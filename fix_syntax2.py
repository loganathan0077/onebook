import re

file_path = '/Users/log/onebook/OneBook.html'

with open(file_path, 'r', encoding='utf8') as f:
    content = f.read()

# Fix the header Activate License button (line 1797)
content = content.replace("window.location.href=\\'license.html\\'", "window.location.href='license.html'")

with open(file_path, 'w', encoding='utf8') as f:
    f.write(content)
