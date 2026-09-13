// ============================================================
// auth.js - Offline RBAC Version
// ============================================================

const DEFAULT_ADMIN = {
    id: "admin_1",
    name: "Admin",
    username: "admin",
    password: "admin",
    role: "admin",
    status: "active",
    permissions: []
};

export function initializeAuth() {
    let users = JSON.parse(localStorage.getItem('users'));
    if (!users || users.length === 0) {
        users = [];
        const settings = JSON.parse(localStorage.getItem('settings') || 'null');
        let initialAdmin = { ...DEFAULT_ADMIN };
        if (settings && settings.adminPassword) {
            initialAdmin.password = settings.adminPassword;
        }
        users.push(initialAdmin);
        localStorage.setItem('users', JSON.stringify(users));
    }
}

export async function login(username, password) {
    initializeAuth();
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
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
    window.location.reload();
    return { success: true };
}

export function checkAuth(redirectToLogin = true) {
    return new Promise((resolve) => {
        initializeAuth();
        const userStr = sessionStorage.getItem('currentUser');
        if (userStr) resolve(JSON.parse(userStr));
        else resolve(null);
    });
}

export function getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
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

export function updateSyncStatus(status, message) {}
export async function saveBillToCloud(billItems) { return { success: true }; }
export async function savePurchaseToCloud(purchaseRecord) { return { success: true }; }
export async function loadUserDataFromFirestore(userId) { return { success: true }; }
export async function syncDataToFirestore(userId) { return { success: true }; }
export function startRealtimeSync(userId, onDataUpdate) { return () => {}; }
export function stopRealtimeSync() {}
export function autoSync() {}
export async function verifyAdmin(actionName) { return { success: true }; }
export async function establishSession(userId, email) { return { status: 'active' }; }
export async function recoverData() { alert('Data recovery is not applicable in offline mode.'); }
window.recoverData = recoverData;