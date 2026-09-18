import re

with open('final.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Toggles to Settings (after USB scanner)
usb_scanner_html = """                                <label class="toggle-switch">
                                    <input type="checkbox" id="globalUsbScannerToggle" onchange="toggleUsbScanner(this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>"""

product_features_html = """
                            <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin-top: 15px; margin-bottom: 15px;">
                                <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 10px;">📦 Product Features</h4>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5;">
                                    <div>
                                        <h5 style="margin: 0 0 5px 0; font-size: 15px;">📅 Expiry Tracking</h5>
                                        <p style="color: #666; margin: 0; font-size: 13px;">Enable expiry dates and tracking for products.</p>
                                    </div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="settingsExpiryTracking">
                                    </label>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0;">
                                    <div>
                                        <h5 style="margin: 0 0 5px 0; font-size: 15px;">💰 Buying Price Tracking</h5>
                                        <p style="color: #666; margin: 0; font-size: 13px;">Show buying prices in product and inventory views. (Always visible in Purchases).</p>
                                    </div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="settingsBuyingPriceTracking">
                                    </label>
                                </div>
                            </div>
"""
content = content.replace(usb_scanner_html, usb_scanner_html + product_features_html)

# 2. Add classes to Add Product inputs
content = content.replace('<div class="form-group">\n                                    <label>Expiry Days (Optional)</label>', '<div class="form-group expiry-tracking-feature">\n                                    <label>Expiry Days (Optional)</label>')
content = content.replace('<div class="form-group">\n                                    <label>Buying Price (₹)</label>', '<div class="form-group buying-price-feature">\n                                    <label>Buying Price (₹)</label>')

# 3. Add classes to Edit Product inputs
content = content.replace('<div class="form-group">\n                        <label>Expiry Days (Optional)</label>', '<div class="form-group expiry-tracking-feature">\n                        <label>Expiry Days (Optional)</label>')

# Insert Buying Price into Edit Product
edit_price = """                    <div class="form-group">
                        <label>Unit Price (₹)</label>
                        <input type="number" id="editProductPrice" step="0.01" required>
                    </div>"""
edit_buying_price = """                    <div class="form-group">
                        <label>Unit Price (₹)</label>
                        <input type="number" id="editProductPrice" step="0.01" required>
                    </div>
                    <div class="form-group buying-price-feature">
                        <label>Buying Price (₹)</label>
                        <input type="number" id="editProductPurchasePrice" step="0.01" placeholder="0.00">
                    </div>"""
content = content.replace(edit_price, edit_buying_price)

# 4. Inventory Table headers
content = content.replace('<th style="padding: 10px;">Expiry Date</th>', '<th style="padding: 10px;" class="expiry-tracking-feature">Expiry Date</th>')

# Cost price th
cost_th = """<th style="padding: 10px; cursor: pointer;" onclick="sortPriceManager('costPrice')">
                                        Cost Price (₹) ↕</th>"""
cost_th_new = """<th style="padding: 10px; cursor: pointer;" class="admin-only buying-price-feature" onclick="sortPriceManager('costPrice')">
                                        Cost Price (₹) ↕</th>"""
content = content.replace(cost_th, cost_th_new)

# Inventory Table Filter
content = content.replace('<div style="display: flex; gap: 10px;">\n                        <select id="expiryFilter"', '<div style="display: flex; gap: 10px;" class="expiry-tracking-feature">\n                        <select id="expiryFilter"')

with open('final.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch script complete")
