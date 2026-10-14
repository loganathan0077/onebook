const dbManager = require('../database');

class ReportService {
    getReportSales(filters = {}) {
        const db = dbManager.getDatabase();
        let query = `
            SELECT 
                s.id as saleId,
                s.id as id,
                s.receipt_number as receiptNumber,
                s.date,
                s.created_at as createdAt,
                s.customer_id as customerId,
                COALESCE(s.customer_name, c.name, 'Walk-in Customer') as customerName,
                c.phone as customerPhone,
                c.gstin as customerGSTIN,
                s.payment_method as paymentMethod,
                s.subtotal as billSubtotal,
                s.discount as discount,
                s.total as billTotal,
                s.status as saleStatus,
                si.id as itemId,
                si.product_id as productId,
                si.product_name as productName,
                p.barcode as barcode,
                p.unit as unit,
                p.hsn as hsn,
                COALESCE(p.gst_rate, 0) as gstRate,
                si.quantity,
                si.price,
                si.discount as itemDiscount,
                si.taxable_value as taxableValue,
                si.cgst,
                si.sgst,
                si.igst,
                si.total as total
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            JOIN sale_items si ON s.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            WHERE s.status != 'CANCELLED'
        `;

        const params = [];

        if (filters.startDate) {
            query += ' AND date(s.date) >= date(?)';
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ' AND date(s.date) <= date(?)';
            params.push(filters.endDate);
        }
        if (filters.customerId) {
            if (filters.customerId === 'walk-in') {
                query += " AND (s.customer_id IS NULL OR s.customer_id = '' OR s.customer_id = 'walk-in')";
            } else {
                query += ' AND (s.customer_id = ? OR c.id = ?)';
                params.push(filters.customerId, filters.customerId);
            }
        }
        if (filters.paymentMethod) {
            query += ' AND lower(s.payment_method) = lower(?)';
            params.push(filters.paymentMethod);
        }

        query += ' ORDER BY s.date DESC, s.id DESC, si.id ASC';

        const rows = db.prepare(query).all(...params);

        // Map and ensure legacy fields expected by report renderers exist
        return rows.map(r => ({
            ...r,
            saleId: r.saleId,
            id: r.id,
            receiptNumber: r.receiptNumber || '',
            date: r.date,
            createdAt: r.createdAt || r.date,
            customerId: r.customerId ? String(r.customerId) : '',
            customerName: r.customerName || 'Walk-in Customer',
            customerPhone: r.customerPhone || '',
            customerGSTIN: r.customerGSTIN || '',
            paymentMethod: r.paymentMethod || 'cash',
            subtotal: r.billSubtotal !== undefined ? r.billSubtotal : r.total,
            discount: r.discount || 0,
            billTotal: r.billTotal,
            productId: r.productId,
            productName: r.productName,
            barcode: r.barcode || 'N/A',
            unit: r.unit || 'Piece',
            hsn: r.hsn || '',
            gstRate: parseFloat(r.gstRate) || 0,
            quantity: parseFloat(r.quantity) || 0,
            price: parseFloat(r.price) || 0,
            itemDiscount: parseFloat(r.itemDiscount) || 0,
            taxableValue: parseFloat(r.taxableValue) || 0,
            cgst: parseFloat(r.cgst) || 0,
            sgst: parseFloat(r.sgst) || 0,
            igst: parseFloat(r.igst) || 0,
            total: parseFloat(r.total) || 0
        }));
    }

    getCustomReportSummary(filters = {}) {
        const sales = this.getReportSales(filters);
        const uniqueSales = {};
        const productSales = {};

        let totalSubtotal = 0;
        let totalDiscount = 0;
        let totalSalesAfterDiscount = 0;
        let totalTaxableValue = 0;
        let totalCGST = 0;
        let totalSGST = 0;
        let totalIGST = 0;

        sales.forEach(sale => {
            if (!uniqueSales[sale.saleId]) {
                uniqueSales[sale.saleId] = {
                    subtotal: sale.subtotal,
                    discount: sale.discount,
                    items: []
                };
            }
            uniqueSales[sale.saleId].items.push(sale);
        });

        Object.values(uniqueSales).forEach(group => {
            totalSubtotal += group.subtotal;
            totalDiscount += group.discount;
            totalSalesAfterDiscount += (group.subtotal - group.discount);

            group.items.forEach(item => {
                totalTaxableValue += item.taxableValue || 0;
                totalCGST += item.cgst || 0;
                totalSGST += item.sgst || 0;
                totalIGST += item.igst || 0;
            });
        });

        sales.forEach(sale => {
            productSales[sale.productName] = (productSales[sale.productName] || 0) + sale.total;
        });

        const uniqueSaleCount = Object.keys(uniqueSales).length;
        const avgTransaction = uniqueSaleCount > 0 ? (totalSalesAfterDiscount / uniqueSaleCount) : 0;
        const topProduct = Object.keys(productSales).length > 0
            ? Object.keys(productSales).reduce((a, b) => productSales[a] > productSales[b] ? a : b, '')
            : '-';

        return {
            totalSalesAfterDiscount,
            totalDiscount,
            totalTaxableValue,
            totalCGST,
            totalSGST,
            totalIGST,
            uniqueSaleCount,
            avgTransaction,
            topProduct,
            recordCount: sales.length
        };
    }
}

module.exports = new ReportService();
