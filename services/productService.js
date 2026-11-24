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
                gstRate: (v.gst_rate !== undefined && v.gst_rate !== null) ? parseFloat(v.gst_rate) : null,
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
            p.gstRate = (p.gst_rate !== undefined && p.gst_rate !== null) ? parseFloat(p.gst_rate) : 0;
            if (p.variants.length > 0) {
                const defVar = p.variants[0];
                const totalStock = p.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                if (p.stock === 0 || p.stock === undefined || p.stock === null || totalStock > 0) {
                    p.stock = totalStock;
                }
                if ((p.price === 0 || p.price === undefined || p.price === null) && defVar && defVar.sellingPrice) {
                    p.price = defVar.sellingPrice;
                }
                if ((p.cost_price === 0 || p.cost_price === undefined || p.cost_price === null) && defVar && defVar.buyingPrice) {
                    p.cost_price = defVar.buyingPrice;
                }
                if (!p.barcode && defVar && defVar.barcode) {
                    p.barcode = defVar.barcode;
                }
            }
        }
        return products;
    }

    getAll() {
        return this.getProducts();
    }

    getProduct(id) {
        if (!id && id !== 0) return null;
        const db = dbManager.getDatabase();
        let product = null;
        if (Number.isInteger(Number(id))) {
            product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id));
        }
        if (!product) {
            product = db.prepare('SELECT * FROM products WHERE id = ? OR barcode = ?').get(id, String(id));
        }
        if (!product) {
            product = db.prepare(`
                SELECT p.* FROM products p 
                JOIN product_variants pv ON p.id = pv.product_id 
                WHERE pv.barcode = ? OR pv.sku = ?
                LIMIT 1
            `).get(String(id), String(id));
        }
        if (!product) return null;
        
        const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(product.id);
        product.gstRate = (product.gst_rate !== undefined && product.gst_rate !== null) ? parseFloat(product.gst_rate) : 0;
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
            gstRate: (v.gst_rate !== undefined && v.gst_rate !== null) ? parseFloat(v.gst_rate) : null,
            loc_location: v.loc_location || null,
            loc_godown: v.loc_godown || null,
            loc_floor: v.loc_floor || null,
            loc_rack: v.loc_rack || null,
            loc_section: v.loc_section || null,
            loc_shelf: v.loc_shelf || null,
            loc_bin: v.loc_bin || null
        }));
        if (product.variants && product.variants.length > 0) {
            const defVar = product.variants[0];
            const totalStock = product.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
            if (product.stock === 0 || product.stock === undefined || product.stock === null || totalStock > 0) {
                product.stock = totalStock;
            }
            if ((product.price === 0 || product.price === undefined || product.price === null) && defVar && defVar.sellingPrice) {
                product.price = defVar.sellingPrice;
            }
            if ((product.cost_price === 0 || product.cost_price === undefined || product.cost_price === null) && defVar && defVar.buyingPrice) {
                product.cost_price = defVar.buyingPrice;
            }
            if (!product.barcode && defVar && defVar.barcode) {
                product.barcode = defVar.barcode;
            }
        }
        return product;
    }

    createProduct(product) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const stmt = db.prepare('INSERT INTO products (name, barcode, category, unit, price, cost_price, stock, min_stock, description, supplier_text, pack_sizes, loc_location, loc_godown, loc_floor, loc_rack, loc_section, loc_shelf, loc_bin, is_favorite, hsn, gst_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
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
                product.loc_bin !== undefined ? product.loc_bin : (product.bin || null),
                product.is_favorite ? 1 : 0,
                product.hsn || null,
                parseFloat(product.gst_rate !== undefined ? product.gst_rate : (product.gstRate || 0)) || 0
            );
            const productId = info.lastInsertRowid;

            const insertVar = db.prepare('INSERT INTO product_variants (product_id, variant_name, sku, barcode, buying_price, selling_price, stock, loc_location, loc_godown, loc_floor, loc_rack, loc_section, loc_shelf, loc_bin, gst_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            
            if (product.variants && product.variants.length > 0) {
                for (const v of product.variants) {
                    const vGst = (v.gstRate !== undefined && v.gstRate !== null) ? parseFloat(v.gstRate) : ((v.gst_rate !== undefined && v.gst_rate !== null) ? parseFloat(v.gst_rate) : null);
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
                        v.loc_bin !== undefined ? v.loc_bin : (v.bin || null),
                        vGst
                    );
                }
            } else {
                insertVar.run(productId, '', null, product.barcode || null, product.cost_price || 0, product.price || 0, product.stock || 0, product.loc_location || null, product.loc_godown || null, product.loc_floor || null, product.loc_rack || null, product.loc_section || null, product.loc_shelf || null, product.loc_bin || null, null);
            }

            return productId;
        });
    }

    updateProduct(id, product) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
            const stmt = db.prepare('UPDATE products SET name = ?, barcode = ?, category = ?, unit = ?, price = ?, cost_price = ?, min_stock = ?, description = ?, supplier_text = ?, pack_sizes = ?, loc_location = ?, loc_godown = ?, loc_floor = ?, loc_rack = ?, loc_section = ?, loc_shelf = ?, loc_bin = ?, is_favorite = ?, hsn = ?, gst_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            stmt.run(
                product.name !== undefined ? product.name : (existing ? existing.name : ''),
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
                product.is_favorite !== undefined ? (product.is_favorite ? 1 : 0) : (existing ? existing.is_favorite : 0),
                product.hsn !== undefined ? product.hsn : (existing ? existing.hsn : null),
                parseFloat(product.gst_rate !== undefined ? product.gst_rate : (product.gstRate !== undefined ? product.gstRate : (existing ? existing.gst_rate : 0))) || 0,
                id
            );

            if (product.variants && product.variants.length > 0) {
                const incomingIds = product.variants
                    .map(v => v.id)
                    .filter(vid => vid !== undefined && vid !== null && !isNaN(Number(vid)) && Number(vid) > 0)
                    .map(vid => Number(vid));

                if (incomingIds.length > 0) {
                    const placeholders = incomingIds.map(() => '?').join(',');
                    db.prepare(`DELETE FROM product_variants WHERE product_id = ? AND id NOT IN (${placeholders}) AND stock = 0`).run(id, ...incomingIds);
                }

                const updateVar = db.prepare('UPDATE product_variants SET variant_name = ?, sku = ?, barcode = ?, buying_price = ?, selling_price = ?, loc_location = ?, loc_godown = ?, loc_floor = ?, loc_rack = ?, loc_section = ?, loc_shelf = ?, loc_bin = ?, gst_rate = ? WHERE id = ?');
                const updateVarKeepGst = db.prepare('UPDATE product_variants SET variant_name = ?, sku = ?, barcode = ?, buying_price = ?, selling_price = ?, loc_location = ?, loc_godown = ?, loc_floor = ?, loc_rack = ?, loc_section = ?, loc_shelf = ?, loc_bin = ? WHERE id = ?');
                const insertVar = db.prepare('INSERT INTO product_variants (product_id, variant_name, sku, barcode, buying_price, selling_price, stock, loc_location, loc_godown, loc_floor, loc_rack, loc_section, loc_shelf, loc_bin, gst_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                for (const v of product.variants) {
                    const loc_loc = v.loc_location !== undefined ? v.loc_location : (v.location !== undefined ? v.location : null);
                    const loc_god = v.loc_godown !== undefined ? v.loc_godown : (v.godown !== undefined ? v.godown : null);
                    const loc_flo = v.loc_floor !== undefined ? v.loc_floor : (v.floor !== undefined ? v.floor : null);
                    const loc_rac = v.loc_rack !== undefined ? v.loc_rack : (v.rack !== undefined ? v.rack : null);
                    const loc_sec = v.loc_section !== undefined ? v.loc_section : (v.section !== undefined ? v.section : null);
                    const loc_she = v.loc_shelf !== undefined ? v.loc_shelf : (v.shelf !== undefined ? v.shelf : null);
                    const loc_bin = v.loc_bin !== undefined ? v.loc_bin : (v.bin !== undefined ? v.bin : null);
                    const hasGst = (v.gstRate !== undefined || v.gst_rate !== undefined);
                    const vGst = hasGst ? ((v.gstRate !== undefined && v.gstRate !== null) ? parseFloat(v.gstRate) : ((v.gst_rate !== undefined && v.gst_rate !== null) ? parseFloat(v.gst_rate) : null)) : null;

                    const isExistingVar = v.id && !isNaN(Number(v.id)) && Number(v.id) > 0 && db.prepare('SELECT id FROM product_variants WHERE id = ? AND product_id = ?').get(Number(v.id), id);
                    if (isExistingVar) {
                        if (hasGst) {
                            updateVar.run((v.variantName !== undefined ? v.variantName : (v.variant_name !== undefined ? v.variant_name : (v.name !== undefined ? v.name : ''))) || '', v.sku || null, v.barcode || null, v.buyingPrice || v.buying_price || 0, v.sellingPrice || v.selling_price || 0, loc_loc, loc_god, loc_flo, loc_rac, loc_sec, loc_she, loc_bin, vGst, Number(v.id));
                        } else {
                            updateVarKeepGst.run((v.variantName !== undefined ? v.variantName : (v.variant_name !== undefined ? v.variant_name : (v.name !== undefined ? v.name : ''))) || '', v.sku || null, v.barcode || null, v.buyingPrice || v.buying_price || 0, v.sellingPrice || v.selling_price || 0, loc_loc, loc_god, loc_flo, loc_rac, loc_sec, loc_she, loc_bin, Number(v.id));
                        }
                    } else {
                        insertVar.run(id, (v.variantName !== undefined ? v.variantName : (v.variant_name !== undefined ? v.variant_name : (v.name !== undefined ? v.name : ''))) || '', v.sku || null, v.barcode || null, v.buyingPrice || v.buying_price || 0, v.sellingPrice || v.selling_price || 0, v.stock || 0, loc_loc, loc_god, loc_flo, loc_rac, loc_sec, loc_she, loc_bin, vGst);
                    }
                }
            }
            return { success: true };
        });
    }

    searchProducts(query) {
        if (!query || !String(query).trim()) {
            return this.getProducts();
        }
        const allProducts = this.getProducts();

        function normalizeTokens(text) {
            if (!text) return [];
            const lower = String(text).toLowerCase();
            const expanded = lower
                .replace(/(\d+)\s*rs\b/gi, (m, p1) => p1 + 'rs ' + p1 + 's ' + p1 + ' ')
                .replace(/(\d+)\s*s\b/gi, (m, p1) => p1 + 's ' + p1 + 'rs ' + p1 + ' ');
            return expanded
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(t => t.length > 0);
        }

        function buildProductSearchContext(p) {
            const name = String(p.name || '').toLowerCase();
            const barcode = String(p.barcode || '').toLowerCase();
            const category = String(p.category || '').toLowerCase();
            const brand = String(p.brand || '').toLowerCase();
            const sku = String(p.sku || '').toLowerCase();
            const rawParts = [name, barcode, category, brand, sku];
            if (p.variants) {
                for (const v of p.variants) {
                    rawParts.push(v.variantName, v.variant_name, v.barcode, v.sku);
                }
            }
            const combined = rawParts.filter(Boolean).join(' ');
            const stripped = combined.replace(/[^a-z0-9]/g, '');
            const tokens = normalizeTokens(combined);
            const tokenSet = new Set(tokens);
            return { name, barcode, category, combined, stripped, tokens, tokenSet };
        }

        function matchProduct(ctx, q) {
            const qLower = String(q).toLowerCase().trim();
            const qStripped = qLower.replace(/[^a-z0-9]/g, '');

            if (ctx.barcode === qLower || (qStripped.length >= 3 && ctx.stripped.includes(qStripped))) {
                return { match: true, score: 1000 };
            }

            const qTokens = qLower
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(t => t.length > 0);

            if (qTokens.length === 0) return { match: true, score: 0 };

            let totalScore = 0;
            for (const qToken of qTokens) {
                let tokenMatched = false;
                const numMatch = qToken.match(/^(\d+)(?:rs|s)$/);
                const altTokens = numMatch ? [qToken, numMatch[1], numMatch[1] + 'rs', numMatch[1] + 's'] : [qToken];

                for (const cand of altTokens) {
                    if (ctx.tokenSet.has(cand)) {
                        tokenMatched = true;
                        totalScore += 20;
                        break;
                    }
                    for (const pToken of ctx.tokens) {
                        if (pToken.startsWith(cand)) {
                            tokenMatched = true;
                            totalScore += 15;
                            break;
                        } else if (pToken.includes(cand)) {
                            tokenMatched = true;
                            totalScore += 10;
                            break;
                        }
                    }
                    if (tokenMatched) break;
                    if (ctx.stripped.includes(cand) || ctx.combined.includes(cand)) {
                        tokenMatched = true;
                        totalScore += 8;
                        break;
                    }
                }

                if (!tokenMatched) {
                    return { match: false, score: 0 };
                }
            }

            return { match: true, score: totalScore };
        }

        const matches = [];
        for (const p of allProducts) {
            const ctx = buildProductSearchContext(p);
            const res = matchProduct(ctx, query);
            if (res.match) {
                matches.push({ product: p, score: res.score });
            }
        }

        matches.sort((a, b) => b.score - a.score);
        return matches.map(m => m.product);
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
            stock: v.stock,
            gstRate: (v.gst_rate !== undefined && v.gst_rate !== null) ? parseFloat(v.gst_rate) : null
        };
    }

    addVariant(productId, variantData) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(productId);
            if (!product) {
                const err = new Error(`PRODUCT_NOT_FOUND: Product with ID ${productId} does not exist.`);
                err.code = 'PRODUCT_NOT_FOUND';
                throw err;
            }

            const varName = (variantData.variantName !== undefined ? variantData.variantName : (variantData.variant_name !== undefined ? variantData.variant_name : (variantData.name || ''))).trim();
            if (!varName) {
                const err = new Error('VARIANT_NAME_REQUIRED: Variant name cannot be empty.');
                err.code = 'VARIANT_NAME_REQUIRED';
                throw err;
            }

            // Check duplicate variant name for this parent product
            const existingVar = db.prepare('SELECT id FROM product_variants WHERE product_id = ? AND LOWER(TRIM(variant_name)) = LOWER(?)').get(productId, varName);
            if (existingVar) {
                const err = new Error(`DUPLICATE_VARIANT: Variant "${varName}" already exists for ${product.name}.`);
                err.code = 'DUPLICATE_VARIANT';
                throw err;
            }

            const barcode = variantData.barcode ? String(variantData.barcode).trim() : null;
            if (barcode) {
                const barcodeInVariants = db.prepare('SELECT id FROM product_variants WHERE barcode = ?').get(barcode);
                const barcodeInProducts = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
                if (barcodeInVariants || barcodeInProducts) {
                    const err = new Error(`DUPLICATE_BARCODE: Barcode "${barcode}" already exists.`);
                    err.code = 'DUPLICATE_BARCODE';
                    throw err;
                }
            }

            const buyingPrice = parseFloat(variantData.buyingPrice !== undefined ? variantData.buyingPrice : (variantData.buying_price || variantData.costPrice || 0)) || 0;
            const sellingPrice = parseFloat(variantData.sellingPrice !== undefined ? variantData.sellingPrice : (variantData.selling_price || variantData.price || 0)) || 0;
            const stock = parseFloat(variantData.stock || 0) || 0;

            const loc_loc = variantData.loc_location !== undefined ? variantData.loc_location : (variantData.location || null);
            const loc_god = variantData.loc_godown !== undefined ? variantData.loc_godown : (variantData.godown || null);
            const loc_flo = variantData.loc_floor !== undefined ? variantData.loc_floor : (variantData.floor || null);
            const loc_rac = variantData.loc_rack !== undefined ? variantData.loc_rack : (variantData.rack || null);
            const loc_sec = variantData.loc_section !== undefined ? variantData.loc_section : (variantData.section || null);
            const loc_she = variantData.loc_shelf !== undefined ? variantData.loc_shelf : (variantData.shelf || null);
            const loc_bin = variantData.loc_bin !== undefined ? variantData.loc_bin : (variantData.bin || null);
            const gst_rate = (variantData.gstRate !== undefined && variantData.gstRate !== null) ? parseFloat(variantData.gstRate) : null;

            const stmt = db.prepare(`
                INSERT INTO product_variants (
                    product_id, variant_name, sku, barcode, buying_price, selling_price,
                    stock, loc_location, loc_godown, loc_floor, loc_rack, loc_section, loc_shelf, loc_bin, gst_rate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const res = stmt.run(
                productId, varName, variantData.sku || barcode || null, barcode,
                buyingPrice, sellingPrice, stock,
                loc_loc, loc_god, loc_flo, loc_rac, loc_sec, loc_she, loc_bin, gst_rate
            );

            const newVariantId = res.lastInsertRowid;

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PRODUCT_VARIANT_CREATED', 'PRODUCT_VARIANT', newVariantId,
                `Added variant "${varName}" to product ID ${productId}`
            );

            return this.getVariant(newVariantId);
        });
    }

    deleteProduct(id) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            let product = null;
            if (id !== undefined && id !== null && Number.isInteger(Number(id))) {
                product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id));
            }
            if (!product && id) {
                product = db.prepare('SELECT * FROM products WHERE barcode = ?').get(String(id));
            }
            if (!product && id) {
                product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
            }
            if (!product) {
                const err = new Error(`PRODUCT_NOT_FOUND: Product with ID ${id} does not exist.`);
                err.code = 'PRODUCT_NOT_FOUND';
                throw err;
            }

            const prodId = product.id;

            // Check stock: parent product stock or any variant stock > 0
            const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(prodId);
            const parentStock = parseFloat(product.stock) || 0;
            const variantsStock = variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
            const totalStock = parentStock + variantsStock;
            if (totalStock > 0) {
                const err = new Error(`CANNOT_DELETE_STOCK: Cannot delete product with existing stock (${totalStock} units). Please adjust stock to 0 first.`);
                err.code = 'CANNOT_DELETE_STOCK';
                throw err;
            }

            // Check transaction history
            let salesCount = 0;
            try {
                salesCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ? OR variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)').get(prodId, prodId)?.count || 0;
            } catch(e) {
                try {
                    salesCount = db.prepare('SELECT COUNT(*) as count FROM sales_items WHERE product_id = ? OR variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)').get(prodId, prodId)?.count || 0;
                } catch(e2) {}
            }
            let purchaseCount = 0;
            try {
                purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ? OR variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)').get(prodId, prodId)?.count || 0;
            } catch(e) {}
            let poCount = 0;
            try {
                poCount = db.prepare('SELECT COUNT(*) as count FROM purchase_order_items WHERE product_id = ? OR variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)').get(prodId, prodId)?.count || 0;
            } catch(e) {}
            let stockHistCount = 0;
            try {
                stockHistCount = db.prepare('SELECT COUNT(*) as count FROM stock_history WHERE product_id = ? OR variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)').get(prodId, prodId)?.count || 0;
            } catch(e) {}

            if (salesCount > 0 || purchaseCount > 0 || poCount > 0 || stockHistCount > 0) {
                const details = [];
                if (salesCount > 0) details.push(`${salesCount} sales records`);
                if (purchaseCount > 0) details.push(`${purchaseCount} purchase records`);
                if (poCount > 0) details.push(`${poCount} purchase order records`);
                if (stockHistCount > 0) details.push(`${stockHistCount} stock movement records`);
                const err = new Error(`CANNOT_DELETE_HISTORY: Cannot delete "${product.name}" because it has existing transaction history (${details.join(', ')}). Product must be preserved for accounting integrity.`);
                err.code = 'CANNOT_DELETE_HISTORY';
                throw err;
            }

            // Safe to delete child rows and then parent product
            try { db.prepare('DELETE FROM inventory_alerts WHERE product_id = ?').run(prodId); } catch(e) {}
            try { db.prepare('DELETE FROM product_prices WHERE product_id = ?').run(prodId); } catch(e) {}
            try { db.prepare('DELETE FROM product_stock_locations WHERE product_id = ?').run(prodId); } catch(e) {}
            try { db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(prodId); } catch(e) {}
            db.prepare('DELETE FROM products WHERE id = ?').run(prodId);

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PRODUCT_DELETED', 'PRODUCT', prodId, `Deleted zero-stock product "${product.name}" (ID ${prodId})`
            );

            return { success: true, id: prodId, name: product.name };
        });
    }

    deleteVariant(variantId, productId = null) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            let variant = null;
            if (variantId !== undefined && variantId !== null && Number.isInteger(Number(variantId))) {
                variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(Number(variantId));
            }
            if (!variant && variantId) {
                variant = db.prepare('SELECT * FROM product_variants WHERE barcode = ? OR sku = ?').get(String(variantId), String(variantId));
            }
            if (!variant && variantId) {
                variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId);
            }
            if (!variant) {
                const err = new Error(`VARIANT_NOT_FOUND: Variant with ID "${variantId}" does not exist.`);
                err.code = 'VARIANT_NOT_FOUND';
                throw err;
            }

            const vId = variant.id;
            const parentId = variant.product_id;
            const variantDisplayName = variant.variant_name || 'Standard';

            // 1. Check stock
            const varStock = parseFloat(variant.stock) || 0;
            if (varStock > 0) {
                const err = new Error(`CANNOT_DELETE_STOCK: Cannot delete variant "${variantDisplayName}" with existing stock (${varStock} units). Please adjust stock to 0 first.`);
                err.code = 'CANNOT_DELETE_STOCK';
                throw err;
            }

            // 2. Check transaction history for this variant
            let salesCount = 0;
            try {
                salesCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE variant_id = ?').get(vId)?.count || 0;
            } catch(e) {
                try {
                    salesCount = db.prepare('SELECT COUNT(*) as count FROM sales_items WHERE variant_id = ?').get(vId)?.count || 0;
                } catch(e2) {}
            }
            let purchaseCount = 0;
            try {
                purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE variant_id = ?').get(vId)?.count || 0;
            } catch(e) {}
            let poCount = 0;
            try {
                poCount = db.prepare('SELECT COUNT(*) as count FROM purchase_order_items WHERE variant_id = ?').get(vId)?.count || 0;
            } catch(e) {}
            let stockHistCount = 0;
            try {
                stockHistCount = db.prepare('SELECT COUNT(*) as count FROM stock_history WHERE variant_id = ?').get(vId)?.count || 0;
            } catch(e) {}

            if (salesCount > 0 || purchaseCount > 0 || poCount > 0 || stockHistCount > 0) {
                const details = [];
                if (salesCount > 0) details.push(`${salesCount} sales records`);
                if (purchaseCount > 0) details.push(`${purchaseCount} purchase records`);
                if (poCount > 0) details.push(`${poCount} purchase order records`);
                if (stockHistCount > 0) details.push(`${stockHistCount} stock movement records`);
                const err = new Error(`CANNOT_DELETE_HISTORY: Cannot delete variant "${variantDisplayName}" because it has existing transaction history (${details.join(', ')}). Variant must be preserved for accounting integrity.`);
                err.code = 'CANNOT_DELETE_HISTORY';
                throw err;
            }

            // 3. Delete from product_stock_locations for this variant
            try {
                db.prepare('DELETE FROM product_stock_locations WHERE variant_id = ?').run(vId);
            } catch(e) {}

            // 4. Delete the variant record
            db.prepare('DELETE FROM product_variants WHERE id = ?').run(vId);

            // 5. Recalculate parent product total stock from remaining variants
            const remainingVars = db.prepare('SELECT stock FROM product_variants WHERE product_id = ?').all(parentId);
            if (remainingVars.length > 0) {
                const totalVarStock = remainingVars.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(totalVarStock, parentId);
            } else {
                db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(parentId);
            }

            // 6. Audit log
            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PRODUCT_VARIANT_DELETED', 'PRODUCT_VARIANT', vId,
                `Deleted zero-stock variant "${variantDisplayName}" (ID ${vId}) of product ID ${parentId}`
            );

            return { success: true, variantId: vId, productId: parentId, variantName: variantDisplayName };
        });
    }

    updateGstRate(productId, gstRate) {
        return this.updateProductGstRate(productId, gstRate);
    }

    updateProductGstRate(productId, gstRate) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(productId);
            if (!product) {
                const err = new Error(`PRODUCT_NOT_FOUND: Product with ID ${productId} does not exist.`);
                err.code = 'PRODUCT_NOT_FOUND';
                throw err;
            }

            const parsedRate = parseFloat(gstRate);
            const rate = isNaN(parsedRate) ? 0 : parsedRate;
            if (rate < 0 || rate > 100) {
                const err = new Error('INVALID_GST_RATE: GST rate must be between 0 and 100.');
                err.code = 'INVALID_GST_RATE';
                throw err;
            }

            db.prepare('UPDATE products SET gst_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(rate, productId);
            db.prepare("UPDATE product_variants SET gst_rate = ? WHERE product_id = ? AND (variant_name IS NULL OR TRIM(variant_name) = '' OR LOWER(TRIM(variant_name)) = 'default')").run(rate, productId);

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PRODUCT_GST_UPDATED', 'PRODUCT', productId, `Updated GST rate to ${rate}% for product "${product.name}"`
            );

            return { success: true, id: productId, gstRate: rate };
        });
    }

    updateVariantGstRate(variantId, gstRate) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const variant = db.prepare('SELECT id, product_id, variant_name FROM product_variants WHERE id = ?').get(variantId);
            if (!variant) {
                const err = new Error(`VARIANT_NOT_FOUND: Variant with ID ${variantId} does not exist.`);
                err.code = 'VARIANT_NOT_FOUND';
                throw err;
            }

            const rate = parseFloat(gstRate);
            if (isNaN(rate) || rate < 0 || rate > 100) {
                const err = new Error('INVALID_GST_RATE: GST rate must be between 0 and 100.');
                err.code = 'INVALID_GST_RATE';
                throw err;
            }

            db.prepare('UPDATE product_variants SET gst_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(rate, variantId);

            if (!variant.variant_name || variant.variant_name.trim() === '' || variant.variant_name.trim().toLowerCase() === 'default') {
                db.prepare('UPDATE products SET gst_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(rate, variant.product_id);
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PRODUCT_VARIANT_GST_UPDATED', 'PRODUCT_VARIANT', variantId,
                `Updated GST rate for variant "${variant.variant_name}" to ${rate}%`
            );

            return { success: true, variantId, gstRate: rate };
        });
    }
}

module.exports = new ProductService();
