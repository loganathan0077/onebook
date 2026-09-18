const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

    win.loadFile('OneBook.html');
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
