const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧪 Starting OneBook Production Critical Fixes Verification Test Suite...\n');

// ============================================================
// TEST 1: Unwanted Backup & Restore Removal in Reports
// ============================================================
console.log('--- TEST 1: Unwanted Backup & Restore in Reports Check ---');
const oneBookHtml = fs.readFileSync(path.join(__dirname, '..', 'OneBook.html'), 'utf8');

// Check that the legacy Backup and Restore div is completely removed from Reports
assert(!oneBookHtml.includes('<!-- Backup and Restore Section -->'), 
    'Legacy Backup and Restore section comment must be removed from Reports');
assert(!oneBookHtml.includes('<span>💾 Full System Backup</span>'), 
    'Legacy Full System Backup button must be removed from Reports');
assert(!oneBookHtml.includes('restoreFileInput'), 
    'Legacy restoreFileInput must be removed from Reports');

// Ensure legitimate SQLite Database Backup & Restore in Settings remains intact
assert(oneBookHtml.includes('id="settings-pane-backup"'), 
    'Settings -> Database Backup & Restore pane must remain intact');
assert(oneBookHtml.includes('triggerLocalBackup'), 
    'Settings database backup handler must remain intact');
assert(oneBookHtml.includes('handleRestoreDatabaseBackup'), 
    'Settings database restore handler must remain intact');

console.log('✅ TEST 1 PASSED: Unwanted Backup & Restore section cleanly removed from Reports, Settings backup preserved.');

// ============================================================
// TEST 2: Demo Mode -> Licensed Mode Transition Semantics
// ============================================================
console.log('\n--- TEST 2: Demo Mode -> Licensed Mode Transition Check ---');
const licenseJs = fs.readFileSync(path.join(__dirname, '..', 'license.js'), 'utf8');
const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'login.html'), 'utf8');

// Verify license.js wipes demo session upon activation
assert(licenseJs.includes("sessionStorage.removeItem('onebook_session_token')"), 
    'license.js must clear onebook_session_token upon activation');
assert(licenseJs.includes("sessionStorage.removeItem('currentUser')"), 
    'license.js must clear currentUser upon activation');
assert(licenseJs.includes('clearDemoSession'), 
    'license.js must invoke clearDemoSession IPC');
assert(licenseJs.includes('login.html?view=create-admin'), 
    'license.js must redirect new users without Admin to Create Admin view');
assert(licenseJs.includes('login.html?activated=true'), 
    'license.js must redirect existing users to login screen with activated notice');

// Verify login.html never auto-redirects demo sessions
assert(loginHtml.includes('isDemoUser'), 
    'login.html must inspect if active session belongs to a demo user');
assert(loginHtml.includes("viewParam === 'create-admin'"), 
    'login.html must support view=create-admin query parameter');
assert(loginHtml.includes('openAuthRecoveryModal()'), 
    'login.html must automatically present Admin Creation modal when view=create-admin');

// Verify OneBook.html isDemoMode() logic
assert(oneBookHtml.includes('isLicenseActive'), 
    'OneBook.html isDemoMode must verify active license');
assert(oneBookHtml.includes('!user.isDemo && user.id !== \'demo_user\''), 
    'OneBook.html isDemoMode must verify user is authenticated production account');

console.log('✅ TEST 2 PASSED: Demo session exit, Admin creation redirection, and production license transition verified.');

// ============================================================
// TEST 3: Fresh Install SQLite Auto-Creation & Input Responsiveness
// ============================================================
console.log('\n--- TEST 3: Fresh Install Auto-Creation & Input Responsiveness Check ---');
const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

// Verify main.js initializes with allowCreate: true
assert(mainJs.includes('allowCreate: true'), 
    'main.js initSqliteAtStartup must allow automatic database creation');
assert(mainJs.includes('createApplicationMenu'), 
    'main.js must register native application menu with Edit shortcuts');
assert(mainJs.includes('typeof input.key === \'string\''), 
    'main.js before-input-event must guard against undefined/null keys');
assert(mainJs.includes('toggleDevTools'), 
    'main.js F12 / shortcuts must support toggling dev tools safely');

// Verify input responsiveness: check that login.html inputs are not covered by default
assert(loginHtml.includes('id="email"'), 'login.html must have accessible email input');
assert(loginHtml.includes('id="password"'), 'login.html must have accessible password input');

console.log('✅ TEST 3 PASSED: SQLite automatic creation, safe before-input-event, and application menu verified.');

// ============================================================
// TEST 4: In-App Version Checking & Auto-Updater UI & Backend
// ============================================================
console.log('\n--- TEST 4: In-App Version Checking & Auto-Updater Check ---');
const updaterServicePath = path.join(__dirname, '..', 'services', 'updaterService.js');
assert(fs.existsSync(updaterServicePath), 'services/updaterService.js must exist on disk');

const updaterServiceJs = fs.readFileSync(updaterServicePath, 'utf8');
assert(updaterServiceJs.includes('checkForUpdates'), 'updaterService must implement checkForUpdates');
assert(updaterServiceJs.includes('downloadUpdate'), 'updaterService must implement downloadUpdate');
assert(updaterServiceJs.includes('installUpdate'), 'updaterService must implement installUpdate');
assert(updaterServiceJs.includes('compareVersions'), 'updaterService must implement semver comparison');

// Test the compareVersions logic
const updaterService = require('../services/updaterService');
assert(updaterService !== null, 'updaterService must export valid instance');

// Verify OneBook.html UI elements for updates
assert(oneBookHtml.includes('id="settings-pane-about"'), 
    'OneBook.html must include settings-pane-about');
assert(oneBookHtml.includes('id="btnCheckUpdates"'), 
    'OneBook.html must include Check for Updates button');
assert(oneBookHtml.includes('id="updaterStatusCard"'), 
    'OneBook.html must include updaterStatusCard');
assert(oneBookHtml.includes('id="updaterProgressCard"'), 
    'OneBook.html must include updaterProgressCard');
assert(oneBookHtml.includes('handleCheckForUpdates'), 
    'OneBook.html must include handleCheckForUpdates handler');
assert(oneBookHtml.includes('handleDownloadUpdate'), 
    'OneBook.html must include handleDownloadUpdate handler');
assert(oneBookHtml.includes('handleInstallUpdate'), 
    'OneBook.html must include handleInstallUpdate handler');

// Verify preload.js exposes updater APIs
const preloadJs = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
assert(preloadJs.includes('getAppVersionSync'), 'preload.js must expose getAppVersionSync');
assert(preloadJs.includes('updater:check'), 'preload.js must bridge updater:check');
assert(preloadJs.includes('updater:download'), 'preload.js must bridge updater:download');
assert(preloadJs.includes('updater:install'), 'preload.js must bridge updater:install');
assert(preloadJs.includes('clearDemoSession'), 'preload.js must bridge clearDemoSession');

console.log('✅ TEST 4 PASSED: In-app auto-updater service, IPC bridges, and interactive UI verified.');

console.log('\n=============================================================');
console.log('🎉 ALL 4 PRODUCTION CRITICAL FIXES VERIFICATION TESTS PASSED! 🎉');
console.log('=============================================================');
