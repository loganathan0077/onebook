import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Date,Time,Barcode,Product,HSN,GST%,Unit,Quantity,Unit Price,Total,Bill No,Customer,Payment Method
old_header1 = "let csv = 'Date,Time,Barcode,Product,HSN,GST%,Unit,Quantity,Unit Price,Total,Bill No,Customer,Payment Method\\n';"
new_header1 = "let csv = 'Sale Date,Entry Date & Time,Barcode,Product,HSN,GST%,Unit,Quantity,Unit Price,Total,Bill No,Customer,Payment Method\\n';"
content = content.replace(old_header1, new_header1)

# Replace the row mapping for old_header1 (line 2681ish)
old_row1 = r"csv += `${saleDate},${date.toLocaleTimeString()},${item.barcode || ''},\"${item.productName}\",${item.hsn || ''},${item.gstRate || 0}%,${item.unit || ''},${item.quantity},${item.price},${item.total},${sale.receiptNumber},\"${sale.customerName || 'Walk-in Customer'}\",${sale.paymentMethod}\\n`;"
new_row1 = r"const entryTime = sale.createdAt ? new Date(sale.createdAt).toLocaleString() : ''; csv += `${saleDate},${entryTime},${item.barcode || ''},\"${item.productName}\",${item.hsn || ''},${item.gstRate || 0}%,${item.unit || ''},${item.quantity},${item.price},${item.total},${sale.receiptNumber},\"${sale.customerName || 'Walk-in Customer'}\",${sale.paymentMethod}\\n`;"
content = content.replace(old_row1, new_row1)

# Second header (line 20017)
old_header2 = r"let csv = 'Date,Time,Bill No,Counter,Customer,Subtotal,Discount,Total,Payment Method\\n';"
new_header2 = r"let csv = 'Sale Date,Entry Date & Time,Bill No,Counter,Customer,Subtotal,Discount,Total,Payment Method\\n';"
content = content.replace(old_header2, new_header2)

# Second row (line 20017)
old_row2 = r"csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${sale.receiptNumber},${sale.counterCode || '-'},\"${sale.customerName || 'Walk-in Customer'}\",${b.subtotal},${b.discount},${b.total},${sale.paymentMethod}\\n`;"
new_row2 = r"const entryTime = sale.createdAt ? new Date(sale.createdAt).toLocaleString() : ''; csv += `${formatDateLocal(sale.date)},${entryTime},${sale.receiptNumber},${sale.counterCode || '-'},\"${sale.customerName || 'Walk-in Customer'}\",${b.subtotal},${b.discount},${b.total},${sale.paymentMethod}\\n`;"
content = content.replace(old_row2, new_row2)

# Third header (line 20024)
old_header3 = r"let csv = 'Date,Time,Barcode,Product,HSN,GST%,Unit,Quantity,Unit Price,Total,Bill No,Counter,Customer,Payment Method\\n';"
new_header3 = r"let csv = 'Sale Date,Entry Date & Time,Barcode,Product,HSN,GST%,Unit,Quantity,Unit Price,Total,Bill No,Counter,Customer,Payment Method\\n';"
content = content.replace(old_header3, new_header3)

# Third row
old_row3 = r"csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${sale.barcode||''},\"${sale.productName}\",${sale.hsn||''},${sale.gstRate||0}%,${sale.unit||''},${sale.quantity},${sale.price},${sale.total},${sale.receiptNumber},${sale.counterCode || '-'},\"${sale.customerName||'Walk-in Customer'}\",${sale.paymentMethod}\\n`;"
new_row3 = r"const entryTime = sale.createdAt ? new Date(sale.createdAt).toLocaleString() : ''; csv += `${formatDateLocal(sale.date)},${entryTime},${sale.barcode||''},\"${sale.productName}\",${sale.hsn||''},${sale.gstRate||0}%,${sale.unit||''},${sale.quantity},${sale.price},${sale.total},${sale.receiptNumber},${sale.counterCode || '-'},\"${sale.customerName||'Walk-in Customer'}\",${sale.paymentMethod}\\n`;"
content = content.replace(old_row3, new_row3)

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("CSV exports patched.")
