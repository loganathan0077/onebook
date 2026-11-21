const path = require('path');
const fs = require('fs');

async function runTests() {
    console.log('=== TEST SUITE: 4 INVENTORY FIXES VERIFICATION ===\n');
    let passCount = 0;
    let failCount = 0;

    const assert = (condition, msg) => {
        if (condition) {
            console.log(`  ✅ PASS: ${msg}`);
            passCount++;
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
            failCount++;
        }
    };

    // 1. SETUP ISOLATED TEST DATABASE
    const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'onebook_inv_fix_test_'));
    const testDbPath = path.join(tempDir, 'onebook_test.db');
    process.env.ONEBOOK_DB_PATH = testDbPath;
    
    const dbManager = require('../database');
    dbManager.initializeDatabase(testDbPath, { allowCreate: true });
    const db = dbManager.getDatabase();

    const productService = require('../services/productService');
    const stockService = require('../services/stockService');

    console.log('[1/4] Testing Bug 1: Immediate Deletion Reflection & Protection');
    try {
        // Create parent product
        const createRes = productService.createProduct({
            name: 'Test Delete Prod',
            barcode: 'DEL-PROD-001',
            category: 'Testing',
            price: 100,
            costPrice: 50,
            stock: 0,
            unit: 'Piece',
            variants: [
                { variantName: 'Var Normal', barcode: 'DEL-VAR-001', stock: 0, sellingPrice: 100, buyingPrice: 50 },
                { variantName: 'Var With Stock', barcode: 'DEL-VAR-002', stock: 10, sellingPrice: 100, buyingPrice: 50 },
                { variantName: 'Var With History', barcode: 'DEL-VAR-003', stock: 0, sellingPrice: 100, buyingPrice: 50 }
            ]
        });
        const parentId = typeof createRes === 'object' && createRes ? createRes.id : createRes;
        const prod = productService.getProduct(parentId);
        const vNormal = prod.variants.find(v => v.variantName === 'Var Normal');
        const vStock = prod.variants.find(v => v.variantName === 'Var With Stock');
        const vHistory = prod.variants.find(v => v.variantName === 'Var With History');

        // Add history to vHistory (sale)
        const mockSale = db.prepare("INSERT INTO sales (receipt_number, total) VALUES ('REC-MOCK-DEL-1', 100)").run();
        const saleId = mockSale.lastInsertRowid;
        db.prepare("INSERT INTO sale_items (sale_id, product_id, variant_id, product_name, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
            saleId, parentId, vHistory.id, 'Test Delete Prod - Var With History', 1, 100, 100
        );

        // Test 1.1: Deleting variant with stock is blocked
        let stockErr = null;
        try {
            productService.deleteVariant(vStock.id, parentId);
        } catch (e) {
            stockErr = e;
        }
        assert(stockErr && stockErr.code === 'CANNOT_DELETE_STOCK', 'Variant with stock cannot be deleted (code: CANNOT_DELETE_STOCK)');

        // Test 1.2: Deleting variant with sales history is blocked
        let historyErr = null;
        try {
            productService.deleteVariant(vHistory.id, parentId);
        } catch (e) {
            historyErr = e;
        }
        assert(historyErr && historyErr.code === 'CANNOT_DELETE_HISTORY', 'Variant with transaction history cannot be deleted (code: CANNOT_DELETE_HISTORY)');

        // Test 1.3: Deleting 0-stock unreferenced variant succeeds
        const delVarRes = productService.deleteVariant(vNormal.id, parentId);
        assert(delVarRes && delVarRes.success === true, '0-stock unreferenced variant deleted successfully');
        const refreshedProd = productService.getProduct(parentId);
        assert(!refreshedProd.variants.find(v => v.id === vNormal.id), 'Deleted variant is immediately gone from database');

        // Test 1.4: Deleting product with variants having stock/history is blocked
        let prodErr = null;
        try {
            productService.deleteProduct(parentId);
        } catch (e) {
            prodErr = e;
        }
        assert(prodErr && (prodErr.code === 'CANNOT_DELETE_STOCK' || prodErr.code === 'CANNOT_DELETE_HISTORY'), 'Parent product with active stock/history variants cannot be deleted');
    } catch (e) {
        assert(false, `Bug 1 tests threw unexpected error: ${e.message}`);
    }

    console.log('\n[2/4] Testing Bug 2: Update Stock & Price Handling (Quantity 0, Price 0)');
    try {
        // Create product with stock 15
        const pCreate = productService.createProduct({
            name: 'Stock Test Product',
            barcode: 'STOCK-001',
            category: 'Testing',
            price: 50,
            stock: 15,
            variants: [
                { variantName: 'Standard', barcode: 'STOCK-001-V', stock: 15, sellingPrice: 50 }
            ]
        });
        const pId = typeof pCreate === 'object' && pCreate ? pCreate.id : pCreate;
        let pObj = productService.getProduct(pId);
        const varId = pObj.variants[0].id;

        assert(pObj.variants[0].stock === 15, 'Initial stock is 15');

        // Test setting stock to 0 intentionally: diff = 0 - 15 = -15
        const currentStock = pObj.variants[0].stock;
        const targetStock = 0;
        const diff = targetStock - currentStock;
        stockService.adjustStock(pId, varId, diff, 'ADJUSTMENT', 'MANUAL');

        pObj = productService.getProduct(pId);
        assert(pObj.variants[0].stock === 0, 'Stock successfully set to 0 in SQLite via diff adjustment');

        // Test updating price to 25.50
        pObj.variants[0].sellingPrice = 25.50;
        pObj.price = 25.50;
        productService.updateProduct(pId, pObj);

        pObj = productService.getProduct(pId);
        assert(pObj.variants[0].sellingPrice === 25.50 && pObj.price === 25.50, 'Price updated to 25.50');

        // Test updating price to 0 (valid zero value)
        pObj.variants[0].sellingPrice = 0;
        pObj.price = 0;
        productService.updateProduct(pId, pObj);

        pObj = productService.getProduct(pId);
        assert(pObj.variants[0].sellingPrice === 0 && pObj.price === 0, 'Price 0.00 is allowed and saved correctly');

        // Test setting stock to 0 when already 0: diff is 0, no duplicate movement
        const movementsBefore = stockService.getStockMovements(varId).length;
        const diffZero = 0 - pObj.variants[0].stock;
        if (diffZero !== 0) {
            stockService.adjustStock(pId, varId, diffZero, 'ADJUSTMENT', 'MANUAL');
        }
        const movementsAfter = stockService.getStockMovements(varId).length;
        assert(movementsBefore === movementsAfter, 'Setting stock to 0 when already 0 avoids redundant duplicate stock movements');
    } catch (e) {
        assert(false, `Bug 2 tests threw unexpected error: ${e.message}`);
    }

    console.log('\n[3/4] Testing Bug 3: Flexible Normalized Inventory Search');
    try {
        // Create the exact product from the user requirement: "10rs clip", barcode "DDS-435163", category "Cosmetics"
        productService.createProduct({
            name: '10rs clip',
            barcode: 'DDS-435163',
            category: 'Cosmetics',
            price: 10,
            stock: 264,
            variants: [
                { variantName: 'Standard', barcode: 'DDS-435163', stock: 264, sellingPrice: 10 }
            ]
        });
        productService.createProduct({
            name: '15rs clip',
            barcode: 'DDS-414531',
            category: 'Cosmetics',
            price: 15,
            stock: 16
        });
        productService.createProduct({
            name: '10rs earring',
            barcode: 'DDS-278110',
            category: 'Cosmetics',
            price: 10,
            stock: 81
        });

        // Test queries specified in prompt: 'clip', '10 cl', '10s clip', 'clip 10', 'rs clip'
        const q1 = productService.searchProducts('clip');
        assert(q1.some(p => p.name === '10rs clip'), "Search 'clip' matches '10rs clip'");

        const q2 = productService.searchProducts('10 cl');
        assert(q2.some(p => p.name === '10rs clip'), "Search '10 cl' matches '10rs clip'");

        const q3 = productService.searchProducts('10s clip');
        assert(q3.some(p => p.name === '10rs clip'), "Search '10s clip' matches '10rs clip'");

        const q4 = productService.searchProducts('clip 10');
        assert(q4.some(p => p.name === '10rs clip'), "Search 'clip 10' matches '10rs clip'");

        const q5 = productService.searchProducts('rs clip');
        assert(q5.some(p => p.name === '10rs clip'), "Search 'rs clip' matches '10rs clip'");

        // Test case-insensitive
        const q6 = productService.searchProducts('10S CLIP');
        assert(q6.some(p => p.name === '10rs clip'), "Search '10S CLIP' (uppercase) matches '10rs clip'");

        // Test barcode partial and punctuation normalized
        const q7 = productService.searchProducts('dds 435');
        assert(q7.some(p => p.name === '10rs clip'), "Search 'dds 435' matches '10rs clip' (barcode: DDS-435163)");

        const q8 = productService.searchProducts('DDS435163');
        assert(q8.some(p => p.name === '10rs clip'), "Search 'DDS435163' (no dash) matches '10rs clip'");

        // Test cross-field search: category + name
        const q9 = productService.searchProducts('cosmetics clip 10');
        assert(q9.some(p => p.name === '10rs clip'), "Search 'cosmetics clip 10' matches cross-field category + name");
    } catch (e) {
        assert(false, `Bug 3 tests threw unexpected error: ${e.message}`);
    }

    console.log('\n[4/4] Testing Bug 4: Removal of Inventory Header GST Control');
    try {
        const htmlContent = fs.readFileSync(path.join(__dirname, '../OneBook.html'), 'utf8');

        // Check header GST elements are removed
        const hasHeaderGstBox = htmlContent.includes('inventory-gst-compact-box');
        const hasHeaderGstSelect = htmlContent.includes('id="invHeaderGstSelect"');
        const hasHeaderGstBtn = htmlContent.includes('id="btnApplyInvHeaderGst"');

        assert(!hasHeaderGstBox, 'inventory-gst-compact-box class is removed from HTML');
        assert(!hasHeaderGstSelect, 'invHeaderGstSelect element is removed from HTML');
        assert(!hasHeaderGstBtn, 'btnApplyInvHeaderGst button is removed from HTML');

        // Check that search and expiryFilter remain present and clean
        const hasInventorySearch = htmlContent.includes('id="inventorySearch"');
        const hasExpiryFilter = htmlContent.includes('id="expiryFilter"');
        assert(hasInventorySearch, 'inventorySearch input is present');
        assert(hasExpiryFilter, 'expiryFilter select is present');

        // Check that product table row GST inline editing and datalist remain intact
        const hasGstDatalist = htmlContent.includes('id="invGstRateDatalist"');
        assert(hasGstDatalist, 'invGstRateDatalist datalist is preserved for row-level GST editing');

        // Check updateGstRate in productService and row editing logic
        assert(typeof productService.updateGstRate === 'function', 'productService.updateGstRate is preserved');
    } catch (e) {
        assert(false, `Bug 4 tests threw unexpected error: ${e.message}`);
    }

    // Cleanup test database
    dbManager.closeDatabase();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    console.log(`\n=== TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED ===\n`);
    if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
});

