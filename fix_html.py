import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('onclick="window.location.href="license.html";"', "onclick=\"window.location.href='license.html';\"")
content = content.replace('onclick="window.location.href="license.html""', "onclick=\"window.location.href='license.html'\"")

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
