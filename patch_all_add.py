import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Fix 18193 (which is missing discount)
old_18193 = """                cart.push({
                    productId: product.id,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: 1,
                    baseQuantity: 1,
                    total: unitPrice
                });"""

new_18193 = """                let effDisc = getEffectiveDiscount(product);
                cart.push({
                    productId: product.id,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: 1,
                    baseQuantity: 1,
                    discountType: effDisc.type,
                    discountValue: effDisc.value,
                    discountPercent: effDisc.type === 'percentage' ? effDisc.value : 0,
                    total: unitPrice
                });"""
html = html.replace(old_18193, new_18193)

old_18465 = """                cart.push({
                    productId: product.id,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: prec,
                    baseQuantity: 1,
                    total: unitPrice,
                    discountPercent: getEffectiveDiscount(product)
                });"""

new_18465 = """                let effDisc = getEffectiveDiscount(product);
                cart.push({
                    productId: product.id,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: prec,
                    baseQuantity: 1,
                    total: unitPrice,
                    discountType: effDisc.type,
                    discountValue: effDisc.value,
                    discountPercent: effDisc.type === 'percentage' ? effDisc.value : 0
                });"""
html = html.replace(old_18465, new_18465)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
