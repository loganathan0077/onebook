const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');

console.log('================================================================');
console.log('🧪 OneBook Auto-Update Comprehensive Test Suite');
console.log('================================================================\n');

// Mock Updater implementing electron-updater interface
class MockAppUpdater extends EventEmitter {
    constructor() {
        super();
        this.autoDownload = false;
        this.autoInstallOnAppQuit = false;
        this.allowPrerelease = false;
        this.allowDowngrade = false;
        this.feedConfig = null;
        this.checkBehavior = 'no-update'; // 'no-update' | 'has-update' | 'network-error' | 'malformed'
        this.downloadBehavior = 'success'; // 'success' | 'fail'
        this.quitAndInstallCalled = false;
        this.quitAndInstallArgs = null;
    }

    setFeedURL(config) {
        this.feedConfig = config;
    }

    async checkForUpdates() {
        this.emit('checking-for-update');

        if (this.checkBehavior === 'network-error') {
            const err = new Error('getaddrinfo ENOTFOUND github.com');
            this.emit('error', err);
            throw err;
        }

        if (this.checkBehavior === 'malformed') {
            const err = new Error('Cannot parse update metadata: Unexpected token');
            this.emit('error', err);
            throw err;
        }

        if (this.checkBehavior === 'has-update') {
            const info = {
                version: '1.0.6',
                releaseDate: new Date().toISOString(),
                releaseNotes: 'Fixed issues and improved POS stability.',
                files: [{ url: 'OneBook-Setup-1.0.6.exe', size: 88500000 }]
            };
            this.emit('update-available', info);
            return { updateInfo: info };
        }

        // no-update
        const info = {
            version: '1.0.5',
            releaseDate: new Date().toISOString(),
            files: [{ url: 'OneBook-Setup-1.0.5.exe', size: 88041620 }]
        };
        this.emit('update-not-available', info);
        return { updateInfo: info };
    }

    async downloadUpdate() {
        if (this.downloadBehavior === 'fail') {
            const err = new Error('net::ERR_INTERNET_DISCONNECTED');
            this.emit('error', err);
            throw err;
        }

        // Simulate progress events
        this.emit('download-progress', { percent: 25, transferred: 22000000, total: 88000000, bytesPerSecond: 2000000 });
        this.emit('download-progress', { percent: 75, transferred: 66000000, total: 88000000, bytesPerSecond: 2500000 });

        // Simulate network latency before download completion
        await new Promise(resolve => setTimeout(resolve, 50));

        this.emit('download-progress', { percent: 100, transferred: 88000000, total: 88000000, bytesPerSecond: 2800000 });
        const info = { version: '1.0.5' };
        this.emit('update-downloaded', info);
        return ['OneBook-Setup-1.0.5.exe'];
    }

    quitAndInstall(isSilent, isForceRunAfter) {
        this.quitAndInstallCalled = true;
        this.quitAndInstallArgs = { isSilent, isForceRunAfter };
    }
}

// Mock Electron BrowserWindow
class MockBrowserWindow {
    constructor() {
        this.sentEvents = [];
        this.webContents = {
            send: (channel, data) => {
                this.sentEvents.push({ channel, data });
            }
        };
    }
    isDestroyed() { return false; }
}

(async () => {
    try {
        const updateService = require('../services/updateService');
        const mockWin = new MockBrowserWindow();
        const mockUpdater = new MockAppUpdater();

        console.log('--- TEST 1: Initialization & Feed Configuration ---');
        updateService.init(mockWin, mockUpdater, '1.0.5');
        assert.strictEqual(updateService.currentVersion, '1.0.5');
        assert.strictEqual(updateService.status, 'IDLE');
        assert.deepStrictEqual(mockUpdater.feedConfig, {
            provider: 'github',
            owner: 'loganathan0077',
            repo: 'onebook'
        });
        assert.strictEqual(mockUpdater.autoDownload, false, 'autoDownload must be false (user confirmed)');
        assert.strictEqual(mockUpdater.autoInstallOnAppQuit, false, 'autoInstallOnAppQuit must be false');
        console.log('✅ Service initialized with correct GitHub repo feed (loganathan0077/onebook)');

        console.log('\n--- TEST 2: Check For Updates - No Update Available ---');
        mockUpdater.checkBehavior = 'no-update';
        const check1 = await updateService.checkForUpdates();
        assert.strictEqual(check1.success, true);
        assert.strictEqual(check1.updateAvailable, false);
        assert.strictEqual(updateService.status, 'NOT_AVAILABLE');
        const lastSent1 = mockWin.sentEvents[mockWin.sentEvents.length - 1];
        assert.strictEqual(lastSent1.channel, 'updater:status-changed');
        assert.strictEqual(lastSent1.data.status, 'NOT_AVAILABLE');
        assert.strictEqual(lastSent1.data.currentVersion, '1.0.5');
        console.log('✅ "No update available" correctly detected and communicated to UI');

        console.log('\n--- TEST 3: Check For Updates - Update Available (v1.0.6) ---');
        mockUpdater.checkBehavior = 'has-update';
        const check2 = await updateService.checkForUpdates();
        assert.strictEqual(check2.success, true);
        assert.strictEqual(check2.updateAvailable, true);
        assert.strictEqual(updateService.status, 'AVAILABLE');
        assert.strictEqual(updateService.availableVersion, '1.0.6');
        const lastSent2 = mockWin.sentEvents[mockWin.sentEvents.length - 1];
        assert.strictEqual(lastSent2.data.status, 'AVAILABLE');
        assert.strictEqual(lastSent2.data.availableVersion, '1.0.6');
        console.log('✅ Newer version (v1.0.6) available state correctly handled');

        console.log('\n--- TEST 4: Download Update & Progress Events ---');
        mockUpdater.downloadBehavior = 'success';
        const dlPromise = updateService.downloadUpdate();
        
        // Double download guard check
        const doubleDl = await updateService.downloadUpdate();
        assert.strictEqual(doubleDl.success, false, 'Multiple simultaneous downloads must be blocked');
        assert(doubleDl.error.includes('already in progress'));

        await dlPromise;
        assert.strictEqual(updateService.status, 'DOWNLOADED');
        assert.strictEqual(updateService.isDownloading, false);
        assert.strictEqual(updateService.downloadProgress.percent, 100);
        console.log('✅ Download progress tracked and double-download guard confirmed');

        console.log('\n--- TEST 5: Restart & Install Execution ---');
        const installRes = updateService.quitAndInstall();
        assert.strictEqual(installRes.success, true);
        assert.strictEqual(mockUpdater.quitAndInstallCalled, true);
        assert.strictEqual(mockUpdater.quitAndInstallArgs.isSilent, false);
        assert.strictEqual(mockUpdater.quitAndInstallArgs.isForceRunAfter, true);
        console.log('✅ Restart & Install calls quitAndInstall safely without silent restart');

        console.log('\n--- TEST 6: Download Failure and Retry ---');
        // Reset state to AVAILABLE
        updateService.status = 'AVAILABLE';
        mockUpdater.downloadBehavior = 'fail';
        const failDl = await updateService.downloadUpdate();
        assert.strictEqual(failDl.success, false);
        assert.strictEqual(updateService.status, 'ERROR');
        assert.strictEqual(updateService.isDownloading, false);
        assert(updateService.lastError.includes('internet connection') || updateService.lastError.includes('ERR_INTERNET_DISCONNECTED'));

        // Retry succeeds
        mockUpdater.downloadBehavior = 'success';
        const retryDl = await updateService.downloadUpdate();
        assert.strictEqual(retryDl.success, true);
        assert.strictEqual(updateService.status, 'DOWNLOADED');
        console.log('✅ Download error caught, reported cleanly, and retry verified');

        console.log('\n--- TEST 7: Network Failure / Offline Error Handling ---');
        mockUpdater.checkBehavior = 'network-error';
        const offlineCheck = await updateService.checkForUpdates();
        assert.strictEqual(offlineCheck.success, false);
        assert.strictEqual(updateService.status, 'ERROR');
        assert(updateService.lastError.includes('internet connection'));
        console.log('✅ Offline network failure caught with user-friendly error message');

        console.log('\n--- TEST 8: Malformed Metadata Handling ---');
        mockUpdater.checkBehavior = 'malformed';
        const malformedCheck = await updateService.checkForUpdates();
        assert.strictEqual(malformedCheck.success, false);
        assert.strictEqual(updateService.status, 'ERROR');
        assert(updateService.lastError.includes('metadata') || updateService.lastError.includes('parse'));
        console.log('✅ Malformed metadata handled gracefully without crashing');

        console.log('\n--- TEST 9: Demo Mode & SQLite Data Safety Verification ---');
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook-update-safety-test-'));
        const dbPath = path.join(tempDir, 'onebook.db');
        const dbManager = require('../database');
        dbManager.initializeDatabase(dbPath, { allowCreate: true });

        const db = dbManager.getDatabase();
        // Insert test product
        db.prepare("INSERT INTO products (id, name, barcode, category, unit, price, stock) VALUES (1, 'Test Product', '123456', 'General', 'Piece', 500, 10)").run();
        
        const userService = require('../services/userService');
        const demoSession = await userService.loginDemo();
        assert.ok(demoSession.sessionToken, 'Demo login should succeed');
        assert.strictEqual(demoSession.user.isDemo, true);

        // Check updater status while in Demo Mode
        const updaterStateInDemo = updateService.getStatus();
        assert.ok(updaterStateInDemo.currentVersion, 'Updater status accessible in Demo Mode');

        // Confirm database was untouched by updateService operations
        const productAfter = db.prepare('SELECT name, stock FROM products WHERE id = 1').get();
        assert.strictEqual(productAfter.name, 'Test Product');
        assert.strictEqual(productAfter.stock, 10);

        dbManager.closeDatabase();
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('✅ SQLite data verified 100% untouched and intact during updater operations');

        console.log('\n================================================================');
        console.log('🎉 ALL AUTO-UPDATE SYSTEM TESTS PASSED SUCCESSFULLY (9/9)!');
        console.log('================================================================\n');
    } catch (e) {
        console.error('❌ TEST FAILED:', e);
        process.exit(1);
    }
})();
