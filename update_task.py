import re

with open('/Users/log/.gemini/antigravity-ide/brain/6ca0b354-140f-4833-8af2-5d3046ae84ea/task.md', 'r') as f:
    text = f.read()

text = text.replace('- `[ ]` Update `main.js`', '- `[x]` Update `main.js`')
text = text.replace('- `[ ]` Update `preload.js`', '- `[x]` Update `preload.js`')
text = text.replace('- `[ ]` Refactor `initOfflineDatabase` in `OneBook.html`', '- `[x]` Refactor `initOfflineDatabase` in `OneBook.html`')
text = text.replace('- `[ ]` Update `handleChangeDatabaseLocation` in `OneBook.html`', '- `[x]` Update `handleChangeDatabaseLocation` in `OneBook.html`')
text = text.replace('- `[ ]` Verify new behavior.', '- `[x]` Verify new behavior.')

with open('/Users/log/.gemini/antigravity-ide/brain/6ca0b354-140f-4833-8af2-5d3046ae84ea/task.md', 'w') as f:
    f.write(text)
