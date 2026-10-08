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
    getLicenseInfoSync: () => ipcRenderer.sendSync('get-license-info-sync'),
    saveLicenseSync: (data) => ipcRenderer.sendSync('save-license-sync', data),
    surrenderLicense: (key, contact) => ipcRenderer.invoke('surrender-license', key, contact),
    getMachineIdSync: () => ipcRenderer.sendSync('get-machine-id-sync'),

    onLicenseBlockedReason: (callback) => ipcRenderer.on('license-blocked-reason', (_event, value) => callback(value)),,
    onLicenseGraceWarning: (callback) => ipcRenderer.on('license-grace-warning', (_event, value) => callback(value)),

    sqlite: {
        products: {
            getAll: () => ipcRenderer.invoke('sqlite:products:getAll'),
            get: (id) => ipcRenderer.invoke('sqlite:products:get', id),
            create: (data) => ipcRenderer.invoke('sqlite:products:create', data),
            update: (id, data) => ipcRenderer.invoke('sqlite:products:update', id, data),
            search: (q) => ipcRenderer.invoke('sqlite:products:search', q),
            lowStock: () => ipcRenderer.invoke('sqlite:products:lowStock')
        },
        stock: {
            get: (pId) => ipcRenderer.invoke('sqlite:stock:get', pId),
            movements: (pId) => ipcRenderer.invoke('sqlite:stock:movements', pId),
            adjust: (productId, variantId, qty, reason, refType, refId) => ipcRenderer.invoke('sqlite:stock:adjust', productId, variantId, qty, reason, refType, refId)
        },
        customers: {
            getAll: () => ipcRenderer.invoke('sqlite:customers:getAll'),
            get: (id) => ipcRenderer.invoke('sqlite:customers:get', id),
            create: (data) => ipcRenderer.invoke('sqlite:customers:create', data),
            update: (id, data) => ipcRenderer.invoke('sqlite:customers:update', id, data),
            delete: (id) => ipcRenderer.invoke('sqlite:customers:delete', id),
            search: (query) => ipcRenderer.invoke('sqlite:customers:search', query)
        },
        sales: {
            create: (data) => ipcRenderer.invoke('sqlite:sales:create', data),
            getAll: (dateStr) => ipcRenderer.invoke('sqlite:sales:getAll', dateStr),
            search: (query) => ipcRenderer.invoke('sqlite:sales:search', query),
            get: (id) => ipcRenderer.invoke('sqlite:sales:get', id),
            cancel: (id) => ipcRenderer.invoke('sqlite:sales:cancel', id)
        }
    },
});


window.addEventListener('DOMContentLoaded', () => {
    console.log('Electron Preload: Application Loaded');
});
