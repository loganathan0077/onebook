import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

original_switch = """        function proceedWithDatabaseSwitch() {
            if (pendingDatabaseFolder) {
                localStorage.setItem('database_folder', pendingDatabaseFolder);
                window.location.reload();
            }
        }"""

new_switch = """        function proceedWithDatabaseSwitch() {
            if (pendingDatabaseFolder) {
                localStorage.setItem('database_folder', pendingDatabaseFolder);
                if (window.electronAPI && window.electronAPI.setDbConfigSync) {
                    window.electronAPI.setDbConfigSync(pendingDatabaseFolder);
                }
                window.location.reload();
            }
        }"""

html = html.replace(original_switch, new_switch)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
