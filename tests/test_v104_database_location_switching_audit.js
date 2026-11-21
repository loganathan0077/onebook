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
const fs = require('fs');
const assert = require('assert');
const Database = require('better-sqlite3');

app.disableHardwareAcceleration();

// Production database path
const PROD_DB_PATH = '/Users/log/Desktop/untitled folder/doodles-store-desktop/OneBook/onebook.db';

// Base directory for audit test folders
const AUDIT_BASE_DIR = path.join(__dirname, '..');
const DIR_A = path.join(AUDIT_BASE_DIR, 'OneBook_DB_SWITCH_TEST_A');
const DB_A_PATH = path.join(DIR_A, 'onebook_test_A.db');

const DIR_B = path.join(AUDIT_BASE_DIR, 'OneBook_DB_SWITCH_TEST_B');
const DB_B_PATH = path.join(DIR_B, 'onebook_test_B.db');

process.env.ONEBOOK_TEST_RUNNER = '1';
process.env.ONEBOOK_SQLITE_PATH = DB_A_PATH;
const mainApp = require('../main');

console.log('================================================================');
console.log('🧪 OneBook — Database Location Switching & Data Isolation Audit');
console.log('================================================================');

// Baseline production database recording
function getDbSnapshot(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    const db = new Database(filePath, { readonly: true });
    const integrity = db.pragma('integrity_check');
    const tables = ['products', 'product_variants', 'sales', 'sale_items', 'purchases', 'purchase_items', 'customers', 'suppliers', 'petty_cash_transactions', 'day_closings', 'users'];
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
        integrity: integrity && integrity[0] ? integrity[0].integrity_check : 'error',
        counts
    };
}

const prodBaselineBefore = getDbSnapshot(PROD_DB_PATH);
console.log('\n[PHASE 10 BASELINE] Production Database Before Testing:');
console.log('  Path:', prodBaselineBefore.path);
console.log('  Size (bytes):', prodBaselineBefore.size);
console.log('  Modified:', prodBaselineBefore.mtime);
console.log('  Integrity:', prodBaselineBefore.integrity);
console.log('  Row Counts:', JSON.stringify(prodBaselineBefore.counts));

// PHASE 2 & 3: Setup Isolated Test Databases A and B with Unique Identifiers
function setupTestDatabases() {
    console.log('\n[PHASE 2] Setting up Isolated Test Databases A and B...');
    
    // Ensure clean directories
    if (fs.existsSync(DIR_A)) fs.rmSync(DIR_A, { recursive: true, force: true });
    if (fs.existsSync(DIR_B)) fs.rmSync(DIR_B, { recursive: true, force: true });
    fs.mkdirSync(DIR_A, { recursive: true });
    fs.mkdirSync(DIR_B, { recursive: true });

    // Database A: Copy from production template (read-only copy)
    fs.copyFileSync(PROD_DB_PATH, DB_A_PATH);

    // Database B: Initialize fresh empty schema using database.js
    const dbManager = require('../database');
    dbManager.initializeDatabase(DB_B_PATH, { allowCreate: true });
    dbManager.closeDatabase();

    assert(fs.existsSync(DB_A_PATH), 'Database A file must exist');
    assert(fs.existsSync(DB_B_PATH), 'Database B file must exist');
    assert(path.resolve(DB_A_PATH) !== path.resolve(PROD_DB_PATH), 'DB A must be separate from production');
    assert(path.resolve(DB_B_PATH) !== path.resolve(PROD_DB_PATH), 'DB B must be separate from production');
    assert(path.resolve(DB_A_PATH) !== path.resolve(DB_B_PATH), 'DB A and B must be separate files');

    console.log('  ✓ Database A created:', DB_A_PATH);
    console.log('  ✓ Database B created:', DB_B_PATH);

    console.log('\n[PHASE 3] Inserting Unique Test Markers into Database A and B...');
    
    // Seed Database A markers
    const dbA = new Database(DB_A_PATH);
    // Product A
    const resAProd = dbA.prepare(`
        INSERT INTO products (name, barcode, category, unit, price, cost_price, stock, min_stock, description)
        VALUES ('TEST_DB_A_PRODUCT', 'BARCODE_A_111', 'Category A', 'Piece', 100, 60, 50, 10, 'Database A unique product')
    `).run();
    dbA.prepare(`
        INSERT INTO product_variants (product_id, variant_name, barcode, buying_price, selling_price, stock)
        VALUES (?, '', 'BARCODE_A_111', 60, 100, 50)
    `).run(resAProd.lastInsertRowid);

    // Customer A (Receivable)
    dbA.prepare(`
        INSERT INTO customers (id, name, phone, opening_balance, balance, address)
        VALUES ('cust_a_1', 'TEST_DB_A_RECEIVABLE', '9990001111', 1500, 1500, 'Customer A Address')
    `).run();

    // Supplier A (Payable)
    dbA.prepare(`
        INSERT INTO suppliers (id, name, phone, balance, address)
        VALUES ('supp_a_1', 'TEST_DB_A_PAYABLE', '9990002222', 2500, 'Supplier A Address')
    `).run();

    // Sale A
    dbA.prepare(`
        INSERT INTO sales (receipt_number, customer_id, date, subtotal, discount, total, payment_method, status)
        VALUES ('INV-A-101', 'cust_a_1', datetime('now'), 500, 0, 500, 'cash', 'ACTIVE')
    `).run();

    // Purchase A
    dbA.prepare(`
        INSERT INTO purchases (invoice_number, supplier_id, date, subtotal, total, payment_method, status)
        VALUES ('PUR-A-201', 'supp_a_1', datetime('now'), 800, 800, 'cash', 'ACTIVE')
    `).run();

    // Petty Cash A
    dbA.prepare(`
        INSERT INTO petty_cash_transactions (type, amount, category, description, date, status)
        VALUES ('expense', 300, 'Office Supplies', 'TEST_DB_A_CASH', date('now'), 'ACTIVE')
    `).run();

    // Day Closing A
    dbA.prepare(`
        INSERT INTO day_closings (date, opening_balance, cash_sales, cash_out, expected_balance, actual_balance, difference, notes)
        VALUES (date('now'), 1000, 500, 300, 1200, 1200, 0, 'TEST_DB_A_CLOSE')
    `).run();

    // Admin & Session Token A
    dbA.prepare(`
        INSERT OR REPLACE INTO users (id, name, username, password_hash, role, status, permissions_json)
        VALUES ('admin_1', 'Admin', 'admin', 'hash', 'admin', 'active', '["all"]')
    `).run();
    dbA.prepare(`
        INSERT OR REPLACE INTO user_sessions (token, user_id, expires_at, revoked)
        VALUES ('audit_session_token_12345', 'admin_1', datetime('now', '+1 year'), 0)
    `).run();

    dbA.close();
    console.log('  ✓ Database A markers seeded.');

    // Seed Database B markers
    const dbB = new Database(DB_B_PATH);
    // Product B
    const resBProd = dbB.prepare(`
        INSERT INTO products (name, barcode, category, unit, price, cost_price, stock, min_stock, description)
        VALUES ('TEST_DB_B_PRODUCT', 'BARCODE_B_222', 'Category B', 'Piece', 250, 150, 80, 15, 'Database B unique product')
    `).run();
    dbB.prepare(`
        INSERT INTO product_variants (product_id, variant_name, barcode, buying_price, selling_price, stock)
        VALUES (?, '', 'BARCODE_B_222', 150, 250, 80)
    `).run(resBProd.lastInsertRowid);

    // Customer B (Receivable)
    dbB.prepare(`
        INSERT INTO customers (id, name, phone, opening_balance, balance, address)
        VALUES ('cust_b_1', 'TEST_DB_B_RECEIVABLE', '8880001111', 3500, 3500, 'Customer B Address')
    `).run();

    // Supplier B (Payable)
    dbB.prepare(`
        INSERT INTO suppliers (id, name, phone, balance, address)
        VALUES ('supp_b_1', 'TEST_DB_B_PAYABLE', '8880002222', 4500, 'Supplier B Address')
    `).run();

    // Sale B
    dbB.prepare(`
        INSERT INTO sales (receipt_number, customer_id, date, subtotal, discount, total, payment_method, status)
        VALUES ('INV-B-301', 'cust_b_1', datetime('now'), 1200, 0, 1200, 'bank', 'ACTIVE')
    `).run();

    // Purchase B
    dbB.prepare(`
        INSERT INTO purchases (invoice_number, supplier_id, date, subtotal, total, payment_method, status)
        VALUES ('PUR-B-401', 'supp_b_1', datetime('now'), 1800, 1800, 'bank', 'ACTIVE')
    `).run();

    // Petty Cash B
    dbB.prepare(`
        INSERT INTO petty_cash_transactions (type, amount, category, description, date, status)
        VALUES ('expense', 700, 'Rent', 'TEST_DB_B_CASH', date('now'), 'ACTIVE')
    `).run();

    // Day Closing B
    dbB.prepare(`
        INSERT INTO day_closings (date, opening_balance, cash_sales, cash_out, expected_balance, actual_balance, difference, notes)
        VALUES (date('now'), 2000, 1200, 700, 2500, 2500, 0, 'TEST_DB_B_CLOSE')
    `).run();

    // Admin & Session Token B
    dbB.prepare(`
        INSERT OR REPLACE INTO users (id, name, username, password_hash, role, status, permissions_json)
        VALUES ('admin_1', 'Admin', 'admin', 'hash', 'admin', 'active', '["all"]')
    `).run();
    dbB.prepare(`
        INSERT OR REPLACE INTO user_sessions (token, user_id, expires_at, revoked)
        VALUES ('audit_session_token_12345', 'admin_1', datetime('now', '+1 year'), 0)
    `).run();

    dbB.close();
    console.log('  ✓ Database B markers seeded.');
}

// Start audit execution
app.whenReady().then(async () => {
    setupTestDatabases();

    // Configure initial database to Database A via environment variable
    process.env.ONEBOOK_SQLITE_PATH = DB_A_PATH;

    // Load main application backend
    mainApp.initSqliteAtStartup();
    const dbManager = require('../database');

    // Launch OneBook in Electron browser window
    const win = new BrowserWindow({
        width: 1200,
        height: 850,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    // Helper to verify module data in renderer DOM & memory
    async function verifyModuleData(expectedDb, stepName) {
        return await win.webContents.executeJavaScript(`(async () => {
            // Helper to get text from DOM elements
            const getTexts = (selector) => Array.from(document.querySelectorAll(selector)).map(e => e.textContent || '').join(' ');
            
            // Debug inspect products
            let prodFetchDebug = null;
            try {
                prodFetchDebug = await window.electronAPI.sqlite.products.getAll();
            } catch(e) {
                prodFetchDebug = { error: e.message };
            }

            // 1. Inventory & Products
            const invText = getTexts('#inventoryTableBody, #productsTableBody, #currentInventoryStatus');
            const hasAProd = invText.includes('TEST_DB_A_PRODUCT') || (typeof products !== 'undefined' && products.some(p => p.name === 'TEST_DB_A_PRODUCT'));
            const hasBProd = invText.includes('TEST_DB_B_PRODUCT') || (typeof products !== 'undefined' && products.some(p => p.name === 'TEST_DB_B_PRODUCT'));

            // 2. Sales
            const salesText = getTexts('#recentSalesBody, #todaySalesTableBody, #reportsSalesTable');
            const hasASale = salesText.includes('INV-A-101') || (typeof sales !== 'undefined' && sales.some(s => s.invoice_no === 'INV-A-101' || s.invoiceNo === 'INV-A-101' || s.receipt_number === 'INV-A-101' || s.receiptNumber === 'INV-A-101'));
            const hasBSale = salesText.includes('INV-B-301') || (typeof sales !== 'undefined' && sales.some(s => s.invoice_no === 'INV-B-301' || s.invoiceNo === 'INV-B-301' || s.receipt_number === 'INV-B-301' || s.receiptNumber === 'INV-B-301'));

            // 3. Purchases
            const hasAPur = (typeof purchases !== 'undefined' && purchases.some(p => p.invoice_number === 'PUR-A-201' || p.invoiceNumber === 'PUR-A-201' || p.notes === 'TEST_DB_A_PURCHASE'));
            const hasBPur = (typeof purchases !== 'undefined' && purchases.some(p => p.invoice_number === 'PUR-B-401' || p.invoiceNumber === 'PUR-B-401' || p.notes === 'TEST_DB_B_PURCHASE'));

            // 4. Receivables (Customers)
            const custText = getTexts('#receivablesTableBody, #customerSelect');
            const hasACust = custText.includes('TEST_DB_A_RECEIVABLE') || (typeof customers !== 'undefined' && customers.some(c => c.name === 'TEST_DB_A_RECEIVABLE'));
            const hasBCust = custText.includes('TEST_DB_B_RECEIVABLE') || (typeof customers !== 'undefined' && customers.some(c => c.name === 'TEST_DB_B_RECEIVABLE'));

            // 5. Payables (Suppliers)
            const suppText = getTexts('#payablesTableBody, #supplierSelect');
            const hasASupp = suppText.includes('TEST_DB_A_PAYABLE') || (typeof suppliers !== 'undefined' && suppliers.some(s => s.name === 'TEST_DB_A_PAYABLE'));
            const hasBSupp = suppText.includes('TEST_DB_B_PAYABLE') || (typeof suppliers !== 'undefined' && suppliers.some(s => s.name === 'TEST_DB_B_PAYABLE'));

            // 6. Petty Cash
            const pcText = getTexts('#pcLedgerTable, #pettycash');
            const hasAPc = pcText.includes('TEST_DB_A_CASH') || (typeof pcTransactions !== 'undefined' && pcTransactions.some(t => t.description === 'TEST_DB_A_CASH'));
            const hasBPc = pcText.includes('TEST_DB_B_CASH') || (typeof pcTransactions !== 'undefined' && pcTransactions.some(t => t.description === 'TEST_DB_B_CASH'));

            // 7. Day Closing
            const dcText = getTexts('#dayClosingHistoryBody, #denomination');
            const hasADc = dcText.includes('TEST_DB_A_CLOSE') || (typeof dayClosings !== 'undefined' && dayClosings.some(d => d.notes === 'TEST_DB_A_CLOSE'));
            const hasBDc = dcText.includes('TEST_DB_B_CLOSE') || (typeof dayClosings !== 'undefined' && dayClosings.some(d => d.notes === 'TEST_DB_B_CLOSE'));

            // 8. Active DB Details from UI
            const activePathInUI = document.getElementById('dbDetailPath') ? document.getElementById('dbDetailPath').textContent : '';

            // 9. Dashboard totals
            const totalProdsEl = document.getElementById('totalProducts');
            const dashboardProds = totalProdsEl ? totalProdsEl.textContent : '';

            return {
                inventory: { hasA: hasAProd, hasB: hasBProd },
                sales: { hasA: hasASale, hasB: hasBSale },
                purchases: { hasA: hasAPur, hasB: hasBPur },
                receivable: { hasA: hasACust, hasB: hasBCust },
                payable: { hasA: hasASupp, hasB: hasBSupp },
                pettyCash: { hasA: hasAPc, hasB: hasBPc },
                dayClosing: { hasA: hasADc, hasB: hasBDc },
                prodFetchDebug,
                activePathInUI,
                invText,
                invTbodyHtml: document.getElementById('inventoryTableBody') ? document.getElementById('inventoryTableBody').innerHTML : 'NO_TBODY',
                salesText,
                dashboardProds
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

    const resultsAudit = {};

    try {
        ipcMain.removeAllListeners('get-license-info-sync');
        ipcMain.on('get-license-info-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
        ipcMain.removeAllListeners('get-license-sync');
        ipcMain.on('get-license-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });

        await win.loadFile(path.join(__dirname, '../login.html'));
        await new Promise(r => setTimeout(r, 400));

        // Inject session token and navigate to OneBook.html with active session
        await win.webContents.executeJavaScript(`
            sessionStorage.setItem('onebook_session_token', 'audit_session_token_12345');
            localStorage.setItem('onebook_session_token', 'audit_session_token_12345');
            sessionStorage.setItem('sessionToken', 'audit_session_token_12345');
            localStorage.setItem('sessionToken', 'audit_session_token_12345');
            sessionStorage.setItem('currentUser', JSON.stringify({ id: 'admin_1', username: 'admin', role: 'admin', permissions: ['all'] }));
            window.location.href = 'OneBook.html';
        `);

        // Wait for OneBook.html to finish loading
        await new Promise(r => win.webContents.once('did-finish-load', r));
        await new Promise(r => setTimeout(r, 600));

        // Inject testing overrides in OneBook.html
        await win.webContents.executeJavaScript(`
            window.isDemoMode = () => false;
            try { isDemoMode = () => false; } catch(e){}
            window.alert = (msg) => console.log('[UI Alert]:', msg);
            window.confirm = () => true;
            window.isUserAdmin = true;
            window.hasPermission = () => true;
            if (window.electronAPI && window.electronAPI.sqlite && window.electronAPI.sqlite.setSessionToken) {
                window.electronAPI.sqlite.setSessionToken('audit_session_token_12345');
            }
        `);

        // ====================================================================
        // PHASE 4 — DATABASE A TEST
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 4: Initial Verification on Database A ---');
        console.log('================================================================');
        
        // Confirm backend connection
        const activePathA = dbManager.getDatabasePath();
        console.log('Active SQLite DB Path:', activePathA);
        assert.strictEqual(path.resolve(activePathA), path.resolve(DB_A_PATH), 'Backend must be connected to Database A');

        // Re-hydrate UI with Database A
        await rehydrateAllModules();

        const snapA = await verifyModuleData('A', 'Phase 4 (Database A)');
        console.log('Product Fetch Debug:', JSON.stringify(snapA.prodFetchDebug));
        console.log('invTbodyHtml:', snapA.invTbodyHtml);
        console.log('DOM Inventory Text snippet:', snapA.invText.slice(0, 150));
        console.log('Inventory check:      A present:', snapA.inventory.hasA, ' | B present:', snapA.inventory.hasB);
        console.log('Sales check:          A present:', snapA.sales.hasA, '     | B present:', snapA.sales.hasB);
        console.log('Purchases check:      A present:', snapA.purchases.hasA, ' | B present:', snapA.purchases.hasB);
        console.log('Receivables check:    A present:', snapA.receivable.hasA,' | B present:', snapA.receivable.hasB);
        console.log('Payables check:       A present:', snapA.payable.hasA, '   | B present:', snapA.payable.hasB);
        console.log('Petty Cash check:     A present:', snapA.pettyCash.hasA, ' | B present:', snapA.pettyCash.hasB);
        console.log('Day Closing check:    A present:', snapA.dayClosing.hasA, '| B present:', snapA.dayClosing.hasB);
        console.log('Active DB path in UI: ', snapA.activePathInUI);

        assert(snapA.inventory.hasA && !snapA.inventory.hasB, 'Inventory must show Database A product and NOT B');
        assert(snapA.sales.hasA && !snapA.sales.hasB, 'Sales must show Database A sale and NOT B');
        assert(snapA.purchases.hasA && !snapA.purchases.hasB, 'Purchases must show Database A purchase and NOT B');
        assert(snapA.receivable.hasA && !snapA.receivable.hasB, 'Receivables must show Database A customer and NOT B');
        assert(snapA.payable.hasA && !snapA.payable.hasB, 'Payables must show Database A supplier and NOT B');
        assert(snapA.pettyCash.hasA && !snapA.pettyCash.hasB, 'Petty Cash must show Database A entry and NOT B');
        assert(snapA.dayClosing.hasA && !snapA.dayClosing.hasB, 'Day Closing must show Database A closing and NOT B');
        console.log('✓ PHASE 4 PASSED: Database A loaded across all modules with zero Database B contamination.');

        // ====================================================================
        // PHASE 5 — SWITCH TO DATABASE B
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 5: Switching to Database B via Change Database Location ---');
        console.log('================================================================');

        const switchBRes = await win.webContents.executeJavaScript(`(async () => {
            return await window.electronAPI.sqlite.system.changeDatabaseLocation({
                folderPath: '${DB_B_PATH}',
                forceOverwrite: false,
                skipBackup: false
            });
        })()`);

        console.log('Switch to DB B Result:', switchBRes);
        assert.strictEqual(switchBRes.success, true, 'Switch to Database B must succeed');
        assert.strictEqual(path.resolve(switchBRes.newPath), path.resolve(DB_B_PATH), 'New path must be Database B');

        // Confirm active connection in dbManager
        const activePathB = dbManager.getDatabasePath();
        console.log('Active SQLite DB Path after switch:', activePathB);
        assert.strictEqual(path.resolve(activePathB), path.resolve(DB_B_PATH), 'Backend active connection must be Database B');

        // Re-hydrate UI with Database B
        await rehydrateAllModules();

        const snapB = await verifyModuleData('B', 'Phase 5 (Database B)');
        console.log('Inventory check:      A present:', snapB.inventory.hasA, ' | B present:', snapB.inventory.hasB);
        console.log('Sales check:          A present:', snapB.sales.hasA, '     | B present:', snapB.sales.hasB);
        console.log('Purchases check:      A present:', snapB.purchases.hasA, ' | B present:', snapB.purchases.hasB);
        console.log('Receivables check:    A present:', snapB.receivable.hasA,' | B present:', snapB.receivable.hasB);
        console.log('Payables check:       A present:', snapB.payable.hasA, '   | B present:', snapB.payable.hasB);
        console.log('Petty Cash check:     A present:', snapB.pettyCash.hasA, ' | B present:', snapB.pettyCash.hasB);
        console.log('Day Closing check:    A present:', snapB.dayClosing.hasA, '| B present:', snapB.dayClosing.hasB);
        console.log('Active DB path in UI: ', snapB.activePathInUI);

        assert(!snapB.inventory.hasA && snapB.inventory.hasB, 'Inventory must show Database B product and NOT A');
        assert(!snapB.sales.hasA && snapB.sales.hasB, 'Sales must show Database B sale and NOT A');
        assert(!snapB.purchases.hasA && snapB.purchases.hasB, 'Purchases must show Database B purchase and NOT A');
        assert(!snapB.receivable.hasA && snapB.receivable.hasB, 'Receivables must show Database B customer and NOT A');
        assert(!snapB.payable.hasA && snapB.payable.hasB, 'Payables must show Database B supplier and NOT A');
        assert(!snapB.pettyCash.hasA && snapB.pettyCash.hasB, 'Petty Cash must show Database B entry and NOT A');
        assert(!snapB.dayClosing.hasA && snapB.dayClosing.hasB, 'Day Closing must show Database B closing and NOT A');
        console.log('✓ PHASE 5 PASSED: Database B switched successfully across all modules with zero Database A contamination.');

        // ====================================================================
        // PHASE 6 — SWITCH BACK TO DATABASE A
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 6: Switching Back to Database A (Reversibility Test) ---');
        console.log('================================================================');

        const switchBackARes = await win.webContents.executeJavaScript(`(async () => {
            return await window.electronAPI.sqlite.system.changeDatabaseLocation({
                folderPath: '${DB_A_PATH}',
                forceOverwrite: false,
                skipBackup: false
            });
        })()`);

        assert.strictEqual(switchBackARes.success, true, 'Switch back to Database A must succeed');
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_A_PATH), 'Backend connection must return to DB A');

        // Re-hydrate UI with Database A
        await rehydrateAllModules();

        const snapBackA = await verifyModuleData('A', 'Phase 6 (Switch Back A)');
        assert(snapBackA.inventory.hasA && !snapBackA.inventory.hasB, 'Inventory must restore Database A product and remove B');
        assert(snapBackA.sales.hasA && !snapBackA.sales.hasB, 'Sales must restore Database A sale and remove B');
        assert(snapBackA.purchases.hasA && !snapBackA.purchases.hasB, 'Purchases must restore Database A purchase and remove B');
        assert(snapBackA.receivable.hasA && !snapBackA.receivable.hasB, 'Receivables must restore Database A customer and remove B');
        assert(snapBackA.payable.hasA && !snapBackA.payable.hasB, 'Payables must restore Database A supplier and remove B');
        assert(snapBackA.pettyCash.hasA && !snapBackA.pettyCash.hasB, 'Petty Cash must restore Database A entry and remove B');
        assert(snapBackA.dayClosing.hasA && !snapBackA.dayClosing.hasB, 'Day Closing must restore Database A closing and remove B');
        console.log('✓ PHASE 6 PASSED: Database switching is 100% reversible; all Database A records restored and B removed.');

        // ====================================================================
        // PHASE 7 — RESTART PERSISTENCE TEST
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 7: Restart Persistence Test ---');
        console.log('================================================================');

        // Test 7.1: Select Database B, restart app, verify B is loaded
        await win.webContents.executeJavaScript(`window.electronAPI.sqlite.system.changeDatabaseLocation({ folderPath: '${DB_B_PATH}', skipBackup: true })`);
        delete process.env.ONEBOOK_SQLITE_PATH; // Remove environment override so app relies on config.json

        // Read config.json to confirm B was saved
        const configPath = path.join(app.getPath('userData'), 'config.json');
        const configDataB = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        assert.strictEqual(path.resolve(configDataB.sqliteDatabasePath), path.resolve(DB_B_PATH), 'config.json must store Database B path');

        // Simulate app shutdown and restart: close DB, re-run resolveSqlitePath and initSqliteAtStartup
        dbManager.closeDatabase();
        
        // Re-read and initialize from config
        const resolvedRestartB = JSON.parse(fs.readFileSync(configPath, 'utf8')).sqliteDatabasePath;
        dbManager.initializeDatabase(resolvedRestartB, { allowCreate: false });
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_B_PATH), 'Restart must connect to Database B');

        // Re-hydrate UI after simulated restart
        await rehydrateAllModules();
        const restartSnapB = await verifyModuleData('B', 'Restart B');
        assert(!restartSnapB.inventory.hasA && restartSnapB.inventory.hasB, 'Restart must show Database B data');
        console.log('✓ 7.1 Database B restart persistence verified');

        // Test 7.2: Select Database A, restart app, verify A is loaded
        await win.webContents.executeJavaScript(`window.electronAPI.sqlite.system.changeDatabaseLocation({ folderPath: '${DB_A_PATH}', skipBackup: true })`);
        const configDataA = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        assert.strictEqual(path.resolve(configDataA.sqliteDatabasePath), path.resolve(DB_A_PATH), 'config.json must store Database A path');

        dbManager.closeDatabase();
        const resolvedRestartA = JSON.parse(fs.readFileSync(configPath, 'utf8')).sqliteDatabasePath;
        dbManager.initializeDatabase(resolvedRestartA, { allowCreate: false });
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_A_PATH), 'Restart must connect to Database A');

        await rehydrateAllModules();
        const restartSnapA = await verifyModuleData('A', 'Restart A');
        assert(restartSnapA.inventory.hasA && !restartSnapA.inventory.hasB, 'Restart must show Database A data');
        console.log('✓ 7.2 Database A restart persistence verified');
        console.log('✓ PHASE 7 PASSED: Restart persistence verified for both databases.');

        // ====================================================================
        // PHASE 8 — WRITE ISOLATION TEST
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 8: Write Isolation Test ---');
        console.log('================================================================');

        // Switch to Database B
        await win.webContents.executeJavaScript(`window.electronAPI.sqlite.system.changeDatabaseLocation({ folderPath: '${DB_B_PATH}', skipBackup: true })`);
        assert.strictEqual(path.resolve(dbManager.getDatabasePath()), path.resolve(DB_B_PATH), 'Active DB must be B');

        // Record DB A and Prod snapshots before write
        const snapABeforeWrite = getDbSnapshot(DB_A_PATH);
        const snapProdBeforeWrite = getDbSnapshot(PROD_DB_PATH);

        // Perform write into Database B: Create product and petty cash entry
        const writeRes = await win.webContents.executeJavaScript(`(async () => {
            const pRes = await window.electronAPI.sqlite.products.create({
                name: 'TEST_DB_B_NEW_ISOLATED_PRODUCT',
                price: 999,
                stock: 77,
                category: 'Category B',
                unit: 'Piece'
            });
            const pcRes = await window.electronAPI.sqlite.pettyCash.createTransaction({
                type: 'expense',
                amount: 888,
                account: 'cash',
                category: 'Rent',
                description: 'TEST_DB_B_NEW_ISOLATED_CASH',
                date: new Date().toISOString().split('T')[0],
                paymentMethod: 'cash'
            });
            return { pRes, pcRes };
        })()`);

        assert(writeRes.pRes && (writeRes.pRes.success || writeRes.pRes.id), 'Write product into DB B must succeed');
        assert(writeRes.pcRes && (writeRes.pcRes.success || writeRes.pcRes.id), 'Write petty cash into DB B must succeed');

        // Verify write exists in Database B
        const verifyDbB = new Database(DB_B_PATH, { readonly: true });
        const wroteProdInB = verifyDbB.prepare("SELECT count(*) as c FROM products WHERE name = 'TEST_DB_B_NEW_ISOLATED_PRODUCT'").get().c;
        const wroteCashInB = verifyDbB.prepare("SELECT count(*) as c FROM petty_cash_transactions WHERE description = 'TEST_DB_B_NEW_ISOLATED_CASH'").get().c;
        verifyDbB.close();
        assert.strictEqual(wroteProdInB, 1, 'Database B must contain newly created product');
        assert.strictEqual(wroteCashInB, 1, 'Database B must contain newly created petty cash');

        // Verify Database A does NOT contain the new writes
        const verifyDbA = new Database(DB_A_PATH, { readonly: true });
        const wroteProdInA = verifyDbA.prepare("SELECT count(*) as c FROM products WHERE name = 'TEST_DB_B_NEW_ISOLATED_PRODUCT'").get().c;
        const wroteCashInA = verifyDbA.prepare("SELECT count(*) as c FROM petty_cash_transactions WHERE description = 'TEST_DB_B_NEW_ISOLATED_CASH'").get().c;
        verifyDbA.close();
        assert.strictEqual(wroteProdInA, 0, 'Database A must NOT contain newly written Database B product');
        assert.strictEqual(wroteCashInA, 0, 'Database A must NOT contain newly written Database B cash entry');

        // Verify Production database does NOT contain the new writes and has not changed
        const verifyProd = new Database(PROD_DB_PATH, { readonly: true });
        const wroteProdInProd = verifyProd.prepare("SELECT count(*) as c FROM products WHERE name = 'TEST_DB_B_NEW_ISOLATED_PRODUCT'").get().c;
        const wroteCashInProd = verifyProd.prepare("SELECT count(*) as c FROM petty_cash_transactions WHERE description = 'TEST_DB_B_NEW_ISOLATED_CASH'").get().c;
        verifyProd.close();
        assert.strictEqual(wroteProdInProd, 0, 'Production database must NOT contain test product');
        assert.strictEqual(wroteCashInProd, 0, 'Production database must NOT contain test cash entry');

        console.log('✓ Writes executed in Database B exist only in Database B');
        console.log('✓ Database A and Production database remain 100% clean and isolated');
        console.log('✓ PHASE 8 PASSED: Write isolation verified.');

        // ====================================================================
        // PHASE 10 — PRODUCTION SAFETY VERIFICATION
        // ====================================================================
        console.log('\n================================================================');
        console.log('--- PHASE 10: Production Safety Verification (Final Check) ---');
        console.log('================================================================');

        const prodBaselineAfter = getDbSnapshot(PROD_DB_PATH);
        console.log('Production Database After Testing:');
        console.log('  Path:', prodBaselineAfter.path);
        console.log('  Size (bytes):', prodBaselineAfter.size, '(Before:', prodBaselineBefore.size, ')');
        console.log('  Modified:', prodBaselineAfter.mtime, '(Before:', prodBaselineBefore.mtime, ')');
        console.log('  Integrity:', prodBaselineAfter.integrity);
        console.log('  Row Counts:', JSON.stringify(prodBaselineAfter.counts));

        assert.strictEqual(prodBaselineAfter.size, prodBaselineBefore.size, 'Production DB size must be identical before and after');
        assert.strictEqual(prodBaselineAfter.mtime, prodBaselineBefore.mtime, 'Production DB modification timestamp must be identical');
        assert.strictEqual(prodBaselineAfter.integrity, 'ok', 'Production DB integrity must remain ok');
        assert.deepStrictEqual(prodBaselineAfter.counts, prodBaselineBefore.counts, 'Production DB row counts must match baseline exactly');
        console.log('✓ PHASE 10 PASSED: Production database was NEVER touched, modified, or contaminated.');

        // Clean up test directories
        dbManager.closeDatabase();
        if (fs.existsSync(DIR_A)) fs.rmSync(DIR_A, { recursive: true, force: true });
        if (fs.existsSync(DIR_B)) fs.rmSync(DIR_B, { recursive: true, force: true });

        // Restore original config
        const pConf = path.join(app.getPath('userData'), 'config.json');
        if (fs.existsSync(pConf)) {
            const c = JSON.parse(fs.readFileSync(pConf, 'utf8'));
            c.databaseFolder = path.dirname(PROD_DB_PATH);
            c.sqliteDatabasePath = PROD_DB_PATH;
            fs.writeFileSync(pConf, JSON.stringify(c, null, 4), 'utf8');
        }

        console.log('\n================================================================');
        console.log('🎉 ALL AUDIT PHASES PASSED SUCCESSFULLY! (100% ISOLATION)');
        console.log('================================================================\n');

        win.close();
        app.quit();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ AUDIT FAILED:', err);
        // Emergency cleanup
        try {
            const dbManager = require('../database');
            dbManager.closeDatabase();
        } catch(e){}
        if (fs.existsSync(DIR_A)) fs.rmSync(DIR_A, { recursive: true, force: true });
        if (fs.existsSync(DIR_B)) fs.rmSync(DIR_B, { recursive: true, force: true });
        win.close();
        app.quit();
        process.exit(1);
    }
});
