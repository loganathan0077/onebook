const dbManager = require('../database');

class LocationService {
    // --- Settings Persistence ---
    getLocationSettings() {
        const db = dbManager.getDatabase();
        const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'location_%'").all();
        const settings = {
            enabled: false,
            trackGodown: true,
            trackFloor: true,
            trackRack: true,
            trackShelf: true,
            trackCode: true
        };
        for (const row of rows) {
            if (row.key === 'location_enabled') settings.enabled = row.value === 'true' || row.value === '1';
            if (row.key === 'location_trackGodown') settings.trackGodown = row.value === 'true' || row.value === '1';
            if (row.key === 'location_trackFloor') settings.trackFloor = row.value === 'true' || row.value === '1';
            if (row.key === 'location_trackRack') settings.trackRack = row.value === 'true' || row.value === '1';
            if (row.key === 'location_trackShelf') settings.trackShelf = row.value === 'true' || row.value === '1';
            if (row.key === 'location_trackCode') settings.trackCode = row.value === 'true' || row.value === '1';
        }
        return settings;
    }

    saveLocationSettings(settings) {
        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();
            const upsert = db.prepare(`
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `);
            if (settings.enabled !== undefined) upsert.run('location_enabled', String(!!settings.enabled));
            if (settings.trackGodown !== undefined) upsert.run('location_trackGodown', String(!!settings.trackGodown));
            if (settings.trackFloor !== undefined) upsert.run('location_trackFloor', String(!!settings.trackFloor));
            if (settings.trackRack !== undefined) upsert.run('location_trackRack', String(!!settings.trackRack));
            if (settings.trackShelf !== undefined) upsert.run('location_trackShelf', String(!!settings.trackShelf));
            if (settings.trackCode !== undefined) upsert.run('location_trackCode', String(!!settings.trackCode));
            return this.getLocationSettings();
        });
    }

    // --- Location Code Generator ---
    generateLocationCode(type) {
        const db = dbManager.getDatabase();
        const prefixMap = {
            godown: 'GOD',
            floor: 'FLO',
            rack: 'RAC',
            shelf: 'SHE'
        };
        const prefix = prefixMap[type] || 'LOC';
        const countRow = db.prepare("SELECT COUNT(*) as count FROM stock_locations WHERE type = ?").get(type);
        const nextNum = (countRow ? countRow.count : 0) + 1;
        let code = `${prefix}-${String(nextNum).padStart(3, '0')}`;
        
        // Ensure uniqueness
        let existing = db.prepare("SELECT id FROM stock_locations WHERE code = ?").get(code);
        let bump = 1;
        while (existing) {
            code = `${prefix}-${String(nextNum + bump).padStart(3, '0')}`;
            existing = db.prepare("SELECT id FROM stock_locations WHERE code = ?").get(code);
            bump++;
        }
        return code;
    }

    // --- Locations CRUD ---
    getLocations(filters = {}) {
        const db = dbManager.getDatabase();
        let query = `
            SELECT l.*, p.name as parent_name, p.code as parent_code
            FROM stock_locations l
            LEFT JOIN stock_locations p ON l.parent_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (filters.type) {
            query += " AND l.type = ?";
            params.push(filters.type);
        }
        if (filters.parent_id !== undefined) {
            if (filters.parent_id === null) {
                query += " AND l.parent_id IS NULL";
            } else {
                query += " AND l.parent_id = ?";
                params.push(filters.parent_id);
            }
        }
        if (filters.is_active !== undefined) {
            query += " AND l.is_active = ?";
            params.push(filters.is_active ? 1 : 0);
        }
        if (filters.search) {
            query += " AND (l.name LIKE ? OR l.code LIKE ?)";
            const term = `%${filters.search}%`;
            params.push(term, term);
        }
        query += " ORDER BY l.created_at ASC";
        return db.prepare(query).all(...params);
    }

    getLocation(id) {
        const db = dbManager.getDatabase();
        return db.prepare(`
            SELECT l.*, p.name as parent_name, p.code as parent_code
            FROM stock_locations l
            LEFT JOIN stock_locations p ON l.parent_id = p.id
            WHERE l.id = ?
        `).get(id);
    }

    createLocation(data) {
        const db = dbManager.getDatabase();
        const id = data.id || `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const code = data.code || this.generateLocationCode(data.type);
        
        db.prepare(`
            INSERT INTO stock_locations (id, name, type, code, parent_id, is_active, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            data.name,
            data.type,
            code,
            data.parent_id || null,
            data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
            data.notes || null
        );
        return { success: true, id, code };
    }

    updateLocation(id, data) {
        const db = dbManager.getDatabase();
        const existing = this.getLocation(id);
        if (!existing) throw new Error('Location not found');

        db.prepare(`
            UPDATE stock_locations
            SET name = COALESCE(?, name),
                type = COALESCE(?, type),
                code = COALESCE(?, code),
                parent_id = ?,
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            data.name !== undefined ? data.name : existing.name,
            data.type !== undefined ? data.type : existing.type,
            data.code !== undefined ? data.code : existing.code,
            data.parent_id !== undefined ? (data.parent_id || null) : existing.parent_id,
            data.notes !== undefined ? data.notes : existing.notes,
            id
        );
        return { success: true, id };
    }

    toggleLocationActive(id, isActive) {
        const db = dbManager.getDatabase();
        db.prepare("UPDATE stock_locations SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(isActive ? 1 : 0, id);
        return { success: true, id, is_active: isActive ? 1 : 0 };
    }

    deleteLocation(id) {
        const db = dbManager.getDatabase();
        const children = db.prepare("SELECT COUNT(*) as count FROM stock_locations WHERE parent_id = ?").get(id);
        if (children && children.count > 0) {
            throw new Error('Cannot delete location with child locations. Delete or reassign children first.');
        }

        const inv = db.prepare("SELECT SUM(quantity) as total FROM location_inventory WHERE location_id = ?").get(id);
        if (inv && inv.total > 0) {
            throw new Error('Cannot delete location with active inventory balance.');
        }

        db.prepare("DELETE FROM stock_locations WHERE id = ?").run(id);
        return { success: true, id };
    }

    getLocationHierarchy() {
        const all = this.getLocations();
        const map = {};
        const roots = [];

        for (const loc of all) {
            map[loc.id] = { ...loc, children: [] };
        }

        for (const loc of all) {
            if (loc.parent_id && map[loc.parent_id]) {
                map[loc.parent_id].children.push(map[loc.id]);
            } else {
                roots.push(map[loc.id]);
            }
        }
        return roots;
    }

    // --- Phase 2: Location-Level Inventory Management ---

    getLocationStock(productId, variantId = null, locationId = null) {
        const db = dbManager.getDatabase();
        if (locationId) {
            if (variantId) {
                const row = db.prepare('SELECT quantity FROM location_inventory WHERE location_id = ? AND product_id = ? AND variant_id = ?').get(locationId, productId, variantId);
                return row ? row.quantity : 0;
            } else {
                const row = db.prepare('SELECT SUM(quantity) as total FROM location_inventory WHERE location_id = ? AND product_id = ?').get(locationId, productId);
                return row ? (row.total || 0) : 0;
            }
        } else {
            if (variantId) {
                return db.prepare(`
                    SELECT li.*, sl.name as location_name, sl.code as location_code, sl.type as location_type
                    FROM location_inventory li
                    JOIN stock_locations sl ON li.location_id = sl.id
                    WHERE li.product_id = ? AND li.variant_id = ? AND sl.is_active = 1
                    ORDER BY sl.name ASC
                `).all(productId, variantId);
            } else {
                return db.prepare(`
                    SELECT li.*, sl.name as location_name, sl.code as location_code, sl.type as location_type
                    FROM location_inventory li
                    JOIN stock_locations sl ON li.location_id = sl.id
                    WHERE li.product_id = ? AND sl.is_active = 1
                    ORDER BY sl.name ASC
                `).all(productId);
            }
        }
    }

    getProductStockBreakdown(productId, variantId = null) {
        const db = dbManager.getDatabase();
        let totalVariantStock = 0;
        if (variantId) {
            const v = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variantId);
            totalVariantStock = v ? (v.stock || 0) : 0;
        } else {
            const sumRow = db.prepare('SELECT SUM(stock) as total FROM product_variants WHERE product_id = ?').get(productId);
            totalVariantStock = sumRow ? (sumRow.total || 0) : 0;
        }

        const locationRows = this.getLocationStock(productId, variantId);
        const assignedStock = locationRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
        const unassignedStock = Math.max(0, parseFloat((totalVariantStock - assignedStock).toFixed(4)));

        return {
            totalStock: totalVariantStock,
            assignedStock,
            unassignedStock,
            locations: locationRows
        };
    }

    adjustLocationStock(locationId, productId, variantId, deltaQuantity) {
        const db = dbManager.getDatabase();
        if (!locationId) return;

        const existing = db.prepare('SELECT id, quantity FROM location_inventory WHERE location_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))')
            .get(locationId, productId, variantId, variantId);

        if (existing) {
            const newQty = existing.quantity + deltaQuantity;
            if (newQty < 0) {
                const err = new Error('INSUFFICIENT_LOCATION_STOCK');
                err.code = 'INSUFFICIENT_LOCATION_STOCK';
                throw err;
            }
            db.prepare('UPDATE location_inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(newQty, existing.id);
        } else {
            if (deltaQuantity < 0) {
                const err = new Error('INSUFFICIENT_LOCATION_STOCK');
                err.code = 'INSUFFICIENT_LOCATION_STOCK';
                throw err;
            }
            db.prepare('INSERT INTO location_inventory (location_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)')
                .run(locationId, productId, variantId, deltaQuantity);
        }
    }

    // --- Phase 3: Stock Transfers ---

    transferStock(productId, variantId, fromLocationId, toLocationId, quantity, notes = '') {
        if (!fromLocationId || !toLocationId) {
            throw new Error('Both source and destination locations are required.');
        }
        if (fromLocationId === toLocationId) {
            throw new Error('Source and destination locations must be different.');
        }
        if (quantity <= 0) {
            throw new Error('Transfer quantity must be greater than zero.');
        }

        return dbManager.transaction(() => {
            const db = dbManager.getDatabase();

            // Verify source stock
            const sourceInv = db.prepare('SELECT quantity FROM location_inventory WHERE location_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))')
                .get(fromLocationId, productId, variantId, variantId);

            const available = sourceInv ? sourceInv.quantity : 0;
            if (available < quantity) {
                const err = new Error(`Insufficient stock at source location. Available: ${available}, Requested: ${quantity}`);
                err.code = 'INSUFFICIENT_SOURCE_STOCK';
                throw err;
            }

            // Deduct from source and Add to destination atomically
            this.adjustLocationStock(fromLocationId, productId, variantId, -quantity);
            this.adjustLocationStock(toLocationId, productId, variantId, quantity);

            // Record transfer entry
            const transferId = `xfer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;

            db.prepare(`
                INSERT INTO stock_transfers (id, transfer_number, product_id, variant_id, from_location_id, to_location_id, quantity, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(transferId, transferNumber, productId, variantId, fromLocationId, toLocationId, quantity, notes || null);

            // Record in stock_movements for audit history (Net 0 effect on total global stock)
            const v = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variantId);
            const currentTotalStock = v ? v.stock : 0;

            const fromLoc = this.getLocation(fromLocationId);
            const toLoc = this.getLocation(toLocationId);
            const fromName = fromLoc ? fromLoc.name : fromLocationId;
            const toName = toLoc ? toLoc.name : toLocationId;

            db.prepare(`
                INSERT INTO stock_movements (product_id, variant_id, type, quantity, previous_stock, new_stock, reference_type, reference_id, notes, location_id)
                VALUES (?, ?, 'transfer_out', ?, ?, ?, 'stock_transfer', ?, ?, ?)
            `).run(productId, variantId, -quantity, currentTotalStock, currentTotalStock, transferNumber, `Transferred to ${toName}`, fromLocationId);

            db.prepare(`
                INSERT INTO stock_movements (product_id, variant_id, type, quantity, previous_stock, new_stock, reference_type, reference_id, notes, location_id)
                VALUES (?, ?, 'transfer_in', ?, ?, ?, 'stock_transfer', ?, ?, ?)
            `).run(productId, variantId, quantity, currentTotalStock, currentTotalStock, transferNumber, `Transferred from ${fromName}`, toLocationId);

            return {
                success: true,
                transferId,
                transferNumber,
                productId,
                variantId,
                quantity,
                fromLocation: fromName,
                toLocation: toName
            };
        });
    }

    getTransfers(filters = {}) {
        const db = dbManager.getDatabase();
        return db.prepare(`
            SELECT st.*, 
                   p.name as product_name, 
                   pv.variant_name as variant_name,
                   fl.name as from_location_name, fl.code as from_location_code,
                   tl.name as to_location_name, tl.code as to_location_code
            FROM stock_transfers st
            LEFT JOIN products p ON st.product_id = p.id
            LEFT JOIN product_variants pv ON st.variant_id = pv.id
            LEFT JOIN stock_locations fl ON st.from_location_id = fl.id
            LEFT JOIN stock_locations tl ON st.to_location_id = tl.id
            ORDER BY st.created_at DESC
            LIMIT 100
        `).all();
    }
}

module.exports = new LocationService();
