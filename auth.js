// ============================================================
// auth.js - Secure SQLite RBAC Integration (Fail-Closed)
// ============================================================

let memorySessionUser = null;

/**
 * Attempt authentication through SQLite IPC.
 * Fails closed: no hardcoded credentials, no plaintext localStorage fallback.
 */
export async function login(username, password) {
    if (!username || !password) {
        return { success: false, error: 'Please enter both username/email and password.' };
    }

    if (!window.electronAPI || !window.electronAPI.sqlite || !window.electronAPI.sqlite.users) {
        return { 
            success: false, 
            error: 'Database offline: SQLite authentication bridge is unavailable. Automatic fallback is disabled.' 
        };
    }

    try {
        const cleanUser = username.trim();
        const res = await window.electronAPI.sqlite.users.login(cleanUser, password);

        // Case 1: IPC transport or database initialization error (res.success === false)
        if (!res || res.success === false) {
            const errMsg = res?.error?.message || '';
            const errCode = res?.error?.code;
            if (errMsg.includes('not initialized') || errCode === 'DATABASE_NOT_INITIALIZED') {
                return { success: false, error: 'Database offline: SQLite database is not connected.' };
            }
            return { success: false, error: errMsg || 'Authentication service unavailable: SQLite database error.' };
        }

        // Case 2: Business authentication rejection from userService (res.data?.success === false)
        if (res.data && res.data.success === false) {
            return { success: false, error: res.data.error || 'Incorrect username or password.' };
        }

        // Case 3: Successful authentication - must have both sessionToken and user
        const { sessionToken, user } = res.data || {};
        if (sessionToken && user && typeof sessionToken === 'string') {
            // Establish session
            memorySessionUser = user;
            if (window.electronAPI.sqlite.setSessionToken) {
                window.electronAPI.sqlite.setSessionToken(sessionToken);
            }

            // Ephemeral storage strictly for navigation continuity across page redirects
            sessionStorage.setItem('onebook_session_token', sessionToken);
            sessionStorage.setItem('currentUser', JSON.stringify(user));

            return { success: true, user };
        }

        // Case 4: Unexpected or malformed response
        return { success: false, error: 'Authentication failed: Invalid server session response.' };
    } catch (err) {
        console.error('Login error:', err);
        return { success: false, error: 'An unexpected authentication error occurred.' };
    }
}

/**
 * Logout and revoke active session
 */
export async function logout() {
    const token = sessionStorage.getItem('onebook_session_token') || 
                  (window.electronAPI?.sqlite?.getSessionToken ? window.electronAPI.sqlite.getSessionToken() : null);

    try {
        if (token && window.electronAPI?.sqlite?.users?.logout) {
            await window.electronAPI.sqlite.users.logout(token);
        }
    } catch (e) {
        console.warn('Error during remote session logout:', e);
    } finally {
        memorySessionUser = null;
        sessionStorage.removeItem('onebook_session_token');
        sessionStorage.removeItem('currentUser');
        if (window.electronAPI?.sqlite?.clearSessionToken) {
            window.electronAPI.sqlite.clearSessionToken();
        }
    }
    return { success: true };
}

/**
 * Validate current session and retrieve trusted user record
 */
export async function checkAuth(redirectToLogin = true) {
    const token = sessionStorage.getItem('onebook_session_token');
    
    if (!token) {
        clearLocalSession();
        if (redirectToLogin && typeof window !== 'undefined' && !window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
        return null;
    }

    if (!window.electronAPI?.sqlite?.users?.validateSession) {
        clearLocalSession();
        if (redirectToLogin && typeof window !== 'undefined' && !window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
        return null;
    }

    try {
        const res = await window.electronAPI.sqlite.users.validateSession(token);
        if (res && res.success && res.data) {
            const user = res.data;
            if (user.status !== 'active') {
                await logout();
                if (redirectToLogin && typeof window !== 'undefined') {
                    window.location.href = 'login.html';
                }
                return null;
            }

            memorySessionUser = user;
            if (window.electronAPI?.sqlite?.setSessionToken) {
                window.electronAPI.sqlite.setSessionToken(token);
            }
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            return user;
        } else {
            // Invalid, expired or revoked session
            await logout();
            if (redirectToLogin && typeof window !== 'undefined' && !window.location.pathname.endsWith('login.html')) {
                window.location.href = 'login.html';
            }
            return null;
        }
    } catch (e) {
        console.error('Session validation error:', e);
        clearLocalSession();
        if (redirectToLogin && typeof window !== 'undefined' && !window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
        return null;
    }
}

function clearLocalSession() {
    memorySessionUser = null;
    sessionStorage.removeItem('onebook_session_token');
    sessionStorage.removeItem('currentUser');
    if (window.electronAPI?.sqlite?.clearSessionToken) {
        window.electronAPI.sqlite.clearSessionToken();
    }
}

/**
 * Get cached user profile for UI elements
 */
export function getCurrentUser() {
    if (memorySessionUser) return memorySessionUser;
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
        memorySessionUser = JSON.parse(userStr);
        return memorySessionUser;
    } catch (e) {
        return null;
    }
}

/**
 * Client-side permission helper for UI visibility toggling.
 * Real security is enforced at the main-process SQLite IPC boundary.
 */
export function hasPermission(action) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'ADMIN') return true;
    if (user.status === 'disabled') return false;
    return Array.isArray(user.permissions) && user.permissions.includes(action);
}

export async function isAdmin() {
    const user = getCurrentUser();
    return !!(user && (user.role === 'admin' || user.role === 'ADMIN'));
}

export async function verifyAdmin(actionName) {
    const admin = await isAdmin();
    return { success: admin };
}

export function initializeAuth() {
    // No-op in secure SQLite mode: no default accounts are created or seeded into localStorage
}
