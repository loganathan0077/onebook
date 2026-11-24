const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const os = require('os');
const updateService = require('./services/updateService');
const companyService = require('./services/companyService');
const settingsService = require('./services/settingsService');

// Enforce consistent application name across development and packaged builds
app.setName('OneBook');

let mainWindow = null;

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
    mainWindow = win;

    try {
        updateService.init(win);
    } catch (e) {
        console.warn('[MAIN] Update service init error:', e.message);
    }

    const mode = checkLicense();
    if (mode === 'DEMO') {
        win.loadFile(path.join(__dirname, 'license.html'));
    } else {
        win.webContents.session.clearCache();
        const activeComp = companyService.getActiveCompany();
        if (activeComp && activeComp.success && activeComp.company) {
            win.loadFile(path.join(__dirname, 'login.html'));
        } else {
            win.loadFile(path.join(__dirname, 'companyManager.html'));
        }
    }

    
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown') {
            const isR = input.key.toLowerCase() === 'r';
            const isCmdOrCtrl = Boolean(input.control || input.meta);
            if (isCmdOrCtrl && isR) {
                if (input.shift) {
                    win.webContents.reloadIgnoringCache();
                } else {
                    win.webContents.reload();
                }
                event.preventDefault();
                return;
            }
            if (input.key === 'F5') {
                win.webContents.reload();
                event.preventDefault();
                return;
            }
            if (input.key === 'F12') {
                win.webContents.reload();
                event.preventDefault();
                return;
            }
        }
    });

    win.on('close', () => {
        try {
            if (dbManager.isDatabaseOpen()) {
                const db = dbManager.getDatabase();
                db.prepare(`UPDATE user_sessions SET revoked = 1 WHERE revoked = 0`).run();
            }
        } catch (e) {}
    });

    win.maximize();
}

// Set up IPC handlers

ipcMain.handle('print-html', async (event, html, options = {}) => {
    return new Promise((resolve) => {
        let tempFile = null;
        try {
            const senderWin = BrowserWindow.fromWebContents(event.sender);
            const isLandscape = Boolean(options && options.landscape);
            const pageSize = (options && options.pageSize) ? options.pageSize : 'A4';
            const title = (options && options.title) ? options.title : 'Print Preview';

            tempFile = path.join(app.getPath('temp'), `onebook-print-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.html`);
            fs.writeFileSync(tempFile, html || '', 'utf8');

            const printWin = new BrowserWindow({
                width: isLandscape ? 1100 : 850,
                height: isLandscape ? 750 : 900,
                show: true,
                title: title,
                parent: senderWin || undefined,
                autoHideMenuBar: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            let finished = false;
            const cleanup = (res) => {
                if (!finished) {
                    finished = true;
                    try {
                        if (!printWin.isDestroyed()) printWin.close();
                    } catch (e) {}
                    try {
                        if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    } catch (e) {}
                    resolve(res);
                }
            };

            printWin.on('closed', () => {
                cleanup({ success: false, cancelled: true });
            });

            printWin.webContents.on('did-finish-load', () => {
                setTimeout(() => {
                    if (printWin.isDestroyed()) return cleanup({ success: false, error: 'Print window closed prematurely' });

                    const printOptions = {
                        silent: Boolean(options && options.silent),
                        printBackground: true,
                        landscape: isLandscape,
                        pageSize: pageSize
                    };

                    printWin.webContents.print(printOptions, (success, failureReason) => {
                        if (success) {
                            cleanup({ success: true });
                        } else {
                            if (failureReason === 'cancelled' || failureReason === 'Print job-canceled' || failureReason === 'canceled') {
                                cleanup({ success: false, cancelled: true });
                            } else {
                                cleanup({ success: false, error: failureReason || 'Print operation cancelled or failed' });
                            }
                        }
                    });
                }, 350);
            });

            printWin.webContents.on('did-fail-load', (e, code, desc) => {
                cleanup({ success: false, error: `Failed to load print document: ${desc}` });
            });

            printWin.loadFile(tempFile);
        } catch (err) {
            try {
                if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            } catch (e) {}
            resolve({ success: false, error: err.message || 'Error initializing printing window' });
        }
    });
});

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
        fs.mkdirSync(path.dirname(p), { recursive: true });
        let data = {};
        if (fs.existsSync(p)) {
            try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch(e){}
        }
        const cleanPath = (folderPath || '').trim().replace(/^["']|["']$/g, '');
        const dbPath = cleanPath.endsWith('.db') ? cleanPath : path.join(cleanPath, 'onebook.db');
        data.databaseFolder = cleanPath.endsWith('.db') ? path.dirname(cleanPath) : cleanPath;
        data.sqliteDatabasePath = dbPath;
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
const locationService = require('./services/locationService');
const dbManager = require('./database');

const backupService = require('./backupService');
const gdriveService = require('./gdriveService');


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
            const raw = arg.split('=')[1].trim().replace(/^["']|["']$/g, '');
            if (raw) return path.normalize(raw);
        }
    }
    // Priority 2: Environment variable
    if (process.env.ONEBOOK_SQLITE_PATH && process.env.ONEBOOK_SQLITE_PATH.trim()) {
        const raw = process.env.ONEBOOK_SQLITE_PATH.trim().replace(/^["']|["']$/g, '');
        if (raw) return path.normalize(raw);
    }
    // Priority 3: config.json (sqliteDatabasePath or databaseFolder)
    try {
        const p = getConfigPath();
        if (fs.existsSync(p)) {
            const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
            if (data.sqliteDatabasePath && typeof data.sqliteDatabasePath === 'string' && data.sqliteDatabasePath.trim()) {
                const sp = path.normalize(data.sqliteDatabasePath.trim().replace(/^["']|["']$/g, ''));
                return sp;
            }
            if (data.databaseFolder && typeof data.databaseFolder === 'string' && data.databaseFolder.trim()) {
                const df = path.normalize(data.databaseFolder.trim().replace(/^["']|["']$/g, ''));
                const cand = df.endsWith('.db') ? df : path.join(df, 'onebook.db');
                return cand;
            }
        }
    } catch (e) {
        console.error('Error reading sqliteDatabasePath from config:', e);
    }

    // Priority 4: Standard default database location (if already exists and non-empty)
    try {
        const defaultDb = path.normalize(path.join(app.getPath('documents'), 'OneBook', 'Database', 'onebook.db'));
        if (fs.existsSync(defaultDb)) {
            const stats = fs.statSync(defaultDb);
            if (stats.size > 0) {
                // Auto-persist to config so it is permanently recorded
                try {
                    const p = getConfigPath();
                    fs.mkdirSync(path.dirname(p), { recursive: true });
                    let data = {};
                    if (fs.existsSync(p)) {
                        try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch(e){}
                    }
                    data.databaseFolder = path.dirname(defaultDb);
                    data.sqliteDatabasePath = defaultDb;
                    fs.writeFileSync(p, JSON.stringify(data, null, 4), 'utf-8');
                } catch(e){}
                return defaultDb;
            }
        }
    } catch (e) {
        console.error('Error checking default database location:', e);
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

app.whenReady().then(async () => {
    companyService.setAppInstance(app);

    if (process.env.ONEBOOK_TEST_RUNNER === '1') {
        return;
    }

    // Check for explicit database or company passed via CLI or ENV
    const explicitArg = process.argv.find(a => a.startsWith('--sqlite-path=') || a.startsWith('--company-folder='));
    const explicitEnv = process.env.ONEBOOK_SQLITE_PATH;
    const explicitTarget = explicitArg ? explicitArg.split('=')[1].trim().replace(/^["']|["']$/g, '') : (explicitEnv ? explicitEnv.trim() : null);

    if (explicitTarget) {
        console.log('[OneBook Startup] Explicit database/company target provided:', explicitTarget);
        try {
            const openRes = await companyService.openCompany(explicitTarget);
            if (openRes && openRes.success) {
                sqliteStatus = {
                    initialized: true,
                    path: openRes.company.dbPath,
                    error: null,
                    message: null
                };
            }
        } catch (e) {
            console.error('[OneBook Startup] Failed to open explicit target:', e.message);
        }
    } else {
        // ISSUE 1: Automatically Open the Last Used Company
        const lastCompanyTarget = companyService.getLastOpenedCompanyTarget();
        if (lastCompanyTarget) {
            console.log('[OneBook Startup] Attempting to auto-load last opened company:', lastCompanyTarget);
            try {
                const openRes = await companyService.openCompany(lastCompanyTarget);
                if (openRes && openRes.success) {
                    sqliteStatus = {
                        initialized: true,
                        path: openRes.company.dbPath,
                        error: null,
                        message: null
                    };
                    console.log('[OneBook Startup] Successfully auto-loaded last company:', openRes.company.companyName || openRes.company.name);
                } else {
                    console.warn('[OneBook Startup] Last company could not be opened safely:', openRes?.error);
                }
            } catch (e) {
                console.warn('[OneBook Startup] Error auto-loading last company:', e.message);
            }
        }
    }

    backupService.init(
        path.join(app.getPath('documents'), 'OneBook', 'Database'),
        () => {
            const p = getConfigPath();
            return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
        },
        (updates) => {
            const p = getConfigPath();
            fs.mkdirSync(path.dirname(p), { recursive: true });
            let data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
            Object.assign(data, updates);
            fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
            return data;
        }
    );
    backupService.startAutoBackupScheduler();

    createWindow();



    app.on('activate', () => {

        if (BrowserWindow.getAllWindows().length === 0) {

            createWindow();

        }

    });

});

app.on('before-quit', () => {
    console.log('[OneBook App] Graceful shutdown executing (checkpoint WAL & close database)...');
    try {
        if (dbManager.isDatabaseOpen()) {
            try {
                const db = dbManager.getDatabase();
                db.prepare(`UPDATE user_sessions SET revoked = 1 WHERE revoked = 0`).run();
            } catch (e) {}
        }
        companyService.closeCurrentCompany();
    } catch (e) {
        console.warn('[OneBook App] Error during company cleanup on shutdown:', e.message);
    }
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
const ledgerService = require('./services/ledgerService');
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
async function handleAuthorizedSqlite(event, sessionToken, requiredPermission, handlerFn, options = {}) {
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

        const isDemo = Boolean(sessionUser.isDemo || sessionUser.id === 'demo_user' || sessionUser.username === 'demo');

        // Security: Block all mutating operations in Demo Mode at the SQLite IPC layer
        if (isDemo && options && options.isWrite) {
            return { success: false, error: { code: 'DEMO_RESTRICTED', message: 'Database modifications are disabled in Demo Mode. An active OneBook license is required.' } };
        }

        // Security: Block leaking licensed business records in Demo Mode
        if (isDemo && options && options.isDemoRestrictedRead) {
            return { success: true, data: options.demoReadDefault !== undefined ? options.demoReadDefault : [] };
        }

        // Administrator role bypasses specific feature permission checks (for non-demo licensed users)
        const isAdmin = !isDemo && (sessionUser.role === 'admin' || sessionUser.role === 'ADMIN');

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


// --- COMPANY & MULTI-DATABASE ARCHITECTURE IPC HANDLERS ---
ipcMain.handle('company:getRecent', async () => {
    return companyService.getRecentCompanies();
});

ipcMain.handle('company:getCompanies', async (event, dataDir) => {
    return companyService.getCompaniesInDataDirectory(dataDir);
});

ipcMain.handle('company:getDataDirectory', async () => {
    return { success: true, dataDirectory: companyService.getDataDirectory() };
});

ipcMain.handle('company:setDataDirectory', async (event, newPath) => {
    return companyService.setDataDirectory(newPath);
});

ipcMain.handle('company:selectFolder', async (event, options = {}) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const res = await dialog.showOpenDialog(parentWin, {
        title: options.title || 'Select Folder',
        defaultPath: options.defaultPath || companyService.getDataDirectory(),
        properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || !res.filePaths.length) {
        return { canceled: true, folderPath: null };
    }
    return { canceled: false, folderPath: res.filePaths[0] };
});

ipcMain.handle('company:selectBackupFile', async (event, options = {}) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const res = await dialog.showOpenDialog(parentWin, {
        title: options.title || 'Select Backup File',
        defaultPath: options.defaultPath,
        filters: [{ name: 'SQLite Database / Backup', extensions: ['db', 'sqlite', 'bak'] }],
        properties: ['openFile']
    });
    if (res.canceled || !res.filePaths.length) {
        return { canceled: true, filePath: null };
    }
    return { canceled: false, filePath: res.filePaths[0] };
});

ipcMain.handle('company:validate', async (event, folderOrDbPath) => {
    return companyService.validateCompanyDatabase(folderOrDbPath);
});

ipcMain.handle('company:create', async (event, data) => {
    return companyService.createCompany(data);
});

ipcMain.handle('company:open', async (event, folderOrDbPath) => {
    try {
        if (dbManager.isDatabaseOpen()) {
            try {
                const db = dbManager.getDatabase();
                db.prepare(`UPDATE user_sessions SET revoked = 1 WHERE revoked = 0`).run();
            } catch (e) {}
        }
    } catch (e) {}
    const result = await companyService.openCompany(folderOrDbPath);
    if (result && result.success && result.company) {
        sqliteStatus = {
            initialized: true,
            path: result.company.dbPath || result.dbPath,
            error: null,
            message: null
        };
        const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
        if (win && !win.isDestroyed()) {
            await win.webContents.executeJavaScript(`
                try {
                    sessionStorage.removeItem('onebook_session_token');
                    sessionStorage.removeItem('currentUser');
                    if (window.electronAPI && window.electronAPI.sqlite && window.electronAPI.sqlite.clearSessionToken) {
                        window.electronAPI.sqlite.clearSessionToken();
                    }
                } catch (e) {}
            `).catch(() => {});
            win.loadFile(path.join(__dirname, 'login.html'));
        }
    }
    return result;
});

ipcMain.handle('company:close', async () => {
    try {
        if (dbManager.isDatabaseOpen()) {
            try {
                const db = dbManager.getDatabase();
                db.prepare(`UPDATE user_sessions SET revoked = 1 WHERE revoked = 0`).run();
            } catch (e) {}
        }
    } catch (e) {}
    return companyService.closeCurrentCompany();
});

ipcMain.handle('company:getActive', async () => {
    return companyService.getActiveCompany();
});

ipcMain.handle('company:removeFromRecent', async (event, companyId) => {
    return companyService.removeFromRecentCompanies(companyId);
});

ipcMain.handle('company:restoreBackup', async (event, data) => {
    return companyService.restoreCompanyBackup(data);
});

ipcMain.handle('company:getHealth', async (event, folderOrDbPath) => {
    return companyService.getCompanyHealth(folderOrDbPath);
});

ipcMain.handle('company:openFolder', async (event, folderPath) => {
    try {
        if (folderPath && fs.existsSync(folderPath)) {
            shell.openPath(folderPath);
            return { success: true };
        }
        return { success: false, error: 'FOLDER_NOT_FOUND', message: 'Folder does not exist on disk' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('company:switchCompany', async (event) => {
    try {
        if (dbManager.isDatabaseOpen()) {
            try {
                const db = dbManager.getDatabase();
                db.prepare(`UPDATE user_sessions SET revoked = 1 WHERE revoked = 0`).run();
            } catch (e) {}
        }
        const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
        if (win && !win.isDestroyed()) {
            await win.webContents.executeJavaScript(`
                try {
                    sessionStorage.removeItem('onebook_session_token');
                    sessionStorage.removeItem('currentUser');
                    if (window.electronAPI && window.electronAPI.sqlite && window.electronAPI.sqlite.clearSessionToken) {
                        window.electronAPI.sqlite.clearSessionToken();
                    }
                } catch (e) {}
            `).catch(() => {});
        }
    } catch (e) {}
    companyService.closeCurrentCompany();
    sqliteStatus = {
        initialized: false,
        path: null,
        error: 'NO_COMPANY_SELECTED',
        message: 'No active company database loaded'
    };
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win && !win.isDestroyed()) {
        win.loadFile(path.join(__dirname, 'companyManager.html'));
    }
    return { success: true };
});

// Company-Specific Settings & Business Profile SQLite IPC
ipcMain.handle('sqlite:settings:getAll', () => handleSqlite(null, () => settingsService.getAllSettings()));
ipcMain.handle('sqlite:settings:get', (e, key) => handleSqlite(e, () => settingsService.getSetting(key)));
ipcMain.handle('sqlite:settings:save', (e, args) => handleSqlite(e, () => settingsService.saveSetting(args?.key, args?.value)));
ipcMain.handle('sqlite:settings:saveAll', (e, args) => handleSqlite(e, () => settingsService.saveAllSettings(args)));
ipcMain.handle('sqlite:settings:getBusinessProfile', () => handleSqlite(null, () => settingsService.getBusinessProfile()));
ipcMain.handle('sqlite:settings:saveBusinessProfile', (e, args) => handleSqlite(e, () => settingsService.saveBusinessProfile(args)));

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

function maskUsername(u) {
    if (!u || typeof u !== 'string') return '';
    if (u.includes('@')) {
        const [name, domain] = u.split('@');
        const visible = name.length > 2 ? name.slice(0, 2) : name.slice(0, 1);
        return `${visible}***@${domain}`;
    }
    const visible = u.length > 2 ? u.slice(0, 2) : u.slice(0, 1);
    return `${visible}***`;
}

// Secure Admin Account & Password Recovery IPC Handlers
ipcMain.handle('auth:checkAdminStatus', async () => {
    try {
        const hasAdmin = userService.hasConfiguredAdmin();
        const configuredAdmin = hasAdmin ? userService.getConfiguredAdmin() : null;
        const mode = checkLicense();
        return {
            success: true,
            hasAdmin,
            mode,
            isLicensed: mode === 'LICENSED',
            deviceId: machineIdCache,
            configuredUsername: configuredAdmin ? maskUsername(configuredAdmin.username) : null
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('auth:verifyLicenseForSetup', async (event, licenseKey) => {
    try {
        const cleanKey = (licenseKey || '').trim().toUpperCase();
        if (!cleanKey) {
            return { success: false, error: 'Please enter a valid licence key.' };
        }

        // Check local license first
        let activeLicense = null;
        const p = getLicensePath();
        if (fs.existsSync(p) && safeStorage.isEncryptionAvailable()) {
            try {
                const decrypted = safeStorage.decryptString(fs.readFileSync(p));
                const parsed = JSON.parse(decrypted);
                if (verifyLicenseSignature(parsed.license, parsed.signature) && parsed.license.deviceId === machineIdCache) {
                    if (parsed.license.licenseKey === cleanKey || (parsed.license.licenseId && cleanKey.includes(parsed.license.licenseId))) {
                        activeLicense = parsed.license;
                    }
                }
            } catch (err) {
                console.warn('[AUTH SETUP] Error reading local license:', err);
            }
        }

        // If not found locally, call activate-license
        if (!activeLicense) {
            const response = await fetch('https://sqibniuqbkgexipynfkx.supabase.co/functions/v1/activate-license', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licenseKey: cleanKey,
                    deviceId: machineIdCache,
                    deviceName: 'OneBook POS',
                    operatingSystem: process.platform,
                    appVersion: '1.0.0'
                })
            });

            const data = await response.json();
            if (!data.success) {
                return { success: false, error: data.error || 'Licence activation failed.' };
            }

            if (!verifyLicenseSignature(data.license, data.signature)) {
                return { success: false, error: 'Cryptographic signature verification failed from server.' };
            }

            const dataToSave = JSON.stringify({ license: data.license, signature: data.signature, keyId: data.keyId });
            const encrypted = safeStorage.encryptString(dataToSave);
            fs.writeFileSync(p, encrypted);
            activeLicense = data.license;
        }

        const hasAdmin = userService.hasConfiguredAdmin();
        const configuredAdmin = hasAdmin ? userService.getConfiguredAdmin() : null;

        return {
            success: true,
            licenseId: activeLicense.licenseId,
            eligible: !hasAdmin,
            alreadyConfigured: hasAdmin,
            maskedUser: configuredAdmin ? maskUsername(configuredAdmin.username) : null
        };
    } catch (e) {
        console.error('[AUTH SETUP] License verify error:', e);
        return { success: false, error: e.message || 'Licence verification failed.' };
    }
});

ipcMain.handle('auth:createAdminAccount', async (event, args) => {
    try {
        const { username, password, licenseId } = args || {};
        if (!username || !password || !licenseId) {
            return { success: false, error: 'Username, password, and licence ID are required.' };
        }

        const p = getLicensePath();
        if (!fs.existsSync(p) || !safeStorage.isEncryptionAvailable()) {
            return { success: false, error: 'No validated licence found on this device.' };
        }

        const decrypted = safeStorage.decryptString(fs.readFileSync(p));
        const parsed = JSON.parse(decrypted);
        if (!verifyLicenseSignature(parsed.license, parsed.signature) || parsed.license.deviceId !== machineIdCache) {
            return { success: false, error: 'Licence verification failed: Device mismatch or invalid signature.' };
        }

        if (parsed.license.licenseId !== licenseId) {
            return { success: false, error: 'Licence ID mismatch.' };
        }

        const res = await userService.createAdminAccount({
            username,
            password,
            licenseId,
            deviceId: machineIdCache
        });

        return { success: true, username: res.username };
    } catch (e) {
        console.error('[AUTH SETUP] Create admin error:', e);
        return { success: false, error: e.message || 'Failed to create admin account.' };
    }
});

ipcMain.handle('auth:resetAdminPassword', async (event, args) => {
    try {
        const { licenseId, recoveryCode, newPassword } = args || {};
        if (!recoveryCode || !newPassword) {
            return { success: false, error: 'Backup Key and new password are required.' };
        }

        const admin = userService.getConfiguredAdmin();
        if (!admin) {
            return { success: false, error: 'No configured Admin account found.' };
        }

        let activeLicenseId = licenseId || admin.license_id;

        const p = getLicensePath();
        if (fs.existsSync(p) && safeStorage.isEncryptionAvailable()) {
            try {
                const decrypted = safeStorage.decryptString(fs.readFileSync(p));
                const parsed = JSON.parse(decrypted);
                if (verifyLicenseSignature(parsed.license, parsed.signature) && parsed.license.deviceId === machineIdCache) {
                    if (licenseId && parsed.license.licenseId !== licenseId) {
                        return { success: false, error: 'Licence ID mismatch.' };
                    }
                    activeLicenseId = parsed.license.licenseId;
                }
            } catch (err) {
                console.warn('[AUTH] Error reading local license for reset:', err);
            }
        }

        const res = await userService.resetAdminPasswordWithRecovery({
            licenseId: activeLicenseId,
            deviceId: machineIdCache,
            recoveryCode,
            newPassword
        });

        return { success: true, username: res.username };
    } catch (e) {
        console.error('[AUTH SETUP] Reset admin password error:', e);
        return { success: false, error: e.message || 'Password reset failed.' };
    }
});

ipcMain.handle('auth:demoLogin', async () => {
    try {
        const res = await userService.loginDemo();
        return { success: true, user: res.user, sessionToken: res.sessionToken };
    } catch (e) {
        console.error('[AUTH DEMO] Demo login error:', e);
        return { success: false, error: e.message || 'Demo login failed.' };
    }
});

// Auto-Updater IPC Handlers
ipcMain.handle('updater:getVersion', () => {
    try {
        return app.getVersion();
    } catch (e) {
        return '1.0.6';
    }
});
ipcMain.handle('updater:getStatus', () => updateService.getStatus());
ipcMain.handle('updater:check', async () => {
    try {
        return await updateService.checkForUpdates();
    } catch (e) {
        return { success: false, error: e.message || 'Failed to check for updates' };
    }
});
ipcMain.handle('updater:download', async () => {
    try {
        return await updateService.downloadUpdate();
    } catch (e) {
        return { success: false, error: e.message || 'Failed to download update' };
    }
});
ipcMain.handle('updater:install', () => {
    try {
        return updateService.quitAndInstall();
    } catch (e) {
        return { success: false, error: e.message || 'Failed to install update' };
    }
});

// Helper to get database details (path, filename, size, status)
function getDatabaseDetailsHelper() {
    const configuredPath = resolveSqlitePath();
    const isConn = dbManager.isDatabaseOpen();
    const activePath = isConn ? dbManager.getDatabasePath() : configuredPath;

    let exists = false;
    let sizeBytes = 0;
    let folder = null;
    let filename = 'onebook.db';

    if (activePath) {
        filename = path.basename(activePath);
        folder = path.dirname(activePath);
        try {
            if (fs.existsSync(activePath)) {
                exists = true;
                const stats = fs.statSync(activePath);
                sizeBytes = stats.size;
            }
        } catch (e) {
            console.warn('[SQLite Details Error]:', e.message);
        }
    }

    return {
        configured: !!configuredPath,
        connected: isConn,
        path: activePath,
        folder: folder,
        filename: filename,
        exists: exists,
        sizeBytes: sizeBytes,
        sizeFormatted: exists ? (sizeBytes > 1048576 ? (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB' : (sizeBytes / 1024).toFixed(1) + ' KB') : '0 KB',
        error: sqliteStatus.error,
        message: sqliteStatus.message
    };
}

ipcMain.handle('sqlite:system:getDatabaseDetails', () => {
    return getDatabaseDetailsHelper();
});

ipcMain.handle('sqlite:system:getDefaultDbFolder', () => {
    return path.join(app.getPath('documents'), 'OneBook', 'Database');
});

ipcMain.handle('sqlite:system:selectFolder', async (event, options = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: options.title || 'Select Database Folder or File',
        defaultPath: options.defaultPath || path.join(app.getPath('documents'), 'OneBook', 'Database'),
        properties: ['openDirectory', 'openFile', 'createDirectory'],
        filters: [
            { name: 'SQLite Database / All Files', extensions: ['db', 'sqlite', 'sqlite3', '*'] }
        ]
    });

    if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, error: 'SELECTION_CANCELLED' };
    }
    return { success: true, folderPath: filePaths[0] };
});

ipcMain.handle('sqlite:system:openDatabaseFolder', async () => {
    try {
        const details = getDatabaseDetailsHelper();
        if (details.folder && fs.existsSync(details.folder)) {
            shell.openPath(details.folder);
            return { success: true };
        } else {
            return { success: false, error: 'FOLDER_NOT_FOUND', message: 'Database folder does not exist: ' + (details.folder || 'None') };
        }
    } catch (e) {
        return { success: false, error: 'OPEN_FAILED', message: e.message };
    }
});

ipcMain.handle('sqlite:system:initializeDatabaseLocation', async (event, args) => {
    const targetFolder = args?.folderPath;
    if (!targetFolder || typeof targetFolder !== 'string') {
        return { success: false, error: 'INVALID_FOLDER', message: 'Target folder must be specified.' };
    }

    try {
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        const targetDbPath = path.join(targetFolder, 'onebook.db');
        const dbExists = fs.existsSync(targetDbPath);

        // Close any currently open database first
        if (dbManager.isDatabaseOpen()) {
            dbManager.closeDatabase();
        }

        // Initialize (allow creation if brand new setup)
        dbManager.initializeDatabase(targetDbPath, { allowCreate: true });

        // Save persistent config
        const p = getConfigPath();
        fs.mkdirSync(path.dirname(p), { recursive: true });
        let data = {};
        if (fs.existsSync(p)) {
            try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch(e){}
        }
        data.databaseFolder = targetFolder;
        data.sqliteDatabasePath = targetDbPath;
        fs.writeFileSync(p, JSON.stringify(data, null, 4), 'utf-8');

        sqliteStatus = {
            initialized: true,
            path: targetDbPath,
            error: null,
            message: null
        };

        console.log('[SQLite Setup] Database successfully initialized at:', targetDbPath);
        return {
            success: true,
            dbPath: targetDbPath,
            isNew: !dbExists,
            details: getDatabaseDetailsHelper()
        };
    } catch (e) {
        console.error('[SQLite Setup Error]:', e);
        sqliteStatus = {
            initialized: false,
            path: targetFolder ? path.join(targetFolder, 'onebook.db') : null,
            error: e.code || 'INIT_FAILED',
            message: e.message
        };
        return { success: false, error: e.code || 'INIT_FAILED', message: e.message };
    }
});

ipcMain.handle('sqlite:system:changeDatabaseLocation', async (event, args) => {
    const rawTarget = args?.folderPath;
    const forceOverwrite = !!args?.forceOverwrite;
    const skipBackup = !!args?.skipBackup;

    if (!rawTarget || typeof rawTarget !== 'string') {
        return { success: false, error: 'INVALID_DESTINATION', message: 'Destination must be specified.' };
    }

    const currentDetails = getDatabaseDetailsHelper();
    const oldDbPath = currentDetails.path;

    if (!oldDbPath || !fs.existsSync(oldDbPath)) {
        return { success: false, error: 'NO_SOURCE_DATABASE', message: 'No current SQLite database found to migrate or switch from.' };
    }

    // Determine targetDbPath and targetFolder (supports directory or direct .db file)
    const isDbFile = rawTarget.endsWith('.db') || rawTarget.endsWith('.sqlite') || rawTarget.endsWith('.sqlite3') || (fs.existsSync(rawTarget) && fs.statSync(rawTarget).isFile());
    
    let targetDbPath = null;
    let targetFolder = null;

    if (isDbFile) {
        targetDbPath = path.normalize(rawTarget);
        targetFolder = path.dirname(targetDbPath);
    } else {
        targetFolder = path.normalize(rawTarget);
        const defaultInFolder = path.join(targetFolder, 'onebook.db');
        if (fs.existsSync(defaultInFolder)) {
            targetDbPath = defaultInFolder;
        } else {
            // Check if there is another .db file in this folder
            let candidateDb = null;
            try {
                if (fs.existsSync(targetFolder)) {
                    const files = fs.readdirSync(targetFolder).filter(f => f.endsWith('.db') && !f.startsWith('.'));
                    if (files.length === 1) {
                        candidateDb = path.join(targetFolder, files[0]);
                    }
                }
            } catch(e){}
            targetDbPath = candidateDb || defaultInFolder;
        }
    }

    if (path.resolve(oldDbPath) === path.resolve(targetDbPath)) {
        return { success: false, error: 'SAME_LOCATION', message: 'The selected folder/file is already the current active database location.' };
    }

    // CASE 1: Target database already exists — Switch to it directly without overwriting!
    if (fs.existsSync(targetDbPath)) {
        console.log('[Database Switch] Target database already exists at:', targetDbPath, '. Validating and connecting...');
        
        // Step 1A: Validate SQLite integrity before switching
        const Database = require('better-sqlite3');
        let checkDb = null;
        try {
            checkDb = new Database(targetDbPath, { readonly: true });
            const integrity = checkDb.pragma('integrity_check');
            const integrityOk = integrity && integrity.length > 0 && integrity[0].integrity_check === 'ok';
            checkDb.close();
            if (!integrityOk) {
                return { success: false, error: 'TARGET_CORRUPT', message: 'Target database failed integrity check: ' + JSON.stringify(integrity) };
            }
        } catch (checkErr) {
            if (checkDb) { try { checkDb.close(); } catch(e){} }
            return { success: false, error: 'TARGET_INVALID', message: 'Cannot open target file as a valid SQLite database: ' + checkErr.message };
        }

        // Step 1B: Create safety backup of the currently active database before switching
        let safetyBackupFile = null;
        if (!skipBackup) {
            try {
                const backupRes = await backupService.createBackup('pre_switch_safety', 'PreSwitch_SafetyBackup');
                if (backupRes && backupRes.success) {
                    safetyBackupFile = backupRes.metadata?.filePath;
                    console.log('[Database Switch] Safety backup of previous DB created at:', safetyBackupFile);
                }
            } catch (bErr) {
                console.warn('[Database Switch] Safety backup warning:', bErr.message);
            }
        }

        // Step 1C: Safely close active connection
        if (dbManager.isDatabaseOpen()) {
            dbManager.closeDatabase();
        }

        // Step 1D: Open the target database
        try {
            dbManager.initializeDatabase(targetDbPath, { allowCreate: false });
        } catch (openErr) {
            console.error('[Database Switch Error]: Could not open target database:', openErr);
            // Rollback to old database
            if (fs.existsSync(oldDbPath)) {
                try { dbManager.initializeDatabase(oldDbPath, { allowCreate: false }); } catch(e){}
            }
            return { success: false, error: 'SWITCH_FAILED', message: 'Failed to connect to target database: ' + openErr.message };
        }

        // Step 1E: Update persistent config
        const p = getConfigPath();
        fs.mkdirSync(path.dirname(p), { recursive: true });
        let data = {};
        if (fs.existsSync(p)) {
            try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch(e){}
        }
        data.databaseFolder = targetFolder;
        data.sqliteDatabasePath = targetDbPath;
        fs.writeFileSync(p, JSON.stringify(data, null, 4), 'utf-8');

        sqliteStatus = {
            initialized: true,
            path: targetDbPath,
            error: null,
            message: null
        };

        console.log('[Database Switch] Successfully connected to existing database at:', targetDbPath);
        return {
            success: true,
            newPath: targetDbPath,
            oldPath: oldDbPath,
            safetyBackup: safetyBackupFile,
            switchedToExisting: true,
            details: getDatabaseDetailsHelper()
        };
    }

    // CASE 2: Target database does not exist — Safe migration/copy of current database to new location
    try {
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }
    } catch (err) {
        return { success: false, error: 'DEST_DIR_CREATE_FAILED', message: 'Could not create destination directory: ' + err.message };
    }

    console.log('[Database Migration] Starting migration from:', oldDbPath, 'to:', targetDbPath, '(skipBackup:', skipBackup, ')');

    // Step 2A: Create a safety backup of current database unless explicitly skipped
    let safetyBackupFile = null;
    if (!skipBackup) {
        try {
            const backupRes = await backupService.createBackup('pre_migration_safety', 'PreMigration_SafetyBackup');
            if (backupRes && backupRes.success) {
                safetyBackupFile = backupRes.metadata?.filePath;
                console.log('[Database Migration] Safety backup created at:', safetyBackupFile);
            }
        } catch (bErr) {
            console.warn('[Database Migration] Safety backup warning:', bErr.message);
        }
    }

    // Step 2B: Checkpoint WAL and copy to target using better-sqlite3 backup API or safe copy
    const tempCopyPath = targetDbPath + '.migrating_' + Date.now();
    try {
        if (dbManager.isDatabaseOpen()) {
            const activeDb = dbManager.getDatabase();
            try {
                activeDb.pragma('wal_checkpoint(TRUNCATE)');
            } catch (walErr) {
                console.warn('[Database Migration] WAL checkpoint warning:', walErr.message);
            }
            // Use SQLite backup API for zero-corruption copy
            await activeDb.backup(tempCopyPath);
        } else {
            // Direct file copy
            fs.copyFileSync(oldDbPath, tempCopyPath);
        }

        // Step 2C: Validate the copied database using integrity checks
        const Database = require('better-sqlite3');
        const vDb = new Database(tempCopyPath, { readonly: true });
        const integrity = vDb.pragma('integrity_check');
        vDb.close();

        const integrityOk = integrity && integrity.length > 0 && integrity[0].integrity_check === 'ok';
        if (!integrityOk) {
            if (fs.existsSync(tempCopyPath)) fs.unlinkSync(tempCopyPath);
            throw new Error('Integrity check failed on copied database: ' + JSON.stringify(integrity));
        }

        // Step 2D: Safely close active connection
        if (dbManager.isDatabaseOpen()) {
            dbManager.closeDatabase();
        }

        fs.renameSync(tempCopyPath, targetDbPath);

        // Step 2E: Update persistent config
        const p = getConfigPath();
        fs.mkdirSync(path.dirname(p), { recursive: true });
        let data = {};
        if (fs.existsSync(p)) {
            try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch(e){}
        }
        data.databaseFolder = targetFolder;
        data.sqliteDatabasePath = targetDbPath;
        fs.writeFileSync(p, JSON.stringify(data, null, 4), 'utf-8');

        // Step 2F: Reopen database from new location
        dbManager.initializeDatabase(targetDbPath, { allowCreate: false });

        sqliteStatus = {
            initialized: true,
            path: targetDbPath,
            error: null,
            message: null
        };

        console.log('[Database Migration] Successfully migrated and reopened database at:', targetDbPath);
        return {
            success: true,
            newPath: targetDbPath,
            oldPath: oldDbPath,
            safetyBackup: safetyBackupFile,
            switchedToExisting: false,
            details: getDatabaseDetailsHelper()
        };

    } catch (migrationErr) {
        console.error('[Database Migration Failed]:', migrationErr);
        // Clean up temp copy
        if (fs.existsSync(tempCopyPath)) {
            try { fs.unlinkSync(tempCopyPath); } catch(e){}
        }

        // Rollback: Reopen old database to ensure app remains functional
        try {
            if (!dbManager.isDatabaseOpen() && fs.existsSync(oldDbPath)) {
                dbManager.initializeDatabase(oldDbPath, { allowCreate: false });
                sqliteStatus = {
                    initialized: true,
                    path: oldDbPath,
                    error: null,
                    message: null
                };
                console.log('[Database Migration Rollback] Successfully rolled back to:', oldDbPath);
            }
        } catch (rollbackErr) {
            console.error('[Database Migration Rollback Error]:', rollbackErr);
        }

        return {
            success: false,
            error: 'MIGRATION_FAILED',
            message: migrationErr.message,
            originalPath: oldDbPath
        };
    }
});

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
        if (dbManager.isDatabaseOpen()) {
            dbManager.closeDatabase();
        }
        dbManager.initializeDatabase(chosenPath, { allowCreate: false });

        // Persist to config.json
        const p = getConfigPath();
        fs.mkdirSync(path.dirname(p), { recursive: true });
        let data = {};
        if (fs.existsSync(p)) {
            try { data = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch(e){}
        }
        data.databaseFolder = path.dirname(chosenPath);
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
ipcMain.handle('sqlite:products:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => productService.getProducts(), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:products:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => productService.getProduct(args?.id !== undefined ? args.id : args), { isDemoRestrictedRead: true, demoReadDefault: null }));
ipcMain.handle('sqlite:products:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'product_add_edit', () => productService.createProduct(args?.data !== undefined ? args.data : args), { isWrite: true }));
ipcMain.handle('sqlite:products:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'product_add_edit', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return productService.updateProduct(id, data);
}, { isWrite: true }));
ipcMain.handle('sqlite:products:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => productService.searchProducts(args?.q !== undefined ? args.q : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:products:lowStock', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'products', () => productService.getLowStockProducts(), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:products:addVariant', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'product_add_edit', () => {
    const productId = args?.productId !== undefined ? args.productId : args;
    const variant = args?.variant !== undefined ? args.variant : arg2;
    return productService.addVariant(productId, variant);
}, { isWrite: true }));
ipcMain.handle('sqlite:products:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => {
    const id = args?.id !== undefined ? args.id : args;
    return productService.deleteProduct(id);
}, { isWrite: true }));
ipcMain.handle('sqlite:products:deleteVariant', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => {
    const variantId = args?.variantId !== undefined ? args.variantId : (args?.id !== undefined ? args.id : args);
    const productId = args?.productId !== undefined ? args.productId : arg2;
    return productService.deleteVariant(variantId, productId);
}, { isWrite: true }));
ipcMain.handle('sqlite:products:updateGstRate', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'product_add_edit', () => {
    const productId = args?.productId !== undefined ? args.productId : args;
    const gstRate = args?.gstRate !== undefined ? args.gstRate : arg2;
    return productService.updateProductGstRate(productId, gstRate);
}, { isWrite: true }));
ipcMain.handle('sqlite:products:updateVariantGstRate', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'product_add_edit', () => {
    const variantId = args?.variantId !== undefined ? args.variantId : args;
    const gstRate = args?.gstRate !== undefined ? args.gstRate : arg2;
    return productService.updateVariantGstRate(variantId, gstRate);
}, { isWrite: true }));

// Stock
ipcMain.handle('sqlite:stock:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => stockService.getCurrentStock(args?.pId !== undefined ? args.pId : args), { isDemoRestrictedRead: true, demoReadDefault: 0 }));
ipcMain.handle('sqlite:stock:movements', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => stockService.getStockMovements(args?.pId !== undefined ? args.pId : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:stock:adjust', (e, args, ...rest) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => {
    if (args && typeof args === 'object' && args.productId !== undefined) {
        return stockService.adjustStock(args.productId, args.variantId, args.qty, args.reason, args.refType, args.refId, args.date, args.locationId);
    }
    return stockService.adjustStock(args, rest[0], rest[1], rest[2], rest[3], rest[4], rest[5], rest[6]);
}, { isWrite: true }));

// Customers
ipcMain.handle('sqlite:customers:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => customerService.getCustomers(), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:customers:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => customerService.getCustomer(args?.id !== undefined ? args.id : args), { isDemoRestrictedRead: true, demoReadDefault: null }));
ipcMain.handle('sqlite:customers:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => customerService.createCustomer(args?.data !== undefined ? args.data : args), { isWrite: true }));
ipcMain.handle('sqlite:customers:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return customerService.updateCustomer(id, data);
}, { isWrite: true }));
ipcMain.handle('sqlite:customers:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => customerService.deleteCustomer(args?.id !== undefined ? args.id : args), { isWrite: true }));
ipcMain.handle('sqlite:customers:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => customerService.searchCustomers(args?.query !== undefined ? args.query : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));

// Sales
ipcMain.handle('sqlite:sales:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => salesService.createSale(args?.data !== undefined ? args.data : args), { isWrite: true }));
ipcMain.handle('sqlite:sales:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => salesService.getSales(args?.dateStr !== undefined ? args.dateStr : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:sales:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => salesService.searchSales(args?.query !== undefined ? args.query : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:sales:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => salesService.getSaleById(args?.id !== undefined ? args.id : args), { isDemoRestrictedRead: true, demoReadDefault: null }));
ipcMain.handle('sqlite:sales:getNextReceiptNumber', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', (user) => {
    if (user && (user.isDemo || user.id === 'demo_user' || user.username === 'demo')) {
        return "Demo Sales – No Invoice Number";
    }
    return salesService.generateInvoiceNumber();
}));
ipcMain.handle('sqlite:sales:cancel', (e, args, arg2) => {
    const sessionToken = args?.sessionToken || arg2;
    const saleId = (args && typeof args === 'object' && args.id !== undefined) ? args.id : (args?.saleId || args);
    return handleAuthorizedSqlite(e, sessionToken, 'delete', () => salesService.cancelSale(saleId), { isWrite: true });
});

// Purchases
ipcMain.handle('sqlite:purchases:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseService.createPurchase(args?.data !== undefined ? args.data : args), { isWrite: true }));
ipcMain.handle('sqlite:purchases:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseService.getPurchases(typeof args?.dateStr === 'string' ? args.dateStr : (typeof args === 'string' ? args : null)), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:purchases:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => purchaseService.searchPurchases(args?.query !== undefined ? args.query : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:purchases:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => {
    let id = args?.id !== undefined ? args.id : args;
    if (typeof id === 'object' && id !== null) {
        id = id.id || id.invoice_number || id.invoiceNumber || id.invoice;
    }
    return purchaseService.getPurchaseById(id);
}, { isDemoRestrictedRead: true, demoReadDefault: null }));
ipcMain.handle('sqlite:purchases:cancel', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => purchaseService.cancelPurchase(args?.id !== undefined ? args.id : args), { isWrite: true }));

// Suppliers
ipcMain.handle('sqlite:suppliers:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.getSuppliers(), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:suppliers:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.getSupplier(args?.id !== undefined ? args.id : args), { isDemoRestrictedRead: true, demoReadDefault: null }));
ipcMain.handle('sqlite:suppliers:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.createSupplier(args?.data !== undefined ? args.data : args), { isWrite: true }));
ipcMain.handle('sqlite:suppliers:update', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return supplierService.updateSupplier(id, data);
}, { isWrite: true }));
ipcMain.handle('sqlite:suppliers:archive', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.archiveSupplier(args?.id !== undefined ? args.id : args), { isWrite: true }));
ipcMain.handle('sqlite:suppliers:search', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'purchase_entry', () => supplierService.searchSuppliers(args?.query !== undefined ? args.query : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));

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
ipcMain.handle('sqlite:pettyCash:getSummary', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getSummary(), { isDemoRestrictedRead: true, demoReadDefault: { currentCash: 0, currentBank: 0, totalAvailable: 0 } }));
ipcMain.handle('sqlite:pettyCash:getOpeningBalances', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getOpeningBalances(), { isDemoRestrictedRead: true, demoReadDefault: { cash: 0, bank: 0 } }));
ipcMain.handle('sqlite:pettyCash:setOpeningBalances', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => {
    const cash = args?.cash !== undefined ? args.cash : args;
    const bank = args?.bank !== undefined ? args.bank : arg2;
    return pettyCashService.setOpeningBalances(cash, bank);
}, { isWrite: true }));
ipcMain.handle('sqlite:pettyCash:getCategories', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getCategories()));
ipcMain.handle('sqlite:pettyCash:saveCategories', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => pettyCashService.saveCategories(args?.cats !== undefined ? args.cats : args), { isWrite: true }));
ipcMain.handle('sqlite:pettyCash:getTransactions', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getTransactions(args?.filters !== undefined ? args.filters : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:pettyCash:getTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.getTransaction(args?.id !== undefined ? args.id : args), { isDemoRestrictedRead: true, demoReadDefault: null }));
ipcMain.handle('sqlite:pettyCash:createTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => pettyCashService.createTransaction(args?.data !== undefined ? args.data : args), { isWrite: true }));
ipcMain.handle('sqlite:pettyCash:updateTransaction', (e, args, arg2) => handleAuthorizedSqlite(e, args?.sessionToken, 'petty_cash', () => {
    const id = args?.id !== undefined ? args.id : args;
    const data = args?.data !== undefined ? args.data : arg2;
    return pettyCashService.updateTransaction(id, data);
}, { isWrite: true }));
ipcMain.handle('sqlite:pettyCash:deleteTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => pettyCashService.deleteTransaction(args?.id !== undefined ? args.id : args), { isWrite: true }));
ipcMain.handle('sqlite:pettyCash:cancelTransaction', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => pettyCashService.cancelTransaction(args?.id !== undefined ? args.id : args), { isWrite: true }));

// Day Closing
ipcMain.handle('sqlite:dayClosing:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'day_closing', () => dayClosingService.getAllClosings(args?.filters !== undefined ? args.filters : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:dayClosing:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'day_closing', () => dayClosingService.getClosing(args?.id !== undefined ? args.id : args), { isDemoRestrictedRead: true, demoReadDefault: null }));
ipcMain.handle('sqlite:dayClosing:getByDate', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'day_closing', () => dayClosingService.getClosingByDate(args?.dateStr !== undefined ? args.dateStr : args), { isDemoRestrictedRead: true, demoReadDefault: null }));
ipcMain.handle('sqlite:dayClosing:save', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'day_closing', () => dayClosingService.saveClosing(args?.data !== undefined ? args.data : args), { isWrite: true }));
ipcMain.handle('sqlite:dayClosing:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => dayClosingService.deleteClosing(args?.id !== undefined ? args.id : args), { isWrite: true }));

// Calculator
async function handleCalculatorSqlite(event, sessionToken, handlerFn) {
    if (!sqliteStatus.initialized || !dbManager.isDatabaseOpen()) {
        return { success: false, error: { code: 'DATABASE_NOT_INITIALIZED', message: 'Database is not initialized.' } };
    }
    if (sessionToken && typeof sessionToken === 'string' && sessionToken.trim().length > 0) {
        try {
            const sessionUser = await userService.validateSession(sessionToken.trim());
            if (sessionUser && sessionUser.status === 'active') {
                const result = await handlerFn(sessionUser);
                return { success: true, data: result };
            }
        } catch (e) {
            console.warn('[Calculator Auth Warn]:', e.message);
        }
    }
    try {
        const result = await handlerFn(null);
        return { success: true, data: result };
    } catch (e) {
        return { success: false, error: { code: e.code || 'DATABASE_ERROR', message: e.message } };
    }
}

ipcMain.handle('sqlite:calculator:getHistory', (e, args) => handleCalculatorSqlite(e, args?.sessionToken, () => calculatorService.getHistory()));
ipcMain.handle('sqlite:calculator:saveHistory', (e, args, arg2) => handleCalculatorSqlite(e, args?.sessionToken, () => {
    const expression = args?.expression !== undefined ? args.expression : args;
    const result = args?.result !== undefined ? args.result : arg2;
    return calculatorService.saveHistory(expression, result);
}));
ipcMain.handle('sqlite:calculator:deleteHistory', (e, args) => handleCalculatorSqlite(e, args?.sessionToken, () => calculatorService.deleteHistory(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:calculator:clearAllHistory', (e, args) => handleCalculatorSqlite(e, args?.sessionToken, () => calculatorService.clearAllHistory()));

// Reports
ipcMain.handle('sqlite:reports:getReportSales', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => reportService.getReportSales(args?.filters !== undefined ? args.filters : args), { isDemoRestrictedRead: true, demoReadDefault: [] }));
ipcMain.handle('sqlite:reports:getSummary', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'reports', () => reportService.getCustomReportSummary(args?.filters !== undefined ? args.filters : args), { isDemoRestrictedRead: true, demoReadDefault: { totalSales: 0, totalPurchases: 0, totalExpenses: 0, netProfit: 0 } }));
ipcMain.handle('sqlite:ledger:getPartyLedger', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'authenticated', () => ledgerService.getPartyLedger(args?.partyId, args?.partyType, args?.options)));

// Dashboard
ipcMain.handle('sqlite:dashboard:getMetrics', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'dashboard', () => dashboardService.getDashboardMetrics(args?.options !== undefined ? args.options : args), { isDemoRestrictedRead: true, demoReadDefault: { totalSales: 0, totalOrders: 0, lowStockCount: 0, pendingReceivables: 0 } }));


// --- Backup & Google Drive IPC Handlers ---
ipcMain.handle('sqlite:backup:createLocal', async (e, args) => {
    return await backupService.createBackup(args?.reason || 'manual', 'OneBook_Backup', args?.customDest || null);
});

ipcMain.handle('sqlite:backup:listLocal', async () => {
    return backupService.listBackups();
});

ipcMain.handle('sqlite:backup:getLastBackup', async () => {
    return backupService.getLastBackupInfo();
});

ipcMain.handle('sqlite:backup:getScheduleSettings', async () => {
    return backupService.getScheduleSettings();
});

ipcMain.handle('sqlite:backup:saveScheduleSettings', async (e, settings) => {
    return backupService.saveScheduleSettings(settings);
});

ipcMain.handle('sqlite:backup:selectBackupFolder', async () => {
    const res = await dialog.showOpenDialog({
        title: 'Select Backup Destination Folder',
        properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return { success: false, canceled: true };
    }
    return { success: true, folderPath: res.filePaths[0] };
});

ipcMain.handle('sqlite:backup:openBackupFolder', async (e, folderPath) => {
    const target = folderPath || backupService.getEffectiveBackupDir();
    try {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }
        await shell.openPath(target);
        return { success: true, path: target };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('sqlite:backup:restoreBackup', async (e, args) => {
    return await backupService.restoreBackup(args?.filePath);
});

ipcMain.handle('sqlite:gdrive:getStatus', async () => {
    return gdriveService.getStatus();
});

ipcMain.handle('sqlite:gdrive:connect', async (e, args) => {
    return await gdriveService.startAuthFlow(args?.clientId, args?.clientSecret);
});

ipcMain.handle('sqlite:gdrive:disconnect', async () => {
    return gdriveService.disconnect();
});

ipcMain.handle('sqlite:gdrive:backupNow', async () => {
    const localRes = await backupService.createBackup('cloud_manual');
    if (!localRes.success) return localRes;
    const cloudRes = await gdriveService.uploadBackup(localRes.metadata);
    return { success: cloudRes.success, local: localRes.metadata, cloud: cloudRes };
});

// Draft Sales SQLite Handlers
ipcMain.handle('sqlite:draftSales:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => dbManager.draftSalesService.getAll()));
ipcMain.handle('sqlite:draftSales:save', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => dbManager.draftSalesService.save(args?.draft !== undefined ? args.draft : args)));
ipcMain.handle('sqlite:draftSales:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'record_sale', () => dbManager.draftSalesService.delete(args?.id !== undefined ? args.id : args)));


// --- Stock Location Management IPC Handlers (Phase 1) ---
ipcMain.handle('sqlite:locations:getSettings', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'settings', () => locationService.getLocationSettings()));
ipcMain.handle('sqlite:locations:saveSettings', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'admin', () => locationService.saveLocationSettings(args?.settings !== undefined ? args.settings : args)));
ipcMain.handle('sqlite:locations:getAll', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.getLocations(args?.filters !== undefined ? args.filters : args)));
ipcMain.handle('sqlite:locations:get', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.getLocation(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:locations:create', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.createLocation(args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:locations:update', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.updateLocation(args?.id, args?.data !== undefined ? args.data : args)));
ipcMain.handle('sqlite:locations:toggleActive', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.toggleLocationActive(args?.id, args?.isActive)));
ipcMain.handle('sqlite:locations:delete', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'delete', () => locationService.deleteLocation(args?.id !== undefined ? args.id : args)));
ipcMain.handle('sqlite:locations:getHierarchy', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.getLocationHierarchy()));
ipcMain.handle('sqlite:locations:getStock', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.getLocationStock(args?.productId, args?.variantId, args?.locationId)));
ipcMain.handle('sqlite:locations:getBreakdown', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.getProductStockBreakdown(args?.productId, args?.variantId)));
ipcMain.handle('sqlite:locations:transferStock', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.transferStock(args?.productId, args?.variantId, args?.fromLocationId, args?.toLocationId, args?.quantity, args?.notes)));
ipcMain.handle('sqlite:locations:getTransfers', (e, args) => handleAuthorizedSqlite(e, args?.sessionToken, 'inventory', () => locationService.getTransfers(args?.filters)));

module.exports = {
    initSqliteAtStartup,
    resolveSqlitePath,
    getDatabaseDetailsHelper,
    createWindow
};
