import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    # Find toggleSetting function and inject the DOM update
    toggle_setting_old = r'(if \(setting === \'quickSaleBarcode\'\) \{)'
    toggle_setting_new = """if (setting === 'enableSalesDate') {
                const saleDateContainer = document.getElementById('customSaleDateContainer');
                if(saleDateContainer) saleDateContainer.style.display = value ? 'block' : 'none';
            }
            
            \\1"""
    content = re.sub(toggle_setting_old, toggle_setting_new, content)

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')
