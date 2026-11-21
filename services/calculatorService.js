const dbManager = require('../database');

class CalculatorService {
    _formatRow(row) {
        if (!row) return null;
        return {
            id: String(row.original_id || row.id),
            sqlite_id: row.id,
            date: row.date,
            expression: row.expression,
            result: parseFloat(row.result) || 0,
            created_at: row.created_at
        };
    }

    getHistory() {
        const db = dbManager.getDatabase();
        const rows = db.prepare('SELECT * FROM calculator_history ORDER BY id DESC').all();
        return rows.map(r => this._formatRow(r));
    }

    saveHistory(expression, result) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            if (!expression || typeof expression !== 'string') {
                throw new Error('EXPRESSION_REQUIRED');
            }
            const numResult = parseFloat(result);
            if (isNaN(numResult)) {
                throw new Error('INVALID_RESULT');
            }

            const originalId = Date.now().toString();
            const dateStr = new Date().toISOString();

            const stmt = db.prepare(`
                INSERT INTO calculator_history (original_id, date, expression, result, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            const info = stmt.run(originalId, dateStr, expression.trim(), numResult);

            return {
                id: originalId,
                sqlite_id: info.lastInsertRowid,
                date: dateStr,
                expression: expression.trim(),
                result: numResult
            };
        });
    }

    deleteHistory(id) {
        if (!id) throw new Error('ID_REQUIRED');
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const row = db.prepare('SELECT * FROM calculator_history WHERE id = ? OR original_id = ?').get(id, String(id));
            if (!row) throw new Error('CALC_HISTORY_NOT_FOUND');

            db.prepare('DELETE FROM calculator_history WHERE id = ?').run(row.id);
            return { success: true, deletedId: row.id };
        });
    }

    clearAllHistory() {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            db.prepare('DELETE FROM calculator_history').run();
            return { success: true };
        });
    }

    calculateGstInclusive(inclusiveAmount, gstRate) {
        const inc = parseFloat(inclusiveAmount);
        const rate = parseFloat(gstRate);
        if (isNaN(inc) || inc < 0 || isNaN(rate) || rate < 0) {
            return { inclusiveAmount: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0 };
        }
        const taxable = inc / (1 + rate / 100);
        const gst = inc - taxable;
        return {
            inclusiveAmount: parseFloat(inc.toFixed(2)),
            taxableAmount: parseFloat(taxable.toFixed(2)),
            gstAmount: parseFloat(gst.toFixed(2)),
            totalAmount: parseFloat(inc.toFixed(2))
        };
    }

    calculateGstExclusive(baseAmount, gstRate) {
        const base = parseFloat(baseAmount);
        const rate = parseFloat(gstRate);
        if (isNaN(base) || base < 0 || isNaN(rate) || rate < 0) {
            return { baseAmount: 0, taxableAmount: 0, gstAmount: 0, totalAmount: 0, finalAmount: 0 };
        }
        const gst = base * (rate / 100);
        const total = base + gst;
        return {
            baseAmount: parseFloat(base.toFixed(2)),
            taxableAmount: parseFloat(base.toFixed(2)),
            gstAmount: parseFloat(gst.toFixed(2)),
            totalAmount: parseFloat(total.toFixed(2)),
            finalAmount: parseFloat(total.toFixed(2))
        };
    }
}

module.exports = new CalculatorService();
