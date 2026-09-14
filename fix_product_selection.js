const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

const startStr = '<!-- Selected Product Area -->';
const endStr = '<!-- Items Table -->';

const startIndex = html.indexOf(startStr);
const endIndex = html.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = `<!-- Selected Product Area -->
                <div id="purchaseSelectedProduct" style="display: none; background: #d4edda; padding: 10px 15px; border-radius: 8px; border: 1px solid #c3e6cb; align-items: center; gap: 15px; flex-wrap: nowrap; overflow-x: auto; margin-bottom: 15px;">
                    
                    <div style="flex: 1; min-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; flex-direction: column; justify-content: center;">
                        <span id="purchaseProductName" style="font-weight: bold; font-size: 1.1em; color: #155724; line-height: 1.2;">Product Name</span>
                        <small style="color: #155724; font-weight: bold; margin-top: 2px;">In Stock: <span id="purchaseCurrentStock">0</span></small>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                        <label style="margin: 0; color: #155724;">Qty:</label>
                        <div class="quantity-controls" style="display: flex;">
                            <button type="button" class="qty-btn decrease" onclick="adjustPurchaseQty(-1)" style="height: 32px;">-</button>
                            <input type="number" id="purchaseQty" value="1" min="1" class="qty-value" style="width: 60px; text-align: center; border: 1px solid #c3e6cb; height: 32px; padding: 0;">
                            <button type="button" class="qty-btn increase" onclick="adjustPurchaseQty(1)" style="height: 32px;">+</button>
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                        <label style="margin: 0; color: #155724;">Rate (₹):</label>
                        <input type="number" id="purchaseItemPrice" style="width: 80px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; height: 32px;">
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;" class="gst-field">
                        <label style="margin: 0; color: #155724;">GST (%):</label>
                        <input type="number" id="purchaseItemGST" style="width: 60px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; height: 32px;">
                    </div>
                    
                    <div style="display: flex; gap: 5px; flex-shrink: 0;">
                        <button class="btn btn-success" onclick="addPurchaseItem()" style="height: 32px; display: inline-flex; align-items: center; justify-content: center;">Add to Bill</button>
                        <button class="btn btn-danger purchase-selection-remove-btn" onclick="cancelPurchaseSelection()" title="Remove Selection" style="height: 32px; display: inline-flex; align-items: center; justify-content: center;">Remove</button>
                    </div>
                </div>
            </div>

            `;
    
    html = html.substring(0, startIndex) + newContent + html.substring(endIndex);
    fs.writeFileSync('final.html', html, 'utf8');
    console.log("Fixed product selection layout");
} else {
    console.log("Could not find boundaries.");
}
