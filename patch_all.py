import re
import os

files_to_patch = ['OneBook.html', 'final.html']

for filename in files_to_patch:
    if not os.path.exists(filename):
        continue
    with open(filename, 'r', encoding='utf-8') as f:
        html = f.read()

    # --- CATEGORY PATCH ---
    # Update Category Discount Modal HTML
    old_cat_modal = """            <div class="form-group">
                <label>Category <span style="color: red;">*</span></label>
                <select id="catDiscCategory" class="form-control" required></select>
            </div>
            <div class="form-group">
                <label>Default Discount (%) <span style="color: red;">*</span></label>
                <input type="number" id="catDiscPercent" class="form-control" min="0" max="100" step="0.01" placeholder="e.g. 10" required>
            </div>"""
    new_cat_modal = """            <div class="form-group">
                <label>Category <span style="color: red;">*</span></label>
                <select id="catDiscCategory" class="form-control" required></select>
            </div>
            <div class="form-group">
                <label>Discount Type</label>
                <select id="catDiscType" class="form-control" onchange="document.getElementById('catDiscValueLabel').innerText = this.value === 'percentage' ? 'Discount (%) *' : 'Discount (₹) *'">
                    <option value="percentage">Percentage (%)</option>
                    <option value="amount">Amount (₹)</option>
                </select>
            </div>
            <div class="form-group">
                <label id="catDiscValueLabel">Discount (%) <span style="color: red;">*</span></label>
                <input type="number" id="catDiscValue" class="form-control" min="0" step="0.01" placeholder="e.g. 10" required>
            </div>"""
    html = html.replace(old_cat_modal, new_cat_modal)

    # Update openCategoryDiscountModal
    old_open = """        function openCategoryDiscountModal(id = null) {
            const catSelect = document.getElementById('catDiscCategory');
            catSelect.innerHTML = masterCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            
            document.getElementById('editingCategoryDiscountId').value = id || '';
            const deleteBtn = document.getElementById('deleteCategoryDiscountBtn');
            
            if (id) {
                const cd = categoryDiscounts.find(c => c.id === id);
                if (cd) {
                    document.getElementById('categoryDiscountModalTitle').innerText = '✏️ Edit Category Discount';
                    catSelect.value = cd.category;
                    document.getElementById('catDiscPercent').value = cd.discount;
                    document.getElementById('catDiscStatus').value = cd.active ? 'active' : 'inactive';
                    if (deleteBtn) deleteBtn.style.display = 'block';
                }
            } else {
                document.getElementById('categoryDiscountModalTitle').innerText = '➕ Add Category Discount';
                document.getElementById('catDiscPercent').value = '';
                document.getElementById('catDiscStatus').value = 'active';
                if (deleteBtn) deleteBtn.style.display = 'none';
            }
            
            document.getElementById('categoryDiscountModal').style.display = 'flex';
        }"""
    new_open = """        function openCategoryDiscountModal(id = null) {
            const catSelect = document.getElementById('catDiscCategory');
            catSelect.innerHTML = masterCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            
            document.getElementById('editingCategoryDiscountId').value = id || '';
            const deleteBtn = document.getElementById('deleteCategoryDiscountBtn');
            
            if (id) {
                const cd = categoryDiscounts.find(c => c.id === id);
                if (cd) {
                    document.getElementById('categoryDiscountModalTitle').innerText = '✏️ Edit Category Discount';
                    catSelect.value = cd.category;
                    document.getElementById('catDiscType').value = cd.discountType || 'percentage';
                    document.getElementById('catDiscValue').value = cd.discountValue !== undefined ? cd.discountValue : cd.discount;
                    document.getElementById('catDiscStatus').value = cd.active ? 'active' : 'inactive';
                    document.getElementById('catDiscValueLabel').innerText = (cd.discountType || 'percentage') === 'percentage' ? 'Discount (%) *' : 'Discount (₹) *';
                    if (deleteBtn) deleteBtn.style.display = 'block';
                }
            } else {
                document.getElementById('categoryDiscountModalTitle').innerText = '➕ Add Category Discount';
                document.getElementById('catDiscType').value = 'percentage';
                document.getElementById('catDiscValue').value = '';
                document.getElementById('catDiscStatus').value = 'active';
                document.getElementById('catDiscValueLabel').innerText = 'Discount (%) *';
                if (deleteBtn) deleteBtn.style.display = 'none';
            }
            
            document.getElementById('categoryDiscountModal').style.display = 'flex';
        }"""
    html = html.replace(old_open, new_open)

    # Update saveCategoryDiscount
    old_save = """        function saveCategoryDiscount() {
            if (typeof window.isAdminUser !== 'undefined' && !window.isAdminUser) return showAlert('Unauthorized: Only Administrators can modify category discounts.', 'error');
            const id = document.getElementById('editingCategoryDiscountId').value;
            const category = document.getElementById('catDiscCategory').value;
            const discountPercent = parseFloat(document.getElementById('catDiscPercent').value);
            const status = document.getElementById('catDiscStatus').value === 'active';
            
            if (!category) {
                showAlert('Please select a category.', '⚠️');
                return;
            }
            if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
                showAlert('Discount must be a number between 0 and 100.', '⚠️');
                return;
            }
            
            if (id) {
                const cd = categoryDiscounts.find(c => c.id === id);
                if (cd) {
                    // Check if another config for same category exists
                    if (categoryDiscounts.some(c => c.category === category && c.id !== id)) {
                        showAlert('A discount configuration for this category already exists.', '⚠️');
                        return;
                    }
                    cd.category = category;
                    cd.discount = discountPercent;
                    cd.active = status;
                }
            } else {
                if (categoryDiscounts.some(c => c.category === category)) {
                    showAlert('A discount configuration for this category already exists.', '⚠️');
                    return;
                }
                categoryDiscounts.push({
                    id: 'cd_' + Math.random().toString(36).substr(2, 9),
                    category: category,
                    discount: discountPercent,
                    active: status
                });
            }
            
            localStorage.setItem('categoryDiscounts', JSON.stringify(categoryDiscounts));
            renderCategoryDiscounts();
            closeCategoryDiscountModal();
            showAlert('Category discount saved successfully!', '✅');
        }"""
    new_save = """        function saveCategoryDiscount() {
            if (typeof window.isAdminUser !== 'undefined' && !window.isAdminUser) return showAlert('Unauthorized: Only Administrators can modify category discounts.', 'error');
            const id = document.getElementById('editingCategoryDiscountId').value;
            const category = document.getElementById('catDiscCategory').value;
            const discountType = document.getElementById('catDiscType').value;
            const discountValue = parseFloat(document.getElementById('catDiscValue').value);
            const status = document.getElementById('catDiscStatus').value === 'active';
            
            if (!category) {
                showAlert('Please select a category.', '⚠️');
                return;
            }
            if (isNaN(discountValue) || discountValue < 0 || (discountType === 'percentage' && discountValue > 100)) {
                showAlert(discountType === 'percentage' ? 'Discount must be between 0 and 100.' : 'Discount must be a valid positive amount.', '⚠️');
                return;
            }
            
            if (id) {
                const cd = categoryDiscounts.find(c => c.id === id);
                if (cd) {
                    // Check if another config for same category exists
                    if (categoryDiscounts.some(c => c.category === category && c.id !== id)) {
                        showAlert('A discount configuration for this category already exists.', '⚠️');
                        return;
                    }
                    cd.category = category;
                    cd.discountType = discountType;
                    cd.discountValue = discountValue;
                    cd.discount = discountValue; // Backward compatibility
                    cd.active = status;
                }
            } else {
                if (categoryDiscounts.some(c => c.category === category)) {
                    showAlert('A discount configuration for this category already exists.', '⚠️');
                    return;
                }
                categoryDiscounts.push({
                    id: 'cd_' + Math.random().toString(36).substr(2, 9),
                    category: category,
                    discountType: discountType,
                    discountValue: discountValue,
                    discount: discountValue, // Backward compatibility
                    active: status
                });
            }
            
            localStorage.setItem('categoryDiscounts', JSON.stringify(categoryDiscounts));
            renderCategoryDiscounts();
            closeCategoryDiscountModal();
            showAlert('Category discount saved successfully!', '✅');
        }"""
    html = html.replace(old_save, new_save)

    old_render = """                    <tr>
                        <td>${c.category}</td>
                        <td style="text-align: center;">${c.discount}%</td>
                        <td style="text-align: center;">"""
    new_render = """                    <tr>
                        <td>${c.category}</td>
                        <td style="text-align: center;">${(c.discountType || 'percentage') === 'percentage' ? (c.discountValue !== undefined ? c.discountValue : c.discount) + '%' : '₹' + (c.discountValue !== undefined ? c.discountValue : c.discount)}</td>
                        <td style="text-align: center;">"""
    html = html.replace(old_render, new_render)

    # --- PRODUCT PATCH ---
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

    old_edit_product_lines = """            document.getElementById('editProductPurchasePrice').value = p.purchasePrice || '';
            document.getElementById('editProductDiscount').value = (p.discountPercent !== undefined && p.discountPercent !== null && p.discountPercent !== '') ? p.discountPercent : '';
            document.getElementById('editProductCategory').value = p.category || '';"""
    new_edit_product_lines = """            document.getElementById('editProductPurchasePrice').value = p.purchasePrice || '';
            document.getElementById('editProductDiscountType').value = p.discountType || 'percentage';
            document.getElementById('editProductDiscount').value = (p.discountValue !== undefined && p.discountValue !== null && p.discountValue !== '') ? p.discountValue : ((p.discountPercent !== undefined && p.discountPercent !== null && p.discountPercent !== '') ? p.discountPercent : '');
            document.getElementById('editProductDiscountLabel').innerHTML = (p.discountType || 'percentage') === 'percentage' ? 'Product Discount (%) — <small style=\\'color:#666; font-weight:normal;\\'>Overrides Category Discount</small>' : 'Product Discount (₹) — <small style=\\'color:#666; font-weight:normal;\\'>Overrides Category Discount</small>';
            document.getElementById('editProductCategory').value = p.category || '';"""
    html = html.replace(old_edit_product_lines, new_edit_product_lines)

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

    # --- CART ADD PATCH ---
    old_get_eff = """        function getEffectiveDiscount(product) {
            if (product.productDiscount !== undefined && product.productDiscount !== null && product.productDiscount !== "") {
                return parseFloat(product.productDiscount);
            }
            if (product.category) {
                const catDiscount = categoryDiscounts.find(c => c.category === product.category && c.active);
                if (catDiscount) {
                    return parseFloat(catDiscount.discount);
                }
            }
            return 0;
        }"""
    new_get_eff = """        function getEffectiveDiscount(product) {
            if (product.discountValue !== undefined && product.discountValue !== null && product.discountValue !== "") {
                return { type: product.discountType || 'percentage', value: parseFloat(product.discountValue) };
            }
            // Fallback for older data that might use discountPercent or productDiscount
            let oldProdVal = product.discountPercent !== undefined ? product.discountPercent : product.productDiscount;
            if (oldProdVal !== undefined && oldProdVal !== null && oldProdVal !== "") {
                return { type: 'percentage', value: parseFloat(oldProdVal) };
            }
            if (product.category) {
                const catDiscount = categoryDiscounts.find(c => c.category === product.category && c.active);
                if (catDiscount) {
                    if (catDiscount.discountValue !== undefined && catDiscount.discountValue !== null && catDiscount.discountValue !== "") {
                        return { type: catDiscount.discountType || 'percentage', value: parseFloat(catDiscount.discountValue) };
                    }
                    if (catDiscount.discount !== undefined && catDiscount.discount !== null && catDiscount.discount !== "") {
                        return { type: 'percentage', value: parseFloat(catDiscount.discount) };
                    }
                }
            }
            return { type: 'percentage', value: 0 };
        }"""
    html = html.replace(old_get_eff, new_get_eff)

    old_add_cart = """            if (existingItemIndex >= 0) {
                cart[existingItemIndex].quantity = parseFloat((cart[existingItemIndex].quantity + quantity).toFixed(3));
                cart[existingItemIndex].total = cart[existingItemIndex].quantity * unitPrice;
            } else {
                cart.push({
                    productId: productId,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: quantity,
                    baseQuantity: unitQuantity, // Store multiplier
                    discountPercent: getEffectiveDiscount(product),
                    total: quantity * unitPrice
                });
            }"""
    new_add_cart = """            if (existingItemIndex >= 0) {
                cart[existingItemIndex].quantity = parseFloat((cart[existingItemIndex].quantity + quantity).toFixed(3));
                cart[existingItemIndex].total = cart[existingItemIndex].quantity * unitPrice;
            } else {
                let effDisc = getEffectiveDiscount(product);
                cart.push({
                    productId: productId,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: quantity,
                    baseQuantity: unitQuantity, // Store multiplier
                    discountType: effDisc.type,
                    discountValue: effDisc.value,
                    discountPercent: effDisc.type === 'percentage' ? effDisc.value : 0, // Fallback placeholder
                    total: quantity * unitPrice
                });
            }"""
    html = html.replace(old_add_cart, new_add_cart)

    old_18193 = """                cart.push({
                    productId: product.id,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: 1,
                    baseQuantity: 1,
                    total: unitPrice
                });"""
    new_18193 = """                let effDisc = getEffectiveDiscount(product);
                cart.push({
                    productId: product.id,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: 1,
                    baseQuantity: 1,
                    discountType: effDisc.type,
                    discountValue: effDisc.value,
                    discountPercent: effDisc.type === 'percentage' ? effDisc.value : 0,
                    total: unitPrice
                });"""
    html = html.replace(old_18193, new_18193)

    old_18465 = """                cart.push({
                    productId: product.id,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: prec,
                    baseQuantity: 1,
                    total: unitPrice,
                    discountPercent: getEffectiveDiscount(product)
                });"""
    new_18465 = """                let effDisc = getEffectiveDiscount(product);
                cart.push({
                    productId: product.id,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: prec,
                    baseQuantity: 1,
                    total: unitPrice,
                    discountType: effDisc.type,
                    discountValue: effDisc.value,
                    discountPercent: effDisc.type === 'percentage' ? effDisc.value : 0
                });"""
    html = html.replace(old_18465, new_18465)


    # --- CART DISPLAY PATCH ---
    old_update_discount = """        function updateCartItemDiscount(index, value) {
            cart[index].discountPercent = parseFloat(value) || 0;
            updateCartDisplay();
        }"""
    new_update_discount = """        function updateCartItemDiscount(index, value) {
            let item = cart[index];
            let valStr = String(value).trim();
            let isPercentage = valStr.includes('%');
            let parsedVal = parseFloat(valStr.replace('%', ''));
            
            if (isNaN(parsedVal) || parsedVal < 0) {
                showAlert('Invalid discount value.', '⚠️');
                updateCartDisplay();
                return;
            }

            let gross = item.quantity * item.price;
            let amount = isPercentage ? gross * (parsedVal / 100) : parsedVal;

            if (amount > gross) {
                showAlert('Discount cannot be greater than the item amount.', '⚠️');
                updateCartDisplay(); // reset input
                return;
            }

            item.discountType = isPercentage ? 'percentage' : 'amount';
            item.discountValue = parsedVal;
            item.discountPercent = isPercentage ? parsedVal : 0; // backward compat
            updateCartDisplay();
        }"""
    html = html.replace(old_update_discount, new_update_discount)

    old_cart_calc = """                item.discountPercent = item.discountPercent || 0;
                let grossAmount = item.quantity * item.price;
                let itemDiscountAmount = grossAmount * (item.discountPercent / 100);
                let netInclusive = grossAmount - itemDiscountAmount;"""
    new_cart_calc = """                let grossAmount = item.quantity * item.price;
                let itemDiscountAmount = 0;
                let dType = item.discountType || 'percentage';
                let dVal = item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0);

                if (dType === 'percentage') {
                    itemDiscountAmount = grossAmount * (dVal / 100);
                } else {
                    itemDiscountAmount = dVal;
                }
                
                // Ensure no negative totals (fallback protection)
                if (itemDiscountAmount > grossAmount) itemDiscountAmount = grossAmount;

                let netInclusive = grossAmount - itemDiscountAmount;"""
    html = html.replace(old_cart_calc, new_cart_calc)

    old_th = """                                    <th>Rate</th>
                                    <th>Disc %</th>
                                    <th>Amount</th>"""
    new_th = """                                    <th>Rate</th>
                                    <th>Discount</th>
                                    <th>Amount</th>"""
    html = html.replace(old_th, new_th)

    old_td = """                                        <td><input type="number" value="${item.discountPercent || 0}" min="0" max="100" style="width:55px; padding:2px;" onchange="updateCartItemDiscount(${index}, this.value)"></td>"""
    new_td = """                                        <td>
                                            <input type="text" value="${(item.discountType || 'percentage') === 'percentage' ? (item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0)) + '%' : (item.discountValue || 0)}" style="width:65px; padding:2px; text-align:center;" onchange="updateCartItemDiscount(${index}, this.value)">
                                        </td>"""
    html = html.replace(old_td, new_td)


    # --- CHECKOUT PATCH ---
    old_checkout = """                            itemDiscount: item.discount || 0,
                            discountPercent: item.discountPercent || 0,
                            gstRate: item.gstRate || 0,"""
    new_checkout = """                            itemDiscount: item.discount || 0,
                            discountType: item.discountType || 'percentage',
                            discountValue: item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0),
                            discountPercent: item.discountPercent || 0,
                            gstRate: item.gstRate || 0,"""
    html = html.replace(old_checkout, new_checkout)


    # --- INVOICE PATCH ---
    old_invoice_th = """                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Disc %</th>"""
    new_invoice_th = """                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Discount</th>"""
    html = html.replace(old_invoice_th, new_invoice_th)

    old_invoice_row = """                    const discPerc = item.discountPercent ? `${item.discountPercent}%` : '0%';"""
    new_invoice_row = """                    let discPerc = '0';
                    if ((item.discountType || 'percentage') === 'percentage') {
                        discPerc = (item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0)) + '%';
                    } else {
                        discPerc = '₹' + (item.discountValue || 0);
                    }"""
    html = html.replace(old_invoice_row, new_invoice_row)

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(html)
