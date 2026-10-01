import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject formatCreatedAtLocal helper
helper = """        function formatCreatedAtLocal(createdAtStr) {
            if (!createdAtStr) return '-';
            const d = new Date(createdAtStr);
            if (Number.isNaN(d.getTime())) return '-';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            let hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const strTime = String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
            return `${day}/${month}/${year} ${strTime}`;
        }
"""
content = content.replace("function formatDateLocalDMY(dateInput) {", helper + "\n        function formatDateLocalDMY(dateInput) {")

# 2. Recent Sales table
# Table Header
old_recent_header = "<th>Sale Date</th>\n                                    <th>Bill No</th>"
new_recent_header = "<th>Sale Date</th>\n                                    <th>Entry Date & Time</th>\n                                    <th>Bill No</th>"
content = content.replace(old_recent_header, new_recent_header)
# In updateTodaysSales, we must capture createdAt for the transaction
old_transaction_init = """                        saleId: sale.saleId,
                        date: sale.date,
                        receiptNumber: sale.receiptNumber || '-',"""
new_transaction_init = """                        saleId: sale.saleId,
                        date: sale.date,
                        createdAt: sale.createdAt,
                        receiptNumber: sale.receiptNumber || '-',"""
content = content.replace(old_transaction_init, new_transaction_init)

old_recent_row = "<td>${formatDateLocalDMY(transaction.date)}</td>\n                        <td>${transaction.receiptNumber}</td>"
new_recent_row = "<td>${formatDateLocalDMY(transaction.date)}</td>\n                        <td>${formatCreatedAtLocal(transaction.createdAt)}</td>\n                        <td>${transaction.receiptNumber}</td>"
content = content.replace(old_recent_row, new_recent_row)
# Wait, also we might need to add a colspan somewhere if empty?
old_recent_empty = """<td colspan="8" style="text-align: center; color: #6c757d;">No sales today</td>"""
new_recent_empty = """<td colspan="9" style="text-align: center; color: #6c757d;">No sales today</td>"""
content = content.replace(old_recent_empty, new_recent_empty)

# 3. Bill-wise Sales
# Table Header
old_billwise_header = '<th style="width: 12%">Sale Date</th>\n                                            <th style="width: 8%">Bill No</th>'
new_billwise_header = '<th style="width: 12%">Sale Date</th>\n                                            <th style="width: 14%">Entry Date & Time</th>\n                                            <th style="width: 8%">Bill No</th>'
content = content.replace(old_billwise_header, new_billwise_header)

old_bill_map = """                    billMap[sale.receiptNumber] = {
                        date: sale.date,
                        billNo: sale.receiptNumber,"""
new_bill_map = """                    billMap[sale.receiptNumber] = {
                        date: sale.date,
                        createdAt: sale.createdAt,
                        billNo: sale.receiptNumber,"""
content = content.replace(old_bill_map, new_bill_map)

old_billwise_row = "<td>${formatDateLocalDMY(b.date)}</td>\n                    <td>${b.billNo}</td>"
new_billwise_row = "<td>${formatDateLocalDMY(b.date)}</td>\n                    <td>${formatCreatedAtLocal(b.createdAt)}</td>\n                    <td>${b.billNo}</td>"
content = content.replace(old_billwise_row, new_billwise_row)

old_billwise_empty = """<td colspan="12" class="text-center">No bills found.</td>"""
new_billwise_empty = """<td colspan="13" class="text-center">No bills found.</td>"""
content = content.replace(old_billwise_empty, new_billwise_empty)

# 4. Item-wise Sales
# Table Header
old_itemwise_header = '<th style="cursor: pointer; color: #007bff; width: 8%" onclick="sortItemWiseReport(\'date\')">Sale Date ↕️</th>\n                                            <th style="cursor: pointer; color: #007bff; width: 16%" onclick="sortItemWiseReport(\'product\')">Product ↕️</th>'
new_itemwise_header = '<th style="cursor: pointer; color: #007bff; width: 8%" onclick="sortItemWiseReport(\'date\')">Sale Date ↕️</th>\n                                            <th style="width: 12%">Entry Date & Time</th>\n                                            <th style="cursor: pointer; color: #007bff; width: 16%" onclick="sortItemWiseReport(\'product\')">Product ↕️</th>'
content = content.replace(old_itemwise_header, new_itemwise_header)

old_itemwise_row = "<td>${formatDateLocalDMY(i.date)}</td>\n                    <td>${i.productName}</td>"
new_itemwise_row = "<td>${formatDateLocalDMY(i.date)}</td>\n                    <td>${formatCreatedAtLocal(i.createdAt)}</td>\n                    <td>${i.productName}</td>"
content = content.replace(old_itemwise_row, new_itemwise_row)

old_itemwise_empty = """<td colspan="12" class="text-center">No items found.</td>"""
new_itemwise_empty = """<td colspan="13" class="text-center">No items found.</td>"""
content = content.replace(old_itemwise_empty, new_itemwise_empty)
# Note: item report spans might be 13, let's fix it later.

# 5. CSV Exports
# For exportFilteredReport (bills), we need to capture createdAt
old_export_bill_map = """                            date: sale.date, billNo: sale.receiptNumber, customer: sale.customerName || 'Walk-in Customer',"""
new_export_bill_map = """                            date: sale.date, createdAt: sale.createdAt, billNo: sale.receiptNumber, customer: sale.customerName || 'Walk-in Customer',"""
content = content.replace(old_export_bill_map, new_export_bill_map)

old_export_bill_row = r"const entryTime = sale.createdAt ? new Date(sale.createdAt).toLocaleString() : ''; csv += `${formatDateLocal(sale.date)},${entryTime},${sale.receiptNumber},${sale.counterCode || '-'},\"${sale.customerName || 'Walk-in Customer'}\",${b.subtotal},${b.discount},${b.total},${sale.paymentMethod}\n`;"
new_export_bill_row = r"const entryTime = b.createdAt ? new Date(b.createdAt).toLocaleString() : ''; csv += `${formatDateLocal(b.date)},${entryTime},${b.billNo},${b.counterCode},\"${b.customer}\",${b.subtotal.toFixed(2)},${b.discount.toFixed(2)},${b.total.toFixed(2)},${b.payment}\n`;"
# Wait, let's grep the current row for exportFilteredReport first! I might have replaced it incorrectly previously.

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
