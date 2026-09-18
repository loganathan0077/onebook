import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

bad_init = """                // Refactored Database Location Logic (Persistent Config First)
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

good_init = """                // Refactored Database Location Logic (Persistent Config First)
                let folder = null;
                
                // 1. Try to get persistent config
                if (window.electronAPI && window.electronAPI.getDbConfigSync) {
                    folder = window.electronAPI.getDbConfigSync();
                }
                
                // 2. Migration: If no persistent config, but localStorage has a folder, use it
                if (!folder) {
                    folder = localStorage.getItem('database_folder');
                }
                
                // 3. Default: If still no folder, use the default Documents path
                if (!folder && window.electronAPI && window.electronAPI.getDefaultDbFolderSync) {
                    folder = window.electronAPI.getDefaultDbFolderSync();
                    if (folder) {
                        window.electronAPI.ensureFolderSync(folder);
                    }
                }

                // 4. Final fallback (e.g. permission errors getting default path)
                if (!folder && window.electronAPI && window.electronAPI.selectDirectorySync) {
                    folder = window.electronAPI.selectDirectorySync();
                }

                // 5. Save to both localStorage and persistent config
                if (folder) {
                    localStorage.setItem('database_folder', folder);
                    if (window.electronAPI && window.electronAPI.setDbConfigSync) {
                        window.electronAPI.setDbConfigSync(folder);
                    }
                } else {
                    alert('CRITICAL ERROR: Unable to determine or create database folder. Please restart or check permissions.');
                }"""

if bad_init in html:
    html = html.replace(bad_init, good_init)
else:
    print("WARNING: bad_init not found")

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
