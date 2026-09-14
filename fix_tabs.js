const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

// 1. Fix missing closing div for products tab
// Currently it looks like:
// 2797:                        <tbody id="productsTableBody"></tbody>
// 2798:                    </table>
// 2799:                </div>
// 2800:            </div>
// 2801:
// 2802:            <!-- Purchase & Parties Tab -->

const buggyProductsEnd = `<tbody id="productsTableBody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Purchase & Parties Tab -->`;

const fixedProductsEnd = `<tbody id="productsTableBody"></tbody>
                    </table>
                </div>
            </div>
            <!-- CLOSING DIV FOR PRODUCTS TAB -->
            </div>

            <!-- Purchase & Parties Tab -->`;

html = html.replace(buggyProductsEnd, fixedProductsEnd);

// 2. Fix the back buttons in receivables and payables tabs
html = html.replace(/<button class="btn btn-secondary" onclick="switchTab\('products'\)">⬅️ Back to Products<\/button>/g, '<button class="btn btn-secondary" onclick="switchTab(\'purchaseparties\')">⬅️ Back to Purchase & Parties</button>');

fs.writeFileSync('final.html', html, 'utf8');
console.log("Fixed tab structures and back buttons.");
