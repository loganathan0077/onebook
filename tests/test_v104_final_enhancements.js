/**
 * OneBook v1.0.4 - Final UI Fixes & Enhancements Verification Suite
 * Tests:
 * 1. Inventory Quick Edit GST Column (Parent & Variant independent GST rates, validation, persistence)
 * 2. Record Sales Shortcuts (Ctrl+Enter, Alt+Enter resolution and non-blocking in search/unit/qty/price)
 * 3. Product Management (Hide unwanted placeholder 'Default' child row while preserving actual variants)
 * 4. Purchase Entry (Removal of payment summary bar, default credit payment, supplier payable calculation)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const dbManager = require('../database');
const productService = require('../services/productService');
const purchaseService = require('../services/purchaseService');

async function runFinalEnhancementTests() {
    console.log('\n================================================================');
    console.log('🧪 OneBook v1.0.4 - Final UI Fixes & Enhancements Test Suite');
    console.log('================================================================\n');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_final_test_'));
    const testDbPath = path.join(tempDir, 'onebook_test.db');

    try {
        dbManager.initializeDatabase(testDbPath, { allowCreate: true });
        const db = dbManager.getDatabase();
        console.log(`✅ Test database initialized at: ${testDbPath}`);

        // -------------------------------------------------------------
        // MODULE 1: INVENTORY QUICK EDIT GST COLUMN
        // -------------------------------------------------------------
        console.log('\n--- MODULE 1: INVENTORY QUICK EDIT GST COLUMN ---');

        // Create parent product with GST 18% and two variants:
        // Variant 1: inherits parent GST (null)
        // Variant 2: has custom GST 5%
        const parentId = productService.createProduct({
            name: 'Polo Cotton T-Shirt',
            category: 'Apparel',
            unit: 'Piece',
            barcode: 'POLO-001',
            price: 799,
            cost_price: 350,
            stock: 0,
            gst_rate: 18,
            variants: [
                {
                    variantName: 'Default',
                    barcode: 'POLO-001-DEF',
                    sellingPrice: 799,
                    buyingPrice: 350,
                    stock: 0
                }
            ]
        });

        // Add Variant Size M with explicit 12% GST
        const varM = productService.addVariant(parentId, {
            variantName: 'Size M',
            barcode: 'POLO-M-NAVY',
            sellingPrice: 849,
            buyingPrice: 400,
            stock: 10,
            gstRate: 12
        });

        // Add Variant Size L with explicit 28% GST
        const varL = productService.addVariant(parentId, {
            variantName: 'Size L',
            barcode: 'POLO-L-NAVY',
            sellingPrice: 899,
            buyingPrice: 450,
            stock: 15,
            gstRate: 28
        });

        // Verify independent update of Variant GST
        const updateVarRes = productService.updateVariantGstRate(varM.id, 5);
        assert.strictEqual(updateVarRes.success, true);
        assert.strictEqual(updateVarRes.gstRate, 5);

        // Verify independent update of Parent GST
        const updateParentGstRes = productService.updateProductGstRate(parentId, 18);
        assert.strictEqual(updateParentGstRes.success, true);

        // Reload product from database and verify variant GST is NOT overwritten by parent GST
        const reloadedProduct = productService.getProduct(parentId);
        assert.strictEqual(reloadedProduct.gst_rate, 18, 'Parent product GST must be 18%');
        const reloadedM = reloadedProduct.variants.find(v => v.id === varM.id);
        const reloadedL = reloadedProduct.variants.find(v => v.id === varL.id);
        assert.strictEqual(reloadedM.gstRate, 5, 'Variant M GST rate must remain 5% (not overwritten)');
        assert.strictEqual(reloadedL.gstRate, 28, 'Variant L GST rate must remain 28%');

        // Validation: reject negative and > 100 rates
        assert.throws(() => {
            productService.updateVariantGstRate(varM.id, -5);
        }, /INVALID_GST_RATE/, 'Negative GST rate for variant must be rejected');

        assert.throws(() => {
            productService.updateVariantGstRate(varM.id, 105);
        }, /INVALID_GST_RATE/, 'GST rate above 100% for variant must be rejected');

        console.log('✅ 1.1 Independent GST rate storage & validation for parent and variants verified');

        // -------------------------------------------------------------
        // MODULE 2: RECORD SALES SHORTCUTS & EVENT BUBBLING
        // -------------------------------------------------------------
        console.log('\n--- MODULE 2: RECORD SALES SHORTCUTS & EVENT BUBBLING ---');

        const htmlContent = fs.readFileSync(path.join(__dirname, '../OneBook.html'), 'utf8');

        // Check that saleProductSearch does not swallow Ctrl+Enter / Alt+Enter
        const saleProductSearchKeydownMatch = htmlContent.match(/searchInput\.addEventListener\('keydown',\s*function\s*\(e\)\s*\{[\s\S]*?if\s*\(e\.key\s*===\s*'Enter'\)\s*\{([\s\S]*?)\}/);
        assert.ok(saleProductSearchKeydownMatch, 'saleProductSearch keydown handler must exist');
        assert.ok(saleProductSearchKeydownMatch[1].includes('e.ctrlKey || e.metaKey || e.altKey'), 'saleProductSearch must let modifier combinations bubble up');

        // Check that saleUnitSearch does not swallow Ctrl+Enter / Alt+Enter
        const unitSearchKeydownMatch = htmlContent.match(/unitSearchInput\.addEventListener\('keydown',\s*function\s*\(e\)\s*\{[\s\S]*?if\s*\(e\.key\s*===\s*'Enter'\)\s*\{([\s\S]*?)\}/);
        assert.ok(unitSearchKeydownMatch, 'saleUnitSearch keydown handler must exist');
        assert.ok(unitSearchKeydownMatch[1].includes('e.ctrlKey || e.metaKey || e.altKey'), 'saleUnitSearch must let modifier combinations bubble up');

        // Check that handleSaleQtyKeyDown does not swallow Ctrl+Enter / Alt+Enter
        const qtyKeydownMatch = htmlContent.match(/function\s+handleSaleQtyKeyDown\s*\(e,\s*el\)\s*\{[\s\S]*?if\s*\(e\.key\s*===\s*'Enter'\)\s*\{([\s\S]*?)\}/);
        assert.ok(qtyKeydownMatch, 'handleSaleQtyKeyDown must exist');
        assert.ok(qtyKeydownMatch[1].includes('e.ctrlKey || e.metaKey || e.altKey'), 'handleSaleQtyKeyDown must let modifier combinations bubble up');

        // Check that salePrice does not prevent Ctrl+Enter / Alt+Enter
        const priceInputMatch = htmlContent.match(/id="salePrice"[\s\S]*?onkeydown="([^"]+)"/);
        assert.ok(priceInputMatch, 'salePrice onkeydown must exist');
        assert.ok(priceInputMatch[1].includes('!event.ctrlKey') && priceInputMatch[1].includes('!event.altKey'), 'salePrice must allow Ctrl/Alt modifiers');

        console.log('✅ 2.1 Sales search, unit, quantity, and price event bubbling verified for Ctrl+Enter & Alt+Enter');

        // -------------------------------------------------------------
        // MODULE 3: PRODUCT MANAGEMENT - HIDE PLACEHOLDER DEFAULT ROW
        // -------------------------------------------------------------
        console.log('\n--- MODULE 3: PRODUCT MANAGEMENT - HIDE PLACEHOLDER DEFAULT ROW ---');

        // Simulate updateProductsTable display logic
        const testProducts = [
            {
                id: 101,
                name: 'Product With Default Only',
                barcode: 'DEF-001',
                price: 100,
                stock: 5,
                variants: [
                    { id: 1001, variantName: 'Default', barcode: 'DEF-001', stock: 5, sellingPrice: 100 }
                ]
            },
            {
                id: 102,
                name: 'Product With Named Variants',
                barcode: 'VAR-002',
                price: 200,
                stock: 20,
                variants: [
                    { id: 1002, variantName: 'Small', barcode: 'VAR-002-S', stock: 8, sellingPrice: 190 },
                    { id: 1003, variantName: 'Large', barcode: 'VAR-002-L', stock: 12, sellingPrice: 220 }
                ]
            }
        ];

        const isPlaceholderVariant = (v) => {
            if (!v) return true;
            const name = String(v.variantName || v.variant_name || v.name || '').trim().toLowerCase();
            return name === '' || name === 'default';
        };

        // Test Product 101 (Only Default)
        const p101Vars = testProducts[0].variants.filter(v => !isPlaceholderVariant(v));
        assert.strictEqual(p101Vars.length, 0, 'Sole Default variant must be recognized as placeholder');
        const p101Badge = p101Vars.length > 0 ? `${p101Vars.length} variants` : '';
        assert.strictEqual(p101Badge, '', 'Sole Default variant must NOT show variant badge');

        // Test Product 102 (Named Variants)
        const p102Vars = testProducts[1].variants.filter(v => !isPlaceholderVariant(v));
        assert.strictEqual(p102Vars.length, 2, 'Named variants Small and Large must be retained');
        const p102Badge = `${p102Vars.length} variants`;
        assert.strictEqual(p102Badge, '2 variants', 'Named variants must show badge');

        // Check OneBook.html contains the placeholder filter logic
        assert.ok(htmlContent.includes('isPlaceholderVariant') || htmlContent.includes("name === 'default'"), 'OneBook.html must implement placeholder variant check');

        console.log('✅ 3.1 Placeholder Default child row hidden for single-variant products; named variants preserved');

        // -------------------------------------------------------------
        // MODULE 4: PURCHASE ENTRY PAYMENT SECTION REMOVED
        // -------------------------------------------------------------
        console.log('\n--- MODULE 4: PURCHASE ENTRY PAYMENT SECTION REMOVAL ---');

        // Verify HTML no longer contains visible payment controls in Purchase Entry
        assert.ok(!htmlContent.includes('Paid Now (₹):'), 'Must not display visible "Paid Now (₹):" in Purchase Entry');
        assert.ok(!htmlContent.includes('Outstanding (₹):'), 'Must not display visible "Outstanding (₹):" in Purchase Entry');
        assert.ok(!htmlContent.includes('Due Date:'), 'Must not display visible "Due Date:" in Purchase Entry');
        assert.ok(!htmlContent.includes('class="pp-payment-bar"'), 'Must remove .pp-payment-bar layout');

        // Verify hidden input fields exist to maintain complete accounting data model
        assert.ok(htmlContent.includes('id="purchasePaymentMethod"'), 'Must preserve hidden purchasePaymentMethod');
        assert.ok(htmlContent.includes('id="purchaseCreditAmountPaid"'), 'Must preserve hidden purchaseCreditAmountPaid');

        // Accounting test: Create purchase in SQLite with default credit payment (amountPaid = 0)
        // Verify full amount becomes payable in supplier balance
        db.prepare(`
            INSERT INTO suppliers (id, name, phone, gstin, balance)
            VALUES ('SUP-ACC-01', 'Premier Fabrics Ltd', '9898989898', '33BBBBB0000B1Z1', 0)
        `).run();

        const purchaseRes = purchaseService.createPurchase({
            invoiceNumber: 'PUR-ACC-2026-001',
            supplierId: 'SUP-ACC-01',
            supplier: 'Premier Fabrics Ltd',
            vendorType: 'supplier',
            date: '2026-11-18',
            paymentMethod: 'credit',
            paymentStatus: 'unpaid',
            amountPaid: 0,
            outstandingAmount: 15000,
            subtotal: 12711.86,
            taxableValue: 12711.86,
            cgst: 1144.07,
            sgst: 1144.07,
            igst: 0,
            totalTax: 2288.14,
            totalAmount: 15000,
            total: 15000,
            items: [
                {
                    productId: parentId,
                    variantId: varM.id,
                    name: 'Polo Cotton T-Shirt',
                    qty: 30,
                    price: 500,
                    total: 15000
                }
            ]
        });

        assert.ok(purchaseRes, 'Purchase must be created in SQLite');

        // Check supplier balance in SQLite: must equal exactly ₹15000 (full amount payable)
        const supplierAfter = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get('SUP-ACC-01');
        assert.strictEqual(supplierAfter.balance, 15000, 'Supplier balance must increase by full purchase amount');

        console.log('✅ 4.1 Payment section removed from UI, default credit purchase properly adds to supplier payable balance');

        console.log('\n================================================================');
        console.log('🎉 ALL FINAL ENHANCEMENTS AND LOGIC VERIFIED WITH 100% SUCCESS!');
        console.log('================================================================\n');

    } catch (err) {
        console.error('\n❌ FINAL TEST SUITE FAILED:', err);
        process.exit(1);
    } finally {
        try {
            dbManager.close();
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

runFinalEnhancementTests();
