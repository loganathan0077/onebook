import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines[4440:4465]):
    print(f"{4441+i}: {line.rstrip()}")
