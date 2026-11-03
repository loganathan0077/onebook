const dbManager = require('../database');

class SupplierService {
    getSuppliers() {
        const db = dbManager.getDatabase();
        return db.prepare("SELECT * FROM suppliers WHERE status != 'archived' ORDER BY name ASC").all();
    }

    getSupplier(id) {
        const db = dbManager.getDatabase();
        return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    }

    searchSuppliers(query) {
        const db = dbManager.getDatabase();
        const q = '%' + query + '%';
        return db.prepare("SELECT * FROM suppliers WHERE status != 'archived' AND (name LIKE ? OR phone LIKE ? OR gstin LIKE ?) ORDER BY name ASC LIMIT 50").all(q, q, q);
    }

    createSupplier(data, testFailure = false) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            
            // Check duplicates based on name (normalized) or GSTIN
            const normalizedName = (data.name || '').trim().toUpperCase();
            const gstin = (data.gstin || '').trim().toUpperCase();

            let duplicateCheck = db.prepare("SELECT id FROM suppliers WHERE UPPER(TRIM(name)) = ? AND status != 'archived'").get(normalizedName);
            if (!duplicateCheck && gstin) {
                duplicateCheck = db.prepare("SELECT id FROM suppliers WHERE UPPER(TRIM(gstin)) = ? AND status != 'archived'").get(gstin);
            }

            if (duplicateCheck) {
                let err = new Error('SUPPLIER_DUPLICATE');
                err.code = 'SUPPLIER_DUPLICATE';
                throw err;
            }

            const insert = db.prepare(`
                INSERT INTO suppliers (
                    id, name, phone, email, gstin, address, state, balance
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            // Since the frontend sometimes provides 'sup_...' ids, we can use it or generate one
            const id = data.id || ('sup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
            
            insert.run(
                id,
                data.name || '',
                data.phone || '',
                data.email || '',
                data.gstin || '',
                data.address || '',
                data.state || '',
                data.openingBalance || data.balance || 0
            );

            if (testFailure) {
                let err = new Error("TEST_FAILURE_ROLLBACK");
                err.code = "DATABASE_ERROR";
                throw err;
            }

            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('SUPPLIER_CREATED', 'SUPPLIER', id);

            return id;
        });
    }

    updateSupplier(id, data) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
            if (!existing) {
                let err = new Error('SUPPLIER_NOT_FOUND');
                err.code = 'SUPPLIER_NOT_FOUND';
                throw err;
            }

            const normalizedName = (data.name || '').trim().toUpperCase();
            const gstin = (data.gstin || '').trim().toUpperCase();

            let duplicateCheck = db.prepare("SELECT id FROM suppliers WHERE id != ? AND UPPER(TRIM(name)) = ? AND status != 'archived'").get(id, normalizedName);
            if (!duplicateCheck && gstin) {
                duplicateCheck = db.prepare("SELECT id FROM suppliers WHERE id != ? AND UPPER(TRIM(gstin)) = ? AND status != 'archived'").get(id, gstin);
            }

            if (duplicateCheck) {
                let err = new Error('SUPPLIER_DUPLICATE');
                err.code = 'SUPPLIER_DUPLICATE';
                throw err;
            }

            db.prepare(`
                UPDATE suppliers SET 
                    name = ?, phone = ?, email = ?, gstin = ?, address = ?, state = ?, balance = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                data.name || existing.name,
                data.phone || existing.phone,
                data.email || existing.email,
                data.gstin || existing.gstin,
                data.address || existing.address,
                data.state || existing.state,
                data.openingBalance !== undefined ? data.openingBalance : (existing.balance || 0),
                id
            );

            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('SUPPLIER_UPDATED', 'SUPPLIER', id);

            return true;
        });
    }

    archiveSupplier(id) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
            if (!existing) {
                let err = new Error('SUPPLIER_NOT_FOUND');
                err.code = 'SUPPLIER_NOT_FOUND';
                throw err;
            }

            // Check for linked purchases
            try {
                const purchaseRef = db.prepare('SELECT COUNT(*) as c FROM purchases WHERE supplier_id = ?').get(id);
                if (purchaseRef && purchaseRef.c > 0) {
                    return {
                        deleted: false,
                        reason: `Supplier has ${purchaseRef.c} linked purchase bill(s). Deletion blocked to preserve transaction history.`,
                        purchasesCount: purchaseRef.c
                    };
                }
            } catch (pErr) {
                console.warn('Could not check purchases table:', pErr.message);
            }

            db.prepare("UPDATE suppliers SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
            db.prepare('INSERT INTO audit_log (action, record_type, record_id) VALUES (?, ?, ?)').run('SUPPLIER_ARCHIVED', 'SUPPLIER', id);

            return { deleted: true, success: true };
        });
    }
}

module.exports = new SupplierService();
