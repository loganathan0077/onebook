import re

with open('final.html', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """                                    <label class="toggle-switch">
                                        <input type="checkbox" id="settingsExpiryTracking">
                                    </label>"""
replacement1 = """                                    <label class="toggle-switch">
                                        <input type="checkbox" id="settingsExpiryTracking" onchange="toggleSetting('expiryTracking', this.checked)">
                                        <span class="toggle-slider"></span>
                                    </label>"""
content = content.replace(target1, replacement1)

target2 = """                                    <label class="toggle-switch">
                                        <input type="checkbox" id="settingsBuyingPriceTracking">
                                    </label>"""
replacement2 = """                                    <label class="toggle-switch">
                                        <input type="checkbox" id="settingsBuyingPriceTracking" onchange="toggleSetting('buyingPriceTracking', this.checked)">
                                        <span class="toggle-slider"></span>
                                    </label>"""
content = content.replace(target2, replacement2)

with open('final.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Toggle fix complete")
