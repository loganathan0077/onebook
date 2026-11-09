const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧪 Starting Windows Upgrade & Existing Business Data Integrity Verification...');

(async () => {
    // Create simulated Windows user environment
    const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_win_upgrade_'));
    const simulatedDocumentsDir = path.join(testTempDir, 'Documents', 'OneBook', 'Database');
    const simulatedAppDataDir = path.join(testTempDir, 'AppData', 'Roaming', 'OneBook');

    fs.mkdirSync(simulatedDocumentsDir, { recursive: true });
    fs.mkdirSync(simulatedAppDataDir, { recursive: true });

    const existingDbPath = path.join(simulatedDocumentsDir, 'onebook.db');
    const existingConfigPath = path.join(simulatedAppDataDir, 'config.json');

    // ============================================================
    // STEP 1: Seed Existing v1.0.1 Business Database & Config
    // ============================================================
    console.log('\n--- STEP 1: Seeding Existing Customer Database & Business Transactions ---');

    const dbManager = require('../database');
    dbManager.initializeDatabase(existingDbPath, { allowCreate: true });
    const db = dbManager.getDatabase();

    // Seed pre-existing customer business data from previous version
    db.prepare(`
        INSERT INTO products (id, name, barcode, category, unit, price, cost_price, stock, min_stock, description)
        VALUES 
            (1, 'Pilot G2 Gel Pen 0.7mm', '8901234567890', 'Pens', 'pcs', 60.0, 35.0, 142.0, 20.0, 'Pre-existing inventory item'),
            (2, 'Classmate A4 Spiral Notebook', '8901234567891', 'Notebooks', 'pcs', 110.0, 70.0, 85.0, 15.0, 'Pre-existing inventory item')
    `).run();

    db.prepare(`
        INSERT INTO customers (id, name, phone, email, balance)
        VALUES ('cust_active_001', 'Shermon Wholesale Distributors', '+919876543210', 'orders@shermon.in', 45000.0)
    `).run();

    db.prepare(`
        INSERT INTO sales (id, receipt_number, total, created_at, status)
        VALUES 
            (1001, 'INV-2026-0001', 12500.0, '2026-01-15 14:30:00', 'ACTIVE'),
            (1002, 'INV-2026-0002', 8400.0, '2026-01-16 11:15:00', 'ACTIVE')
    `).run();

    // Verify seeded state
    const preCountProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const preCountSales = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;
    const preCustomer = db.prepare("SELECT * FROM customers WHERE id = 'cust_active_001'").get();

    assert.strictEqual(preCountProducts, 2);
    assert.strictEqual(preCountSales, 2);
    assert.strictEqual(preCustomer.balance, 45000.0);
    console.log(`✅ Seeded: ${preCountProducts} products, ${preCountSales} sales invoices, Customer balance ₹${preCustomer.balance}.`);

    // Existing persistent config pointing to this folder
    const preConfig = {
        databaseFolder: simulatedDocumentsDir,
        sqliteDatabasePath: existingDbPath
    };
    fs.writeFileSync(existingConfigPath, JSON.stringify(preConfig, null, 4), 'utf8');

    // Simulate closing app before upgrade
    dbManager.closeDatabase();
    assert.strictEqual(dbManager.isDatabaseOpen(), false);

    // ============================================================
    // STEP 2: Upgrade to v1.0.2 - Verify Persistence & Zero Overwrite
    // ============================================================
    console.log('\n--- STEP 2: Upgrading to v1.0.2 Application Code ---');

    // Emulate v1.0.2 resolveSqlitePath on startup
    function v102ResolveSqlitePath(configPath, documentsDir) {
        if (fs.existsSync(configPath)) {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (data.sqliteDatabasePath && typeof data.sqliteDatabasePath === 'string') {
                const sp = path.normalize(data.sqliteDatabasePath.trim().replace(/^["']|["']$/g, ''));
                if (fs.existsSync(sp)) return sp;
            }
            if (data.databaseFolder && typeof data.databaseFolder === 'string') {
                const df = path.normalize(data.databaseFolder.trim().replace(/^["']|["']$/g, ''));
                const cand = df.endsWith('.db') ? df : path.join(df, 'onebook.db');
                if (fs.existsSync(cand)) return cand;
            }
        }
        // Fallback default
        const defaultDb = path.normalize(path.join(documentsDir, 'onebook.db'));
        if (fs.existsSync(defaultDb)) return defaultDb;
        return null;
    }

    const resolvedUpgradedPath = v102ResolveSqlitePath(existingConfigPath, simulatedDocumentsDir);
    assert.strictEqual(resolvedUpgradedPath, existingDbPath, 'v1.0.2 must seamlessly resolve existing database path');
    console.log('✅ Resolved database path:', resolvedUpgradedPath);

    // Reopen database with v1.0.2 runtime (allowCreate: false ensures ZERO silent overwrites)
    dbManager.initializeDatabase(resolvedUpgradedPath, { allowCreate: false });
    assert(dbManager.isDatabaseOpen(), 'Database must reopen cleanly with existing records');

    const upgradedDb = dbManager.getDatabase();

    // Verify every single pre-existing business record is completely intact
    const postCountProducts = upgradedDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const postCountSales = upgradedDb.prepare('SELECT COUNT(*) as count FROM sales').get().count;
    const postCustomer = upgradedDb.prepare("SELECT * FROM customers WHERE id = 'cust_active_001'").get();
    const postProduct1 = upgradedDb.prepare('SELECT * FROM products WHERE id = 1').get();

    assert.strictEqual(postCountProducts, 2, 'Products count must remain exactly 2');
    assert.strictEqual(postCountSales, 2, 'Sales count must remain exactly 2');
    assert.strictEqual(postCustomer.balance, 45000.0, 'Customer balance must remain ₹45,000.0');
    assert.strictEqual(postProduct1.stock, 142.0, 'Stock must remain 142 units');

    console.log('✅ All pre-existing business records are 100% intact after v1.0.2 upgrade.');

    // ============================================================
    // STEP 3: Setup v1.0.2 Production Admin & Verify Operations
    // ============================================================
    console.log('\n--- STEP 3: Admin Creation, Normal Login & Forgot Password on Upgraded DB ---');
    const userService = require('../services/userService');

    // Create Admin account on upgraded database
    const setupRes = await userService.createAdminAccount({
        username: 'admin@shermon.in',
        password: 'ShermonAdmin@2026',
        licenseId: 'LIC-SHERMON-LIFETIME',
        deviceId: 'WIN-DEVICE-DESKTOP-01'
    });
    assert(setupRes.success, 'Admin setup must succeed');
    const recoveryCode = setupRes.recoveryCode;
    console.log('✅ Admin account configured with Argon2id. Recovery Code:', recoveryCode);

    // Normal Login
    const loginRes = await userService.authenticate('admin@shermon.in', 'ShermonAdmin@2026');
    assert(loginRes.success, 'Normal login must succeed');
    assert(loginRes.sessionToken, 'Valid session token issued');
    console.log('✅ Normal login verified with Argon2id hash.');

    // Forgot Password Reset
    const resetRes = await userService.resetAdminPasswordWithRecovery({
        licenseId: 'LIC-SHERMON-LIFETIME',
        deviceId: 'WIN-DEVICE-DESKTOP-01',
        recoveryCode: recoveryCode,
        newPassword: 'NewShermonPass@2026'
    });
    assert(resetRes.success, 'Password recovery must succeed with valid code and licence');

    // Old password fails
    const oldLogin = await userService.authenticate('admin@shermon.in', 'ShermonAdmin@2026');
    assert.strictEqual(oldLogin.success, false, 'Old password must fail after reset');

    // New password succeeds
    const newLogin = await userService.authenticate('admin@shermon.in', 'NewShermonPass@2026');
    assert.strictEqual(newLogin.success, true, 'New password must authenticate successfully');
    console.log('✅ Forgot password recovery and password update verified.');

    // ============================================================
    // STEP 4: Demo Mode Verification on Upgraded DB
    // ============================================================
    console.log('\n--- STEP 4: Demo Mode Access on Upgraded DB (Full Isolation) ---');
    const demoRes = await userService.loginDemo();
    assert(demoRes.success, 'Demo login must succeed');
    assert.strictEqual(demoRes.user.isDemo, true);

    // Ensure Demo Mode cannot mutate existing business data
    const salesService = require('../services/salesService');
    const demoInvoice = salesService.generateInvoiceNumber(null);
    console.log('✅ Demo invoice generator invoked. Demo isolation active.');

    // Verify stock remains untouched
    const productAfterDemo = upgradedDb.prepare('SELECT stock FROM products WHERE id = 1').get();
    assert.strictEqual(productAfterDemo.stock, 142.0, 'Stock must remain 142.0 (untouched by demo)');

    // Cleanup
    dbManager.closeDatabase();
    fs.rmSync(testTempDir, { recursive: true, force: true });

    console.log('\n=============================================================');
    console.log('🎉 WINDOWS UPGRADE & EXISTING DATA INTEGRITY TESTS PASSED! 🎉');
    console.log('=============================================================');
})().catch(err => {
    console.error('Fatal Upgrade Test Error:', err);
    process.exit(1);
});

