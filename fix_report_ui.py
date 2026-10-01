import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject formatDateLocalDMY
helper = """        function formatDateLocalDMY(dateInput) {
            const d = parseSaleDateLocal(dateInput);
            if (Number.isNaN(d.getTime())) return '';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }
"""
content = content.replace("function formatDateLocal(dateInput) {", helper + "\n        function formatDateLocal(dateInput) {")

# 2. Fix updateTodaysSales
old_recent = "<td>${formatDateLocal(transaction.date)}</td>"
new_recent = "<td>${formatDateLocalDMY(transaction.date)}</td>"
content = content.replace(old_recent, new_recent)

# 3. Fix renderBillWiseReport
old_report_row = "<td>${new Date(b.date).toLocaleString()}</td>"
new_report_row = "<td>${formatDateLocalDMY(b.date)}</td>"
content = content.replace(old_report_row, new_report_row)

# 4. Fix Reports table header
old_report_header = '<th style="width: 12%">Date & Time</th>'
new_report_header = '<th style="width: 12%">Sale Date</th>'
content = content.replace(old_report_header, new_report_header)

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Report UI fixed.")
