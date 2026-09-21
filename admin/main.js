import { createClient } from '@supabase/supabase-js';

// NOTE: Use the actual Supabase project URL and anon key here
const SUPABASE_URL = 'http://127.0.0.1:54321'; // Or process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = 'ey...'; // Replace with actual anon key in production

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let session = null;
let currentRole = null;

async function checkAuth() {
    const { data, error } = await supabase.auth.getSession();
    session = data.session;
    if (!session) {
        renderLogin();
    } else {
        await loadDashboard();
    }
}

function renderLogin() {
    document.getElementById('app').innerHTML = `
        <div class="login-container">
            <h2 style="text-align: center; margin-top: 0;">OneBook Admin Login</h2>
            <div id="loginError" style="color: red; margin-bottom: 10px;"></div>
            <input type="email" id="email" class="input-field" placeholder="Admin Email">
            <input type="password" id="password" class="input-field" placeholder="Password">
            <button class="btn btn-primary" style="width: 100%;" onclick="window.handleLogin()">Login</button>
        </div>
    `;
}

window.handleLogin = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        document.getElementById('loginError').innerText = error.message;
    } else {
        session = data.session;
        loadDashboard();
    }
};

window.handleLogout = async () => {
    await supabase.auth.signOut();
    session = null;
    currentRole = null;
    renderLogin();
};

async function fetchAdminData(route, payload = {}) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ route, payload })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to fetch data');
    currentRole = result.role;
    return result.data;
}

async function executeAdminAction(action, payload = {}) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-license-action`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, payload })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Action failed');
    return result.data;
}

function renderAppLayout(contentHtml) {
    document.getElementById('app').innerHTML = `
        <div class="admin-container">
            <div class="sidebar">
                <h2>OneBook Admin</h2>
                <div style="margin-bottom: 20px; font-size: 12px; color: #94a3b8;">Role: ${currentRole || '...'}</div>
                <button class="nav-item" onclick="window.loadDashboard()">📊 Dashboard</button>
                <button class="nav-item" onclick="window.loadBusinesses()">🏪 Businesses</button>
                <button class="nav-item" onclick="window.loadLicenses()">🔑 Licenses</button>
                <button class="nav-item" onclick="window.loadLogs()">📝 Activity Logs</button>
                <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
                <button class="nav-item" style="color: #ef4444;" onclick="window.handleLogout()">🚪 Logout</button>
            </div>
            <div class="content">
                ${contentHtml}
            </div>
        </div>
    `;
}

window.loadDashboard = async () => {
    try {
        renderAppLayout('<h2>Loading Dashboard...</h2>');
        const stats = await fetchAdminData('dashboard');
        const html = `
            <h2>Dashboard</h2>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                <div class="card"><h3>Total Businesses</h3><p style="font-size: 24px; font-weight: bold;">${stats.totalBusinesses}</p></div>
                <div class="card"><h3>Total Licenses</h3><p style="font-size: 24px; font-weight: bold;">${stats.totalLicenses}</p></div>
                <div class="card"><h3>Active Licenses</h3><p style="font-size: 24px; font-weight: bold; color: #166534;">${stats.activeLicenses}</p></div>
                <div class="card"><h3>Trial Licenses</h3><p style="font-size: 24px; font-weight: bold; color: #854d0e;">${stats.trialLicenses}</p></div>
                <div class="card"><h3>Expiring Soon (30d)</h3><p style="font-size: 24px; font-weight: bold; color: #9a3412;">${stats.expiringSoon}</p></div>
                <div class="card"><h3>Expired</h3><p style="font-size: 24px; font-weight: bold; color: #991b1b;">${stats.expired}</p></div>
                <div class="card"><h3>Suspended</h3><p style="font-size: 24px; font-weight: bold; color: #991b1b;">${stats.suspended}</p></div>
                <div class="card"><h3>Active Devices</h3><p style="font-size: 24px; font-weight: bold;">${stats.activeDevices}</p></div>
            </div>
        `;
        renderAppLayout(html);
    } catch (e) {
        alert(e.message);
    }
};

window.loadLicenses = async () => {
    try {
        renderAppLayout('<h2>Loading Licenses...</h2>');
        const licenses = await fetchAdminData('licenses');
        let rows = '';
        licenses.forEach(l => {
            const biz = l.businesses ? l.businesses.business_name : 'Unknown';
            rows += `
                <tr>
                    <td>${biz}</td>
                    <td><a href="#" onclick="window.viewLicense('${l.id}')">OB-****-${l.license_key_last4}</a></td>
                    <td>${l.plan}</td>
                    <td><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
                    <td>${l.devices ? l.devices.length : 0}/${l.max_devices}</td>
                    <td>${l.expires_at ? new Date(l.expires_at).toLocaleDateString() : 'Never'}</td>
                </tr>
            `;
        });
        
        const html = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2>Licenses</h2>
                <button class="btn btn-primary" onclick="window.showCreateLicenseModal()">+ Create License</button>
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>Business</th><th>License Key</th><th>Plan</th><th>Status</th><th>Devices</th><th>Expires</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        renderAppLayout(html);
    } catch (e) {
        alert(e.message);
    }
};

window.viewLicense = async (id) => {
    try {
        renderAppLayout('<h2>Loading License Details...</h2>');
        const l = await fetchAdminData('license_details', { id });
        
        let devicesHtml = '';
        if (l.devices && l.devices.length > 0) {
            l.devices.forEach(d => {
                devicesHtml += `
                    <tr>
                        <td>${d.device_name || 'Unknown'}</td>
                        <td>${d.device_id}</td>
                        <td>${d.status}</td>
                        <td>
                            ${d.status === 'ACTIVE' ? `<button class="btn btn-danger" onclick="window.resetDevice('${l.id}', '${d.device_id}')">Reset</button>` : ''}
                        </td>
                    </tr>
                `;
            });
        } else {
            devicesHtml = '<tr><td colspan="4">No devices registered.</td></tr>';
        }

        const html = `
            <h2>License Details: OB-****-${l.license_key_last4}</h2>
            <div class="card" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <p><strong>Business:</strong> ${l.businesses?.business_name}</p>
                    <p><strong>Plan:</strong> ${l.plan}</p>
                    <p><strong>Status:</strong> <span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></p>
                </div>
                <div>
                    <p><strong>Max Devices:</strong> ${l.max_devices}</p>
                    <p><strong>Expires:</strong> ${l.expires_at ? new Date(l.expires_at).toLocaleDateString() : 'Never'}</p>
                    <p><strong>Created:</strong> ${new Date(l.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            
            <div class="card">
                <h3>Actions</h3>
                ${l.status === 'ACTIVE' ? `<button class="btn btn-danger" onclick="window.suspendLicense('${l.id}')">Suspend License</button>` : ''}
                ${l.status === 'SUSPENDED' ? `<button class="btn btn-primary" onclick="window.reactivateLicense('${l.id}')">Reactivate License</button>` : ''}
            </div>

            <div class="card">
                <h3>Devices</h3>
                <table>
                    <thead><tr><th>Name</th><th>ID</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>${devicesHtml}</tbody>
                </table>
            </div>
        `;
        renderAppLayout(html);
    } catch (e) {
        alert(e.message);
    }
};

window.suspendLicense = async (id) => {
    if(!confirm('Are you sure you want to suspend this license?')) return;
    try {
        await executeAdminAction('SUSPEND_LICENSE', { license_id: id });
        alert('License suspended successfully');
        window.viewLicense(id);
    } catch(e) { alert(e.message); }
};

window.reactivateLicense = async (id) => {
    try {
        await executeAdminAction('REACTIVATE_LICENSE', { license_id: id });
        alert('License reactivated successfully');
        window.viewLicense(id);
    } catch(e) { alert(e.message); }
};

window.resetDevice = async (license_id, device_id) => {
    if(!confirm('Are you sure you want to reset (revoke) this device?')) return;
    try {
        await executeAdminAction('RESET_DEVICE', { license_id, device_id });
        alert('Device reset successfully');
        window.viewLicense(license_id);
    } catch(e) { alert(e.message); }
};

// ... more endpoints like loadBusinesses, loadLogs etc.

checkAuth();

window.loadBusinesses = async () => {
    try {
        renderAppLayout('<h2>Loading Businesses...</h2>');
        const businesses = await fetchAdminData('businesses');
        let rows = '';
        businesses.forEach(b => {
            rows += `
                <tr>
                    <td>${b.business_code}</td>
                    <td>${b.business_name}</td>
                    <td>${b.owner_name || ''}</td>
                    <td>${b.phone || ''}</td>
                    <td>${b.licenses ? b.licenses.length : 0} Licenses</td>
                </tr>
            `;
        });
        const html = `
            <h2>Businesses</h2>
            <div class="card">
                <table>
                    <thead><tr><th>Code</th><th>Name</th><th>Owner</th><th>Phone</th><th>Licenses</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        renderAppLayout(html);
    } catch(e) { alert(e.message); }
};

window.loadLogs = async () => {
    try {
        renderAppLayout('<h2>Loading Logs...</h2>');
        const logs = await fetchAdminData('admin_logs');
        let rows = '';
        logs.forEach(l => {
            rows += `
                <tr>
                    <td>${new Date(l.created_at).toLocaleString()}</td>
                    <td>${l.action}</td>
                    <td>${l.license_id || '-'}</td>
                    <td>${l.result}</td>
                </tr>
            `;
        });
        const html = `
            <h2>Admin Activity Logs</h2>
            <div class="card">
                <table>
                    <thead><tr><th>Time</th><th>Action</th><th>License ID</th><th>Result</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        renderAppLayout(html);
    } catch(e) { alert(e.message); }
};

window.showCreateLicenseModal = () => {
    const bizId = prompt('Enter Business ID (UUID):');
    if(!bizId) return;
    const plan = prompt('Enter Plan (TRIAL, MONTHLY, ANNUAL, LIFETIME):', 'TRIAL');
    if(!plan) return;
    executeAdminAction('CREATE_LICENSE', { business_id: bizId, plan: plan, max_devices: 1 })
    .then(data => {
        alert('License created successfully! Plaintext Key: ' + data.rawKey + '

SAVE THIS KEY NOW. IT WILL NOT BE SHOWN AGAIN.');
        window.loadLicenses();
    }).catch(e => alert(e.message));
};
