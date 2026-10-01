import re

with open('/Users/log/onebook/admin/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"window\.deleteLicense = \(licenseId\) => \{.*?\};", "", content, flags=re.DOTALL)
content = re.sub(r"window\.executeDeleteLicense = async \(licenseId\) => \{.*?\};", "", content, flags=re.DOTALL)

with open('/Users/log/onebook/admin/main.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Delete functions truly removed")
