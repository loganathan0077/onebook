import re

def fix_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 1. Fix editId
        old_edit = """            const editId = document.getElementById('customerEditId').value;
            if (!editId && isDemoMode() && !canCreateDemoCustomer()) {
                showDemoLimitMessage('customers');
                return;
            }
            const editId = document.getElementById('customerEditId').value;"""
        new_edit = """            const editId = document.getElementById('customerEditId').value;
            if (!editId && isDemoMode() && !canCreateDemoCustomer()) {
                showDemoLimitMessage('customers');
                return;
            }"""
        content = content.replace(old_edit, new_edit)
        
        # 2. Fix line 21444 single quote issue
        old_btn = "window.location.href='license.html'"
        new_btn = 'window.location.href="license.html"'
        content = content.replace(old_btn, new_btn)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {file_path}")
    except FileNotFoundError:
        pass

fix_file('/Users/log/onebook/OneBook.html')
fix_file('/Users/log/onebook/final.html')
