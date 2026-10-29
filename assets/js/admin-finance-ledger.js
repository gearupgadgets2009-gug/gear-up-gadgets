(function () {
    'use strict';

    const KEYS = {
        orders: 'admin_orders',
        financeTransactions: 'gug_finance_transactions',
        salaries: 'gug_finance_salaries',
        dealers: 'gug_erp_dealers',
        dealerLedger: 'gug_erp_dealer_ledger',
        purchaseOrders: 'gug_erp_purchase_orders',
        employees: 'gug_erp_employees',
        products: 'gug_erp_products',
        customProducts: 'admin_custom_products',
        stockConfig: 'gug_finance_stock_custom',
        manual: 'gug_finance_ledger_manual',
        overrides: 'gug_finance_ledger_overrides',
        receipts: 'gug_finance_receipt_files',
        petty: 'gug_finance_petty_expenses',
        payrollExpenses: 'gug_finance_payroll_expenses'
    };
    const PETTY_CATEGORIES = ['Fueling', 'Tea/Snacks/Water', 'Groceries', 'Conveyance'];
    const watchedKeys = new Set(Object.values(KEYS));
    let activeRows = new Map();
    let modal;

    function read(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || 'null');
            return value === null ? fallback : value;
        } catch (error) {
            console.error(`[Finance] Could not read ${key} from local storage.`, error);
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new CustomEvent('gug:finance-refresh', { detail: { key } }));
    }

    function escapeHTML(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function amount(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    function money(value) {
        return `Rs. ${Math.round(amount(value)).toLocaleString('en-PK')}`;
    }

    function localDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseDate(value) {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        const text = String(value).trim();
        if (!text) return null;
        const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        const parsed = new Date(text);
        return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    function displayDate(value) {
        const date = parseDate(value);
        if (!date) return 'Date not recorded';
        const text = String(value == null ? '' : value);
        const hasTime = /[T ]\d{1,2}:\d{2}/.test(text);
        if (!hasTime) return date.toLocaleDateString();
        const timestamp = new Date(value);
        return Number.isNaN(timestamp.getTime())
            ? date.toLocaleDateString()
            : timestamp.toLocaleString();
    }

    function normalizeStatus(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isCancelled(record) {
        const status = normalizeStatus(record.status || record.orderStatus);
        return /cancel|refund|void|deleted|return/.test(status);
    }

    function orderAmount(order) {
        const totalFields = ['grandTotal', 'totalAmount', 'orderTotal', 'total', 'amount', 'finalAmount'];
        for (const field of totalFields) {
            const value = Number(order[field]);
            if (Number.isFinite(value) && value > 0) return value;
        }
        return (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => {
            const quantity = amount(item.quantity || item.qty || item.count) || 1;
            return sum + amount(item.price || item.salePrice || item.unitPrice) * quantity;
        }, 0);
    }

    function orderDate(order) {
        return order.date || order.createdAt || order.created_at || order.orderDate || order.timestamp || '';
    }

    function makeRow(source, id, fields) {
        const row = { source, id: String(id), amount: 0, date: '', reference: '', party: '', description: '', method: '', status: '', receiptName: '', receiptUrl: '', manual: false, ...fields };
        row.key = `${source}:${row.id}`;
        return row;
    }

    function applyOverride(row, overrides) {
        const override = overrides[row.key];
        if (!override) return row;
        if (override.hidden) return null;
        return { ...row, ...override };
    }

    function sourceRows() {
        const overrides = read(KEYS.overrides, {});
        const rows = { customer: [], dealer: [], supplier: [] };
        const orders = read(KEYS.orders, []);
        const ordersByReference = new Map();

        orders.forEach(order => {
            if (!order || !order.id || isCancelled(order)) return;
            const reference = String(order.id);
            ordersByReference.set(reference.replace(/^#/, '').toLowerCase(), order);
            const customer = order.customer && typeof order.customer === 'object'
                ? (order.customer.name || order.customer.fullName || '')
                : (order.customer || order.customerName || order.name || '');
            const payments = Array.isArray(order.paymentHistory)
                ? order.paymentHistory.filter(item => item && amount(item.amount) > 0)
                : [];
            const legacyPaid = payments.length ? 0 : (
                amount(order.paidAmount) ||
                (/paid/i.test(String(order.paymentStatus || '')) ? orderAmount(order) : 0)
            );
            const entries = payments.length ? payments.map((item, index) => ({
                id: `order:${reference}:payment:${item.id || item.timestamp || index}`,
                amount: item.amount,
                date: item.timestamp || item.date || orderDate(order),
                reference: item.transactionReference || item.reference || reference,
                method: item.paymentMethod || item.method || order.paymentMethod || order.payment || 'Customer payment',
                bankNetwork: item.bankNetwork || '',
                status: 'Received',
                receiptName: item.receiptName || '',
                receiptData: item.receiptData || ''
            })) : legacyPaid > 0 ? [{
                id: `order:${reference}:legacy-paid`,
                amount: legacyPaid,
                date: order.transactionAt || orderDate(order),
                reference: order.paymentReference || reference,
                method: order.paymentMethod || order.payment || 'Customer payment',
                bankNetwork: order.bankNetwork || '',
                status: order.paymentStatus || 'Received',
                receiptName: order.receiptName || '',
                receiptData: order.receiptData || ''
            }] : [];
            entries.forEach(payment => {
                const row = makeRow('customer', payment.id, {
                    amount: payment.amount,
                    date: payment.date,
                    reference: payment.reference,
                    party: customer || 'Website customer',
                    description: Array.isArray(order.items) ? `${order.items.length} order line(s)` : 'Website order payment',
                    method: payment.bankNetwork ? `${payment.method} · ${payment.bankNetwork}` : payment.method,
                    status: payment.status,
                    receiptName: payment.receiptName,
                    receiptData: payment.receiptData
                });
                const adjusted = applyOverride(row, overrides);
                if (adjusted) rows.customer.push(adjusted);
            });
        });

        const financeTransactions = read(KEYS.financeTransactions, []);
        financeTransactions.forEach(transaction => {
            if (!transaction || !transaction.id || /failed|refunded|void/.test(normalizeStatus(transaction.status))) return;
            const orderRef = String(transaction.orderId || '').replace(/^#/, '').toLowerCase();
            const relatedOrder = orderRef ? ordersByReference.get(orderRef) : null;
            const transactionRefs = [transaction.id, transaction.transactionReference, transaction.reference]
                .filter(Boolean).map(value => String(value).toLowerCase());
            const alreadyInOrderHistory = relatedOrder && Array.isArray(relatedOrder.paymentHistory) &&
                relatedOrder.paymentHistory.some(payment => payment && [
                    payment.id, payment.transactionReference, payment.reference
                ].filter(Boolean).some(value => transactionRefs.includes(String(value).toLowerCase())));
            if (alreadyInOrderHistory) return;
            const row = makeRow('customer', `transaction:${transaction.id}`, {
                amount: transaction.amount,
                date: transaction.date,
                reference: transaction.transactionReference || transaction.reference || transaction.orderId || transaction.id,
                party: transaction.customer || 'Customer payment',
                description: transaction.id,
                method: transaction.bankNetwork
                    ? `${transaction.paymentMethod || 'Payment'} · ${transaction.bankNetwork}`
                    : transaction.paymentMethod || transaction.gateway || 'Payment',
                status: transaction.status || 'Recorded',
                receiptName: transaction.receiptName || '',
                receiptData: transaction.receiptData || '',
                manual: true,
                externalManual: true,
                transaction
            });
            const adjusted = applyOverride(row, overrides);
            if (adjusted) rows.customer.push(adjusted);
        });

        read(KEYS.manual, []).forEach(entry => {
            if (!entry || !rows[entry.source]) return;
            const { id: manualId, ...entryFields } = entry;
            const row = makeRow(entry.source, `manual:${manualId}`, { ...entryFields, manual: true });
            const adjusted = applyOverride(row, overrides);
            if (adjusted) rows[entry.source].push(adjusted);
        });

        const dealers = read(KEYS.dealers, []);
        const explicitDealerLedger = read(KEYS.dealerLedger, []);
        const dealersWithExplicitLedger = new Set(explicitDealerLedger
            .filter(entry => entry && ['PAYMENT_RECEIVED', 'ADVANCE_PAYMENT'].includes(entry.type) && (amount(entry.credit) || amount(entry.amount)) > 0)
            .map(entry => String(entry.dealerId)));
        dealers.forEach(dealer => {
            if (!dealer) return;
            if (dealersWithExplicitLedger.has(String(dealer.id))) return;
            (Array.isArray(dealer.paymentHistory) ? dealer.paymentHistory : []).forEach(payment => {
                if (!payment || !payment.id) return;
                const row = makeRow('dealer', `payment:${dealer.id}:${payment.id}`, {
                    amount: payment.amount,
                    date: payment.timestamp || payment.recordedAt || payment.date,
                    reference: payment.transactionReference || payment.reference || payment.id,
                    party: dealer.shopName || dealer.name || 'B2B dealer',
                    description: payment.notes || dealer.name || 'Dealer payment',
                    method: payment.method || payment.paymentMethod || 'Dealer receipt',
                    status: 'Received',
                    receiptName: payment.receiptName || '',
                    receiptData: payment.receiptData || '',
                    transactionReference: payment.transactionReference || '',
                    bankNetwork: payment.bankNetwork || ''
                });
                const adjusted = applyOverride(row, overrides);
                if (adjusted) rows.dealer.push(adjusted);
            });
        });
        explicitDealerLedger.forEach(payment => {
            if (!payment || !payment.id || !['PAYMENT_RECEIVED', 'ADVANCE_PAYMENT'].includes(payment.type)) return;
            const paymentAmount = amount(payment.credit) || amount(payment.amount);
            if (paymentAmount <= 0) return;
            const dealer = dealers.find(item => String(item.id) === String(payment.dealerId));
            const row = makeRow('dealer', `ledger:${payment.id}`, {
                amount: paymentAmount,
                date: payment.date,
                reference: payment.transactionReference || payment.referenceNo || payment.id,
                party: payment.shopName || (dealer && (dealer.shopName || dealer.name)) || payment.dealerName || 'B2B dealer',
                description: payment.description || 'Dealer payment received',
                method: payment.bankNetwork
                    ? `${payment.paymentMethod || 'Dealer receipt'} · ${payment.bankNetwork}`
                    : payment.paymentMethod || 'Dealer receipt',
                status: 'Received',
                receiptName: payment.receiptName || '',
                receiptData: payment.receiptData || ''
            });
            const adjusted = applyOverride(row, overrides);
            if (adjusted) rows.dealer.push(adjusted);
        });

        read(KEYS.purchaseOrders, []).forEach(po => {
            if (!po || !po.id) return;
            const payments = Array.isArray(po.paymentHistory) ? po.paymentHistory.filter(payment => payment && amount(payment.amount) > 0) : [];
            const historyTotal = payments.reduce((sum, payment) => sum + amount(payment.amount), 0);
            const paidTotal = amount(po.paidAmount) || (normalizeStatus(po.paymentStatus) === 'paid' ? amount(po.totalAmount) : 0);
            const entries = payments.length ? payments.map(payment => ({
                id: `po:${po.id}:payment:${payment.id || payment.recordedAt || payment.date}`,
                amount: payment.amount,
                date: payment.date,
                reference: payment.transactionReference || payment.reference || payment.id || po.id,
                method: payment.method || payment.paymentMethod || 'Supplier payment',
                receiptName: payment.receiptName || '',
                bankNetwork: payment.bankNetwork || '',
                transactionReference: payment.transactionReference || '',
                paidAmount: payment.paidAmount,
                balanceAmount: payment.balanceAmount,
                receiptData: payment.receiptData || ''
            })) : [];
            if (paidTotal > historyTotal) {
                entries.push({
                    id: `po:${po.id}:legacy-paid`,
                    amount: paidTotal - historyTotal,
                    date: po.transactionAt || po.paymentDate || po.paidDate || po.updatedAt || po.orderDate || po.createdAt || '',
                    reference: po.paymentReference || po.id,
                    method: po.paymentMethod || 'Previously recorded payment',
                    receiptName: po.receiptName || '',
                    bankNetwork: po.bankNetwork || '',
                    receiptData: po.receiptData || ''
                });
            }
            if (!payments.length && !entries.length) entries.push({
                id: `po:${po.id}`,
                amount: paidTotal,
                date: po.transactionAt || po.paymentDate || po.paidDate || po.updatedAt || po.orderDate || po.createdAt || '',
                reference: po.id,
                method: po.paymentMethod || 'Supplier payment',
                receiptName: po.receiptName || '',
                bankNetwork: po.bankNetwork || '',
                receiptData: po.receiptData || ''
            });
            entries.forEach(payment => {
                if (!payment.amount) return;
                const row = makeRow('supplier', payment.id, {
                    amount: payment.amount,
                    date: payment.date,
                    reference: payment.reference || po.id,
                    party: po.supplierName || po.supplier || 'Supplier',
                    description: po.notes || 'Supplier inventory payment',
                    method: payment.bankNetwork ? `${payment.method} · ${payment.bankNetwork}` : payment.method,
                    status: po.paymentStatus || 'Partially paid',
                    receiptName: payment.receiptName,
                    receiptData: payment.receiptData || ''
                });
                const adjusted = applyOverride(row, overrides);
                if (adjusted) rows.supplier.push(adjusted);
            });
        });

        Object.values(rows).forEach(list => list.sort((a, b) => {
            const first = parseDate(a.date);
            const second = parseDate(b.date);
            return (second ? second.getTime() : 0) - (first ? first.getTime() : 0);
        }));
        return rows;
    }

    function periodRange() {
        const selection = document.querySelector('.finance-range-filter')?.value || '1y';
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start = new Date(endOfToday);
        const end = endOfToday;
        const subtractMonths = months => start.setMonth(start.getMonth() - months);

        if (selection === 'custom') {
            const startText = document.querySelector('.finance-range-start')?.value || '';
            const endText = document.querySelector('.finance-range-end')?.value || '';
            const customStart = parseDate(startText);
            const customEnd = parseDate(endText);
            if (!customStart || !customEnd || customStart > customEnd) return { valid: false, selection };
            return { start: customStart, end: customEnd, valid: true, selection };
        }
        if (selection === '1d') {
            start = endOfToday;
        } else if (selection === '1w') {
            start.setDate(start.getDate() - 6);
        } else {
            const months = { '3m': 3, '6m': 6, '1y': 12, '2y': 24, '5y': 60, '10y': 120 }[selection] || 12;
            subtractMonths(months);
        }
        return { start, end, valid: true, selection };
    }

    function inPeriod(row, range) {
        const date = parseDate(row.date);
        return Boolean(range.valid && date && date >= range.start && date <= range.end);
    }

    function selectedRows(rows, range) {
        return rows.filter(row => inPeriod(row, range));
    }

    function sumRows(rows) {
        return rows.reduce((total, row) => total + amount(row.amount), 0);
    }

    function receiptMarkup(row) {
        const receipt = read(KEYS.receipts, {})[row.key];
        const name = row.receiptName || (receipt && receipt.name) || '';
        if (!name && !row.receiptUrl && !row.receiptData && !(receipt && receipt.data)) return '<span class="text-secondary">—</span>';
        const link = row.receiptUrl || row.receiptData || (receipt && receipt.data) || '';
        const safeLink = /^(https?:\/\/|data:application\/pdf;base64,|data:image\/)/i.test(link) ? link : '';
        return safeLink
            ? `<a href="${escapeHTML(safeLink)}" ${safeLink.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : `download="${escapeHTML(name || 'receipt')}"`} class="text-info">${escapeHTML(name || 'View receipt')}</a>`
            : `<span class="text-info">${escapeHTML(name || 'Receipt attached')}</span>`;
    }

    function actionMarkup(row) {
        const safeId = encodeURIComponent(row.id);
        const safeSource = escapeHTML(row.source);
        return `<div class="d-inline-flex gap-1"><button type="button" class="btn btn-sm btn-outline-light py-0 px-2" data-finance-action="edit" data-source="${safeSource}" data-id="${safeId}" aria-label="Edit ledger entry"><i class="fas fa-edit"></i></button><button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" data-finance-action="delete" data-source="${safeSource}" data-id="${safeId}" aria-label="Delete ledger entry"><i class="fas fa-trash"></i></button></div>`;
    }

    function renderLedgerTable(elementId, rows) {
        const body = document.getElementById(elementId);
        if (!body) return;
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="7" class="text-center text-secondary py-3">No records in this period.</td></tr>';
            return;
        }
        body.innerHTML = rows.map(row => {
            activeRows.set(row.key, row);
            return `<tr>
                <td>${escapeHTML(displayDate(row.date))}</td>
                <td class="font-monospace">${escapeHTML(row.reference || row.id)}</td>
                <td><span class="fw-semibold">${escapeHTML(row.party)}</span><small class="d-block text-secondary">${escapeHTML(row.description)}</small></td>
                <td><span>${escapeHTML(row.method || '—')}</span><small class="d-block text-secondary">${escapeHTML(row.status || '')}</small></td>
                <td class="text-end font-monospace fw-bold">${money(row.amount)}</td>
                <td>${receiptMarkup(row)}</td>
                <td class="text-end action-column">${actionMarkup(row)}</td>
            </tr>`;
        }).join('');
    }

    function salaryRows() {
        const salaries = read(KEYS.salaries, []);
        const entries = [];
        salaries.forEach(salary => {
            if (!salary) return;
            const net = amount(salary.net);
            const paid = amount(salary.paidAmount) || (normalizeStatus(salary.status) === 'paid' ? net : 0);
            const date = salary.date || salary.generatedAt || salary.createdAt || salary.transactionAt || salary.paidDate || salary.paymentDate || '';
            if (net > 0) {
                entries.push({
                    amount: net,
                    paidAmount: paid,
                    balanceAmount: Math.max(0, net - paid),
                    date,
                    name: salary.name || 'Employee',
                    reference: salary.transactionReference || salary.ref || salary.id,
                    source: normalizeStatus(salary.status) === 'paid' ? 'Salary paid' : 'Salary accrued',
                    method: salary.bankNetwork ? `${salary.paymentMethod || salary.method || 'Payroll'} · ${salary.bankNetwork}` : salary.paymentMethod || salary.method || 'Payroll',
                    receiptName: salary.receiptName || '',
                    receiptData: salary.receiptData || ''
                });
            }
            const advance = amount(salary.advance);
            if (advance > 0 && !salary.advanceRecordedAsSalary) entries.push({
                amount: advance,
                date: salary.advanceDate || date,
                name: salary.name || 'Employee',
                reference: `${salary.id} advance`,
                source: 'Salary advance',
                method: salary.paymentMethod || salary.method || 'Payroll'
            });
        });
        read(KEYS.payrollExpenses, []).forEach(expense => {
            if (expense && expense.date && amount(expense.amount) > 0) {
                entries.push({
                    amount: amount(expense.amount),
                    date: expense.date,
                    name: expense.employeeName || 'Employee',
                    reference: expense.id || 'Payroll expense',
                    source: 'HR payroll'
                });
            }
        });
        return entries;
    }

    function pettyRows() {
        return read(KEYS.petty, []).filter(entry => entry && entry.id).map(entry => ({
            source: 'petty',
            id: String(entry.id),
            key: `petty:${entry.id}`,
            amount: amount(entry.amount),
            date: entry.date || '',
            reference: entry.category || 'Miscellaneous',
            party: entry.category || 'Petty cash',
            description: entry.description || '',
            method: entry.method || 'Cash',
            status: 'Paid',
            receiptName: entry.receiptName || '',
            receiptUrl: entry.receiptUrl || '',
            manual: true
        }));
    }

    function productCatalog() {
        const fromLive = Array.isArray(window.LIVE_PRODUCTS) ? window.LIVE_PRODUCTS : [];
        const fromErp = read(KEYS.products, []);
        const fromCustom = read(KEYS.customProducts, []);
        const combined = [...fromLive, ...(Array.isArray(fromErp) ? fromErp : []), ...(Array.isArray(fromCustom) ? fromCustom : [])];
        const products = new Map();
        combined.forEach(product => {
            if (!product) return;
            const name = product.name || product.title || product.productName;
            if (!name) return;
            const key = String(product.id || name).toLowerCase();
            if (!products.has(key)) products.set(key, product);
        });
        return products;
    }

    function productSales(range) {
        const catalog = productCatalog();
        const customCosts = read(KEYS.stockConfig, {});
        const sales = new Map();
        read(KEYS.orders, []).forEach(order => {
            if (!order || isCancelled(order) || !inPeriod({ date: orderDate(order) }, range)) return;
            (Array.isArray(order.items) ? order.items : []).forEach(item => {
                const name = item.name || item.title || item.productName || 'Unlabelled product';
                const productId = String(item.id || item.productId || name).toLowerCase();
                const product = catalog.get(productId) || [...catalog.values()].find(candidate =>
                    String(candidate.name || candidate.title || '').toLowerCase() === String(name).toLowerCase());
                const quantity = amount(item.quantity || item.qty || item.count) || 1;
                const unitPrice = amount(item.price || item.salePrice || item.unitPrice || (product && product.price));
                const config = customCosts[String(item.productId || item.id || (product && product.id) || '')] || {};
                const unitCost = amount(item.costPrice || item.cost || (product && (product.costPrice || product.purchasePrice)) || config.costPrice) ||
                    Math.round(unitPrice * 0.7);
                const key = String((product && product.id) || productId || name).toLowerCase();
                const row = sales.get(key) || { name, quantity: 0, revenue: 0, cost: 0 };
                row.quantity += quantity;
                row.revenue += unitPrice * quantity;
                row.cost += unitCost * quantity;
                sales.set(key, row);
            });
        });
        catalog.forEach(product => {
            const name = product.name || product.title || product.productName;
            const key = String(product.id || name).toLowerCase();
            if (!sales.has(key)) sales.set(key, { name, quantity: 0, revenue: 0, cost: 0 });
        });
        return [...sales.values()].map(row => ({
            ...row,
            profit: row.revenue - row.cost,
            margin: row.revenue > 0 ? ((row.revenue - row.cost) / row.revenue) * 100 : 0
        }));
    }

    function renderMovement(range) {
        const sales = productSales(range);
        const sold = sales.filter(item => item.quantity > 0);
        const fast = [...sold].sort((a, b) => b.quantity - a.quantity || b.profit - a.profit).slice(0, 5);
        const slow = [...sales].sort((a, b) => a.quantity - b.quantity || a.profit - b.profit).slice(0, 5);
        const empty = '<tr><td colspan="4" class="text-secondary">No product records available.</td></tr>';
        const render = (items, includeRevenue) => items.length ? items.map(item => `<tr>
            <td>${escapeHTML(item.name)}</td>
            <td class="text-end">${item.quantity.toLocaleString()}</td>
            ${includeRevenue ? `<td class="text-end">${money(item.revenue)}</td>` : `<td class="text-end">${item.margin.toFixed(1)}%</td>`}
            <td class="text-end ${item.profit >= 0 ? 'text-success' : 'text-danger'}">${money(item.profit)}</td>
        </tr>`).join('') : empty;
        const fastDashboard = document.getElementById('finance-fast-moving');
        const slowDashboard = document.getElementById('finance-slow-moving');
        const fastStock = document.getElementById('stock-fast-moving');
        const slowStock = document.getElementById('stock-slow-moving');
        if (fastDashboard) fastDashboard.innerHTML = render(fast, true);
        if (slowDashboard) slowDashboard.innerHTML = render(slow, true);
        if (fastStock) fastStock.innerHTML = render(fast, false);
        if (slowStock) slowStock.innerHTML = render(slow, false);
    }

    function currentData(range) {
        const rows = sourceRows();
        const customer = selectedRows(rows.customer, range);
        const dealer = selectedRows(rows.dealer, range);
        const supplier = selectedRows(rows.supplier, range);
        const payroll = salaryRows().filter(row => inPeriod(row, range));
        const petty = selectedRows(pettyRows(), range);
        return { rows, customer, dealer, supplier, payroll, petty };
    }

    function rangeLabel(range) {
        if (!range.valid) return 'Choose a valid custom start and end date.';
        return `${range.start.toLocaleDateString()} – ${range.end.toLocaleDateString()}`;
    }

    function renderFinance() {
        const range = periodRange();
        const data = currentData(range);
        const revenueByCustomer = sumRows(data.customer);
        const revenueByDealer = sumRows(data.dealer);
        const supplierTotal = sumRows(data.supplier);
        const payrollTotal = sumRows(data.payroll);
        const pettyTotal = sumRows(data.petty);
        const revenue = revenueByCustomer + revenueByDealer;
        const expenses = supplierTotal + payrollTotal + pettyTotal;
        const net = revenue - expenses;
        const inventoryCapital = typeof window.calculateFullERP === 'function'
            ? amount(window.calculateFullERP().totalCapitalInvested)
            : supplierTotal;
        activeRows = new Map();

        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        setText('master-capital', money(inventoryCapital));
        setText('master-revenue', money(revenue));
        setText('master-expenses', money(expenses));
        setText('master-net', money(net));
        setText('master-period-label', rangeLabel(range));
        const netElement = document.getElementById('master-net');
        if (netElement) netElement.className = `finance-kpi-value ${net >= 0 ? 'text-success' : 'text-danger'}`;
        setText('ledger-customer-total', money(revenueByCustomer));
        setText('ledger-dealer-total', money(revenueByDealer));
        setText('ledger-supplier-total', money(supplierTotal));

        const income = document.getElementById('master-income-breakdown');
        if (income) income.innerHTML = `<tr><td>Customer CRM</td><td class="text-end">${money(revenueByCustomer)}</td></tr><tr><td>Dealer B2B</td><td class="text-end">${money(revenueByDealer)}</td></tr><tr class="fw-bold"><td>Total Revenue</td><td class="text-end">${money(revenue)}</td></tr>`;
        const expense = document.getElementById('master-expense-breakdown');
        if (expense) expense.innerHTML = `<tr><td>Purchasing &amp; suppliers</td><td class="text-end">${money(supplierTotal)}</td></tr><tr><td>HR payroll &amp; advances</td><td class="text-end">${money(payrollTotal)}</td></tr><tr><td>Petty cash / miscellaneous</td><td class="text-end">${money(pettyTotal)}</td></tr><tr class="fw-bold"><td>Total Expenses</td><td class="text-end">${money(expenses)}</td></tr>`;

        renderLedgerTable('finance-customer-ledger', data.customer);
        renderLedgerTable('finance-dealer-ledger', data.dealer);
        renderLedgerTable('finance-supplier-ledger', data.supplier);
        renderPettyTable(data.petty);
        renderMovement(range);
        if (typeof window.renderFinancialKpis === 'function') window.renderFinancialKpis();
    }

    function financeSummary() {
        const range = periodRange();
        const data = currentData(range);
        const revenue = sumRows(data.customer) + sumRows(data.dealer);
        const supplier = sumRows(data.supplier);
        const payroll = sumRows(data.payroll);
        const payrollPaid = data.payroll.reduce((total, entry) => {
            if (entry.source === 'Salary advance') return total + amount(entry.amount);
            return total + amount(entry.paidAmount);
        }, 0);
        const petty = sumRows(data.petty);
        const transactions = read(KEYS.financeTransactions, []).filter(transaction =>
            transaction && normalizeStatus(transaction.status) === 'completed' &&
            inPeriod({ date: transaction.date || transaction.createdAt || transaction.timestamp }, range));
        const onlinePayment = transactions.reduce((total, transaction) => total + amount(transaction.amount), 0);
        return {
            revenue,
            supplier,
            payroll,
            payrollPaid,
            petty,
            expenses: supplier + payroll + petty,
            netProfit: revenue - supplier - payroll - petty,
            netOperatingProfit: revenue - payroll - petty,
            onlinePayment,
            onlineCount: transactions.length
        };
    }

    function bindExclusiveTabs(buttonIds, panelIds) {
        buttonIds.forEach((buttonId, activeIndex) => {
            const button = document.getElementById(buttonId);
            if (!button) return;
            button.addEventListener('click', () => {
                buttonIds.forEach((id, index) => {
                    const tab = document.getElementById(id);
                    const panel = document.getElementById(panelIds[index]);
                    const active = index === activeIndex;
                    if (tab) {
                        tab.classList.toggle('active', active);
                        tab.setAttribute('aria-selected', String(active));
                    }
                    if (panel) panel.hidden = !active;
                });
            });
        });
    }

    function renderPettyTable(rows) {
        const body = document.getElementById('finance-petty-table');
        if (!body) return;
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-3">No petty cash expenses in this period.</td></tr>';
            return;
        }
        body.innerHTML = rows.map(row => `<tr>
            <td>${escapeHTML(displayDate(row.date))}</td><td>${escapeHTML(row.reference)}</td>
            <td>${escapeHTML(row.description)}</td><td>${receiptMarkup(row)}</td>
            <td class="text-end fw-bold">${money(row.amount)}</td>
            <td class="text-end action-column">${actionMarkup(row)}</td>
        </tr>`).join('');
    }

    function ensureModal() {
        let element = document.getElementById('financeEntryModal');
        if (element) return element;
        element = document.createElement('div');
        element.className = 'modal fade';
        element.id = 'financeEntryModal';
        element.tabIndex = -1;
        element.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content">
            <div class="modal-header bg-dark text-white"><h5 class="modal-title" id="finance-entry-title">Add Finance Ledger Entry</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button></div>
            <form id="finance-entry-form">
                <div class="modal-body">
                    <input type="hidden" id="finance-entry-id"><input type="hidden" id="finance-entry-kind">
                    <div class="mb-3"><label class="form-label text-dark fw-semibold" for="finance-entry-source">Ledger section</label><select class="form-select" id="finance-entry-source" required><option value="customer">Customer CRM</option><option value="dealer">Dealer B2B</option><option value="supplier">Supplier payment</option><option value="petty">Petty cash expense</option></select></div>
                    <div class="mb-3" id="finance-category-wrap"><label class="form-label text-dark fw-semibold" for="finance-entry-category">Expense category</label><select class="form-select" id="finance-entry-category">${PETTY_CATEGORIES.map(category => `<option>${escapeHTML(category)}</option>`).join('')}</select></div>
                    <div class="mb-3"><label class="form-label text-dark fw-semibold" for="finance-entry-party">Customer / dealer / supplier</label><input class="form-control" id="finance-entry-party" maxlength="160" required></div>
                    <div class="mb-3"><label class="form-label text-dark fw-semibold" for="finance-entry-reference">Reference / description</label><input class="form-control" id="finance-entry-reference" maxlength="200" required></div>
                    <div class="row g-3">
                        <div class="col-md-6"><label class="form-label text-dark fw-semibold" for="finance-entry-amount">Amount (PKR)</label><input class="form-control" type="number" id="finance-entry-amount" min="0.01" step="0.01" required></div>
                        <div class="col-md-6"><label class="form-label text-dark fw-semibold" for="finance-entry-date">Date</label><input class="form-control" type="date" id="finance-entry-date" required></div>
                    </div>
                    <div class="row g-3 mt-0" id="finance-entry-payment-fields">
                        <div class="col-md-6"><label class="form-label text-dark fw-semibold" for="finance-entry-method">Payment method</label><input class="form-control" id="finance-entry-method" maxlength="100" placeholder="Cash, bank transfer, COD"></div>
                        <div class="col-md-6"><label class="form-label text-dark fw-semibold" for="finance-entry-status">Status</label><input class="form-control" id="finance-entry-status" maxlength="80" placeholder="Received / paid / pending"></div>
                    </div>
                    <div class="mt-3"><label class="form-label text-dark fw-semibold" for="finance-entry-receipt-name">Receipt file name</label><input class="form-control" id="finance-entry-receipt-name" maxlength="180" placeholder="e.g. supplier-invoice-2026-10.pdf"></div>
                    <div class="mt-3"><label class="form-label text-dark fw-semibold" for="finance-entry-receipt-url">Receipt URL (optional)</label><input class="form-control" type="url" id="finance-entry-receipt-url" maxlength="1000" placeholder="https://..."></div>
                    <div class="mt-3"><label class="form-label text-dark fw-semibold" for="finance-receipt-file">Attach receipt (optional, max 1 MB)</label><input class="form-control" type="file" id="finance-receipt-file" accept=".pdf,.png,.jpg,.jpeg,.webp"></div>
                    <div class="small text-danger mt-2" id="finance-entry-error" role="alert"></div>
                </div>
                <div class="modal-footer"><button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary btn-sm fw-bold">Save entry</button></div>
            </form>
        </div></div>`;
        document.body.appendChild(element);
        modal = bootstrap.Modal.getOrCreateInstance(element);
        element.querySelector('#finance-entry-form').addEventListener('submit', saveEntry);
        element.querySelector('#finance-entry-source').addEventListener('change', updateEntryForm);
        return element;
    }

    function updateEntryForm() {
        const element = document.getElementById('financeEntryModal');
        if (!element) return;
        const petty = element.querySelector('#finance-entry-source').value === 'petty';
        element.querySelector('#finance-category-wrap').classList.toggle('d-none', !petty);
        element.querySelector('#finance-entry-payment-fields').classList.toggle('d-none', petty);
    }

    function openEntryModal(source, row) {
        const element = ensureModal();
        const form = element.querySelector('#finance-entry-form');
        form.reset();
        element.querySelector('#finance-entry-error').textContent = '';
        element.querySelector('#finance-entry-id').value = row ? (row.manual && !row.externalManual && row.id.startsWith('manual:') ? row.id.slice('manual:'.length) : row.id) : '';
        element.querySelector('#finance-entry-kind').value = row ? (row.externalManual ? 'legacy' : row.manual ? 'manual' : 'source') : 'new';
        element.querySelector('#finance-entry-source').value = source || (row && row.source) || 'customer';
        element.querySelector('#finance-entry-source').disabled = Boolean(row);
        element.querySelector('#finance-entry-party').value = row ? (row.party || '') : '';
        element.querySelector('#finance-entry-reference').value = row ? (row.reference || row.description || '') : '';
        element.querySelector('#finance-entry-amount').value = row ? amount(row.amount) : '';
        element.querySelector('#finance-entry-date').value = row ? localDateString(parseDate(row.date) || new Date()) : localDateString(new Date());
        element.querySelector('#finance-entry-method').value = row ? (row.method || '') : '';
        element.querySelector('#finance-entry-status').value = row ? (row.status || '') : '';
        element.querySelector('#finance-entry-receipt-name').value = row ? (row.receiptName || '') : '';
        element.querySelector('#finance-entry-receipt-url').value = row ? (row.receiptUrl || '') : '';
        element.querySelector('#finance-entry-category').value = row ? (row.reference || 'Fueling') : 'Fueling';
        element.querySelector('#finance-entry-title').textContent = row ? 'Edit Finance Ledger Entry' : 'Add Finance Ledger Entry';
        updateEntryForm();
        modal.show();
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('The receipt file could not be read.'));
            reader.readAsDataURL(file);
        });
    }

    async function saveEntry(event) {
        event.preventDefault();
        const element = document.getElementById('financeEntryModal');
        const errorElement = element.querySelector('#finance-entry-error');
        const id = element.querySelector('#finance-entry-id').value;
        const kind = element.querySelector('#finance-entry-kind').value;
        const source = element.querySelector('#finance-entry-source').value;
        const file = element.querySelector('#finance-receipt-file').files[0];
        if (file && file.size > 1024 * 1024) {
            errorElement.textContent = 'Receipt files must be 1 MB or smaller.';
            return;
        }
        if (file && !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            errorElement.textContent = 'Attach a PDF, PNG, JPEG or WebP receipt.';
            return;
        }
        const date = element.querySelector('#finance-entry-date').value;
        const receiptUrl = element.querySelector('#finance-entry-receipt-url').value.trim();
        if (receiptUrl && !/^https?:\/\//i.test(receiptUrl)) {
            errorElement.textContent = 'Receipt URL must begin with http:// or https://.';
            return;
        }
        const numericAmount = Number(element.querySelector('#finance-entry-amount').value);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !date) {
            errorElement.textContent = 'Enter a valid positive amount and date.';
            return;
        }
        const entryId = id || `FIN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const rowKey = source === 'petty' || kind === 'source' || kind === 'legacy'
            ? `${source}:${entryId}`
            : `${source}:manual:${entryId}`;
        const entry = {
            id: kind === 'source' ? entryId : entryId.replace(/^manual:/, ''),
            source: source === 'petty' ? 'petty' : source,
            party: element.querySelector('#finance-entry-party').value.trim(),
            reference: source === 'petty' ? element.querySelector('#finance-entry-category').value : element.querySelector('#finance-entry-reference').value.trim(),
            description: element.querySelector('#finance-entry-reference').value.trim(),
            amount: numericAmount,
            date,
            method: element.querySelector('#finance-entry-method').value.trim() || (source === 'petty' ? 'Cash' : ''),
            status: element.querySelector('#finance-entry-status').value.trim() || (source === 'petty' ? 'Paid' : 'Recorded'),
            receiptName: element.querySelector('#finance-entry-receipt-name').value.trim() || (file && file.name) || '',
            receiptUrl,
            manual: true
        };

        try {
            if (file) {
                const receipts = read(KEYS.receipts, {});
                receipts[rowKey] = { name: entry.receiptName, data: await readFile(file) };
                write(KEYS.receipts, receipts);
            }
            if (source === 'petty') {
                const entries = read(KEYS.petty, []);
                const existing = entries.findIndex(item => String(item.id) === entryId);
                const pettyEntry = { ...entry, category: entry.reference };
                if (kind === 'manual' && existing !== -1) entries[existing] = pettyEntry;
                else entries.unshift(pettyEntry);
                write(KEYS.petty, entries);
            } else if (kind === 'source' || kind === 'legacy') {
                const overrides = read(KEYS.overrides, {});
                overrides[`${source}:${id}`] = {
                    amount: entry.amount,
                    date: entry.date,
                    party: entry.party,
                    reference: entry.reference,
                    description: entry.description,
                    method: entry.method,
                    status: entry.status,
                    receiptName: entry.receiptName,
                    receiptUrl: entry.receiptUrl
                };
                write(KEYS.overrides, overrides);
            } else {
                const entries = read(KEYS.manual, []);
                const existing = entries.findIndex(item => String(item.id) === entryId);
                if (kind === 'manual' && existing !== -1) entries[existing] = entry;
                else entries.unshift(entry);
                write(KEYS.manual, entries);
            }
            modal.hide();
            renderFinance();
        } catch (error) {
            console.error('[Finance] Could not save ledger entry or receipt.', error);
            errorElement.textContent = `Unable to save this entry: ${error.message || 'storage error'}`;
        }
    }

    function removeEntry(source, id) {
        const row = activeRows.get(`${source}:${id}`);
        if (!row) return;
        const message = row.manual
            ? 'Delete this manually entered finance record?'
            : 'Hide this synced record from the Finance ledger? The source record in its module will not be deleted.';
        if (!window.confirm(message)) return;
        if (source === 'petty') {
            write(KEYS.petty, read(KEYS.petty, []).filter(entry => String(entry.id) !== id));
            const receipts = read(KEYS.receipts, {});
            delete receipts[`petty:${id}`];
            write(KEYS.receipts, receipts);
        } else if (row.manual && id.startsWith('manual:')) {
            const entryId = id.slice('manual:'.length);
            write(KEYS.manual, read(KEYS.manual, []).filter(entry => String(entry.id) !== entryId));
            const receipts = read(KEYS.receipts, {});
            delete receipts[`${source}:manual:${entryId}`];
            write(KEYS.receipts, receipts);
        } else if (row.manual && id.startsWith('transaction:')) {
            const overrides = read(KEYS.overrides, {});
            overrides[`${source}:${id}`] = { hidden: true };
            write(KEYS.overrides, overrides);
        } else {
            const overrides = read(KEYS.overrides, {});
            overrides[`${source}:${id}`] = { hidden: true };
            write(KEYS.overrides, overrides);
        }
        renderFinance();
    }

    function synchronizeRanges(event) {
        if (event.target.matches('.finance-range-filter')) {
            document.querySelectorAll('.finance-range-filter').forEach(select => { select.value = event.target.value; });
        }
        if (event.target.matches('.finance-range-start, .finance-range-end')) {
            const isStart = event.target.classList.contains('finance-range-start');
            document.querySelectorAll(isStart ? '.finance-range-start' : '.finance-range-end').forEach(input => { input.value = event.target.value; });
        }
        const custom = document.querySelector('.finance-range-filter')?.value === 'custom';
        document.querySelectorAll('.finance-range-start, .finance-range-end').forEach(input => input.classList.toggle('d-none', !custom));
        renderFinance();
    }

    function handleFinanceAction(event) {
        const button = event.target.closest('[data-finance-action]');
        if (!button) return;
        const id = decodeURIComponent(button.dataset.id || '');
        const source = button.dataset.source;
        const row = activeRows.get(`${source}:${id}`) || (source === 'petty' ? pettyRows().find(item => item.id === id) : null);
        if (button.dataset.financeAction === 'edit' && row) openEntryModal(source, row);
        if (button.dataset.financeAction === 'delete') removeEntry(source, id);
    }

    function initialize() {
        if (!document.getElementById('finance-master-dashboard')) return;
        ensureModal();
        bindExclusiveTabs(
            ['finance-customer-tab', 'finance-dealer-tab', 'finance-online-tab'],
            ['finance-customer-panel', 'finance-dealer-panel', 'finance-online-panel']
        );
        bindExclusiveTabs(
            ['stock-running-tab', 'stock-slow-tab'],
            ['stock-running-panel', 'stock-slow-panel']
        );
        document.querySelectorAll('.finance-range-filter, .finance-range-start, .finance-range-end').forEach(element =>
            element.addEventListener('change', synchronizeRanges));
        document.querySelectorAll('.finance-range-start, .finance-range-end').forEach(element =>
            element.classList.toggle('d-none', document.querySelector('.finance-range-filter').value !== 'custom'));
        document.getElementById('finance-add-ledger').addEventListener('click', () => openEntryModal('customer'));
        document.getElementById('finance-add-petty').addEventListener('click', () => openEntryModal('petty'));
        document.querySelectorAll('.finance-add-source').forEach(button => button.addEventListener('click', () => openEntryModal(button.dataset.source)));
        document.addEventListener('click', handleFinanceAction);

        const previousRender = window.renderAllERPModules;
        if (typeof previousRender === 'function') {
            window.renderAllERPModules = function () {
                previousRender.apply(this, arguments);
                renderFinance();
            };
        }
        window.addEventListener('storage', event => {
            if (!event.key || watchedKeys.has(event.key)) renderFinance();
        });
        window.addEventListener('gug:finance-refresh', renderFinance);
        window.GUG_FINANCE_LEDGER = {
            refresh: renderFinance,
            getRows: sourceRows,
            getSummary: financeSummary,
            addExpense(expense) {
                if (!expense || !expense.date || amount(expense.amount) <= 0) {
                    throw new Error('A payroll expense requires a valid positive amount and date.');
                }
                const entries = read(KEYS.payrollExpenses, []);
                entries.unshift({
                    id: expense.id || `PAYROLL-${Date.now()}`,
                    employeeName: expense.employeeName || 'Employee',
                    description: expense.description || 'Employee payroll',
                    amount: amount(expense.amount),
                    date: expense.date,
                    method: expense.method || 'Payroll',
                    receiptName: expense.receiptName || ''
                });
                write(KEYS.payrollExpenses, entries);
                return entries[0];
            }
        };
        renderFinance();
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();
