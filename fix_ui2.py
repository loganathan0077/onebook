import re
with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                                <div style="display: flex; gap: 10px; align-items: flex-end; width: 100%;">
                                    <div class="form-group">
                                        <label>Subtotal (₹)</label>
                                        <input type="number" id="cartSubtotal" step="0.01" readonly style="font-weight: bold; font-size: 18px;">
                                    </div>
                                    <div class="form-group">
                                        <label>Total Item Disc. (₹)</label>
                                        <input type="number" id="cartTotalItemDiscount" step="0.01" readonly style="font-weight: bold; color: red;">
                                    </div>
                                    <div class="form-group">
                                        <label>Ext.Discount (₹)</label>
                                        <input type="number" id="discountAmount" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" onfocus="this.select()" onkeydown="if(event.key==='Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey){event.preventDefault(); document.getElementById('courierCharges').focus();}">
                                    </div>
                                    <div class="form-group">
                                        <label>Courier (₹)</label>
                                        <input type="number" id="courierCharges" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" onfocus="this.select()" onkeydown="if(event.key==='Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey){event.preventDefault(); document.getElementById('paymentMethod').focus();}">
                                    </div>
                                </div>
                                
                                <!-- Row 2 -->
                                <div style="display: flex; gap: 10px; align-items: flex-end; width: 100%;">
                                    <div class="form-group">
                                        <label>Taxable (₹)</label>
                                        <input type="number" id="cartTaxableAmount" step="0.01" readonly style="font-weight: bold; font-size: 18px;">
                                    </div>
                                    <div class="form-group">
                                        <label>CGST (₹)</label>
                                        <input type="number" id="cartCGST" step="0.01" readonly style="font-weight: bold;">
                                    </div>
                                    <div class="form-group">
                                        <label>SGST (₹)</label>
                                        <input type="number" id="cartSGST" step="0.01" readonly style="font-weight: bold;">
                                    </div>
                                    <div class="form-group">
                                        <label>IGST (₹)</label>
                                        <input type="number" id="cartIGST" step="0.01" readonly style="font-weight: bold;">
                                    </div>
                                    <div class="form-group" style="flex: 1.5;">
                                        <label>Total Amount (₹)</label>
                                        <input type="number" id="cartTotal" step="0.01" readonly style="font-weight: bold; color: #28a745; font-size: 20px; background: #d4edda;">
                                    </div>
                                </div>"""
                                
replacement = """                                <div style="display: grid; grid-template-columns: 1fr auto; row-gap: 8px; column-gap: 20px; font-size: 14px; margin-bottom: 10px;">
                                    <div style="color: #6c757d;">Subtotal</div>
                                    <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartSubtotal">0.00</span></div>
                                    
                                    <div style="color: #6c757d;">Total Item Discount</div>
                                    <div style="text-align: right; font-weight: bold; color: red; font-family: monospace;">₹<span id="cartTotalItemDiscount">0.00</span></div>
                                    
                                    <div style="color: #6c757d;">Taxable Amount</div>
                                    <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartTaxableAmount">0.00</span></div>
                                    
                                    <div style="color: #6c757d;">CGST</div>
                                    <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartCGST">0.00</span></div>
                                    
                                    <div style="color: #6c757d;">SGST</div>
                                    <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartSGST">0.00</span></div>
                                    
                                    <div style="color: #6c757d;">IGST</div>
                                    <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartIGST">0.00</span></div>
                                    
                                    <div style="grid-column: 1 / -1; border-top: 2px dashed #dee2e6; margin: 10px 0;"></div>
                                    
                                    <div style="font-weight: bold; color: #343a40; font-size: 16px;">Total Amount</div>
                                    <div style="text-align: right; font-weight: bold; color: #28a745; font-size: 20px; font-family: monospace;">₹<span id="cartTotal">0.00</span></div>
                                </div>
                                
                                <div style="display: flex; gap: 15px; margin-top: 15px;">
                                    <div class="form-group" style="flex: 1; margin-bottom: 0;">
                                        <label style="font-size: 13px; color: #6c757d; margin-bottom: 5px; display: block;">Extra Discount (₹)</label>
                                        <input type="number" id="discountAmount" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" class="form-control" onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('courierCharges').focus();}">
                                    </div>
                                    <div class="form-group" style="flex: 1; margin-bottom: 0;">
                                        <label style="font-size: 13px; color: #6c757d; margin-bottom: 5px; display: block;">Courier/Packing (₹)</label>
                                        <input type="number" id="courierCharges" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" class="form-control" onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('paymentMethod').focus();}">
                                    </div>
                                </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open('OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Re-applied Sale Summary redesign successfully!")
else:
    print("Could not find target for Sale Summary redesign!")

