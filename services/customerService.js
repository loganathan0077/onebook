const dbManager = require('../database');

class CustomerService {
    getCustomers() {
        return dbManager.getDatabase().prepare('SELECT * FROM customers ORDER BY name ASC').all();
    }

    getCustomer(id) {
        return dbManager.getDatabase().prepare('SELECT * FROM customers WHERE id = ?').get(id);
    }

    createCustomer(c) {
        const db = dbManager.getDatabase();
        const id = c.id || ('cus_' + Date.now() + Math.random().toString(36).substring(2, 7));
        db.prepare(`INSERT INTO customers
            (id, name, phone, email, gstin, address, state, country, notes, opening_balance, balance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            id,
            c.name,
            c.phone || null,
            c.email || null,
            c.gstin || null,
            c.address || null,
            c.state || null,
            c.country || 'INDIA',
            c.notes || null,
            c.openingBalance != null ? c.openingBalance : (c.opening_balance || 0),
            c.balance || 0
        );
        return id;
    }

    updateCustomer(id, c) {
        if (!id) throw new Error('Customer ID required for update');
        const db = dbManager.getDatabase();
        const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
        if (!existing) throw new Error('Customer not found: ' + id);
        db.prepare(`UPDATE customers SET
            name = ?,
            phone = ?,
            email = ?,
            gstin = ?,
            address = ?,
            state = ?,
            country = ?,
            notes = ?,
            opening_balance = ?,
            balance = ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`).run(
            c.name,
            c.phone || null,
            c.email || null,
            c.gstin || null,
            c.address || null,
            c.state || null,
            c.country || 'INDIA',
            c.notes || null,
            c.openingBalance != null ? c.openingBalance : (c.opening_balance || 0),
            c.balance != null ? c.balance : 0,
            id
        );
        return id;
    }

    // Safe delete: only removes if no sales reference this customer.
    // Returns { deleted: true } or { deleted: false, reason: '...' }
    deleteCustomer(id) {
        if (!id) throw new Error('Customer ID required for delete');
        const db = dbManager.getDatabase();
        const existing = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(id);
        if (!existing) return { deleted: false, reason: 'Customer not found' };
        // Check for historical sales references
        const salesRef = db.prepare('SELECT COUNT(*) as c FROM sales WHERE customer_id = ?').get(id);
        if (salesRef && salesRef.c > 0) {
            return {
                deleted: false,
                reason: `Customer has ${salesRef.c} historical sale(s). Deletion blocked to preserve transaction history.`,
                salesCount: salesRef.c
            };
        }
        db.prepare('DELETE FROM customers WHERE id = ?').run(id);
        return { deleted: true };
    }

    searchCustomers(query) {
        if (!query || query.length < 2) return [];
        const q = '%' + query + '%';
        return dbManager.getDatabase().prepare(`
            SELECT * FROM customers
            WHERE name LIKE ? OR phone LIKE ? OR gstin LIKE ? OR email LIKE ?
            ORDER BY name ASC LIMIT 50
        `).all(q, q, q, q);
    }
}

module.exports = new CustomerService();
