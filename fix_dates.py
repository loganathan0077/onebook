import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject parseSaleDateLocal
helper_func = """
        function parseSaleDateLocal(dateStr) {
            if (!dateStr) return new Date();
            if (dateStr.includes('T')) return new Date(dateStr);
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
            return new Date(dateStr);
        }
"""
content = content.replace("function formatDateLocal(dateInput) {", helper_func + "\n        function formatDateLocal(dateInput) {")

# 2. Fix processSale saleDate assignment
process_sale_old = """                let saleDate = new Date().toISOString();
                const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
                if (settings.enableSalesDate) {
                    if (typeof isDemoMode === 'function' && isDemoMode()) {
                        // Demo Mode forces system date
                    } else {
                        const customDateVal = document.getElementById('customSaleDate') ? document.getElementById('customSaleDate').dataset.isoDate : '';
                        if (customDateVal) {
                            // Use custom date but preserve current LOCAL time for ordering
                            const now = new Date();
                            const parts = customDateVal.split('-');
                            if (parts.length === 3) {
                                now.setFullYear(parseInt(parts[0], 10));
                                now.setMonth(parseInt(parts[1], 10) - 1);
                                now.setDate(parseInt(parts[2], 10));
                                saleDate = now.toISOString();
                            }
                        }
                    }
                }"""

process_sale_new = """                const _td = new Date();
                let saleDate = `${_td.getFullYear()}-${String(_td.getMonth() + 1).padStart(2, '0')}-${String(_td.getDate()).padStart(2, '0')}`;
                const settings = JSON.parse(localStorage.getItem('settings') || 'null') || getDefaultSettings();
                if (settings.enableSalesDate) {
                    if (typeof isDemoMode === 'function' && isDemoMode()) {
                        // Demo Mode forces system date
                    } else {
                        const customDateVal = document.getElementById('customSaleDate') ? document.getElementById('customSaleDate').dataset.isoDate : '';
                        if (customDateVal) {
                            const parts = customDateVal.split('-');
                            if (parts.length === 3) {
                                saleDate = customDateVal;
                            }
                        }
                    }
                }"""
content = content.replace(process_sale_old, process_sale_new)

# 3. Fix new Date(sale.date) across the file
content = content.replace("new Date(sale.date)", "parseSaleDateLocal(sale.date)")
# Also fix globalBillDiscMap[billNo].date
content = content.replace("new Date(globalBillDiscMap[billNo].date)", "parseSaleDateLocal(globalBillDiscMap[billNo].date)")

# 4. Fix exportSalesExcelXLSX
export_excel_old = """                    'Date': parseSaleDateLocal(sale.date).toLocaleString(),"""
export_excel_new = """                    'Sale Date': formatDateLocal(sale.date),
                    'Entry Date & Time': sale.createdAt ? new Date(sale.createdAt).toLocaleString() : '',"""
content = content.replace(export_excel_old, export_excel_new)

# 5. Fix exportFilteredReport CSV
export_csv_old = """csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${sale.barcode||''},"${sale.productName}",${sale.hsn||''},${sale.gstRate||0}%,${sale.unit||''},${sale.quantity},${sale.price},${sale.total},${sale.receiptNumber},${sale.counterCode || '-'},"${sale.customerName||'Walk-in Customer'}",${sale.paymentMethod}\\n`;"""
export_csv_new = """const entryTime = sale.createdAt ? new Date(sale.createdAt).toLocaleString() : '';
                    csv += `${d.toLocaleDateString()},${entryTime},${sale.barcode||''},"${sale.productName}",${sale.hsn||''},${sale.gstRate||0}%,${sale.unit||''},${sale.quantity},${sale.price},${sale.total},${sale.receiptNumber},${sale.counterCode || '-'},"${sale.customerName||'Walk-in Customer'}",${sale.paymentMethod}\\n`;"""
content = content.replace(export_csv_old, export_csv_new)
# and its header:
export_csv_header_old = """            let csv = 'Date,Time,Barcode,Product,HSN,GST Rate,Unit,Qty,Price,Total,Bill No,Counter,Customer,Payment\\n';"""
export_csv_header_new = """            let csv = 'Sale Date,Entry Date & Time,Barcode,Product,HSN,GST Rate,Unit,Qty,Price,Total,Bill No,Counter,Customer,Payment\\n';"""
content = content.replace(export_csv_header_old, export_csv_header_new)

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched successfully")
