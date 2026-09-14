const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

// 1. Add global state for highlighting
if (!html.includes('let purchaseSearchHighlightIndex = -1;')) {
    html = html.replace(
        'let selectedPurchaseProduct = null;',
        `let selectedPurchaseProduct = null;\n        let purchaseSearchHighlightIndex = -1;`
    );
}

// 2. Add style for highlighted result
if (!html.includes('.search-result-item.highlighted')) {
    html = html.replace(
        '</style>',
        `    .search-result-item.highlighted { background-color: #e2e8f0; border-left: 3px solid #007bff; }\n    </style>`
    );
}

// 3. Add onkeydown to purchaseSearchInput
html = html.replace(
    `oninput="searchPurchaseProduct(this.value)"`,
    `oninput="searchPurchaseProduct(this.value)" onkeydown="handlePurchaseSearchKeydown(event)" autocomplete="off"`
);

// 4. Update searchPurchaseProduct to reset highlight index and add IDs to result items
html = html.replace(
    `            if (matches.length === 0) {
                resultsDiv.style.display = 'none';
                return;
            }

            resultsDiv.innerHTML = matches.map(p => \`
                <div class="search-result-item" onclick="selectPurchaseProduct(\${p.id})">`,
    `            if (matches.length === 0) {
                resultsDiv.style.display = 'none';
                return;
            }
            purchaseSearchHighlightIndex = -1;
            resultsDiv.innerHTML = matches.map((p, index) => \`
                <div class="search-result-item" id="ps-result-\${index}" onclick="selectPurchaseProduct(\${p.id})">`
);

// 5. Inject handlePurchaseSearchKeydown and handlePurchaseFieldKeydown
const jsInject = `
        function handlePurchaseSearchKeydown(event) {
            const resultsDiv = document.getElementById('purchaseSearchResults');
            if (resultsDiv.style.display === 'none' || resultsDiv.innerHTML.trim() === '') return;
            
            const items = resultsDiv.querySelectorAll('.search-result-item');
            if (items.length === 0) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                purchaseSearchHighlightIndex++;
                if (purchaseSearchHighlightIndex >= items.length) purchaseSearchHighlightIndex = 0;
                updatePurchaseSearchHighlight(items);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                purchaseSearchHighlightIndex--;
                if (purchaseSearchHighlightIndex < 0) purchaseSearchHighlightIndex = items.length - 1;
                updatePurchaseSearchHighlight(items);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                if (purchaseSearchHighlightIndex >= 0 && purchaseSearchHighlightIndex < items.length) {
                    items[purchaseSearchHighlightIndex].click();
                } else {
                    items[0].click(); // Select first by default
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                resultsDiv.style.display = 'none';
            }
        }

        function updatePurchaseSearchHighlight(items) {
            items.forEach(item => item.classList.remove('highlighted'));
            if (purchaseSearchHighlightIndex >= 0 && purchaseSearchHighlightIndex < items.length) {
                const activeItem = items[purchaseSearchHighlightIndex];
                activeItem.classList.add('highlighted');
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }

        function handlePurchaseFieldKeydown(event, nextFieldId) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (nextFieldId === 'addBtn') {
                    addPurchaseItem();
                } else {
                    const nextEl = document.getElementById(nextFieldId);
                    if (nextEl) {
                        nextEl.focus();
                        if(nextEl.select) nextEl.select();
                    }
                }
            }
        }
`;

if (!html.includes('handlePurchaseSearchKeydown(event) {')) {
    html = html.replace(
        'function searchPurchaseProduct(query) {',
        jsInject + '\n        function searchPurchaseProduct(query) {'
    );
}

// 6. Focus Qty after product selection
html = html.replace(
    `            document.getElementById('purchaseSearchInput').value = '';
            document.getElementById('purchaseSearchResults').style.display = 'none';
        }`,
    `            document.getElementById('purchaseSearchInput').value = '';
            document.getElementById('purchaseSearchResults').style.display = 'none';
            setTimeout(() => {
                const qtyInput = document.getElementById('purchaseQty');
                if (qtyInput) {
                    qtyInput.focus();
                    qtyInput.select();
                }
            }, 50);
        }`
);

// 7. Focus purchaseSearchInput after adding to bill
html = html.replace(
    `            updatePurchaseTable();
            cancelPurchaseSelection();
            
            // Re-render inventory table to reflect new stock
            renderProducts();`,
    `            updatePurchaseTable();
            cancelPurchaseSelection();
            
            // Re-render inventory table to reflect new stock
            renderProducts();
            
            setTimeout(() => {
                const searchInput = document.getElementById('purchaseSearchInput');
                if (searchInput) searchInput.focus();
            }, 50);`
);

// 8. Add onkeydown to Qty, Rate, GST
html = html.replace(
    `id="purchaseQty" value="1" min="1" class="qty-value"`,
    `id="purchaseQty" value="1" min="1" class="qty-value" onkeydown="handlePurchaseFieldKeydown(event, 'purchaseItemPrice')"`
);
html = html.replace(
    `id="purchaseItemPrice" style="width: 80px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; height: 32px;"`,
    `id="purchaseItemPrice" style="width: 80px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; height: 32px;" onkeydown="handlePurchaseFieldKeydown(event, 'purchaseItemGST')"`
);
html = html.replace(
    `id="purchaseItemGST" style="width: 60px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; height: 32px;"`,
    `id="purchaseItemGST" style="width: 60px; padding: 5px; border-radius: 4px; border: 1px solid #c3e6cb; height: 32px;" onkeydown="handlePurchaseFieldKeydown(event, 'addBtn')"`
);

fs.writeFileSync('final.html', html, 'utf8');
console.log("Keyboard navigation injected");
