import re

with open('final.html', 'r', encoding='utf-8') as f:
    html = f.read()

original_func = """        function changeAdminPassword() {
            const currentSettings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            const currentPwd = document.getElementById('settingsCurrentPwd').value;
            const newPwd = document.getElementById('settingsNewPwd').value;
            const confirmPwd = document.getElementById('settingsConfirmPwd').value;

            if (currentPwd !== currentSettings.adminPassword) {
                showAlert('Incorrect current password.', '❌');
                return;
            }
            if (newPwd !== confirmPwd) {
                showAlert('New password and confirm password do not match.', '❌');
                return;
            }
            if (!newPwd) {
                showAlert('Password cannot be empty.', '⚠️');
                return;
            }

            currentSettings.adminPassword = newPwd;
            localStorage.setItem('settings', JSON.stringify(currentSettings));
            showAlert('Admin password changed successfully!', '✅');
            
            document.getElementById('settingsCurrentPwd').value = '';
            document.getElementById('settingsNewPwd').value = '';
            document.getElementById('settingsConfirmPwd').value = '';
        }"""

new_func = """        function changeAdminPassword() {
            const currentPwd = document.getElementById('settingsCurrentPwd').value;
            const newPwd = document.getElementById('settingsNewPwd').value;
            const confirmPwd = document.getElementById('settingsConfirmPwd').value;

            const userStr = sessionStorage.getItem('currentUser');
            if (!userStr) {
                showAlert('User session not found.', '❌');
                return;
            }
            const sessionUser = JSON.parse(userStr);

            let users = JSON.parse(localStorage.getItem('users') || '[]');
            const dbUser = users.find(u => u.id === sessionUser.id);

            if (!dbUser) {
                showAlert('User not found in the active database.', '❌');
                return;
            }

            if (currentPwd !== dbUser.password) {
                showAlert('Incorrect current password.', '❌');
                return;
            }
            
            if (newPwd !== confirmPwd) {
                showAlert('New password and confirmation do not match.', '❌');
                return;
            }
            
            if (!newPwd) {
                showAlert('Password cannot be empty.', '⚠️');
                return;
            }

            // Update password in users array (this uses the exact same storage as Admin Login)
            dbUser.password = newPwd;
            localStorage.setItem('users', JSON.stringify(users));
            
            // Keep session storage updated
            sessionUser.password = newPwd;
            sessionStorage.setItem('currentUser', JSON.stringify(sessionUser));

            // Keep settings in sync for any legacy code, but primary is users
            const currentSettings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
            currentSettings.adminPassword = newPwd;
            localStorage.setItem('settings', JSON.stringify(currentSettings));
            
            showAlert('Password changed successfully.', '✅');
            
            document.getElementById('settingsCurrentPwd').value = '';
            document.getElementById('settingsNewPwd').value = '';
            document.getElementById('settingsConfirmPwd').value = '';
        }"""

html = html.replace(original_func, new_func)

with open('final.html', 'w', encoding='utf-8') as f:
    f.write(html)
