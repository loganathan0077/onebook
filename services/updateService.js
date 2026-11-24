/**
 * OneBook Auto-Update Service
 * Manages GitHub-based application updates using electron-updater.
 */

const { EventEmitter } = require('events');

class UpdateService extends EventEmitter {
    constructor() {
        super();
        this.mainWindow = null;
        this.autoUpdater = null;
        this.status = 'IDLE'; // IDLE | CHECKING | AVAILABLE | NOT_AVAILABLE | DOWNLOADING | DOWNLOADED | ERROR
        this.currentVersion = '1.0.6';
        this.availableVersion = null;
        this.updateInfo = null;
        this.downloadProgress = null;
        this.lastError = null;
        this.isDownloading = false;
        this.isInitialized = false;

        // Default GitHub update feed configuration
        this.feedConfig = {
            provider: 'github',
            owner: 'loganathan0077',
            repo: 'onebook'
        };
    }

    /**
     * Initialize autoUpdater with configuration and event handlers
     * @param {BrowserWindow} mainWindow
     * @param {Object} [customUpdater] - Optional dependency injection for testing
     * @param {string} [appVersion] - Optional version override
     */
    init(mainWindow, customUpdater = null, appVersion = null) {
        this.mainWindow = mainWindow;
        if (appVersion) {
            this.currentVersion = appVersion;
        } else {
            try {
                const { app } = require('electron');
                if (app && typeof app.getVersion === 'function') {
                    this.currentVersion = app.getVersion();
                }
            } catch (e) {
                // Keep default or package.json version
            }
        }

        if (customUpdater) {
            this.autoUpdater = customUpdater;
        } else {
            try {
                const { autoUpdater } = require('electron-updater');
                this.autoUpdater = autoUpdater;
            } catch (e) {
                console.warn('[UpdateService] Failed to load electron-updater:', e.message);
                return;
            }
        }

        if (!this.autoUpdater) return;

        // Configure updater behavior
        this.autoUpdater.autoDownload = false;
        this.autoUpdater.autoInstallOnAppQuit = false;
        this.autoUpdater.allowPrerelease = false;
        this.autoUpdater.allowDowngrade = false;

        try {
            if (typeof this.autoUpdater.setFeedURL === 'function') {
                this.autoUpdater.setFeedURL(this.feedConfig);
            }
        } catch (e) {
            console.warn('[UpdateService] setFeedURL error:', e.message);
        }

        // Attach event listeners
        this.attachEvents();
        this.isInitialized = true;
        console.log(`[UpdateService] Initialized for version ${this.currentVersion} (Feed: ${this.feedConfig.owner}/${this.feedConfig.repo})`);
    }

    setMainWindow(win) {
        this.mainWindow = win;
    }

    attachEvents() {
        if (!this.autoUpdater) return;

        this.autoUpdater.on('checking-for-update', () => {
            this.status = 'CHECKING';
            this.lastError = null;
            this.notifyState();
            this.emit('checking-for-update');
        });

        this.autoUpdater.on('update-available', (info) => {
            this.status = 'AVAILABLE';
            this.updateInfo = info;
            this.availableVersion = info?.version || null;
            this.lastError = null;
            this.notifyState();
            this.emit('update-available', info);
        });

        this.autoUpdater.on('update-not-available', (info) => {
            this.status = 'NOT_AVAILABLE';
            this.updateInfo = info;
            this.availableVersion = null;
            this.lastError = null;
            this.notifyState();
            this.emit('update-not-available', info);
        });

        this.autoUpdater.on('download-progress', (progressObj) => {
            this.status = 'DOWNLOADING';
            this.isDownloading = true;
            this.downloadProgress = {
                percent: Math.min(100, Math.max(0, Math.round(progressObj.percent || 0))),
                transferred: progressObj.transferred || 0,
                total: progressObj.total || 0,
                bytesPerSecond: progressObj.bytesPerSecond || 0
            };
            this.notifyState();
            this.emit('download-progress', this.downloadProgress);
        });

        this.autoUpdater.on('update-downloaded', (info) => {
            this.status = 'DOWNLOADED';
            this.isDownloading = false;
            this.updateInfo = info;
            this.downloadProgress = { percent: 100, transferred: 100, total: 100, bytesPerSecond: 0 };
            this.lastError = null;
            this.notifyState();
            this.emit('update-downloaded', info);
        });

        this.autoUpdater.on('error', (err) => {
            this.status = 'ERROR';
            this.isDownloading = false;
            const rawMsg = err?.message || String(err || 'Unknown update error');
            
            // Clean up network / connection error messages for user presentation
            if (rawMsg.includes('ENOTFOUND') || rawMsg.includes('net::ERR_INTERNET_DISCONNECTED') || rawMsg.includes('ERR_NAME_NOT_RESOLVED')) {
                this.lastError = 'Unable to reach the update server. Please check your internet connection.';
            } else if (rawMsg.includes('404')) {
                this.lastError = 'Update metadata not found on release server.';
            } else {
                this.lastError = rawMsg;
            }

            this.notifyState();
            this.emit('error', this.lastError);
        });
    }

    notifyState() {
        const state = this.getStatus();
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
            try {
                this.mainWindow.webContents.send('updater:status-changed', state);
            } catch (e) {
                // Non-fatal if renderer unavailable
            }
        }
    }

    getStatus() {
        return {
            status: this.status,
            currentVersion: this.currentVersion,
            availableVersion: this.availableVersion,
            updateInfo: this.updateInfo ? {
                version: this.updateInfo.version,
                releaseDate: this.updateInfo.releaseDate,
                releaseNotes: this.updateInfo.releaseNotes
            } : null,
            progress: this.downloadProgress,
            error: this.lastError,
            isDownloading: this.isDownloading
        };
    }

    /**
     * Check for available updates
     */
    async checkForUpdates() {
        if (this.isDownloading) {
            return { success: false, error: 'A download is already in progress.' };
        }

        if (!this.autoUpdater) {
            this.status = 'ERROR';
            this.lastError = 'Updater component is not available.';
            this.notifyState();
            return { success: false, error: this.lastError };
        }

        this.status = 'CHECKING';
        this.lastError = null;
        this.notifyState();

        try {
            const checkResult = await this.autoUpdater.checkForUpdates();
            return {
                success: true,
                updateAvailable: Boolean(checkResult?.updateInfo && checkResult.updateInfo.version !== this.currentVersion),
                updateInfo: checkResult?.updateInfo || null
            };
        } catch (err) {
            // Error event handler will also catch this, but return friendly error
            const errStr = err?.message || String(err);
            let userFriendly = errStr;
            if (errStr.includes('ENOTFOUND') || errStr.includes('net::ERR_') || errStr.includes('connect')) {
                userFriendly = 'Unable to check for updates. Please check your internet connection.';
            }
            this.status = 'ERROR';
            this.lastError = userFriendly;
            this.notifyState();
            return { success: false, error: userFriendly };
        }
    }

    /**
     * Download the available update
     */
    async downloadUpdate() {
        if (this.isDownloading) {
            return { success: false, error: 'Download is already in progress.' };
        }

        if (this.status !== 'AVAILABLE' && this.status !== 'ERROR') {
            return { success: false, error: 'No update available to download.' };
        }

        if (!this.autoUpdater || typeof this.autoUpdater.downloadUpdate !== 'function') {
            return { success: false, error: 'Download method not supported.' };
        }

        this.isDownloading = true;
        this.status = 'DOWNLOADING';
        this.lastError = null;
        this.notifyState();

        try {
            await this.autoUpdater.downloadUpdate();
            return { success: true };
        } catch (err) {
            this.isDownloading = false;
            this.status = 'ERROR';
            this.lastError = err?.message || 'Download failed. Please try again.';
            this.notifyState();
            return { success: false, error: this.lastError };
        }
    }

    /**
     * Quit application and install the downloaded update
     */
    quitAndInstall() {
        if (this.status !== 'DOWNLOADED') {
            return { success: false, error: 'Update has not been downloaded yet.' };
        }

        if (!this.autoUpdater || typeof this.autoUpdater.quitAndInstall !== 'function') {
            return { success: false, error: 'Installer method not available.' };
        }

        console.log('[UpdateService] Restarting application to apply update...');
        // isSilent: false, isForceRunAfter: true
        try {
            this.autoUpdater.quitAndInstall(false, true);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message || 'Failed to trigger installer.' };
        }
    }
}

module.exports = new UpdateService();

