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
                stock: v.stock,
                loc_location: v.loc_location || null,
                loc_godown: v.loc_godown || null,
                loc_floor: v.loc_floor || null,
                loc_rack: v.loc_rack || null,
                loc_section: v.loc_section || null,
                loc_shelf: v.loc_shelf || null,
                loc_bin: v.loc_bin || null
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
            stock: v.stock,
            loc_location: v.loc_location || null,
            loc_godown: v.loc_godown || null,
            loc_floor: v.loc_floor || null,
            loc_rack: v.loc_rack || null,
            loc_section: v.loc_section || null,
            loc_shelf: v.loc_shelf || null,
            loc_bin: v.loc_bin || null
        }));
        return product;
    }

    createProduct(product) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const stmt = db.prepare('INSERT INTO products (name, barcode, category, unit, price, cost_price, stock, min_stock, description, supplier_text, pack_sizes, loc_location, loc_godown, loc_floor, loc_rack, loc_section, loc_shelf, loc_bin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
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
                product.pack_sizes ? JSON.stringify(product.pack_sizes) : null,
                product.loc_location !== undefined ? product.loc_location : (product.location || null),
                product.loc_godown !== undefined ? product.loc_godown : (product.godown || null),
                product.loc_floor !== undefined ? product.loc_floor : (product.floor || null),
                product.loc_rack !== undefined ? product.loc_rack : (product.rack || null),
                product.loc_section !== undefined ? product.loc_section : (product.section || null),
                product.loc_shelf !== undefined ? product.loc_shelf : (product.shelf || null),
                product.loc_bin !== undefined ? product.loc_bin : (product.bin || null)
            );
            const productId = info.lastInsertRowid;

            const insertVar = db.prepare('INSERT INTO product_variants (product_id, variant_name, sku, barcode, buying_price, selling_price, stock, loc_location, loc_godown, loc_floor, loc_rack, loc_section, loc_shelf, loc_bin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            
            if (product.variants && product.variants.length > 0) {
                for (const v of product.variants) {
                    insertVar.run(
                        productId,
                        v.variantName !== undefined ? v.variantName : (v.variant_name !== undefined ? v.variant_name : (v.name !== undefined ? v.name : '')),
                        v.sku || null,
                        v.barcode || null,
                        v.buyingPrice !== undefined ? v.buyingPrice : (v.cost_price || 0),
                        v.sellingPrice !== undefined ? v.sellingPrice : (v.price || 0),
                        v.stock || 0,
                        v.loc_location !== undefined ? v.loc_location : (v.location || null),
                        v.loc_godown !== undefined ? v.loc_godown : (v.godown || null),
                        v.loc_floor !== undefined ? v.loc_floor : (v.floor || null),
                        v.loc_rack !== undefined ? v.loc_rack : (v.rack || null),
                        v.loc_section !== undefined ? v.loc_section : (v.section || null),
                        v.loc_shelf !== undefined ? v.loc_shelf : (v.shelf || null),
                        v.loc_bin !== undefined ? v.loc_bin : (v.bin || null)
                    );
                }
            } else {
                insertVar.run(productId, '', null, product.barcode || null, product.cost_price || 0, product.price || 0, product.stock || 0, product.loc_location || null, product.loc_godown || null, product.loc_floor || null, product.loc_rack || null, product.loc_section || null, product.loc_shelf || null, product.loc_bin || null);
            }

            return productId;
        });
    }

    updateProduct(id, product) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const stmt = db.prepare('UPDATE products SET name = ?, barcode = ?, category = ?, unit = ?, price = ?, cost_price = ?, min_stock = ?, description = ?, supplier_text = ?, pack_sizes = ?, loc_location = ?, loc_godown = ?, loc_floor = ?, loc_rack = ?, loc_section = ?, loc_shelf = ?, loc_bin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
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
                product.loc_location !== undefined ? product.loc_location : (product.location !== undefined ? product.location : null),
                product.loc_godown !== undefined ? product.loc_godown : (product.godown !== undefined ? product.godown : null),
                product.loc_floor !== undefined ? product.loc_floor : (product.floor !== undefined ? product.floor : null),
                product.loc_rack !== undefined ? product.loc_rack : (product.rack !== undefined ? product.rack : null),
                product.loc_section !== undefined ? product.loc_section : (product.section !== undefined ? product.section : null),
                product.loc_shelf !== undefined ? product.loc_shelf : (product.shelf !== undefined ? product.shelf : null),
                product.loc_bin !== undefined ? product.loc_bin : (product.bin !== undefined ? product.bin : null),
                id
            );

            if (product.variants && product.variants.length > 0) {
                const incomingIds = product.variants.filter(v => v.id).map(v => v.id);
                if (incomingIds.length > 0) {
                    db.prepare('DELETE FROM product_variants WHERE product_id = ? AND id NOT IN (' + incomingIds.join(',') + ') AND stock = 0').run(id);
                }

                const updateVar = db.prepare('UPDATE product_variants SET variant_name = ?, sku = ?, barcode = ?, buying_price = ?, selling_price = ?, loc_location = ?, loc_godown = ?, loc_floor = ?, loc_rack = ?, loc_section = ?, loc_shelf = ?, loc_bin = ? WHERE id = ?');
                const insertVar = db.prepare('INSERT INTO product_variants (product_id, variant_name, sku, barcode, buying_price, selling_price, stock, loc_location, loc_godown, loc_floor, loc_rack, loc_section, loc_shelf, loc_bin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                for (const v of product.variants) {
                    const loc_loc = v.loc_location !== undefined ? v.loc_location : (v.location !== undefined ? v.location : null);
                    const loc_god = v.loc_godown !== undefined ? v.loc_godown : (v.godown !== undefined ? v.godown : null);
                    const loc_flo = v.loc_floor !== undefined ? v.loc_floor : (v.floor !== undefined ? v.floor : null);
                    const loc_rac = v.loc_rack !== undefined ? v.loc_rack : (v.rack !== undefined ? v.rack : null);
                    const loc_sec = v.loc_section !== undefined ? v.loc_section : (v.section !== undefined ? v.section : null);
                    const loc_she = v.loc_shelf !== undefined ? v.loc_shelf : (v.shelf !== undefined ? v.shelf : null);
                    const loc_bin = v.loc_bin !== undefined ? v.loc_bin : (v.bin !== undefined ? v.bin : null);

                    if (v.id) {
                        updateVar.run((v.variantName !== undefined ? v.variantName : (v.variant_name !== undefined ? v.variant_name : (v.name !== undefined ? v.name : ''))) || '', v.sku || null, v.barcode || null, v.buyingPrice || v.buying_price || 0, v.sellingPrice || v.selling_price || 0, loc_loc, loc_god, loc_flo, loc_rac, loc_sec, loc_she, loc_bin, v.id);
                    } else {
                        insertVar.run(id, (v.variantName !== undefined ? v.variantName : (v.variant_name !== undefined ? v.variant_name : (v.name !== undefined ? v.name : ''))) || '', v.sku || null, v.barcode || null, v.buyingPrice || v.buying_price || 0, v.sellingPrice || v.selling_price || 0, v.stock || 0, loc_loc, loc_god, loc_flo, loc_rac, loc_sec, loc_she, loc_bin);
                    }
                }
            }
        });
    }

    searchProducts(query) {
        const db = dbManager.getDatabase();
        const searchTerm = '%' + query + '%';
        const products = db.prepare('SELECT p.* FROM products p LEFT JOIN product_variants pv ON p.id = pv.product_id WHERE p.name LIKE ? OR p.barcode LIKE ? OR p.category LIKE ? OR pv.variant_name LIKE ? OR pv.barcode LIKE ? OR pv.sku LIKE ? GROUP BY p.id ORDER BY p.name ASC').all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
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
                    stock: v.stock,
                    loc_location: v.loc_location || null,
                    loc_godown: v.loc_godown || null,
                    loc_floor: v.loc_floor || null,
                    loc_rack: v.loc_rack || null,
                    loc_section: v.loc_section || null,
                    loc_shelf: v.loc_shelf || null,
                    loc_bin: v.loc_bin || null
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
