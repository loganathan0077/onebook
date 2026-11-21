const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const os = require('os');

let autoUpdater = null;
try {
    const eu = require('electron-updater');
    autoUpdater = eu.autoUpdater;
} catch (e) {
    console.log('[Updater] electron-updater not loaded in this environment:', e.message);
}

function compareVersions(v1, v2) {
    const clean1 = (v1 || '').replace(/^v/, '').trim();
    const clean2 = (v2 || '').replace(/^v/, '').trim();
    const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
    const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

/**
 * Validate that download URLs strictly originate from trusted official release endpoints.
 */
function isTrustedDownloadUrl(urlString) {
    try {
        const u = new URL(urlString);
        const host = u.hostname.toLowerCase();
        // Official GitHub Releases
        if (host === 'github.com' && u.pathname.startsWith('/loganathan0077/onebook/releases/download/')) {
            return true;
        }
        // Official GitHub CDN asset redirects
        if (host === 'objects.githubusercontent.com') {
            return true;
        }
        // Official Branded Download Endpoint
        if (host === 'download.doodlesstore.in' && (u.pathname === '/onebook' || u.pathname.startsWith('/onebook/'))) {
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

class UpdaterService {
    constructor() {
        this.status = 'idle'; // idle | checking | up-to-date | available | downloading | downloaded | error
        this.currentVersion = (app && typeof app.getVersion === 'function') ? app.getVersion() : '1.0.3';
        this.latestVersion = null;
        this.releaseNotes = null;
        this.downloadUrl = null;
        this.downloadedFilePath = null;
        this.expectedSha512 = null;
        this.updateEngine = null; // 'electron-updater' | 'direct' | null
        this.progress = {
            percent: 0,
            transferred: 0,
            total: 0,
            bytesPerSecond: 0
        };
        this.error = null;
        this.isDownloading = false;
        this.activeRequest = null;
    }

    broadcast(channel, data) {
        if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== 'function') return;
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, data);
            }
        }
    }

    emitStatus(status, extra = {}) {
        this.status = status;
        const payload = {
            status: this.status,
            currentVersion: this.currentVersion,
            latestVersion: this.latestVersion,
            releaseNotes: this.releaseNotes,
            downloadUrl: this.downloadUrl,
            error: this.error,
            progress: this.progress,
            updateEngine: this.updateEngine,
            ...extra
        };
        this.broadcast('updater:status', payload);
        return payload;
    }

    emitProgress(progress) {
        this.progress = { ...this.progress, ...progress };
        this.broadcast('updater:progress', this.progress);
    }

    init() {
        // Configure electron-updater if available and packaged
        if (autoUpdater && app.isPackaged) {
            autoUpdater.autoDownload = false;
            autoUpdater.autoInstallOnAppQuit = false;

            autoUpdater.on('checking-for-update', () => {
                this.error = null;
                this.emitStatus('checking');
            });

            autoUpdater.on('update-available', (info) => {
                this.updateEngine = 'electron-updater';
                this.latestVersion = info.version;
                this.releaseNotes = info.releaseNotes || 'A new update is available for OneBook.';
                this.emitStatus('available', { info });
            });

            autoUpdater.on('update-not-available', (info) => {
                this.latestVersion = info?.version || this.currentVersion;
                this.emitStatus('up-to-date');
            });

            autoUpdater.on('download-progress', (progressObj) => {
                this.emitProgress({
                    percent: Math.round(progressObj.percent || 0),
                    transferred: progressObj.transferred || 0,
                    total: progressObj.total || 0,
                    bytesPerSecond: progressObj.bytesPerSecond || 0
                });
            });

            autoUpdater.on('update-downloaded', (info) => {
                this.isDownloading = false;
                this.emitStatus('downloaded', { info });
            });

            autoUpdater.on('error', (err) => {
                console.warn('[electron-updater error, falling back to GitHub API]:', err?.message);
                this.error = err ? (err.message || String(err)) : 'Update service error';
                this.updateEngine = 'direct';
                // Fall back to direct GitHub release check
                this.checkViaGithub();
            });
        }

        // Register IPC handlers
        ipcMain.handle('updater:check', async () => {
            return await this.checkForUpdates();
        });

        ipcMain.handle('updater:download', async () => {
            return await this.downloadUpdate();
        });

        ipcMain.handle('updater:install', async () => {
            return await this.installUpdate();
        });

        ipcMain.handle('updater:getStatus', () => {
            return {
                status: this.status,
                currentVersion: this.currentVersion,
                latestVersion: this.latestVersion,
                releaseNotes: this.releaseNotes,
                downloadUrl: this.downloadUrl,
                error: this.error,
                progress: this.progress,
                updateEngine: this.updateEngine
            };
        });
    }

    async checkForUpdates() {
        this.error = null;
        this.emitStatus('checking');

        if (autoUpdater && app.isPackaged) {
            try {
                this.updateEngine = 'electron-updater';
                const checkRes = await autoUpdater.checkForUpdates();
                if (checkRes && checkRes.updateInfo) {
                    this.latestVersion = checkRes.updateInfo.version;
                    const cmp = compareVersions(this.latestVersion, this.currentVersion);
                    if (cmp > 0) {
                        return { success: true, status: 'available', version: this.latestVersion };
                    } else {
                        return { success: true, status: 'up-to-date', version: this.currentVersion };
                    }
                }
            } catch (err) {
                console.warn('[electron-updater] Check failed, trying GitHub API directly:', err.message);
                this.updateEngine = 'direct';
            }
        }

        this.updateEngine = 'direct';
        return await this.checkViaGithub();
    }

    async fetchExpectedChecksum(latestYmlUrl) {
        if (!latestYmlUrl || !isTrustedDownloadUrl(latestYmlUrl)) return;
        return new Promise((resolve) => {
            const req = https.get(latestYmlUrl, {
                headers: { 'User-Agent': 'OneBook-Desktop-App/' + this.currentVersion }
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    this.fetchExpectedChecksum(res.headers.location).then(resolve);
                    return;
                }
                if (res.statusCode === 200) {
                    let text = '';
                    res.on('data', chunk => { text += chunk; });
                    res.on('end', () => {
                        const m = text.match(/sha512:\s*([A-Za-z0-9+/=]+)/);
                        if (m && m[1]) {
                            this.expectedSha512 = m[1].trim();
                        }
                        resolve(this.expectedSha512);
                    });
                } else {
                    resolve(null);
                }
            });
            req.on('error', () => resolve(null));
            req.setTimeout(5000, () => { req.destroy(); resolve(null); });
        });
    }

    async checkViaGithub() {
        return new Promise((resolve) => {
            const options = {
                hostname: 'api.github.com',
                path: '/repos/loganathan0077/onebook/releases/latest',
                method: 'GET',
                headers: {
                    'User-Agent': 'OneBook-Desktop-App/' + this.currentVersion,
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            throw new Error(`GitHub Release API returned status ${res.statusCode}`);
                        }
                        const release = JSON.parse(data);
                        const tag = release.tag_name || release.name || '';
                        const cleanVersion = tag.replace(/^v/, '').trim();
                        this.latestVersion = cleanVersion;
                        this.releaseNotes = release.body || 'A new update is available for OneBook.';

                        // Find Windows x64 installer asset and latest.yml
                        let assetUrl = null;
                        if (Array.isArray(release.assets)) {
                            const latestYmlAsset = release.assets.find(a => (a.name || '').toLowerCase() === 'latest.yml');
                            if (latestYmlAsset && latestYmlAsset.browser_download_url) {
                                this.fetchExpectedChecksum(latestYmlAsset.browser_download_url).catch(() => {});
                            }

                            const exeAsset = release.assets.find(a => {
                                const n = (a.name || '').toLowerCase();
                                return n.endsWith('.exe') && !n.includes('blockmap') && (n.includes('setup') || n.includes('x64') || !n.includes('ia32'));
                            });
                            if (exeAsset) assetUrl = exeAsset.browser_download_url;
                        }

                        if (!assetUrl) {
                            assetUrl = 'https://download.doodlesstore.in/onebook';
                        }
                        this.downloadUrl = assetUrl;

                        const cmp = compareVersions(cleanVersion, this.currentVersion);
                        if (cmp > 0) {
                            this.emitStatus('available');
                            resolve({ success: true, status: 'available', version: cleanVersion });
                        } else {
                            this.emitStatus('up-to-date');
                            resolve({ success: true, status: 'up-to-date', version: cleanVersion });
                        }
                    } catch (e) {
                        this.error = e.message;
                        this.emitStatus('error');
                        resolve({ success: false, error: e.message });
                    }
                });
            });

            req.on('error', (err) => {
                this.error = err.message || 'Network error while checking for updates.';
                this.emitStatus('error');
                resolve({ success: false, error: this.error });
            });

            req.on('timeout', () => {
                req.destroy();
                this.error = 'Request timed out while checking for updates.';
                this.emitStatus('error');
                resolve({ success: false, error: this.error });
            });

            req.end();
        });
    }

    async downloadUpdate() {
        if (this.isDownloading) {
            return { success: false, error: 'Download is already in progress.' };
        }

        // Mutual exclusion: if electron-updater is handling it, run through electron-updater
        if (this.updateEngine === 'electron-updater' && autoUpdater && app.isPackaged && !this.downloadUrl) {
            try {
                this.isDownloading = true;
                this.emitStatus('downloading');
                await autoUpdater.downloadUpdate();
                return { success: true };
            } catch (err) {
                console.warn('[electron-updater download failed, falling back to direct]:', err.message);
                this.isDownloading = false;
                this.updateEngine = 'direct';
            }
        }

        this.updateEngine = 'direct';
        const targetUrl = this.downloadUrl || 'https://download.doodlesstore.in/onebook';
        const tempDir = (app && typeof app.getPath === 'function') ? app.getPath('temp') : os.tmpdir();
        const baseFileName = `OneBook-Setup-${this.latestVersion || 'update'}.exe`;
        const tempPath = path.join(tempDir, baseFileName);
        const partPath = tempPath + '.part';

        // Clean any leftover previous .part file
        if (fs.existsSync(partPath)) {
            try { fs.unlinkSync(partPath); } catch (e) {}
        }

        this.isDownloading = true;
        this.emitStatus('downloading');

        return new Promise((resolve) => {
            const startTime = Date.now();
            let lastProgressTime = startTime;
            let lastBytes = 0;

            const downloadHelper = (currentUrl, redirectsLeft = 5) => {
                if (redirectsLeft <= 0) {
                    this.isDownloading = false;
                    this.error = 'Too many redirects while downloading update installer.';
                    this.emitStatus('error');
                    resolve({ success: false, error: this.error });
                    return;
                }

                if (!isTrustedDownloadUrl(currentUrl)) {
                    this.isDownloading = false;
                    this.error = `Rejected untrusted download source: ${currentUrl}`;
                    this.emitStatus('error');
                    resolve({ success: false, error: this.error });
                    return;
                }

                const urlObj = new URL(currentUrl);
                const client = urlObj.protocol === 'https:' ? https : http;

                const req = client.get(currentUrl, {
                    headers: { 'User-Agent': 'OneBook-Desktop-App/' + this.currentVersion }
                }, (res) => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        const redirectUrl = new URL(res.headers.location, currentUrl).href;
                        downloadHelper(redirectUrl, redirectsLeft - 1);
                        return;
                    }

                    if (res.statusCode !== 200) {
                        this.isDownloading = false;
                        this.error = `Download failed with HTTP status ${res.statusCode}`;
                        this.emitStatus('error');
                        resolve({ success: false, error: this.error });
                        return;
                    }

                    const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
                    let transferred = 0;

                    const fileStream = fs.createWriteStream(partPath);
                    const hash = crypto.createHash('sha512');

                    res.on('data', (chunk) => {
                        transferred += chunk.length;
                        hash.update(chunk);

                        const now = Date.now();
                        if (now - lastProgressTime >= 300 || transferred === totalBytes) {
                            const timeDeltaSec = (now - lastProgressTime) / 1000;
                            const bytesDelta = transferred - lastBytes;
                            const bytesPerSecond = timeDeltaSec > 0 ? Math.round(bytesDelta / timeDeltaSec) : 0;
                            const percent = totalBytes > 0 ? Math.round((transferred / totalBytes) * 100) : 0;

                            lastProgressTime = now;
                            lastBytes = transferred;

                            this.emitProgress({
                                percent,
                                transferred,
                                total: totalBytes,
                                bytesPerSecond
                            });
                        }
                    });

                    res.pipe(fileStream);

                    fileStream.on('finish', () => {
                        fileStream.close(() => {
                            try {
                                const stats = fs.statSync(partPath);

                                // Safety Check 1: Minimum file size (Windows installer is ~80+ MB; HTML or truncated files fail this)
                                if (stats.size < 30 * 1024 * 1024) {
                                    throw new Error(`Incomplete installer downloaded (${(stats.size / 1024 / 1024).toFixed(1)} MB). Expected complete Windows executable.`);
                                }

                                // Safety Check 2: Windows PE executable magic header ('MZ')
                                const fd = fs.openSync(partPath, 'r');
                                const magic = Buffer.alloc(2);
                                fs.readSync(fd, magic, 0, 2, 0);
                                fs.closeSync(fd);
                                if (magic.toString('ascii') !== 'MZ') {
                                    throw new Error('Downloaded file is not a valid Windows executable (magic header mismatch).');
                                }

                                // Safety Check 3: Verify SHA-512 checksum if available from latest.yml
                                const computedBase64 = hash.digest('base64');
                                if (this.expectedSha512) {
                                    if (computedBase64 !== this.expectedSha512) {
                                        throw new Error(`SHA-512 integrity verification failed (got ${computedBase64}, expected ${this.expectedSha512}).`);
                                    }
                                }

                                // Atomic promotion from .part to final target .exe
                                if (fs.existsSync(tempPath)) {
                                    try { fs.unlinkSync(tempPath); } catch (e) {}
                                }
                                fs.renameSync(partPath, tempPath);
                                this.downloadedFilePath = tempPath;
                                this.isDownloading = false;

                                this.emitProgress({
                                    percent: 100,
                                    transferred: stats.size,
                                    total: stats.size,
                                    bytesPerSecond: 0
                                });
                                this.emitStatus('downloaded', { sha512: computedBase64 });
                                resolve({ success: true, filePath: tempPath, sha512: computedBase64 });
                            } catch (validationErr) {
                                if (fs.existsSync(partPath)) {
                                    try { fs.unlinkSync(partPath); } catch (e) {}
                                }
                                this.isDownloading = false;
                                this.error = validationErr.message;
                                this.emitStatus('error');
                                resolve({ success: false, error: validationErr.message });
                            }
                        });
                    });

                    fileStream.on('error', (err) => {
                        if (fs.existsSync(partPath)) {
                            try { fs.unlinkSync(partPath); } catch (e) {}
                        }
                        this.isDownloading = false;
                        this.error = err.message;
                        this.emitStatus('error');
                        resolve({ success: false, error: err.message });
                    });
                });

                req.on('error', (err) => {
                    if (fs.existsSync(partPath)) {
                        try { fs.unlinkSync(partPath); } catch (e) {}
                    }
                    this.isDownloading = false;
                    this.error = err.message || 'Download network error';
                    this.emitStatus('error');
                    resolve({ success: false, error: this.error });
                });

                this.activeRequest = req;
            };

            downloadHelper(targetUrl);
        });
    }

    async installUpdate() {
        if (this.updateEngine === 'electron-updater' && autoUpdater && app.isPackaged && !this.downloadedFilePath) {
            try {
                autoUpdater.quitAndInstall(false, true);
                return { success: true };
            } catch (err) {
                console.warn('[electron-updater quitAndInstall failed]:', err.message);
            }
        }

        if (this.downloadedFilePath && fs.existsSync(this.downloadedFilePath)) {
            try {
                // Final verification: Confirm file is a genuine Windows PE executable before running
                const fd = fs.openSync(this.downloadedFilePath, 'r');
                const magic = Buffer.alloc(2);
                fs.readSync(fd, magic, 0, 2, 0);
                fs.closeSync(fd);
                if (magic.toString('ascii') !== 'MZ') {
                    throw new Error('Downloaded installer failed executable validation before launch.');
                }

                if (process.platform === 'win32') {
                    const child = spawn(this.downloadedFilePath, ['--updated'], {
                        detached: true,
                        stdio: 'ignore'
                    });
                    child.unref();
                    app.quit();
                    return { success: true };
                } else {
                    console.log('[Updater] Validated Windows update installer ready at:', this.downloadedFilePath);
                    return { success: true, message: 'Installer verified at ' + this.downloadedFilePath };
                }
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        return { success: false, error: 'No downloaded update installer found to run.' };
    }
}

module.exports = new UpdaterService();
