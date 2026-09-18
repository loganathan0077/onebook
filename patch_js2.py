import re

with open('final.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Populate editProductPurchasePrice in editProduct
edit_product_target = """            document.getElementById('editProductBarcode').value = product.barcode || '';
            document.getElementById('editProductName').value = product.name;"""
edit_product_replacement = """            document.getElementById('editProductBarcode').value = product.barcode || '';
            document.getElementById('editProductName').value = product.name;
            const editPurchasePrice = document.getElementById('editProductPurchasePrice');
            if(editPurchasePrice) editPurchasePrice.value = product.costPrice || '';"""
content = content.replace(edit_product_target, edit_product_replacement)

# 2. Save editProductPurchasePrice in saveEditProduct
save_edit_product_target = """            const newStock = parseInt(document.getElementById('editProductStock').value) || 0;
            const newMinStock = parseInt(document.getElementById('editProductMinStock').value) || 0;
            const newExpiry = document.getElementById('editProductExpiryDays').value;"""
save_edit_product_replacement = """            const newStock = parseInt(document.getElementById('editProductStock').value) || 0;
            const newMinStock = parseInt(document.getElementById('editProductMinStock').value) || 0;
            const newExpiry = document.getElementById('editProductExpiryDays').value;
            const editPurchasePriceEl = document.getElementById('editProductPurchasePrice');
            const newPurchasePrice = editPurchasePriceEl ? (parseFloat(editPurchasePriceEl.value) || 0) : 0;"""
content = content.replace(save_edit_product_target, save_edit_product_replacement)

# Assign it in saveEditProduct
assign_cost_target = """            product.stock = newStock;
            product.minStock = newMinStock;
            product.supplier = document.getElementById('editProductSupplier').value;"""
assign_cost_replacement = """            product.stock = newStock;
            product.minStock = newMinStock;
            product.costPrice = newPurchasePrice || product.costPrice;
            product.supplier = document.getElementById('editProductSupplier').value;"""
content = content.replace(assign_cost_target, assign_cost_replacement)

# 3. Inventory Stock Status handling logic (Expiry status)
status_logic_target = """                if (product.expiryDays && product.dateAdded) {
                    const addDate = new Date(product.dateAdded);
                    const expDate = new Date(addDate.getTime() + (product.expiryDays * 24 * 60 * 60 * 1000));
                    const now = new Date();
                    const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

                    if (daysLeft < 0) {
                        statusHtml = '<span class="status-badge status-expired">🔴 Expired</span>';
                    } else if (daysLeft <= 30) {
                        statusHtml = `<span class="status-badge status-warning">🟠 Expiring (${daysLeft}d)</span>`;
                    }
                }"""
status_logic_replacement = """                const settings = JSON.parse(localStorage.getItem('settings') || 'null') || {};
                const expiryTracking = settings.expiryTracking !== undefined ? settings.expiryTracking : false;
                
                if (expiryTracking && product.expiryDays && product.dateAdded) {
                    const addDate = new Date(product.dateAdded);
                    const expDate = new Date(addDate.getTime() + (product.expiryDays * 24 * 60 * 60 * 1000));
                    const now = new Date();
                    const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

                    if (daysLeft < 0) {
                        statusHtml = '<span class="status-badge status-expired">🔴 Expired</span>';
                    } else if (daysLeft <= 30) {
                        statusHtml = `<span class="status-badge status-warning">🟠 Expiring (${daysLeft}d)</span>`;
                    }
                }"""
content = content.replace(status_logic_target, status_logic_replacement)

# 4. Expiry table cell
expiry_td_target = """<td style="padding: 10px;">${expiryStr}</td>"""
expiry_td_replacement = """<td style="padding: 10px;" class="expiry-tracking-feature">${expiryStr}</td>"""
content = content.replace(expiry_td_target, expiry_td_replacement)

with open('final.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("JS patching part 2 complete")
