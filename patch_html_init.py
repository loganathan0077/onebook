import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

original_init = """                // Ensure a database folder is selected
                let folder = localStorage.getItem('database_folder');
                if (!folder) {
                    folder = window.electronAPI.selectDirectorySync();
                    if (folder) {
                        localStorage.setItem('database_folder', folder);
                    } else {
                        alert('CRITICAL ERROR: You must select a folder to save your database! Please restart the application.');
                    }
                }"""

new_init = """                // Refactored Database Location Logic (Persistent Config First)
                let folder = null;
                
                // 1. Try to get persistent config
                if (window.electronAPI.getDbConfigSync) {
                    folder = window.electronAPI.getDbConfigSync();
                }
                
                // 2. If no persistent config, use default Documents path
                if (!folder) {
                    folder = window.electronAPI.getDefaultDbFolderSync();
                    window.electronAPI.ensureFolderSync(folder);
                    window.electronAPI.setDbConfigSync(folder);
                }

                // 3. Fallback check (should ideally never hit unless permission errors)
                if (!folder) {
                    // Try localStorage as a last resort
                    folder = localStorage.getItem('database_folder');
                    if (!folder) {
                        folder = window.electronAPI.selectDirectorySync();
                    }
                }

                // 4. Save to localStorage for synchronous frontend access and persistent config
                if (folder) {
                    localStorage.setItem('database_folder', folder);
                    if (window.electronAPI.setDbConfigSync) {
                        window.electronAPI.setDbConfigSync(folder);
                    }
                } else {
                    alert('CRITICAL ERROR: Unable to determine or create database folder. Please restart or check permissions.');
                }"""

html = html.replace(original_init, new_init)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
