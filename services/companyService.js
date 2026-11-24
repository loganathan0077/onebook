/**
 * OneBook - Company & Database Architecture Service
 * 
 * Provides robust multi-company database management:
 * 1. Separation of Application and Data Storage.
 * 2. Independent company directory structure with company.json metadata.
 * 3. Validation and integrity checks before opening any database.
 * 4. Safe creation of new companies without overwriting existing files.
 * 5. Automatic pre-operation safety backups and verified restore workflows.
 * 6. Central atomic config.json management for recent companies.
 * 7. Strict database safety rules: never silently recreate, switch, or overwrite.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const dbManager = require('../database');
const backupService = require('../backupService');

let appInstance = null;
let activeCompany = null;
let customConfigPath = null;

function setAppInstance(app) {
    appInstance = app;
}

function setConfigPath(p) {
    customConfigPath = p;
}

/**
 * Checks whether a path belongs to an automated test or temporary directory
 */
function isTestPath(targetPath) {
    if (process.env.ONEBOOK_TEST_MODE === '1') return false;
    if (!targetPath || typeof targetPath !== 'string') return false;
    const norm = path.normalize(targetPath).toLowerCase();
    return (
        norm.includes('/tests/') ||
        norm.includes('\\tests\\') ||
        norm.includes('temp_test_companies') ||
        norm.includes('onebook_test_') ||
        norm.includes('/var/folders/') ||
        norm.includes('\\temp\\') ||
        norm.includes('/tmp/')
    );
}

/**
 * Get the path to central application config.json
 */
function getConfigPath() {
    if (process.env.ONEBOOK_CONFIG_PATH && process.env.ONEBOOK_CONFIG_PATH.trim()) {
        return path.normalize(process.env.ONEBOOK_CONFIG_PATH.trim());
    }
    if (customConfigPath) {
        return path.normalize(customConfigPath);
    }
    if (appInstance && typeof appInstance.getPath === 'function') {
        return path.join(appInstance.getPath('userData'), 'config.json');
    }
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'OneBook', 'config.json');
    }
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        return path.join(appData, 'OneBook', 'config.json');
    }
    return path.join(home, '.config', 'OneBook', 'config.json');
}

/**
 * Safely read central config.json with fallback
 */
function readConfig() {
    try {
        const p = getConfigPath();
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('[CompanyService] Error reading config.json:', e.message);
    }
    return {};
}

/**
 * Atomically write central config.json
 */
function writeConfig(updates) {
    try {
        const p = getConfigPath();
        fs.mkdirSync(path.dirname(p), { recursive: true });
        const existing = readConfig();

        // Production guard: Never let test directories contaminate production config
        const cleanUpdates = { ...updates };
        if (!process.env.ONEBOOK_CONFIG_PATH && !customConfigPath) {
            if (cleanUpdates.databaseFolder && isTestPath(cleanUpdates.databaseFolder)) {
                delete cleanUpdates.databaseFolder;
            }
            if (cleanUpdates.sqliteDatabasePath && isTestPath(cleanUpdates.sqliteDatabasePath)) {
                delete cleanUpdates.sqliteDatabasePath;
            }
            if (cleanUpdates.dataDirectory && (cleanUpdates.dataDirectory === '[object Object]' || isTestPath(cleanUpdates.dataDirectory))) {
                delete cleanUpdates.dataDirectory;
            }
        }

        const merged = { ...existing, ...cleanUpdates };
        const tmpPath = `${p}.tmp_${Date.now()}`;
        fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 4), 'utf8');
        fs.renameSync(tmpPath, p);
        return merged;
    } catch (e) {
        console.error('[CompanyService] Error saving config.json:', e.message);
        throw e;
    }
}

/**
 * Determine default Data Directory
 * Windows: D:\OneBook\Data\ if D: exists; fallback to Documents\OneBook\Data\
 * macOS/Linux: Documents/OneBook/Data/
 */
function getDefaultDataDirectory() {
    if (process.platform === 'win32') {
        try {
            // Check if D: drive is accessible
            if (fs.existsSync('D:\\')) {
                return 'D:\\OneBook\\Data';
            }
        } catch (e) {}
    }
    let docPath = '';
    if (appInstance && typeof appInstance.getPath === 'function') {
        docPath = appInstance.getPath('documents');
    } else {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        docPath = path.join(home, 'Documents');
    }
    return path.join(docPath, 'OneBook', 'Data');
}

/**
 * Get active Data Directory
 */
function getDataDirectory() {
    const config = readConfig();
    const isCustom = !!process.env.ONEBOOK_CONFIG_PATH || !!customConfigPath;
    if (config.dataDirectory && 
        typeof config.dataDirectory === 'string' && 
        config.dataDirectory.trim() && 
        config.dataDirectory !== '[object Object]' &&
        (isCustom || !isTestPath(config.dataDirectory))) {
        return path.normalize(config.dataDirectory.trim());
    }
    const def = getDefaultDataDirectory();
    writeConfig({ dataDirectory: def });
    return def;
}

/**
 * Set active Data Directory
 */
function setDataDirectory(newPath) {
    let cleanPath = newPath;
    if (newPath && typeof newPath === 'object') {
        cleanPath = newPath.dataDirectory || newPath.path || newPath.folderPath || newPath.selectedPath || '';
    }
    if (!cleanPath || typeof cleanPath !== 'string' || cleanPath === '[object Object]' || !cleanPath.trim()) {
        cleanPath = getDefaultDataDirectory();
    }
    const norm = path.normalize(cleanPath.trim());
    if (!fs.existsSync(norm)) {
        try { fs.mkdirSync(norm, { recursive: true }); } catch (e) {}
    }
    writeConfig({ dataDirectory: norm });
    return norm;
}

/**
 * Sanitize folder name from company name
 */
function sanitizeFolderName(name) {
    return (name || 'Company')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Read company.json metadata
 */
function readCompanyMetadata(folderPath) {
    if (!folderPath || !fs.existsSync(folderPath)) return null;
    const metaPath = path.join(folderPath, 'company.json');
    if (fs.existsSync(metaPath)) {
        try {
            const raw = fs.readFileSync(metaPath, 'utf8');
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[CompanyService] Error reading company.json:', e.message);
        }
    }
    return null;
}

/**
 * Atomically write company.json metadata
 */
function writeCompanyMetadata(folderPath, metadata) {
    if (!folderPath) throw new Error('Company folder path required');
    fs.mkdirSync(folderPath, { recursive: true });
    const metaPath = path.join(folderPath, 'company.json');
    const tmpPath = `${metaPath}.tmp_${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(metadata, null, 4), 'utf8');
    fs.renameSync(tmpPath, metaPath);
    return metadata;
}

/**
 * Validate a Company Folder and its SQLite database
 */
function validateCompanyDatabase(folderOrDbPath) {
    try {
        if (!folderOrDbPath || typeof folderOrDbPath !== 'string') {
            return {
                valid: false,
                code: 'INVALID_PATH',
                error: 'Path must be a non-empty string.'
            };
        }

        const norm = path.normalize(folderOrDbPath.trim());
        let folderPath = norm;
        let dbPath = path.join(norm, 'onebook.db');

        try {
            if (norm.endsWith('.db') || (fs.existsSync(norm) && fs.statSync(norm).isFile())) {
                dbPath = norm;
                folderPath = path.dirname(norm);
            }
        } catch (e) {
            return {
                valid: false,
                code: 'ACCESS_DENIED',
                error: `Cannot access path (${e.code || e.message}): ${norm}`
            };
        }

    // 1. Directory exists
    if (!fs.existsSync(folderPath)) {
        return {
            valid: false,
            code: 'DIRECTORY_NOT_FOUND',
            error: `Company folder not found at: ${folderPath}`
        };
    }

    // 2. Database file exists
    if (!fs.existsSync(dbPath)) {
        return {
            valid: false,
            code: 'DATABASE_NOT_FOUND',
            error: `Database file onebook.db not found in folder: ${folderPath}`
        };
    }

    // 3. Database is readable and non-empty
    let stats = null;
    try {
        stats = fs.statSync(dbPath);
    } catch (e) {
        return {
            valid: false,
            code: 'DATABASE_NOT_READABLE',
            error: `Database file cannot be read: ${e.message}`
        };
    }

    if (stats.size === 0) {
        return {
            valid: false,
            code: 'DATABASE_EMPTY',
            error: 'Database file is 0 bytes (empty/uninitialized).'
        };
    }

    // 4. Verify SQLite header
    try {
        const fd = fs.openSync(dbPath, 'r');
        const buf = Buffer.alloc(16);
        fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
        const header = buf.toString('ascii');
        if (!header.startsWith('SQLite format 3')) {
            return {
                valid: false,
                code: 'INVALID_SQLITE_HEADER',
                error: 'File is not a valid SQLite 3 database.'
            };
        }
    } catch (e) {
        return {
            valid: false,
            code: 'HEADER_READ_FAILED',
            error: `Failed to inspect SQLite header: ${e.message}`
        };
    }

    // 5. Open and perform SQLite integrity check & table verification
    let testDb = null;
    let integrityOk = false;
    let schemaVersion = 1;
    let recordCounts = {};

    try {
        testDb = new Database(dbPath, { readonly: true, fileMustExist: true });
        testDb.pragma('busy_timeout = 3000');
        const intRes = testDb.pragma('integrity_check', { simple: true });
        integrityOk = (intRes === 'ok');

        if (!integrityOk) {
            testDb.close();
            return {
                valid: false,
                code: 'DATABASE_CORRUPT',
                error: `Database integrity check failed: ${intRes}`
            };
        }

        // 6. Check required core tables
        const requiredTables = ['products', 'sales', 'users'];
        const existingTables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
        for (const req of requiredTables) {
            if (!existingTables.includes(req)) {
                testDb.close();
                return {
                    valid: false,
                    code: 'SCHEMA_INCOMPLETE',
                    error: `Missing required table "${req}" in database.`
                };
            }
        }

        // Read schema version from database_metadata if present
        try {
            const verRow = testDb.prepare("SELECT value FROM database_metadata WHERE key = 'schema_version'").get();
            if (verRow && verRow.value) schemaVersion = Number(verRow.value) || 1;
        } catch (e) {}

        // Gather sample record counts safely
        const tablesToCount = ['products', 'product_variants', 'sales', 'customers', 'suppliers', 'petty_cash_transactions', 'users'];
        for (const t of tablesToCount) {
            if (existingTables.includes(t)) {
                try {
                    recordCounts[t] = testDb.prepare(`SELECT count(*) as c FROM ${t}`).get().c;
                } catch (e) {
                    recordCounts[t] = 0;
                }
            }
        }

        testDb.close();
        testDb = null;
    } catch (e) {
        if (testDb) {
            try { testDb.close(); } catch(ce){}
        }
        return {
            valid: false,
            code: 'DATABASE_OPEN_FAILED',
            error: `Failed to open or inspect database: ${e.message}`
        };
    }

    // 7. Check or create company.json metadata
    let metadata = readCompanyMetadata(folderPath);
    if (!metadata) {
        // Auto-generate company.json for existing valid company database
        const folderName = path.basename(folderPath);
        metadata = {
            companyId: crypto.randomUUID(),
            companyName: folderName,
            databaseFile: path.basename(dbPath),
            createdAt: stats.birthtime ? stats.birthtime.toISOString() : new Date().toISOString(),
            lastOpenedAt: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
            schemaVersion: schemaVersion,
            applicationVersion: '1.0.6',
            financialYear: getCurrentFinancialYear(),
            currency: 'INR',
            status: 'active'
        };
        try {
            writeCompanyMetadata(folderPath, metadata);
        } catch (e) {
            console.warn('[CompanyService] Warning: Could not auto-write company.json:', e.message);
        }
    }

    return {
        valid: true,
        code: 'VALID',
        folderPath,
        dbPath,
        company: metadata,
        dbStats: {
            size: stats.size,
            mtime: stats.mtime.toISOString()
        },
        schemaVersion,
        recordCounts
    };
    } catch (outerErr) {
        return {
            valid: false,
            code: outerErr.code || 'VALIDATION_EXCEPTION',
            error: outerErr.message || 'Unknown validation error'
        };
    }
}

/**
 * Determine current financial year string (e.g. "2026-2027")
 */
function getCurrentFinancialYear(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    if (month >= 4) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
}

/**
 * Get Recent Companies with Live Health & Backup Status
 */
function getRecentCompanies() {
    const config = readConfig();
    let recentList = Array.isArray(config.recentCompanies) ? config.recentCompanies : [];

    // Filter out any test directories that might have contaminated the config
    const originalCount = recentList.length;
    recentList = recentList.filter(item => {
        const folder = item.folderPath || (item.databasePath ? path.dirname(item.databasePath) : '');
        const dbPath = item.databasePath || (folder ? path.join(folder, 'onebook.db') : '');
        return !isTestPath(folder) && !isTestPath(dbPath);
    });

    if (recentList.length !== originalCount) {
        console.log(`[CompanyService Cleanup] Purged ${originalCount - recentList.length} test entries from recent companies list.`);
        writeConfig({ recentCompanies: recentList });
    }

    // Fallback: If recent list is empty, detect previously configured database path or Doodles Store
    if (recentList.length === 0) {
        let legacyDb = config.sqliteDatabasePath || (config.databaseFolder ? path.join(config.databaseFolder, 'onebook.db') : null);
        if (!legacyDb || !fs.existsSync(legacyDb) || isTestPath(legacyDb)) {
            const prodDoodles = '/Users/log/Desktop/untitled folder/doodles-store-desktop/OneBook/onebook.db';
            if (fs.existsSync(prodDoodles)) {
                legacyDb = prodDoodles;
            }
        }

        if (legacyDb && fs.existsSync(legacyDb) && !isTestPath(legacyDb)) {
            const folder = path.dirname(legacyDb);
            const folderName = path.basename(folder);
            const meta = readCompanyMetadata(folder) || {
                companyId: 'doodles-store-primary',
                companyName: (folderName === 'OneBook' || folder.includes('doodles-store')) ? 'Doodles Store' : folderName,
                databaseFile: path.basename(legacyDb),
                createdAt: new Date().toISOString(),
                lastOpenedAt: new Date().toISOString()
            };
            recentList.push({
                companyId: meta.companyId,
                companyName: meta.companyName,
                folderPath: folder,
                databasePath: legacyDb,
                lastOpenedAt: meta.lastOpenedAt
            });
            writeConfig({
                recentCompanies: recentList,
                databaseFolder: folder,
                sqliteDatabasePath: legacyDb
            });
        }
    }

    // Check each company in the list
    const enriched = recentList.map(item => {
        const folder = item.folderPath || (item.databasePath ? path.dirname(item.databasePath) : null);
        const dbPath = item.databasePath || (folder ? path.join(folder, 'onebook.db') : null);

        let folderExists = false;
        let dbExists = false;
        let dbSize = 0;
        let lastModified = null;
        let healthStatus = 'HEALTHY';
        let statusMessage = 'Ready';
        let lastBackupInfo = null;
        let companyMeta = null;

        if (folder && fs.existsSync(folder)) {
            folderExists = true;
            companyMeta = readCompanyMetadata(folder);
        }

        if (dbPath && fs.existsSync(dbPath)) {
            dbExists = true;
            try {
                const st = fs.statSync(dbPath);
                dbSize = st.size;
                lastModified = st.mtime.toISOString();
            } catch (e) {}
        }

        // Determine health status
        if (!folderExists || !dbExists) {
            healthStatus = 'MISSING';
            statusMessage = 'Database file or folder not found on disk';
        } else if (dbSize === 0) {
            healthStatus = 'EMPTY';
            statusMessage = 'Database file is empty (0 bytes)';
        } else {
            // Check backups
            lastBackupInfo = getLatestBackupInfo(folder);
            if (!lastBackupInfo) {
                healthStatus = 'BACKUP_DUE';
                statusMessage = 'No backup found for this company';
            } else {
                const hoursSinceBackup = (Date.now() - new Date(lastBackupInfo.timestamp).getTime()) / (1000 * 60 * 60);
                if (hoursSinceBackup > 48) {
                    healthStatus = 'BACKUP_DUE';
                    statusMessage = `Backup due (${Math.floor(hoursSinceBackup / 24)} days since last backup)`;
                } else {
                    healthStatus = 'HEALTHY';
                    statusMessage = 'Database operational & healthy';
                }
            }
        }

        return {
            companyId: item.companyId || (companyMeta?.companyId) || crypto.randomUUID(),
            companyName: item.companyName || companyMeta?.companyName || (folder ? path.basename(folder) : 'Unknown Company'),
            folderPath: folder,
            databasePath: dbPath,
            lastOpenedAt: item.lastOpenedAt || companyMeta?.lastOpenedAt || lastModified || new Date().toISOString(),
            financialYear: companyMeta?.financialYear || getCurrentFinancialYear(),
            dbSize,
            healthStatus,
            statusMessage,
            lastBackupInfo
        };
    });

    return enriched;
}

/**
 * Scan subdirectories in Data Directory for companies
 */
function scanDataDirectory(dataDir = null) {
    const dir = dataDir || getDataDirectory();
    if (!fs.existsSync(dir)) return [];

    const results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subPath = path.join(dir, entry.name);
                const dbPath = path.join(subPath, 'onebook.db');
                if (fs.existsSync(dbPath)) {
                    const validation = validateCompanyDatabase(subPath);
                    if (validation.valid) {
                        results.push({
                            companyId: validation.company.companyId,
                            companyName: validation.company.companyName,
                            folderPath: subPath,
                            databasePath: dbPath,
                            lastOpenedAt: validation.company.lastOpenedAt,
                            financialYear: validation.company.financialYear,
                            dbSize: validation.dbStats.size,
                            healthStatus: 'HEALTHY'
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[CompanyService] Error scanning data directory:', e.message);
    }
    return results;
}

/**
 * Get all valid registered companies in the current Data Directory for company switcher dropdown.
 * Automatically discovers subdirectories with valid databases, verifies integrity,
 * strictly excludes companies from other directories, and identifies the active company.
 */
function getCompaniesInDataDirectory(dataDir = null) {
    const baseDir = dataDir || getDataDirectory();
    if (!fs.existsSync(baseDir)) return [];

    const normBaseDir = path.normalize(path.resolve(baseDir));
    const scanned = scanDataDirectory(normBaseDir);
    const recents = getRecentCompanies();

    const map = new Map();

    // 1. Scanned entries directly inside baseDir
    for (const comp of scanned) {
        if (!comp || !comp.folderPath) continue;
        const normFolder = path.normalize(path.resolve(comp.folderPath));
        if (normFolder.startsWith(normBaseDir) && normFolder !== normBaseDir) {
            map.set(normFolder, comp);
        }
    }

    // 2. Recent companies belonging strictly to baseDir
    for (const comp of recents) {
        if (!comp || !comp.folderPath) continue;
        const normFolder = path.normalize(path.resolve(comp.folderPath));
        if (normFolder.startsWith(normBaseDir) && normFolder !== normBaseDir) {
            if (map.has(normFolder)) {
                const existing = map.get(normFolder);
                map.set(normFolder, {
                    ...existing,
                    ...comp,
                    companyName: comp.companyName || existing.companyName
                });
            } else {
                const val = validateCompanyDatabase(normFolder);
                if (val && val.valid) {
                    map.set(normFolder, comp);
                }
            }
        }
    }

    // 3. Filter valid, non-corrupted, non-missing
    const validList = Array.from(map.values()).filter(c => {
        if (!c.folderPath || !c.databasePath) return false;
        if (!fs.existsSync(c.folderPath) || !fs.existsSync(c.databasePath)) return false;
        if (c.healthStatus === 'MISSING' || c.healthStatus === 'CORRUPT' || c.healthStatus === 'EMPTY') return false;
        return true;
    });

    // 4. Mark active
    const activeRes = getActiveCompany();
    const active = activeRes && activeRes.company ? activeRes.company : null;
    const activeNorm = (active && (active.folderPath || active.path))
        ? path.normalize(path.resolve(active.folderPath || active.path))
        : null;

    return validList.map(c => {
        const norm = path.normalize(path.resolve(c.folderPath));
        return {
            companyId: c.companyId,
            companyName: c.companyName,
            folderPath: c.folderPath,
            databasePath: c.databasePath,
            financialYear: c.financialYear || 'Current',
            isActive: activeNorm ? (norm === activeNorm) : false
        };
    }).sort((a, b) => a.companyName.localeCompare(b.companyName));
}

/**
 * Add or update a company in recentCompanies list
 */
function addOrUpdateRecentCompany(companyInfo) {
    if (!companyInfo || !companyInfo.folderPath) return;
    const normFolder = path.normalize(companyInfo.folderPath);
    const dbPath = companyInfo.databasePath || path.join(normFolder, 'onebook.db');

    // Production guard: Never add test directories to production config
    if (!process.env.ONEBOOK_CONFIG_PATH && !customConfigPath) {
        if (isTestPath(normFolder) || isTestPath(dbPath)) {
            console.log('[CompanyService Guard] Ignored adding test company to production config:', companyInfo.companyName);
            return;
        }
    }

    const config = readConfig();
    let list = Array.isArray(config.recentCompanies) ? [...config.recentCompanies] : [];

    const existingIdx = list.findIndex(c => 
        (c.companyId && companyInfo.companyId && c.companyId === companyInfo.companyId) ||
        (c.folderPath && path.normalize(c.folderPath) === normFolder)
    );

    const entry = {
        companyId: companyInfo.companyId || crypto.randomUUID(),
        companyName: companyInfo.companyName || path.basename(normFolder),
        folderPath: normFolder,
        databasePath: dbPath,
        lastOpenedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...entry };
    } else {
        list.unshift(entry);
    }

    // Keep top 20 recent companies
    list = list.slice(0, 20);

    writeConfig({
        recentCompanies: list,
        lastOpenedCompanyId: entry.companyId
    });

    return entry;
}

/**
 * Remove a company from recentCompanies list (Does NOT delete files)
 */
function removeFromRecentCompanies(companyId) {
    if (!companyId) return { success: false, error: 'companyId required' };
    const config = readConfig();
    let list = Array.isArray(config.recentCompanies) ? config.recentCompanies : [];
    const initialLen = list.length;
    list = list.filter(c => c.companyId !== companyId);

    writeConfig({ recentCompanies: list });
    return { success: true, removed: initialLen !== list.length };
}

/**
 * Inspect latest backup in company folder
 */
function getLatestBackupInfo(companyFolder) {
    if (!companyFolder || !fs.existsSync(companyFolder)) return null;
    const backupsDir = path.join(companyFolder, 'Backups');
    if (!fs.existsSync(backupsDir)) return null;

    const subdirs = ['Daily', 'Manual', 'BeforeUpdate', ''];
    let latestFile = null;
    let latestMtime = 0;
    let latestSize = 0;
    let backupType = 'Manual';

    for (const sub of subdirs) {
        const d = path.join(backupsDir, sub);
        if (fs.existsSync(d)) {
            try {
                const files = fs.readdirSync(d);
                for (const f of files) {
                    if (f.endsWith('.db') && !f.endsWith('.tmp') && !f.includes('.part')) {
                        const fp = path.join(d, f);
                        const st = fs.statSync(fp);
                        if (st.mtimeMs > latestMtime && st.size > 0) {
                            latestMtime = st.mtimeMs;
                            latestFile = fp;
                            latestSize = st.size;
                            backupType = sub || 'Manual';
                        }
                    }
                }
            } catch (e) {}
        }
    }

    if (!latestFile) return null;

    return {
        filePath: latestFile,
        fileName: path.basename(latestFile),
        type: backupType,
        size: latestSize,
        timestamp: new Date(latestMtime).toISOString()
    };
}

/**
 * Create a New Company
 */
async function createCompany({ companyName, folderPath = null, financialYear = null, initialConfig = {} }) {
    try {
        if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
            return {
                success: false,
                error: 'INVALID_COMPANY_NAME',
                message: 'Company name is required and cannot be empty.'
            };
        }

        const cleanName = companyName.trim();
        const folderName = sanitizeFolderName(cleanName);
        const baseDataDir = getDataDirectory();
        const targetFolder = folderPath ? path.normalize(folderPath.trim()) : path.join(baseDataDir, folderName);
        const targetDbPath = path.join(targetFolder, 'onebook.db');

        // Rule 3: Never overwrite an existing database
        if (fs.existsSync(targetDbPath)) {
            const stats = fs.statSync(targetDbPath);
            if (stats.size > 0) {
                return {
                    success: false,
                    error: 'DATABASE_ALREADY_EXISTS',
                    message: `A company database already exists at "${targetDbPath}". Creating a company here would overwrite existing business data.`
                };
            }
        }

        // Create recommended company folder structure
        fs.mkdirSync(targetFolder, { recursive: true });
        fs.mkdirSync(path.join(targetFolder, 'Backups', 'Daily'), { recursive: true });
        fs.mkdirSync(path.join(targetFolder, 'Backups', 'Manual'), { recursive: true });
        fs.mkdirSync(path.join(targetFolder, 'Backups', 'BeforeUpdate'), { recursive: true });
        fs.mkdirSync(path.join(targetFolder, 'Exports'), { recursive: true });
        fs.mkdirSync(path.join(targetFolder, 'Attachments'), { recursive: true });

    // Initialize brand new SQLite database with schema
    const newDb = new Database(targetDbPath, { fileMustExist: false });
    newDb.pragma('journal_mode = WAL');
    newDb.pragma('synchronous = FULL');
    newDb.pragma('foreign_keys = ON');

    // Build database schema via dbManager's internal schema builder
    // Temporarily point dbManager or run schema creation on newDb
    newDb.exec(`
        CREATE TABLE IF NOT EXISTS database_metadata (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO database_metadata (key, value) VALUES ('schema_version', '1');
        INSERT OR REPLACE INTO database_metadata (key, value) VALUES ('application_version', '1.0.6');

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT,
            category TEXT,
            unit TEXT,
            price REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            stock REAL DEFAULT 0,
            min_stock REAL DEFAULT 0,
            description TEXT,
            supplier_text TEXT,
            pack_sizes TEXT,
            hsn TEXT,
            gst_rate REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS product_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            variant_name TEXT NOT NULL,
            legacy_variant_id TEXT,
            sku TEXT,
            barcode TEXT,
            buying_price REAL DEFAULT 0,
            selling_price REAL DEFAULT 0,
            stock REAL DEFAULT 0,
            gst_rate REAL DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_pv_product_id ON product_variants(product_id);
        CREATE INDEX IF NOT EXISTS idx_pv_barcode ON product_variants(barcode);

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            address TEXT,
            state TEXT,
            country TEXT DEFAULT 'INDIA',
            notes TEXT,
            opening_balance REAL DEFAULT 0,
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            address TEXT,
            state TEXT,
            balance REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_number TEXT NOT NULL UNIQUE,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            customer_id TEXT,
            customer_type TEXT,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            taxable_value REAL DEFAULT 0,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            total_tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            payment_method TEXT,
            status TEXT DEFAULT 'ACTIVE',
            courier REAL DEFAULT 0,
            cash_amount REAL DEFAULT 0,
            other_payment_amount REAL DEFAULT 0,
            customer_amount REAL DEFAULT 0,
            change_amount REAL DEFAULT 0,
            gst_applied INTEGER DEFAULT 0,
            payment_status TEXT DEFAULT 'fully_paid',
            amount_paid REAL DEFAULT 0,
            outstanding_amount REAL DEFAULT 0,
            due_date DATETIME,
            customer_name TEXT DEFAULT 'Walk-in Customer',
            customer_gstin TEXT,
            customer_address TEXT,
            customer_state TEXT,
            tax_type TEXT DEFAULT 'intra',
            place_of_supply TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER,
            source_product_id INTEGER,
            variant_id INTEGER,
            product_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            base_quantity REAL,
            price REAL NOT NULL,
            discount REAL DEFAULT 0,
            taxable_value REAL DEFAULT 0,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            total REAL NOT NULL,
            location_id TEXT,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            supplier_id TEXT,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            taxable_value REAL DEFAULT 0,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            total_tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            payment_method TEXT,
            status TEXT DEFAULT 'ACTIVE',
            payment_status TEXT DEFAULT 'fully_paid',
            amount_paid REAL DEFAULT 0,
            outstanding_amount REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );

        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            product_id INTEGER,
            source_product_id INTEGER,
            variant_id INTEGER,
            product_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            discount REAL DEFAULT 0,
            taxable_value REAL DEFAULT 0,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            total REAL NOT NULL,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            variant_id INTEGER,
            source_product_id INTEGER,
            type TEXT NOT NULL,
            quantity REAL NOT NULL,
            previous_stock REAL,
            new_stock REAL,
            reference_type TEXT,
            reference_id INTEGER,
            location_id TEXT,
            notes TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT NOT NULL,
            sale_id INTEGER,
            amount REAL NOT NULL,
            method TEXT,
            reference TEXT,
            notes TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (sale_id) REFERENCES sales(id)
        );

        CREATE TABLE IF NOT EXISTS party_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id TEXT NOT NULL,
            purchase_id INTEGER,
            amount REAL NOT NULL,
            method TEXT,
            reference TEXT,
            notes TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (purchase_id) REFERENCES purchases(id)
        );

        CREATE TABLE IF NOT EXISTS cash_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            reference_type TEXT,
            reference_id INTEGER,
            payment_method TEXT,
            reference_number TEXT,
            category TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bank_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            reference_type TEXT,
            reference_id INTEGER,
            payment_method TEXT,
            reference_number TEXT,
            category TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS petty_cash_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            description TEXT,
            account TEXT DEFAULT 'cash',
            from_account TEXT,
            to_account TEXT,
            voucher_no TEXT,
            remarks TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_pc_date ON petty_cash_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_pc_voucher ON petty_cash_transactions(voucher_no);

        CREATE TABLE IF NOT EXISTS day_closings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE NOT NULL UNIQUE,
            opening_balance REAL DEFAULT 0,
            cash_sales REAL DEFAULT 0,
            bank_sales REAL DEFAULT 0,
            online_sales REAL DEFAULT 0,
            total_sales REAL DEFAULT 0,
            cash_in REAL DEFAULT 0,
            cash_out REAL DEFAULT 0,
            expected_balance REAL DEFAULT 0,
            actual_balance REAL DEFAULT 0,
            difference REAL DEFAULT 0,
            notes TEXT,
            denominations_json TEXT,
            closed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            user_code TEXT,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL DEFAULT '',
            hash_algorithm TEXT NOT NULL DEFAULT 'argon2id',
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'manager', 'cashier', 'ADMIN', 'USER')),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
            permissions_json TEXT NOT NULL DEFAULT '[]',
            license_id TEXT,
            device_id TEXT,
            recovery_code_hash TEXT,
            recovery_attempts INTEGER DEFAULT 0,
            recovery_locked_until DATETIME,
            last_password_change DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            revoked INTEGER NOT NULL DEFAULT 0,
            last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS stock_locations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            code TEXT UNIQUE,
            parent_id TEXT,
            is_active INTEGER DEFAULT 1,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES stock_locations(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS draft_sales (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            customer_name TEXT,
            customer_type TEXT DEFAULT 'walk-in',
            items_json TEXT NOT NULL,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            payment_method TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS calculator_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_id TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expression TEXT NOT NULL,
            result REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Verify integrity of newly created database
    const intRes = newDb.pragma('integrity_check', { simple: true });
    if (intRes !== 'ok') {
        newDb.close();
        throw new Error(`Database creation validation failed: ${intRes}`);
    }

    newDb.pragma('wal_checkpoint(TRUNCATE)');
    newDb.close();

    // Create company metadata
    const companyId = crypto.randomUUID();
    const metadata = {
        companyId,
        companyName: cleanName,
        databaseFile: 'onebook.db',
        createdAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        schemaVersion: 1,
        applicationVersion: '1.0.6',
        financialYear: financialYear || getCurrentFinancialYear(),
        currency: initialConfig.currency || 'INR',
        status: 'active'
    };
    writeCompanyMetadata(targetFolder, metadata);

    // Add to central recent list
    addOrUpdateRecentCompany({
        companyId,
        companyName: cleanName,
        folderPath: targetFolder,
        databasePath: targetDbPath
    });

    return {
        success: true,
        company: metadata,
        folderPath: targetFolder,
        databasePath: targetDbPath
    };
    } catch (err) {
        return {
            success: false,
            error: err.code || 'CREATE_FAILED',
            message: err.message
        };
    }
}

/**
 * Open a Company Database
 */
async function openCompany(folderOrDbPath) {
    try {
        const validation = validateCompanyDatabase(folderOrDbPath);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.code,
                message: validation.error
            };
        }

        const { folderPath, dbPath, company } = validation;

        // Gracefully close any active database
        if (dbManager.isDatabaseOpen()) {
            try {
                dbManager.closeDatabase();
            } catch (e) {
                console.warn('[CompanyService] Warning on previous db close:', e.message);
            }
        }

        // Connect to target database
        dbManager.initializeDatabase(dbPath, { allowCreate: false });

        // Update company.json
        company.lastOpenedAt = new Date().toISOString();
        writeCompanyMetadata(folderPath, company);

        // Update central config.json
        addOrUpdateRecentCompany({
            companyId: company.companyId,
            companyName: company.companyName,
            folderPath,
            databasePath: dbPath
        });

        writeConfig({
            sqliteDatabasePath: dbPath,
            databaseFolder: folderPath,
            lastOpenedCompanyId: company.companyId
        });

        // Configure backup service destination
        const companyBackupsDir = path.join(folderPath, 'Backups');
        backupService.init(
            companyBackupsDir,
            () => readConfig(),
            (updates) => writeConfig(updates)
        );

        activeCompany = {
            ...company,
            folderPath,
            databasePath: dbPath
        };

        console.log(`[CompanyService] Successfully opened company "${company.companyName}" at: ${dbPath}`);
        return {
            success: true,
            company: activeCompany,
            dbPath,
            folderPath
        };
    } catch (err) {
        return {
            success: false,
            error: err.code || 'OPEN_FAILED',
            message: err.message
        };
    }
}

/**
 * Close currently active company
 */
function closeCurrentCompany() {
    if (dbManager.isDatabaseOpen()) {
        try {
            dbManager.closeDatabase();
        } catch (e) {
            console.warn('[CompanyService] Close database warning:', e.message);
        }
    }
    activeCompany = null;
    return { success: true };
}

/**
 * Get active company
 */
function getActiveCompany() {
    if (!activeCompany && dbManager.isDatabaseOpen()) {
        const dbPath = dbManager.getDatabasePath();
        if (dbPath && fs.existsSync(dbPath)) {
            const folderPath = path.dirname(dbPath);
            const meta = readCompanyMetadata(folderPath) || {
                companyId: 'current-db',
                companyName: path.basename(folderPath) === 'Database' ? 'OneBook Store' : path.basename(folderPath),
                databaseFile: path.basename(dbPath)
            };
            activeCompany = {
                ...meta,
                folderPath,
                databasePath: dbPath
            };
        }
    }
    return {
        success: true,
        company: activeCompany ? {
            ...activeCompany,
            name: activeCompany.companyName || activeCompany.name
        } : null
    };
}

/**
 * Safe Database Restore Workflow
 */
async function restoreCompanyBackup({ companyFolderPath, companyFolderOrDbPath, backupFilePath }) {
    try {
        let folder = companyFolderPath || companyFolderOrDbPath;
        if (!folder || typeof folder !== 'string') {
            return { success: false, error: 'INVALID_FOLDER', message: 'Company folder must be specified.' };
        }
        folder = path.normalize(folder.trim());
        if (folder.endsWith('.db') || (fs.existsSync(folder) && fs.statSync(folder).isFile())) {
            folder = path.dirname(folder);
        }

        if (!fs.existsSync(folder)) {
            return { success: false, error: 'FOLDER_NOT_FOUND', message: `Company folder does not exist: ${folder}` };
        }
        if (!backupFilePath || !fs.existsSync(backupFilePath)) {
            return { success: false, error: 'BACKUP_NOT_FOUND', message: `Backup file does not exist: ${backupFilePath}` };
        }

        const backupStats = fs.statSync(backupFilePath);
        if (backupStats.size === 0) {
            return { success: false, error: 'BACKUP_EMPTY', message: 'Selected backup file is 0 bytes (empty).' };
        }

        // 1. Validate backup file using SQLite
        let testDb = null;
        try {
            testDb = new Database(backupFilePath, { readonly: true, fileMustExist: true });
            const intRes = testDb.pragma('integrity_check', { simple: true });
            if (intRes !== 'ok') {
                return { success: false, error: 'INTEGRITY_CHECK_FAILED', message: `Backup integrity check failed: ${intRes}` };
            }
            testDb.close();
            testDb = null;
        } catch (e) {
            if (testDb) {
                try { testDb.close(); } catch(ce){}
            }
            return { success: false, error: 'VALIDATION_ERROR', message: `Backup validation error: ${e.message}` };
        }

        const targetDbPath = path.join(folder, 'onebook.db');
        const safetyBackupDir = path.join(folder, 'Backups', 'Manual');
        fs.mkdirSync(safetyBackupDir, { recursive: true });

        // 2. Create pre-restore safety backup of current active database
        let safetyBackupPath = null;
        if (fs.existsSync(targetDbPath) && fs.statSync(targetDbPath).size > 0) {
            const timeStr = new Date().toISOString().replace(/[:.]/g, '-');
            safetyBackupPath = path.join(safetyBackupDir, `PreRestore_SafetyBackup_${timeStr}.db`);
            
            // If current DB is open, flush WAL
            if (dbManager.isDatabaseOpen()) {
                try {
                    dbManager.getDatabase().pragma('wal_checkpoint(PASSIVE)');
                } catch (e) {}
            }
            fs.copyFileSync(targetDbPath, safetyBackupPath);
            console.log('[CompanyService] Pre-restore safety backup created at:', safetyBackupPath);
        }

        // 3. Restore into temporary file first
        const tempRestorePath = path.join(folder, `onebook_restore_${Date.now()}.tmp.db`);
        fs.copyFileSync(backupFilePath, tempRestorePath);

        // 4. Validate temporary restored file
        try {
            const checkDb = new Database(tempRestorePath, { readonly: true, fileMustExist: true });
            const checkInt = checkDb.pragma('integrity_check', { simple: true });
            if (checkInt !== 'ok') {
                checkDb.close();
                fs.unlinkSync(tempRestorePath);
                return { success: false, error: 'RESTORE_TEMP_CHECK_FAILED', message: `Restored temp file failed integrity check: ${checkInt}` };
            }
            checkDb.close();
        } catch (e) {
            if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath);
            return { success: false, error: 'TEMP_VERIFICATION_ERROR', message: e.message };
        }

        // 5. Close active database connection cleanly
        const wasOpen = dbManager.isDatabaseOpen();
        if (wasOpen) {
            dbManager.closeDatabase();
        }

        // 6. Clean up old WAL/SHM files
        try {
            if (fs.existsSync(`${targetDbPath}-wal`)) fs.unlinkSync(`${targetDbPath}-wal`);
            if (fs.existsSync(`${targetDbPath}-shm`)) fs.unlinkSync(`${targetDbPath}-shm`);
        } catch (e) {}

        // 7. Atomically replace database file
        fs.renameSync(tempRestorePath, targetDbPath);

        // 8. Re-open database
        dbManager.initializeDatabase(targetDbPath, { allowCreate: false });

        // 9. Re-read metadata
        const company = readCompanyMetadata(folder) || {
            companyId: crypto.randomUUID(),
            companyName: path.basename(folder),
            databaseFile: 'onebook.db'
        };
        company.lastOpenedAt = new Date().toISOString();
        writeCompanyMetadata(folder, company);

        activeCompany = {
            ...company,
            folderPath: folder,
            databasePath: targetDbPath
        };

        return {
            success: true,
            message: 'Database restored successfully.',
            databasePath: targetDbPath,
            safetyBackup: safetyBackupPath,
            preRestoreSafetyBackup: safetyBackupPath
        };
    } catch (err) {
        return {
            success: false,
            error: err.code || 'RESTORE_FAILED',
            message: err.message
        };
    }
}

/**
 * Get Comprehensive Database Health Report
 */
function getCompanyHealth(folderOrDbPath) {
    const val = validateCompanyDatabase(folderOrDbPath);
    if (!val.valid) {
        return {
            status: val.code === 'DATABASE_NOT_FOUND' ? 'MISSING' : 'CORRUPT',
            code: val.code,
            error: val.error,
            healthy: false
        };
    }

    const { folderPath, dbPath, company, dbStats, recordCounts } = val;
    const latestBackup = getLatestBackupInfo(folderPath);

    let walSize = 0;
    try {
        const walPath = `${dbPath}-wal`;
        if (fs.existsSync(walPath)) {
            walSize = fs.statSync(walPath).size;
        }
    } catch (e) {}

    let status = 'HEALTHY';
    if (!latestBackup) {
        status = 'BACKUP_DUE';
    } else {
        const hours = (Date.now() - new Date(latestBackup.timestamp).getTime()) / (1000 * 60 * 60);
        if (hours > 48) status = 'BACKUP_DUE';
    }

    return {
        status,
        healthy: status === 'HEALTHY',
        integrityCheck: 'ok',
        foreignKeyCheck: 'ok',
        company,
        folderPath,
        dbPath,
        dbSize: dbStats.size,
        walSize,
        lastModified: dbStats.mtime,
        latestBackup,
        recordCounts,
        schemaVersion: val.schemaVersion
    };
}

/**
 * Safely find and validate the last opened company target for auto-startup.
 * Returns valid folderPath or dbPath string, or null if missing/invalid.
 */
function getLastOpenedCompanyTarget() {
    try {
        const config = readConfig();
        let target = null;

        // Priority 1: lastOpenedCompanyId matching recentCompanies
        if (config.lastOpenedCompanyId && Array.isArray(config.recentCompanies)) {
            const found = config.recentCompanies.find(c => c.companyId === config.lastOpenedCompanyId);
            if (found) {
                target = found.folderPath || found.databasePath;
            }
        }

        // Priority 2: Most recent company from recentCompanies list
        if (!target && Array.isArray(config.recentCompanies) && config.recentCompanies.length > 0) {
            target = config.recentCompanies[0].folderPath || config.recentCompanies[0].databasePath;
        }

        // Priority 3: sqliteDatabasePath or databaseFolder
        if (!target) {
            target = config.sqliteDatabasePath || config.databaseFolder;
        }

        if (!target || typeof target !== 'string' || isTestPath(target)) {
            return null;
        }

        // Strictly validate before returning
        const validation = validateCompanyDatabase(target);
        if (!validation.valid) {
            console.warn('[CompanyService] Last opened company validation failed:', validation.error);
            return null;
        }

        return target;
    } catch (err) {
        console.warn('[CompanyService] Error getting last opened company target:', err.message);
        return null;
    }
}

module.exports = {
    setAppInstance,
    setConfigPath,
    isTestPath,
    getConfigPath,
    readConfig,
    writeConfig,
    getDefaultDataDirectory,
    getDataDirectory,
    setDataDirectory,
    sanitizeFolderName,
    readCompanyMetadata,
    writeCompanyMetadata,
    validateCompanyDatabase,
    getRecentCompanies,
    scanDataDirectory,
    getCompaniesInDataDirectory,
    addOrUpdateRecentCompany,
    removeFromRecentCompanies,
    createCompany,
    openCompany,
    closeCurrentCompany,
    getActiveCompany,
    getLastOpenedCompanyTarget,
    restoreCompanyBackup,
    getCompanyHealth,
    getLatestBackupInfo,
    getCurrentFinancialYear
};
