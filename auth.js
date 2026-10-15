// ============================================================
// auth.js - Offline RBAC Version
// ============================================================

const DEFAULT_ADMIN = {
    id: "admin_1",
    name: "Admin",
    username: "admin@example.com",
    password: "Admin@2026",
    role: "admin",
    status: "active",
    permissions: []
};

function safeGetUsers() {
    try {
        const raw = localStorage.getItem('users');
        if (!raw) return [];
        if (typeof raw === 'object') {
            return Array.isArray(raw) ? raw : [raw];
        }
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (trimmed === '[object Object]' || trimmed.startsWith('[object Object]')) {
                return [];
            }
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
            return [];
        }
        return [];
    } catch (e) {
        console.warn('Failed to parse users from localStorage:', e);
        return [];
    }
}

export function initializeAuth() {
    let users = safeGetUsers();
    if (!users || users.length === 0) {
        users = [];
        let settings = null;
        try {
            const rawSettings = localStorage.getItem('settings');
            if (rawSettings && rawSettings !== '[object Object]') {
                settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings;
            }
        } catch (e) {
            settings = null;
        }
        let initialAdmin = { ...DEFAULT_ADMIN };
        if (settings && settings.adminPassword) {
            initialAdmin.password = settings.adminPassword;
        }
        users.push(initialAdmin);
        localStorage.setItem('users', JSON.stringify(users));
    } else {
        // Force update existing default admin if they are struggling with login
        let adminUser = users.find(u => u.id === 'admin_1');
        if (adminUser && adminUser.username === 'admin') {
            adminUser.username = 'admin@example.com';
            adminUser.password = 'Admin@2026';
            localStorage.setItem('users', JSON.stringify(users));
        }
    }
}

export async function login(username, password) {
    initializeAuth();
    const users = safeGetUsers();
    const user = users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (!user) {
        return { success: false, error: "Incorrect username or password." };
    }
    if (user.status === 'disabled') {
        return { success: false, error: "This account has been disabled. Please contact the Administrator." };
    }
    
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    return { success: true, user: user };
}

export async function logout() {
    sessionStorage.removeItem('currentUser');
    return { success: true };
}

export function checkAuth(redirectToLogin = true) {
    return new Promise((resolve) => {
        initializeAuth();
        const userStr = sessionStorage.getItem('currentUser');
        if (userStr && userStr !== '[object Object]') {
            let sessionUser = null;
            try {
                sessionUser = JSON.parse(userStr);
            } catch (e) {
                sessionUser = null;
            }
            if (sessionUser) {
                const users = safeGetUsers();
                const updatedUser = users.find(u => u.id === sessionUser.id);
                if (updatedUser) {
                    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
                    resolve(updatedUser);
                } else {
                    resolve(sessionUser);
                }
                return;
            }
        }
        resolve(null);
    });
}

export function getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr || userStr === '[object Object]') return null;
    let sessionUser = null;
    try {
        sessionUser = JSON.parse(userStr);
    } catch (e) {
        return null;
    }
    if (!sessionUser) return null;
    const users = safeGetUsers();
    const updatedUser = users.find(u => u.id === sessionUser.id);
    if (updatedUser) {
        sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
        return updatedUser;
    }
    return sessionUser;
}

export function hasPermission(action) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.status === 'disabled') return false;
    return (user.permissions || []).includes(action);
}

export async function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

export async function verifyAdmin(actionName) { return { success: true }; }
