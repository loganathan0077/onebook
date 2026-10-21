const { contextBridge, ipcRenderer } = require('electron');

let currentSessionToken = null;

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
        // Session token management
        setSessionToken: (token) => { currentSessionToken = (typeof token === 'string') ? token.trim() : null; },
        getSessionToken: () => currentSessionToken,
        clearSessionToken: () => { currentSessionToken = null; },

        system: {
            getStatus: () => ipcRenderer.invoke('sqlite:system:getStatus'),
            selectAndConnect: () => ipcRenderer.invoke('sqlite:system:selectAndConnect')
        },
        users: {
            login: (username, password) => ipcRenderer.invoke('sqlite:users:login', { username, password }),
            logout: (sessionToken) => ipcRenderer.invoke('sqlite:users:logout', { sessionToken: sessionToken || currentSessionToken }),
            validateSession: (sessionToken) => ipcRenderer.invoke('sqlite:users:validateSession', { sessionToken: sessionToken || currentSessionToken }),
            getAll: (sessionToken) => ipcRenderer.invoke('sqlite:users:getAll', { sessionToken: sessionToken || currentSessionToken }),
            create: (sessionToken, userData) => ipcRenderer.invoke('sqlite:users:create', { sessionToken: sessionToken || currentSessionToken, userData }),
            update: (sessionToken, userId, updateData) => ipcRenderer.invoke('sqlite:users:update', { sessionToken: sessionToken || currentSessionToken, userId, updateData }),
            toggleStatus: (sessionToken, userId, targetStatus) => ipcRenderer.invoke('sqlite:users:toggleStatus', { sessionToken: sessionToken || currentSessionToken, userId, targetStatus }),
            delete: (sessionToken, userId) => ipcRenderer.invoke('sqlite:users:delete', { sessionToken: sessionToken || currentSessionToken, userId }),
            changePassword: (sessionToken, userId, newPassword) => ipcRenderer.invoke('sqlite:users:changePassword', { sessionToken: sessionToken || currentSessionToken, userId, newPassword })
        },
        categories: {
            getAll: () => ipcRenderer.invoke('sqlite:categories:getAll', { sessionToken: currentSessionToken }),
            get: (id) => ipcRenderer.invoke('sqlite:categories:get', { sessionToken: currentSessionToken, id }),
            create: (name) => ipcRenderer.invoke('sqlite:categories:create', { sessionToken: currentSessionToken, name }),
            update: (id, newName) => ipcRenderer.invoke('sqlite:categories:update', { sessionToken: currentSessionToken, id, newName }),
            toggleStatus: (id, active) => ipcRenderer.invoke('sqlite:categories:toggleStatus', { sessionToken: currentSessionToken, id, active }),
            delete: (id) => ipcRenderer.invoke('sqlite:categories:delete', { sessionToken: currentSessionToken, id }),
            migrate: (items) => ipcRenderer.invoke('sqlite:categories:migrate', { sessionToken: currentSessionToken, items })
        },
        units: {
            getAll: () => ipcRenderer.invoke('sqlite:units:getAll', { sessionToken: currentSessionToken }),
            get: (id) => ipcRenderer.invoke('sqlite:units:get', { sessionToken: currentSessionToken, id }),
            create: (name) => ipcRenderer.invoke('sqlite:units:create', { sessionToken: currentSessionToken, name }),
            update: (id, newName) => ipcRenderer.invoke('sqlite:units:update', { sessionToken: currentSessionToken, id, newName }),
            toggleStatus: (id, active) => ipcRenderer.invoke('sqlite:units:toggleStatus', { sessionToken: currentSessionToken, id, active }),
            delete: (id) => ipcRenderer.invoke('sqlite:units:delete', { sessionToken: currentSessionToken, id }),
            migrate: (items) => ipcRenderer.invoke('sqlite:units:migrate', { sessionToken: currentSessionToken, items })
        },
        products: {
            getAll: () => ipcRenderer.invoke('sqlite:products:getAll', { sessionToken: currentSessionToken }),
            get: (id) => ipcRenderer.invoke('sqlite:products:get', { sessionToken: currentSessionToken, id }),
            create: (data) => ipcRenderer.invoke('sqlite:products:create', { sessionToken: currentSessionToken, data }),
            update: (id, data) => ipcRenderer.invoke('sqlite:products:update', { sessionToken: currentSessionToken, id, data }),
            search: (q) => ipcRenderer.invoke('sqlite:products:search', { sessionToken: currentSessionToken, q }),
            lowStock: () => ipcRenderer.invoke('sqlite:products:lowStock', { sessionToken: currentSessionToken })
        },
        stock: {
            get: (pId) => ipcRenderer.invoke('sqlite:stock:get', { sessionToken: currentSessionToken, pId }),
            movements: (pId) => ipcRenderer.invoke('sqlite:stock:movements', { sessionToken: currentSessionToken, pId }),
            adjust: (productId, variantId, qty, reason, refType, refId) => 
                ipcRenderer.invoke('sqlite:stock:adjust', { sessionToken: currentSessionToken, productId, variantId, qty, reason, refType, refId })
        },
        customers: {
            getAll: () => ipcRenderer.invoke('sqlite:customers:getAll', { sessionToken: currentSessionToken }),
            get: (id) => ipcRenderer.invoke('sqlite:customers:get', { sessionToken: currentSessionToken, id }),
            create: (data) => ipcRenderer.invoke('sqlite:customers:create', { sessionToken: currentSessionToken, data }),
            update: (id, data) => ipcRenderer.invoke('sqlite:customers:update', { sessionToken: currentSessionToken, id, data }),
            delete: (id) => ipcRenderer.invoke('sqlite:customers:delete', { sessionToken: currentSessionToken, id }),
            search: (query) => ipcRenderer.invoke('sqlite:customers:search', { sessionToken: currentSessionToken, query })
        },
        sales: {
            create: (data) => ipcRenderer.invoke('sqlite:sales:create', { sessionToken: currentSessionToken, data }),
            getAll: (dateStr) => ipcRenderer.invoke('sqlite:sales:getAll', { sessionToken: currentSessionToken, dateStr }),
            search: (query) => ipcRenderer.invoke('sqlite:sales:search', { sessionToken: currentSessionToken, query }),
            get: (id) => ipcRenderer.invoke('sqlite:sales:get', { sessionToken: currentSessionToken, id }),
            cancel: (id) => ipcRenderer.invoke('sqlite:sales:cancel', { sessionToken: currentSessionToken, id })
        },
        purchases: {
            create: (data) => ipcRenderer.invoke('sqlite:purchases:create', { sessionToken: currentSessionToken, data }),
            getAll: (dateStr) => ipcRenderer.invoke('sqlite:purchases:getAll', { sessionToken: currentSessionToken, dateStr }),
            search: (query) => ipcRenderer.invoke('sqlite:purchases:search', { sessionToken: currentSessionToken, query }),
            get: (id) => ipcRenderer.invoke('sqlite:purchases:get', { sessionToken: currentSessionToken, id }),
            cancel: (id) => ipcRenderer.invoke('sqlite:purchases:cancel', { sessionToken: currentSessionToken, id })
        },
        suppliers: {
            getAll: () => ipcRenderer.invoke('sqlite:suppliers:getAll', { sessionToken: currentSessionToken }),
            get: (id) => ipcRenderer.invoke('sqlite:suppliers:get', { sessionToken: currentSessionToken, id }),
            create: (data) => ipcRenderer.invoke('sqlite:suppliers:create', { sessionToken: currentSessionToken, data }),
            update: (id, data) => ipcRenderer.invoke('sqlite:suppliers:update', { sessionToken: currentSessionToken, id, data }),
            archive: (id) => ipcRenderer.invoke('sqlite:suppliers:archive', { sessionToken: currentSessionToken, id }),
            search: (query) => ipcRenderer.invoke('sqlite:suppliers:search', { sessionToken: currentSessionToken, query })
        },
        purchaseOrders: {
            create: (data) => ipcRenderer.invoke('sqlite:purchaseOrders:create', { sessionToken: currentSessionToken, data }),
            update: (id, data) => ipcRenderer.invoke('sqlite:purchaseOrders:update', { sessionToken: currentSessionToken, id, data }),
            getAll: () => ipcRenderer.invoke('sqlite:purchaseOrders:getAll', { sessionToken: currentSessionToken }),
            get: (id) => ipcRenderer.invoke('sqlite:purchaseOrders:get', { sessionToken: currentSessionToken, id }),
            search: (query) => ipcRenderer.invoke('sqlite:purchaseOrders:search', { sessionToken: currentSessionToken, query }),
            cancel: (id) => ipcRenderer.invoke('sqlite:purchaseOrders:cancel', { sessionToken: currentSessionToken, id }),
            receive: (id) => ipcRenderer.invoke('sqlite:purchaseOrders:receive', { sessionToken: currentSessionToken, id })
        },
        payments: {
            getSalePayments: (saleId) => ipcRenderer.invoke('sqlite:payments:getSalePayments', { sessionToken: currentSessionToken, saleId }),
            createSalePayment: (data) => ipcRenderer.invoke('sqlite:payments:createSalePayment', { sessionToken: currentSessionToken, data }),
            cancelSalePayment: (id) => ipcRenderer.invoke('sqlite:payments:cancelSalePayment', { sessionToken: currentSessionToken, id }),
            getPurchasePayments: (purchaseId) => ipcRenderer.invoke('sqlite:payments:getPurchasePayments', { sessionToken: currentSessionToken, purchaseId }),
            createPurchasePayment: (data) => ipcRenderer.invoke('sqlite:payments:createPurchasePayment', { sessionToken: currentSessionToken, data }),
            cancelPurchasePayment: (id) => ipcRenderer.invoke('sqlite:payments:cancelPurchasePayment', { sessionToken: currentSessionToken, id }),
            getLedgerPayments: () => ipcRenderer.invoke('sqlite:payments:getLedgerPayments', { sessionToken: currentSessionToken }),
            createLedgerPayment: (data) => ipcRenderer.invoke('sqlite:payments:createLedgerPayment', { sessionToken: currentSessionToken, data })
        },
        cashBank: {
            getCashSummary: () => ipcRenderer.invoke('sqlite:cashBank:getCashSummary', { sessionToken: currentSessionToken }),
            getBankSummary: () => ipcRenderer.invoke('sqlite:cashBank:getBankSummary', { sessionToken: currentSessionToken }),
            getTransactions: (accountType, filters) => ipcRenderer.invoke('sqlite:cashBank:getTransactions', { sessionToken: currentSessionToken, accountType, filters }),
            getTransaction: (id, accountType) => ipcRenderer.invoke('sqlite:cashBank:getTransaction', { sessionToken: currentSessionToken, id, accountType }),
            createTransaction: (data) => ipcRenderer.invoke('sqlite:cashBank:createTransaction', { sessionToken: currentSessionToken, data }),
            updateTransaction: (id, data) => ipcRenderer.invoke('sqlite:cashBank:updateTransaction', { sessionToken: currentSessionToken, id, data }),
            cancelTransaction: (id, accountType) => ipcRenderer.invoke('sqlite:cashBank:cancelTransaction', { sessionToken: currentSessionToken, id, accountType }),
            getOpeningBalance: (accountType) => ipcRenderer.invoke('sqlite:cashBank:getOpeningBalance', { sessionToken: currentSessionToken, accountType }),
            setOpeningBalance: (accountType, amount) => ipcRenderer.invoke('sqlite:cashBank:setOpeningBalance', { sessionToken: currentSessionToken, accountType, amount }),
            transfer: (data) => ipcRenderer.invoke('sqlite:cashBank:transfer', { sessionToken: currentSessionToken, data })
        },
        pettyCash: {
            getSummary: () => ipcRenderer.invoke('sqlite:pettyCash:getSummary', { sessionToken: currentSessionToken }),
            getOpeningBalances: () => ipcRenderer.invoke('sqlite:pettyCash:getOpeningBalances', { sessionToken: currentSessionToken }),
            setOpeningBalances: (cash, bank) => ipcRenderer.invoke('sqlite:pettyCash:setOpeningBalances', { sessionToken: currentSessionToken, cash, bank }),
            getCategories: () => ipcRenderer.invoke('sqlite:pettyCash:getCategories', { sessionToken: currentSessionToken }),
            saveCategories: (cats) => ipcRenderer.invoke('sqlite:pettyCash:saveCategories', { sessionToken: currentSessionToken, cats }),
            getTransactions: (filters) => ipcRenderer.invoke('sqlite:pettyCash:getTransactions', { sessionToken: currentSessionToken, filters }),
            getTransaction: (id) => ipcRenderer.invoke('sqlite:pettyCash:getTransaction', { sessionToken: currentSessionToken, id }),
            createTransaction: (data) => ipcRenderer.invoke('sqlite:pettyCash:createTransaction', { sessionToken: currentSessionToken, data }),
            updateTransaction: (id, data) => ipcRenderer.invoke('sqlite:pettyCash:updateTransaction', { sessionToken: currentSessionToken, id, data }),
            deleteTransaction: (id) => ipcRenderer.invoke('sqlite:pettyCash:deleteTransaction', { sessionToken: currentSessionToken, id }),
            cancelTransaction: (id) => ipcRenderer.invoke('sqlite:pettyCash:cancelTransaction', { sessionToken: currentSessionToken, id })
        },
        dayClosing: {
            getAll: (filters) => ipcRenderer.invoke('sqlite:dayClosing:getAll', { sessionToken: currentSessionToken, filters }),
            get: (id) => ipcRenderer.invoke('sqlite:dayClosing:get', { sessionToken: currentSessionToken, id }),
            getByDate: (dateStr) => ipcRenderer.invoke('sqlite:dayClosing:getByDate', { sessionToken: currentSessionToken, dateStr }),
            save: (data) => ipcRenderer.invoke('sqlite:dayClosing:save', { sessionToken: currentSessionToken, data }),
            delete: (id) => ipcRenderer.invoke('sqlite:dayClosing:delete', { sessionToken: currentSessionToken, id })
        },
        calculator: {
            getHistory: () => ipcRenderer.invoke('sqlite:calculator:getHistory', { sessionToken: currentSessionToken }),
            saveHistory: (expression, result) => ipcRenderer.invoke('sqlite:calculator:saveHistory', { sessionToken: currentSessionToken, expression, result }),
            deleteHistory: (id) => ipcRenderer.invoke('sqlite:calculator:deleteHistory', { sessionToken: currentSessionToken, id }),
            clearAllHistory: () => ipcRenderer.invoke('sqlite:calculator:clearAllHistory', { sessionToken: currentSessionToken })
        },
        reports: {
            getReportSales: (filters) => ipcRenderer.invoke('sqlite:reports:getReportSales', { sessionToken: currentSessionToken, filters }),
            getSummary: (filters) => ipcRenderer.invoke('sqlite:reports:getSummary', { sessionToken: currentSessionToken, filters })
        },
        
        backup: {
            createLocal: (args) => ipcRenderer.invoke('sqlite:backup:createLocal', args),
            listLocal: () => ipcRenderer.invoke('sqlite:backup:listLocal')
        },
        gdrive: {
            getStatus: () => ipcRenderer.invoke('sqlite:gdrive:getStatus'),
            connect: (args) => ipcRenderer.invoke('sqlite:gdrive:connect', args),
            disconnect: () => ipcRenderer.invoke('sqlite:gdrive:disconnect'),
            backupNow: () => ipcRenderer.invoke('sqlite:gdrive:backupNow')
        },
        draftSales: {
            getAll: (args) => ipcRenderer.invoke('sqlite:draftSales:getAll', args),
            save: (args) => ipcRenderer.invoke('sqlite:draftSales:save', args),
            delete: (args) => ipcRenderer.invoke('sqlite:draftSales:delete', args)
        },
        dashboard: {
            getMetrics: (options) => ipcRenderer.invoke('sqlite:dashboard:getMetrics', { sessionToken: currentSessionToken, options })
        }
    }
});

window.addEventListener('DOMContentLoaded', () => {
    console.log('Electron Preload: Application Loaded');
});
