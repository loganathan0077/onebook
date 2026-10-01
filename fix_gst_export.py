import re

with open('/Users/log/onebook/OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix GST Header
old_gst_header = "let csv = 'Date & Time,Bill No,Customer Name,Customer GSTIN / GST No,Customer Address,Customer State,Tax Type (Intra-State / Inter-State),Subtotal,Discount,Taxable Amount,CGST,SGST,IGST,Total,Payment Method\\n';"
new_gst_header = "let csv = 'Sale Date,Entry Date & Time,Bill No,Customer Name,Customer GSTIN / GST No,Customer Address,Customer State,Tax Type (Intra-State / Inter-State),Subtotal,Discount,Taxable Amount,CGST,SGST,IGST,Total,Payment Method\\n';"
content = content.replace(old_gst_header, new_gst_header)

# Fix GST Row
old_gst_row = "csv += `${dateStr},${bill.receiptNumber},${customerName},${customerGSTIN},${customerAddress},${bill.customerState},${taxTypeDisplay},${bill.subtotal.toFixed(2)},${bill.discount.toFixed(2)},${bill.taxableValue.toFixed(2)},${bill.cgst.toFixed(2)},${bill.sgst.toFixed(2)},${bill.igst.toFixed(2)},${bill.total.toFixed(2)},${payment}\\n`;"
new_gst_row = "csv += `${formatDateLocalDMY(bill.date)},${formatCreatedAtLocal(bill.createdAt)},${bill.receiptNumber},${customerName},${customerGSTIN},${customerAddress},${bill.customerState},${taxTypeDisplay},${bill.subtotal.toFixed(2)},${bill.discount.toFixed(2)},${bill.taxableValue.toFixed(2)},${bill.cgst.toFixed(2)},${bill.sgst.toFixed(2)},${bill.igst.toFixed(2)},${bill.total.toFixed(2)},${payment}\\n`;"
content = content.replace(old_gst_row, new_gst_row)

# Fix GST Grand Total (add 1 comma)
old_gst_gt = "csv += `GRAND TOTAL,,,,,,,${grandSubtotal.toFixed(2)},${grandDiscount.toFixed(2)},${grandTaxable.toFixed(2)},${grandCGST.toFixed(2)},${grandSGST.toFixed(2)},${grandIGST.toFixed(2)},${grandTotalInvoice.toFixed(2)},\\n`;"
new_gst_gt = "csv += `GRAND TOTAL,,,,,,,,${grandSubtotal.toFixed(2)},${grandDiscount.toFixed(2)},${grandTaxable.toFixed(2)},${grandCGST.toFixed(2)},${grandSGST.toFixed(2)},${grandIGST.toFixed(2)},${grandTotalInvoice.toFixed(2)},\\n`;"
content = content.replace(old_gst_gt, new_gst_gt)

with open('/Users/log/onebook/OneBook.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("GST CSV fixed")
