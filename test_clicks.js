const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: require('path').resolve('./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
        args: ['.', '--remote-debugging-port=9222'],
        headless: true
    });

    try {
        const pages = await browser.pages();
        let page = pages.find(p => p.url().includes('OneBook.html') || p.url().includes('final.html'));
        if (!page) {
            await new Promise(r => setTimeout(r, 2000));
            const newPages = await browser.pages();
            page = newPages.find(p => p.url().includes('OneBook.html') || p.url().includes('final.html'));
        }
        
        console.log("Connected to page:", page.url());
        
        // Wait for page load
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("Testing 6 demo sales via UI clicks...");
        
        for (let i = 1; i <= 6; i++) {
            console.log(`\n--- Sale ${i} ---`);
            
            // Go to POS tab if not already
            await page.evaluate(() => {
                const nav = document.querySelector('[onclick="switchTab(\'pos\')"]');
                if (nav) nav.click();
            });
            await new Promise(r => setTimeout(r, 200));
            
            // We need to add an item to cart. Find a product button and click it
            await page.evaluate(() => {
                const prodBtn = document.querySelector('.product-card');
                if (prodBtn) prodBtn.click();
            });
            await new Promise(r => setTimeout(r, 200));
            
            // Set cash payment amount to total
            await page.evaluate(() => {
                const total = document.getElementById('cartTotal').value;
                const payment = document.getElementById('paymentAmountReceived');
                if (payment) payment.value = total || "10";
            });
            
            // Click Complete Sale
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('.btn-success')).find(b => b.innerText.includes('Complete Sale'));
                if (btn) btn.click();
            });
            
            // Wait a moment for processing and sweetalert
            await new Promise(r => setTimeout(r, 500));
            
            const swalState = await page.evaluate(() => {
                const swal = document.querySelector('.swal2-container');
                if (!swal || swal.style.display === 'none') return { status: 'none' };
                
                const title = document.querySelector('.swal2-title');
                const content = document.querySelector('.swal2-html-container');
                
                const result = {
                    title: title ? title.innerText : '',
                    content: content ? content.innerText : ''
                };
                
                // close it
                const okBtn = document.querySelector('.swal2-confirm');
                if (okBtn) okBtn.click();
                
                return result;
            });
            
            console.log("SweetAlert triggered:", swalState);
            
            if (swalState.title && swalState.title.includes('Demo Mode Limit')) {
                console.log("SUCCESS! Demo Limit reached and blocked!");
                break;
            }
        }
        
        // Final count
        const count = await page.evaluate(() => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const salesStr = localStorage.getItem('sales');
            const sales = salesStr ? JSON.parse(salesStr) : [];
            return sales.filter(s => s.isDemo && s.date && s.date.startsWith(todayStr)).length;
        });
        console.log("Total persisted Demo Sales today:", count);
        
    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
})();
