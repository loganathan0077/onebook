const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

const startTag = '<!-- Label Settings Modal -->';
const endTag = '<!-- Entity Details Modal -->';

const startIndex = html.indexOf(startTag);
const endIndex = html.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = `<!-- Label Settings Modal -->
    <div id="labelSettingsModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 2050; padding: 20px; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 8px; width: 100%; max-width: 600px; max-height: calc(100vh - 40px); display: flex; flex-direction: column; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin: auto;">
            
            <div style="padding: 10px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; color: #333;">🏷️ Label Settings</h4>
                <span onclick="document.getElementById('labelSettingsModal').style.display='none'" style="cursor:pointer; font-size: 20px; font-weight: bold; color: #dc3545;">&times;</span>
            </div>
            
            <div style="padding: 15px; overflow-y: auto; flex: 1;">
                <style>
                    #labelSettingsModal .form-group { margin-bottom: 8px; }
                    #labelSettingsModal label { margin-bottom: 2px; font-size: 13px; font-weight: bold; color: #495057; display: block; }
                    #labelSettingsModal input, #labelSettingsModal select { padding: 4px 8px; height: 32px; font-size: 13px; width: 100%; box-sizing: border-box; }
                    #labelSettingsModal .btn { padding: 4px 12px; font-size: 13px; height: 32px; }
                    #labelSettingsModal .compact-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; align-items: start; margin-bottom: 10px; }
                </style>

                <div class="form-group" style="margin-bottom: 12px;">
                    <label>Label Preset</label>
                    <select id="labelPreset" onchange="applyLabelPreset()">
                        <option value="custom">Custom</option>
                        <option value="pen">Pen Label (50x30mm)</option>
                        <option value="standard">Standard Barcode (38x25mm)</option>
                        <option value="large">Large Shipping (100x150mm)</option>
                    </select>
                </div>

                <div class="compact-grid">
                    <div class="form-group">
                        <label>Custom Size (mm) [W x H]</label>
                        <div style="display: flex; gap: 5px;">
                            <input type="number" id="labelWidth" placeholder="Width" onchange="saveLabelSettings()">
                            <input type="number" id="labelHeight" placeholder="Height" onchange="saveLabelSettings()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Spacing / Gap (mm) [X x Y]</label>
                        <div style="display: flex; gap: 5px;">
                            <input type="number" id="labelGapX" placeholder="Horizontal" onchange="saveLabelSettings()">
                            <input type="number" id="labelGapY" placeholder="Vertical" onchange="saveLabelSettings()">
                        </div>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 12px;">
                    <label>Margins (mm) [Top, Right, Bottom, Left]</label>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                        <input type="number" id="labelMarginTop" placeholder="Top" onchange="saveLabelSettings()">
                        <input type="number" id="labelMarginRight" placeholder="Right" onchange="saveLabelSettings()">
                        <input type="number" id="labelMarginBottom" placeholder="Bottom" onchange="saveLabelSettings()">
                        <input type="number" id="labelMarginLeft" placeholder="Left" onchange="saveLabelSettings()">
                    </div>
                </div>

                <h5 style="margin: 15px 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #495057;">Format</h5>

                <div class="compact-grid">
                    <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
                        <div style="flex: 1;">
                            <label>Font Size (px)</label>
                            <input type="number" id="labelFontSize" onchange="saveLabelSettings()">
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <label style="margin-bottom: 2px;">Bold</label>
                            <input type="checkbox" id="labelFontBold" onchange="saveLabelSettings()" style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Alignment</label>
                        <select id="labelAlignment" onchange="saveLabelSettings()">
                            <option value="center">Center</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Barcode Size</label>
                        <select id="labelBarcodeSize" onchange="saveLabelSettings()">
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div style="padding: 10px 15px; border-top: 1px solid #eee; display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; background: #f8f9fa; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                <button class="btn btn-danger" onclick="resetLabelSettings()" style="height: 32px; padding: 4px 12px; font-size: 13px;">↩ Reset Defaults</button>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary" onclick="previewLabelSettings()" style="height: 32px; padding: 4px 12px; font-size: 13px;">👁️ Preview</button>
                    <button class="btn btn-primary" onclick="saveLabelSettings(); document.getElementById('labelSettingsModal').style.display='none';" style="height: 32px; padding: 4px 12px; font-size: 13px;">💾 Save & Close</button>
                </div>
            </div>
        </div>
    </div>\n\n    `;
    html = html.substring(0, startIndex) + newContent + html.substring(endIndex);
    fs.writeFileSync('final.html', html, 'utf8');
    console.log("Successfully replaced label modal.");
} else {
    console.log("Failed to find start or end tags.");
}
