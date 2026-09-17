import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject First Run HTML Modal
html_to_inject = """
    <!-- First Run Setup Modal -->
    <div id="firstRunModal" class="modal" style="z-index: 999999; display: none; background-color: rgba(0,0,0,0.9);">
        <div class="modal-content" style="max-width: 500px; text-align: center; padding: 40px 20px;">
            <img src="onebooklogo.png" alt="OneBook" style="height: 80px; margin-bottom: 20px;" onerror="this.style.display='none'">
            <h1 style="margin: 0 0 10px 0; font-size: 28px; color: #333;">Welcome to OneBook</h1>
            <p style="color: #666; margin: 0 0 30px 0; font-size: 16px;">Select your Business Data Location to get started.</p>
            <button class="btn btn-primary" style="font-size: 18px; padding: 12px 24px; width: 100%; max-width: 300px; border-radius: 8px;" onclick="handleFirstRunSelectFolder()">📁 Choose Folder</button>
        </div>
    </div>
"""
content = content.replace('<!-- Database Location Preview Modal -->', html_to_inject + '\n    <!-- Database Location Preview Modal -->')

# 2. Update initOfflineDatabase Javascript logic
js_original = """        (function initOfflineDatabase() {
            if (window.electronAPI) {
                // Ensure a database folder is selected
                let folder = localStorage.getItem('database_folder');
                if (!folder) {
                    folder = window.electronAPI.selectDirectorySync();
                    if (folder) {
                        localStorage.setItem('database_folder', folder);
                    }
                }"""

js_new = """        window.handleFirstRunSelectFolder = function() {
            const folder = window.electronAPI.selectDirectorySync();
            if (folder) {
                // Check if it has data
                const pData = window.electronAPI.loadDataSync({ folder, key: 'products' });
                if (pData) {
                    // It has data!
                    if (confirm(`OneBook database detected in this folder!\\n\\nDo you want to use this existing database?`)) {
                        localStorage.setItem('database_folder', folder);
                        window.location.reload();
                    }
                } else {
                    if (confirm(`No OneBook database found.\\n\\nCreate a new database here?`)) {
                        localStorage.setItem('database_folder', folder);
                        window.location.reload();
                    }
                }
            }
        };

        (function initOfflineDatabase() {
            if (window.electronAPI) {
                // Ensure a database folder is selected
                let folder = localStorage.getItem('database_folder');
                if (!folder) {
                    window.addEventListener('DOMContentLoaded', () => {
                        const m = document.getElementById('firstRunModal');
                        if (m) m.style.display = 'flex';
                    });
                    // Pause other logic if no folder is selected
                    // Since it requires a folder, we just wait for the user.
                }"""

content = content.replace(js_original, js_new)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
with open('final.html', 'w', encoding='utf-8') as f:
    f.write(content)
