const crypto = require('crypto');
const database = require('../database');

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
     * Hash a password using Node.js native crypto.scrypt
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
     * Timing-safe verification of password against stored hash and salt
     */
    async verifyPassword(password, storedHash, salt) {
        if (!password || !storedHash || !salt) {
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
            console.error('[UserService] verifyPassword error:', e);
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
            name: session.name,
            username: session.username,
            userCode: session.user_code,
            role: session.role,
            status: session.status,
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
            SELECT id, name, username, user_code, password_hash, salt, role, status, permissions_json
            FROM users
            WHERE username = ? COLLATE NOCASE
        `).get(username.trim());

        if (!user) {
            return { success: false, error: 'Incorrect username or password.' };
        }

        if (user.status === 'disabled') {
            return { success: false, error: 'This account has been disabled. Please contact the Administrator.' };
        }

        const isValid = await this.verifyPassword(password, user.password_hash, user.salt);
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
                permissions
            },
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
     * Change user password: hashes with new salt and revokes all active sessions
     */
    async changePassword(userId, newPassword) {
        if (!userId || !newPassword || typeof newPassword !== 'string' || newPassword.length === 0) {
            throw new Error('User ID and valid new password are required');
        }

        const db = database.getDatabase();
        const salt = this.generateSalt();
        const passwordHash = await this.hashPassword(newPassword, salt);
        const nowIso = new Date().toISOString();

        const stmt = db.prepare(`
            UPDATE users
            SET password_hash = ?, salt = ?, updated_at = ?
            WHERE id = ?
        `);
        const info = stmt.run(passwordHash, salt, nowIso, userId);
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
