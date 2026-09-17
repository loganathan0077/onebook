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
