with open('OneBook.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    
div_count = 0
for i, line in enumerate(lines[2269:2615]):
    div_count += line.count('<div') - line.count('</div')
    if div_count == 0:
        print(f"Line {2270+i}: depth 0")
