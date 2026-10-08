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
            
            // Extract the new fields (with fallbacks)
            const courier = saleData.courier || 0;
            const cash_amount = saleData.cashAmount || 0;
            const other_payment_amount = saleData.otherPaymentAmount || 0;
            const customer_amount = saleData.customerAmount || 0;
            const change_amount = saleData.change || 0;
            const gst_applied = saleData.gstApplied ? 1 : 0;
            
            const payment_status = saleData.paymentStatus || 'fully_paid';
            const amount_paid = saleData.amountPaid || saleData.total || 0;
            const outstanding_amount = saleData.outstandingAmount || 0;
            const due_date = saleData.dueDate || null;
            
            const taxable_value = saleData.taxableValue || 0;
            const cgst = saleData.cgst || 0;
            const sgst = saleData.sgst || 0;
            const igst = saleData.igst || 0;
            const total_tax = saleData.totalTax || 0;
            
            const customer_name = saleData.customer_name || 'Walk-in Customer';

            const insertSale = db.prepare(`
                INSERT INTO sales (
                    receipt_number, date, customer_id, customer_type, subtotal, discount, payment_method, total,
                    courier, cash_amount, other_payment_amount, customer_amount, change_amount, gst_applied,
                    payment_status, amount_paid, outstanding_amount, due_date,
                    taxable_value, cgst, sgst, igst, total_tax, customer_name
                ) VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const saleInfo = insertSale.run(
                receiptNum, saleData.date, saleData.customer_id || null, saleData.customer_type || 'WALK-IN', 
                saleData.subtotal, saleData.discount, saleData.payment_method, saleData.total,
                courier, cash_amount, other_payment_amount, customer_amount, change_amount, gst_applied,
                payment_status, amount_paid, outstanding_amount, due_date,
                taxable_value, cgst, sgst, igst, total_tax, customer_name
            );
            
            const saleId = saleInfo.lastInsertRowid;

            const insertItem = db.prepare(`
                INSERT INTO sale_items (
                    sale_id, product_id, product_name, variant_id, quantity, price, discount, total,
                    taxable_value, cgst, sgst, igst
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (let item of saleData.items) {
                insertItem.run(
                    saleId, item.product_id, item.product_name, item.variant_id, 
                    item.quantity, item.price, item.discount || 0, item.total,
                    item.taxableValue || 0, item.cgst || 0, item.sgst || 0, item.igst || 0
                );
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

    
    getSales(dateStr) {
        const db = dbManager.getDatabase();
        // dateStr is 'YYYY-MM-DD'
        let sales = [];
        if (dateStr) {
            sales = db.prepare('SELECT * FROM sales WHERE date(date) = date(?) ORDER BY date DESC').all(dateStr);
        } else {
            sales = db.prepare('SELECT * FROM sales ORDER BY date DESC LIMIT 100').all();
        }
        
        const getItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
        for (let s of sales) {
            s.items = getItems.all(s.id);
        }
        return sales;
    }

    searchSales(query) {
        const db = dbManager.getDatabase();
        const q = '%' + query + '%';
        const sales = db.prepare('SELECT s.* FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.receipt_number LIKE ? OR s.date LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR s.payment_method LIKE ? OR s.status LIKE ? GROUP BY s.id ORDER BY s.date DESC LIMIT 50').all(q, q, q, q, q, q);
        
        const getItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
        for (let s of sales) {
            s.items = getItems.all(s.id);
        }
        return sales;
    }

    getSaleById(id) {
        const db = dbManager.getDatabase();
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
        if (sale) {
            sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
        }
        return sale;
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
