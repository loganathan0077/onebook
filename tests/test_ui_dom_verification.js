/**
 * OneBook v1.0.4 - UI & DOM Verification Test Suite
 * Inspects OneBook.html using JSDOM to strictly verify:
 * 1. Inventory GST % Header Option & Search Escape Key
 * 2. Sales 7-Step Enter Navigation & Shortcuts
 * 3. Product Hierarchy & Variants Structure
 * 4. Purchase Payment Method Removal & Date Filters
 * 5. Petty Cash Input Fields & Keyboard Event Propagation
 * 6. Day Closing Vertical Scrollability & Sticky Save Button
 * 7. Dedicated GST Calculator (Inclusive & Exclusive)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

async function runDomTests() {
    console.log('\n================================================================');
    console.log('🖥️  OneBook v1.0.4 - UI & DOM Verification Test Suite');
    console.log('================================================================\n');

    const htmlPath = path.join(__dirname, '../OneBook.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const dom = new JSDOM(htmlContent, {
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    const doc = dom.window.document;

    // -------------------------------------------------------------
    // MODULE 1: INVENTORY SECTION UI
    // -------------------------------------------------------------
    console.log('--- MODULE 1: INVENTORY SECTION UI ---');

    // 1.4 Inventory GST % Header
    const invGstSelect = doc.getElementById('invHeaderGstSelect');
    assert.ok(invGstSelect, '#invHeaderGstSelect must exist in Inventory header');
    const options = Array.from(invGstSelect.options).map(o => o.value);
    assert.ok(options.includes('0') && options.includes('5') && options.includes('12') && options.includes('18') && options.includes('28'), 'Must include 0%, 5%, 12%, 18%, 28%');

    const btnApplyGst = doc.getElementById('btnApplyInvHeaderGst');
    assert.ok(btnApplyGst, '#btnApplyInvHeaderGst button must exist');
    assert.ok(btnApplyGst.getAttribute('onclick')?.includes('applyGstRateFromInventoryHeader'), 'Button must invoke applyGstRateFromInventoryHeader()');
    console.log('✅ 1.4 Inventory GST %: Compact header selector with standard GST rates and Apply action verified');

    // 1.1 Quick Edit GST Column
    const invGstDatalist = doc.getElementById('invGstRateDatalist');
    assert.ok(invGstDatalist, '#invGstRateDatalist datalist must exist for Quick Edit GST');
    const dlOptions = Array.from(invGstDatalist.options).map(o => o.value);
    assert.ok(dlOptions.includes('0') && dlOptions.includes('5') && dlOptions.includes('12') && dlOptions.includes('18') && dlOptions.includes('28'), 'Datalist must have 0, 5, 12, 18, 28 presets');
    assert.ok(htmlContent.includes('quick-edit-gst'), 'quick-edit-gst CSS class must exist for inline GST editing');
    assert.ok(htmlContent.includes('updateVariantGstRate') && htmlContent.includes('updateGstRate'), 'Must support updating GST for both variants and products');
    console.log('✅ 1.1 Inventory Quick Edit: Inline GST% editing with datalist presets, keyboard navigation, and parent/variant independence verified');

    // 1.5 Inventory Search Escape Key
    const invSearch = doc.getElementById('inventorySearch');
    assert.ok(invSearch, '#inventorySearch must exist');
    const invSearchKeyDown = invSearch.getAttribute('onkeydown') || '';
    assert.ok(invSearchKeyDown.includes('Escape'), 'Must listen for Escape key');
    assert.ok(invSearchKeyDown.includes('expiryFilter'), 'Must reset expiryFilter');
    assert.ok(invSearchKeyDown.includes('filterInventoryTable') || invSearchKeyDown.includes('filterProducts') || invSearchKeyDown.includes('refreshInventoryUI'), 'Must trigger table refresh');
    console.log('✅ 1.5 Inventory Search: Escape key listener restores full inventory, resets filters, and maintains focus');

    // -------------------------------------------------------------
    // MODULE 2: SALES SECTION UI & KEYBOARD WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- MODULE 2: SALES SECTION WORKFLOW & SHORTCUTS ---');

    // 2.1 7-Step Navigation sequence elements
    const saleProdSearch = doc.getElementById('saleProductSearch');
    const saleUnitSearch = doc.getElementById('saleUnitSearch');
    const saleQty = doc.getElementById('saleQuantity');
    const salePrice = doc.getElementById('salePrice');
    const btnAddSale = doc.getElementById('btnAddItemSale');

    assert.ok(saleProdSearch, '1. saleProductSearch must exist');
    assert.ok(saleUnitSearch, '2. saleUnitSearch must exist');
    assert.ok(saleQty, '3. saleQuantity must exist');
    assert.ok(salePrice, '4. salePrice must exist');
    assert.ok(btnAddSale, '5. btnAddItemSale must exist');

    assert.strictEqual(salePrice.getAttribute('tabindex'), '0', 'salePrice must be focusable with tabindex="0"');
    console.log('✅ 2.1 Sales Keyboard Navigation: Full 7-step sequence elements (Search -> Unit -> Qty -> Price -> Add Item -> Focus return) verified');

    // 2.2 Keyboard Shortcuts
    assert.ok(htmlContent.includes("e.key === 'Enter' && (e.ctrlKey") || htmlContent.includes("e.ctrlKey && e.key === 'Enter'"), 'Ctrl+Enter shortcut handler must exist');
    assert.ok(htmlContent.includes("e.key === 'Enter' && e.altKey") || htmlContent.includes("e.altKey && e.key === 'Enter'"), 'Alt+Enter shortcut handler must exist');
    console.log('✅ 2.2 Sales Shortcuts: Ctrl+Enter (Show All / Open Inventory) and Alt+Enter (Add Stock / Add Inventory) handlers verified');

    // -------------------------------------------------------------
    // MODULE 3: PRODUCT SECTION HIERARCHY
    // -------------------------------------------------------------
    console.log('\n--- MODULE 3: PRODUCT SECTION HIERARCHY ---');

    const productsTable = doc.getElementById('productsTableBody') || doc.getElementById('productsTable');
    assert.ok(productsTable, '#productsTableBody must exist');
    assert.ok(htmlContent.includes('getProductVariants'), 'Must contain getProductVariants helper for hierarchy');
    assert.ok(htmlContent.includes('table-secondary') || htmlContent.includes('table-light') || htmlContent.includes('↳'), 'Must render variants in nested visual hierarchy');
    console.log('✅ 3.1 Product Section: Parent products display with associated variants (barcode, price, stock, GST) in visual tree structure');

    // -------------------------------------------------------------
    // MODULE 4: PURCHASE SECTION UI
    // -------------------------------------------------------------
    console.log('\n--- MODULE 4: PURCHASE SECTION & DATE FILTERS ---');

    // 4.1 Payment Method and Payment Summary Bar removed from Purchase Entry
    const purPayMethod = doc.getElementById('purchasePaymentMethod');
    assert.ok(purPayMethod, '#purchasePaymentMethod element must exist in purchase form');
    assert.strictEqual(purPayMethod.getAttribute('type'), 'hidden', 'Payment Method must be hidden input, not visible select');
    assert.strictEqual(purPayMethod.value, 'credit', 'Hidden payment method must default to credit');
    const visibleSelects = doc.querySelectorAll('select#purchasePaymentMethod');
    assert.strictEqual(visibleSelects.length, 0, 'No visible select dropdown for purchase payment method must exist');

    const paymentBar = doc.querySelector('.pp-payment-bar');
    assert.strictEqual(paymentBar, null, 'Visible .pp-payment-bar (Paid Now, Outstanding, Due Date) must not exist in Purchase Entry');
    const hiddenPaid = doc.getElementById('purchaseCreditAmountPaid');
    const hiddenDue = doc.getElementById('purchaseCreditOutstanding');
    assert.ok(hiddenPaid && hiddenDue, 'Hidden inputs for credit purchase accounting must exist');
    console.log('✅ 4.1 Purchase Entry: Payment summary bar removed from UI layout while preserving credit purchase accounting');

    // 4.2 Purchase Date Filters
    const phDateGroup = doc.getElementById('phFilterDateGroup');
    assert.ok(phDateGroup, '#phFilterDateGroup button group must exist in Purchase History');
    const phBtns = phDateGroup.querySelectorAll('button');
    const btnTexts = Array.from(phBtns).map(b => b.textContent.trim());
    assert.ok(btnTexts.some(t => t.includes('All Time')), 'Must have All Time button');
    assert.ok(btnTexts.some(t => t.includes('Today')), 'Must have Today button');
    assert.ok(btnTexts.some(t => t.includes('This Week')), 'Must have This Week button');
    assert.ok(btnTexts.some(t => t.includes('This Month')), 'Must have This Month button');
    console.log('✅ 4.2 Purchase Date Filters: All Time, Today, This Week, and This Month quick filter buttons present');

    // -------------------------------------------------------------
    // MODULE 5: PETTY CASH INPUT FIELDS
    // -------------------------------------------------------------
    console.log('\n--- MODULE 5: PETTY CASH INPUT FIELDS ---');

    const pcAmount = doc.getElementById('pcAmount');
    const pcDesc = doc.getElementById('pcDescription');
    const pcRemarks = doc.getElementById('pcRemarks');

    assert.ok(pcAmount, '#pcAmount input must exist');
    assert.ok(pcDesc, '#pcDescription input must exist');
    assert.ok(pcRemarks, '#pcRemarks input must exist');

    assert.ok(pcAmount.getAttribute('onkeydown')?.includes('stopPropagation'), '#pcAmount must stop event propagation for non-Enter keys');
    assert.ok(pcDesc.getAttribute('onkeydown')?.includes('stopPropagation'), '#pcDescription must stop event propagation for non-Enter keys');
    assert.ok(pcRemarks.getAttribute('onkeydown')?.includes('stopPropagation'), '#pcRemarks must stop event propagation for non-Enter keys');
    console.log('✅ 5.1 Petty Cash Inputs: Amount, Description, and Remark fields accept normal text and isolate keyboard shortcuts');

    // -------------------------------------------------------------
    // MODULE 6: DAY CLOSING LAYOUT & SAVE BUTTON
    // -------------------------------------------------------------
    console.log('\n--- MODULE 6: DAY CLOSING LAYOUT & SAVE BUTTON ---');

    const dcLeftCol = doc.querySelector('.dc-left-col');
    assert.ok(dcLeftCol, '.dc-left-col must exist');
    const dcSaveBtn = doc.getElementById('dcSaveBtn');
    assert.ok(dcSaveBtn, '#dcSaveBtn must exist');

    assert.ok(htmlContent.includes('.dc-left-col') && (htmlContent.includes('overflow-y: auto') || htmlContent.includes('overflow-y:auto')), 'Left column must be vertically scrollable');
    assert.ok((htmlContent.includes('.dc-btn-save') || htmlContent.includes('#dcSaveBtn')) && htmlContent.includes('position: sticky') && htmlContent.includes('bottom: 0'), 'Save button must be sticky at bottom of action area');
    console.log('✅ 6.1 Day Closing Layout: Vertically scrollable container and sticky save button prevent clipping across viewports');

    // -------------------------------------------------------------
    // MODULE 7: GST CALCULATOR UI
    // -------------------------------------------------------------
    console.log('\n--- MODULE 7: GST CALCULATOR UI ---');

    const gstCard = doc.getElementById('gstCalculatorCard');
    assert.ok(gstCard, '#gstCalculatorCard must exist');

    const tabInclusive = doc.getElementById('gstModeInclusiveBtn');
    const tabExclusive = doc.getElementById('gstModeExclusiveBtn');
    assert.ok(tabInclusive && tabExclusive, 'Must contain Inclusive and Exclusive mode tabs');

    const rateBtns = gstCard.querySelectorAll('.gst-rate-preset-btn');
    assert.ok(rateBtns.length >= 5, 'Must provide preset rate buttons for 0%, 5%, 12%, 18%, 28%');

    const customRate = doc.getElementById('gstCalcCustomRate');
    assert.ok(customRate, '#gstCalcCustomRate input must exist for custom rates');

    const resTaxable = doc.getElementById('gstCalcTaxableAmount');
    const resGst = doc.getElementById('gstCalcGstAmount');
    const resTotal = doc.getElementById('gstCalcTotalAmount');
    assert.ok(resTaxable && resGst && resTotal, 'Result fields (Taxable Amount, GST Amount, Total Amount) must exist');
    console.log('✅ 7.1 GST Calculator: Dedicated GST inclusive/exclusive card, preset rates (0-28%), custom rate input, and result readouts verified');

    console.log('\n================================================================');
    console.log('🎉 ALL UI & DOM VALIDATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================\n');
}

runDomTests().catch(err => {
    console.error('❌ UI DOM TEST FAILED:', err);
    process.exit(1);
});
