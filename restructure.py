import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract Keyboard Shortcuts Panel
kb_pattern = r'<!-- Keyboard Shortcuts Panel -->\s*<div id="keyboardShortcutsPanel"(.|\n)*?<!-- Draft Sales Section -->'
kb_match = re.search(kb_pattern, content)
if kb_match:
    kb_html = kb_match.group(0).replace('<!-- Draft Sales Section -->', '').strip()
    content = content.replace(kb_html, '')
    
    # 2. Extract Draft Sales, Sale Receipt, GST Invoice, Today's Sales
    # These are currently siblings of the action buttons because of an extra </div>
    # Let's fix the extra </div> first.
    # The action buttons block:
    action_buttons_pattern = r'(<!-- Action Buttons -->\s*<div.*?</div>\s*</div>\s*</div>\s*</div>\s*</div>)'
    # Wait, let's just find the exact string:
    target_divs = """                            <!-- Action Buttons -->
                            <div style="display: flex; flex-direction: column; gap: 10px; min-width: 160px; justify-content: flex-end;">
                                <button type="button" id="btnCompleteSale" class="btn btn-success" onclick="completeSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; white-space: nowrap; font-size: 18px; font-weight: bold;">✅ Complete Sale</button>
                                <button type="button" id="btnHoldSale" class="btn btn-warning" onclick="holdSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; color: #856404; font-weight: bold; white-space: nowrap; font-size: 18px;">⏸️ Hold Sale</button>
                                <button type="button" id="btnClearCart" class="btn btn-cart-remove" onclick="clearCart()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; background-color: #dc3545; color: white; white-space: nowrap; font-size: 18px; font-weight: bold;">🗑️ Clear Cart</button>
                            </div>
                        </div>
                    </div>
                </div>"""
                
    new_divs = """                            <!-- Action Buttons -->
                            <div style="display: flex; flex-direction: column; gap: 10px; min-width: 160px; justify-content: flex-end;">
                                <button type="button" id="btnCompleteSale" class="btn btn-success" onclick="completeSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; white-space: nowrap; font-size: 18px; font-weight: bold;">✅ Complete Sale</button>
                                <button type="button" id="btnHoldSale" class="btn btn-warning" onclick="holdSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; color: #856404; font-weight: bold; white-space: nowrap; font-size: 18px;">⏸️ Hold Sale</button>
                                <button type="button" id="btnClearCart" class="btn btn-cart-remove" onclick="clearCart()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; background-color: #dc3545; color: white; white-space: nowrap; font-size: 18px; font-weight: bold;">🗑️ Clear Cart</button>
                            </div>
"""
    content = content.replace(target_divs, new_divs)

    # 3. Put the Keyboard Shortcuts Panel at the very end of the content area
    # Before the Scanner Modal:
    scanner_modal_pattern = r'<!-- Scanner Modal -->'
    content = content.replace('<!-- Scanner Modal -->', kb_html + '\n\n    <!-- Scanner Modal -->')
    
    with open('OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("DOM restructured successfully.")
else:
    print("Could not find Keyboard Shortcuts Panel")

