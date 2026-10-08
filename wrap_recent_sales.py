with open('OneBook.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                <div class="responsive-header"
                    style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                    <h4 class="section-title"
                        style="margin: 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;"
                        id="recordSalesTitle">Today's Sales</h4>
                    <input type="date" id="recordSalesDate" onchange="updateTodaysSales()"
                        style="padding: 8px; border-radius: 5px; border: 1px solid #dee2e6; max-width: 100%;">
                </div>
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="position: sticky; top: 0; z-index: 10; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <tr>
                                <th>Sale Date</th>
                                <th>Entry Date & Time</th>
                                <th>Bill No</th>
                                <th>Subtotal</th>
                                <th>Discount</th>
                                <th>Courier</th>
                                <th>Total</th>
                                <th>Customer</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="todaySalesBody"></tbody>
                    </table>
                </div>"""

replacement = """            <div id="recentSalesPanel">
                <div class="responsive-header"
                    style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                    <h4 class="section-title"
                        style="margin: 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;"
                        id="recordSalesTitle">Today's Sales</h4>
                    <input type="date" id="recordSalesDate" onchange="updateTodaysSales()"
                        style="padding: 8px; border-radius: 5px; border: 1px solid #dee2e6; max-width: 100%;">
                </div>
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="position: sticky; top: 0; z-index: 10; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <tr>
                                <th>Sale Date</th>
                                <th>Entry Date & Time</th>
                                <th>Bill No</th>
                                <th>Subtotal</th>
                                <th>Discount</th>
                                <th>Courier</th>
                                <th>Total</th>
                                <th>Customer</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="todaySalesBody"></tbody>
                    </table>
                </div>
            </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open('OneBook.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Wrapped Recent Sales successfully!")
else:
    print("Target not found for Recent Sales wrap.")
