import re

files = ['/Users/log/onebook/OneBook.html', '/Users/log/onebook/final.html']

for file in files:
    with open(file, 'r', encoding='utf8') as f:
        content = f.read()

    # Remove the malformed licenseActionContainer block entirely
    # It looks like:
    # <div id="licenseActionContainer"></div>
    # <script>
    #     function renderLicenseActionBtn() {
    #         const container = document.getElementById('licenseActionContainer');
    #         if (!container) return;
    #         if (typeof isDemoMode === 'function' && isDemoMode()) {
    #             container.innerHTML = '<button class="btn btn-primary" onclick="switchSettingsTab(\'license\'); alert(\'Please enter a valid license key below to activate.\')" style="width: 100%; font-weight: bold; background-color: #007bff; border-color: #007bff; padding: 10px; border-radius: 6px; color: white; cursor: pointer;">Activate License</button>';
    #         } else {
    #             container.innerHTML = '<button class="btn btn-danger" onclick="promptSurrenderLicense()" style="width: 100%; font-weight: bold; background-color: #dc3545; border-color: #dc3545; padding: 10px; border-radius: 6px; color: white; cursor: pointer;">Surrender License</button>';
    #         }
    #     }
    # </script>
    
    # And there might be nested duplicates due to my previous script. Let's just remove anything that matches <div id="licenseActionContainer"></div> up to </script> if it contains renderLicenseActionBtn
    
    pattern = r'<div id="licenseActionContainer"></div>\s*<script>\s*function renderLicenseActionBtn\(\) \{.*?</script>'
    
    # We will use re.DOTALL
    content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    # Also I saw in OneBook.html there was:
    # container.innerHTML = '<div id="licenseActionContainer"></div>\n<script>\n...
    # Let's clean that up too by matching any leftover function renderLicenseActionBtn().*?</script>
    content = re.sub(r'<script>\s*function renderLicenseActionBtn\(\) \{.*?</script>', '', content, flags=re.DOTALL)
    
    # And also remove any <div id="licenseActionContainer"></div>
    content = content.replace('<div id="licenseActionContainer"></div>', '')

    with open(file, 'w', encoding='utf8') as f:
        f.write(content)

