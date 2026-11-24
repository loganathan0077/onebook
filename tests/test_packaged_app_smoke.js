const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const pkgVersion = require('../package.json').version;

console.log('================================================================');
console.log(`🧪 OneBook v${pkgVersion} - Packaged macOS App & ASAR Verification Suite`);
console.log('================================================================');

(async () => {
    const appPath = path.join(__dirname, '..', 'dist', 'mac-arm64', 'OneBook.app');
    const macBin = path.join(appPath, 'Contents', 'MacOS', 'OneBook');
    const asarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar');
    const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
    const dmgPath = path.join(__dirname, '..', 'dist', `OneBook-${pkgVersion}-arm64.dmg`);
    const zipPath = path.join(__dirname, '..', 'dist', `OneBook-${pkgVersion}-arm64-mac.zip`);

    // --- CHECK 1: File Artifacts Exist ---
    console.log('\n--- CHECK 1: Packaged Artifacts Verification ---');
    assert(fs.existsSync(appPath), `Packaged app bundle must exist at ${appPath}`);
    assert(fs.existsSync(macBin), `Executable binary must exist at ${macBin}`);
    assert(fs.existsSync(asarPath), `app.asar must exist at ${asarPath}`);
    assert(fs.existsSync(infoPlistPath), `Info.plist must exist at ${infoPlistPath}`);
    assert(fs.existsSync(dmgPath), `macOS DMG must exist at ${dmgPath}`);
    assert(fs.existsSync(zipPath), `macOS ZIP must exist at ${zipPath}`);

    const dmgSizeMb = (fs.statSync(dmgPath).size / (1024 * 1024)).toFixed(1);
    const zipSizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
    const asarSizeMb = (fs.statSync(asarPath).size / (1024 * 1024)).toFixed(1);

    console.log(`✓ OneBook.app found`);
    console.log(`✓ DMG file found (${dmgSizeMb} MB): ${dmgPath}`);
    console.log(`✓ ZIP file found (${zipSizeMb} MB): ${zipPath}`);
    console.log(`✓ app.asar found (${asarSizeMb} MB): ${asarPath}`);

    // --- CHECK 2: Info.plist Metadata ---
    console.log('\n--- CHECK 2: Bundle Metadata in Info.plist ---');
    const plistContent = execSync(`/usr/libexec/PlistBuddy -c "Print" "${infoPlistPath}"`, { encoding: 'utf8' });
    assert(plistContent.includes('CFBundleDisplayName = OneBook'), 'DisplayName must be OneBook');
    assert(plistContent.includes('CFBundleIdentifier = com.onebook.pos'), 'Identifier must be com.onebook.pos');
    assert(plistContent.includes(`CFBundleShortVersionString = ${pkgVersion}`), `Version string must be ${pkgVersion}`);
    assert(plistContent.includes(`CFBundleVersion = ${pkgVersion}`), `CFBundleVersion must be ${pkgVersion}`);
    console.log(`✓ Info.plist metadata verified: Name=OneBook, ID=com.onebook.pos, Version=${pkgVersion}`);

    // --- CHECK 3: Inspect app.asar File Whitelist & Version ---
    console.log('\n--- CHECK 3: ASAR Extraction & Whitelist Audit ---');
    const tmpExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_mac_asar_test_'));
    const asarCli = path.join(__dirname, '..', 'node_modules', '.bin', 'asar');
    execSync(`"${asarCli}" extract "${asarPath}" "${tmpExtractDir}"`);

    // Verify key files are present
    const expectedFiles = [
        'OneBook.html', 'main.js', 'preload.js', 'login.html', 'license.html',
        'database.js', 'auth.js', 'package.json', 'services/productService.js',
        'services/pettyCashService.js', 'services/updateService.js', 'onebooklogo.png'
    ];
    for (const f of expectedFiles) {
        assert(fs.existsSync(path.join(tmpExtractDir, f)), `File ${f} must be present in packaged app.asar`);
    }

    // Verify package.json inside ASAR
    const packagedPkg = JSON.parse(fs.readFileSync(path.join(tmpExtractDir, 'package.json'), 'utf8'));
    assert.strictEqual(packagedPkg.version, pkgVersion, `package.json in ASAR must have version ${pkgVersion}`);
    assert.strictEqual(packagedPkg.productName, 'OneBook', 'package.json in ASAR must have productName OneBook');
    console.log(`✓ Packaged package.json version verified: ${packagedPkg.version}`);

    // Verify test files are EXCLUDED from ASAR
    assert(!fs.existsSync(path.join(tmpExtractDir, 'tests')), 'tests/ directory must NOT be packaged in app.asar');
    assert(!fs.existsSync(path.join(tmpExtractDir, 'onebook.db')), 'Database files must NOT be packaged in app.asar');
    console.log('✓ Sensitive and development files confirmed EXCLUDED from app.asar');

    // Clean up extract dir
    fs.rmSync(tmpExtractDir, { recursive: true, force: true });

    // --- CHECK 4: Native better-sqlite3 Execution inside Packaged App ---
    console.log('\n--- CHECK 4: Native better-sqlite3 Execution inside Packaged App ---');
    const check4ScriptPath = path.join(os.tmpdir(), `check4_${Date.now()}.js`);
    fs.writeFileSync(check4ScriptPath, [
        "const Database = require('" + path.join(asarPath, 'node_modules', 'better-sqlite3') + "');",
        "const db = new Database(':memory:');",
        "db.exec(\"CREATE TABLE test (id INT, val TEXT); INSERT INTO test VALUES (1, 'Packaged SQLite OK');\");",
        "const row = db.prepare('SELECT val FROM test WHERE id = 1').get();",
        "if (row && row.val === 'Packaged SQLite OK') {",
        "    console.log('PACKAGE_TEST_SQLITE_SUCCESS');",
        "} else {",
        "    process.exit(1);",
        "}"
    ].join('\n'), 'utf8');

    const sqliteCheckOut = execSync(`"${macBin}" "${check4ScriptPath}"`, {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        encoding: 'utf8'
    });
    fs.unlinkSync(check4ScriptPath);
    assert(sqliteCheckOut.includes('PACKAGE_TEST_SQLITE_SUCCESS'), 'better-sqlite3 must run successfully inside packaged app');
    console.log('✓ better-sqlite3 native driver loads and executes queries inside OneBook.app binary');

    // --- CHECK 5: End-to-End Database & Business Flow in Packaged Binary ---
    console.log('\n--- CHECK 5: Isolated Test DB Operations in Packaged App ---');
    const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_packaged_e2e_'));
    const isolatedDbPath = path.join(isolatedDir, 'isolated_test.db');
    // Copy existing prod db to isolated location
    fs.copyFileSync('/Users/log/Desktop/untitled folder/doodles-store-desktop/OneBook/onebook.db', isolatedDbPath);

    const check5ScriptPath = path.join(isolatedDir, 'check5.js');
    fs.writeFileSync(check5ScriptPath, [
        "const path = require('path');",
        "const asar = '" + asarPath + "';",
        "const dbPath = '" + isolatedDbPath + "';",
        "const dbManager = require(path.join(asar, 'database.js'));",
        "dbManager.initializeDatabase(dbPath);",
        "const db = dbManager.getDatabase();",
        "const verRow = db.prepare(\"SELECT value FROM database_metadata WHERE key = 'application_version'\").get();",
        "console.log('PACKAGED_DB_VERSION:' + (verRow ? verRow.value : 'none'));",
        "const products = db.prepare('SELECT * FROM products').all();",
        "const variants = db.prepare('SELECT * FROM product_variants').all();",
        "console.log('PACKAGED_PRODUCTS_COUNT:' + products.length);",
        "console.log('PACKAGED_VARIANTS_COUNT:' + variants.length);",
        "const productService = require(path.join(asar, 'services', 'productService.js'));",
        "const allProducts = productService.getAll();",
        "console.log('PACKAGED_PRODUCTS_RETRIEVED:' + allProducts.length);",
        "console.log('PACKAGED_PRODUCT_VARIANTS:' + (allProducts[0] ? allProducts[0].variants.length : 0));",
        "dbManager.closeDatabase();",
        "console.log('PACKAGED_E2E_FLOW_SUCCESS');"
    ].join('\n'), 'utf8');

    const flowCheckOut = execSync(`"${macBin}" "${check5ScriptPath}"`, {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        encoding: 'utf8'
    });

    assert(flowCheckOut.includes('PACKAGED_E2E_FLOW_SUCCESS'), 'End-to-end service execution must succeed');
    assert(flowCheckOut.includes('PACKAGED_PRODUCTS_COUNT:1'), 'Product count must match expected');
    assert(flowCheckOut.includes('PACKAGED_VARIANTS_COUNT:2'), 'Variant count must match expected');
    assert(flowCheckOut.includes('PACKAGED_PRODUCTS_RETRIEVED:1'), 'Products retrieved count must match');
    assert(flowCheckOut.includes('PACKAGED_PRODUCT_VARIANTS:2'), 'Product variants count must match');
    console.log('✓ Packaged OneBook.app successfully executed business services on isolated database');

    // Clean up isolated dir
    fs.rmSync(isolatedDir, { recursive: true, force: true });

    console.log('\n================================================================');
    console.log('🎉 ALL PACKAGED MACOS APP CHECKS PASSED (100% VERIFIED)!');
    console.log('================================================================');
})().catch(err => {
    console.error('Fatal Packaged App Test Failure:', err);
    process.exit(1);
});
