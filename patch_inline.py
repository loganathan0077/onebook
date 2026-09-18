import re

with open('final.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove height: 32px and increase width for Qty, Price, GST in purchase table
html = html.replace(
    'style="width: 60px; text-align: center; border: 1px solid #c3e6cb; height: 32px; padding: 0;"',
    'style="width: 80px; text-align: center; border: 1px solid #c3e6cb; padding: 0; font-size: 18px;"'
)
html = html.replace(
    'style="width: 80px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; height: 32px;"',
    'style="width: 120px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; font-size: 18px;"'
)
html = html.replace(
    'style="width: 60px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; height: 32px;"',
    'style="width: 100px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; font-size: 18px;"'
)

with open('final.html', 'w', encoding='utf-8') as f:
    f.write(html)
