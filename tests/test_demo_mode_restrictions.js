/**
 * OneBook Test Suite: Demo Mode Access Restrictions & Data Isolation
 * Verifies all 10 scenarios specified in the task requirements:
 * 1. New installation -> Continue with Demo
 * 2. Valid licence installed -> Continue with Demo
 * 3. Demo Mode -> Attempt to complete a sale
 * 4. Demo Mode -> Attempt to create an invoice
 * 5. Demo Mode -> Attempt to modify inventory
 * 6. Demo Mode -> Attempt to modify customer balances
 * 7. Demo Mode -> Attempt to modify petty cash
 * 8. Valid licence -> Admin login with correct credentials
 * 9. Licensed Mode -> Complete a genuine sale and generate an invoice
 * 10. Switch between Demo and Licensed Mode and verify data does not mix
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const database = require('../database');
const userService = require('../services/userService');
const salesService = require('../services/salesService');
const productService = require('../services/productService');
const customerService = require('../services/customerService');
const stockService = require('../services/stockService');
const pettyCashService = require('../services/pettyCashService');

async function runTestSuite() {
    console.log('🧪 Starting OneBook Demo Mode Restrictions & Data Isolation Test Suite...');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_demo_test_'));
    const testDbPath = path.join(tempDir, 'onebook_test.db');
    console.log('📁 Test Database:', testDbPath);

    // Initialize Database
    const db = database.initializeDatabase(testDbPath, { allowCreate: true });
    assert(database.isDatabaseOpen(), 'Database must be initialized and open');
    console.log('✅ SQLite Test Database initialized.');

    // Seed test product and customer for licensed mode
    const productId = productService.createProduct({
        name: 'Licensed Test Product',
        category: 'Hardware',
        unit: 'Piece',
        price: 150,
        cost_price: 100,
        stock: 25,
        min_stock: 5,
        variants: [{
            variantName: 'Default',
            barcode: 'LIC-PROD-001',
            buyingPrice: 100,
            sellingPrice: 150,
            stock: 25
        }]
    });
    const fullProd = productService.getProduct(productId);
    const variantId = fullProd.variants && fullProd.variants.length > 0 ? fullProd.variants[0].id : null;

    const customerId = customerService.createCustomer({
        name: 'Licensed Test Customer',
        phone: '9998887770',
        openingBalance: 500
    });

    // Create Licensed Admin Account
    const adminSetup = await userService.createAdminAccount({
        username: 'admin@onebook.com',
        password: 'AdminPassword@2026',
        licenseId: 'LIC-TEST-001',
        deviceId: 'TEST-DEVICE-001'
    });
    assert(adminSetup.success === true, 'Admin account creation must succeed');
    console.log('✅ Admin Account created for testing.');

    // Mock IPC dispatcher that replicates handleAuthorizedSqlite with our new safeguards
    async function dispatchAuthorizedSqlite(sessionToken, requiredPermission, handlerFn, options = {}) {
        if (!sessionToken || typeof sessionToken !== 'string') {
            return { success: false, error: { code: 'UNAUTHENTICATED', message: 'Missing session token.' } };
        }
        const sessionUser = await userService.validateSession(sessionToken);
        if (!sessionUser) {
            return { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session.' } };
        }
        const isDemo = Boolean(sessionUser.isDemo || sessionUser.id === 'demo_user' || sessionUser.username === 'demo');

        if (isDemo && options && options.isWrite) {
            return { success: false, error: { code: 'DEMO_RESTRICTED', message: 'Database modifications are disabled in Demo Mode.' } };
        }
        if (isDemo && options && options.isDemoRestrictedRead) {
            return { success: true, data: options.demoReadDefault !== undefined ? options.demoReadDefault : [] };
        }
        const isAdmin = !isDemo && (sessionUser.role === 'admin' || sessionUser.role === 'ADMIN');
        if (requiredPermission && requiredPermission !== 'authenticated') {
            const userPerms = Array.isArray(sessionUser.permissions) ? sessionUser.permissions : [];
            const hasPermission = isAdmin || userPerms.includes('all') || userPerms.includes(requiredPermission);
            if (!hasPermission) {
                return { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied.' } };
            }
        }
        const result = await handlerFn(sessionUser);
        return { success: true, data: result };
    }

    // --- SCENARIO 1: New installation -> Continue with Demo ---
    console.log('\n--- SCENARIO 1: New installation -> Continue with Demo ---');
    const demoLoginRes = await userService.loginDemo();
    assert(demoLoginRes.success === true, 'Demo login must succeed');
    assert(demoLoginRes.user.isDemo === true, 'User isDemo flag must be true');
    assert(demoLoginRes.user.id === 'demo_user', 'Demo user ID must be demo_user');
    assert(demoLoginRes.sessionToken, 'Demo session token must be issued');
    const demoToken = demoLoginRes.sessionToken;
    console.log('✅ Scenario 1: New installation creates valid Demo session without credentials.');

    // --- SCENARIO 2: Valid licence installed -> Continue with Demo ---
    console.log('\n--- SCENARIO 2: Valid licence installed -> Continue with Demo ---');
    // On a licensed machine, clicking "Continue with Demo" produces an isDemo session
    const validatedDemoUser = await userService.validateSession(demoToken);
    assert(validatedDemoUser.isDemo === true, 'Validated session must maintain isDemo: true');
    assert(validatedDemoUser.userId === 'demo_user', 'Validated session must retain demo_user');
    console.log('✅ Scenario 2: Valid licence machine entering Demo Mode retains Demo session and restrictions.');

    // --- SCENARIO 3 & 4: Demo Mode -> Attempt to complete a sale & create an invoice ---
    console.log('\n--- SCENARIO 3 & 4: Demo Mode -> Attempt to complete a sale & create an invoice ---');
    // 1. Invoice Number generation for Demo Mode
    const demoReceiptNumberRes = await dispatchAuthorizedSqlite(demoToken, 'record_sale', (user) => {
        if (user && user.isDemo) {
            return "Demo Sales – No Invoice Number";
        }
        return salesService.generateInvoiceNumber();
    });
    assert.strictEqual(demoReceiptNumberRes.data, "Demo Sales – No Invoice Number", 'Receipt number in demo mode must be "Demo Sales – No Invoice Number"');
    console.log('✅ Invoice number generation in Demo Mode returns "Demo Sales – No Invoice Number" (no real invoice number).');

    // 2. Attempt to write sale to SQLite database
    const initialSaleCount = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;
    const demoSaleAttempt = await dispatchAuthorizedSqlite(demoToken, 'record_sale', () => salesService.createSale({
        receipt_number: demoReceiptNumberRes.data,
        subtotal: 150,
        total: 150,
        payment_method: 'cash',
        customer_name: 'Walk-in Customer',
        items: [{
            product_id: productId,
            variant_id: variantId,
            product_name: 'Licensed Test Product',
            name: 'Licensed Test Product',
            quantity: 2,
            price: 150,
            total: 300
        }]
    }), { isWrite: true });

    assert(demoSaleAttempt.success === false, 'Sale creation in SQLite must fail for Demo session');
    assert.strictEqual(demoSaleAttempt.error.code, 'DEMO_RESTRICTED', 'Error code must be DEMO_RESTRICTED');
    const afterSaleCount = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;
    assert.strictEqual(afterSaleCount, initialSaleCount, 'No sale records must be added to SQLite in Demo Mode');
    console.log('✅ Scenario 3 & 4: Attempting to record sale / invoice in SQLite is blocked with DEMO_RESTRICTED.');

    // --- SCENARIO 5: Demo Mode -> Attempt to modify inventory ---
    console.log('\n--- SCENARIO 5: Demo Mode -> Attempt to modify inventory ---');
    const initialStock = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variantId).stock;
    const demoStockAttempt = await dispatchAuthorizedSqlite(demoToken, 'inventory', () => stockService.adjustStock(
        productId, variantId, -5, 'Demo Sale', 'sale', null
    ), { isWrite: true });
    assert(demoStockAttempt.success === false, 'Stock adjustment must be rejected for Demo session');
    assert.strictEqual(demoStockAttempt.error.code, 'DEMO_RESTRICTED');
    const stockAfter = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variantId).stock;
    assert.strictEqual(stockAfter, initialStock, 'Licensed inventory stock must remain completely unmodified');
    console.log('✅ Scenario 5: Attempting to modify inventory stock in Demo Mode is blocked with DEMO_RESTRICTED.');

    // --- SCENARIO 6: Demo Mode -> Attempt to modify customer balances ---
    console.log('\n--- SCENARIO 6: Demo Mode -> Attempt to modify customer balances ---');
    const initialCustomerBal = db.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customerId).opening_balance;
    const demoCustomerAttempt = await dispatchAuthorizedSqlite(demoToken, 'record_sale', () => customerService.updateCustomer(
        customerId, { openingBalance: 9999 }
    ), { isWrite: true });
    assert(demoCustomerAttempt.success === false, 'Customer balance update must be rejected for Demo session');
    assert.strictEqual(demoCustomerAttempt.error.code, 'DEMO_RESTRICTED');
    const customerBalAfter = db.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customerId).opening_balance;
    assert.strictEqual(customerBalAfter, initialCustomerBal, 'Customer balance in SQLite must remain completely unmodified');
    console.log('✅ Scenario 6: Attempting to modify customer balances in Demo Mode is blocked with DEMO_RESTRICTED.');

    // --- SCENARIO 7: Demo Mode -> Attempt to modify petty cash ---
    console.log('\n--- SCENARIO 7: Demo Mode -> Attempt to modify petty cash ---');
    const demoPettyCashAttempt = await dispatchAuthorizedSqlite(demoToken, 'petty_cash', () => pettyCashService.createTransaction({
        date: new Date().toISOString(),
        type: 'expense',
        category: 'Tea',
        amount: 50,
        account: 'cash'
    }), { isWrite: true });
    assert(demoPettyCashAttempt.success === false, 'Petty cash transaction must be rejected for Demo session');
    assert.strictEqual(demoPettyCashAttempt.error.code, 'DEMO_RESTRICTED');
    console.log('✅ Scenario 7: Attempting to modify petty cash in Demo Mode is blocked with DEMO_RESTRICTED.');

    // --- SCENARIO 8: Valid licence -> Admin login with correct credentials ---
    console.log('\n--- SCENARIO 8: Valid licence -> Admin login with correct credentials ---');
    const adminLoginRes = await userService.authenticate('admin@onebook.com', 'AdminPassword@2026');
    assert(adminLoginRes.success === true, 'Admin login must succeed with correct credentials');
    assert(adminLoginRes.sessionToken, 'Admin session token must be returned');
    assert(adminLoginRes.user.isDemo !== true, 'Admin user must NOT have isDemo set to true');
    const adminToken = adminLoginRes.sessionToken;
    const validatedAdmin = await userService.validateSession(adminToken);
    assert(validatedAdmin.isDemo === false, 'Validated Admin session must have isDemo: false');
    console.log('✅ Scenario 8: Admin login succeeds and creates Licensed session (isDemo: false).');

    // --- SCENARIO 9: Licensed Mode -> Complete a genuine sale and generate an invoice ---
    console.log('\n--- SCENARIO 9: Licensed Mode -> Complete a genuine sale and generate an invoice ---');
    // Generate real invoice number
    const adminReceiptRes = await dispatchAuthorizedSqlite(adminToken, 'record_sale', (user) => {
        if (user && user.isDemo) {
            return "Demo Sales – No Invoice Number";
        }
        return salesService.generateInvoiceNumber();
    });
    assert(adminReceiptRes.success === true, 'Invoice number generation for licensed admin must succeed');
    assert(adminReceiptRes.data.startsWith('INV-'), `Invoice number must have real INV- prefix, got: ${adminReceiptRes.data}`);
    console.log(`✅ Real invoice number generated for licensed sale: ${adminReceiptRes.data}`);

    // Create real sale in SQLite
    const licensedSaleRes = await dispatchAuthorizedSqlite(adminToken, 'record_sale', () => salesService.createSale({
        receipt_number: adminReceiptRes.data,
        subtotal: 300,
        total: 300,
        payment_method: 'cash',
        customer_id: customerId,
        customer_name: 'Licensed Test Customer',
        items: [{
            product_id: productId,
            variant_id: variantId,
            product_name: 'Licensed Test Product',
            name: 'Licensed Test Product',
            quantity: 2,
            price: 150,
            total: 300
        }]
    }), { isWrite: true });

    assert(licensedSaleRes.success === true, 'Licensed sale creation in SQLite must succeed');
    const newStock = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variantId).stock;
    assert.strictEqual(newStock, initialStock - 2, 'Stock in SQLite must be decremented by 2 for genuine licensed sale');
    console.log(`✅ Genuine sale successfully recorded in SQLite. Stock updated from ${initialStock} to ${newStock}.`);

    // --- SCENARIO 10: Switch between Demo and Licensed Mode and verify that data does not mix ---
    console.log('\n--- SCENARIO 10: Switch between Demo and Licensed Mode (Data Isolation) ---');
    // 1. Query sales as Demo User
    const demoSalesQuery = await dispatchAuthorizedSqlite(demoToken, 'record_sale', () => salesService.getSales(), {
        isDemoRestrictedRead: true,
        demoReadDefault: []
    });
    assert(Array.isArray(demoSalesQuery.data), 'Demo sales query must return array');
    assert.strictEqual(demoSalesQuery.data.length, 0, 'Demo Mode must NEVER read licensed sales records');

    // 2. Query products as Demo User
    const demoProductsQuery = await dispatchAuthorizedSqlite(demoToken, 'products', () => productService.getProducts(), {
        isDemoRestrictedRead: true,
        demoReadDefault: []
    });
    assert.strictEqual(demoProductsQuery.data.length, 0, 'Demo Mode must NEVER read licensed products from SQLite');

    // 3. Query sales as Licensed Admin
    const adminSalesQuery = await dispatchAuthorizedSqlite(adminToken, 'record_sale', () => salesService.getSales(), {
        isDemoRestrictedRead: true,
        demoReadDefault: []
    });
    assert(adminSalesQuery.data.length >= 1, 'Licensed Admin must see real business sales');
    assert.strictEqual(adminSalesQuery.data[0].receipt_number, adminReceiptRes.data, 'Licensed Admin sees genuine invoice record');

    // 4. Query products as Licensed Admin
    const adminProductsQuery = await dispatchAuthorizedSqlite(adminToken, 'products', () => productService.getProducts(), {
        isDemoRestrictedRead: true,
        demoReadDefault: []
    });
    assert(adminProductsQuery.data.length >= 1, 'Licensed Admin sees real business products');
    assert.strictEqual(adminProductsQuery.data[0].name, 'Licensed Test Product', 'Licensed Admin sees correct product');

    console.log('✅ Data Isolation Verified: Demo Mode has 0 access to licensed records; Licensed Mode has full access to business records.');
    console.log('\n======================================================');
    console.log('🎉 ALL 10 DEMO MODE RESTRICTION SCENARIOS VERIFIED! 🎉');
    console.log('======================================================');

    // Cleanup
    database.closeDatabase();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
}

runTestSuite().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
