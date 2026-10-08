import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                const kbPanel = document.getElementById('keyboardShortcutsPanel');
                if (kbPanel) {
                    if (tabName === 'dashboard' || tabName === 'inventory' || tabName === 'sales') {
                        kbPanel.style.display = 'block';
                    } else {
                        kbPanel.style.display = 'none';
                    }
                }"""

content = content.replace(target, "")

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed duplicate!")
