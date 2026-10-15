const dbManager = require('../database');
const purchaseService = require('./purchaseService');

class PurchaseOrderService {
    _mapPO(row, items = []) {
        return {
            ...row,
            id: row.po_number || String(row.id),
            internal_id: row.id,
            po_number: row.po_number,
            date: row.date ? row.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
            createdAt: row.created_at || row.date,
            supplier: row.supplier_name || "Unknown Supplier",
            supplierName: row.supplier_name || "Unknown Supplier",
            supplierId: row.supplier_id || null,
            total: row.total || 0,
            status: row.status || "Pending",
            notes: row.notes || "",
            items: items.map(item => ({
                id: item.id,
                productId: item.product_id,
                variantId: item.variant_id,
                name: item.product_name,
                productName: item.product_name,
                qty: item.quantity,
                quantity: item.quantity,
                price: item.price,
                rate: item.price,
                total: item.total,
                product: {
                    id: item.product_id,
                    name: item.product_name,
                    variantId: item.variant_id,
                    price: item.price
                }
            }))
        };
    }

    getPurchaseOrders() {
        const db = dbManager.getDatabase();
        const pos = db.prepare('SELECT * FROM purchase_orders ORDER BY date DESC, id DESC').all();
        return pos.map(po => {
            const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(po.id);
            return this._mapPO(po, items);
        });
    }

    getPurchaseOrder(id) {
        const db = dbManager.getDatabase();
        // Allow query by numeric id or po_number string
        const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ? OR po_number = ?').get(id, id);
        if (po) {
            const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(po.id);
            return this._mapPO(po, items);
        }
        return null;
    }

    searchPurchaseOrders(query) {
        const db = dbManager.getDatabase();
        const q = '%' + query + '%';
        const pos = db.prepare('SELECT * FROM purchase_orders WHERE po_number LIKE ? OR supplier_name LIKE ? ORDER BY date DESC LIMIT 50').all(q, q);
        return pos.map(po => {
            const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(po.id);
            return this._mapPO(po, items);
        });
    }

    createPurchaseOrder(data, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            // Generate PO Number if not provided
            const poNumber = data.poNumber || data.id || 'PO-' + Date.now();
            
            // Check for duplicates
            const duplicateCheck = db.prepare("SELECT id FROM purchase_orders WHERE po_number = ? AND status != 'Cancelled'").get(poNumber);
            if (duplicateCheck) {
                let err = new Error('PO_NUMBER_DUPLICATE');
                err.code = 'PO_NUMBER_DUPLICATE';
                throw err;
            }

            const insertPO = db.prepare(`
                INSERT INTO purchase_orders (po_number, date, supplier_id, supplier_name, total, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const total = (data.totalAmount !== undefined && data.totalAmount !== null)
                ? parseFloat(data.totalAmount)
                : (data.items ? data.items.reduce((sum, item) => sum + ((parseFloat(item.price || item.rate) || 0) * (parseFloat(item.qty || item.quantity) || 0)), 0) : 0);

            const result = insertPO.run(
                poNumber,
                data.date || new Date().toISOString(),
                data.supplierId || null,
                data.supplier || data.supplierName || 'Unknown Supplier',
                total,
                data.status || 'Pending',
                data.notes || ''
            );
            
            const poId = result.lastInsertRowid;

            if (testFailure === 'HEADER_INSERT') {
                throw new Error("TEST_FAILURE_HEADER");
            }

            const insertItem = db.prepare(`
                INSERT INTO purchase_order_items (po_id, product_id, variant_id, product_name, quantity, price, total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    const qty = parseFloat(item.qty || item.quantity) || 0;
                    const price = parseFloat(item.price || item.rate) || 0;
                    const itemTotal = qty * price;
                    
                    let productId = item.productId || (item.product ? item.product.id : null);
                    let variantId = item.variantId || (item.product ? item.product.variantId : null);
                    
                    // Fallback to fetch default variant if variantId is missing but product exists
                    if (productId && !variantId) {
                        const defaultVar = db.prepare("SELECT id FROM product_variants WHERE product_id = ? ORDER BY id ASC LIMIT 1").get(productId);
                        if (defaultVar) {
                            variantId = defaultVar.id;
                        }
                    }

                    if (!productId) {
                        throw new Error('INVALID_PRODUCT_ID');
                    }

                    let productName = item.productName;
                    if (!productName && item.product) productName = item.product.name;
                    if (!productName) productName = 'Unknown';

                    insertItem.run(
                        poId,
                        productId,
                        variantId,
                        productName,
                        qty,
                        price,
                        itemTotal
                    );
                });
            }

            if (testFailure === 'ITEMS_INSERT') {
                throw new Error("TEST_FAILURE_ITEMS");
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('PO_CREATED', 'PO', poId);

            return poId;
        });
    }

    updatePurchaseOrder(id, data) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const existing = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
            if (!existing) {
                throw new Error('PO_NOT_FOUND');
            }
            if (existing.status === 'Received' || existing.status === 'Cancelled') {
                throw new Error('PO_CANNOT_BE_MODIFIED');
            }

            const poNumber = data.poNumber || data.id || existing.po_number;
            
            // Check for duplicates
            const duplicateCheck = db.prepare("SELECT id FROM purchase_orders WHERE id != ? AND po_number = ? AND status != 'Cancelled'").get(id, poNumber);
            if (duplicateCheck) {
                let err = new Error('PO_NUMBER_DUPLICATE');
                err.code = 'PO_NUMBER_DUPLICATE';
                throw err;
            }

            const total = (data.totalAmount !== undefined && data.totalAmount !== null)
                ? parseFloat(data.totalAmount)
                : (data.items ? data.items.reduce((sum, item) => sum + ((parseFloat(item.price || item.rate) || 0) * (parseFloat(item.qty || item.quantity) || 0)), 0) : existing.total);

            db.prepare(`
                UPDATE purchase_orders SET 
                    po_number = ?, date = ?, supplier_id = ?, supplier_name = ?, total = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                poNumber,
                data.date || existing.date,
                data.supplierId || existing.supplier_id,
                data.supplier || data.supplierName || existing.supplier_name,
                total,
                data.status || existing.status,
                data.notes || existing.notes,
                id
            );

            // Replace items
            db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(id);

            const insertItem = db.prepare(`
                INSERT INTO purchase_order_items (po_id, product_id, variant_id, product_name, quantity, price, total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    const qty = parseFloat(item.qty || item.quantity) || 0;
                    const price = parseFloat(item.price || item.rate) || 0;
                    const itemTotal = qty * price;
                    
                    let productId = item.productId || (item.product ? item.product.id : null);
                    let variantId = item.variantId || (item.product ? item.product.variantId : null);
                    
                    if (productId && !variantId) {
                        const defaultVar = db.prepare("SELECT id FROM product_variants WHERE product_id = ? ORDER BY id ASC LIMIT 1").get(productId);
                        if (defaultVar) {
                            variantId = defaultVar.id;
                        }
                    }

                    if (!productId) {
                        throw new Error('INVALID_PRODUCT_ID');
                    }

                    let productName = item.productName;
                    if (!productName && item.product) productName = item.product.name;
                    if (!productName) productName = 'Unknown';

                    insertItem.run(
                        id,
                        productId,
                        variantId,
                        productName,
                        qty,
                        price,
                        itemTotal
                    );
                });
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('PO_UPDATED', 'PO', id);

            return true;
        });
    }

    cancelPurchaseOrder(id) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
            if (!po) throw new Error('PO_NOT_FOUND');

            if (po.status === 'Received') {
                throw new Error('CANNOT_CANCEL_RECEIVED_PO'); // To cancel a received PO, one should cancel the underlying Purchase.
            }

            db.prepare("UPDATE purchase_orders SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('PO_CANCELLED', 'PO', id);

            return true;
        });
    }

    receivePurchaseOrder(id, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const po = this.getPurchaseOrder(id);
            if (!po) throw new Error('PO_NOT_FOUND');

            if (po.status === 'Received') {
                throw new Error('PO_ALREADY_RECEIVED');
            }
            if (po.status === 'Cancelled') {
                throw new Error('PO_CANCELLED');
            }

            if (testFailure === 'BEFORE_CONVERSION') {
                throw new Error('TEST_FAILURE_BEFORE_CONVERSION');
            }

            // Map PO items to Purchase items
            const purchaseItems = po.items.map(item => ({
                productId: item.productId !== undefined ? item.productId : item.product_id,
                variantId: item.variantId !== undefined ? item.variantId : item.variant_id,
                qty: item.qty !== undefined ? item.qty : item.quantity,
                price: item.price,
                total: item.total
            }));

            const purchaseData = {
                invoiceNumber: "PO-" + po.po_number + "-INV",
                supplier: po.supplier_name,
                supplierId: po.supplier_id,
                date: new Date().toISOString(),
                items: purchaseItems,
                subtotal: po.total,
                totalAmount: po.total
            };

            // This creates the purchase and updates stock, and generates stock movements!
            const purchaseId = purchaseService.createPurchase(purchaseData);

            if (testFailure === 'AFTER_PURCHASE_CREATION') {
                throw new Error('TEST_FAILURE_AFTER_PURCHASE_CREATION');
            }

            // Update PO status
            db.prepare("UPDATE purchase_orders SET status = 'Received', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
            
            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('PO_RECEIVED', 'PO', id);

            return { poId: id, purchaseId };
        });
    }

    // Aliases to match main.js IPC handler names
    createPO(data) { return this.createPurchaseOrder(data); }
    updatePO(id, data) { return this.updatePurchaseOrder(id, data); }
    getPOs() { return this.getPurchaseOrders(); }
    getPO(id) { return this.getPurchaseOrder(id); }
    searchPOs(query) { return this.searchPurchaseOrders(query); }
    cancelPO(id) { return this.cancelPurchaseOrder(id); }
    receivePO(id) { return this.receivePurchaseOrder(id); }
}

module.exports = new PurchaseOrderService();
