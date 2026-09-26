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
                    // Success! Redirect to main app
                    window.location.href = 'OneBook.html';
                } else {
                    showError(saveResult.error || 'Failed to save license locally.');
                }
            } else if (data.error === "Device limit exceeded" && data.transferAvailable) {
                setLoading(false);
                const confirmTransfer = confirm("This license is currently active on another computer. Move it to this computer?");
                if (confirmTransfer) {
                    setLoading(true);
                    try {
                        const transferRes = await fetch('https://sqibniuqbkgexipynfkx.supabase.co/functions/v1/transfer-license', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                licenseKey: key,
                                deviceId: machineId,
                                deviceName: 'OneBook POS',
                                operatingSystem: navigator.platform,
                                appVersion: '1.0.0'
                            })
                        });
                        const transferData = await transferRes.json();
                        if (transferData.success) {
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
                            const saveResult = window.electronAPI.saveLicenseSync(transferData);
                            if (saveResult.success) {
                                window.location.href = 'OneBook.html';
                            } else {
                                showError(saveResult.error || 'Failed to save license locally.');
                            }
                        } else {
                            showError(transferData.error || 'Transfer failed.');
                        }
                    } catch (err) {
                        console.error('Transfer error:', err);
                        showError('Network error during transfer.');
                    } finally {
                        setLoading(false);
                    }
                }
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
