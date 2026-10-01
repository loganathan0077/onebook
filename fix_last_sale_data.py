import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix processSale
old_ps_sale = """                lastSaleData = {
                    saleId: saleId,
                    receiptNumber: receiptNumber,
                    date: saleDate,
                    counterCode: currentUserObj.userCode || '-',"""
new_ps_sale = """                lastSaleData = {
                    saleId: saleId,
                    receiptNumber: receiptNumber,
                    date: saleDate,
                    createdAt: saleItems.length > 0 ? saleItems[0].createdAt : new Date().toISOString(),
                    counterCode: currentUserObj.userCode || '-',"""
content = content.replace(old_ps_sale, new_ps_sale)

# Fix viewBill
old_vb_sale = """            lastSaleData = {
                saleId: firstItem.saleId,
                receiptNumber: firstItem.receiptNumber,
                date: firstItem.date,
                customerName: firstItem.customerName,"""
new_vb_sale = """            lastSaleData = {
                saleId: firstItem.saleId,
                receiptNumber: firstItem.receiptNumber,
                date: firstItem.date,
                createdAt: firstItem.createdAt,
                customerName: firstItem.customerName,"""
content = content.replace(old_vb_sale, new_vb_sale)

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("lastSaleData fixed")
