def update_file(file_path):
    with open(file_path, 'r', encoding='utf8') as f:
        content = f.read()

    old_logic = """            // Filter products based on search term
            const filteredProducts = products.filter(product => {
                const searchLower = searchTerm.toLowerCase();
                const nameStr = product.name !== undefined && product.name !== null ? String(product.name).toLowerCase() : '';
                const barcodeStr = product.barcode !== undefined && product.barcode !== null ? String(product.barcode).toLowerCase() : '';
                const categoryStr = product.category !== undefined && product.category !== null ? String(product.category).toLowerCase() : '';
                
                return nameStr.includes(searchLower) || barcodeStr.includes(searchLower) || categoryStr.includes(searchLower);
            });"""

    new_logic = """            // Advanced Tokenized Product Search
            const tokens = searchTerm.toLowerCase().trim().split(/\\s+/).filter(t => t.length > 0);
            
            let matchedProducts = [];
            if (tokens.length === 0) {
                matchedProducts = products.map(product => ({ product, score: 0 }));
            } else {
                products.forEach(product => {
                    const nameStr = product.name !== undefined && product.name !== null ? String(product.name).toLowerCase() : '';
                    const barcodeStr = product.barcode !== undefined && product.barcode !== null ? String(product.barcode).toLowerCase() : '';
                    const categoryStr = product.category !== undefined && product.category !== null ? String(product.category).toLowerCase() : '';
                    const brandStr = product.brand !== undefined && product.brand !== null ? String(product.brand).toLowerCase() : '';
                    const skuStr = product.sku !== undefined && product.sku !== null ? String(product.sku).toLowerCase() : '';
                    const priceStr = product.sellingPrice !== undefined && product.sellingPrice !== null ? String(product.sellingPrice) : '';
                    
                    const searchableText = `${nameStr} ${barcodeStr} ${categoryStr} ${brandStr} ${skuStr} ${priceStr}`;
                    
                    const matchesAll = tokens.every(token => searchableText.includes(token));
                    
                    if (matchesAll) {
                        let score = 999;
                        const exactBarcodeMatch = tokens.length === 1 && barcodeStr === tokens[0];
                        const exactNameMatch = nameStr === searchTerm.toLowerCase().trim();
                        const startsWith = nameStr.startsWith(tokens[0]);
                        const allTokensInName = tokens.every(token => nameStr.includes(token));
                        
                        if (exactBarcodeMatch) score = 1;
                        else if (exactNameMatch) score = 2;
                        else if (startsWith) score = 3;
                        else if (allTokensInName) score = 4;
                        else if (tokens.every(token => nameStr.includes(token) || categoryStr.includes(token) || brandStr.includes(token))) score = 5;
                        else score = 6;
                        
                        matchedProducts.push({ product, score });
                    }
                });
                
                matchedProducts.sort((a, b) => a.score - b.score);
            }
            const filteredProducts = matchedProducts.map(m => m.product);"""

    content = content.replace(old_logic, new_logic)

    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)

update_file('/Users/log/onebook/final.html')
update_file('/Users/log/onebook/OneBook.html')

