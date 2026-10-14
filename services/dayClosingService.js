const dbManager = require('../database');

class DayClosingService {
    _formatRecord(row) {
        if (!row) return null;
        let denominations = {};
        if (row.denominations_json) {
            try {
                denominations = JSON.parse(row.denominations_json);
            } catch (e) {
                denominations = {};
            }
        }

        const openingCash = parseFloat(row.opening_cash !== undefined && row.opening_cash !== null ? row.opening_cash : row.opening_balance) || 0;
        const cashSales = parseFloat(row.cash_sales) || 0;
        const bankSales = parseFloat(row.bank_sales) || 0;
        const onlineSales = parseFloat(row.online_sales) || 0;
        const totalSales = parseFloat(row.total_sales !== undefined && row.total_sales !== null ? row.total_sales : (cashSales + bankSales + onlineSales)) || 0;
        const expectedCash = parseFloat(row.expected_cash !== undefined && row.expected_cash !== null ? row.expected_cash : row.expected_balance) || (openingCash + cashSales);
        const actualCash = parseFloat(row.actual_cash !== undefined && row.actual_cash !== null ? row.actual_cash : row.actual_balance) || 0;
        const difference = parseFloat(row.difference) || (actualCash - expectedCash);

        let status = row.status;
        if (!status) {
            if (Math.abs(difference) < 0.01) status = 'Matched';
            else status = difference > 0 ? 'Excess' : 'Shortage';
        }

        return {
            id: String(row.original_id || row.id),
            sqlite_id: row.id,
            date: row.date,
            openingCash: openingCash,
            cashSales: cashSales,
            bankSales: bankSales,
            onlineSales: onlineSales,
            totalSales: totalSales,
            expectedCash: expectedCash,
            actualCash: actualCash,
            difference: difference,
            denominations: denominations,
            notes: row.notes || '',
            status: status,
            closed_at: row.closed_at
        };
    }

    getAllClosings(filters = {}) {
        const db = dbManager.getDatabase();
        let query = 'SELECT * FROM day_closings WHERE 1=1';
        const params = [];

        if (filters.fromDate) {
            query += ' AND date(date) >= date(?)';
            params.push(filters.fromDate);
        }
        if (filters.toDate) {
            query += ' AND date(date) <= date(?)';
            params.push(filters.toDate);
        }

        query += ' ORDER BY date(date) DESC, id DESC';

        const rows = db.prepare(query).all(...params);
        return rows.map(r => this._formatRecord(r));
    }

    getClosing(id) {
        const db = dbManager.getDatabase();
        const row = db.prepare('SELECT * FROM day_closings WHERE id = ? OR original_id = ?').get(id, String(id));
        return this._formatRecord(row);
    }

    getClosingByDate(dateStr) {
        const db = dbManager.getDatabase();
        const dateOnly = String(dateStr).slice(0, 10);
        const row = db.prepare('SELECT * FROM day_closings WHERE date(date) = date(?)').get(dateOnly);
        return this._formatRecord(row);
    }

    saveClosing(data) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();

            if (!data) throw new Error('DATA_REQUIRED');

            const dateStr = data.date ? String(data.date).trim() : new Date().toISOString();
            const dateOnly = dateStr.slice(0, 10);

            const openingCash = parseFloat(data.openingCash) || 0;
            const cashSales = parseFloat(data.cashSales) || 0;
            const bankSales = parseFloat(data.bankSales) || 0;
            const onlineSales = parseFloat(data.onlineSales) || 0;
            const totalSales = parseFloat(data.totalSales !== undefined ? data.totalSales : (cashSales + bankSales + onlineSales)) || 0;
            const expectedCash = parseFloat(data.expectedCash !== undefined ? data.expectedCash : (openingCash + cashSales)) || 0;
            const actualCash = parseFloat(data.actualCash) || 0;
            const difference = parseFloat(data.difference !== undefined ? data.difference : (actualCash - expectedCash)) || 0;
            const notes = data.notes ? String(data.notes).trim() : '';

            let status = data.status;
            if (!status) {
                if (Math.abs(difference) < 0.01) status = 'Matched';
                else status = difference > 0 ? 'Excess' : 'Shortage';
            }

            const denominationsJson = JSON.stringify(data.denominations || {});
            const originalId = data.id ? String(data.id) : Date.now().toString();

            // Check if record exists by id, original_id, or by exact same date
            let existing = null;
            if (data.id) {
                existing = db.prepare('SELECT * FROM day_closings WHERE id = ? OR original_id = ?').get(data.id, String(data.id));
            }

            if (!existing) {
                // Check if closing already exists for this date to prevent duplicate closing submissions
                existing = db.prepare('SELECT * FROM day_closings WHERE date(date) = date(?)').get(dateOnly);
            }

            if (existing) {
                // Update existing record
                const updateStmt = db.prepare(`
                    UPDATE day_closings SET
                        date = ?,
                        opening_balance = ?,
                        cash_sales = ?,
                        expected_balance = ?,
                        actual_balance = ?,
                        difference = ?,
                        notes = ?,
                        closed_at = CURRENT_TIMESTAMP,
                        bank_sales = ?,
                        online_sales = ?,
                        total_sales = ?,
                        denominations_json = ?,
                        status = ?,
                        opening_cash = ?,
                        expected_cash = ?,
                        actual_cash = ?
                    WHERE id = ?
                `);

                updateStmt.run(
                    dateStr,
                    openingCash,
                    cashSales,
                    expectedCash,
                    actualCash,
                    difference,
                    notes,
                    bankSales,
                    onlineSales,
                    totalSales,
                    denominationsJson,
                    status,
                    openingCash,
                    expectedCash,
                    actualCash,
                    existing.id
                );

                db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'DAY_CLOSING', ?)").run('DAY_CLOSING_UPDATED', existing.id);

                return this.getClosing(existing.id);
            } else {
                // Insert new record
                const insertStmt = db.prepare(`
                    INSERT INTO day_closings (
                        date, opening_balance, cash_sales, expected_balance, actual_balance, difference,
                        notes, closed_at, original_id, bank_sales, online_sales, total_sales,
                        denominations_json, status, opening_cash, expected_cash, actual_cash
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, CURRENT_TIMESTAMP, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?
                    )
                `);

                const res = insertStmt.run(
                    dateStr,
                    openingCash,
                    cashSales,
                    expectedCash,
                    actualCash,
                    difference,
                    notes,
                    originalId,
                    bankSales,
                    onlineSales,
                    totalSales,
                    denominationsJson,
                    status,
                    openingCash,
                    expectedCash,
                    actualCash
                );

                const newId = res.lastInsertRowid;
                db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'DAY_CLOSING', ?)").run('DAY_CLOSING_CREATED', newId);

                return this.getClosing(newId);
            }
        });
    }

    deleteClosing(id) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const existing = db.prepare('SELECT * FROM day_closings WHERE id = ? OR original_id = ?').get(id, String(id));
            if (!existing) throw new Error('DAY_CLOSING_NOT_FOUND');

            db.prepare('DELETE FROM day_closings WHERE id = ?').run(existing.id);
            db.prepare("INSERT INTO audit_log (action, record_type, record_id) VALUES (?, 'DAY_CLOSING', ?)").run('DAY_CLOSING_DELETED', existing.id);

            return { success: true, deletedId: existing.id, originalId: existing.original_id };
        });
    }
}

module.exports = new DayClosingService();
