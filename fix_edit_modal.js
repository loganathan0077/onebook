const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

// 1. Update editProductModal container and content wrappers to use the new compact grid layout

const oldHeader = `<div id="editProductModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Product</h2>
                <button class="modal-close" onclick="closeEditProductModal()">&times;</button>
            </div>
            <form id="editProductForm" onsubmit="saveEditedProduct(event)">`;

const newHeader = `<div id="editProductModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 2050; padding: 20px; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 8px; width: 100%; max-width: 1000px; max-height: calc(100vh - 40px); display: flex; flex-direction: column; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin: auto;">
            <div style="padding: 10px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; border-radius: 8px 8px 0 0;">
                <h4 style="margin: 0; color: #333;">✏️ Edit Product</h4>
                <span onclick="closeEditProductModal()" style="cursor:pointer; font-size: 20px; font-weight: bold; color: #dc3545;">&times;</span>
            </div>
            <div style="padding: 15px; overflow-y: auto; flex: 1;">
            <form id="editProductForm" onsubmit="saveEditedProduct(event)">`;

html = html.replace(oldHeader, newHeader);

// Fix the closing tags at the bottom of the form
const oldFooter = `                <button type="button" class="btn btn-warning" onclick="closeEditProductModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
        </div>
    </div>`;

const newFooter = `                <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid #eee; padding-top: 15px;">
                    <button type="button" class="btn btn-warning" onclick="closeEditProductModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">✅ Save Changes</button>
                </div>
            </form>
            </div>
        </div>
    </div>`;

html = html.replace(oldFooter, newFooter);

// Also need to fix openEditProductModal / closeEditProductModal to use inline styles if any
// But they already set display='flex' and display='none', which works perfectly with the new container.

fs.writeFileSync('final.html', html, 'utf8');
console.log("Edit Modal styled!");
