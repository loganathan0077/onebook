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
        const id = c.id || ('cus_' + Date.now() + Math.random().toString(36).substring(7));
        db.prepare('INSERT INTO customers (id, name, phone, email, gstin, address, state, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
            id, c.name, c.phone, c.email, c.gstin, c.address, c.state, c.balance || 0
        );
        return id;
    }
}
module.exports = new CustomerService();
