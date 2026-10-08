const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
    const win = new BrowserWindow({
        webPreferences: { nodeIntegration: true, contextIsolation: false },
        show: false
    });
    
    let hasError = false;
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[CONSOLE] ${message} (line ${line})`);
        if (level >= 2 && !message.includes("Electron Security Warning")) {
            hasError = true;
        }
    });
    
    win.loadFile('OneBook.html');
    
    win.webContents.once('did-finish-load', () => {
        win.webContents.executeJavaScript(`
            setTimeout(() => {
                switchTab('reports');
                setTimeout(() => {
                    switchTab('purchaseparties');
                }, 1000);
            }, 1000);
        `);
        
        setTimeout(() => {
            console.log("TEST FINISHED");
            app.quit();
        }, 4000);
    });
});
