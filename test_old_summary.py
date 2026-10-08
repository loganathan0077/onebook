with open('old_summary.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

depth = 0
for i, line in enumerate(lines):
    depth += line.count('<div') - line.count('</div')

print(f"Final depth: {depth}")
