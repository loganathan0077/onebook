const dbManager = require('../database');

class StockService {
    getCurrentStock(variantId) {
        const db = dbManager.getDatabase();
        const v = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variantId);
        return v ? v.stock : 0;
    }

    getStockMovements(variantId) {
        const db = dbManager.getDatabase();
        if (variantId) {
            return db.prepare('SELECT * FROM stock_movements WHERE variant_id = ? ORDER BY date DESC').all(variantId);
        } else {
            return db.prepare('SELECT * FROM stock_movements ORDER BY date DESC').all();
        }
    }

    adjustStock(variantId, quantity, reason, referenceType, referenceId, date = null) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const v = db.prepare('SELECT id, product_id, stock FROM product_variants WHERE id = ?').get(variantId);
            if (!v) throw new Error('VARIANT_NOT_FOUND');
            
            const prevStock = v.stock;
            const newStock = prevStock + quantity;
            
            db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, variantId);
            
            db.prepare('INSERT INTO stock_movements (product_id, variant_id, type, quantity, previous_stock, new_stock, reference_type, reference_id, notes, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))')
              .run(v.product_id, variantId, reason, quantity, prevStock, newStock, referenceType, referenceId, reason, date);
        });
    }

    recordStockMovement(productId, variantId, quantity, type, referenceType, referenceId, date = null) {
        const db = dbManager.getDatabase();
        // Just directly inserting, ideally use adjustStock but for backward compat
        db.prepare('INSERT INTO stock_movements (product_id, variant_id, type, quantity, reference_type, reference_id, date) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))')
          .run(productId, variantId, type, quantity, referenceType, referenceId, date);
    }
}

module.exports = new StockService();
