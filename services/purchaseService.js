const dbManager = require('../database');
const cashBankService = require('./cashBankService');
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
                    } else {
                        const prod = db.prepare('SELECT name, barcode, cost_price, price, stock FROM products WHERE id = ?').get(item.productId);
                        if (prod) {
                            const newVar = db.prepare(`
                                INSERT INTO product_variants (product_id, variant_name, sku, barcode, buying_price, selling_price, stock)
                                VALUES (?, 'Standard', '', ?, ?, ?, ?)
                            `).run(item.productId, prod.barcode || '', prod.cost_price || 0, prod.price || 0, prod.stock || 0);
                            item.variantId = newVar.lastInsertRowid;
                        }
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
            const supplier_id = purchaseData.supplierId || null;

            if (invoiceNum && supplier_id) {
                const duplicate = db.prepare("SELECT id FROM purchases WHERE invoice_number = ? AND supplier_id = ? AND status != 'CANCELLED'").get(invoiceNum, supplier_id);
                if (duplicate) {
                    let err = new Error('PURCHASE_DUPLICATE_INVOICE');
                    err.code = 'PURCHASE_DUPLICATE_INVOICE';
                    throw err;
                }
            }
            
            // Map the fields
            const supplier_name = purchaseData.supplier || 'Unknown Supplier';
            const date = purchaseData.date;
            const subtotal = purchaseData.subtotal || 0;
            const discount = purchaseData.discount || 0;
            const other_charges = purchaseData.otherCharges || 0;
            const total = parseFloat(purchaseData.totalAmount !== undefined ? purchaseData.totalAmount : (purchaseData.total !== undefined ? purchaseData.total : 0)) || 0;
            const payment_method = purchaseData.paymentMethod || 'cash';
            const due_date = purchaseData.dueDate || null;
            const amount_paid = purchaseData.amountPaid !== undefined ? Number(purchaseData.amountPaid) : (payment_method === 'credit' ? 0 : total);
            const outstanding_amount = purchaseData.outstandingAmount !== undefined ? Number(purchaseData.outstandingAmount) : (payment_method === 'credit' ? total : 0);
            const payment_status = purchaseData.paymentStatus || (outstanding_amount <= 0.01 ? 'fully_paid' : (amount_paid > 0 ? 'partially_paid' : 'unpaid'));
            const tax_type = purchaseData.taxType || 'intra';
            const gst_applied = purchaseData.gstApplied ? 1 : 0;

            const insertPurchase = db.prepare(`
                INSERT INTO purchases (
                    invoice_number, date, supplier_id, subtotal, discount,
                    taxable_value, cgst, sgst, igst, total_tax, total, payment_method, status,
                    payment_status, amount_paid, outstanding_amount, due_date
                ) VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)
            `);
            
            const purchaseInfo = insertPurchase.run(
                invoiceNum, date, supplier_id, subtotal, discount,
                purchaseData.taxableValue || 0, purchaseData.cgst || 0, purchaseData.sgst || 0, purchaseData.igst || 0, purchaseData.totalTax || 0, total, payment_method,
                payment_status, amount_paid, outstanding_amount, due_date
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
                
                // Also update product cost_price and stock
                db.prepare('UPDATE products SET cost_price = ?, stock = stock + ? WHERE id = ?').run(price, qtyToAdd, item.productId);

                stockService.adjustStock(item.productId, item.variantId, qtyToAdd, 'PURCHASE', 'PURCHASE', purchaseId, date);
            }
            
            // Record Cash / Bank movement for immediate payment
            if (amount_paid > 0) {
                const method = (payment_method || 'cash').toLowerCase();
                const accType = (method === 'cash') ? 'cash' : 'bank';
                cashBankService.recordPaymentMovement(accType, 'OUT', amount_paid, purchaseId, 'PURCHASE', 'Purchase Payment #' + invoiceNum, date, method, invoiceNum);

                // Insert into party_payments so invoice payment history and subsequent balance calculations are complete
                try {
                    db.prepare(`
                        INSERT INTO party_payments (supplier_id, purchase_id, amount, method, reference, notes, date, status)
                        VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE')
                    `).run(
                        supplier_id || 'GENERAL_SUPPLIER',
                        purchaseId,
                        amount_paid,
                        method === 'credit' ? 'cash' : method,
                        invoiceNum || '',
                        payment_method === 'credit' ? 'Down payment on credit purchase' : 'Full payment at purchase creation',
                        date
                    );
                } catch(e) {
                    console.warn('[PurchaseService] Could not insert initial party_payment:', e.message);
                }
            }

            // Update supplier/vendor balance for credit / outstanding amount
            const dueBalance = (outstanding_amount > 0) ? outstanding_amount : (payment_method === 'credit' ? total : 0);
            if (supplier_id && dueBalance > 0) {
                const isCustomer = (purchaseData.vendorType === 'customer') || (String(supplier_id).startsWith('cus'));
                if (isCustomer) {
                    try {
                        db.prepare('UPDATE customers SET balance = COALESCE(balance, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(dueBalance, supplier_id);
                    } catch(e) {
                        console.warn('[PurchaseService] Could not update customer balance:', e.message);
                    }
                } else {
                    try {
                        db.prepare('UPDATE suppliers SET balance = COALESCE(balance, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(dueBalance, supplier_id);
                    } catch(e) {
                        console.warn('[PurchaseService] Could not update supplier balance:', e.message);
                    }
                }
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
            purchases = db.prepare(`
                SELECT p.*, COALESCE(s.name, c.name) as supplier_name,
                       COALESCE(s.gstin, c.gstin) as supplier_gstin,
                       COALESCE(s.state, c.state) as supplier_state,
                       CASE WHEN c.id IS NOT NULL THEN 'customer' ELSE 'supplier' END as vendor_type
                FROM purchases p 
                LEFT JOIN suppliers s ON p.supplier_id = s.id 
                LEFT JOIN customers c ON p.supplier_id = c.id
                WHERE date(p.date) = date(?) 
                ORDER BY p.date DESC
            `).all(dateStr);
        } else {
            purchases = db.prepare(`
                SELECT p.*, COALESCE(s.name, c.name) as supplier_name,
                       COALESCE(s.gstin, c.gstin) as supplier_gstin,
                       COALESCE(s.state, c.state) as supplier_state,
                       CASE WHEN c.id IS NOT NULL THEN 'customer' ELSE 'supplier' END as vendor_type
                FROM purchases p 
                LEFT JOIN suppliers s ON p.supplier_id = s.id 
                LEFT JOIN customers c ON p.supplier_id = c.id
                ORDER BY p.date DESC
            `).all();
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
        const purchases = db.prepare(`
            SELECT p.*, COALESCE(s.name, c.name) as supplier_name,
                   COALESCE(s.gstin, c.gstin) as supplier_gstin,
                   COALESCE(s.state, c.state) as supplier_state,
                   CASE WHEN c.id IS NOT NULL THEN 'customer' ELSE 'supplier' END as vendor_type
            FROM purchases p 
            LEFT JOIN suppliers s ON p.supplier_id = s.id 
            LEFT JOIN customers c ON p.supplier_id = c.id
            WHERE p.invoice_number LIKE ? OR p.date LIKE ? OR COALESCE(s.name, c.name) LIKE ? OR p.status LIKE ? 
            ORDER BY p.date DESC LIMIT 50
        `).all(q, q, q, q);
        
        const getItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
        for (let p of purchases) {
            p.items = getItems.all(p.id);
        }
        return purchases;
    }

    getPurchaseById(id) {
        const db = dbManager.getDatabase();
        const purchase = db.prepare(`
            SELECT p.*, COALESCE(s.name, c.name) as supplier_name,
                   COALESCE(s.gstin, c.gstin) as supplier_gstin,
                   COALESCE(s.state, c.state) as supplier_state,
                   COALESCE(s.phone, c.phone) as supplier_phone,
                   COALESCE(s.address, c.address) as supplier_address,
                   CASE WHEN c.id IS NOT NULL THEN 'customer' ELSE 'supplier' END as vendor_type
            FROM purchases p 
            LEFT JOIN suppliers s ON p.supplier_id = s.id 
            LEFT JOIN customers c ON p.supplier_id = c.id
            WHERE p.id = ? OR p.invoice_number = ?
        `).get(id, id);
        if (purchase) {
            purchase.items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);
            try {
                purchase.payments = db.prepare("SELECT * FROM party_payments WHERE purchase_id = ? AND status != 'CANCELLED' ORDER BY date DESC, id DESC").all(purchase.id);
            } catch (e) {
                purchase.payments = [];
            }
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
                    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
                    stockService.adjustStock(item.product_id, item.variant_id, -item.quantity, 'PURCHASE_CANCELLED', 'PURCHASE', purchaseId);
                } else if (item.product_id) {
                    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
                    stockService.adjustStock(item.product_id, null, -item.quantity, 'PURCHASE_CANCELLED', 'PURCHASE', purchaseId);
                }
            }

            // Revert supplier / customer balance if purchase was on credit or had outstanding amount
            const dueBalance = (purchase.outstanding_amount > 0) ? purchase.outstanding_amount : (purchase.payment_method === 'credit' ? purchase.total : 0);
            if (purchase.supplier_id && dueBalance > 0) {
                const isCustomer = (purchase.vendor_type === 'customer') || (String(purchase.supplier_id).startsWith('cus'));
                if (isCustomer) {
                    try {
                        db.prepare('UPDATE customers SET balance = COALESCE(balance, 0) - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(dueBalance, purchase.supplier_id);
                    } catch(e) {
                        console.warn('[PurchaseService] Could not revert customer balance:', e.message);
                    }
                } else {
                    try {
                        db.prepare('UPDATE suppliers SET balance = COALESCE(balance, 0) - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(dueBalance, purchase.supplier_id);
                    } catch(e) {
                        console.warn('[PurchaseService] Could not revert supplier balance:', e.message);
                    }
                }
            }

            db.prepare("UPDATE purchases SET status = 'CANCELLED' WHERE id = ?").run(purchaseId);
            cashBankService.cancelLinkedMovement('PURCHASE', purchaseId);
            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('PURCHASE_CANCELLED', 'PURCHASE', purchaseId);
            
            return true;
        });
    }
}

module.exports = new PurchaseService();
