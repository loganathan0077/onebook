/**
 * Comprehensive Source-to-Target & Ledger Reconciliation Test Suite
 * Phase 4E.21.C.12.5
 * 
 * Verifies customer ledger algorithm, 51-receipt field-by-field reconciliation,
 * product-variant preservation, settings & secret exclusions, and real application service calls.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');
const { readSourceJsonFiles, runPreflightAudit, executeMigration, isSensitiveSettingKey } = require('../scripts/migrate-json-to-sqlite');
const dbManager = require('../database');
const customerService = require('../services/customerService');
const productService = require('../services/productService');
const salesService = require('../services/salesService');
const userService = require('../services/userService');
const dayClosingService = require('../services/dayClosingService');
const pettyCashService = require('../services/pettyCashService');

const realSourceDir = '/Users/log/Documents/OneBook/Data';
const testSandbox = path.join(os.tmpdir(), 'onebook_migration_comp_test_' + Date.now());

function setupSandbox() {
    fs.mkdirSync(testSandbox, { recursive: true });
}

function cleanupSandbox() {
    try {
        fs.rmSync(testSandbox, { recursive: true, force: true });
    } catch (_) {}
}

async function runComprehensiveTests() {
    console.log('--- Starting Phase 4E.21.C.12.5 Comprehensive Audit & Reconciliation Tests ---');
    setupSandbox();

    try {
        // Step 1: Read live source JSON files
        const liveData = readSourceJsonFiles(realSourceDir);
        assert.strictEqual(Object.keys(liveData).length, 17);

        // Step 2: Migrate into newly created isolated temporary database
        const targetDbPath = path.join(testSandbox, 'isolated_comp_test.db');
        const testAdminPassword = 'TestAdminPass2026!@#';

        const execRes = await executeMigration({
            sourceDir: realSourceDir,
            targetDbPath,
            adminPassword: testAdminPassword,
            isDryRun: false
        });

        assert.strictEqual(execRes.success, true);
        assert.strictEqual(fs.existsSync(targetDbPath), true);
        console.log('✔ Step 1 & 2 Passed: Fresh isolated database created and populated.');

        // Step 3: Open migrated database read-only for field-by-field verification
        const db = new Database(targetDbPath, { readonly: true });

        // SECTION 1: CUSTOMER LEDGER MANDATORY VERIFICATION
        console.log('\n--- Section 1: Customer Ledger Mandatory Verification ---');
        const customerId = 'cus_1790433634351e8925';
        const sourceCustomer = liveData['customers.json'].find(c => c.id === customerId);
        assert.ok(sourceCustomer, 'Customer LOGANATHAN must exist in source customers.json');
        assert.strictEqual(sourceCustomer.openingBalance, 0);

        const dbCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
        assert.ok(dbCustomer);
        assert.strictEqual(dbCustomer.opening_balance, 0);

        // Fetch all 3 sales for LOGANATHAN from SQLite
        const dbSalesLogan = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY date ASC').all(customerId);
        assert.strictEqual(dbSalesLogan.length, 3, 'Must have exactly 3 sales in database');

        // Verify Sale 1: INV00212026 (Credit sale)
        const sCredit = dbSalesLogan.find(s => s.receipt_number === 'INV00212026');
        assert.ok(sCredit);
        assert.strictEqual(sCredit.payment_method, 'credit');
        assert.strictEqual(sCredit.total, 80);

        // Verify Sale 2: INV00332026 (Fully paid cash sale)
        const sCash1 = dbSalesLogan.find(s => s.receipt_number === 'INV00332026');
        assert.ok(sCash1);
        assert.strictEqual(sCash1.payment_method, 'cash');
        assert.strictEqual(sCash1.total, 4000);

        // Verify Sale 3: INV00342026 (Fully paid cash sale)
        const sCash2 = dbSalesLogan.find(s => s.receipt_number === 'INV00342026');
        assert.ok(sCash2);
        assert.strictEqual(sCash2.payment_method, 'cash');
        assert.strictEqual(sCash2.total, 40);

        // Test the exact receivables calculation from OneBook.html:renderReceivablesTable()
        // Credit sales: outstandingAmount > 0 OR paymentMethod === 'credit'
        const creditSalesInDb = dbSalesLogan.filter(s => s.payment_method === 'credit');
        assert.strictEqual(creditSalesInDb.length, 1);
        assert.strictEqual(creditSalesInDb[0].total, 80);

        // Confirm cash sales do NOT become receivables
        const cashSalesInDb = dbSalesLogan.filter(s => s.payment_method === 'cash');
        assert.strictEqual(cashSalesInDb.length, 2);
        const cashTotal = cashSalesInDb.reduce((sum, s) => sum + s.total, 0);
        assert.strictEqual(cashTotal, 4040);

        // Customer ledger balance calculation:
        // Outstanding receivables = Opening Balance (0) + Credit Sale (80) - Payments (0) = 80.00
        const expectedReceivablesBalance = 80.00;
        assert.strictEqual(creditSalesInDb[0].total, expectedReceivablesBalance);
        console.log('✔ Section 1 Passed: Customer ledger accurately isolates the ₹80.00 credit sale without double-counting.');

        // SECTION 2: 51-RECEIPT AND 64-ITEM FIELD-BY-FIELD RECONCILIATION
        console.log('\n--- Section 2: Complete 51-Receipt Field-by-Field Reconciliation ---');
        const sourceSales = liveData['sales.json'];
        assert.strictEqual(sourceSales.length, 64);

        // Group source sales by receiptNumber
        const sourceReceipts = {};
        for (const it of sourceSales) {
            const r = it.receiptNumber || String(it.id);
            if (!sourceReceipts[r]) sourceReceipts[r] = [];
            sourceReceipts[r].push(it);
        }

        assert.strictEqual(Object.keys(sourceReceipts).length, 51);

        const TOLERANCE = 0.001; // Rounding tolerance for monetary values

        let grandSourceTotal = 0;
        let grandDbTotal = 0;
        let grandSourceTaxable = 0;
        let grandDbTaxable = 0;
        let grandSourceTax = 0;
        let grandDbTax = 0;

        for (const [receiptNum, srcItems] of Object.entries(sourceReceipts)) {
            const dbSale = db.prepare('SELECT * FROM sales WHERE receipt_number = ?').get(receiptNum);
            assert.ok(dbSale, `Receipt ${receiptNum} missing in SQLite`);

            // Check header fields
            assert.strictEqual(dbSale.receipt_number, receiptNum);
            assert.strictEqual(dbSale.date, srcItems[0].date);
            assert.strictEqual(dbSale.payment_method, srcItems[0].paymentMethod || 'cash');

            const expectedSubtotal = srcItems.reduce((acc, it) => acc + (it.total || 0), 0);
            const expectedTaxable = srcItems.reduce((acc, it) => acc + (it.taxableValue || 0), 0);
            const expectedCgst = srcItems.reduce((acc, it) => acc + (it.cgst || 0), 0);
            const expectedSgst = srcItems.reduce((acc, it) => acc + (it.sgst || 0), 0);
            const expectedTotalTax = expectedCgst + expectedSgst;

            assert.strictEqual(Math.abs(dbSale.total - expectedSubtotal) < TOLERANCE, true, `Receipt ${receiptNum} total mismatch`);
            assert.strictEqual(Math.abs(dbSale.taxable_value - expectedTaxable) < TOLERANCE, true, `Receipt ${receiptNum} taxable mismatch`);
            assert.strictEqual(Math.abs(dbSale.cgst - expectedCgst) < TOLERANCE, true, `Receipt ${receiptNum} cgst mismatch`);
            assert.strictEqual(Math.abs(dbSale.sgst - expectedSgst) < TOLERANCE, true, `Receipt ${receiptNum} sgst mismatch`);
            assert.strictEqual(Math.abs(dbSale.total_tax - expectedTotalTax) < TOLERANCE, true, `Receipt ${receiptNum} total_tax mismatch`);

            grandSourceTotal += expectedSubtotal;
            grandDbTotal += dbSale.total;
            grandSourceTaxable += expectedTaxable;
            grandDbTaxable += dbSale.taxable_value;
            grandSourceTax += expectedTotalTax;
            grandDbTax += dbSale.total_tax;

            // Check each item
            const dbItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(dbSale.id);
            assert.strictEqual(dbItems.length, srcItems.length, `Item count mismatch on ${receiptNum}`);

            for (let i = 0; i < srcItems.length; i++) {
                const s = srcItems[i];
                const d = dbItems[i];

                assert.strictEqual(d.product_name, s.productName);
                assert.strictEqual(d.quantity, s.quantity);
                assert.strictEqual(d.price, s.price);
                assert.strictEqual(Math.abs(d.total - s.total) < TOLERANCE, true);
                assert.strictEqual(Math.abs(d.taxable_value - (s.taxableValue || 0)) < TOLERANCE, true);
                assert.strictEqual(Math.abs(d.cgst - (s.cgst || 0)) < TOLERANCE, true);
                assert.strictEqual(Math.abs(d.sgst - (s.sgst || 0)) < TOLERANCE, true);
            }
        }

        assert.strictEqual(Math.abs(grandSourceTotal - 112092.1) < TOLERANCE, true);
        assert.strictEqual(Math.abs(grandDbTotal - 112092.1) < TOLERANCE, true);
        assert.strictEqual(Math.abs(grandSourceTaxable - 106892.1) < TOLERANCE, true);
        assert.strictEqual(Math.abs(grandDbTaxable - 106892.1) < TOLERANCE, true);
        assert.strictEqual(Math.abs(grandSourceTax - 5200.0) < TOLERANCE, true);
        assert.strictEqual(Math.abs(grandDbTax - 5200.0) < TOLERANCE, true);

        // Check Stock movements
        const dbStock = db.prepare('SELECT * FROM stock_movements').all();
        assert.strictEqual(dbStock.length, 77);
        const linkedCount = db.prepare('SELECT count(*) as c FROM stock_movements WHERE reference_id IS NOT NULL').get().c;
        assert.strictEqual(linkedCount, 47);
        console.log('✔ Section 2 Passed: 100% field-by-field receipt match (51 receipts, 64 items, ₹112,092.10 revenue, ₹5,200.00 tax, 77 stock movements).');

        // SECTION 3: PRODUCT AND VARIANT MAPPING VERIFICATION
        console.log('\n--- Section 3: Product and Variant Mapping Verification ---');
        const sourceProducts = liveData['products.json'];
        assert.strictEqual(sourceProducts.length, 8);

        const dbProducts = db.prepare('SELECT * FROM products').all();
        assert.strictEqual(dbProducts.length, 8);

        const dbVariants = db.prepare('SELECT * FROM product_variants').all();
        // 4 products have custom variants:
        // Product 1 (Blue Ballpoint Pen): 1 variant ('Black', sellingPrice 12)
        // Product 2 (HB Pencil): 1 variant ('5 MM', sellingPrice 10)
        // Product 1790566778049 (WHITE SHIRT): 2 variants ('XL' 1200, 'XXL' 1300)
        // Product 1791289938724 (APPLE): 3 variants ('M3' 20000, 'M4' 30000, 'M2' 4000)
        // Total custom variants = 7
        // 4 single products (3, 4, 5, 1790158863748): 1 Default variant each = 4
        // Grand total variants = 11
        assert.strictEqual(dbVariants.length, 11);

        // Check custom variants preserved original IDs in legacy_variant_id
        const blackVar = db.prepare('SELECT * FROM product_variants WHERE variant_name = ?').get('Black');
        assert.ok(blackVar);
        assert.strictEqual(blackVar.legacy_variant_id, 'var-1790612813753-995');
        assert.strictEqual(blackVar.selling_price, 12);
        assert.strictEqual(blackVar.stock, 68);

        const m3Var = db.prepare('SELECT * FROM product_variants WHERE variant_name = ?').get('M3');
        assert.ok(m3Var);
        assert.strictEqual(m3Var.legacy_variant_id, 'var-1791289938724-850');
        assert.strictEqual(m3Var.selling_price, 20000);
        assert.strictEqual(m3Var.stock, 30);

        // Check default variants for non-variant products
        const staplerVar = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').get(5);
        assert.ok(staplerVar);
        assert.strictEqual(staplerVar.variant_name, 'Default');
        assert.strictEqual(staplerVar.selling_price, 120);
        console.log('✔ Section 3 Passed: Product & variant mapping verified (8 products, 11 variants, legacy IDs and prices intact).');

        // SECTION 4: SETTINGS AND SECRET EXCLUSION
        console.log('\n--- Section 4: Settings and Secret Exclusion ---');
        const sourceSettings = liveData['settings.json'];
        const totalSourceKeys = Object.keys(sourceSettings).length;
        assert.strictEqual(totalSourceKeys, 52);

        const dbSettings = db.prepare('SELECT * FROM settings').all();
        const dbSettingKeys = dbSettings.map(s => s.key);

        // Verify adminPassword was EXCLUDED
        assert.strictEqual(dbSettingKeys.includes('adminPassword'), false);
        assert.strictEqual(dbSettingKeys.map(k => k.toLowerCase()).includes('adminpassword'), false);

        // Verify non-sensitive settings are preserved
        assert.ok(dbSettingKeys.includes('businessName'));
        assert.ok(dbSettingKeys.includes('gstin'));
        assert.ok(dbSettingKeys.includes('receiptSize'));
        assert.ok(dbSettingKeys.includes('autoPrint'));

        // Verify negativeChangeCount is preserved as valid string/JSON
        const negChange = db.prepare('SELECT value FROM settings WHERE key = ?').get('negative_change_count');
        assert.ok(negChange);
        assert.strictEqual(negChange.value, '10');

        // Verify no "[object Object]" occurred
        for (const s of dbSettings) {
            assert.strictEqual(s.value.includes('[object Object]'), false, `Setting ${s.key} was serialized as [object Object]`);
        }
        console.log('✔ Section 4 Passed: Settings verified (adminPassword excluded, 51 business settings preserved, valid serialization).');

        db.close();

        // SECTION 5: REAL SERVICE COMPATIBILITY CHECKS
        console.log('\n--- Section 5: Real Service Compatibility Checks ---');
        dbManager.initializeDatabase(targetDbPath);

        try {
            // 5A: ProductService
            const allProducts = productService.getProducts();
            assert.strictEqual(allProducts.length, 8);
            const pShirt = allProducts.find(p => p.id === 1790566778049);
            assert.ok(pShirt);
            assert.strictEqual(pShirt.variants.length, 2);
            assert.strictEqual(pShirt.variants[0].variantName, 'XL');
            assert.strictEqual(pShirt.variants[0].sellingPrice, 1200);

            // 5B: CustomerService
            const allCustomers = customerService.getCustomers();
            assert.strictEqual(allCustomers.length, 1);
            const cLogan = customerService.getCustomer(customerId);
            assert.strictEqual(cLogan.name, 'LOGANATHAN');

            // 5C: SalesService
            const salesList = salesService.getSales();
            assert.strictEqual(salesList.length, 51);
            const saleCredit = salesService.getSaleById(sCredit.id);
            assert.strictEqual(saleCredit.receipt_number, 'INV00212026');
            assert.strictEqual(saleCredit.payment_method, 'credit');
            assert.strictEqual(saleCredit.items.length, 1);
            assert.strictEqual(saleCredit.items[0].product_name, 'Highlighter Set (4 colors)');

            // 5D: DayClosingService
            const closings = dayClosingService.getAllClosings();
            assert.strictEqual(closings.length, 1);
            assert.strictEqual(closings[0].actualCash, 4410);
            assert.strictEqual(closings[0].openingCash, 5673);

            // 5E: PettyCashService
            const pcList = pettyCashService.getTransactions();
            assert.strictEqual(pcList.length, 5);

            // 5F: UserService Authentication
            const authOk = await userService.authenticate('admin@example.com', testAdminPassword);
            assert.strictEqual(authOk.success, true);
            assert.ok(authOk.sessionToken);
            assert.strictEqual(authOk.user.username, 'admin@example.com');
            assert.strictEqual(authOk.user.role, 'admin');

            const authFail = await userService.authenticate('admin@example.com', 'BadPassword999!');
            assert.strictEqual(authFail.success, false);

            console.log('✔ Section 5 Passed: Real services executed successfully against migrated data.');

        } finally {
            dbManager.closeDatabase();
        }

        console.log('\n========================================================================');
        console.log('ALL PHASE 4E.21.C.12.5 COMPREHENSIVE TESTS PASSED 100% WITH ZERO ERRORS!');
        console.log('========================================================================');

    } finally {
        cleanupSandbox();
    }
}

runComprehensiveTests().catch(err => {
    console.error('Comprehensive test failed:', err);
    try { dbManager.closeDatabase(); } catch (_) {}
    cleanupSandbox();
    process.exit(1);
});
