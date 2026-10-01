import re
with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'function checkLicense.*?}', content, flags=re.DOTALL)
if m:
    print(m.group(0))
else:
    print("Not found checkLicense")
