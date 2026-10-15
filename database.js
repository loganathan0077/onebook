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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Units
    db.exec(`
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
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

    // Users
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'USER',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

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

    // Runtime column migration for cash_transactions & bank_transactions (Phase 4E.11)
    const cashCols = db.prepare('PRAGMA table_info(cash_transactions)').all().map(c => c.name);
    if (!cashCols.includes('payment_method')) db.exec('ALTER TABLE cash_transactions ADD COLUMN payment_method TEXT');
    if (!cashCols.includes('reference_number')) db.exec('ALTER TABLE cash_transactions ADD COLUMN reference_number TEXT');
    if (!cashCols.includes('category')) db.exec('ALTER TABLE cash_transactions ADD COLUMN category TEXT');
    if (!cashCols.includes('created_at')) db.exec('ALTER TABLE cash_transactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');

    const bankCols = db.prepare('PRAGMA table_info(bank_transactions)').all().map(c => c.name);
    if (!bankCols.includes('payment_method')) db.exec('ALTER TABLE bank_transactions ADD COLUMN payment_method TEXT');
    if (!bankCols.includes('reference_number')) db.exec('ALTER TABLE bank_transactions ADD COLUMN reference_number TEXT');
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

module.exports = {
    initializeDatabase,
    getDatabase,
    transaction,
    backupDatabase,
    verifyDatabase,
    closeDatabase,
    isDatabaseOpen,
    getDatabasePath
};
