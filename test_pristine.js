const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
    const win = new BrowserWindow({
        webPreferences: { nodeIntegration: true, contextIsolation: false },
        width: 1200, height: 800
    });
    
    win.loadFile('OneBook.html');
    
    win.webContents.once('did-finish-load', () => {
        setTimeout(() => {
            win.webContents.capturePage().then(image => {
                require('fs').writeFileSync('screenshot_dashboard.png', image.toPNG());
                
                win.webContents.executeJavaScript("switchTab('sales')");
                setTimeout(() => {
                    win.webContents.capturePage().then(image => {
                        require('fs').writeFileSync('screenshot_sales.png', image.toPNG());
                        
                        win.webContents.executeJavaScript("switchTab('reports')");
                        setTimeout(() => {
                            win.webContents.capturePage().then(image => {
                                require('fs').writeFileSync('screenshot_reports.png', image.toPNG());
                                console.log("Screenshots captured");
                                app.quit();
                            });
                        }, 500);
                    });
                }, 500);
            });
        }, 1500);
    });
});
