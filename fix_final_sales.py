import re

file_path = '/Users/log/onebook/final.html'

with open(file_path, 'r', encoding='utf8') as f:
    content = f.read()

# 1. Add demo limit check at start of completeSale
# Look for function completeSale() {
sale_check = """
            if (typeof isDemoMode === 'function' && isDemoMode()) {
                const todayStr = new Date().toISOString().slice(0, 10);
                if (!canCreateDemoSale(todayStr)) {
                    showDemoLimitMessage('sales');
                    return;
                }
            }
"""
content = re.sub(r'(function completeSale\(\) \{)', r'\1\n' + sale_check, content, count=1)

# 2. Add isDemo to the sale object
# Look for:
#                            userId: currentUser.id || '',
sale_isdemo = """
                            isDemo: (typeof isDemoMode === 'function' && isDemoMode()),
                            userId: currentUser.id || '',"""
content = re.sub(r'(\s+userId:\s*currentUser\.id\s*\|\|\s*\'\',)', sale_isdemo, content)

with open(file_path, 'w', encoding='utf8') as f:
    f.write(content)
