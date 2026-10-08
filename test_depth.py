with open('OneBook.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '<div id="sales" class="tab-content">' in line:
        start = i
        break

depth = 0
for i in range(start, start + 300):
    line = lines[i]
    depth += line.count('<div') - line.count('</div')
    if depth == 0:
        print(f"Depth became 0 at line {i+1}!! Content: {line.strip()}")
