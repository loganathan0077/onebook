const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

const targetBlockStart = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                    <h2 class="section-title" style="margin-bottom: 0px; border-bottom: none;">Product Management</h2>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="openPurchaseModal()">➕ Purchase (Bill Entry)</button>
                        <button class="btn btn-info" onclick="openPurchaseHistoryModal()">📜 Purchase History</button>
                        <button class="btn btn-secondary" onclick="openSupplierManagementModal()">👤 Supplier Details</button>
                        <button class="btn btn-secondary" onclick="openCustomerManagementModal()">👥 Customer Details</button>
                    </div>
                </div>`;

const targetBlock2 = `<div style="margin-bottom: 30px; padding: 15px; background: #fff3e0; border: 1px solid #ffcc80; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <h3 style="margin-top: 0; color: #e65100; font-size: 1.2em; border-bottom: 1px solid #ffe0b2; padding-bottom: 10px; margin-bottom: 15px;">Financial Tracking</h3>
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <button class="btn" onclick="switchTab('receivables')" style="flex: 1; padding: 12px; font-size: 1.1em; background: var(--th-primary, #f57c00); color: white; border: none; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;">💰 Customer Receivables</button>
                        <button class="btn" onclick="switchTab('payables')" style="flex: 1; padding: 12px; font-size: 1.1em; background: var(--th-primary-start, #ef6c00); color: white; border: none; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;">💳 Supplier Payables</button>
                    </div>
                </div>
                
                <!-- Main Product Form Removed (Use Purchase Button) -->`;

if (html.includes(targetBlockStart) && html.includes(targetBlock2)) {
    // 1. Remove the old blocks and keep just the title
    const newTitle = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 15px;">
                    <h2 class="section-title" style="margin-bottom: 0px; border-bottom: none;">Product Management</h2>
                </div>`;
    
    html = html.replace(targetBlockStart, newTitle);
    html = html.replace(targetBlock2, "");

    // 2. Inject the new Purchase & Parties section after the products table
    const tableEnd = `                    </table>
                </div>
            </div>`;
    
    const newSection = `                    </table>
                </div>
                
                <!-- Purchase & Parties Section -->
                <div style="margin-top: 40px; margin-bottom: 10px;">
                    <h3 class="section-title" style="margin: 0; margin-bottom: 15px;">💼 Purchase & Parties</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                        
                        <button class="btn btn-primary" onclick="openPurchaseModal()" style="padding: 20px; font-size: 1.1em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; border-radius: 8px; font-weight: 600;">
                            <span style="font-size: 2em; line-height: 1;">➕</span>
                            Purchase / Bill Entry
                        </button>
                        
                        <button class="btn btn-warning" onclick="openPurchaseHistoryModal()" style="padding: 20px; font-size: 1.1em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; border-radius: 8px; font-weight: 600; background-color: #ffc107; color: #212529; border-color: #ffc107;">
                            <span style="font-size: 2em; line-height: 1;">🧾</span>
                            Purchase History
                        </button>
                        
                        <button class="btn btn-secondary" onclick="openSupplierManagementModal()" style="padding: 20px; font-size: 1.1em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; border-radius: 8px; font-weight: 600;">
                            <span style="font-size: 2em; line-height: 1;">👤</span>
                            Supplier Details
                        </button>

                        <button class="btn btn-secondary" onclick="openCustomerManagementModal()" style="padding: 20px; font-size: 1.1em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; border-radius: 8px; font-weight: 600;">
                            <span style="font-size: 2em; line-height: 1;">👥</span>
                            Customer Details
                        </button>

                        <button class="btn" onclick="switchTab('receivables')" style="background: var(--th-primary, #f57c00); color: white; padding: 20px; font-size: 1.1em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <span style="font-size: 2em; line-height: 1;">💰</span>
                            Customer Receivables
                        </button>

                        <button class="btn" onclick="switchTab('payables')" style="background: var(--th-primary-start, #ef6c00); color: white; padding: 20px; font-size: 1.1em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <span style="font-size: 2em; line-height: 1;">💳</span>
                            Supplier Payables
                        </button>
                        
                    </div>
                </div>
            </div>`;
            
    html = html.replace(tableEnd, newSection);
    fs.writeFileSync('final.html', html, 'utf8');
    console.log("Successfully reorganized Product Management page.");
} else {
    console.log("Failed to find target blocks for replacement.");
}
