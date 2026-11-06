const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set up temporary test database path to avoid modifying production data during unit tests
const testDbDir = path.join(os.tmpdir(), 'onebook_auth_test_' + Date.now());
fs.mkdirSync(testDbDir, { recursive: true });
const testDbPath = path.join(testDbDir, 'onebook_test.db');

console.log('🧪 Starting OneBook Secure Admin Authentication & Password Recovery Verification Suite...');
console.log('📁 Test Database:', testDbPath);

const database = require('../database');
const userService = require('../services/userService');

async function runTests() {
    // Initialize test database
    database.initializeDatabase(testDbPath, { allowCreate: true });
    const db = database.getDatabase();
    console.log('✅ 1. SQLite Test Database initialized with schema & Argon2id support');

    // -------------------------------------------------------------
    // Test 1: Verify Schema has all required columns
    // -------------------------------------------------------------
    const cols = db.pragma('table_info(users)').map(c => c.name);
    console.log('📊 Users table columns:', cols);
    assert(cols.includes('license_id'), 'Missing license_id column');
    assert(cols.includes('device_id'), 'Missing device_id column');
    assert(cols.includes('recovery_code_hash'), 'Missing recovery_code_hash column');
    assert(cols.includes('recovery_attempts'), 'Missing recovery_attempts column');
    assert(cols.includes('recovery_locked_until'), 'Missing recovery_locked_until column');
    assert(cols.includes('last_password_change'), 'Missing last_password_change column');
    console.log('✅ 2. Database Schema: All required admin auth & recovery columns present.');

    // -------------------------------------------------------------
    // Test 2: Demo Mode Login
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Demo Mode Access ---');
    const demoRes = await userService.loginDemo();
    assert(demoRes.success === true, 'Demo login failed');
    assert(demoRes.user.isDemo === true, 'Demo user must have isDemo flag');
    assert(demoRes.user.username === 'demo', 'Demo username mismatch');
    assert(typeof demoRes.sessionToken === 'string' && demoRes.sessionToken.length > 0, 'Demo session token missing');

    // Validate demo session
    const validatedDemo = await userService.validateSession(demoRes.sessionToken);
    assert(validatedDemo !== null, 'Demo session validation failed');
    assert(validatedDemo.username === 'demo', 'Validated demo username mismatch');
    console.log('✅ Demo Mode works seamlessly and creates valid session without requiring credentials.');

    // Standard login cannot use demo_user directly
    const demoAuthDirect = await userService.authenticate('demo', 'somepassword');
    assert(demoAuthDirect.success === false, 'Direct password login for demo user must be disallowed');
    console.log('✅ Demo Account cannot be logged in via standard password input (fail-safe).');

    // -------------------------------------------------------------
    // Test 3: Rejection of Default Hardcoded Credentials
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Default Credentials Deprecation ---');
    // Ensure default credentials admin@example.com / Admin@2026 fail on a clean DB
    const defaultAuth = await userService.authenticate('admin@example.com', 'Admin@2026');
    assert(defaultAuth.success === false, 'Default hardcoded credentials must not allow login');
    console.log('✅ Hardcoded default credentials (admin@example.com / Admin@2026) rejected.');

    // -------------------------------------------------------------
    // Test 4: Admin Account Creation with Argon2id & Licence Binding
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Create Admin Account with Argon2id ---');
    const testLicenseId = 'LIC-TEST-2026-ABCD';
    const testDeviceId = 'DEV-HW-999-XYZ';
    const testAdminUser = 'production_admin@mycompany.com';
    const testAdminPass = 'SuperSecurePass2026!';

    // Rejection of invalid inputs
    await assert.rejects(
        async () => {
            await userService.createAdminAccount({ username: '', password: '123', licenseId: testLicenseId, deviceId: testDeviceId });
        },
        /required/i,
        'Empty username should be rejected'
    );
    await assert.rejects(
        async () => {
            await userService.createAdminAccount({ username: 'admin', password: '123', licenseId: testLicenseId, deviceId: testDeviceId });
        },
        /at least 6 characters/i,
        'Short password should be rejected'
    );

    // Create valid Admin Account
    const createRes = await userService.createAdminAccount({
        username: testAdminUser,
        password: testAdminPass,
        licenseId: testLicenseId,
        deviceId: testDeviceId
    });

    assert(createRes.success === true, 'Admin creation failed');
    assert(createRes.username === testAdminUser, 'Username mismatch');
    assert(typeof createRes.recoveryCode === 'string' && createRes.recoveryCode.length >= 16, 'Recovery code must be generated');
    const initialRecoveryCode = createRes.recoveryCode;
    console.log('🔑 Generated Secure Recovery Code:', initialRecoveryCode);

    // Verify stored password hash is Argon2id
    const storedAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get(testAdminUser);
    assert(storedAdmin !== undefined, 'Admin record not found in database');
    assert(storedAdmin.password_hash.startsWith('$argon2id$'), 'Password hash MUST start with $argon2id$');
    assert(storedAdmin.password_hash !== testAdminPass, 'Plaintext password must NEVER be stored');
    assert(storedAdmin.license_id === testLicenseId, 'Licence ID binding mismatch');
    assert(storedAdmin.device_id === testDeviceId, 'Device ID binding mismatch');
    assert(storedAdmin.recovery_code_hash.startsWith('$argon2id$'), 'Recovery code MUST be hashed with Argon2id');
    console.log('✅ Admin Account saved in SQLite, hashed with Argon2id, and bound to licence & device.');

    // -------------------------------------------------------------
    // Test 5: Normal Login with New Admin Credentials
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Normal Login ---');
    // Wrong password rejected
    const wrongAuth = await userService.authenticate(testAdminUser, 'WrongPassword123');
    assert(wrongAuth.success === false, 'Wrong password must be rejected');
    console.log('✅ Incorrect password properly rejected.');

    // Correct password succeeds
    const correctAuth = await userService.authenticate(testAdminUser, testAdminPass);
    if (!correctAuth.success) console.error('correctAuth failure details:', correctAuth);
    assert(correctAuth.success === true, 'Valid login failed');
    assert(correctAuth.user.username === testAdminUser, 'Logged in username mismatch');
    assert(correctAuth.user.role === 'admin', 'User must have admin role');
    assert(correctAuth.user.isLicensed === true, 'User must have isLicensed true');
    console.log('✅ Correct Admin credentials authenticated against Argon2id hash.');

    // Session validation works
    const adminSession = await userService.validateSession(correctAuth.sessionToken);
    assert(adminSession !== null, 'Admin session validation failed');
    console.log('✅ Admin session token validated successfully.');

    // -------------------------------------------------------------
    // Test 6: Password Recovery Ownership Verification & Rate Limiting
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Password Recovery & Rate Limiting ---');

    // 6.1 Cannot reset with wrong licence ID
    await assert.rejects(
        async () => {
            await userService.resetAdminPasswordWithRecovery({
                licenseId: 'WRONG-LICENCE-ID',
                deviceId: testDeviceId,
                recoveryCode: initialRecoveryCode,
                newPassword: 'BrandNewPassword2026!'
            });
        },
        /Licence key mismatch/i,
        'Wrong licence key must be rejected'
    );
    console.log('✅ Password recovery with mismatched licence key rejected.');

    // 6.2 Cannot reset with wrong recovery code
    await assert.rejects(
        async () => {
            await userService.resetAdminPasswordWithRecovery({
                licenseId: testLicenseId,
                deviceId: testDeviceId,
                recoveryCode: 'WRONG-RECOVERY-CODE',
                newPassword: 'BrandNewPassword2026!'
            });
        },
        /Invalid recovery code/i,
        'Wrong recovery code must be rejected'
    );
    console.log('✅ Password recovery with incorrect recovery code rejected.');

    // 6.3 Rate Limiting: 5 failed attempts trigger lockout
    for (let attempt = 2; attempt <= 4; attempt++) {
        try {
            await userService.resetAdminPasswordWithRecovery({
                licenseId: testLicenseId,
                deviceId: testDeviceId,
                recoveryCode: 'WRONG-CODE-' + attempt,
                newPassword: 'NewPassword!'
            });
        } catch(e) {
            // expected
        }
    }

    // 5th failed attempt should lock out
    try {
        await userService.resetAdminPasswordWithRecovery({
            licenseId: testLicenseId,
            deviceId: testDeviceId,
            recoveryCode: 'WRONG-CODE-5',
            newPassword: 'NewPassword!'
        });
        assert.fail('5th attempt should trigger lockout');
    } catch(err) {
        assert(err.message.includes('locked for 15 minutes'), 'Should report 15 minute lockout');
        console.log('✅ Rate limiting: Account recovery successfully locked after 5 failed attempts.');
    }

    // Attempting during lockout fails even with correct code
    await assert.rejects(
        async () => {
            await userService.resetAdminPasswordWithRecovery({
                licenseId: testLicenseId,
                deviceId: testDeviceId,
                recoveryCode: initialRecoveryCode,
                newPassword: 'BrandNewPassword2026!'
            });
        },
        /temporarily locked/i,
        'Should be locked during lockout period'
    );
    console.log('✅ Lockout enforcement: Recovery requests blocked while locked.');

    // Clear lockout for testing successful recovery
    db.prepare('UPDATE users SET recovery_attempts = 0, recovery_locked_until = NULL WHERE id = ?').run(storedAdmin.id);

    // 6.4 Successful Password Reset with valid Recovery Code
    const newAdminPass = 'BrandNewPassword2026!';
    const resetRes = await userService.resetAdminPasswordWithRecovery({
        licenseId: testLicenseId,
        deviceId: testDeviceId,
        recoveryCode: initialRecoveryCode,
        newPassword: newAdminPass
    });

    assert(resetRes.success === true, 'Password reset failed');
    assert(typeof resetRes.newRecoveryCode === 'string', 'A new recovery code must be generated');
    assert(resetRes.newRecoveryCode !== initialRecoveryCode, 'New recovery code must differ from old one');
    console.log('✅ Password successfully reset! New Recovery Code issued:', resetRes.newRecoveryCode);

    // 6.5 Session Invalidation: Previous session must now be invalidated
    const oldSessionCheck = await userService.validateSession(correctAuth.sessionToken);
    assert(oldSessionCheck === null, 'Active sessions MUST be revoked after password reset');
    console.log('✅ Active sessions successfully revoked upon password reset.');

    // 6.6 Login with new password succeeds, old password fails
    const oldPassAuth = await userService.authenticate(testAdminUser, testAdminPass);
    assert(oldPassAuth.success === false, 'Old password must no longer work');
    const newPassAuth = await userService.authenticate(testAdminUser, newAdminPass);
    assert(newPassAuth.success === true, 'New password must allow login');
    console.log('✅ Login with new password succeeded, old password rejected.');

    console.log('\n======================================================');
    console.log('🎉 ALL 6 COMPREHENSIVE AUTH & RECOVERY TESTS PASSED! 🎉');
    console.log('======================================================');

    // Clean up test DB
    database.closeDatabase();
    try { fs.rmSync(testDbDir, { recursive: true, force: true }); } catch(e){}
}

runTests().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
