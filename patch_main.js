const fs = require('fs');
const path = require('path');

let mainCode = fs.readFileSync('main.js', 'utf8');

const newIpcHandlers = `
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
`;

// Insert before app.whenReady().then(...)
mainCode = mainCode.replace('app.whenReady().then(() => {', newIpcHandlers + '\napp.whenReady().then(() => {');

fs.writeFileSync('main.js', mainCode, 'utf8');
