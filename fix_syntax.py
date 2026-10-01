import re

files = ['/Users/log/onebook/OneBook.html', '/Users/log/onebook/final.html']

for file in files:
    with open(file, 'r', encoding='utf8') as f:
        content = f.read()

    # Fix the header Activate License button (line 1797)
    # The backslashes were erroneously injected
    content = content.replace("window.location.href=\\'license.html\\'", "window.location.href='license.html'")
    
    # We must properly replace the body of loadLicenseInfo / refreshLicenseUI.
    # To do this safely, we will find the start of the function and the end of the script block,
    # or just find the `let statusColor = '#dc3545'; // default red` up to `</script>`
    # Wait, the end of the function is just `}` before `</script>`
    
    # Let's find the function start:
    func_name = 'loadLicenseInfo' if 'OneBook.html' in file else 'refreshLicenseUI'
    
    # We want to replace from `let statusColor = '#dc3545'; // default red` up to the closing `}` of the function.
    # Since my previous script injected the new table logic, we just need to delete the garbage dangling code
    # that comes AFTER `display.innerHTML = \`...\`;`
    
    # Let's find: `display.innerHTML = \`...\`;`
    # and delete everything from the `}` immediately following it up to the `}` that closes the function.
    
    # Actually, a simpler way: find the start of the new logic, and replace all the way to `</script>`
    # The script block ends at `</script>`.
    # Let's just redefine the entire function from `function refreshLicenseUI() {` down to `</script>`!
    
    start_str = f"function {func_name}() {{"
    start_idx = content.find(start_str)
    end_idx = content.find("</script>", start_idx)
    
    full_function = """function {func_name}() {{
        const display = document.getElementById('licenseInfoDisplay');
        if (!display) return;
        
        if (!window.electronAPI || !window.electronAPI.getLicenseInfoSync) {{
            display.innerHTML = '<div style="color:red; padding: 10px; background: #f8d7da; border-radius: 6px;">Unable to load license information</div>';
            return;
        }}

        let info;
        try {{
            info = window.electronAPI.getLicenseInfoSync();
        }} catch (e) {{
            display.innerHTML = `<div style="color:red; padding: 10px; background: #f8d7da; border-radius: 6px;">Exception: ${{e.message}}</div>`;
            return;
        }}

        if (!info) {{
            display.innerHTML = '<div style="color:red; padding: 10px; background: #f8d7da; border-radius: 6px;">No data returned.</div>';
            return;
        }}

        let statusColor = '#dc3545';
        if (info.status === 'ACTIVE') statusColor = '#28a745';
        else if (info.status === 'TRIAL') statusColor = '#ffc107';
        
        let planText = info.plan || 'DEMO';
        let daysRemainingStr = 'Not applicable';
        let expiryDateStr = 'Not applicable';
        let graceDate = 'Not applicable';
        let deviceStatus = info.deviceStatus || 'Not available';
        let lastCheckDate = 'Not available';
        let isFreshDemo = (info.mode === 'DEMO' && !info.plan);

        if (!isFreshDemo) {{
            if (info.plan === 'LIFETIME' || !info.expiresAt) {{
                daysRemainingStr = 'Unlimited';
                expiryDateStr = 'Never';
                if (info.plan === 'LIFETIME') graceDate = 'Not applicable';
            }} else if (info.expiresAt) {{
                const expDate = new Date(info.expiresAt);
                const now = new Date();
                const ms = expDate.getTime() - now.getTime();

                try {{
                    expiryDateStr = expDate.toLocaleDateString('en-GB', {{ day: 'numeric', month: 'short', year: 'numeric' }});
                }} catch(e) {{
                    expiryDateStr = info.expiresAt;
                }}

                if (ms <= 0) {{
                    daysRemainingStr = 'Expired';
                }} else {{
                    const days = Math.ceil(ms / 86400000);
                    daysRemainingStr = days + (days === 1 ? ' Day' : ' Days');
                }}
            }}
            if (info.offlineGraceUntil && info.plan !== 'LIFETIME') {{
                try {{
                    graceDate = new Date(info.offlineGraceUntil).toLocaleDateString('en-GB', {{ day: 'numeric', month: 'short', year: 'numeric' }});
                }} catch(e) {{}}
            }}
            if (info.lastOnlineCheck) {{
                try {{
                    lastCheckDate = new Date(info.lastOnlineCheck).toLocaleString('en-GB', {{ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }});
                }} catch(e) {{}}
            }}
        }}

        let warningHtml = '';
        if (info.mode === 'DEMO') {{
            warningHtml += '<div style="background: #e2e8f0; color: #1e293b; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-weight: bold;">ℹ️ Application is operating in Demo Mode. Activate a license to unlock full capabilities.</div>';
        }}

        let actionButtonHtml = '';
        if (typeof isDemoMode === 'function' && isDemoMode()) {{
            actionButtonHtml = '<button class="btn btn-primary" onclick="window.location.href=\\'license.html\\'" style="width: 100%; font-weight: bold; background-color: #007bff; border-color: #007bff; padding: 10px; border-radius: 6px; color: white; cursor: pointer; margin-top: 25px;">Activate License</button>';
        }} else {{
            actionButtonHtml = '<button class="btn btn-danger" onclick="if(typeof promptSurrenderLicense === \\'function\\') promptSurrenderLicense(); else alert(\\'Surrender not implemented in this view.\\');" style="width: 100%; font-weight: bold; background-color: #dc3545; border-color: #dc3545; padding: 10px; border-radius: 6px; color: white; cursor: pointer; margin-top: 25px;">Surrender License</button>';
        }}

        display.innerHTML = `
            ${{warningHtml}}
            <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 14px;">
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 160px; color: #64748b;">License Status</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: ${{statusColor}}; font-weight: bold;">${{info.status}}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Plan</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${{planText}}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Expires</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${{expiryDateStr}}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Days Remaining</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${{daysRemainingStr}}</td></tr>
                <tr><td style="padding: 20px 0 0 0;" colspan="2"></td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Device Status</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${{deviceStatus}}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Last Online Check</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${{lastCheckDate}}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Offline Grace Until</td><td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${{graceDate}}</td></tr>
            </table>
            ${{actionButtonHtml}}
        `;
    }}
    """
    
    # We replace from start_idx to end_idx with full_function.
    # We must evaluate the f-string first.
    full_function = full_function.format(func_name=func_name)
    content = content[:start_idx] + full_function + content[end_idx:]

    with open(file, 'w', encoding='utf8') as f:
        f.write(content)

