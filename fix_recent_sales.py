import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the column rendering
old_td = "<td>${new Date(transaction.date).toLocaleString()}</td>"
new_td = "<td>${formatDateLocal(transaction.date)}</td>"
content = content.replace(old_td, new_td)

# Fix the header if it says Date & Time
content = content.replace("<th>Date & Time</th>", "<th>Sale Date</th>")

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Recent sales fixed.")
