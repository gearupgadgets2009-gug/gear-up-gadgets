(function () {
    'use strict';

    const METHODS = ['Cash', 'Online', 'Bank'];
    const NETWORKS = {
        Online: ['EasyPaisa', 'JazzCash', 'NayaPay', 'SadaPay'],
        Bank: [
            'Meezan Bank', 'HBL', 'Allied Bank', 'Bank Alfalah', 'UBL',
            'MCB Bank', 'National Bank of Pakistan', 'Faysal Bank',
            'Askari Bank', 'Standard Chartered', 'Bank Al Habib'
        ]
    };
    const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
    const normalizeMethod = value => {
        const method = String(value == null ? '' : value).trim().toLowerCase();
        if (method === 'cash' || method.includes('cash on delivery') || method.includes('direct cash')) return 'Cash';
        if (method === 'online' || method.includes('online') || method.includes('jazzcash') ||
            method.includes('easypaisa') || method.includes('nayapay') || method.includes('sadapay')) return 'Online';
        if (method === 'bank' || method.includes('bank transfer') || method.includes('bank wire') ||
            method.includes('bank payment')) return 'Bank';
        return METHODS.includes(value) ? value : 'Cash';
    };
    const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);

    function money(value) {
        const numeric = Number(value);
        return `Rs. ${Number.isFinite(numeric) ? numeric.toLocaleString('en-PK') : '0'}`;
    }

    function nowLocal(value) {
        return new Date(value || Date.now()).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'medium' });
    }

    function mount(options) {
        const form = typeof options.form === 'string' ? document.getElementById(options.form) : options.form;
        if (!form) return null;
        const prefix = options.prefix;
        const details = options.existingDetails || {};
        const method = document.getElementById(options.methodId || `${prefix}-method`);
        if (method && method.tagName === 'SELECT') {
            method.innerHTML = METHODS.map(value => `<option value="${value}">${value}</option>`).join('');
            method.value = normalizeMethod(details.paymentMethod || options.defaultMethod);
        }
        const amount = document.getElementById(options.amountId);
        const total = typeof options.total === 'function' ? options.total : () => {
            const element = document.getElementById(options.totalId);
            return element ? Number(element.value || element.dataset.paymentTotal || 0) : 0;
        };
        let fields = document.getElementById(`${prefix}-payment-details`);
        if (!fields) {
            fields = document.createElement('div');
            fields.id = `${prefix}-payment-details`;
            fields.className = 'payment-method-fields row g-3 mt-2';
            fields.innerHTML = `
                <div class="col-md-6 payment-cash-balance">
                    <label class="form-label small fw-bold" for="${prefix}-balance">Balance Amount</label>
                    <output id="${prefix}-balance" class="form-control payment-balance-output">Rs. 0</output>
                </div>
                <div class="col-md-6 payment-digital-field">
                    <label class="form-label small fw-bold" id="${prefix}-network-label" for="${prefix}-network">Online Platform</label>
                    <select class="form-select" id="${prefix}-network">
                        <option value="">Select a platform</option>
                    </select>
                </div>
                <div class="col-md-6 payment-digital-field">
                    <label class="form-label small fw-bold" for="${prefix}-reference">Reference Number / Transaction ID</label>
                    <input type="text" class="form-control" id="${prefix}-reference" maxlength="180" placeholder="Transaction reference">
                </div>
                <div class="col-md-6 payment-digital-field">
                    <label class="form-label small fw-bold" for="${prefix}-receipt">Upload Screenshot (optional)</label>
                    <input type="file" class="form-control" id="${prefix}-receipt" accept="image/*">
                    <small class="payment-receipt-status text-muted">Image receipts up to 2 MB.</small>
                </div>
                <div class="col-12">
                    <label class="form-label small fw-bold" for="${prefix}-timestamp">Transaction Date &amp; Time</label>
                    <input type="text" class="form-control payment-timestamp" id="${prefix}-timestamp" readonly>
                </div>
                <div class="col-12 payment-capture-error text-danger small" role="alert"></div>`;
            const insertionPoint = method ? method.closest('.mb-3, .col-md-6, .col-12, .row') : null;
            if (insertionPoint && insertionPoint.parentElement) insertionPoint.insertAdjacentElement('afterend', fields);
            else form.querySelector('.modal-body, .modal-content, fieldset')?.appendChild(fields);
        }

        const update = () => {
            if (!fields) return;
            const selectedMethod = normalizeMethod(method && method.value);
            if (method && method.value !== selectedMethod) method.value = selectedMethod;
            if (selectedMethod !== lastMethod && network) network.dataset.selectedNetwork = '';
            const isCash = selectedMethod === 'Cash';
            fields.querySelectorAll('.payment-cash-balance').forEach(element => element.hidden = !isCash);
            fields.querySelectorAll('.payment-digital-field').forEach(element => element.hidden = isCash);
            if (network && network.dataset.networkMethod !== selectedMethod) {
                const networks = NETWORKS[selectedMethod] || [];
                const selectedNetwork = network.dataset.selectedNetwork || '';
                const preservedNetwork = selectedNetwork && !networks.includes(selectedNetwork)
                    ? [selectedNetwork, ...networks]
                    : networks;
                network.innerHTML = `<option value="">Select ${selectedMethod === 'Online' ? 'a platform' : 'a bank'}</option>` +
                    preservedNetwork.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
                network.value = selectedNetwork;
                network.dataset.networkMethod = selectedMethod;
            }
            const networkLabel = document.getElementById(`${prefix}-network-label`);
            if (networkLabel) networkLabel.textContent = selectedMethod === 'Bank' ? 'Bank' : 'Online Platform';
            const paid = amount ? Number(amount.value || 0) : 0;
            const due = Number(total()) || 0;
            const output = document.getElementById(`${prefix}-balance`);
            if (output) output.value = money(Math.max(0, due - paid));
            const error = fields.querySelector('.payment-capture-error');
            if (error) error.textContent = '';
            lastMethod = selectedMethod;
        };
        const network = document.getElementById(`${prefix}-network`);
        const reference = document.getElementById(`${prefix}-reference`);
        const timestamp = document.getElementById(`${prefix}-timestamp`);
        const initialMethod = normalizeMethod(method && method.value);
        let lastMethod = initialMethod;
        if (network) {
            network.dataset.selectedNetwork =
                normalizeMethod(details.paymentMethod || options.defaultMethod) === initialMethod
                    ? details.bankNetwork || ''
                    : '';
            network.dataset.networkMethod = '';
            if (!network.dataset.paymentHelperBound) {
                network.addEventListener('change', () => {
                    network.dataset.selectedNetwork = network.value;
                });
                network.dataset.paymentHelperBound = 'true';
            }
        }
        if (method && !method.dataset.paymentHelperBound) {
            method.addEventListener('change', () => {
                if (typeof method.paymentHelperUpdate === 'function') method.paymentHelperUpdate();
            });
            method.dataset.paymentHelperBound = 'true';
        }
        if (method) method.paymentHelperUpdate = update;
        if (amount && !amount.dataset.paymentHelperBound) {
            amount.addEventListener('input', () => {
                if (method && typeof method.paymentHelperUpdate === 'function') method.paymentHelperUpdate();
            });
            amount.dataset.paymentHelperBound = 'true';
        }
        if (reference) reference.value = details.transactionReference || details.reference || '';
        fields.dataset.receiptData = details.receiptData || '';
        fields.dataset.receiptName = details.receiptName || '';
        fields.dataset.receiptReading = 'false';
        const receiptStatus = fields.querySelector('.payment-receipt-status');
        if (receiptStatus) {
            receiptStatus.textContent = details.receiptName
                ? `Existing receipt: ${details.receiptName}`
                : 'Image receipts up to 2 MB.';
        }
        if (timestamp) {
            const instant = details.transactionAt ? new Date(details.transactionAt) : new Date();
            timestamp.dataset.transactionAt = Number.isNaN(instant.getTime()) ? new Date().toISOString() : instant.toISOString();
            timestamp.value = nowLocal(timestamp.dataset.transactionAt);
        }
        fields.onchange = event => {
            if (event.target.id !== `${prefix}-receipt`) return;
            const file = event.target.files && event.target.files[0];
            const status = fields.querySelector('.payment-receipt-status');
            if (!file) return;
            if (!file.type.startsWith('image/') || file.size > MAX_RECEIPT_BYTES) {
                event.target.value = '';
                const error = fields.querySelector('.payment-capture-error');
                if (error) error.textContent = 'Choose an image receipt no larger than 2 MB.';
                if (status) status.textContent = 'Image receipts up to 2 MB.';
                return;
            }
            fields.dataset.receiptReading = 'true';
            const reader = new FileReader();
            reader.onload = () => {
                fields.dataset.receiptData = String(reader.result || '');
                fields.dataset.receiptName = file.name;
                fields.dataset.receiptReading = 'false';
                if (status) status.textContent = `Attached: ${file.name}`;
            };
            reader.onerror = () => {
                fields.dataset.receiptReading = 'false';
                const error = fields.querySelector('.payment-capture-error');
                if (error) error.textContent = 'Could not read the selected payment screenshot.';
            };
            reader.readAsDataURL(file);
        };
        if (amount && options.amountLabel) {
            const label = form.querySelector(`label[for="${options.amountId}"]`);
            if (label) label.textContent = options.amountLabel;
        }
        if (amount) amount.dataset.paymentTotal = String(Number(total()) || 0);
        update();
        return {
            collect() {
                const selectedMethod = normalizeMethod(method && method.value);
                const paidAmount = amount ? Number(amount.value || 0) : 0;
                const due = Number(total()) || 0;
                const receiptData = fields.dataset.receiptData || '';
                if (fields.dataset.receiptReading === 'true') {
                    throw new Error('Wait for the payment screenshot to finish loading before saving.');
                }
                if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > due) {
                    throw new Error(`Paid Amount must be between Rs. 0 and ${money(due)}.`);
                }
                if (selectedMethod !== 'Cash' && (!network?.value.trim() || !reference?.value.trim())) {
                    throw new Error('Select the payment platform or bank and enter the Reference Number for digital payments.');
                }
                return {
                    paymentMethod: selectedMethod,
                    method: selectedMethod,
                    bankNetwork: network?.value.trim() || '',
                    paymentPlatform: selectedMethod === 'Online' ? network?.value.trim() || '' : '',
                    bankName: selectedMethod === 'Bank' ? network?.value.trim() || '' : '',
                    reference: reference?.value.trim() || '',
                    transactionReference: reference?.value.trim() || '',
                    paidAmount,
                    balanceAmount: Math.max(0, due - paidAmount),
                    transactionAt: timestamp && timestamp.dataset.transactionAt
                        ? timestamp.dataset.transactionAt
                        : new Date().toISOString(),
                    receiptName: fields.dataset.receiptName || '',
                    receiptData
                };
            },
            refresh: update
        };
    }

    function printMarkup(payment) {
        const record = payment || {};
        const method = record.paymentMethod || record.method || record.payment || 'Not recorded';
        const paid = Number(record.paidAmount || 0);
        const balance = Number(record.balanceAmount || 0);
        const reference = record.transactionReference || record.paymentReference || record.reference || '';
        return `<div class="payment-print-summary"><strong>Payment Method:</strong> ${escapeHTML(method)}<br>
            ${reference ? `<strong>Reference Number:</strong> ${escapeHTML(reference)}<br>` : ''}
            <strong>Paid Amount:</strong> ${money(paid)}<br><strong>Balance Amount:</strong> ${money(balance)}</div>`;
    }

    window.GUG_PAYMENT_METHODS = { methods: METHODS, mount, printMarkup };
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.payment-method-fields').forEach(fields => fields.classList.add('payment-method-ready'));
    });
})();
