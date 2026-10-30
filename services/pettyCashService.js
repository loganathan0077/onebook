const dbManager = require('../database');

class PettyCashService {
    // -------------------------------------------------------------
    // SUMMARIES & BALANCES
    // -------------------------------------------------------------

    getOpeningBalances() {
        const db = dbManager.getDatabase();
        const rowCash = db.prepare("SELECT value FROM settings WHERE key = 'petty_cash_opening_cash'").get();
        const rowBank = db.prepare("SELECT value FROM settings WHERE key = 'petty_cash_opening_bank'").get();

        const cash = rowCash && rowCash.value !== null ? parseFloat(rowCash.value) || 0 : 0;
        const bank = rowBank && rowBank.value !== null ? parseFloat(rowBank.value) || 0 : 0;

        return { cash, bank };
    }

    setOpeningBalances(cashAmount, bankAmount) {
        const cash = parseFloat(cashAmount);
        const bank = parseFloat(bankAmount);

        if (isNaN(cash) || !isFinite(cash) || cash < 0) {
            throw new Error('INVALID_AMOUNT: Opening cash must be a non-negative number');
        }
        if (isNaN(bank) || !isFinite(bank) || bank < 0) {
            throw new Error('INVALID_AMOUNT: Opening bank must be a non-negative number');
        }

        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();

            db.prepare(`
                INSERT INTO settings (key, value, updated_at) VALUES ('petty_cash_opening_cash', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `).run(String(cash));

            db.prepare(`
                INSERT INTO settings (key, value, updated_at) VALUES ('petty_cash_opening_bank', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `).run(String(bank));

            db.prepare(`
                INSERT INTO audit_log (action, record_type, record_id, details)
                VALUES ('PETTY_CASH_OPENING_UPDATED', 'SETTINGS', 0, ?)
            `).run(`Cash: ${cash}, Bank: ${bank}`);

            return { cash, bank };
        });
    }

    getSummary() {
        const db = dbManager.getDatabase();
        const opening = this.getOpeningBalances();

        const txs = db.prepare("SELECT * FROM petty_cash_transactions WHERE status = 'ACTIVE'").all();

        let cashIn = 0, cashOut = 0;
        let bankIn = 0, bankOut = 0;
        const expenseSummary = {};
        const incomeSummary = {};

        for (const t of txs) {
            const amt = parseFloat(t.amount) || 0;
            const type = (t.type || '').toLowerCase();
            const cat = t.category || 'General';

            if (type === 'expense') {
                if (t.account === 'cash') cashOut += amt;
                else if (t.account === 'bank') bankOut += amt;
                expenseSummary[cat] = (expenseSummary[cat] || 0) + amt;
            } else if (type === 'income') {
                if (t.account === 'cash') cashIn += amt;
                else if (t.account === 'bank') bankIn += amt;
                incomeSummary[cat] = (incomeSummary[cat] || 0) + amt;
            } else if (type === 'transfer') {
                if (t.from_account === 'bank' && t.to_account === 'cash') {
                    bankOut += amt;
                    cashIn += amt;
                } else if (t.from_account === 'cash' && t.to_account === 'bank') {
                    cashOut += amt;
                    bankIn += amt;
                }
            }
        }

        const currentCash = opening.cash + cashIn - cashOut;
        const currentBank = opening.bank + bankIn - bankOut;
        const totalBalance = currentCash + currentBank;

        return {
            openingCash: opening.cash,
            openingBank: opening.bank,
            cashIn,
            cashOut,
            currentCash,
            bankIn,
            bankOut,
            currentBank,
            totalBalance,
            expenseSummary,
            incomeSummary
        };
    }

    // -------------------------------------------------------------
    // CATEGORIES
    // -------------------------------------------------------------

    getCategories() {
        const db = dbManager.getDatabase();
        const row = db.prepare("SELECT value FROM settings WHERE key = 'petty_cash_categories'").get();
        if (row && row.value) {
            try {
                return JSON.parse(row.value);
            } catch (e) {}
        }
        return null;
    }

    saveCategories(categories) {
        if (!categories || typeof categories !== 'object') {
            throw new Error('INVALID_CATEGORIES_DATA');
        }
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            db.prepare(`
                INSERT INTO settings (key, value, updated_at) VALUES ('petty_cash_categories', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `).run(JSON.stringify(categories));
            return categories;
        });
    }

    // -------------------------------------------------------------
    // TRANSACTIONS (CRUD, FILTER, SEARCH)
    // -------------------------------------------------------------

    _formatRow(row) {
        if (!row) return null;
        return {
            id: String(row.original_id || row.id),
            sqlite_id: row.id,
            type: row.type,
            amount: parseFloat(row.amount) || 0,
            category: row.category || '',
            description: row.description || '',
            date: row.date,
            status: row.status,
            account: row.account || '',
            fromAccount: row.from_account || '',
            toAccount: row.to_account || '',
            voucherNo: row.voucher_no || '',
            remarks: row.remarks || '',
            original_id: row.original_id || '',
            created_at: row.created_at
        };
    }

    getTransactions(filters = {}) {
        const db = dbManager.getDatabase();
        let sql = "SELECT * FROM petty_cash_transactions WHERE 1=1";
        const params = [];

        if (filters.status && filters.status !== 'all') {
            sql += " AND status = ?";
            params.push(filters.status);
        } else if (!filters.status) {
            sql += " AND status = 'ACTIVE'";
        }

        if (filters.type) {
            sql += " AND type = ?";
            params.push(filters.type.toLowerCase());
        }

        if (filters.account) {
            sql += " AND (account = ? OR from_account = ? OR to_account = ?)";
            const acc = filters.account.toLowerCase();
            params.push(acc, acc, acc);
        }

        if (filters.category) {
            sql += " AND category = ?";
            params.push(filters.category);
        }

        if (filters.fromDate) {
            sql += " AND date(date) >= date(?)";
            params.push(filters.fromDate);
        }

        if (filters.toDate) {
            sql += " AND date(date) <= date(?)";
            params.push(filters.toDate);
        }

        if (filters.search) {
            sql += " AND (voucher_no LIKE ? OR description LIKE ? OR category LIKE ? OR remarks LIKE ?)";
            const q = '%' + filters.search + '%';
            params.push(q, q, q, q);
        }

        sql += " ORDER BY date DESC, id DESC";

        if (filters.limit) {
            sql += " LIMIT ?";
            params.push(parseInt(filters.limit, 10));
            if (filters.offset) {
                sql += " OFFSET ?";
                params.push(parseInt(filters.offset, 10));
            }
        }

        return db.prepare(sql).all(...params).map(r => this._formatRow(r));
    }

    getTransaction(id) {
        const db = dbManager.getDatabase();
        const row = db.prepare("SELECT * FROM petty_cash_transactions WHERE id = ? OR original_id = ?").get(id, String(id)) || null;
        return this._formatRow(row);
    }


    generateVoucherNo(type) {
        const prefix = type === 'transfer' ? 'TR-' : 'PC-';
        const db = dbManager.getDatabase();
        const rows = db.prepare("SELECT voucher_no FROM petty_cash_transactions WHERE voucher_no LIKE ?").all(prefix + '%');
        let maxId = 0;
        for (const r of rows) {
            if (r.voucher_no && r.voucher_no.startsWith(prefix)) {
                const num = parseInt(r.voucher_no.replace(prefix, ''), 10);
                if (!isNaN(num) && num > maxId) maxId = num;
            }
        }
        return prefix + String(maxId + 1).padStart(3, '0');
    }

    createTransaction(data, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();

            const type = (data.type || '').toLowerCase();
            if (type !== 'expense' && type !== 'income' && type !== 'transfer') {
                throw new Error('INVALID_TRANSACTION_TYPE: Must be expense, income, or transfer');
            }

            const amount = parseFloat(data.amount);
            if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
                throw new Error('INVALID_AMOUNT: Amount must be a positive number');
            }

            const date = data.date || new Date().toISOString().split('T')[0];
            const original_id = data.original_id ? String(data.original_id) : (data.id ? String(data.id) : null);
            const description = data.description || '';
            const remarks = data.remarks || '';
            const voucher_no = data.voucher_no || data.voucherNo || this.generateVoucherNo(type);

            let account = null;
            let category = null;
            let from_account = null;
            let to_account = null;

            if (type === 'transfer') {
                from_account = (data.fromAccount || data.from_account || 'bank').toLowerCase();
                to_account = (data.toAccount || data.to_account || 'cash').toLowerCase();
                if ((from_account !== 'cash' && from_account !== 'bank') || (to_account !== 'cash' && to_account !== 'bank')) {
                    throw new Error('INVALID_TRANSFER_ACCOUNTS: from and to must be cash or bank');
                }
                if (from_account === to_account) {
                    throw new Error('INVALID_TRANSFER: Cannot transfer to same account');
                }
            } else {
                account = (data.account || 'cash').toLowerCase();
                if (account !== 'cash' && account !== 'bank') {
                    throw new Error('INVALID_ACCOUNT: Account must be cash or bank');
                }
                category = data.category || (type === 'expense' ? 'Miscellaneous Expense' : 'Other Income');
            }

            // Check if record with original_id already exists (idempotent import/create)
            if (original_id) {
                const existing = db.prepare("SELECT id FROM petty_cash_transactions WHERE original_id = ?").get(original_id);
                if (existing) {
                    return this.getTransaction(existing.id);
                }
            }

            const insert = db.prepare(`
                INSERT INTO petty_cash_transactions (
                    type, amount, category, description, date, status,
                    original_id, account, from_account, to_account, voucher_no, remarks
                ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)
            `);

            const res = insert.run(
                type, amount, category, description, date,
                original_id, account, from_account, to_account, voucher_no, remarks
            );

            const txId = res.lastInsertRowid;

            if (testFailure) {
                throw new Error('TEST_FAILURE_ROLLBACK');
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PETTY_CASH_TRANSACTION_CREATED',
                'PETTY_CASH',
                txId,
                `${type.toUpperCase()} ₹${amount} (${voucher_no})`
            );

            return this.getTransaction(txId);
        });
    }

    updateTransaction(id, data) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const tx = this.getTransaction(id);
            if (!tx) throw new Error('TRANSACTION_NOT_FOUND');
            if (tx.status === 'CANCELLED') throw new Error('CANNOT_UPDATE_CANCELLED_TRANSACTION');

            const type = (data.type !== undefined ? data.type : tx.type).toLowerCase();
            if (type !== 'expense' && type !== 'income' && type !== 'transfer') {
                throw new Error('INVALID_TRANSACTION_TYPE: Must be expense, income, or transfer');
            }

            let amount = tx.amount;
            if (data.amount !== undefined) {
                const a = parseFloat(data.amount);
                if (isNaN(a) || !isFinite(a) || a <= 0) {
                    throw new Error('INVALID_AMOUNT: Amount must be a positive number');
                }
                amount = a;
            }

            const date = data.date !== undefined ? data.date : tx.date;
            const description = data.description !== undefined ? data.description : tx.description;
            const remarks = data.remarks !== undefined ? data.remarks : tx.remarks;
            const voucher_no = data.voucher_no || data.voucherNo || tx.voucherNo;

            let account = tx.account;
            let category = tx.category;
            let from_account = tx.fromAccount;
            let to_account = tx.toAccount;

            if (type === 'transfer') {
                from_account = (data.fromAccount !== undefined ? data.fromAccount : (data.from_account !== undefined ? data.from_account : tx.fromAccount)).toLowerCase();
                to_account = (data.toAccount !== undefined ? data.toAccount : (data.to_account !== undefined ? data.to_account : tx.toAccount)).toLowerCase();
                account = null;
                category = null;
                if ((from_account !== 'cash' && from_account !== 'bank') || (to_account !== 'cash' && to_account !== 'bank')) {
                    throw new Error('INVALID_TRANSFER_ACCOUNTS: from and to must be cash or bank');
                }
                if (from_account === to_account) {
                    throw new Error('INVALID_TRANSFER: Cannot transfer to same account');
                }
            } else {
                account = (data.account !== undefined ? data.account : (tx.account || 'cash')).toLowerCase();
                category = data.category !== undefined ? data.category : tx.category;
                from_account = null;
                to_account = null;
                if (account !== 'cash' && account !== 'bank') {
                    throw new Error('INVALID_ACCOUNT: Account must be cash or bank');
                }
            }

            db.prepare(`
                UPDATE petty_cash_transactions
                SET type = ?, amount = ?, category = ?, description = ?, date = ?,
                    account = ?, from_account = ?, to_account = ?, voucher_no = ?, remarks = ?
                WHERE id = ?
            `).run(
                type, amount, category, description, date,
                account, from_account, to_account, voucher_no, remarks, tx.sqlite_id
            );

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PETTY_CASH_TRANSACTION_UPDATED',
                'PETTY_CASH',
                tx.sqlite_id,
                `Updated ${voucher_no} amount to ₹${amount}`
            );

            return this.getTransaction(tx.sqlite_id);
        });
    }

    deleteTransaction(id) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const tx = this.getTransaction(id);
            if (!tx) throw new Error('TRANSACTION_NOT_FOUND');

            // Hard delete as supported by existing OneBook UI deletePCTransaction()
            db.prepare("DELETE FROM petty_cash_transactions WHERE id = ?").run(tx.sqlite_id);

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PETTY_CASH_TRANSACTION_DELETED',
                'PETTY_CASH',
                tx.sqlite_id,
                `Deleted ${tx.voucherNo} (₹${tx.amount})`
            );

            return { success: true, deletedId: tx.sqlite_id, voucherNo: tx.voucherNo };
        });
    }

    cancelTransaction(id) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const tx = this.getTransaction(id);
            if (!tx) throw new Error('TRANSACTION_NOT_FOUND');
            if (tx.status === 'CANCELLED') throw new Error('TRANSACTION_ALREADY_CANCELLED');

            db.prepare("UPDATE petty_cash_transactions SET status = 'CANCELLED' WHERE id = ?").run(tx.sqlite_id);

            db.prepare('INSERT INTO audit_log (action, record_type, record_id, details) VALUES (?, ?, ?, ?)').run(
                'PETTY_CASH_TRANSACTION_CANCELLED',
                'PETTY_CASH',
                tx.sqlite_id,
                `Cancelled ${tx.voucherNo} (₹${tx.amount})`
            );

            return { success: true, id: tx.sqlite_id, status: 'CANCELLED' };
        });
    }
}

module.exports = new PettyCashService();
