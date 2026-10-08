with open('target_block.html', 'r', encoding='utf-8') as f:
    target = f.read()

replacement = """                    <!-- Sale Summary and Payment -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: 100%; margin-bottom: 0;">
                        <!-- GROUP 1: Sale Calculation Summary -->
                        <div style="background: #e9ecef; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <h4 style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #004085; display: flex; align-items: center; gap: 8px;">💳 Sale Summary</h4>
                            
                            <div style="display: grid; grid-template-columns: 1fr auto; row-gap: 8px; column-gap: 20px; font-size: 15px; margin-bottom: 10px;">
                                <div style="color: #495057;">Subtotal</div>
                                <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartSubtotal">0.00</span></div>
                                
                                <div style="color: #495057;">Total Item Discount</div>
                                <div style="text-align: right; font-weight: bold; color: red; font-family: monospace;">₹<span id="cartTotalItemDiscount">0.00</span></div>
                                
                                <div style="color: #495057;">Taxable Amount</div>
                                <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartTaxableAmount">0.00</span></div>
                                
                                <div style="color: #495057;">CGST</div>
                                <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartCGST">0.00</span></div>
                                
                                <div style="color: #495057;">SGST</div>
                                <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartSGST">0.00</span></div>
                                
                                <div style="color: #495057;">IGST</div>
                                <div style="text-align: right; font-weight: bold; font-family: monospace;">₹<span id="cartIGST">0.00</span></div>
                            </div>
                            
                            <div style="border-top: 2px dashed #dee2e6; margin: 10px 0;"></div>
                            
                            <div style="display: grid; grid-template-columns: 1fr auto; align-items: center;">
                                <div style="font-weight: bold; color: #343a40; font-size: 18px;">Total Amount</div>
                                <div style="text-align: right; font-weight: bold; color: #28a745; font-size: 24px; font-family: monospace;">₹<span id="cartTotal">0.00</span></div>
                            </div>
                        </div>
                        
                        <div style="display:none;">
                            <select id="saleTaxType" class="form-control" onchange="updateCartDisplay()">
                                <option value="auto">Auto (Detect from State)</option>
                                <option value="intra">Intra-State (CGST + SGST)</option>
                                <option value="inter">Inter-State (IGST)</option>
                            </select>
                        </div>

                        <!-- GROUP 2: Adjustments & Payment -->
                        <div style="background: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div>
                                <h4 style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #495057; display: flex; align-items: center; gap: 8px;">⚙️ Adjustments & Payment</h4>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                    <div class="form-group" style="margin-bottom: 0;">
                                        <label style="font-size: 13px; color: #6c757d; margin-bottom: 5px; display: block;">Extra Discount (₹)</label>
                                        <input type="number" id="discountAmount" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" class="form-control" onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('courierCharges').focus();}" style="font-weight: bold;">
                                    </div>
                                    <div class="form-group" style="margin-bottom: 0;">
                                        <label style="font-size: 13px; color: #6c757d; margin-bottom: 5px; display: block;">Courier/Packing (₹)</label>
                                        <input type="number" id="courierCharges" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" class="form-control" onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('paymentMethod').focus();}" style="font-weight: bold;">
                                    </div>
                                </div>
                                
                                <div class="form-group" style="margin-bottom: 15px;">
                                    <label style="font-size: 13px; color: #6c757d; margin-bottom: 5px; display: block;">Payment Method</label>
                                    <select id="paymentMethod" class="form-control" onchange="togglePaymentFields()" style="font-weight: bold; background-color: #f8f9fa;">
                                        <option value="cash" selected>Cash Only</option>
                                        <option value="card">Card</option>
                                        <option value="upi">UPI</option>
                                        <option value="credit">Credit</option>
                                        <option value="mixed">Mixed (Cash + UPI/Balance)</option>
                                    </select>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                    <div class="form-group" id="customerAmountGroup" style="display: none; position: relative; margin-bottom: 0;">
                                        <label style="font-size: 13px; color: #6c757d; margin-bottom: 5px; display: block; white-space: nowrap;">Cash Received (₹) <span style="color: red;">*</span></label>
                                        <input type="number" id="customerAmount" class="form-control" step="0.01" onchange="calculateChange()" oninput="calculateChange()" placeholder="Enter amount" required onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('btnCompleteSale').focus();}" style="font-weight: bold;">
                                        <small id="cashAmountError" style="position: absolute; left: 0; bottom: -18px; font-size: 11px; color: red; display: none; white-space: nowrap;"></small>
                                    </div>
                                    
                                    <div class="form-group" id="otherPaymentGroup" style="display: none; margin-bottom: 0;">
                                        <label style="font-size: 13px; color: #6c757d; margin-bottom: 5px; display: block; white-space: nowrap;">UPI/Balance (₹)</label>
                                        <input type="number" id="otherPaymentAmount" class="form-control" step="0.01" onchange="calculateChange()" oninput="calculateChange()" placeholder="Amount" value="0" style="font-weight: bold;">
                                    </div>
                                    
                                    <div class="form-group" id="changeAmountGroup" style="display: none; position: relative; margin-bottom: 0;">
                                        <label style="font-size: 13px; color: #6c757d; margin-bottom: 5px; display: block;">Give (₹)</label>
                                        <input type="number" id="changeAmount" class="form-control" step="0.01" readonly style="font-weight: bold; color: #dc3545; background: #fff5f5;">
                                        <div id="negativeChangeInfo" style="position: absolute; left: 0; bottom: -18px; font-size: 11px; color: #dc3545; display: none; white-space: nowrap;">
                                            <span id="negativeChangeText"></span> | Count: <span id="negativeChangeCount">0</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div id="creditPaymentGroup" style="display: none; padding: 10px; margin-top: 10px; background: #fff5f5; border: 1px solid #fed7d7; border-radius: 6px;">
                                    <h4 style="margin: 0 0 10px 0; color: #c53030; font-size: 13px; border-bottom: 1px solid #fed7d7; padding-bottom: 5px;">💳 Credit Details</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                        <div class="form-group" style="margin-bottom: 0;">
                                            <label style="font-size: 11px; color: #c53030;">Initial Paid (₹)</label>
                                            <input type="number" id="creditAmountPaid" step="0.01" class="form-control form-control-sm" onchange="calculateChange()" oninput="calculateChange()" placeholder="e.g. 1000" value="0">
                                        </div>
                                        <div class="form-group" style="margin-bottom: 0;">
                                            <label style="font-size: 11px; color: #c53030;">Outstanding (₹)</label>
                                            <input type="text" id="creditOutstanding" class="form-control form-control-sm" readonly style="font-weight: bold; color: #c53030; background: #fff;" value="₹0.00">
                                        </div>
                                        <div class="form-group" id="inlineAdvancePaymentSection" style="margin-bottom: 0;">
                                            <label style="font-size: 11px; color: #c53030;">Method</label>
                                            <select id="creditPaymentMethod" class="form-control form-control-sm" onchange="calculateChange()">
                                                <option value="cash">Cash</option>
                                                <option value="upi">UPI</option>
                                                <option value="card">Card</option>
                                                <option value="bank">Bank</option>
                                                <option value="cheque">Cheque</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div class="form-group" id="inlineReferenceGroup" style="display: none; margin-bottom: 0;">
                                            <label style="font-size: 11px; color: #c53030;">Ref No.</label>
                                            <input type="text" id="creditReference" class="form-control form-control-sm" placeholder="Ref No">
                                        </div>
                                        <div class="form-group" style="grid-column: 1 / -1; margin-bottom: 0;">
                                            <label style="font-size: 11px; color: #c53030;">Due Date</label>
                                            <input type="date" id="creditDueDate" class="form-control form-control-sm">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Action Buttons inside the right card -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                                <button type="button" id="btnHoldSale" class="btn btn-warning" onclick="holdSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; color: #856404; font-weight: bold; white-space: nowrap; font-size: 16px;">⏸️ Hold</button>
                                <button type="button" id="btnClearCart" class="btn btn-cart-remove" onclick="clearCart()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="height: 48px; background-color: #dc3545; color: white; white-space: nowrap; font-size: 16px; font-weight: bold;">🗑️ Clear</button>
                                <button type="button" id="btnCompleteSale" class="btn btn-success" onclick="completeSale()" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.click();}" style="grid-column: 1 / -1; height: 48px; white-space: nowrap; font-size: 18px; font-weight: bold;">✅ Complete Sale</button>
                            </div>
                        </div>
                    </div>
                </div>
"""

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

if target in content:
    content = content.replace(target, replacement)
    with open('OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully replaced target block!")
else:
    print("Target block not found in OneBook.html!")
