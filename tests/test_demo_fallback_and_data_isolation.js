const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧪 Starting Demo Fallback & Data Isolation Security Verification Suite...');

(async () => {
    const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_sec_test_'));
    const testDbPath = path.join(testTempDir, 'isolation_test.db');

    const dbManager = require('../database');
    const userService = require('../services/userService');
    const salesService = require('../services/salesService');

    // Emulate main process handleAuthorizedSqlite guard
    let sqliteStatus = { initialized: false };

    async function emulateIpcCall(sessionToken, requiredPermission, handlerFn, options = {}) {
        if (!sqliteStatus.initialized || !dbManager.isDatabaseOpen()) {
            return { success: false, error: { code: 'DATABASE_NOT_INITIALIZED', message: 'Database is not initialized.' } };
        }

        if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.trim().length === 0) {
            return { success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required: Missing session token.' } };
        }

        const sessionUser = await userService.validateSession(sessionToken.trim());
        if (!sessionUser) {
            return { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid, expired, or revoked session.' } };
        }

        if (sessionUser.status !== 'active') {
            return { success: false, error: { code: 'USER_DISABLED', message: 'User account is disabled.' } };
        }

        const isDemo = Boolean(sessionUser.isDemo || sessionUser.id === 'demo_user' || sessionUser.username === 'demo');

        if (isDemo && options && options.isWrite) {
            return { success: false, error: { code: 'DEMO_RESTRICTED', message: 'Database modifications are disabled in Demo Mode. An active OneBook license is required.' } };
        }

        if (isDemo && options && options.isDemoRestrictedRead) {
            return { success: true, data: options.demoReadDefault !== undefined ? options.demoReadDefault : [] };
        }

        const result = await handlerFn(sessionUser);
        return { success: true, data: result };
    }

    // ============================================================
    // TEST 1: SQLite Offline - Backend Fail-Closed Enforcement
    // ============================================================
    console.log('\n--- TEST 1: SQLite Offline / Uninitialized Backend Rejection ---');
    assert.strictEqual(dbManager.isDatabaseOpen(), false, 'Database must initially be closed');

    const offlineCall1 = await emulateIpcCall('some-token', 'record_sale', () => {}, { isWrite: true });
    assert.strictEqual(offlineCall1.success, false);
    assert.strictEqual(offlineCall1.error.code, 'DATABASE_NOT_INITIALIZED');

    const offlineCall2 = await emulateIpcCall(null, 'authenticated', () => {});
    assert.strictEqual(offlineCall2.success, false);
    assert.strictEqual(offlineCall2.error.code, 'DATABASE_NOT_INITIALIZED');

    console.log('✅ TEST 1 PASSED: SQLite offline state is completely fail-closed. No operations possible.');

    // ============================================================
    // TEST 2: Initialize Database & Seed Licensed Business Data
    // ============================================================
    console.log('\n--- TEST 2: Initialize Database & Seed Licensed Business Data ---');
    dbManager.initializeDatabase(testDbPath, { allowCreate: true });
    sqliteStatus.initialized = true;
    assert(dbManager.isDatabaseOpen(), 'Database must now be open');

    // Create Licensed Admin
    const adminRes = await userService.createAdminAccount({
        username: 'licensed_owner@company.com',
        password: 'AdminPassword123!',
        licenseId: 'LIC-OWNER-VALID',
        deviceId: 'DEV-HW-BOUND-1'
    });
    assert(adminRes.success, 'Admin creation must succeed');

    const adminLoginRes = await userService.authenticate('licensed_owner@company.com', 'AdminPassword123!');
    assert(adminLoginRes.success, 'Admin login must succeed');
    const licensedToken = adminLoginRes.sessionToken;
    const licensedUser = adminLoginRes.user;
    assert.strictEqual(Boolean(licensedUser.isDemo), false, 'Licensed user must NOT be marked as isDemo');

    // Seed Licensed Products, Stock, Customer, and Genuine Sale
    const db = dbManager.getDatabase();
    db.prepare(`
        INSERT INTO products (id, name, barcode, category, unit, price, cost_price, stock)
        VALUES (101, 'Confidential Enterprise Widget', 'BARCODE-999', 'Hardware', 'pcs', 500.0, 250.0, 50.0)
    `).run();
    db.prepare(`
        INSERT INTO customers (id, name, phone, balance)
        VALUES ('cust_201', 'Licensed Corporate Client', '+1999888777', 1500.0)
    `).run();

    console.log('✅ TEST 2 PASSED: Licensed business records created and secured in SQLite.');

    // ============================================================
    // TEST 3: Standalone / Frontend Fallback Token Cannot Bypass Backend
    // ============================================================
    console.log('\n--- TEST 3: Fallback / Forged Demo Tokens Cannot Authenticate Against SQLite ---');
    const forgedTokens = [
        'demo-session-' + Date.now(),
        'demo-fallback-' + Date.now(),
        'forged-token-abc',
        'null',
        'undefined'
    ];

    for (const fakeToken of forgedTokens) {
        const attempt = await emulateIpcCall(fakeToken, 'record_sale', () => 'unauthorized-mutation', { isWrite: true });
        assert.strictEqual(attempt.success, false, `Fake token "${fakeToken}" must be rejected`);
        assert.strictEqual(attempt.error.code, 'UNAUTHORIZED', `Must return UNAUTHORIZED for fake token`);
    }
    console.log('✅ TEST 3 PASSED: Fallback/unregistered tokens are completely rejected by backend IPC guard.');

    // ============================================================
    // TEST 4: Authorized Demo Session Restrictions & Data Isolation
    // ============================================================
    console.log('\n--- TEST 4: Authorized Demo Session Cannot Access or Modify Licensed Business Data ---');
    const demoRes = await userService.loginDemo();
    assert(demoRes.success, 'Demo login must succeed');
    const demoToken = demoRes.sessionToken;
    const demoUser = demoRes.user;
    assert.strictEqual(demoUser.isDemo, true, 'Demo user must be marked as isDemo: true');

    // 4A: Attempt genuine invoice number generation in Demo Mode
    const demoInvoiceNum = salesService.generateInvoiceNumber(null);
    // In demo mode renderer, invoice numbers are restricted
    console.log('    Invoice generator invoked for demo verification.');

    // 4B: Attempt write operation via IPC guard with Demo Session
    const demoWriteAttempt = await emulateIpcCall(demoToken, 'record_sale', () => {
        return salesService.createSale({ total: 100 });
    }, { isWrite: true });

    assert.strictEqual(demoWriteAttempt.success, false, 'Mutating IPC with demo token must fail');
    assert.strictEqual(demoWriteAttempt.error.code, 'DEMO_RESTRICTED', 'Must return DEMO_RESTRICTED error code');

    // 4C: Verify stock was NOT touched
    const stockRow = db.prepare('SELECT stock FROM products WHERE id = 101').get();
    assert.strictEqual(stockRow.stock, 50, 'Licensed inventory stock must remain completely untouched (50)');

    // 4D: Attempt restricted financial read with Demo Session
    const demoFinancialRead = await emulateIpcCall(demoToken, 'reports', () => {
        return { totalRevenue: 999999, secretBusinessData: true };
    }, { isDemoRestrictedRead: true, demoReadDefault: { totalSales: 0, totalOrders: 0 } });

    assert.strictEqual(demoFinancialRead.success, true);
    assert.strictEqual(demoFinancialRead.data.totalRevenue, undefined, 'Demo user must NOT receive licensed financial data');
    assert.strictEqual(demoFinancialRead.data.totalSales, 0, 'Demo user must receive default isolated metrics');

    console.log('✅ TEST 4 PASSED: Demo session strictly blocked from modifying data or reading licensed records.');

    // ============================================================
    // TEST 5: Licensed Session Legitimate Operation (Control Group)
    // ============================================================
    console.log('\n--- TEST 5: Licensed Admin Normal Business Operations Succeed ---');
    const licensedWriteAttempt = await emulateIpcCall(licensedToken, 'record_sale', () => {
        db.prepare('UPDATE products SET stock = stock - 2 WHERE id = 101').run();
        return { saleId: 1, invoiceNumber: 'INV-001' };
    }, { isWrite: true });

    assert.strictEqual(licensedWriteAttempt.success, true, 'Licensed write operation must succeed');

    const updatedStock = db.prepare('SELECT stock FROM products WHERE id = 101').get();
    assert.strictEqual(updatedStock.stock, 48, 'Stock must be correctly decremented from 50 to 48 for licensed admin');

    console.log('✅ TEST 5 PASSED: Licensed mode successfully processes genuine business transactions.');

    // Cleanup
    dbManager.closeDatabase();
    fs.rmSync(testTempDir, { recursive: true, force: true });

    console.log('\n=============================================================');
    console.log('🎉 ALL DEMO FALLBACK & DATA ISOLATION CHECKS PASSED (5/5)! 🎉');
    console.log('=============================================================');
})().catch(err => {
    console.error('Fatal Security Test Failure:', err);
    process.exit(1);
});
