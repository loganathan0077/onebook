import re

file_path = '/Users/log/onebook/license.html'

with open(file_path, 'r', encoding='utf8') as f:
    content = f.read()

# Add the Continue in Demo Mode button
button_injection = """            <button id="activateBtn" class="activate-btn">
                <span class="btn-text">Activate License</span>
                <div class="spinner" id="spinner" style="display: none;"></div>
            </button>
            
            <div style="text-align: center; margin: 15px 0 15px 0; font-size: 14px; color: #64748b; font-weight: bold;">or</div>
            
            <button id="demoBtn" onclick="window.location.href='login.html'" class="activate-btn" style="background: transparent; color: #0d6efd; border: 2px solid #0d6efd; box-shadow: none;">
                <span class="btn-text">Continue in Demo Mode</span>
            </button>
            <p style="text-align: center; font-size: 12px; color: #64748b; margin-top: 10px;">No license? Continue with Demo Mode to explore OneBook.</p>"""

# Replace the original button with the new block
content = re.sub(
    r'<button id="activateBtn" class="activate-btn">[\s\S]*?</button>',
    button_injection,
    content,
    count=1
)

with open(file_path, 'w', encoding='utf8') as f:
    f.write(content)
