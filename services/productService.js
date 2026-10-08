const dbManager = require('../database');

class ProductService {
    getProducts() {
        const db = dbManager.getDatabase();
        const products = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
        const variants = db.prepare('SELECT * FROM product_variants').all();
        const variantsByProduct = {};
        for (const v of variants) {
            if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
            variantsByProduct[v.product_id].push({
                id: v.id,
                productId: v.product_id,
                variantName: v.variant_name,
                legacyVariantId: v.legacy_variant_id,
                sku: v.sku,
                barcode: v.barcode,
                buyingPrice: v.buying_price,
                sellingPrice: v.selling_price,
                stock: v.stock
            });
        }
        for (const p of products) {
            p.variants = variantsByProduct[p.id] || [];
        }
        return products;
    }

    getProduct(id) {
        const db = dbManager.getDatabase();
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!product) return null;
        
        const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(id);
        product.variants = variants.map(v => ({
            id: v.id,
            productId: v.product_id,
            variantName: v.variant_name,
            legacyVariantId: v.legacy_variant_id,
            sku: v.sku,
            barcode: v.barcode,
            buyingPrice: v.buying_price,
            sellingPrice: v.selling_price,
            stock: v.stock
        }));
        return product;
    }

    createProduct(product) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const stmt = db.prepare('INSERT INTO products (name, barcode, category, unit, price, cost_price, stock, min_stock, description, supplier_text, pack_sizes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            const info = stmt.run(
                product.name,
                product.barcode || null,
                product.category || null,
                product.unit || null,
                product.price || 0,
                product.cost_price || 0,
                product.stock || 0,
                product.min_stock || 0,
                product.description || null,
                product.supplier_text || null,
                product.pack_sizes ? JSON.stringify(product.pack_sizes) : null
            );
            const productId = info.lastInsertRowid;

            const insertVar = db.prepare('INSERT INTO product_variants (product_id, variant_name, sku, barcode, buying_price, selling_price, stock) VALUES (?, ?, ?, ?, ?, ?, ?)');
            
            if (product.variants && product.variants.length > 0) {
                for (const v of product.variants) {
                    insertVar.run(productId, v.variantName, v.sku || null, v.barcode || null, v.buyingPrice || 0, v.sellingPrice || 0, v.stock || 0);
                }
            } else {
                insertVar.run(productId, 'Default', null, product.barcode || null, product.cost_price || 0, product.price || 0, 0);
            }

            return productId;
        });
    }

    updateProduct(id, product) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const stmt = db.prepare('UPDATE products SET name = ?, barcode = ?, category = ?, unit = ?, price = ?, cost_price = ?, min_stock = ?, description = ?, supplier_text = ?, pack_sizes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            stmt.run(
                product.name,
                product.barcode || null,
                product.category || null,
                product.unit || null,
                product.price || 0,
                product.cost_price || 0,
                product.min_stock || 0,
                product.description || null,
                product.supplier_text || null,
                product.pack_sizes ? JSON.stringify(product.pack_sizes) : null,
                id
            );

            if (product.variants && product.variants.length > 0) {
                const updateVar = db.prepare('UPDATE product_variants SET variant_name = ?, sku = ?, barcode = ?, buying_price = ?, selling_price = ? WHERE id = ?');
                const insertVar = db.prepare('INSERT INTO product_variants (product_id, variant_name, sku, barcode, buying_price, selling_price, stock) VALUES (?, ?, ?, ?, ?, ?, ?)');
                for (const v of product.variants) {
                    if (v.id) {
                        updateVar.run(v.variantName || v.variant_name, v.sku || null, v.barcode || null, v.buyingPrice || v.buying_price || 0, v.sellingPrice || v.selling_price || 0, v.id);
                    } else {
                        insertVar.run(id, v.variantName || v.variant_name, v.sku || null, v.barcode || null, v.buyingPrice || v.buying_price || 0, v.sellingPrice || v.selling_price || 0, v.stock || 0);
                    }
                }
            }
        });
    }

    searchProducts(query) {
        const db = dbManager.getDatabase();
        const searchTerm = '%' + query + '%';
        const products = db.prepare('SELECT p.* FROM products p LEFT JOIN product_variants pv ON p.id = pv.product_id WHERE p.name LIKE ? OR p.barcode LIKE ? OR pv.barcode LIKE ? OR pv.sku LIKE ? GROUP BY p.id').all(searchTerm, searchTerm, searchTerm, searchTerm);
        if (products.length > 0) {
            const productIds = products.map(p => p.id);
            const variants = db.prepare(`SELECT * FROM product_variants WHERE product_id IN (${productIds.join(',')})`).all();
            const variantsByProduct = {};
            for (const v of variants) {
                if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
                variantsByProduct[v.product_id].push({
                    id: v.id,
                    productId: v.product_id,
                    variantName: v.variant_name,
                    legacyVariantId: v.legacy_variant_id,
                    sku: v.sku,
                    barcode: v.barcode,
                    buyingPrice: v.buying_price,
                    sellingPrice: v.selling_price,
                    stock: v.stock
                });
            }
            for (const p of products) {
                p.variants = variantsByProduct[p.id] || [];
            }
        }
        return products;
    }

    getLowStockProducts() {
        const db = dbManager.getDatabase();
        const products = db.prepare(`
            SELECT p.*, pv.id as variant_id, pv.variant_name, pv.stock as variant_stock 
            FROM products p 
            JOIN product_variants pv ON p.id = pv.product_id 
            WHERE pv.stock <= p.min_stock AND p.min_stock > 0
        `).all();
        return products;
    }

    getVariant(variantId) {
        const db = dbManager.getDatabase();
        const v = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId);
        if (!v) return null;
        return {
            id: v.id,
            productId: v.product_id,
            variantName: v.variant_name,
            legacyVariantId: v.legacy_variant_id,
            sku: v.sku,
            barcode: v.barcode,
            buyingPrice: v.buying_price,
            sellingPrice: v.selling_price,
            stock: v.stock
        };
    }
}

module.exports = new ProductService();
