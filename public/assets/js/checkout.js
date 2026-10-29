/* ==========================================================================
   Gear Up Gadgets - Checkout Page JS (Dynamic Shipping & Coupon Support)
   ========================================================================== */

function initCheckoutPage() {
    renderCheckoutSummary();
    window.checkoutPaymentCapture = window.GUG_PAYMENT_METHODS.mount({
        form: document.querySelector('form[onsubmit="handlePlaceOrder(event)"]'),
        prefix: 'checkout',
        methodId: 'checkout-payment-method',
        amountId: 'checkout-paid-amount',
        amountLabel: 'Paid Amount (PKR)',
        total: () => getCalculatedOrderTotals(getCart()).total
    });
}

function getCalculatedOrderTotals(cart) {
    const subtotal = cart.reduce((sum, item) => {
        const cleanPrice = parseFloat(String(item.price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
        return sum + (cleanPrice * item.qty);
    }, 0);

    // Retrieve Admin-Defined Dynamic Shipping Rate from Central ERP
    const shippingConfig = (window.GUG_DB && typeof window.GUG_DB.getShippingConfig === 'function') 
        ? window.GUG_DB.getShippingConfig() 
        : { rate: Number(localStorage.getItem('gug_shipping_rate')) || 350, freeThreshold: 0 };

    const configuredRate = Number(shippingConfig.rate !== undefined ? shippingConfig.rate : 350);
    let baseShipping = subtotal > 0 ? configuredRate : 0;

    // Check optional admin free threshold
    if (shippingConfig.freeThreshold > 0 && subtotal >= shippingConfig.freeThreshold) {
        baseShipping = 0;
    }

    const activeCouponCode = localStorage.getItem('active_coupon');
    let discount = 0;
    let shipping = baseShipping;
    let couponResult = null;

    if (activeCouponCode) {
        if (window.GUG_DB && typeof window.GUG_DB.validateCoupon === 'function') {
            couponResult = window.GUG_DB.validateCoupon(activeCouponCode, subtotal);
        } else {
            const clean = activeCouponCode.toUpperCase();
            if (clean === 'FREESHIP' || clean === 'FREESHIPPING') {
                couponResult = { valid: true, code: clean, isFreeShipping: true, discountAmount: 0 };
            } else if (clean === 'GEARUP10') {
                couponResult = { valid: true, code: clean, isFreeShipping: false, discountAmount: Math.round(subtotal * 0.10) };
            } else if (clean === 'WELCOME5') {
                couponResult = { valid: true, code: clean, isFreeShipping: false, discountAmount: Math.round(subtotal * 0.05) };
            }
        }

        if (couponResult && couponResult.valid) {
            if (couponResult.isFreeShipping) {
                shipping = 0;
            } else {
                discount = couponResult.discountAmount || 0;
            }
        }
    }

    const total = Math.max(0, subtotal - discount + shipping);

    return {
        subtotal,
        baseShipping,
        shipping,
        discount,
        total,
        couponResult,
        shippingConfig
    };
}

function renderCheckoutSummary() {
    const list = document.getElementById('checkout-summary-list');
    const totalsContainer = document.getElementById('checkout-summary-totals');
    
    if (!list || !totalsContainer) return;

    const cart = getCart();
    if (cart.length === 0) {
        window.location.href = 'cart.html';
        return;
    }

    // Render items list
    list.innerHTML = cart.map(item => {
        const cleanPrice = parseFloat(String(item.price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
        return `
            <div class="d-flex justify-content-between align-items-center mb-3" style="font-size: 13px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <span class="text-secondary" style="max-width: 75%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">
                    ${item.name} <strong class="text-danger ms-1">x ${item.qty}</strong>
                </span>
                <span class="text-white fw-semibold">Rs. ${formatPrice(cleanPrice * item.qty)}</span>
            </div>
        `;
    }).join('');

    // Calculate totals with dynamic shipping and coupons
    const totals = getCalculatedOrderTotals(cart);
    let paymentDetails;
    try {
        paymentDetails = window.checkoutPaymentCapture.collect();
    } catch (error) {
        showToast(error.message, 'error');
        return;
    }
    let discountRowHTML = '';

    if (totals.couponResult && totals.couponResult.valid) {
        if (totals.couponResult.isFreeShipping) {
            discountRowHTML = `
                <div class="d-flex justify-content-between mb-3 text-success" style="font-size: 14px;">
                    <span><i class="fas fa-ticket-alt me-1"></i> Free Shipping Coupon (${totals.couponResult.code}):</span>
                    <span class="fw-bold">Waived (-Rs. ${formatPrice(totals.baseShipping)})</span>
                </div>
            `;
        } else if (totals.discount > 0) {
            discountRowHTML = `
                <div class="d-flex justify-content-between mb-3 text-success" style="font-size: 14px;">
                    <span><i class="fas fa-ticket-alt me-1"></i> Discount (${totals.couponResult.code}):</span>
                    <span class="fw-bold">-Rs. ${formatPrice(totals.discount)}</span>
                </div>
            `;
        }
    }

    // Format shipping fee display
    let shippingDisplayHTML = '';
    if (totals.shipping === 0) {
        if (totals.couponResult && totals.couponResult.isFreeShipping) {
            shippingDisplayHTML = `<span class="text-success fw-bold"><span class="text-secondary text-decoration-line-through me-1" style="font-size: 12px;">Rs. ${formatPrice(totals.baseShipping)}</span>Free Shipping <span class="badge bg-success ms-1">Coupon</span></span>`;
        } else {
            shippingDisplayHTML = `<span class="text-success fw-bold">Free Shipping</span>`;
        }
    } else {
        shippingDisplayHTML = `<span class="text-white fw-semibold">Rs. ${formatPrice(totals.shipping)}</span>`;
    }

    totalsContainer.innerHTML = `
        <div class="d-flex justify-content-between mb-3" style="font-size: 14px;">
            <span class="text-secondary">Subtotal:</span>
            <span class="text-white fw-semibold">Rs. ${formatPrice(totals.subtotal)}</span>
        </div>
        ${discountRowHTML}
        <div class="d-flex justify-content-between mb-3" style="font-size: 14px;">
            <span class="text-secondary">Shipping Fee:</span>
            <div>${shippingDisplayHTML}</div>
        </div>
        <div class="d-flex justify-content-between mb-0 pt-3 border-top" style="border-color: var(--border-color) !important; font-size: 18px;">
            <span class="text-white fw-bold">Grand Total:</span>
            <span class="text-danger fw-bold" style="color: var(--accent-red);">Rs. ${formatPrice(totals.total)}</span>
        </div>
    `;
}

function handlePlaceOrder(event) {
    event.preventDefault();

    // Grab form fields
    const firstName = document.getElementById('checkout-fname').value.trim();
    const lastName = document.getElementById('checkout-lname').value.trim();
    const address = document.getElementById('checkout-address').value.trim();
    const city = document.getElementById('checkout-city').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    const notes = document.getElementById('checkout-notes').value.trim();

    if (!firstName || !lastName || !address || !city || !phone || !email) {
        showToast('Please fill out all required fields.', 'error');
        return;
    }

    const cart = getCart();
    if (cart.length === 0) {
        showToast('Your cart is empty.', 'error');
        return;
    }

    const totals = getCalculatedOrderTotals(cart);
    const activeCoupon = localStorage.getItem('active_coupon');

    // Generate Order ID (Tracking ID)
    const orderId = `GUG-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const paymentMethodLabel = paymentDetails.paymentMethod;
    const paymentHistory = paymentDetails.paidAmount > 0 ? [{
        id: `CRM-PAY-${Date.now()}`,
        amount: paymentDetails.paidAmount,
        date: paymentDetails.transactionAt,
        timestamp: paymentDetails.transactionAt,
        method: paymentDetails.paymentMethod,
        paymentMethod: paymentDetails.paymentMethod,
        bankNetwork: paymentDetails.bankNetwork,
        reference: paymentDetails.transactionReference || orderId,
        transactionReference: paymentDetails.transactionReference,
        receiptName: paymentDetails.receiptName,
        receiptData: paymentDetails.receiptData,
        balanceAfter: paymentDetails.balanceAmount
    }] : [];

    const orderDetails = {
        id: orderId,
        customer: {
            name: `${firstName} ${lastName}`,
            address: address,
            city: city,
            phone: phone,
            email: email
        },
        name: `${firstName} ${lastName}`,
        address: address,
        city: city,
        phone: phone,
        email: email,
        notes: notes,
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping,
        total: totals.total,
        coupon: activeCoupon || null,
        items: cart.map(item => {
            const cleanPrice = parseFloat(String(item.price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
            return {
                id: item.id || 'PROD-GEN',
                title: item.name,
                name: item.name,
                price: cleanPrice,
                costPrice: Math.round(cleanPrice * 0.65),
                quantity: item.qty,
                sku: item.sku || 'GUG-SKU',
                image: item.image || '',
                category: item.category || ''
            };
        }),
        payment: paymentMethodLabel,
        paymentMethod: paymentMethodLabel,
        paymentStatus: paymentDetails.balanceAmount === 0 && paymentDetails.paidAmount > 0 ? 'Paid' : 'Pending',
        paidAmount: paymentDetails.paidAmount,
        balanceAmount: paymentDetails.balanceAmount,
        paymentReference: paymentDetails.transactionReference,
        bankNetwork: paymentDetails.bankNetwork,
        transactionAt: paymentDetails.transactionAt,
        paymentHistory,
        orderStatus: 'New Order',
        status: 'Pending',
        archived: false,
        date: new Date().toISOString()
    };

    // Synchronize through Centralized GUG ERP Core Engine
    if (window.GUG_DB && typeof window.GUG_DB.processStorefrontOrder === 'function') {
        window.GUG_DB.processStorefrontOrder(orderDetails);
    } else {
        // Fallback to local admin orders store
        let adminOrders = JSON.parse(localStorage.getItem('admin_orders')) || [];
        adminOrders.unshift(orderDetails);
        localStorage.setItem('admin_orders', JSON.stringify(adminOrders));
    }

    // Direct Cloud Firestore Synchronization
    if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveOrder === 'function') {
        window.GUG_FIREBASE.saveOrder(orderDetails);
    }

    // Show Success Panel
    renderOrderSuccess(orderId, orderDetails);

    // Clear Cart & Coupon
    clearCart();
    localStorage.removeItem('active_coupon');
}

function renderOrderSuccess(orderId, orderDetails) {
    const checkoutContainer = document.getElementById('checkout-grid-container');
    if (!checkoutContainer) return;

    checkoutContainer.innerHTML = `
        <div class="col-lg-8 offset-lg-2">
            <div class="p-5 rounded-3 text-center" style="background-color: var(--bg-card); border: 1px solid var(--border-color); box-shadow: var(--shadow-md);">
                <div class="mb-4" style="color: var(--accent-green); font-size: 64px;">
                    <i class="icon icon-check-circle-solid"></i>
                </div>
                <h2 class="text-white fw-bold mb-2">ORDER PLACED SUCCESSFULLY!</h2>
                <p class="text-secondary mb-4">Thank you for your order. We have received your order details and are preparing shipment.</p>
                
                <div class="p-4 rounded-3 text-start mb-4" style="background-color: var(--bg-main); border: 1px solid var(--border-color); font-size: 14px;">
                    <div class="d-flex justify-content-between mb-3 pb-2 border-bottom" style="border-color: var(--border-color) !important;">
                        <span class="text-secondary">Order ID:</span>
                        <strong class="text-white">${orderId}</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-3 pb-2 border-bottom" style="border-color: var(--border-color) !important;">
                        <span class="text-secondary">Customer:</span>
                        <span class="text-white fw-semibold">${orderDetails.name}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-3 pb-2 border-bottom" style="border-color: var(--border-color) !important;">
                        <span class="text-secondary">Phone Number:</span>
                        <span class="text-white fw-semibold">${orderDetails.phone}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-3 pb-2 border-bottom" style="border-color: var(--border-color) !important;">
                        <span class="text-secondary">Shipping Address:</span>
                        <span class="text-white fw-semibold text-end" style="max-width: 60%;">${orderDetails.address}, ${orderDetails.city}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-3 pb-2 border-bottom" style="border-color: var(--border-color) !important;">
                        <span class="text-secondary">Payment Method:</span>
                        <span class="text-white fw-semibold">${orderDetails.payment}</span>
                    </div>
                    <div class="d-flex justify-content-between pt-1">
                        <span class="text-secondary">Total Amount Paid:</span>
                        <strong class="text-danger" style="color: var(--accent-red); font-size: 16px;">Rs. ${formatPrice(orderDetails.total)}</strong>
                    </div>
                </div>

                <div class="d-flex justify-content-center gap-3">
                    <a href="index.html" class="btn btn-outline-light px-4 py-2" style="font-weight: bold;">BACK TO HOME</a>
                    <a href="shop.html" class="btn btn-danger px-4 py-2 fw-bold" style="background-color: var(--accent-red); border: none;">CONTINUE SHOPPING</a>
                </div>
            </div>
        </div>
    `;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleCheckoutApplyCoupon() {
    const input = document.getElementById('checkout-coupon-input');
    if (!input) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
        showToast('Please enter a promo or free shipping coupon code.', 'error');
        return;
    }

    const cart = getCart();
    const subtotal = cart.reduce((sum, item) => {
        const cleanPrice = parseFloat(String(item.price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
        return sum + (cleanPrice * item.qty);
    }, 0);

    let result = null;
    if (window.GUG_DB && typeof window.GUG_DB.validateCoupon === 'function') {
        result = window.GUG_DB.validateCoupon(code, subtotal);
    } else {
        if (code === 'FREESHIP' || code === 'FREESHIPPING') {
            result = { valid: true, isFreeShipping: true, code: code };
        } else if (code === 'GEARUP10' || code === 'WELCOME5') {
            result = { valid: true, isFreeShipping: false, code: code };
        } else {
            result = { valid: false, message: 'Invalid coupon code.' };
        }
    }

    if (result && result.valid) {
        localStorage.setItem('active_coupon', result.code);
        if (result.isFreeShipping) {
            showToast(`Coupon "${result.code}" applied! Free Shipping activated.`, 'success');
        } else {
            showToast(`Coupon "${result.code}" applied successfully!`, 'success');
        }
        renderCheckoutSummary();
    } else {
        showToast(result ? result.message : 'Invalid coupon code.', 'error');
    }
}

function handleCheckoutRemoveCoupon() {
    localStorage.removeItem('active_coupon');
    const input = document.getElementById('checkout-coupon-input');
    if (input) input.value = '';
    showToast('Coupon removed.', 'info');
    renderCheckoutSummary();
}

document.addEventListener('DOMContentLoaded', () => {
    initCheckoutPage();
    const active = localStorage.getItem('active_coupon');
    const input = document.getElementById('checkout-coupon-input');
    if (active && input) {
        input.value = active;
    }
});

