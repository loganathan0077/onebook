import re

with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()
    
# Find the sales tab
start_sales = content.find('id="sales" class="tab-content"')
if start_sales != -1:
    end_sales = content.find('id="reports" class="tab-content"', start_sales)
    sales_content = content[start_sales:end_sales]
    
    # Check for "Powered by" in sales content
    if "Powered by" in sales_content:
        print("Found 'Powered by' inside sales tab!")
    else:
        print("Not in sales tab.")
