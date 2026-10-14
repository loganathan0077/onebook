const dbManager = require('../database');

class CashBankService {
    // -------------------------------------------------------------
    // SUMMARIES & BALANCES
    // -------------------------------------------------------------

    getCashSummary() {
        const db = dbManager.getDatabase();
        const opening = this.getOpeningBalance('cash');
        
        const totals = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as cashIn,
                COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as cashOut
            FROM cash_transactions 
            WHERE status = 'ACTIVE'
        `).get();

        const currentBalance = opening + totals.cashIn - totals.cashOut;
        return {
            accountType: 'cash',
            openingBalance: opening,
            totalIn: totals.cashIn,
            totalOut: totals.cashOut,
            currentBalance: currentBalance
        };
    }

    getBankSummary() {
        const db = dbManager.getDatabase();
        const opening = this.getOpeningBalance('bank');
        
        const totals = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as bankIn,
                COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as bankOut
            FROM bank_transactions 
            WHERE status = 'ACTIVE'
        `).get();

        const currentBalance = opening + totals.bankIn - totals.bankOut;
        return {
            accountType: 'bank',
            openingBalance: opening,
            totalIn: totals.bankIn,
            totalOut: totals.bankOut,
            currentBalance: currentBalance
        };
    }

    // -------------------------------------------------------------
    // OPENING BALANCES (Explicit in settings table)
    // -------------------------------------------------------------

    getOpeningBalance(accountType) {
        const acc = (accountType || '').toLowerCase();
        if (acc !== 'cash' && acc !== 'bank') {
            throw new Error('INVALID_ACCOUNT_TYPE: Must be cash or bank');
        }
        const db = dbManager.getDatabase();
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('opening_' + acc);
        if (!row || row.value === null || row.value === undefined) {
            return 0;
        }
        const val = parseFloat(row.value);
        return isNaN(val) ? 0 : val;
    }

    setOpeningBalance(accountType, amount) {
        const acc = (accountType || '').toLowerCase();
        if (acc !== 'cash' && acc !== 'bank') {
            throw new Error('INVALID_ACCOUNT_TYPE: Must be cash or bank');
        }
        const val = parseFloat(amount);
        if (isNaN(val) || !isFinite(val) || val < 0) {
            throw new Error('INVALID_AMOUNT: Opening balance must be a non-negative number');
        }

        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            db.prepare(`
                INSERT INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `).run('opening_' + acc, String(val));

            db.prepare(`
                INSERT INTO audit_log (action, record_type, record_id, details) 
                VALUES ('OPENING_BALANCE_UPDATED', 'SETTINGS', 0, ?)
            `).run(`${acc.toUpperCase()}: ${val}`);

            return { accountType: acc, openingBalance: val };
        });
    }

    // -------------------------------------------------------------
    // TRANSACTIONS (CRUD, SEARCH, CANCEL)
    // -------------------------------------------------------------

    getTransactions(accountType, filters = {}) {
        const acc = (accountType || 'cash').toLowerCase();
        if (acc !== 'cash' && acc !== 'bank') {
            throw new Error('INVALID_ACCOUNT_TYPE: Must be cash or bank');
        }
        const table = acc === 'cash' ? 'cash_transactions' : 'bank_transactions';
        const db = dbManager.getDatabase();

        let sql = `SELECT * FROM ${table} WHERE 1=1`;
        const params = [];

        if (filters.status && filters.status !== 'all') {
            sql += ` AND status = ?`;
            params.push(filters.status);
        } else if (!filters.status) {
            sql += ` AND status = 'ACTIVE'`;
        }

        if (filters.type) {
            sql += ` AND type = ?`;
            params.push(filters.type.toUpperCase());
        }

        if (filters.fromDate) {
            sql += ` AND date(date) >= date(?)`;
            params.push(filters.fromDate);
        }

        if (filters.toDate) {
            sql += ` AND date(date) <= date(?)`;
            params.push(filters.toDate);
        }

        if (filters.search) {
            sql += ` AND (description LIKE ? OR reference_number LIKE ? OR category LIKE ?)`;
            const q = '%' + filters.search + '%';
            params.push(q, q, q);
        }

        sql += ` ORDER BY date DESC, id DESC`;

        if (filters.limit) {
            sql += ` LIMIT ?`;
            params.push(parseInt(filters.limit, 10));
            if (filters.offset) {
                sql += ` OFFSET ?`;
                params.push(parseInt(filters.offset, 10));
            }
        }

        return db.prepare(sql).all(...params);
    }

    getTransaction(id, accountType = null) {
        const db = dbManager.getDatabase();
        if (accountType) {
            const acc = accountType.toLowerCase();
            const table = acc === 'cash' ? 'cash_transactions' : 'bank_transactions';
            const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
            if (row) row.accountType = acc;
            return row || null;
        }

        // Search cash first, then bank
        let row = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(id);
        if (row) {
            row.accountType = 'cash';
            return row;
        }
        row = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
        if (row) {
            row.accountType = 'bank';
            return row;
        }
        return null;
    }

    createTransaction(data, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            const acc = (data.accountType || '').toLowerCase();
            if (acc !== 'cash' && acc !== 'bank') {
                throw new Error('INVALID_ACCOUNT_TYPE: Account type must be cash or bank');
            }

            let type = (data.type || '').toUpperCase();
            if (type === 'INCOME') type = 'IN';
            if (type === 'EXPENSE') type = 'OUT';
            if (type !== 'IN' && type !== 'OUT') {
                throw new Error('INVALID_TRANSACTION_TYPE: Transaction type must be IN or OUT');
            }

            const amount = parseFloat(data.amount);
            if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
                throw new Error('INVALID_AMOUNT: Amount must be a positive number');
            }

            const date = data.date || new Date().toISOString();
            const description = data.description || '';
            const reference_type = data.reference_type || data.referenceType || 'MANUAL';
            const reference_id = data.reference_id !== undefined ? data.reference_id : (data.referenceId || null);
            const payment_method = data.payment_method || data.paymentMethod || (acc === 'cash' ? 'cash' : 'bank');
            const reference_number = data.reference_number || data.referenceNumber || data.voucherNo || '';
            const category = data.category || 'General';

            const table = acc === 'cash' ? 'cash_transactions' : 'bank_transactions';

            // Idempotency check for linked references
            if (reference_type !== 'MANUAL' && reference_id !== null) {
                const existing = db.prepare(`
                    SELECT id FROM ${table} 
                    WHERE reference_type = ? AND reference_id = ? AND status != 'CANCELLED'
                `).get(reference_type, reference_id);
                if (existing) {
                    throw new Error(`DUPLICATE_REFERENCE: An active ${acc} transaction already exists for ${reference_type} #${reference_id}`);
                }
            }

            const insert = db.prepare(`
                INSERT INTO ${table} (
                    type, amount, description, reference_type, reference_id, 
                    date, status, payment_method, reference_number, category
                ) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE', ?, ?, ?)
            `);

            const result = insert.run(
                type, amount, description, reference_type, reference_id,
                date, payment_method, reference_number, category
            );
            const txId = result.lastInsertRowid;

            if (testFailure) {
                throw new Error('TEST_FAILURE_ROLLBACK');
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                `${acc.toUpperCase()}_TRANSACTION_CREATED`,
                acc === 'cash' ? 'CASH_TX' : 'BANK_TX',
                txId,
                `${type} ₹${amount} (${reference_type} ${reference_id || ''})`
            );

            return {
                id: txId,
                accountType: acc,
                type,
                amount,
                description,
                reference_type,
                reference_id,
                date,
                status: 'ACTIVE',
                payment_method,
                reference_number,
                category
            };
        });
    }

    updateTransaction(id, data) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const tx = this.getTransaction(id, data.accountType);
            if (!tx) throw new Error('TRANSACTION_NOT_FOUND');
            if (tx.status === 'CANCELLED') throw new Error('CANNOT_UPDATE_CANCELLED_TRANSACTION');

            const table = tx.accountType === 'cash' ? 'cash_transactions' : 'bank_transactions';

            let newAmount = tx.amount;
            if (data.amount !== undefined) {
                const a = parseFloat(data.amount);
                if (isNaN(a) || !isFinite(a) || a <= 0) {
                    throw new Error('INVALID_AMOUNT: Amount must be a positive number');
                }
                newAmount = a;
            }

            const newDesc = data.description !== undefined ? data.description : tx.description;
            const newDate = data.date !== undefined ? data.date : tx.date;
            const newRefNo = data.reference_number !== undefined ? data.reference_number : tx.reference_number;
            const newCat = data.category !== undefined ? data.category : tx.category;

            db.prepare(`
                UPDATE ${table} 
                SET amount = ?, description = ?, date = ?, reference_number = ?, category = ?
                WHERE id = ?
            `).run(newAmount, newDesc, newDate, newRefNo, newCat, id);

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                `${tx.accountType.toUpperCase()}_TRANSACTION_UPDATED`,
                tx.accountType === 'cash' ? 'CASH_TX' : 'BANK_TX',
                id,
                `Updated amount to ₹${newAmount}`
            );

            return this.getTransaction(id, tx.accountType);
        });
    }

    cancelTransaction(id, accountType = null) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const tx = this.getTransaction(id, accountType);
            if (!tx) throw new Error('TRANSACTION_NOT_FOUND');
            if (tx.status === 'CANCELLED') throw new Error('TRANSACTION_ALREADY_CANCELLED');

            const table = tx.accountType === 'cash' ? 'cash_transactions' : 'bank_transactions';

            db.prepare(`UPDATE ${table} SET status = 'CANCELLED' WHERE id = ?`).run(id);

            // If this is a transfer, also cancel the linked paired transaction
            if (tx.reference_type === 'TRANSFER' && tx.reference_id) {
                const partnerTable = tx.accountType === 'cash' ? 'bank_transactions' : 'cash_transactions';
                db.prepare(`UPDATE ${partnerTable} SET status = 'CANCELLED' WHERE id = ? AND status = 'ACTIVE'`).run(tx.reference_id);
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                `${tx.accountType.toUpperCase()}_TRANSACTION_CANCELLED`,
                tx.accountType === 'cash' ? 'CASH_TX' : 'BANK_TX',
                id,
                `Cancelled ${tx.type} ₹${tx.amount}`
            );

            return { id, status: 'CANCELLED', previousRecord: tx };
        });
    }

    // -------------------------------------------------------------
    // TRANSFERS (Atomic Cash <-> Bank)
    // -------------------------------------------------------------

    transfer(data, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();

            const from = (data.fromAccount || '').toLowerCase();
            const to = (data.toAccount || '').toLowerCase();

            if ((from !== 'cash' && from !== 'bank') || (to !== 'cash' && to !== 'bank')) {
                throw new Error('INVALID_TRANSFER_ACCOUNTS: fromAccount and toAccount must be cash or bank');
            }
            if (from === to) {
                throw new Error('INVALID_TRANSFER: Cannot transfer to the same account');
            }

            const amount = parseFloat(data.amount);
            if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
                throw new Error('INVALID_AMOUNT: Transfer amount must be positive');
            }

            const date = data.date || new Date().toISOString();
            const refNo = data.referenceNumber || ('TR-' + Date.now());
            const desc = data.description || (`Transfer from ${from.toUpperCase()} to ${to.toUpperCase()}`);

            const fromTable = from === 'cash' ? 'cash_transactions' : 'bank_transactions';
            const toTable = to === 'cash' ? 'cash_transactions' : 'bank_transactions';

            // Insert OUT in source
            const resOut = db.prepare(`
                INSERT INTO ${fromTable} (
                    type, amount, description, reference_type, reference_id,
                    date, status, payment_method, reference_number, category
                ) VALUES ('OUT', ?, ?, 'TRANSFER', NULL, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE', ?, ?, 'Transfer')
            `).run(amount, desc, date, from, refNo);
            const outId = resOut.lastInsertRowid;

            // Insert IN in destination
            const resIn = db.prepare(`
                INSERT INTO ${toTable} (
                    type, amount, description, reference_type, reference_id,
                    date, status, payment_method, reference_number, category
                ) VALUES ('IN', ?, ?, 'TRANSFER', ?, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE', ?, ?, 'Transfer')
            `).run(amount, desc, outId, date, to, refNo);
            const inId = resIn.lastInsertRowid;

            // Update source with destination reference_id
            db.prepare(`UPDATE ${fromTable} SET reference_id = ? WHERE id = ?`).run(inId, outId);

            if (testFailure) {
                throw new Error('TEST_FAILURE_ROLLBACK');
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'ACCOUNT_TRANSFER_CREATED',
                'TRANSFER',
                outId,
                `Transferred ₹${amount} from ${from} to ${to} (Ref: ${refNo})`
            );

            return {
                outId,
                inId,
                fromAccount: from,
                toAccount: to,
                amount,
                date,
                referenceNumber: refNo,
                description: desc
            };
        });
    }

    // -------------------------------------------------------------
    // LINKED MOVEMENTS (Idempotent Integration with Payments/Sales/Purchases)
    // -------------------------------------------------------------

    recordPaymentMovement(accountType, type, amount, referenceId, referenceType, description, date, method, refNo) {
        const acc = (accountType || 'cash').toLowerCase();
        const table = acc === 'cash' ? 'cash_transactions' : 'bank_transactions';
        const db = dbManager.getDatabase();

        // Idempotency: check if an active transaction already exists for this source
        const existing = db.prepare(`
            SELECT * FROM ${table} 
            WHERE reference_type = ? AND reference_id = ? AND status != 'CANCELLED'
        `).get(referenceType, referenceId);

        if (existing) {
            return existing; // Already recorded, do not duplicate!
        }

        const insert = db.prepare(`
            INSERT INTO ${table} (
                type, amount, description, reference_type, reference_id,
                date, status, payment_method, reference_number, category
            ) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'ACTIVE', ?, ?, ?)
        `);

        const res = insert.run(
            type,
            amount,
            description || '',
            referenceType,
            referenceId,
            date,
            method || acc,
            refNo || '',
            referenceType
        );

        return {
            id: res.lastInsertRowid,
            accountType: acc,
            type,
            amount,
            referenceType,
            referenceId
        };
    }

    cancelLinkedMovement(referenceType, referenceId) {
        const db = dbManager.getDatabase();
        // Cancel in both cash and bank tables for this reference
        const resCash = db.prepare(`
            UPDATE cash_transactions 
            SET status = 'CANCELLED' 
            WHERE reference_type = ? AND reference_id = ? AND status = 'ACTIVE'
        `).run(referenceType, referenceId);

        const resBank = db.prepare(`
            UPDATE bank_transactions 
            SET status = 'CANCELLED' 
            WHERE reference_type = ? AND reference_id = ? AND status = 'ACTIVE'
        `).run(referenceType, referenceId);

        return {
            cashCancelled: resCash.changes,
            bankCancelled: resBank.changes
        };
    }
}

module.exports = new CashBankService();
