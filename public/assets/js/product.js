/* ==========================================================================
   Gear Up Gadgets - Product Detail Page JS
   ========================================================================== */

let currentProduct = null;
let isProductPageInitialized = false;

function initProductPage() {
    const id = getQueryParam('id');
    const storageParam = getQueryParam('storage');
    if (!id) {
        window.location.href = 'shop.html';
        return;
    }

    const targetId = String(id).toLowerCase().trim();
    let catalog = (window.GUG_DB && typeof window.GUG_DB.getStorefrontProducts === 'function') 
        ? window.GUG_DB.getStorefrontProducts() 
        : (window.PRODUCTS_DATA || (typeof productDatabase !== 'undefined' ? productDatabase : []));

    currentProduct = catalog.find(p => p && (
        String(p.id).toLowerCase() === targetId || 
        String(p.numericId) === targetId || 
        String(p.sku || '').toLowerCase() === targetId ||
        (Array.isArray(p.variants) && p.variants.some(v => String(v.id || '').toLowerCase() === targetId || String(v.sku || '').toLowerCase() === targetId))
    ));

    if (!currentProduct && typeof productDatabase !== 'undefined' && Array.isArray(productDatabase)) {
        currentProduct = productDatabase.find(p => p && (
            String(p.id).toLowerCase() === targetId || 
            String(p.numericId) === targetId || 
            String(p.sku || '').toLowerCase() === targetId ||
            (Array.isArray(p.variants) && p.variants.some(v => String(v.id || '').toLowerCase() === targetId || String(v.sku || '').toLowerCase() === targetId))
        ));
    }

    if (!currentProduct) {
        if (!window.__retryProductCount) window.__retryProductCount = 0;
        if (window.__retryProductCount < 5) {
            window.__retryProductCount++;
            setTimeout(initProductPage, 80);
            return;
        }
        window.location.href = 'shop.html';
        return;
    }

    // Resolve initial variant if specified
    if (Array.isArray(currentProduct.variants) && currentProduct.variants.length > 0) {
        let matchedVariant = null;
        if (storageParam) {
            const sp = storageParam.toLowerCase().replace(/\s+/g, '');
            matchedVariant = currentProduct.variants.find(v => (v.storage || '').toLowerCase().replace(/\s+/g, '') === sp || (v.name || '').toLowerCase().replace(/\s+/g, '') === sp);
        }
        if (!matchedVariant && targetId) {
            matchedVariant = currentProduct.variants.find(v => String(v.id || '').toLowerCase() === targetId || String(v.sku || '').toLowerCase() === targetId);
        }
        currentProduct.selectedVariant = matchedVariant || currentProduct.variants[0];
        if (currentProduct.selectedVariant && currentProduct.selectedVariant.price) {
            currentProduct.price = currentProduct.selectedVariant.price;
        }
    }

    // Render details
    renderProductDetails();
    renderRelatedProducts();
    isProductPageInitialized = true;
}

function selectProductStorage(variantId) {
    if (!currentProduct || !Array.isArray(currentProduct.variants)) return;
    const variant = currentProduct.variants.find(v => String(v.id) === String(variantId));
    if (!variant) return;

    currentProduct.selectedVariant = variant;
    currentProduct.price = variant.price;
    if (currentProduct.sellingPrice) currentProduct.sellingPrice = variant.price;

    // Update Price UI
    renderProductPriceUI();

    // Update Badge UI
    const badge = document.getElementById('product-selected-storage-badge');
    if (badge) {
        badge.innerText = `${variant.name || variant.storage} - Rs. ${formatPrice(variant.price)}`;
    }

    // Update Pill Buttons Active State
    const pillContainer = document.getElementById('product-storage-options-list');
    if (pillContainer) {
        const pills = pillContainer.querySelectorAll('.storage-option-pill');
        pills.forEach(p => {
            if (p.getAttribute('data-variant-id') === String(variant.id)) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });
    }

    // Update Specs Table Storage row if present
    const specs = generateSpecs(currentProduct);
    const specsHTML = Object.keys(specs).map(key => `
        <tr>
            <td class="text-white fw-semibold" style="width: 30%; border-bottom: 1px solid var(--border-color); padding: 12px 15px; background-color: var(--bg-main);">${key}</td>
            <td class="text-secondary" style="border-bottom: 1px solid var(--border-color); padding: 12px 15px;">${specs[key]}</td>
        </tr>
    `).join('');
    const specsTbody = document.getElementById('specs-table-body');
    if (specsTbody) specsTbody.innerHTML = specsHTML;

    // Sync URL without reload
    try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('storage', variant.storage || variant.name);
        window.history.replaceState({ path: newUrl.toString() }, '', newUrl.toString());
    } catch(e) {}
}

function renderProductPriceUI() {
    const priceContainer = document.getElementById('product-detail-price');
    if (!priceContainer || !currentProduct) return;

    const currentPrice = currentProduct.selectedVariant ? currentProduct.selectedVariant.price : currentProduct.price;
    const originalPrice = currentProduct.selectedVariant ? (currentProduct.selectedVariant.originalPrice || null) : currentProduct.originalPrice;

    if (currentProduct.onSale && originalPrice && originalPrice > currentPrice) {
        let saleBadgeText = 'SALE';
        if (currentProduct.saleDiscountPercent) {
            saleBadgeText = `${currentProduct.saleDiscountPercent}% OFF`;
        } else {
            const perc = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
            if (perc > 0) saleBadgeText = `${perc}% OFF`;
        }
        priceContainer.innerHTML = `
            <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="product-price-current fw-bold" style="font-size: 26px; color: var(--accent-red);">Rs. ${formatPrice(currentPrice)}</span>
                <span class="product-price-old text-decoration-line-through text-secondary" style="font-size: 18px;">Rs. ${formatPrice(originalPrice)}</span>
                <span class="badge bg-danger ms-2 fw-bold" style="font-size: 12px; padding: 6px 12px;">${saleBadgeText}</span>
            </div>
        `;
    } else {
        priceContainer.innerHTML = `
            <span class="product-price-current fw-bold" style="font-size: 26px; color: var(--accent-red);">Rs. ${formatPrice(currentPrice)}</span>
        `;
    }
}

function renderProductDetails() {
    // Page Title
    document.title = `${currentProduct.name} - Gear Up Gadgets`;
    
    // Breadcrumbs
    document.getElementById('breadcrumb-category').innerText = currentProduct.category.toUpperCase().replace('-', ' ');
    document.getElementById('breadcrumb-category').href = `shop.html?category=${currentProduct.category}`;
    document.getElementById('breadcrumb-title').innerText = currentProduct.name;

    // Image / Video
    const detailImgEl = document.getElementById('product-detail-img');
    if (detailImgEl) {
        const isProdVid = typeof window.isMediaVideo === 'function' ? window.isMediaVideo(currentProduct.image) : /\.(mp4|webm|mov|ogg|mkv|m4v)$/i.test(currentProduct.image || '');
        const parent = detailImgEl.parentElement;
        if (parent) {
            if (isProdVid) {
                parent.innerHTML = `<video id="product-detail-img" src="${currentProduct.image}" autoplay loop muted playsinline class="img-fluid" style="max-height: 100%; object-fit: contain;"></video>`;
            } else {
                parent.innerHTML = `<img src="${currentProduct.image}" id="product-detail-img" class="img-fluid" alt="${currentProduct.name}" style="max-height: 100%; object-fit: contain;" onerror="this.src='assets/images/logo.png'">`;
            }
        } else {
            detailImgEl.src = currentProduct.image;
            detailImgEl.alt = currentProduct.name;
        }
    }

    // Info
    document.getElementById('product-detail-title').innerText = currentProduct.name;
    document.getElementById('product-detail-cat').innerText = currentProduct.category.toUpperCase().replace('-', ' ');
    document.getElementById('product-detail-cat').href = `shop.html?category=${currentProduct.category}`;
    
    // Stock Status
    const stockStatus = document.getElementById('product-detail-stock');
    const totalStock = typeof window.getProductStockNumber === 'function' 
        ? window.getProductStockNumber(currentProduct) 
        : (currentProduct.totalStock || currentProduct.stockQuantity || (currentProduct.inStock ? 10 : 0));
    const qtyInput = document.getElementById('product-detail-qty');
    const buyBtn = document.getElementById('product-detail-add-btn');

    if (totalStock > 5) {
        stockStatus.className = 'badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 fw-bold d-inline-flex align-items-center gap-1';
        stockStatus.innerHTML = `<i class="fas fa-boxes-stacked me-1"></i> ${totalStock} stocks available`;
        if (qtyInput) {
            qtyInput.max = totalStock;
            qtyInput.disabled = false;
            if (parseInt(qtyInput.value) > totalStock) qtyInput.value = 1;
        }
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.style.opacity = '1';
            buyBtn.style.cursor = 'pointer';
            const btnText = buyBtn.querySelector('.btn-text');
            if (btnText) btnText.innerText = 'Add to Cart';
            else buyBtn.innerText = 'Add to Cart';
        }
    } else if (totalStock > 0) {
        const leftText = totalStock === 1 ? 'Only 1 stock left' : `Only ${totalStock} stocks are left`;
        stockStatus.className = 'badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-3 py-2 fw-bold d-inline-flex align-items-center gap-1';
        stockStatus.innerHTML = `<i class="fas fa-fire me-1"></i> ${leftText}`;
        if (qtyInput) {
            qtyInput.max = totalStock;
            qtyInput.disabled = false;
            if (parseInt(qtyInput.value) > totalStock) qtyInput.value = totalStock;
        }
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.style.opacity = '1';
            buyBtn.style.cursor = 'pointer';
            const btnText = buyBtn.querySelector('.btn-text');
            if (btnText) btnText.innerText = 'Add to Cart';
            else buyBtn.innerText = 'Add to Cart';
        }
    } else {
        stockStatus.className = 'badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-2 fw-bold d-inline-flex align-items-center gap-1';
        stockStatus.innerHTML = `<i class="fas fa-circle-xmark me-1"></i> Out of stock`;
        if (qtyInput) {
            qtyInput.value = 0;
            qtyInput.disabled = true;
        }
        if (buyBtn) {
            buyBtn.disabled = true;
            buyBtn.style.opacity = '0.6';
            buyBtn.style.cursor = 'not-allowed';
            const btnText = buyBtn.querySelector('.btn-text');
            if (btnText) btnText.innerText = 'Out of Stock';
            else buyBtn.innerText = 'Out of Stock';
        }
    }

    // Price
    renderProductPriceUI();

    // Storage / Variant Options Rendering
    const storageWrap = document.getElementById('product-storage-options-wrap');
    const storageList = document.getElementById('product-storage-options-list');
    const storageBadge = document.getElementById('product-selected-storage-badge');

    if (Array.isArray(currentProduct.variants) && currentProduct.variants.length > 0 && storageWrap && storageList) {
        storageWrap.style.display = 'block';
        if (!currentProduct.selectedVariant) {
            currentProduct.selectedVariant = currentProduct.variants[0];
        }
        if (storageBadge) {
            storageBadge.innerText = `${currentProduct.selectedVariant.name || currentProduct.selectedVariant.storage} - Rs. ${formatPrice(currentProduct.selectedVariant.price)}`;
        }
        storageList.innerHTML = currentProduct.variants.map(v => {
            const isSelected = (currentProduct.selectedVariant && String(currentProduct.selectedVariant.id) === String(v.id));
            const variantId = String(v.id || '');
            const variantName = String(v.name || v.storage || '');
            return `
                <button type="button" class="storage-option-pill ${isSelected ? 'active' : ''}" 
                        data-variant-id="${window.escapeHtml(variantId)}"
                        data-storage="${window.escapeHtml(v.storage || variantName)}">
                    <i class="fa-solid fa-hard-drive" style="font-size: 11px;"></i>
                    <span>${window.escapeHtml(variantName)}</span>
                    <span class="pill-price-sub">Rs. ${formatPrice(v.price)}</span>
                </button>
            `;
        }).join('');
        storageList.querySelectorAll('.storage-option-pill').forEach(button => {
            button.addEventListener('click', () => selectProductStorage(button.dataset.variantId));
        });
    } else if (storageWrap) {
        storageWrap.style.display = 'none';
    }

    // Short Description snippet
    const shortDescEl = document.getElementById('product-detail-short-desc');
    if (shortDescEl) {
        if (currentProduct.shortDescription) {
            shortDescEl.innerText = currentProduct.shortDescription;
        } else {
            shortDescEl.innerText = 'Shop with confidence. Gear Up Gadget offers 100% original, brand new, seal-packed desktop hardware with standard brand warranties and fast, secure shipping throughout Pakistan.';
        }
    }

    // Key Highlights (PTA, Protection Plan, 2-Year Warranty)
    const highlightsWrap = document.getElementById('product-key-highlights-wrap');
    if (highlightsWrap) {
        const isFlagshipPhone = (currentProduct.category || '').toLowerCase() === 'mobiles' || (currentProduct.name || '').toLowerCase().includes('iphone');
        if (isFlagshipPhone) {
            highlightsWrap.style.display = 'block';
        } else {
            highlightsWrap.style.display = 'none';
        }
    }

    // Tabs: Description
    const customDesc = currentProduct.description 
        ? `<p style="line-height: 1.8; white-space: pre-line;">${currentProduct.description}</p>` 
        : `
        <p style="line-height: 1.8;">${currentProduct.name} is a high-performance product designed to meet the demands of modern users. Built using premium quality materials and cutting-edge engineering, it offers exceptional reliability, stability, and speed.</p>
        <p style="line-height: 1.8;">Guaranteed authentic stock with official warranty coverage across Pakistan.</p>
    `;
    
    document.getElementById('tab-desc-content').innerHTML = customDesc;

    // Tabs: Specifications Table
    const specs = generateSpecs(currentProduct);
    const specsHTML = Object.keys(specs).map(key => `
        <tr>
            <td class="text-white fw-semibold" style="width: 30%; border-bottom: 1px solid var(--border-color); padding: 12px 15px; background-color: var(--bg-main);">${key}</td>
            <td class="text-secondary" style="border-bottom: 1px solid var(--border-color); padding: 12px 15px;">${specs[key]}</td>
        </tr>
    `).join('');

    document.getElementById('specs-table-body').innerHTML = specsHTML;
}

function handleDetailAddToCart() {
    if (!currentProduct) return;
    const totalStock = typeof window.getProductStockNumber === 'function' 
        ? window.getProductStockNumber(currentProduct) 
        : (currentProduct.totalStock || currentProduct.stockQuantity || (currentProduct.inStock ? 10 : 0));
    if (totalStock <= 0) {
        if (typeof showToast === 'function') showToast('Sorry, this product is currently out of stock.', 'warning');
        return;
    }
    const qtyInput = document.getElementById('product-detail-qty');
    let qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
    if (qty > totalStock) qty = totalStock;
    const button = document.getElementById('product-detail-add-btn');

    if (currentProduct.selectedVariant) {
        const variantPayload = {
            id: currentProduct.selectedVariant.id || `${currentProduct.id}-${currentProduct.selectedVariant.storage}`,
            name: `${currentProduct.baseName || currentProduct.name} (${currentProduct.selectedVariant.name || currentProduct.selectedVariant.storage})`,
            price: currentProduct.selectedVariant.price,
            originalPrice: currentProduct.selectedVariant.originalPrice || currentProduct.selectedVariant.price,
            image: currentProduct.image,
            category: currentProduct.category,
            storage: currentProduct.selectedVariant.storage,
            sku: currentProduct.selectedVariant.sku,
            qty: qty
        };
        handleCargoAddToCart(button, variantPayload, qty);
    } else {
        handleCargoAddToCart(button, currentProduct.id, qty);
    }
}

function renderRelatedProducts() {
    const grid = document.getElementById('related-products-grid');
    if (!grid) return;

    // Filter same category, exclude current product
    const related = (window.PRODUCTS_DATA || []).filter(p => 
        p.category === currentProduct.category && p.id != currentProduct.id
    ).slice(0, 4);

    if (related.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center text-secondary">No related products found.</div>';
        return;
    }

    grid.innerHTML = related.map(p => renderProductCardHTML(p)).join('');
}

function generateSpecs(p) {
    // Generate mock specifications based on product category & title
    const name = p.name || p.title || '';
    const totalStock = typeof window.getProductStockNumber === 'function' ? window.getProductStockNumber(p) : (p.totalStock || p.stockQuantity || 0);
    const availText = totalStock > 5 
        ? `${totalStock} Available` 
        : (totalStock > 0 ? `Only ${totalStock} Left` : "Out of Stock");

    const defaultSpecs = {
        "Brand": extractBrand(name),
        "Category": (p.category || 'Mobiles').toUpperCase().replace('-', ' '),
        "Item Model": name.split(' ').slice(0, 3).join(' '),
        "Condition": name.toLowerCase().includes('used') ? "Used (Pre-owned)" : (name.toLowerCase().includes('open box') ? "Open Box" : "New / Sealed"),
        "Warranty": "1-Year Local Warranty",
        "Availability": availText
    };

    if ((p.category || '').toLowerCase() === 'mobiles' || (p.brand || '').toLowerCase() === 'apple') {
        const isIphone18 = name.toLowerCase().includes('iphone 18');
        const isProMax = name.toLowerCase().includes('max');
        const activeStorage = p.selectedVariant ? `${p.selectedVariant.name} (${p.selectedVariant.storage})` : "256GB / 512GB / 1TB / 2TB Available";
        return {
            ...defaultSpecs,
            "Brand": p.brand || "Apple",
            "Item Model": isIphone18 ? (isProMax ? "iPhone 18 Pro Max" : "iPhone 18 Pro") : name.split(' ').slice(0, 4).join(' '),
            "PTA Status": "Official PTA Approved",
            "Protection Plan": "Comprehensive Protection Plan Included (Front screen, back glass & liquid damage)",
            "Warranty": "2-Year Official Warranty (Apple Official + Mercantile Pakistan authorized)",
            "Storage Option": activeStorage,
            "Display": isProMax ? '6.9" Super Retina XDR OLED 120Hz ProMotion' : '6.3" Super Retina XDR OLED 120Hz ProMotion',
            "Processor / Chipset": isIphone18 ? "Apple A19 Pro Bionic Chip" : (name.toLowerCase().includes('a18') ? "Apple A18 Pro" : "Apple Bionic / Qualcomm Snapdragon"),
            "Camera System": "48MP Pro Fusion (Variable Aperture) + 48MP Ultra-Wide + 48MP Periscope Telephoto",
            "Build & Materials": "Grade 5 Aerospace Titanium with Ceramic Shield 2 Front",
            "Condition": "Brand New / 100% Factory Sealed"
        };
    }

    if (p.category === 'processors') {
        return {
            ...defaultSpecs,
            "Socket Type": name.toLowerCase().includes('am5') ? 'AMD Socket AM5' : (name.toLowerCase().includes('am4') ? 'AMD Socket AM4' : (name.toLowerCase().includes('1700') ? 'Intel LGA 1700' : 'Intel LGA 1851')),
            "Cores / Threads": name.toLowerCase().includes('9950x') ? '16 Cores / 32 Threads' : (name.toLowerCase().includes('7800x3d') || name.toLowerCase().includes('9800x3d') ? '8 Cores / 16 Threads' : '6 Cores / 12 Threads'),
            "Boost Clock": name.toLowerCase().includes('i9') ? '5.8 GHz' : (name.toLowerCase().includes('ryzen 7') ? '5.0 GHz' : '4.6 GHz'),
            "Cache": name.toLowerCase().includes('x3d') ? '104MB Cache (3D V-Cache)' : '32MB Cache',
            "Integrated Graphics": name.toLowerCase().includes('f') ? 'No' : 'Intel UHD Graphics / AMD Radeon Graphics'
        };
    }

    if (p.category === 'graphics-cards') {
        return {
            ...defaultSpecs,
            "Chipset Manufacturer": name.toLowerCase().includes('radeon') || name.toLowerCase().includes('rx') ? 'AMD' : 'NVIDIA',
            "Video Memory": name.toLowerCase().includes('4090') ? '24GB GDDR6X' : (name.toLowerCase().includes('70 ti') ? '16GB GDDR7' : (name.toLowerCase().includes('3060') ? '12GB GDDR6' : '8GB GDDR6')),
            "Bus Width": name.toLowerCase().includes('4090') ? '384-Bit' : (name.toLowerCase().includes('70') ? '256-Bit' : '192-Bit'),
            "Cooling System": name.toLowerCase().includes('2x') || name.toLowerCase().includes('twin') ? 'Dual Fan' : 'Triple Fan (Active Air Cooler)',
            "Interface": "PCI Express 4.0 / 5.0 x16"
        };
    }

    if (p.category === 'monitors') {
        return {
            ...defaultSpecs,
            "Screen Size": name.toLowerCase().includes('49') ? '49" Ultra-wide' : (name.toLowerCase().includes('34') ? '34" Curved' : '27" Widescreen'),
            "Resolution": name.toLowerCase().includes('4k') || name.toLowerCase().includes('3840') ? '3840 x 2160 (4K UHD)' : (name.toLowerCase().includes('qhd') || name.toLowerCase().includes('2560') ? '2560 x 1440 (QHD)' : '1920 x 1080 (FHD)'),
            "Refresh Rate": name.toLowerCase().includes('360hz') ? '360Hz' : (name.toLowerCase().includes('240hz') ? '240Hz' : (name.toLowerCase().includes('180hz') ? '180Hz' : '144Hz')),
            "Panel Type": name.toLowerCase().includes('ips') ? 'IPS (In-Plane Switching)' : (name.toLowerCase().includes('oled') ? 'QD-OLED' : 'VA Panel'),
            "Response Time": name.toLowerCase().includes('0.03ms') ? '0.03ms (GtG)' : '1ms (GtG)'
        };
    }

    return defaultSpecs;
}

function extractBrand(name) {
    const brands = ['AMD', 'Intel', 'ASUS', 'MSI', 'Zotac', 'Gigabyte', 'Sapphire', 'Logitech', 'Razer', 'Attack Shark', 'Corsair', 'Lian Li', 'XPG', 'WESTERN DIGITAL', 'WD', 'Kingston', 'HP', 'Dell', 'Lenovo', 'Apple', 'AOC', 'Viewsonic', 'SAMA'];
    for (let brand of brands) {
        if (name.toLowerCase().includes(brand.toLowerCase())) {
            return brand;
        }
    }
    return "Generic";
}

// Auto-initialize immediately for zero-lag rendering
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductPage);
} else {
    initProductPage();
}
window.addEventListener('productsReady', initProductPage);
window.addEventListener('gugCatalogUpdated', initProductPage);

