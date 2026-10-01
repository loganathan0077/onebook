import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    # 1. Inject Settings UI
    settings_ui = """<h3>⚙️ General Settings</h3>
                            <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin-top: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h4 style="margin: 0 0 5px 0;">📅 Enable Sales Date</h4>
                                    <p style="color: #666; margin: 0; font-size: 13px;">Allow selecting the date for new sales. (Shortcut: Ctrl+D)</p>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="settingsEnableSalesDate" onchange="toggleSetting('enableSalesDate', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>"""
    content = re.sub(r'<h3>⚙️ General Settings</h3>', settings_ui, content, count=1)

    # 2. Update loadSettings
    load_settings_inj = """const businessNameInput = document.getElementById('settingsBusinessName');
            if(document.getElementById('settingsEnableSalesDate')) document.getElementById('settingsEnableSalesDate').checked = settings.enableSalesDate === true;
            // set customSaleDate display
            const saleDateContainer = document.getElementById('customSaleDateContainer');
            if(saleDateContainer) saleDateContainer.style.display = settings.enableSalesDate === true ? 'block' : 'none';
            if(document.getElementById('customSaleDate') && !document.getElementById('customSaleDate').value) {
                document.getElementById('customSaleDate').value = new Date().toISOString().slice(0, 10);
            }"""
    content = re.sub(r'const businessNameInput = document.getElementById\(\'settingsBusinessName\'\);', load_settings_inj, content, count=1)

    # 3. Update saveSettings
    save_settings_inj = """settings.taxNumber = taxNumberInput.value;
            if(document.getElementById('settingsEnableSalesDate')) settings.enableSalesDate = document.getElementById('settingsEnableSalesDate').checked;"""
    content = re.sub(r'settings\.taxNumber = taxNumberInput\.value;', save_settings_inj, content, count=1)

    # 4. Update toggleSetting
    toggle_setting_inj = """if(setting === 'buyingPriceTracking') document.getElementById('settingsBuyingPriceTracking').checked = settings.buyingPriceTracking || false;
                if(setting === 'enableSalesDate') document.getElementById('settingsEnableSalesDate').checked = settings.enableSalesDate || false;"""
    content = re.sub(r'if\(setting === \'buyingPriceTracking\'\) document\.getElementById\(\'settingsBuyingPriceTracking\'\)\.checked = settings\.buyingPriceTracking \|\| false;', toggle_setting_inj, content, count=1)
    
    toggle_setting_apply = """if(setting === 'buyingPriceTracking') settings.buyingPriceTracking = value;
            if(setting === 'enableSalesDate') {
                settings.enableSalesDate = value;
                const saleDateContainer = document.getElementById('customSaleDateContainer');
                if(saleDateContainer) saleDateContainer.style.display = value ? 'block' : 'none';
            }"""
    content = re.sub(r'if\(setting === \'buyingPriceTracking\'\) settings\.buyingPriceTracking = value;', toggle_setting_apply, content, count=1)

    # 5. Record Sale Sticky Header
    old_header = r'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">\s*<div style="display: flex; align-items: center; gap: 15px;">\s*<h2 class="section-title" style="margin: 0;">Record New Sale</h2>\s*</div>\s*<div style="display: flex; align-items: center; gap: 10px; background: #e8f5e9; padding: 5px 20px; border-radius: 8px; border: 2px solid #28a745; box-shadow: 0 2px 4px rgba\(0,0,0,0\.1\);">\s*<div style="display: flex; flex-direction: column; align-items: flex-end;">\s*<span style="font-weight: bold; font-size: 20px; color: #155724; line-height: 1;">Total Amount \(₹\)</span>\s*<span id="topRightTotalAmount" style="font-weight: bold; font-size: 40px; color: #28a745; line-height: 1\.2;">0\.00</span>\s*</div>\s*</div>\s*</div>'
    new_header = """<div style="display: flex; justify-content: space-between; align-items: center; position: sticky; top: -20px; z-index: 50; background: #f8f9fa; padding: 15px; border-bottom: 2px solid #ddd; border-radius: 8px; margin: -20px -20px 15px -20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <h2 class="section-title" style="margin: 0;">Record New Sale</h2>
                    </div>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div id="customSaleDateContainer" style="display: none; background: #fff; padding: 5px 15px; border-radius: 8px; border: 1px solid #ced4da; box-shadow: inset 0 1px 2px rgba(0,0,0,0.075);">
                            <span style="font-weight: bold; font-size: 14px; color: #495057; display: block; margin-bottom: 2px;">📅 Sale Date <small style="font-weight:normal;color:#6c757d">(Ctrl+D)</small></span>
                            <input type="date" id="customSaleDate" style="border: none; outline: none; font-size: 16px; font-weight: bold; color: #212529; background: transparent; padding: 0;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; background: #e8f5e9; padding: 5px 20px; border-radius: 8px; border: 2px solid #28a745; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <span style="font-weight: bold; font-size: 20px; color: #155724; line-height: 1;">Total Amount (₹)</span>
                                <span id="topRightTotalAmount" style="font-weight: bold; font-size: 40px; color: #28a745; line-height: 1.2;">0.00</span>
                            </div>
                        </div>
                    </div>
                </div>"""
    content = re.sub(old_header, new_header, content, count=1)

    # 6. completeSale Logic
    complete_sale_old = r'const todayStr = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);\s*if \(\!canCreateDemoSale\(todayStr\)\)'
    complete_sale_new = """const systemDateStr = new Date().toISOString().slice(0, 10);
                if (!canCreateDemoSale(systemDateStr))"""
    content = re.sub(complete_sale_old, complete_sale_new, content)

    # Update saleDate assignment
    date_logic_old = r'const saleDate = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);'
    date_logic_new = """let saleDate = new Date().toISOString().slice(0, 10);
            const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            if (settings.enableSalesDate) {
                if (typeof isDemoMode === 'function' && isDemoMode()) {
                    // Demo Mode forces system date
                    saleDate = new Date().toISOString().slice(0, 10);
                } else {
                    const customDateVal = document.getElementById('customSaleDate').value;
                    if (customDateVal) {
                        saleDate = customDateVal;
                    }
                }
            }"""
    content = re.sub(date_logic_old, date_logic_new, content)

    # 7. Ctrl+D Shortcut listener
    shortcut_js = """
        // Ctrl+D Shortcut for Sale Date
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
                // Ensure we are on the Record Sale tab before intercepting
                const salesTab = document.getElementById('sales');
                if (salesTab && salesTab.style.display !== 'none' && salesTab.classList.contains('active')) {
                    e.preventDefault();
                    
                    const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
                    
                    if (!settings.enableSalesDate) {
                        // Toast non-intrusively
                        const toast = document.createElement('div');
                        toast.innerText = 'Sales Date feature is disabled in Settings.';
                        toast.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 10px 20px; border-radius: 5px; z-index: 99999; box-shadow: 0 4px 6px rgba(0,0,0,0.1); opacity: 0; transition: opacity 0.3s;';
                        document.body.appendChild(toast);
                        setTimeout(() => toast.style.opacity = '1', 10);
                        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
                        return;
                    }
                    
                    if (typeof isDemoMode === 'function' && isDemoMode()) {
                        const toast = document.createElement('div');
                        toast.innerText = 'Demo Mode: Sales Date is fixed to today.';
                        toast.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #ff9800; color: white; padding: 10px 20px; border-radius: 5px; z-index: 99999; box-shadow: 0 4px 6px rgba(0,0,0,0.1); opacity: 0; transition: opacity 0.3s;';
                        document.body.appendChild(toast);
                        setTimeout(() => toast.style.opacity = '1', 10);
                        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
                        return;
                    }
                    
                    const dateInput = document.getElementById('customSaleDate');
                    if (dateInput) {
                        dateInput.focus();
                        if (typeof dateInput.showPicker === 'function') {
                            try { dateInput.showPicker(); } catch(err) {}
                        }
                    }
                }
            }
        });
    </script>"""
    content = re.sub(r'</script>(?=\s*</head>)', shortcut_js, content)

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

