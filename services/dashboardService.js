const dbManager = require("../database");

class DashboardService {
    getDashboardMetrics(options = {}) {
        const db = dbManager.getDatabase();

        const now = options.now ? new Date(options.now) : new Date();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(todayStart);
        const dayOfWeek = weekStart.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        weekStart.setDate(todayStart.getDate() - diffToMonday);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        const activeSales = db.prepare(`
            SELECT id as saleId, date, subtotal, COALESCE(discount, 0) as discount, total
            FROM sales
            WHERE status != 'CANCELLED'
            ORDER BY date DESC
        `).all();

        let todaySalesAmount = 0;
        let todaySalesCount = 0;
        let weekSalesAmount = 0;
        let weekSalesCount = 0;
        let monthSalesAmount = 0;
        let monthSalesCount = 0;

        activeSales.forEach(sale => {
            const saleDate = new Date(sale.date);
            if (isNaN(saleDate.getTime())) return;

            const netAmount = (sale.subtotal !== null && sale.subtotal !== undefined)
                ? (sale.subtotal - sale.discount)
                : sale.total;

            if (saleDate >= todayStart && saleDate <= todayEnd) {
                todaySalesAmount += netAmount;
                todaySalesCount++;
            }

            if (saleDate >= weekStart && saleDate <= todayEnd) {
                weekSalesAmount += netAmount;
                weekSalesCount++;
            }

            if (saleDate >= monthStart && saleDate <= todayEnd) {
                monthSalesAmount += netAmount;
                monthSalesCount++;
            }
        });

        const productRow = db.prepare("SELECT count(*) as count FROM products").get();
        const totalProducts = productRow ? productRow.count : 0;

        const lowStockProducts = db.prepare(`
            SELECT id, name, stock, min_stock as minStock
            FROM products
            WHERE stock <= min_stock
            ORDER BY name ASC
        `).all();

        const customers = db.prepare("SELECT id, name, opening_balance FROM customers").all();
        let totalOutstanding = 0;

        customers.forEach(c => {
            let runningBalance = parseFloat(c.opening_balance) || 0;

            const customerSales = db.prepare(`
                SELECT total, COALESCE(amount_paid, 0) as amountPaid
                FROM sales
                WHERE (customer_id = ? OR customer_name = ?) AND status != 'CANCELLED'
            `).all(c.id, c.name);

            customerSales.forEach(s => {
                runningBalance += (s.total - s.amountPaid);
            });

            const acctPayments = db.prepare(`
                SELECT amount FROM payments
                WHERE customer_id = ? AND sale_id IS NULL AND status != 'CANCELLED'
            `).all(c.id);

            acctPayments.forEach(p => {
                runningBalance -= (p.amount || 0);
            });

            if (runningBalance > 0) {
                totalOutstanding += runningBalance;
            }
        });

        const recentRows = db.prepare(`
            SELECT s.id as saleId, s.date, s.subtotal, COALESCE(s.discount, 0) as discount, s.total,
                   si.product_name as productName, si.quantity
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.status != 'CANCELLED'
            ORDER BY s.date DESC, s.id DESC
            LIMIT 60
        `).all();

        const billsMap = {};
        recentRows.forEach(row => {
            if (!billsMap[row.saleId]) {
                billsMap[row.saleId] = {
                    saleId: row.saleId,
                    date: row.date,
                    items: [],
                    total: row.total,
                    subtotal: row.subtotal,
                    discount: row.discount
                };
            }
            billsMap[row.saleId].items.push(`${row.productName} (${row.quantity})`);
        });

        const recentSales = Object.values(billsMap).slice(0, 10);

        return {
            todaySalesAmount: parseFloat(todaySalesAmount.toFixed(2)),
            todaySalesCount,
            weekSalesAmount: parseFloat(weekSalesAmount.toFixed(2)),
            weekSalesCount,
            monthSalesAmount: parseFloat(monthSalesAmount.toFixed(2)),
            monthSalesCount,
            totalProducts,
            dashboardOutstandingAmount: parseFloat(totalOutstanding.toFixed(2)),
            lowStockProducts,
            recentSales
        };
    }
}

module.exports = new DashboardService();
