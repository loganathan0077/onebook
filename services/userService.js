const crypto = require('crypto');
const database = require('../database');
const { argon2id, argon2Verify } = require('hash-wasm');

class UserService {
    constructor() {
        this.scryptOptions = {
            N: 16384,
            r: 8,
            p: 1,
            maxmem: 32 * 1024 * 1024
        };
        this.keyLength = 64; // 64 bytes
        this.sessionDurationHours = 24;
    }

    /**
     * Generate a cryptographically secure random salt (hex string)
     */
    generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Generate 16-character alphanumeric recovery code formatted as XXXX-XXXX-XXXX-XXXX
     * Base32 alphabet omitting visually ambiguous characters (0, O, 1, I)
     */
    generateRecoveryCode() {
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        const bytes = crypto.randomBytes(16);
        let code = '';
        for (let i = 0; i < 16; i++) {
            code += chars[bytes[i] % chars.length];
            if (i % 4 === 3 && i !== 15) code += '-';
        }
        return code;
    }

    /**
     * Hash password using Argon2id (RFC 9106, 64 MB memory, 3 iterations, 1 lane, PHC format)
     */
    async hashPasswordArgon2id(password) {
        if (!password || typeof password !== 'string' || password.length === 0) {
            throw new Error('Password must be a non-empty string');
        }
        const salt = new Uint8Array(16);
        crypto.getRandomValues(salt);
        return await argon2id({
            password,
            salt,
            parallelism: 1,
            iterations: 3,
            memorySize: 65536, // 64 MB
            hashLength: 32,
            outputType: 'encoded'
        });
    }

    /**
     * Hash recovery code securely using Argon2id
     */
    async hashRecoveryCode(code) {
        if (!code || typeof code !== 'string') throw new Error('Recovery code required');
        const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return await this.hashPasswordArgon2id(clean);
    }

    /**
     * Verify recovery code against stored Argon2id hash
     */
    async verifyRecoveryCodeHash(inputCode, storedHash) {
        if (!inputCode || !storedHash) return false;
        const clean = inputCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        try {
            return await argon2Verify({
                password: clean,
                hash: storedHash
            });
        } catch (e) {
            console.error('[UserService] Recovery code verify error:', e);
            return false;
        }
    }

    /**
     * Legacy: Hash a password using Node.js native crypto.scrypt
     */
    async hashPassword(password, salt) {
        if (!password || typeof password !== 'string' || password.length === 0) {
            throw new Error('Password must be a non-empty string');
        }
        if (!salt || typeof salt !== 'string' || salt.length === 0) {
            throw new Error('Salt must be a non-empty string');
        }

        return new Promise((resolve, reject) => {
            crypto.scrypt(password, salt, this.keyLength, this.scryptOptions, (err, derivedKey) => {
                if (err) return reject(err);
                resolve(derivedKey.toString('hex'));
            });
        });
    }

    /**
     * Timing-safe verification of password against stored hash (Argon2id or legacy scrypt)
     */
    async verifyPassword(password, storedHash, salt, algorithm = null) {
        if (!password || !storedHash) {
            return false;
        }

        // 1. Argon2id verification
        if (storedHash.startsWith('$argon2id$') || algorithm === 'argon2id') {
            try {
                return await argon2Verify({
                    password,
                    hash: storedHash
                });
            } catch (e) {
                console.error('[UserService] Argon2id verification error:', e);
                return false;
            }
        }

        // 2. Legacy scrypt verification
        if (!salt) {
            return false;
        }

        try {
            const computedHashHex = await this.hashPassword(password, salt);
            const computedBuffer = Buffer.from(computedHashHex, 'hex');
            const storedBuffer = Buffer.from(storedHash, 'hex');

            if (computedBuffer.length !== storedBuffer.length || computedBuffer.length === 0) {
                return false;
            }

            return crypto.timingSafeEqual(computedBuffer, storedBuffer);
        } catch (e) {
            console.error('[UserService] scrypt verify error:', e);
            return false;
        }
    }

    /**
     * Generate cryptographically secure session token (256-bit / 64 hex chars)
     */
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Create user session with standard UTC ISO timestamp
     */
    async createSession(userId) {
        if (!userId) throw new Error('User ID required for session creation');
        const db = database.getDatabase();
        const token = this.generateSessionToken();
        const now = Date.now();
        const expiresAt = new Date(now + this.sessionDurationHours * 60 * 60 * 1000).toISOString();
        const createdAt = new Date(now).toISOString();

        const stmt = db.prepare(`
            INSERT INTO user_sessions (token, user_id, expires_at, revoked, created_at, last_activity)
            VALUES (?, ?, ?, 0, ?, ?)
        `);
        stmt.run(token, userId, expiresAt, createdAt, createdAt);

        return {
            token,
            userId,
            expiresAt
        };
    }

    /**
     * Validate session token: checks existence, revocation, timezone-safe UTC expiry, and active status
     */
    async validateSession(token) {
        if (!token || typeof token !== 'string') {
            return null;
        }

        const db = database.getDatabase();
        const session = db.prepare(`
            SELECT s.token, s.user_id, s.expires_at, s.revoked,
                   u.id, u.name, u.username, u.user_code, u.role, u.status, u.permissions_json
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
        `).get(token);

        if (!session) {
            return null;
        }

        if (session.revoked === 1) {
            return null;
        }

        const now = Date.now();
        const expiryTime = new Date(session.expires_at).getTime();
        if (isNaN(expiryTime) || now > expiryTime) {
            return null;
        }

        // Keep user object even if inactive so authorization guard can distinguish USER_DISABLED from invalid token
        // The status property is preserved on user object

        // Update last activity with UTC ISO string
        try {
            db.prepare(`UPDATE user_sessions SET last_activity = ? WHERE token = ?`).run(new Date(now).toISOString(), token);
        } catch (e) {
            // Non-fatal
        }

        let permissions = [];
        try {
            permissions = JSON.parse(session.permissions_json || '[]');
        } catch (e) {
            permissions = [];
        }

        return {
            userId: session.id,
            id: session.id,
            name: session.name,
            username: session.username,
            userCode: session.user_code,
            role: session.role,
            status: session.status,
            isDemo: session.id === 'demo_user' || session.username === 'demo',
            permissions
        };
    }

    /**
     * Revoke session token (Logout)
     */
    async revokeSession(token) {
        if (!token) return false;
        const db = database.getDatabase();
        const info = db.prepare(`UPDATE user_sessions SET revoked = 1 WHERE token = ?`).run(token);
        return info.changes > 0;
    }

    /**
     * Revoke all sessions for a specific user (on password change, disable, or delete)
     */
    async revokeAllUserSessions(userId) {
        if (!userId) return false;
        const db = database.getDatabase();
        const info = db.prepare(`UPDATE user_sessions SET revoked = 1 WHERE user_id = ?`).run(userId);
        return info.changes > 0;
    }

    /**
     * Authenticate user with username and password
     */
    async authenticate(username, password) {
        if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
            return { success: false, error: 'Username and password are required' };
        }

        const db = database.getDatabase();
        const user = db.prepare(`
            SELECT id, name, username, user_code, password_hash, salt, hash_algorithm, role, status, permissions_json, license_id, device_id
            FROM users
            WHERE username = ? COLLATE NOCASE
        `).get(username.trim());

        if (!user) {
            return { success: false, error: 'Incorrect username or password.' };
        }

        if (user.id === 'demo_user') {
            return { success: false, error: 'Please use "Continue in Demo Mode" to enter the demo account.' };
        }

        if (user.status === 'disabled') {
            return { success: false, error: 'This account has been disabled. Please contact the Administrator.' };
        }

        const isValid = await this.verifyPassword(password, user.password_hash, user.salt, user.hash_algorithm);
        if (!isValid) {
            return { success: false, error: 'Incorrect username or password.' };
        }

        const session = await this.createSession(user.id);

        let permissions = [];
        try {
            permissions = JSON.parse(user.permissions_json || '[]');
        } catch (e) {
            permissions = [];
        }

        return {
            success: true,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                userCode: user.user_code,
                role: user.role,
                status: user.status,
                licenseId: user.license_id || null,
                isLicensed: Boolean(user.license_id),
                permissions
            },
            sessionToken: session.token,
            expiresAt: session.expiresAt
        };
    }

    /**
     * Check if a licensed Admin account has already been initialized
     */
    hasConfiguredAdmin() {
        const db = database.getDatabase();
        const admin = db.prepare(`
            SELECT id, username, license_id, device_id 
            FROM users 
            WHERE role = 'admin' AND license_id IS NOT NULL AND length(trim(license_id)) > 0
        `).get();
        return Boolean(admin);
    }

    /**
     * Get configured admin user details (including recovery info)
     */
    getConfiguredAdmin() {
        const db = database.getDatabase();
        return db.prepare(`
            SELECT id, name, username, role, status, license_id, device_id, recovery_code_hash, recovery_attempts, recovery_locked_until, created_at, last_password_change 
            FROM users 
            WHERE role = 'admin' AND license_id IS NOT NULL AND length(trim(license_id)) > 0
            ORDER BY created_at DESC LIMIT 1
        `).get();
    }

    /**
     * Create / Setup new licensed Admin credentials
     */
    async createAdminAccount({ username, password, licenseId, deviceId }) {
        if (!username || typeof username !== 'string' || !username.trim()) {
            throw new Error('Valid username or email is required.');
        }
        if (!password || typeof password !== 'string' || password.length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }
        if (!licenseId || typeof licenseId !== 'string') {
            throw new Error('Valid licence ID is required to create Admin account.');
        }
        if (!deviceId || typeof deviceId !== 'string') {
            throw new Error('Valid device binding ID is required.');
        }

        const cleanUsername = username.trim();
        const db = database.getDatabase();

        // Generate recovery code and hash with Argon2id
        const recoveryCode = this.generateRecoveryCode();
        const recoveryCodeHash = await this.hashRecoveryCode(recoveryCode);

        // Hash password with Argon2id
        const passwordHash = await this.hashPasswordArgon2id(password);

        const nowIso = new Date().toISOString();

        // Check for existing admin or existing username (excluding demo_user)
        const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' AND id != 'demo_user'").get();
        const existingByUsername = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != 'demo_user'").get(cleanUsername);

        let adminId = 'admin_1';
        if (existingByUsername) {
            adminId = existingByUsername.id;
        } else if (existingAdmin) {
            adminId = existingAdmin.id;
        } else {
            adminId = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        }

        db.transaction(() => {
            // Delete any unbonded legacy admin record if replacing (never delete demo_user)
            if (existingAdmin && existingAdmin.id !== adminId && existingAdmin.id !== 'demo_user') {
                try { db.prepare("DELETE FROM users WHERE id = ?").run(existingAdmin.id); } catch(e){}
            }

            const stmt = db.prepare(`
                INSERT INTO users (
                    id, name, username, password_hash, salt, hash_algorithm, role, status, 
                    permissions_json, license_id, device_id, recovery_code_hash, recovery_attempts, 
                    recovery_locked_until, created_at, updated_at, last_password_change
                ) VALUES (
                    ?, ?, ?, ?, '', 'argon2id', 'admin', 'active',
                    '["all"]', ?, ?, ?, 0, NULL, ?, ?, ?
                )
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    username = excluded.username,
                    password_hash = excluded.password_hash,
                    salt = '',
                    hash_algorithm = 'argon2id',
                    role = 'admin',
                    status = 'active',
                    license_id = excluded.license_id,
                    device_id = excluded.device_id,
                    recovery_code_hash = excluded.recovery_code_hash,
                    recovery_attempts = 0,
                    recovery_locked_until = NULL,
                    updated_at = excluded.updated_at,
                    last_password_change = excluded.last_password_change
            `);
            stmt.run(adminId, cleanUsername, cleanUsername, passwordHash, licenseId, deviceId, recoveryCodeHash, nowIso, nowIso, nowIso);
        })();

        // Invalidate active sessions
        await this.revokeAllUserSessions(adminId);

        return {
            success: true,
            adminId,
            username: cleanUsername,
            recoveryCode
        };
    }

    /**
     * Password recovery: verifies licence + recovery code with rate limiting, hashes new password with Argon2id
     */
    async resetAdminPasswordWithRecovery({ licenseId, deviceId, recoveryCode, newPassword }) {
        if (!recoveryCode || typeof recoveryCode !== 'string' || !recoveryCode.trim()) {
            throw new Error('Recovery code is required.');
        }
        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters.');
        }

        const admin = this.getConfiguredAdmin();
        if (!admin) {
            throw new Error('No licensed Admin account found. Please setup an Admin account first.');
        }

        // Verify licence association
        if (admin.license_id !== licenseId) {
            throw new Error('Licence key mismatch: This account was created with a different licence key.');
        }

        const db = database.getDatabase();
        const now = Date.now();

        // Rate limiting check
        if (admin.recovery_locked_until) {
            const lockTime = new Date(admin.recovery_locked_until).getTime();
            if (now < lockTime) {
                const minutesLeft = Math.ceil((lockTime - now) / 60000);
                throw new Error(`Account recovery temporarily locked due to repeated failed attempts. Please try again in ${minutesLeft} minute(s).`);
            }
        }

        // Verify recovery code
        const isCodeValid = await this.verifyRecoveryCodeHash(recoveryCode, admin.recovery_code_hash);
        if (!isCodeValid) {
            const newAttempts = (admin.recovery_attempts || 0) + 1;
            let lockUntil = null;
            if (newAttempts >= 5) {
                lockUntil = new Date(now + 15 * 60 * 1000).toISOString(); // 15-minute lockout
            }
            db.prepare("UPDATE users SET recovery_attempts = ?, recovery_locked_until = ? WHERE id = ?")
              .run(newAttempts, lockUntil, admin.id);

            if (newAttempts >= 5) {
                throw new Error('Too many failed recovery attempts. Account recovery locked for 15 minutes.');
            } else {
                throw new Error(`Invalid recovery code. ${5 - newAttempts} attempt(s) remaining before temporary lockout.`);
            }
        }

        // Valid recovery: hash new password with Argon2id, generate fresh recovery code
        const newRecoveryCode = this.generateRecoveryCode();
        const newRecoveryCodeHash = await this.hashRecoveryCode(newRecoveryCode);
        const newPasswordHash = await this.hashPasswordArgon2id(newPassword);
        const nowIso = new Date().toISOString();

        db.prepare(`
            UPDATE users SET 
                password_hash = ?,
                salt = '',
                hash_algorithm = 'argon2id',
                recovery_code_hash = ?,
                recovery_attempts = 0,
                recovery_locked_until = NULL,
                updated_at = ?,
                last_password_change = ?
            WHERE id = ?
        `).run(newPasswordHash, newRecoveryCodeHash, nowIso, nowIso, admin.id);

        // Invalidate all active sessions
        await this.revokeAllUserSessions(admin.id);

        return {
            success: true,
            username: admin.username,
            newRecoveryCode
        };
    }

    /**
     * Demo login: creates an ephemeral demo session with full demo access
     */
    async loginDemo() {
        const demoUser = {
            id: 'demo_user',
            name: 'Demo Account',
            username: 'demo',
            userCode: 'DEMO',
            role: 'admin',
            status: 'active',
            isDemo: true,
            permissions: ['all']
        };

        const db = database.getDatabase();
        const existingDemo = db.prepare("SELECT id FROM users WHERE id = 'demo_user'").get();
        if (!existingDemo) {
            db.prepare(`
                INSERT INTO users (id, name, username, user_code, password_hash, salt, hash_algorithm, role, status, permissions_json, created_at, updated_at)
                VALUES ('demo_user', 'Demo Account', 'demo', 'DEMO', 'DEMO_MODE_ACTIVE', '', 'none', 'admin', 'active', '["all"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run();
        }

        const session = await this.createSession(demoUser.id);
        return {
            success: true,
            user: demoUser,
            sessionToken: session.token,
            expiresAt: session.expiresAt
        };
    }

    /**
     * Create new user
     */
    async createUser(userData) {
        const { id, name, username, userCode, password, role, status, permissions } = userData || {};
        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new Error('Name is required.');
        }
        if (!username || typeof username !== 'string' || !username.trim()) {
            throw new Error('Username is required.');
        }
        if (!password || typeof password !== 'string' || password.length === 0) {
            throw new Error('Password is required.');
        }

        const cleanUsername = username.trim();
        const db = database.getDatabase();
        const existing = db.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`).get(cleanUsername);
        if (existing) {
            const err = new Error('Username already exists');
            err.code = 'USER_ALREADY_EXISTS';
            throw err;
        }

        const userId = id || ('usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'));
        const salt = this.generateSalt();
        const passwordHash = await this.hashPassword(password, salt);
        const userRole = (role && ['admin', 'user', 'manager', 'cashier'].includes(role.toLowerCase())) ? role.toLowerCase() : 'user';
        const userStatus = (status && status === 'disabled') ? 'disabled' : 'active';
        const permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);
        const nowIso = new Date().toISOString();

        const stmt = db.prepare(`
            INSERT INTO users (id, name, username, user_code, password_hash, salt, hash_algorithm, role, status, permissions_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'scrypt', ?, ?, ?, ?, ?)
        `);
        stmt.run(userId, name.trim(), cleanUsername, userCode ? userCode.trim() : null, passwordHash, salt, userRole, userStatus, permsJson, nowIso, nowIso);

        return {
            id: userId,
            name: name.trim(),
            username: cleanUsername,
            userCode: userCode ? userCode.trim() : null,
            role: userRole,
            status: userStatus,
            permissions: Array.isArray(permissions) ? permissions : []
        };
    }

    /**
     * Update user details (name, userCode, role, status, permissions)
     */
    async updateUser(userId, updateData) {
        if (!userId) throw new Error('User ID is required');
        const db = database.getDatabase();
        const user = db.prepare(`SELECT id, role, status FROM users WHERE id = ?`).get(userId);
        if (!user) {
            const err = new Error('User not found');
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        // Check last active administrator protection if role is changing away from admin
        if (user.role === 'admin' && updateData.role && updateData.role !== 'admin') {
            await this.assertNotLastActiveAdmin(userId);
        }

        const name = updateData.name !== undefined ? String(updateData.name).trim() : null;
        const userCode = updateData.userCode !== undefined ? (updateData.userCode ? String(updateData.userCode).trim() : null) : null;
        const role = updateData.role ? String(updateData.role).toLowerCase() : user.role;
        const permsJson = updateData.permissions ? JSON.stringify(updateData.permissions) : null;
        const nowIso = new Date().toISOString();

        const updates = [];
        const params = [];

        if (name !== null) { updates.push('name = ?'); params.push(name); }
        if (updateData.userCode !== undefined) { updates.push('user_code = ?'); params.push(userCode); }
        if (updateData.role !== undefined) { updates.push('role = ?'); params.push(role); }
        if (permsJson !== null) { updates.push('permissions_json = ?'); params.push(permsJson); }
        updates.push('updated_at = ?'); params.push(nowIso);

        params.push(userId);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        return await this.getUser(userId);
    }

    /**
     * Toggle user status (active <-> disabled) with last active admin protection and session revocation
     */
    async toggleUserStatus(userId, targetStatus = null) {
        if (!userId) throw new Error('User ID is required');
        const db = database.getDatabase();
        const user = db.prepare(`SELECT id, role, status FROM users WHERE id = ?`).get(userId);
        if (!user) {
            const err = new Error('User not found');
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        const newStatus = targetStatus ? targetStatus : (user.status === 'active' ? 'disabled' : 'active');

        // Last active administrator protection: cannot disable the last active administrator
        if (user.role === 'admin' && newStatus === 'disabled') {
            await this.assertNotLastActiveAdmin(userId);
        }

        db.prepare(`UPDATE users SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, new Date().toISOString(), userId);

        // Disabling a user immediately revokes all their active sessions
        if (newStatus === 'disabled') {
            await this.revokeAllUserSessions(userId);
        }

        return { id: userId, status: newStatus };
    }

    /**
     * Delete user with last active admin protection and session cleanup
     */
    async deleteUser(userId) {
        if (!userId) throw new Error('User ID is required');
        const db = database.getDatabase();
        const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(userId);
        if (!user) {
            const err = new Error('User not found');
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        // Last active administrator protection: cannot delete the last active administrator
        if (user.role === 'admin') {
            await this.assertNotLastActiveAdmin(userId);
        }

        // Revoke sessions first, then delete user record
        await this.revokeAllUserSessions(userId);
        const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
        return { success: info.changes > 0, id: userId };
    }

    /**
     * Change user password: hashes with Argon2id and revokes all active sessions
     */
    async changePassword(userId, newPassword) {
        if (!userId || !newPassword || typeof newPassword !== 'string' || newPassword.length === 0) {
            throw new Error('User ID and valid new password are required');
        }

        const db = database.getDatabase();
        const passwordHash = await this.hashPasswordArgon2id(newPassword);
        const nowIso = new Date().toISOString();

        const stmt = db.prepare(`
            UPDATE users
            SET password_hash = ?, salt = '', hash_algorithm = 'argon2id', updated_at = ?, last_password_change = ?
            WHERE id = ?
        `);
        const info = stmt.run(passwordHash, nowIso, nowIso, userId);
        if (info.changes === 0) {
            const err = new Error('User not found');
            err.code = 'USER_NOT_FOUND';
            throw err;
        }

        // Changing password immediately revokes all existing sessions
        await this.revokeAllUserSessions(userId);

        return { success: true };
    }

    /**
     * Helper: assert that the given user is not the last active administrator
     */
    async assertNotLastActiveAdmin(userId) {
        const db = database.getDatabase();
        const activeAdmins = db.prepare(`
            SELECT id FROM users
            WHERE role = 'admin' AND status = 'active'
        `).all();

        if (activeAdmins.length <= 1 && activeAdmins.some(a => a.id === userId)) {
            const err = new Error('Operation rejected: Cannot delete or disable the last active administrator.');
            err.code = 'CANNOT_DISABLE_LAST_ADMIN';
            throw err;
        }
    }

    /**
     * Get single user sanitized (no password_hash, no salt)
     */
    async getUser(userId) {
        if (!userId) return null;
        const db = database.getDatabase();
        const r = db.prepare(`
            SELECT id, name, username, user_code, role, status, permissions_json, created_at, updated_at
            FROM users
            WHERE id = ?
        `).get(userId);

        if (!r) return null;
        return {
            id: r.id,
            name: r.name,
            username: r.username,
            userCode: r.user_code,
            role: r.role,
            status: r.status,
            permissions: (() => { try { return JSON.parse(r.permissions_json); } catch(e){ return []; } })(),
            createdAt: r.created_at,
            updatedAt: r.updated_at
        };
    }

    /**
     * Get all users sanitized (no password_hash, no salt)
     */
    async getUsers() {
        const db = database.getDatabase();
        const rows = db.prepare(`
            SELECT id, name, username, user_code, role, status, permissions_json, created_at, updated_at
            FROM users
            ORDER BY created_at ASC
        `).all();

        return rows.map(r => ({
            id: r.id,
            name: r.name,
            username: r.username,
            userCode: r.user_code,
            role: r.role,
            status: r.status,
            permissions: (() => { try { return JSON.parse(r.permissions_json); } catch(e){ return []; } })(),
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));
    }
}

module.exports = new UserService();
