import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Receipt display
old_receipt_date = "<p><strong>Date:</strong> ${date.toLocaleDateString()}</p>\n                    <p><strong>Time:</strong> ${date.toLocaleTimeString()}</p>"
new_receipt_date = "<p><strong>Sale Date:</strong> ${formatDateLocalDMY(lastSaleData.date)}</p>\n                    <p><strong>Entered On:</strong> ${lastSaleData.createdAt ? formatCreatedAtLocal(lastSaleData.createdAt) : '-'}</p>"
content = content.replace(old_receipt_date, new_receipt_date)

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Receipt UI fixed")
