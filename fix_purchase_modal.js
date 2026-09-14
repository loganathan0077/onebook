const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

// 1. Remove 'purchaseSelectedProduct' from togglePurchaseBillElements
html = html.replace(
    `'purchaseBillActions',\n                'purchaseSelectedProduct',\n                'purchasePaymentDetails'`,
    `'purchaseBillActions',\n                'purchasePaymentDetails'`
);
// Handle potential trailing comma or spacing differences
html = html.replace(
    `'purchaseBillActions',\n                'purchaseSelectedProduct'`,
    `'purchaseBillActions'`
);

// 2. Add cancelPurchaseSelection() to openPurchaseModal
html = html.replace(
    `function openPurchaseModal() {
            window.isAddingFromSale = false;
            document.getElementById('purchaseModal').style.display = 'flex';`,
    `function openPurchaseModal() {
            window.isAddingFromSale = false;
            document.getElementById('purchaseModal').style.display = 'flex';
            cancelPurchaseSelection(); // explicitly hide and reset product selection`
);

fs.writeFileSync('final.html', html, 'utf8');
console.log("Fixed openPurchaseModal behavior");
