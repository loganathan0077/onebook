import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    # Find the end of clearCart inside the callback
    old_code = r"(console\.log\('Cart cleared successfully'\);)"
    new_code = r"\1\n                if (typeof resetSaleDateToToday === 'function') resetSaleDateToToday();"
    
    content = re.sub(old_code, new_code, content)

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

