const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

const oldHtml = `<div class="pc-form-grid">
                        <div class="form-group">
                            <label>Date *</label>
                            <input type="date" id="pcDate" required>
                        </div>
                        <div class="form-group">
                            <label>Amount (₹) *</label>
                            <input type="number" id="pcAmount" step="0.01" min="0.01" placeholder="Enter amount" required>
                        </div>
                    </div>

                    <!-- Dynamic Fields Container -->
                    <div class="pc-form-grid" id="pcDynamicFields">
                        <!-- Populated by JS -->
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label>Description</label>
                        <input type="text" id="pcDescription" placeholder="Enter transaction details">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label>Remarks / Ref No</label>
                        <input type="text" id="pcRemarks" placeholder="Optional">
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-success" onclick="savePCTransaction()" id="pcSaveBtn">✅ Save Transaction</button>
                        <button class="btn btn-warning" onclick="resetPCForm()" id="pcCancelBtn" style="display: none;">✖️ Cancel Edit</button>
                    </div>`;

const newHtml = `<style>
                        /* Compact Single Row Form */
                        .pc-single-row {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 10px;
                            align-items: flex-end;
                            margin-bottom: 20px;
                            background: #f8f9fa;
                            padding: 15px;
                            border-radius: 8px;
                            border: 1px solid #dee2e6;
                        }
                        @media (min-width: 1024px) {
                            .pc-single-row {
                                flex-wrap: nowrap;
                                overflow-x: visible;
                            }
                        }
                        .pc-single-row .form-group {
                            margin: 0;
                            display: flex;
                            flex-direction: column;
                        }
                        .pc-single-row label {
                            font-size: 12px !important;
                            font-weight: bold;
                            margin-bottom: 4px;
                            white-space: nowrap;
                            color: #495057;
                        }
                        .pc-single-row input, .pc-single-row select {
                            height: 34px !important;
                            padding: 4px 8px !important;
                            font-size: 13px !important;
                            width: 100%;
                            box-sizing: border-box;
                        }
                        .pc-single-row .btn {
                            height: 34px;
                            padding: 4px 15px;
                            font-size: 13px;
                            white-space: nowrap;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                        }
                        /* Dynamic container uses display contents to let children participate in flex */
                        #pcDynamicFields {
                            display: contents;
                        }
                        /* Sizing logic */
                        .pc-col-date { flex: 0 0 130px; }
                        .pc-col-amount { flex: 0 0 110px; }
                        .pc-col-desc { flex: 2; min-width: 120px; }
                        .pc-col-remarks { flex: 1; min-width: 90px; }
                        .pc-col-actions { flex: 0 0 auto; display: flex; gap: 5px; }
                        /* For dynamic fields injected by JS */
                        #pcDynamicFields > .form-group { flex: 1.2; min-width: 120px; }
                    </style>

                    <div class="pc-single-row">
                        <div class="form-group pc-col-date">
                            <label>Date *</label>
                            <input type="date" id="pcDate" required>
                        </div>
                        <div class="form-group pc-col-amount">
                            <label>Amount (₹) *</label>
                            <input type="number" id="pcAmount" step="0.01" min="0.01" placeholder="Amount" required>
                        </div>
                        
                        <!-- Dynamic Fields Container -->
                        <div id="pcDynamicFields">
                            <!-- Populated by JS -->
                        </div>

                        <div class="form-group pc-col-desc">
                            <label>Description</label>
                            <input type="text" id="pcDescription" placeholder="Description">
                        </div>
                        
                        <div class="form-group pc-col-remarks">
                            <label>Remarks / Ref</label>
                            <input type="text" id="pcRemarks" placeholder="Optional">
                        </div>

                        <div class="pc-col-actions">
                            <button class="btn btn-success" onclick="savePCTransaction()" id="pcSaveBtn">✅ Save</button>
                            <button class="btn btn-warning" onclick="resetPCForm()" id="pcCancelBtn" style="display: none;">✖️</button>
                        </div>
                    </div>`;

if (html.includes('<div class="pc-form-grid">\n                        <div class="form-group">')) {
    html = html.replace(oldHtml, newHtml);
    fs.writeFileSync('final.html', html, 'utf8');
    console.log("Successfully replaced Petty Cash layout");
} else {
    console.log("Failed to find Petty Cash layout block");
}
