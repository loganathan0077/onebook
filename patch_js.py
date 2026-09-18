import re

with open('final.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update saveSettings
save_settings_target = """            const defaultTaxType = document.getElementById('settingsDefaultTaxType');
            if(defaultTaxType) currentSettings.defaultTaxType = defaultTaxType.value;

            localStorage.setItem('settings', JSON.stringify(currentSettings));"""
save_settings_replacement = """            const defaultTaxType = document.getElementById('settingsDefaultTaxType');
            if(defaultTaxType) currentSettings.defaultTaxType = defaultTaxType.value;

            const expiryToggle = document.getElementById('settingsExpiryTracking');
            if(expiryToggle) currentSettings.expiryTracking = expiryToggle.checked;

            const buyingToggle = document.getElementById('settingsBuyingPriceTracking');
            if(buyingToggle) currentSettings.buyingPriceTracking = buyingToggle.checked;

            localStorage.setItem('settings', JSON.stringify(currentSettings));"""
content = content.replace(save_settings_target, save_settings_replacement)

# 2. Update applySettingsToUI
apply_settings_target = """            if(window.isGlobalUsbScannerActive !== undefined) {
                const scannerToggle = document.getElementById('globalUsbScannerToggle');
                if (scannerToggle) {
                    scannerToggle.checked = window.isGlobalUsbScannerActive;
                }
            }
        }"""
apply_settings_replacement = """            if(window.isGlobalUsbScannerActive !== undefined) {
                const scannerToggle = document.getElementById('globalUsbScannerToggle');
                if (scannerToggle) {
                    scannerToggle.checked = window.isGlobalUsbScannerActive;
                }
            }
            
            const expTrack = settings.expiryTracking !== undefined ? settings.expiryTracking : false;
            const buyTrack = settings.buyingPriceTracking !== undefined ? settings.buyingPriceTracking : false;
            
            const expToggle = document.getElementById('settingsExpiryTracking');
            if(expToggle) expToggle.checked = expTrack;
            const buyToggle = document.getElementById('settingsBuyingPriceTracking');
            if(buyToggle) buyToggle.checked = buyTrack;
            
            applyProductFeaturesVisibility(expTrack, buyTrack);
        }
        
        function applyProductFeaturesVisibility(expiryTracking, buyingPriceTracking) {
            const styleId = 'product-features-style';
            let styleEl = document.getElementById(styleId);
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }
            
            let css = '';
            if (!expiryTracking) {
                css += '.expiry-tracking-feature { display: none !important; }\\n';
            }
            if (!buyingPriceTracking) {
                css += '.buying-price-feature { display: none !important; }\\n';
            }
            styleEl.innerHTML = css;
        }

        function toggleSetting(setting, value) {
            if (typeof window.isAdminUser !== 'undefined' && !window.isAdminUser) {
                showAlert('Unauthorized: Only Administrators can change settings.', 'error');
                const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
                if(setting === 'expiryTracking') document.getElementById('settingsExpiryTracking').checked = settings.expiryTracking || false;
                if(setting === 'buyingPriceTracking') document.getElementById('settingsBuyingPriceTracking').checked = settings.buyingPriceTracking || false;
                return;
            }
            const currentSettings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            currentSettings[setting] = value;
            localStorage.setItem('settings', JSON.stringify(currentSettings));
            
            const expTrack = currentSettings.expiryTracking !== undefined ? currentSettings.expiryTracking : false;
            const buyTrack = currentSettings.buyingPriceTracking !== undefined ? currentSettings.buyingPriceTracking : false;
            applyProductFeaturesVisibility(expTrack, buyTrack);
            
            loadProducts();
        }"""
content = content.replace(apply_settings_target, apply_settings_replacement)

with open('final.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("JS patching part 1 complete")
