import re

with open('final.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the table styles in purchaseModal
html = re.sub(
    r'#purchaseModal \.table th, #purchaseModal \.table td \{ padding: 6px 10px; font-size: 13px; \}',
    '#purchaseModal .table th, #purchaseModal .table td { padding: 12px 10px; font-size: 18px; vertical-align: middle; }\n                #purchaseModal h2 { font-size: 24px !important; }',
    html
)

with open('final.html', 'w', encoding='utf-8') as f:
    f.write(html)
