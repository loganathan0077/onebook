import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update updateCartItemDiscount
old_update_discount = """        function updateCartItemDiscount(index, value) {
            cart[index].discountPercent = parseFloat(value) || 0;
            updateCartDisplay();
        }"""

new_update_discount = """        function updateCartItemDiscount(index, value) {
            let item = cart[index];
            let valStr = String(value).trim();
            let isPercentage = valStr.includes('%');
            let parsedVal = parseFloat(valStr.replace('%', ''));
            
            if (isNaN(parsedVal) || parsedVal < 0) {
                showAlert('Invalid discount value.', '⚠️');
                updateCartDisplay();
                return;
            }

            let gross = item.quantity * item.price;
            let amount = isPercentage ? gross * (parsedVal / 100) : parsedVal;

            if (amount > gross) {
                showAlert('Discount cannot be greater than the item amount.', '⚠️');
                updateCartDisplay(); // reset input
                return;
            }

            item.discountType = isPercentage ? 'percentage' : 'amount';
            item.discountValue = parsedVal;
            item.discountPercent = isPercentage ? parsedVal : 0; // backward compat
            updateCartDisplay();
        }"""
html = html.replace(old_update_discount, new_update_discount)


# 2. Update updateCartDisplay calculation
old_cart_calc = """                item.discountPercent = item.discountPercent || 0;
                let grossAmount = item.quantity * item.price;
                let itemDiscountAmount = grossAmount * (item.discountPercent / 100);
                let netInclusive = grossAmount - itemDiscountAmount;"""

new_cart_calc = """                let grossAmount = item.quantity * item.price;
                let itemDiscountAmount = 0;
                let dType = item.discountType || 'percentage';
                let dVal = item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0);

                if (dType === 'percentage') {
                    itemDiscountAmount = grossAmount * (dVal / 100);
                } else {
                    itemDiscountAmount = dVal;
                }
                
                // Ensure no negative totals (fallback protection)
                if (itemDiscountAmount > grossAmount) itemDiscountAmount = grossAmount;

                let netInclusive = grossAmount - itemDiscountAmount;"""
html = html.replace(old_cart_calc, new_cart_calc)


# 3. Update Cart HTML table header
old_th = """                                    <th>Rate</th>
                                    <th>Disc %</th>
                                    <th>Amount</th>"""

new_th = """                                    <th>Rate</th>
                                    <th>Discount</th>
                                    <th>Amount</th>"""
html = html.replace(old_th, new_th)


# 4. Update Cart HTML table cell input
old_td = """                                        <td><input type="number" value="${item.discountPercent || 0}" min="0" max="100" style="width:55px; padding:2px;" onchange="updateCartItemDiscount(${index}, this.value)"></td>"""

new_td = """                                        <td>
                                            <input type="text" value="${(item.discountType || 'percentage') === 'percentage' ? (item.discountValue !== undefined ? item.discountValue : (item.discountPercent || 0)) + '%' : (item.discountValue || 0)}" style="width:65px; padding:2px; text-align:center;" onchange="updateCartItemDiscount(${index}, this.value)">
                                        </td>"""
html = html.replace(old_td, new_td)

with open('OneBook.html', 'w', encoding='utf-8') as f:
    f.write(html)
