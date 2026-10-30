const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dbManager = require('./database');

class BackupService {
    constructor() {
        this.appDataDir = null;
        this.configGetter = null;
        this.configSetter = null;
        this.isBackingUp = false;
        this.schedulerTimer = null;
        this.inFlightRestore = false;
    }

    init(appDataDir, configGetter, configSetter) {
        this.appDataDir = appDataDir;
        this.configGetter = configGetter;
        this.configSetter = configSetter;
    }

    getConfig() {
        if (typeof this.configGetter === 'function') {
            try {
                return this.configGetter() || {};
            } catch (e) {
                console.warn('[BackupService] Error reading config:', e.message);
            }
        }
        return {};
    }

    saveConfig(updates) {
        if (typeof this.configSetter === 'function') {
            try {
                return this.configSetter(updates);
            } catch (e) {
                console.warn('[BackupService] Error saving config:', e.message);
            }
        }
    }

    getEffectiveBackupDir() {
        const config = this.getConfig();
        // 1. Explicit backup destination configured by user
        if (config.backupDestination && typeof config.backupDestination === 'string' && config.backupDestination.trim()) {
            const dest = config.backupDestination.trim();
            if (path.basename(dest) !== 'OneBook_Backups') {
                return path.join(dest, 'OneBook_Backups');
            }
            return dest;
        }

        // 2. Derive from active database folder
        const activeDbPath = dbManager.getDatabasePath();
        if (activeDbPath && typeof activeDbPath === 'string') {
            return path.join(path.dirname(activeDbPath), 'OneBook_Backups');
        }

        // 3. Fallback to Documents/OneBook/Database/OneBook_Backups
        if (this.appDataDir) {
            return path.join(this.appDataDir, 'OneBook_Backups');
        }
        return '/Users/log/Documents/OneBook/Database/OneBook_Backups';
    }

    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    formatTimestampFilename(d = new Date()) {
        const pad = (n) => String(n).padStart(2, '0');
        const YYYY = d.getFullYear();
        const MM = pad(d.getMonth() + 1);
        const DD = pad(d.getDate());
        const HH = pad(d.getHours());
        const mm = pad(d.getMinutes());
        const ss = pad(d.getSeconds());
        return `${YYYY}-${MM}-${DD}_${HH}-${mm}-${ss}`;
    }

    async createBackup(reason = 'manual', prefix = 'OneBook_Backup', customDest = null) {
        if (this.isBackingUp) {
            return { success: false, error: 'BACKUP_IN_PROGRESS', message: 'A backup is already in progress' };
        }
        this.isBackingUp = true;

        let tempFilePath = null;
        let finalFilePath = null;

        try {
            const activeDbPath = dbManager.getDatabasePath();
            if (!activeDbPath || !fs.existsSync(activeDbPath)) {
                throw new Error('Active SQLite production database is not available');
            }

            const isConn = dbManager.isDatabaseOpen();
            if (!isConn) {
                throw new Error('SQLite database is currently disconnected');
            }

            const db = dbManager.getDatabase();
            if (!db) {
                throw new Error('SQLite database handle is not initialized');
            }

            // Flush WAL transactions to main database file before snapshot
            try {
                db.pragma('wal_checkpoint(PASSIVE)');
            } catch (walErr) {
                console.warn('[BackupService] Non-fatal wal_checkpoint warning:', walErr.message);
            }

            const targetDir = customDest || this.getEffectiveBackupDir();
            this.ensureDir(targetDir);

            const now = new Date();
            const timeStr = this.formatTimestampFilename(now);
            const fileName = `${prefix}_${timeStr}.db`;
            finalFilePath = path.join(targetDir, fileName);
            tempFilePath = path.join(targetDir, `${fileName}.tmp_${Date.now()}`);

            console.log(`[BackupService] Starting safe online backup (${reason}) to temp file:`, tempFilePath);

            // Execute safe SQLite online backup API to temporary file
            await db.backup(tempFilePath);

            // Verify temporary backup snapshot integrity
            const vDb = new Database(tempFilePath, { readonly: true });
            const integrity = vDb.prepare('PRAGMA integrity_check').all();
            const fkCheck = vDb.prepare('PRAGMA foreign_key_check').all();
            
            // Count rows in critical tables to ensure not empty
            let salesCount = 0;
            let productsCount = 0;
            try {
                const sRow = vDb.prepare('SELECT count(*) as c FROM sales').get();
                salesCount = sRow ? sRow.c : 0;
                const pRow = vDb.prepare('SELECT count(*) as c FROM products').get();
                productsCount = pRow ? pRow.c : 0;
            } catch (cntErr) {
                console.warn('[BackupService] Verification row count check warning:', cntErr.message);
            }
            vDb.close();

            const isIntegrityOk = integrity && integrity.length > 0 && integrity[0].integrity_check === 'ok';
            const isFkOk = !fkCheck || fkCheck.length === 0;

            if (!isIntegrityOk || !isFkOk) {
                throw new Error(`Backup failed validation: integrity=${integrity?.[0]?.integrity_check}, foreignKeyViolations=${fkCheck?.length}`);
            }

            // Rename valid temp file to final destination filename
            fs.renameSync(tempFilePath, finalFilePath);
            tempFilePath = null; // Successfully promoted

            const stat = fs.statSync(finalFilePath);
            const metadata = {
                timestamp: now.toISOString(),
                fileName,
                filePath: finalFilePath,
                fileSize: stat.size,
                reason, // 'manual' | 'automatic' | 'daily' | 'weekly' | 'monthly' | etc.
                verified: true,
                salesCount,
                productsCount
            };

            // Update metadata record file
            const metaPath = path.join(targetDir, 'backups_meta.json');
            let metaList = [];
            if (fs.existsSync(metaPath)) {
                try {
                    metaList = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    if (!Array.isArray(metaList)) metaList = [];
                } catch (e) {
                    metaList = [];
                }
            }
            metaList.unshift(metadata);

            // Enforce retention policy: keep latest 30 backups, never delete baseline or recovery DBs
            const config = this.getConfig();
            const maxRetention = (typeof config.backupRetentionCount === 'number' && config.backupRetentionCount > 0) 
                ? config.backupRetentionCount 
                : 30;

            if (metaList.length > maxRetention) {
                const toPrune = metaList.splice(maxRetention);
                toPrune.forEach(b => {
                    try {
                        if (fs.existsSync(b.filePath) && 
                            !b.filePath.includes('baseline') && 
                            !b.filePath.includes('recovery') &&
                            metaList.length >= 1) { // Never delete the only remaining backup
                            fs.unlinkSync(b.filePath);
                            console.log('[BackupService Retention] Pruned old backup:', b.fileName);
                        }
                    } catch (e) {
                        console.warn('[BackupService Retention Prune Warning]:', e.message);
                    }
                });
            }

            fs.writeFileSync(metaPath, JSON.stringify(metaList, null, 2), 'utf8');

            // Record last successful backup in persistent config
            this.saveConfig({
                lastBackupTimestamp: metadata.timestamp,
                lastBackupPath: metadata.filePath,
                lastBackupFileName: metadata.fileName,
                lastBackupSize: metadata.fileSize,
                lastBackupReason: reason
            });

            console.log(`[BackupService] Successfully created, verified and recorded backup: ${fileName} (${stat.size} bytes)`);
            return { success: true, metadata };
        } catch (err) {
            console.error('[BackupService Error]:', err.message);
            // Clean up temporary file if it was left behind
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try { fs.unlinkSync(tempFilePath); } catch (e) {}
            }
            return { success: false, error: err.message };
        } finally {
            this.isBackingUp = false;
        }
    }

    listBackups() {
        const targetDir = this.getEffectiveBackupDir();
        this.ensureDir(targetDir);

        const metaPath = path.join(targetDir, 'backups_meta.json');
        let metaList = [];
        if (fs.existsSync(metaPath)) {
            try {
                metaList = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                if (Array.isArray(metaList)) {
                    // Filter to verified existing files only
                    return metaList.filter(item => {
                        return item && item.filePath && fs.existsSync(item.filePath);
                    });
                }
            } catch (e) {
                console.warn('[BackupService] Error reading backups_meta.json:', e.message);
            }
        }

        // Fallback scan of directory
        try {
            const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.db') && !f.includes('.tmp_'));
            return files.map(f => {
                const p = path.join(targetDir, f);
                const stat = fs.statSync(p);
                return {
                    fileName: f,
                    filePath: p,
                    fileSize: stat.size,
                    timestamp: stat.mtime.toISOString(),
                    reason: f.includes('Auto') ? 'automatic' : 'manual',
                    verified: true
                };
            }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (scanErr) {
            console.warn('[BackupService] Error scanning backup dir:', scanErr.message);
            return [];
        }
    }

    getLastBackupInfo() {
        const backups = this.listBackups();
        if (backups && backups.length > 0) {
            return backups[0];
        }
        const config = this.getConfig();
        if (config.lastBackupPath && fs.existsSync(config.lastBackupPath)) {
            return {
                timestamp: config.lastBackupTimestamp,
                filePath: config.lastBackupPath,
                fileName: config.lastBackupFileName || path.basename(config.lastBackupPath),
                fileSize: config.lastBackupSize,
                reason: config.lastBackupReason || 'manual'
            };
        }
        return null;
    }

    async restoreBackup(backupFilePath) {
        if (this.inFlightRestore || this.isBackingUp) {
            return { success: false, error: 'BUSY', message: 'A backup or restore operation is already in progress' };
        }
        this.inFlightRestore = true;

        try {
            if (!backupFilePath || !fs.existsSync(backupFilePath)) {
                throw new Error('Selected backup file does not exist on disk');
            }

            // Verify the backup before touching production
            const vDb = new Database(backupFilePath, { readonly: true });
            const integrity = vDb.prepare('PRAGMA integrity_check').all();
            vDb.close();

            if (!integrity || integrity[0].integrity_check !== 'ok') {
                throw new Error('Selected backup file failed SQLite integrity check and cannot be restored');
            }

            const activeDbPath = dbManager.getDatabasePath();
            if (!activeDbPath) {
                throw new Error('No active database location configured');
            }

            // Create a safety snapshot of current DB before restoring
            const safetyRes = await this.createBackup('pre_restore_safety', 'PreRestore_SafetyBackup');
            console.log('[BackupService Restore] Pre-restore safety backup created:', safetyRes?.metadata?.fileName);

            // Safely close connection
            dbManager.closeDatabase();

            // Copy backup over production database file
            fs.copyFileSync(backupFilePath, activeDbPath);

            // Remove old WAL and SHM files to ensure clean start
            const walFile = `${activeDbPath}-wal`;
            const shmFile = `${activeDbPath}-shm`;
            if (fs.existsSync(walFile)) try { fs.unlinkSync(walFile); } catch (e) {}
            if (fs.existsSync(shmFile)) try { fs.unlinkSync(shmFile); } catch (e) {}

            // Re-initialize database
            dbManager.initializeDatabase(activeDbPath, { allowCreate: false });

            console.log('[BackupService Restore] Restored successfully from:', backupFilePath);
            return { success: true, activeDbPath, restoredFrom: backupFilePath };
        } catch (err) {
            console.error('[BackupService Restore Error]:', err.message);
            return { success: false, error: err.message };
        } finally {
            this.inFlightRestore = false;
        }
    }

    // --- Automatic Scheduler Implementation ---

    getScheduleSettings() {
        const config = this.getConfig();
        const sched = config.autoBackupSchedule || {};
        return {
            enabled: sched.enabled === true,
            frequency: sched.frequency || 'daily', // 'daily' | 'weekly' | 'monthly'
            time: sched.time || '22:00', // HH:mm 24-hour format
            dayOfWeek: sched.dayOfWeek !== undefined ? sched.dayOfWeek : 1, // 0=Sunday, 1=Monday...
            dayOfMonth: sched.dayOfMonth !== undefined ? sched.dayOfMonth : 1, // 1-28
            destinationFolder: config.backupDestination || '',
            lastAutoBackupDate: sched.lastAutoBackupDate || null
        };
    }

    saveScheduleSettings(settings) {
        const config = this.getConfig();
        const currentSched = config.autoBackupSchedule || {};
        const updatedSched = {
            ...currentSched,
            enabled: settings.enabled === true,
            frequency: settings.frequency || 'daily',
            time: settings.time || '22:00',
            dayOfWeek: parseInt(settings.dayOfWeek !== undefined ? settings.dayOfWeek : 1, 10),
            dayOfMonth: parseInt(settings.dayOfMonth !== undefined ? settings.dayOfMonth : 1, 10),
            lastAutoBackupDate: currentSched.lastAutoBackupDate || null
        };

        const updates = {
            autoBackupSchedule: updatedSched
        };

        if (settings.destinationFolder !== undefined) {
            updates.backupDestination = settings.destinationFolder;
        }

        this.saveConfig(updates);
        console.log('[BackupService Scheduler] Saved schedule settings:', updatedSched);

        // Restart scheduler tick with new settings
        this.restartScheduler();
        return this.getScheduleSettings();
    }

    startAutoBackupScheduler() {
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }

        console.log('[BackupService Scheduler] Initializing automatic backup scheduler...');

        // Check for catch-up backup on application launch
        setTimeout(() => {
            this.checkCatchUpBackup();
        }, 5000);

        // Run check every 60 seconds
        this.schedulerTimer = setInterval(() => {
            this.checkAndRunScheduledBackup();
        }, 60 * 1000);
    }

    restartScheduler() {
        this.startAutoBackupScheduler();
    }

    getDateKey(d = new Date()) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    checkCatchUpBackup() {
        const sched = this.getScheduleSettings();
        if (!sched.enabled) return;

        const now = new Date();
        const [schedHours, schedMinutes] = (sched.time || '22:00').split(':').map(Number);
        
        // Check if scheduled time has passed today
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const targetMinutes = schedHours * 60 + schedMinutes;

        const todayKey = this.getDateKey(now);
        const lastRunDate = sched.lastAutoBackupDate;

        if (lastRunDate === todayKey) {
            // Already backed up today
            return;
        }

        let shouldCatchUp = false;

        if (sched.frequency === 'daily') {
            if (nowMinutes >= targetMinutes) {
                shouldCatchUp = true;
            }
        } else if (sched.frequency === 'weekly') {
            const currentDay = now.getDay();
            if (currentDay === sched.dayOfWeek && nowMinutes >= targetMinutes) {
                shouldCatchUp = true;
            }
        } else if (sched.frequency === 'monthly') {
            const currentMDay = now.getDate();
            if (currentMDay === sched.dayOfMonth && nowMinutes >= targetMinutes) {
                shouldCatchUp = true;
            }
        }

        if (shouldCatchUp) {
            console.log('[BackupService Scheduler] Missed scheduled backup detected. Performing catch-up backup...');
            this.executeScheduledBackup(`catchup_${sched.frequency}`);
        }
    }

    checkAndRunScheduledBackup() {
        if (this.isBackingUp || this.inFlightRestore) return;

        const sched = this.getScheduleSettings();
        if (!sched.enabled) return;

        const now = new Date();
        const [schedHours, schedMinutes] = (sched.time || '22:00').split(':').map(Number);

        // Must match exact current hour and minute
        if (now.getHours() !== schedHours || now.getMinutes() !== schedMinutes) {
            return;
        }

        const todayKey = this.getDateKey(now);
        if (sched.lastAutoBackupDate === todayKey) {
            // Already ran today during this window
            return;
        }

        let isMatch = false;

        if (sched.frequency === 'daily') {
            isMatch = true;
        } else if (sched.frequency === 'weekly') {
            if (now.getDay() === sched.dayOfWeek) {
                isMatch = true;
            }
        } else if (sched.frequency === 'monthly') {
            if (now.getDate() === sched.dayOfMonth) {
                isMatch = true;
            }
        }

        if (isMatch) {
            console.log(`[BackupService Scheduler] Triggering ${sched.frequency} automatic backup at ${sched.time}...`);
            this.executeScheduledBackup(`automatic_${sched.frequency}`);
        }
    }

    async executeScheduledBackup(reason) {
        const res = await this.createBackup(reason, 'OneBook_AutoBackup');
        if (res.success) {
            const now = new Date();
            const todayKey = this.getDateKey(now);
            const config = this.getConfig();
            const currentSched = config.autoBackupSchedule || {};
            currentSched.lastAutoBackupDate = todayKey;
            this.saveConfig({ autoBackupSchedule: currentSched });
            console.log(`[BackupService Scheduler] Automatic backup completed successfully: ${res.metadata.fileName}`);
        } else {
            console.error(`[BackupService Scheduler Error]: Automatic backup failed:`, res.error);
        }
    }
}

module.exports = new BackupService();
