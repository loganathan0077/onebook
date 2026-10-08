const dbManager = require('../database');
const stockService = require('./stockService');

class SalesService {
    generateInvoiceNumber() {
        const db = dbManager.getDatabase();
        const year = new Date().getFullYear();
        const currentMax = db.prepare('SELECT receipt_number FROM sales WHERE receipt_number LIKE ? ORDER BY receipt_number DESC LIMIT 1').get('%-' + year);
        let nextNum = 1;
        if (currentMax && currentMax.receipt_number) {
            const match = currentMax.receipt_number.match(/INV-(\d{4})-.*/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        return `INV-${String(nextNum).padStart(4, '0')}-${year}`;
    }

    createSale(saleData, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            // Validate all items
            for (let item of saleData.items) {
                const variant = db.prepare('SELECT id, product_id, stock FROM product_variants WHERE id = ?').get(item.variant_id);
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
                if (variant.stock < item.quantity) {
                    let err = new Error('INSUFFICIENT_STOCK');
                    err.code = 'INSUFFICIENT_STOCK';
                    throw err;
                }
            }

            const receiptNum = saleData.receipt_number || this.generateInvoiceNumber();
            const insertSale = db.prepare('INSERT INTO sales (receipt_number, date, customer_id, customer_type, subtotal, discount, payment_method, total) VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?)');
            const saleInfo = insertSale.run(receiptNum, saleData.date, saleData.customer_id || null, saleData.customer_type || 'WALK-IN', saleData.subtotal, saleData.discount, saleData.payment_method, saleData.total);
            const saleId = saleInfo.lastInsertRowid;

            const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, variant_id, quantity, price, discount, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            
            for (let item of saleData.items) {
                insertItem.run(saleId, item.product_id, item.product_name, item.variant_id, item.quantity, item.price, item.discount || 0, item.total);
                stockService.adjustStock(item.variant_id, -item.quantity, 'SALE', 'SALE', saleId, saleData.date);
            }
            
            if (testFailure) {
                let err = new Error("TEST_FAILURE_ROLLBACK");
                err.code = "DATABASE_ERROR";
                throw err;
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('SALE_CREATED', 'SALE', saleId);

            return saleId;
        });
    }

    cancelSale(saleId) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
            if (!sale) {
                let err = new Error('SALE_NOT_FOUND');
                err.code = 'SALE_NOT_FOUND';
                throw err;
            }
            if (sale.status === 'CANCELLED') {
                let err = new Error('SALE_ALREADY_CANCELLED');
                err.code = 'SALE_ALREADY_CANCELLED';
                throw err;
            }

            const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
            
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
                    stockService.adjustStock(item.variant_id, item.quantity, 'SALE_CANCELLED', 'SALE', saleId);
                }
            }

            db.prepare("UPDATE sales SET status = 'CANCELLED' WHERE id = ?").run(saleId);
            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('SALE_CANCELLED', 'SALE', saleId);
            
            return true;
        });
    }
}

module.exports = new SalesService();
