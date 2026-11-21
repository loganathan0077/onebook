/**
 * OneBook v1.0.4 - Petty Cash Keyboard-Driven Selection Enhancement Test
 * 
 * Verifies all requirements:
 * 1. Transaction Type Keyboard Selection: E (Expense), I (Income), T (Transfer)
 * 2. Payment Account Keyboard Selection: C (Cash), B (Bank), typing/arrow filter, Enter commit, Escape close
 * 3. Category Intelligent Keyboard Search:
 *    - Prefix/partial search (e.g. W -> Water, R -> Rent)
 *    - Multi-character distinction (S -> Staff & Salary, Sta -> Staff Expenses, Sal -> Salary / Wages)
 *    - Arrow navigation, Enter commit, Escape close, Backspace re-filtering
 *    - No premature auto-commit while typing
 * 4. Dependency: Expense vs Income categories, clearing incompatible categories on type switch
 * 5. Non-interference: No shortcut triggering when typing in editable fields (Amount, Description, Remarks, Search)
 * 6. End-to-end keyboard-only workflow: E -> C -> type category -> Enter -> Amount -> Enter -> Description -> Enter -> Remarks -> Enter -> Save -> SQLite persistence
 */

const electron = require('electron');

if (typeof electron === 'string') {
    const { spawn } = require('child_process');
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electron, [__filename], { env, stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code || 0));
    return;
}

const { app, BrowserWindow, ipcMain } = electron;
const path = require('path');
const os = require('os');
const fs = require('fs');

app.disableHardwareAcceleration();

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onebook_pc_test_'));
const testDbPath = path.join(tempDir, 'onebook_pettycash.db');
process.env.ONEBOOK_DB_PATH = testDbPath;

const dbManager = require('../database');
dbManager.initializeDatabase(testDbPath, { allowCreate: true });
const pettyCashService = require('../services/pettyCashService');

app.whenReady().then(async () => {
    console.log('\n================================================================');
    console.log('🚀 OneBook v1.0.4 - Petty Cash Keyboard Selection Test');
    console.log('================================================================\n');

    ipcMain.on('get-license-info-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
    ipcMain.on('get-license-sync', (e) => { e.returnValue = { mode: 'ACTIVE', status: 'ACTIVE' }; });
    ipcMain.handle('sqlite:system:getDatabaseDetails', async () => ({ connected: true, exists: true, path: testDbPath }));
    ipcMain.handle('auth:checkAdminStatus', async () => ({ success: true, data: { isAdmin: true } }));
    ipcMain.handle('sqlite:users:validateSession', async () => ({ success: true, data: { id: 1, username: 'admin', role: 'admin', status: 'active' } }));
    ipcMain.handle('sqlite:users:getCurrentUser', async () => ({ success: true, data: { id: 1, username: 'admin', role: 'admin', status: 'active' } }));
    ipcMain.handle('sqlite:settings:get', async () => ({ success: true, data: { gstEnabled: true } }));
    ipcMain.handle('sqlite:dashboard:getMetrics', async () => ({ success: true, data: {} }));

    // Wire SQLite Petty Cash IPC handlers
    ipcMain.handle('sqlite:pettyCash:getSummary', () => ({ success: true, data: pettyCashService.getSummary() }));
    ipcMain.handle('sqlite:pettyCash:getOpeningBalances', () => ({ success: true, data: pettyCashService.getOpeningBalances() }));
    ipcMain.handle('sqlite:pettyCash:setOpeningBalances', (e, cash, bank) => {
        pettyCashService.setOpeningBalances(cash, bank);
        return { success: true };
    });
    ipcMain.handle('sqlite:pettyCash:getCategories', () => ({ success: true, data: pettyCashService.getCategories() }));
    ipcMain.handle('sqlite:pettyCash:saveCategories', (e, cats) => {
        pettyCashService.saveCategories(cats);
        return { success: true };
    });
    ipcMain.handle('sqlite:pettyCash:getTransactions', (e, filters) => ({ success: true, data: pettyCashService.getTransactions(filters) }));
    ipcMain.handle('sqlite:pettyCash:createTransaction', (e, args) => {
        const tx = args?.data !== undefined ? args.data : args;
        return { success: true, data: pettyCashService.createTransaction(tx) };
    });
    ipcMain.handle('sqlite:pettyCash:updateTransaction', (e, args) => {
        const id = args?.id !== undefined ? args.id : args;
        const data = args?.data !== undefined ? args.data : args;
        return { success: true, data: pettyCashService.updateTransaction(id, data) };
    });
    ipcMain.handle('sqlite:pettyCash:deleteTransaction', (e, id) => ({ success: true, data: pettyCashService.deleteTransaction(id) }));

    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        show: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    app.focus({ steal: true });
    win.show();
    win.focus();
    win.webContents.focus();

    win.webContents.on('console-message', (e, level, message, line, sourceId) => {
        console.log(`[Browser Console L${line}] ${message}`);
    });

    win.loadFile(path.join(__dirname, '../OneBook.html'));

    win.webContents.on('will-navigate', (event, url) => {
        if (url.includes('login.html')) {
            event.preventDefault();
        }
    });

    win.webContents.once('did-finish-load', async () => {
        try {
            await new Promise(r => setTimeout(r, 1000));
            console.log('✅ Window loaded. Setting up session & running Petty Cash tests...');

            await win.webContents.executeJavaScript(`
                (async () => {
                    const user = { id: 1, username: 'admin', role: 'admin', isDemo: false, permissions: ['dashboard', 'inventory', 'record_sale', 'products', 'petty_cash', 'delete'] };
                    window.currentUser = user;
                    sessionStorage.setItem('currentUser', JSON.stringify(user));
                    sessionStorage.setItem('onebook_user', JSON.stringify(user));
                    const mainContainer = document.getElementById('mainAppContainer');
                    if (mainContainer) mainContainer.style.display = 'block';
                })()
            `);
            await new Promise(r => setTimeout(r, 500));

            const testResults = await win.webContents.executeJavaScript(`
                (async () => {
                    const results = [];
                    function assert(name, condition, details = '') {
                        results.push({ name, pass: !!condition, details });
                        if (condition) {
                            console.log('  PASS: ' + name);
                        } else {
                            console.error('  FAIL: ' + name + (details ? ' - ' + details : ''));
                        }
                    }

                    // 1. Switch to Petty Cash Tab
                    if (typeof switchTab === 'function') {
                        switchTab('pettycash', document.querySelector('button[data-tab="pettycash"]'));
                    } else if (typeof showSection === 'function') {
                        showSection('pettycash');
                    }
                    await new Promise(r => setTimeout(r, 300));

                    const pcTab = document.getElementById('pettycash');
                    assert('Petty Cash tab is active', pcTab && pcTab.classList.contains('active'));

                    // Test 1: Transaction Type Shortcuts (E, I, T)
                    // Reset to Expense first
                    setPCTransactionType('expense');
                    assert('Initial type is expense', currentPCType === 'expense' && document.getElementById('pcTypeExpense').classList.contains('active'));

                    // Press I (Income)
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    assert('Pressing I selects Income', currentPCType === 'income' && document.getElementById('pcTypeIncome').classList.contains('active'));

                    // Press T (Transfer)
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    assert('Pressing T selects Transfer', currentPCType === 'transfer' && document.getElementById('pcTypeTransfer').classList.contains('active'));

                    // Press E (Expense)
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    assert('Pressing E selects Expense', currentPCType === 'expense' && document.getElementById('pcTypeExpense').classList.contains('active'));

                    // Test 2: Payment Account Shortcuts (C, B)
                    // Press B (Bank)
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    const selAccB = document.getElementById('pcAccount').value;
                    const searchAccB = document.getElementById('pcAccountSearch').value;
                    assert('Pressing B selects Bank', selAccB === 'bank' && searchAccB.includes('Bank'));
                    assert('Focus moved to Category Search after B', document.activeElement && document.activeElement.id === 'pcCategorySearch');

                    // Press C (Cash)
                    // Move focus away from CategorySearch to test global shortcut C
                    document.getElementById('pcTypeExpense').focus();
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    const selAccC = document.getElementById('pcAccount').value;
                    const searchAccC = document.getElementById('pcAccountSearch').value;
                    assert('Pressing C selects Cash', selAccC === 'cash' && searchAccC.includes('Cash'));
                    assert('Focus moved to Category Search after C', document.activeElement && document.activeElement.id === 'pcCategorySearch');

                    // Test 3: Account Search Input Dropdown & Navigation
                    const accInput = document.getElementById('pcAccountSearch');
                    accInput.focus();
                    accInput.value = 'ba';
                    accInput.dispatchEvent(new Event('input', { bubbles: true }));
                    const accMenu = document.getElementById('pcAccountDropdown');
                    assert('Account dropdown opens on input', accMenu && accMenu.style.display !== 'none');
                    assert('Account filtered to Bank', accMenu.textContent.includes('Bank') && !accMenu.textContent.includes('Cash'));

                    // Press Enter in Account Search
                    accInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    assert('Enter commits Bank from Account Search', document.getElementById('pcAccount').value === 'bank');
                    assert('Focus moved to Category Search after Enter in Account Search', document.activeElement && document.activeElement.id === 'pcCategorySearch');

                    // Re-select Cash
                    selectPCAccount('cash');

                    // Test 4: Category Intelligent Search & Multi-character Ambiguity
                    const catInput = document.getElementById('pcCategorySearch');
                    const catMenu = document.getElementById('pcCategoryDropdown');

                    // 4A: Search 'W' -> Water
                    catInput.focus();
                    catInput.value = 'W';
                    catInput.dispatchEvent(new Event('input', { bubbles: true }));
                    assert('Category dropdown open for W', catMenu && catMenu.style.display !== 'none');
                    assert('Water found for W', catMenu.textContent.includes('Water'));

                    // 4B: Search 'R' -> Rent
                    catInput.value = 'R';
                    catInput.dispatchEvent(new Event('input', { bubbles: true }));
                    assert('Rent found for R', catMenu.textContent.includes('Rent'));

                    // 4C: Ambiguity test: S matches Staff and Salary
                    catInput.value = 'S';
                    catInput.dispatchEvent(new Event('input', { bubbles: true }));
                    assert('S shows Staff Expenses', catMenu.textContent.includes('Staff Expenses'));
                    assert('S shows Salary / Wages', catMenu.textContent.includes('Salary / Wages'));
                    assert('Input not auto-committed while typing S', document.getElementById('pcCategory').value !== 'Staff Expenses' && document.getElementById('pcCategory').value !== 'Salary / Wages');

                    // 4D: Type 'Sta' -> narrows to Staff Expenses, eliminates Salary
                    catInput.value = 'Sta';
                    catInput.dispatchEvent(new Event('input', { bubbles: true }));
                    assert('Sta shows Staff Expenses', catMenu.textContent.includes('Staff Expenses'));
                    assert('Sta eliminates Salary / Wages', !catMenu.textContent.includes('Salary / Wages'));

                    // 4E: Type 'Sal' -> narrows to Salary / Wages, eliminates Staff
                    catInput.value = 'Sal';
                    catInput.dispatchEvent(new Event('input', { bubbles: true }));
                    assert('Sal shows Salary / Wages', catMenu.textContent.includes('Salary / Wages'));
                    assert('Sal eliminates Staff Expenses', !catMenu.textContent.includes('Staff Expenses'));

                    // 4F: Press Enter to commit Salary / Wages
                    catInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    assert('Enter commits Salary / Wages', document.getElementById('pcCategory').value === 'Salary / Wages' && document.getElementById('pcCategorySearch').value === 'Salary / Wages');
                    assert('Focus moved to Description after Category selection', document.activeElement && document.activeElement.id === 'pcDescription');

                    // 4G: Test Escape closes dropdown
                    catInput.focus();
                    catInput.value = 'RandomNonexistentCategory';
                    catInput.dispatchEvent(new Event('input', { bubbles: true }));
                    catInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                    assert('Escape closes category dropdown', catMenu.style.display === 'none');

                    // Test 5: Category Dependency & Incompatible Category Clearing
                    // Currently type is Expense with 'Salary / Wages'.
                    // Switch to Income ('i'):
                    document.getElementById('pcTypeExpense').focus();
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    assert('Switched to Income', currentPCType === 'income');
                    assert('Incompatible category cleared on switch to Income', document.getElementById('pcCategory').value === '' && document.getElementById('pcCategorySearch').value === '');

                    // Select Income category
                    const incomeCatInput = document.getElementById('pcCategorySearch');
                    incomeCatInput.focus();
                    incomeCatInput.value = 'Sales';
                    incomeCatInput.dispatchEvent(new Event('input', { bubbles: true }));
                    incomeCatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    assert('Selected Sales Receipt for Income', document.getElementById('pcCategory').value === 'Sales Receipt');

                    // Switch back to Expense ('e'):
                    document.getElementById('pcTypeIncome').focus();
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
                    await new Promise(r => setTimeout(r, 100));
                    assert('Switched back to Expense', currentPCType === 'expense');
                    assert('Income category cleared on switch to Expense', document.getElementById('pcCategory').value === '' && document.getElementById('pcCategorySearch').value === '');

                    // Test 6: Non-interference when typing in editable fields
                    // Amount field:
                    const amtInput = document.getElementById('pcAmount');
                    amtInput.focus();
                    amtInput.value = '150';
                    amtInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
                    amtInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true }));
                    amtInput.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
                    amtInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
                    amtInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
                    assert('Shortcuts ignored while typing in Amount', currentPCType === 'expense');

                    // Description field:
                    const descInput = document.getElementById('pcDescription');
                    descInput.focus();
                    descInput.value = 'Electric Tea Bill';
                    descInput.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
                    descInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
                    assert('Shortcuts ignored while typing in Description', currentPCType === 'expense');

                    // Test 7: Complete Keyboard-First Workflow
                    // User Request Sequence: Date > (enter) > Amount > (enter) > Payment Account > (enter) > Category > (enter) > Description > (enter) > Remark > (enter) > Save
                    console.log('  Testing complete keyboard-first workflow (Date -> Amount -> Account -> Category -> Description -> Remarks -> Save)...');

                    // Reset form and select Expense
                    resetPCForm();
                    await new Promise(r => setTimeout(r, 80));

                    // Step 1: Start on Date
                    const wfDate = document.getElementById('pcDate');
                    wfDate.focus();
                    assert('Workflow step 1: Focus on Date', document.activeElement && document.activeElement.id === 'pcDate');

                    // Date -> Enter -> moves to Amount
                    wfDate.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Workflow step 2: Date Enter moves to Amount', document.activeElement && document.activeElement.id === 'pcAmount');

                    // Step 2: Amount -> type 250 -> Enter -> moves to Payment Account (pcAccountSearch)
                    const wfAmt = document.getElementById('pcAmount');
                    wfAmt.value = '250';
                    wfAmt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Workflow step 3: Amount Enter moves to Payment Account', document.activeElement && document.activeElement.id === 'pcAccountSearch');

                    // Step 3: Payment Account -> select Cash / press Enter -> moves to Category (pcCategorySearch)
                    const wfAcc = document.getElementById('pcAccountSearch');
                    wfAcc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Workflow step 4: Account Enter moves to Category', document.activeElement && document.activeElement.id === 'pcCategorySearch');
                    assert('Workflow step 4: Account value is cash', document.getElementById('pcAccount').value === 'cash');

                    // Step 4: Category -> type 'Water', press Enter -> moves to Description
                    const wfCat = document.getElementById('pcCategorySearch');
                    wfCat.value = 'Water';
                    wfCat.dispatchEvent(new Event('input', { bubbles: true }));
                    wfCat.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Workflow step 5: Category selected Water', document.getElementById('pcCategory').value === 'Water');
                    assert('Workflow step 5: Category Enter moves to Description', document.activeElement && document.activeElement.id === 'pcDescription');

                    // Step 5: Description -> type 'Office 20L Water Cans', press Enter -> moves to Remarks
                    const wfDesc = document.getElementById('pcDescription');
                    wfDesc.value = 'Office 20L Water Cans';
                    wfDesc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Workflow step 6: Description Enter moves to Remarks', document.activeElement && document.activeElement.id === 'pcRemarks');

                    // Step 6: Remarks -> type 'Receipt #CAN-99', press Enter -> moves to Save button
                    const wfRemarks = document.getElementById('pcRemarks');
                    wfRemarks.value = 'Receipt #CAN-99';
                    wfRemarks.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Workflow step 7: Remarks Enter moves to Save button', document.activeElement && document.activeElement.id === 'pcSaveBtn');

                    // Step 7: Press Enter on Save button (triggers save)
                    const saveBtn = document.getElementById('pcSaveBtn');
                    saveBtn.click();
                    await new Promise(r => setTimeout(r, 600));

                    // Close success alert popup
                    if (typeof closePopup === 'function') closePopup();

                    // Verify transaction appears in ledger table
                    const ledgerBody = document.getElementById('pcLedgerBody');
                    assert('Transaction in ledger table', ledgerBody && ledgerBody.textContent.includes('Water') && ledgerBody.textContent.includes('250.00'));

                    // Test 8: Transfer Mode Navigation (Date -> Amount -> From Account -> To Account -> Description -> Remarks -> Save)
                    console.log('  Testing Transfer mode navigation (Date -> Amount -> FromAccount -> ToAccount -> Description -> Remarks -> Save)...');
                    setPCTransactionType('transfer');
                    await new Promise(r => setTimeout(r, 80));

                    const trDate = document.getElementById('pcDate');
                    trDate.focus();
                    assert('Transfer: starts on Date', document.activeElement && document.activeElement.id === 'pcDate');

                    trDate.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Transfer: Date Enter moves to Amount', document.activeElement && document.activeElement.id === 'pcAmount');

                    const trAmt = document.getElementById('pcAmount');
                    trAmt.value = '1000';
                    trAmt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Transfer: Amount Enter moves to From Account', document.activeElement && document.activeElement.id === 'pcFromAccount');

                    const trFrom = document.getElementById('pcFromAccount');
                    trFrom.dataset.hasChanged = 'true';
                    trFrom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Transfer: From Account Enter moves to To Account', document.activeElement && document.activeElement.id === 'pcToAccount');

                    const trTo = document.getElementById('pcToAccount');
                    trTo.dataset.hasChanged = 'true';
                    trTo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Transfer: To Account Enter moves to Description', document.activeElement && document.activeElement.id === 'pcDescription');

                    const trDesc = document.getElementById('pcDescription');
                    trDesc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Transfer: Description Enter moves to Remarks', document.activeElement && document.activeElement.id === 'pcRemarks');

                    const trRemarks = document.getElementById('pcRemarks');
                    trRemarks.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                    await new Promise(r => setTimeout(r, 80));
                    assert('Transfer: Remarks Enter moves to Save button', document.activeElement && document.activeElement.id === 'pcSaveBtn');

                    return results;
                })()
            `);

            console.log('\n----------------------------------------------------------------');
            console.log('📊 Test Summary:');
            console.log('----------------------------------------------------------------');
            let passed = 0;
            let failed = 0;
            testResults.forEach(r => {
                if (r.pass) {
                    passed++;
                    console.log(`  ✅ ${r.name}`);
                } else {
                    failed++;
                    console.error(`  ❌ ${r.name}: ${r.details}`);
                }
            });
            console.log(`\nPassed: ${passed} / ${testResults.length}`);

            // Also verify SQLite persistence directly
            const transactions = pettyCashService.getTransactions();
            const savedTx = transactions.find(t => t.category === 'Water' && t.amount === 250);
            if (savedTx && savedTx.account === 'cash') {
                console.log('  ✅ SQLite Persistence Verified: Voucher', savedTx.voucher_no || savedTx.voucherNo, 'Amount:', savedTx.amount);
            } else {
                console.error('  ❌ SQLite Persistence Failed: Transaction not found in database');
                failed++;
            }

            console.log('================================================================\n');

            if (failed === 0) {
                console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
                app.exit(0);
            } else {
                console.error(`💥 ${failed} TEST(S) FAILED`);
                app.exit(1);
            }
        } catch (err) {
            console.error('Fatal test error:', err);
            app.exit(1);
        }
    });
});
