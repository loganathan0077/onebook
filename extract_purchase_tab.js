const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

// 1. Add nav-tab for F10
const oldNav = `<button class="nav-tab" data-tab="settings" onclick="switchTab('settings', this)">⚙️ Settings <kbd style="background: #e9ecef; border: 1px solid #ced4da; color: #495057; padding: 2px 4px; border-radius: 3px; font-size: 11px; margin-left: 5px; font-family: monospace;">F9</kbd></button>`;
const newNav = `${oldNav}
            <button class="nav-tab" data-tab="purchaseparties" onclick="switchTab('purchaseparties', this)">💼 Purchase & Parties <kbd style="background: #e9ecef; border: 1px solid #ced4da; color: #495057; padding: 2px 4px; border-radius: 3px; font-size: 11px; margin-left: 5px; font-family: monospace;">F10</kbd></button>`;
html = html.replace(oldNav, newNav);

// 2. Add 'F10': 'purchaseparties' to tabMap
const oldTabMap = `'F8': 'calculator',
                    'F9': 'settings'
                };`;
const newTabMap = `'F8': 'calculator',
                    'F9': 'settings',
                    'F10': 'purchaseparties'
                };`;
html = html.replace(oldTabMap, newTabMap);

// 3. Extract the section from products into its own tab
const sectionRegex = /<!-- Purchase & Parties Section -->\s*<div style="margin-top: 40px; margin-bottom: 10px;">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/;

const match = html.match(sectionRegex);
if (match) {
    const fullMatch = match[0];
    
    // Remove it from the end of the products tab
    html = html.replace(fullMatch, '            </div>');
    
    // Create new tab div right after products tab
    const productsEnd = `            </div>\n\n            <!-- Receivables Tab -->`;
    const newTabContent = `            </div>\n\n            <!-- Purchase & Parties Tab -->
            <div id="purchaseparties" class="tab-content" style="display: none;">
                <!-- Purchase & Parties Section -->
                <div style="margin-top: 10px; margin-bottom: 10px;">
${match[1]}
                </div>
            </div>\n\n            <!-- Receivables Tab -->`;
            
    html = html.replace(productsEnd, newTabContent);
    fs.writeFileSync('final.html', html, 'utf8');
    console.log("Successfully extracted to new tab.");
} else {
    console.log("Failed to find section via regex.");
}
