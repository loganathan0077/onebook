import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Update header
old_invoice_th = """                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Disc %</th>"""
new_invoice_th = """                                    <th style="padding: 4px; border: 1px solid #333; font-size: 10px;">Discount</th>"""
html = html.replace(old_invoice_th, new_invoice_th)

# Update row string
old_invoice_row = """                    const discPerc = item.discountPercent ? `${item.discountPercent}%` : '0%';"""
new_invoice_row = """                    let discPerc = '0';
                    if ((item.discountType || 'percentage') === 'percentage') {
                        discPerc = (item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0)) + '%';
                    } else {
                        discPerc = '₹' + (item.discountValue || 0);
                    }"""
html = html.replace(old_invoice_row, new_invoice_row)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
