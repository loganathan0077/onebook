import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

def replacer(match):
    # match.group(1) is the inner HTML
    return f'<div class="gst-field" id="{match.group(1)}" style="display: none; width: 100%;">\n                                        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 15px; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap;">{match.group(2)}</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap;">\n                                                <span style="color: #212529; font-size: 15px;">₹</span>\n                                                <input type="number" id="{match.group(3)}" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;" value="0.00">\n                                            </div>\n                                        </div>\n                                        </div>'

# For standard GST fields (taxable, cgst, sgst)
pattern1 = r'<div class="gst-field" id="(summary-[a-z]+)" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">\s*<span style="color: #6c757d; white-space: nowrap; flex: 1;">([^<]+)</span>\s*<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; flex: 0 0 auto;">\s*<span style="color: #212529; font-size: 15px;">₹</span>\s*<input type="number" id="([^"]+)" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;" value="0.00">\s*</div>\s*</div>'

# For IGST field (display: none !important)
pattern2 = r'<div class="gst-field" id="(summary-igst)" style="display: none !important;">\s*<span style="color: #6c757d; white-space: nowrap; flex: 1;">([^<]+)</span>\s*<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap; flex: 0 0 auto;">\s*<span style="color: #212529; font-size: 15px;">₹</span>\s*<input type="number" id="([^"]+)" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;" value="0.00">\s*</div>\s*</div>'

def replacer_igst(match):
    return f'<div class="gst-field" id="{match.group(1)}" style="display: none !important; width: 100%;">\n                                        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 15px; width: 100%;">\n                                            <span style="color: #6c757d; white-space: nowrap;">{match.group(2)}</span>\n                                            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; white-space: nowrap;">\n                                                <span style="color: #212529; font-size: 15px;">₹</span>\n                                                <input type="number" id="{match.group(3)}" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;" value="0.00">\n                                            </div>\n                                        </div>\n                                        </div>'

old_content = content
content = re.sub(pattern1, replacer, content)
content = re.sub(pattern2, replacer_igst, content)

if content == old_content:
    print("No changes made! Regex failed.")
else:
    with open('OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated layout successfully.")
