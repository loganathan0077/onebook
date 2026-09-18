import re

with open('final.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Update Margin and Markup headers
margin_th = """<th style="padding: 10px; cursor: pointer;" onclick="sortPriceManager('margin')">
                                        Margin % ↕</th>"""
margin_th_new = """<th style="padding: 10px; cursor: pointer;" class="admin-only buying-price-feature" onclick="sortPriceManager('margin')">
                                        Margin % ↕</th>"""
content = content.replace(margin_th, margin_th_new)

markup_th = """<th style="padding: 10px; cursor: pointer;" onclick="sortPriceManager('markup')">
                                        Markup % ↕</th>"""
markup_th_new = """<th style="padding: 10px; cursor: pointer;" class="admin-only buying-price-feature" onclick="sortPriceManager('markup')">
                                        Markup % ↕</th>"""
content = content.replace(markup_th, markup_th_new)

# Update Cost Price td in renderPriceManager
cost_td = """                    <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        <input type="number" 
                               value="${costPrice}" 
                               class="form-control" 
                               style="width: 100px; padding: 4px;"
                               onchange="updateProductPrice(${product.id}, 'costPrice', this.value)">
                    </td>"""
cost_td_new = """                    <td style="padding: 8px; border-bottom: 1px solid #eee;" class="admin-only buying-price-feature">
                        <input type="number" 
                               value="${costPrice}" 
                               class="form-control" 
                               style="width: 100px; padding: 4px;"
                               onchange="updateProductPrice(${product.id}, 'costPrice', this.value)">
                    </td>"""
content = content.replace(cost_td, cost_td_new)

# Update Margin and Markup tds in renderPriceManager
margin_td = """                    <!-- Admin Only: Margin & Markup -->
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        <span class="${margin > 0 ? 'text-success' : margin < 0 ? 'text-danger' : ''}" style="font-weight: 500;">
                            ${margin.toFixed(2)}%
                        </span>
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        <span class="${markup > 0 ? 'text-success' : markup < 0 ? 'text-danger' : ''}" style="font-weight: 500;">
                            ${markup.toFixed(2)}%
                        </span>
                    </td>"""
margin_td_new = """                    <!-- Admin Only: Margin & Markup -->
                    <td style="padding: 8px; border-bottom: 1px solid #eee;" class="admin-only buying-price-feature">
                        <span class="${margin > 0 ? 'text-success' : margin < 0 ? 'text-danger' : ''}" style="font-weight: 500;">
                            ${margin.toFixed(2)}%
                        </span>
                    </td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;" class="admin-only buying-price-feature">
                        <span class="${markup > 0 ? 'text-success' : markup < 0 ? 'text-danger' : ''}" style="font-weight: 500;">
                            ${markup.toFixed(2)}%
                        </span>
                    </td>"""
content = content.replace(margin_td, margin_td_new)

with open('final.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("JS patching part 3 complete")
