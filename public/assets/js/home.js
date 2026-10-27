/* ==========================================================================
   Gear Up Gadgets - Homepage JS
   ========================================================================== */

const HARDWARE_SHOWCASE_CATEGORIES = [
    { slug: 'processors', title: 'Processors' },
    { slug: 'graphic-cards', title: 'Graphic Cards' },
    { slug: 'monitors', title: 'Monitors' },
    { slug: 'motherboards', title: 'Motherboards' },
    { slug: 'ram', title: 'RAM' },
    { slug: 'ssds', title: 'SSDs' },
    { slug: 'cooler-fans', title: 'Cooler Fans' },
    { slug: 'casings', title: 'Casings' },
    { slug: 'prebuilt-cpus', title: 'Pre-built CPUs' },
    { slug: 'keyboards', title: 'Keyboards' },
    { slug: 'mice', title: 'Mice' },
    { slug: 'laptops', title: 'Laptops' }
];

const HARDWARE_CATEGORY_MAP = {
    processors: 'processors',
    'graphic-cards': 'graphics-cards',
    monitors: 'monitors',
    motherboards: 'motherboards',
    ram: 'ram',
    ssds: 'storage',
    'cooler-fans': 'cooling-solutions',
    casings: 'casing',
    'prebuilt-cpus': 'laptops',
    keyboards: 'keyboards',
    mice: 'mouse',
    laptops: 'laptops'
};

const HARDWARE_SHOWCASE_PLACEHOLDERS = {
    keyboards: [
        {
            id: 'kb-01',
            name: 'HyperX Alloy Elite 2 RGB',
            category: 'Keyboards',
            price: 21999,
            image: 'assets/images/laptop2.png',
            specs: {
                Switch: 'Red Linear',
                Lighting: 'RGB',
                Layout: 'Full-size',
                Connectivity: 'USB-C'
            }
        },
        {
            id: 'kb-02',
            name: 'Corsair K70 RGB MK.2',
            category: 'Keyboards',
            price: 27999,
            image: 'assets/images/laptop2.png',
            specs: {
                Switch: 'Cherry MX Red',
                Lighting: 'RGB',
                Frame: 'Aluminum',
                Macro: '6 Programmable Keys'
            }
        }
    ],
    mice: [
        {
            id: 'mouse-01',
            name: 'Logitech G502 HERO',
            category: 'Mice',
            price: 10500,
            image: 'assets/images/laptop2.png',
            specs: {
                Sensor: 'HERO 25K',
                DPI: '100-25600',
                Buttons: '11 Programmable',
                Weight: '121g'
            }
        },
        {
            id: 'mouse-02',
            name: 'Razer DeathAdder V2',
            category: 'Mice',
            price: 12999,
            image: 'assets/images/laptop2.png',
            specs: {
                Sensor: 'Focus+',
                DPI: '100-20000',
                Buttons: '8 Programmable',
                Switches: 'Razer Optical'
            }
        }
    ]
};

function initHomePage() {
    renderBanners();
    renderFeaturedProducts();
    renderHardwareShowcase();
    renderNewArrivals();
    renderTechPartners();
}

function renderBanners() {
    // We can initialize simple slideshow logic if needed, or let it display statically
}

function renderFeaturedProducts() {
    const grid = document.getElementById('home-featured-grid');
    const container = document.getElementById('home-featured-container');
    if (!grid || !container || !Array.isArray(window.PRODUCTS_DATA)) return;

    const featuredProducts = window.PRODUCTS_DATA.filter(p => p.isFeatured === true);
    
    if (featuredProducts.length > 0) {
        container.style.display = 'flex';
        grid.style.display = 'flex';
        
        let html = '';
        featuredProducts.forEach((p, index) => {
            const delay = index * 50; // Staggered animation
            let cardHTML = renderProductCardHTML(p);
            cardHTML = cardHTML.replace('<div class="col-lg-3', `<div class="col-lg-3" data-aos="fade-up" data-aos-delay="${delay}"`);
            html += cardHTML;
        });
        grid.innerHTML = html;
    } else {
        container.style.display = 'none';
        grid.style.display = 'none';
    }
}

function renderHardwareShowcase() {
    const tabs = document.getElementById('hardware-tabs');
    const grid = document.getElementById('hardware-showcase-grid');
    if (!tabs || !grid || !Array.isArray(window.PRODUCTS_DATA)) return;

    tabs.innerHTML = HARDWARE_SHOWCASE_CATEGORIES.map((category, index) => `
        <button type="button" class="hardware-tab-button ${index === 0 ? 'active' : ''}" data-category="${category.slug}">
            ${category.title}
        </button>
    `).join('');

    tabs.querySelectorAll('.hardware-tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const selected = button.dataset.category;
            setHardwareShowcaseCategory(selected);
        });
    });

    setHardwareShowcaseCategory(HARDWARE_SHOWCASE_CATEGORIES[0].slug);
}

function setHardwareShowcaseCategory(categorySlug) {
    const tabs = document.querySelectorAll('.hardware-tab-button');
    tabs.forEach(button => {
        button.classList.toggle('active', button.dataset.category === categorySlug);
    });
    renderHardwareShowcaseGrid(categorySlug);
}

function getHardwareProducts(categorySlug) {
    const datasetCategory = HARDWARE_CATEGORY_MAP[categorySlug] || categorySlug;
    const catalog = (Array.isArray(window.PRODUCTS_DATA) && window.PRODUCTS_DATA.length > 0)
        ? window.PRODUCTS_DATA
        : ((typeof productDatabase !== 'undefined' && Array.isArray(productDatabase)) ? productDatabase : []);
    const products = catalog.filter(p => (p.category || '').toLowerCase() === datasetCategory.toLowerCase());
    if (products.length > 0) {
        return products;
    }
    return HARDWARE_SHOWCASE_PLACEHOLDERS[categorySlug] || [];
}

function renderHardwareShowcaseGrid(categorySlug) {
    const grid = document.getElementById('hardware-showcase-grid');
    if (!grid) return;
    const items = getHardwareProducts(categorySlug);
    grid.innerHTML = items.map(p => renderProductCardHTML(p)).join('');
}

function renderNewArrivals() {
    const carousel = document.getElementById('latest-arrivals-carousel');
    const prevBtn = document.getElementById('latest-arrivals-prev');
    const nextBtn = document.getElementById('latest-arrivals-next');
    if (!carousel) return;

    const getScrollStep = () => {
        const slide = carousel.querySelector('.latest-arrivals-slide');
        return slide ? slide.getBoundingClientRect().width + 22 : 320;
    };

    const scrollByStep = (direction) => {
        const step = getScrollStep();
        carousel.scrollBy({ left: direction * step, behavior: 'smooth' });
    };

    prevBtn?.addEventListener('click', () => scrollByStep(-1));
    nextBtn?.addEventListener('click', () => scrollByStep(1));

    let autoplayTimer;
    const startAutoplay = () => {
        stopAutoplay();
        autoplayTimer = window.setInterval(() => {
            if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 10) {
                carousel.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                scrollByStep(1);
            }
        }, 4200);
    };
    const stopAutoplay = () => {
        if (autoplayTimer) {
            window.clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    };

    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    window.addEventListener('resize', () => {
        if (carousel.scrollLeft + carousel.clientWidth > carousel.scrollWidth - 10) {
            carousel.scrollLeft = carousel.scrollWidth - carousel.clientWidth;
        }
    });
    startAutoplay();
}

function renderTechPartners() {
    const grid = document.getElementById('tech-partners-grid');
    if (!grid) return;

    const partners = [
        {
            title: "Adeel Shahid: Gear Up Gadget studio tour!",
            author: "ADEEL SHAHID",
            youtubeId: "adeel_shahid",
            thumb: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80"
        },
        {
            title: "Hamza Bhatti: Custom PC builds & upgrades at Gear Up Gadget",
            author: "HAMZA BHATTI",
            youtubeId: "hamza_bhatti",
            thumb: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=400&q=80"
        },
        {
            title: "Irfan Junejo's new ultimate tech hub revealed",
            author: "IRFAN JUNEJO",
            youtubeId: "irfan_junejo",
            thumb: "https://images.unsplash.com/photo-1600132806370-bf17e65e942f?auto=format&fit=crop&w=400&q=80"
        },
        {
            title: "WildLens by Abrar: Epic Ultrawide & Ergonomic Setup Upgrade",
            author: "WILDLENS BY ABRAR",
            youtubeId: "abrar",
            thumb: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=400&q=80"
        }
    ];

    grid.innerHTML = partners.map(p => `
        <div class="col-lg-3 col-md-6 col-sm-12">
            <div class="tech-video-card">
                <div class="video-thumbnail-container" onclick="playMockVideo('${p.title}')">
                    <img src="${p.thumb}" class="video-thumbnail" alt="">
                    <div class="play-btn-overlay">
                        <i class="icon icon-caret-right-solid" style="margin-left: 3px;"></i>
                    </div>
                </div>
                <div class="tech-video-info">
                    <div class="tech-video-author">${p.author}</div>
                    <div class="tech-video-title">${p.title}</div>
                </div>
            </div>
        </div>
    `).join('');
}

function playMockVideo(title) {
    showToast(`Loading tech partner video: ${title}...`, 'info');
}

function renderProductCardHTML(p) {
    const isOutOfStock = !p.inStock;
    const badgeHTML = p.onSale ? `<span class="product-card-badge">SALE</span>` : '';
    const priceHTML = p.onSale 
        ? `<span class="product-price-current">Rs. ${formatPrice(p.price)}</span>
           <span class="product-price-old">Rs. ${formatPrice(p.originalPrice)}</span>`
        : `<span class="product-price-current">Rs. ${formatPrice(p.price)}</span>`;

    const buttonHTML = renderProductAddToCartButton(p);

    return `
        <div class="col-6 col-sm-6 col-md-4 col-lg-3 mb-3 mb-md-4">
            <div class="product-card">
                ${badgeHTML}
                <div class="product-card-img-wrap" onclick="window.location.href='product.html?id=${p.id}'" style="cursor: pointer;">
                    ${(window.isMediaVideo && window.isMediaVideo(p.image)) ? `<video src="${p.image}" class="product-card-img" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: contain;"></video>` : `<img src="${p.image}" class="product-card-img" alt="${p.name}" loading="lazy" onerror="this.src='assets/images/logo.png'">`}
                </div>
                <div class="product-card-info">
                    <div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                        <div class="product-card-cat">${p.category}</div>
                        ${typeof window.formatProductStockBadge === 'function' ? window.formatProductStockBadge(p, true) : (p.totalStock > 0 ? `<span class="stock-badge in-stock" style="font-size:10px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);padding:2px 6px;border-radius:4px;white-space:nowrap;"><i class="fas fa-boxes-stacked"></i> ${p.totalStock} stocks available</span>` : `<span class="stock-badge out-of-stock" style="font-size:10px;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);padding:2px 6px;border-radius:4px;white-space:nowrap;"><i class="fas fa-circle-xmark"></i> Out of stock</span>`)}
                    </div>
                    <h4 class="product-card-title">
                        <a href="product.html?id=${p.id}">${p.name}</a>
                    </h4>
                    <div class="product-card-price-row">
                        ${priceHTML}
                    </div>
                    ${buttonHTML}
                </div>
            </div>
        </div>
    `;
}


const renderProductAddToCartButton = (p) => {
    const stockQty = typeof window.getProductStockNumber === 'function' ? window.getProductStockNumber(p) : (p.totalStock || p.stockQuantity || 0);
    if (stockQty <= 0) {
        return `<button class="btn w-100 btn-sm fw-bold" style="background-color: #2a2a2a; border-color: #3a3a3a; color: #777; cursor: not-allowed; padding: 6px 12px; border-radius: 4px;" disabled><i class="fas fa-circle-xmark me-1"></i> Out of Stock</button>`;
    }
    return `<button class="btn w-100 btn-sm fw-bold add-to-cart-btn btn-cargo-expert transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style="background-color: black; border-color: black; color: white;" data-id="${p.id}">
        <span class="btn-text-default">Add to Cart</span>
        <span class="btn-text-added">Your parcel is on the way!</span>
        <div class="cart-wrapper">
            <svg class="box-icon" width="14" height="14" viewBox="0 0 24 24" fill="#deb887" stroke="#8b5a2b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            <svg class="cart-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        </div>
    </button>`;
};



