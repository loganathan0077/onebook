document.addEventListener('DOMContentLoaded', () => {
    const machineId = window.electronAPI.getMachineIdSync();
    document.getElementById('machineIdDisplay').innerText = `Machine ID: ${machineId}`;

    const licenseInput = document.getElementById('licenseKey');
    const activateBtn = document.getElementById('activateBtn');
    const errorMessage = document.getElementById('errorMessage');
    const btnText = document.querySelector('.btn-text');
    const spinner = document.getElementById('spinner');

    licenseInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
        e.target.value = value;
        licenseInput.classList.remove('invalid');
        errorMessage.innerText = '';
    });

    activateBtn.addEventListener('click', async () => {
        const key = licenseInput.value.trim();
        
        if (!key) {
            showError('Please enter a valid license key.');
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
                // mask the key safely
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
                    // Success! Redirect to login/admin setup screen
                    window.location.href = 'login.html';
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

    const demoBtn = document.getElementById('demoBtn');
    if (demoBtn) {
        demoBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            demoBtn.disabled = true;
            const btnText = demoBtn.querySelector('.btn-text');
            if (btnText) btnText.innerHTML = 'Starting Demo Mode...';

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
        if (isLoading) {
            activateBtn.disabled = true;
            btnText.style.display = 'none';
            spinner.style.display = 'block';
            licenseInput.disabled = true;
        } else {
            activateBtn.disabled = false;
            btnText.style.display = 'block';
            spinner.style.display = 'none';
            licenseInput.disabled = false;
        }
    }

    function showError(message) {
        licenseInput.classList.add('invalid');
        errorMessage.innerText = message;
    }
});
