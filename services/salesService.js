const dbManager = require('../database');
const cashBankService = require('./cashBankService');
const stockService = require('./stockService');

class SalesService {
    generateInvoiceNumber(customDb = null) {
        const db = customDb || dbManager.getDatabase();
        let prefix = 'INV';
        let sep = '-';
        let yr = String(new Date().getFullYear());
        let pad = 4;
        let maxNum = 0;
        
        try {
            const pRow = db.prepare("SELECT value FROM settings WHERE key = 'invoicePrefix'").get();
            if (pRow && pRow.value !== undefined && pRow.value !== null) prefix = String(pRow.value).trim();
            
            const sRow = db.prepare("SELECT value FROM settings WHERE key = 'invoiceSeparator'").get();
            if (sRow) {
                let sVal = sRow.value;
                if (sVal === 'none') sep = '';
                else if (sVal === 'custom') {
                    const cRow = db.prepare("SELECT value FROM settings WHERE key = 'invoiceCustomSeparator'").get();
                    sep = cRow ? cRow.value : '';
                } else if (sVal) {
                    sep = sVal;
                }
            }
            
            const yRow = db.prepare("SELECT value FROM settings WHERE key = 'invoiceYear'").get();
            if (yRow && yRow.value) yr = String(yRow.value).trim();
            
            const padRow = db.prepare("SELECT value FROM settings WHERE key = 'invoicePadding'").get();
            if (padRow && padRow.value) pad = parseInt(padRow.value) || 4;

            const nextRow = db.prepare("SELECT value FROM settings WHERE key = 'invoiceNextNumber'").get();
            if (nextRow && nextRow.value) {
                const cfgNext = parseInt(nextRow.value, 10);
                if (!isNaN(cfgNext) && cfgNext > 1) {
                    maxNum = Math.max(maxNum, cfgNext - 1);
                }
            }
        } catch(e) {
            console.warn('[SalesService] Could not read settings for invoice number:', e.message);
        }

        // Scan existing sales table to find the absolute maximum sequence number for this pattern
        const allSales = db.prepare("SELECT receipt_number FROM sales WHERE receipt_number IS NOT NULL").all();
        
        const prefixEscaped = prefix ? prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
        const sepEscaped = sep ? sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
        const yrEscaped = yr ? yr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
        
        const patternRegex = new RegExp(`^${prefixEscaped}${sepEscaped}(\\d+)(${sepEscaped}${yrEscaped})?$`, 'i');
        
        for (const row of allSales) {
            const rn = String(row.receipt_number || '').trim();
            const match = rn.match(patternRegex);
            if (match && match[1]) {
                const n = parseInt(match[1], 10);
                if (!isNaN(n) && n > maxNum) {
                    maxNum = n;
                }
            }
        }

        // If no matches with strict pattern, search for any digits in sales
        if (maxNum === 0) {
            for (const row of allSales) {
                const rn = String(row.receipt_number || '').trim();
                const matches = rn.match(/\d+/g);
                if (matches) {
                    for (const m of matches) {
                        if (m.length === 4 && (m.startsWith('202') || m.startsWith('203'))) continue; // skip year
                        const n = parseInt(m, 10);
                        if (!isNaN(n) && n > maxNum && n < 10000000) {
                            maxNum = n;
                        }
                    }
                }
            }
        }

        let nextNum = maxNum + 1;
        let candidate = '';
        
        // Ensure uniqueness against SQLite database
        while (true) {
            const numStr = String(nextNum).padStart(pad, '0');
            const parts = [];
            if (prefix) parts.push(prefix);
            parts.push(numStr);
            if (yr) parts.push(yr);
            candidate = parts.join(sep);
            
            const existing = db.prepare('SELECT id FROM sales WHERE receipt_number = ?').get(candidate);
            if (!existing) {
                break;
            }
            nextNum++;
        }

        try {
            db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('invoiceNextNumber', ?, CURRENT_TIMESTAMP)").run(String(nextNum + 1));
        } catch(e) {}
        
        return candidate;
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

            // Generate a reliable unique receipt number:
            let receiptNum = saleData.receipt_number ? String(saleData.receipt_number).trim() : '';
            
            // Check uniqueness against the actual SQLite database before insertion
            if (!receiptNum || db.prepare('SELECT id FROM sales WHERE receipt_number = ?').get(receiptNum)) {
                receiptNum = this.generateInvoiceNumber(db);
            }
            
            // Extract fields (with fallbacks)
            const courier = saleData.courier || 0;
            const cash_amount = saleData.cashAmount || 0;
            const other_payment_amount = saleData.otherPaymentAmount || 0;
            const customer_amount = saleData.customerAmount || 0;
            const change_amount = saleData.change || 0;
            const gst_applied = saleData.gstApplied ? 1 : 0;
            
            const isCredit = saleData.payment_method === 'credit';
            const total = parseFloat(saleData.total) || 0;
            const payment_status = isCredit ? 'unpaid' : (saleData.paymentStatus || 'fully_paid');
            const amount_paid = isCredit ? 0 : (saleData.amountPaid !== undefined ? parseFloat(saleData.amountPaid) : total);
            const outstanding_amount = isCredit ? total : (parseFloat(saleData.outstandingAmount) || 0);
            const due_date = isCredit ? null : (saleData.dueDate || null);
            
            const taxable_value = saleData.taxableValue || 0;
            const cgst = saleData.cgst || 0;
            const sgst = saleData.sgst || 0;
            const igst = saleData.igst || 0;
            const total_tax = saleData.totalTax || 0;
            
            const customer_name = saleData.customer_name || 'Walk-in Customer';
            const customer_gstin = saleData.customer_gstin || null;
            const customer_address = saleData.customer_address || null;
            const customer_state = saleData.customer_state || null;
            const tax_type = saleData.tax_type || (igst > 0 ? 'inter' : 'intra');
            const place_of_supply = saleData.place_of_supply || null;

            const insertSale = db.prepare(`
                INSERT INTO sales (
                    receipt_number, date, customer_id, customer_type, subtotal, discount, payment_method, total,
                    courier, cash_amount, other_payment_amount, customer_amount, change_amount, gst_applied,
                    payment_status, amount_paid, outstanding_amount, due_date,
                    taxable_value, cgst, sgst, igst, total_tax, customer_name,
                    customer_gstin, customer_address, customer_state, tax_type, place_of_supply
                ) VALUES (?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let saleInfo;
            let attempts = 0;
            while (attempts < 5) {
                attempts++;
                try {
                    saleInfo = insertSale.run(
                        receiptNum, saleData.date, saleData.customer_id || null, saleData.customer_type || 'WALK-IN', 
                        saleData.subtotal, saleData.discount, saleData.payment_method, total,
                        courier, cash_amount, other_payment_amount, customer_amount, change_amount, gst_applied,
                        payment_status, amount_paid, outstanding_amount, due_date,
                        taxable_value, cgst, sgst, igst, total_tax, customer_name,
                        customer_gstin, customer_address, customer_state, tax_type, place_of_supply
                    );
                    break;
                } catch (insertErr) {
                    if (insertErr && insertErr.message && insertErr.message.includes('UNIQUE constraint failed: sales.receipt_number') && attempts < 5) {
                        console.warn(`[SalesService] Duplicate receipt_number '${receiptNum}' collided. Generating a fresh unique receipt number (attempt ${attempts})...`);
                        receiptNum = this.generateInvoiceNumber(db);
                    } else {
                        throw insertErr;
                    }
                }
            }
            if (!saleInfo) {
                throw new Error('FAILED_TO_GENERATE_UNIQUE_RECEIPT_NUMBER');
            }
            
            const saleId = saleInfo.lastInsertRowid;

            const insertItem = db.prepare(`
                INSERT INTO sale_items (
                    sale_id, product_id, product_name, variant_id, quantity, price, discount, total,
                    taxable_value, cgst, sgst, igst, location_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (let item of saleData.items) {
                const locId = item.location_id || item.locationId || null;
                insertItem.run(
                    saleId, item.product_id, item.product_name, item.variant_id, 
                    item.quantity, item.price, item.discount || 0, item.total,
                    item.taxableValue || 0, item.cgst || 0, item.sgst || 0, item.igst || 0,
                    locId
                );
                stockService.adjustStock(item.product_id, item.variant_id, -item.quantity, 'SALE', 'SALE', saleId, saleData.date, locId);
            }
            
            // For Credit, record the full amount as customer outstanding
            if (isCredit && saleData.customer_id) {
                try {
                    db.prepare('UPDATE customers SET balance = COALESCE(balance, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(total, saleData.customer_id);
                } catch(e) {
                    console.warn('[SalesService] Could not update customer balance for credit sale:', e.message);
                }
            }

            // Record Cash / Bank movement for immediate payment (never for credit)
            if (amount_paid > 0 && !isCredit) {
                if (cash_amount > 0) {
                    cashBankService.recordPaymentMovement('cash', 'IN', cash_amount, saleId, 'SALE', 'Sale Cash Receipt #' + receiptNum, saleData.date, 'cash', receiptNum);
                }
                if (other_payment_amount > 0) {
                    const otherMethod = (saleData.payment_method === 'cash') ? 'upi' : (saleData.payment_method || 'bank');
                    cashBankService.recordPaymentMovement('bank', 'IN', other_payment_amount, saleId, 'SALE', 'Sale Bank/UPI Receipt #' + receiptNum, saleData.date, otherMethod, receiptNum);
                }
                if (cash_amount <= 0 && other_payment_amount <= 0) {
                    const method = (saleData.payment_method || 'cash').toLowerCase();
                    const accType = (method === 'cash') ? 'cash' : 'bank';
                    cashBankService.recordPaymentMovement(accType, 'IN', amount_paid, saleId, 'SALE', 'Sale Receipt #' + receiptNum, saleData.date, method, receiptNum);
                }
            }

            if (testFailure) {
                let err = new Error("TEST_FAILURE_ROLLBACK");
                err.code = "DATABASE_ERROR";
                throw err;
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('SALE_CREATED', 'SALE', saleId);

            return { id: saleId, receipt_number: receiptNum, receiptNumber: receiptNum };
        });
    }

    
    getSales(dateStr) {
        const db = dbManager.getDatabase();
        // dateStr is 'YYYY-MM-DD'
        let sales = [];
        const dateParam = (typeof dateStr === 'string' && dateStr.trim()) ? dateStr.trim() : null;
        if (dateParam) {
            sales = db.prepare('SELECT * FROM sales WHERE date(date) = date(?) ORDER BY date DESC').all(dateParam);
        } else {
            sales = db.prepare('SELECT * FROM sales ORDER BY date DESC').all();
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
                    stockService.adjustStock(item.product_id, item.variant_id, item.quantity, 'SALE_CANCELLED', 'SALE', saleId, null, item.location_id || null);
                }
            }

            db.prepare("UPDATE sales SET status = 'CANCELLED' WHERE id = ?").run(saleId);
            cashBankService.cancelLinkedMovement('SALE', saleId);
            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('SALE_CANCELLED', 'SALE', saleId);
            
            return true;
        });
    }
}

module.exports = new SalesService();
