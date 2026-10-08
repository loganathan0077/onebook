with open('OneBook.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_index = -1
for i, line in enumerate(lines):
    if '<div id="sales" class="tab-content">' in line:
        start_index = i
        break

if start_index != -1:
    depth = 0
    for i, line in enumerate(lines[start_index:]):
        depth += line.count('<div') - line.count('</div')
        if depth == 0:
            print(f"sales tab closes at line {start_index + i + 1}")
            break
