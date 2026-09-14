const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

// Helper to replace modal wrappers and headers
function optimizeModal(html, modalId, modalTitleStr, closeFn) {
    const startStr = `<div id="${modalId}" class="modal">`;
    const headerRegex = new RegExp(`<div class="modal-header">\\s*<h2>.*?${modalTitleStr}.*?<\\/h2>\\s*<button class="modal-close".*?>&times;<\\/button>\\s*<\\/div>`, 's');
    
    html = html.replace(startStr, `<div id="${modalId}" class="modal" style="align-items: center; justify-content: center; padding: 20px;">`);
    
    // Also adjust the modal-content inside it. We need to find the next modal-content div.
    // Instead of regex, just do a string replace if we know the rough match.
    // Actually, let's use a simpler replace strategy for the content.
    return html;
}

// 1. Purchase History Modal
html = html.replace(
    '<div id="purchaseHistoryModal" class="modal">',
    '<div id="purchaseHistoryModal" class="modal" style="align-items: center; justify-content: center; padding: 20px;">'
);
html = html.replace(
    '<div class="modal-content" style="max-width: 1000px;">\n            <div class="modal-header">\n                <h2>📜 Purchase History</h2>\n                <button class="modal-close" onclick="closePurchaseHistoryModal()">&times;</button>\n            </div>',
    '<div class="modal-content" style="max-width: 1000px; width: 95%; max-height: calc(100vh - 40px); display: flex; flex-direction: column; padding: 20px;">\n            <div class="modal-header" style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #dee2e6;">\n                <h2 style="margin: 0; font-size: 1.5rem; color: #333;">📜 Purchase History</h2>\n                <button class="modal-close" onclick="closePurchaseHistoryModal()" style="font-size: 24px; padding: 0;">&times;</button>\n            </div>'
);
html = html.replace(
    '<div\n                style="padding: 15px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; gap: 10px; display: flex; flex-wrap: wrap; align-items: center;">',
    '<div style="padding: 10px 0; border-bottom: 1px solid #dee2e6; gap: 10px; display: flex; flex-wrap: wrap; align-items: center; margin-bottom: 10px;">'
);
// Make purchase history table scrollable flex item
html = html.replace(
    /<div style="overflow-x: auto;">\s*<table class="table">\s*<thead>/s,
    '<div style="overflow: auto; flex: 1;">\n                <table class="table">\n                    <thead style="position: sticky; top: 0; z-index: 10;">'
);


// 2. Supplier Details Modal
html = html.replace(
    '<div id="supplierManagementModal" class="modal">',
    '<div id="supplierManagementModal" class="modal" style="align-items: center; justify-content: center; padding: 20px;">'
);
html = html.replace(
    '<div class="modal-content" style="max-width: 900px; width: 90%;">\n            <div class="modal-header">\n                <h2>👤 Supplier Details</h2>\n                <button class="modal-close" onclick="closeSupplierManagementModal()">&times;</button>\n            </div>',
    '<div class="modal-content" style="max-width: 900px; width: 95%; max-height: calc(100vh - 40px); display: flex; flex-direction: column; padding: 20px;">\n            <div class="modal-header" style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #dee2e6;">\n                <h2 style="margin: 0; font-size: 1.5rem; color: #333;">👤 Supplier Details</h2>\n                <button class="modal-close" onclick="closeSupplierManagementModal()" style="font-size: 24px; padding: 0;">&times;</button>\n            </div>'
);
html = html.replace(
    /<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px; flex-wrap: wrap;">/,
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px; flex-wrap: wrap;">'
);
html = html.replace(
    /<div class="table-responsive">\s*<table class="table">\s*<thead>/s,
    '<div class="table-responsive" style="overflow: auto; flex: 1;">\n                <table class="table" style="margin: 0;">\n                    <thead style="position: sticky; top: 0; z-index: 10; background: #343a40; color: white;">'
);

// 3. Customer Details Modal
html = html.replace(
    '<div id="customerManagementModal" class="modal">',
    '<div id="customerManagementModal" class="modal" style="align-items: center; justify-content: center; padding: 20px;">'
);
html = html.replace(
    '<div class="modal-content" style="max-width: 900px; width: 90%;">\n            <div class="modal-header">\n                <h2>👥 Customer Management</h2>\n                <button class="modal-close" onclick="closeCustomerManagementModal()">&times;</button>\n            </div>',
    '<div class="modal-content" style="max-width: 900px; width: 95%; max-height: calc(100vh - 40px); display: flex; flex-direction: column; padding: 20px;">\n            <div class="modal-header" style="padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #dee2e6;">\n                <h2 style="margin: 0; font-size: 1.5rem; color: #333;">👥 Customer Details</h2>\n                <button class="modal-close" onclick="closeCustomerManagementModal()" style="font-size: 24px; padding: 0;">&times;</button>\n            </div>'
);
html = html.replace(
    /<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 15px; flex-wrap: wrap;">/,
    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px; flex-wrap: wrap;">'
);
html = html.replace(
    /<div class="table-responsive">\s*<table class="table">\s*<thead>/s,
    '<div class="table-responsive" style="overflow: auto; flex: 1;">\n                <table class="table" style="margin: 0;">\n                    <thead style="position: sticky; top: 0; z-index: 10; background: #343a40; color: white;">'
);


fs.writeFileSync('final.html', html, 'utf8');
console.log("Optimized Customer, Supplier, and History modals");
