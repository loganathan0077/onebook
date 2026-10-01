const { ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('get-license-info-sync');
console.log(info);
