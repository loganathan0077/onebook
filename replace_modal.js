const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

const startTag = '<!-- New Product Form Container (Hidden by default) -->';
const endTag = '<!-- Selected Product Area -->';

const startIndex = html.indexOf(startTag);
const endIndex = html.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = `<!-- New Product Form Container (Hidden by default) -->
                <div id="purchaseNewProductContainer" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 2050; padding: 20px;">
                    <div style="background: white; border: 2px solid #28a745; border-radius: 8px; width: 100%; max-width: 1000px; max-height: calc(100vh - 40px); margin: 0 auto; display: flex; flex-direction: column; top: 50%; transform: translateY(-50%); position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                        
                        <div style="padding: 10px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                            <h4 style="margin: 0; color: #28a745;">Add New Product for Purchase</h4>
                            <span onclick="hidePurchaseAddNewProductForm()" style="cursor:pointer; font-size: 20px; font-weight: bold; color: #dc3545;">&times;</span>
                        </div>
                        
                        <div style="padding: 15px; overflow-y: auto; flex: 1;">
                            <style>
                                #purchaseNewProductContainer .form-group { margin-bottom: 8px; }
                                #purchaseNewProductContainer label { margin-bottom: 2px; font-size: 13px; font-weight: bold; color: #495057; }
                                #purchaseNewProductContainer input, #purchaseNewProductContainer select { padding: 4px 8px; height: 32px; font-size: 13px; }
                                #purchaseNewProductContainer .btn { padding: 4px 12px; font-size: 13px; height: 32px; }
                                #purchaseNewProductContainer .compact-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; align-items: end; }
                            </style>

                            <!-- Row 1: Barcode and Image -->
                            <div class="compact-grid" style="margin-bottom: 8px;">
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Barcode</label>
                                    <div style="display: flex; gap: 5px;">
                                        <input type="text" id="newProductBarcode" placeholder="Scan or enter barcode" style="flex: 1;">
                                        <button type="button" class="btn btn-info" onclick="openScannerModal('newProduct')">📷 Scan</button>
                                        <button type="button" class="btn btn-secondary" onclick="generateNewProductBarcode()" style="background-color: #6c757d; color: white;">⚡ Auto-Generate</button>
                                    </div>
                                </div>
                                <div class="form-group" style="grid-column: span 2; display: flex; align-items: end; gap: 10px;">
                                    <div style="flex: 1;">
                                        <label>Product Image (Optional)</label>
                                        <input type="file" id="newProductImage" accept="image/*" class="form-control" onchange="previewProductImage(this, 'newProductImagePreview', 'newProductImageBase64', 'newProductImageClear')" style="padding: 2px;">
                                        <input type="hidden" id="newProductImageBase64">
                                    </div>
                                    <div style="position: relative; height: 32px; width: 32px; flex-shrink: 0;">
                                        <img id="newProductImagePreview" src="" alt="Preview" style="display: none; width: 100%; height: 100%; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
                                        <span id="newProductImageClear" onclick="clearProductImage('newProductImage', 'newProductImagePreview', 'newProductImageBase64', 'newProductImageClear')" style="display: none; position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; width: 16px; height: 16px; text-align: center; line-height: 14px; cursor: pointer; font-size: 12px; font-weight: bold;">&times;</span>
                                        <div id="newProductImageInfo" style="display: none;"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="compact-grid">
                                <div class="form-group">
                                    <label>Product Name</label>
                                    <input type="text" id="newProductName" required placeholder="e.g., Blue Ballpoint Pen">
                                </div>
                                <div class="form-group gst-field" style="display:none;">
                                    <label>HSN/SAC Code</label>
                                    <input type="text" id="newProductHSN" placeholder="e.g. 4820">
                                </div>
                                <div class="form-group">
                                    <label>Category</label>
                                    <select id="newProductCategory">
                                        <option value="">Select Category...</option>
                                        <option value="BAGS & TRAVEL ACCESSORIES">BAGS & TRAVEL ACCESSORIES</option>
                                        <option value="BEAUTY & PERSONAL CARE">BEAUTY & PERSONAL CARE</option>
                                        <option value="CLEANING & HYGIENE ITEMS">CLEANING & HYGIENE ITEMS</option>
                                        <option value="ELECTRONICS ACCESSORIES">ELECTRONICS ACCESSORIES</option>
                                        <option value="FANCY ITEMS">FANCY ITEMS</option>
                                        <option value="GIFT PACKS / RETURN GIFTS">GIFT PACKS / RETURN GIFTS</option>
                                        <option value="HARDWARE & TOOLS">HARDWARE & TOOLS</option>
                                        <option value="HOUSEHOLD ITEMS">HOUSEHOLD ITEMS</option>
                                        <option value="KITCHEN ACCESSORIES">KITCHEN ACCESSORIES</option>
                                        <option value="MOBILE ACCESSORIES">MOBILE ACCESSORIES</option>
                                        <option value="PARTY & CELEBRATION ITEMS">PARTY & CELEBRATION ITEMS</option>
                                        <option value="PLASTIC ITEMS">PLASTIC ITEMS</option>
                                        <option value="SNACKS & PACKAGED FOODS">SNACKS & PACKAGED FOODS</option>
                                        <option value="SPORTS ITEMS">SPORTS ITEMS</option>
                                        <option value="STATIONERY ITEM">STATIONERY ITEM</option>
                                        <option value="TOYS & KIDS ITEMS">TOYS & KIDS ITEMS</option>
                                        <option value="Other">Other (Custom...)</option>
                                    </select>
                                    <input type="text" id="newProductCustomCategory" placeholder="Enter custom category" style="display:none;margin-top:4px; width: 100%;" />
                                </div>
                                <div class="form-group">
                                    <label>Base Unit (single item info)</label>
                                    <select id="newProductUnit">
                                        <option value="">Select Unit...</option>
                                        <option value="Piece">Piece</option>
                                        <option value="Pack">Pack</option>
                                        <option value="Box">Box</option>
                                        <option value="Set">Set</option>
                                        <option value="Pair">Pair</option>
                                        <option value="Dozen">Dozen</option>
                                        <option value="Bundle">Bundle</option>
                                        <option value="Carton">Carton</option>
                                        <option value="Roll">Roll</option>
                                        <option value="Bag">Bag</option>
                                        <option value="Packet">Packet</option>
                                        <option value="Kilogram">Kilogram (kg)</option>
                                        <option value="Gram">Gram (g)</option>
                                        <option value="Litre">Litre (L)</option>
                                        <option value="Millilitre">Millilitre (ml)</option>
                                        <option value="Meter">Meter (m)</option>
                                        <option value="Centimeter">Centimeter (cm)</option>
                                        <option value="Inch">Inch</option>
                                        <option value="Feet">Feet</option>
                                        <option value="Bottle">Bottle</option>
                                        <option value="Tin">Tin</option>
                                        <option value="Can">Can</option>
                                        <option value="Tube">Tube</option>
                                        <option value="Tray">Tray</option>
                                        <option value="Cup">Cup</option>
                                        <option value="Unit">Unit</option>
                                        <option value="Sheet">Sheet</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label>Quantity Type</label>
                                    <select id="newProductQuantityType" onchange="document.getElementById('newProductDecimalPrecisionContainer').style.display = this.value === 'decimal' ? 'block' : 'none'">
                                        <option value="whole" selected>Whole Number</option>
                                        <option value="decimal">Decimal</option>
                                    </select>
                                </div>
                                <div class="form-group" id="newProductDecimalPrecisionContainer" style="display: none;">
                                    <label>Decimal Precision</label>
                                    <select id="newProductDecimalPrecision">
                                        <option value="0.1">0.1</option>
                                        <option value="0.01" selected>0.01</option>
                                        <option value="0.001">0.001</option>
                                    </select>
                                </div>
                                <div class="form-group gst-field" style="display:none;">
                                    <label>GST Rate (%)</label>
                                    <select id="newProductGSTRate" onchange="document.getElementById('newProductCustomGSTRate').style.display = this.value === 'custom' ? 'block' : 'none'">
                                        <option value="0">0%</option>
                                        <option value="5">5%</option>
                                        <option value="12">12%</option>
                                        <option value="18">18%</option>
                                        <option value="28">28%</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                    <input type="number" id="newProductCustomGSTRate" placeholder="Enter %" style="display:none; margin-top:4px;" min="0" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Selling Price (₹)</label>
                                    <input type="number" id="newProductSellingPrice" placeholder="10.00">
                                </div>
                                <div class="form-group">
                                    <label>Buying Price (₹)</label>
                                    <input type="number" id="newProductPurchasePrice" placeholder="0.00">
                                </div>
                            </div>

                            <!-- Pack Sizes Section -->
                            <div class="form-group" style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6; margin-top: 10px; margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                    <label style="margin: 0;">Pack Sizes (whole size item info)</label>
                                    <button type="button" class="btn btn-info btn-sm" onclick="addPackSizeInput('', '', '', 'purchasePackSizesContainer')">+ Add Pack Size</button>
                                </div>
                                <div id="purchasePackSizesContainer">
                                    <!-- Dynamic pack size inputs will be added here -->
                                </div>
                            </div>

                            <!-- Last Row -->
                            <div class="compact-grid">
                                <div class="form-group">
                                    <label>Current Stock</label>
                                    <input type="number" id="newProductInitialStock" value="0" oninput="calculateNewProductMinStock()">
                                </div>
                                <div class="form-group">
                                    <label>Minimum Stock Level</label>
                                    <input type="number" id="newProductMinStock" value="0">
                                </div>
                                <div class="form-group">
                                    <label>Supplier</label>
                                    <input type="text" id="newProductSupplier" placeholder="Optional">
                                </div>
                                <div class="form-group">
                                    <label>Description</label>
                                    <input type="text" id="newProductDescription" placeholder="Optional product description">
                                </div>
                            </div>
                        </div>
                        
                        <div style="padding: 10px 15px; border-top: 1px solid #eee; display: flex; gap: 10px; justify-content: flex-end; background: #f8f9fa; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                            <button class="btn btn-secondary" onclick="hidePurchaseAddNewProductForm()">❌ Cancel</button>
                            <button class="btn btn-primary" onclick="addNewProductToPurchase()">Add Product</button>
                        </div>
                    </div>
                </div>

                `;
    html = html.substring(0, startIndex) + newContent + html.substring(endIndex);
    fs.writeFileSync('final.html', html, 'utf8');
    console.log("Successfully replaced modal.");
} else {
    console.log("Failed to find start or end tags.");
}
