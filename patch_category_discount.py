import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

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

# Update renderCategoryDiscounts
old_render = """                    <tr>
                        <td>${c.category}</td>
                        <td style="text-align: center;">${c.discount}%</td>
                        <td style="text-align: center;">"""
new_render = """                    <tr>
                        <td>${c.category}</td>
                        <td style="text-align: center;">${(c.discountType || 'percentage') === 'percentage' ? (c.discountValue !== undefined ? c.discountValue : c.discount) + '%' : '₹' + (c.discountValue !== undefined ? c.discountValue : c.discount)}</td>
                        <td style="text-align: center;">"""
html = html.replace(old_render, new_render)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
