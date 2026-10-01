import re
with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'let _isDemo = false;.*?function isDemoMode\(\).*?}', content, flags=re.DOTALL)
if m:
    print(m.group(0))
else:
    for line in content.split('\n'):
        if 'isDemoMode' in line:
            print(line.strip())
