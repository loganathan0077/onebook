import re

for filename in ['final.html', 'OneBook.html']:
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace HTML structure for Products table
    old_html = """                <div id="productsListContainer"
                    style="max-height: 400px; overflow-y: auto; overflow-x: auto; border: 1px solid #dee2e6; border-radius: 4px; display: block;">
                    <table style="margin-bottom: 0;">
                        <thead style="position: sticky; top: 0; background: white; z-index: 1;">
                            <tr>
                                <th style="width: 40px;"><input type="checkbox" id="selectAllProducts"
                                        onchange="toggleSelectAllProducts(this)"></th>
                                <th style="width: 150px;">Barcode</th>
                                <th>Product Name</th>
                                <th>Category</th>
                                <th id="labelCenterExpDaysHeader" style="text-align: right;">Exp. Days</th>
                                <th>Stock</th>
                                <th>Price</th>
                                <th style="width: 100px; text-align: center;">Labels Qty</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="productsTableBody"></tbody>
                    </table>
                </div>"""

    new_html = """                <div class="inventory-table-container" style="border: 1px solid #dee2e6; border-radius: 4px; display: block; overflow: hidden; background: white;">
                    <div class="table-responsive" style="max-height: 60vh; overflow-y: auto; overflow-x: hidden;" id="productsListContainer">
                        <table class="inventory-table" style="margin: 0; width: 100%; table-layout: fixed; border-collapse: collapse;">
                            <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 1;">
                                <tr>
                                    <th style="width: 4%; text-align: center;"><input type="checkbox" id="selectAllProducts" onchange="toggleSelectAllProducts(this)"></th>
                                    <th style="width: 13%;">Barcode</th>
                                    <th style="width: 25%;">Product Name</th>
                                    <th style="width: 15%;">Category</th>
                                    <th id="labelCenterExpDaysHeader" style="width: 10%; text-align: right;">Exp. Days</th>
                                    <th style="width: 8%; text-align: right;">Stock</th>
                                    <th style="width: 8%; text-align: right;">Price</th>
                                    <th style="width: 9%; text-align: center;">Labels Qty</th>
                                    <th style="width: 8%; text-align: center;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="productsTableBody"></tbody>
                        </table>
                    </div>
                </div>"""
    
    content = content.replace(old_html, new_html)

    # Ensure JS rendering matches the new compact style if needed.
    # The current JS outputs normal <td> without fixed widths since it's driven by table-layout: fixed.
    # But let's check if there are any <td style="..."> we should adjust.
    old_td_checkbox = '<td style="text-align: center;">'
    new_td_checkbox = '<td style="text-align: center;">' # Already centered
    
    # Let's just make sure it was replaced.
    if old_html not in f.read() and new_html in content:
        print(f"Replaced HTML in {filename}")

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")
