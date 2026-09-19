const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectorySync: () => ipcRenderer.sendSync('select-directory-sync'),
    saveDataSync: (args) => ipcRenderer.sendSync('save-data-sync', args),
    loadDataSync: (args) => ipcRenderer.sendSync('load-data-sync', args),
    createBackupSync: (args) => ipcRenderer.sendSync('create-backup-sync', args),
    getDbConfigSync: () => ipcRenderer.sendSync('get-db-config-sync'),
    setDbConfigSync: (folderPath) => ipcRenderer.sendSync('set-db-config-sync', folderPath),
    getDefaultDbFolderSync: () => ipcRenderer.sendSync('get-default-db-folder-sync'),
    ensureFolderSync: (folderPath) => ipcRenderer.sendSync('ensure-folder-sync', folderPath),
    checkFolderHasDataSync: (folderPath) => ipcRenderer.sendSync('check-folder-has-data-sync', folderPath),
    focusWindow: () => ipcRenderer.send('focus-window'),

    // Licensing APIs
    getLicenseSync: () => ipcRenderer.sendSync('get-license-sync'),
    saveLicenseSync: (data) => ipcRenderer.sendSync('save-license-sync', data),
    getMachineIdSync: () => ipcRenderer.sendSync('get-machine-id-sync'),
});


window.addEventListener('DOMContentLoaded', () => {
    console.log('Electron Preload: Application Loaded');
});
