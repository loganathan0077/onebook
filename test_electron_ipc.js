const { app, ipcMain } = require('electron');
const path = require('path');

// Override app.getPath to point to the real onebook appData if needed
// Actually, I can just require main.js? No, it starts the whole app.
