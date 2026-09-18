const fs = require('fs');
let preloadCode = fs.readFileSync('preload.js', 'utf8');

const newMethods = `
    getDbConfigSync: () => ipcRenderer.sendSync('get-db-config-sync'),
    setDbConfigSync: (folderPath) => ipcRenderer.sendSync('set-db-config-sync', folderPath),
    getDefaultDbFolderSync: () => ipcRenderer.sendSync('get-default-db-folder-sync'),
    ensureFolderSync: (folderPath) => ipcRenderer.sendSync('ensure-folder-sync', folderPath),
    checkFolderHasDataSync: (folderPath) => ipcRenderer.sendSync('check-folder-has-data-sync', folderPath),
`;

preloadCode = preloadCode.replace('createBackupSync: (args) => ipcRenderer.sendSync(\'create-backup-sync\', args)', 'createBackupSync: (args) => ipcRenderer.sendSync(\'create-backup-sync\', args),' + newMethods);

fs.writeFileSync('preload.js', preloadCode, 'utf8');
