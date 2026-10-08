with open('OneBook.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "const kbPanel = document.getElementById('keyboardShortcutsPanel');" in line:
        if "isRecordSale" in ''.join(lines[max(0, i-5):i]):
            new_lines.append(line)
        else:
            skip = True
    elif skip:
        if "}" in line and "else" not in lines[i-1] and "kbPanel.style.display" not in line:
            # We skip until the block finishes.
            # wait, it's safer to just slice out the exact lines.
            pass
    if not skip:
        new_lines.append(line)

# Let's do it safely by just finding the exact text and replacing it.
