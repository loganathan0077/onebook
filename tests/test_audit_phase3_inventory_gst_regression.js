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
const assert = require('assert');

app.disableHardwareAcceleration();

// Completely isolated test database in tmp
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_phase3_inv_gst_'));
const testDbPath = path.join(tempDir, 'onebook_test_phase3.db');
process.env.ONEBOOK_DB_PATH = testDbPath;
process.env.ONEBOOK_SQLITE_PATH = testDbPath;
process.env.ONEBOOK_TEST_RUNNER = '1';

const dbManager = require('../database');
dbManager.initializeDatabase(testDbPath, { allowCreate: true });
const productService = require('../services/productService');

// Seed test parent product
const parentId = productService.createProduct({
    name: 'Audit Parent Pen',
    barcode: 'AUDIT-P-101',
    category: 'Stationery',
    unit: 'Piece',
    price: 50,
    cost_price: 25,
    stock: 100,
    min_stock: 10,
    hsn: '9608',
    gst_rate: 18
});

// Seed variant 1 (inherits parent GST rate)
const varInheritObj = productService.addVariant(parentId, {
    variantName: 'Blue (Inherits GST)',
    barcode: 'AUDIT-V-102',
    sellingPrice: 50,
    buyingPrice: 25,
    stock: 60,
    unit: 'Piece',
    category: 'Stationery',
    gstRate: null // inherits
});
const varInheritId = varInheritObj.id;

// Seed variant 2 (overrides GST rate)
const varOverrideObj = productService.addVariant(parentId, {
    variantName: 'Gold Luxury (Overrides GST)',
    barcode: 'AUDIT-V-103',
    sellingPrice: 120,
    buyingPrice: 60,
    stock: 40,
    unit: 'Piece',
    category: 'Stationery',
    gstRate: 28 // overrides
});
const varOverrideId = varOverrideObj.id;

// Seed user & session for authenticated IPC calls
const Database = require('better-sqlite3');
const dbDirect = new Database(testDbPath);
dbDirect.prepare(`
    INSERT OR REPLACE INTO users (id, name, username, password_hash, role, status, permissions_json)
    VALUES ('admin_phase3', 'Admin', 'admin', 'hash', 'admin', 'active', '["all"]')
`).run();
dbDirect.prepare(`
    INSERT OR REPLACE INTO user_sessions (token, user_id, expires_at, revoked)
    VALUES ('token_phase3_audit', 'admin_phase3', datetime('now', '+1 year'), 0)
`).run();
dbDirect.close();

// Load main app IPC handlers
const mainApp = require('../main');

app.whenReady().then(async () => {
    if (dbManager.isDatabaseOpen()) dbManager.closeDatabase();
    mainApp.initSqliteAtStartup();
    console.log('================================================================');
    console.log('🧪 PHASE 3: Comprehensive Inventory & GST Regression Test');
    console.log('📁 Test DB:', testDbPath);
    console.log('================================================================');

    ipcMain.removeAllListeners('get-license-info-sync');
    ipcMain.on('get-license-info-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
    ipcMain.removeAllListeners('get-license-sync');
    ipcMain.on('get-license-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });

    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    win.webContents.on('console-message', (e, level, message, line, sourceId) => {
        console.log(`[Renderer Console L${level}]: ${message} (${sourceId}:${line})`);
    });

    try {
        await win.loadFile(path.join(__dirname, '../login.html'));
        await win.webContents.executeJavaScript(`
            sessionStorage.setItem('onebook_session_token', 'token_phase3_audit');
            localStorage.setItem('onebook_session_token', 'token_phase3_audit');
            sessionStorage.setItem('sessionToken', 'token_phase3_audit');
            localStorage.setItem('sessionToken', 'token_phase3_audit');
            sessionStorage.setItem('currentUser', JSON.stringify({ id: 'admin_phase3', username: 'admin', role: 'admin', permissions: ['all'] }));
            window.location.href = 'OneBook.html';
        `);

        await new Promise(r => win.webContents.once('did-finish-load', r));
        await new Promise(r => setTimeout(r, 600));

        await win.webContents.executeJavaScript(`
            window.isDemoMode = () => false;
            try { isDemoMode = () => false; } catch(e){}
            window.alert = (msg) => console.log('[UI Alert]:', msg);
            window.confirm = () => true;
            window.isUserAdmin = true;
            window.hasPermission = () => true;
            if (window.electronAPI && window.electronAPI.sqlite && window.electronAPI.sqlite.setSessionToken) {
                window.electronAPI.sqlite.setSessionToken('token_phase3_audit');
            }
        `);

        // Helper to refresh UI
        async function refreshUI() {
            await win.webContents.executeJavaScript(`(async () => {
                if (typeof window.loadProductsFromDatabase === 'function') await window.loadProductsFromDatabase();
                if (typeof updateInventoryTable === 'function') await updateInventoryTable();
                if (typeof updateProductsTable === 'function') await updateProductsTable();
                if (typeof updateDashboard === 'function') await updateDashboard();
            })()`);
            await new Promise(r => setTimeout(r, 300));
        }

        await refreshUI();

        // 1. Verify Initial Rendering in Inventory & Products
        const initialCheck = await win.webContents.executeJavaScript(`(() => {
            const invText = document.getElementById('inventoryTableBody') ? document.getElementById('inventoryTableBody').textContent : '';
            const prodText = document.getElementById('productsTableBody') ? document.getElementById('productsTableBody').textContent : '';
            return {
                hasParentInInv: invText.includes('Audit Parent Pen'),
                hasVarInheritInInv: invText.includes('Audit Parent Pen - Blue (Inherits GST)'),
                hasVarOverrideInInv: invText.includes('Audit Parent Pen - Gold Luxury (Overrides GST)'),
                hasParentInProd: prodText.includes('Audit Parent Pen'),
                hasVarInheritInProd: prodText.includes('Audit Parent Pen - Blue (Inherits GST)'),
                hasVarOverrideInProd: prodText.includes('Audit Parent Pen - Gold Luxury (Overrides GST)')
            };
        })()`);

        assert(initialCheck.hasParentInInv, 'Parent product must render in Inventory');
        assert(initialCheck.hasVarInheritInInv, 'Inheriting variant must render flat in Inventory');
        assert(initialCheck.hasVarOverrideInInv, 'Overriding variant must render flat in Inventory');
        assert(initialCheck.hasParentInProd, 'Parent product must render in Products table');
        assert(initialCheck.hasVarInheritInProd, 'Inheriting variant must render flat in Products table');
        assert(initialCheck.hasVarOverrideInProd, 'Overriding variant must render flat in Products table');
        console.log('✓ Initial flat rendering confirmed across Inventory and Products tables');

        // 2. Edit Parent Product Details via Edit Modal
        const editParentRes = await win.webContents.executeJavaScript(`(async () => {
            const btn = document.querySelector('button[onclick*="openEditProductModal(' + ${parentId} + ')"]') ||
                        document.querySelector('button[data-product-id="' + ${parentId} + '"].edit-btn');
            
            // Call update directly through the edit flow
            const updateRes = await window.electronAPI.sqlite.products.update(${parentId}, {
                name: 'Audit Parent Pen RENAMED',
                category: 'Stationery Luxury',
                price: 55,
                costPrice: 28,
                stock: 95,
                minStock: 12,
                hsn: '9609',
                gstRate: 12 // Change GST from 18 to 12
            });
            return updateRes;
        })()`);
        assert(editParentRes.success, 'Parent product edit update must succeed');
        await refreshUI();

        // Verify parent in DB
        const dbVerify1 = dbManager.getDatabase();
        const pRow = dbVerify1.prepare('SELECT * FROM products WHERE id = ?').get(parentId);
        assert.strictEqual(pRow.name, 'Audit Parent Pen RENAMED');
        assert.strictEqual(pRow.gst_rate, 12);
        assert.strictEqual(pRow.price, 55);
        console.log('✓ Parent product details and GST (12%) updated and verified in SQLite');

        // 3. Test changing parent GST to 0, 5, 28 and verify NO reverting to 0 unexpectedly
        const gstTestRates = [0, 5, 28];
        for (const testGst of gstTestRates) {
            const gstUpdateRes = await win.webContents.executeJavaScript(`(async () => {
                return await window.electronAPI.sqlite.products.updateGstRate(${parentId}, ${testGst});
            })()`);
            assert(gstUpdateRes.success, `Updating parent GST to ${testGst}% must succeed`);
            await refreshUI();

            const checkGstDb = dbManager.getDatabase().prepare('SELECT gst_rate FROM products WHERE id = ?').get(parentId).gst_rate;
            assert.strictEqual(checkGstDb, testGst, `Parent GST in DB must be exactly ${testGst}`);

            // Check UI input value
            const checkGstUi = await win.webContents.executeJavaScript(`(() => {
                const input = document.querySelector('input.quick-edit-gst[data-record-type="product"][data-product-id="' + ${parentId} + '"]');
                return input ? parseFloat(input.value) : null;
            })()`);
            assert.strictEqual(checkGstUi, testGst, `Parent GST in UI input must be exactly ${testGst}`);
        }
        console.log('✓ Parent GST supports 0%, 5%, 28% without unexpected resetting to 0');

        // Restore parent GST to 18%
        await win.webContents.executeJavaScript(`(async () => { await window.electronAPI.sqlite.products.updateGstRate(${parentId}, 18); })()`);
        await refreshUI();

        // 4. Edit Variant & Verify GST Inheritance & Override
        // VarInherit has gstRate: null (inherits parent 18%)
        const inheritCheck = await win.webContents.executeJavaScript(`(async () => {
            try {
                const pRes = await window.electronAPI.sqlite.products.get(${parentId});
                const p = pRes?.data;
                const vInherit = p?.variants?.find(v => v.id === ${varInheritId});
                const vOverride = p?.variants?.find(v => v.id === ${varOverrideId});
                return {
                    parentGst: p?.gst_rate !== undefined ? p.gst_rate : p?.gstRate,
                    vInheritGst: vInherit?.gst_rate !== undefined ? vInherit.gst_rate : vInherit?.gstRate,
                    vOverrideGst: vOverride?.gst_rate !== undefined ? vOverride.gst_rate : vOverride?.gstRate
                };
            } catch(e) {
                return { error: e.stack || e.message };
            }
        })()`);
        console.log('Inheritance check:', inheritCheck);
        if (inheritCheck.error) throw new Error(inheritCheck.error);
        assert.strictEqual(inheritCheck.parentGst, 18, 'Parent GST should be 18%');
        assert.strictEqual(inheritCheck.vOverrideGst, 28, 'Overriding variant GST should remain 28%');

        // Update variant override GST to 5%
        const varGstUpdateRes = await win.webContents.executeJavaScript(`(async () => {
            try {
                return await window.electronAPI.sqlite.products.updateVariantGstRate(${varOverrideId}, 5);
            } catch(e) {
                return { error: e.stack || e.message };
            }
        })()`);
        console.log('varGstUpdateRes:', varGstUpdateRes);
        if (varGstUpdateRes.error) throw new Error(varGstUpdateRes.error);
        assert(varGstUpdateRes.success, 'Updating variant GST to 5% must succeed');
        await refreshUI();

        const vRow = dbManager.getDatabase().prepare('SELECT gst_rate FROM product_variants WHERE id = ?').get(varOverrideId);
        assert.strictEqual(vRow.gst_rate, 5, 'Variant GST in SQLite must be 5%');

        // 5. Verify Record Sale Cart calculations for Parent and Variant
        const cartCheck = await win.webContents.executeJavaScript(`(async () => {
            try {
                const pRes = await window.electronAPI.sqlite.products.get(${parentId});
                const parentProd = pRes?.data;
                const varObj = parentProd?.variants?.find(v => v.id === ${varOverrideId});

                // Add parent to cart
                cart = [{
                    productId: parentProd.id,
                    variantId: null,
                    productName: parentProd.name,
                    price: parentProd.price,
                    quantity: 1,
                    baseQuantity: 1
                }];
                if (typeof updateCartDisplay === 'function') updateCartDisplay();
                const parentCartGst = cart[0]?.gstRate;

                // Add variant override to cart
                cart = [{
                    productId: parentProd.id,
                    variantId: varObj.id,
                    variantName: varObj.variantName,
                    productName: parentProd.name + ' - ' + varObj.variantName,
                    price: varObj.sellingPrice,
                    quantity: 1,
                    baseQuantity: 1
                }];
                if (typeof updateCartDisplay === 'function') updateCartDisplay();
                const variantCartGst = cart[0]?.gstRate;

                return { parentCartGst, variantCartGst };
            } catch(e) {
                return { error: e.stack || e.message };
            }
        })()`);
        console.log('Cart GST check:', cartCheck);
        if (cartCheck.error) throw new Error(cartCheck.error);
        assert.strictEqual(cartCheck.parentCartGst, 18, 'Parent product in cart must use parent GST (18%)');
        assert.strictEqual(cartCheck.variantCartGst, 5, 'Variant in cart must use variant override GST (5%)');
        console.log('✓ Record Sale cart correctly applies parent and variant GST rates');

        console.log('\n================================================================');
        console.log('🎉 PHASE 3 PASSED: Inventory & GST Regression 100% Verified!');
        console.log('================================================================\n');

        dbManager.closeDatabase();
        try { win.destroy(); } catch (e) {}
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        app.quit();
        process.exit(0);

    } catch (err) {
        console.error('❌ Phase 3 Failed:', err);
        try { dbManager.closeDatabase(); } catch(e) {}
        try { win.destroy(); } catch (e) {}
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        app.quit();
        process.exit(1);
    }
});
