const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: require('path').resolve('./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
        args: ['.', '--remote-debugging-port=9222'],
        headless: true
    });

    try {
        const pages = await browser.pages();
        let page = pages.find(p => p.url().includes('OneBook.html'));
        if (!page) {
            await new Promise(r => setTimeout(r, 2000));
            const newPages = await browser.pages();
            page = newPages.find(p => p.url().includes('OneBook.html') || p.url().includes('final.html'));
        }
        
        // Let's dump all global functions to see where completeSale is
        const globals = await page.evaluate(() => {
            return {
                completeSale: typeof window.completeSale,
                cart: typeof window.cart,
                isDemoMode: typeof window.isDemoMode,
                url: window.location.href
            };
        });
        
        console.log("Globals:", globals);
        
    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
})();
