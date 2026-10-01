import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Items CSV in Day Closing
old_row = r"csv += `${date.toLocaleDateString()},${date.toLocaleTimeString()},${sale.barcode || 'N/A'},${product},${sale.hsn || ''},${sale.gstRate || 0}%,${sale.unit || 'Piece'},${sale.quantity},${sale.price},${sale.total},${sale.receiptNumber || '-'},${customer},${sale.paymentMethod}\n`;"
new_row = r"csv += `${formatDateLocalDMY(sale.date)},${formatCreatedAtLocal(sale.createdAt)},${sale.barcode || 'N/A'},${product},${sale.hsn || ''},${sale.gstRate || 0}%,${sale.unit || 'Piece'},${sale.quantity},${sale.price},${sale.total},${sale.receiptNumber || '-'},${customer},${sale.paymentMethod}\n`;"
content = content.replace(old_row, new_row)

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("CSV fixed again")
