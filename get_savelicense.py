import re
with open('/Users/log/onebook/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'ipcMain.on\(\'save-license-sync\'.*?\);', content, flags=re.DOTALL)
if m:
    print(m.group(0))
