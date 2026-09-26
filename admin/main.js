
// Modal UI System

window.copyKeyToClipboard = async (key, btnId) => {
    try {
        await navigator.clipboard.writeText(key);
        const btn = document.getElementById(btnId);
        if (btn) {
            const oldText = btn.innerText;
            btn.innerText = 'Copied!';
            window.showToast('Key copied to clipboard');
            setTimeout(() => { btn.innerText = oldText; }, 2000);
        }
    } catch(err) {
        window.showErrorAlert('Failed to copy to clipboard');
    }
};

window.showOneTimeKeyModal = (key, plan) => {
    const keyBody = `
        <p>License created successfully for ${plan} plan.</p>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 15px 0;">
            <div class="key-display" style="margin: 0; flex-grow: 1;">${key}</div>
            <button class="btn btn-secondary" id="copy_btn_new" onclick="window.copyKeyToClipboard('${key}', 'copy_btn_new')">Copy Key</button>
        </div>
        <p style="color:red; font-weight:bold; text-align: center;">WARNING:<br>SAVE THIS KEY NOW. IT WILL NOT BE SHOWN AGAIN.</p>
    `;
    window.openModal('License Key Generated', keyBody, `<button class="btn btn-primary" onclick="window.closeModal()">I have saved it</button>`, false);
};

window.openModal = (title, bodyHtml, footerHtml, closeable = true) => {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml;
    const closeBtn = document.querySelector('.modal-close');
    closeBtn.style.display = closeable ? 'block' : 'none';
    document.getElementById('genericModal').style.display = 'flex';
};

window.closeModal = () => {
    document.getElementById('genericModal').style.display = 'none';
};

window.showToast = (message) => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
};

// ... replace alert logic
window.showErrorAlert = (msg) => {
    window.openModal('Error', `<p style="color:red">${msg}</p>`, `<button class="btn btn-secondary" onclick="window.closeModal()">Close</button>`);
}

window.showConfirmModal = (title, message, confirmBtnText, onConfirmStr) => {
    window.openModal(
        title,
        `<p>${message}</p>`,
        `<button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
         <button class="btn btn-danger" onclick="window.closeModal(); ${onConfirmStr}">${confirmBtnText}</button>`
    );
};

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('<REAL')) {
    console.error('Supabase configuration missing');
}

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
        window.showErrorAlert(e.message);
    }
};

window.loadLicenses = async () => {
    try {
        renderAppLayout('<h2>Loading Licenses...</h2>');
        const licenses = await fetchAdminData('licenses');
        let rows = '';
        licenses.forEach(l => {
            const biz = l.businesses ? l.businesses.business_name : 'Unknown';
            const activeCount = l.devices ? l.devices.filter(d => d.status === 'ACTIVE').length : 0;
            const revokedCount = l.devices ? l.devices.filter(d => d.status === 'REVOKED').length : 0;
            const deviceStr = `${activeCount} / ${l.max_devices} <span style="font-size:11px;color:#64748b;display:block;">(${revokedCount} revoked)</span>`;
            rows += `
                <tr>
                    <td>${biz}</td>
                    <td><a href="#" onclick="window.viewLicense('${l.id}')">OB-****-${l.license_key_last4}</a></td>
                    <td>${l.plan}</td>
                    <td><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
                    <td>${deviceStr}</td>
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
        window.showErrorAlert(e.message);
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
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <button class="btn btn-primary" onclick="window.extendExpiryModal('${l.id}', '${l.expires_at || ''}')">Extend Expiry</button>
                    <button class="btn btn-primary" onclick="window.changeMaxDevicesModal('${l.id}', '${l.max_devices}')">Change Max Devices</button>
                </div>
                <div style="display:flex; gap:10px;">
                    ${l.status === 'ACTIVE' ? `<button class="btn btn-danger" onclick="window.suspendLicense('${l.id}')">Suspend License</button>` : ''}
                    ${l.status === 'SUSPENDED' ? `<button class="btn btn-primary" onclick="window.reactivateLicense('${l.id}')">Reactivate License</button>` : ''}
                    <button class="btn btn-danger" onclick="window.deactivateLicense('${l.id}')">Deactivate License</button>
                </div>
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
        window.showErrorAlert(e.message);
    }
};

window.suspendLicense = async (id) => {
    window.showConfirmModal('Suspend License', 'Are you sure you want to suspend this license?', 'Suspend', `window.executeSuspend('${id}')`);
};
window.executeSuspend = async (id) => {
    try {
        await executeAdminAction('SUSPEND_LICENSE', { license_id: id });
        window.showToast('License suspended successfully');
        window.viewLicense(id);
    } catch(e) { window.showErrorAlert(e.message); }
};

window.reactivateLicense = async (id) => {
    try {
        await executeAdminAction('REACTIVATE_LICENSE', { license_id: id });
        window.showToast('License reactivated successfully');
        window.viewLicense(id);
    } catch(e) { window.showErrorAlert(e.message); }
};

window.resetDevice = async (license_id, device_id) => {
    window.showConfirmModal('Reset Device', 'Are you sure you want to reset (revoke) this device?', 'Reset Device', `window.executeResetDevice('${license_id}', '${device_id}')`);
};
window.executeResetDevice = async (license_id, device_id) => {
    try {
        await executeAdminAction('RESET_DEVICE', { license_id, device_id });
        window.showToast('Device reset successfully');
        window.viewLicense(license_id);
    } catch(e) { window.showErrorAlert(e.message); }
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
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2>Businesses</h2>
                <button class="btn btn-primary" onclick="window.showCreateBusinessModal()">+ Create Business</button>
            </div>
            <div class="card">
                <table>
                    <thead><tr><th>Code</th><th>Name</th><th>Owner</th><th>Phone</th><th>Licenses</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        renderAppLayout(html);
    } catch(e) { window.showErrorAlert(e.message); }
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
    } catch(e) { window.showErrorAlert(e.message); }
};


window.showCreateBusinessModal = () => {
    const body = `
        <div class="form-group"><label>Business Code *</label><input type="text" id="cb_code" class="form-control"></div>
        <div class="form-group"><label>Business Name *</label><input type="text" id="cb_name" class="form-control"></div>
        <div class="form-group"><label>Owner Name *</label><input type="text" id="cb_owner" class="form-control"></div>
        <div class="form-group"><label>Phone *</label><input type="text" id="cb_phone" class="form-control"></div>
        <div class="form-group"><label>Email *</label><input type="email" id="cb_email" class="form-control"></div>
        <div id="cb_error" class="form-error"></div>
    `;
    const footer = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="cb_submit" onclick="window.submitCreateBusiness()">Create Business</button>
    `;
    window.openModal('Create Business', body, footer);
};

window.submitCreateBusiness = async () => {
    const code = document.getElementById('cb_code').value.trim();
    const name = document.getElementById('cb_name').value.trim();
    const owner = document.getElementById('cb_owner').value.trim();
    let phone = document.getElementById('cb_phone').value.trim();
    let email = document.getElementById('cb_email').value.trim();
    const errDiv = document.getElementById('cb_error');
    
    if(!code || !name || !owner || !phone || !email) {
        errDiv.innerText = 'Please fill in all required fields.';
        errDiv.style.display = 'block';
        return;
    }
    
    // Phone validation
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
        errDiv.innerText = 'Phone must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
        errDiv.style.display = 'block';
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errDiv.innerText = 'Please enter a valid email address.';
        errDiv.style.display = 'block';
        return;
    }
    email = email.toLowerCase();
    
    document.getElementById('cb_submit').disabled = true;
    document.getElementById('cb_submit').innerText = 'Creating...';
    
    try {
        await executeAdminAction('CREATE_BUSINESS', { business_code: code, business_name: name, owner_name: owner, phone, email });
        window.closeModal();
        window.showToast('Business Created Successfully');
        window.loadBusinesses();
    } catch(e) {
        errDiv.innerText = e.message;
        errDiv.style.display = 'block';
        document.getElementById('cb_submit').disabled = false;
        document.getElementById('cb_submit').innerText = 'Create Business';
    }
};

window.showCreateLicenseModal = async () => {
    try {
        const businesses = await fetchAdminData('businesses');
        let bizOptions = businesses.map(b => `<option value="${b.id}">${b.business_name} (${b.business_code})</option>`).join('');
        
        const body = `
            <div class="form-group"><label>Business *</label><select id="cl_biz" class="form-control">${bizOptions}</select></div>
            <div class="form-group"><label>Plan *</label>
                <select id="cl_plan" class="form-control" onchange="window.updateLicenseModalUI()">
                    <option value="TRIAL">TRIAL</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="ANNUAL">ANNUAL</option>
                    <option value="LIFETIME">LIFETIME</option>
                </select>
            </div>
            <div class="form-group"><label>Max Devices *</label><input type="number" id="cl_devices" class="form-control" value="1" min="1"></div>
            <div class="form-group" id="cl_expiry_group"><label>Expiry Date</label><input type="date" id="cl_expiry" class="form-control"></div>
            <div class="form-group"><label>Notes</label><textarea id="cl_notes" class="form-control"></textarea></div>
            <div id="cl_error" class="form-error"></div>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="cl_submit" onclick="window.submitCreateLicense()">Create License</button>
        `;
        window.openModal('Create License', body, footer);
    } catch(e) { window.showErrorAlert(e.message); }
};

window.updateLicenseModalUI = () => {
    const plan = document.getElementById('cl_plan').value;
    const expGrp = document.getElementById('cl_expiry_group');
    if(plan === 'LIFETIME') {
        expGrp.style.display = 'none';
    } else {
        expGrp.style.display = 'block';
    }
};

window.submitCreateLicense = async () => {
    const bizId = document.getElementById('cl_biz').value;
    const plan = document.getElementById('cl_plan').value;
    const max_devices = parseInt(document.getElementById('cl_devices').value);
    const expires_at = document.getElementById('cl_expiry').value;
    const notes = document.getElementById('cl_notes').value;
    const errDiv = document.getElementById('cl_error');
    
    document.getElementById('cl_submit').disabled = true;
    document.getElementById('cl_submit').innerText = 'Creating...';
    
    try {
        const payload = { business_id: bizId, plan, max_devices, notes };
        if (plan !== 'LIFETIME' && expires_at) {
            payload.expires_at = new Date(expires_at).toISOString();
        }
        
        const data = await executeAdminAction('CREATE_LICENSE', payload);
        window.closeModal();
        
        window.showOneTimeKeyModal(data.rawKey, plan);
        
        window.loadLicenses();
        
    } catch(e) {
        errDiv.innerText = e.message;
        errDiv.style.display = 'block';
        document.getElementById('cl_submit').disabled = false;
        document.getElementById('cl_submit').innerText = 'Create License';
    }
};










window.extendExpiryModal = (licenseId, currentExpiryStr) => {
    let currentDisp = 'Never';
    if (currentExpiryStr) {
        currentDisp = new Date(currentExpiryStr).toLocaleDateString();
    }
    
    // We store the current date as a JS Date object for easy calculation
    const currDateObj = currentExpiryStr ? new Date(currentExpiryStr) : new Date();

    const bodyHtml = `
        <p><strong>Current Expiry:</strong> ${currentDisp}</p>
        <p><strong>Extension Type:</strong></p>
        <div style="margin-bottom: 10px;">
            <label><input type="radio" name="ext_type" value="1_month" checked onclick="window.updateExtExpiryPreview('${currentExpiryStr}')"> 1 Month</label><br>
            <label><input type="radio" name="ext_type" value="1_year" onclick="window.updateExtExpiryPreview('${currentExpiryStr}')"> 1 Year</label><br>
            <label><input type="radio" name="ext_type" value="custom" onclick="window.updateExtExpiryPreview('${currentExpiryStr}')"> Custom Date</label>
        </div>
        <div id="ext_custom_div" style="display:none; margin-bottom:10px;">
            <label>New Expiry Date:</label><br>
            <input type="date" id="ext_custom_date" class="form-input" style="width:100%;">
        </div>
        <p><strong>New Expiry:</strong> <span id="ext_preview" style="font-weight:bold;"></span></p>
    `;
    const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.executeExtendExpiry('${licenseId}', '${currentExpiryStr}')">Confirm</button>
    `;
    window.openModal('Extend License', bodyHtml, footerHtml);
    setTimeout(() => { window.updateExtExpiryPreview(currentExpiryStr); }, 100);
};

window.updateExtExpiryPreview = (currentExpiryStr) => {
    const type = document.querySelector('input[name="ext_type"]:checked').value;
    const customDiv = document.getElementById('ext_custom_div');
    const previewSpan = document.getElementById('ext_preview');
    
    const baseDate = currentExpiryStr ? new Date(currentExpiryStr) : new Date();
    
    if (type === '1_month') {
        customDiv.style.display = 'none';
        baseDate.setMonth(baseDate.getMonth() + 1);
        previewSpan.innerText = baseDate.toLocaleDateString();
        window._tempExtDate = baseDate.toISOString();
    } else if (type === '1_year') {
        customDiv.style.display = 'none';
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        previewSpan.innerText = baseDate.toLocaleDateString();
        window._tempExtDate = baseDate.toISOString();
    } else if (type === 'custom') {
        customDiv.style.display = 'block';
        const customVal = document.getElementById('ext_custom_date').value;
        if (customVal) {
            const cd = new Date(customVal);
            previewSpan.innerText = cd.toLocaleDateString();
            window._tempExtDate = cd.toISOString();
        } else {
            previewSpan.innerText = '-';
            window._tempExtDate = null;
        }
        
        document.getElementById('ext_custom_date').onchange = () => {
             const v = document.getElementById('ext_custom_date').value;
             if (v) {
                 const d2 = new Date(v);
                 previewSpan.innerText = d2.toLocaleDateString();
                 window._tempExtDate = d2.toISOString();
             } else {
                 previewSpan.innerText = '-';
                 window._tempExtDate = null;
             }
        };
    }
};

window.executeExtendExpiry = async (licenseId, currentExpiryStr) => {
    try {
        if (!window._tempExtDate) {
            window.showErrorAlert("Please select a valid expiry date.");
            return;
        }
        
        // Prevent shortening by accident
        if (currentExpiryStr) {
            const curDate = new Date(currentExpiryStr);
            const newDate = new Date(window._tempExtDate);
            if (newDate <= curDate) {
                if(!confirm("The new expiry date is earlier than or equal to the current expiry. Proceed anyway?")) {
                    return;
                }
            }
        }
        
        window.closeModal();
        await executeAdminAction('EXTEND_EXPIRY', { license_id: licenseId, expires_at: window._tempExtDate });
        window.showToast('License expiry extended successfully');
        window.viewLicense(licenseId);
    } catch(e) {
        window.showErrorAlert(e.message);
    }
};

window.changeMaxDevicesModal = (licenseId, currentMax) => {
    const bodyHtml = `
        <p><strong>Current Maximum Devices:</strong> ${currentMax}</p>
        <div>
            <label>New Maximum Devices:</label><br>
            <input type="number" id="new_max_devices" class="form-input" style="width:100%;" min="1" value="${currentMax}">
        </div>
    `;
    const footerHtml = `
        <button class="btn btn-secondary" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.executeChangeMaxDevices('${licenseId}')">Save</button>
    `;
    window.openModal('Change Maximum Devices', bodyHtml, footerHtml);
};

window.executeChangeMaxDevices = async (licenseId) => {
    try {
        const newMax = document.getElementById('new_max_devices').value;
        if (!newMax || parseInt(newMax) < 1) {
            window.showErrorAlert("Valid max devices count is required.");
            return;
        }
        window.closeModal();
        await executeAdminAction('CHANGE_MAX_DEVICES', { license_id: licenseId, max_devices: parseInt(newMax) });
        window.showToast('Max devices updated successfully');
        window.viewLicense(licenseId);
    } catch(e) {
        window.showErrorAlert(e.message);
    }
};

window.deactivateLicense = async (id) => {
    window.showConfirmModal('Deactivate License', 'Are you sure you want to deactivate this license? It cannot be used anymore.', 'Deactivate', `window.executeDeactivate('${id}')`);
};

window.executeDeactivate = async (id) => {
    try {
        await executeAdminAction('DEACTIVATE_LICENSE', { license_id: id });
        window.showToast('License deactivated successfully');
        window.viewLicense(id);
    } catch(e) { window.showErrorAlert(e.message); }
};
