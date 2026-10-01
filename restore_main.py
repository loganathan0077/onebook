import re

file_path = '/Users/log/onebook/main.js'

with open(file_path, 'r', encoding='utf8') as f:
    content = f.read()

# Replace:
#    const mode = checkLicense();
#    // In both LICENSED and DEMO modes, we load OneBook.html
#    win.loadFile('OneBook.html');
# With conditional loading.

target = """    const mode = checkLicense();
    // In both LICENSED and DEMO modes, we load OneBook.html
    win.loadFile('OneBook.html');"""

replacement = """    const mode = checkLicense();
    if (mode === 'DEMO') {
        win.loadFile('license.html');
    } else {
        win.loadFile('OneBook.html');
    }"""

content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf8') as f:
    f.write(content)
