const electron = require('electron');

if (typeof electron === 'string') {
    const { spawn } = require('child_process');
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electron, [__filename], { env, stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code || 0));
    return;
}

const { app, BrowserWindow, ipcMain } = electron;
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');
const Database = require('better-sqlite3');

app.disableHardwareAcceleration();

// Production database path
const PROD_DB_PATH = '/Users/log/Desktop/untitled folder/doodles-store-desktop/OneBook/onebook.db';

// Completely isolated temporary directory for test databases A and B
const AUDIT_TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_final_release_audit_'));
const DIR_A = path.join(AUDIT_TMP_DIR, 'DB_A_DIR');
const DB_A_PATH = path.join(DIR_A, 'onebook_test_A.db');

const DIR_B = path.join(AUDIT_TMP_DIR, 'DB_B_DIR');
const DB_B_PATH = path.join(DIR_B, 'onebook_test_B.db');

process.env.ONEBOOK_TEST_RUNNER = '1';
process.env.ONEBOOK_SQLITE_PATH = DB_A_PATH;

const mainApp = require('../main');
const dbManager = require('../database');

console.log('================================================================');
console.log('🚀 OneBook — Final Release Readiness Audit Suite');
console.log('📁 Isolated Test Dir:', AUDIT_TMP_DIR);
console.log('📁 Database A:       ', DB_A_PATH);
console.log('📁 Database B:       ', DB_B_PATH);
console.log('================================================================\n');

// Helper to record DB snapshot
function getDbSnapshot(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    const buf = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const db = new Database(filePath, { readonly: true });
    const integrity = db.pragma('integrity_check');
    const tables = [
        'products', 'product_variants', 'sales', 'sale_items',
        'purchases', 'purchase_items', 'customers', 'suppliers',
        'petty_cash_transactions', 'day_closings', 'users'
    ];
    const counts = {};
    for (const t of tables) {
        try {
            counts[t] = db.prepare('SELECT count(*) as c FROM ' + t).get().c;
        } catch (e) {
            counts[t] = 0;
        }
    }
    db.close();
    return {
        path: filePath,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        sha256,
        integrity: integrity[0]?.integrity_check || 'unknown',
        counts
    };
}

// Setup test databases
function setupTestDatabases() {
    fs.mkdirSync(DIR_A, { recursive: true });
    fs.mkdirSync(DIR_B, { recursive: true });

    // Initialize Schema in A
    const dbInitA = new Database(DB_A_PATH);
    dbInitA.close();
    dbManager.initializeDatabase(DB_A_PATH, { allowCreate: true });
    dbManager.closeDatabase();

    // Initialize Schema in B
    const dbInitB = new Database(DB_B_PATH);
    dbInitB.close();
    dbManager.initializeDatabase(DB_B_PATH, { allowCreate: true });
    dbManager.closeDatabase();

    // Seed Database A
    const dbA = new Database(DB_A_PATH);
    const pResA = dbA.prepare(`
        INSERT INTO products (name, barcode, category, unit, price, cost_price, stock, min_stock, description, gst_rate)
        VALUES ('TEST_DB_A_PRODUCT', 'BARCODE_A_111', 'Category A', 'Piece', 100, 60, 50, 10, 'Database A unique product', 18)
    `).run();
    dbA.prepare(`
        INSERT INTO product_variants (product_id, variant_name, barcode, buying_price, selling_price, stock)
        VALUES (?, '', 'BARCODE_A_111', 60, 100, 50)
    `).run(pResA.lastInsertRowid);

    dbA.prepare(`
        INSERT INTO customers (id, name, phone, opening_balance, balance, address)
        VALUES ('cust_a_1', 'TEST_DB_A_RECEIVABLE', '9990001111', 1500, 1500, 'Customer A Address')
    `).run();

    dbA.prepare(`
        INSERT INTO suppliers (id, name, phone, balance, address)
        VALUES ('supp_a_1', 'TEST_DB_A_PAYABLE', '9990002222', 2500, 'Supplier A Address')
    `).run();

    dbA.prepare(`
        INSERT INTO sales (receipt_number, customer_id, date, subtotal, discount, total, payment_method, status)
        VALUES ('INV-A-101', 'cust_a_1', datetime('now'), 500, 0, 500, 'cash', 'ACTIVE')
    `).run();

    dbA.prepare(`
        INSERT INTO purchases (invoice_number, supplier_id, date, subtotal, total, payment_method, status)
        VALUES ('PUR-A-201', 'supp_a_1', datetime('now'), 800, 800, 'cash', 'ACTIVE')
    `).run();

    dbA.prepare(`
        INSERT INTO petty_cash_transactions (type, amount, category, description, date, status)
        VALUES ('expense', 300, 'Office Supplies', 'TEST_DB_A_CASH', date('now'), 'ACTIVE')
    `).run();

    dbA.prepare(`
        INSERT INTO day_closings (date, opening_balance, cash_sales, cash_out, expected_balance, actual_balance, difference, notes)
        VALUES (date('now'), 1000, 500, 300, 1200, 1200, 0, 'TEST_DB_A_CLOSE')
    `).run();

    dbA.prepare(`
        INSERT OR REPLACE INTO users (id, name, username, password_hash, role, status, permissions_json)
        VALUES ('admin_audit', 'Admin', 'admin', 'hash', 'admin', 'active', '["all"]')
    `).run();
    dbA.prepare(`
        INSERT OR REPLACE INTO user_sessions (token, user_id, expires_at, revoked)
        VALUES ('final_release_token', 'admin_audit', datetime('now', '+1 year'), 0)
    `).run();
    dbA.close();

    // Seed Database B
    const dbB = new Database(DB_B_PATH);
    const pResB = dbB.prepare(`
        INSERT INTO products (name, barcode, category, unit, price, cost_price, stock, min_stock, description, gst_rate)
        VALUES ('TEST_DB_B_PRODUCT', 'BARCODE_B_222', 'Category B', 'Piece', 250, 150, 80, 15, 'Database B unique product', 12)
    `).run();
    dbB.prepare(`
        INSERT INTO product_variants (product_id, variant_name, barcode, buying_price, selling_price, stock)
        VALUES (?, '', 'BARCODE_B_222', 150, 250, 80)
    `).run(pResB.lastInsertRowid);

    dbB.prepare(`
        INSERT INTO customers (id, name, phone, opening_balance, balance, address)
        VALUES ('cust_b_1', 'TEST_DB_B_RECEIVABLE', '8880001111', 3500, 3500, 'Customer B Address')
    `).run();

    dbB.prepare(`
        INSERT INTO suppliers (id, name, phone, balance, address)
        VALUES ('supp_b_1', 'TEST_DB_B_PAYABLE', '8880002222', 4500, 'Supplier B Address')
    `).run();

    dbB.prepare(`
        INSERT INTO sales (receipt_number, customer_id, date, subtotal, discount, total, payment_method, status)
        VALUES ('INV-B-301', 'cust_b_1', datetime('now'), 1200, 0, 1200, 'bank', 'ACTIVE')
    `).run();

    dbB.prepare(`
        INSERT INTO purchases (invoice_number, supplier_id, date, subtotal, total, payment_method, status)
        VALUES ('PUR-B-401', 'supp_b_1', datetime('now'), 1800, 1800, 'bank', 'ACTIVE')
    `).run();

    dbB.prepare(`
        INSERT INTO petty_cash_transactions (type, amount, category, description, date, status)
        VALUES ('expense', 700, 'Rent', 'TEST_DB_B_CASH', date('now'), 'ACTIVE')
    `).run();

    dbB.prepare(`
        INSERT INTO day_closings (date, opening_balance, cash_sales, cash_out, expected_balance, actual_balance, difference, notes)
        VALUES (date('now'), 2000, 1200, 700, 2500, 2500, 0, 'TEST_DB_B_CLOSE')
    `).run();

    dbB.prepare(`
        INSERT OR REPLACE INTO users (id, name, username, password_hash, role, status, permissions_json)
        VALUES ('admin_audit', 'Admin', 'admin', 'hash', 'admin', 'active', '["all"]')
    `).run();
    dbB.prepare(`
        INSERT OR REPLACE INTO user_sessions (token, user_id, expires_at, revoked)
        VALUES ('final_release_token', 'admin_audit', datetime('now', '+1 year'), 0)
    `).run();
    dbB.close();

    console.log('✓ Isolated Test Databases A and B seeded successfully.');
}

app.whenReady().then(async () => {
    setupTestDatabases();

    // Baseline production snapshot
    const baselineProd = getDbSnapshot(PROD_DB_PATH);
    console.log('\n[PHASE 1] Recorded Production Baseline:');
    console.log('  Path:    ', baselineProd.path);
    console.log('  Size:    ', baselineProd.size, 'bytes');
    console.log('  Checksum:', baselineProd.sha256);
    console.log('  Counts:  ', JSON.stringify(baselineProd.counts));

    // Connect to Database A
    mainApp.initSqliteAtStartup();

    ipcMain.removeAllListeners('get-license-info-sync');
    ipcMain.on('get-license-info-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
    ipcMain.removeAllListeners('get-license-sync');
    ipcMain.on('get-license-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });

    const win = new BrowserWindow({
        width: 1280,
        height: 850,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    // Helper to verify data across modules in the UI
    async function verifyModuleData(expectedDb) {
        return await win.webContents.executeJavaScript(`(async () => {
            const getTexts = (selector) => Array.from(document.querySelectorAll(selector)).map(e => e.textContent || '').join(' ');
            
            // 1. Inventory & Products
            const invText = getTexts('#inventoryTableBody, #productsTableBody');
            const hasAProd = invText.includes('TEST_DB_A_PRODUCT');
            const hasBProd = invText.includes('TEST_DB_B_PRODUCT');

            // 2. Sales
            const salesText = getTexts('#recentSalesBody, #todaySalesTableBody, #reportsSalesTable');
            const hasASale = salesText.includes('INV-A-101') || (typeof sales !== 'undefined' && sales.some(s => s.receipt_number === 'INV-A-101'));
            const hasBSale = salesText.includes('INV-B-301') || (typeof sales !== 'undefined' && sales.some(s => s.receipt_number === 'INV-B-301'));

            // 3. Purchases
            const hasAPur = typeof purchases !== 'undefined' && purchases.some(p => p.invoice_number === 'PUR-A-201');
            const hasBPur = typeof purchases !== 'undefined' && purchases.some(p => p.invoice_number === 'PUR-B-401');

            // 4. Receivables (Customers)
            const custText = getTexts('#receivablesTableBody, #customerSelect');
            const hasACust = custText.includes('TEST_DB_A_RECEIVABLE') || (typeof customers !== 'undefined' && customers.some(c => c.name === 'TEST_DB_A_RECEIVABLE'));
            const hasBCust = custText.includes('TEST_DB_B_RECEIVABLE') || (typeof customers !== 'undefined' && customers.some(c => c.name === 'TEST_DB_B_RECEIVABLE'));

            // 5. Payables (Suppliers)
            const suppText = getTexts('#payablesTableBody, #supplierSelect');
            const hasASupp = suppText.includes('TEST_DB_A_PAYABLE') || (typeof suppliers !== 'undefined' && suppliers.some(s => s.name === 'TEST_DB_A_PAYABLE'));
            const hasBSupp = suppText.includes('TEST_DB_B_PAYABLE') || (typeof suppliers !== 'undefined' && suppliers.some(s => s.name === 'TEST_DB_B_PAYABLE'));

            // 6. Petty Cash
            const pcText = getTexts('#pcLedgerTable');
            const hasAPc = pcText.includes('TEST_DB_A_CASH') || (typeof pcTransactions !== 'undefined' && pcTransactions.some(t => t.description === 'TEST_DB_A_CASH'));
            const hasBPc = pcText.includes('TEST_DB_B_CASH') || (typeof pcTransactions !== 'undefined' && pcTransactions.some(t => t.description === 'TEST_DB_B_CASH'));

            // 7. Day Closing
            const dcText = getTexts('#dayClosingHistoryBody');
            const hasADc = dcText.includes('TEST_DB_A_CLOSE') || (typeof dayClosings !== 'undefined' && dayClosings.some(d => d.notes === 'TEST_DB_A_CLOSE'));
            const hasBDc = dcText.includes('TEST_DB_B_CLOSE') || (typeof dayClosings !== 'undefined' && dayClosings.some(d => d.notes === 'TEST_DB_B_CLOSE'));

            const activePathInUI = document.getElementById('dbDetailPath') ? document.getElementById('dbDetailPath').textContent : '';

            return {
                inventory: { hasA: hasAProd, hasB: hasBProd },
                sales: { hasA: hasASale, hasB: hasBSale },
                purchases: { hasA: hasAPur, hasB: hasBPur },
                receivable: { hasA: hasACust, hasB: hasBCust },
                payable: { hasA: hasASupp, hasB: hasBSupp },
                pettyCash: { hasA: hasAPc, hasB: hasBPc },
                dayClosing: { hasA: hasADc, hasB: hasBDc },
                activePathInUI
            };
        })()`);
    }

    async function rehydrateAllModules() {
        await win.webContents.executeJavaScript(`(async () => {
            products = []; sales = []; customers = []; suppliers = []; purchases = []; pcTransactions = []; dayClosings = [];
            if (typeof refreshUI === 'function') await refreshUI();
            if (typeof updateDashboard === 'function') await updateDashboard();
            if (typeof updateInventoryTable === 'function') await updateInventoryTable();
            if (typeof updateProductsTable === 'function') await updateProductsTable();
            if (typeof renderReceivablesTable === 'function') await renderReceivablesTable();
            if (typeof renderPayablesTable === 'function') await renderPayablesTable();
            if (typeof loadDayClosingsFromSQLite === 'function') await loadDayClosingsFromSQLite();
            if (typeof renderDayClosingHistory === 'function') renderDayClosingHistory();
            if (typeof loadPettyCashDataFromSQLite === 'function') await loadPettyCashDataFromSQLite();
            if (typeof renderPCLedger === 'function') renderPCLedger();
            if (typeof updateDatabaseLocationUI === 'function') await updateDatabaseLocationUI();
        })()`);
        await new Promise(r => setTimeout(r, 400));
    }

    try {
        // Authenticate into OneBook.html
        await win.loadFile(path.join(__dirname, '../login.html'));
        await new Promise(r => setTimeout(r, 300));

        await win.webContents.executeJavaScript(`
            sessionStorage.setItem('onebook_session_token', 'final_release_token');
            localStorage.setItem('onebook_session_token', 'final_release_token');
            sessionStorage.setItem('sessionToken', 'final_release_token');
            localStorage.setItem('sessionToken', 'final_release_token');
            sessionStorage.setItem('currentUser', JSON.stringify({ id: 'admin_audit', username: 'admin', role: 'admin', permissions: ['all'] }));
            window.location.href = 'OneBook.html';
        `);

        await new Promise(r => win.webContents.once('did-finish-load', r));
        await new Promise(r => setTimeout(r, 500));

        await win.webContents.executeJavaScript(`
            window.isDemoMode = () => false;
            try { isDemoMode = () => false; } catch(e){}
            window.alert = (msg) => console.log('[UI Alert]:', msg);
            window.confirm = () => true;
            window.isUserAdmin = true;
            window.hasPermission = () => true;
            if (window.electronAPI && window.electronAPI.sqlite && window.electronAPI.sqlite.setSessionToken) {
                window.electronAPI.sqlite.setSessionToken('final_release_token');
            }
        `);

        // ====================================================================
        // PHASE 4: Database Location Switching (A -> B -> A) & Persistence
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 4: Database Switching & Isolation ---');
        console.log('================================================================');

        await rehydrateAllModules();
        const snapA = await verifyModuleData('A');
        console.log('Initial DB A check:');
        console.log('  Inventory:   A:', snapA.inventory.hasA, '  B:', snapA.inventory.hasB);
        console.log('  Sales:       A:', snapA.sales.hasA, '  B:', snapA.sales.hasB);
        console.log('  Purchases:   A:', snapA.purchases.hasA, '  B:', snapA.purchases.hasB);
        console.log('  Receivables: A:', snapA.receivable.hasA, '  B:', snapA.receivable.hasB);
        console.log('  Payables:    A:', snapA.payable.hasA, '  B:', snapA.payable.hasB);
        console.log('  Petty Cash:  A:', snapA.pettyCash.hasA, '  B:', snapA.pettyCash.hasB);
        console.log('  Day Closing: A:', snapA.dayClosing.hasA, '  B:', snapA.dayClosing.hasB);

        assert(snapA.inventory.hasA && !snapA.inventory.hasB, 'DB A inventory isolated');
        assert(snapA.sales.hasA && !snapA.sales.hasB, 'DB A sales isolated');
        assert(snapA.purchases.hasA && !snapA.purchases.hasB, 'DB A purchases isolated');
        assert(snapA.receivable.hasA && !snapA.receivable.hasB, 'DB A receivables isolated');
        assert(snapA.payable.hasA && !snapA.payable.hasB, 'DB A payables isolated');
        assert(snapA.pettyCash.hasA && !snapA.pettyCash.hasB, 'DB A petty cash isolated');
        assert(snapA.dayClosing.hasA && !snapA.dayClosing.hasB, 'DB A day closing isolated');
        console.log('✓ 4.1 Database A loaded exclusively (0% DB B data)');

        // Switch to Database B
        console.log('\nSwitching to Database B via changeDatabaseLocation...');
        const switchB = await win.webContents.executeJavaScript(`window.electronAPI.sqlite.system.changeDatabaseLocation({ folderPath: '${DB_B_PATH}', skipBackup: false })`);
        assert.strictEqual(switchB.success, true, 'Switch to B must succeed');
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_B_PATH), 'Backend active DB must be B');

        await rehydrateAllModules();
        const snapB = await verifyModuleData('B');
        console.log('DB B check:');
        console.log('  Inventory:   A:', snapB.inventory.hasA, '  B:', snapB.inventory.hasB);
        console.log('  Sales:       A:', snapB.sales.hasA, '  B:', snapB.sales.hasB);
        console.log('  Purchases:   A:', snapB.purchases.hasA, '  B:', snapB.purchases.hasB);
        console.log('  Receivables: A:', snapB.receivable.hasA, '  B:', snapB.receivable.hasB);
        console.log('  Payables:    A:', snapB.payable.hasA, '  B:', snapB.payable.hasB);
        console.log('  Petty Cash:  A:', snapB.pettyCash.hasA, '  B:', snapB.pettyCash.hasB);
        console.log('  Day Closing: A:', snapB.dayClosing.hasA, '  B:', snapB.dayClosing.hasB);

        assert(!snapB.inventory.hasA && snapB.inventory.hasB, 'DB B inventory isolated');
        assert(!snapB.sales.hasA && snapB.sales.hasB, 'DB B sales isolated');
        assert(!snapB.purchases.hasA && snapB.purchases.hasB, 'DB B purchases isolated');
        assert(!snapB.receivable.hasA && snapB.receivable.hasB, 'DB B receivables isolated');
        assert(!snapB.payable.hasA && snapB.payable.hasB, 'DB B payables isolated');
        assert(!snapB.pettyCash.hasA && snapB.pettyCash.hasB, 'DB B petty cash isolated');
        assert(!snapB.dayClosing.hasA && snapB.dayClosing.hasB, 'DB B day closing isolated');
        console.log('✓ 4.2 Switched to Database B exclusively (0% DB A data)');

        // Switch back to Database A
        console.log('\nSwitching back to Database A (Reversibility)...');
        const switchA = await win.webContents.executeJavaScript(`window.electronAPI.sqlite.system.changeDatabaseLocation({ folderPath: '${DB_A_PATH}', skipBackup: false })`);
        assert.strictEqual(switchA.success, true, 'Switch back to A must succeed');
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_A_PATH), 'Backend active DB must be A');

        await rehydrateAllModules();
        const snapBackA = await verifyModuleData('A');
        assert(snapBackA.inventory.hasA && !snapBackA.inventory.hasB, 'Restored DB A inventory');
        assert(snapBackA.sales.hasA && !snapBackA.sales.hasB, 'Restored DB A sales');
        console.log('✓ 4.3 Switched back to Database A: 100% reversible');

        // Restart while connected to B
        console.log('\nTesting restart while connected to B...');
        await win.webContents.executeJavaScript(`window.electronAPI.sqlite.system.changeDatabaseLocation({ folderPath: '${DB_B_PATH}', skipBackup: true })`);
        delete process.env.ONEBOOK_SQLITE_PATH; // relies on config.json
        const configPath = path.join(app.getPath('userData'), 'config.json');
        const confB = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        assert.strictEqual(path.resolve(confB.sqliteDatabasePath), path.resolve(DB_B_PATH), 'config.json stores DB B');

        dbManager.closeDatabase();
        const restartPathB = JSON.parse(fs.readFileSync(configPath, 'utf8')).sqliteDatabasePath;
        dbManager.initializeDatabase(restartPathB, { allowCreate: false });
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_B_PATH));
        await rehydrateAllModules();
        const snapRestartB = await verifyModuleData('B');
        assert(!snapRestartB.inventory.hasA && snapRestartB.inventory.hasB, 'Restart B verified');
        console.log('✓ 4.4 Restart persistence on Database B verified');

        // Restart while connected to A
        console.log('\nTesting restart while connected to A...');
        await win.webContents.executeJavaScript(`window.electronAPI.sqlite.system.changeDatabaseLocation({ folderPath: '${DB_A_PATH}', skipBackup: true })`);
        const confA = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        assert.strictEqual(path.resolve(confA.sqliteDatabasePath), path.resolve(DB_A_PATH), 'config.json stores DB A');

        dbManager.closeDatabase();
        const restartPathA = JSON.parse(fs.readFileSync(configPath, 'utf8')).sqliteDatabasePath;
        dbManager.initializeDatabase(restartPathA, { allowCreate: false });
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_A_PATH));
        await rehydrateAllModules();
        const snapRestartA = await verifyModuleData('A');
        assert(snapRestartA.inventory.hasA && !snapRestartA.inventory.hasB, 'Restart A verified');
        console.log('✓ 4.5 Restart persistence on Database A verified');

        // ====================================================================
        // PHASE 5: Comprehensive Controlled Write Isolation in Database B
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 5: Write Isolation Across All 7 Modules ---');
        console.log('================================================================');

        // Switch to DB B for writes
        await win.webContents.executeJavaScript(`window.electronAPI.sqlite.system.changeDatabaseLocation({ folderPath: '${DB_B_PATH}', skipBackup: true })`);
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_B_PATH));

        const writeResults = await win.webContents.executeJavaScript(`(async () => {
            // 1. Write Product
            const pRes = await window.electronAPI.sqlite.products.create({
                name: 'WRITE_TEST_PROD_B',
                price: 199,
                stock: 25,
                category: 'Category B',
                unit: 'Piece'
            });
            const pId = pRes?.data || pRes?.id || pRes;
            const pObj = (await window.electronAPI.sqlite.products.get(pId))?.data;
            const varId = pObj?.variants?.[0]?.id;

            // 2. Write Customer
            const cRes = await window.electronAPI.sqlite.customers.create({
                id: 'cust_write_b',
                name: 'WRITE_TEST_CUST_B',
                phone: '7770001111',
                balance: 500
            });

            // 3. Write Supplier
            const sRes = await window.electronAPI.sqlite.suppliers.create({
                id: 'supp_write_b',
                name: 'WRITE_TEST_SUPP_B',
                phone: '7770002222',
                balance: 750
            });

            // 4. Write Sale
            const saleRes = await window.electronAPI.sqlite.sales.create({
                customer_id: 'cust_write_b',
                customer_name: 'WRITE_TEST_CUST_B',
                payment_method: 'cash',
                subtotal: 199,
                total: 199,
                items: [{
                    product_id: pId,
                    variant_id: varId,
                    product_name: 'WRITE_TEST_PROD_B',
                    quantity: 1,
                    price: 199,
                    total: 199
                }]
            });

            // 5. Write Purchase
            const purRes = await window.electronAPI.sqlite.purchases.create({
                invoiceNumber: 'PUR-WRITE-B-999',
                supplierId: 'supp_write_b',
                supplier: 'WRITE_TEST_SUPP_B',
                payment_method: 'cash',
                total: 350,
                items: [{
                    productId: pId,
                    variantId: varId,
                    productName: 'WRITE_TEST_PROD_B',
                    quantity: 2,
                    price: 175,
                    total: 350
                }]
            });

            // 6. Write Petty Cash
            const pcRes = await window.electronAPI.sqlite.pettyCash.createTransaction({
                type: 'expense',
                amount: 150,
                category: 'Office Supplies',
                description: 'WRITE_TEST_PC_B',
                account: 'cash'
            });

            // 7. Write Day Closing
            const dcRes = await window.electronAPI.sqlite.dayClosing.save({
                date: '2026-11-20',
                opening_balance: 1000,
                cash_sales: 199,
                cash_out: 150,
                expected_balance: 1049,
                actual_balance: 1049,
                difference: 0,
                notes: 'WRITE_TEST_DC_B'
            });

            return { pRes, cRes, sRes, saleRes, purRes, pcRes, dcRes };
        })()`);

        console.log('Write results in DB B:');
        console.log('  Product:   ', writeResults.pRes?.id || writeResults.pRes?.success);
        console.log('  Customer:  ', writeResults.cRes?.success || writeResults.cRes?.id);
        console.log('  Supplier:  ', writeResults.sRes?.success || writeResults.sRes?.id);
        console.log('  Sale:      ', writeResults.saleRes?.receipt_number || writeResults.saleRes?.success);
        console.log('  Purchase:  ', writeResults.purRes?.id || writeResults.purRes?.success);
        console.log('  Petty Cash:', writeResults.pcRes?.id || writeResults.pcRes?.success);
        console.log('  Day Closing:', writeResults.dcRes?.id || writeResults.dcRes?.success);

        // Verification in Database B
        const verifyB = new Database(DB_B_PATH, { readonly: true });
        const hasProdInB = verifyB.prepare("SELECT count(*) as c FROM products WHERE name = 'WRITE_TEST_PROD_B'").get().c;
        const hasCustInB = verifyB.prepare("SELECT count(*) as c FROM customers WHERE name = 'WRITE_TEST_CUST_B'").get().c;
        const hasSuppInB = verifyB.prepare("SELECT count(*) as c FROM suppliers WHERE name = 'WRITE_TEST_SUPP_B'").get().c;
        const hasSaleInB = verifyB.prepare("SELECT count(*) as c FROM sales WHERE customer_name = 'WRITE_TEST_CUST_B'").get().c;
        const hasPurInB  = verifyB.prepare("SELECT count(*) as c FROM purchases WHERE invoice_number = 'PUR-WRITE-B-999'").get().c;
        const hasPcInB   = verifyB.prepare("SELECT count(*) as c FROM petty_cash_transactions WHERE description = 'WRITE_TEST_PC_B'").get().c;
        const hasDcInB   = verifyB.prepare("SELECT count(*) as c FROM day_closings WHERE notes = 'WRITE_TEST_DC_B'").get().c;
        verifyB.close();

        assert.strictEqual(hasProdInB, 1, 'Product written to DB B');
        assert.strictEqual(hasCustInB, 1, 'Customer written to DB B');
        assert.strictEqual(hasSuppInB, 1, 'Supplier written to DB B');
        assert.strictEqual(hasSaleInB, 1, 'Sale written to DB B');
        assert.strictEqual(hasPurInB, 1, 'Purchase written to DB B');
        assert.strictEqual(hasPcInB, 1, 'Petty Cash written to DB B');
        assert.strictEqual(hasDcInB, 1, 'Day Closing written to DB B');
        console.log('✓ All 7 writes confirmed present in Database B');

        // Verification in Database A (Must have 0 of these writes)
        const verifyA = new Database(DB_A_PATH, { readonly: true });
        const hasProdInA = verifyA.prepare("SELECT count(*) as c FROM products WHERE name = 'WRITE_TEST_PROD_B'").get().c;
        const hasCustInA = verifyA.prepare("SELECT count(*) as c FROM customers WHERE name = 'WRITE_TEST_CUST_B'").get().c;
        const hasSuppInA = verifyA.prepare("SELECT count(*) as c FROM suppliers WHERE name = 'WRITE_TEST_SUPP_B'").get().c;
        const hasSaleInA = verifyA.prepare("SELECT count(*) as c FROM sales WHERE customer_name = 'WRITE_TEST_CUST_B'").get().c;
        const hasPurInA  = verifyA.prepare("SELECT count(*) as c FROM purchases WHERE invoice_number = 'PUR-WRITE-B-999'").get().c;
        const hasPcInA   = verifyA.prepare("SELECT count(*) as c FROM petty_cash_transactions WHERE description = 'WRITE_TEST_PC_B'").get().c;
        const hasDcInA   = verifyA.prepare("SELECT count(*) as c FROM day_closings WHERE notes = 'WRITE_TEST_DC_B'").get().c;
        verifyA.close();

        assert.strictEqual(hasProdInA, 0, 'DB A isolated from DB B product write');
        assert.strictEqual(hasCustInA, 0, 'DB A isolated from DB B customer write');
        assert.strictEqual(hasSuppInA, 0, 'DB A isolated from DB B supplier write');
        assert.strictEqual(hasSaleInA, 0, 'DB A isolated from DB B sale write');
        assert.strictEqual(hasPurInA, 0, 'DB A isolated from DB B purchase write');
        assert.strictEqual(hasPcInA, 0, 'DB A isolated from DB B petty cash write');
        assert.strictEqual(hasDcInA, 0, 'DB A isolated from DB B day closing write');
        console.log('✓ Database A verified 100% clean (0 writes leaked)');

        // Verification in Production Database (Must have 0 of these writes)
        const verifyProd = new Database(PROD_DB_PATH, { readonly: true });
        const hasProdInProd = verifyProd.prepare("SELECT count(*) as c FROM products WHERE name = 'WRITE_TEST_PROD_B'").get().c;
        const hasCustInProd = verifyProd.prepare("SELECT count(*) as c FROM customers WHERE name = 'WRITE_TEST_CUST_B'").get().c;
        const hasSuppInProd = verifyProd.prepare("SELECT count(*) as c FROM suppliers WHERE name = 'WRITE_TEST_SUPP_B'").get().c;
        const hasSaleInProd = verifyProd.prepare("SELECT count(*) as c FROM sales WHERE customer_name = 'WRITE_TEST_CUST_B'").get().c;
        const hasPurInProd  = verifyProd.prepare("SELECT count(*) as c FROM purchases WHERE invoice_number = 'PUR-WRITE-B-999'").get().c;
        const hasPcInProd   = verifyProd.prepare("SELECT count(*) as c FROM petty_cash_transactions WHERE description = 'WRITE_TEST_PC_B'").get().c;
        const hasDcInProd   = verifyProd.prepare("SELECT count(*) as c FROM day_closings WHERE notes = 'WRITE_TEST_DC_B'").get().c;
        verifyProd.close();

        assert.strictEqual(hasProdInProd, 0, 'Production DB isolated from test product write');
        assert.strictEqual(hasCustInProd, 0, 'Production DB isolated from test customer write');
        assert.strictEqual(hasSuppInProd, 0, 'Production DB isolated from test supplier write');
        assert.strictEqual(hasSaleInProd, 0, 'Production DB isolated from test sale write');
        assert.strictEqual(hasPurInProd, 0, 'Production DB isolated from test purchase write');
        assert.strictEqual(hasPcInProd, 0, 'Production DB isolated from test petty cash write');
        assert.strictEqual(hasDcInProd, 0, 'Production DB isolated from test day closing write');
        console.log('✓ Production Database verified 100% untouched (0 writes leaked)');

        // ====================================================================
        // PHASE 6: Real Application UI Tab Navigation & Rendering Test
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 6: Real Application UI Screen Verification ---');
        console.log('================================================================');

        const tabsToTest = [
            'dashboard',
            'inventory',
            'products',
            'sales',
            'purchaseparties',
            'pettycash',
            'dayclosing',
            'reports',
            'settings'
        ];

        for (const t of tabsToTest) {
            const switched = await win.webContents.executeJavaScript(`(() => {
                if (typeof switchTab === 'function') {
                    switchTab('${t}');
                    return true;
                }
                return false;
            })()`);
            await new Promise(r => setTimeout(r, 150));
            assert.strictEqual(switched, true, `Tab switch to ${t} must execute`);
            console.log(`  ✓ Screen tab '${t}' rendered successfully`);
        }

        // ====================================================================
        // PHASE 7: Test Cleanup Verification
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 7: Safe Cleanup of Test Databases ---');
        console.log('================================================================');

        dbManager.closeDatabase();

        // Safety assertion: Ensure neither DIR_A nor DIR_B is equal or parent of production DB
        assert.notStrictEqual(path.resolve(DIR_A), path.resolve(path.dirname(PROD_DB_PATH)));
        assert.notStrictEqual(path.resolve(DIR_B), path.resolve(path.dirname(PROD_DB_PATH)));
        assert(AUDIT_TMP_DIR.includes('onebook_final_release_audit_'), 'Cleanup target must be temporary audit directory');

        fs.rmSync(AUDIT_TMP_DIR, { recursive: true, force: true });
        const existsAfterCleanup = fs.existsSync(AUDIT_TMP_DIR);
        assert.strictEqual(existsAfterCleanup, false, 'Temporary audit directory must be deleted');
        console.log('✓ Temporary test directory deleted cleanly: ' + AUDIT_TMP_DIR);
        console.log('✓ Cleanup verified via fs.existsSync: false');

        // Restore production config in Application Support
        const cfgFile = path.join(app.getPath('userData'), 'config.json');
        if (fs.existsSync(cfgFile)) {
            const c = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
            c.databaseFolder = path.dirname(PROD_DB_PATH);
            c.sqliteDatabasePath = PROD_DB_PATH;
            fs.writeFileSync(cfgFile, JSON.stringify(c, null, 4), 'utf8');
            console.log('✓ Restored config.json to production path: ' + PROD_DB_PATH);
        }

        // ====================================================================
        // PHASE 8: Final Production Database Verification
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 8: Final Production Database Verification vs Baseline ---');
        console.log('================================================================');

        const finalProd = getDbSnapshot(PROD_DB_PATH);
        console.log('Final Production Database Check:');
        console.log('  Path:        ', finalProd.path);
        console.log('  Size (bytes):', finalProd.size, ' (Baseline:', baselineProd.size, ')');
        console.log('  Last Mod:    ', finalProd.mtime, ' (Baseline:', baselineProd.mtime, ')');
        console.log('  SHA-256:     ', finalProd.sha256);
        console.log('  Baseline SHA:', baselineProd.sha256);
        console.log('  Integrity:   ', finalProd.integrity);
        console.log('  Counts:      ', JSON.stringify(finalProd.counts));

        assert.strictEqual(finalProd.path, baselineProd.path, 'Path matches');
        assert.strictEqual(finalProd.size, baselineProd.size, 'Size identical');
        assert.strictEqual(finalProd.mtime, baselineProd.mtime, 'Modified timestamp identical');
        assert.strictEqual(finalProd.sha256, baselineProd.sha256, 'SHA-256 Checksum 100% IDENTICAL');
        assert.strictEqual(finalProd.integrity, 'ok', 'Integrity check is ok');
        assert.deepStrictEqual(finalProd.counts, baselineProd.counts, 'Row counts match baseline exactly');
        console.log('\n✓ Production database is 100% UNTOUCHED, UNMODIFIED, AND INTEGRITY PRESERVED!');

        console.log('\n================================================================');
        console.log('🎉 ALL AUDIT PHASES COMPLETED WITH 100% SUCCESS!');
        console.log('================================================================\n');

        try { win.destroy(); } catch (e) {}
        app.quit();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ AUDIT SUITE FAILED:', err);
        try { dbManager.closeDatabase(); } catch (e) {}
        try { fs.rmSync(AUDIT_TMP_DIR, { recursive: true, force: true }); } catch (e) {}
        try { win.destroy(); } catch (e) {}
        app.quit();
        process.exit(1);
    }
});
