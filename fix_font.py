import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the <input> styles for the summary rows to include font-size: 15px !important;
# and the Total Amount to font-size: 18px !important;
# Also the rupee symbols should match.

content = content.replace(
    'id="cartSubtotal" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none;"',
    'id="cartSubtotal" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;"'
)

content = content.replace(
    'id="cartTotalDiscount" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #dc3545; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none;"',
    'id="cartTotalDiscount" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #dc3545; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;"'
)

content = content.replace(
    'id="cartTaxableAmount" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none;"',
    'id="cartTaxableAmount" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;"'
)

content = content.replace(
    'id="cartCGST" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none;"',
    'id="cartCGST" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;"'
)

content = content.replace(
    'id="cartSGST" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none;"',
    'id="cartSGST" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;"'
)

content = content.replace(
    'id="cartIGST" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none;"',
    'id="cartIGST" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #212529; width: 80px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 15px !important;"'
)

content = content.replace(
    'id="cartTotal" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; font-size: 20px; color: #28a745; width: 100px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none;"',
    'id="cartTotal" step="0.01" readonly style="background: transparent; border: none; text-align: right; font-weight: bold; color: #28a745; width: 100px; padding: 0; margin: 0; outline: none; cursor: default; -webkit-appearance: none; pointer-events: none; font-size: 18px !important;"'
)

content = content.replace(
    '<span style="color: #212529;">₹</span>',
    '<span style="color: #212529; font-size: 15px;">₹</span>'
)
content = content.replace(
    '<span style="color: #dc3545;">₹</span>',
    '<span style="color: #dc3545; font-size: 15px;">₹</span>'
)
content = content.replace(
    '<span style="color: #28a745; font-size: 20px; font-weight: bold;">₹</span>',
    '<span style="color: #28a745; font-size: 18px; font-weight: bold;">₹</span>'
)


with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Font sizes updated!")
