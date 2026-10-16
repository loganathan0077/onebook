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

    onLicenseBlockedReason: (callback) => ipcRenderer.on('license-blocked-reason', (_event, value) => callback(value)),
    onLicenseGraceWarning: (callback) => ipcRenderer.on('license-grace-warning', (_event, value) => callback(value)),

    sqlite: {
        system: {
            getStatus: () => ipcRenderer.invoke('sqlite:system:getStatus'),
            selectAndConnect: () => ipcRenderer.invoke('sqlite:system:selectAndConnect')
        },
        categories: {
            getAll: () => ipcRenderer.invoke('sqlite:categories:getAll'),
            get: (id) => ipcRenderer.invoke('sqlite:categories:get', id),
            create: (name) => ipcRenderer.invoke('sqlite:categories:create', name),
            update: (id, newName) => ipcRenderer.invoke('sqlite:categories:update', id, newName),
            toggleStatus: (id, active) => ipcRenderer.invoke('sqlite:categories:toggleStatus', id, active),
            delete: (id) => ipcRenderer.invoke('sqlite:categories:delete', id),
            migrate: (items) => ipcRenderer.invoke('sqlite:categories:migrate', items)
        },
        units: {
            getAll: () => ipcRenderer.invoke('sqlite:units:getAll'),
            get: (id) => ipcRenderer.invoke('sqlite:units:get', id),
            create: (name) => ipcRenderer.invoke('sqlite:units:create', name),
            update: (id, newName) => ipcRenderer.invoke('sqlite:units:update', id, newName),
            toggleStatus: (id, active) => ipcRenderer.invoke('sqlite:units:toggleStatus', id, active),
            delete: (id) => ipcRenderer.invoke('sqlite:units:delete', id),
            migrate: (items) => ipcRenderer.invoke('sqlite:units:migrate', items)
        },
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
        },
        purchases: {
            create: (data) => ipcRenderer.invoke('sqlite:purchases:create', data),
            getAll: (dateStr) => ipcRenderer.invoke('sqlite:purchases:getAll', dateStr),
            search: (query) => ipcRenderer.invoke('sqlite:purchases:search', query),
            get: (id) => ipcRenderer.invoke('sqlite:purchases:get', id),
            cancel: (id) => ipcRenderer.invoke('sqlite:purchases:cancel', id)
        },
        suppliers: {
            getAll: () => ipcRenderer.invoke('sqlite:suppliers:getAll'),
            get: (id) => ipcRenderer.invoke('sqlite:suppliers:get', id),
            create: (data) => ipcRenderer.invoke('sqlite:suppliers:create', data),
            update: (id, data) => ipcRenderer.invoke('sqlite:suppliers:update', id, data),
            archive: (id) => ipcRenderer.invoke('sqlite:suppliers:archive', id),
            search: (query) => ipcRenderer.invoke('sqlite:suppliers:search', query)
        },
        purchaseOrders: {
            create: (data) => ipcRenderer.invoke('sqlite:purchaseOrders:create', data),
            update: (id, data) => ipcRenderer.invoke('sqlite:purchaseOrders:update', id, data),
            getAll: () => ipcRenderer.invoke('sqlite:purchaseOrders:getAll'),
            get: (id) => ipcRenderer.invoke('sqlite:purchaseOrders:get', id),
            search: (query) => ipcRenderer.invoke('sqlite:purchaseOrders:search', query),
            cancel: (id) => ipcRenderer.invoke('sqlite:purchaseOrders:cancel', id),
            receive: (id) => ipcRenderer.invoke('sqlite:purchaseOrders:receive', id)
        },
        payments: {
            getSalePayments: (saleId) => ipcRenderer.invoke('sqlite:payments:getSalePayments', saleId),
            createSalePayment: (data) => ipcRenderer.invoke('sqlite:payments:createSalePayment', data),
            cancelSalePayment: (id) => ipcRenderer.invoke('sqlite:payments:cancelSalePayment', id),
            getPurchasePayments: (purchaseId) => ipcRenderer.invoke('sqlite:payments:getPurchasePayments', purchaseId),
            createPurchasePayment: (data) => ipcRenderer.invoke('sqlite:payments:createPurchasePayment', data),
            cancelPurchasePayment: (id) => ipcRenderer.invoke('sqlite:payments:cancelPurchasePayment', id),
            getLedgerPayments: () => ipcRenderer.invoke('sqlite:payments:getLedgerPayments'),
            createLedgerPayment: (data) => ipcRenderer.invoke('sqlite:payments:createLedgerPayment', data)
        },
                cashBank: {
            getCashSummary: () => ipcRenderer.invoke('sqlite:cashBank:getCashSummary'),
            getBankSummary: () => ipcRenderer.invoke('sqlite:cashBank:getBankSummary'),
            getTransactions: (accountType, filters) => ipcRenderer.invoke('sqlite:cashBank:getTransactions', accountType, filters),
            getTransaction: (id, accountType) => ipcRenderer.invoke('sqlite:cashBank:getTransaction', id, accountType),
            createTransaction: (data) => ipcRenderer.invoke('sqlite:cashBank:createTransaction', data),
            updateTransaction: (id, data) => ipcRenderer.invoke('sqlite:cashBank:updateTransaction', id, data),
            cancelTransaction: (id, accountType) => ipcRenderer.invoke('sqlite:cashBank:cancelTransaction', id, accountType),
            getOpeningBalance: (accountType) => ipcRenderer.invoke('sqlite:cashBank:getOpeningBalance', accountType),
            setOpeningBalance: (accountType, amount) => ipcRenderer.invoke('sqlite:cashBank:setOpeningBalance', accountType, amount),
            transfer: (data) => ipcRenderer.invoke('sqlite:cashBank:transfer', data)
        },
        pettyCash: {
            getSummary: () => ipcRenderer.invoke('sqlite:pettyCash:getSummary'),
            getOpeningBalances: () => ipcRenderer.invoke('sqlite:pettyCash:getOpeningBalances'),
            setOpeningBalances: (cash, bank) => ipcRenderer.invoke('sqlite:pettyCash:setOpeningBalances', cash, bank),
            getCategories: () => ipcRenderer.invoke('sqlite:pettyCash:getCategories'),
            saveCategories: (cats) => ipcRenderer.invoke('sqlite:pettyCash:saveCategories', cats),
            getTransactions: (filters) => ipcRenderer.invoke('sqlite:pettyCash:getTransactions', filters),
            getTransaction: (id) => ipcRenderer.invoke('sqlite:pettyCash:getTransaction', id),
            createTransaction: (data) => ipcRenderer.invoke('sqlite:pettyCash:createTransaction', data),
            updateTransaction: (id, data) => ipcRenderer.invoke('sqlite:pettyCash:updateTransaction', id, data),
            deleteTransaction: (id) => ipcRenderer.invoke('sqlite:pettyCash:deleteTransaction', id),
            cancelTransaction: (id) => ipcRenderer.invoke('sqlite:pettyCash:cancelTransaction', id)
        },
        dayClosing: {
            getAll: (filters) => ipcRenderer.invoke('sqlite:dayClosing:getAll', filters),
            get: (id) => ipcRenderer.invoke('sqlite:dayClosing:get', id),
            getByDate: (dateStr) => ipcRenderer.invoke('sqlite:dayClosing:getByDate', dateStr),
            save: (data) => ipcRenderer.invoke('sqlite:dayClosing:save', data),
            delete: (id) => ipcRenderer.invoke('sqlite:dayClosing:delete', id)
        },
        calculator: {
            getHistory: () => ipcRenderer.invoke('sqlite:calculator:getHistory'),
            saveHistory: (expression, result) => ipcRenderer.invoke('sqlite:calculator:saveHistory', expression, result),
            deleteHistory: (id) => ipcRenderer.invoke('sqlite:calculator:deleteHistory', id),
            clearAllHistory: () => ipcRenderer.invoke('sqlite:calculator:clearAllHistory')
        },
        reports: {
            getReportSales: (filters) => ipcRenderer.invoke('sqlite:reports:getReportSales', filters),
            getSummary: (filters) => ipcRenderer.invoke('sqlite:reports:getSummary', filters)
        },
        dashboard: {
            getMetrics: (options) => ipcRenderer.invoke('sqlite:dashboard:getMetrics', options)
        }
    }
});

window.addEventListener('DOMContentLoaded', () => {
    console.log('Electron Preload: Application Loaded');
});
