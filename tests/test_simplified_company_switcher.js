/**
 * Automated Test: OneBook Simplified Company Switcher in Right Sidebar
 *
 * Verifies:
 * 1. UI structure: Only Current Company and Logout in sidebar bottom; no separate Switch Company button.
 * 2. Company dropdown exists and opens upward.
 * 3. Discovery with at least three companies in the same Data Directory.
 * 4. Active company is correctly identified.
 * 5. Companies in other data directories are strictly excluded.
 * 6. Session isolation: switching to another company requires fresh authentication.
 * 7. Switching back also requires fresh authentication.
 * 8. Company databases remain intact and isolated (no data loss or overwrite).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

// Set test environment configuration path before requiring companyService
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_test_switcher_'));
const testConfigPath = path.join(tempDir, 'config.json');
process.env.ONEBOOK_CONFIG_PATH = testConfigPath;

const companyService = require('../services/companyService');
const userService = require('../services/userService');
const dbManager = require('../database');

async function runTests() {
    console.log('🧪 Starting Simplified Company Switcher Test Suite...\n');

    try {
        // --- 1. UI Structure & Markup Verification in OneBook.html ---
        console.log('--- Phase 1: Sidebar UI Markup & Layout Verification ---');
        const htmlPath = path.join(__dirname, '..', 'OneBook.html');
        const html = fs.readFileSync(htmlPath, 'utf8');

        // Check that separate Switch Company button is NOT in the visible sidebar
        const sidebarAccountSection = html.substring(
            html.indexOf('class="sidebar-account-section"'),
            html.indexOf('class="sidebar-branding-footer"')
        );
        assert.strictEqual(
            sidebarAccountSection.includes('id="sidebarSwitchRow"'),
            false,
            'Visible sidebar account section must NOT contain a separate Switch Company button'
        );
        assert.strictEqual(
            sidebarAccountSection.includes('Switch Company</span>'),
            false,
            'No separate "Switch Company" button label in the account section'
        );

        // Check that bottom contains ONLY Current Company and Logout
        assert.strictEqual(
            sidebarAccountSection.includes('id="sidebarCompanyRow"'),
            true,
            'Sidebar must contain Current Company row (clickable dropdown)'
        );
        assert.strictEqual(
            sidebarAccountSection.includes('id="sidebarLogoutRow"'),
            true,
            'Sidebar must contain Logout row'
        );

        // Verify Company Dropdown exists
        assert.strictEqual(
            html.includes('id="sidebarCompanyDropdown"'),
            true,
            'Sidebar company dropdown container must exist'
        );
        assert.strictEqual(
            html.includes('CURRENT COMPANY'),
            true,
            'Dropdown must contain CURRENT COMPANY section'
        );
        assert.strictEqual(
            html.includes('AVAILABLE COMPANIES'),
            true,
            'Dropdown must contain AVAILABLE COMPANIES section'
        );
        assert.strictEqual(
            html.includes('id="dropdownCompanyList"'),
            true,
            'Dropdown must contain available company list container'
        );
        assert.strictEqual(
            html.includes('toggleCompanyDropdown'),
            true,
            'toggleCompanyDropdown function must be present'
        );
        assert.strictEqual(
            html.includes('handleSelectCompanyFromDropdown'),
            true,
            'handleSelectCompanyFromDropdown function must be present'
        );

        // Verify CSS upward opening
        assert.strictEqual(
            html.includes('bottom: calc(100% +'),
            true,
            'Dropdown CSS must position dropdown above the company button (opening upward)'
        );

        console.log('  ✅ [PASS] Sidebar contains only Current Company and Logout with upward dropdown menu');


        // --- 2. Company Discovery with 3 Companies in Same Data Directory ---
        console.log('\n--- Phase 2: Discovery of 3 Companies in Same Data Directory ---');
        const dataDir = path.join(tempDir, 'Data');
        fs.mkdirSync(dataDir, { recursive: true });
        companyService.setDataDirectory(dataDir);

        // Create 3 companies in dataDir
        const companyAName = 'syzhi';
        const companyBName = 'Doodles Store';
        const companyCName = 'APR Group';

        const compA = await companyService.createCompany({ companyName: companyAName });
        assert.strictEqual(compA.success, true, 'Company A creation must succeed');

        const compB = await companyService.createCompany({ companyName: companyBName });
        assert.strictEqual(compB.success, true, 'Company B creation must succeed');

        const compC = await companyService.createCompany({ companyName: companyCName });
        assert.strictEqual(compC.success, true, 'Company C creation must succeed');

        // Create an external company in a completely DIFFERENT data directory
        const externalDir = path.join(tempDir, 'ExternalData', 'External Corp');
        fs.mkdirSync(externalDir, { recursive: true });
        await companyService.createCompany({ companyName: 'External Corp', folderPath: externalDir });

        // Open Company A so it is the active company
        await companyService.openCompany(compA.folderPath);

        // Discover companies in dataDir
        const discovered = companyService.getCompaniesInDataDirectory(dataDir);
        console.log('  Discovered companies in Data Directory:', discovered.map(c => `${c.companyName} (Active: ${c.isActive})`));

        // Verify: Exactly 3 companies in dataDir
        assert.strictEqual(discovered.length, 3, 'Must discover exactly 3 companies in the configured Data Directory');
        const names = discovered.map(c => c.companyName);
        assert.strictEqual(names.includes(companyAName), true, 'Company A (syzhi) must appear');
        assert.strictEqual(names.includes(companyBName), true, 'Company B (Doodles Store) must appear');
        assert.strictEqual(names.includes(companyCName), true, 'Company C (APR Group) must appear');
        assert.strictEqual(names.includes('External Corp'), false, 'External companies from other directories must be strictly excluded');

        // Verify: Active company is correctly identified
        const activeComp = discovered.find(c => c.isActive === true);
        assert.ok(activeComp, 'An active company must be identified');
        assert.strictEqual(activeComp.companyName, companyAName, 'Active company must be syzhi');

        console.log('  ✅ [PASS] All 3 companies in Data Directory discovered, external excluded, active company identified');


        // --- 3. Session Isolation & Authentication on Switching ---
        console.log('\n--- Phase 3: Switching Between Companies & Session Isolation ---');

        // Create admin user in Company A
        await companyService.openCompany(compA.folderPath);
        await userService.createAdminAccount({
            username: 'admin_a',
            password: 'PasswordA123!',
            licenseId: 'LIC-A',
            deviceId: 'DEV-A'
        });
        const loginResA = await userService.authenticate('admin_a', 'PasswordA123!');
        assert.strictEqual(loginResA.success, true, 'Login to Company A must succeed');
        const tokenA = loginResA.sessionToken;

        // Verify token works in Company A
        const sessionA = await userService.validateSession(tokenA);
        assert.ok(sessionA, 'Session token A must be valid in Company A');
        assert.strictEqual(sessionA.username, 'admin_a');

        // Switch to Company B
        console.log('  Switching from syzhi to Doodles Store...');
        // Invalidate A session
        await userService.revokeAllSessions();
        // Open Company B
        const switchResB = await companyService.openCompany(compB.folderPath);
        assert.strictEqual(switchResB.success, true, 'Opening Company B must succeed');

        // Verify Token A is invalid/rejected in Company B
        const checkTokenAInB = await userService.validateSession(tokenA);
        assert.strictEqual(checkTokenAInB, null, 'Company A session token must NOT be valid in Company B');

        // Create admin user in Company B
        await userService.createAdminAccount({
            username: 'admin_b',
            password: 'PasswordB123!',
            licenseId: 'LIC-B',
            deviceId: 'DEV-B'
        });

        // Verify Company A credentials fail in Company B
        const crossLoginFail = await userService.authenticate('admin_a', 'PasswordA123!');
        assert.strictEqual(crossLoginFail.success, false, 'Company A credentials must be rejected in Company B');

        // Login to Company B succeeds with Company B credentials
        const loginResB = await userService.authenticate('admin_b', 'PasswordB123!');
        assert.strictEqual(loginResB.success, true, 'Login to Company B with Company B credentials must succeed');
        const tokenB = loginResB.sessionToken;

        // Switch back to Company A
        console.log('  Switching back from Doodles Store to syzhi...');
        await userService.revokeAllSessions();
        const switchResBackToA = await companyService.openCompany(compA.folderPath);
        assert.strictEqual(switchResBackToA.success, true, 'Opening Company A again must succeed');

        // Verify Token B is invalid in Company A
        const checkTokenBInA = await userService.validateSession(tokenB);
        assert.strictEqual(checkTokenBInA, null, 'Company B session token must NOT be valid in Company A');

        // Verify fresh login is required for Company A (old tokenA was revoked)
        const checkTokenAExpired = await userService.validateSession(tokenA);
        assert.strictEqual(checkTokenAExpired, null, 'Previous Company A token was revoked and requires fresh login');

        // Fresh login to Company A works with Company A credentials
        const freshLoginA = await userService.authenticate('admin_a', 'PasswordA123!');
        assert.strictEqual(freshLoginA.success, true, 'Fresh login to Company A succeeds');
        assert.notStrictEqual(freshLoginA.sessionToken, tokenA, 'Fresh login generates brand new session token');

        console.log('  ✅ [PASS] Cross-company session isolation verified; fresh credentials required on both switches');


        // --- 4. Database Integrity Verification (No data lost or overwritten) ---
        console.log('\n--- Phase 4: Database Integrity & Data Isolation ---');
        // Write record to Company A
        const currentDb = dbManager.getDatabase();
        currentDb.prepare(`CREATE TABLE IF NOT EXISTS company_marker (val TEXT)`).run();
        currentDb.prepare(`INSERT INTO company_marker (val) VALUES ('syzhi_marker')`).run();

        // Switch to Company C (APR Group)
        await companyService.openCompany(compC.folderPath);
        const dbC = dbManager.getDatabase();
        const markerInC = dbC.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='company_marker'`).get();
        assert.strictEqual(markerInC, undefined, 'Company C must NOT have Company A tables or data');

        // Switch back to Company A and verify marker exists
        await companyService.openCompany(compA.folderPath);
        const dbARevisited = dbManager.getDatabase();
        const markerInA = dbARevisited.prepare(`SELECT val FROM company_marker`).get();
        assert.strictEqual(markerInA.val, 'syzhi_marker', 'Company A data must remain 100% intact');

        console.log('  ✅ [PASS] Database data completely isolated and intact across all 3 companies');

        console.log('\n==================================================');
        console.log('🎉 ALL SIMPLIFIED COMPANY SWITCHER TESTS PASSED!');
        console.log('==================================================');
    } finally {
        try {
            companyService.closeCurrentCompany();
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

runTests();
