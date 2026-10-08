const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');

const path = require('path');

const fs = require('fs');

const crypto = require('crypto');

const { execSync } = require('child_process');

const os = require('os');





function createWindow() {

    const win = new BrowserWindow({

        width: 1200,

        height: 800,

        icon: path.join(__dirname, 'icon-512.png'),

        webPreferences: {

            nodeIntegration: false,

            contextIsolation: true,

            preload: path.join(__dirname, 'preload.js')

        }

    });



    const mode = checkLicense();
    if (mode === 'DEMO') {
        win.loadFile(path.join(__dirname, 'license.html'));
    } else {
        win.webContents.session.clearCache();

        win.loadFile(path.join(__dirname, 'OneBook.html'), { query: { t: Date.now().toString() } });
    }

    
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') {
            win.webContents.reload();
            event.preventDefault();
        }
    });

    win.maximize();


}



// Set up IPC handlers

ipcMain.handle('surrender-license', async (event, licenseKey, contact) => {
    try {
        const p = getLicensePath();
        if (!fs.existsSync(p)) return { success: false, error: 'No local license found.' };

        const decrypted = safeStorage.decryptString(fs.readFileSync(p));
        const parsed = JSON.parse(decrypted);
        const { license, signature } = parsed;

        console.log('[LICENSE SURRENDER] Starting surrender');
        console.log('[LICENSE SURRENDER] License ID:', license.licenseId);
        console.log('[LICENSE SURRENDER] Device ID:', license.deviceId);

        const response = await fetch('https://sqibniuqbkgexipynfkx.supabase.co/functions/v1/surrender-license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                licenseId: license.licenseId,
                deviceId: license.deviceId,
                signature: signature,
                licensePayload: license,
                licenseKey: licenseKey,
                registeredContact: contact
            })
        });

        const data = await response.json();
        console.log('[LICENSE SURRENDER] HTTP status:', response.status);
        console.log('[LICENSE SURRENDER] Response:', data);
        
        if (data.success) {
            // Delete trusted state only after server confirmation
            fs.unlinkSync(p);
            return { success: true };
        }
        return { success: false, error: data.error || 'Server rejected surrender.' };
    } catch (e) {
        console.error('Surrender error:', e);
        return { success: false, error: e.message || 'Failed to contact server.' };
    }
});


ipcMain.on('select-directory-sync', (event) => {

    const result = dialog.showOpenDialogSync({

        properties: ['openDirectory'],

        title: 'Select Folder for salesapp Database'

    });

    event.returnValue = result ? result[0] : null;

});



ipcMain.on('save-data-sync', (event, { folder, key, data }) => {

    if (!folder) {

        event.returnValue = { success: false, error: 'No folder selected' };

        return;

    }

    try {

        const filePath = path.join(folder, `${key}.json`);

        fs.writeFileSync(filePath, data, 'utf-8');

        event.returnValue = { success: true };

    } catch (error) {

        console.error('Save error:', error);

        event.returnValue = { success: false, error: error.message };

    }

});



ipcMain.on('load-data-sync', (event, { folder, key }) => {

    if (!folder) {

        event.returnValue = null;

        return;

    }

    try {

        const filePath = path.join(folder, `${key}.json`);

        if (fs.existsSync(filePath)) {

            event.returnValue = fs.readFileSync(filePath, 'utf-8');

        } else {

            event.returnValue = null;

        }

    } catch (error) {

        console.error('Load error:', error);

        event.returnValue = null;

    }

});



ipcMain.on('create-backup-sync', (event, { folder, filename, data }) => {

    if (!folder) {

        event.returnValue = { success: false, error: 'No folder selected' };

        return;

    }

    try {

        const backupDir = path.join(folder, 'backup');

        if (!fs.existsSync(backupDir)) {

            fs.mkdirSync(backupDir, { recursive: true });

        }

        const filePath = path.join(backupDir, filename);

        fs.writeFileSync(filePath, data, 'utf-8');

        event.returnValue = { success: true, filePath };

    } catch (error) {

        console.error('Backup error:', error);

        event.returnValue = { success: false, error: error.message };

    }

});









// --- Licensing Configuration ---

const getLicensePath = () => path.join(app.getPath('userData'), 'license-state.bin');



const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt7Yd7SNQPoNlkjBCIs6cOa9josLFtw0qTsTy6e9SnY8=
-----END PUBLIC KEY-----`;



function getHardwareId() {

    try {

        const platform = os.platform();

        let hwid = '';

        if (platform === 'darwin') {

            hwid = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID').toString();

            const match = hwid.match(/"IOPlatformUUID" = "(.*?)"/);

            if (match) return match[1];

        } else if (platform === 'win32') {

            hwid = execSync('powershell.exe -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"').toString().trim();

            if (hwid && hwid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') return hwid;

        } else if (platform === 'linux') {

            if (fs.existsSync('/etc/machine-id')) {

                return fs.readFileSync('/etc/machine-id', 'utf8').trim();

            } else if (fs.existsSync('/var/lib/dbus/machine-id')) {

                return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();

            }

        }

    } catch (e) {

        console.error('Failed to get primary hardware ID', e);

    }

    // Safe fallback if the preferred identifier is unavailable: Use hostname + username hash

    // We do NOT randomly generate a new UUID on every failure, to maintain stability.

    const fallbackString = `${os.hostname()}-${os.userInfo().username}`;

    return crypto.createHash('sha256').update(fallbackString).digest('hex').substring(0, 32);

}



const machineIdCache = getHardwareId();



ipcMain.on('get-machine-id-sync', (event) => {

    event.returnValue = machineIdCache;

});



function verifyLicenseSignature(payloadObj, signatureBase64) {

    try {

        // Construct canonical payload exactly

        const canonical = JSON.stringify({
            deviceId: payloadObj.deviceId,
            expiresAt: payloadObj.expiresAt,
            issuedAt: payloadObj.issuedAt,
            lastOnlineCheck: payloadObj.lastOnlineCheck,
            licenseId: payloadObj.licenseId,
            licenseVersion: payloadObj.licenseVersion,
            offlineGraceUntil: payloadObj.offlineGraceUntil,
            plan: payloadObj.plan,
            status: payloadObj.status
        });



        const isVerified = crypto.verify(

            null,

            Buffer.from(canonical, 'utf8'),

            LICENSE_PUBLIC_KEY,

            Buffer.from(signatureBase64, 'base64')

        );

        return isVerified;

    } catch (e) {

        console.error("Signature verification error:", e);

        return false;

    }

}




ipcMain.on('get-license-info-sync', (event) => {
    try {
        const p = getLicensePath();
        if (!fs.existsSync(p)) {
            event.returnValue = { mode: 'DEMO', status: 'DEMO' };
            return;
        }
        if (!safeStorage.isEncryptionAvailable()) {
            event.returnValue = { mode: 'DEMO', status: 'NO_SECURE_STORAGE' };
            return;
        }

        const decrypted = safeStorage.decryptString(fs.readFileSync(p));
        const parsed = JSON.parse(decrypted);
        const { license, signature } = parsed;

        if (!verifyLicenseSignature(license, signature)) {
            event.returnValue = { mode: 'DEMO', status: 'INVALID_SIGNATURE' };
            return;
        }

        let deviceStatus = 'ACTIVE';
        if (license.deviceId !== machineIdCache) {
            deviceStatus = 'MISMATCH';
        }
        
        let mode = 'LICENSED';
        if (deviceStatus !== 'ACTIVE' || (license.status !== 'ACTIVE' && license.status !== 'TRIAL')) mode = 'DEMO';
        if (license.expiresAt) {
            const expiresAt = new Date(license.expiresAt);
            if (expiresAt < new Date()) {
                mode = 'DEMO';
                license.status = 'EXPIRED';
            }
        }

        event.returnValue = {
            mode: mode,
            status: license.status,
            plan: license.plan,
            expiresAt: license.expiresAt,
            deviceStatus: deviceStatus,
            lastOnlineCheck: license.lastOnlineCheck,
            offlineGraceUntil: license.offlineGraceUntil
        };
    } catch (e) {
        console.error('License info read error:', e);
        event.returnValue = { mode: 'DEMO', status: 'ERROR' };
    }
});

ipcMain.on('get-license-sync', (event) => {

    try {

        const p = getLicensePath();

        if (fs.existsSync(p)) {

            if (!safeStorage.isEncryptionAvailable()) {

                console.error("Secure license storage is unavailable on this device.");

                event.returnValue = null;

                return;

            }

            const decrypted = safeStorage.decryptString(fs.readFileSync(p));

            event.returnValue = JSON.parse(decrypted);

            return;

        }

    } catch (e) {

        console.error('License read error:', e);

    }

    event.returnValue = null;

});



ipcMain.on('save-license-sync', (event, responseData) => {

    try {

        // Must verify signature BEFORE saving

        const { license, signature, keyId } = responseData;

        if (!license || !signature) {

             throw new Error("Invalid response format");

        }



        if (!verifyLicenseSignature(license, signature)) {

             throw new Error("Cryptographic signature verification failed from server");

        }



        const dataToSave = JSON.stringify({ license, signature, keyId });

        const p = getLicensePath();



        if (!safeStorage.isEncryptionAvailable()) {

            throw new Error("Secure license storage is unavailable on this device.");

        }

        const encrypted = safeStorage.encryptString(dataToSave);

        fs.writeFileSync(p, encrypted);

        event.returnValue = { success: true };

    } catch (e) {

        console.error('License write error:', e);

        event.returnValue = { success: false, error: e.message };

    }

});



function checkLicense() {
    try {
        const p = getLicensePath();
        if (!fs.existsSync(p)) {
            const oldPath = path.join(app.getPath('userData'), 'license-state.json');
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            return 'DEMO';
        }

        if (!safeStorage.isEncryptionAvailable()) return 'DEMO';

        const decrypted = safeStorage.decryptString(fs.readFileSync(p));
        const parsed = JSON.parse(decrypted);
        const { license, signature } = parsed;

        if (!verifyLicenseSignature(license, signature)) return 'DEMO';
        if (license.deviceId !== machineIdCache) return 'DEMO';
        if (license.status !== 'ACTIVE' && license.status !== 'TRIAL') return 'DEMO';
        
        if (license.expiresAt) {
            const expiresAt = new Date(license.expiresAt);
            if (expiresAt < new Date()) return 'DEMO';
        }
        return 'LICENSED';
    } catch (e) {
        console.error('License check error:', e);
    }
    return 'DEMO';
}

// ---------------------------------------------





// --- Persistent Configuration for Database ---

const getConfigPath = () => path.join(app.getPath('userData'), 'config.json');



ipcMain.on('get-db-config-sync', (event) => {

    try {

        const p = getConfigPath();

        if (fs.existsSync(p)) {

            const data = JSON.parse(fs.readFileSync(p, 'utf-8'));

            event.returnValue = data.databaseFolder || null;

            return;

        }

    } catch (e) {

        console.error('Config read error:', e);

    }

    event.returnValue = null;

});



ipcMain.on('set-db-config-sync', (event, folderPath) => {

    try {

        const p = getConfigPath();

        let data = {};

        if (fs.existsSync(p)) {

            data = JSON.parse(fs.readFileSync(p, 'utf-8'));

        }

        data.databaseFolder = folderPath;

        fs.writeFileSync(p, JSON.stringify(data, null, 4), 'utf-8');

        event.returnValue = { success: true };

    } catch (e) {

        console.error('Config write error:', e);

        event.returnValue = { success: false, error: e.message };

    }

});



ipcMain.on('get-default-db-folder-sync', (event) => {

    try {

        event.returnValue = path.join(app.getPath('documents'), 'OneBook', 'Data');

    } catch (e) {

        event.returnValue = null;

    }

});



ipcMain.on('ensure-folder-sync', (event, folderPath) => {

    try {

        if (!fs.existsSync(folderPath)) {

            fs.mkdirSync(folderPath, { recursive: true });

        }

        event.returnValue = { success: true };

    } catch (error) {

        event.returnValue = { success: false, error: error.message };

    }

});



ipcMain.on('check-folder-has-data-sync', (event, folderPath) => {

    try {

        if (!fs.existsSync(folderPath)) {

            event.returnValue = false;

            return;

        }

        // Basic check if a crucial database file exists

        if (fs.existsSync(path.join(folderPath, 'settings.json')) || fs.existsSync(path.join(folderPath, 'products.json'))) {

            event.returnValue = true;

        } else {

            event.returnValue = false;

        }

    } catch (error) {

        event.returnValue = false;

    }

});

// ---------------------------------------------



ipcMain.on('focus-window', (event) => {

    const win = BrowserWindow.fromWebContents(event.sender);

    if (win) {

        win.focus();

    }

});



app.whenReady().then(() => {

    createWindow();



    app.on('activate', () => {

        if (BrowserWindow.getAllWindows().length === 0) {

            createWindow();

        }

    });

});



app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') {

        app.quit();

    }

});


// --- SQLITE IPC HANDLERS ---
const productService = require('./services/productService');
const salesService = require('./services/salesService');\nconst purchaseService = require('./services/purchaseService');
const supplierService = require('./services/supplierService');
const purchaseOrderService = require('./services/purchaseOrderService');
const paymentService = require('./services/paymentService');
const stockService = require('./services/stockService');
const customerService = require('./services/customerService');

// Error wrapping helper
async function handleSqlite(event, handlerFn) {
    try {
        const result = await handlerFn();
        return { success: true, data: result };
    } catch (e) {
        console.error('SQLite IPC Error:', e);
        // Map structured errors if present
        if (e.code) {
            return { success: false, error: { code: e.code, message: e.message } };
        }
        if (e.message && e.message.includes('Insufficient stock')) {
            return { success: false, error: { code: 'INSUFFICIENT_STOCK', message: e.message } };
        }
        return { success: false, error: { code: 'DATABASE_ERROR', message: 'The operation could not be completed.', technicalDetails: e.message } };
    }
}
}

// Products
ipcMain.handle('sqlite:products:getAll', (e) => handleSqlite(e, () => productService.getProducts()));
ipcMain.handle('sqlite:products:get', (e, id) => handleSqlite(e, () => productService.getProduct(id)));
ipcMain.handle('sqlite:products:create', (e, data) => handleSqlite(e, () => productService.createProduct(data)));
ipcMain.handle('sqlite:products:update', (e, id, data) => handleSqlite(e, () => productService.updateProduct(id, data)));
ipcMain.handle('sqlite:products:search', (e, q) => handleSqlite(e, () => productService.searchProducts(q)));
ipcMain.handle('sqlite:products:lowStock', (e) => handleSqlite(e, () => productService.getLowStockProducts()));

// Stock
ipcMain.handle('sqlite:stock:get', (e, pId) => handleSqlite(e, () => stockService.getCurrentStock(pId)));
ipcMain.handle('sqlite:stock:movements', (e, pId) => handleSqlite(e, () => stockService.getStockMovements(pId)));
ipcMain.handle('sqlite:stock:adjust', (e, productId, variantId, qty, reason, refType, refId) => handleSqlite(e, () => stockService.adjustStock(productId, variantId, qty, reason, refType, refId)));

// Customers
ipcMain.handle('sqlite:customers:getAll', (e) => handleSqlite(e, () => customerService.getCustomers()));
ipcMain.handle('sqlite:customers:get', (e, id) => handleSqlite(e, () => customerService.getCustomer(id)));
ipcMain.handle('sqlite:customers:create', (e, data) => handleSqlite(e, () => customerService.createCustomer(data)));
ipcMain.handle('sqlite:customers:update', (e, id, data) => handleSqlite(e, () => customerService.updateCustomer(id, data)));
ipcMain.handle('sqlite:customers:delete', (e, id) => handleSqlite(e, () => customerService.deleteCustomer(id)));
ipcMain.handle('sqlite:customers:search', (e, query) => handleSqlite(e, () => customerService.searchCustomers(query)));

// Sales
ipcMain.handle('sqlite:sales:create', (e, data) => handleSqlite(e, () => salesService.createSale(data)));
ipcMain.handle('sqlite:sales:getAll', (e, dateStr) => handleSqlite(e, () => salesService.getSales(dateStr)));
ipcMain.handle('sqlite:sales:search', (e, query) => handleSqlite(e, () => salesService.searchSales(query)));
ipcMain.handle('sqlite:sales:get', (e, id) => handleSqlite(e, () => salesService.getSaleById(id)));
ipcMain.handle('sqlite:sales:cancel', (e, id) => handleSqlite(e, () => salesService.cancelSale(id)));
// Note: sales.getAll and sales.get would need to be in salesService. Skipping for now if not implemented.
