
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dbManager = require('./database');

const BACKUP_DIR = '/Users/log/Documents/OneBook/Database/Backups';

class BackupService {
    constructor() {
        this.backupDir = BACKUP_DIR;
        this.isBackingUp = false;
        this.timer = null;
        this.ensureBackupDir();
    }

    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async createBackup(reason = 'manual', prefix = 'OneBook_Backup') {
        if (this.isBackingUp) {
            return { success: false, error: 'BACKUP_IN_PROGRESS', message: 'A backup is already in progress' };
        }
        this.isBackingUp = true;
        try {
            this.ensureBackupDir();
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-');
            const fileName = `${prefix}_${timestamp}.db`;
            const filePath = path.join(this.backupDir, fileName);

            const activeDbPath = dbManager.getDatabasePath();
            if (!activeDbPath || !fs.existsSync(activeDbPath)) {
                throw new Error('Active SQLite database is not available');
            }

            const db = dbManager.getDatabase();
            await db.backup(filePath);

            // Verify backup with integrity check & foreign key check
            const vDb = new Database(filePath, { readonly: true });
            const integrity = vDb.prepare('PRAGMA integrity_check').all();
            const fkCheck = vDb.prepare('PRAGMA foreign_key_check').all();
            vDb.close();

            if (integrity[0].integrity_check !== 'ok' || fkCheck.length > 0) {
                fs.unlinkSync(filePath);
                throw new Error('Backup failed integrity or foreign key verification');
            }

            const stat = fs.statSync(filePath);
            const metadata = {
                timestamp: now.toISOString(),
                fileName,
                filePath,
                fileSize: stat.size,
                reason,
                verified: true
            };

            // Save metadata
            const metaPath = path.join(this.backupDir, 'backups_meta.json');
            let metaList = [];
            if (fs.existsSync(metaPath)) {
                try { metaList = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e){}
            }
            metaList.unshift(metadata);
            
            // Retention: keep latest 15 backups, but never delete baseline or recovery DBs
            if (metaList.length > 15) {
                const toPrune = metaList.splice(15);
                toPrune.forEach(b => {
                    try {
                        if (fs.existsSync(b.filePath) && !b.filePath.includes('baseline') && !b.filePath.includes('c18')) {
                            fs.unlinkSync(b.filePath);
                        }
                    } catch(e){}
                });
            }
            fs.writeFileSync(metaPath, JSON.stringify(metaList, null, 2), 'utf8');

            console.log(`[BackupService] Successfully created and verified backup: ${fileName} (${stat.size} bytes)`);
            return { success: true, metadata };
        } catch(err) {
            console.error('[BackupService Error]:', err.message);
            return { success: false, error: err.message };
        } finally {
            this.isBackingUp = false;
        }
    }

    listBackups() {
        this.ensureBackupDir();
        const metaPath = path.join(this.backupDir, 'backups_meta.json');
        if (fs.existsSync(metaPath)) {
            try { return JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e){}
        }
        // Fallback: list .db files in directory
        const files = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.db'));
        return files.map(f => {
            const p = path.join(this.backupDir, f);
            const stat = fs.statSync(p);
            return {
                fileName: f,
                filePath: p,
                fileSize: stat.size,
                timestamp: stat.mtime.toISOString(),
                verified: true
            };
        }).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    startAutoBackupScheduler() {
        // Run daily backup check every 4 hours
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.checkAndRunScheduledBackup();
        }, 4 * 60 * 60 * 1000);

        // Check on startup
        setTimeout(() => {
            this.checkAndRunScheduledBackup();
        }, 10000);
    }

    checkAndRunScheduledBackup() {
        const backups = this.listBackups();
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        const lastBackup = backups.length > 0 ? new Date(backups[0].timestamp).getTime() : 0;
        if (now - lastBackup > oneDayMs) {
            console.log('[BackupService] Last backup is older than 24h or missing. Triggering scheduled daily backup...');
            this.createBackup('daily_schedule');
        }
    }
}

module.exports = new BackupService();
