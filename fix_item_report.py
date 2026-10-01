import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the render row
content = content.replace("<td>${new Date(i.date).toLocaleString()}</td>", "<td>${formatDateLocalDMY(i.date)}</td>")

# Fix the sort
content = content.replace("valA = new Date(a.date); valB = new Date(b.date);", "valA = parseSaleDateLocal(a.date); valB = parseSaleDateLocal(b.date);")

# Also check for "Date ↕️" in the header if it was "Date & Time" previously
# Actually it was "Date ↕️" on line 2584. I'll just change Date to Sale Date in the header.
content = content.replace("onclick=\"sortItemWiseReport('date')\">Date ↕️</th>", "onclick=\"sortItemWiseReport('date')\">Sale Date ↕️</th>")

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Item report fixed")
