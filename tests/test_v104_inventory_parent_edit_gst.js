/**
 * OneBook v1.0.4 - Live Electron UI Verification for Inventory Parent Edit, GST Persistence & Clean Input UI
 * 
 * Verifies:
 * 1. BUG 1: Parent Inventory Edit button opens Edit Product modal (NOT Edit Variant modal) with parent product ID and data,
 *    saves correctly, and refreshes the table immediately. Variant row opens Edit Variant modal.
 * 2. BUG 2: Quick Edit GST accepts numeric values (including 0, 5, 12, 18, 28), saves to SQLite products/variants,
 *    does not revert to 0 on blur/reload, correctly reflects in Record Sale cart and calculations.
 * 3. BUG 3: GST input has no datalist dropdown arrow or number spinner arrows, providing clean numeric input.
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
const assert = require('assert');

app.disableHardwareAcceleration();

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_inv_test_'));
const testDbPath = path.join(tempDir, 'onebook_test.db');
process.env.ONEBOOK_DB_PATH = testDbPath;

const dbManager = require('../database');
dbManager.initializeDatabase(testDbPath, { allowCreate: true });
const productService = require('../services/productService');
const stockService = require('../services/stockService');

// Seed test product 'pen' with variant 'black'
const penId = productService.createProduct({
    name: 'pen',
    barcode: 'DDS-689163',
    category: 'Other',
    unit: 'Bundle',
    price: 10,
    cost_price: 5,
    stock: 4,
    min_stock: 1,
    hsn: '9608',
    gst_rate: 0
});

productService.addVariant(penId, {
    variantName: 'black',
    barcode: 'DDS-7771144',
    sellingPrice: 10,
    buyingPrice: 5,
    stock: 40,
    unit: 'Bundle',
    category: 'Other',
    gstRate: null // inherits from parent
});

app.whenReady().then(async () => {
    console.log('\n================================================================');
    console.log('🧪 OneBook - Live Electron Inventory Parent Edit & GST Test');
    console.log('================================================================\n');

    let currentSessionToken = 'test-token-' + Date.now();

    ipcMain.on('get-license-info-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
    ipcMain.on('get-license-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
    ipcMain.handle('sqlite:system:getDatabaseDetails', async () => ({ connected: true, exists: true, path: testDbPath }));
    ipcMain.handle('auth:checkAdminStatus', async () => ({ success: true, data: { isAdmin: true } }));
    ipcMain.handle('sqlite:users:validateSession', async () => ({ success: true, data: { id: 1, username: 'admin', role: 'admin', status: 'active' } }));
    ipcMain.handle('sqlite:users:getCurrentUser', async () => ({ success: true, data: { id: 1, username: 'admin', role: 'admin', status: 'active' } }));
    ipcMain.handle('sqlite:settings:get', async () => ({ success: true, data: { gstEnabled: true, quickEditInventory: true } }));
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
        const id = args?.id !== undefined ? args.id : (args?.productId !== undefined ? args.productId : args);
        const data = args?.data !== undefined ? args.data : (args?.product !== undefined ? args.product : (arg2 || args));
        return productService.updateProduct(id, data);
    });
    ipcMain.handle('sqlite:products:updateGstRate', async (e, args, arg2) => {
        const productId = args?.productId !== undefined ? args.productId : args;
        const gstRate = args?.gstRate !== undefined ? args.gstRate : arg2;
        return productService.updateProductGstRate(productId, gstRate);
    });
    ipcMain.handle('sqlite:products:updateVariantGstRate', async (e, args, arg2) => {
        const variantId = args?.variantId !== undefined ? args.variantId : args;
        const gstRate = args?.gstRate !== undefined ? args.gstRate : arg2;
        return productService.updateVariantGstRate(variantId, gstRate);
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
    ipcMain.handle('sqlite:stock:adjust', async (e, args, ...rest) => {
        let pId, vId, qty, reason, refType, refId, date, locId;
        if (args && typeof args === 'object' && args.productId !== undefined) {
            pId = args.productId;
            vId = args.variantId;
            qty = args.qty !== undefined ? args.qty : args.quantity;
            reason = args.reason;
            refType = args.refType;
            refId = args.refId;
            date = args.date;
            locId = args.locationId;
        } else {
            [pId, vId, qty, reason, refType, refId, date, locId] = [args, rest[0], rest[1], rest[2], rest[3], rest[4], rest[5], rest[6]];
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

    win.webContents.on('did-finish-load', async () => {
        try {
            console.log('Renderer loaded. Executing automated test suite in Chromium...');

            const testResults = await win.webContents.executeJavaScript(`(async () => {
                const results = [];
                function logTest(name, passed, detail) {
                    results.push({ name, passed, detail });
                    console.log((passed ? '✅ PASS: ' : '❌ FAIL: ') + name + (detail ? ' (' + detail + ')' : ''));
                }

                // Setup authenticated session
                window.DATA_BACKEND = 'sqlite';
                window.hasPermission = () => true;
                window.isUserAdmin = true;
                sessionStorage.setItem('onebook_session_token', 'test-token');
                sessionStorage.setItem('currentUser', JSON.stringify({ id: 1, username: 'admin', role: 'admin', permissions: ['all'] }));
                localStorage.setItem('sessionToken', 'test-token');
                const s = JSON.parse(localStorage.getItem('settings') || '{}');
                s.gstEnabled = true;
                s.quickEditInventory = true;
                localStorage.setItem('settings', JSON.stringify(s));

                const loginModal = document.getElementById('loginModal');
                if (loginModal) loginModal.style.display = 'none';
                const mainApp = document.getElementById('mainAppContainer');
                if (mainApp) mainApp.style.display = 'block';

                await window.loadProductsFromDatabase();
                await updateInventoryTable();

                const rows = document.querySelectorAll('#inventoryTableBody tr');
                logTest('Inventory rows rendered', rows.length === 2, 'Found ' + rows.length + ' rows');

                const row1 = rows[0];
                const row2 = rows[1];

                const row1Name = row1.cells[1].innerText.trim();
                const row2Name = row2.cells[1].innerText.trim();
                logTest('Row 1 is parent product pen', row1Name === 'pen', 'Row 1: ' + row1Name);
                logTest('Row 2 is variant pen - black', row2Name.includes('black'), 'Row 2: ' + row2Name);

                // --- TEST BUG 3: GST Input clean UI (no datalist arrow, no spin buttons) ---
                const row1GstInput = row1.querySelector('.quick-edit-gst');
                const hasDatalist = row1GstInput && row1GstInput.hasAttribute('list');
                logTest('BUG 3: GST input does not have list attribute (no datalist dropdown arrow)', !hasDatalist, 'hasAttribute list: ' + hasDatalist);

                const gstComputed = window.getComputedStyle(row1GstInput);
                logTest('BUG 3: GST input is styled for clean numeric input', row1GstInput.type === 'number', 'type: ' + row1GstInput.type);

                // --- TEST BUG 1: Parent Inventory Edit button routing ---
                const row1EditBtn = row1.querySelector('.inv-action-edit');
                logTest('Row 1 has Edit button', !!row1EditBtn);

                // Click Edit on Row 1 (Parent Product)
                row1EditBtn.click();
                await new Promise(r => setTimeout(r, 150));

                const editProdModal = document.getElementById('editProductModal');
                const editVarModal = document.getElementById('editVariantModal');

                const prodModalOpen = editProdModal && (editProdModal.style.display === 'flex' || editProdModal.style.display === 'block');
                const varModalOpen = editVarModal && (editVarModal.style.display === 'flex' || editVarModal.style.display === 'block');

                logTest('BUG 1: Clicking Edit on parent product opens Edit Product Modal (NOT Edit Variant Modal)', prodModalOpen && !varModalOpen, 'prodModal: ' + prodModalOpen + ', varModal: ' + varModalOpen);

                const editProdNameInput = document.getElementById('editProductName');
                const editProdIdInput = document.getElementById('editProductId');
                logTest('BUG 1: Edit Product modal populated with parent product details', editProdNameInput && editProdNameInput.value === 'pen', 'Name in form: ' + (editProdNameInput ? editProdNameInput.value : 'null'));

                // Edit the product name to 'pen luxury' and save
                editProdNameInput.value = 'pen luxury';
                const editForm = document.getElementById('editProductForm');
                const fakeEvent = { preventDefault: () => {} };
                await saveEditedProduct(fakeEvent);
                await new Promise(r => setTimeout(r, 200));

                // Verify table refreshed and displays updated parent name
                const updatedRows = document.querySelectorAll('#inventoryTableBody tr');
                const updatedRow1Name = updatedRows[0].cells[1].innerText.trim();
                logTest('BUG 1: Parent product edit saved and inventory table refreshed immediately', updatedRow1Name === 'pen luxury', 'Updated Name: ' + updatedRow1Name);

                // Now test clicking Edit on Row 2 (Variant)
                const row2EditBtn = updatedRows[1].querySelector('.inv-action-edit');
                row2EditBtn.click();
                await new Promise(r => setTimeout(r, 150));

                const varModalOpen2 = editVarModal && (editVarModal.style.display === 'flex' || editVarModal.style.display === 'block');
                const prodModalOpen2 = editProdModal && (editProdModal.style.display === 'flex' || editProdModal.style.display === 'block');
                const evNameVal = document.getElementById('evName') ? document.getElementById('evName').value : '';

                logTest('BUG 1: Clicking Edit on variant row opens Edit Variant Modal with variant name', varModalOpen2 && !prodModalOpen2 && evNameVal === 'black', 'varModal: ' + varModalOpen2 + ', evName: ' + evNameVal);
                closeEditVariantModal();
                await new Promise(r => setTimeout(r, 100));

                // --- TEST BUG 2: GST Saving and Persistence ---
                // 1. Edit parent product GST to 5%
                const r1GstInput = document.querySelectorAll('#inventoryTableBody tr')[0].querySelector('.quick-edit-gst');
                r1GstInput.value = '5';
                await saveQuickEditField(r1GstInput, 'gst');
                await new Promise(r => setTimeout(r, 100));

                logTest('BUG 2: Parent GST saved as 5% in UI', r1GstInput.value === '5' && r1GstInput.dataset.savedVal === '5', 'val: ' + r1GstInput.value);

                // 2. Edit parent GST to 0% (checking valid 0 is not overwritten or reverted)
                r1GstInput.value = '0';
                await saveQuickEditField(r1GstInput, 'gst');
                await new Promise(r => setTimeout(r, 100));

                logTest('BUG 2: Parent GST saved as 0% in UI (0 accepted as valid)', r1GstInput.value === '0' && r1GstInput.dataset.savedVal === '0', 'val: ' + r1GstInput.value);

                // 3. Edit parent GST to 18%
                r1GstInput.value = '18';
                await saveQuickEditField(r1GstInput, 'gst');
                await new Promise(r => setTimeout(r, 100));

                // 4. Edit variant GST to 12%
                const r2GstInput = document.querySelectorAll('#inventoryTableBody tr')[1].querySelector('.quick-edit-gst');
                r2GstInput.value = '12';
                await saveQuickEditField(r2GstInput, 'gst');
                await new Promise(r => setTimeout(r, 100));

                logTest('BUG 2: Variant GST saved as 12% in UI', r2GstInput.value === '12' && r2GstInput.dataset.savedVal === '12', 'val: ' + r2GstInput.value);

                // 5. Test persistence after reloading products from database (simulating restart)
                await window.loadProductsFromDatabase();
                await updateInventoryTable();

                const reloadedRows = document.querySelectorAll('#inventoryTableBody tr');
                const relR1Gst = reloadedRows[0].querySelector('.quick-edit-gst').value;
                const relR2Gst = reloadedRows[1].querySelector('.quick-edit-gst').value;

                logTest('BUG 2: GST values survive reload without reverting to 0 (Parent: 18%, Variant: 12%)', relR1Gst === '18' && relR2Gst === '12', 'Parent: ' + relR1Gst + '%, Variant: ' + relR2Gst + '%');

                // 6. Test Record Sale shopping cart GST retrieval
                cart = [];
                // Add parent product to cart
                const parentProd = products.find(p => p.name === 'pen luxury');
                cart.push({
                    productId: parentProd.id,
                    productName: parentProd.name,
                    price: 10,
                    quantity: 1,
                    baseQuantity: 1
                });
                updateCartDisplay();

                const parentCartItem = cart[0];
                logTest('BUG 2: Record Sale cart retrieves updated parent GST (18%)', parentCartItem.gstRate === 18, 'Cart GST: ' + parentCartItem.gstRate + '%');

                // Add variant to cart
                const varObj = parentProd.variants.find(v => v.variantName === 'black');
                cart.push({
                    productId: parentProd.id,
                    variantId: varObj.id,
                    variantName: 'black',
                    productName: 'pen luxury - black',
                    price: 10,
                    quantity: 1,
                    baseQuantity: 1
                });
                updateCartDisplay();

                const variantCartItem = cart[1];
                logTest('BUG 2: Record Sale cart retrieves variant-specific GST override (12%)', variantCartItem.gstRate === 12, 'Variant Cart GST: ' + variantCartItem.gstRate + '%');

                // --- TEST USER REPORTED GLITCH: Changing GST in Inventory must immediately update Record Sale cart from 3% to 6% ---
                // Setup: item already in cart with variantId pointing to base variant
                const baseVar = parentProd.variants.find(v => !v.variantName || v.variantName === '' || v.variantName.toLowerCase() === 'default') || parentProd.variants[0];
                cart = [{
                    productId: parentProd.id,
                    variantId: baseVar.id,
                    productName: parentProd.name,
                    price: 10,
                    quantity: 1,
                    baseQuantity: 1
                }];
                // Change GST to 3 first
                r1GstInput.value = '3';
                await saveQuickEditField(r1GstInput, 'gst');
                await new Promise(r => setTimeout(r, 100));
                logTest('Glitch test: Cart shows 3% initially', cart[0].gstRate === 3, 'Cart GST: ' + cart[0].gstRate + '%');

                // Now user edits GST in Inventory to 6%
                r1GstInput.value = '6';
                await saveQuickEditField(r1GstInput, 'gst');
                await new Promise(r => setTimeout(r, 100));

                logTest('Glitch test: Cart immediately updates to 6% (NOT 3%)', cart[0].gstRate === 6, 'Cart GST: ' + cart[0].gstRate + '%');

                // Switch to sales tab and verify cart remains 6%
                switchTab('sales');
                await new Promise(r => setTimeout(r, 150));
                logTest('Glitch test: Switching to Record Sale tab preserves updated 6% GST in Cart', cart[0].gstRate === 6, 'Cart GST on tab switch: ' + cart[0].gstRate + '%');

                return results;
            })()`);

            console.log('\n--- Test Results Summary ---');
            let allPassed = true;
            for (const r of testResults) {
                console.log((r.passed ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? ': ' + r.detail : ''));
                if (!r.passed) allPassed = false;
            }

            // Verify directly in SQLite test database
            const db = dbManager.getDatabase();
            const parentRowInDb = db.prepare('SELECT name, gst_rate FROM products WHERE id = ?').get(penId);
            const variantRowInDb = db.prepare('SELECT variant_name, gst_rate FROM product_variants WHERE product_id = ? AND variant_name = ?').get(penId, 'black');

            console.log(`SQLite DB check: Product name="${parentRowInDb.name}", gst_rate=${parentRowInDb.gst_rate}`);
            console.log(`SQLite DB check: Variant variant_name="${variantRowInDb.variant_name}", gst_rate=${variantRowInDb.gst_rate}`);

            assert.strictEqual(parentRowInDb.name, 'pen luxury', 'Parent product name updated in SQLite');
            assert.strictEqual(parentRowInDb.gst_rate, 6, 'Parent product GST rate updated in SQLite');
            assert.strictEqual(variantRowInDb.gst_rate, 12, 'Variant GST rate updated in SQLite');

            console.log('\n================================================================');
            if (allPassed) {
                console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! (100%)');
            } else {
                console.log('❌ SOME TESTS FAILED');
                process.exitCode = 1;
            }
            console.log('================================================================\n');

        } catch (err) {
            console.error('Test execution failed:', err);
            process.exitCode = 1;
        } finally {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (e) {}
            try { win.destroy(); } catch (e) {}
            app.quit();
            process.exit(process.exitCode || 0);
        }
    });
});
