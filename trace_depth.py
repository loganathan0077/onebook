with open('OneBook.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start = -1
for i, line in enumerate(lines):
    if '<div id="sales" class="tab-content">' in line:
        start = i
        break

depth = 0
for i in range(start, start + 500):
    line = lines[i]
    depth += line.count('<div') - line.count('</div')
    if 'id="keyboardShortcutsPanel"' in line:
        print(f"Line {i}: Keyboard Shortcuts found at depth {depth}")
    if '<!-- Reports Tab -->' in line:
        print(f"Line {i}: Reports Tab found at depth {depth}")
    if depth <= 0:
        print(f"Line {i}: Depth reached {depth}! Line content: {line.strip()}")
        break
