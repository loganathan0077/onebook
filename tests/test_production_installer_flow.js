const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧪 Starting OneBook Production Installer & Flow Verification Test Suite...');

// ============================================================
// TEST 1: Package.json Assets Integrity Check (build.files)
// ============================================================
console.log('\n--- TEST 1: Packaged Build Files Whitelist Integrity ---');
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const filesWhitelist = pkg.build && pkg.build.files ? pkg.build.files : [];
console.log('📦 Total Whitelist Entries:', filesWhitelist.length);

assert(filesWhitelist.includes('auth.js'), 'CRITICAL: auth.js must be in build.files so OneBook.html can import it');
assert(filesWhitelist.includes('icon-192.png'), 'icon-192.png must be in build.files');
assert(filesWhitelist.includes('icon-512.png'), 'icon-512.png must be in build.files');
assert(filesWhitelist.includes('license.html'), 'license.html must be in build.files');
assert(filesWhitelist.includes('login.html'), 'login.html must be in build.files');
assert(filesWhitelist.includes('OneBook.html'), 'OneBook.html must be in build.files');
assert(filesWhitelist.includes('license.js'), 'license.js must be in build.files');

// Verify every explicit file in build.files actually exists in project root
for (const entry of filesWhitelist) {
    if (!entry.includes('*')) {
        const fullPath = path.join(__dirname, '..', entry);
        assert(fs.existsSync(fullPath), `Packaged file must exist on disk: ${entry}`);
    }
}
console.log('✅ TEST 1 PASSED: All essential runtime assets and modules exist and are included in package.json build.files.');

// ============================================================
// TEST 2: HTML UI Navigation & Script Resilience Check
// ============================================================
console.log('\n--- TEST 2: HTML UI Navigation & Script Resilience Check ---');
const licenseHtml = fs.readFileSync(path.join(__dirname, '..', 'license.html'), 'utf8');
const licenseJs = fs.readFileSync(path.join(__dirname, '..', 'license.js'), 'utf8');
const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'login.html'), 'utf8');

// Ensure license.html demoBtn does NOT redirect to login.html
assert(!licenseHtml.includes("onclick=\"window.location.href='login.html'\""), 
    'license.html demoBtn must NOT have inline redirect to login.html');
assert(licenseJs.includes("window.location.href = 'OneBook.html'"), 
    'license.js demoBtn must redirect directly to OneBook.html');
assert(licenseJs.includes("demoLogin"), 
    'license.js must initialize demo login session');

// Ensure login.html uses standard script rather than brittle module import
assert(!loginHtml.includes('<script type="module">'), 
    'login.html must use standard <script> instead of <script type="module"> to avoid missing-module lockouts');
assert(loginHtml.includes('handleDemoLogin'), 
    'login.html must define handleDemoLogin');
assert(loginHtml.includes('openAuthRecoveryModal'), 
    'login.html must define openAuthRecoveryModal');
assert(loginHtml.includes('performLogin'), 
    'login.html must have performLogin');
assert(loginHtml.includes('initialSetupAlert'), 
    'login.html must include first-time admin setup prompt banner');

console.log('✅ TEST 2 PASSED: Activation and Login HTML/JS flow semantics verified.');

// ============================================================
// TEST 3: Database Path Resolution & Persistent Configuration
// ============================================================
console.log('\n--- TEST 3: Database Path Persistence & Space Handling ---');

const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_path_test_'));
const testUserDataDir = path.join(testTempDir, 'User Data With Spaces', 'OneBook');
fs.mkdirSync(testUserDataDir, { recursive: true });

const testConfigPath = path.join(testUserDataDir, 'config.json');

// Simulate setting databaseFolder and sqliteDatabasePath with spaces in path
const dbFolderWithSpaces = path.join(testTempDir, 'My Documents With Spaces', 'OneBook Database');
fs.mkdirSync(dbFolderWithSpaces, { recursive: true });
const targetDbFile = path.join(dbFolderWithSpaces, 'onebook.db');

// Touch db file so it exists
fs.writeFileSync(targetDbFile, 'SQLite test header data');

// Save config JSON
const configData = {
    databaseFolder: dbFolderWithSpaces,
    sqliteDatabasePath: targetDbFile
};
fs.writeFileSync(testConfigPath, JSON.stringify(configData, null, 4), 'utf8');

// Emulate resolveSqlitePath logic
function simulateResolveSqlitePath(configFilePath) {
    if (fs.existsSync(configFilePath)) {
        const data = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        if (data.sqliteDatabasePath && typeof data.sqliteDatabasePath === 'string') {
            const sp = path.normalize(data.sqliteDatabasePath.trim().replace(/^["']|["']$/g, ''));
            return sp;
        }
        if (data.databaseFolder && typeof data.databaseFolder === 'string') {
            const df = path.normalize(data.databaseFolder.trim().replace(/^["']|["']$/g, ''));
            const cand = df.endsWith('.db') ? df : path.join(df, 'onebook.db');
            return cand;
        }
    }
    return null;
}

const resolvedPath = simulateResolveSqlitePath(testConfigPath);
assert.strictEqual(resolvedPath, targetDbFile, 'Resolved path must match targetDbFile exactly including spaces');
assert(fs.existsSync(resolvedPath), 'Resolved database path must exist on disk');

// Test fallback when only databaseFolder is present in config
const legacyConfigPath = path.join(testTempDir, 'legacy_config.json');
fs.writeFileSync(legacyConfigPath, JSON.stringify({ databaseFolder: dbFolderWithSpaces }), 'utf8');
const resolvedLegacyPath = simulateResolveSqlitePath(legacyConfigPath);
assert.strictEqual(resolvedLegacyPath, targetDbFile, 'Must resolve onebook.db inside databaseFolder');

// Cleanup temp test directory
fs.rmSync(testTempDir, { recursive: true, force: true });
console.log('✅ TEST 3 PASSED: Database configuration persistence and spaces handling verified.');

// ============================================================
// TEST 4: SQLite Database Initialization & Services
// ============================================================
console.log('\n--- TEST 4: Database Initialization & Admin Flow ---');
const dbTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_db_test_'));
const testDbPath = path.join(dbTempDir, 'test_onebook.db');

const dbManager = require('../database');
dbManager.initializeDatabase(testDbPath, { allowCreate: true });
assert(dbManager.isDatabaseOpen(), 'Database must be open after initialization');

const userService = require('../services/userService');

// Check initial admin status
assert.strictEqual(userService.hasConfiguredAdmin(), false, 'Brand new database must have no configured admin');

// Create Admin Account with Argon2id
(async () => {
    const adminSetupRes = await userService.createAdminAccount({
        username: 'admin@mybusiness.com',
        password: 'SecurePass2026!',
        licenseId: 'LIC-TEST-123',
        deviceId: 'DEVICE-MAC-TEST'
    });
    assert(adminSetupRes.success, 'Admin creation must succeed');
    assert(adminSetupRes.recoveryCode, 'Must generate recovery code');
    assert.strictEqual(userService.hasConfiguredAdmin(), true, 'hasConfiguredAdmin must now return true');

    // Demo Login verification
    const demoRes = await userService.loginDemo();
    assert(demoRes.user, 'Demo user must be returned');
    assert.strictEqual(demoRes.user.isDemo, true, 'User must be marked as isDemo: true');
    assert.strictEqual(demoRes.user.username, 'demo');

    // Clean up database
    dbManager.closeDatabase();
    fs.rmSync(dbTempDir, { recursive: true, force: true });
    console.log('✅ TEST 4 PASSED: Database initialization, admin setup, and demo login verified.');

    console.log('\n=============================================================');
    console.log('🎉 ALL PRODUCTION INSTALLER & FLOW VERIFICATION TESTS PASSED! 🎉');
    console.log('=============================================================');
})().catch(err => {
    console.error('Test 4 Async Error:', err);
    process.exit(1);
});
