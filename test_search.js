const fs = require('fs');
const content = fs.readFileSync('final.html', 'utf8');
const searchFunc = content.match(/window\.searchProductsUnified = function[\s\S]*?};\n/)[0];
eval(searchFunc);

const products = [
    { name: 'Blue Ballpoint Pen', sellingPrice: 5, category: 'Pens', barcode: '890' },
    { name: 'Blue Gel Pen', sellingPrice: 10, category: 'Pens', barcode: '891' },
    { name: 'Red Ballpoint Pen', sellingPrice: 5, category: 'Pens', barcode: '892' },
    { name: 'Black Marker', sellingPrice: 20, category: 'Markers', barcode: '893' },
    { name: 'Apple', sellingPrice: 240, category: 'Fruits', barcode: '894' }
];

console.log("Searching 'pen':");
console.log(window.searchProductsUnified('pen', products).map(p => p.name));

console.log("\nSearching '5 pen':");
console.log(window.searchProductsUnified('5 pen', products).map(p => p.name));

console.log("\nSearching 'pen 5':");
console.log(window.searchProductsUnified('pen 5', products).map(p => p.name));

console.log("\nSearching 'ball 5':");
console.log(window.searchProductsUnified('ball 5', products).map(p => p.name));

console.log("\nSearching 'blue pen':");
console.log(window.searchProductsUnified('blue pen', products).map(p => p.name));

console.log("\nSearching 'marker 20':");
console.log(window.searchProductsUnified('marker 20', products).map(p => p.name));
