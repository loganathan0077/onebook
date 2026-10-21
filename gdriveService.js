
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { app, shell } = require('electron');
const Database = require('better-sqlite3');
const backupService = require('./backupService');

class GoogleDriveService {
    constructor() {
        this.configPath = path.join(app ? app.getPath('userData') : '/Users/log/Library/Application Support/OneBook', 'gdrive_config.json');
        this.tokensPath = path.join(app ? app.getPath('userData') : '/Users/log/Library/Application Support/OneBook', 'gdrive_tokens.enc');
        this.authServer = null;
    }

    getConfig() {
        if (fs.existsSync(this.configPath)) {
            try { return JSON.parse(fs.readFileSync(this.configPath, 'utf8')); } catch(e){}
        }
        return {
            clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
            configured: false
        };
    }

    saveConfig(cfg) {
        fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2), 'utf8');
    }

    getEncryptionKey() {
        // Deterministic machine-based encryption key
        const secret = 'OneBook-Secure-Key-' + (process.env.USER || 'log');
        return crypto.createHash('sha256').update(secret).digest();
    }

    saveTokens(tokens) {
        const key = this.getEncryptionKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let enc = cipher.update(JSON.stringify(tokens), 'utf8', 'hex');
        enc += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        const payload = JSON.stringify({ iv: iv.toString('hex'), tag: authTag, data: enc });
        fs.writeFileSync(this.tokensPath, payload, 'utf8');
    }

    getTokens() {
        if (!fs.existsSync(this.tokensPath)) return null;
        try {
            const payload = JSON.parse(fs.readFileSync(this.tokensPath, 'utf8'));
            const key = this.getEncryptionKey();
            const iv = Buffer.from(payload.iv, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
            let dec = decipher.update(payload.data, 'hex', 'utf8');
            dec += decipher.final('utf8');
            return JSON.parse(dec);
        } catch(e) {
            console.error('[GDrive Token Read Error]:', e.message);
            return null;
        }
    }

    isConnected() {
        const tokens = this.getTokens();
        return !!(tokens && (tokens.access_token || tokens.refresh_token));
    }

    getStatus() {
        const tokens = this.getTokens();
        const config = this.getConfig();
        const isConn = this.isConnected();
        
        let lastBackupInfo = null;
        const metaPath = path.join(backupService.backupDir, 'gdrive_last_backup.json');
        if (fs.existsSync(metaPath)) {
            try { lastBackupInfo = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e){}
        }

        return {
            connected: isConn,
            configured: !!(config.clientId && config.clientSecret),
            clientId: config.clientId ? config.clientId.substring(0, 15) + '...' : null,
            lastBackup: lastBackupInfo
        };
    }

    disconnect() {
        if (fs.existsSync(this.tokensPath)) {
            fs.unlinkSync(this.tokensPath);
        }
        return { success: true };
    }

    async startAuthFlow(clientId, clientSecret) {
        if (clientId && clientSecret) {
            this.saveConfig({ clientId, clientSecret, configured: true });
        }
        const cfg = this.getConfig();
        if (!cfg.clientId || !cfg.clientSecret) {
            return {
                success: false,
                error: 'CREDENTIALS_REQUIRED',
                message: 'Google Cloud OAuth Client ID and Secret are required. Please configure them in Google Cloud Console.'
            };
        }

        return new Promise((resolve) => {
            const redirectUri = 'http://127.0.0.1:45678/oauth2callback';
            const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file');
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(cfg.clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

            if (this.authServer) {
                try { this.authServer.close(); } catch(e){}
            }

            this.authServer = http.createServer(async (req, res) => {
                if (req.url && req.url.startsWith('/oauth2callback')) {
                    const u = new URL(req.url, 'http://127.0.0.1:45678');
                    const code = u.searchParams.get('code');
                    const error = u.searchParams.get('error');

                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('<h1>Authorization Successful!</h1><p>You can close this browser window and return to OneBook.</p>');
                        this.authServer.close();
                        this.authServer = null;

                        try {
                            const tokens = await this.exchangeCodeForTokens(code, cfg.clientId, cfg.clientSecret, redirectUri);
                            this.saveTokens(tokens);
                            resolve({ success: true, message: 'Google Drive connected successfully' });
                        } catch(err) {
                            resolve({ success: false, error: err.message });
                        }
                    } else {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end('<h1>Authorization Failed</h1><p>' + (error || 'Unknown error') + '</p>');
                        this.authServer.close();
                        this.authServer = null;
                        resolve({ success: false, error: error || 'OAuth authorization denied' });
                    }
                }
            });

            this.authServer.listen(45678, '127.0.0.1', () => {
                shell.openExternal(authUrl);
            });

            setTimeout(() => {
                if (this.authServer) {
                    this.authServer.close();
                    this.authServer = null;
                    resolve({ success: false, error: 'TIMEOUT', message: 'Authentication timed out after 2 minutes' });
                }
            }, 120000);
        });
    }

    async exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
        return new Promise((resolve, reject) => {
            const body = new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            }).toString();

            const req = https.request('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) return reject(new Error(parsed.error_description || parsed.error));
                        resolve(parsed);
                    } catch(e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    async getAccessToken() {
        const tokens = this.getTokens();
        if (!tokens) throw new Error('Google Drive is not connected');

        // Check if current access token is valid or refresh
        if (tokens.access_token && (!tokens.expiry_date || tokens.expiry_date > Date.now() + 60000)) {
            return tokens.access_token;
        }

        if (!tokens.refresh_token) {
            throw new Error('Refresh token missing. Please reconnect Google Drive.');
        }

        const cfg = this.getConfig();
        const refreshed = await new Promise((resolve, reject) => {
            const body = new URLSearchParams({
                refresh_token: tokens.refresh_token,
                client_id: cfg.clientId,
                client_secret: cfg.clientSecret,
                grant_type: 'refresh_token'
            }).toString();

            const req = https.request('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) return reject(new Error(parsed.error_description || parsed.error));
                        resolve(parsed);
                    } catch(e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });

        tokens.access_token = refreshed.access_token;
        if (refreshed.expires_in) {
            tokens.expiry_date = Date.now() + (refreshed.expires_in * 1000);
        }
        this.saveTokens(tokens);
        return tokens.access_token;
    }

    async uploadBackup(localBackupResult) {
        if (!this.isConnected()) {
            return { success: false, error: 'NOT_CONNECTED', message: 'Google Drive is not connected' };
        }

        const token = await this.getAccessToken();
        const filePath = localBackupResult.filePath;
        const fileName = path.basename(filePath);
        const fileSize = fs.statSync(filePath).size;

        // Ensure folder 'OneBook_Backups'
        const folderId = await this.getOrCreateFolder(token, 'OneBook_Backups');

        // Upload file via multipart upload
        const boundary = '-------314159265358979323846';
        const delimiter = '\r\n--' + boundary + '\r\n';
        const closeDelimiter = '\r\n--' + boundary + '--';

        const metadata = {
            name: fileName,
            parents: [folderId],
            description: 'OneBook SQLite Verified Backup'
        };

        const fileBuffer = fs.readFileSync(filePath);

        const postData = Buffer.concat([
            Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: application/octet-stream\r\n\r\n'),
            fileBuffer,
            Buffer.from(closeDelimiter)
        ]);

        const uploadRes = await new Promise((resolve, reject) => {
            const req = https.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'multipart/related; boundary=' + boundary,
                    'Content-Length': postData.length
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
                        resolve(parsed);
                    } catch(e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        // Record last successful cloud backup
        const cloudMeta = {
            fileId: uploadRes.id,
            fileName: uploadRes.name,
            fileSize: fileSize,
            timestamp: new Date().toISOString(),
            status: 'success'
        };
        const metaPath = path.join(backupService.backupDir, 'gdrive_last_backup.json');
        fs.writeFileSync(metaPath, JSON.stringify(cloudMeta, null, 2), 'utf8');

        console.log('[GDrive] Cloud backup successful. File ID:', uploadRes.id);
        return { success: true, file: cloudMeta };
    }

    async getOrCreateFolder(token, folderName) {
        // Search folder
        const q = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
        const searchRes = await new Promise((resolve, reject) => {
            https.get(`https://www.googleapis.com/drive/v3/files?q=${q}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch(e){ reject(e); }
                });
            }).on('error', reject);
        });

        if (searchRes.files && searchRes.files.length > 0) {
            return searchRes.files[0].id;
        }

        // Create folder
        const createRes = await new Promise((resolve, reject) => {
            const body = JSON.stringify({
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder'
            });
            const req = https.request('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch(e){ reject(e); }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });

        return createRes.id;
    }
}

module.exports = new GoogleDriveService();
