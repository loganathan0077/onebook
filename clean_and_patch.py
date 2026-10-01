import re

files = ['/Users/log/onebook/OneBook.html', '/Users/log/onebook/final.html']

for file in files:
    with open(file, 'r', encoding='utf8') as f:
        content = f.read()

    # 1. Remove all old DEMO MODE CONTROLS script blocks
    old_script_pattern = r'<!-- DEMO MODE CONTROLS -->.*?</script>'
    # The script blocks didn't have </script> if they were just injected into </head>.
    # Wait, my previous patch did: `content = content.replace("</head>", demo_script + "</head>")`
    # And demo_script contained `</script>`. So `old_script_pattern` works.
    content = re.sub(r'<!-- DEMO MODE CONTROLS -->[\s\S]*?</script>', '', content)
    
    # Remove any leftover watermark injections
    content = re.sub(r'<div id="demoWatermark"[^>]*>🔵 DEMO MODE</div>', '', content)
    content = re.sub(r'<button id="demoActivateBtn"[^>]*>Activate License</button>', '', content)
    
    # 2. Inject centralized isDemoMode into <head> (just once)
    new_script = """<!-- DEMO MODE CONTROLS -->
    <script>
        const DEMO_MAX_PRODUCTS = 10;
        const DEMO_MAX_CUSTOMERS = 2;
        const DEMO_MAX_SALES_PER_DAY = 5;

        function isDemoMode() {
            if (window.electronAPI && window.electronAPI.getLicenseInfoSync) {
                try {
                    const info = window.electronAPI.getLicenseInfoSync();
                    return info && info.mode === 'DEMO';
                } catch (e) {
                    console.error('License check error:', e);
                }
            }
            return true; // Default to DEMO if we can't verify
        }

        function getDemoProductCount() { return products ? products.filter(p => p.isDemo).length : 0; }
        function canCreateDemoProduct() { return getDemoProductCount() < DEMO_MAX_PRODUCTS; }
        function getDemoCustomerCount() { return customers ? customers.filter(c => c.isDemo).length : 0; }
        function canCreateDemoCustomer() { return getDemoCustomerCount() < DEMO_MAX_CUSTOMERS; }
        function getDemoSalesCountForDate(dateStr) { return sales ? sales.filter(s => s.isDemo && s.date && s.date.startsWith(dateStr)).length : 0; }
        function canCreateDemoSale(dateStr) { return getDemoSalesCountForDate(dateStr) < DEMO_MAX_SALES_PER_DAY; }

        function showDemoLimitMessage(type) {
            let msg = '';
            if (type === 'products') msg = `Demo Mode allows up to ${DEMO_MAX_PRODUCTS} newly created demo products.\\nActivate OneBook to add unlimited products.`;
            else if (type === 'customers') msg = `Demo Mode allows up to ${DEMO_MAX_CUSTOMERS} newly created demo customers.\\nActivate OneBook to add more customers.`;
            else if (type === 'sales') msg = `You can record up to ${DEMO_MAX_SALES_PER_DAY} demo sales per day.\\nActivate OneBook to record unlimited sales.`;
            
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Demo Mode Limit Reached',
                    text: msg,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Activate License',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed) {
                        if (typeof switchSettingsTab === 'function') {
                            document.getElementById('settingsModal').style.display = 'block';
                            switchSettingsTab('license');
                        }
                    }
                });
            } else {
                alert("Demo Limit Reached\\n\\n" + msg);
            }
        }
    </script>
"""
    # Replace ONLY the very first </head>
    content = content.replace("</head>", new_script + "</head>", 1)
    
    # 3. Inject Watermark into Header
    header_target = """<span id="userEmail" style="font-size: 0.9em; opacity: 0.9;"></span>"""
    header_replacement = """<div id="demoWatermark" style="display: none; background: #fff; color: var(--th-primary); padding: 5px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; border: 2px solid var(--th-primary); box-shadow: 0 2px 5px rgba(0,0,0,0.2);">🔵 DEMO MODE</div>
                    <button id="demoActivateBtn" onclick="document.getElementById('settingsModal').style.display = 'block'; switchSettingsTab('license');" style="display: none; background: #fff; color: var(--th-primary); border: none; padding: 6px 15px; border-radius: 6px; font-weight: bold; cursor: pointer;">Activate License</button>
                    <span id="userEmail" style="font-size: 0.9em; opacity: 0.9;"></span>"""
    content = content.replace(header_target, header_replacement)

    # 4. Patch DOMContentLoaded to show watermark and dynamically render UI
    # We will search for window.addEventListener('DOMContentLoaded', async () => {
    init_target_1 = """        window.addEventListener('DOMContentLoaded', async () => {
            console.log('🚀 App Initializing...');
            if (typeof updateLicenseMode === 'function') updateLicenseMode();
            if (typeof isDemoMode === 'function' && isDemoMode()) {
                const w = document.getElementById('demoWatermark');
                const b = document.getElementById('demoActivateBtn');
                if (w) w.style.display = 'block';
                if (b) b.style.display = 'block';
            }"""
    init_target_2 = """        window.addEventListener('DOMContentLoaded', async () => {
            console.log('🚀 App Initializing...');"""
    
    init_replacement = """        window.addEventListener('DOMContentLoaded', async () => {
            console.log('🚀 App Initializing...');
            if (isDemoMode()) {
                const w = document.getElementById('demoWatermark');
                const b = document.getElementById('demoActivateBtn');
                if (w) w.style.display = 'block';
                if (b) b.style.display = 'block';
            } else {
                const w = document.getElementById('demoWatermark');
                const b = document.getElementById('demoActivateBtn');
                if (w) w.style.display = 'none';
                if (b) b.style.display = 'none';
            }"""
    
    if init_target_1 in content:
        content = content.replace(init_target_1, init_replacement)
    elif init_target_2 in content:
        content = content.replace(init_target_2, init_replacement)

    # 5. Fix generateReceiptNumber()
    receipt_target = """        function generateReceiptNumber() {
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();"""
    receipt_replacement = """        function generateReceiptNumber() {
            if (typeof isDemoMode === 'function' && isDemoMode()) {
                return "DEMO SALE " + Math.random().toString().slice(2, 8);
            }
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();"""
    content = content.replace(receipt_target, receipt_replacement)
    
    # 6. Remove previous completeSale hooks and inject new one
    content = re.sub(r'            if \(isDemoMode\(\)\) \{\n                const todayStr = new Date\(\).toISOString\(\).slice\(0, 10\);\n                if \(saleDate !== todayStr\) \{\n                    showAlert\(\'Demo Mode: You can only record sales for the current system date.\', \'warning\'\);\n                    document.getElementById\(\'recordSalesDate\'\).value = todayStr;\n                    return;\n                \}\n                if \(!canCreateDemoSale\(todayStr\)\) \{\n                    showDemoLimitMessage\(\'sales\'\);\n                    return;\n                \}\n            \}\n            ', '', content)
    
    completeSale_target = """            const saleDate = document.getElementById('recordSalesDate').value || new Date().toISOString().slice(0, 10);
            
            if (cart.length === 0) {"""
    completeSale_replacement = """            const saleDate = document.getElementById('recordSalesDate').value || new Date().toISOString().slice(0, 10);
            
            if (isDemoMode()) {
                const todayStr = new Date().toISOString().slice(0, 10);
                if (saleDate !== todayStr) {
                    showAlert('Demo Mode: You can only record sales for the current system date.', 'warning');
                    document.getElementById('recordSalesDate').value = todayStr;
                    return;
                }
                if (!canCreateDemoSale(todayStr)) {
                    showDemoLimitMessage('sales');
                    return;
                }
            }

            if (cart.length === 0) {"""
    content = content.replace(completeSale_target, completeSale_replacement)
    
    # Remove previous receiptNumber hook in completeSale
    # Previous was:
    # let receiptNumber = generateReceiptNumber();
    # if (isDemoMode()) {
    #     receiptNumber = "DEMO SALE " + Date.now().toString().slice(-6);
    # }
    content = re.sub(r'let receiptNumber = generateReceiptNumber\(\);\n            if \(isDemoMode\(\)\) \{\n                receiptNumber = "DEMO SALE " \+ Date\.now\(\)\.toString\(\)\.slice\(-6\);\n            \}', 'const receiptNumber = generateReceiptNumber();', content)

    # 7. Add Activate License to Settings
    # We'll replace the existing Surrender License button container with dynamic generation based on isDemoMode
    surrender_target = """<div style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                    <button class="btn btn-danger" onclick="promptSurrenderLicense()" style="width: 100%; font-weight: bold; background-color: #dc3545; border-color: #dc3545; padding: 10px; border-radius: 6px; color: white; cursor: pointer;">Surrender License</button>
                                </div>"""
    
    surrender_replacement = """<div id="licenseActionContainer" style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                                </div>
                                <script>
                                    function renderLicenseActionBtn() {
                                        const container = document.getElementById('licenseActionContainer');
                                        if (!container) return;
                                        if (typeof isDemoMode === 'function' && isDemoMode()) {
                                            container.innerHTML = '<button class="btn btn-primary" onclick="switchSettingsTab(\\'license\\'); alert(\\'Please enter a valid license key below to activate.\\')" style="width: 100%; font-weight: bold; background-color: #007bff; border-color: #007bff; padding: 10px; border-radius: 6px; color: white; cursor: pointer;">Activate License</button>';
                                        } else {
                                            container.innerHTML = '<button class="btn btn-danger" onclick="promptSurrenderLicense()" style="width: 100%; font-weight: bold; background-color: #dc3545; border-color: #dc3545; padding: 10px; border-radius: 6px; color: white; cursor: pointer;">Surrender License</button>';
                                        }
                                    }
                                    // Make sure to call this when loading license info
                                </script>"""
    content = content.replace(surrender_target, surrender_replacement)

    # Inject call to renderLicenseActionBtn in loadLicenseInfo
    load_license_target = """        let statusColor = '#dc3545'; // default red
        if (info.status === 'ACTIVE') statusColor = '#28a745';"""
    load_license_replacement = """        let statusColor = '#dc3545'; // default red
        if (info.status === 'ACTIVE') statusColor = '#28a745';
        if (typeof renderLicenseActionBtn === 'function') renderLicenseActionBtn();"""
    content = content.replace(load_license_target, load_license_replacement)


    # Write back
    with open(file, 'w', encoding='utf8') as f:
        f.write(content)
        
print("Cleanup and patching successful")
