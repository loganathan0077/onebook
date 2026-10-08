with open('old_bottom.html', 'r', encoding='utf-8') as f:
    old_html = f.read()

with open('new_bottom.html', 'r', encoding='utf-8') as f:
    new_html = f.read()

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

if old_html in content:
    content = content.replace(old_html, new_html)
    with open('OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully replaced the bottom section with the new 4-column layout!")
else:
    print("Error: Could not find old_bottom.html in OneBook.html!")
