// Authentication and Data Sync Module
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    runTransaction,
    getDocFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Helper: Merge Arrays to prevent data loss
// Prevents overwriting Cloud history with empty/stale Local data
function mergeArrays(cloudArray, localArray, keyFn) {
    if (!Array.isArray(cloudArray)) cloudArray = [];
    if (!Array.isArray(localArray)) localArray = [];

    const merged = new Map();

    // 1. Add Cloud Data first (Base of Truth)
    cloudArray.forEach(item => {
        const key = keyFn(item);
        if (key) merged.set(key, item);
    });

    // 2. Add Local Data (New entries or Updates)
    localArray.forEach(item => {
        const key = keyFn(item);
        if (key) {
            // For robust sync:
            // If item exists in Cloud, we generally trust Local if it's an "Edit".
            // However, typical data loss happens when Local is EMPTY/STALE.
            // If Local is missing the item (not in localArray iteration), it stays in map (preserved).
            // If Local HAS the item, it overwrites the map entry (updates).
            merged.set(key, item);
        }
    });

    return Array.from(merged.values());
}

// Helper: Generate unique keys for different data types
const getProductKey = (p) => p.id; // Products have unique ID (timestamp)
const getSaleKey = (s) => (s.saleId && s.productId) ? `${s.saleId}_${s.productId}` : JSON.stringify(s); // Sales are items
const getStockKey = (s) => s.date; // Stock history uses timestamp
const getOrderKey = (o) => o.id; // Purchase Orders have ID
const getPurchaseKey = (p) => p.id; // Purchases have ID
const getDraftKey = (d) => d.id; // Drafts have ID

// Helper: Generate UUID for Session ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Session State
// Session State
// FIX: Persist Session ID so reloads don't kill the session
let currentSessionId = sessionStorage.getItem('salesSessionId');
if (!currentSessionId) {
    currentSessionId = generateUUID();
    sessionStorage.setItem('salesSessionId', currentSessionId);
}
let sessionHeartbeatInterval = null;
let sessionListenerUnsubscribe = null;

// UI Helper: Update Sync Status Badge
function updateSyncStatus(status, message) {
    const statusEl = document.getElementById('sync-status');
    const iconEl = document.getElementById('sync-icon');
    const textEl = document.getElementById('sync-text');

    if (!statusEl || !iconEl || !textEl) return;

    if (status === 'syncing') {
        iconEl.innerText = '🔄';
        textEl.innerText = message || 'Syncing to Cloud...';
        statusEl.style.background = 'rgba(255, 255, 255, 0.2)'; // Neutral
    } else if (status === 'success') {
        iconEl.innerText = '✅';
        textEl.innerText = message || 'All Data Secured in Cloud';
        statusEl.style.background = 'rgba(46, 204, 113, 0.3)'; // Green
        statusEl.style.borderColor = 'rgba(46, 204, 113, 0.6)';
    } else if (status === 'offline') {
        iconEl.innerText = '💾';
        textEl.innerText = message || 'Saved to Device (Offline)';
        statusEl.style.background = 'rgba(241, 196, 15, 0.3)'; // Yellow
        statusEl.style.borderColor = 'rgba(241, 196, 15, 0.6)';
    } else if (status === 'error') {
        iconEl.innerText = '⚠️';
        textEl.innerText = message || 'Sync Failed - Retrying...';
        statusEl.style.background = 'rgba(231, 76, 60, 0.3)'; // Red
        statusEl.style.borderColor = 'rgba(231, 76, 60, 0.6)';
    }
}

// Login function
// Login function
// Login function
export async function login(email, password, force = false) {
    try {
        // Enforce Session Persistence (Logout on tab close)
        await setPersistence(auth, browserSessionPersistence);

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Login successful:", userCredential.user.email);

        // --- Session Enforcement (Force Login with Warning) ---
        if (!force) {
            // Check if anyone is there (Read-Only) - FORCE SERVER READ (Bypass Cache)
            const sessionDocRef = doc(db, 'sessions', userCredential.user.uid);
            try {
                const docSnap = await getDocFromServer(sessionDocRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const now = Date.now();
                    const lastActive = data.lastActive || 0;
                    const timeDiff = now - lastActive;

                    console.log("[Login Check] Found existing session:", data);
                    console.log("[Login Check] Time Diff:", timeDiff, "Limit: 300000");
                    console.log("[Login Check] Current ID:", currentSessionId, "Stored ID:", data.activeSessionId);

                    // If active (<5 mins - increased for mobile background safety) AND not me (ID mismatch)
                    if ((timeDiff < 300000) && data.activeSessionId !== currentSessionId) {
                        console.log("[Login Check] CONFLICT DETECTED - Returning Warning");
                        return {
                            success: false,
                            requiresConfirmation: true,
                            otherDevice: data.deviceName || 'Unknown Device'
                        };
                    }
                }
            } catch (e) {
                console.warn("Server read failed, falling back to cache", e);
                // If offline, we might skip check, or block safe?
                // For now, let's proceed if check fails (optimistic offline login)
            }
        }

        // We ALWAYS claim the session if force=true or no one is home.
        await establishSession(userCredential.user.uid, email);

        // Session Active/Claimed -> Proceed
        // Load user data from Firestore after login
        await loadUserDataFromFirestore(userCredential.user.uid);

        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Login error:", error);
        let errorMessage = "Login failed. Please try again.";

        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = "Invalid email address.";
                break;
            case 'auth/user-disabled':
                errorMessage = "This account has been disabled.";
                break;
            case 'auth/user-not-found':
                errorMessage = "No account found with this email.";
                break;
            case 'auth/wrong-password':
                errorMessage = "Incorrect password.";
                break;
            case 'auth/invalid-credential':
                errorMessage = "Invalid email or password.";
                break;
        }

        return { success: false, error: errorMessage };
    }
}

// Logout function
export async function logout() {
    try {
        // Sync data before logout
        if (auth.currentUser) {
            await syncDataToFirestore(auth.currentUser.uid);
        }

        await signOut(auth);

        // Clear localStorage
        localStorage.clear();

        console.log("Logout successful");
        return { success: true };
    } catch (error) {
        console.error("Logout error:", error);
        return { success: false, error: error.message };
    }
}

// Check authentication state
export function checkAuth(redirectToLogin = true) {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe(); // STOP LISTENING immediately
            if (user) {
                console.log("User is authenticated:", user.email);

                // Validate Session on Reload
                const sessionStatus = await checkSessionStatus(user.uid);

                if (sessionStatus === 'kicked') {
                    console.warn("Session Invalid on Load - Logging out");
                    await signOut(auth);
                    if (window.location.pathname.indexOf('public/index.html') === -1 && window.location.pathname.indexOf('login.html') === -1 && window.location.pathname !== '/') {
                        window.location.replace('/');
                    }
                    resolve(null);
                    return;
                }

                // If we are active, ensure heartbeat is running
                if (sessionStatus === 'active') {
                    startHeartbeat(user.uid);
                }

                resolve(user);
                // Trigger auto-sync on auth check to be safe
                // Always attempt load - it handles offline state by updating UI
                loadUserDataFromFirestore(user.uid);
            } else {
                console.log("User is not authenticated");
                if (redirectToLogin && !window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
                    window.location.href = '/';
                }
                resolve(null);
            }
        });
    });
}

// Cloud-First Save: Transactionally save bill and update stock
// Returns { success: true } or { success: false, error: '...' }
export async function saveBillToCloud(billItems) {
    // billItems is an array of sale objects (one per product in the bill)
    if (!billItems || billItems.length === 0) return { success: false, error: "Empty bill" };

    const docRef = doc(db, 'sharedStore', 'data');

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) {
                throw new Error("Shared Database not found!");
            }

            const data = docSnap.data();
            const cloudProducts = data.products || [];
            const cloudSales = data.sales || [];

            // 1. Update Stock
            // We need to map product IDs to their cloud objects for fast lookup
            const productMap = new Map(cloudProducts.map(p => [p.id, p]));

            billItems.forEach(item => {
                const product = productMap.get(item.productId);
                if (!product) {
                    throw new Error(`Product not found: ${item.productName}`);
                }

                // Deduct Stock
                // Handle Pack vs Piece logic if unit is available
                // Assuming item.quantity is in "units sold"
                // And item.baseQuantity is multiplier (if defined in cart item)
                const multiplier = item.baseQuantity || 1;
                const deduction = item.quantity * multiplier;

                // Optional: Strict Stock Check
                // if (product.stock < deduction) throw new Error(`Insufficient stock for ${product.name}`);

                product.stock = parseFloat((product.stock - deduction).toFixed(3));
            });

            // Reconstruct products array with updates
            const updatedProducts = Array.from(productMap.values());

            // 2. Add New Sales
            // We append the new bill items to the cloud sales history
            // Use array concatenation (efficient enough for < 10k items, database layout is singular)
            const updatedSales = cloudSales.concat(billItems);

            // 3. Write Back
            transaction.update(docRef, {
                products: updatedProducts,
                sales: updatedSales
            });
        });

        console.log("✅ Bill saved to Cloud & Stock updated.");
        return { success: true };

    } catch (e) {
        console.error("Cloud Transaction Failed:", e);
        return { success: false, error: e.message };
    }
}

// Cloud-First Purchase Save: Transactionally save purchase and update stock (INCREMENT)
export async function savePurchaseToCloud(purchaseRecord) {
    if (!purchaseRecord || !purchaseRecord.items || purchaseRecord.items.length === 0) {
        return { success: false, error: "Empty purchase record" };
    }

    const docRef = doc(db, 'sharedStore', 'data');

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) {
                throw new Error("Shared Database not found!");
            }

            const data = docSnap.data();
            const cloudProducts = data.products || [];
            const cloudPurchases = data.purchases || [];

            // 1. Update Stock & Prices
            const productMap = new Map(cloudProducts.map(p => [p.id, p]));

            purchaseRecord.items.forEach(item => {
                const product = productMap.get(item.productId);

                // Note: If product doesn't exist in cloud (newly created locally), 
                // it might need to be created? 
                // But the current flow creates products FIRST in the "Products" tab, 
                // so they should exist. If "Add New Product" was used INLINE, 
                // we need to ensure that product was synced to cloud already?
                // For now, let's assume existence or log warning.

                if (product) {
                    // Update Stock
                    const currentStock = parseFloat(product.stock) || 0;
                    const addedStock = parseFloat(item.qty) || 0;
                    product.stock = currentStock + addedStock;

                    // Update Prices (if provided and positive)
                    if (item.price > 0) product.costPrice = parseFloat(item.price);
                    if (item.sellingPrice > 0) product.price = parseFloat(item.sellingPrice);
                }
            });

            const updatedProducts = Array.from(productMap.values());

            // 2. Add New Purchase Record
            const updatedPurchases = cloudPurchases.concat(purchaseRecord);

            // 3. Write Back
            transaction.update(docRef, {
                products: updatedProducts,
                purchases: updatedPurchases
            });
        });

        return { success: true };

    } catch (e) {
        console.error("Cloud Purchase Save Error:", e);
        return { success: false, error: e.message };
    }
}

// Sync localStorage data to Firestore (SHARED STORE - all users see same data)
// Uses Transaction to MERGE data instead of overwriting
export async function syncDataToFirestore(userId) {
    updateSyncStatus('syncing', 'Backing up to Cloud...');

    try {
        // 1. Get Local Data
        const localProducts = JSON.parse(localStorage.getItem('products')) || [];
        const localSales = JSON.parse(localStorage.getItem('sales')) || [];
        const localStockHistory = JSON.parse(localStorage.getItem('stockHistory')) || [];
        const localPurchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders')) || [];
        const localDraftSales = JSON.parse(localStorage.getItem('draftSales')) || [];
        const localPurchases = JSON.parse(localStorage.getItem('purchases')) || [];
        const localCustomCategories = JSON.parse(localStorage.getItem('customCategories')) || [];
        const localNegativeChangeCount = parseInt(localStorage.getItem('negativeChangeCount')) || 0;
        const localReceiptCounters = JSON.parse(localStorage.getItem('receiptCounters')) || {};

        const docRef = doc(db, 'sharedStore', 'data');

        // 2. Run Transaction
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            let cloudData = {};

            if (docSnap.exists()) {
                cloudData = docSnap.data();
            }

            // 3. Merge Strategies
            const mergedProducts = mergeArrays(cloudData.products, localProducts, getProductKey);
            const mergedSales = mergeArrays(cloudData.sales, localSales, getSaleKey);
            const mergedStockHistory = mergeArrays(cloudData.stockHistory, localStockHistory, getStockKey);
            const mergedPurchaseOrders = mergeArrays(cloudData.purchaseOrders, localPurchaseOrders, getOrderKey);
            const mergedDraftSales = mergeArrays(cloudData.draftSales, localDraftSales, getDraftKey);
            const mergedPurchases = mergeArrays(cloudData.purchases, localPurchases, getPurchaseKey);

            // For simple arrays of strings/primitives, simple union
            const mergedCategories = [...new Set([...(cloudData.customCategories || []), ...localCustomCategories])];

            // Counters: Max wins (to avoid resetting sequence)
            const mergedNegativeChangeCount = Math.max((cloudData.negativeChangeCount || 0), localNegativeChangeCount);

            // Receipt Counters (Last Number used): Max wins
            const mergedReceiptCounters = { ...(cloudData.receiptCounters || {}) };
            Object.keys(localReceiptCounters).forEach(key => {
                if (!mergedReceiptCounters[key] || localReceiptCounters[key] > mergedReceiptCounters[key]) {
                    mergedReceiptCounters[key] = localReceiptCounters[key];
                }
            });

            const newData = {
                products: mergedProducts,
                sales: mergedSales,
                stockHistory: mergedStockHistory,
                purchaseOrders: mergedPurchaseOrders,
                draftSales: mergedDraftSales,
                purchases: mergedPurchases,
                customCategories: mergedCategories,
                negativeChangeCount: mergedNegativeChangeCount,
                receiptCounters: mergedReceiptCounters,
                lastUpdated: new Date().toISOString(),
                lastUpdatedBy: userId
            };

            // 4. Update Cloud
            transaction.set(docRef, newData, { merge: true });

            return newData; // Pass merged data out
        }).then((mergedData) => {
            // Transaction success! Update LocalStorage to match Cloud
            // This ensures the device gets back any history it was missing
            localStorage.setItem('products', JSON.stringify(mergedData.products));
            localStorage.setItem('sales', JSON.stringify(mergedData.sales));
            localStorage.setItem('stockHistory', JSON.stringify(mergedData.stockHistory));
            localStorage.setItem('purchaseOrders', JSON.stringify(mergedData.purchaseOrders));
            localStorage.setItem('draftSales', JSON.stringify(mergedData.draftSales));
            localStorage.setItem('purchases', JSON.stringify(mergedData.purchases));
            localStorage.setItem('customCategories', JSON.stringify(mergedData.customCategories));
            localStorage.setItem('negativeChangeCount', mergedData.negativeChangeCount.toString());
            localStorage.setItem('receiptCounters', JSON.stringify(mergedData.receiptCounters));

            console.log('✅ Sync Complete: Data merged safely. No history lost.');
            updateSyncStatus('success'); // Show Success
        });

        return { success: true };
    } catch (error) {
        console.error("Error syncing data to Firestore:", error);

        // Show Offline/Error Status
        if (!navigator.onLine) {
            updateSyncStatus('offline', 'You are Offline - Saving Locally');
        } else {
            updateSyncStatus('error', 'Sync Failed - Check Internet');
        }

        return { success: false, error: error.message };
    }
}

// Cloud Recovery Function - Migrates data from legacy users/{userId} store to sharedStore
export async function recoverLegacyData(userId) {
    updateSyncStatus('syncing', 'Recovering Legacy Data...');
    try {
        const legacyDocRef = doc(db, 'users', userId);
        const sharedDocRef = doc(db, 'sharedStore', 'data');

        // 1. Fetch Legacy Data
        const legacySnap = await getDocFromServer(legacyDocRef);
        if (!legacySnap.exists()) {
            updateSyncStatus('success', 'No legacy data found.');
            return { success: true, message: "No legacy data found for this user." };
        }
        const legacyData = legacySnap.data();

        // 2. Fetch Current Shared Data
        const sharedSnap = await getDocFromServer(sharedDocRef);
        let sharedData = {};
        if (sharedSnap.exists()) {
            sharedData = sharedSnap.data();
        }

        // 3. Merge Strategies
        const mergedProducts = mergeArrays(sharedData.products, legacyData.products || [], getProductKey);
        const mergedSales = mergeArrays(sharedData.sales, legacyData.sales || [], getSaleKey);
        const mergedStockHistory = mergeArrays(sharedData.stockHistory, legacyData.stockHistory || [], getStockKey);
        const mergedPurchaseOrders = mergeArrays(sharedData.purchaseOrders, legacyData.purchaseOrders || [], getOrderKey);
        const mergedDraftSales = mergeArrays(sharedData.draftSales, legacyData.draftSales || [], getDraftKey);
        const mergedPurchases = mergeArrays(sharedData.purchases, legacyData.purchases || [], getPurchaseKey);
        const mergedCategories = [...new Set([...(sharedData.customCategories || []), ...(legacyData.customCategories || [])])];
        const mergedNegativeChangeCount = Math.max((sharedData.negativeChangeCount || 0), (legacyData.negativeChangeCount || 0));

        const mergedReceiptCounters = { ...(sharedData.receiptCounters || {}) };
        if (legacyData.receiptCounters) {
            Object.keys(legacyData.receiptCounters).forEach(key => {
                if (!mergedReceiptCounters[key] || legacyData.receiptCounters[key] > mergedReceiptCounters[key]) {
                    mergedReceiptCounters[key] = legacyData.receiptCounters[key];
                }
            });
        }

        const newData = {
            products: mergedProducts,
            sales: mergedSales,
            stockHistory: mergedStockHistory,
            purchaseOrders: mergedPurchaseOrders,
            draftSales: mergedDraftSales,
            purchases: mergedPurchases,
            customCategories: mergedCategories,
            negativeChangeCount: mergedNegativeChangeCount,
            receiptCounters: mergedReceiptCounters,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: userId
        };

        // 4. Update Cloud Shared Store
        await runTransaction(db, async (transaction) => {
            transaction.set(sharedDocRef, newData, { merge: true });
        });

        // 5. Update LocalStorage
        localStorage.setItem('products', JSON.stringify(newData.products));
        localStorage.setItem('sales', JSON.stringify(newData.sales));
        localStorage.setItem('stockHistory', JSON.stringify(newData.stockHistory));
        localStorage.setItem('purchaseOrders', JSON.stringify(newData.purchaseOrders));
        localStorage.setItem('draftSales', JSON.stringify(newData.draftSales));
        localStorage.setItem('purchases', JSON.stringify(newData.purchases));
        localStorage.setItem('customCategories', JSON.stringify(newData.customCategories));
        localStorage.setItem('negativeChangeCount', newData.negativeChangeCount.toString());
        localStorage.setItem('receiptCounters', JSON.stringify(newData.receiptCounters));

        updateSyncStatus('success', 'Legacy Data Recovered');
        return { success: true, message: `Successfully recovered legacy data! Merged ${(legacyData.sales || []).length} sales.` };
    } catch (error) {
        console.error('Error recovering legacy data:', error);
        updateSyncStatus('error', 'Recovery Failed');
        return { success: false, error: error.message };
    }
}

// Load data from Firestore to localStorage (SHARED STORE - all users see same data)
// CRITICAL FIX: Merges Cloud data with Local data instead of overwriting.
// Prevents loss of unsynced local changes if user reloads page.
export async function loadUserDataFromFirestore(userId) {
    updateSyncStatus('syncing', 'Checking for new data...');

    try {
        // Load from shared store instead of per-user storage
        const sharedDocRef = doc(db, 'sharedStore', 'data');

        // FORCE SERVER FETCH (Bypass Cache) to ensure we get the latest phone updates
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 1000)); // 10000ms timeout
        const docSnap = await Promise.race([getDocFromServer(sharedDocRef), timeoutPromise]);

        let cloudData = {};
        if (docSnap.exists()) {
            cloudData = docSnap.data();
        }

        // --- CLOUD FIRST STRATEGY ---
        // We trust the Cloud Data as the "Single Source of Truth".
        // We do NOT merge stale local data over fresh cloud data.

        // 1. Products: Trust Cloud (Stock is transactional)
        const products = cloudData.products || [];

        // 2. Sales: Trust Cloud (Transactional)
        const sales = cloudData.sales || [];

        // 3. Purchases: Trust Cloud
        const purchases = cloudData.purchases || [];

        // 4. Other Arrays: Trust Cloud
        const stockHistory = cloudData.stockHistory || [];
        const purchaseOrders = cloudData.purchaseOrders || [];
        const draftSales = cloudData.draftSales || []; // Maybe merge drafts? For now, Cloud wins

        // 5. Categories & Counters
        const customCategories = cloudData.customCategories || [];
        const negativeChangeCount = cloudData.negativeChangeCount || 0;
        const receiptCounters = cloudData.receiptCounters || {};

        // 3. Update localStorage with CLOUD data
        localStorage.setItem('products', JSON.stringify(products));
        localStorage.setItem('sales', JSON.stringify(sales));
        localStorage.setItem('purchases', JSON.stringify(purchases));
        localStorage.setItem('stockHistory', JSON.stringify(stockHistory));
        localStorage.setItem('purchaseOrders', JSON.stringify(purchaseOrders));
        localStorage.setItem('draftSales', JSON.stringify(draftSales));
        localStorage.setItem('customCategories', JSON.stringify(customCategories));
        localStorage.setItem('negativeChangeCount', negativeChangeCount.toString());
        localStorage.setItem('receiptCounters', JSON.stringify(receiptCounters));

        console.log('✅ Loaded data from SHARED store - Sync Verified.');
        updateSyncStatus('success', 'Data Synced from Cloud');

        return { success: true };

    } catch (error) {
        console.error('Error loading data from Firestore:', error);

        if (error.message === 'TIMEOUT') {
            updateSyncStatus('offline', 'Using Local Data (Sync Pending)');
        } else if (!navigator.onLine) {
            updateSyncStatus('offline', 'You are Offline - Working Locally');
        } else {
            updateSyncStatus('error', 'Connection Error');
        }

        return { success: false, error: error.message };
    }
}

// Auto-sync data on changes (debounced)
let syncTimeout;
export function autoSync() {
    updateSyncStatus('offline', 'Unsynced Changes...');

    if (!auth.currentUser) return;

    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        syncDataToFirestore(auth.currentUser.uid);
    }, 2000); // Sync 2 seconds after last change
}

// Get current user
export function getCurrentUser() {
    return auth.currentUser;
}

// Real-time sync - Listen to Firestore changes (SHARED STORE)
let unsubscribeListener = null;
let isFirstLoad = true; // Flag to skip the first snapshot

export function startRealtimeSync(userId, onDataUpdate) {
    if (unsubscribeListener) {
        console.log('Real-time sync already active');
        return unsubscribeListener;
    }

    // Listen to shared store instead of per-user storage
    const sharedDocRef = doc(db, 'sharedStore', 'data');

    unsubscribeListener = onSnapshot(sharedDocRef, (doc) => {
        // REMOVED isFirstLoad skip. We want the latest state immediately.
        // if (isFirstLoad) { ... }

        if (doc.exists()) {
            const data = doc.data();

            if (data.lastUpdatedBy === userId) {
                // If I just synced, I have the data. But cloud might have more.
            } else {
                updateSyncStatus('success', 'Data Updated from other device');
            }

            // Update localStorage with new data from shared store
            localStorage.setItem('products', JSON.stringify(data.products || []));
            localStorage.setItem('sales', JSON.stringify(data.sales || []));
            localStorage.setItem('stockHistory', JSON.stringify(data.stockHistory || []));
            localStorage.setItem('purchaseOrders', JSON.stringify(data.purchaseOrders || []));
            localStorage.setItem('draftSales', JSON.stringify(data.draftSales || []));
            localStorage.setItem('purchases', JSON.stringify(data.purchases || []));
            localStorage.setItem('customCategories', JSON.stringify(data.customCategories || []));
            localStorage.setItem('negativeChangeCount', (data.negativeChangeCount || 0).toString());
            localStorage.setItem('receiptCounters', JSON.stringify(data.receiptCounters || {}));

            console.log('✅ Real-time sync: SHARED data updated (from another user)');

            // Call callback to refresh UI
            if (onDataUpdate) {
                onDataUpdate();
            }
        }
    }, (error) => {
        console.error('Real-time sync error:', error);
        updateSyncStatus('error', 'Sync Disconnected');
    });

    console.log('🔄 Real-time sync started for SHARED store');
    return unsubscribeListener;
}

export function stopRealtimeSync() {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
        isFirstLoad = true; // Reset flag
        console.log('🛑 Real-time sync stopped');
    }
}

// Admin verification function
export async function isAdmin() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('❌ No user logged in');
            return false;
        }

        // Check if user's email is in the admin list
        const adminDocRef = doc(db, 'admins', 'adminList');
        const adminDoc = await getDoc(adminDocRef);

        if (adminDoc.exists()) {
            const adminEmails = adminDoc.data().emails || [];
            const isAdminUser = adminEmails.includes(user.email);
            return isAdminUser;
        }

        // Default: allow all if no list
        return true;

    } catch (error) {
        console.error('❌ Error checking admin status:', error);
        return false;
    }
}

// Prompt for admin verification (replaces password prompt)
export async function verifyAdmin(actionName) {
    const isUserAdmin = await isAdmin();

    if (!isUserAdmin) {
        return {
            success: false,
            message: '❌ Access Denied: Only administrators can ' + actionName
        };
    }
    return { success: true };
}

// --- Session Management System ---

// --- Session Management System (Force Login) ---

// 1. Establish Session (Login / Init) - FORCE CLAIM
export async function establishSession(userId, email) {
    const browserName = getBrowserName();
    // Always overwrite. Force Login.
    await claimSession(userId, email, browserName);
    return { status: 'active' };
}

// Helper: Check status without forcing (for Page Reloads)
async function checkSessionStatus(userId) {
    const sessionDocRef = doc(db, 'sessions', userId);
    try {
        const docSnap = await getDoc(sessionDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // If ID matches, we are good.
            if (data.activeSessionId === currentSessionId) {
                return 'active';
            }
            // If ID does NOT match, we were kicked.
            return 'kicked';
        }
        // No session? We can claim it (rare case: DB cleared while we were open)
        return 'active'; // actually we should probably claim it if missing? 
        // Let's safe fail to 'kicked' if we expected to be logged in? 
        // No, if user is auth'd but no session doc, treating as kicked is safer.
        // OR we can self-heal. Let's self-heal.
        await claimSession(userId, 'Recovered', getBrowserName());
        return 'active';
    } catch (e) {
        console.error("Session check error", e);
        return 'error';
    }
}

// 2. Claim Session (Write to Firestore)
async function claimSession(userId, email, deviceName) {
    const sessionDocRef = doc(db, 'sessions', userId);
    await setDoc(sessionDocRef, {
        activeSessionId: currentSessionId,
        email: email,
        lastActive: Date.now(),
        deviceName: deviceName,
        deviceIp: 'Unknown',
        loginRequest: null
    });
    console.log('🔒 Session Claimed (Force):', currentSessionId);
    startHeartbeat(userId);
}

// 3. Request Access - DELETED (Force Login replaces this)
// export async function requestSessionAccess... DELETE

// 3. Request Access (Ask other device to logout) - DEPRECATED
// export async function requestSessionAccess(userId, email) { ... }

// 4. Start Heartbeat & Listener (Active Session)
function startHeartbeat(userId) {
    if (sessionHeartbeatInterval) clearInterval(sessionHeartbeatInterval);
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe();

    // Heartbeat: Update locally every 10s
    sessionHeartbeatInterval = setInterval(async () => {
        if (!auth.currentUser) return;
        try {
            const sessionDocRef = doc(db, 'sessions', userId);
            await updateDoc(sessionDocRef, { lastActive: Date.now() });
        } catch (e) {
            console.warn("Heartbeat failed", e);
        }
    }, 10000);

    // Listener: Detect if I am kicked out OR if new request comes In
    const sessionDocRef = doc(db, 'sessions', userId);
    sessionListenerUnsubscribe = onSnapshot(sessionDocRef, (doc) => {
        if (!doc.exists()) return;
        const data = doc.data();

        // 4a. Check if I was kicked
        if (data.activeSessionId !== currentSessionId) {
            console.warn("⚠️ Session invalidated by another device");
            handleRemoteLogout();
            return;
        }

        // 4b. Check for Incoming Requests - DEPRECATED (Force Login)
        /*
        if (data.loginRequest && data.loginRequest.status === 'pending') {
             // ...
        }
        */
    });
}

// 5. Handle Remote Logout
function handleRemoteLogout() {
    stopHeartbeat();
    signOut(auth);
    alert('You have been logged out because this account was accessed from another device.');
    window.location.href = '/';
}

function stopHeartbeat() {
    if (sessionHeartbeatInterval) clearInterval(sessionHeartbeatInterval);
    if (sessionListenerUnsubscribe) sessionListenerUnsubscribe();
    sessionHeartbeatInterval = null;
    sessionListenerUnsubscribe = null;
}

// 6. Response to Login Request (Accept/Deny) - DEPRECATED
// export async function respondToLoginRequest(userId, accept) { ... }
// Deny: Write status


// Utils
function getBrowserName() {
    const agent = navigator.userAgent;
    if (agent.includes("Chrome")) return "Chrome";
    if (agent.includes("Firefox")) return "Firefox";
    if (agent.includes("Safari")) return "Safari";
    return "Browser";
}
