// tests/test_company_auth_isolation.js
// Verification suite for Company Switching Authentication & Session Isolation

const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

// Use isolated test directory to prevent production pollution
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_test_auth_isolation_'));
const testConfigPath = path.join(TEST_DIR, 'test_config.json');
process.env.ONEBOOK_CONFIG_PATH = testConfigPath;
process.env.ONEBOOK_TEST_MODE = '1';

const dbManager = require('../database');
const companyService = require('../services/companyService');
const userService = require('../services/userService');

// Set isolated data directory
const testDataDir = path.join(TEST_DIR, 'Data');
fs.mkdirSync(testDataDir, { recursive: true });
companyService.setDataDirectory(testDataDir);

async function runTests() {
    console.log('==================================================');
    console.log('🧪 Running Company Authentication & Session Isolation Tests');
    console.log('==================================================\n');

    let passed = 0;
    let failed = 0;

    function report(name, fn) {
        try {
            fn();
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${name}`);
            console.error(`     Error: ${err.message}\n     Stack: ${err.stack}`);
            failed++;
        }
    }

    async function reportAsync(name, fn) {
        try {
            await fn();
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${name}`);
            console.error(`     Error: ${err.message}\n     Stack: ${err.stack}`);
            failed++;
        }
    }

    try {
        // Step 1: Create Company A (Suzhi Test)
        console.log('--- Step 1: Create Company A & Company B ---');
        const compARes = await companyService.createCompany({
            companyName: 'Suzhi Enterprises',
            financialYear: '2026-2027',
            folderName: 'suzhi_ent'
        });
        assert(compARes.success, 'Failed to create Company A: ' + compARes.error);
        const compAPath = compARes.folderPath;
        console.log('Created Company A at:', compAPath);

        // Open Company A and set up admin user
        await companyService.openCompany(compAPath);
        const adminA = await userService.createAdminAccount({
            username: 'admin_suzhi',
            password: 'SuzhiPass123!',
            licenseId: 'LIC-SUZHI-001',
            deviceId: 'DEV-001'
        });
        assert(adminA.success, 'Failed to setup admin in Company A');

        // Step 2: Create Company B (Doodles Store Test)
        const compBRes = await companyService.createCompany({
            companyName: 'Doodles Retail Store',
            financialYear: '2026-2027',
            folderName: 'doodles_retail'
        });
        assert(compBRes.success, 'Failed to create Company B: ' + compBRes.error);
        const compBPath = compBRes.folderPath;
        console.log('Created Company B at:', compBPath);

        // Open Company B and set up admin user
        await companyService.openCompany(compBPath);
        const adminB = await userService.createAdminAccount({
            username: 'admin_doodles',
            password: 'DoodlesPass456!',
            licenseId: 'LIC-DOODLES-002',
            deviceId: 'DEV-002'
        });
        assert(adminB.success, 'Failed to setup admin in Company B');

        // Close all companies for initial clean state
        companyService.closeCurrentCompany();

        console.log('\n--- Test Phase 1: Authentication Scoped to Company A ---');

        let sessionTokenA = null;
        await reportAsync('Authenticate user in Company A succeeds with valid credentials', async () => {
            await companyService.openCompany(compAPath);
            const authRes = await userService.authenticate('admin_suzhi', 'SuzhiPass123!');
            assert(authRes.success, 'Authentication failed: ' + authRes.error);
            assert(authRes.sessionToken, 'Session token missing');
            assert(authRes.user && authRes.user.username === 'admin_suzhi', 'Incorrect user authenticated');
            sessionTokenA = authRes.sessionToken;

            // Verify session validation in Company A
            const validated = await userService.validateSession(sessionTokenA);
            assert(validated, 'Session token failed validation in Company A');
            assert.strictEqual(validated.username, 'admin_suzhi');
            assert.strictEqual(validated.status, 'active');
        });

        await reportAsync('Authentication in Company A rejects invalid password', async () => {
            const badAuth = await userService.authenticate('admin_suzhi', 'WrongPassword!');
            assert.strictEqual(badAuth.success, false, 'Expected authentication to fail for wrong password');
        });

        await reportAsync('Authentication in Company A rejects credentials belonging to Company B', async () => {
            const crossAuth = await userService.authenticate('admin_doodles', 'DoodlesPass456!');
            assert.strictEqual(crossAuth.success, false, 'Expected Company B user not to exist in Company A');
        });

        console.log('\n--- Test Phase 2: Switch Company Invalidation ---');

        await reportAsync('Switch Company revokes all active sessions in Company A before close', async () => {
            // Revoke all active sessions on switch
            const revokedCount = await userService.revokeAllSessions();
            assert(revokedCount >= 1, 'Expected at least 1 session to be revoked');

            // Verify that token A is now marked revoked in Company A's DB
            const checkRevoked = await userService.validateSession(sessionTokenA);
            assert.strictEqual(checkRevoked, null, 'Revoked session token must fail validation');

            // Close Company A
            companyService.closeCurrentCompany();
            const activeRes = companyService.getActiveCompany();
            assert.strictEqual(activeRes.company, null, 'Active company must be null after close');
        });

        console.log('\n--- Test Phase 3: Cross-Company Token Isolation ---');

        let sessionTokenB = null;
        await reportAsync('Opening Company B: Company A session token is rejected in Company B', async () => {
            await companyService.openCompany(compBPath);
            assert(dbManager.isDatabaseOpen(), 'Company B database not open');

            // Attempt to validate Company A's session token against Company B database
            const crossValidated = await userService.validateSession(sessionTokenA);
            assert.strictEqual(crossValidated, null, 'Company A token must NOT be valid in Company B DB');
        });

        await reportAsync('Authenticate user in Company B succeeds independently', async () => {
            const authRes = await userService.authenticate('admin_doodles', 'DoodlesPass456!');
            assert(authRes.success, 'Authentication failed for Company B');
            assert(authRes.sessionToken, 'Session token missing in Company B');
            sessionTokenB = authRes.sessionToken;

            const validatedB = await userService.validateSession(sessionTokenB);
            assert(validatedB, 'Session token failed validation in Company B');
            assert.strictEqual(validatedB.username, 'admin_doodles');
        });

        console.log('\n--- Test Phase 4: Switch Back to Company A Requires Fresh Login ---');

        await reportAsync('Switching back to Company A invalidates Company B and requires fresh login for A', async () => {
            // Revoke Company B sessions and close
            await userService.revokeAllSessions();
            companyService.closeCurrentCompany();

            // Reopen Company A
            await companyService.openCompany(compAPath);

            // Previous sessionTokenA must still be rejected (was revoked on switch)
            const oldTokenCheck = await userService.validateSession(sessionTokenA);
            assert.strictEqual(oldTokenCheck, null, 'Old Company A token must remain invalid');

            // Company B token must also be rejected in Company A
            const tokenBCheck = await userService.validateSession(sessionTokenB);
            assert.strictEqual(tokenBCheck, null, 'Company B token must not be valid in Company A');

            // Fresh login must be performed
            const freshLogin = await userService.authenticate('admin_suzhi', 'SuzhiPass123!');
            assert(freshLogin.success, 'Fresh login failed in Company A');
            assert.notStrictEqual(freshLogin.sessionToken, sessionTokenA, 'New session must have fresh token');

            const newValidated = await userService.validateSession(freshLogin.sessionToken);
            assert(newValidated, 'Fresh token failed validation');
        });

        console.log('\n--- Test Phase 5: Logout Flow Destroys Session ---');

        await reportAsync('Explicit logout destroys active session immediately', async () => {
            const loginRes = await userService.authenticate('admin_suzhi', 'SuzhiPass123!');
            assert(loginRes.success);
            const tokenToRevoke = loginRes.sessionToken;

            // Valid before logout
            const before = await userService.validateSession(tokenToRevoke);
            assert(before !== null, 'Session should be valid before logout');

            // Revoke via logout
            const revoked = await userService.revokeSession(tokenToRevoke);
            assert.strictEqual(revoked, true, 'revokeSession should return true');

            // Invalid after logout
            const after = await userService.validateSession(tokenToRevoke);
            assert.strictEqual(after, null, 'Session must be null after logout');
        });

        console.log('\n--- Test Phase 6: Application Shutdown / Invalidation ---');

        await reportAsync('Application shutdown revokes all active sessions', async () => {
            const loginRes = await userService.authenticate('admin_suzhi', 'SuzhiPass123!');
            assert(loginRes.success);
            const activeToken = loginRes.sessionToken;

            // Simulate app shutdown cleanup
            await userService.revokeAllSessions();
            companyService.closeCurrentCompany();

            // Reopen database
            await companyService.openCompany(compAPath);
            const checkAfterReopen = await userService.validateSession(activeToken);
            assert.strictEqual(checkAfterReopen, null, 'Sessions must not persist across application shutdowns');
        });

    } finally {
        // Clean up test directory
        try {
            companyService.closeCurrentCompany();
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        } catch (e) {
            console.warn('Cleanup warning:', e.message);
        }
    }

    console.log('\n==================================================');
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Unhandled test suite failure:', err);
    process.exit(1);
});
