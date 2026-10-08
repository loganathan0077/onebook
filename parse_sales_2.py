import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()
    
# Find the sales tab
start_sales = content.find('id="sales" class="tab-content"')
if start_sales != -1:
    end_sales = content.find('<!-- END RECORD SALE TAB -->', start_sales)
    if end_sales == -1: end_sales = start_sales + 1000
    print(content[start_sales:start_sales+1500])
