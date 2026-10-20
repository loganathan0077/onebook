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




// --- SQLite Database Lifecycle Management ---
const dbManager = require('./database');

let sqliteStatus = {
    initialized: false,
    path: null,
    error: null,
    message: null
};

function resolveSqlitePath() {
    // Priority 1: CLI flag (--sqlite-path=...)
    for (const arg of process.argv) {
        if (arg.startsWith('--sqlite-path=')) {
            return arg.split('=')[1].trim();
        }
    }
    // Priority 2: Environment variable
    if (process.env.ONEBOOK_SQLITE_PATH && process.env.ONEBOOK_SQLITE_PATH.trim()) {
        return process.env.ONEBOOK_SQLITE_PATH.trim();
    }
    // Priority 3: config.json (sqliteDatabasePath)
    try {
        const p = getConfigPath();
        if (fs.existsSync(p)) {
            const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
            if (data.sqliteDatabasePath && typeof data.sqliteDatabasePath === 'string' && data.sqliteDatabasePath.trim()) {
                return data.sqliteDatabasePath.trim();
            }
        }
    } catch (e) {
        console.error('Error reading sqliteDatabasePath from config:', e);
    }
    return null;
}

function initSqliteAtStartup() {
    const targetPath = resolveSqlitePath();
    if (!targetPath) {
        sqliteStatus = {
            initialized: false,
            path: null,
            error: 'SQLITE_NOT_CONFIGURED',
            message: 'No SQLite database path is configured. Please select an existing database file.'
        };
        console.log('[SQLite Startup] No SQLite database configured.');
        return;
    }

    try {
        dbManager.initializeDatabase(targetPath, { allowCreate: false });
        sqliteStatus = {
            initialized: true,
            path: targetPath,
            error: null,
            message: null
        };
        console.log('[SQLite Startup] Successfully connected to SQLite database at:', targetPath);
    } catch (e) {
        sqliteStatus = {
            initialized: false,
            path: targetPath,
            error: e.code || 'DATABASE_INIT_ERROR',
            message: e.message
        };
        console.error('[SQLite Startup Error]:', e.message);
    }
}

app.whenReady().then(() => {
    initSqliteAtStartup();

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
const salesService = require('./services/salesService');
const purchaseService = require('./services/purchaseService');
const supplierService = require('./services/supplierService');
const purchaseOrderService = require('./services/purchaseOrderService');
const paymentService = require('./services/paymentService');
const cashBankService = require('./services/cashBankService');
const pettyCashService = require('./services/pettyCashService');
const dayClosingService = require('./services/dayClosingService');
const calculatorService = require('./services/calculatorService');
const reportService = require('./services/reportService');
const dashboardService = require('./services/dashboardService');
const stockService = require('./services/stockService');
const customerService = require('./services/customerService');
const categoryService = require('./services/categoryService');
const unitService = require('./services/unitService');
const userService = require('./services/userService');

// Error wrapping helper
async function handleSqlite(event, handlerFn) {
    try {
        const result = await handlerFn();
        return { success: true, data: result };
    } catch (e) {
        console.error('SQLite IPC Error:', e);
        if (e.code) {
            return { success: false, error: { code: e.code, message: e.message } };
        }
        if (e.message && e.message.includes('Insufficient stock')) {
            return { success: false, error: { code: 'INSUFFICIENT_STOCK', message: e.message } };
        }
        return { success: false, error: { code: 'DATABASE_ERROR', message: e.message || 'The operation could not be completed.' } };
    }
}

/**
 * Main-Process Authorized SQLite IPC Guard
 * Validates session token from request args against trusted SQLite user_sessions.
 * Never trusts renderer-provided roles, permissions, or user IDs.
 */
async function handleAuthorizedSqlite(event, sessionToken, requiredPermission, handlerFn) {
    try {
        if (!sqliteStatus.initialized || !dbManager.isDatabaseOpen()) {
            return { success: false, error: { code: 'DATABASE_NOT_INITIALIZED', message: 'Database is not initialized.' } };
        }

        if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.trim().length === 0) {
            return { success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required: Missing session token.' } };
        }

        // Validate session token strictly from trusted SQLite table
        const sessionUser = await userService.validateSession(sessionToken.trim());
        if (!sessionUser) {
            return { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid, expired, or revoked session.' } };
        }

        if (sessionUser.status !== 'active') {
            return { success: false, error: { code: 'USER_DISABLED', message: 'User account is disabled.' } };
        }

        // Administrator role bypasses specific feature permission checks
        const isAdmin = sessionUser.role === 'admin' || sessionUser.role === 'ADMIN';

        if (requiredPermission && requiredPermission !== 'authenticated') {
            if (!isAdmin) {
                if (requiredPermission === 'admin') {
                    return { success: false, error: { code: 'FORBIDDEN', message: 'Administrator privilege required.' } };
                }
                const userPerms = Array.isArray(sessionUser.permissions) ? sessionUser.permissions : [];
                if (!userPerms.includes(requiredPermission)) {
                    return { success: false, error: { code: 'FORBIDDEN', message: `Permission denied: Missing '${requiredPermission}' permission.` } };
                }
            }
        }

        // Invoke business operation with validated sessionUser context
        const result = await handlerFn(sessionUser);
        return { success: true, data: result };
    } catch (e) {
        console.error('Authorized SQLite IPC Error:', e);
        if (e.code) {
            return { success: false, error: { code: e.code, message: e.message } };
        }
        return { success: false, error: { code: 'DATABASE_ERROR', message: e.message || 'The operation could not be completed.' } };
    }
}


// System SQLite status and connection IPC
ipcMain.handle('sqlite:system:getStatus', () => {
    return {
        initialized: sqliteStatus.initialized,
        path: sqliteStatus.path,
        error: sqliteStatus.error,
        message: sqliteStatus.message || null
    };
});

// User Authentication & Management SQLite IPC
ipcMain.handle('sqlite:users:login', (e, args) => handleSqlite(e, () => userService.authenticate(args?.username, args?.password)));
ipcMain.handle('sqlite:users:logout', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'authenticated', () => userService.revokeSession(args?.sessionToken)));
ipcMain.handle('sqlite:users:validateSession', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'authenticated', (user) => user));
ipcMain.handle('sqlite:users:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => userService.getUsers()));
ipcMain.handle('sqlite:users:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => userService.createUser(args?.userData)));
ipcMain.handle('sqlite:users:update', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => userService.updateUser(args?.userId, args?.updateData)));
ipcMain.handle('sqlite:users:toggleStatus', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => userService.toggleUserStatus(args?.userId, args?.targetStatus)));
ipcMain.handle('sqlite:users:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => userService.deleteUser(args?.userId)));
ipcMain.handle('sqlite:users:changePassword', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'authenticated', (user) => {
    // Only admin can change other users passwords; non-admin can only change own password
    if (user.role !== 'admin' && user.role !== 'ADMIN' && user.userId !== args?.userId) {
        const err = new Error('Forbidden: Non-administrators can only change their own password.');
        err.code = 'FORBIDDEN';
        throw err;
    }
    return userService.changePassword(args?.userId, args?.newPassword);
}));

ipcMain.handle('sqlite:system:selectAndConnect', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select SQLite Database File',
        filters: [
            { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, error: 'SELECTION_CANCELLED' };
    }

    const chosenPath = filePaths[0];

    try {
        if (!dbManager.isDatabaseOpen()) {
            dbManager.initializeDatabase(chosenPath, { allowCreate: false });
        } else {
            return { success: false, error: 'ALREADY_CONNECTED', message: 'A database is already connected. Please restart the app to switch databases.' };
        }

        // Persist to config.json
        const p = getConfigPath();
        let data = {};
        if (fs.existsSync(p)) {
            data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        }
        data.sqliteDatabasePath = chosenPath;
        fs.writeFileSync(p, JSON.stringify(data, null, 4), 'utf-8');

        sqliteStatus = {
            initialized: true,
            path: chosenPath,
            error: null,
            message: null
        };

        return { success: true, path: chosenPath };
    } catch (e) {
        return { success: false, error: e.code || 'CONNECTION_FAILED', message: e.message };
    }
});

// Categories
ipcMain.handle('sqlite:categories:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => categoryService.getCategories()));
ipcMain.handle('sqlite:categories:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => categoryService.getCategory(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:categories:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => categoryService.createCategory(args?.name !== undefined ? args.name : args)));
ipcMain.handle('sqlite:categories:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const id = args?.id !== undefined ? args.id : args;
    const newName = args?.newName !== undefined ? args.newName : arg2;
    return categoryService.updateCategory(id, newName);
}));
ipcMain.handle('sqlite:categories:toggleStatus', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const id = args?.id !== undefined ? args.id : args;
    const active = args?.active !== undefined ? args.active : arg2;
    return categoryService.toggleCategoryStatus(id, active);
}));
ipcMain.handle('sqlite:categories:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => categoryService.deleteCategory(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:categories:migrate', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => categoryService.migrateCategories(args?.items !== undefined ? args.items : args)));

// Units
ipcMain.handle('sqlite:units:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => unitService.getUnits()));
ipcMain.handle('sqlite:units:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => unitService.getUnit(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:units:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => unitService.createUnit(args?.name !== undefined ? args.name : args)));
ipcMain.handle('sqlite:units:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const id = args?.id !== undefined ? args.id : args;
    const newName = args?.newName !== undefined ? args.newName : arg2;
    return unitService.updateUnit(id, newName);
}));
ipcMain.handle('sqlite:units:toggleStatus', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const id = args?.id !== undefined ? args.id : args;
    const active = args?.active !== undefined ? args.active : arg2;
    return unitService.toggleUnitStatus(id, active);
}));
ipcMain.handle('sqlite:units:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => unitService.deleteUnit(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:units:migrate', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => unitService.migrateUnits(args?.items !== undefined ? args.items : args)));

// Products
ipcMain.handle('sqlite:products:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => productService.getProducts()));
ipcMain.handle('sqlite:products:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => productService.getProduct(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:products:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'product_add_edit', () => productService.createProduct(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:products:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'product_add_edit', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return productService.updateProduct(id, data);
}));
ipcMain.handle('sqlite:products:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => productService.searchProducts(args?.q !== undefined ? args.q : args)));
ipcMain.handle('sqlite:products:lowStock', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => productService.getLowStockProducts()));

// Stock
ipcMain.handle('sqlite:stock:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => stockService.getCurrentStock(args?.pId !== undefined ? args.pId : args)));
ipcMain.handle('sqlite:stock:movements', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => stockService.getStockMovements(args?.pId !== undefined ? args.pId : args)));
ipcMain.handle('sqlite:stock:adjust', (e, args, ...rest) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => {
    if (args && typeof args === 'object' && args.productId !== undefined) {
        return stockService.adjustStock(args.productId, args.variantId, args.qty, args.reason, args.refType, args.refId);
    }
    return stockService.adjustStock(args, rest[0], rest[1], rest[2], rest[3], rest[4]);
}));

// Customers
ipcMain.handle('sqlite:customers:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => customerService.getCustomers()));
ipcMain.handle('sqlite:customers:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => customerService.getCustomer(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:customers:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => customerService.createCustomer(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:customers:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return customerService.updateCustomer(id, data);
}));
ipcMain.handle('sqlite:customers:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => customerService.deleteCustomer(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:customers:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => customerService.searchCustomers(args?.query !== undefined ? args.query : args)));

// Sales
ipcMain.handle('sqlite:sales:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => salesService.createSale(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:sales:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => salesService.getSales(args?.dateStr !== undefined ? args.dateStr : args)));
ipcMain.handle('sqlite:sales:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => salesService.searchSales(args?.query !== undefined ? args.query : args)));
ipcMain.handle('sqlite:sales:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => salesService.getSaleById(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:sales:cancel', (e, args, arg2) => {
    const sessionToken = args?.sessionToken || arg2;
    const saleId = (args && typeof args === 'object' && args.id !== undefined) ? args.id : (args?.saleId || args);
    return handleAuthorizedSqlite(e, sessionToken, 'delete', () => salesService.cancelSale(saleId));
});

// Purchases
ipcMain.handle('sqlite:purchases:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseService.createPurchase(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:purchases:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseService.getPurchases(args?.dateStr !== undefined ? args.dateStr : args)));
ipcMain.handle('sqlite:purchases:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseService.searchPurchases(args?.query !== undefined ? args.query : args)));
ipcMain.handle('sqlite:purchases:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseService.getPurchaseById(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:purchases:cancel', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => purchaseService.cancelPurchase(args?.id !== undefined ? args.id : args)));

// Suppliers
ipcMain.handle('sqlite:suppliers:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.getSuppliers()));
ipcMain.handle('sqlite:suppliers:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.getSupplier(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:suppliers:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.createSupplier(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:suppliers:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return supplierService.updateSupplier(id, data);
}));
ipcMain.handle('sqlite:suppliers:archive', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.archiveSupplier(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:suppliers:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.searchSuppliers(args?.query !== undefined ? args.query : args)));

// Purchase Orders
ipcMain.handle('sqlite:purchaseOrders:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseOrderService.createPO(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:purchaseOrders:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return purchaseOrderService.updatePO(id, data);
}));
ipcMain.handle('sqlite:purchaseOrders:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseOrderService.getPOs()));
ipcMain.handle('sqlite:purchaseOrders:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseOrderService.getPO(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:purchaseOrders:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseOrderService.searchPOs(args?.query !== undefined ? args.query : args)));
ipcMain.handle('sqlite:purchaseOrders:cancel', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => purchaseOrderService.cancelPO(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:purchaseOrders:receive', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseOrderService.receivePO(args?.id !== undefined ? args.id : args)));

// Payments
ipcMain.handle('sqlite:payments:getSalePayments', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => paymentService.getSalePayments(args?.saleId !== undefined ? args.saleId : args)));
ipcMain.handle('sqlite:payments:createSalePayment', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => paymentService.createSalePayment(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:payments:cancelSalePayment', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => paymentService.cancelSalePayment(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:payments:getPurchasePayments', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => paymentService.getPurchasePayments(args?.purchaseId !== undefined ? args.purchaseId : args)));
ipcMain.handle('sqlite:payments:createPurchasePayment', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => paymentService.createPurchasePayment(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:payments:cancelPurchasePayment', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => paymentService.cancelPurchasePayment(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:payments:getLedgerPayments', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => paymentService.getLedgerPayments()));
ipcMain.handle('sqlite:payments:createLedgerPayment', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => paymentService.createLedgerPayment(args?.data !== undefined ? args.data : args)));

// Cash & Bank
ipcMain.handle('sqlite:cashBank:getCashSummary', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => cashBankService.getCashSummary()));
ipcMain.handle('sqlite:cashBank:getBankSummary', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => cashBankService.getBankSummary()));
ipcMain.handle('sqlite:cashBank:getTransactions', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => {
    const accountType = args?.accountType !== undefined ? args.accountType : args;
    const filters = args?.filters !== undefined ? args.filters : arg2;
    return cashBankService.getTransactions(accountType, filters);
}));
ipcMain.handle('sqlite:cashBank:getTransaction', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => {
    const id = args?.id !== undefined ? args.id : args;
    const accountType = args?.accountType !== undefined ? args.accountType : arg2;
    return cashBankService.getTransaction(id, accountType);
}));
ipcMain.handle('sqlite:cashBank:createTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => cashBankService.createTransaction(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:cashBank:updateTransaction', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return cashBankService.updateTransaction(id, data);
}));
ipcMain.handle('sqlite:cashBank:cancelTransaction', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const id = args?.id !== undefined ? args.id : args;
    const accountType = args?.accountType !== undefined ? args.accountType : arg2;
    return cashBankService.cancelTransaction(id, accountType);
}));
ipcMain.handle('sqlite:cashBank:getOpeningBalance', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => cashBankService.getOpeningBalance(args?.accountType !== undefined ? args.accountType : args)));
ipcMain.handle('sqlite:cashBank:setOpeningBalance', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const accountType = args?.accountType !== undefined ? args.accountType : args;
    const amount = args?.amount !== undefined ? args.amount : arg2;
    return cashBankService.setOpeningBalance(accountType, amount);
}));
ipcMain.handle('sqlite:cashBank:transfer', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => cashBankService.transfer(args?.data !== undefined ? args.data : args)));

// Petty Cash
ipcMain.handle('sqlite:pettyCash:getSummary', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getSummary()));
ipcMain.handle('sqlite:pettyCash:getOpeningBalances', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getOpeningBalances()));
ipcMain.handle('sqlite:pettyCash:setOpeningBalances', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const cash = args?.cash !== undefined ? args.cash : args;
    const bank = args?.bank !== undefined ? args.bank : arg2;
    return pettyCashService.setOpeningBalances(cash, bank);
}));
ipcMain.handle('sqlite:pettyCash:getCategories', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getCategories()));
ipcMain.handle('sqlite:pettyCash:saveCategories', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => pettyCashService.saveCategories(args?.cats !== undefined ? args.cats : args)));
ipcMain.handle('sqlite:pettyCash:getTransactions', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getTransactions(args?.filters !== undefined ? args.filters : args)));
ipcMain.handle('sqlite:pettyCash:getTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getTransaction(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:pettyCash:createTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.createTransaction(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:pettyCash:updateTransaction', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return pettyCashService.updateTransaction(id, data);
}));
ipcMain.handle('sqlite:pettyCash:deleteTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => pettyCashService.deleteTransaction(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:pettyCash:cancelTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => pettyCashService.cancelTransaction(args?.id !== undefined ? args.id : args)));

// Day Closing
ipcMain.handle('sqlite:dayClosing:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'day_closing', () => dayClosingService.getAllClosings(args?.filters !== undefined ? args.filters : args)));
ipcMain.handle('sqlite:dayClosing:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'day_closing', () => dayClosingService.getClosing(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:dayClosing:getByDate', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'day_closing', () => dayClosingService.getClosingByDate(args?.dateStr !== undefined ? args.dateStr : args)));
ipcMain.handle('sqlite:dayClosing:save', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'day_closing', () => dayClosingService.saveClosing(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:dayClosing:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => dayClosingService.deleteClosing(args?.id !== undefined ? args.id : args)));

// Calculator
ipcMain.handle('sqlite:calculator:getHistory', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'calculator', () => calculatorService.getHistory()));
ipcMain.handle('sqlite:calculator:saveHistory', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'calculator', () => {
    const expression = args?.expression !== undefined ? args.expression : args;
    const result = args?.result !== undefined ? args.result : arg2;
    return calculatorService.saveHistory(expression, result);
}));
ipcMain.handle('sqlite:calculator:deleteHistory', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'calculator', () => calculatorService.deleteHistory(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:calculator:clearAllHistory', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'calculator', () => calculatorService.clearAllHistory()));

// Reports
ipcMain.handle('sqlite:reports:getReportSales', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => reportService.getReportSales(args?.filters !== undefined ? args.filters : args)));
ipcMain.handle('sqlite:reports:getSummary', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => reportService.getCustomReportSummary(args?.filters !== undefined ? args.filters : args)));

// Dashboard
ipcMain.handle('sqlite:dashboard:getMetrics', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'dashboard', () => dashboardService.getDashboardMetrics(args?.options !== undefined ? args.options : args)));
