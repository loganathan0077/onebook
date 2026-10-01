import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Bill CSV
old_bill_row = r"csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${b.billNo},${b.counterCode},\"${b.customer}\",${b.subtotal.toFixed(2)},${b.discount.toFixed(2)},${b.total.toFixed(2)},${b.payment}\\n`;"
new_bill_row = r"const entryTime = b.createdAt ? new Date(b.createdAt).toLocaleString() : ''; csv += `${formatDateLocalDMY(b.date)},${formatCreatedAtLocal(b.createdAt)},${b.billNo},${b.counterCode || '-'},\"${b.customer}\",${b.subtotal.toFixed(2)},${b.discount.toFixed(2)},${b.total.toFixed(2)},${b.payment}\\n`;"
content = content.replace(old_bill_row, new_bill_row)

# Fix Items CSV
old_item_row = r"csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${sale.barcode||''},\"${sale.productName}\",${sale.hsn||''},${sale.gstRate||0}%,${sale.unit||''},${sale.quantity},${sale.price},${sale.total},${sale.receiptNumber},${sale.counterCode || '-'},\"${sale.customerName||'Walk-in Customer'}\",${sale.paymentMethod}\\n`;"
new_item_row = r"const entryTime = sale.createdAt ? new Date(sale.createdAt).toLocaleString() : ''; csv += `${formatDateLocalDMY(sale.date)},${formatCreatedAtLocal(sale.createdAt)},${sale.barcode||''},\"${sale.productName}\",${sale.hsn||''},${sale.gstRate||0}%,${sale.unit||''},${sale.quantity},${sale.price},${sale.total},${sale.receiptNumber},${sale.counterCode || '-'},\"${sale.customerName||'Walk-in Customer'}\",${sale.paymentMethod}\\n`;"
content = content.replace(old_item_row, new_item_row)

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("CSV fixed")
