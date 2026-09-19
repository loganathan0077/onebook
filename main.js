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



    if (checkLicense()) {

        win.loadFile('OneBook.html');

    } else {

        win.loadFile('license.html');

    }

    win.maximize();

}



// Set up IPC handlers

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

            licenseId: payloadObj.licenseId,

            licenseVersion: payloadObj.licenseVersion,

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

            // Delete old insecure json if it exists

            const oldPath = path.join(app.getPath('userData'), 'license-state.json');

            if (fs.existsSync(oldPath)) {

                fs.unlinkSync(oldPath);

            }

            return false;

        }



        if (!safeStorage.isEncryptionAvailable()) {

            console.error("Secure license storage is unavailable on this device.");

            return false;

        }



        const decrypted = safeStorage.decryptString(fs.readFileSync(p));

        const parsed = JSON.parse(decrypted);

        const { license, signature } = parsed;



        // 1. Re-verify signature

        if (!verifyLicenseSignature(license, signature)) {

            console.error("Signature rejected at startup.");

            return false;

        }



        // 2. Verify hardware deviceId

        if (license.deviceId !== machineIdCache) {

            console.error("Device ID mismatch at startup.");

            return false;

        }



        // 3. Verify status

        if (license.status !== 'ACTIVE') {

            return false;

        }



        // 4. Verify expiry

        if (license.expiresAt) {

            const expiresAt = new Date(license.expiresAt);

            if (expiresAt < new Date()) {

                return false;

            }

        }



        return true;

    } catch (e) {

        console.error('License check error:', e);

    }

    return false;

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
