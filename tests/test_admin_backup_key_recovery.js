const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

// Setup disposable test environment
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook-recovery-test-'));
const testDbPath = path.join(tempDir, 'onebook_test.db');
process.env.ONEBOOK_DB_PATH = testDbPath;

console.log('--- OneBook Admin Backup Key Recovery Test Suite ---');
console.log('Temporary DB Path:', testDbPath);

const database = require('../database');
database.initializeDatabase(testDbPath, { allowCreate: true });

const userService = require('../services/userService');

async function runTests() {
    try {
        console.log('\n[TEST 1] Verify Backup Key Generation and Argon2id Hashing Format');
        const code = userService.generateRecoveryCode();
        console.log('Generated Recovery Code sample:', code);
        assert.strictEqual(code.length, 19, 'Code formatted with hyphens should be 19 chars (XXXX-XXXX-XXXX-XXXX)');
        assert.strictEqual(code.replace(/[^A-Za-z0-9]/g, '').length, 16, 'Clean alphanumeric code should be 16 chars');
        
        const codeHash = await userService.hashRecoveryCode(code);
        assert(codeHash.startsWith('$argon2id$'), 'Stored recovery code hash must use Argon2id PHC format');
        console.log('✓ Backup Key format and Argon2id hash verified');

        console.log('\n[TEST 2] Create Licensed Admin with K-prefixed Backup Key');
        // Test with a synthetic K-prefixed recovery key
        const kPrefixedKey = 'K8X2-44MN-99PQ-22ZZ';
        const cleanKKey = kPrefixedKey.replace(/[^A-Za-z0-9]/g, '');
        assert(kPrefixedKey.startsWith('K'), 'Test key starts with K');
        
        const testLicenseId = 'lic_test_recovery_001';
        const testDeviceId = 'device_test_recovery_mach1';
        
        const adminRes = await userService.createAdminAccount({
            username: 'store_owner',
            password: 'InitialPassword@123',
            licenseId: testLicenseId,
            deviceId: testDeviceId
        });
        
        assert.strictEqual(adminRes.success, true, 'Admin account created successfully');
        console.log('Admin created. Generated key:', adminRes.recoveryCode);

        // Manually update the recovery code to the K-prefixed key to test K-prefixed recovery
        const db = database.getDatabase();
        const kHash = await userService.hashRecoveryCode(kPrefixedKey);
        db.prepare('UPDATE users SET recovery_code_hash = ? WHERE username = ?').run(kHash, 'store_owner');

        const dbUser = db.prepare('SELECT id, username, recovery_code_hash, license_id FROM users WHERE username = ?').get('store_owner');
        assert.strictEqual(dbUser.recovery_code_hash, kHash, 'K-hash stored in SQLite');
        assert(!dbUser.recovery_code_hash.includes(kPrefixedKey), 'Plaintext recovery code must NEVER be in database');
        console.log('✓ Admin account configured with K-prefixed Backup Key');

        console.log('\n[TEST 3] Verify K-prefixed Backup Key Normalization Variations');
        // Variation A: Exact key with hyphens
        const validA = await userService.verifyRecoveryCodeHash(kPrefixedKey, dbUser.recovery_code_hash);
        assert.strictEqual(validA, true, 'K-key with hyphens must verify');

        // Variation B: Lowercase without hyphens
        const validB = await userService.verifyRecoveryCodeHash(cleanKKey.toLowerCase(), dbUser.recovery_code_hash);
        assert.strictEqual(validB, true, 'Lowercase K-key without hyphens must verify');

        // Variation C: Mixed spaces
        const validC = await userService.verifyRecoveryCodeHash('K8X2 44MN 99PQ 22ZZ', dbUser.recovery_code_hash);
        assert.strictEqual(validC, true, 'K-key with spaces must verify');

        // Variation D: Invalid key
        const invalid = await userService.verifyRecoveryCodeHash('K999-0000-1111-2222', dbUser.recovery_code_hash);
        assert.strictEqual(invalid, false, 'Invalid recovery key must be rejected');
        console.log('✓ All normalization variations (hyphen, lowercase, spaces) verified');

        console.log('\n[TEST 4] Password Reset using K-prefixed Backup Key');
        const resetRes = await userService.resetAdminPasswordWithRecovery({
            licenseId: testLicenseId,
            deviceId: testDeviceId,
            recoveryCode: kPrefixedKey,
            newPassword: 'NewSecurePassword@456'
        });

        assert.strictEqual(resetRes.success, true, 'Password reset succeeded');
        assert.strictEqual(resetRes.username, 'store_owner');

        // Verify login with new password
        const authRes = await userService.authenticate('store_owner', 'NewSecurePassword@456');
        assert.strictEqual(authRes.success, true, 'Authentication with new password succeeded');
        console.log('✓ New password verified against Argon2id hash');

        // Verify login with old password fails
        const oldAuthRes = await userService.authenticate('store_owner', 'InitialPassword@123');
        assert.strictEqual(oldAuthRes.success, false, 'Authentication with old password correctly failed');
        console.log('✓ Old password rejected');

        // Verify existing original recovery key remains completely valid (not invalidated or overwritten)
        const keyStillValid = await userService.verifyRecoveryCodeHash(kPrefixedKey, db.prepare('SELECT recovery_code_hash FROM users WHERE username = ?').get('store_owner').recovery_code_hash);
        assert.strictEqual(keyStillValid, true, 'Existing original Backup Key must remain valid for future recoveries');
        console.log('✓ Existing original Backup Key preserved and verified valid');

        console.log('\n[TEST 5] Rate Limiting & Lockout Protection');
        const currentAdmin = userService.getConfiguredAdmin();
        const activeCode = kPrefixedKey;
        
        // Fail 4 times
        for (let i = 1; i <= 4; i++) {
            try {
                await userService.resetAdminPasswordWithRecovery({
                    licenseId: testLicenseId,
                    deviceId: testDeviceId,
                    recoveryCode: 'WRONG-CODE-TEST-1234',
                    newPassword: 'SomePassword@999'
                });
                assert.fail('Should have thrown on wrong code');
            } catch (err) {
                assert(err.message.includes('Invalid recovery code'), `Attempt ${i}: ${err.message}`);
            }
        }

        // 5th failed attempt triggers lockout
        try {
            await userService.resetAdminPasswordWithRecovery({
                licenseId: testLicenseId,
                deviceId: testDeviceId,
                recoveryCode: 'WRONG-CODE-TEST-1234',
                newPassword: 'SomePassword@999'
            });
            assert.fail('Should have locked out');
        } catch (err) {
            assert(err.message.includes('locked for 15 minutes'), '5th attempt locks account for 15 minutes');
        }

        // 6th attempt is blocked by active lockout, even if code is correct!
        try {
            await userService.resetAdminPasswordWithRecovery({
                licenseId: testLicenseId,
                deviceId: testDeviceId,
                recoveryCode: activeCode,
                newPassword: 'SomePassword@999'
            });
            assert.fail('Locked account should block recovery even with valid code');
        } catch (err) {
            assert(err.message.includes('Account recovery temporarily locked'), 'Locked account rejected');
        }
        console.log('✓ 5-attempt rate limiting and 15-minute temporary lockout verified');

        console.log('\n[TEST 6] Licence Mismatch Protection');
        // Clear lockout for testing licence mismatch
        db.prepare('UPDATE users SET recovery_locked_until = NULL, recovery_attempts = 0 WHERE id = ?').run(currentAdmin.id);

        try {
            await userService.resetAdminPasswordWithRecovery({
                licenseId: 'DIFFERENT_LICENCE_KEY',
                deviceId: testDeviceId,
                recoveryCode: activeCode,
                newPassword: 'AnotherPassword@789'
            });
            assert.fail('Should fail on licence mismatch');
        } catch (err) {
            assert(err.message.includes('Licence key mismatch'), 'Licence mismatch correctly blocked');
        }
        console.log('✓ Licence key mismatch protection verified');

        console.log('\n[TEST 7] Recovery without explicit licenseId (Auto-resolution fallback)');
        // Calling with licenseId matching or null (resolving from admin.license_id)
        const autoResetRes = await userService.resetAdminPasswordWithRecovery({
            licenseId: null,
            deviceId: testDeviceId,
            recoveryCode: activeCode,
            newPassword: 'FinalPassword@000'
        });
        assert.strictEqual(autoResetRes.success, true, 'Password reset succeeded with auto-resolved licence ID');
        console.log('✓ Auto-resolved licence ID recovery verified');

        console.log('\n======================================================');
        console.log('ALL TESTS PASSED: Admin Backup Key Recovery Flow is 100% Verified!');
        console.log('======================================================\n');
    } catch (e) {
        console.error('TEST FAILED:', e);
        process.exit(1);
    } finally {
        database.closeDatabase();
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

runTests();
