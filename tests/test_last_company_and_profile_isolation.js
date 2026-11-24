/**
 * Automated Verification: Last Opened Company & Business Profile Isolation Test
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

// Isolate config to temporary directory so user's real config is never affected
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_test_isolation_'));
const testConfigPath = path.join(tempDir, 'test_config.json');
process.env.ONEBOOK_CONFIG_PATH = testConfigPath;
process.env.ONEBOOK_TEST_MODE = '1';

const companyService = require('../services/companyService');
const settingsService = require('../services/settingsService');
const dbManager = require('../database');

async function runTests() {
    console.log('=== Starting Last Company & Profile Isolation Tests ===');
    console.log('Isolated Test Dir:', tempDir);

    try {
        // Step 1: Initialize Data Directory
        const testDataDir = path.join(tempDir, 'Data');
        fs.mkdirSync(testDataDir, { recursive: true });
        companyService.setDataDirectory(testDataDir);

        // Step 2: Test Auto-Open when no company exists
        console.log('\n--- Test 1: Auto-Open with No Saved Company ---');
        let target = companyService.getLastOpenedCompanyTarget();
        assert.strictEqual(target, null, 'Should return null when no company has been opened');
        console.log('✓ Correctly returns null when no saved company');

        // Step 3: Create Company Alpha
        console.log('\n--- Test 2: Create and Open Company Alpha ---');
        const createAlphaRes = await companyService.createCompany({
            companyName: 'Alpha Supermart',
            financialYear: '2026-2027'
        });
        if (!createAlphaRes.success) {
            console.error('createAlphaRes failed:', createAlphaRes);
        }
        assert.strictEqual(createAlphaRes.success, true, 'Company Alpha creation should succeed');
        const alphaFolder = createAlphaRes.folderPath;
        const alphaDbPath = createAlphaRes.dbPath;

        const openAlphaRes = await companyService.openCompany(alphaFolder);
        assert.strictEqual(openAlphaRes.success, true, 'Company Alpha should open successfully');
        assert.strictEqual(openAlphaRes.company.companyName, 'Alpha Supermart');

        // Step 4: Verify Auto-Open returns Company Alpha
        console.log('\n--- Test 3: Auto-Open Points to Company Alpha ---');
        target = companyService.getLastOpenedCompanyTarget();
        assert.strictEqual(path.resolve(target), path.resolve(alphaFolder), 'Last opened company should be Alpha');
        console.log('✓ Auto-open target correctly points to Company Alpha:', target);

        // Step 5: Save Profile to Company Alpha SQLite DB
        console.log('\n--- Test 4: Save Settings for Company Alpha ---');
        const alphaProfile = {
            businessName: 'Alpha Supermart',
            tagline: 'Fresh Groceries Daily',
            mobile: '9876543210',
            email: 'contact@alpha.com',
            website: 'https://alpha.com',
            address: '123 Market St, Chennai',
            gstin: '33AAAAA0000A1Z5'
        };
        const saveAlphaRes = settingsService.saveAllSettings(alphaProfile);
        assert.strictEqual(saveAlphaRes.success, true, 'Settings save for Alpha should succeed');

        const readAlphaRes = settingsService.getAllSettings();
        assert.strictEqual(readAlphaRes.businessName, 'Alpha Supermart');
        assert.strictEqual(readAlphaRes.gstin, '33AAAAA0000A1Z5');
        console.log('✓ Alpha settings saved and retrieved from SQLite successfully');

        // Step 6: Create Company Beta (Clean slate)
        console.log('\n--- Test 5: Create and Open Company Beta ---');
        const createBetaRes = await companyService.createCompany({
            companyName: 'Beta Hardware',
            financialYear: '2026-2027'
        });
        assert.strictEqual(createBetaRes.success, true, 'Company Beta creation should succeed');
        const betaFolder = createBetaRes.folderPath;

        const openBetaRes = await companyService.openCompany(betaFolder);
        assert.strictEqual(openBetaRes.success, true, 'Company Beta should open successfully');

        // Step 7: Verify Company Beta has clean/empty profile (NO data leakage)
        console.log('\n--- Test 6: Verify Data Isolation (No Leakage into Beta) ---');
        const readBetaInitial = settingsService.getAllSettings();
        const betaProfile = settingsService.getBusinessProfile();
        assert.strictEqual(betaProfile.businessName, '', 'New company business name must be empty');
        assert.strictEqual(betaProfile.gstin, '', 'New company gstin must be empty');
        assert.strictEqual(betaProfile.mobile, '', 'New company mobile must be empty');
        console.log('✓ Verified: Beta has completely empty business profile (No leakage from Alpha!)');

        // Step 8: Save distinct Profile for Company Beta
        console.log('\n--- Test 7: Save Settings for Company Beta ---');
        const betaSettings = {
            businessName: 'Beta Hardware',
            tagline: 'Tools & Construction Supplies',
            mobile: '9123456789',
            email: 'sales@betahardware.com',
            website: 'https://betahardware.com',
            address: '456 Industrial Rd, Coimbatore',
            gstin: '33BBBBB1111B2Z6'
        };
        settingsService.saveAllSettings(betaSettings);
        const readBetaSaved = settingsService.getAllSettings();
        assert.strictEqual(readBetaSaved.businessName, 'Beta Hardware');
        assert.strictEqual(readBetaSaved.gstin, '33BBBBB1111B2Z6');
        console.log('✓ Beta settings saved and verified in SQLite');

        // Step 9: Switch back to Company Alpha and verify data is 100% intact
        console.log('\n--- Test 8: Switch Back to Alpha & Verify Isolation ---');
        await companyService.openCompany(alphaFolder);
        const readAlphaAgain = settingsService.getAllSettings();
        assert.strictEqual(readAlphaAgain.businessName, 'Alpha Supermart', 'Alpha businessName must be intact');
        assert.strictEqual(readAlphaAgain.gstin, '33AAAAA0000A1Z5', 'Alpha gstin must be intact');
        assert.strictEqual(readAlphaAgain.tagline, 'Fresh Groceries Daily', 'Alpha tagline must be intact');
        console.log('✓ Verified: Alpha profile data completely intact after switching');

        // Step 10: Switch back to Beta and verify
        console.log('\n--- Test 9: Switch Back to Beta & Verify Isolation ---');
        await companyService.openCompany(betaFolder);
        const readBetaAgain = settingsService.getAllSettings();
        assert.strictEqual(readBetaAgain.businessName, 'Beta Hardware', 'Beta businessName must be intact');
        assert.strictEqual(readBetaAgain.gstin, '33BBBBB1111B2Z6', 'Beta gstin must be intact');
        console.log('✓ Verified: Beta profile data completely intact after switching back');

        // Step 11: Test safety when company folder is deleted or corrupted
        console.log('\n--- Test 10: Auto-Open Safety when Database Missing ---');
        const missingTarget = companyService.getLastOpenedCompanyTarget();
        assert.ok(missingTarget, 'Target exists before deletion');
        
        // Simulate missing database by deleting the DB file inside Beta
        const betaDbFile = path.join(betaFolder, 'onebook.db');
        fs.unlinkSync(betaDbFile);

        const safeTarget = companyService.getLastOpenedCompanyTarget();
        assert.strictEqual(safeTarget, null, 'Must return null and NOT create empty db when db is missing');
        assert.strictEqual(fs.existsSync(betaDbFile), false, 'Must NEVER silently recreate missing db file');
        console.log('✓ Safe fallback: missing company db returns null and is never silently recreated');

        // Step 12: Close database cleanly
        companyService.closeCurrentCompany();

        console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! 🎉\n');
    } finally {
        // Cleanup temp test directory
        try {
            if (dbManager.isDatabaseOpen()) {
                dbManager.closeDatabase();
            }
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log('✓ Temporary test directory cleaned up.');
        } catch (e) {
            console.warn('Test cleanup warning:', e.message);
        }
    }
}

runTests().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
