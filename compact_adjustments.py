with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = """                    <!-- 3. ADJUSTMENTS & PAYMENT -->
                    <div class="sale-card-box" style="background: #ffffff; justify-content: flex-start;">
                        <h4 class="sale-card-title" style="color: #495057; font-size: 18px;">⚙️ Adjustments & Payment</h4>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 5px; display: block;">Extra Discount (₹)</label>
                                <input type="number" id="discountAmount" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" class="form-control" onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('courierCharges').focus();}" style="font-weight: bold;">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 5px; display: block;">Courier (₹)</label>
                                <input type="number" id="courierCharges" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" class="form-control" onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('paymentMethod').focus();}" style="font-weight: bold;">
                            </div>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label style="font-size: 12px; color: #6c757d; margin-bottom: 5px; display: block;">Payment Method</label>
                            <select id="paymentMethod" class="form-control" onchange="togglePaymentFields()" style="font-weight: bold; background-color: #f8f9fa;">
                                <option value="cash" selected>Cash Only</option>
                                <option value="card">Card</option>
                                <option value="upi">UPI</option>
                                <option value="credit">Credit</option>
                                <option value="mixed">Mixed (Cash + UPI/Balance)</option>
                            </select>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 0;">
                            <div class="form-group" id="customerAmountGroup" style="display: none; position: relative; margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 5px; display: block; white-space: nowrap;">Cash Rcvd (₹) <span style="color: red;">*</span></label>
                                <input type="number" id="customerAmount" class="form-control" step="0.01" onchange="calculateChange()" oninput="calculateChange()" placeholder="Amount" required onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('btnCompleteSale').focus();}" style="font-weight: bold;">
                                <small id="cashAmountError" style="position: absolute; left: 0; bottom: -18px; font-size: 10px; color: red; display: none; white-space: nowrap;"></small>
                            </div>
                            
                            <div class="form-group" id="otherPaymentGroup" style="display: none; margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 5px; display: block; white-space: nowrap;">UPI/Bal (₹)</label>
                                <input type="number" id="otherPaymentAmount" class="form-control" step="0.01" onchange="calculateChange()" oninput="calculateChange()" placeholder="Amount" value="0" style="font-weight: bold;">
                            </div>
                            
                            <div class="form-group" id="changeAmountGroup" style="display: none; position: relative; margin-bottom: 0; grid-column: 1 / -1; margin-top: 5px;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 5px; display: block;">Give Change (₹)</label>
                                <input type="number" id="changeAmount" class="form-control" step="0.01" readonly style="font-weight: bold; color: #dc3545; background: #fff5f5;">
                                <div id="negativeChangeInfo" style="position: absolute; left: 0; bottom: -18px; font-size: 10px; color: #dc3545; display: none; white-space: nowrap;">
                                    <span id="negativeChangeText"></span> | Count: <span id="negativeChangeCount">0</span>
                                </div>
                            </div>
                        </div>"""

new = """                    <!-- 3. ADJUSTMENTS & PAYMENT -->
                    <div class="sale-card-box" style="background: #ffffff; justify-content: flex-start;">
                        <h4 class="sale-card-title" style="color: #495057; font-size: 16px;">⚙️ Adjustments & Payment</h4>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 4px; display: block;">Extra Discount (₹)</label>
                                <input type="number" id="discountAmount" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" class="form-control" onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('courierCharges').focus();}" style="font-weight: bold; height: 36px;">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 4px; display: block;">Courier (₹)</label>
                                <input type="number" id="courierCharges" min="0" step="0.01" value="0" onchange="updateDiscount()" placeholder="0" class="form-control" onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('paymentMethod').focus();}" style="font-weight: bold; height: 36px;">
                            </div>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 10px;">
                            <label style="font-size: 12px; color: #6c757d; margin-bottom: 4px; display: block;">Payment Method</label>
                            <select id="paymentMethod" class="form-control" onchange="togglePaymentFields()" style="font-weight: bold; background-color: #f8f9fa; height: 36px;">
                                <option value="cash" selected>Cash Only</option>
                                <option value="card">Card</option>
                                <option value="upi">UPI</option>
                                <option value="credit">Credit</option>
                                <option value="mixed">Mixed (Cash + UPI/Balance)</option>
                            </select>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 0;">
                            <div class="form-group" id="customerAmountGroup" style="display: none; position: relative; margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 4px; display: block; white-space: nowrap;">Cash Rcvd (₹) <span style="color: red;">*</span></label>
                                <input type="number" id="customerAmount" class="form-control" step="0.01" onchange="calculateChange()" oninput="calculateChange()" placeholder="Amount" required onfocus="this.select()" onkeydown="if(event.key==='Enter'){event.preventDefault(); document.getElementById('btnCompleteSale').focus();}" style="font-weight: bold; height: 36px;">
                                <small id="cashAmountError" style="position: absolute; left: 0; bottom: -16px; font-size: 10px; color: red; display: none; white-space: nowrap;"></small>
                            </div>
                            
                            <div class="form-group" id="otherPaymentGroup" style="display: none; margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 4px; display: block; white-space: nowrap;">UPI/Bal (₹)</label>
                                <input type="number" id="otherPaymentAmount" class="form-control" step="0.01" onchange="calculateChange()" oninput="calculateChange()" placeholder="Amount" value="0" style="font-weight: bold; height: 36px;">
                            </div>
                            
                            <div class="form-group" id="changeAmountGroup" style="display: none; position: relative; margin-bottom: 0;">
                                <label style="font-size: 12px; color: #6c757d; margin-bottom: 4px; display: block;">Give Change (₹)</label>
                                <input type="number" id="changeAmount" class="form-control" step="0.01" readonly style="font-weight: bold; color: #dc3545; background: #fff5f5; height: 36px;">
                                <div id="negativeChangeInfo" style="position: absolute; left: 0; bottom: -16px; font-size: 10px; color: #dc3545; display: none; white-space: nowrap;">
                                    <span id="negativeChangeText"></span> | Count: <span id="negativeChangeCount">0</span>
                                </div>
                            </div>
                        </div>"""

if old in content:
    content = content.replace(old, new)
    with open('OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Adjustments & Payment compacted.")
else:
    print("ERROR: Target block not found.")
