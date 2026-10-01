import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    # 1. Add isFutureDate utility
    utils_js = """        function isFutureDate(isoString) {
            if (!isoString) return false;
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayIso = `${year}-${month}-${day}`;
            return isoString > todayIso;
        }

        function normalizeSaleDate(input) {"""
    content = content.replace("        function normalizeSaleDate(input) {", utils_js, 1)

    # 2. Update normalizeSaleDateInput
    old_normalize = r"(const res = normalizeSaleDate\(el\.value\);\n\s*if \(res\.valid\) \{)\n\s*el\.value = res\.display;\n\s*el\.dataset\.isoDate = res\.iso;"
    new_normalize = r"\1\n                if (typeof isFutureDate === 'function' && isFutureDate(res.iso)) {\n                    showAlert('Future dates are not allowed. Please enter today or a previous date.', '⚠️');\n                    resetSaleDateToToday();\n                } else {\n                    el.value = res.display;\n                    el.dataset.isoDate = res.iso;\n                }"
    content = re.sub(old_normalize, new_normalize, content, count=1)

    # 3. Update handleNativePickerChange
    old_picker = r"(function handleNativePickerChange\(el\) \{\n\s*if \(typeof isDemoMode === 'function' && isDemoMode\(\)\) return;\n\s*if \(el\.value\) \{)"
    new_picker = r"\1\n                if (typeof isFutureDate === 'function' && isFutureDate(el.value)) {\n                    showAlert('Future dates are not allowed. Please enter today or a previous date.', '⚠️');\n                    resetSaleDateToToday();\n                    return;\n                }"
    content = re.sub(old_picker, new_picker, content, count=1)

    # 4. Inject validation before showConfirm in completeSale()
    old_confirm = r"(// Confirm Completion\n\s*showConfirm\(`Complete sale for)"
    new_confirm = r"""const _settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            if (_settings.enableSalesDate && !(typeof isDemoMode === 'function' && isDemoMode())) {
                const _customDateVal = document.getElementById('customSaleDate') ? document.getElementById('customSaleDate').dataset.isoDate : '';
                if (_customDateVal && typeof isFutureDate === 'function' && isFutureDate(_customDateVal)) {
                    showAlert('Future dates are not allowed. Please enter today or a previous date.', '⚠️');
                    if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();
                    return;
                }
            }

            \1"""
    content = re.sub(old_confirm, new_confirm, content, count=1)

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

