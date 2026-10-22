class SqliteDataStore {
    async getProducts() {
        const res = await window.electronAPI.sqlite.products.getAll();
        const pList = (res && res.success && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
        return pList.map(p => {
            const defVar = p.variants && p.variants.length > 0 ? p.variants[0] : null;
            return {
                ...p,
                id: p.id,
                name: p.name,
                category: p.category,
                barcode: defVar ? defVar.barcode : p.barcode,
                price: Number(defVar ? (defVar.sellingPrice !== undefined ? defVar.sellingPrice : defVar.selling_price) : (p.price || 0)),
                sellingPrice: Number(defVar ? (defVar.sellingPrice !== undefined ? defVar.sellingPrice : defVar.selling_price) : (p.price || 0)),
                costPrice: Number(defVar ? (defVar.buyingPrice !== undefined ? defVar.buyingPrice : defVar.buying_price) : (p.cost_price || p.costPrice || 0)),
                stock: Number(defVar ? defVar.stock : (p.stock || 0)),
                minStock: Number(p.min_stock || p.minStock || 0),
                unit: p.unit || 'Piece',
                variants: (p.variants || []).map(v => ({
                    id: v.id,
                    productId: v.productId || v.product_id || p.id,
                    variantName: v.variantName || v.variant_name || 'Default',
                    sku: v.sku,
                    barcode: v.barcode,
                    buyingPrice: Number(v.buyingPrice !== undefined ? v.buyingPrice : (v.buying_price || 0)),
                    sellingPrice: Number(v.sellingPrice !== undefined ? v.sellingPrice : (v.selling_price || 0)),
                    stock: Number(v.stock || 0),
                    minimumStock: Number(p.min_stock || p.minStock || 0)
                }))
            };
        });
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
