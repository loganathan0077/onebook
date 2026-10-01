import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    # 1. Add enteredAtHtml in generateTAXInvoiceHTML
    old_dateStr = r'(const dateStr = new Date\(saleData\.date\)\.toLocaleDateString\(\);)'
    new_dateStr = r'\1\n            const enteredAtHtml = saleData.createdAt ? `<div><strong>Entered At:</strong> ${new Date(saleData.createdAt).toLocaleString()}</div>` : \'\';'
    content = re.sub(old_dateStr, new_dateStr, content, count=1)

    # 2. Inject enteredAtHtml into the Invoice Details div
    old_invoiceDetails = r'(<div><strong>Invoice Date:</strong> \$\{dateStr\}</div>)'
    new_invoiceDetails = r'\1\n                                ${enteredAtHtml}'
    content = re.sub(old_invoiceDetails, new_invoiceDetails, content, count=1)

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

