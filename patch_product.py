import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update Edit Product UI
old_product_ui = """                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label>Product Discount (%) — <small style="color:#666; font-weight:normal;">Overrides Category Discount</small></label>
                        <input type="number" id="editProductDiscount" step="0.1" min="0" max="100" placeholder="e.g. 5 (Leave blank for category default)">
                    </div>"""

new_product_ui = """                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label id="editProductDiscountLabel">Product Discount (%) — <small style="color:#666; font-weight:normal;">Overrides Category Discount</small></label>
                        <div style="display: flex; gap: 10px;">
                            <select id="editProductDiscountType" class="form-control" style="width: auto;" onchange="document.getElementById('editProductDiscountLabel').innerHTML = this.value === 'percentage' ? 'Product Discount (%) — <small style=\\'color:#666; font-weight:normal;\\'>Overrides Category Discount</small>' : 'Product Discount (₹) — <small style=\\'color:#666; font-weight:normal;\\'>Overrides Category Discount</small>'">
                                <option value="percentage">Percentage (%)</option>
                                <option value="amount">Amount (₹)</option>
                            </select>
                            <input type="number" id="editProductDiscount" step="0.01" min="0" placeholder="e.g. 5 (Leave blank for category default)" style="flex: 1;">
                        </div>
                    </div>"""
html = html.replace(old_product_ui, new_product_ui)

# 2. Update editProduct JS function to load the discountType
old_edit_product_lines = """            document.getElementById('editProductPurchasePrice').value = p.purchasePrice || '';
            document.getElementById('editProductDiscount').value = (p.discountPercent !== undefined && p.discountPercent !== null && p.discountPercent !== '') ? p.discountPercent : '';
            document.getElementById('editProductCategory').value = p.category || '';"""

new_edit_product_lines = """            document.getElementById('editProductPurchasePrice').value = p.purchasePrice || '';
            document.getElementById('editProductDiscountType').value = p.discountType || 'percentage';
            document.getElementById('editProductDiscount').value = (p.discountValue !== undefined && p.discountValue !== null && p.discountValue !== '') ? p.discountValue : ((p.discountPercent !== undefined && p.discountPercent !== null && p.discountPercent !== '') ? p.discountPercent : '');
            document.getElementById('editProductDiscountLabel').innerHTML = (p.discountType || 'percentage') === 'percentage' ? 'Product Discount (%) — <small style=\\'color:#666; font-weight:normal;\\'>Overrides Category Discount</small>' : 'Product Discount (₹) — <small style=\\'color:#666; font-weight:normal;\\'>Overrides Category Discount</small>';
            document.getElementById('editProductCategory').value = p.category || '';"""

html = html.replace(old_edit_product_lines, new_edit_product_lines)

# 3. Update saveProduct JS function to save the discountType
old_save_product_disc = """        function saveProduct() {
            if (typeof window.isAdminUser !== 'undefined' && !window.isAdminUser) return showAlert('Unauthorized: Only Administrators can modify products.', 'error');
            const id = document.getElementById('editProductId').value;
            const b = document.getElementById('editProductBarcode').value.trim();
            const n = document.getElementById('editProductName').value.trim();
            const p = parseFloat(document.getElementById('editProductPrice').value);
            const pp = parseFloat(document.getElementById('editProductPurchasePrice').value);
            const dp = document.getElementById('editProductDiscount').value;
            const c = document.getElementById('editProductCategory').value;"""

new_save_product_disc = """        function saveProduct() {
            if (typeof window.isAdminUser !== 'undefined' && !window.isAdminUser) return showAlert('Unauthorized: Only Administrators can modify products.', 'error');
            const id = document.getElementById('editProductId').value;
            const b = document.getElementById('editProductBarcode').value.trim();
            const n = document.getElementById('editProductName').value.trim();
            const p = parseFloat(document.getElementById('editProductPrice').value);
            const pp = parseFloat(document.getElementById('editProductPurchasePrice').value);
            const dt = document.getElementById('editProductDiscountType').value;
            const dp = document.getElementById('editProductDiscount').value;
            const c = document.getElementById('editProductCategory').value;"""

html = html.replace(old_save_product_disc, new_save_product_disc)

old_save_product_assign = """            if (p < 0) { showAlert('Unit Price cannot be negative.', 'error'); return; }
            if (!isNaN(pp) && pp < 0) { showAlert('Buying Price cannot be negative.', 'error'); return; }

            const parsedDp = dp === '' ? null : parseFloat(dp);
            if (parsedDp !== null && (isNaN(parsedDp) || parsedDp < 0 || parsedDp > 100)) {
                showAlert('Discount must be between 0 and 100.', 'error');
                return;
            }"""

new_save_product_assign = """            if (p < 0) { showAlert('Unit Price cannot be negative.', 'error'); return; }
            if (!isNaN(pp) && pp < 0) { showAlert('Buying Price cannot be negative.', 'error'); return; }

            const parsedDp = dp === '' ? null : parseFloat(dp);
            if (parsedDp !== null) {
                if (isNaN(parsedDp) || parsedDp < 0) {
                    showAlert('Discount must be a positive number.', 'error');
                    return;
                }
                if (dt === 'percentage' && parsedDp > 100) {
                    showAlert('Percentage discount cannot exceed 100%.', 'error');
                    return;
                }
            }"""

html = html.replace(old_save_product_assign, new_save_product_assign)

old_save_product_obj = """                prod.name = n;
                prod.price = p;
                prod.purchasePrice = isNaN(pp) ? null : pp;
                prod.discountPercent = parsedDp;
                prod.category = c;"""

new_save_product_obj = """                prod.name = n;
                prod.price = p;
                prod.purchasePrice = isNaN(pp) ? null : pp;
                prod.discountType = parsedDp !== null ? dt : null;
                prod.discountValue = parsedDp;
                prod.discountPercent = parsedDp; // Fallback
                prod.category = c;"""

html = html.replace(old_save_product_obj, new_save_product_obj)


with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
