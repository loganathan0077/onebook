/**
 * OneBook - Company-Specific Settings & Business Profile Service
 * 
 * Stores all settings and business profiles inside the active company's SQLite database
 * in the 'settings' key-value table. This guarantees complete data isolation between
 * different companies.
 */

const dbManager = require('../database');

function getDb() {
    if (!dbManager.isDatabaseOpen()) {
        throw new Error('Database is not connected');
    }
    return dbManager.getDatabase();
}

function ensureSettingsTable() {
    const db = getDb();
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

function getAllSettings() {
    ensureSettingsTable();
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
        try {
            settings[r.key] = JSON.parse(r.value);
        } catch (e) {
            settings[r.key] = r.value;
        }
    }
    return settings;
}

function getSetting(key) {
    ensureSettingsTable();
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return null;
    try {
        return JSON.parse(row.value);
    } catch (e) {
        return row.value;
    }
}

function saveSetting(key, value) {
    ensureSettingsTable();
    const db = getDb();
    const valStr = (typeof value === 'object' && value !== null) ? JSON.stringify(value) : String(value ?? '');
    db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, valStr);
    return { success: true, key, value };
}

function saveAllSettings(settingsObj) {
    if (!settingsObj || typeof settingsObj !== 'object') {
        return { success: false, error: 'Invalid settings payload' };
    }
    ensureSettingsTable();
    const db = getDb();
    const insertStmt = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    const tx = db.transaction((obj) => {
        for (const [k, v] of Object.entries(obj)) {
            const valStr = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : String(v ?? '');
            insertStmt.run(k, valStr);
        }
    });

    tx(settingsObj);
    return { success: true };
}

function getBusinessProfile() {
    const all = getAllSettings();
    if (all.business_profile && typeof all.business_profile === 'object') {
        return all.business_profile;
    }
    return {
        businessName: all.businessName || '',
        tagline: all.tagline || '',
        logoData: all.logoData || null,
        mobile: all.mobile || '',
        email: all.email || '',
        website: all.website || '',
        address: all.address || '',
        gstin: all.gstin || ''
    };
}

function saveBusinessProfile(profile) {
    if (!profile || typeof profile !== 'object') {
        return { success: false, error: 'Invalid profile data' };
    }
    const cleanProfile = {
        businessName: profile.businessName || '',
        tagline: profile.tagline || '',
        logoData: profile.logoData || null,
        mobile: profile.mobile || '',
        email: profile.email || '',
        website: profile.website || '',
        address: profile.address || '',
        gstin: profile.gstin || ''
    };
    saveAllSettings({
        ...cleanProfile,
        business_profile: cleanProfile
    });
    return { success: true, profile: cleanProfile };
}

module.exports = {
    getAllSettings,
    getSetting,
    saveSetting,
    saveAllSettings,
    getBusinessProfile,
    saveBusinessProfile
};

