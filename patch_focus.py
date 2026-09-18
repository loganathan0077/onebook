import os
import re

# Update main.js to add focus handler
with open('main.js', 'r', encoding='utf-8') as f:
    main_js = f.read()

if 'ipcMain.on(\'focus-window\'' not in main_js:
    focus_handler = """ipcMain.on('focus-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.focus();
    }
});
"""
    main_js = main_js.replace('app.whenReady().then(() => {', focus_handler + '\napp.whenReady().then(() => {')
    with open('main.js', 'w', encoding='utf-8') as f:
        f.write(main_js)

# Update preload.js to expose focusWindow
with open('preload.js', 'r', encoding='utf-8') as f:
    preload_js = f.read()

if 'focusWindow:' not in preload_js:
    preload_js = preload_js.replace('checkFolderHasDataSync: (folderPath) => ipcRenderer.sendSync(\'check-folder-has-data-sync\', folderPath),', 
                                  'checkFolderHasDataSync: (folderPath) => ipcRenderer.sendSync(\'check-folder-has-data-sync\', folderPath),\n    focusWindow: () => ipcRenderer.send(\'focus-window\'),')
    with open('preload.js', 'w', encoding='utf-8') as f:
        f.write(preload_js)

# Update login.html to call focusWindow
with open('login.html', 'r', encoding='utf-8') as f:
    login_html = f.read()

if 'window.electronAPI.focusWindow()' not in login_html:
    login_html = login_html.replace("document.getElementById('email').focus();", 
                                  "if (window.electronAPI && window.electronAPI.focusWindow) { window.electronAPI.focusWindow(); }\n        setTimeout(() => { document.getElementById('email').focus(); }, 100);")
    with open('login.html', 'w', encoding='utf-8') as f:
        f.write(login_html)
