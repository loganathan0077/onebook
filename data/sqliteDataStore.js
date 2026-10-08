class SqliteDataStore {
    async getProducts() {
        const res = await window.electronAPI.sqlite.products.getAll();
        return res.success ? res.data : [];
    }
    async getProduct(id) {
        const res = await window.electronAPI.sqlite.products.get(id);
        return res.success ? res.data : null;
    }
    async createProduct(product) {
        const res = await window.electronAPI.sqlite.products.create(product);
        if (!res.success) throw new Error(res.error.message);
        return res.data; // id
    }
    async updateProduct(id, product) {
        const res = await window.electronAPI.sqlite.products.update(id, product);
        if (!res.success) throw new Error(res.error.message);
    }
    async searchProducts(query) {
        const res = await window.electronAPI.sqlite.products.search(query);
        return res.success ? res.data : [];
    }

    async getCustomers() {
        const res = await window.electronAPI.sqlite.customers.getAll();
        return res.success ? res.data : [];
    }
    async getCustomer(id) {
        const res = await window.electronAPI.sqlite.customers.get(id);
        return res.success ? res.data : null;
    }
    async createCustomer(customer) {
        const res = await window.electronAPI.sqlite.customers.create(customer);
        if (!res.success) throw new Error(res.error.message);
        return res.data;
    }

    async createSale(salePayload) {
        const res = await window.electronAPI.sqlite.sales.create(salePayload);
        if (!res.success) throw new Error(res.error.message);
        return res.data;
    }
    async cancelSale(id) {
        const res = await window.electronAPI.sqlite.sales.cancel(id);
        if (!res.success) throw new Error(res.error.message);
        return res.data;
    }

    async getStock(productId) {
        const res = await window.electronAPI.sqlite.stock.get(productId);
        return res.success ? res.data : 0;
    }
    async getStockMovements(productId) {
        const res = await window.electronAPI.sqlite.stock.movements(productId);
        return res.success ? res.data : [];
    }
    async adjustStock(productId, qty, type, refId) {
        const res = await window.electronAPI.sqlite.stock.adjust(productId, qty, type, refId);
        if (!res.success) throw new Error(res.error.message);
    }
}
window.SqliteDataStore = SqliteDataStore;
