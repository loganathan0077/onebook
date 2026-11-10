document.addEventListener('DOMContentLoaded', () => {
    let machineId = 'DEVICE-UNKNOWN';
    try {
        if (window.electronAPI && window.electronAPI.getMachineIdSync) {
            machineId = window.electronAPI.getMachineIdSync();
        }
    } catch (e) {
        console.warn('Machine ID error:', e);
    }
    const machineEl = document.getElementById('machineIdDisplay');
    if (machineEl) machineEl.innerText = `Machine ID: ${machineId}`;

    const licenseInput = document.getElementById('licenseKey');
    const activateBtn = document.getElementById('activateBtn');
    const errorMessage = document.getElementById('errorMessage');
    const btnText = document.querySelector('.btn-text');
    const spinner = document.getElementById('spinner');

    if (licenseInput) {
        licenseInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
            e.target.value = value;
            licenseInput.classList.remove('invalid');
            if (errorMessage) errorMessage.innerText = '';
        });

        setTimeout(() => {
            licenseInput.focus();
        }, 150);
    }

    if (activateBtn) {
        activateBtn.addEventListener('click', async () => {
            const key = licenseInput ? licenseInput.value.trim() : '';
            
            if (!key) {
                showError('Please enter a valid license key.');
                if (licenseInput) licenseInput.focus();
                return;
            }

            setLoading(true);

            try {
                const response = await fetch('https://sqibniuqbkgexipynfkx.supabase.co/functions/v1/activate-license', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        licenseKey: key,
                        deviceId: machineId,
                        deviceName: 'OneBook POS',
                        operatingSystem: navigator.platform,
                        appVersion: '1.0.0'
                    })
                });

                const data = await response.json();

                if (data.success) {
                    // Mask the key safely for storage
                    let maskedKey = '';
                    const parts = key.split('-');
                    if (parts.length >= 4) {
                        maskedKey = `${parts[0]}-****-${parts[parts.length-1]}`;
                    } else if (key.length >= 4) {
                        maskedKey = `****-${key.slice(-4)}`;
                    } else {
                        maskedKey = '****';
                    }
                    localStorage.setItem('maskedLicenseKey', maskedKey);

                    // Save securely via IPC
                    const saveResult = window.electronAPI.saveLicenseSync(data);
                    if (saveResult.success) {
                        // 1. Completely exit and wipe any Demo session state
                        sessionStorage.removeItem('onebook_session_token');
                        sessionStorage.removeItem('currentUser');
                        if (window.electronAPI && window.electronAPI.sqlite && window.electronAPI.sqlite.clearSessionToken) {
                            window.electronAPI.sqlite.clearSessionToken();
                        }
                        if (window.electronAPI && window.electronAPI.auth && window.electronAPI.auth.clearDemoSession) {
                            await window.electronAPI.auth.clearDemoSession();
                        }

                        // 2. Check if this is a new user without a production Admin account
                        let hasAdmin = false;
                        try {
                            if (window.electronAPI && window.electronAPI.auth && window.electronAPI.auth.checkAdminStatus) {
                                const adminStatus = await window.electronAPI.auth.checkAdminStatus();
                                hasAdmin = Boolean(adminStatus && adminStatus.hasAdmin);
                            }
                        } catch (e) {
                            console.warn('Admin check error:', e);
                        }

                        // 3. Direct new users to Create Admin Account, existing users to Login
                        if (!hasAdmin) {
                            let setupToken = null;
                            try {
                                if (window.electronAPI && window.electronAPI.auth && window.electronAPI.auth.createSetupToken) {
                                    const tokenRes = await window.electronAPI.auth.createSetupToken();
                                    if (tokenRes && tokenRes.success && tokenRes.token) {
                                        setupToken = tokenRes.token;
                                    }
                                }
                            } catch (tokenErr) {
                                console.warn('Could not generate setup token:', tokenErr);
                            }

                            if (setupToken) {
                                window.location.href = 'login.html?view=create-admin&token=' + encodeURIComponent(setupToken);
                            } else {
                                window.location.href = 'login.html?view=create-admin';
                            }
                        } else {
                            window.location.href = 'login.html?activated=true';
                        }
                    } else {
                        showError(saveResult.error || 'Failed to save license locally.');
                    }
                } else if (data.error === "Device limit exceeded") {
                    showError("This license key is already activated on another device. You must release the existing activation or transfer the license before using it here.");
                } else if (data.error === "Invalid license key") {
                    showError("Invalid license key. Please check the key and try again.");
                } else {
                    showError(data.error || 'Activation failed.');
                }
            } catch (error) {
                console.error('Activation request error:', error);
                showError('Network error. Please check your connection.');
            } finally {
                setLoading(false);
            }
        });
    }

    const demoBtn = document.getElementById('demoBtn');
    if (demoBtn) {
        demoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            demoBtn.disabled = true;
            const bText = demoBtn.querySelector('.btn-text');
            if (bText) bText.innerHTML = 'Starting Demo Mode...';

            try {
                let sessionToken = null;
                let user = null;

                if (window.electronAPI && window.electronAPI.auth && window.electronAPI.auth.demoLogin) {
                    const res = await window.electronAPI.auth.demoLogin();
                    if (res && res.success && res.sessionToken && res.user) {
                        sessionToken = res.sessionToken;
                        user = res.user;
                    }
                }

                // Fallback safe demo session if SQLite is not yet initialized
                if (!sessionToken || !user) {
                    sessionToken = 'demo-session-' + Date.now();
                    user = {
                        id: 999999,
                        username: 'demo',
                        fullName: 'Demo User',
                        role: 'demo',
                        status: 'active',
                        isDemo: true,
                        permissions: [
                            'dashboard:view', 'products:view', 'inventory:view',
                            'sales:view', 'customers:view', 'suppliers:view',
                            'reports:view', 'purchases:view', 'expenses:view'
                        ]
                    };
                }

                sessionStorage.setItem('onebook_session_token', sessionToken);
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                if (window.electronAPI && window.electronAPI.sqlite && window.electronAPI.sqlite.setSessionToken) {
                    window.electronAPI.sqlite.setSessionToken(sessionToken);
                }

                // Directly bypass login screen and navigate to main OneBook Dashboard
                window.location.href = 'OneBook.html';
            } catch (err) {
                console.error('Demo navigation error:', err);
                sessionStorage.setItem('onebook_session_token', 'demo-fallback-' + Date.now());
                sessionStorage.setItem('currentUser', JSON.stringify({
                    id: 999999,
                    username: 'demo',
                    fullName: 'Demo User',
                    role: 'demo',
                    status: 'active',
                    isDemo: true
                }));
                window.location.href = 'OneBook.html';
            }
        });
    }

    function setLoading(isLoading) {
        if (!activateBtn) return;
        if (isLoading) {
            activateBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'block';
            if (licenseInput) licenseInput.disabled = true;
        } else {
            activateBtn.disabled = false;
            if (btnText) btnText.style.display = 'block';
            if (spinner) spinner.style.display = 'none';
            if (licenseInput) licenseInput.disabled = false;
        }
    }

    function showError(message) {
        if (licenseInput) licenseInput.classList.add('invalid');
        if (errorMessage) errorMessage.innerText = message;
    }
});
