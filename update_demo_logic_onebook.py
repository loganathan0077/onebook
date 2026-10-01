import re

file_path = '/Users/log/onebook/OneBook.html'

with open(file_path, 'r', encoding='utf8') as f:
    content = f.read()

# 1. Inject requireLicensedForWrite and update showDemoLimitMessage
guard_func = """
        function requireLicensedForWrite(actionName = 'this action') {
            if (typeof isDemoMode !== 'function' || !isDemoMode()) {
                return true;
            }
            
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '🔵 DEMO MODE',
                    html: `You're currently using OneBook in Demo Mode.<br><br>You can view and explore the software, but <b>${actionName}</b> requires an active OneBook license.<br><br>Please activate your license to continue.`,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Activate License',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = 'license.html';
                    }
                });
            } else {
                if (confirm(`DEMO MODE\\n\\nYou're currently using OneBook in Demo Mode. ${actionName} requires an active OneBook license.\\n\\nClick OK to activate your license.`)) {
                    window.location.href = 'license.html';
                }
            }
            return false;
        }

        function showDemoLimitMessage(type) {
            let actionName = 'this action';
            if (type === 'products') actionName = 'creating more than 10 products';
            if (type === 'customers') actionName = 'creating more than 2 customers';
            if (type === 'sales') actionName = 'completing more than 5 sales per day';
            requireLicensedForWrite(actionName);
        }
"""
# Replace the existing showDemoLimitMessage function entirely
content = re.sub(
    r'function showDemoLimitMessage\(type\) \{[\s\S]*?\}(?=\s*</script>|\s*function)',
    guard_func,
    content,
    count=1
)

# 2. Inject guards into the strict-block functions
strict_guards = {
    r'(function addStock\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('updating stock')) return;",
    r'(function savePurchase\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('creating a purchase')) return;",
    r'(function savePO\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('saving a purchase order')) return;",
    r'(function saveSupplier\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('creating a supplier')) return;",
    r'(function savePCTransaction\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('saving a petty cash transaction')) return;",
    r'(function saveDayClosing\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('performing day closing')) return;",
    r'(function saveSettings\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('saving settings')) return;",
    r'(function saveInvoiceSettings\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('saving invoice settings')) return;",
    r'(function saveLabelSettings\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('saving label settings')) return;",
    r'(function saveLedgerPayment\(\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('saving a ledger payment')) return;",
    r'(function saveEditedProduct\(event\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('editing a product')) return;",
    r'(function saveEditedBill\(billNumber\)\s*\{)': r"\1\n            if (!requireLicensedForWrite('editing a bill')) return;"
}

for pattern, replacement in strict_guards.items():
    content = re.sub(pattern, replacement, content, count=1)

with open(file_path, 'w', encoding='utf8') as f:
    f.write(content)
