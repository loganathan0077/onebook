import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Update checkout
old_checkout = """                            itemDiscount: item.discount || 0,
                            discountPercent: item.discountPercent || 0,
                            gstRate: item.gstRate || 0,"""

new_checkout = """                            itemDiscount: item.discount || 0,
                            discountType: item.discountType || 'percentage',
                            discountValue: item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0),
                            discountPercent: item.discountPercent || 0,
                            gstRate: item.gstRate || 0,"""

html = html.replace(old_checkout, new_checkout)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
