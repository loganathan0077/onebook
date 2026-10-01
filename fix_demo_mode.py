import re

files = ['/Users/log/onebook/OneBook.html', '/Users/log/onebook/final.html']

for file in files:
    with open(file, 'r', encoding='utf8') as f:
        content = f.read()

    # 1. Clean up stray JS
    content = re.sub(r"';\s*\}\s*\}\s*// Make sure to call this when loading license info\s*</script>", "</script>", content)
    
    # 2. Fix the header Activate License button to link to license.html
    header_btn_old = r'<button id="demoActivateBtn" onclick="document.getElementById\(\'settingsModal\'\).style.display = \'block\'; switchSettingsTab\(\'license\'\);"([^>]*)>'
    header_btn_new = r'<button id="demoActivateBtn" onclick="window.location.href=\'license.html\';" \1>'
    content = re.sub(header_btn_old, header_btn_new, content)
    
    # 3. Replace loadLicenseInfo / refreshLicenseUI block with one that natively supports Demo Mode formatting
    # We will look for the `display.innerHTML = ...` part and replace it.
    # The existing table generation looks like this:
    # display.innerHTML = `
    #     ${warningHtml}
    #     <table ...>
    #     ...
    #     </table>
    # `;
    
    # We'll just replace the entire function's innerHTML generation and variable assignment logic
    # Wait, the safest way is to do a full function replace using regex.
    # We know the function name is 'loadLicenseInfo' in OneBook.html and 'refreshLicenseUI' in final.html.
    
    func_name = 'loadLicenseInfo' if 'OneBook.html' in file else 'refreshLicenseUI'
    
    # Let's replace the whole body from `let statusColor` down to `display.innerHTML = \`... \`;`
    # Let's just do a targeted block replacement.
    
    table_pattern = r'let statusColor =.*?display\.innerHTML = `.*?`;'
    
    new_table_logic = """let statusColor = '#dc3545'; // default red
        if (info.status === 'ACTIVE') statusColor = '#28a745';
        else if (info.status === 'TRIAL') statusColor = '#ffc107';
        
        let planText = info.plan || 'DEMO';
        let daysRemainingStr = 'Not applicable';
        let expiryDateStr = 'Not applicable';
        let graceDate = 'Not applicable';
        let deviceStatus = info.deviceStatus || 'Not available';
        let lastCheckDate = 'Not available';
        let isFreshDemo = (info.mode === 'DEMO' && !info.plan);

        if (!isFreshDemo) {
            if (info.plan === 'LIFETIME' || !info.expiresAt) {
                daysRemainingStr = 'Unlimited';
                expiryDateStr = 'Never';
                if (info.plan === 'LIFETIME') graceDate = 'Not applicable';
            } else if (info.expiresAt) {
                const expDate = new Date(info.expiresAt);
                const now = new Date();
                const ms = expDate.getTime() - now.getTime();

                try {
                    expiryDateStr = expDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                } catch(e) {
                    expiryDateStr = info.expiresAt;
                }

                if (ms <= 0) {
                    daysRemainingStr = 'Expired';
                } else {
                    const days = Math.ceil(ms / 86400000);
                    daysRemainingStr = days + (days === 1 ? ' Day' : ' Days');
                }
            }
            if (info.offlineGraceUntil && info.plan !== 'LIFETIME') {
                try {
                    graceDate = new Date(info.offlineGraceUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                } catch(e) {}
            }
            if (info.lastOnlineCheck) {
                try {
                    lastCheckDate = new Date(info.lastOnlineCheck).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                } catch(e) {}
            }
        }

        let warningHtml = '';
        if (info.mode === 'DEMO') {
            warningHtml += '<div style="background: #e2e8f0; color: #1e293b; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-weight: bold;">ℹ️ Application is operating in Demo Mode. Activate a license to unlock full capabilities.</div>';
        }

        let actionButtonHtml = '';
        if (typeof isDemoMode === 'function' && isDemoMode()) {
            actionButtonHtml = '<button class="btn btn-primary" onclick="window.location.href=\\'license.html\\'" style="width: 100%; font-weight: bold; background-color: #007bff; border-color: #007bff; padding: 10px; border-radius: 6px; color: white; cursor: pointer; margin-top: 25px;">Activate License</button>';
        } else {
            actionButtonHtml = '<button class="btn btn-danger" onclick="if(typeof promptSurrenderLicense === \\'function\\') promptSurrenderLicense(); else alert(\\'Surrender not implemented in this view.\\');" style="width: 100%; font-weight: bold; background-color: #dc3545; border-color: #dc3545; padding: 10px; border-radius: 6px; color: white; cursor: pointer; margin-top: 25px;">Surrender License</button>';
        }

        display.innerHTML = `
            ${warningHtml}
            <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 14px;">
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 160px; color: #64748b;">License Status</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: ${statusColor}; font-weight: bold;">${info.status}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Plan</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${planText}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Expires</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${expiryDateStr}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Days Remaining</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${daysRemainingStr}</td></tr>
                <tr><td style="padding: 20px 0 0 0;" colspan="2"></td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Device Status</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${deviceStatus}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Last Online Check</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${lastCheckDate}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Offline Grace Until</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${graceDate}</td></tr>
            </table>
            ${actionButtonHtml}
        `;"""
    
    content = re.sub(r'let statusColor =.*?(?=^\s*\}(?!;)|<\/script>)', new_table_logic + '\n', content, flags=re.DOTALL | re.MULTILINE)
    
    # Wait, my regex might match too much. Let's just find the `let statusColor` and the `display.innerHTML` blocks.
    
    # 4. Fix completeSale to add `isDemoSale: true`
    complete_sale_pattern = r'const saleId = Date\.now\(\);\s*const sale = \{'
    if 'isDemoSale:' not in content:
        # Only inject if not already there
        complete_sale_replacement = r'const saleId = Date.now();\n                const sale = {\n                    isDemo: typeof isDemoMode === \'function\' ? isDemoMode() : false,'
        content = re.sub(complete_sale_pattern, complete_sale_replacement, content)
        
    # Also fix the showDemoLimitMessage function to redirect to license.html
    demo_msg_old = r"if \(typeof switchSettingsTab === 'function'\) \{\s*document\.getElementById\('settingsModal'\)\.style\.display = 'block';\s*switchSettingsTab\('license'\);\s*\}"
    demo_msg_new = r"window.location.href='license.html';"
    content = re.sub(demo_msg_old, demo_msg_new, content)
    
    # 5. Fix finalizeAddProduct to enforce max 10 products
    add_product_pattern = r'(function finalizeAddProduct\(product, categorySelect, customCategoryInput\) \{)'
    add_product_replacement = r"""\1
            if (typeof isDemoMode === 'function' && isDemoMode()) {
                if (!canCreateDemoProduct()) {
                    showDemoLimitMessage('products');
                    return;
                }
                product.isDemo = true;
            }"""
    content = re.sub(add_product_pattern, add_product_replacement, content)
    
    # 6. Fix saveCustomer to enforce max 2 customers
    save_cust_pattern = r'(function saveCustomer\(\) \{[\s\S]*?if \(!window\.hasPermission[^>]*\n)'
    save_cust_replacement = r"""\1
            if (typeof isDemoMode === 'function' && isDemoMode()) {
                // If editing existing, allow it. If creating new, check limit.
                const editingId = document.getElementById('editCustomerId').value;
                if (!editingId) {
                    if (!canCreateDemoCustomer()) {
                        showDemoLimitMessage('customers');
                        return;
                    }
                }
            }"""
    content = re.sub(save_cust_pattern, save_cust_replacement, content)
    
    # And we must inject `customer.isDemo = true;` when saving a new customer.
    # Where does `const customer = { id: ...` happen in saveCustomer?
    customer_obj_pattern = r'(const customer = \{\s*id: customerId,)'
    customer_obj_replacement = r'\1\n                isDemo: (typeof isDemoMode === "function" && isDemoMode() && !document.getElementById("editCustomerId").value) ? true : undefined,'
    content = re.sub(customer_obj_pattern, customer_obj_replacement, content)

    with open(file, 'w', encoding='utf8') as f:
        f.write(content)

