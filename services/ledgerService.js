// services/ledgerService.js
// Dedicated Customer & Supplier Ledger / Statement of Account Service for OneBook

const dbManager = require('../database');

class LedgerService {

    /**
     * Helper to get local date string YYYY-MM-DD from any date input without timezone drift
     */
    getLocalDateString(val) {
        if (!val) return '';
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
            return val.substring(0, 10);
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /**
     * Compute Date Range for standard presets
     */
    getDateRangeFromPreset(preset, customFrom = null, customTo = null) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth(); // 0-indexed
        const day = today.getDate();

        const format = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dayStr = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dayStr}`;
        };

        const todayStr = format(today);

        if (customFrom || customTo) {
            if (!preset || preset === 'all' || preset === 'custom') {
                return {
                    fromDate: customFrom || '',
                    toDate: customTo || ''
                };
            }
        }

        switch (preset) {
            case 'today':
                return { fromDate: todayStr, toDate: todayStr };

            case 'yesterday': {
                const yest = new Date(today);
                yest.setDate(day - 1);
                const str = format(yest);
                return { fromDate: str, toDate: str };
            }

            case 'this_week': {
                const d = new Date(today);
                const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0
                d.setDate(d.getDate() - dayOfWeek);
                return { fromDate: format(d), toDate: todayStr };
            }

            case 'last_week': {
                const start = new Date(today);
                const dayOfWeek = (start.getDay() + 6) % 7;
                start.setDate(start.getDate() - dayOfWeek - 7);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                return { fromDate: format(start), toDate: format(end) };
            }

            case 'this_month': {
                const start = new Date(year, month, 1);
                const end = new Date(year, month + 1, 0);
                return { fromDate: format(start), toDate: format(end) };
            }

            case 'last_month': {
                const start = new Date(year, month - 1, 1);
                const end = new Date(year, month, 0);
                return { fromDate: format(start), toDate: format(end) };
            }

            case 'last_3_months': {
                const start = new Date(year, month - 3, day);
                return { fromDate: format(start), toDate: todayStr };
            }

            case 'last_6_months': {
                const start = new Date(year, month - 6, day);
                return { fromDate: format(start), toDate: todayStr };
            }

            case 'this_year': {
                // Indian Financial Year: April 1 to March 31
                const fyStartYear = month >= 3 ? year : year - 1;
                const start = new Date(fyStartYear, 3, 1);
                const end = new Date(fyStartYear + 1, 2, 31);
                return { fromDate: format(start), toDate: format(end) };
            }

            case 'last_year': {
                const fyStartYear = (month >= 3 ? year : year - 1) - 1;
                const start = new Date(fyStartYear, 3, 1);
                const end = new Date(fyStartYear + 1, 2, 31);
                return { fromDate: format(start), toDate: format(end) };
            }

            case 'custom':
                return {
                    fromDate: customFrom || '',
                    toDate: customTo || ''
                };

            case 'all':
            default:
                return { fromDate: '', toDate: '' };
        }
    }

    /**
     * Retrieve complete ledger statement for a party (customer or supplier)
     */
    getPartyLedger(partyId, partyType = 'customer', options = {}) {
        if (!dbManager.isDatabaseOpen()) {
            throw new Error('DATABASE_NOT_INITIALIZED');
        }

        const db = dbManager.getDatabase();
        const type = (partyType || 'customer').toLowerCase();
        const isCustomer = type === 'customer';

        // 1. Fetch Party Information
        let party = null;
        const pIdStr = String(partyId !== undefined && partyId !== null ? partyId : '').trim();

        if (isCustomer) {
            let hasCustStatus = false;
            let hasCustOpening = false;
            try {
                const cols = db.prepare('PRAGMA table_info(customers)').all();
                hasCustStatus = cols.some(c => c.name === 'status');
                hasCustOpening = cols.some(c => c.name === 'opening_balance');
            } catch (e) {}

            const statusExpr = hasCustStatus ? "COALESCE(status, 'active') as status" : "'active' as status";
            const openingExpr = hasCustOpening ? "COALESCE(opening_balance, 0) as opening_balance" : "0 as opening_balance";

            party = db.prepare(`
                SELECT id, name, phone, email, gstin, address, state, country, notes,
                       ${statusExpr},
                       ${openingExpr},
                       COALESCE(balance, 0) as balance
                FROM customers
                WHERE id = ? OR CAST(id AS TEXT) = ? OR name = ?
            `).get(partyId, pIdStr, partyId);
        } else {
            let hasSuppOpening = false;
            let hasSuppStatus = false;
            try {
                const cols = db.prepare('PRAGMA table_info(suppliers)').all();
                hasSuppOpening = cols.some(c => c.name === 'opening_balance');
                hasSuppStatus = cols.some(c => c.name === 'status');
            } catch (e) {}

            const statusExpr = hasSuppStatus ? "COALESCE(status, 'active') as status" : "'active' as status";
            const openingExpr = hasSuppOpening ? "COALESCE(opening_balance, 0) as opening_balance" : "0 as opening_balance";

            party = db.prepare(`
                SELECT id, name, phone, email, gstin, address, state,
                       ${statusExpr},
                       ${openingExpr},
                       COALESCE(balance, 0) as balance
                FROM suppliers
                WHERE id = ? OR CAST(id AS TEXT) = ? OR name = ?
            `).get(partyId, pIdStr, partyId);
        }

        if (!party) {
            return {
                success: false,
                error: 'PARTY_NOT_FOUND',
                message: `${isCustomer ? 'Customer' : 'Supplier'} record not found for identifier: ${partyId}`
            };
        }

        // 2. Resolve Date Range
        const preset = options.preset || 'all';
        const dateRange = this.getDateRangeFromPreset(preset, options.fromDate, options.toDate);
        const fromDateStr = dateRange.fromDate;
        const toDateStr = dateRange.toDate;

        // 3. Fetch Transactions strictly from SQLite
        const rawEntries = [];
        const canonicalId = party.id;
        const partyName = party.name;

        if (isCustomer) {
            // A. Credit Sales
            // Cash sales where payment_method != 'credit' AND outstanding_amount <= 0.009 AND payment_status == 'fully_paid' are pure cash sales and do NOT affect customer receivable
            const sales = db.prepare(`
                SELECT id, receipt_number, date, total, amount_paid, outstanding_amount,
                       payment_method, payment_status, created_at
                FROM sales
                WHERE (customer_id = ? OR (customer_id IS NULL AND customer_name = ?))
                  AND status != 'CANCELLED'
                  AND (payment_method = 'credit' OR outstanding_amount > 0.009 OR payment_status != 'fully_paid')
            `).all(canonicalId, partyName);

            // B. Customer Payments
            const payments = db.prepare(`
                SELECT id, sale_id, amount, method, reference, notes, date, status
                FROM payments
                WHERE (customer_id = ? OR customer_id = ?)
                  AND status != 'CANCELLED'
            `).all(canonicalId, partyName);

            // Process Sales
            for (const sale of sales) {
                const saleTotal = parseFloat(sale.total) || 0;
                const saleDate = sale.date || sale.created_at;
                const receiptNo = sale.receipt_number || ('INV-' + sale.id);

                // Add Credit Sale Invoice Entry (Debit to Customer)
                rawEntries.push({
                    id: 'sale_' + sale.id,
                    dbId: sale.id,
                    refId: sale.id,
                    refType: 'sale',
                    date: saleDate,
                    dateStr: this.getLocalDateString(saleDate),
                    type: 'Credit Sale',
                    particulars: `Sale Invoice #${receiptNo}`,
                    voucherNo: receiptNo,
                    debit: saleTotal,
                    credit: 0
                });

                // Check for upfront downpayment at bill creation not present in payments table
                const linkedPayments = payments.filter(p => p.sale_id === sale.id);
                const linkedPaymentsSum = linkedPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
                const outAmt = parseFloat(sale.outstanding_amount) || 0;
                const upfrontPaid = Math.max(0, parseFloat((saleTotal - outAmt - linkedPaymentsSum).toFixed(2)));

                if (upfrontPaid > 0.009) {
                    rawEntries.push({
                        id: 'sale_upfront_' + sale.id,
                        dbId: sale.id,
                        refId: sale.id,
                        refType: 'sale',
                        date: saleDate,
                        dateStr: this.getLocalDateString(saleDate),
                        type: 'Customer Receipt',
                        particulars: `Upfront Payment (${(sale.payment_method || 'CASH').toUpperCase()}) - Invoice #${receiptNo}`,
                        voucherNo: receiptNo,
                        debit: 0,
                        credit: upfrontPaid
                    });
                }
            }

            // Process Payments
            for (const p of payments) {
                const pDate = p.date || p.created_at;
                const pAmt = parseFloat(p.amount) || 0;
                const methodStr = (p.method || 'CASH').toUpperCase();
                const notesStr = p.notes ? ` - ${p.notes}` : '';

                rawEntries.push({
                    id: 'pay_' + p.id,
                    dbId: p.id,
                    refId: p.id,
                    refType: 'payment',
                    saleId: p.sale_id || null,
                    date: pDate,
                    dateStr: this.getLocalDateString(pDate),
                    type: 'Customer Receipt',
                    particulars: `Payment Received (${methodStr})${notesStr}`,
                    voucherNo: p.reference || ('RCPT-' + p.id),
                    debit: 0,
                    credit: pAmt
                });
            }

        } else {
            // SUPPLIER LEDGER
            // A. Credit Purchases
            const purchases = db.prepare(`
                SELECT id, invoice_number, date, total, amount_paid, outstanding_amount,
                       payment_method, payment_status, created_at
                FROM purchases
                WHERE (supplier_id = ? OR supplier_id = ?)
                  AND status != 'CANCELLED'
                  AND (payment_method = 'credit' OR outstanding_amount > 0.009 OR payment_status != 'fully_paid')
            `).all(canonicalId, partyName);

            // B. Supplier Payments
            const partyPayments = db.prepare(`
                SELECT id, purchase_id, amount, method, reference, notes, date, status
                FROM party_payments
                WHERE (supplier_id = ? OR supplier_id = ?)
                  AND status != 'CANCELLED'
            `).all(canonicalId, partyName);

            // Process Purchases
            for (const pc of purchases) {
                const pcTotal = parseFloat(pc.total) || 0;
                const pcDate = pc.date || pc.created_at;
                const invNo = pc.invoice_number || ('PUR-' + pc.id);

                // Purchase Bill: Credit to Supplier
                rawEntries.push({
                    id: 'pur_' + pc.id,
                    dbId: pc.id,
                    refId: pc.id,
                    refType: 'purchase',
                    date: pcDate,
                    dateStr: this.getLocalDateString(pcDate),
                    type: 'Purchase Bill',
                    particulars: `Purchase Bill #${invNo}`,
                    voucherNo: invNo,
                    debit: 0,
                    credit: pcTotal
                });

                // Check upfront payment
                const linkedPayments = partyPayments.filter(p => p.purchase_id === pc.id);
                const linkedPaymentsSum = linkedPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
                const outAmt = parseFloat(pc.outstanding_amount) || 0;
                const upfrontPaid = Math.max(0, parseFloat((pcTotal - outAmt - linkedPaymentsSum).toFixed(2)));

                if (upfrontPaid > 0.009) {
                    rawEntries.push({
                        id: 'pur_upfront_' + pc.id,
                        dbId: pc.id,
                        refId: pc.id,
                        refType: 'purchase',
                        date: pcDate,
                        dateStr: this.getLocalDateString(pcDate),
                        type: 'Supplier Payment',
                        particulars: `Upfront Payment (${(pc.payment_method || 'CASH').toUpperCase()}) - Bill #${invNo}`,
                        voucherNo: invNo,
                        debit: upfrontPaid,
                        credit: 0
                    });
                }
            }

            // Process Supplier Payments
            for (const p of partyPayments) {
                const pDate = p.date || p.created_at;
                const pAmt = parseFloat(p.amount) || 0;
                const methodStr = (p.method || 'CASH').toUpperCase();
                const notesStr = p.notes ? ` - ${p.notes}` : '';

                // Payment Made: Debit to Supplier
                rawEntries.push({
                    id: 'ppay_' + p.id,
                    dbId: p.id,
                    refId: p.id,
                    refType: 'party_payment',
                    purchaseId: p.purchase_id || null,
                    date: pDate,
                    dateStr: this.getLocalDateString(pDate),
                    type: 'Supplier Payment',
                    particulars: `Payment Made (${methodStr})${notesStr}`,
                    voucherNo: p.reference || ('VPAY-' + p.id),
                    debit: pAmt,
                    credit: 0
                });
            }
        }

        // 4. Stable Chronological Sorting
        rawEntries.sort((a, b) => {
            // Compare calendar date strings (YYYY-MM-DD)
            const dateCmp = (a.dateStr || '').localeCompare(b.dateStr || '');
            if (dateCmp !== 0) return dateCmp;

            // On the same calendar day:
            // Check if one entry is an invoice and the other is a payment linked to that same invoice
            const invA = a.saleId || a.purchaseId || (a.refType === 'sale' || a.refType === 'purchase' ? a.refId : null);
            const invB = b.saleId || b.purchaseId || (b.refType === 'sale' || b.refType === 'purchase' ? b.refId : null);
            if (invA && invB && invA !== invB) {
                return Number(invA) - Number(invB);
            }

            // Invoice/Bill must always precede payment on the same transaction or day
            const isBillA = a.type === 'Credit Sale' || a.type === 'Purchase Bill';
            const isBillB = b.type === 'Credit Sale' || b.type === 'Purchase Bill';
            if (isBillA && !isBillB) return -1;
            if (!isBillA && isBillB) return 1;

            // Secondary: compare full timestamp if both have specific non-midnight time
            const timeA = new Date(a.date).getTime() || 0;
            const timeB = new Date(b.date).getTime() || 0;
            if (timeA !== timeB) return timeA - timeB;

            return (a.dbId || 0) - (b.dbId || 0);
        });

        // 5. Partition by Date Filter and Calculate Balances
        const masterOpeningBalance = parseFloat(party.opening_balance) || 0;

        let periodOpeningBalance = masterOpeningBalance;
        const periodTransactions = [];

        for (const entry of rawEntries) {
            const entryDate = entry.dateStr;

            // If there is a fromDate and entry is strictly before fromDate, accumulate into periodOpeningBalance
            if (fromDateStr && entryDate < fromDateStr) {
                if (isCustomer) {
                    periodOpeningBalance += (entry.debit - entry.credit);
                } else {
                    periodOpeningBalance += (entry.credit - entry.debit);
                }
                continue;
            }

            // If there is a toDate and entry is strictly after toDate, exclude from period
            if (toDateStr && entryDate > toDateStr) {
                continue;
            }

            periodTransactions.push(entry);
        }

        periodOpeningBalance = parseFloat(periodOpeningBalance.toFixed(2));

        // 6. Compute Running Balance for Period Transactions
        let currentRunningBalance = periodOpeningBalance;
        let totalDebit = 0;
        let totalCredit = 0;

        for (const entry of periodTransactions) {
            totalDebit += entry.debit;
            totalCredit += entry.credit;

            if (isCustomer) {
                currentRunningBalance += (entry.debit - entry.credit);
                entry.runningBalance = parseFloat(currentRunningBalance.toFixed(2));
                entry.balanceType = currentRunningBalance >= 0 ? 'Dr' : 'Cr';
            } else {
                currentRunningBalance += (entry.credit - entry.debit);
                entry.runningBalance = parseFloat(currentRunningBalance.toFixed(2));
                entry.balanceType = currentRunningBalance >= 0 ? 'Cr' : 'Dr';
            }
        }

        totalDebit = parseFloat(totalDebit.toFixed(2));
        totalCredit = parseFloat(totalCredit.toFixed(2));
        const closingBalance = parseFloat(currentRunningBalance.toFixed(2));

        // Determine balance indicators
        const openingBalanceType = isCustomer
            ? (periodOpeningBalance >= 0 ? 'Dr' : 'Cr')
            : (periodOpeningBalance >= 0 ? 'Cr' : 'Dr');

        const closingBalanceType = isCustomer
            ? (closingBalance >= 0 ? 'Dr' : 'Cr')
            : (closingBalance >= 0 ? 'Cr' : 'Dr');

        // Fetch company details for header export
        let companyProfile = { businessName: 'OneBook Company' };
        try {
            const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('businessName', 'tagline', 'phone', 'email', 'gstin', 'address', 'logo')").all();
            for (const row of settingsRows) {
                companyProfile[row.key] = row.value;
            }
        } catch (e) {}

        return {
            success: true,
            party: {
                id: party.id,
                name: party.name,
                phone: (party.phone && String(party.phone).trim()) ? party.phone : '-',
                email: (party.email && String(party.email).trim()) ? party.email : '-',
                gstin: (party.gstin && String(party.gstin).trim()) ? party.gstin : '-',
                address: (party.address && String(party.address).trim()) ? party.address : '-',
                state: (party.state && String(party.state).trim()) ? party.state : '-',
                status: party.status ? (String(party.status).charAt(0).toUpperCase() + String(party.status).slice(1)) : 'Active',
                accountType: isCustomer ? 'Customer' : 'Supplier',
                masterOpeningBalance
            },
            company: companyProfile,
            period: {
                preset,
                fromDate: fromDateStr,
                toDate: toDateStr,
                displayText: this.formatPeriodDisplay(preset, fromDateStr, toDateStr)
            },
            summary: {
                openingBalance: Math.abs(periodOpeningBalance),
                rawOpeningBalance: periodOpeningBalance,
                openingBalanceType,
                totalDebit,
                totalCredit,
                closingBalance: Math.abs(closingBalance),
                rawClosingBalance: closingBalance,
                closingBalanceType,
                transactionCount: periodTransactions.length
            },
            // Convenience accessors
            openingBalance: Math.abs(periodOpeningBalance),
            openingBalanceType,
            totalDebit,
            totalCredit,
            closingBalance: Math.abs(closingBalance),
            closingBalanceType,
            transactions: periodTransactions
        };
    }

    formatPeriodDisplay(preset, fromDate, toDate) {
        if (preset === 'all' || (!fromDate && !toDate)) return 'All Time';
        if (fromDate && toDate && fromDate === toDate) return `Date: ${fromDate}`;
        if (fromDate && toDate) return `${fromDate} to ${toDate}`;
        if (fromDate) return `From ${fromDate}`;
        if (toDate) return `Up to ${toDate}`;
        return 'All Time';
    }
}

module.exports = new LedgerService();
