const electron = require('electron');

if (typeof electron === 'string') {
    const { spawn } = require('child_process');
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electron, [__filename], { env, stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code || 0));
    return;
}

const { app, BrowserWindow, ipcMain } = electron;
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

app.disableHardwareAcceleration();

// Isolated test environment in /tmp
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook-admin-flow-test-'));
const testDbPath = path.join(tempDir, 'onebook_test.db');
process.env.ONEBOOK_DB_PATH = testDbPath;

console.log('================================================================');
console.log('🧪 OneBook - Admin Creation & Password Recovery Verification Suite');
console.log('📁 Test Database:', testDbPath);
console.log('================================================================');

const database = require('../database');
database.initializeDatabase(testDbPath, { allowCreate: true });

const userService = require('../services/userService');

// Set up mock license verification and authentication IPC handlers for the test window
const TEST_LICENSE_ID = 'LIC-TEST-RECOVERY-2026';
const TEST_DEVICE_ID = 'DEVICE-TEST-UUID-999';

// Seed initial admin user with known recovery key to test existing recovery key preservation
let initialRecoveryCode = 'K8M2-44PQ-99XX-11ZZ';

app.whenReady().then(async () => {
    // Register IPC handlers needed by login.html
    ipcMain.handle('auth:checkAdminStatus', async () => {
        const hasAdmin = userService.hasConfiguredAdmin();
        const configuredAdmin = hasAdmin ? userService.getConfiguredAdmin() : null;
        return {
            success: true,
            hasAdmin,
            mode: 'LICENSED',
            isLicensed: true,
            deviceId: TEST_DEVICE_ID,
            configuredUsername: configuredAdmin ? configuredAdmin.username : null
        };
    });

    ipcMain.handle('auth:verifyLicenseForSetup', async (event, key) => {
        const hasAdmin = userService.hasConfiguredAdmin();
        const configuredAdmin = hasAdmin ? userService.getConfiguredAdmin() : null;
        return {
            success: true,
            licenseId: TEST_LICENSE_ID,
            eligible: !hasAdmin,
            alreadyConfigured: hasAdmin,
            maskedUser: configuredAdmin ? configuredAdmin.username : null
        };
    });

    ipcMain.handle('auth:createAdminAccount', async (event, args) => {
        try {
            const { username, password, licenseId } = args || {};
            const res = await userService.createAdminAccount({
                username,
                password,
                licenseId: licenseId || TEST_LICENSE_ID,
                deviceId: TEST_DEVICE_ID
            });
            return { success: true, username: res.username };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('auth:resetAdminPassword', async (event, args) => {
        try {
            const { licenseId, recoveryCode, newPassword } = args || {};
            const res = await userService.resetAdminPasswordWithRecovery({
                licenseId: licenseId || TEST_LICENSE_ID,
                deviceId: TEST_DEVICE_ID,
                recoveryCode,
                newPassword
            });
            return { success: true, username: res.username };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('auth:login', async (event, { username, password }) => {
        return await userService.authenticate(username, password);
    });

    const win = new BrowserWindow({
        width: 1000,
        height: 750,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    await win.loadFile(path.join(__dirname, '../login.html'));

    try {
        console.log('\n--- CHECK 1: Verify DOM does not contain duplicate backup key display or copy button ---');
        const domCheck = await win.webContents.executeJavaScript(`(() => {
            const displayCodeEl = document.getElementById('displayRecoveryCodeText');
            const copyBtnEl = document.getElementById('btnCopyRecoveryCode');
            const step3Section = document.getElementById('step3SuccessSection');
            const proceedBtn = document.getElementById('btnProceedToLogin');
            
            // Check if any element contains the old warning text
            const textContent = step3Section ? step3Section.textContent : '';
            const hasBackupWarning = textContent.includes('Store this Backup Key in a safe place');
            const hasBackupKeyHeader = textContent.includes('Your Backup Key (Secure Recovery Code)');

            return {
                displayCodeExists: !!displayCodeEl,
                copyBtnExists: !!copyBtnEl,
                proceedBtnExists: !!proceedBtn,
                hasBackupWarning,
                hasBackupKeyHeader
            };
        })()`);

        assert.strictEqual(domCheck.displayCodeExists, false, 'Backup key display text element must NOT exist');
        assert.strictEqual(domCheck.copyBtnExists, false, 'Backup key copy button must NOT exist');
        assert.strictEqual(domCheck.hasBackupWarning, false, 'Backup key storage warning must NOT exist');
        assert.strictEqual(domCheck.hasBackupKeyHeader, false, 'Backup key dashed header must NOT exist');
        assert.strictEqual(domCheck.proceedBtnExists, true, 'Proceed to Login button must exist in Step 3');
        console.log('✓ DOM clean: extra backup key display, copy button, and instructions removed');

        console.log('\n--- CHECK 2: Create Admin Account in UI & Verify Simple Success Screen ---');
        // Open setup modal
        await win.webContents.executeJavaScript(`(() => {
            window.showStep1();
            document.getElementById('recoveryLicenseInput').value = 'OB-TEST-LIC-KEY';
        })()`);

        // Submit verify license
        await win.webContents.executeJavaScript(`window.submitVerifyLicense()`);
        await new Promise(r => setTimeout(r, 100));

        // Fill admin creation form
        await win.webContents.executeJavaScript(`(() => {
            document.getElementById('newAdminUsername').value = 'store_owner@pos.com';
            document.getElementById('newAdminPassword').value = 'InitialPass@123';
            document.getElementById('newAdminPasswordConfirm').value = 'InitialPass@123';
        })()`);

        // Submit create admin
        await win.webContents.executeJavaScript(`window.submitCreateAdmin()`);
        await new Promise(r => setTimeout(r, 200));

        // Inspect Step 3 Success screen state
        const createScreenState = await win.webContents.executeJavaScript(`(() => {
            const step2 = document.getElementById('step2CreateSection').style.display;
            const step3 = document.getElementById('step3SuccessSection').style.display;
            const title = document.getElementById('step3SuccessTitle').textContent;
            const subtitle = document.getElementById('step3SuccessSubtitle').textContent;
            return { step2, step3, title, subtitle };
        })()`);

        assert.strictEqual(createScreenState.step2, 'none', 'Create section must be hidden');
        assert.strictEqual(createScreenState.step3, 'block', 'Step 3 success section must be visible');
        assert.strictEqual(createScreenState.title, 'Admin Account Created!', 'Step 3 title must be Admin Account Created!');
        assert(createScreenState.subtitle.includes('proceed to login'), 'Step 3 subtitle must instruct proceeding to login');
        console.log('✓ Admin account created successfully and clean success screen displayed without backup key');

        // Click Proceed to Login
        await win.webContents.executeJavaScript(`document.getElementById('btnProceedToLogin').click()`);
        await new Promise(r => setTimeout(r, 100));

        const loginFormState = await win.webContents.executeJavaScript(`(() => {
            const modalDisplay = document.getElementById('authRecoveryModal').style.display;
            const emailValue = document.getElementById('email').value;
            return { modalDisplay, emailValue };
        })()`);

        assert.strictEqual(loginFormState.modalDisplay, 'none', 'Modal must be closed after clicking Proceed to Login');
        assert.strictEqual(loginFormState.emailValue, 'store_owner@pos.com', 'Login email input must be populated with created username');
        console.log('✓ Proceed to Login successfully closes modal and prefills email field');

        console.log('\n--- CHECK 3: Verify Original Recovery Key System Integrity in SQLite ---');
        const db = database.getDatabase();
        const adminInDb = db.prepare("SELECT id, username, recovery_code_hash FROM users WHERE username = 'store_owner@pos.com'").get();
        assert(adminInDb, 'Admin record must exist in SQLite database');
        assert(adminInDb.recovery_code_hash, 'Admin must have a recovery_code_hash in SQLite');
        assert(adminInDb.recovery_code_hash.startsWith('$argon2id$'), 'recovery_code_hash must use Argon2id format');
        console.log('✓ SQLite database has valid Argon2id recovery_code_hash');

        // Test normal login with created credentials
        const loginRes = await userService.authenticate('store_owner@pos.com', 'InitialPass@123');
        assert.strictEqual(loginRes.success, true, 'Login with created credentials must succeed');
        console.log('✓ Normal login with created admin credentials verified');

        console.log('\n--- CHECK 4: Test Password Reset using the Original Recovery Key ---');
        // Let's set a specific known original recovery key into the user's account to simulate the user's existing key
        const originalRecoveryKey = 'K9X4-77MN-22QR-88ZZ';
        const originalKeyHash = await userService.hashRecoveryCode(originalRecoveryKey);
        db.prepare("UPDATE users SET recovery_code_hash = ? WHERE id = ?").run(originalKeyHash, adminInDb.id);

        // Open Forgot Password modal in UI
        await win.webContents.executeJavaScript(`window.openAuthRecoveryModal()`);
        await new Promise(r => setTimeout(r, 150));

        const recoverModalState = await win.webContents.executeJavaScript(`(() => {
            const step1 = document.getElementById('step1LicenceSection').style.display;
            const step2Recover = document.getElementById('step2RecoverSection').style.display;
            const title = document.getElementById('recoveryModalTitle').textContent;
            return { step1, step2Recover, title };
        })()`);

        assert.strictEqual(recoverModalState.step2Recover, 'block', 'Step 2 Recover must display for existing admin');
        assert.strictEqual(recoverModalState.title, 'Reset Admin Password', 'Title must be Reset Admin Password');
        console.log('✓ Forgot Password modal opens directly to password reset for configured admin');

        // Enter original recovery key and new password
        await win.webContents.executeJavaScript(`(() => {
            document.getElementById('inputRecoveryCode').value = '${originalRecoveryKey}';
            document.getElementById('resetNewPassword').value = 'NewPassword@2026';
            document.getElementById('resetNewPasswordConfirm').value = 'NewPassword@2026';
        })()`);

        // Submit password reset
        await win.webContents.executeJavaScript(`window.submitResetPassword()`);
        await new Promise(r => setTimeout(r, 200));

        const resetSuccessState = await win.webContents.executeJavaScript(`(() => {
            const step2 = document.getElementById('step2RecoverSection').style.display;
            const step3 = document.getElementById('step3SuccessSection').style.display;
            const title = document.getElementById('step3SuccessTitle').textContent;
            const subtitle = document.getElementById('step3SuccessSubtitle').textContent;
            return { step2, step3, title, subtitle };
        })()`);

        assert.strictEqual(resetSuccessState.step2, 'none', 'Recover section must be hidden');
        assert.strictEqual(resetSuccessState.step3, 'block', 'Success section must be visible');
        assert.strictEqual(resetSuccessState.title, 'Password Reset Successfully!', 'Title must indicate success');
        console.log('✓ Password reset succeeded via UI and clean confirmation displayed');

        // Click Proceed to Login
        await win.webContents.executeJavaScript(`document.getElementById('btnProceedToLogin').click()`);
        await new Promise(r => setTimeout(r, 100));

        // Test login with new password
        const newLoginRes = await userService.authenticate('store_owner@pos.com', 'NewPassword@2026');
        assert.strictEqual(newLoginRes.success, true, 'Login with new password must succeed');
        console.log('✓ Login with newly reset password succeeded');

        // Test login with old password fails
        const oldLoginRes = await userService.authenticate('store_owner@pos.com', 'InitialPass@123');
        assert.strictEqual(oldLoginRes.success, false, 'Login with old password must fail');
        console.log('✓ Old password correctly rejected');

        console.log('\n--- CHECK 5: Confirm Original Recovery Key Was NOT Overwritten or Invalidated ---');
        // The original recovery key must STILL be valid!
        const dbAdminAfterReset = db.prepare("SELECT recovery_code_hash FROM users WHERE id = ?").get(adminInDb.id);
        const originalKeyStillValid = await userService.verifyRecoveryCodeHash(originalRecoveryKey, dbAdminAfterReset.recovery_code_hash);
        assert.strictEqual(originalKeyStillValid, true, 'Original recovery key must remain valid for subsequent recoveries');
        assert.strictEqual(dbAdminAfterReset.recovery_code_hash, originalKeyHash, 'recovery_code_hash in SQLite must NOT be changed');
        console.log('✓ Original recovery key hash preserved exactly in SQLite');

        console.log('\n--- CHECK 6: Test Subsequent Password Reset using the SAME Original Recovery Key ---');
        // Perform a second reset using the exact same original recovery key
        const secondReset = await userService.resetAdminPasswordWithRecovery({
            licenseId: TEST_LICENSE_ID,
            deviceId: TEST_DEVICE_ID,
            recoveryCode: originalRecoveryKey,
            newPassword: 'ThirdPassword@789'
        });
        assert.strictEqual(secondReset.success, true, 'Second reset using the original key must succeed');

        const thirdLoginRes = await userService.authenticate('store_owner@pos.com', 'ThirdPassword@789');
        assert.strictEqual(thirdLoginRes.success, true, 'Login with third password must succeed');
        console.log('✓ Second password reset with SAME original recovery key verified 100%');

        console.log('\n--- CHECK 7: Updating Admin Account Preserves Existing Recovery Key ---');
        // When createAdminAccount is called for an existing admin, it must not overwrite the existing recovery key
        await userService.createAdminAccount({
            username: 'store_owner@pos.com',
            password: 'UpdatedPassword@456',
            licenseId: TEST_LICENSE_ID,
            deviceId: TEST_DEVICE_ID
        });

        const dbAdminAfterUpdate = db.prepare("SELECT recovery_code_hash FROM users WHERE id = ?").get(adminInDb.id);
        assert.strictEqual(dbAdminAfterUpdate.recovery_code_hash, originalKeyHash, 'Updating credentials must preserve existing recovery key');
        
        const keyStillValidAfterUpdate = await userService.verifyRecoveryCodeHash(originalRecoveryKey, dbAdminAfterUpdate.recovery_code_hash);
        assert.strictEqual(keyStillValidAfterUpdate, true, 'Original recovery key remains valid after account credential update');
        console.log('✓ Re-creating / updating admin credentials preserves existing recovery key');

        console.log('\n--- CHECK 8: Rate Limiting & Lockout Protection Still Active ---');
        // Test that 5 invalid recovery attempts still lock the account for security
        for (let i = 1; i <= 4; i++) {
            try {
                await userService.resetAdminPasswordWithRecovery({
                    licenseId: TEST_LICENSE_ID,
                    deviceId: TEST_DEVICE_ID,
                    recoveryCode: 'WRONG-KEY-1111-2222',
                    newPassword: 'SomePass@123'
                });
                assert.fail('Should fail on wrong key');
            } catch (err) {
                assert(err.message.includes('Invalid recovery code'), `Attempt ${i}: ${err.message}`);
            }
        }

        try {
            await userService.resetAdminPasswordWithRecovery({
                licenseId: TEST_LICENSE_ID,
                deviceId: TEST_DEVICE_ID,
                recoveryCode: 'WRONG-KEY-1111-2222',
                newPassword: 'SomePass@123'
            });
            assert.fail('5th attempt should lock account');
        } catch (err) {
            assert(err.message.includes('locked for 15 minutes'), '5th failed attempt locks recovery for 15 minutes');
        }
        console.log('✓ Rate limiting and 15-minute temporary lockout protection fully intact');

        console.log('\n================================================================');
        console.log('🎉 ALL 8 TESTS PASSED: Admin Creation & Recovery Flow 100% Verified!');
        console.log('================================================================\n');

        win.close();
        database.closeDatabase();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        app.quit();
        process.exit(0);
    } catch (err) {
        console.error('❌ TEST FAILED:', err);
        win.close();
        database.closeDatabase();
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        app.quit();
        process.exit(1);
    }
});
