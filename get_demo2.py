import re
with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'function isDemoMode\(\).*?}', content, flags=re.DOTALL)
if m:
    print(m.group(0))
