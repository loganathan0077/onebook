const dbManager = require('../database');

class PaymentService {
    // -------------------------------------------------------------
    // SALE (CUSTOMER) PAYMENTS
    // -------------------------------------------------------------

    getSalePayments(saleId) {
        const db = dbManager.getDatabase();
        return db.prepare("SELECT * FROM payments WHERE sale_id = ? AND status != 'CANCELLED' ORDER BY date DESC, id DESC").all(saleId);
    }

    createSalePayment(data, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            // Validate sale
            const sale = db.prepare('SELECT * FROM sales WHERE receipt_number = ? OR id = ?').get(data.invoice, data.invoice);
            if (!sale) throw new Error('SALE_NOT_FOUND');
            if (sale.status === 'CANCELLED') throw new Error('SALE_CANCELLED');

            const saleId = sale.id;
            const customerId = sale.customer_id || "WALK-IN";
            
            // if (!customerId) throw new Error('CUSTOMER_REQUIRED_FOR_PAYMENT');

            const amount = parseFloat(data.amount);
            if (isNaN(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');

            // Calculate current outstanding safely
            // Note: Since amount_paid and outstanding_amount might be dirty from direct JSON modifications 
            // before this migration, we must derive current paid by aggregating SQLite payments.
            const existingPayments = db.prepare("SELECT sum(amount) as totalPaid FROM payments WHERE sale_id = ? AND status != 'CANCELLED'").get(saleId);
            const currentPaid = existingPayments.totalPaid || 0;
            const totalAmount = sale.total;
            let currentOutstanding = totalAmount - currentPaid;
            if (currentOutstanding < 0.01) currentOutstanding = 0;

            if (amount > (currentOutstanding + 0.01)) {
                throw new Error(`Payment amount (₹${amount}) cannot exceed the outstanding amount (₹${currentOutstanding.toFixed(2)}).`);
            }

            // Insert payment
            const insert = db.prepare(`
                INSERT INTO payments (customer_id, sale_id, amount, method, reference, notes, date, status)
                VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE')
            `);
            const result = insert.run(
                customerId,
                saleId,
                amount,
                data.method || 'cash',
                data.reference || '',
                data.notes || '',
                data.date
            );
            const paymentId = result.lastInsertRowid;

            if (testFailure === 'AFTER_INSERT') throw new Error('TEST_FAILURE_AFTER_INSERT');

            // Update Sale
            const newPaid = currentPaid + amount;
            let newOutstanding = totalAmount - newPaid;
            if (newOutstanding < 0.01) newOutstanding = 0;
            
            let newStatus = 'unpaid';
            if (newOutstanding <= 0.01) {
                newStatus = 'fully_paid';
            } else if (newPaid > 0) {
                newStatus = 'partially_paid';
            }

            db.prepare(`
                UPDATE sales SET 
                    amount_paid = ?, outstanding_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(newPaid, newOutstanding, newStatus, saleId);

            db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'PAYMENT', ?)").run('SALE_PAYMENT_CREATED', paymentId);

            return { paymentId, saleId, newPaid, newOutstanding, newStatus };
        });
    }

    cancelSalePayment(paymentId) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
            if (!payment) throw new Error('PAYMENT_NOT_FOUND');
            if (payment.status === 'CANCELLED') throw new Error('PAYMENT_ALREADY_CANCELLED');
            if (!payment.sale_id) throw new Error('PAYMENT_NOT_LINKED_TO_SALE');

            const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(payment.sale_id);
            if (!sale) throw new Error('SALE_NOT_FOUND');

            // Cancel payment
            db.prepare("UPDATE payments SET status = 'CANCELLED' WHERE id = ?").run(paymentId);

            // Recalculate sale totals
            const existingPayments = db.prepare("SELECT sum(amount) as totalPaid FROM payments WHERE sale_id = ? AND status != 'CANCELLED'").get(sale.id);
            const currentPaid = existingPayments.totalPaid || 0;
            const totalAmount = sale.total;
            let newOutstanding = totalAmount - currentPaid;
            if (newOutstanding < 0.01) newOutstanding = 0;
            
            let newStatus = 'unpaid';
            if (newOutstanding <= 0.01) {
                newStatus = 'fully_paid';
            } else if (currentPaid > 0) {
                newStatus = 'partially_paid';
            }

            db.prepare(`
                UPDATE sales SET 
                    amount_paid = ?, outstanding_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(currentPaid, newOutstanding, newStatus, sale.id);

            db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'PAYMENT', ?)").run('SALE_PAYMENT_CANCELLED', paymentId);

            return { paymentId, saleId: sale.id, newPaid: currentPaid, newOutstanding, newStatus, payment };
        });
    }


    // -------------------------------------------------------------
    // PURCHASE (SUPPLIER) PAYMENTS
    // -------------------------------------------------------------

    getPurchasePayments(purchaseId) {
        const db = dbManager.getDatabase();
        return db.prepare("SELECT * FROM party_payments WHERE purchase_id = ? AND status != 'CANCELLED' ORDER BY date DESC, id DESC").all(purchaseId);
    }

    createPurchasePayment(data, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            // Validate purchase
            const purchase = db.prepare('SELECT * FROM purchases WHERE invoice_number = ? OR id = ?').get(data.invoice, data.invoice);
            if (!purchase) throw new Error('PURCHASE_NOT_FOUND');
            if (purchase.status === 'CANCELLED') throw new Error('PURCHASE_CANCELLED');

            const purchaseId = purchase.id;
            const supplierId = purchase.supplier_id;
            
            if (!supplierId) throw new Error('SUPPLIER_REQUIRED_FOR_PAYMENT');

            const amount = parseFloat(data.amount);
            if (isNaN(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');

            const existingPayments = db.prepare("SELECT sum(amount) as totalPaid FROM party_payments WHERE purchase_id = ? AND status != 'CANCELLED'").get(purchaseId);
            const currentPaid = existingPayments.totalPaid || 0;
            const totalAmount = purchase.total;
            let currentOutstanding = totalAmount - currentPaid;
            if (currentOutstanding < 0.01) currentOutstanding = 0;

            if (amount > (currentOutstanding + 0.01)) {
                throw new Error(`Payment amount (₹${amount}) cannot exceed the outstanding amount (₹${currentOutstanding.toFixed(2)}).`);
            }

            // Insert payment
            const insert = db.prepare(`
                INSERT INTO party_payments (supplier_id, purchase_id, amount, method, reference, notes, date, status)
                VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE')
            `);
            const result = insert.run(
                supplierId,
                purchaseId,
                amount,
                data.method || 'cash',
                data.reference || '',
                data.notes || '',
                data.date
            );
            const paymentId = result.lastInsertRowid;

            if (testFailure === 'AFTER_INSERT') throw new Error('TEST_FAILURE_AFTER_INSERT');

            // Update Purchase
            const newPaid = currentPaid + amount;
            let newOutstanding = totalAmount - newPaid;
            if (newOutstanding < 0.01) newOutstanding = 0;
            
            let newStatus = 'unpaid';
            if (newOutstanding <= 0.01) {
                newStatus = 'fully_paid';
            } else if (newPaid > 0) {
                newStatus = 'partially_paid';
            }

            db.prepare(`
                UPDATE purchases SET 
                    amount_paid = ?, outstanding_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(newPaid, newOutstanding, newStatus, purchaseId);

            db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'PARTY_PAYMENT', ?)").run('PURCHASE_PAYMENT_CREATED', paymentId);

            return { paymentId, purchaseId, newPaid, newOutstanding, newStatus };
        });
    }

    cancelPurchasePayment(paymentId) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            const payment = db.prepare('SELECT * FROM party_payments WHERE id = ?').get(paymentId);
            if (!payment) throw new Error('PAYMENT_NOT_FOUND');
            if (payment.status === 'CANCELLED') throw new Error('PAYMENT_ALREADY_CANCELLED');
            if (!payment.purchase_id) throw new Error('PAYMENT_NOT_LINKED_TO_PURCHASE');

            const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(payment.purchase_id);
            if (!purchase) throw new Error('PURCHASE_NOT_FOUND');

            // Cancel payment
            db.prepare("UPDATE party_payments SET status = 'CANCELLED' WHERE id = ?").run(paymentId);

            // Recalculate purchase totals
            const existingPayments = db.prepare("SELECT sum(amount) as totalPaid FROM party_payments WHERE purchase_id = ? AND status != 'CANCELLED'").get(purchase.id);
            const currentPaid = existingPayments.totalPaid || 0;
            const totalAmount = purchase.total;
            let newOutstanding = totalAmount - currentPaid;
            if (newOutstanding < 0.01) newOutstanding = 0;
            
            let newStatus = 'unpaid';
            if (newOutstanding <= 0.01) {
                newStatus = 'fully_paid';
            } else if (currentPaid > 0) {
                newStatus = 'partially_paid';
            }

            db.prepare(`
                UPDATE purchases SET 
                    amount_paid = ?, outstanding_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(currentPaid, newOutstanding, newStatus, purchase.id);

            db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'PARTY_PAYMENT', ?)").run('PURCHASE_PAYMENT_CANCELLED', paymentId);

            return { paymentId, purchaseId: purchase.id, newPaid: currentPaid, newOutstanding, newStatus, payment };
        });
    }

    // -------------------------------------------------------------
    // GENERAL LEDGER PAYMENTS (NO SPECIFIC INVOICE)
    // -------------------------------------------------------------
    
    getLedgerPayments() {
        const db = dbManager.getDatabase();
        // Fetch from both tables where sale_id/purchase_id IS NULL OR not null, but since OneBook expects "partyPayments" 
        // to have all ledger payments, we will just fetch the standalone ones for now, OR fetch all?
        // Let's match existing UI behaviour. In OneBook, PartyPayments is an array of standalone payments.
        // We will return standalone payments from both tables.
        const custPayments = db.prepare("SELECT id, customer_id as partyId, 'customer' as partyType, amount, method, reference, notes, date FROM payments WHERE sale_id IS NULL AND status != 'CANCELLED'").all();
        const suppPayments = db.prepare("SELECT id, supplier_id as partyId, 'supplier' as partyType, amount, method, reference, notes, date FROM party_payments WHERE purchase_id IS NULL AND status != 'CANCELLED'").all();
        
        return [...custPayments, ...suppPayments].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    createLedgerPayment(data) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const amount = parseFloat(data.amount);
            if (isNaN(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');
            
            let paymentId;
            if (data.partyType === 'customer') {
                const insert = db.prepare(`
                    INSERT INTO payments (customer_id, sale_id, amount, method, reference, notes, date, status)
                    VALUES (?, NULL, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE')
                `);
                const res = insert.run(data.partyId, amount, data.method || 'cash', data.reference || '', data.notes || '', data.date);
                paymentId = res.lastInsertRowid;
                db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'PAYMENT', ?)").run('LEDGER_PAYMENT_CREATED', paymentId);
            } else if (data.partyType === 'supplier') {
                const insert = db.prepare(`
                    INSERT INTO party_payments (supplier_id, purchase_id, amount, method, reference, notes, date, status)
                    VALUES (?, NULL, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE')
                `);
                const res = insert.run(data.partyId, amount, data.method || 'cash', data.reference || '', data.notes || '', data.date);
                paymentId = res.lastInsertRowid;
                db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'PARTY_PAYMENT', ?)").run('LEDGER_PAYMENT_CREATED', paymentId);
            } else {
                throw new Error('INVALID_PARTY_TYPE');
            }
            return paymentId;
        });
    }

}

module.exports = new PaymentService();
