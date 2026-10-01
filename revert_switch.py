import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_func = """        window.switchSettingsTab = function(paneId, btnElement) {
            try {
                // Hide all panes
                const panes = document.querySelectorAll('.settings-pane');
                for(let i=0; i<panes.length; i++) panes[i].classList.remove('active');
                
                // Remove active class from all nav items
                const navs = document.querySelectorAll('.settings-nav-item');
                for(let i=0; i<navs.length; i++) navs[i].classList.remove('active');

                // Show selected pane
                const selectedPane = document.getElementById(paneId);
                if (selectedPane) {
                    selectedPane.classList.add('active');
                    selectedPane.style.display = 'block'; // force display
                }

                if(paneId === 'settings-pane-license') {
                    if(typeof refreshLicenseUI === 'function') refreshLicenseUI();
                }
                if(paneId === 'settings-pane-account') {
                    if(typeof renderUserManagementTable === 'function') renderUserManagementTable();
                }
                if(paneId === 'settings-pane-theme') {
                    if(typeof renderThemeGrid === 'function') renderThemeGrid();
                }

                // Add active class to clicked button
                if (btnElement) {
                    btnElement.classList.add('active');
                }
            } catch(e) {
                alert("Error in switchSettingsTab: " + e.message);
                console.error(e);
            }
        }"""

new_func = """        function switchSettingsTab(paneId, btnElement) {
            try {
                // Hide all panes
                const panes = document.querySelectorAll('.settings-pane');
                for(let i=0; i<panes.length; i++) {
                    panes[i].classList.remove('active');
                    panes[i].style.display = ''; // Reset any inline display
                }
                
                // Remove active class from all nav items
                const navs = document.querySelectorAll('.settings-nav-item');
                for(let i=0; i<navs.length; i++) navs[i].classList.remove('active');

                // Show selected pane
                const selectedPane = document.getElementById(paneId);
                if (selectedPane) {
                    selectedPane.classList.add('active');
                }

                if(paneId === 'settings-pane-license') {
                    if(typeof refreshLicenseUI === 'function') refreshLicenseUI();
                }
                if(paneId === 'settings-pane-account') {
                    if(typeof renderUserManagementTable === 'function') renderUserManagementTable();
                }
                if(paneId === 'settings-pane-theme') {
                    if(typeof renderThemeGrid === 'function') renderThemeGrid();
                }

                // Add active class to clicked button
                if (btnElement) {
                    btnElement.classList.add('active');
                }
            } catch(e) {
                console.error("Error in switchSettingsTab: ", e);
            }
        }"""

if old_func in content:
    content = content.replace(old_func, new_func)
    with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Reverted successfully")
else:
    print("Function to revert not found!")
