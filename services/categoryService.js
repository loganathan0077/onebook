const dbManager = require('../database');

class CategoryService {
    getCategories() {
        const db = dbManager.getDatabase();
        return db.prepare('SELECT id, name, is_active, created_at FROM categories ORDER BY name COLLATE NOCASE ASC').all()
            .map(r => ({
                id: r.id,
                name: r.name,
                active: Boolean(r.is_active),
                is_active: r.is_active,
                created_at: r.created_at
            }));
    }

    getCategory(id) {
        const db = dbManager.getDatabase();
        const r = db.prepare('SELECT id, name, is_active, created_at FROM categories WHERE id = ?').get(id);
        if (!r) return null;
        return {
            id: r.id,
            name: r.name,
            active: Boolean(r.is_active),
            is_active: r.is_active,
            created_at: r.created_at
        };
    }

    getCategoryByName(name) {
        if (!name || typeof name !== 'string') return null;
        const db = dbManager.getDatabase();
        const r = db.prepare('SELECT id, name, is_active, created_at FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(name);
        if (!r) return null;
        return {
            id: r.id,
            name: r.name,
            active: Boolean(r.is_active),
            is_active: r.is_active,
            created_at: r.created_at
        };
    }

    createCategory(name, active = true) {
        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new Error('Category name is required');
        }
        const trimmed = name.trim();
        const isActiveVal = (active === false || active === 0 || active === '0') ? 0 : 1;
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const existing = this.getCategoryByName(trimmed);
            if (existing) {
                const err = new Error('CATEGORY_ALREADY_EXISTS');
                err.code = 'CATEGORY_ALREADY_EXISTS';
                throw err;
            }
            const info = db.prepare('INSERT INTO categories (name, is_active) VALUES (?, ?)').run(trimmed, isActiveVal);
            return {
                id: info.lastInsertRowid,
                name: trimmed,
                active: Boolean(isActiveVal)
            };
        });
    }

    updateCategory(id, newName) {
        if (!id) throw new Error('Category ID is required');
        if (!newName || typeof newName !== 'string' || !newName.trim()) {
            throw new Error('New category name is required');
        }
        const trimmed = newName.trim();
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const current = this.getCategory(id);
            if (!current) {
                const err = new Error('CATEGORY_NOT_FOUND');
                err.code = 'CATEGORY_NOT_FOUND';
                throw err;
            }

            const existing = this.getCategoryByName(trimmed);
            if (existing && existing.id !== current.id) {
                const err = new Error('CATEGORY_ALREADY_EXISTS');
                err.code = 'CATEGORY_ALREADY_EXISTS';
                throw err;
            }

            const oldName = current.name;
            db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(trimmed, id);

            // Cascade name update to products referencing oldName
            db.prepare('UPDATE products SET category = ? WHERE category = ?').run(trimmed, oldName);

            return {
                id: current.id,
                name: trimmed,
                oldName,
                active: current.active
            };
        });
    }

    toggleCategoryStatus(id, active) {
        if (!id) throw new Error('Category ID is required');
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const current = this.getCategory(id);
            if (!current) {
                const err = new Error('CATEGORY_NOT_FOUND');
                err.code = 'CATEGORY_NOT_FOUND';
                throw err;
            }

            const newActiveVal = (typeof active === 'boolean')
                ? (active ? 1 : 0)
                : (current.active ? 0 : 1);

            db.prepare('UPDATE categories SET is_active = ? WHERE id = ?').run(newActiveVal, id);

            return {
                id: current.id,
                name: current.name,
                active: Boolean(newActiveVal)
            };
        });
    }

    deleteCategory(id) {
        if (!id) throw new Error('Category ID is required');
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const current = this.getCategory(id);
            if (!current) {
                const err = new Error('CATEGORY_NOT_FOUND');
                err.code = 'CATEGORY_NOT_FOUND';
                throw err;
            }

            // Check if any product is currently using this category
            const countRow = db.prepare('SELECT count(*) as count FROM products WHERE category = ?').get(current.name);
            if (countRow && countRow.count > 0) {
                const err = new Error('CATEGORY_IN_USE');
                err.code = 'CATEGORY_IN_USE';
                err.productCount = countRow.count;
                throw err;
            }

            db.prepare('DELETE FROM categories WHERE id = ?').run(id);
            return { success: true, id };
        });
    }

    // Idempotent migration from an array of legacy items or names
    migrateCategories(categoryItems) {
        if (!Array.isArray(categoryItems) || categoryItems.length === 0) {
            return { imported: 0, skipped: 0 };
        }

        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const insertStmt = db.prepare('INSERT OR IGNORE INTO categories (name, is_active) VALUES (?, ?)');
            let imported = 0;
            let skipped = 0;

            for (const item of categoryItems) {
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

                const existing = db.prepare('SELECT id, is_active FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(name);
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

module.exports = new CategoryService();
