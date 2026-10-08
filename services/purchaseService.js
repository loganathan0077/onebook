const dbManager = require('../database');
const stockService = require('./stockService');

class PurchaseService {
    generateInvoiceNumber() {
        const db = dbManager.getDatabase();
        const year = new Date().getFullYear();
        const currentMax = db.prepare('SELECT invoice_number FROM purchases WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1').get('%-' + year);
        let nextNum = 1;
        if (currentMax && currentMax.invoice_number) {
            const match = currentMax.invoice_number.match(/PUR-(\d{4})-.*/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        return `PUR-${String(nextNum).padStart(4, '0')}-${year}`;
    }

    createPurchase(purchaseData, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            // Validate all items
            for (let item of purchaseData.items) {
                if (!item.variantId) {
                    const defaultVariant = db.prepare('SELECT id FROM product_variants WHERE product_id = ? ORDER BY id ASC LIMIT 1').get(item.productId);
                    if (defaultVariant) {
                        item.variantId = defaultVariant.id;
                    }
                }

                const variant = db.prepare('SELECT id, product_id FROM product_variants WHERE id = ?').get(item.variantId);
                if (!variant) {
                    let err = new Error('VARIANT_NOT_FOUND');
                    err.code = 'VARIANT_NOT_FOUND';
                    throw err;
                }
                if (variant.product_id !== item.productId) {
                    let err = new Error('VARIANT_PRODUCT_MISMATCH');
                    err.code = 'VARIANT_PRODUCT_MISMATCH';
                    throw err;
                }
            }

            const invoiceNum = purchaseData.invoiceNumber || this.generateInvoiceNumber();
            
            // Map the fields
            const supplier_id = purchaseData.supplierId || null;
            const supplier_name = purchaseData.supplier || 'Unknown Supplier';
            const date = purchaseData.date;
            const subtotal = purchaseData.subtotal || 0;
            const discount = purchaseData.discount || 0;
            const other_charges = purchaseData.otherCharges || 0;
            const total = purchaseData.totalAmount || 0;
            const payment_method = purchaseData.paymentMethod || 'cash';
            const amount_paid = purchaseData.amountPaid !== undefined ? purchaseData.amountPaid : total;
            const outstanding_amount = purchaseData.outstandingAmount || 0;
            const due_date = purchaseData.dueDate || null;
            const payment_status = purchaseData.paymentStatus || 'fully_paid';
            const tax_type = purchaseData.taxType || 'intra';
            const gst_applied = purchaseData.gstApplied ? 1 : 0;

            const insertPurchase = db.prepare(`
                INSERT INTO purchases (
                    invoice_number, date, supplier_id, subtotal, discount, other_charges,
                    taxable_value, cgst, sgst, igst, total_tax, total, payment_method, status,
                    supplier_name, amount_paid, payment_status, outstanding_amount, due_date, tax_type, gst_applied
                ) VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const purchaseInfo = insertPurchase.run(
                invoiceNum, date, supplier_id, subtotal, discount, other_charges,
                purchaseData.taxableValue || 0, purchaseData.cgst || 0, purchaseData.sgst || 0, purchaseData.igst || 0, purchaseData.totalTax || 0, total, payment_method,
                supplier_name, amount_paid, payment_status, outstanding_amount, due_date, tax_type, gst_applied
            );
            
            const purchaseId = purchaseInfo.lastInsertRowid;

            const insertItem = db.prepare(`
                INSERT INTO purchase_items (
                    purchase_id, product_id, product_name, variant_id, quantity, price, discount, total,
                    taxable_value, cgst, sgst, igst
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (let item of purchaseData.items) {
                const qtyToAdd = parseFloat(item.qty || item.quantity || 0);
                const price = item.price !== undefined ? parseFloat(item.price) : 0;
                const itemTotal = item.total || (qtyToAdd * price);
                
                insertItem.run(
                    purchaseId, item.productId, item.name || item.productName || 'Unknown Product', item.variantId, 
                    qtyToAdd, price, item.discount || 0, itemTotal,
                    item.taxableValue || 0, item.cgst || 0, item.sgst || 0, item.igst || 0
                );

                // Update product variant stock and buying price
                db.prepare('UPDATE product_variants SET buying_price = ? WHERE id = ?').run(price, item.variantId);
                
                // Also update product cost_price if it's a simple product (it's safe to update regardless)
                db.prepare('UPDATE products SET cost_price = ? WHERE id = ?').run(price, item.productId);

                stockService.adjustStock(item.productId, item.variantId, qtyToAdd, 'PURCHASE', 'PURCHASE', purchaseId, date);
            }
            
            if (testFailure) {
                let err = new Error("TEST_FAILURE_ROLLBACK");
                err.code = "DATABASE_ERROR";
                throw err;
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('PURCHASE_CREATED', 'PURCHASE', purchaseId);

            return purchaseId;
        });
    }

    getPurchases(dateStr) {
        const db = dbManager.getDatabase();
        let purchases = [];
        if (dateStr) {
            purchases = db.prepare('SELECT * FROM purchases WHERE date(date) = date(?) ORDER BY date DESC').all(dateStr);
        } else {
            purchases = db.prepare('SELECT * FROM purchases ORDER BY date DESC LIMIT 100').all();
        }
        
        const getItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
        for (let p of purchases) {
            p.items = getItems.all(p.id);
        }
        return purchases;
    }

    searchPurchases(query) {
        const db = dbManager.getDatabase();
        const q = '%' + query + '%';
        const purchases = db.prepare('SELECT p.* FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.invoice_number LIKE ? OR p.date LIKE ? OR s.name LIKE ? OR p.supplier_name LIKE ? OR p.payment_status LIKE ? OR p.status LIKE ? GROUP BY p.id ORDER BY p.date DESC LIMIT 50').all(q, q, q, q, q, q);
        
        const getItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
        for (let p of purchases) {
            p.items = getItems.all(p.id);
        }
        return purchases;
    }

    getPurchaseById(id) {
        const db = dbManager.getDatabase();
        const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
        if (purchase) {
            purchase.items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);
        }
        return purchase;
    }

    cancelPurchase(purchaseId) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
            if (!purchase) {
                let err = new Error('PURCHASE_NOT_FOUND');
                err.code = 'PURCHASE_NOT_FOUND';
                throw err;
            }
            if (purchase.status === 'CANCELLED') {
                let err = new Error('PURCHASE_ALREADY_CANCELLED');
                err.code = 'PURCHASE_ALREADY_CANCELLED';
                throw err;
            }

            const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId);
            
            for (let item of items) {
                if (item.variant_id) {
                    const variant = db.prepare('SELECT id, product_id FROM product_variants WHERE id = ?').get(item.variant_id);
                    if (!variant) {
                        let err = new Error('VARIANT_NOT_FOUND');
                        err.code = 'VARIANT_NOT_FOUND';
                        throw err;
                    }
                    if (variant.product_id !== item.product_id) {
                        let err = new Error('VARIANT_PRODUCT_MISMATCH');
                        err.code = 'VARIANT_PRODUCT_MISMATCH';
                        throw err;
                    }
                    stockService.adjustStock(item.product_id, item.variant_id, -item.quantity, 'PURCHASE_CANCELLED', 'PURCHASE', purchaseId);
                }
            }

            db.prepare("UPDATE purchases SET status = 'CANCELLED' WHERE id = ?").run(purchaseId);
            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('PURCHASE_CANCELLED', 'PURCHASE', purchaseId);
            
            return true;
        });
    }
}

module.exports = new PurchaseService();
