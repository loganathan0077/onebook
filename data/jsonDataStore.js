class JsonDataStore {
    // Basic wrapper falling back to localStorage
    async getProducts() { return JSON.parse(localStorage.getItem('products')) || []; }
    async getProduct(id) { 
        const products = await this.getProducts(); 
        return products.find(p => p.id === id); 
    }
    async createProduct(product) {
        const products = await this.getProducts();
        products.push(product);
        localStorage.setItem('products', JSON.stringify(products));
        return product.id;
    }
    async updateProduct(id, product) {
        let products = await this.getProducts();
        const idx = products.findIndex(p => p.id === id);
        if (idx !== -1) {
            products[idx] = { ...products[idx], ...product };
            localStorage.setItem('products', JSON.stringify(products));
        }
    }
    async searchProducts(query) {
        const products = await this.getProducts();
        const q = query.toLowerCase();
        return products.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.barcode && p.barcode.toLowerCase().includes(q)));
    }

    async getCustomers() { return JSON.parse(localStorage.getItem('customers')) || []; }
    async getCustomer(id) {
        const c = await this.getCustomers();
        return c.find(x => x.id === id);
    }
    async createCustomer(customer) {
        const c = await this.getCustomers();
        c.push(customer);
        localStorage.setItem('customers', JSON.stringify(c));
        return customer.id;
    }

    async createSale(salePayload) {
        let sales = JSON.parse(localStorage.getItem('sales')) || [];
        // Flattens items manually for JSON mode compatibility
        salePayload.items.forEach(item => {
            sales.push({ ...salePayload, ...item, saleId: salePayload.id || Date.now() });
        });
        localStorage.setItem('sales', JSON.stringify(sales));
        
        let stockHistory = JSON.parse(localStorage.getItem('stockHistory')) || [];
        salePayload.items.forEach(item => {
            stockHistory.push({ id: Date.now(), type: 'SALE', productId: item.product_id, quantity: -item.quantity, date: new Date().toISOString() });
        });
        localStorage.setItem('stockHistory', JSON.stringify(stockHistory));
        
        return salePayload.id;
    }
    async cancelSale(id) {
        throw new Error('Cancel sale not properly implemented in JSON mode');
    }

    async getStock(productId) {
        const p = await this.getProduct(productId);
        return p ? p.stock : 0;
    }
    async getStockMovements(productId) {
        const sh = JSON.parse(localStorage.getItem('stockHistory')) || [];
        return sh.filter(s => s.productId === productId);
    }
    async adjustStock(productId, qty, type, refId) {
        const p = await this.getProduct(productId);
        if (p) {
            p.stock += qty;
            await this.updateProduct(productId, p);
        }
    }
}
window.JsonDataStore = JsonDataStore;
