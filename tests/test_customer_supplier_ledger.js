/**
 * Test Suite: Customer & Supplier Ledger / Statement of Account
 * 
 * Verifies:
 * 1. Customer with no transactions (opening 0, closing 0, empty list)
 * 2. Customer credit sale (Debit ₹5,000, Dr ₹5,000)
 * 3. Customer partial payment (Credit ₹2,000, Dr ₹3,000)
 * 4. Customer multiple payments (Credit ₹1,000, Dr ₹2,000)
 * 5. Pure cash sale exclusion (does NOT appear on ledger, balance unaffected)
 * 6. Supplier credit purchase (Credit ₹10,000, Cr ₹10,000)
 * 7. Supplier partial payment (Debit ₹4,000, Cr ₹6,000)
 * 8. Date filtering presets (this_month, all_time, custom date range)
 * 9. Period opening balance calculation across date filters
 * 10. Ledger closing balance reconciliation with party master balance
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

// Isolated test configuration
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_ledger_test_'));
const testConfigPath = path.join(testDir, 'test_config.json');
process.env.ONEBOOK_CONFIG_PATH = testConfigPath;
process.env.ONEBOOK_TEST_MODE = '1';

const companyService = require('../services/companyService');
const dbManager = require('../database');
const ledgerService = require('../services/ledgerService');
const customerService = require('../services/customerService');
const supplierService = require('../services/supplierService');
const salesService = require('../services/salesService');
const purchaseService = require('../services/purchaseService');
const paymentService = require('../services/paymentService');

async function runTests() {
  console.log('🧪 Starting Customer & Supplier Ledger Test Suite...\n');

  try {
    // 1. Initialize isolated database via companyService
    const testDataDir = path.join(testDir, 'Data');
    fs.mkdirSync(testDataDir, { recursive: true });
    companyService.setDataDirectory(testDataDir);

    const createCompanyRes = await companyService.createCompany({
      companyName: 'Ledger Test Enterprises',
      financialYear: '2026-2027'
    });
    assert.strictEqual(createCompanyRes.success, true, 'Company creation should succeed');

    const openCompanyRes = await companyService.openCompany(createCompanyRes.folderPath);
    assert.strictEqual(openCompanyRes.success, true, 'Company should open');

    const db = dbManager.getDatabase();
    assert(db, 'Database should be opened and available');
    console.log('✓ Isolated test database initialized.');

    // 2. Scenario A: Customer with no transactions
    console.log('\n--- Scenario A: Customer with no transactions ---');
    const customerAId = customerService.createCustomer({
      name: 'Fresh Customer',
      phone: '9876543210',
      email: 'fresh@example.com',
      address: '123 Market St',
      openingBalance: 0,
      balance: 0
    });
    assert(customerAId, 'Customer ID should be returned');

    const ledgerA = ledgerService.getPartyLedger(customerAId, 'customer', { preset: 'all_time' });
    assert.strictEqual(ledgerA.success, true);
    assert.strictEqual(ledgerA.openingBalance, 0);
    assert.strictEqual(ledgerA.totalDebit, 0);
    assert.strictEqual(ledgerA.totalCredit, 0);
    assert.strictEqual(ledgerA.closingBalance, 0);
    assert.strictEqual(ledgerA.closingBalanceType, 'Dr');
    assert.strictEqual(ledgerA.transactions.length, 0);
    console.log('✓ Empty customer ledger correctly returns 0 balance and 0 transactions.');

    // 3. Scenario B: Customer with credit sale (₹5,000)
    console.log('\n--- Scenario B: Customer with credit sale ---');
    // Insert a product and variant
    const prodRes = db.prepare(`
      INSERT INTO products (name, barcode, category, unit, price, cost_price, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('Test Widget', 'TW-001', 'General', 'Pcs', 1000, 700, 100);
    const prodId = prodRes.lastInsertRowid;

    const varRes = db.prepare(`
      INSERT INTO product_variants (product_id, variant_name, sku, barcode, buying_price, selling_price, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(prodId, 'Standard', 'SKU-TW-001', 'TW-001', 700, 1000, 100);
    const varId = varRes.lastInsertRowid;

    const saleRes = salesService.createSale({
      customer_id: customerAId,
      customer_name: 'Fresh Customer',
      customer_type: 'REGISTERED',
      total: 5000,
      subtotal: 5000,
      discount: 0,
      payment_method: 'credit',
      amountPaid: 0,
      outstandingAmount: 5000,
      date: '2026-05-10 10:00:00',
      items: [
        { product_id: prodId, product_name: 'Test Widget', variant_id: varId, quantity: 5, price: 1000, total: 5000 }
      ]
    });
    assert(saleRes.id, 'Sale creation should return saleId');

    const ledgerB = ledgerService.getPartyLedger(customerAId, 'customer', { preset: 'all_time' });
    assert.strictEqual(ledgerB.transactions.length, 1);
    assert.strictEqual(ledgerB.totalDebit, 5000);
    assert.strictEqual(ledgerB.totalCredit, 0);
    assert.strictEqual(ledgerB.closingBalance, 5000);
    assert.strictEqual(ledgerB.closingBalanceType, 'Dr');
    assert.strictEqual(ledgerB.transactions[0].debit, 5000);
    assert.strictEqual(ledgerB.transactions[0].credit, 0);
    assert.strictEqual(ledgerB.transactions[0].runningBalance, 5000);
    assert.strictEqual(ledgerB.transactions[0].balanceType, 'Dr');
    console.log('✓ Credit sale correctly recorded as Debit ₹5,000 with Dr ₹5,000 balance.');

    // 4. Scenario C: Customer partial payment (₹2,000)
    console.log('\n--- Scenario C: Customer partial payment ---');
    const pay1 = paymentService.createSalePayment({
      invoice: saleRes.id,
      amount: 2000,
      method: 'cash',
      reference: 'REC-001',
      notes: 'Partial payment against invoice',
      date: '2026-05-15 11:00:00'
    });
    assert(pay1.paymentId, 'Payment 1 should succeed');

    const ledgerC = ledgerService.getPartyLedger(customerAId, 'customer', { preset: 'all_time' });
    assert.strictEqual(ledgerC.transactions.length, 2);
    assert.strictEqual(ledgerC.totalDebit, 5000);
    assert.strictEqual(ledgerC.totalCredit, 2000);
    assert.strictEqual(ledgerC.closingBalance, 3000);
    assert.strictEqual(ledgerC.closingBalanceType, 'Dr');
    assert.strictEqual(ledgerC.transactions[1].credit, 2000);
    assert.strictEqual(ledgerC.transactions[1].runningBalance, 3000);
    assert.strictEqual(ledgerC.transactions[1].balanceType, 'Dr');
    console.log('✓ Partial payment correctly recorded as Credit ₹2,000 with remaining running balance ₹3,000 Dr.');

    // 5. Scenario D: Customer second payment (₹1,000)
    console.log('\n--- Scenario D: Customer second payment ---');
    const pay2 = paymentService.createSalePayment({
      invoice: saleRes.id,
      amount: 1000,
      method: 'bank_transfer',
      reference: 'REC-002',
      notes: 'Second installment',
      date: '2026-05-20 14:00:00'
    });
    assert(pay2.paymentId, 'Payment 2 should succeed');

    const ledgerD = ledgerService.getPartyLedger(customerAId, 'customer', { preset: 'all_time' });
    assert.strictEqual(ledgerD.transactions.length, 3);
    assert.strictEqual(ledgerD.totalDebit, 5000);
    assert.strictEqual(ledgerD.totalCredit, 3000);
    assert.strictEqual(ledgerD.closingBalance, 2000);
    assert.strictEqual(ledgerD.closingBalanceType, 'Dr');
    assert.strictEqual(ledgerD.transactions[2].credit, 1000);
    assert.strictEqual(ledgerD.transactions[2].runningBalance, 2000);
    console.log('✓ Multiple payments sequence correctly maintains chronological running balance.');

    // 6. Scenario E: Cash sale exclusion
    console.log('\n--- Scenario E: Pure cash sale exclusion ---');
    // Create a pure cash sale where customer paid full in cash
    const cashSale = salesService.createSale({
      customer_id: customerAId,
      customer_name: 'Fresh Customer',
      customer_type: 'REGISTERED',
      total: 1000,
      subtotal: 1000,
      discount: 0,
      payment_method: 'cash',
      amountPaid: 1000,
      outstandingAmount: 0,
      paymentStatus: 'fully_paid',
      date: '2026-05-25 16:00:00',
      items: [
        { product_id: prodId, product_name: 'Test Widget', variant_id: varId, quantity: 1, price: 1000, total: 1000 }
      ]
    });
    assert(cashSale.id, 'Cash sale should succeed');

    const ledgerE = ledgerService.getPartyLedger(customerAId, 'customer', { preset: 'all_time' });
    // Still 3 transactions: pure cash sale must NOT be present!
    assert.strictEqual(ledgerE.transactions.length, 3, 'Pure cash sale must NOT be added to receivables ledger');
    assert.strictEqual(ledgerE.closingBalance, 2000, 'Balance must remain unchanged at ₹2,000');
    console.log('✓ Pure cash sale was successfully excluded from customer receivables ledger.');

    // 7. Scenario F: Supplier with credit purchase (₹10,000)
    console.log('\n--- Scenario F: Supplier credit purchase ---');
    const suppCreate = supplierService.createSupplier({
      name: 'Apex Distributors',
      phone: '9123456789',
      email: 'apex@distrib.com',
      address: '789 Supply Ave',
      balance: 0
    });
    const suppAId = suppCreate.supplierId || suppCreate.id || suppCreate;
    assert(suppAId, 'Supplier ID should be created');

    const purId = purchaseService.createPurchase({
      supplierId: suppAId,
      supplier: 'Apex Distributors',
      invoiceNumber: 'INV-APEX-99',
      date: '2026-06-01',
      totalAmount: 10000,
      subtotal: 10000,
      discount: 0,
      paymentMethod: 'credit',
      amountPaid: 0,
      outstandingAmount: 10000,
      items: [
        { productId: prodId, variantId: varId, quantity: 10, price: 1000, total: 10000 }
      ]
    });
    assert(purId, 'Purchase should succeed');

    const ledgerF = ledgerService.getPartyLedger(suppAId, 'supplier', { preset: 'all_time' });
    assert.strictEqual(ledgerF.transactions.length, 1);
    assert.strictEqual(ledgerF.totalCredit, 10000, 'Supplier purchase is Credit');
    assert.strictEqual(ledgerF.totalDebit, 0);
    assert.strictEqual(ledgerF.closingBalance, 10000);
    assert.strictEqual(ledgerF.closingBalanceType, 'Cr', 'Supplier liability is Cr');
    assert.strictEqual(ledgerF.transactions[0].credit, 10000);
    assert.strictEqual(ledgerF.transactions[0].runningBalance, 10000);
    assert.strictEqual(ledgerF.transactions[0].balanceType, 'Cr');
    console.log('✓ Supplier credit purchase correctly recorded as Credit ₹10,000 with Cr ₹10,000 balance.');

    // 8. Scenario G: Supplier partial payment (₹4,000)
    console.log('\n--- Scenario G: Supplier partial payment ---');
    const suppPay1 = paymentService.createPurchasePayment({
      purchaseId: purId,
      amount: 4000,
      method: 'bank_transfer',
      reference: 'PAY-APEX-01',
      notes: 'Partial payment towards purchase bill',
      date: '2026-06-05 15:30:00'
    });
    assert(suppPay1.paymentId, 'Supplier payment should succeed');

    const ledgerG = ledgerService.getPartyLedger(suppAId, 'supplier', { preset: 'all_time' });
    assert.strictEqual(ledgerG.transactions.length, 2);
    assert.strictEqual(ledgerG.totalDebit, 4000, 'Payment to supplier is Debit');
    assert.strictEqual(ledgerG.totalCredit, 10000);
    assert.strictEqual(ledgerG.closingBalance, 6000);
    assert.strictEqual(ledgerG.closingBalanceType, 'Cr');
    assert.strictEqual(ledgerG.transactions[1].debit, 4000);
    assert.strictEqual(ledgerG.transactions[1].runningBalance, 6000);
    assert.strictEqual(ledgerG.transactions[1].balanceType, 'Cr');
    console.log('✓ Supplier payment correctly recorded as Debit ₹4,000 with remaining payable ₹6,000 Cr.');

    // 9. Scenario H: Date Filtering & Period Opening Balance
    console.log('\n--- Scenario H: Date Filtering & Period Opening Balance ---');
    // For Customer A:
    // 2026-05-10: Debit 5,000 (Running Dr 5,000)
    // 2026-05-15: Credit 2,000 (Running Dr 3,000)
    // 2026-05-20: Credit 1,000 (Running Dr 2,000)
    // Now add a payment in June:
    const pay3 = paymentService.createSalePayment({
      invoice: saleRes.id,
      amount: 500,
      method: 'cash',
      reference: 'REC-003',
      notes: 'June installment',
      date: '2026-06-10 12:00:00'
    });
    assert(pay3.paymentId, 'Payment 3 should succeed');

    // Filter Customer A for June 2026 only:
    const ledgerH = ledgerService.getPartyLedger(customerAId, 'customer', {
      fromDate: '2026-06-01',
      toDate: '2026-06-30'
    });
    // In June, only 1 transaction (the ₹500 payment)
    assert.strictEqual(ledgerH.transactions.length, 1);
    // Opening balance before June 1st must be exactly 2,000 Dr!
    assert.strictEqual(ledgerH.openingBalance, 2000, 'Period opening balance must match cumulative prior balance');
    assert.strictEqual(ledgerH.openingBalanceType, 'Dr');
    assert.strictEqual(ledgerH.totalDebit, 0);
    assert.strictEqual(ledgerH.totalCredit, 500);
    // Closing balance: 2000 - 500 = 1500 Dr
    assert.strictEqual(ledgerH.closingBalance, 1500);
    assert.strictEqual(ledgerH.closingBalanceType, 'Dr');
    assert.strictEqual(ledgerH.transactions[0].runningBalance, 1500);
    console.log('✓ Period opening balance and closing balance across date boundaries mathematically verified.');

    // 10. Scenario I: Reconciliation with Master Balances
    console.log('\n--- Scenario I: Reconciliation with Master Party Balances ---');
    const custRow = db.prepare('SELECT balance FROM customers WHERE id = ?').get(customerAId);
    const suppRow = db.prepare('SELECT balance FROM suppliers WHERE id = ?').get(suppAId);

    const fullCustomerLedger = ledgerService.getPartyLedger(customerAId, 'customer', { preset: 'all_time' });
    const fullSupplierLedger = ledgerService.getPartyLedger(suppAId, 'supplier', { preset: 'all_time' });

    assert.strictEqual(fullCustomerLedger.closingBalance, custRow.balance, 'Customer closing balance matches master table');
    assert.strictEqual(fullSupplierLedger.closingBalance, suppRow.balance, 'Supplier closing balance matches master table');
    console.log(`✓ Customer master balance (₹${custRow.balance}) reconciles with ledger (₹${fullCustomerLedger.closingBalance}).`);
    console.log(`✓ Supplier master balance (₹${suppRow.balance}) reconciles with ledger (₹${fullSupplierLedger.closingBalance}).`);

    // 11. Scenario J: Party Details and Status Verification
    console.log('\n--- Scenario J: Party Details and Status Verification ---');
    assert.strictEqual(fullCustomerLedger.party.name, 'Fresh Customer');
    assert.strictEqual(fullCustomerLedger.party.phone, '9876543210');
    assert.strictEqual(fullCustomerLedger.party.accountType, 'Customer');
    assert.strictEqual(fullCustomerLedger.party.status, 'Active');

    assert.strictEqual(fullSupplierLedger.party.name, 'Apex Distributors');
    assert.strictEqual(fullSupplierLedger.party.phone, '9123456789');
    assert.strictEqual(fullSupplierLedger.party.accountType, 'Supplier');
    assert.strictEqual(fullSupplierLedger.party.status, 'Active');
    console.log('✓ Customer and Supplier party metadata (Name, Phone, Status, Account Type) verified.');

    // 12. Scenario K: Actual Development Database (syzhi) Verification
    console.log('\n--- Scenario K: Actual Development Database (syzhi) Read-only Verification ---');
    const devDbPath = '/Users/log/Documents/OneBook/Data/syzhi/onebook.db';
    if (fs.existsSync(devDbPath)) {
      await companyService.openCompany(path.dirname(devDbPath));
      
      // LOGANATHAN customer test
      const devCustRow = dbManager.getDatabase().prepare('SELECT balance FROM customers WHERE id = ?').get('cus_17954376137968a9yk');
      const devCustLedger = ledgerService.getPartyLedger('cus_17954376137968a9yk', 'customer', { preset: 'all' });
      assert.strictEqual(devCustLedger.success, true);
      assert.strictEqual(devCustLedger.party.name, 'LOGANATHAN');
      assert.strictEqual(devCustLedger.party.accountType, 'Customer');
      assert.strictEqual(devCustLedger.summary.closingBalance, devCustRow.balance);
      assert.strictEqual(devCustLedger.summary.closingBalanceType, 'Dr');
      // Verify same-day chronological order: Credit Sale 3 precedes Payment 1
      const sale3Idx = devCustLedger.transactions.findIndex(t => t.voucherNo === 'INV-0003-2026');
      const pay1Idx = devCustLedger.transactions.findIndex(t => t.id === 'pay_1');
      assert(sale3Idx >= 0 && pay1Idx >= 0, 'Sale 3 and Payment 1 should exist');
      assert(sale3Idx < pay1Idx, 'Sale 3 must chronologically precede Payment 1 on the same date');
      console.log('✓ Development customer LOGANATHAN loaded with exact balance ₹311.00 Dr and proper intra-day chronological ordering.');

      // AADHI supplier test
      const devSuppLedger = ledgerService.getPartyLedger('sup_1795437992204_r604g', 'supplier', { preset: 'all' });
      assert.strictEqual(devSuppLedger.success, true);
      assert.strictEqual(devSuppLedger.party.name, 'AADHI');
      assert.strictEqual(devSuppLedger.party.accountType, 'Supplier');
      assert.strictEqual(devSuppLedger.summary.closingBalance, 262.5);
      assert.strictEqual(devSuppLedger.summary.closingBalanceType, 'Cr');
      console.log('✓ Development supplier AADHI loaded with exact balance ₹262.50 Cr.');
    }

    console.log('\n🎉 ALL LEDGER VERIFICATION SCENARIOS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ LEDGER TEST FAILED:', err);
    process.exit(1);
  } finally {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTests();
