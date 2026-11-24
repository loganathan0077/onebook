const assert = require('assert');
const path = require('path');
const fs = require('fs');

// We use the application's database and services
const dbManager = require('../database');
const productService = require('../services/productService');
const stockService = require('../services/stockService');

async function runTests() {
    console.log('🧪 Starting Product & Inventory Synchronization Tests...\n');
    
    // Test database path
    const testDbPath = path.join(__dirname, 'test_sync.db');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    // Initialize database
    dbManager.initializeDatabase(testDbPath, { allowCreate: true });
    const db = dbManager.getDatabase();

    try {
        // Setup initial test data
        console.log('1. Setting up test data: sheet (1 variant) & laptop (default variant)');
        
        // 1. sheet: parent product + 1 variant (blue)
        db.prepare(`
            INSERT INTO products (id, name, barcode, category, unit, price, cost_price, stock)
            VALUES (1, 'sheet', '', 'Garments', 'Box', 0, 250, 1)
        `).run();
        db.prepare(`
            INSERT INTO product_variants (id, product_id, variant_name, barcode, selling_price, buying_price, stock)
            VALUES (1, 1, 'blue', 'DDS-310857', 345.0, 250.0, 342.0)
        `).run();

        // 2. laptop: product with 2 variants: base variant (laptop) + added variant (laptop - m4)
        db.prepare(`
            INSERT INTO products (id, name, barcode, category, unit, price, cost_price, stock)
            VALUES (2, 'laptop', '', 'Electrical', 'Piece', 0, 0, 0)
        `).run();
        db.prepare(`
            INSERT INTO product_variants (id, product_id, variant_name, barcode, selling_price, buying_price, stock)
            VALUES (2, 2, '', 'DDS-145421', 100.0, 0.0, 1000.0)
        `).run();
        db.prepare(`
            INSERT INTO product_variants (id, product_id, variant_name, barcode, selling_price, buying_price, stock)
            VALUES (3, 2, 'm4', 'DDS-9291482', 150.0, 0.0, 34.0)
        `).run();

        // 3. simple product with no variants
        db.prepare(`
            INSERT INTO products (id, name, barcode, category, unit, price, cost_price, stock)
            VALUES (4, 'notebook', 'BOOK-101', 'Stationery', 'Piece', 50.0, 30.0, 200.0)
        `).run();

        // Test database sync logic
        console.log('2. Testing database synchronization query...');
        db.exec(`
            UPDATE products 
            SET stock = (SELECT COALESCE(SUM(stock), 0) FROM product_variants WHERE product_id = products.id) 
            WHERE EXISTS (SELECT 1 FROM product_variants WHERE product_id = products.id);

            UPDATE products 
            SET price = (SELECT selling_price FROM product_variants WHERE product_id = products.id AND selling_price > 0 ORDER BY id ASC LIMIT 1) 
            WHERE (price = 0 OR price IS NULL) 
              AND EXISTS (SELECT 1 FROM product_variants WHERE product_id = products.id AND selling_price > 0);

            UPDATE products 
            SET barcode = (SELECT barcode FROM product_variants WHERE product_id = products.id AND barcode IS NOT NULL AND barcode != '' ORDER BY id ASC LIMIT 1) 
            WHERE (barcode IS NULL OR barcode = '') 
              AND EXISTS (SELECT 1 FROM product_variants WHERE product_id = products.id AND barcode IS NOT NULL AND barcode != '');
        `);

        // Check products table in database
        const p1 = db.prepare('SELECT * FROM products WHERE id = 1').get();
        assert.strictEqual(p1.stock, 342, 'sheet stock in products table should be synced to 342');
        assert.strictEqual(p1.price, 345, 'sheet price in products table should be synced to 345');
        assert.strictEqual(p1.barcode, 'DDS-310857', 'sheet barcode should be DDS-310857');

        const p2 = db.prepare('SELECT * FROM products WHERE id = 2').get();
        assert.strictEqual(p2.stock, 1034, 'laptop stock in products table should be synced to 1034 (1000 + 34)');
        assert.strictEqual(p2.price, 100, 'laptop price in products table should be synced to 100');
        assert.strictEqual(p2.barcode, 'DDS-145421', 'laptop barcode should be DDS-145421');

        console.log('   ✅ Database sync queries verified successfully.');

        // Test productService.getProducts()
        console.log('3. Testing productService.getProducts() returns accurate stock and price...');
        const allProducts = productService.getProducts();
        
        const laptopProd = allProducts.find(p => p.id === 2);
        assert.strictEqual(laptopProd.stock, 1034, 'productService laptop stock should be 1034');
        assert.strictEqual(laptopProd.price, 100, 'productService laptop price should be 100');
        assert.strictEqual(laptopProd.barcode, 'DDS-145421', 'productService laptop barcode should be DDS-145421');

        const sheetProd = allProducts.find(p => p.id === 1);
        assert.strictEqual(sheetProd.stock, 342, 'productService sheet stock should be 342');
        assert.strictEqual(sheetProd.price, 345, 'productService sheet price should be 345');
        assert.strictEqual(sheetProd.barcode, 'DDS-310857', 'productService sheet barcode should be DDS-310857');

        console.log('   ✅ productService.getProducts() verified successfully.');

        // Test StockService.adjustStock syncs products table
        console.log('4. Testing StockService.adjustStock synchronizes products table...');
        stockService.adjustStock(2, 2, 50, 'RESTOCK', 'MANUAL', 'Added 50 laptops');
        const p2AfterStock = db.prepare('SELECT * FROM products WHERE id = 2').get();
        const v2AfterStock = db.prepare('SELECT * FROM product_variants WHERE id = 2').get();
        assert.strictEqual(v2AfterStock.stock, 1050, 'Variant stock should be 1050');
        assert.strictEqual(p2AfterStock.stock, 1084, 'Parent product stock in SQLite should be updated to 1084 (1050 + 34)');

        console.log('   ✅ Stock adjustment synchronization verified.');

        // Test Product Management Table Flattening Logic (matching OneBook.html)
        console.log('5. Testing OneBook.html Product Management table row generation logic...');
        
        function getVariantDisplayName(p, v) {
            let name = p.name || 'Unknown Product';
            const vName = v && v.variantName ? String(v.variantName).trim() : '';
            if (vName && vName.toLowerCase() !== 'default') {
                return `${name} - ${vName}`;
            }
            return name;
        }

        function flattenForProductManagement(rawProducts) {
            const flatItems = [];
            (rawProducts || []).forEach(p => {
                const rawVars = (p.variants || []).map(v => ({
                    id: v.id,
                    productId: p.id,
                    variantName: v.variantName !== undefined ? v.variantName : (v.variant_name !== undefined ? v.variant_name : (v.name || '')),
                    barcode: v.barcode || v.sku || '',
                    sku: v.sku || v.barcode || '',
                    buyingPrice: parseFloat(v.buyingPrice !== undefined ? v.buyingPrice : (v.buying_price || 0)) || 0,
                    sellingPrice: parseFloat(v.sellingPrice !== undefined ? v.sellingPrice : (v.selling_price || 0)) || 0,
                    stock: parseFloat(v.stock !== undefined ? v.stock : 0) || 0,
                    unit: v.unit || p.unit || 'Piece',
                    category: v.category || p.category || 'Uncategorized'
                }));

                const validVars = rawVars.filter(v => {
                    if (rawVars.length <= 1) return true;
                    const hasName = v.variantName && String(v.variantName).trim() !== '' && String(v.variantName).trim().toLowerCase() !== 'default';
                    const hasBarcode = v.barcode && String(v.barcode).trim() !== '';
                    const hasStock = parseFloat(v.stock) > 0;
                    const hasPrice = parseFloat(v.sellingPrice) > 0;
                    return hasName || hasBarcode || hasStock || hasPrice;
                });

                if (validVars.length > 0) {
                    validVars.forEach(v => {
                        const vDisplayName = getVariantDisplayName(p, v);
                        const vBarcode = v.barcode || p.barcode || '—';
                        const vStock = (v.stock !== undefined && v.stock !== null) ? v.stock : 0;
                        const vPrice = (v.sellingPrice !== undefined && v.sellingPrice !== null && v.sellingPrice !== 0) 
                            ? v.sellingPrice 
                            : (parseFloat(p.price !== undefined ? p.price : (p.selling_price || 0)) || 0);

                        flatItems.push({
                            id: v.id,
                            productId: p.id,
                            displayName: vDisplayName,
                            barcode: vBarcode,
                            stock: vStock,
                            price: vPrice,
                            category: v.category || p.category || 'Uncategorized'
                        });
                    });
                } else {
                    flatItems.push({
                        id: p.id,
                        productId: p.id,
                        displayName: p.name,
                        barcode: p.barcode || '—',
                        stock: parseFloat(p.stock) || 0,
                        price: parseFloat(p.price) || 0,
                        category: p.category || 'Uncategorized'
                    });
                }
            });
            return flatItems;
        }

        const flatResults = flattenForProductManagement(productService.getProducts());

        // Check 1: sheet should appear as EXACTLY ONE row
        const sheetRows = flatResults.filter(r => r.displayName.includes('sheet'));
        assert.strictEqual(sheetRows.length, 1, 'sheet must appear as exactly ONE row');
        assert.strictEqual(sheetRows[0].displayName, 'sheet - blue', 'sheet display name should be "sheet - blue"');
        assert.strictEqual(sheetRows[0].barcode, 'DDS-310857', 'sheet barcode must be DDS-310857');
        assert.strictEqual(sheetRows[0].stock, 342, 'sheet stock must be 342');
        assert.strictEqual(sheetRows[0].price, 345, 'sheet price must be 345');

        // Check 2: laptop (original) MUST appear with barcode DDS-145421, stock 1050, price 100
        const laptopRows = flatResults.filter(r => r.displayName === 'laptop');
        assert.strictEqual(laptopRows.length, 1, 'laptop must appear as exactly ONE row');
        assert.strictEqual(laptopRows[0].barcode, 'DDS-145421', 'laptop barcode must be DDS-145421');
        assert.strictEqual(laptopRows[0].stock, 1050, 'laptop stock must be 1050');
        assert.strictEqual(laptopRows[0].price, 100, 'laptop price must be 100');

        // Check 3: laptop - m4 MUST ALSO appear with barcode DDS-9291482, stock 34, price 150
        const m4Rows = flatResults.filter(r => r.displayName === 'laptop - m4');
        assert.strictEqual(m4Rows.length, 1, 'laptop - m4 must appear as exactly ONE row');
        assert.strictEqual(m4Rows[0].barcode, 'DDS-9291482', 'laptop - m4 barcode must be DDS-9291482');
        assert.strictEqual(m4Rows[0].stock, 34, 'laptop - m4 stock must be 34');
        assert.strictEqual(m4Rows[0].price, 150, 'laptop - m4 price must be 150');

        // Check 4: notebook with no variants should appear as 1 row
        const notebookRows = flatResults.filter(r => r.displayName === 'notebook');
        assert.strictEqual(notebookRows.length, 1, 'notebook must appear as exactly 1 row');
        assert.strictEqual(notebookRows[0].stock, 200, 'notebook stock should be 200');

        // Check 5: Total rows for syzhi's 3 items
        const syzhiRows = flatResults.filter(r => r.displayName !== 'notebook');
        assert.strictEqual(syzhiRows.length, 3, 'Must show exactly the three products: laptop, laptop - m4, sheet - blue');
        const displayedNames = syzhiRows.map(r => r.displayName).sort();
        assert.deepStrictEqual(displayedNames, ['laptop', 'laptop - m4', 'sheet - blue'], 'Expected 3 products');

        console.log('   ✅ All Product Management table display checks passed successfully!');

        console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
    } finally {
        dbManager.closeDatabase();
        if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    }
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
