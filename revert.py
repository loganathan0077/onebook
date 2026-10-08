import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                            <!-- Action Buttons -->
                            <div style="display: flex; flex-direction: column; gap: 10px; min-width: 160px; justify-content: flex-end;">
                                <button type="button" id="btnCompleteSale" class="btn btn-success" onclick="completeSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; white-space: nowrap; font-size: 18px; font-weight: bold;">✅ Complete Sale</button>
                                <button type="button" id="btnHoldSale" class="btn btn-warning" onclick="holdSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; color: #856404; font-weight: bold; white-space: nowrap; font-size: 18px;">⏸️ Hold Sale</button>
                                <button type="button" id="btnClearCart" class="btn btn-cart-remove" onclick="clearCart()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; background-color: #dc3545; color: white; white-space: nowrap; font-size: 18px; font-weight: bold;">🗑️ Clear Cart</button>
                            </div>
"""

replacement = """                            <!-- Action Buttons -->
                            <div style="display: flex; flex-direction: column; gap: 10px; min-width: 160px; justify-content: flex-end;">
                                <button type="button" id="btnCompleteSale" class="btn btn-success" onclick="completeSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; white-space: nowrap; font-size: 18px; font-weight: bold;">✅ Complete Sale</button>
                                <button type="button" id="btnHoldSale" class="btn btn-warning" onclick="holdSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; color: #856404; font-weight: bold; white-space: nowrap; font-size: 18px;">⏸️ Hold Sale</button>
                                <button type="button" id="btnClearCart" class="btn btn-cart-remove" onclick="clearCart()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; background-color: #dc3545; color: white; white-space: nowrap; font-size: 18px; font-weight: bold;">🗑️ Clear Cart</button>
                            </div>
                        </div>
                    </div>
                </div>
"""

content = content.replace(target, replacement)
with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
