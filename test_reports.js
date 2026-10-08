const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
    const win = new BrowserWindow({
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[CONSOLE] ${message} (line ${line})`);
    });
    win.loadFile('OneBook.html');
    win.webContents.once('did-finish-load', () => {
        win.webContents.executeJavaScript(`
            setTimeout(() => {
                switchTab('reports');
            }, 1000);
        `);
        setTimeout(() => {
            app.quit();
        }, 5000);
    });
});
