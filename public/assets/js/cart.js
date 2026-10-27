/* ==========================================================================
   Gear Up Gadgets - Shopping Cart Page JS (Dynamic Shipping & Coupon Support)
   ========================================================================== */

function initCartPage() {
    renderCart();
    
    // Listen for custom cart updates and storage events
    window.addEventListener('cartUpdated', renderCart);
    window.addEventListener('storage', (e) => {
        if (e.key === 'gear_up_cart' || e.key === 'active_coupon') {
            renderCart();
        }
    });

    // Event delegation on table body for remove and quantity adjustment
    const tableBody = document.getElementById('cart-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            const removeBtn = e.target.closest('.btn-remove-item');
            if (removeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = removeBtn.getAttribute('data-id');
                if (id) {
                    if (typeof window.removeFromCart === 'function') {
                        window.removeFromCart(id);
                    }
                    renderCart();
                }
                return;
            }

            const minusBtn = e.target.closest('.btn-qty-minus');
            if (minusBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = minusBtn.getAttribute('data-id');
                if (id) {
                    changeQty(id, -1);
                }
                return;
            }

            const plusBtn = e.target.closest('.btn-qty-plus');
            if (plusBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = plusBtn.getAttribute('data-id');
                if (id) {
                    changeQty(id, 1);
                }
                return;
            }
        });
    }
}

function renderCart() {
    const tableBody = document.getElementById('cart-table-body');
    const summaryContainer = document.getElementById('cart-summary-container');
    const mainRow = document.getElementById('cart-main-row');
    const emptyMsg = document.getElementById('cart-empty-message');

    if (!tableBody || !mainRow || !emptyMsg) return;

    const cart = (typeof getCart === 'function') ? getCart() : (JSON.parse(localStorage.getItem('gear_up_cart') || '[]'));

    if (!cart || cart.length === 0) {
        mainRow.style.setProperty('display', 'none', 'important');
        emptyMsg.style.display = 'block';
        return;
    }

    mainRow.style.display = 'flex';
    emptyMsg.style.display = 'none';

    // Render items in table
    tableBody.innerHTML = cart.map(item => {
        const cleanPrice = parseFloat(String(item.price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
        const currentQty = parseInt(item.qty, 10) || 1;
        const subtotal = cleanPrice * currentQty;
        const safeId = String(item.id).replace(/'/g, "\\'");
        
        return `
            <tr data-cart-item-id="${item.id}">
                <td style="border-color: var(--border-color);">
                    <div class="d-flex align-items-center gap-3">
                        <button type="button" class="btn btn-sm text-danger border-0 p-1 btn-remove-item" data-id="${item.id}" title="Remove item" aria-label="Remove item" style="background: none; font-size: 16px; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='none'">
                            <i class="icon icon-times-solid"></i>
                        </button>
                        <img src="${item.image || 'assets/images/logo.png'}" alt="${item.name || ''}" style="width: 52px; height: 52px; object-fit: contain; background: white; padding: 3px; border-radius: 6px; border: 1px solid var(--border-color);">
                        <span class="cart-item-title fw-bold">
                            <a href="product.html?id=${encodeURIComponent(item.id)}" style="color: var(--text-primary, #ffffff); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-red, #E50303)'" onmouseout="this.style.color='var(--text-primary, #ffffff)'">${item.name}</a>
                        </span>
                    </div>
                </td>
                <td class="text-white fw-semibold" style="border-color: var(--border-color); white-space: nowrap;">Rs. ${formatPrice(cleanPrice)}</td>
                <td style="border-color: var(--border-color);">
                    <div style="display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 6px; background-color: var(--bg-main); width: fit-content; overflow: hidden;">
                        <button type="button" class="btn btn-sm text-secondary btn-qty-minus" style="border: none; padding: 6px 12px; background: transparent; cursor: pointer; font-size: 14px; font-weight: bold;" data-id="${item.id}" aria-label="Decrease quantity" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">-</button>
                        <span class="text-white fw-bold px-2 qty-display" style="min-width: 30px; text-align: center; font-size: 14px;">${currentQty}</span>
                        <button type="button" class="btn btn-sm text-secondary btn-qty-plus" style="border: none; padding: 6px 12px; background: transparent; cursor: pointer; font-size: 14px; font-weight: bold;" data-id="${item.id}" aria-label="Increase quantity" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-secondary)'">+</button>
                    </div>
                </td>
                <td class="text-danger fw-bold" style="border-color: var(--border-color); color: var(--accent-red); white-space: nowrap;">Rs. ${formatPrice(subtotal)}</td>
            </tr>
        `;
    }).join('');

    // Calculate Subtotal
    const subtotal = cart.reduce((sum, item) => {
        const cleanPrice = parseFloat(String(item.price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
        return sum + (cleanPrice * (parseInt(item.qty, 10) || 1));
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

    // Check active coupon and validate
    const activeCouponCode = localStorage.getItem('active_coupon');
    let discount = 0;
    let shipping = baseShipping;
    let discountRowHTML = '';
    let couponAppliedBadge = '';

    if (activeCouponCode) {
        let couponResult = null;
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
                discountRowHTML = `
                    <div class="d-flex justify-content-between mb-3 text-success">
                        <span><i class="fas fa-ticket-alt me-1"></i> Coupon (${couponResult.code}):</span>
                        <span class="fw-bold">Free Delivery (-Rs. ${formatPrice(baseShipping)})</span>
                    </div>
                `;
                couponAppliedBadge = `<span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-50 ms-2" style="font-size: 11px;">Coupon Applied</span>`;
            } else {
                discount = couponResult.discountAmount || 0;
                discountRowHTML = `
                    <div class="d-flex justify-content-between mb-3 text-success">
                        <span><i class="fas fa-ticket-alt me-1"></i> Discount (${couponResult.code}):</span>
                        <span class="fw-bold">-Rs. ${formatPrice(discount)}</span>
                    </div>
                `;
            }
        } else if (couponResult && !couponResult.valid) {
            discountRowHTML = `
                <div class="alert alert-warning p-2 small mb-3">
                    <i class="fas fa-exclamation-triangle me-1"></i> ${couponResult.message}
                </div>
            `;
        }
    }

    const total = Math.max(0, subtotal - discount + shipping);

    let shippingDisplayHTML = '';
    if (shipping === 0) {
        if (activeCouponCode && couponAppliedBadge) {
            shippingDisplayHTML = `<span class="text-success fw-bold"><span class="text-secondary text-decoration-line-through me-1" style="font-size: 12px;">Rs. ${formatPrice(baseShipping)}</span>Free Shipping ${couponAppliedBadge}</span>`;
        } else {
            shippingDisplayHTML = `<span class="text-success fw-bold">Free Shipping</span>`;
        }
    } else {
        shippingDisplayHTML = `<span class="text-white fw-semibold">Rs. ${formatPrice(shipping)}</span>`;
    }

    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="p-4 rounded-3" style="background-color: var(--bg-card); border: 1px solid var(--border-color);">
                <h5 class="text-white fw-bold mb-4" style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">CART TOTALS</h5>
                
                <div class="d-flex justify-content-between mb-3">
                    <span class="text-secondary">Subtotal:</span>
                    <span class="text-white fw-semibold">Rs. ${formatPrice(subtotal)}</span>
                </div>
                
                ${discountRowHTML}

                <div class="d-flex justify-content-between mb-3">
                    <span class="text-secondary">Shipping Fee:</span>
                    <div>${shippingDisplayHTML}</div>
                </div>
                
                <div class="d-flex justify-content-between mb-4 pt-3 border-top" style="border-color: var(--border-color) !important; font-size: 18px;">
                    <span class="text-white fw-bold">Grand Total:</span>
                    <span class="text-danger fw-bold" style="color: var(--accent-red);">Rs. ${formatPrice(total)}</span>
                </div>

                <button class="btn-checkout w-100 py-3 text-center fw-bold" onclick="window.location.href='checkout.html'">
                    PROCEED TO CHECKOUT
                </button>
            </div>
        `;
    }
}

let _lastQtyChangeTime = 0;
let _lastQtyChangeId = null;

function changeQty(productId, delta) {
    if (!productId) return;
    const now = Date.now();
    const targetIdStr = String(productId).trim().toLowerCase();

    // Guard: ignore rapid accidental duplicate executions within 250ms
    if (_lastQtyChangeId === targetIdStr && (now - _lastQtyChangeTime) < 250) {
        return;
    }
    _lastQtyChangeId = targetIdStr;
    _lastQtyChangeTime = now;

    const cart = (typeof getCart === 'function') ? getCart() : (JSON.parse(localStorage.getItem('gear_up_cart') || '[]'));
    const item = cart.find(i => String(i.id).trim().toLowerCase() === targetIdStr);
    if (item) {
        const currentQty = parseInt(item.qty, 10) || 1;
        const newQty = currentQty + delta;
        if (newQty <= 0) {
            if (typeof removeFromCart === 'function') {
                removeFromCart(productId);
            } else {
                const updated = cart.filter(i => String(i.id).trim().toLowerCase() !== targetIdStr);
                saveCart(updated);
            }
        } else {
            if (typeof updateCartQty === 'function') {
                updateCartQty(productId, newQty);
            } else {
                item.qty = newQty;
                saveCart(cart);
            }
        }
        renderCart();
    }
}

function handleApplyCoupon() {
    const input = document.getElementById('coupon-code-input');
    if (!input) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
        if (typeof showToast === 'function') showToast('Please enter a coupon code.', 'error');
        return;
    }

    const cart = (typeof getCart === 'function') ? getCart() : (JSON.parse(localStorage.getItem('gear_up_cart') || '[]'));
    const subtotal = cart.reduce((sum, item) => {
        const cleanPrice = parseFloat(String(item.price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
        return sum + (cleanPrice * (parseInt(item.qty, 10) || 1));
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
        if (typeof showToast === 'function') {
            if (result.isFreeShipping) {
                showToast(`Coupon "${result.code}" applied! Free delivery granted.`, 'success');
            } else {
                showToast(`Coupon "${result.code}" applied successfully!`, 'success');
            }
        }
        renderCart();
    } else {
        if (typeof showToast === 'function') {
            showToast(result ? result.message : 'Invalid coupon code.', 'error');
        }
    }
}

function handleRemoveCoupon() {
    localStorage.removeItem('active_coupon');
    if (typeof showToast === 'function') showToast('Coupon removed.', 'info');
    renderCart();
}

window.changeQty = changeQty;
window.renderCart = renderCart;
window.handleApplyCoupon = handleApplyCoupon;
window.handleRemoveCoupon = handleRemoveCoupon;

document.addEventListener('DOMContentLoaded', initCartPage);
