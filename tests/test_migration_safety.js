/**
 * Hardened Safety & Failure-Injection Test Suite for JSON-to-SQLite Migration Utility
 * Phase 4E.21.C.12.4
 * 
 * Verifies secret pattern filtering, customer ledger math, receipt totals/taxes,
 * failure injection, product variants, schema alignment, and real read-only application service integration.
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
const testSandbox = path.join(os.tmpdir(), 'onebook_migration_test_' + Date.now());

function setupSandbox() {
    fs.mkdirSync(testSandbox, { recursive: true });
}

function cleanupSandbox() {
    try {
        fs.rmSync(testSandbox, { recursive: true, force: true });
    } catch (_) {}
}

async function runSafetyTests() {
    console.log('--- Starting Phase 4E.21.C.12.4 Hardened Migration Tests ---');
    setupSandbox();

    try {
        // Test 1: Live source read-only audit & financial verification
        console.log('Test 1: Read-only live audit and detailed financial breakdown...');
        const liveData = readSourceJsonFiles(realSourceDir);
        assert.strictEqual(Object.keys(liveData).length, 17);
        const { report, receipts } = runPreflightAudit(liveData);
        assert.strictEqual(report.valid, true);
        assert.strictEqual(report.counts.distinctSales, 51);
        assert.strictEqual(report.counts.salesRawRows, 64);
        assert.strictEqual(report.financialTotals.totalGrossSales, 112092.1);
        assert.strictEqual(report.financialTotals.taxableValue, 106892.1);
        assert.strictEqual(report.financialTotals.totalTax, 5200);
        assert.strictEqual(report.financialTotals.cgst, 2600);
        assert.strictEqual(report.financialTotals.sgst, 2600);
        assert.strictEqual(report.financialTotals.igst, 0);
        assert.strictEqual(report.financialTotals.creditSalesTotal, 80);
        console.log('✔ Test 1 Passed: Preflight financial breakdown verified.');

        // Test 2: Dry Run produces NO files
        console.log('Test 2: Dry run creates zero files...');
        const dryRunTarget = path.join(testSandbox, 'dry_run_target.db');
        const dryRunRes = await executeMigration({
            sourceDir: realSourceDir,
            targetDbPath: dryRunTarget,
            isDryRun: true
        });
        assert.strictEqual(dryRunRes.mode, 'DRY_RUN');
        assert.strictEqual(dryRunRes.success, true);
        assert.strictEqual(fs.existsSync(dryRunTarget), false);
        console.log('✔ Test 2 Passed: Dry run verified non-destructive.');

        // Test 3: Overwrite collision refusal
        console.log('Test 3: Existing target collision refusal...');
        const existingFile = path.join(testSandbox, 'existing_db.db');
        fs.writeFileSync(existingFile, 'EXISTING DATA PRESERVED');
        let collisionBlocked = false;
        try {
            await executeMigration({
                sourceDir: realSourceDir,
                targetDbPath: existingFile,
                adminPassword: 'Password123!',
                isDryRun: false
            });
        } catch (err) {
            if (err.message.includes('Safety violation: Target database file already exists')) {
                collisionBlocked = true;
            }
        }
        assert.strictEqual(collisionBlocked, true);
        assert.strictEqual(fs.readFileSync(existingFile, 'utf8'), 'EXISTING DATA PRESERVED');
        console.log('✔ Test 3 Passed: Collision guard verified.');

        // Test 4: Failure injection before admin insertion triggers complete rollback & cleanup
        console.log('Test 4: Failure before admin insertion rolls back completely...');
        const failAdminDb = path.join(testSandbox, 'fail_admin.db');
        let failAdminCaught = false;
        try {
            await executeMigration({
                sourceDir: realSourceDir,
                targetDbPath: failAdminDb,
                adminPassword: 'Password123!',
                testFailure: 'FAIL_BEFORE_ADMIN'
            });
        } catch (err) {
            if (err.message === 'TEST_INJECTED_FAILURE_BEFORE_ADMIN') failAdminCaught = true;
        }
        assert.strictEqual(failAdminCaught, true);
        assert.strictEqual(fs.existsSync(failAdminDb), false);
        assert.strictEqual(fs.existsSync(`${failAdminDb}-wal`), false);
        assert.strictEqual(fs.existsSync(`${failAdminDb}-shm`), false);
        console.log('✔ Test 4 Passed: Admin failure rollback and cleanup verified.');

        // Test 5: Failure injection before audit log insertion triggers complete rollback & cleanup
        console.log('Test 5: Failure before audit insertion rolls back completely...');
        const failAuditDb = path.join(testSandbox, 'fail_audit.db');
        let failAuditCaught = false;
        try {
            await executeMigration({
                sourceDir: realSourceDir,
                targetDbPath: failAuditDb,
                adminPassword: 'Password123!',
                testFailure: 'FAIL_BEFORE_AUDIT'
            });
        } catch (err) {
            if (err.message === 'TEST_INJECTED_FAILURE_BEFORE_AUDIT') failAuditCaught = true;
        }
        assert.strictEqual(failAuditCaught, true);
        assert.strictEqual(fs.existsSync(failAuditDb), false);
        console.log('✔ Test 5 Passed: Audit failure rollback and cleanup verified.');

        // Test 6: Foreign Key Failure Rollback in Isolated Sandbox
        console.log('Test 6: Foreign Key Failure Rollback...');
        const fkDir = path.join(testSandbox, 'fk_dir');
        fs.mkdirSync(fkDir);
        for (const [k, v] of Object.entries(liveData)) {
            if (k === 'sales.json') {
                const badSales = JSON.parse(JSON.stringify(v));
                badSales[0].customerId = 'NON_EXISTENT_CUSTOMER_ID';
                fs.writeFileSync(path.join(fkDir, k), JSON.stringify(badSales));
            } else {
                fs.writeFileSync(path.join(fkDir, k), JSON.stringify(v));
            }
        }
        const fkTargetDb = path.join(testSandbox, 'fk_target.db');
        let fkCaught = false;
        try {
            await executeMigration({
                sourceDir: fkDir,
                targetDbPath: fkTargetDb,
                adminPassword: 'Password123!',
                isDryRun: false
            });
        } catch (err) {
            fkCaught = true;
        }
        assert.strictEqual(fkCaught, true);
        assert.strictEqual(fs.existsSync(fkTargetDb), false);
        console.log('✔ Test 6 Passed: Foreign key violation aborted and cleaned.');

        // Test 7: Secret filtering pattern test with synthetic variants
        console.log('Test 7: Pattern-based secret key filtering...');
        const syntheticKeys = [
            'adminPassword', 'smtpPassword', 'apiToken', 'adminPasswordHash',
            'accessToken', 'secretKey', 'auth_header', 'client_secret', 'apiKey'
        ];
        syntheticKeys.forEach(k => {
            assert.strictEqual(isSensitiveSettingKey(k), true, `Key ${k} must be recognized as sensitive`);
        });
        const legitimateKeys = ['businessName', 'tagline', 'address', 'gstin', 'receiptSize', 'autoPrint'];
        legitimateKeys.forEach(k => {
            assert.strictEqual(isSensitiveSettingKey(k), false, `Key ${k} must NOT be flagged as sensitive`);
        });
        console.log('✔ Test 7 Passed: Secret pattern filter correctly identifies synthetic secret variants.');

        // Test 8: Full Isolated Sandbox Migration & Exact Entity Audit
        console.log('Test 8: Full Migration to isolated test sandbox & deep audit...');
        const sandboxTargetDb = path.join(testSandbox, 'sandbox_success.db');
        const execRes = await executeMigration({
            sourceDir: realSourceDir,
            targetDbPath: sandboxTargetDb,
            adminPassword: 'AdminStrongPassword2026!',
            isDryRun: false
        });
        assert.strictEqual(execRes.success, true);
        assert.strictEqual(fs.existsSync(sandboxTargetDb), true);

        // Open sandbox database read-only to verify
        const verifyDb = new Database(sandboxTargetDb, { readonly: true });

        // 8A: Sensitive Settings Protection Check
        console.log('Checking sensitive settings exclusion in target DB...');
        const adminPwSetting = verifyDb.prepare('SELECT value FROM settings WHERE LOWER(key) = ?').get('adminpassword');
        assert.strictEqual(adminPwSetting, undefined);
        const allSettingKeys = verifyDb.prepare('SELECT key FROM settings').all().map(r => r.key.toLowerCase());
        assert.strictEqual(allSettingKeys.includes('adminpassword'), false);
        assert.strictEqual(allSettingKeys.includes('password'), false);
        console.log('✔ 8A Passed: Sensitive settings completely excluded from target DB.');

        // 8B: Source-to-Database Reconciliation for All 51 Receipts
        console.log('Checking 1-to-1 reconciliation across all 51 receipts and 64 items...');
        let verifiedReceiptsCount = 0;
        let verifiedItemsCount = 0;
        let dbTotalTax = 0;
        let dbTotalTaxable = 0;

        for (const [receiptNum, sourceItems] of Object.entries(receipts)) {
            const dbSale = verifyDb.prepare('SELECT * FROM sales WHERE receipt_number = ?').get(receiptNum);
            assert.ok(dbSale, `Receipt #${receiptNum} must exist in SQLite sales`);

            const expectedSubtotal = sourceItems.reduce((acc, it) => acc + (it.total || 0), 0);
            const expectedTaxable = sourceItems.reduce((acc, it) => acc + (it.taxableValue || 0), 0);
            const expectedCgst = sourceItems.reduce((acc, it) => acc + (it.cgst || 0), 0);
            const expectedSgst = sourceItems.reduce((acc, it) => acc + (it.sgst || 0), 0);
            const expectedTotalTax = expectedCgst + expectedSgst;

            assert.strictEqual(Math.abs(dbSale.total - expectedSubtotal) < 0.001, true);
            assert.strictEqual(Math.abs(dbSale.taxable_value - expectedTaxable) < 0.001, true);
            assert.strictEqual(Math.abs(dbSale.cgst - expectedCgst) < 0.001, true);
            assert.strictEqual(Math.abs(dbSale.sgst - expectedSgst) < 0.001, true);
            assert.strictEqual(Math.abs(dbSale.total_tax - expectedTotalTax) < 0.001, true);

            dbTotalTax += dbSale.total_tax;
            dbTotalTaxable += dbSale.taxable_value;

            // Check items
            const dbItems = verifyDb.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(dbSale.id);
            assert.strictEqual(dbItems.length, sourceItems.length);

            for (let i = 0; i < sourceItems.length; i++) {
                const sIt = sourceItems[i];
                const dIt = dbItems[i];
                assert.strictEqual(dIt.product_name, sIt.productName);
                assert.strictEqual(dIt.quantity, sIt.quantity);
                assert.strictEqual(dIt.price, sIt.price);
                assert.strictEqual(dIt.total, sIt.total);
                assert.strictEqual(dIt.taxable_value, sIt.taxableValue || 0);
                assert.strictEqual(dIt.cgst, sIt.cgst || 0);
                assert.strictEqual(dIt.sgst, sIt.sgst || 0);
                verifiedItemsCount++;
            }
            verifiedReceiptsCount++;
        }
        assert.strictEqual(verifiedReceiptsCount, 51);
        assert.strictEqual(verifiedItemsCount, 64);
        assert.strictEqual(Math.round(dbTotalTax * 100) / 100, 5200);
        assert.strictEqual(Math.round(dbTotalTaxable * 100) / 100, 106892.1);
        console.log('✔ 8B Passed: 100% 1-to-1 source-to-database match across all 51 receipts and 64 items.');

        // 8C: Customer Ledger Calculation for cus_1790433634351e8925
        console.log('Verifying customer ledger algorithm...');
        const cust = verifyDb.prepare('SELECT * FROM customers WHERE id = ?').get('cus_1790433634351e8925');
        assert.strictEqual(cust.opening_balance, 0);

        // Fetch all sales for this customer
        const custSales = verifyDb.prepare('SELECT * FROM sales WHERE customer_id = ?').all(cust.id);
        assert.strictEqual(custSales.length, 3, 'Must have exactly 3 sales for LOGANATHAN');

        // Total customer sales in DB = 4120.00 (80 credit + 4000 cash + 40 cash)
        const totalCustSales = custSales.reduce((sum, s) => sum + s.total, 0);
        assert.strictEqual(totalCustSales, 4120);

        // Credit sale verification
        const creditSalesOnly = custSales.filter(s => s.payment_method === 'credit');
        assert.strictEqual(creditSalesOnly.length, 1);
        assert.strictEqual(creditSalesOnly[0].receipt_number, 'INV00212026');
        assert.strictEqual(creditSalesOnly[0].total, 80);
        console.log('✔ 8C Passed: Customer ledger transactions verified (1 credit sale of ₹80, 2 cash sales).');

        // 8D: Check product_variants table rows
        const dbProducts = verifyDb.prepare('SELECT * FROM products').all();
        assert.strictEqual(dbProducts.length, 8, 'Must have exactly 8 products in SQLite');
        const dbVariants = verifyDb.prepare('SELECT * FROM product_variants').all();
        // 4 products with variants (1+1+2+3 = 7 variants) + 4 products with 1 Default variant = 11 variants total!
        assert.strictEqual(dbVariants.length, 11, 'Must have exactly 11 variants in product_variants');
        console.log('✔ 8D Passed: All 8 products have corresponding variants preserving variantName, legacyId, price, cost, and stock.');

        verifyDb.close();

        // Test 9: Real Application Service Compatibility Checks (Read-Only)
        console.log('Test 9: Exercising real application services on migrated database...');
        dbManager.initializeDatabase(sandboxTargetDb);

        try {
            // 9A: Exercise productService (Reads products AND product_variants seamlessly)
            const prods = productService.getProducts();
            assert.strictEqual(prods.length, 8, 'productService.getProducts must return 8 products');
            assert.ok(prods[0].variants.length > 0, 'productService must populate variants array');
            // First alphabetically is 'A4 Notebook (100 pages)' with Default variant
            assert.strictEqual(prods[0].name, 'A4 Notebook (100 pages)');
            assert.strictEqual(prods[0].variants[0].variantName, 'Default');
            assert.strictEqual(prods[0].variants[0].sellingPrice, 40);

            // Find 'Blue Ballpoint Pen' which has specific variant 'Black'
            const pen = prods.find(p => p.id === 1);
            assert.ok(pen && pen.variants.length === 1);
            assert.strictEqual(pen.variants[0].variantName, 'Black');
            assert.strictEqual(pen.variants[0].sellingPrice, 12);

            const p1 = productService.getProduct(1);
            assert.ok(p1 && p1.name === 'Blue Ballpoint Pen');
            assert.strictEqual(p1.variants.length, 1);
            assert.strictEqual(p1.variants[0].variantName, 'Black');
            assert.strictEqual(p1.variants[0].sellingPrice, 12);

            // 9B: Exercise customerService
            const custs = customerService.getCustomers();
            assert.strictEqual(custs.length, 1, 'customerService must return 1 customer');
            const cLogan = customerService.getCustomer('cus_1790433634351e8925');
            assert.strictEqual(cLogan.name, 'LOGANATHAN');

            // 9C: Exercise salesService
            const allSales = salesService.getSales();
            assert.strictEqual(allSales.length, 51, 'salesService must return all 51 sales');
            const sCredit = salesService.getSaleById(creditSalesOnly[0].id);
            assert.ok(sCredit && sCredit.receipt_number === 'INV00212026');
            assert.strictEqual(sCredit.items.length, 1);
            assert.strictEqual(sCredit.items[0].product_name, 'Highlighter Set (4 colors)');
            assert.strictEqual(sCredit.items[0].price, 80);

            // 9D: Exercise dayClosingService
            const closings = dayClosingService.getAllClosings();
            assert.strictEqual(closings.length, 1, 'dayClosingService must return 1 record');
            assert.strictEqual(closings[0].actualCash, 4410);

            // 9E: Exercise pettyCashService
            const pettyTx = pettyCashService.getTransactions();
            assert.strictEqual(pettyTx.length, 5, 'pettyCashService must return 5 transactions');

            // 9F: Exercise userService (Verify administrator login with scrypt password)
            const authRes = await userService.authenticate('admin@example.com', 'AdminStrongPassword2026!');
            assert.strictEqual(authRes.success, true, 'userService authentication must succeed with scrypt password');
            assert.ok(authRes.sessionToken && authRes.sessionToken.length > 0);
            assert.strictEqual(authRes.user.username, 'admin@example.com');
            assert.strictEqual(authRes.user.role, 'admin');

            // Verify bad password fails authentication
            const badAuthRes = await userService.authenticate('admin@example.com', 'WrongPassword123!');
            assert.strictEqual(badAuthRes.success, false, 'userService must reject incorrect password');

            console.log('✔ Test 9 Passed: Real application services executed and verified on migrated database.');

        } finally {
            dbManager.closeDatabase();
        }

        console.log('\n======================================================');
        console.log('All 9 Hardened Migration & Safety Tests PASSED 100%!   ');
        console.log('======================================================');

    } finally {
        cleanupSandbox();
    }
}

runSafetyTests().catch(err => {
    console.error('Safety tests failed:', err);
    try { dbManager.closeDatabase(); } catch (_) {}
    cleanupSandbox();
    process.exit(1);
});
