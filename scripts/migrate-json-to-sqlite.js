/**
 * OneBook JSON-to-SQLite Migration Utility
 * Phase 4E.21.C.12.4 — Product Variants, Customer Ledger and Full Runtime Compatibility
 * 
 * Safely imports legacy shop JSON files into a fresh SQLite database
 * without touching original source files or modifying existing configurations.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const readline = require('readline');

// Scrypt configuration matching services/userService.js
const SCRYPT_OPTIONS = {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024
};
const KEY_LENGTH = 64;

/**
 * Secret key denylist and regex pattern matching to ensure no secrets or credential variants
 * are ever imported into SQLite settings table.
 */
const SENSITIVE_SETTINGS_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /credential/i,
    /apikey/i,
    /api_key/i,
    /auth/i,
    /private_key/i,
    /privatekey/i,
    /session_token/i,
    /sessiontoken/i
];

function isSensitiveSettingKey(key) {
    if (!key || typeof key !== 'string') return true;
    return SENSITIVE_SETTINGS_PATTERNS.some(pat => pat.test(key));
}

function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(derivedKey.toString('hex'));
        });
    });
}

/**
 * Expected schema DDL and runtime column migrations matching database.js and service queries exactly
 */
function initializeSchema(db) {
    db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS database_metadata (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

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

        CREATE TABLE IF NOT EXISTS product_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            variant_name TEXT NOT NULL,
            legacy_variant_id TEXT,
            sku TEXT,
            barcode TEXT,
            buying_price REAL DEFAULT 0,
            selling_price REAL DEFAULT 0,
            stock REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_pv_product_id ON product_variants(product_id);
        CREATE INDEX IF NOT EXISTS idx_pv_barcode ON product_variants(barcode);

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

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

        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER,
            source_product_id INTEGER,
            variant_id INTEGER,
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

        CREATE TABLE IF NOT EXISTS purchase_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id INTEGER NOT NULL,
            product_id INTEGER,
            source_product_id INTEGER,
            variant_id INTEGER,
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

        CREATE TABLE IF NOT EXISTS cash_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            reference_type TEXT,
            reference_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            payment_method TEXT,
            reference_number TEXT,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bank_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            reference_type TEXT,
            reference_id INTEGER,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            payment_method TEXT,
            reference_number TEXT,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS petty_cash_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_id TEXT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            description TEXT,
            account TEXT DEFAULT 'cash',
            from_account TEXT,
            to_account TEXT,
            voucher_no TEXT,
            remarks TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS day_closings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_id TEXT,
            date DATE NOT NULL UNIQUE,
            opening_balance REAL DEFAULT 0,
            cash_sales REAL DEFAULT 0,
            bank_sales REAL DEFAULT 0,
            online_sales REAL DEFAULT 0,
            total_sales REAL DEFAULT 0,
            cash_in REAL DEFAULT 0,
            cash_out REAL DEFAULT 0,
            expected_balance REAL DEFAULT 0,
            actual_balance REAL DEFAULT 0,
            difference REAL DEFAULT 0,
            notes TEXT,
            denominations_json TEXT,
            status TEXT,
            opening_cash REAL DEFAULT 0,
            expected_cash REAL DEFAULT 0,
            actual_cash REAL DEFAULT 0,
            closed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_number TEXT NOT NULL UNIQUE,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            supplier_id TEXT,
            supplier_name TEXT,
            total REAL DEFAULT 0,
            status TEXT DEFAULT 'PENDING',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );

        CREATE TABLE IF NOT EXISTS purchase_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_id INTEGER NOT NULL,
            product_id INTEGER,
            variant_id INTEGER,
            product_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            total REAL NOT NULL,
            FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS calculator_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_id TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expression TEXT NOT NULL,
            result REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            user_code TEXT,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            hash_algorithm TEXT NOT NULL DEFAULT 'scrypt',
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'manager', 'cashier', 'ADMIN', 'USER')),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
            permissions_json TEXT NOT NULL DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

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
        CREATE INDEX IF NOT EXISTS idx_pc_date ON petty_cash_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_pc_voucher ON petty_cash_transactions(voucher_no);
        CREATE INDEX IF NOT EXISTS idx_pc_orig_id ON petty_cash_transactions(original_id);
        CREATE INDEX IF NOT EXISTS idx_dc_date ON day_closings(date);
        CREATE INDEX IF NOT EXISTS idx_dc_orig_id ON day_closings(original_id);
        CREATE INDEX IF NOT EXISTS idx_calc_hist_date ON calculator_history(date);
        CREATE INDEX IF NOT EXISTS idx_calc_hist_orig_id ON calculator_history(original_id);
        CREATE INDEX IF NOT EXISTS idx_cash_tx_date ON cash_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_cash_tx_ref ON cash_transactions(reference_type, reference_id);
        CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_bank_tx_ref ON bank_transactions(reference_type, reference_id);

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            action TEXT NOT NULL,
            record_type TEXT NOT NULL,
            record_id INTEGER,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

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

    db.prepare("INSERT OR IGNORE INTO database_metadata (key, value) VALUES ('schema_version', '1')").run();
    db.prepare("INSERT OR IGNORE INTO database_metadata (key, value) VALUES ('application_version', '1.0.1')").run();
}

/**
 * Read and validate all 17 JSON files in source directory
 */
function readSourceJsonFiles(sourceDir) {
    const requiredFiles = [
        'calculatorHistory.json',
        'customers.json',
        'dayClosings.json',
        'draftSales.json',
        'masterCategories.json',
        'masterUnits.json',
        'negativeChangeCount.json',
        'pettyCashCategories.json',
        'pettyCashTransactions.json',
        'products.json',
        'purchaseOrders.json',
        'purchases.json',
        'sales.json',
        'settings.json',
        'stockHistory.json',
        'suppliers.json',
        'users.json'
    ];

    const data = {};
    for (const file of requiredFiles) {
        const filePath = path.join(sourceDir, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Required JSON file missing: ${filePath}`);
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        try {
            data[file] = JSON.parse(raw);
        } catch (err) {
            throw new Error(`Failed to parse JSON file ${file}: ${err.message}`);
        }
    }
    return data;
}

/**
 * Pre-flight audit and validation
 */
function runPreflightAudit(data) {
    const report = {
        valid: true,
        errors: [],
        warnings: [],
        counts: {},
        financialTotals: {
            totalGrossSales: 0,
            subtotal: 0,
            itemDiscounts: 0,
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0,
            creditSalesTotal: 0
        }
    };

    // Counts
    report.counts.categories = Array.isArray(data['masterCategories.json']) ? data['masterCategories.json'].length : 0;
    report.counts.units = Array.isArray(data['masterUnits.json']) ? data['masterUnits.json'].length : 0;
    report.counts.customers = Array.isArray(data['customers.json']) ? data['customers.json'].length : 0;
    report.counts.suppliers = Array.isArray(data['suppliers.json']) ? data['suppliers.json'].length : 0;
    report.counts.products = Array.isArray(data['products.json']) ? data['products.json'].length : 0;
    report.counts.stockMovements = Array.isArray(data['stockHistory.json']) ? data['stockHistory.json'].length : 0;
    report.counts.salesRawRows = Array.isArray(data['sales.json']) ? data['sales.json'].length : 0;
    report.counts.pettyCash = Array.isArray(data['pettyCashTransactions.json']) ? data['pettyCashTransactions.json'].length : 0;
    report.counts.dayClosings = Array.isArray(data['dayClosings.json']) ? data['dayClosings.json'].length : 0;
    report.counts.calculator = Array.isArray(data['calculatorHistory.json']) ? data['calculatorHistory.json'].length : 0;
    report.counts.users = Array.isArray(data['users.json']) ? data['users.json'].length : 0;

    // Check unique product IDs
    const activeProductIds = new Set();
    for (const p of data['products.json']) {
        if (activeProductIds.has(p.id)) {
            report.errors.push(`Duplicate product ID detected in products.json: ${p.id}`);
            report.valid = false;
        }
        activeProductIds.add(p.id);
    }

    // Check customer IDs
    const customerIds = new Set();
    for (const c of data['customers.json']) {
        customerIds.add(c.id);
    }

    // Group sales into receipts and calculate sums
    const receipts = {};
    let totalGross = 0;
    let sumSubtotal = 0;
    let sumItemDiscount = 0;
    let sumTaxable = 0;
    let sumCgst = 0;
    let sumSgst = 0;
    let sumIgst = 0;
    let sumTax = 0;
    let creditTotal = 0;

    for (const s of data['sales.json']) {
        const r = s.receiptNumber || String(s.id);
        if (!receipts[r]) {
            receipts[r] = [];
        }
        receipts[r].push(s);
        
        const rowTotal = s.total || 0;
        totalGross += rowTotal;
        sumSubtotal += (s.subtotal !== undefined ? s.subtotal : rowTotal);
        sumItemDiscount += (s.itemDiscount || 0);
        sumTaxable += (s.taxableValue || 0);
        sumCgst += (s.cgst || 0);
        sumSgst += (s.sgst || 0);
        sumIgst += (s.igst || 0);
        sumTax += (s.totalTax || 0);

        if (s.paymentMethod === 'credit' || s.paymentStatus === 'unpaid') {
            creditTotal += rowTotal;
        }

        // Check product reference
        if (s.productId && !activeProductIds.has(s.productId)) {
            report.warnings.push(`Sale #${r} item references deleted product ID ${s.productId} ('${s.productName}'). Handled safely via source_product_id.`);
        }

        // Check customer reference
        if (s.customerId && s.customerId.trim() !== '' && !customerIds.has(s.customerId)) {
            report.errors.push(`Sale #${r} references non-existent customer ID ${s.customerId}.`);
            report.valid = false;
        }
    }

    report.counts.distinctSales = Object.keys(receipts).length;
    report.financialTotals.totalGrossSales = Math.round(totalGross * 100) / 100;
    report.financialTotals.itemDiscounts = Math.round(sumItemDiscount * 100) / 100;
    report.financialTotals.taxableValue = Math.round(sumTaxable * 100) / 100;
    report.financialTotals.cgst = Math.round(sumCgst * 100) / 100;
    report.financialTotals.sgst = Math.round(sumSgst * 100) / 100;
    report.financialTotals.igst = Math.round(sumIgst * 100) / 100;
    report.financialTotals.totalTax = Math.round(sumTax * 100) / 100;
    report.financialTotals.creditSalesTotal = Math.round(creditTotal * 100) / 100;

    // Stock movements audit
    for (const sm of data['stockHistory.json']) {
        if (sm.productId && !activeProductIds.has(sm.productId)) {
            report.warnings.push(`Stock movement references deleted product ID ${sm.productId} ('${sm.productName}'). Handled safely via source_product_id.`);
        }
    }

    return { report, receipts, activeProductIds };
}

/**
 * Safely remove newly created database file and any SQLite sidecars (-wal, -shm)
 */
function safelyCleanupTarget(targetDbPath, createdByUs) {
    if (!createdByUs || !targetDbPath) return;
    const sidecars = [targetDbPath, `${targetDbPath}-wal`, `${targetDbPath}-shm`];
    for (const file of sidecars) {
        if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
            } catch (_) {}
        }
    }
}

/**
 * Execute atomic migration into a new target database file
 */
async function executeMigration({ sourceDir, targetDbPath, adminPassword, isDryRun = false, testFailure = null }) {
    if (!sourceDir || !fs.existsSync(sourceDir)) {
        throw new Error(`Source folder does not exist: ${sourceDir}`);
    }
    if (!targetDbPath) {
        throw new Error('Explicit target database path is required.');
    }
    if (fs.existsSync(targetDbPath)) {
        throw new Error(`Safety violation: Target database file already exists at ${targetDbPath}. Overwrite refused.`);
    }

    const data = readSourceJsonFiles(sourceDir);
    const { report, receipts, activeProductIds } = runPreflightAudit(data);

    if (isDryRun) {
        return {
            mode: 'DRY_RUN',
            success: report.valid,
            report
        };
    }

    if (!report.valid) {
        throw new Error(`Pre-flight validation failed: ${report.errors.join('; ')}`);
    }

    if (!adminPassword || typeof adminPassword !== 'string' || adminPassword.length < 8) {
        throw new Error('A secure administrator password (minimum 8 characters) is required.');
    }

    // Pre-derive admin salt and scrypt hash BEFORE opening database transaction
    const adminSalt = generateSalt();
    const adminPasswordHash = await hashPassword(adminPassword, adminSalt);

    // Ensure target directory exists
    fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });

    let createdByUs = false;
    let db = null;
    let migrationRunId = 'mig_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

    try {
        db = new Database(targetDbPath);
        createdByUs = true;

        // Initialize schema DDL matching database.js
        initializeSchema(db);

        // Perform 100% of the inserts in ONE ATOMIC TRANSACTION
        const atomicTransaction = db.transaction(() => {
            // 1. Categories
            const insertCategory = db.prepare('INSERT INTO categories (name, is_active) VALUES (?, ?)');
            for (const cat of data['masterCategories.json']) {
                insertCategory.run(cat.name, cat.active ? 1 : 0);
            }

            // 2. Units
            const insertUnit = db.prepare('INSERT INTO units (name, is_active) VALUES (?, ?)');
            for (const u of data['masterUnits.json']) {
                insertUnit.run(u.name, u.active ? 1 : 0);
            }

            // 3. Customers
            const insertCustomer = db.prepare(`
                INSERT INTO customers (id, name, phone, email, gstin, address, state, country, notes, opening_balance, balance)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const c of data['customers.json']) {
                const opBal = c.openingBalance != null ? c.openingBalance : 0;
                insertCustomer.run(
                    c.id,
                    c.name,
                    c.phone || null,
                    c.email || null,
                    c.gstin || null,
                    c.address || null,
                    c.state || null,
                    c.country || 'INDIA',
                    c.notes || null,
                    opBal,
                    opBal
                );
            }

            // 4. Suppliers
            const insertSupplier = db.prepare(`
                INSERT INTO suppliers (id, name, phone, email, gstin, address, state, balance)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const s of data['suppliers.json']) {
                const opBal = s.openingBalance != null ? s.openingBalance : 0;
                insertSupplier.run(
                    s.id,
                    s.name,
                    s.phone || null,
                    s.email || null,
                    s.gstin || null,
                    s.address || null,
                    s.state || null,
                    opBal
                );
            }

            // 5. Products and Primary Default Variant
            const insertProduct = db.prepare(`
                INSERT INTO products (id, name, barcode, category, unit, price, cost_price, stock, min_stock, description, supplier_text, pack_sizes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const insertVariant = db.prepare(`
                INSERT INTO product_variants (product_id, variant_name, legacy_variant_id, sku, barcode, buying_price, selling_price, stock)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const defaultVariantByProduct = {};

            for (const p of data['products.json']) {
                insertProduct.run(
                    p.id,
                    p.name,
                    p.barcode || null,
                    p.category || null,
                    p.unit || null,
                    p.price || 0,
                    p.costPrice || 0,
                    p.stock || 0,
                    p.minStock || 0,
                    p.description || null,
                    p.supplier || null,
                    p.packSizes ? JSON.stringify(p.packSizes) : null
                );

                if (Array.isArray(p.variants) && p.variants.length > 0) {
                    for (let i = 0; i < p.variants.length; i++) {
                        const v = p.variants[i];
                        const varResult = insertVariant.run(
                            p.id,
                            v.variantName || ('Variant ' + (i + 1)),
                            v.id || null,
                            v.sku || null,
                            v.barcode || null,
                            v.buyingPrice || 0,
                            v.sellingPrice != null ? v.sellingPrice : (p.price || 0),
                            v.stock != null ? v.stock : 0
                        );
                        if (i === 0) {
                            defaultVariantByProduct[p.id] = varResult.lastInsertRowid;
                        }
                    }
                } else {
                    const varResult = insertVariant.run(
                        p.id,
                        'Default',
                        null,
                        null,
                        p.barcode || null,
                        p.costPrice || 0,
                        p.price || 0,
                        p.stock || 0
                    );
                    defaultVariantByProduct[p.id] = varResult.lastInsertRowid;
                }
            }

            // 6. Sales and Sale Items
            const insertSale = db.prepare(`
                INSERT INTO sales (
                    receipt_number, date, customer_id, customer_type, subtotal, discount,
                    taxable_value, cgst, sgst, igst, total_tax, total, payment_method, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
            `);

            const insertSaleItem = db.prepare(`
                INSERT INTO sale_items (
                    sale_id, product_id, source_product_id, variant_id, product_name, quantity,
                    base_quantity, price, discount, taxable_value, cgst, sgst, igst, total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const [receiptNum, items] of Object.entries(receipts)) {
                const header = items[0];
                const custId = (header.customerId && header.customerId.trim() !== '') ? header.customerId : null;
                const custType = custId ? (header.customerType || 'registered') : 'walk-in';

                // Aggregate values across items
                const subtotal = items.reduce((sum, it) => sum + (it.total || 0), 0);
                const discount = header.discount || 0;
                const taxableValue = items.reduce((sum, it) => sum + (it.taxableValue || 0), 0);
                const cgst = items.reduce((sum, it) => sum + (it.cgst || 0), 0);
                const sgst = items.reduce((sum, it) => sum + (it.sgst || 0), 0);
                const igst = items.reduce((sum, it) => sum + (it.igst || 0), 0);
                const totalTax = cgst + sgst + igst;
                const total = subtotal;

                const saleResult = insertSale.run(
                    receiptNum,
                    header.date,
                    custId,
                    custType,
                    subtotal,
                    discount,
                    taxableValue,
                    cgst,
                    sgst,
                    igst,
                    totalTax,
                    total,
                    header.paymentMethod || 'cash'
                );

                const saleId = saleResult.lastInsertRowid;

                for (const it of items) {
                    const isKnownProduct = activeProductIds.has(it.productId);
                    const variantId = isKnownProduct ? (defaultVariantByProduct[it.productId] || null) : null;

                    insertSaleItem.run(
                        saleId,
                        isKnownProduct ? it.productId : null,
                        it.productId || null,
                        variantId,
                        it.productName,
                        it.quantity || 1,
                        it.baseQuantity || 1,
                        it.price || 0,
                        it.itemDiscount || 0,
                        it.taxableValue || 0,
                        it.cgst || 0,
                        it.sgst || 0,
                        it.igst || 0,
                        it.total || 0
                    );
                }
            }

            // 7. Stock Movements (Preserving reference_id where details reference receipt)
            const insertStock = db.prepare(`
                INSERT INTO stock_movements (product_id, source_product_id, type, quantity, reference_id, date)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            for (const sm of data['stockHistory.json']) {
                const isKnownProduct = activeProductIds.has(sm.productId);
                let refId = null;
                if (sm.details) {
                    const match = sm.details.match(/Receipt:\s*([A-Za-z0-9-]+)/);
                    if (match) {
                        const sRow = db.prepare('SELECT id FROM sales WHERE receipt_number = ?').get(match[1]);
                        if (sRow) refId = sRow.id;
                    }
                }
                insertStock.run(
                    isKnownProduct ? sm.productId : null,
                    sm.productId || null,
                    sm.type || 'adjustment',
                    sm.quantity || 0,
                    refId,
                    sm.date
                );
            }

            // 8. Day Closings
            const insertDayClosing = db.prepare(`
                INSERT INTO day_closings (
                    original_id, date, opening_balance, cash_sales, bank_sales, online_sales,
                    total_sales, expected_balance, actual_balance, difference, notes, denominations_json,
                    status, opening_cash, expected_cash, actual_cash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const dc of data['dayClosings.json']) {
                const dateOnly = String(dc.date).slice(0, 10);
                insertDayClosing.run(
                    dc.id ? String(dc.id) : null,
                    dateOnly,
                    dc.openingCash || 0,
                    dc.cashSales || 0,
                    dc.bankSales || 0,
                    dc.onlineSales || 0,
                    dc.totalSales || 0,
                    dc.expectedCash || 0,
                    dc.actualCash || 0,
                    dc.difference || 0,
                    dc.notes || null,
                    dc.denominations ? JSON.stringify(dc.denominations) : null,
                    dc.status || null,
                    dc.openingCash || 0,
                    dc.expectedCash || 0,
                    dc.actualCash || 0
                );
            }

            // 9. Petty Cash Transactions
            const insertPettyCash = db.prepare(`
                INSERT INTO petty_cash_transactions (
                    id, original_id, type, amount, category, description, account, voucher_no, remarks, date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const pc of data['pettyCashTransactions.json']) {
                insertPettyCash.run(
                    pc.id,
                    String(pc.id),
                    pc.type || 'expense',
                    pc.amount || 0,
                    pc.category || null,
                    pc.description || '',
                    pc.account || 'cash',
                    pc.voucherNo || null,
                    pc.remarks || null,
                    pc.date
                );
            }

            // 10. Calculator History
            const insertCalc = db.prepare(`
                INSERT INTO calculator_history (original_id, date, expression, result)
                VALUES (?, ?, ?, ?)
            `);
            for (const ch of data['calculatorHistory.json']) {
                insertCalc.run(
                    ch.id ? String(ch.id) : null,
                    ch.date,
                    ch.expression,
                    ch.result
                );
            }

            // 11. Settings (STRICT PATTERN-BASED SECRET EXCLUSION)
            const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            for (const [key, val] of Object.entries(data['settings.json'])) {
                if (isSensitiveSettingKey(key)) {
                    continue; // Skip secret / credential variants
                }
                const strVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
                insertSetting.run(key, strVal);
            }
            if (data['pettyCashCategories.json']) {
                insertSetting.run('petty_cash_categories', JSON.stringify(data['pettyCashCategories.json']));
            }
            if (data['negativeChangeCount.json'] !== undefined) {
                insertSetting.run('negative_change_count', String(data['negativeChangeCount.json']));
            }

            if (testFailure === 'FAIL_BEFORE_ADMIN') {
                throw new Error('TEST_INJECTED_FAILURE_BEFORE_ADMIN');
            }

            // 12. Administrator Account (INSIDE TRANSACTION)
            db.prepare(`
                INSERT INTO users (
                    id, name, username, password_hash, salt, hash_algorithm, role, status, permissions_json
                ) VALUES (?, ?, ?, ?, ?, 'scrypt', 'admin', 'active', '["*"]')
            `).run(
                'admin_1',
                'Administrator',
                'admin@example.com',
                adminPasswordHash,
                adminSalt
            );

            if (testFailure === 'FAIL_BEFORE_AUDIT') {
                throw new Error('TEST_INJECTED_FAILURE_BEFORE_AUDIT');
            }

            // 13. Migration Audit Record (INSIDE TRANSACTION matching database.js columns)
            db.prepare(`
                INSERT INTO migration_audit (
                    migration_run_id, source_file, target_table, migration_status, notes
                ) VALUES (?, 'ALL_17_JSON_FILES', 'ALL_TABLES', 'SUCCESS', ?)
            `).run(
                migrationRunId,
                JSON.stringify({
                    file_count: 17,
                    total_sales_amount: report.financialTotals.totalGrossSales,
                    counts: report.counts
                })
            );
        });

        // Execute the single atomic transaction
        atomicTransaction();

        // Post-migration Integrity & Reconciliation Checks
        const pragmaIntegrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
        if (pragmaIntegrity !== 'ok') {
            throw new Error(`Integrity check failed: ${pragmaIntegrity}`);
        }

        const pragmaFk = db.prepare('PRAGMA foreign_key_check').all();
        if (pragmaFk.length > 0) {
            throw new Error(`Foreign key check failed: ${JSON.stringify(pragmaFk)}`);
        }

        // Financial Reconciliation
        const dbTotalRevenue = db.prepare('SELECT sum(total) as rev FROM sale_items').get().rev;
        const roundedDbRev = Math.round(dbTotalRevenue * 100) / 100;
        if (Math.abs(roundedDbRev - report.financialTotals.totalGrossSales) > 0.01) {
            throw new Error(`Revenue reconciliation mismatch: JSON total ₹${report.financialTotals.totalGrossSales} vs SQLite total ₹${roundedDbRev}`);
        }

        db.close();
        db = null;

        return {
            mode: 'EXECUTION',
            success: true,
            migrationRunId,
            targetDbPath,
            reconciliation: {
                totalSalesJson: report.financialTotals.totalGrossSales,
                totalSalesSqlite: roundedDbRev,
                distinctSalesCount: report.counts.distinctSales,
                saleItemsCount: report.counts.salesRawRows,
                productsCount: report.counts.products,
                stockMovementsCount: report.counts.stockMovements,
                creditSalesTotal: report.financialTotals.creditSalesTotal
            }
        };

    } catch (err) {
        if (db) {
            try { db.close(); } catch (_) {}
            db = null;
        }
        safelyCleanupTarget(targetDbPath, createdByUs);
        throw err;
    }
}

// CLI Interactive Wrapper
if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const sourceIdx = args.indexOf('--source');
    const targetIdx = args.indexOf('--target');

    const sourceDir = sourceIdx !== -1 ? args[sourceIdx + 1] : '/Users/log/Documents/OneBook/Data';
    const targetDbPath = targetIdx !== -1 ? args[targetIdx + 1] : null;

    if (!targetDbPath && !dryRun) {
        console.error('Usage: node scripts/migrate-json-to-sqlite.js --target <destination.db> [--source <dataDir>] [--dry-run]');
        process.exit(1);
    }

    if (dryRun) {
        console.log('Running JSON-to-SQLite Pre-flight Audit & Dry Run...');
        console.log('Source:', sourceDir);
        executeMigration({ sourceDir, targetDbPath: targetDbPath || 'dry-run-placeholder.db', isDryRun: true })
            .then(res => {
                console.log('\n--- PRE-FLIGHT AUDIT REPORT ---');
                console.log(JSON.stringify(res.report, null, 2));
                console.log('\nValidation Status:', res.success ? 'PASSED (Ready for migration)' : 'FAILED');
                process.exit(res.success ? 0 : 1);
            })
            .catch(err => {
                console.error('Pre-flight error:', err.message);
                process.exit(1);
            });
    } else {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Enter new secure password for administrator (admin@example.com) [min 8 chars]: ', (password) => {
            rl.close();
            if (!password || password.length < 8) {
                console.error('Error: Administrator password must be at least 8 characters long.');
                process.exit(1);
            }

            console.log('Starting migration to:', targetDbPath);
            executeMigration({ sourceDir, targetDbPath, adminPassword: password })
                .then(res => {
                    console.log('\n--- MIGRATION COMPLETED SUCCESSFULLY ---');
                    console.log(JSON.stringify(res, null, 2));
                    process.exit(0);
                })
                .catch(err => {
                    console.error('\nMigration FAILED and target database was rolled back/deleted:');
                    console.error(err.message);
                    process.exit(1);
                });
        });
    }
}

module.exports = {
    executeMigration,
    runPreflightAudit,
    readSourceJsonFiles,
    safelyCleanupTarget,
    isSensitiveSettingKey,
    initializeSchema
};
