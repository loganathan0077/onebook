
window.DATA_BACKEND = 'sqlite'; // Set default for Mac test environment
window.dataStore = window.DATA_BACKEND === 'sqlite' ? new window.SqliteDataStore() : new window.JsonDataStore();
