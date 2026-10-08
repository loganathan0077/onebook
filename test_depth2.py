with open('OneBook.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '<div class="content"' in line:
        start = i
        break

depth = 0
for i in range(start, start + 3000):
    line = lines[i]
    depth += line.count('<div') - line.count('</div')
    if 'id="keyboardShortcutsPanel"' in line:
        print(f"Keyboard Shortcuts is at depth {depth}")
    if 'id="reports"' in line:
        print(f"Reports is at depth {depth}")
