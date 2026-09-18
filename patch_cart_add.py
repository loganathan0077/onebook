import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Update getEffectiveDiscount
old_get_eff = """        function getEffectiveDiscount(product) {
            if (product.productDiscount !== undefined && product.productDiscount !== null && product.productDiscount !== "") {
                return parseFloat(product.productDiscount);
            }
            if (product.category) {
                const catDiscount = categoryDiscounts.find(c => c.category === product.category && c.active);
                if (catDiscount) {
                    return parseFloat(catDiscount.discount);
                }
            }
            return 0;
        }"""

new_get_eff = """        function getEffectiveDiscount(product) {
            if (product.discountValue !== undefined && product.discountValue !== null && product.discountValue !== "") {
                return { type: product.discountType || 'percentage', value: parseFloat(product.discountValue) };
            }
            // Fallback for older data that might use discountPercent or productDiscount
            let oldProdVal = product.discountPercent !== undefined ? product.discountPercent : product.productDiscount;
            if (oldProdVal !== undefined && oldProdVal !== null && oldProdVal !== "") {
                return { type: 'percentage', value: parseFloat(oldProdVal) };
            }
            if (product.category) {
                const catDiscount = categoryDiscounts.find(c => c.category === product.category && c.active);
                if (catDiscount) {
                    if (catDiscount.discountValue !== undefined && catDiscount.discountValue !== null && catDiscount.discountValue !== "") {
                        return { type: catDiscount.discountType || 'percentage', value: parseFloat(catDiscount.discountValue) };
                    }
                    if (catDiscount.discount !== undefined && catDiscount.discount !== null && catDiscount.discount !== "") {
                        return { type: 'percentage', value: parseFloat(catDiscount.discount) };
                    }
                }
            }
            return { type: 'percentage', value: 0 };
        }"""

html = html.replace(old_get_eff, new_get_eff)


# Update addItemToCart to store discount object
old_add_cart = """            if (existingItemIndex >= 0) {
                cart[existingItemIndex].quantity = parseFloat((cart[existingItemIndex].quantity + quantity).toFixed(3));
                cart[existingItemIndex].total = cart[existingItemIndex].quantity * unitPrice;
            } else {
                cart.push({
                    productId: productId,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: quantity,
                    baseQuantity: unitQuantity, // Store multiplier
                    discountPercent: getEffectiveDiscount(product),
                    total: quantity * unitPrice
                });
            }"""

new_add_cart = """            if (existingItemIndex >= 0) {
                cart[existingItemIndex].quantity = parseFloat((cart[existingItemIndex].quantity + quantity).toFixed(3));
                cart[existingItemIndex].total = cart[existingItemIndex].quantity * unitPrice;
            } else {
                let effDisc = getEffectiveDiscount(product);
                cart.push({
                    productId: productId,
                    productName: product.name,
                    barcode: product.barcode,
                    unit: unitName,
                    price: unitPrice,
                    quantity: quantity,
                    baseQuantity: unitQuantity, // Store multiplier
                    discountType: effDisc.type,
                    discountValue: effDisc.value,
                    discountPercent: effDisc.type === 'percentage' ? effDisc.value : 0, // Fallback placeholder
                    total: quantity * unitPrice
                });
            }"""

html = html.replace(old_add_cart, new_add_cart)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
