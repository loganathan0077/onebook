/**
 * Test Suite for JSON-to-SQLite Migration Utility (Pre-flight & Validation)
 * Phase 4E.21.C.12
 * 
 * Verifies pre-flight validation and dry-run execution without modifying or creating databases.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { readSourceJsonFiles, runPreflightAudit, executeMigration } = require('../scripts/migrate-json-to-sqlite');

const sourceDir = '/Users/log/Documents/OneBook/Data';

async function runTests() {
    console.log('Running Migration Utility Pre-flight Tests...');

    // Test 1: Read all 17 JSON files
    const data = readSourceJsonFiles(sourceDir);
    assert.strictEqual(Object.keys(data).length, 17, 'Must read exactly 17 JSON files');
    console.log('✔ Test 1: Successfully read all 17 JSON files.');

    // Test 2: Run preflight audit
    const { report, receipts, activeProductIds } = runPreflightAudit(data);
    assert.strictEqual(report.valid, true, 'Preflight audit must pass with valid = true');
    assert.strictEqual(report.counts.categories, 15, 'Must find 15 categories');
    assert.strictEqual(report.counts.units, 17, 'Must find 17 units');
    assert.strictEqual(report.counts.customers, 1, 'Must find 1 customer');
    assert.strictEqual(report.counts.suppliers, 1, 'Must find 1 supplier');
    assert.strictEqual(report.counts.products, 8, 'Must find 8 active products');
    assert.strictEqual(report.counts.distinctSales, 51, 'Must group into 51 distinct sales');
    assert.strictEqual(report.counts.salesRawRows, 64, 'Must find 64 sale items');
    assert.strictEqual(report.counts.stockMovements, 77, 'Must find 77 stock movements');
    assert.strictEqual(report.counts.dayClosings, 1, 'Must find 1 day closing');
    assert.strictEqual(report.counts.pettyCash, 5, 'Must find 5 petty cash transactions');
    assert.strictEqual(report.financialTotals.totalGrossSales, 112092.1, 'Gross sales total must match ₹112,092.10');
    console.log('✔ Test 2: Preflight audit assertions passed.');

    // Test 3: Dry-run execution
    const dryRunRes = await executeMigration({
        sourceDir,
        targetDbPath: '/tmp/nonexistent-dry-run-placeholder.db',
        isDryRun: true
    });
    assert.strictEqual(dryRunRes.mode, 'DRY_RUN', 'Dry run must return DRY_RUN mode');
    assert.strictEqual(dryRunRes.success, true, 'Dry run must report success');
    assert.strictEqual(fs.existsSync('/tmp/nonexistent-dry-run-placeholder.db'), false, 'Dry run must never create database file');
    console.log('✔ Test 3: Dry-run mode executed cleanly without creating any file.');

    // Test 4: Target collision safety guard
    let collisionBlocked = false;
    try {
        await executeMigration({
            sourceDir,
            targetDbPath: '/Users/log/onebook/package.json', // existing file
            adminPassword: 'Password123!',
            isDryRun: false
        });
    } catch (err) {
        if (err.message.includes('Safety violation: Target database file already exists')) {
            collisionBlocked = true;
        }
    }
    assert.strictEqual(collisionBlocked, true, 'Must refuse to overwrite existing file');
    console.log('✔ Test 4: Overwrite refusal guard verified.');

    // Test 5: Password length safety guard
    let passwordBlocked = false;
    try {
        await executeMigration({
            sourceDir,
            targetDbPath: '/tmp/placeholder-db-test-pw.db',
            adminPassword: 'short',
            isDryRun: false
        });
    } catch (err) {
        if (err.message.includes('minimum 8 characters')) {
            passwordBlocked = true;
        }
    }
    assert.strictEqual(passwordBlocked, true, 'Must refuse passwords shorter than 8 chars');
    console.log('✔ Test 5: Short password guard verified.');

    console.log('\nAll 5 Migration Utility Pre-flight Tests PASSED!');
}

runTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
