const dbManager = require('../database');

class UnitService {
    getUnits() {
        const db = dbManager.getDatabase();
        return db.prepare('SELECT id, name, is_active, created_at FROM units ORDER BY name COLLATE NOCASE ASC').all()
            .map(r => ({
                id: r.id,
                name: r.name,
                active: Boolean(r.is_active),
                is_active: r.is_active,
                created_at: r.created_at
            }));
    }

    getUnit(id) {
        const db = dbManager.getDatabase();
        const r = db.prepare('SELECT id, name, is_active, created_at FROM units WHERE id = ?').get(id);
        if (!r) return null;
        return {
            id: r.id,
            name: r.name,
            active: Boolean(r.is_active),
            is_active: r.is_active,
            created_at: r.created_at
        };
    }

    getUnitByName(name) {
        if (!name || typeof name !== 'string') return null;
        const db = dbManager.getDatabase();
        const r = db.prepare('SELECT id, name, is_active, created_at FROM units WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(name);
        if (!r) return null;
        return {
            id: r.id,
            name: r.name,
            active: Boolean(r.is_active),
            is_active: r.is_active,
            created_at: r.created_at
        };
    }

    createUnit(name, active = true) {
        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new Error('Unit name is required');
        }
        const trimmed = name.trim();
        const isActiveVal = (active === false || active === 0 || active === '0') ? 0 : 1;
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const existing = this.getUnitByName(trimmed);
            if (existing) {
                const err = new Error('UNIT_ALREADY_EXISTS');
                err.code = 'UNIT_ALREADY_EXISTS';
                throw err;
            }
            const info = db.prepare('INSERT INTO units (name, is_active) VALUES (?, ?)').run(trimmed, isActiveVal);
            return {
                id: info.lastInsertRowid,
                name: trimmed,
                active: Boolean(isActiveVal)
            };
        });
    }

    updateUnit(id, newName) {
        if (!id) throw new Error('Unit ID is required');
        if (!newName || typeof newName !== 'string' || !newName.trim()) {
            throw new Error('New unit name is required');
        }
        const trimmed = newName.trim();
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const current = this.getUnit(id);
            if (!current) {
                const err = new Error('UNIT_NOT_FOUND');
                err.code = 'UNIT_NOT_FOUND';
                throw err;
            }

            const existing = this.getUnitByName(trimmed);
            if (existing && existing.id !== current.id) {
                const err = new Error('UNIT_ALREADY_EXISTS');
                err.code = 'UNIT_ALREADY_EXISTS';
                throw err;
            }

            const oldName = current.name;
            db.prepare('UPDATE units SET name = ? WHERE id = ?').run(trimmed, id);

            // Cascade name update to products referencing oldName
            db.prepare('UPDATE products SET unit = ? WHERE unit = ?').run(trimmed, oldName);

            return {
                id: current.id,
                name: trimmed,
                oldName,
                active: current.active
            };
        });
    }

    toggleUnitStatus(id, active) {
        if (!id) throw new Error('Unit ID is required');
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const current = this.getUnit(id);
            if (!current) {
                const err = new Error('UNIT_NOT_FOUND');
                err.code = 'UNIT_NOT_FOUND';
                throw err;
            }

            const newActiveVal = (typeof active === 'boolean')
                ? (active ? 1 : 0)
                : (current.active ? 0 : 1);

            db.prepare('UPDATE units SET is_active = ? WHERE id = ?').run(newActiveVal, id);

            return {
                id: current.id,
                name: current.name,
                active: Boolean(newActiveVal)
            };
        });
    }

    deleteUnit(id) {
        if (!id) throw new Error('Unit ID is required');
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const current = this.getUnit(id);
            if (!current) {
                const err = new Error('UNIT_NOT_FOUND');
                err.code = 'UNIT_NOT_FOUND';
                throw err;
            }

            // Check if any product is currently using this unit
            const countRow = db.prepare('SELECT count(*) as count FROM products WHERE unit = ?').get(current.name);
            if (countRow && countRow.count > 0) {
                const err = new Error('UNIT_IN_USE');
                err.code = 'UNIT_IN_USE';
                err.productCount = countRow.count;
                throw err;
            }

            db.prepare('DELETE FROM units WHERE id = ?').run(id);
            return { success: true, id };
        });
    }

    // Idempotent migration from an array of legacy items or names
    migrateUnits(unitItems) {
        if (!Array.isArray(unitItems) || unitItems.length === 0) {
            return { imported: 0, skipped: 0 };
        }

        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const insertStmt = db.prepare('INSERT OR IGNORE INTO units (name, is_active) VALUES (?, ?)');
            let imported = 0;
            let skipped = 0;

            for (const item of unitItems) {
                const rawName = (typeof item === 'string') ? item : (item && item.name ? item.name : null);
                if (!rawName || typeof rawName !== 'string') {
                    skipped++;
                    continue;
                }
                const name = rawName.trim();
                if (!name) {
                    skipped++;
                    continue;
                }

                const isActiveVal = (typeof item === 'object' && item !== null && item.active === false) ? 0 : 1;

                const existing = db.prepare('SELECT id, is_active FROM units WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(name);
                if (existing) {
                    skipped++;
                } else {
                    insertStmt.run(name, isActiveVal);
                    imported++;
                }
            }

            return { imported, skipped };
        });
    }
}

module.exports = new UnitService();
