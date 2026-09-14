const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

// 1. Center the modal wrapper
html = html.replace(
    '<div id="purchaseModal" class="modal">',
    '<div id="purchaseModal" class="modal" style="align-items: center; justify-content: center; padding: 20px;">'
);

// 2. Adjust modal content
html = html.replace(
    '<div class="modal-content" style="max-width: 1200px; width: 95%;">',
    '<div class="modal-content" style="max-width: 1200px; width: 95%; max-height: calc(100vh - 40px); display: flex; flex-direction: column; padding: 20px;">'
);

// 3. Compact header
html = html.replace(
    /<div class="modal-header">\s*<h2>🛍️ Purchase \/ Supplier Bill<\/h2>\s*<button class="modal-close" onclick="closePurchaseModal\(\)">&times;<\/button>\s*<\/div>/,
    `<div class="modal-header" style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #dee2e6;">
                <h2 style="margin: 0; font-size: 1.5rem; color: #333;">🛍️ Purchase / Supplier Bill</h2>
                <button class="modal-close" onclick="closePurchaseModal()" style="font-size: 24px; padding: 0;">&times;</button>
            </div>`
);

// 4. Wrap the rest in a scrollable body
html = html.replace(
    '<div id="purchaseBillFormGrid" class="form-grid" style="margin-bottom: 20px;">',
    '<div style="overflow-y: auto; flex: 1; padding-right: 5px;">\n            <div id="purchaseBillFormGrid" class="form-grid" style="margin-bottom: 15px; gap: 10px; grid-template-columns: repeat(3, 1fr);">'
);

// Close the scrollable body right before purchaseBillActions
html = html.replace(
    '<div id="purchaseBillActions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">',
    '</div>\n            <div id="purchaseBillActions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6; background: white;">'
);

// Add global compact styles specifically for this modal to save vertical space
const compactStyles = `
            <style>
                #purchaseModal .form-group { margin-bottom: 8px; }
                #purchaseModal label { margin-bottom: 2px; font-size: 13px; font-weight: bold; }
                #purchaseModal input, #purchaseModal select { padding: 4px 8px; height: 32px; font-size: 13px; }
                #purchaseModal .btn { padding: 4px 12px; font-size: 13px; height: 32px; display: inline-flex; align-items: center; justify-content: center; }
                #purchaseFindProductHeader { margin-bottom: 10px !important; }
                #purchaseFindProductHeader input { height: 32px !important; }
                #purchaseModal .table th, #purchaseModal .table td { padding: 6px 10px; font-size: 13px; }
                #purchasePaymentSection { padding: 10px !important; margin-top: 10px !important; }
                #purchasePaymentSection h4 { margin-bottom: 10px; font-size: 14px; }
            </style>
`;

html = html.replace(
    '<div class="modal-header" style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #dee2e6;">',
    compactStyles + '\n            <div class="modal-header" style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #dee2e6;">'
);

// Fix height of buttons in Find Product section
html = html.replace(
    /style="height: 46px;"/g,
    'style="height: 32px;"'
);

fs.writeFileSync('final.html', html, 'utf8');
console.log("Optimized Purchase modal");
