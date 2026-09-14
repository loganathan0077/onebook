const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

const badStructure = `<tbody id="productsTableBody"></tbody>
                    </table>
                </div>
            </div>
            <!-- CLOSING DIV FOR PRODUCTS TAB -->
            </div>

            <!-- Purchase & Parties Tab -->`;

const goodStructure = `<tbody id="productsTableBody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Purchase & Parties Tab -->`;

html = html.replace(badStructure, goodStructure);
fs.writeFileSync('final.html', html, 'utf8');
console.log("Reverted extra closing div.");
