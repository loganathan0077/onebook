const fs = require('fs');
let html = fs.readFileSync('final.html', 'utf8');

const oldSwitchFallback = `                } else if (tabName === 'receivables' || tabName === 'payables') {
                    const prodNav = document.querySelector(\`.nav-tab[data-tab="products"]\`);
                    if (prodNav) prodNav.classList.add('active');
                }`;

const newSwitchFallback = `                } else if (tabName === 'receivables' || tabName === 'payables') {
                    const prodNav = document.querySelector(\`.nav-tab[data-tab="purchaseparties"]\`);
                    if (prodNav) prodNav.classList.add('active');
                }`;

html = html.replace(oldSwitchFallback, newSwitchFallback);

fs.writeFileSync('final.html', html, 'utf8');
console.log("Fixed switchTab fallback highlight.");
