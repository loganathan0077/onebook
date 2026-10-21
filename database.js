const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;
let currentDbPath = null;

function initializeDatabase(dbPath, { allowCreate = false } = {}) {
    if (db) {
        throw new Error('Database already initialized.');
    }
    if (!dbPath || typeof dbPath !== 'string') {
        const err = new Error('INVALID_DATABASE_PATH: Path must be a non-empty string.');
        err.code = 'INVALID_DATABASE_PATH';
        throw err;
    }
    if (!allowCreate && !fs.existsSync(dbPath)) {
        const err = new Error(`DATABASE_FILE_NOT_FOUND: The SQLite database file does not exist at "${dbPath}". Silent database creation is disallowed.`);
        err.code = 'DATABASE_FILE_NOT_FOUND';
        throw err;
    }
    if (!allowCreate) {
        const stats = fs.statSync(dbPath);
        if (stats.size === 0) {
            const err = new Error(`DATABASE_FILE_EMPTY: The SQLite database file at "${dbPath}" is 0 bytes.`);
            err.code = 'DATABASE_FILE_EMPTY';
            throw err;
        }
    }
    
    // Ensure directory exists if creation is explicitly allowed
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        if (!allowCreate) {
            const err = new Error(`DATABASE_DIRECTORY_NOT_FOUND: Directory "${dir}" does not exist.`);
            err.code = 'DATABASE_DIRECTORY_NOT_FOUND';
            throw err;
        }
        fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath, { fileMustExist: !allowCreate });
    currentDbPath = dbPath;

    // Apply PRAGMAs
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = FULL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    // Create tables
    createSchema();

    return db;
}

function getDatabasePath() {
    return currentDbPath;
}

function getDatabase() {
    if (!db) {
        throw new Error('Database is not initialized.');
    }
    return db;
}

function createSchema() {
    // Database Metadata
    db.exec(`
        CREATE TABLE IF NOT EXISTS database_metadata (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    // Initialize version if not exists
    db.prepare(`INSERT OR IGNORE INTO database_metadata (key, value) VALUES ('schema_version', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO database_metadata (key, value) VALUES ('application_version', '1.0.1')`).run();

    // Products
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT,
            category TEXT,
            unit TEXT,
            price REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            stock REAL DEFAULT 0,
            min_stock REAL DEFAULT 0,
            description TEXT,
            supplier_text TEXT,
            pack_sizes TEXT,
            hsn TEXT,
            gst_rate REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Categories
    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Units
    db.exec(`
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Customers
    db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            address TEXT,
            state TEXT,
            country TEXT DEFAULT 'INDIA',
            notes TEXT,
            opening_balance REAL DEFAULT 0,
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        -- Runtime migration: add columns to existing DBs
        -- (ALTER TABLE is safe to run multiple times via try/catch in JS)
    `);

    // Suppliers
    db.exec(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            address TEXT,
            state TEXT,
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Sales
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_number TEXT NOT NULL UNIQUE,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            customer_id TEXT,
            customer_type TEXT,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            taxable_value REAL DEFAULT 0,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            total_tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            payment_method TEXT,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
    `);

    // Sale Items
    db.exec(`
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER,
            source_product_id INTEGER,
            product_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            base_quantity REAL,
            price REAL NOT NULL,
            discount REAL DEFAULT 0,
            taxable_value REAL DEFAULT 0,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            total REAL NOT NULL,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);

    // Purchases
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            supplier_id TEXT,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            taxable_value REAL DEFAULT 0,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            total_tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            payment_method TEXT,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );
    `);

    // Purchase Items
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            product_id INTEGER,
            source_product_id INTEGER,
            product_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            discount REAL DEFAULT 0,
            taxable_value REAL DEFAULT 0,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            total REAL NOT NULL,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);

    // Stock Movements
    db.exec(`
        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            source_product_id INTEGER,
            type TEXT NOT NULL,
            quantity REAL NOT NULL,
            reference_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    `);

    // Payments
    db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id TEXT NOT NULL,
            sale_id INTEGER,
            amount REAL NOT NULL,
            method TEXT,
            reference TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (sale_id) REFERENCES sales(id)
        );
    `);

    // Party Payments
    db.exec(`
        CREATE TABLE IF NOT EXISTS party_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id TEXT NOT NULL,
            purchase_id INTEGER,
            amount REAL NOT NULL,
            method TEXT,
            reference TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (purchase_id) REFERENCES purchases(id)
        );
    `);

    // Cash Transactions
    db.exec(`
        CREATE TABLE IF NOT EXISTS cash_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            reference_type TEXT,
            reference_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE'
        );
    `);

    // Bank Transactions
    db.exec(`
        CREATE TABLE IF NOT EXISTS bank_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            reference_type TEXT,
            reference_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE'
        );
    `);

    // Petty Cash Transactions
    db.exec(`
        CREATE TABLE IF NOT EXISTS petty_cash_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            description TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE'
        );
    `);

    // Day Closings
    db.exec(`
        CREATE TABLE IF NOT EXISTS day_closings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE NOT NULL UNIQUE,
            opening_balance REAL DEFAULT 0,
            cash_sales REAL DEFAULT 0,
            cash_in REAL DEFAULT 0,
            cash_out REAL DEFAULT 0,
            expected_balance REAL DEFAULT 0,
            actual_balance REAL DEFAULT 0,
            difference REAL DEFAULT 0,
            notes TEXT,
            closed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Users and Sessions DDL (Non-destructive, preservation migration)
    try {
        const usersTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
        if (usersTableExists) {
            const userCols = db.pragma("table_info(users)");
            const colNames = userCols.map(c => c.name);
            const idCol = userCols.find(c => c.name === "id");
            
            // If legacy INTEGER PRIMARY KEY schema is present, perform non-destructive table copy migration
            if (idCol && idCol.type.toUpperCase() === "INTEGER") {
                db.transaction(() => {
                    db.exec(`
                        CREATE TABLE IF NOT EXISTS users_new (
                            id TEXT PRIMARY KEY,
                            name TEXT NOT NULL DEFAULT "",
                            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                            user_code TEXT,
                            password_hash TEXT NOT NULL,
                            salt TEXT NOT NULL DEFAULT "",
                            hash_algorithm TEXT NOT NULL DEFAULT 'scrypt',
                            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'manager', 'cashier', 'ADMIN', 'USER')),
                            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
                            permissions_json TEXT NOT NULL DEFAULT "[]",
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                    `);

                    // Copy all existing rows without dropping or losing data
                    const hasName = colNames.includes("name");
                    const hasUserCode = colNames.includes("user_code");
                    const hasSalt = colNames.includes("salt");
                    const hasHashAlg = colNames.includes("hash_algorithm");
                    const hasRole = colNames.includes("role");
                    const hasStatus = colNames.includes("status");
                    const hasPerms = colNames.includes("permissions_json");
                    const hasCreatedAt = colNames.includes("created_at");
                    const hasUpdated = colNames.includes("updated_at");

                    // Check for case-insensitive duplicate usernames before attempting copy
                    const duplicateCheck = db.prepare(`
                        SELECT LOWER(username) as lower_name, COUNT(*) as count 
                        FROM users 
                        GROUP BY LOWER(username) 
                        HAVING count > 1
                    `).all();

                    if (duplicateCheck.length > 0) {
                        const conflictingNames = duplicateCheck.map(d => d.lower_name).join(", ");
                        const err = new Error(`Migration conflict: Found case-insensitive duplicate usernames in legacy users table (${conflictingNames}). Migration aborted to prevent data loss.`);
                        err.code = "MIGRATION_DUPLICATE_USERNAMES";
                        throw err;
                    }

                    const sourceCount = db.prepare("SELECT count(*) as c FROM users").get().c;

                    // Strict INSERT (never IGNORE) so any constraint failure triggers a rollback
                    db.exec(`
                        INSERT INTO users_new (
                            id, name, username, user_code, password_hash, salt, hash_algorithm, role, status, permissions_json, created_at, updated_at
                        )
                        SELECT 
                            CAST(id AS TEXT),
                            ${hasName ? "COALESCE(name, '')" : "''"},
                            username,
                            ${hasUserCode ? "user_code" : "NULL"},
                            password_hash,
                            ${hasSalt ? "COALESCE(salt, '')" : "''"},
                            ${hasHashAlg ? "COALESCE(hash_algorithm, 'legacy_unknown')" : "'legacy_unknown'"},
                            ${hasRole ? "COALESCE(role, 'user')" : "'user'"},
                            ${hasStatus ? "COALESCE(status, 'active')" : "'active'"},
                            ${hasPerms ? "COALESCE(permissions_json, '[]')" : "'[]'"},
                            ${hasCreatedAt ? "COALESCE(created_at, CURRENT_TIMESTAMP)" : "CURRENT_TIMESTAMP"},
                            ${hasUpdated ? "COALESCE(updated_at, CURRENT_TIMESTAMP)" : "CURRENT_TIMESTAMP"}
                        FROM users;
                    `);

                    const destCount = db.prepare("SELECT count(*) as c FROM users_new").get().c;
                    if (destCount !== sourceCount) {
                        throw new Error(`Migration verification failed: source count (${sourceCount}) does not match destination count (${destCount}). Aborting migration.`);
                    }

                    // Collision-safe, deterministic backup table name that preserves all existing tables
                    let backupTableName = "users_legacy_backup";
                    let suffix = 1;
                    while (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(backupTableName)) {
                        backupTableName = `users_legacy_backup_${suffix}`;
                        suffix++;
                    }

                    db.exec(`ALTER TABLE users RENAME TO ${backupTableName};`);
                    db.exec(`ALTER TABLE users_new RENAME TO users;`);
                })();
            } else {
                // Table already has TEXT id, ensure any missing columns are added idempotently
                if (!colNames.includes("name")) try { db.exec(`ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ""`); } catch(e){}
                if (!colNames.includes("user_code")) try { db.exec(`ALTER TABLE users ADD COLUMN user_code TEXT`); } catch(e){}
                if (!colNames.includes("salt")) try { db.exec(`ALTER TABLE users ADD COLUMN salt TEXT NOT NULL DEFAULT ""`); } catch(e){}
                if (!colNames.includes("hash_algorithm")) try { db.exec(`ALTER TABLE users ADD COLUMN hash_algorithm TEXT NOT NULL DEFAULT "scrypt"`); } catch(e){}
                if (!colNames.includes("status")) try { db.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT "active"`); } catch(e){}
                if (!colNames.includes("permissions_json")) try { db.exec(`ALTER TABLE users ADD COLUMN permissions_json TEXT NOT NULL DEFAULT "[]"`); } catch(e){}
                if (!colNames.includes("updated_at")) try { db.exec(`ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch(e){}
            }
        } else {
            // Fresh installation: create users table directly
            db.exec(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL DEFAULT "",
                    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    user_code TEXT,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    hash_algorithm TEXT NOT NULL DEFAULT "scrypt",
                    role TEXT NOT NULL DEFAULT "user" CHECK (role IN ("admin", "user", "manager", "cashier", "ADMIN", "USER")),
                    status TEXT NOT NULL DEFAULT "active" CHECK (status IN ("active", "disabled")),
                    permissions_json TEXT NOT NULL DEFAULT "[]",
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
        }

        // Create user_sessions and indexes safely
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
            CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
        `);
    } catch (e) {
        console.error("[Database] users schema initialization error:", e);
        throw e;
    }

    // Settings
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Purchase Orders
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_number TEXT NOT NULL UNIQUE,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            supplier_id TEXT,
            total REAL DEFAULT 0,
            status TEXT DEFAULT 'PENDING',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );
    `);

    // Runtime column migration for customers (idempotent)
    const customerCols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
    if (!customerCols.includes('country')) {
        db.exec("ALTER TABLE customers ADD COLUMN country TEXT DEFAULT 'INDIA'");
    }
    if (!customerCols.includes('notes')) {
        db.exec('ALTER TABLE customers ADD COLUMN notes TEXT');
    }
    if (!customerCols.includes('opening_balance')) {
        db.exec('ALTER TABLE customers ADD COLUMN opening_balance REAL DEFAULT 0');
    }

    // Runtime column migration for stock_movements
    const smCols = db.prepare('PRAGMA table_info(stock_movements)').all().map(c => c.name);
    if (!smCols.includes('variant_id')) db.exec('ALTER TABLE stock_movements ADD COLUMN variant_id INTEGER');
    if (!smCols.includes('previous_stock')) db.exec('ALTER TABLE stock_movements ADD COLUMN previous_stock REAL');
    if (!smCols.includes('new_stock')) db.exec('ALTER TABLE stock_movements ADD COLUMN new_stock REAL');
    if (!smCols.includes('reference_type')) db.exec('ALTER TABLE stock_movements ADD COLUMN reference_type TEXT');
    if (!smCols.includes('notes')) db.exec('ALTER TABLE stock_movements ADD COLUMN notes TEXT');

    // Runtime column migration for suppliers & sales
    const supplierCols = db.prepare('PRAGMA table_info(suppliers)').all().map(c => c.name);
    if (!supplierCols.includes('status')) db.exec("ALTER TABLE suppliers ADD COLUMN status TEXT DEFAULT 'active'");

    const salesCols = db.prepare('PRAGMA table_info(sales)').all().map(c => c.name);
    if (!salesCols.includes('courier')) db.exec('ALTER TABLE sales ADD COLUMN courier REAL DEFAULT 0');
    if (!salesCols.includes('cash_amount')) db.exec('ALTER TABLE sales ADD COLUMN cash_amount REAL DEFAULT 0');
    if (!salesCols.includes('other_payment_amount')) db.exec('ALTER TABLE sales ADD COLUMN other_payment_amount REAL DEFAULT 0');
    if (!salesCols.includes('customer_amount')) db.exec('ALTER TABLE sales ADD COLUMN customer_amount REAL DEFAULT 0');
    if (!salesCols.includes('change_amount')) db.exec('ALTER TABLE sales ADD COLUMN change_amount REAL DEFAULT 0');
    if (!salesCols.includes('gst_applied')) db.exec('ALTER TABLE sales ADD COLUMN gst_applied INTEGER DEFAULT 0');
    if (!salesCols.includes('payment_status')) db.exec("ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'fully_paid'");
    if (!salesCols.includes('amount_paid')) db.exec('ALTER TABLE sales ADD COLUMN amount_paid REAL DEFAULT 0');
    if (!salesCols.includes('outstanding_amount')) db.exec('ALTER TABLE sales ADD COLUMN outstanding_amount REAL DEFAULT 0');
    if (!salesCols.includes('due_date')) db.exec('ALTER TABLE sales ADD COLUMN due_date DATETIME');
    if (!salesCols.includes('customer_name')) db.exec("ALTER TABLE sales ADD COLUMN customer_name TEXT DEFAULT 'Walk-in Customer'");

    // Runtime column migration for cash_transactions & bank_transactions (Phase 4E.11)
    const cashCols = db.prepare('PRAGMA table_info(cash_transactions)').all().map(c => c.name);
    if (!cashCols.includes('payment_method')) db.exec('ALTER TABLE cash_transactions ADD COLUMN payment_method TEXT');
    if (!cashCols.includes('reference_number')) db.exec('ALTER TABLE cash_transactions ADD COLUMN reference_number TEXT');
    if (!cashCols.includes('category')) db.exec('ALTER TABLE cash_transactions ADD COLUMN category TEXT');
    if (!cashCols.includes('created_at')) db.exec('ALTER TABLE cash_transactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');

    const bankCols = db.prepare('PRAGMA table_info(bank_transactions)').all().map(c => c.name);
    if (!bankCols.includes('payment_method')) db.exec('ALTER TABLE bank_transactions ADD COLUMN payment_method TEXT');

    if (!bankCols.includes('reference_number')) db.exec('ALTER TABLE bank_transactions ADD COLUMN reference_number TEXT');

    // Runtime table creation for draft_sales
    db.exec(`
        CREATE TABLE IF NOT EXISTS draft_sales (
            id TEXT PRIMARY KEY,
            customer_id TEXT,
            customer_name TEXT,
            customer_type TEXT DEFAULT 'walk-in',
            items_json TEXT NOT NULL,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            payment_method TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    if (!bankCols.includes('category')) db.exec('ALTER TABLE bank_transactions ADD COLUMN category TEXT');
    if (!bankCols.includes('created_at')) db.exec('ALTER TABLE bank_transactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');

    // Runtime column migration for petty_cash_transactions (Phase 4E.12)
    const pcCols = db.prepare('PRAGMA table_info(petty_cash_transactions)').all().map(c => c.name);
    if (!pcCols.includes('original_id')) db.exec('ALTER TABLE petty_cash_transactions ADD COLUMN original_id TEXT');
    if (!pcCols.includes('account')) db.exec("ALTER TABLE petty_cash_transactions ADD COLUMN account TEXT DEFAULT 'cash'");
    if (!pcCols.includes('from_account')) db.exec('ALTER TABLE petty_cash_transactions ADD COLUMN from_account TEXT');
    if (!pcCols.includes('to_account')) db.exec('ALTER TABLE petty_cash_transactions ADD COLUMN to_account TEXT');
    if (!pcCols.includes('voucher_no')) db.exec('ALTER TABLE petty_cash_transactions ADD COLUMN voucher_no TEXT');
    if (!pcCols.includes('remarks')) db.exec('ALTER TABLE petty_cash_transactions ADD COLUMN remarks TEXT');
    if (!pcCols.includes('created_at')) db.exec('ALTER TABLE petty_cash_transactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_pc_date ON petty_cash_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_pc_voucher ON petty_cash_transactions(voucher_no);
        CREATE INDEX IF NOT EXISTS idx_pc_orig_id ON petty_cash_transactions(original_id);
    `);

    // Runtime column migration for categories & units (Phase 4E.20.1)
    const catCols = db.prepare('PRAGMA table_info(categories)').all().map(c => c.name);
    if (!catCols.includes('is_active')) {
        db.exec('ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    }

    const unitCols = db.prepare('PRAGMA table_info(units)').all().map(c => c.name);
    if (!unitCols.includes('is_active')) {
        db.exec('ALTER TABLE units ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    }

    // Runtime column migration for day_closings (Phase 4E.13)
    const dcCols = db.prepare('PRAGMA table_info(day_closings)').all().map(c => c.name);
    if (!dcCols.includes('original_id')) db.exec('ALTER TABLE day_closings ADD COLUMN original_id TEXT');
    if (!dcCols.includes('bank_sales')) db.exec('ALTER TABLE day_closings ADD COLUMN bank_sales REAL DEFAULT 0');
    if (!dcCols.includes('online_sales')) db.exec('ALTER TABLE day_closings ADD COLUMN online_sales REAL DEFAULT 0');
    if (!dcCols.includes('total_sales')) db.exec('ALTER TABLE day_closings ADD COLUMN total_sales REAL DEFAULT 0');
    if (!dcCols.includes('denominations_json')) db.exec('ALTER TABLE day_closings ADD COLUMN denominations_json TEXT');
    if (!dcCols.includes('status')) db.exec('ALTER TABLE day_closings ADD COLUMN status TEXT');
    if (!dcCols.includes('opening_cash')) db.exec('ALTER TABLE day_closings ADD COLUMN opening_cash REAL DEFAULT 0');
    if (!dcCols.includes('expected_cash')) db.exec('ALTER TABLE day_closings ADD COLUMN expected_cash REAL DEFAULT 0');
    if (!dcCols.includes('actual_cash')) db.exec('ALTER TABLE day_closings ADD COLUMN actual_cash REAL DEFAULT 0');

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_dc_date ON day_closings(date);
        CREATE INDEX IF NOT EXISTS idx_dc_orig_id ON day_closings(original_id);
    `);

    // Calculator History (Phase 4E.14)
    db.exec(`
        CREATE TABLE IF NOT EXISTS calculator_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_id TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expression TEXT NOT NULL,
            result REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_calc_hist_date ON calculator_history(date);
        CREATE INDEX IF NOT EXISTS idx_calc_hist_orig_id ON calculator_history(original_id);
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cash_tx_date ON cash_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_cash_tx_ref ON cash_transactions(reference_type, reference_id);
        CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_bank_tx_ref ON bank_transactions(reference_type, reference_id);
    `);

        // Migration Audit Log
    db.exec(`
        CREATE TABLE IF NOT EXISTS migration_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration_run_id TEXT NOT NULL,
            source_file TEXT,
            source_record_id TEXT,
            target_table TEXT,
            target_record_id TEXT,
            migration_status TEXT NOT NULL,
            notes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Audit Log
    db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            action TEXT NOT NULL,
            record_type TEXT NOT NULL,
            record_id INTEGER,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

function transaction(callback) {
    if (!db) throw new Error('Database not initialized');
    const executeTx = db.transaction(callback);
    return executeTx();
}

function verifyDatabase() {
    if (!db) throw new Error('Database not initialized');
    const result = db.pragma('integrity_check', { simple: true });
    if (result === 'ok') {
        return { healthy: true, result: 'ok' };
    }
    return { healthy: false, result: JSON.stringify(result) };
}

async function backupDatabase(backupDirPath, prefix = 'OneBook') {
    if (!db) throw new Error('Database not initialized');
    
    if (!fs.existsSync(backupDirPath)) {
        fs.mkdirSync(backupDirPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${prefix}_${timestamp}.db`;
    const backupFilePath = path.join(backupDirPath, backupFileName);

    try {
        await db.backup(backupFilePath);
        return { success: true, filePath: backupFilePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

function isDatabaseOpen() {
    return db !== null && db.open;
}


const draftSalesService = {
    getAll: () => {
        const rows = db.prepare('SELECT * FROM draft_sales ORDER BY updated_at DESC').all();
        return rows.map(r => {
            let items = [];
            try { items = JSON.parse(r.items_json); } catch(e){}
            return {
                id: r.id,
                customerId: r.customer_id,
                customerName: r.customer_name,
                customerType: r.customer_type,
                items: items,
                subtotal: r.subtotal,
                discount: r.discount,
                total: r.total,
                paymentMethod: r.payment_method,
                date: r.created_at,
                timestamp: new Date(r.created_at).getTime()
            };
        });
    },
    save: (draft) => {
        const id = draft.id || ('draft_' + Date.now());
        const itemsJson = JSON.stringify(draft.items || []);
        db.prepare(`
            INSERT INTO draft_sales (id, customer_id, customer_name, customer_type, items_json, subtotal, discount, total, payment_method, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                customer_id=excluded.customer_id,
                customer_name=excluded.customer_name,
                customer_type=excluded.customer_type,
                items_json=excluded.items_json,
                subtotal=excluded.subtotal,
                discount=excluded.discount,
                total=excluded.total,
                payment_method=excluded.payment_method,
                updated_at=CURRENT_TIMESTAMP
        `).run(
            id,
            draft.customerId || null,
            draft.customerName || 'Walk-in Customer',
            draft.customerType || 'walk-in',
            itemsJson,
            Number(draft.subtotal || 0),
            Number(draft.discount || 0),
            Number(draft.total || 0),
            draft.paymentMethod || 'cash'
        );
        return { success: true, id };
    },
    delete: (id) => {
        db.prepare('DELETE FROM draft_sales WHERE id = ?').run(id);
        return { success: true };
    }
};

module.exports = {
    initializeDatabase,
    getDatabase,
    transaction,
    backupDatabase,
    verifyDatabase,
    closeDatabase,
    isDatabaseOpen,
    draftSalesService,
    getDatabasePath
};
