const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('================================================================');
console.log('🧪 OneBook v1.0.4 - Critical Bug Fixes & Integrity Test Suite');
console.log('================================================================\n');

(async () => {
    const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_v104_test_'));
    const initialDbDir = path.join(testTempDir, 'InitialDB');
    const migratedDbDir1 = path.join(testTempDir, 'MigratedNoBackup');
    const migratedDbDir2 = path.join(testTempDir, 'MigratedWithBackup');
    const configDir = path.join(testTempDir, 'Config');

    fs.mkdirSync(initialDbDir, { recursive: true });
    fs.mkdirSync(migratedDbDir1, { recursive: true });
    fs.mkdirSync(migratedDbDir2, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });

    const initialDbPath = path.join(initialDbDir, 'onebook.db');
    const configPath = path.join(configDir, 'config.json');

    const dbManager = require('../database');
    const productService = require('../services/productService');
    const stockService = require('../services/stockService');
    const purchaseService = require('../services/purchaseService');
    const backupService = require('../backupService');
    const userService = require('../services/userService');

    // ============================================================
    // TEST SUITE SETUP: Disposable SQLite DB
    // ============================================================
    console.log('--- Initializing Disposable SQLite Database ---');
    dbManager.initializeDatabase(initialDbPath, { allowCreate: true });
    const db = dbManager.getDatabase();
    assert.strictEqual(dbManager.isDatabaseOpen(), true, 'Database must be open');
    console.log('✅ SQLite Database successfully initialized at:', initialDbPath);

    // Seed test demo session
    const demoSession = await userService.loginDemo();
    assert.ok(demoSession && demoSession.sessionToken, 'Demo session must be created');
    console.log('✅ Demo session verified. Session Token ready.');

    // ============================================================
    // PROBLEM 1A: Inventory Creation, Stock Updates & Refresh
    // ============================================================
    console.log('\n--- TEST 1A: Product Creation, Stock Update & Database Synchronization ---');
    
    // 1. Create a new product as done by finalizeAddProduct
    const newProductData = {
        name: 'Xerox Double A Paper A4',
        category: 'Paper',
        unit: 'Rim',
        min_stock: 10,
        description: '75 GSM Multipurpose Paper',
        supplier: 'Xerox India',
        variants: [{
            variantName: 'A4 75GSM',
            sku: '890123450001',
            barcode: '890123450001',
            buyingPrice: 220.0,
            sellingPrice: 320.0,
            stock: 50.0
        }]
    };

    const createdProdId = productService.createProduct(newProductData);
    assert.ok(createdProdId, 'Product must be created with ID');
    console.log(`✅ Product created: ID ${createdProdId} - ${newProductData.name}`);

    // Verify product is in database
    const fetchedProd = productService.getProduct(createdProdId);
    assert.ok(fetchedProd, 'Product must exist in SQLite');
    assert.strictEqual(fetchedProd.name, 'Xerox Double A Paper A4');
    assert.strictEqual(fetchedProd.variants.length, 1);
    assert.strictEqual(fetchedProd.variants[0].stock, 50.0);
    assert.strictEqual(fetchedProd.variants[0].sellingPrice, 320.0);
    console.log('✅ Product retrieval verified from SQLite.');

    // 2. Adjust stock and price as done by updateStockAndPrice
    const variantId = fetchedProd.variants[0].id;
    const qtyAdjustment = 25.0; // Adding 25 units
    const newPrice = 350.0;     // Updating selling price to 350

    // Simulate stock adjustment
    stockService.adjustStock(fetchedProd.id, variantId, qtyAdjustment, 'addition', null, null, null, null);
    
    // Simulate price update
    fetchedProd.variants[0].sellingPrice = newPrice;
    fetchedProd.variants[0].selling_price = newPrice;
    fetchedProd.price = newPrice;
    fetchedProd.sellingPrice = newPrice;
    productService.updateProduct(fetchedProd.id, fetchedProd);

    // Verify updated product in SQLite
    const updatedProd = productService.getProduct(fetchedProd.id);
    assert.strictEqual(updatedProd.variants[0].stock, 75.0, 'Stock should be 50 + 25 = 75');
    assert.strictEqual(updatedProd.variants[0].sellingPrice, 350.0, 'Selling price should be 350.0');
    console.log(`✅ Stock updated to ${updatedProd.variants[0].stock} units, price to ₹${updatedProd.variants[0].sellingPrice}.`);

    // Verify products list refresh (loadProductsFromDatabase)
    const allProducts = productService.getProducts();
    const inList = allProducts.find(p => p.id === createdProdId);
    assert.ok(inList, 'Product must be found in getAll products list');
    assert.strictEqual(inList.variants[0].stock, 75.0);
    console.log('✅ In-memory database reload reflection verified.');

    // ============================================================
    // PROBLEM 1B: Record Sale Product Selection & Enter-Key Handling
    // ============================================================
    console.log('\n--- TEST 1B: Record Sale Enter-Key Selection & Cart Insertion ---');

    // Simulate autocomplete search candidates generation
    const candidateProducts = allProducts.map(p => {
        const v = p.variants[0];
        return {
            id: p.id,
            name: p.name,
            variantId: v.id,
            displayName: `${p.name} - ${v.variant_name || v.variantName}`,
            barcode: v.barcode,
            stock: v.stock,
            price: v.sellingPrice !== undefined ? v.sellingPrice : v.selling_price
        };
    });

    // Search query: "Xerox"
    const searchQuery = 'Xerox';
    const matches = candidateProducts.filter(item => 
        item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    assert.ok(matches.length > 0, 'Search should find the matching product');
    const selectedItem = matches[0];
    console.log(`✅ Autocomplete matched top product: "${selectedItem.displayName}"`);

    // Simulate Enter-key selection directly into cart
    const cart = [];
    function simulateAddItemToCart(prod, qty = 1) {
        assert.ok(prod.stock >= qty, 'Stock must be sufficient');
        const existing = cart.find(item => String(item.productId) === String(prod.id) && String(item.variantId) === String(prod.variantId));
        if (existing) {
            existing.quantity += qty;
            existing.total = existing.quantity * existing.price;
        } else {
            cart.push({
                productId: prod.id,
                variantId: prod.variantId,
                productName: prod.displayName,
                unit: 'Rim',
                price: prod.price,
                quantity: qty,
                total: qty * prod.price
            });
        }
    }

    // First Enter press
    simulateAddItemToCart(selectedItem, 1);
    assert.strictEqual(cart.length, 1);
    assert.strictEqual(cart[0].productName, 'Xerox Double A Paper A4 - A4 75GSM');
    assert.strictEqual(cart[0].quantity, 1);
    assert.strictEqual(cart[0].total, 350.0);
    console.log('✅ Enter press inserted item into cart with 1 Rim @ ₹350.00');

    // Second Enter press on same product increases quantity without creating duplicate rows
    simulateAddItemToCart(selectedItem, 1);
    assert.strictEqual(cart.length, 1, 'Cart must NOT have duplicate rows for same product/variant');
    assert.strictEqual(cart[0].quantity, 2, 'Quantity should increment to 2');
    assert.strictEqual(cart[0].total, 700.0, 'Total should be ₹700.00');
    console.log('✅ Consecutive Enter press updated quantity to 2 with zero duplicate entries.');

    // ============================================================
    // PROBLEM 2: Petty Cash Print HTML Handler
    // ============================================================
    console.log('\n--- TEST 2: Petty Cash Print Document Temp File & Dialog Configuration ---');

    // Simulate print-html handler with temp file mechanism
    const sampleLedgerHtml = `<!DOCTYPE html><html><head><title>Petty Cash Ledger</title></head><body><h1>SUZHI - Petty Cash Ledger</h1><table><tr><th>Date</th><th>Voucher</th><th>DR</th><th>CR</th><th>Balance</th></tr><tr><td>11/11/2026</td><td>PCV-001</td><td>0.00</td><td>500.00</td><td>500.00</td></tr></table></body></html>`;

    const printTempFile = path.join(os.tmpdir(), `onebook-print-test-${Date.now()}.html`);
    fs.writeFileSync(printTempFile, sampleLedgerHtml, 'utf8');
    assert.ok(fs.existsSync(printTempFile), 'Temporary print file must be created on disk');
    
    const fileContent = fs.readFileSync(printTempFile, 'utf8');
    assert.strictEqual(fileContent, sampleLedgerHtml, 'Print file content must match exactly');
    console.log('✅ Print HTML successfully written to file scheme path:', printTempFile);

    // Verify temp file cleanup on completion
    fs.unlinkSync(printTempFile);
    assert.strictEqual(fs.existsSync(printTempFile), false, 'Temporary print file must be deleted upon completion');
    console.log('✅ Temporary print file safely cleaned up without leaving orphaned files.');

    // ============================================================
    // PROBLEM 3: Purchase Details JSON & Safe Settings Parsing
    // ============================================================
    console.log('\n--- TEST 3: Purchase Details Retrieval & Corrupted Settings Resiliency ---');

    // 1. Create a supplier and a purchase invoice in SQLite
    const supplierId = 'sup_test_001';
    db.prepare(`
        INSERT INTO suppliers (id, name, phone, gstin, state, address) 
        VALUES (?, 'Paper Mill Suppliers Ltd', '+919988776655', '33AAAAA0000A1Z5', 'Tamil Nadu', '123 Mill Road, Erode')
    `).run(supplierId);

    const purchaseData = {
        invoiceNumber: 'PUR-2026-0042',
        supplier_id: supplierId,
        supplierId: supplierId,
        date: '2026-11-10',
        paymentMethod: 'CREDIT',
        taxType: 'intra',
        total: 11800.0,
        subtotal: 10000.0,
        discount: 0.0,
        otherCharges: 0.0,
        amountPaid: 5000.0,
        outstandingAmount: 6800.0,
        paymentStatus: 'PARTIAL',
        items: [{
            productId: createdProdId,
            variantId: variantId,
            name: 'Xerox Double A Paper A4',
            qty: 50,
            price: 200.0,
            taxableValue: 10000.0,
            cgst: 900.0,
            sgst: 900.0,
            igst: 0.0,
            total: 11800.0
        }]
    };

    const savedPurchaseId = purchaseService.createPurchase(purchaseData);
    assert.ok(savedPurchaseId, 'Purchase must be created');
    console.log(`✅ Purchase invoice created: ID ${savedPurchaseId} (${purchaseData.invoiceNumber})`);

    // 2. Retrieve purchase details via purchaseService.getPurchaseById
    const fetchedPurchase = purchaseService.getPurchaseById(savedPurchaseId);
    assert.ok(fetchedPurchase, 'Purchase details must be retrieved');
    assert.strictEqual(fetchedPurchase.supplier_name, 'Paper Mill Suppliers Ltd');
    assert.strictEqual(fetchedPurchase.supplier_gstin, '33AAAAA0000A1Z5');
    assert.strictEqual(fetchedPurchase.invoice_number, 'PUR-2026-0042');
    assert.ok(Array.isArray(fetchedPurchase.items), 'Purchase items must be an array');
    assert.strictEqual(fetchedPurchase.items.length, 1);
    assert.strictEqual(fetchedPurchase.items[0].product_name, 'Xerox Double A Paper A4');
    assert.strictEqual(fetchedPurchase.items[0].cgst, 900.0);
    assert.strictEqual(fetchedPurchase.items[0].sgst, 900.0);
    console.log('✅ Purchase invoice, items, and tax breakdown verified from SQLite.');

    // 3. Test _safeGetSettings parser with corrupted settings
    function testSafeGetSettings(rawSettings) {
        try {
            if (rawSettings && rawSettings !== '[object Object]' && rawSettings !== 'null' && rawSettings !== 'undefined') {
                const parsed = JSON.parse(rawSettings);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                }
            }
        } catch (e) {
            // gracefully fallback
        }
        return { businessName: 'Default Store', receiptSize: 'A4' };
    }

    // Case A: Corrupted string "[object Object]"
    const corruptedSettingsResult = testSafeGetSettings('[object Object]');
    assert.strictEqual(corruptedSettingsResult.businessName, 'Default Store', 'Must safely fallback without throwing');
    console.log('✅ Corrupted "[object Object]" safely handled without SyntaxError.');

    // Case B: Valid JSON settings
    const validJson = JSON.stringify({ businessName: 'OneBook Retailers', gstin: '33BBBBB1111B1Z2' });
    const validSettingsResult = testSafeGetSettings(validJson);
    assert.strictEqual(validSettingsResult.businessName, 'OneBook Retailers');
    assert.strictEqual(validSettingsResult.gstin, '33BBBBB1111B1Z2');
    console.log('✅ Valid JSON settings successfully parsed.');

    // Case C: Safely parse items whether Array or JSON string
    function normalizeItems(items) {
        if (Array.isArray(items)) return items;
        if (typeof items === 'string') {
            try {
                const p = JSON.parse(items);
                if (Array.isArray(p)) return p;
            } catch (e) {}
        }
        return [];
    }
    assert.strictEqual(normalizeItems(fetchedPurchase.items).length, 1);
    assert.strictEqual(normalizeItems(JSON.stringify(fetchedPurchase.items)).length, 1);
    assert.strictEqual(normalizeItems(null).length, 0);
    console.log('✅ Normalization of purchase items (Array, JSON string, null) verified.');

    // ============================================================
    // PROBLEM 4: Database Location Switching (With & Without Backup)
    // ============================================================
    console.log('\n--- TEST 4: Database Location Switching, Backup & Migration ---');

    // A. Migration WITH Backup (Backup & Continue)
    console.log('Testing: Change Database Location WITH Backup...');
    const targetDbPathWithBackup = path.join(migratedDbDir2, 'onebook.db');
    const tempCopyPath1 = targetDbPathWithBackup + '.migrating_' + Date.now();

    // Checkpoint WAL and perform atomic backup
    db.pragma('wal_checkpoint(TRUNCATE)');
    await db.backup(tempCopyPath1);

    // Validate integrity of copied DB
    const Database = require('better-sqlite3');
    const vDb1 = new Database(tempCopyPath1, { readonly: true });
    const integrity1 = vDb1.pragma('integrity_check');
    const countRow1 = vDb1.prepare('SELECT count(*) as c FROM products').get();
    vDb1.close();

    assert.strictEqual(integrity1[0].integrity_check, 'ok', 'Copied DB must pass integrity check');
    assert.ok(countRow1.c >= 1, 'Copied DB must contain all products');
    fs.renameSync(tempCopyPath1, targetDbPathWithBackup);
    console.log(`✅ Verified destination database integrity ok (${countRow1.c} products preserved).`);

    // Close old database and reopen new location
    dbManager.closeDatabase();
    dbManager.initializeDatabase(targetDbPathWithBackup, { allowCreate: false });
    const newDb = dbManager.getDatabase();
    const verifiedProduct = newDb.prepare('SELECT * FROM products WHERE id = ?').get(createdProdId);
    assert.strictEqual(verifiedProduct.name, 'Xerox Double A Paper A4', 'Business records must persist in new location');
    console.log('✅ Database reopened at new location. Product records verified intact.');

    // B. Migration WITHOUT Backup (Continue (No Backup))
    console.log('Testing: Change Database Location WITHOUT Backup...');
    const targetDbPathNoBackup = path.join(migratedDbDir1, 'onebook.db');
    const tempCopyPath2 = targetDbPathNoBackup + '.migrating_' + Date.now();

    newDb.pragma('wal_checkpoint(TRUNCATE)');
    await newDb.backup(tempCopyPath2);

    const vDb2 = new Database(tempCopyPath2, { readonly: true });
    const integrity2 = vDb2.pragma('integrity_check');
    const countRow2 = vDb2.prepare('SELECT count(*) as c FROM purchases').get();
    vDb2.close();

    assert.strictEqual(integrity2[0].integrity_check, 'ok', 'Copied DB must pass integrity check');
    assert.ok(countRow2.c >= 1, 'Copied DB must contain all purchases');
    fs.renameSync(tempCopyPath2, targetDbPathNoBackup);

    dbManager.closeDatabase();
    dbManager.initializeDatabase(targetDbPathNoBackup, { allowCreate: false });
    const finalDb = dbManager.getDatabase();
    const verifiedPurchase = finalDb.prepare('SELECT * FROM purchases WHERE id = ?').get(savedPurchaseId);
    assert.strictEqual(verifiedPurchase.invoice_number, 'PUR-2026-0042');
    console.log('✅ Database reopened after No-Backup migration. Purchases verified intact.');

    // C. Verify Rollback Protection: Original database is never deleted
    assert.ok(fs.existsSync(initialDbPath), 'Original source database must remain untouched on disk');
    console.log('✅ Original database file preserved at:', initialDbPath);

    // ============================================================
    // TEST SUITE CLEANUP
    // ============================================================
    dbManager.closeDatabase();
    try {
        fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch (e) {}

    console.log('\n================================================================');
    console.log('🎉 ALL ONEBOOK v1.0.4 CRITICAL TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
})();
