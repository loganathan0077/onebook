import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    new_func = """
        function requireLicensedForWrite(actionName = 'this action') {
            if (typeof isDemoMode !== 'function' || !isDemoMode()) {
                return true;
            }
            
            // Create modal if it doesn't exist
            let modal = document.getElementById('demoLicenseModal');
            if (!modal) {
                const modalHtml = `
                    <div id="demoLicenseModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99999; justify-content: center; align-items: center; backdrop-filter: blur(4px);">
                        <div style="background: white; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); width: 100%; max-width: 460px; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; animation: modalFadeIn 0.2s ease-out;">
                            <div style="padding: 24px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 22px;">🔵</span>
                                <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: 0.5px;">DEMO MODE</h2>
                            </div>
                            <div style="padding: 24px; color: #334155; font-size: 15px; line-height: 1.6;">
                                <p style="margin-top: 0;">You're currently using OneBook in Demo Mode.</p>
                                <p id="demoLicenseMessage" style="font-weight: 600; color: #0f172a; margin: 18px 0; font-size: 15px;">Saving ${actionName} requires an active OneBook license.</p>
                                <p style="margin-bottom: 0;">Activate your license to continue using OneBook for business operations.</p>
                            </div>
                            <div style="padding: 20px 24px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 12px;">
                                <button onclick="document.getElementById('demoLicenseModal').style.display = 'none'" style="padding: 10px 20px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #475569; font-weight: 600; font-size: 14px; cursor: pointer;">Cancel</button>
                                <button onclick="window.location.href='license.html'" style="padding: 10px 20px; border-radius: 8px; border: none; background: #007bff; color: white; font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">Activate License</button>
                            </div>
                        </div>
                    </div>
                    <style>
                        @keyframes modalFadeIn {
                            from { opacity: 0; transform: scale(0.95) translateY(10px); }
                            to { opacity: 1; transform: scale(1) translateY(0); }
                        }
                    </style>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                modal = document.getElementById('demoLicenseModal');
                
                // Add ESC key listener
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && modal.style.display === 'flex') {
                        modal.style.display = 'none';
                    }
                });
            }
            
            // Update message text
            let msgText = `Saving ${actionName} requires an active OneBook license.`;
            if (actionName.includes('more than')) { // Handle limit messages
                msgText = `You've reached the maximum of ${actionName.replace('creating more than ', '').replace('completing more than ', '')}.<br>Activate your OneBook license to continue.`;
            } else {
                // Ensure natural phrasing for custom strings
                msgText = `${actionName.charAt(0).toUpperCase() + actionName.slice(1)} requires an active OneBook license.`;
            }
            document.getElementById('demoLicenseMessage').innerHTML = msgText;
            
            // Show modal
            modal.style.display = 'flex';
            
            return false;
        }
"""
    
    # Replace the existing requireLicensedForWrite function entirely
    content = re.sub(
        r'function requireLicensedForWrite.*?return false;\n\s*\}',
        new_func.strip(),
        content,
        flags=re.DOTALL
    )

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

