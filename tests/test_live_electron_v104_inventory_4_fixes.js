/**
 * OneBook v1.0.4 - Live Electron BrowserWindow UI Test
 * 
 * Verifies all 4 inventory fixes directly inside the live Electron Chromium renderer:
 * 1. Inventory deletion refreshes table immediately
 * 2. Update Stock & Price updates products reliably, handles quantity 0, clears form
 * 3. Flexible normalized inventory search matches 'clip', '10 cl', '10s clip', 'clip 10', 'rs clip', 'dds 435'
 * 4. Header GST apply control is removed and layout is clean
 */

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

app.disableHardwareAcceleration();

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_live_test_'));
const testDbPath = path.join(tempDir, 'onebook_live.db');
process.env.ONEBOOK_DB_PATH = testDbPath;

const dbManager = require('../database');
dbManager.initializeDatabase(testDbPath, { allowCreate: true });
const productService = require('../services/productService');
const stockService = require('../services/stockService');

// Seed test products
productService.createProduct({
    name: '10rs clip',
    barcode: 'DDS-435163',
    category: 'Cosmetics',
    price: 10,
    stock: 264,
    variants: [
        { variantName: 'Standard', barcode: 'DDS-435163', stock: 264, sellingPrice: 10 }
    ]
});

productService.createProduct({
    name: '10rs earring',
    barcode: 'DDS-278110',
    category: 'Cosmetics',
    price: 10,
    stock: 81
});

productService.createProduct({
    name: 'Item To Delete',
    barcode: 'DEL-ITEM-001',
    category: 'Testing',
    price: 20,
    stock: 0
});

app.whenReady().then(async () => {
    console.log('\n================================================================');
    console.log('🚀 OneBook v1.0.4 - Live Electron UI Verification');
    console.log('================================================================\n');

    ipcMain.on('get-license-info-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
    ipcMain.on('get-license-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
    ipcMain.handle('sqlite:system:getDatabaseDetails', async () => ({ connected: true, exists: true, path: testDbPath }));
    ipcMain.handle('auth:checkAdminStatus', async () => ({ success: true, data: { isAdmin: true } }));
    ipcMain.handle('sqlite:users:validateSession', async () => ({ success: true, data: { id: 1, username: 'admin', role: 'admin', status: 'active' } }));
    ipcMain.handle('sqlite:users:getCurrentUser', async () => ({ success: true, data: { id: 1, username: 'admin', role: 'admin', status: 'active' } }));
    ipcMain.handle('sqlite:settings:get', async () => ({ success: true, data: { gstEnabled: true, quickEditInventory: false } }));
    ipcMain.handle('sqlite:products:getAll', async () => ({ success: true, data: productService.getProducts() }));
    ipcMain.handle('sqlite:products:get', async (e, args) => {
        const id = args?.id !== undefined ? args.id : args;
        return { success: true, data: productService.getProduct(id) };
    });
    ipcMain.handle('sqlite:products:search', async (e, args) => {
        const q = args?.q !== undefined ? args.q : args;
        return { success: true, data: productService.searchProducts(q) };
    });
    ipcMain.handle('sqlite:products:update', async (e, args, arg2) => {
        const id = args?.id !== undefined ? args.id : args;
        const data = args?.data !== undefined ? args.data : arg2;
        return productService.updateProduct(id, data);
    });
    ipcMain.handle('sqlite:products:delete', async (e, args) => {
        const id = args?.id !== undefined ? args.id : args;
        return productService.deleteProduct(id);
    });
    ipcMain.handle('sqlite:products:deleteVariant', async (e, args, arg2) => {
        const variantId = args?.variantId !== undefined ? args.variantId : (args?.id !== undefined ? args.id : args);
        const productId = args?.productId !== undefined ? args.productId : arg2;
        return productService.deleteVariant(variantId, productId);
    });
    ipcMain.handle('sqlite:stock:adjust', async (e, args, arg2, arg3, arg4, arg5, arg6, arg7, arg8) => {
        let pId, vId, qty, reason, refType, refId, date, locId;
        if (args && typeof args === 'object' && args.productId !== undefined) {
            pId = args.productId;
            vId = args.variantId;
            qty = args.qty !== undefined ? args.qty : args.quantity;
            reason = args.reason;
            refType = args.refType || args.referenceType;
            refId = args.refId || args.referenceId;
            date = args.date;
            locId = args.locationId;
        } else {
            [pId, vId, qty, reason, refType, refId, date, locId] = [args, arg2, arg3, arg4, arg5, arg6, arg7, arg8];
        }
        return stockService.adjustStock(pId, vId, qty, reason, refType, refId, date, locId);
    });
    ipcMain.handle('sqlite:dashboard:getMetrics', async () => ({ success: true, data: {} }));

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

    win.webContents.on('will-navigate', (event, url) => {
        if (url.includes('login.html')) {
            event.preventDefault();
        }
    });

    win.loadFile(path.join(__dirname, '../OneBook.html'));

    win.webContents.on('console-message', (e, level, msg) => {
        console.log('RENDERER [' + level + ']:', msg);
    });

    win.webContents.once('did-finish-load', async () => {
        try {
            await new Promise(r => setTimeout(r, 1000));

            // Authenticate and open Inventory section
            await win.webContents.executeJavaScript(`
                (async () => {
                    const user = { id: 1, username: 'admin', role: 'admin', isDemo: false, permissions: ['dashboard', 'inventory', 'record_sale', 'products', 'delete'] };
                    window.currentUser = user;
                    sessionStorage.setItem('currentUser', JSON.stringify(user));
                    sessionStorage.setItem('onebook_user', JSON.stringify(user));
                    if (typeof showSection === 'function') showSection('inventory');
                    if (typeof loadProductsFromDatabase === 'function') await loadProductsFromDatabase();
                    if (typeof updateInventoryTable === 'function') await updateInventoryTable();
                })()
            `);
            await new Promise(r => setTimeout(r, 600));

            // TEST 1: Header GST apply control removal in DOM
            console.log('[1/4] Verifying Header GST Control Removal in UI DOM...');
            const gstControls = await win.webContents.executeJavaScript(`
                (() => {
                    return {
                        hasHeaderBox: Boolean(document.querySelector('.inventory-gst-compact-box')),
                        hasHeaderSelect: Boolean(document.getElementById('invHeaderGstSelect')),
                        hasHeaderBtn: Boolean(document.getElementById('btnApplyInvHeaderGst')),
                        hasSearchInput: Boolean(document.getElementById('inventorySearch')),
                        hasExpiryFilter: Boolean(document.getElementById('expiryFilter')),
                        hasDatalist: Boolean(document.getElementById('invGstRateDatalist'))
                    };
                })()
            `);
            console.log('  Header GST Controls state:', gstControls);
            if (!gstControls.hasHeaderBox && !gstControls.hasHeaderSelect && !gstControls.hasHeaderBtn && gstControls.hasSearchInput && gstControls.hasExpiryFilter && gstControls.hasDatalist) {
                console.log('  ✅ PASS: Header GST controls successfully removed while search, expiry, and row datalist are intact');
            } else {
                throw new Error('Header GST controls still present or required elements missing');
            }

            // TEST 2: Flexible Normalized Inventory Search in UI
            console.log('\n[2/4] Verifying Flexible Normalized Inventory Search in UI...');
            const searchTestQueries = ['clip', '10 cl', '10s clip', 'clip 10', 'rs clip', 'dds 435'];
            for (const q of searchTestQueries) {
                const searchResult = await win.webContents.executeJavaScript(`
                    (async () => {
                        const input = document.getElementById('inventorySearch');
                        input.value = '${q}';
                        const apiRes = await window.electronAPI.sqlite.products.search('${q}');
                        console.log('API search result for ${q}:', JSON.stringify(apiRes));
                        await updateInventoryTable();
                        const rows = Array.from(document.querySelectorAll('#inventoryTableBody tr'));
                        const visibleTexts = rows.map(r => r.textContent.trim());
                        return { query: '${q}', apiRes, count: rows.length, texts: visibleTexts };
                    })()
                `);
                console.log('Search result for ' + q + ':', searchResult);
                const matched = searchResult.texts.some(t => t.includes('10rs clip'));
                if (matched) {
                    console.log(`  ✅ PASS: Search '${q}' matched '${searchResult.texts.join(', ')}'`);
                } else {
                    throw new Error(`Search '${q}' failed to match '10rs clip'. Visible rows: ${JSON.stringify(searchResult.texts)}`);
                }
            }

            // Clear search filter
            await win.webContents.executeJavaScript(`
                (async () => {
                    document.getElementById('inventorySearch').value = '';
                    await updateInventoryTable();
                })()
            `);
            await new Promise(r => setTimeout(r, 400));

            // TEST 3: Update Stock & Price in UI (Setting stock to 0 intentionally)
            console.log('\n[3/4] Verifying Update Stock & Price UI Handling (Quantity 0)...');
            const updateResult = await win.webContents.executeJavaScript(`
                (async () => {
                    const prod = (products || []).find(p => p.name === '10rs clip');
                    if (!prod) return { success: false, error: 'Product not found' };

                    // Select product via autocomplete
                    selectStockBarcodeProduct(prod, prod.variants && prod.variants[0] ? prod.variants[0] : null);

                    // Set quantity to 0 and new price to 12.00
                    document.getElementById('addStockQuantity').value = '0';
                    document.getElementById('updateStockPrice').value = '12.00';

                    // Mock showAlert to prevent modal blocking
                    window.lastAlertMsg = '';
                    window.showAlert = (msg) => { window.lastAlertMsg = msg; };

                    // Execute update
                    await updateStockAndPrice();

                    // Check if form is cleared
                    const cleared = (
                        document.getElementById('updateStockProductId').value === '' &&
                        document.getElementById('stockBarcode').value === '' &&
                        document.getElementById('addStockQuantity').value === '' &&
                        document.getElementById('updateStockPrice').value === ''
                    );

                    // Re-fetch product from SQLite
                    const updated = await window.electronAPI.sqlite.products.get(prod.id);
                    const prodData = updated.data || updated;
                    const newStock = prodData.variants && prodData.variants[0] ? prodData.variants[0].stock : prodData.stock;
                    const newPrice = prodData.variants && prodData.variants[0] ? prodData.variants[0].sellingPrice : prodData.price;

                    return { success: true, cleared, newStock, newPrice, alert: window.lastAlertMsg };
                })()
            `);
            console.log('  Update Stock & Price Result:', updateResult);
            if (updateResult.success && updateResult.cleared && updateResult.newStock === 0 && updateResult.newPrice === 12.00) {
                console.log('  ✅ PASS: Quantity 0 set stock to 0 in SQLite, price updated to 12.00, and form cleared immediately');
            } else {
                throw new Error(`Update Stock & Price failed: ${JSON.stringify(updateResult)}`);
            }

            // TEST 4: Immediate Deletion in UI
            console.log('\n[4/4] Verifying Immediate Deletion in UI...');
            const deleteResult = await win.webContents.executeJavaScript(`
                (async () => {
                    const prodToDelete = (products || []).find(p => p.name === 'Item To Delete');
                    if (!prodToDelete) return { success: false, error: 'Product to delete not found' };

                    // Mock showConfirm to automatically execute callback
                    window.showConfirm = (msg, onYes) => { if (onYes) onYes(); };
                    window.showAlert = (msg) => { window.lastAlertMsg = msg; };

                    await deleteInventoryProduct(prodToDelete.id);
                    await new Promise(r => setTimeout(r, 500));

                    const rows = Array.from(document.querySelectorAll('#inventoryTableBody tr'));
                    const isVisibleInTable = rows.some(r => r.cells[1] && r.cells[1].textContent.includes('Item To Delete'));
                    const inMemory = (products || []).some(p => p.name === 'Item To Delete');

                    return { success: true, isVisibleInTable, inMemory, alert: window.lastAlertMsg };
                })()
            `);
            console.log('  Delete Result in UI:', deleteResult);
            if (deleteResult.success && !deleteResult.isVisibleInTable && !deleteResult.inMemory) {
                console.log('  ✅ PASS: Deleted item immediately disappeared from UI table and memory state without application restart');
            } else {
                throw new Error(`Delete failed to reflect immediately: ${JSON.stringify(deleteResult)}`);
            }

            console.log('\n================================================================');
            console.log('🎉 ALL 4 INVENTORY FIXES VERIFIED SUCCESSFULLY IN LIVE ELECTRON UI');
            console.log('================================================================\n');

            dbManager.closeDatabase();
            if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
            app.exit(0);
        } catch (err) {
            console.error('\n❌ Live UI Test Failed:', err.message);
            dbManager.closeDatabase();
            if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
            app.exit(1);
        }
    });
});
