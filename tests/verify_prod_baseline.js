const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { app } = require('electron');

const PROD_DB_PATH = '/Users/log/Desktop/untitled folder/doodles-store-desktop/OneBook/onebook.db';

console.log('================================================================');
console.log('🔍 PRODUCTION DATABASE BASELINE CHECK');
console.log('================================================================');

if (!fs.existsSync(PROD_DB_PATH)) {
    console.error('❌ Production database does not exist at:', PROD_DB_PATH);
    process.exit(1);
}

const stats = fs.statSync(PROD_DB_PATH);
const fileBuffer = fs.readFileSync(PROD_DB_PATH);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

console.log('Path:             ', PROD_DB_PATH);
console.log('Size (bytes):     ', stats.size);
console.log('Last Modified:    ', stats.mtime.toISOString());
console.log('SHA-256 Checksum: ', sha256);

const db = new Database(PROD_DB_PATH, { readonly: true });
const integrity = db.pragma('integrity_check');
console.log('Integrity Check:  ', JSON.stringify(integrity));

const tables = [
    'products',
    'product_variants',
    'sales',
    'sale_items',
    'purchases',
    'purchase_items',
    'customers',
    'suppliers',
    'petty_cash_transactions',
    'day_closings',
    'users',
    'user_sessions',
    'categories',
    'units'
];

const counts = {};
for (const t of tables) {
    try {
        counts[t] = db.prepare(`SELECT count(*) as c FROM ${t}`).get().c;
    } catch (e) {
        counts[t] = `TABLE_MISSING (${e.message})`;
    }
}
db.close();

console.log('Record Counts:');
for (const [t, c] of Object.entries(counts)) {
    console.log(`  ${t.padEnd(25)}: ${c}`);
}

const snapshot = {
    path: PROD_DB_PATH,
    size: stats.size,
    mtime: stats.mtime.toISOString(),
    sha256,
    integrity: integrity[0]?.integrity_check || 'unknown',
    counts
};

fs.writeFileSync(path.join(__dirname, 'prod_baseline_snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8');
console.log('\n✓ Baseline recorded to tests/prod_baseline_snapshot.json');
console.log('================================================================');
if (app) app.quit();
process.exit(0);

