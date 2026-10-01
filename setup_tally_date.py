import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    # 1. Update HTML UI for customSaleDateContainer
    old_date_html = r'<div id="customSaleDateContainer" style="display: none; background: #fff; padding: 5px 15px; border-radius: 8px; border: 1px solid #ced4da; box-shadow: inset 0 1px 2px rgba\(0,0,0,0\.075\);">\s*<span style="font-weight: bold; font-size: 14px; color: #495057; display: block; margin-bottom: 2px;">📅 Sale Date <small style="font-weight:normal;color:#6c757d">\(Ctrl\+D\)</small></span>\s*<input type="date" id="customSaleDate" style="border: none; outline: none; font-size: 16px; font-weight: bold; color: #212529; background: transparent; padding: 0;">\s*</div>'
    new_date_html = """<div id="customSaleDateContainer" style="display: none; background: #fff; padding: 5px 15px; border-radius: 8px; border: 1px solid #ced4da; box-shadow: inset 0 1px 2px rgba(0,0,0,0.075);">
                            <span style="font-weight: bold; font-size: 14px; color: #495057; display: block; margin-bottom: 2px;">📅 Sale Date <small style="font-weight:normal;color:#6c757d">(Ctrl+D)</small></span>
                            <div style="display: flex; align-items: center; position: relative;">
                                <input type="text" id="customSaleDate" placeholder="DD/MM/YYYY" autocomplete="off" inputmode="numeric" style="border: none; outline: none; font-size: 16px; font-weight: bold; color: #212529; background: transparent; padding: 0; width: 110px;" onblur="normalizeSaleDateInput(this)" onkeydown="if(event.key === 'Enter') normalizeSaleDateInput(this)">
                                <span style="cursor: pointer; font-size: 16px; margin-left: 5px;" onclick="document.getElementById('nativeSalePicker').showPicker()">📅</span>
                                <input type="date" id="nativeSalePicker" style="position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;" onchange="handleNativePickerChange(this)">
                            </div>
                        </div>"""
    content = re.sub(old_date_html, new_date_html, content, count=1)

    # 2. Inject Utility JS Functions
    utils_js = """
        function normalizeSaleDate(input) {
            if (!input) return { valid: false };
            input = input.trim().replace(/\s+/g, '');
            let d, m, y;
            if (/^\d{8}$/.test(input)) {
                d = input.substring(0, 2);
                m = input.substring(2, 4);
                y = input.substring(4, 8);
            } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(input)) {
                const parts = input.split(/[/-]/);
                d = parts[0].padStart(2, '0');
                m = parts[1].padStart(2, '0');
                y = parts[2];
            } else {
                return { valid: false };
            }

            const day = parseInt(d, 10);
            const month = parseInt(m, 10);
            const year = parseInt(y, 10);
            
            const dateObj = new Date(year, month - 1, day);
            if (dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day) {
                return {
                    valid: true,
                    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                    display: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
                };
            }
            return { valid: false };
        }

        function normalizeSaleDateInput(el) {
            if (typeof isDemoMode === 'function' && isDemoMode()) return;
            if (!el.value) return;
            const res = normalizeSaleDate(el.value);
            if (res.valid) {
                el.value = res.display;
                el.dataset.isoDate = res.iso;
            } else {
                showAlert('Invalid date. Please enter a valid date in DDMMYYYY format.', '⚠️');
                resetSaleDateToToday();
            }
        }

        function handleNativePickerChange(el) {
            if (typeof isDemoMode === 'function' && isDemoMode()) return;
            if (el.value) {
                const parts = el.value.split('-');
                const display = `${parts[2]}/${parts[1]}/${parts[0]}`;
                const textInput = document.getElementById('customSaleDate');
                if (textInput) {
                    textInput.value = display;
                    textInput.dataset.isoDate = el.value;
                }
            }
        }

        function resetSaleDateToToday() {
            const el = document.getElementById('customSaleDate');
            if (el) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                el.value = `${day}/${month}/${year}`;
                el.dataset.isoDate = `${year}-${month}-${day}`;
            }
        }
        
        // Add to window load so it gets evaluated immediately and overrides any cached values
        window.addEventListener('DOMContentLoaded', resetSaleDateToToday);

        function completeSale() {"""
        
    content = content.replace("        function completeSale() {", utils_js, 1)

    # 3. Update completeSale saleDate mapping
    # Look for: const customDateVal = document.getElementById('customSaleDate') ? document.getElementById('customSaleDate').value : '';
    old_mapping = r"const customDateVal = document\.getElementById\('customSaleDate'\) \? document\.getElementById\('customSaleDate'\)\.value : '';"
    new_mapping = r"const customDateVal = document.getElementById('customSaleDate') ? document.getElementById('customSaleDate').dataset.isoDate : '';"
    content = re.sub(old_mapping, new_mapping, content)

    # 4. Reset date on Complete Sale (Success Path)
    # Find: localStorage.setItem('sales', JSON.stringify(sales));
    old_success = r"(localStorage\.setItem\('sales', JSON\.stringify\(sales\)\);)"
    new_success = r"\1\n                if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();"
    content = re.sub(old_success, new_success, content)

    # 5. Update clearCart to reset date
    old_clear = r"(function clearCart\(\) \{\n\s*cart = \[\];\n\s*localStorage\.removeItem\('currentCart'\);)"
    new_clear = r"\1\n            if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();"
    content = re.sub(old_clear, new_clear, content)

    # 6. Update loadSettings to use resetSaleDateToToday instead of static initial injection
    old_load_settings = r"if\(document\.getElementById\('customSaleDate'\) && !document\.getElementById\('customSaleDate'\)\.value\) \{\n\s*document\.getElementById\('customSaleDate'\)\.value = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);\n\s*\}"
    new_load_settings = r"if(typeof resetSaleDateToToday === 'function') resetSaleDateToToday();"
    content = re.sub(old_load_settings, new_load_settings, content)
    
    # 7. Update Ctrl+D shortcut behavior
    # We replace: if (typeof dateInput.showPicker === 'function') { ... }
    old_shortcut = r"if \(typeof dateInput\.showPicker === 'function'\) \{\n\s*try \{ dateInput\.showPicker\(\); \} catch\(err\) \{\}\n\s*\}"
    new_shortcut = r"setTimeout(() => dateInput.select(), 10);"
    content = re.sub(old_shortcut, new_shortcut, content)

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

