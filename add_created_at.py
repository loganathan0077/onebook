import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    # 1. Update sale object to include createdAt
    # Find `date: saleDate,` and append `createdAt: new Date().toISOString(),`
    content = re.sub(
        r'(date:\s*saleDate,)',
        r'\1\n                            createdAt: new Date().toISOString(),',
        content,
        count=1
    )

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

