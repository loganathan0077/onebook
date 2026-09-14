const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

html = html.replace(
    /style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba\(0,0,0,0\.6\); z-index: 2050; padding: 20px;"/g,
    'style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 2050; padding: 20px; align-items: center; justify-content: center;"'
);

html = html.replace(
    /style="background: white; border: 2px solid #28a745; border-radius: 8px; width: 100%; max-width: 1000px; max-height: calc\(100vh - 40px\); margin: 0 auto; display: flex; flex-direction: column; top: 50%; transform: translateY\(-50%\); position: relative; box-shadow: 0 4px 15px rgba\(0,0,0,0\.2\);"/g,
    'style="background: white; border: 2px solid #28a745; border-radius: 8px; width: 100%; max-width: 1000px; max-height: calc(100vh - 40px); display: flex; flex-direction: column; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin: auto;"'
);

// We must also ensure `showPurchaseAddNewProductForm` sets display to 'flex' instead of 'block'.
html = html.replace(
    /document\.getElementById\('purchaseNewProductContainer'\)\.style\.display = 'block';/g,
    "document.getElementById('purchaseNewProductContainer').style.display = 'flex';"
);

fs.writeFileSync('final.html', html, 'utf8');
console.log("Fixed flex centering");
