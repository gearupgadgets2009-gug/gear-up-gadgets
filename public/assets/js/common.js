/* ==========================================================================
   Gear Up Gadgets - Common Layout and eCommerce Logic
   ========================================================================== */

if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

(function sanitizeAndVerifyGearUpCatalog() {
    try {
        // Fast exit if already sanitized in this session
        if (sessionStorage.getItem('gug_sanitized_v2')) return;
        sessionStorage.setItem('gug_sanitized_v2', 'true');

        // Unregister any lingering service workers
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                regs.forEach(reg => reg.unregister());
            });
        }

        // Zero-Tolerance Purge for any foreign cosmetics/Meliora residual data in localStorage
        const cosmeticKeywords = ['meliora', 'cosmetic', 'lipstick', 'serum', 'mascara', 'makeup', 'skincare', 'foundation', 'blush', 'eyeliner', 'fragrance', 'perfume', 'lotion', 'beauty'];
        const keysToCheck = ['gug_erp_products', 'admin_custom_products', 'admin_orders', 'cart', 'gug_custom_categories', 'gug_custom_brands', 'gug_categories', 'gug_brands'];
        keysToCheck.forEach(key => {
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        const cleaned = parsed.filter(item => {
                            if (typeof item === 'string') {
                                const s = item.toLowerCase();
                                return !cosmeticKeywords.some(kw => s.includes(kw));
                            } else if (item && typeof item === 'object') {
                                const str = (JSON.stringify(item)).toLowerCase();
                                return !cosmeticKeywords.some(kw => str.includes(kw));
                            }
                            return true;
                        });
                        if (cleaned.length !== parsed.length) {
                            localStorage.setItem(key, JSON.stringify(cleaned));
                        }
                    }
                } catch(e) {}
            }
        });
    } catch(e) {}
})();

(function autoLoadFirebase() {
    // Prevent duplicate injection if HTML already includes Firebase scripts or already initialized
    const hasStaticFirebase = Boolean(
        typeof firebase !== 'undefined' ||
        document.querySelector('script[src*="firebase-app-compat.js"]') ||
        document.querySelector('script[src*="firebase-sync.js"]') ||
        document.querySelector('meta[data-firebase-loader]')
    );

    if (typeof firebase === 'undefined' && !hasStaticFirebase) {
        const marker = document.createElement('meta');
        marker.setAttribute('data-firebase-loader', 'true');
        document.head.appendChild(marker);

        const scripts = [
            "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
            "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js",
            "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js",
            "assets/js/firebase-config.js",
            "assets/js/firebase-sync.js"
        ];

        let index = 0;
        function loadNext() {
            if (index >= scripts.length) {
                console.log("🔥 [Firebase] All Firebase modules loaded.");
                return;
            }
            const s = document.createElement('script');
            s.src = scripts[index];
            s.async = false;
            s.onload = () => {
                index++;
                loadNext();
            };
            s.onerror = (e) => {
                index++;
                loadNext();
            };
            document.head.appendChild(s);
        }
        loadNext();
    }
})();

document.addEventListener('DOMContentLoaded', function() {
    // 0. Ensure No Blocking Preloaders Hijack the Page
    const existingPreloader = document.getElementById('global-preloader');
    if (existingPreloader) existingPreloader.remove();
    document.querySelectorAll('.page-loader').forEach(el => el.remove());

    // 1. Apply Global Storefront Theme
    applyGlobalTheme();

    // 2. Inject Common Header and Footer
    injectHeader();
    injectFooter();
    injectToastContainer();

    // Immediate ERP Master Catalog & Product Hydration for Instant Display
    if (window.GUG_DB && typeof window.GUG_DB.getStorefrontProducts === 'function') {
        window.PRODUCTS_DATA = window.GUG_DB.getStorefrontProducts();
        window.dispatchEvent(new Event('productsReady'));
    }

    // Listen for theme and banner update events
    window.addEventListener('storage', function(e) {
        if (!e || !e.key || e.key === 'gug_event_theme_config' || e.key === 'gug_sales_event_name' || e.key === 'gug_sales_page_active') {
            applyGlobalTheme();
            injectHeader();
            injectFooter();
        }
    });
    window.addEventListener('gugThemeUpdated', function() {
        applyGlobalTheme();
        injectHeader();
        injectFooter();
    });

    // 3. Initialize eCommerce Features
    updateCartBadge();
    initializeSearch();
    initializeAnimationSystem();
    
    // 4. Page-specific initializations
    const currentPath = window.location.pathname;
    if (currentPath.includes('shop.html')) {
        if (typeof initShopPage === 'function') initShopPage();
    } else if (currentPath.includes('product.html')) {
        if (typeof initProductPage === 'function') initProductPage();
    } else if (currentPath.includes('cart.html')) {
        if (typeof initCartPage === 'function') initCartPage();
    } else if (currentPath.includes('checkout.html')) {
        if (typeof initCheckoutPage === 'function') initCheckoutPage();
    } else if (currentPath.includes('pc-builder.html') || currentPath.includes('custom-pc.html')) {
        if (typeof initPCBuilderPage === 'function') initPCBuilderPage();
    } else {
        // Assume homepage if not matching others
        if (typeof initHomePage === 'function') initHomePage();
    }

    // Global Stock Helpers
    window.getProductStockNumber = function(p) {
        if (!p) return 0;
        if (window.GUG_DB && typeof window.GUG_DB.getProductStockCount === 'function') {
            return window.GUG_DB.getProductStockCount(p);
        }
        if (typeof p.totalStock === 'number') return p.totalStock;
        if (typeof p.stockQuantity === 'number') return p.stockQuantity;
        if (typeof p.stock === 'number') return Number(p.stock);
        if (p.stock && typeof p.stock === 'object') {
            let sum = 0;
            Object.values(p.stock).forEach(val => sum += Number(val || 0));
            return sum;
        }
        if (Array.isArray(p.variants) && p.variants.length > 0) {
            let sum = 0;
            p.variants.forEach(v => sum += Number(v.stock || 0));
            if (sum > 0) return sum;
        }
        return 0;
    };

    window.formatProductStockBadge = function(p, compact = false) {
        const stock = window.getProductStockNumber(p);
        if (window.GUG_DB && typeof window.GUG_DB.formatStockBadge === 'function') {
            return window.GUG_DB.formatStockBadge(stock, { compact });
        }
        if (stock > 5) {
            return `<span class="stock-badge in-stock" style="display:inline-flex;align-items:center;gap:${compact ? '4px' : '6px'};font-size:${compact ? '10px' : '11px'};font-weight:700;color:#10b981;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);padding:${compact ? '2px 6px' : '4px 8px'};border-radius:4px;white-space:nowrap;"><i class="fas fa-boxes-stacked"></i> ${stock} stocks available</span>`;
        } else if (stock > 0) {
            const text = stock === 1 ? 'Only 1 stock left' : `Only ${stock} stocks are left`;
            return `<span class="stock-badge low-stock" style="display:inline-flex;align-items:center;gap:${compact ? '4px' : '6px'};font-size:${compact ? '10px' : '11px'};font-weight:700;color:#f59e0b;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.35);padding:${compact ? '2px 6px' : '4px 8px'};border-radius:4px;white-space:nowrap;"><i class="fas fa-fire"></i> ${text}</span>`;
        } else {
            return `<span class="stock-badge out-of-stock" style="display:inline-flex;align-items:center;gap:${compact ? '4px' : '6px'};font-size:${compact ? '10px' : '11px'};font-weight:700;color:#ef4444;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);padding:${compact ? '2px 6px' : '4px 8px'};border-radius:4px;white-space:nowrap;"><i class="fas fa-circle-xmark"></i> Out of stock</span>`;
        }
    };

    // 4. Inject Quick View Modal
    const modalHtml = `
        <div id="global-quickview-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center; opacity:0; transition: opacity 0.3s ease;">
            <div style="position:relative; width:70vw; max-width:1100px; max-height:85vh; background:var(--bg-main, #121212); border-radius:12px; display:flex; flex-direction:column; overflow:hidden; border: 1px solid var(--border-color, #333); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                <button id="quickview-close-btn" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.5); border:none; color:white; font-size:24px; width:40px; height:40px; border-radius:50%; cursor:pointer; z-index:10; display:flex; justify-content:center; align-items:center;">&times;</button>
                <div style="display:flex; flex-wrap:wrap; height:100%; overflow-y:auto;">
                    <div style="flex:1; min-width:300px; padding:20px; display:flex; justify-content:center; align-items:center; background:white;">
                        <img id="quickview-img" src="" style="max-width:100%; max-height:400px; object-fit:contain;">
                    </div>
                    <div style="flex:1.2; min-width:300px; padding:40px; display:flex; flex-direction:column; justify-content:center; background:var(--bg-card, #1a1a1a);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                            <span id="quickview-category" style="color:var(--accent-red, #db2724); font-size:13px; font-weight:800; letter-spacing:1px; text-transform:uppercase; display:block;"></span>
                            <div id="quickview-stock-badge"></div>
                        </div>
                        <h2 id="quickview-title" style="color:white; font-size:24px; font-weight:bold; margin-bottom:15px; line-height:1.4;"></h2>
                        <div id="quickview-price" style="color:var(--accent-red, #db2724); font-size:32px; font-weight:bold; margin-bottom:20px;"></div>
                        <p style="color:#aaa; font-size:14px; margin-bottom:30px; line-height:1.6;">Experience top-tier performance with this premium hardware. Fully authentic and comes with a 1-year local warranty.</p>
                        <div id="quickview-btn-container"></div>
                        <a id="quickview-full-details-link" href="#" style="color:#888; text-decoration:underline; font-size:14px; margin-top:20px; text-align:center; display:block; transition: color 0.3s ease;" onmouseover="this.style.color='white'" onmouseout="this.style.color='#888'">View Full Product Details</a>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('global-quickview-modal').style.display = 'none';

    document.getElementById('global-quickview-modal').addEventListener('click', function(e) {
        if(e.target === this || e.target.id === 'quickview-close-btn') {
            this.style.opacity = '0';
            setTimeout(() => this.style.display = 'none', 300);
        }
    });

    window.showQuickViewModal = function(productId) {
        if (!productId) return;
        const targetId = String(productId).toLowerCase().trim();
        let dataList = window.PRODUCTS_DATA;
        if (!Array.isArray(dataList) || dataList.length === 0) {
            if (window.GUG_DB && typeof window.GUG_DB.getStorefrontProducts === 'function') {
                dataList = window.GUG_DB.getStorefrontProducts();
            } else if (typeof productDatabase !== 'undefined') {
                dataList = productDatabase;
            } else {
                dataList = [];
            }
        }
        const p = dataList.find(item => item && (String(item.id).toLowerCase() === targetId || String(item.numericId) === targetId || String(item.sku || '').toLowerCase() === targetId));
        if (!p) return;

        const imgEl = document.getElementById('quickview-img');
        const titleEl = document.getElementById('quickview-title');
        const catEl = document.getElementById('quickview-category');
        const priceEl = document.getElementById('quickview-price');
        const linkEl = document.getElementById('quickview-full-details-link');
        const modal = document.getElementById('global-quickview-modal');

        if (imgEl) {
            const mediaSrc = p.image || 'assets/images/logo.png';
            const isVid = typeof window.isMediaVideo === 'function' ? window.isMediaVideo(mediaSrc) : false;
            const parent = imgEl.parentElement;
            if (parent) {
                if (isVid) {
                    parent.innerHTML = `<video id="quickview-img" src="${mediaSrc}" autoplay loop muted playsinline style="max-width:100%; max-height:400px; object-fit:contain;"></video>`;
                } else {
                    parent.innerHTML = `<img id="quickview-img" src="${mediaSrc}" style="max-width:100%; max-height:400px; object-fit:contain;" onerror="this.src='assets/images/logo.png'">`;
                }
            } else {
                imgEl.src = mediaSrc;
            }
        }
        if (titleEl) titleEl.textContent = p.name || p.title || '';
        if (catEl) catEl.textContent = (p.category || "").replace("-", " ");
        
        const stockBadgeEl = document.getElementById('quickview-stock-badge');
        if (stockBadgeEl && typeof window.formatProductStockBadge === 'function') {
            stockBadgeEl.innerHTML = window.formatProductStockBadge(p, false);
        }

        let priceRaw = (p.price || "").toString().replace("Rs.", "").replace(/,/g, "").trim();
        if (priceEl) priceEl.textContent = "Rs. " + formatPrice(parseFloat(priceRaw) || 0);
        
        if (linkEl) linkEl.href = `product.html?id=${p.id}`;

        const stockQty = typeof window.getProductStockNumber === 'function' ? window.getProductStockNumber(p) : (p.totalStock || p.stockQuantity || 0);
        const btnContainer = document.getElementById('quickview-btn-container');
        if (btnContainer) {
            if (stockQty <= 0) {
                btnContainer.innerHTML = `<button class="btn w-100 fw-bold" style="background-color: #2a2a2a; border-color: #3a3a3a; color: #777; padding: 15px; font-size: 16px; border-radius: 6px; cursor: not-allowed;" disabled>Out of Stock</button>`;
            } else {
                btnContainer.innerHTML = `<button class="btn w-100 fw-bold add-to-cart-btn transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style="background-color: black; border-color: black; color: white; padding: 15px; font-size: 16px; border-radius: 6px;" onclick="handleAddToCart(event, '${p.id}')">Add to Cart</button>`;
            }
        }

        if (modal) {
            modal.style.display = 'flex';
            modal.style.opacity = '1';
        }
    };

    // 5. Global Search Logic
    const searchInput = document.getElementById('global-search-input');
    const searchBtn = document.getElementById('global-search-btn');
    const executeSearch = () => {
        if (searchInput && searchInput.value.trim() !== '') {
            window.location.href = `shop.html?search=${encodeURIComponent(searchInput.value.trim())}`;
        }
    };
    if (searchBtn) searchBtn.addEventListener('click', executeSearch);
    if (searchInput) searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });
});

// --- Global Theme Engine & Injections ---

function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(10, 10, 15, ${alpha !== undefined ? alpha : 1})`;
    let c = hex.trim().replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return `rgba(10, 10, 15, ${alpha !== undefined ? alpha : 1})`;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha !== undefined ? alpha : 1})`;
}
window.hexToRgba = hexToRgba;

function isMediaVideo(url, explicitType) {
    if (explicitType === 'video') return true;
    if (explicitType === 'image') return false;
    if (!url) return false;
    if (typeof url === 'object') {
        if (url.type === 'video' || url.mediaType === 'video') return true;
        url = url.url || url.src || url.image || '';
    }
    const str = String(url).trim().toLowerCase();
    if (str.startsWith('data:video/')) return true;
    const clean = str.split('?')[0].split('#')[0];
    return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.mov') || clean.endsWith('.ogg') || clean.endsWith('.mkv') || clean.endsWith('.m4v') || clean.endsWith('.avi');
}
window.isMediaVideo = isMediaVideo;

function renderMediaTag(mediaSrc, options = {}) {
    if (!mediaSrc) return '';
    const src = typeof mediaSrc === 'object' ? (mediaSrc.url || mediaSrc.src || mediaSrc.image || '') : String(mediaSrc);
    const isVid = isMediaVideo(mediaSrc, options.explicitType);
    const className = options.className || '';
    const style = options.style || '';
    const alt = options.alt || 'Media';
    const fallback = options.fallback || 'assets/images/logo.png';
    const extraAttrs = options.extraAttrs || '';

    if (isVid) {
        return `<video src="${src}" autoplay loop muted playsinline class="${className}" style="${style}" ${extraAttrs}></video>`;
    } else {
        return `<img src="${src}" alt="${alt}" class="${className}" style="${style}" loading="lazy" decoding="async" onerror="this.src='${fallback}'" ${extraAttrs}>`;
    }
}
window.renderMediaTag = renderMediaTag;

function applyGlobalTheme() {
    let cfg = {};
    try {
        cfg = JSON.parse(localStorage.getItem('gug_event_theme_config') || '{}');
    } catch(e) {}

    const bgMain = cfg.bgMain || '#0b0f13';
    const bgCard = cfg.bgCard || '#14191f';
    const navbarBg = cfg.navbar || '#070a0d';
    const topbarBg = cfg.topbarBg || '#050709';
    const navbarTextColor = cfg.navbarTextColor || '#ffffff';
    const footerBg = cfg.footer || '#070a0d';
    const footerTextColor = cfg.footerTextColor || '#8b949e';
    const accentRed = cfg.accentRed || '#E50303';
    const cardBorderColor = cfg.cardBorderColor || '#1f262e';
    const stickyNavbar = cfg.stickyNavbar !== false;
    const footerPartners = cfg.footerPartnersEnabled !== false;

    // Derived glass tints matching the theme palette while preserving translucency
    const glassCardBg = hexToRgba(bgCard, 0.45);
    const glassHeaderBg = hexToRgba(navbarBg, 0.55);
    const glassTopbarBg = hexToRgba(topbarBg, 0.60);
    const glassFooterBg = hexToRgba(footerBg, 0.65);
    const glassDropdownBg = hexToRgba(navbarBg, 0.85);
    const accentGlow = hexToRgba(accentRed, 0.25);
    const accentHoverBorder = hexToRgba(accentRed, 0.55);

    // Dynamic background setup
    let bgColor = bgMain;
    let bgImage = '';
    let bgAttachment = cfg.bgAttachment || 'fixed';
    let bgSize = 'cover';
    let bgRepeat = 'no-repeat';
    let bgPosition = 'center top';

    const opacityPct = cfg.bgOpacity !== undefined ? Number(cfg.bgOpacity) : 85;
    const overlayAlpha = Math.min(1, Math.max(0, opacityPct / 100));
    const overlayColor = hexToRgba(bgMain, overlayAlpha);

    let videoContainer = document.getElementById('gug-global-bg-video-container');

    if (cfg.bgType === 'video' && cfg.bgVideo) {
        bgImage = 'none';
        if (!videoContainer) {
            videoContainer = document.createElement('div');
            videoContainer.id = 'gug-global-bg-video-container';
            videoContainer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;z-index:-10;pointer-events:none;';
            if (document.body) {
                document.body.prepend(videoContainer);
            } else if (document.documentElement) {
                document.documentElement.prepend(videoContainer);
            }
        }
        const videoOpacity = Math.max(0.05, Math.min(1, (100 - opacityPct) / 100));
        videoContainer.innerHTML = `<video src="${cfg.bgVideo}" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;opacity:${videoOpacity};"></video><div style="position:absolute;inset:0;background:${overlayColor};pointer-events:none;"></div>`;
    } else {
        if (videoContainer) videoContainer.remove();
        if (cfg.bgType === 'image' && cfg.bgImage) {
            // High-resolution user wallpaper with dynamic tint overlay
            bgImage = `linear-gradient(${overlayColor}, ${overlayColor}), url("${cfg.bgImage}")`;
            bgSize = 'cover, cover';
            bgRepeat = 'no-repeat, no-repeat';
            bgPosition = 'center top, center top';
            bgAttachment = `${bgAttachment}, ${bgAttachment}`;
        } else {
            // Default Honeycomb Mesh patterned to match the active accent color
            const encodedAccent = encodeURIComponent(accentRed);
            bgImage = `radial-gradient(ellipse at 50% 0%, ${hexToRgba(accentRed, 0.18)} 0%, transparent 60%), radial-gradient(ellipse at 85% 100%, ${hexToRgba(accentRed, 0.12)} 0%, transparent 50%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg id='hex-mesh' fill='${encodedAccent}' fill-opacity='0.12' fill-rule='nonzero'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v13.2l11 6.35 11-6.35V17.9L14 11.55 3 17.9zm11 1.73l9 5.2v10.38l-9 5.2-9-5.2V24.83l9-5.2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;
            bgSize = 'cover, cover, 28px 49px';
            bgRepeat = 'no-repeat, no-repeat, repeat';
            bgPosition = 'center top, center top, center top';
            bgAttachment = 'fixed, fixed, fixed';
        }
    }

    // Set root CSS variables via JS style property as well as in stylesheet
    const root = document.documentElement;
    if (root && root.style) {
        root.style.setProperty('--gug-bg-color', bgColor);
        root.style.setProperty('--gug-bg-image', bgImage);
        root.style.setProperty('--gug-bg-size', bgSize);
        root.style.setProperty('--gug-bg-attachment', bgAttachment);
        root.style.setProperty('--gug-bg-repeat', bgRepeat);
        root.style.setProperty('--gug-bg-position', bgPosition);
        root.style.setProperty('--bg-main', 'transparent');
        root.style.setProperty('--bg-card', glassCardBg);
        root.style.setProperty('--bg-header', glassHeaderBg);
        root.style.setProperty('--accent-red', accentRed);
        root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.1)');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.85)');
        root.style.setProperty('--ios-glass-bg', glassCardBg);
        root.style.setProperty('--ios-glass-bg-header', glassHeaderBg);
        root.style.setProperty('--ios-glass-bg-footer', glassFooterBg);
        root.style.setProperty('--ios-glass-bg-dropdown', glassDropdownBg);
        root.style.setProperty('--accent-glow', accentGlow);
        root.style.setProperty('--accent-hover-border', accentHoverBorder);
    }

    if (document.body && document.body.style) {
        document.body.style.setProperty('--gug-bg-color', bgColor);
        document.body.style.setProperty('--gug-bg-image', bgImage);
        document.body.style.setProperty('--gug-bg-size', bgSize);
        document.body.style.setProperty('--gug-bg-attachment', bgAttachment);
        document.body.style.setProperty('--gug-bg-repeat', bgRepeat);
        document.body.style.setProperty('--gug-bg-position', bgPosition);
        document.body.style.backgroundColor = bgColor;
        document.body.style.backgroundImage = bgImage;
        document.body.style.backgroundSize = bgSize;
        document.body.style.backgroundAttachment = bgAttachment;
        document.body.style.backgroundRepeat = bgRepeat;
        document.body.style.backgroundPosition = bgPosition;
    }

    let styleEl = document.getElementById('gug-global-theme-stylesheet');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'gug-global-theme-stylesheet';
        document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
        :root {
            --gug-bg-color: ${bgColor} !important;
            --gug-bg-image: ${bgImage} !important;
            --gug-bg-size: ${bgSize} !important;
            --gug-bg-attachment: ${bgAttachment} !important;
            --gug-bg-repeat: ${bgRepeat} !important;
            --gug-bg-position: ${bgPosition} !important;
            --bg-main: transparent !important;
            --bg-card: ${glassCardBg} !important;
            --bg-header: ${glassHeaderBg} !important;
            --accent-red: ${accentRed} !important;
            --border-color: rgba(255, 255, 255, 0.1) !important;
            --text-primary: #ffffff !important;
            --text-secondary: rgba(255, 255, 255, 0.85) !important;
            --ios-glass-bg: ${glassCardBg} !important;
            --ios-glass-bg-header: ${glassHeaderBg} !important;
            --ios-glass-bg-footer: ${glassFooterBg} !important;
            --ios-glass-bg-dropdown: ${glassDropdownBg} !important;
            --accent-glow: ${accentGlow} !important;
            --accent-hover-border: ${accentHoverBorder} !important;
        }
        body {
            background-color: ${bgColor} !important;
            background-image: ${bgImage} !important;
            background-size: ${bgSize} !important;
            background-attachment: ${bgAttachment} !important;
            background-repeat: ${bgRepeat} !important;
            background-position: ${bgPosition} !important;
            color: #ffffff !important;
        }
        .tf-header {
            background: ${glassHeaderBg} !important;
            backdrop-filter: blur(24px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4) !important;
            ${stickyNavbar ? '' : 'position: relative !important;'}
        }
        .tf-header .header-inner {
            background: ${glassHeaderBg} !important;
            backdrop-filter: blur(24px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
        }
        .tf-header .topbar, .tf-header > div:first-child {
            background: ${glassTopbarBg} !important;
            backdrop-filter: blur(24px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
        .tf-header .item-link {
            color: #ffffff !important;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85) !important;
        }
        footer, .site-footer {
            background: ${glassFooterBg} !important;
            backdrop-filter: blur(24px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: #ffffff !important;
        }
        .card, .product-card, .shop-card, .card-product, .cat-card, .custom-pc-card, .home-repair-card {
            background: rgba(18, 24, 32, 0.92) !important;
            background-color: rgba(18, 24, 32, 0.92) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
            color: #ffffff !important;
        }
        .card:hover, .product-card:hover, .cat-card:hover, .custom-pc-card:hover, .home-repair-card:hover {
            border-color: ${accentHoverBorder} !important;
            box-shadow: 0 22px 50px rgba(0, 0, 0, 0.7), 0 0 25px ${accentGlow}, inset 0 1px 0 rgba(255, 255, 255, 0.18) !important;
        }
        .dropdown-menu, .sub-menu, .dropdown-menu-custom {
            background: ${glassDropdownBg} !important;
            backdrop-filter: blur(28px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(28px) saturate(200%) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7) !important;
        }
        .brand-marquee-container {
            display: ${footerPartners ? 'block' : 'none'} !important;
        }
    `;
}
window.applyGlobalTheme = applyGlobalTheme;
try { applyGlobalTheme(); } catch(e) {}

function injectHeader() {
    const placeholder = document.getElementById('header-placeholder');
    if (!placeholder) return;

    let cfg = {};
    try {
        cfg = JSON.parse(localStorage.getItem('gug_event_theme_config') || '{}');
    } catch(e) {}

    const queryPhone = cfg.footerPhone || cfg.topbarPhone || '021 34832214';
    const phoneClean = queryPhone.replace(/\s+/g, '');
    const phoneLabel = cfg.footerPhoneLabel || 'Queries:';
    let topbarEmail = cfg.footerEmail || cfg.topbarEmail || 'sales@gearupgadget.com';
    let topbarAddress = cfg.topbarAddress || 'F6 Technocity Mall';
    const storeHours = cfg.footerStoreHours || '12:00 PM - 8:00 PM';
    const storeDays = cfg.footerStoreDays || 'Mon-Sat';

    // Upgrade any legacy address or email in stored config to ensure global consistency
    if (!topbarAddress || topbarAddress.includes('Osif') || topbarAddress.includes('Pace') || topbarAddress.includes('FA-06')) {
        topbarAddress = 'F6 Technocity Mall';
        cfg.topbarAddress = topbarAddress;
        try { localStorage.setItem('gug_event_theme_config', JSON.stringify(cfg)); } catch(e) {}
    }
    if (!topbarEmail || topbarEmail.includes('gearupgadget.pk') || topbarEmail.includes('gearupgadgets.pk')) {
        topbarEmail = 'sales@gearupgadget.com';
        cfg.topbarEmail = topbarEmail;
        try { localStorage.setItem('gug_event_theme_config', JSON.stringify(cfg)); } catch(e) {}
    }
    const salesPageName = localStorage.getItem('gug_sales_event_name') || 'Sales';
    const isSalesActive = localStorage.getItem('gug_sales_page_active') === 'true';

    placeholder.innerHTML = `
        <header class="tf-header">
            <!-- Topbar -->
            <div class="topbar" style="background-color: ${cfg.topbarBg || '#050709'}; border-bottom: 1px solid #14191f; padding: 5px 0; font-size: 12px; color: var(--text-secondary);">
                <div class="topbar-inner w-100 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div class="d-flex align-items-center flex-wrap gap-3">
                        <span><i class="icon icon-map-marker-alt-solid text-danger me-1"></i> ${topbarAddress}</span>
                        <span><i class="icon icon-envelope-solid text-danger me-1"></i> ${topbarEmail}</span>
                    </div>
                    <div class="d-flex align-items-center gap-3 flex-wrap">
                        <span class="d-inline-flex align-items-center"><i class="icon icon-phone-alt-solid text-danger me-1"></i> <strong class="text-white">${phoneLabel}</strong>&nbsp;<a href="tel:${phoneClean}" class="text-white fw-bold text-decoration-none" style="letter-spacing: 0.3px;">${queryPhone}</a></span>
                        <span class="d-none d-lg-inline-flex align-items-center"><i class="icon icon-clock-solid text-danger me-1"></i> ${storeDays}: ${storeHours}</span>
                    </div>
                </div>
            </div>
            
            ${isSalesActive ? `
            <!-- Active Sales Campaign Topbar Announcement -->
            <div class="sales-campaign-topbar text-center py-2 px-3 fw-bold" style="background: linear-gradient(90deg, #990000 0%, #E50303 50%, #990000 100%); color: #ffffff; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.15);" onclick="window.location.href='sales.html'">
                <a href="sales.html" class="text-white text-decoration-none d-flex align-items-center justify-content-center gap-2 flex-wrap" style="font-size: 13px;">
                    <span class="badge bg-white text-danger fw-bold px-2 py-1"><i class="fas fa-bolt me-1"></i> SPECIAL EVENT</span>
                    <span><strong>${salesPageName.toUpperCase()} IS NOW LIVE!</strong> Click here to browse exclusive discounted hardware & gadgets!</span>
                    <span class="text-white text-decoration-underline ms-2">VIEW DEALS <i class="fas fa-arrow-right ms-1"></i></span>
                </a>
            </div>
            ` : ''}
            
            <div class="header-inner w-100 d-flex justify-content-between align-items-center py-2">
                <!-- Left Wrapper for Logo (aligned completely to the left) -->
                <div class="header-logo-wrapper d-flex align-items-center justify-content-start" style="flex: 0 0 auto;">
                    <a href="index.html" class="logo-site d-flex align-items-center gap-2">
                        <img src="assets/images/logo.png" alt="Gear Up Gadgets" style="max-height: 65px; width: auto; object-fit: contain;">
                    </a>
                </div>

                <!-- Desktop Navigation and Actions (grouped completely on the right) -->
                <div class="header-right-group ms-auto d-none d-lg-flex align-items-center justify-content-end" style="flex: 0 0 auto;">
                    <div class="box-navigation">
                        <ul class="nav-menu-main d-flex list-unstyled m-0 p-0 align-items-center">
                            <li class="menu-item"><a href="index.html" class="item-link">Home</a></li>
                            ${isSalesActive ? `<li class="menu-item"><a href="sales.html" class="item-link text-danger fw-bold"><i class="fas fa-tags me-1"></i>${salesPageName}</a></li>` : ''}
                            <li class="menu-item nav-dropdown">
                                <a href="shop.html" class="item-link d-flex align-items-center gap-1" style="display: flex; align-items: center; gap: 4px;">
                                    Product <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </a>
                                <ul class="dropdown-menu-custom list-unstyled m-0">
                                    <li class="dropdown-heading" style="grid-column: 1 / -1;">Products</li>
                                    <li><a href="shop.html?category=mobiles"><i class="fas fa-mobile-screen-button text-danger me-2"></i>Mobiles</a></li>
                                    <li><a href="shop.html?category=mouse"><i class="fas fa-mouse text-danger me-2"></i>Mouse</a></li>
                                    <li><a href="shop.html?category=mechanical keyboards"><i class="fas fa-keyboard text-danger me-2"></i>Keyboards</a></li>
                                    <li><a href="shop.html?category=gaming mice"><i class="fas fa-mouse text-danger me-2"></i>Mice</a></li>
                                    <li><a href="shop.html?category=monitors"><i class="fas fa-desktop text-danger me-2"></i>Monitors</a></li>
                                    <li><a href="shop.html?category=processors"><i class="fas fa-microchip text-danger me-2"></i>CPUs</a></li>
                                    <li><a href="shop.html?category=casings"><i class="fas fa-server text-danger me-2"></i>Casings</a></li>
                                    <li><a href="shop.html?category=cooling fans"><i class="fas fa-fan text-danger me-2"></i>Cooling Fans</a></li>
                                    <li><a href="shop.html?category=nvme ssds"><i class="fas fa-hdd text-danger me-2"></i>SSDs</a></li>
                                    <li><a href="shop.html?category=hard drives"><i class="fas fa-database text-danger me-2"></i>Hard Drives</a></li>
                                    <li><a href="shop.html?category=ram"><i class="fas fa-memory text-danger me-2"></i>RAM</a></li>
                                    <li><a href="shop.html?category=rom"><i class="fas fa-save text-danger me-2"></i>ROM</a></li>
                                    <li><a href="shop.html?category=laptops"><i class="fas fa-laptop text-danger me-2"></i>Laptops</a></li>
                                    <li><a href="shop.html?category=computers"><i class="fas fa-tv text-danger me-2"></i>Computers</a></li>
                                    <li><a href="shop.html?category=accessories"><i class="fas fa-plug text-danger me-2"></i>Accessories</a></li>
                                    <li><a href="shop.html?category=headphones"><i class="fas fa-headphones text-danger me-2"></i>Headphones</a></li>
                                </ul>
                            </li>
                            <li class="menu-item"><a href="about.html" class="item-link">About Us</a></li>
                            <li class="menu-item"><a href="contact.html" class="item-link">Contact</a></li>
                            <li class="menu-item"><a href="repair.html" class="item-link text-white fw-bold" style="background-color: var(--accent-red); padding: 8px 18px !important; font-size: 13px !important; border-radius: 50px; display: inline-flex; align-items: center; justify-content: center; text-align: center; text-decoration: none; box-shadow: 0 2px 8px rgba(220,53,69,0.3); white-space: nowrap;"><i class="fas fa-tools me-2"></i>Repairing &amp; Data Recovery</a></li>
                        </ul>
                    </div>

                    <div class="d-flex align-items-center header-actions gap-2">
                        <div class="header-search-widget">
                            <button class="header-search-toggle" id="global-search-toggle" type="button" aria-label="Search">
                                <i class="icon icon-search-solid"></i>
                            </button>
                        </div>

                        <a href="cart.html" class="cart-trigger transition-transform duration-200 ease-in-out hover:scale-105 active:scale-95" aria-label="View Cart">
                            <i class="icon icon-shopping-cart-solid"></i>
                            <span class="cart-count-badge global-cart-count" id="global-cart-count">0</span>
                        </a>
                    </div>
                </div>

                <!-- Mobile Actions (visible < 992px) -->
                <div class="d-flex d-lg-none align-items-center gap-2">
                    <button class="gug-hamburger-btn" id="mobile-search-toggle" type="button" aria-label="Search">
                        <i class="icon icon-search-solid" style="font-size: 16px;"></i>
                    </button>
                    <a href="cart.html" class="cart-trigger" aria-label="View Cart" style="display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border: 1px solid var(--border-color, #2a2f35); border-radius: 8px; position: relative;">
                        <i class="icon icon-shopping-cart-solid" style="font-size: 18px;"></i>
                        <span class="cart-count-badge global-cart-count" id="global-mobile-cart-count" style="position: absolute; top: -3px; right: -3px;">0</span>
                    </a>
                    <button class="gug-hamburger-btn" id="gug-hamburger-btn" type="button" aria-label="Toggle Navigation">
                        <i class="fas fa-bars"></i>
                    </button>
                </div>
            </div>

            <!-- Inline Search Panel -->
            <div class="search-inline-panel" id="search-inline-panel" aria-hidden="true">
                <div class="search-inline-panel-inner">
                    <div class="search-inline-body">
                        <input type="text" class="search-inline-input" id="global-search-input" placeholder="Search products..." autocomplete="off">
                        <button class="search-inline-submit" id="global-search-btn" type="button" aria-label="Search">
                            <i class="icon icon-search-solid"></i>
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- Mobile Navigation Offcanvas Drawer -->
        <div id="gug-mobile-drawer" class="gug-mobile-drawer">
            <div class="mobile-drawer-header">
                <div class="d-flex align-items-center gap-2">
                    <img src="assets/images/logo.png" alt="Gear Up Gadgets" style="max-height: 40px; width: auto;">
                    <span class="text-white fw-bold" style="font-size: 16px; letter-spacing: 0.5px;">NAVIGATION</span>
                </div>
                <button type="button" id="gug-mobile-close" class="btn-close-custom" aria-label="Close Navigation" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="mobile-drawer-body">
                <!-- Mobile Search -->
                <form id="gug-drawer-search-form" class="d-flex gap-2">
                    <input type="text" id="gug-drawer-search-input" class="form-control" placeholder="Search gadgets..." style="background: #141920; border: 1px solid var(--border-color, #232b36); color: #fff; font-size: 14px; border-radius: 6px;">
                    <button type="submit" class="btn btn-danger px-3" style="background: var(--accent-red); border: none; border-radius: 6px;">
                        <i class="fas fa-search"></i>
                    </button>
                </form>

                <!-- Navigation Links -->
                <div>
                    <div class="text-uppercase text-secondary fw-bold mb-2" style="font-size: 11px; letter-spacing: 1px;">Menu</div>
                    <ul class="mobile-drawer-nav">
                        <li><a href="index.html" class="mobile-nav-link"><i class="fas fa-home me-2 text-danger"></i>Home</a></li>
                        ${isSalesActive ? `<li><a href="sales.html" class="mobile-nav-link text-danger fw-bold"><i class="fas fa-tags me-2 text-danger"></i>${salesPageName}</a></li>` : ''}
                        <li><a href="shop.html" class="mobile-nav-link"><i class="fas fa-boxes me-2 text-danger"></i>Product</a></li>
                        <li><a href="about.html" class="mobile-nav-link"><i class="fas fa-info-circle me-2 text-danger"></i>About Us</a></li>
                        <li><a href="contact.html" class="mobile-nav-link"><i class="fas fa-envelope me-2 text-danger"></i>Contact Us</a></li>
                    </ul>
                </div>

                <!-- Categories -->
                <div>
                    <div class="text-uppercase text-secondary fw-bold mb-2" style="font-size: 11px; letter-spacing: 1px;">Categories</div>
                    <div class="d-flex flex-wrap gap-2">
                        <a href="shop.html?category=mobiles" class="mobile-category-pill">Mobiles</a>
                        <a href="shop.html?category=mouse" class="mobile-category-pill">Mouse</a>
                        <a href="shop.html?category=mechanical keyboards" class="mobile-category-pill">Keyboards</a>
                        <a href="shop.html?category=gaming mice" class="mobile-category-pill">Mice</a>
                        <a href="shop.html?category=monitors" class="mobile-category-pill">Monitors</a>
                        <a href="shop.html?category=processors" class="mobile-category-pill">CPUs</a>
                        <a href="shop.html?category=casings" class="mobile-category-pill">Casings</a>
                        <a href="shop.html?category=cooling fans" class="mobile-category-pill">Cooling Fans</a>
                        <a href="shop.html?category=nvme ssds" class="mobile-category-pill">SSDs</a>
                        <a href="shop.html?category=hard drives" class="mobile-category-pill">Hard Drives</a>
                        <a href="shop.html?category=ram" class="mobile-category-pill">RAM</a>
                        <a href="shop.html?category=rom" class="mobile-category-pill">ROM</a>
                        <a href="shop.html?category=laptops" class="mobile-category-pill">Laptops</a>
                        <a href="shop.html?category=computers" class="mobile-category-pill">Computers</a>
                        <a href="shop.html?category=accessories" class="mobile-category-pill">Accessories</a>
                        <a href="shop.html?category=headphones" class="mobile-category-pill">Headphones</a>
                    </div>
                </div>

                <!-- Repair & Recovery Action -->
                <div>
                    <a href="repair.html" class="btn w-100 py-2 fw-bold text-white d-flex align-items-center justify-content-center gap-2" style="background-color: var(--accent-red); border-radius: 8px; text-decoration: none;">
                        <i class="fas fa-tools"></i> Repairing &amp; Data Recovery
                    </a>
                </div>

                <!-- Panel Logins -->
                <div>
                    <div class="text-uppercase text-secondary fw-bold mb-2" style="font-size: 11px; letter-spacing: 1px;">Panel Logins & Portals</div>
                    <div class="d-flex flex-column gap-2">
                        <a href="admin.html" class="mobile-portal-card">
                            <i class="fas fa-shield-alt text-danger"></i>
                            <span>Admin Management</span>
                        </a>
                        <a href="dealer-login.html" class="mobile-portal-card">
                            <i class="fas fa-handshake text-danger"></i>
                            <span>Dealer Portal</span>
                        </a>
                        <a href="staff-login.html" class="mobile-portal-card">
                            <i class="fas fa-id-badge text-danger"></i>
                            <span>Staff Portal</span>
                        </a>
                        <a href="track.html" class="mobile-portal-card">
                            <i class="fas fa-search-location text-danger"></i>
                            <span>Track Order / Repair</span>
                        </a>
                    </div>
                </div>

                <!-- Contact & Timings -->
                <div class="pt-2 border-top" style="border-color: var(--border-color, #1a222d) !important; font-size: 12px; color: var(--text-secondary);">
                    <div class="mb-1"><i class="fas fa-phone text-danger me-2"></i> <strong class="text-white">${phoneLabel}</strong> <a href="tel:${phoneClean}" class="text-white text-decoration-none fw-bold">${queryPhone}</a></div>
                    <div class="mb-1"><i class="fas fa-envelope text-danger me-2"></i> ${topbarEmail}</div>
                    <div><i class="fas fa-clock text-danger me-2"></i> ${storeDays}: ${storeHours}</div>
                </div>
            </div>
        </div>
        <div id="gug-mobile-backdrop" class="gug-mobile-backdrop"></div>
    `;

    setupMobileDrawerEvents();
}

function setupMobileDrawerEvents() {
    const hamburgerBtn = document.getElementById('gug-hamburger-btn');
    const drawer = document.getElementById('gug-mobile-drawer');
    const backdrop = document.getElementById('gug-mobile-backdrop');
    const closeBtn = document.getElementById('gug-mobile-close');
    const searchForm = document.getElementById('gug-drawer-search-form');
    const searchInput = document.getElementById('gug-drawer-search-input');

    if (!drawer || !backdrop) return;

    function openDrawer(e) {
        if (e) e.preventDefault();
        drawer.classList.add('active');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        drawer.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Close on navigation click inside drawer
    drawer.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            closeDrawer();
        });
    });

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const q = searchInput.value.trim();
            if (q) {
                closeDrawer();
                window.location.href = `shop.html?search=${encodeURIComponent(q)}`;
            }
        });
    }
}

function injectFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) return;

    let cfg = {};
    try {
        cfg = JSON.parse(localStorage.getItem('gug_event_theme_config') || '{}');
    } catch(e) {}

    const shopAddr = cfg.footerShopAddress || 'FA-06, 1st floor, Techno City Mall, Karachi.';
    const officeAddr = cfg.footerHeadOffice || 'D-5, 4th floor, Osif Center, Block 13 A, University Road Gulshan-e-Iqbal, Karachi-Pakistan.';
    const aboutText = cfg.footerAbout || "Pakistan's premier high-end computer store. Servicing tech enthusiasts, gaming communities, and rendering professionals since 2012 with premium hardware, graphics cards, custom PC assembly, and unmatched support.";
    const copyright = cfg.footerCopyright || 'Copyright &copy; 2021 to 2026 <a href="index.html" class="text-white fw-bold">GEAR UP GADGETS</a>. All rights reserved.';
    
    // Contact Info - Support Multiple Arrays & Fallback Single Strings
    const queriesPhones = (Array.isArray(cfg.queriesPhones) && cfg.queriesPhones.length > 0)
        ? cfg.queriesPhones
        : [(cfg.footerPhone || cfg.topbarPhone || '021 34832214')];
    const queryPhone = queriesPhones[0];
    const phoneClean = queryPhone.replace(/\s+/g, '');
    const phoneLabel = cfg.footerPhoneLabel || 'Queries:';

    const whatsappNumbers = (Array.isArray(cfg.whatsappNumbers) && cfg.whatsappNumbers.length > 0)
        ? cfg.whatsappNumbers
        : (cfg.footerWhatsapp ? [cfg.footerWhatsapp] : []);
    const whatsapp = whatsappNumbers[0] || '';
    const whatsappClean = whatsapp.replace(/[^0-9]/g, '');

    const supportEmails = (Array.isArray(cfg.supportEmails) && cfg.supportEmails.length > 0)
        ? cfg.supportEmails
        : [(cfg.footerEmail || cfg.topbarEmail || 'sales@gearupgadget.com')];
    const footerEmail = supportEmails[0];

    const generalPhones = (Array.isArray(cfg.generalPhones) && cfg.generalPhones.length > 0)
        ? cfg.generalPhones
        : [];

    const storeHours = cfg.footerStoreHours || '12:00 PM - 8:00 PM';
    const storeDays = cfg.footerStoreDays || 'Monday - Saturday (Sunday Closed)';

    // Pre-Footer Top Bar
    const topBarEnabled = cfg.footerTopBarEnabled !== false;
    const topBarTitle = cfg.footerTopBarTitle || 'Our Official Partners';
    const topBarSubtitle = cfg.footerTopBarSubtitle || 'Authorized hardware distributors and certified premium brands in Pakistan';
    const featuresEnabled = cfg.footerFeaturesEnabled !== false;
    const footerPartners = cfg.footerPartnersEnabled !== false;

    // Helper to style the last word of title with red accent
    const titleWords = topBarTitle.trim().split(' ');
    let formattedTitle = topBarTitle;
    if (titleWords.length > 1) {
        const lastWord = titleWords.pop();
        formattedTitle = `${titleWords.join(' ')} <span style="color: var(--accent-red);">${lastWord}</span>`;
    } else {
        formattedTitle = `<span style="color: var(--accent-red);">${topBarTitle}</span>`;
    }

    placeholder.innerHTML = `
        ${topBarEnabled ? `
        <!-- PRE-FOOTER TOP BAR SECTION -->
        <div class="pre-footer-topbar" style="margin-bottom: 25px; padding-top: 40px; border-bottom: 1px solid var(--border-color);">
            <div class="gug-container">
                ${featuresEnabled ? `
                <!-- Trust & Guarantee Value Badges -->
                <div class="row g-3 justify-content-center mb-4 pb-2">
                    <div class="col-6 col-md-3">
                        <div class="p-3 rounded-3 d-flex align-items-center gap-3" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color);">
                            <div class="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style="width: 44px; height: 44px; background: rgba(229,3,3,0.1); color: var(--accent-red); font-size: 1.25rem;">
                                <i class="fas fa-shield-halved"></i>
                            </div>
                            <div>
                                <h6 class="text-white fw-bold mb-0" style="font-size: 13px;">100% Genuine</h6>
                                <span class="text-secondary small" style="font-size: 11px;">Authentic Box Pack</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 rounded-3 d-flex align-items-center gap-3" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color);">
                            <div class="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style="width: 44px; height: 44px; background: rgba(229,3,3,0.1); color: var(--accent-red); font-size: 1.25rem;">
                                <i class="fas fa-award"></i>
                            </div>
                            <div>
                                <h6 class="text-white fw-bold mb-0" style="font-size: 13px;">Official Warranty</h6>
                                <span class="text-secondary small" style="font-size: 11px;">Brand Claim Support</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 rounded-3 d-flex align-items-center gap-3" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color);">
                            <div class="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style="width: 44px; height: 44px; background: rgba(229,3,3,0.1); color: var(--accent-red); font-size: 1.25rem;">
                                <i class="fas fa-truck-fast"></i>
                            </div>
                            <div>
                                <h6 class="text-white fw-bold mb-0" style="font-size: 13px;">Express Shipping</h6>
                                <span class="text-secondary small" style="font-size: 11px;">Nationwide Delivery</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 rounded-3 d-flex align-items-center gap-3" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color);">
                            <div class="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style="width: 44px; height: 44px; background: rgba(229,3,3,0.1); color: var(--accent-red); font-size: 1.25rem;">
                                <i class="fas fa-headset"></i>
                            </div>
                            <div>
                                <h6 class="text-white fw-bold mb-0" style="font-size: 13px;">Expert Support</h6>
                                <span class="text-secondary small" style="font-size: 11px;">6 Days A Week</span>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${footerPartners ? `
                <div class="text-center mb-3">
                    <h3 style="font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: var(--text-primary); margin-bottom: 6px;">
                        ${formattedTitle}
                    </h3>
                    ${topBarSubtitle ? `<p class="text-secondary small mb-3" style="letter-spacing: 0.5px;">${topBarSubtitle}</p>` : ''}
                    
                    <!-- Brand Logo Marquee -->
                    <div class="brand-marquee-container" style="padding-bottom: 25px; margin-bottom: 0;">
                        <div class="brand-marquee align-items-center">
                            <!-- First Set -->
                            <a href="shop.html?brand=dell" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/dell/E50303" alt="Dell" class="brand-logo-img"></a>
                            <a href="shop.html?brand=hp" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/hp/E50303" alt="HP" class="brand-logo-img"></a>
                            <a href="shop.html?brand=lenovo" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/lenovo/E50303" alt="Lenovo" class="brand-logo-img"></a>
                            <a href="shop.html?brand=asus" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/asus/E50303" alt="ASUS" class="brand-logo-img"></a>
                            <a href="shop.html?brand=acer" style="cursor:pointer; text-decoration: none;"><span class="brand-logo-text custom-text-brand" style="font-family: Arial, sans-serif; font-weight: 800; font-style: italic;">acer</span></a>
                            <a href="shop.html?brand=apple" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/apple/E50303" alt="Apple" class="brand-logo-img"></a>
                            <a href="shop.html?brand=msi" style="cursor:pointer; text-decoration: none;"><span class="brand-logo-text custom-text-brand" style="font-family: Arial, sans-serif; font-weight: 800; letter-spacing: 2px;">MSI</span></a>
                            <a href="shop.html?brand=gigabyte" style="cursor:pointer; text-decoration: none;"><span class="brand-logo-text custom-text-brand" style="font-family: 'Times New Roman', serif; font-weight: bold;">GIGABYTE</span></a>
                            <a href="shop.html?brand=corsair" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/corsair/E50303" alt="Corsair" class="brand-logo-img"></a>
                            <a href="shop.html?brand=intel" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/intel/E50303" alt="Intel" class="brand-logo-img"></a>
                            <a href="shop.html?brand=amd" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/amd/E50303" alt="AMD" class="brand-logo-img"></a>
                            <a href="shop.html?brand=nvidia" style="cursor:pointer;"><img src="https://cdn.simpleicons.org/nvidia/E50303" alt="NVIDIA" class="brand-logo-img"></a>
                            
                            <!-- Duplicated for seamless loop -->
                            <a href="shop.html?brand=dell" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/dell/E50303" alt="Dell" class="brand-logo-img"></a>
                            <a href="shop.html?brand=hp" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/hp/E50303" alt="HP" class="brand-logo-img"></a>
                            <a href="shop.html?brand=lenovo" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/lenovo/E50303" alt="Lenovo" class="brand-logo-img"></a>
                            <a href="shop.html?brand=asus" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/asus/E50303" alt="ASUS" class="brand-logo-img"></a>
                            <a href="shop.html?brand=acer" style="cursor:pointer; text-decoration: none;" aria-hidden="true"><span class="brand-logo-text custom-text-brand" style="font-family: Arial, sans-serif; font-weight: 800; font-style: italic;">acer</span></a>
                            <a href="shop.html?brand=apple" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/apple/E50303" alt="Apple" class="brand-logo-img"></a>
                            <a href="shop.html?brand=msi" style="cursor:pointer; text-decoration: none;" aria-hidden="true"><span class="brand-logo-text custom-text-brand" style="font-family: Arial, sans-serif; font-weight: 800; letter-spacing: 2px;">MSI</span></a>
                            <a href="shop.html?brand=gigabyte" style="cursor:pointer; text-decoration: none;" aria-hidden="true"><span class="brand-logo-text custom-text-brand" style="font-family: 'Times New Roman', serif; font-weight: bold;">GIGABYTE</span></a>
                            <a href="shop.html?brand=corsair" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/corsair/E50303" alt="Corsair" class="brand-logo-img"></a>
                            <a href="shop.html?brand=intel" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/intel/E50303" alt="Intel" class="brand-logo-img"></a>
                            <a href="shop.html?brand=amd" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/amd/E50303" alt="AMD" class="brand-logo-img"></a>
                            <a href="shop.html?brand=nvidia" style="cursor:pointer;" aria-hidden="true"><img src="https://cdn.simpleicons.org/nvidia/E50303" alt="NVIDIA" class="brand-logo-img"></a>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        <footer style="background-color: var(--bg-header); padding: 40px 0 20px 0; font-size: 14px; color: var(--text-secondary);">
            <div class="gug-container">
                <div class="row g-4 mb-4">
                    <!-- Column 1: About & Locations -->
                    <div class="col-lg-4 col-md-6">
                        <img src="assets/images/logo.png" alt="Gear Up Gadgets" style="max-height: 80px; margin-bottom: 20px;">
                        <p class="mb-3" style="line-height: 1.6;">${aboutText}</p>
                        <div style="color: var(--text-primary); font-size: 13px; line-height: 1.5;">
                            <p class="mb-2"><strong style="color: white;"><i class="icon icon-map-marker-alt-solid text-danger me-2"></i> SHOP ADDRESS:</strong><br><span style="padding-left: 22px; display: block;">${shopAddr}</span></p>
                            <p class="mb-0"><strong style="color: white;"><i class="icon icon-map-marker-alt-solid text-danger me-2"></i> HEAD OFFICE:</strong><br><span style="padding-left: 22px; display: block;">${officeAddr}</span></p>
                        </div>
                    </div>

                    <!-- Column 2: Support Menu -->
                    <div class="col-lg-2 col-md-6">
                        <h5 class="text-white mb-4" style="font-weight: 700; font-size: 16px;">SUPPORT MENU</h5>
                        <ul class="list-unstyled p-0 m-0" style="line-height: 2;">
                            <li><a href="about.html" class="text-secondary hover-danger">About Us</a></li>
                            <li><a href="contact.html" class="text-secondary hover-danger">Contact Us</a></li>
                            <li><a href="repair.html" class="text-secondary hover-danger"><i class="fas fa-tools text-danger me-1"></i> Repairing &amp; Data Recovery</a></li>
                            <li><a href="dealer-login.html" class="text-secondary hover-danger"><i class="fas fa-handshake text-danger me-1"></i> B2B Dealer Portal</a></li>
                            <li><a href="staff-login.html" class="text-secondary hover-danger"><i class="fas fa-id-badge text-danger me-1"></i> Staff Workspace</a></li>
                            <li><a href="admin.html" class="text-secondary hover-danger"><i class="fas fa-shield-alt text-danger me-1"></i> Admin Portal</a></li>
                            <li><a href="terms.html" class="text-secondary hover-danger">Terms & Conditions</a></li>
                            <li><a href="privacy.html" class="text-secondary hover-danger">Privacy Policy</a></li>
                        </ul>
                    </div>

                    <!-- Column 3: Categories -->
                    <div class="col-lg-3 col-md-6">
                        <h5 class="text-white mb-4" style="font-weight: 700; font-size: 16px;">CATEGORIES</h5>
                        <ul class="list-unstyled p-0 m-0" style="line-height: 2; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                            <li><a href="shop.html?category=processors" class="text-secondary hover-danger">Processors</a></li>
                            <li><a href="shop.html?category=graphics-cards" class="text-secondary hover-danger">GPUs</a></li>
                            <li><a href="shop.html?category=monitors" class="text-secondary hover-danger">Monitors</a></li>
                            <li><a href="shop.html?category=motherboards" class="text-secondary hover-danger">Motherboards</a></li>
                            <li><a href="shop.html?category=ram" class="text-secondary hover-danger">RAM</a></li>
                            <li><a href="shop.html?category=storage" class="text-secondary hover-danger">SSD/Storage</a></li>
                            <li><a href="shop.html?category=cooling-solutions" class="text-secondary hover-danger">Coolers</a></li>
                            <li><a href="shop.html?category=casing" class="text-secondary hover-danger">Cases</a></li>
                        </ul>
                    </div>

                    <!-- Column 4: Contact Us -->
                    <div class="col-lg-3 col-md-6">
                        <h5 class="text-white mb-4" style="font-weight: 700; font-size: 16px;">CONTACT US</h5>
                        <ul class="list-unstyled p-0 m-0" style="line-height: 1.8;">
                            ${queriesPhones.map((ph, idx) => `
                                <li class="mb-2"><strong>${idx === 0 ? phoneLabel : 'Queries ' + (idx + 1) + ':'}</strong> <a href="tel:${ph.replace(/\s+/g, '')}" class="text-white fw-bold text-decoration-none" style="letter-spacing: 0.3px; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='#ffffff'">${ph}</a></li>
                            `).join('')}
                            ${generalPhones.map((gph, idx) => `
                                <li class="mb-2"><strong>Landline ${generalPhones.length > 1 ? (idx + 1) + ':' : ':'}</strong> <a href="tel:${gph.replace(/\s+/g, '')}" class="text-white fw-bold text-decoration-none" style="letter-spacing: 0.3px; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='#ffffff'">${gph}</a></li>
                            `).join('')}
                            ${whatsappNumbers.map((wa, idx) => `
                                <li class="mb-2"><strong>WhatsApp ${whatsappNumbers.length > 1 ? (idx + 1) + ':' : ':'}</strong> <a href="https://wa.me/${wa.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" class="text-white fw-bold text-decoration-none" style="letter-spacing: 0.3px; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='#ffffff'">${wa}</a></li>
                            `).join('')}
                            <li class="mb-2"><strong>Store Hours:</strong> <span class="text-white">${storeHours}</span>${storeDays ? `<br><span class="small text-secondary">${storeDays}</span>` : ''}</li>
                            ${supportEmails.map((em, idx) => `
                                <li class="mb-2"><strong>${idx === 0 ? 'Support Email:' : 'Email ' + (idx + 1) + ':'}</strong> <a href="mailto:${em}" class="text-secondary text-decoration-none hover-danger d-block">${em}</a></li>
                            `).join('')}
                        </ul>
                    </div>
                </div>

                <div style="border-top: 1px solid var(--border-color); padding-top: 20px;" class="d-flex justify-content-between align-items-center flex-wrap gap-10">
                    <p class="m-0" style="font-size: 13px;">${copyright}</p>
                    <div class="d-flex gap-15">
                        <a href="#" class="text-secondary hover-danger" style="font-size: 16px;"><i class="icon icon-facebook-f-brands"></i></a>
                        <a href="#" class="text-secondary hover-danger" style="font-size: 16px;"><i class="icon icon-twitter-brands"></i></a>
                        <a href="#" class="text-secondary hover-danger" style="font-size: 16px;"><i class="icon icon-youtube-brands"></i></a>
                        <a href="#" class="text-secondary hover-danger" style="font-size: 16px;"><i class="icon icon-instagram-brands"></i></a>
                    </div>
                </div>
            </div>
        </footer>
    `;

    // Hydrate contact page elements if present
    hydrateContactPageElements(cfg);
}

function hydrateContactPageElements(cfg) {
    if (!cfg) return;
    const phoneEl = document.getElementById('contact-page-queries-phone');
    const ph = (Array.isArray(cfg.queriesPhones) && cfg.queriesPhones[0]) || cfg.footerPhone || cfg.topbarPhone;
    if (phoneEl && ph) {
        phoneEl.textContent = ph;
        phoneEl.href = `tel:${ph.replace(/\s+/g, '')}`;
    }
    const hoursEl = document.getElementById('contact-page-store-hours');
    if (hoursEl && cfg.footerStoreHours) {
        hoursEl.textContent = `${cfg.footerStoreDays || 'Monday to Saturday'}: ${cfg.footerStoreHours}`;
    }
    const shopAddrEl = document.getElementById('contact-page-shop-addr');
    if (shopAddrEl && cfg.footerShopAddress) {
        shopAddrEl.textContent = cfg.footerShopAddress;
    }
    const officeAddrEl = document.getElementById('contact-page-office-addr');
    if (officeAddrEl && cfg.footerHeadOffice) {
        officeAddrEl.textContent = cfg.footerHeadOffice;
    }
    const emailEl = document.getElementById('contact-page-support-email');
    const em = (Array.isArray(cfg.supportEmails) && cfg.supportEmails[0]) || cfg.footerEmail || cfg.topbarEmail;
    if (emailEl && em) {
        emailEl.textContent = em;
    }
}

function injectToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
}

// --- Cart Actions ---

function getCart() {
    try {
        const cart = localStorage.getItem('gear_up_cart');
        return cart ? JSON.parse(cart) : [];
    } catch (e) {
        console.error('Error parsing cart from localStorage:', e);
        return [];
    }
}

function saveCart(cart) {
    try {
        localStorage.setItem('gear_up_cart', JSON.stringify(cart));
    } catch (e) {
        console.error('Error saving cart to localStorage:', e);
    }
    updateCartBadge();
    // Dispatch custom event to let pages know the cart updated
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
}

let _lastAddToCartTime = 0;
let _lastAddToCartId = null;

function addToCart(productOrId, qty = 1) {
    const rawId = (productOrId && typeof productOrId === 'object' && productOrId.id) ? productOrId.id : productOrId;
    const now = Date.now();
    // Guard: Prevent double invocation within 400ms for the exact same item
    if (rawId && String(rawId) === String(_lastAddToCartId) && (now - _lastAddToCartTime) < 400) {
        console.warn('addToCart duplicate invocation blocked within 400ms for:', rawId);
        return;
    }
    _lastAddToCartId = rawId;
    _lastAddToCartTime = now;

    let dataList = (window.GUG_DB && typeof window.GUG_DB.getStorefrontProducts === 'function')
        ? window.GUG_DB.getStorefrontProducts()
        : (window.PRODUCTS_DATA || (typeof productDatabase !== "undefined" ? productDatabase : []));
    
    let product = null;
    if (productOrId && typeof productOrId === 'object' && productOrId.id) {
        product = productOrId;
    } else if (productOrId) {
        const pIdStr = String(productOrId).trim().toLowerCase();
        product = dataList.find(p => 
            String(p.id).trim().toLowerCase() === pIdStr || 
            String(p.numericId || '').trim() === pIdStr ||
            String(p.sku || '').trim().toLowerCase() === pIdStr
        );
    }

    if (!product) {
        console.warn('addToCart: Product not found for identifier:', productOrId);
        return;
    }

    const cleanPrice = parseFloat(String(product.price).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || 0;
    const cleanOrigPrice = product.originalPrice ? parseFloat(String(product.originalPrice).replace(/Rs\.?/gi, '').replace(/,/g, '').trim()) || cleanPrice : cleanPrice;

    let cart = getCart();
    let existingItem = cart.find(item => String(item.id).trim().toLowerCase() === String(product.id).trim().toLowerCase());

    const numQty = parseInt(qty, 10) || 1;
    if (existingItem) {
        existingItem.qty = (parseInt(existingItem.qty, 10) || 0) + numQty;
    } else {
        cart.push({
            id: product.id,
            name: product.name || product.title,
            price: cleanPrice,
            onSale: !!product.onSale,
            originalPrice: cleanOrigPrice,
            image: product.image || 'assets/images/logo.png',
            category: product.category || 'General',
            qty: numQty
        });
    }

    saveCart(cart);
    showToast(`"${product.name || product.title}" added to cart!`, 'success');
}

function removeFromCart(productId) {
    if (!productId) return;
    const targetIdStr = String(productId).trim().toLowerCase();
    let cart = getCart();
    const initialLen = cart.length;
    cart = cart.filter(item => String(item.id).trim().toLowerCase() !== targetIdStr);
    
    saveCart(cart);
    if (cart.length < initialLen) {
        showToast('Item removed from cart.', 'info');
    }
}

function updateCartQty(productId, qty) {
    if (!productId) return;
    const numQty = parseInt(qty, 10);
    if (isNaN(numQty) || numQty <= 0) {
        removeFromCart(productId);
        return;
    }
    const targetIdStr = String(productId).trim().toLowerCase();
    let cart = getCart();
    let item = cart.find(item => String(item.id).trim().toLowerCase() === targetIdStr);
    if (item) {
        item.qty = numQty;
        saveCart(cart);
    }
}

function clearCart() {
    saveCart([]);
    showToast('Your cart has been cleared.', 'info');
}

function updateCartBadge() {
    const badges = document.querySelectorAll('.global-cart-count, #global-cart-count, #global-mobile-cart-count');
    if (!badges || badges.length === 0) return;
    
    const cart = getCart();
    const totalQty = cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    badges.forEach(b => {
        b.innerText = totalQty;
    });
}

// Window attachments for cross-script access
window.getCart = getCart;
window.saveCart = saveCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQty = updateCartQty;
window.clearCart = clearCart;
window.updateCartBadge = updateCartBadge;
window.showToast = showToast;
window.handleCargoAddToCart = handleCargoAddToCart;

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification show ${type === 'success' ? 'success' : ''}`;
    
    let icon = '<i class="icon icon-info-circle-solid text-info"></i>';
    if (type === 'success') {
        icon = '<i class="icon icon-check-circle-solid text-success" style="font-size: 18px;"></i>';
    } else if (type === 'error') {
        icon = '<i class="icon icon-exclamation-triangle-solid text-danger"></i>';
    }
    
    toast.innerHTML = `
        ${icon}
        <span style="font-size: 13px; font-weight: 500;">${message}</span>
    `;
    
    const container = document.getElementById('toast-container') || document.body;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Search Features ---

function initializeSearch() {
    const searchToggle = document.getElementById('global-search-toggle');
    const mobileSearchToggle = document.getElementById('mobile-search-toggle');
    const panel = document.getElementById('search-inline-panel');
    const searchInput = document.getElementById('global-search-input');

    if (!panel || !searchInput) return;

    const closeBtn = document.getElementById('global-search-close');
    const submitBtn = document.getElementById('global-search-btn');

    const updatePanelHeight = () => {
        const header = document.querySelector('.tf-header');
        const navbarHeight = header ? header.getBoundingClientRect().height : 0;
        const availableHeight = Math.max(window.innerHeight - navbarHeight, 0);
        panel.style.setProperty('--search-panel-height', `${availableHeight}px`);
    };

    const closeSearch = () => {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        if (searchToggle) searchToggle.setAttribute('aria-expanded', 'false');
        searchInput.value = '';
        searchInput.blur();
    };

    const openSearch = () => {
        updatePanelHeight();
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        if (searchToggle) searchToggle.setAttribute('aria-expanded', 'true');
        setTimeout(() => searchInput.focus(), 180);
    };

    if (searchToggle) {
        searchToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (panel.classList.contains('is-open')) {
                closeSearch();
            } else {
                openSearch();
            }
        });
    }

    if (mobileSearchToggle) {
        mobileSearchToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (panel.classList.contains('is-open')) {
                closeSearch();
            } else {
                openSearch();
            }
        });
    }

    closeBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        closeSearch();
    });

    window.addEventListener('resize', updatePanelHeight);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && panel.classList.contains('is-open')) {
            closeSearch();
        }
    });

    const performSearch = (e) => {
        if (e) e.stopPropagation();
        const query = searchInput.value.trim();
        if (query.length > 0) {
            window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
        } else {
            closeSearch();
        }
    };

    submitBtn?.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch(e);
        }
    });
}

// --- Helpers ---

function formatPrice(number) {
    if (typeof number !== 'number') return number;
    return number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function handleCargoAddToCart(button, productId, qty = 1) {
    if (!button || button.disabled || button.classList.contains('is-running') || button.classList.contains('is-done')) return;

    const label = button.querySelector('.btn-text');
    const packageEl = button.querySelector('.package');

    button.classList.remove('is-done');
    button.classList.add('is-running');

    if (label) {
        label.textContent = '';
    }

    window.setTimeout(() => {
        addToCart(productId, qty);
        updateCartBadge();
        button.classList.remove('is-running');
        button.classList.add('is-done');

        if (label) {
            label.textContent = 'Added to cart';
        }

        window.setTimeout(() => {
            button.classList.remove('is-done');
            if (label) {
                label.textContent = 'Add to Cart';
            }
            if (packageEl) {
                packageEl.style.opacity = '';
            }
        }, 2500);
    }, 1600);
}

function initializeAnimationSystem() {
    const header = document.querySelector('.tf-header');
    const heroSection = document.querySelector('.hero-slider-container');

    // Immediately remove any existing preloader or page-loader elements
    const oldLoader = document.getElementById('global-preloader');
    if (oldLoader) oldLoader.remove();
    document.querySelectorAll('.page-loader').forEach(el => el.remove());

    if (header) {
        const onScroll = () => {
            header.classList.toggle('scrolled', window.scrollY > 20);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (heroSection) {
        let ticking = false;
        const parallax = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const offset = Math.max(0, window.scrollY * 0.12);
                    heroSection.style.setProperty('--hero-parallax', `${offset}px`);
                    ticking = false;
                });
                ticking = true;
            }
        };
        window.addEventListener('scroll', parallax, { passive: true });
    }

    // Immediately ensure all cards and reveal elements are rendered with full visibility
    document.querySelectorAll('.reveal, .reveal-up, .reveal-left, .reveal-right, .slide-hidden').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.visibility = 'visible';
    });
}




/* ==========================================================================
   Scroll Reveal Intersection Observer
   ========================================================================== */
const observerOptions = {
    root: null,
    rootMargin: '120px',
    threshold: 0.01 // Trigger immediately when entering proximity
};

const scrollObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            el.classList.add('slide-in-animated');
            el.style.opacity = '1';
            el.style.transform = 'none';
            observer.unobserve(el);
        }
    });
}, observerOptions);

// Attach observer globally so dynamically rendered products can use it immediately
window.gugScrollObserver = scrollObserver;

document.addEventListener('DOMContentLoaded', function () {
    // Initial observation of hardcoded HTML elements with instant visibility guarantee
    const elementsToAnimate = document.querySelectorAll('.slide-hidden');
    elementsToAnimate.forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        scrollObserver.observe(el);
    });
});



// Global Cargo Drop Button Animation Logic
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-cargo');
    if (btn && !btn.classList.contains('is-dropping')) {
        btn.classList.add('is-dropping');
        btn.disabled = true;
        const textSpan = btn.querySelector('.btn-text-default');
        const addedSpan = btn.querySelector('.btn-text-added');
        if (textSpan && addedSpan) {
            textSpan.style.display = 'none';
            addedSpan.style.display = 'inline-block';
            setTimeout(() => {
                btn.classList.remove('is-dropping');
                btn.disabled = false;
                textSpan.style.display = 'inline-block';
                addedSpan.style.display = 'none';
            }, 1600);
        }
    }
});

// Expert Cargo Drop Button Animation Logic (Single Global Authority)
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-cargo-expert');
    if (!btn) return;

    e.preventDefault();
    if (e.stopImmediatePropagation) {
        e.stopImmediatePropagation();
    }

    if (btn.classList.contains('is-running') || btn.classList.contains('is-added') || btn.classList.contains('is-processing') || btn.disabled) {
        return;
    }

    const pid = btn.getAttribute('data-id');
    if (!pid) return;

    btn.disabled = true;
    btn.classList.add('is-running', 'is-added', 'is-processing');

    if (typeof window.addToCart === 'function') {
        window.addToCart(pid, 1);
    }

    // Reset after 3.5 seconds
    setTimeout(() => {
        btn.classList.remove('is-running', 'is-added', 'is-processing');
        btn.disabled = false;
    }, 3500);
});




// --- Repair Services UI ---
function injectRepairUI() {
    if (document.getElementById('repair-sidebar')) return;

    const html = `
        <!-- Off-canvas Sidebar -->
        <div id="repair-sidebar" class="repair-sidebar">
            <div class="repair-sidebar-header">
                <h5 class="m-0 text-white"><i class="fas fa-tools text-danger me-2"></i> Services</h5>
                <button id="repair-sidebar-close" class="btn-close-custom"><i class="fas fa-times"></i></button>
            </div>
            <div class="repair-sidebar-body">
                <a href="repair.html?tab=repair" class="btn w-100 btn-outline-danger d-flex align-items-center justify-content-center gap-2 py-3 fw-bold mb-3" style="border-radius: 8px; text-decoration: none;">
                    <i class="fas fa-wrench"></i> Repairing
                </a>
                <a href="repair.html?tab=recovery" class="btn w-100 d-flex align-items-center justify-content-center gap-2 py-3 fw-bold mb-3 text-white" style="border-radius: 8px; background: linear-gradient(135deg, #1d4ed8, #2563eb); border: none; text-decoration: none;">
                    <i class="fas fa-database"></i> Data Recovery
                </a>
                <a href="track.html" class="btn w-100 d-flex align-items-center justify-content-center gap-2 py-3 fw-bold text-white" style="border-radius: 8px; background-color: var(--accent-red); text-decoration: none;">
                    <i class="fas fa-search-location"></i> Track your Order / Repair
                </a>
            </div>
        </div>
        <div id="repair-sidebar-backdrop" class="repair-backdrop"></div>

        <!-- Repair Modal -->
        <div id="repair-modal" class="repair-modal">
            <div class="repair-modal-content">
                <div class="repair-modal-header">
                    <h4 class="m-0 text-white"><i class="fas fa-wrench text-danger me-2"></i> Repair Request</h4>
                    <button id="repair-modal-close" class="btn-close-custom"><i class="fas fa-times"></i></button>
                </div>
                <div class="repair-modal-body">
                    <form id="repair-request-form">
                        <div class="mb-3">
                            <label class="form-label text-secondary">Full Name</label>
                            <input type="text" name="fullName" class="form-control repair-input" required placeholder="Enter your full name">
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-secondary">Address</label>
                            <textarea name="address" class="form-control repair-input" rows="2" required placeholder="Enter your full address"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-secondary">Office Address (Optional)</label>
                            <input type="text" name="officeAddress" class="form-control repair-input" placeholder="Enter your office address (optional)">
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-secondary">Mobile Phone Number</label>
                            <input type="tel" name="mobileNumber" class="form-control repair-input" required placeholder="03XXXXXXXXX">
                        </div>
                        <div class="mb-3">
                            <label class="form-label text-secondary">Email Address</label>
                            <input type="email" name="email" class="form-control repair-input" required placeholder="you@example.com">
                        </div>
                        <div class="mb-4">
                            <label class="form-label text-secondary">WhatsApp Number</label>
                            <input type="tel" name="whatsappNumber" class="form-control repair-input" required placeholder="03XXXXXXXXX">
                        </div>
                        <button type="submit" class="btn w-100 py-2 fw-bold text-white shadow" style="background-color: var(--accent-red); border: none; border-radius: 8px;">Submit Request</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Data Recovery Modal -->
        <div id="data-recovery-modal" class="recovery-modal">
            <div class="recovery-modal-header">
                <div>
                    <h5 class="m-0 text-white fw-bold"><i class="fas fa-database text-primary me-2"></i> Data Recovery</h5>
                    <small class="text-secondary" style="font-size: 12px;">Storage media diagnostics and recovery</small>
                </div>
                <button id="recovery-modal-close" class="btn-close-custom" aria-label="Close"><i class="fas fa-times"></i></button>
            </div>
            <div class="recovery-modal-body">
                <form id="data-recovery-request-form">
                    <div class="row g-2 mb-2">
                        <div class="col-md-6">
                            <label class="form-label text-secondary small mb-1">Full Name *</label>
                            <input type="text" name="fullName" class="form-control recovery-input" required placeholder="Your full name">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-secondary small mb-1">Mobile Phone *</label>
                            <input type="tel" name="mobileNumber" class="form-control recovery-input" required placeholder="03XXXXXXXXX">
                        </div>
                    </div>
                    <div class="row g-2 mb-2">
                        <div class="col-md-6">
                            <label class="form-label text-secondary small mb-1">WhatsApp Number *</label>
                            <input type="tel" name="whatsappNumber" class="form-control recovery-input" required placeholder="03XXXXXXXXX">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-secondary small mb-1">Email Address *</label>
                            <input type="email" name="email" class="form-control recovery-input" required placeholder="you@example.com">
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label text-secondary small mb-1">City / Residential Address *</label>
                        <input type="text" name="address" class="form-control recovery-input" required placeholder="e.g. Karachi / Lahore / Islamabad...">
                    </div>
                    <div class="mb-2">
                        <label class="form-label text-secondary small mb-1">Office Address (Optional)</label>
                        <input type="text" name="officeAddress" class="form-control recovery-input" placeholder="Complete office / work address (optional)">
                    </div>
                    
                    <div class="p-3 my-3 rounded-2" style="background-color: #080d14; border: 1px solid #1e293b;">
                        <h6 class="text-primary fw-bold mb-2 small text-uppercase"><i class="fas fa-hard-drive me-1"></i> Storage Media Details</h6>
                        <div class="row g-2 mb-2">
                            <div class="col-md-6">
                                <label class="form-label text-secondary small mb-1">Storage Media Type *</label>
                                <select name="mediaType" class="form-select recovery-input" required>
                                    <option value="External USB Hard Drive">External USB Hard Drive (Portable HDD)</option>
                                    <option value="Internal PC/Laptop HDD">Internal Hard Drive (3.5" or 2.5" HDD)</option>
                                    <option value="Solid State Drive (SSD / NVMe)">Solid State Drive (SATA SSD / NVMe M.2)</option>
                                    <option value="USB Flash Drive">USB Flash Pen Drive</option>
                                    <option value="SD / MicroSD Card">SD / MicroSD Memory Card</option>
                                    <option value="RAID / NAS / Server">RAID Array / NAS Storage / Server</option>
                                    <option value="Mobile / Tablet">Mobile Phone / Tablet Storage</option>
                                    <option value="Other Storage Device">Other Storage Device</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-secondary small mb-1">Brand, Model & Capacity *</label>
                                <input type="text" name="mediaBrandCapacity" class="form-control recovery-input" required placeholder="e.g. Seagate 2TB, Samsung 980 1TB">
                            </div>
                        </div>
                        <div class="row g-2">
                            <div class="col-md-6">
                                <label class="form-label text-secondary small mb-1">File System / OS Used</label>
                                <select name="fileSystem" class="form-select recovery-input">
                                    <option value="Windows (NTFS / FAT32 / exFAT)">Windows (NTFS / FAT32 / exFAT)</option>
                                    <option value="macOS (APFS / HFS+)">macOS (APFS / HFS+)</option>
                                    <option value="Linux (ext4 / Btrfs / XFS)">Linux (ext4 / Btrfs / XFS)</option>
                                    <option value="Unknown / Not Sure">Unknown / Not Sure</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-secondary small mb-1">Service Urgency *</label>
                                <select name="urgency" class="form-select recovery-input">
                                    <option value="Standard (3-5 Days)">Standard Diagnostics (3-5 Business Days)</option>
                                    <option value="Priority (24-48 Hours)">Priority Expedited (24-48 Hours)</option>
                                    <option value="Emergency (Same-Day)">Emergency Cleanroom (Same-Day / 24h)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="p-3 mb-3 rounded-2" style="background-color: #080d14; border: 1px solid #1e293b;">
                        <h6 class="text-danger fw-bold mb-2 small text-uppercase"><i class="fas fa-triangle-exclamation me-1"></i> Data Loss & Failure Scenario</h6>
                        <div class="row g-2 mb-2">
                            <div class="col-md-6">
                                <label class="form-label text-secondary small mb-1">Failure / Loss Type *</label>
                                <select name="failureType" class="form-select recovery-input" required>
                                    <option value="Physical / Dropped / Clicking Noise">Physical Damage / Dropped / Clicking or Grinding Sound</option>
                                    <option value="Drive Not Detected / Freezing PC">Drive Not Detected / Not Spinning / Freezing PC</option>
                                    <option value="Accidental Deletion / Formatted">Accidental Deletion / Formatted Drive</option>
                                    <option value="Corrupted / RAW Partition">Corrupted Partition / RAW File System</option>
                                    <option value="Water / Liquid / Fire Damage">Water / Liquid Damage</option>
                                    <option value="Virus / Ransomware Encryption">Virus / Ransomware Encryption</option>
                                    <option value="Power Surge / Burnt PCB">Power Surge / Burnt Board / Smoke</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label text-secondary small mb-1">Previous Recovery Attempts</label>
                                <select name="previousAttempts" class="form-select recovery-input">
                                    <option value="None (Unopened / Untouched)">No prior attempts made (Best chance)</option>
                                    <option value="Tried Software Recovery">Tried DIY software recovery tool</option>
                                    <option value="Sent to Another Shop">Sent to another technician / repair shop</option>
                                </select>
                            </div>
                        </div>
                        <div class="mb-2">
                            <label class="form-label text-secondary small mb-1">Critical Files Most Needed *</label>
                            <input type="text" name="criticalData" class="form-control recovery-input" required placeholder="e.g. Accounting data, family photos, CAD files, everything">
                        </div>
                        <div>
                            <label class="form-label text-secondary small mb-1">Detailed Symptoms / Notes</label>
                            <textarea name="details" class="form-control recovery-input" rows="2" placeholder="Describe what happened prior to data loss, any noises or error messages..."></textarea>
                        </div>
                    </div>

                    <button type="submit" class="btn w-100 py-3 fw-bold text-white shadow" style="background: linear-gradient(135deg, #1d4ed8, #2563eb); border: none; border-radius: 8px; font-size: 15px; letter-spacing: 0.5px;">
                        <i class="fas fa-shield-alt me-2"></i> SUBMIT DATA RECOVERY CASE
                    </button>
                </form>
            </div>
        </div>

        <div id="repair-modal-backdrop" class="repair-backdrop"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Event Listeners
    const sidebar = document.getElementById('repair-sidebar');
    const sidebarBackdrop = document.getElementById('repair-sidebar-backdrop');
    const sidebarClose = document.getElementById('repair-sidebar-close');
    
    const modalBtn = document.getElementById('open-repair-modal');
    const modal = document.getElementById('repair-modal');
    const modalBackdrop = document.getElementById('repair-modal-backdrop');
    const modalClose = document.getElementById('repair-modal-close');
    const repairForm = document.getElementById('repair-request-form');

    const recModal = document.getElementById('data-recovery-modal');
    const recClose = document.getElementById('recovery-modal-close');
    const recForm = document.getElementById('data-recovery-request-form');
    const recSidebarBtn = document.getElementById('open-recovery-sidebar-btn');

    function openSidebar(e) { e?.preventDefault(); sidebar.classList.add('active'); sidebarBackdrop.classList.add('active'); }
    function closeSidebar() { sidebar.classList.remove('active'); sidebarBackdrop.classList.remove('active'); }
    function openModal() { closeSidebar(); closeRecoveryModal(); modal.classList.add('active'); modalBackdrop.classList.add('active'); }
    function closeModal() { modal.classList.remove('active'); if (!recModal.classList.contains('active')) modalBackdrop.classList.remove('active'); }

    function openRecoveryModal(e) {
        if (e) e.preventDefault();
        closeSidebar();
        closeModal();
        if (recModal) recModal.classList.add('active');
        if (modalBackdrop) modalBackdrop.classList.add('active');
    }
    function closeRecoveryModal() {
        if (recModal) recModal.classList.remove('active');
        if (!modal.classList.contains('active')) modalBackdrop.classList.remove('active');
    }

    window.openDataRecoveryModal = openRecoveryModal;
    window.closeDataRecoveryModal = closeRecoveryModal;

    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

    if (modalBtn) modalBtn.addEventListener('click', openModal);
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', () => { closeModal(); closeRecoveryModal(); });

    if (recClose) recClose.addEventListener('click', closeRecoveryModal);
    if (recSidebarBtn) recSidebarBtn.addEventListener('click', openRecoveryModal);

    // Bind triggers across header, mobile drawer, footer
    document.querySelectorAll('#nav-data-recovery-btn, #mobile-data-recovery-btn, .data-recovery-trigger').forEach(el => {
        el.addEventListener('click', openRecoveryModal);
    });

    // Check URL query or hash for auto-open
    if (window.location.hash === '#data-recovery-modal' || window.location.search.includes('recovery')) {
        setTimeout(openRecoveryModal, 300);
    }

    if (repairForm) {
        repairForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (typeof showToast === 'function') {
                showToast('Repair request submitted successfully! We will contact you soon.', 'success');
            } else {
                alert('Repair request submitted successfully!');
            }
            closeModal();
            repairForm.reset();
        });
    }

    if (recForm) {
        recForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const caseId = 'GUG-REC-' + Math.floor(100000 + Math.random() * 900000);
            const data = {
                caseId: caseId,
                id: caseId,
                name: (recForm.querySelector('[name="fullName"]') || {}).value || '',
                fullName: (recForm.querySelector('[name="fullName"]') || {}).value || '',
                phone: (recForm.querySelector('[name="mobileNumber"]') || {}).value || '',
                mobileNumber: (recForm.querySelector('[name="mobileNumber"]') || {}).value || '',
                whatsapp: (recForm.querySelector('[name="whatsappNumber"]') || {}).value || '',
                whatsappNumber: (recForm.querySelector('[name="whatsappNumber"]') || {}).value || '',
                email: (recForm.querySelector('[name="email"]') || {}).value || '',
                address: (recForm.querySelector('[name="address"]') || {}).value || '',
                officeAddress: (recForm.querySelector('[name="officeAddress"]') || {}).value || '',
                mediaType: (recForm.querySelector('[name="mediaType"]') || {}).value || 'Hard Drive',
                mediaBrandCapacity: (recForm.querySelector('[name="mediaBrandCapacity"]') || {}).value || '',
                fileSystem: (recForm.querySelector('[name="fileSystem"]') || {}).value || 'Unknown',
                urgency: (recForm.querySelector('[name="urgency"]') || {}).value || 'Standard',
                failureType: (recForm.querySelector('[name="failureType"]') || {}).value || 'Physical',
                previousAttempts: (recForm.querySelector('[name="previousAttempts"]') || {}).value || 'None',
                criticalData: (recForm.querySelector('[name="criticalData"]') || {}).value || '',
                details: (recForm.querySelector('[name="details"]') || {}).value || 'Submitted via Data Recovery form',
                status: 'Pending Inspection',
                labNotes: '',
                estimatedCost: '',
                archived: false,
                date: new Date().toISOString()
            };

            let arr = JSON.parse(localStorage.getItem('admin_recovery_requests')) || [];
            arr.unshift(data);
            localStorage.setItem('admin_recovery_requests', JSON.stringify(arr));

            if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveRecoveryRequest === 'function') {
                window.GUG_FIREBASE.saveRecoveryRequest(data);
            }

            const successMsg = 'Your Data Recovery request has been submitted successfully!\n\nYour Case ID is: ' + caseId + '\n\nPlease save this Case ID to track your diagnosis and recovery progress.';
            if (typeof showToast === 'function') {
                showToast('Case Submitted! ID: ' + caseId, 'success');
            }
            alert(successMsg);
            closeRecoveryModal();
            recForm.reset();
        });
    }
}

// Ensure injectRepairUI runs when DOM is loaded or from existing init functions
document.addEventListener('DOMContentLoaded', injectRepairUI);


// Admin Data Hydration
window.addEventListener('load', function() {
    // 1. Repair Form intercept
    const repairForm = document.getElementById('repair-request-form');
    if (repairForm) {
        // Remove existing listener (simple clone hack)
        const newForm = repairForm.cloneNode(true);
        repairForm.parentNode.replaceChild(newForm, repairForm);
        newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const diagId = 'GUG-REP-' + Math.floor(100000 + Math.random() * 900000);
            const data = {
                diagnoseId: diagId,
                id: diagId,
                name: (newForm.querySelector('[name="fullName"]') || {}).value || '',
                fullName: (newForm.querySelector('[name="fullName"]') || {}).value || '',
                address: (newForm.querySelector('[name="address"]') || {}).value || '',
                officeAddress: (newForm.querySelector('[name="officeAddress"]') || {}).value || '',
                phone: (newForm.querySelector('[name="mobileNumber"]') || {}).value || '',
                mobileNumber: (newForm.querySelector('[name="mobileNumber"]') || {}).value || '',
                email: (newForm.querySelector('[name="email"]') || {}).value || '',
                whatsapp: (newForm.querySelector('[name="whatsappNumber"]') || {}).value || '',
                whatsappNumber: (newForm.querySelector('[name="whatsappNumber"]') || {}).value || '',
                details: (newForm.querySelector('[name="details"]') || {}).value || 'Repair submitted via Quick Modal',
                status: 'Pending',
                diagnosisNotes: '',
                archived: false,
                date: new Date().toISOString(),
                seen: false
            };
            let arr = JSON.parse(localStorage.getItem('admin_repair_requests')) || [];
            arr.unshift(data);
            localStorage.setItem('admin_repair_requests', JSON.stringify(arr));

            if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveRepairRequest === 'function') {
                window.GUG_FIREBASE.saveRepairRequest(data);
            }
            
            if (typeof showToast === 'function') showToast('Repair request submitted! ID: ' + diagId, 'success');
            alert('Your repair request has been submitted successfully!\n\nYour Diagnose ID is: ' + diagId + '\n\nPlease save this ID to track your repair status.');
            const modalEl = document.getElementById('repair-modal');
            const backdropEl = document.getElementById('repair-modal-backdrop');
            if (modalEl) modalEl.classList.remove('active');
            if (backdropEl) backdropEl.classList.remove('active');
            newForm.reset();
        });
    }

    // 2. Product Overrides & ERP Master Catalog Hydration
    if (window.GUG_DB && typeof window.GUG_DB.getStorefrontProducts === 'function') {
        window.PRODUCTS_DATA = window.GUG_DB.getStorefrontProducts();
        window.dispatchEvent(new Event('productsReady'));
    } else if (window.PRODUCTS_DATA) {
        let deleted = JSON.parse(localStorage.getItem('admin_deleted_products')) || [];
        let custom = JSON.parse(localStorage.getItem('admin_custom_products')) || [];
        
        // Apply Deletions
        window.PRODUCTS_DATA = window.PRODUCTS_DATA.filter(p => !deleted.includes(p.id.toString()));
        
        // Apply Custom/Edited
        custom.forEach(cp => {
            let index = window.PRODUCTS_DATA.findIndex(p => p.id.toString() === cp.id.toString());
            if(index > -1) window.PRODUCTS_DATA[index] = cp;
            else window.PRODUCTS_DATA.unshift(cp); // Prepend new products
        });
        window.dispatchEvent(new Event('productsReady'));
    }
});

window.handleAddToCart = function(e, productId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    addToCart(productId, 1);
    updateCartBadge();
};

window.addEventListener('storage', function(e) {
    if(e.key === 'gug_erp_products' || e.key === 'admin_custom_products' || e.key === 'admin_deleted_products' || e.key === 'gug_sales_page_active' || e.key === 'gug_sales_event_name') {
        if (window.GUG_DB && typeof window.GUG_DB.getStorefrontProducts === 'function') {
            if (typeof window.GUG_DB.invalidateProductCache === 'function') window.GUG_DB.invalidateProductCache();
            window.PRODUCTS_DATA = window.GUG_DB.getStorefrontProducts();
            window.dispatchEvent(new Event('productsReady'));
        } else {
            window.location.reload();
        }
    }
});

// Auto-inject data-labels on all tables for responsive card display
function initStorefrontResponsiveTableCards() {
    if (typeof document === 'undefined') return;
    const applyLabels = () => {
        document.querySelectorAll('table').forEach(table => {
            const ths = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
            if (!ths.length) return;
            table.querySelectorAll('tbody tr').forEach(tr => {
                const cells = tr.querySelectorAll('td');
                cells.forEach((td, idx) => {
                    if (ths[idx] && !td.getAttribute('data-label') && !td.hasAttribute('colspan')) {
                        td.setAttribute('data-label', ths[idx]);
                    }
                });
            });
        });
    };
    applyLabels();
    if (typeof MutationObserver !== 'undefined' && document.body) {
        const observer = new MutationObserver(() => applyLabels());
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
document.addEventListener('DOMContentLoaded', initStorefrontResponsiveTableCards);



