import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()
    
    # 6. completeSale Logic fix
    # We replace: const saleDate = new Date().toISOString();
    date_logic_old = r'const saleDate = new Date\(\)\.toISOString\(\);'
    date_logic_new = """let saleDate = new Date().toISOString();
                const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
                if (settings.enableSalesDate) {
                    if (typeof isDemoMode === 'function' && isDemoMode()) {
                        // Demo Mode forces system date
                    } else {
                        const customDateVal = document.getElementById('customSaleDate') ? document.getElementById('customSaleDate').value : '';
                        if (customDateVal) {
                            // Use custom date but preserve current time for ordering
                            const now = new Date();
                            const timePart = now.toISOString().split('T')[1];
                            saleDate = `${customDateVal}T${timePart}`;
                        }
                    }
                }"""
    content = re.sub(date_logic_old, date_logic_new, content)

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

