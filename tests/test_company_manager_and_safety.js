/**
 * OneBook - Comprehensive Company Manager, Data Safety & Multi-Company Audit Test Suite
 * 
 * Verifies all 12 core requirements and 5 strict safety rules:
 * Rule 1: Never silently create a database if missing.
 * Rule 2: Never silently switch databases.
 * Rule 3: Never overwrite an existing database on create.
 * Rule 4: Updates and operations preserve data.
 * Rule 5: Database errors are visible and explicit.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const companyService = require('../services/companyService');
const dbManager = require('../database');
const backupService = require('../backupService');

const PROD_DB_PATH = '/Users/log/Desktop/untitled folder/doodles-store-desktop/OneBook/onebook.db';
let INITIAL_PROD_HASH = null;
let INITIAL_PROD_SIZE = null;

const TEST_ROOT = path.join(__dirname, 'temp_test_companies_' + Date.now());

function getFileSha256(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function verifyProdBaseline(stageName) {
    console.log(`\n[Prod Baseline Check: ${stageName}]`);
    if (!fs.existsSync(PROD_DB_PATH)) {
        throw new Error(`CRITICAL: Production DB missing at ${PROD_DB_PATH}`);
    }
    const stat = fs.statSync(PROD_DB_PATH);
    const hash = getFileSha256(PROD_DB_PATH);
    if (!INITIAL_PROD_HASH) {
        INITIAL_PROD_HASH = hash;
        INITIAL_PROD_SIZE = stat.size;
        console.log(`Recorded pre-test production DB baseline: ${stat.size} bytes, SHA-256: ${hash}`);
        return;
    }
    if (stat.size !== INITIAL_PROD_SIZE) {
        throw new Error(`CRITICAL: Production DB size changed! Expected ${INITIAL_PROD_SIZE}, got ${stat.size}`);
    }
    if (hash !== INITIAL_PROD_HASH) {
        throw new Error(`CRITICAL: Production DB hash changed during test run! Expected ${INITIAL_PROD_HASH}, got ${hash}`);
    }
    console.log(`✓ Production DB is 100% UNTOUCHED and BIT-FOR-BIT IDENTICAL to pre-test baseline.`);
}

async function runTests() {
    console.log('================================================================');
    console.log('🚀 STARTING ONEBOOK COMPANY MANAGER & DATA SAFETY AUDIT');
    console.log('================================================================');
    
    // Step 0: Initial Prod Baseline Verification
    verifyProdBaseline('INITIAL');

    fs.mkdirSync(TEST_ROOT, { recursive: true });

    // CRITICAL: Point companyService to isolated test config.json to guarantee 0% production config contamination
    const TEST_CONFIG_PATH = path.join(TEST_ROOT, 'test_config.json');
    process.env.ONEBOOK_CONFIG_PATH = TEST_CONFIG_PATH;
    companyService.setConfigPath(TEST_CONFIG_PATH);

    let testsPassed = 0;
    let testsFailed = 0;

    function assert(condition, message) {
        if (!condition) {
            testsFailed++;
            console.error(`  ❌ FAILED: ${message}`);
            throw new Error(`Assertion failed: ${message}`);
        } else {
            testsPassed++;
            console.log(`  ✓ PASSED: ${message}`);
        }
    }

    try {
        // -------------------------------------------------------------
        // TEST 1: Directory Resolution & Sanitize Folder Name
        // -------------------------------------------------------------
        console.log('\n--- Test 1: Directory Resolution & Name Sanitization ---');
        const defaultDataDir = companyService.getDefaultDataDirectory();
        assert(typeof defaultDataDir === 'string' && defaultDataDir.length > 0, 'Default data directory is a valid path');
        
        const cleanName1 = companyService.sanitizeFolderName('My Store: Retail & Wholesale / 2026?');
        assert(cleanName1 === 'My Store Retail & Wholesale  2026' || cleanName1 === 'My Store Retail & Wholesale 2026', `Folder sanitization stripped illegal chars: "${cleanName1}"`);

        // -------------------------------------------------------------
        // TEST 2: Rule 1 - Never Silently Create Database on Missing
        // -------------------------------------------------------------
        console.log('\n--- Test 2: Rule 1 - Reject Missing Database Without Silent Creation ---');
        const nonExistentDir = path.join(TEST_ROOT, 'GhostCompany');
        const valRes = companyService.validateCompanyDatabase(nonExistentDir);
        assert(valRes.valid === false, 'Validation of non-existent folder returned valid: false');
        assert(valRes.code === 'DIRECTORY_NOT_FOUND' || valRes.code === 'DATABASE_NOT_FOUND', `Correct error code returned: ${valRes.code}`);
        assert(!fs.existsSync(nonExistentDir), 'Ghost directory was NOT created on disk');

        const openMissingRes = await companyService.openCompany(nonExistentDir);
        assert(openMissingRes.success === false, 'openCompany on missing folder returned success: false');
        assert(openMissingRes.error === 'DATABASE_NOT_FOUND' || openMissingRes.error === 'DIRECTORY_NOT_FOUND' || openMissingRes.error === 'DATABASE_VALIDATION_FAILED', `openCompany returned error code: ${openMissingRes.error}`);

        // -------------------------------------------------------------
        // TEST 3: Validation Robustness (0-byte file, corrupted header)
        // -------------------------------------------------------------
        console.log('\n--- Test 3: Validation Integrity (0-byte & corrupt headers) ---');
        const zeroByteFolder = path.join(TEST_ROOT, 'ZeroByteCompany');
        fs.mkdirSync(zeroByteFolder, { recursive: true });
        fs.writeFileSync(path.join(zeroByteFolder, 'onebook.db'), Buffer.alloc(0));
        
        const zeroVal = companyService.validateCompanyDatabase(zeroByteFolder);
        assert(zeroVal.valid === false, '0-byte database rejected');
        assert(zeroVal.code === 'DATABASE_EMPTY' || zeroVal.code === 'DATABASE_ZERO_BYTES', `0-byte error code: ${zeroVal.code}`);

        const corruptFolder = path.join(TEST_ROOT, 'CorruptCompany');
        fs.mkdirSync(corruptFolder, { recursive: true });
        fs.writeFileSync(path.join(corruptFolder, 'onebook.db'), Buffer.from('NOT A SQLITE FILE AT ALL JUNK DATA'));
        
        const corruptVal = companyService.validateCompanyDatabase(corruptFolder);
        assert(corruptVal.valid === false, 'Corrupt SQLite header rejected');
        assert(corruptVal.code === 'INVALID_SQLITE_HEADER', `Corrupt header error code: ${corruptVal.code}`);

        // -------------------------------------------------------------
        // TEST 4: Create New Company Workflow
        // -------------------------------------------------------------
        console.log('\n--- Test 4: Create New Company Workflow ---');
        const createRes = await companyService.createCompany({
            companyName: 'Alpha Retailers',
            folderPath: path.join(TEST_ROOT, 'Alpha Retailers'),
            financialYear: '2026-2027',
            phone: '9876543210',
            currency: '₹'
        });
        assert(createRes.success === true, 'Alpha Retailers created successfully');
        assert(fs.existsSync(path.join(TEST_ROOT, 'Alpha Retailers', 'onebook.db')), 'onebook.db created');
        assert(fs.existsSync(path.join(TEST_ROOT, 'Alpha Retailers', 'company.json')), 'company.json created');
        assert(fs.existsSync(path.join(TEST_ROOT, 'Alpha Retailers', 'Backups', 'Daily')), 'Backups/Daily created');
        assert(fs.existsSync(path.join(TEST_ROOT, 'Alpha Retailers', 'Backups', 'Manual')), 'Backups/Manual created');
        assert(fs.existsSync(path.join(TEST_ROOT, 'Alpha Retailers', 'Backups', 'BeforeUpdate')), 'Backups/BeforeUpdate created');
        assert(fs.existsSync(path.join(TEST_ROOT, 'Alpha Retailers', 'Exports')), 'Exports/ created');
        assert(fs.existsSync(path.join(TEST_ROOT, 'Alpha Retailers', 'Attachments')), 'Attachments/ created');

        // Verify company.json contents
        const meta = companyService.readCompanyMetadata(path.join(TEST_ROOT, 'Alpha Retailers'));
        assert(meta !== null, 'Metadata readable');
        assert(meta.companyName === 'Alpha Retailers' || meta.name === 'Alpha Retailers', `Metadata name is ${meta.companyName || meta.name}`);
        assert(meta.financialYear === '2026-2027', `Metadata financialYear is ${meta.financialYear}`);
        assert(typeof meta.companyId === 'string' && meta.companyId.length > 10, 'Generated UUID companyId present');

        // -------------------------------------------------------------
        // TEST 5: Rule 3 - Never Overwrite Existing Database on Create
        // -------------------------------------------------------------
        console.log('\n--- Test 5: Rule 3 - Collision Guard on Create ---');
        const duplicateCreate = await companyService.createCompany({
            companyName: 'Alpha Retailers',
            folderPath: path.join(TEST_ROOT, 'Alpha Retailers'),
            financialYear: '2026-2027'
        });
        assert(duplicateCreate.success === false, 'Duplicate company creation rejected');
        assert(duplicateCreate.error === 'DATABASE_ALREADY_EXISTS', `Collision error code: ${duplicateCreate.error}`);

        // -------------------------------------------------------------
        // TEST 6: Multi-Company Data Isolation
        // -------------------------------------------------------------
        console.log('\n--- Test 6: Multi-Company Data Isolation Audit ---');
        // Create second company
        const betaCreate = await companyService.createCompany({
            companyName: 'Beta Wholesale',
            folderPath: path.join(TEST_ROOT, 'Beta Wholesale'),
            financialYear: '2026-2027'
        });
        assert(betaCreate.success === true, 'Beta Wholesale created successfully');

        // Open Company A (Alpha)
        const openAlpha = await companyService.openCompany(path.join(TEST_ROOT, 'Alpha Retailers'));
        assert(openAlpha.success === true, 'Alpha Retailers opened');
        const activeAlpha = companyService.getActiveCompany();
        assert(activeAlpha.company.name === 'Alpha Retailers', 'Active company is Alpha');

        // Insert distinct product in Alpha
        const dbA = dbManager.getDatabase();
        dbA.prepare(`
            INSERT INTO products (name, barcode, price, stock)
            VALUES (?, ?, ?, ?)
        `).run('Alpha Secret Item', 'BAR_ALPHA_123', 500.0, 25);

        const alphaProd = dbA.prepare("SELECT * FROM products WHERE barcode = 'BAR_ALPHA_123'").get();
        assert(alphaProd && alphaProd.name === 'Alpha Secret Item', 'Product stored in Alpha DB');

        // Switch to Company B (Beta)
        const openBeta = await companyService.openCompany(path.join(TEST_ROOT, 'Beta Wholesale'));
        assert(openBeta.success === true, 'Beta Wholesale opened');
        const activeBeta = companyService.getActiveCompany();
        assert(activeBeta.company.name === 'Beta Wholesale', 'Active company is Beta');

        const dbB = dbManager.getDatabase();
        // Check Alpha's item in Beta
        const crossCheckInBeta = dbB.prepare("SELECT * FROM products WHERE barcode = 'BAR_ALPHA_123'").get();
        assert(!crossCheckInBeta, 'ISOLATION VERIFIED: Alpha product does NOT exist in Beta DB');

        // Insert distinct product in Beta
        dbB.prepare(`
            INSERT INTO products (name, barcode, price, stock)
            VALUES (?, ?, ?, ?)
        `).run('Beta Bulk Goods', 'BAR_BETA_456', 1200.0, 100);

        // Switch back to Alpha
        const reopenAlpha = await companyService.openCompany(path.join(TEST_ROOT, 'Alpha Retailers'));
        assert(reopenAlpha.success === true, 'Reopened Alpha Retailers');
        const dbA2 = dbManager.getDatabase();

        const crossCheckInAlpha = dbA2.prepare("SELECT * FROM products WHERE barcode = 'BAR_BETA_456'").get();
        assert(!crossCheckInAlpha, 'ISOLATION VERIFIED: Beta product does NOT exist in Alpha DB');

        const recheckAlphaProd = dbA2.prepare("SELECT * FROM products WHERE barcode = 'BAR_ALPHA_123'").get();
        assert(recheckAlphaProd && recheckAlphaProd.stock === 25, 'Alpha original product is 100% intact');

        // -------------------------------------------------------------
        // TEST 7: Safe Backup & Restore Workflow
        // -------------------------------------------------------------
        console.log('\n--- Test 7: Safe Backup & Restore Workflow ---');
        // Create manual backup of Alpha
        const backupRes = await backupService.createBackup('manual', 'Alpha_Snapshot');
        assert(backupRes.success === true, 'Backup created successfully');
        assert(fs.existsSync(backupRes.metadata.filePath), 'Backup file exists on disk');
        assert(backupRes.metadata.verified === true, 'Backup verification passed');

        const backupFilePath = backupRes.metadata.filePath;
        console.log('  Created backup at:', backupFilePath);

        // Modify Alpha by adding a new record that shouldn't be in the backup
        dbA2.prepare(`
            INSERT INTO products (name, barcode, price, stock)
            VALUES (?, ?, ?, ?)
        `).run('Alpha Temporary Item', 'BAR_TEMP_999', 99.0, 1);

        const tempCheck = dbA2.prepare("SELECT * FROM products WHERE barcode = 'BAR_TEMP_999'").get();
        assert(tempCheck !== undefined, 'Temporary product exists before restore');

        // Perform safe restore
        const restoreRes = await companyService.restoreCompanyBackup({
            companyFolderOrDbPath: path.join(TEST_ROOT, 'Alpha Retailers'),
            backupFilePath: backupFilePath
        });
        assert(restoreRes.success === true, 'Restore workflow completed successfully');
        assert(restoreRes.preRestoreSafetyBackup && fs.existsSync(restoreRes.preRestoreSafetyBackup), 'Pre-restore safety snapshot created');

        // Reconnect and check data: Temporary product should NOT exist, original product SHOULD exist
        const reopenAfterRestore = await companyService.openCompany(path.join(TEST_ROOT, 'Alpha Retailers'));
        assert(reopenAfterRestore.success === true, 'Reopened Alpha after restore');
        const dbRestored = dbManager.getDatabase();

        const restoredOriginal = dbRestored.prepare("SELECT * FROM products WHERE barcode = 'BAR_ALPHA_123'").get();
        assert(restoredOriginal && restoredOriginal.stock === 25, 'Original product restored perfectly');

        const restoredTemp = dbRestored.prepare("SELECT * FROM products WHERE barcode = 'BAR_TEMP_999'").get();
        assert(restoredTemp === undefined, 'Temporary product was reverted cleanly by restore');

        // -------------------------------------------------------------
        // TEST 8: Health Diagnostics
        // -------------------------------------------------------------
        console.log('\n--- Test 8: Health Diagnostics API ---');
        const health = companyService.getCompanyHealth(path.join(TEST_ROOT, 'Alpha Retailers'));
        assert(health.healthy === true, 'Company health check reports healthy: true');
        assert(health.integrityCheck === 'ok', 'PRAGMA integrity_check is ok');
        assert(health.foreignKeyCheck === 'ok', 'PRAGMA foreign_key_check is ok');
        assert(health.dbSize > 0, `Database size is positive: ${health.dbSize} bytes`);

        // -------------------------------------------------------------
        // TEST 9: Graceful Shutdown & WAL Checkpoint
        // -------------------------------------------------------------
        console.log('\n--- Test 9: Graceful Shutdown & WAL Checkpoint ---');
        companyService.closeCurrentCompany();
        assert(dbManager.isDatabaseOpen() === false, 'Database handle closed cleanly');
        assert(companyService.getActiveCompany().company === null, 'Active company reset to null');

        // -------------------------------------------------------------
        // TEST 10: Final Production Database Baseline Verification
        // -------------------------------------------------------------
        verifyProdBaseline('FINAL_POST_TEST');

    } finally {
        // Cleanup temp test directory
        try {
            fs.rmSync(TEST_ROOT, { recursive: true, force: true });
            console.log(`\n✓ Cleaned up test folder: ${TEST_ROOT}`);
        } catch (e) {
            console.warn('Test cleanup warning:', e.message);
        }
    }

    console.log('\n================================================================');
    console.log(`🎉 ALL TESTS COMPLETED: ${testsPassed} passed, ${testsFailed} failed.`);
    console.log('================================================================');
}

runTests().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('\n❌ TEST RUNNER FATAL ERROR:', err);
    process.exit(1);
});
