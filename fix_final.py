with open("final.html", "r") as f:
    content = f.read()

bad1 = "const displayName = variant ? (window.getVariantDisplayName ? window.getVariantDisplayName(product, variant) : ) : product.name;"
good1 = "const displayName = variant ? (window.getVariantDisplayName ? window.getVariantDisplayName(product, variant) : `${product.name} - ${variant.name}`) : product.name;"

bad2 = "document.getElementById('addStockProductName').textContent = displayName + (barcode && barcode !== 'N/A' ?  : '');"
good2 = "document.getElementById('addStockProductName').textContent = displayName + (barcode && barcode !== 'N/A' ? ` (${barcode})` : '');"

content = content.replace(bad1, good1)
content = content.replace(bad2, good2)

with open("final.html", "w") as f:
    f.write(content)

print("Fixed!")
