/* ==========================================================================
   Gear Up Gadgets - Custom PC Builder Page JS
   ========================================================================== */

// Selected components for the build
const selectedBuild = {
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null,
    storage: null,
    casing: null,
    cooler: null
};

// Slots configuration
const builderSlots = {
    cpu: { name: "Processor (CPU)", icon: "icon-cpu-solid", category: "processors" },
    motherboard: { name: "Motherboard", icon: "icon-server-solid", category: "motherboards" },
    ram: { name: "Memory (RAM)", icon: "icon-microchip-solid", category: "ram" },
    gpu: { name: "Graphics Card (GPU)", icon: "icon-image-solid", category: "graphics-cards" },
    storage: { name: "Storage (SSD/HDD)", icon: "icon-hdd-solid", category: "storage" },
    casing: { name: "Casing (Chassis)", icon: "icon-archive-solid", category: "casing" },
    cooler: { name: "CPU Cooler / Fan", icon: "icon-wind-solid", category: "cooling-solutions" }
};

let currentActiveSlotKey = null;

function initPCBuilderPage() {
    renderBuilderRows();
    updateBuildTotal();
}

function renderBuilderRows() {
    const container = document.getElementById('builder-rows-container');
    if (!container) return;

    container.innerHTML = Object.keys(builderSlots).map(key => {
        const slot = builderSlots[key];
        const selected = selectedBuild[key];
        
        let detailsHTML = '';
        let actionBtnHTML = '';
        let priceHTML = '';

        if (selected) {
            priceHTML = `<div class="builder-selected-price">Rs. ${formatPrice(selected.price)}</div>`;
            detailsHTML = `
                <div class="d-flex align-items-center gap-15">
                    <img src="${selected.image}" alt="" style="width: 50px; height: 50px; object-fit: contain; background: white; padding: 2px; border-radius: 4px;">
                    <div>
                        <div class="builder-comp-name">${slot.name}</div>
                        <div class="builder-selected-title fw-bold text-white"><a href="product.html?id=${selected.id}" target="_blank">${selected.name}</a></div>
                    </div>
                </div>
            `;
            actionBtnHTML = `
                <button class="btn-builder btn-builder-remove" onclick="removeComponent('${key}')">Remove</button>
                <button class="btn-builder btn-builder-add" onclick="openSelectionModal('${key}')">Change</button>
            `;
        } else {
            priceHTML = `<div class="builder-selected-price text-secondary" style="font-weight: normal; font-size: 13px;">Not selected</div>`;
            detailsHTML = `
                <div>
                    <div class="builder-comp-name">${slot.name}</div>
                    <div class="builder-selected-title text-secondary">Choose a compatible ${slot.name.toLowerCase()} for your build</div>
                </div>
            `;
            actionBtnHTML = `
                <button class="btn-builder btn-builder-add" onclick="openSelectionModal('${key}')">Choose Parts</button>
            `;
        }

        return `
            <div class="builder-row">
                <div class="builder-icon">
                    <i class="icon ${slot.icon}"></i>
                </div>
                <div class="builder-comp-details">
                    ${detailsHTML}
                </div>
                ${priceHTML}
                <div class="builder-actions">
                    ${actionBtnHTML}
                </div>
            </div>
        `;
    }).join('');
}

function openSelectionModal(slotKey) {
    currentActiveSlotKey = slotKey;
    const slot = builderSlots[slotKey];
    
    const modal = document.getElementById('part-selection-modal');
    const modalTitle = document.getElementById('modal-slot-title');
    const searchInput = document.getElementById('modal-search-parts');
    
    if (!modal || !modalTitle) return;

    modalTitle.innerText = `Select ${slot.name}`;
    if (searchInput) searchInput.value = '';
    
    // Initial load of parts
    renderModalParts('');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden'; // Lock background scroll
}

function closeSelectionModal() {
    const modal = document.getElementById('part-selection-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
}

function handleModalSearch(query) {
    renderModalParts(query.trim().toLowerCase());
}

function renderModalParts(filterQuery = '') {
    const container = document.getElementById('modal-parts-list');
    if (!container || !currentActiveSlotKey) return;

    const slot = builderSlots[currentActiveSlotKey];
    
    const allProducts = (typeof getProducts === 'function') ? getProducts() : (window.PRODUCTS_DATA || []);
    let parts = allProducts.filter(p => p.category === slot.category);
    
    if (filterQuery) {
        parts = parts.filter(p => p.name.toLowerCase().includes(filterQuery));
    }

    if (parts.length === 0) {
        container.innerHTML = '<div class="text-center py-5 text-secondary">No products found matching your search.</div>';
        return;
    }

    container.innerHTML = parts.map(p => `
        <div class="selection-item-row">
            <img src="${p.image}" class="selection-item-img" alt="">
            <div class="selection-item-details">
                <div class="selection-item-title fw-bold">${p.name}</div>
                <div class="selection-item-price">Rs. ${formatPrice(p.price)}</div>
            </div>
            <button class="btn btn-danger btn-sm px-4 fw-bold" style="background-color: var(--accent-red); border: none;" onclick="selectComponent('${p.id}')">
                Select
            </button>
        </div>
    `).join('');
}

function selectComponent(productId) {
    const catalog = (window.GUG_DB && typeof window.GUG_DB.getStorefrontProducts === 'function') 
        ? window.GUG_DB.getStorefrontProducts() 
        : (window.PRODUCTS_DATA || (typeof productDatabase !== 'undefined' ? productDatabase : []));
    const targetIdStr = String(productId).trim().toLowerCase();
    const product = catalog.find(p => String(p.id).trim().toLowerCase() === targetIdStr || String(p.numericId || '').trim() === targetIdStr);
    if (!product || !currentActiveSlotKey) return;

    selectedBuild[currentActiveSlotKey] = product;
    
    closeSelectionModal();
    renderBuilderRows();
    updateBuildTotal();
    showToast(`"${product.name}" selected for your build!`, 'success');
}

function removeComponent(slotKey) {
    selectedBuild[slotKey] = null;
    renderBuilderRows();
    updateBuildTotal();
    showToast(`Component removed.`, 'info');
}

function updateBuildTotal() {
    const totalPriceLabel = document.getElementById('builder-total-price-val');
    const countLabel = document.getElementById('builder-parts-count-val');
    
    if (!totalPriceLabel || !countLabel) return;

    let total = 0;
    let count = 0;

    Object.keys(selectedBuild).forEach(key => {
        if (selectedBuild[key]) {
            total += selectedBuild[key].price;
            count++;
        }
    });

    totalPriceLabel.innerText = `Rs. ${formatPrice(total)}`;
    countLabel.innerText = `${count} of 7 parts selected`;
}

function addBuildToCart() {
    let count = 0;
    
    Object.keys(selectedBuild).forEach(key => {
        const item = selectedBuild[key];
        if (item) {
            if (typeof addToCart === 'function') {
                addToCart(item, 1);
            }
            count++;
        }
    });

    if (count === 0) {
        showToast('Please select at least one component before adding to cart!', 'error');
        return;
    }

    showToast(`Successfully added ${count} components to your cart!`, 'success');
    setTimeout(() => {
        window.location.href = 'cart.html';
    }, 800);
}

function printBuildQuotation() {
    let total = 0;
    let text = "==================================================\n";
    text += "        GEAR UP GADGETS - CUSTOM PC QUOTATION      \n";
    text += "==================================================\n";
    
    Object.keys(selectedBuild).forEach(key => {
        const slot = builderSlots[key];
        const item = selectedBuild[key];
        if (item) {
            text += `${slot.name.PadRight(20)}: ${item.name.Substring(0,40)}... (Rs. ${formatPrice(item.price)})\n`;
            total += item.price;
        } else {
            text += `${slot.name.PadRight(20)}: [Not Selected]\n`;
        }
    });
    
    text += "--------------------------------------------------\n";
    text += `TOTAL ESTIMATE      : Rs. ${formatPrice(total)}\n`;
    text += "==================================================\n";
    text += "Note: Prices are subject to market change.\n";
    text += "Generators: gearupgadgets.pk\n";
    
    // Create print popup or download
    const blob = new Blob([text], {type: "text/plain;charset=utf-8"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "custom_pc_build_quotation.txt";
    link.click();
}

// Simple padding helper for string formatting in quotation txt
String.prototype.PadRight = function(length, character) {
    return this + Array(length - this.length + 1).join(character || ' ');
};
String.prototype.Substring = function(start, length) {
    return this.substr(start, length);
};

window.selectComponent = selectComponent;
window.removeComponent = removeComponent;
window.openSelectionModal = openSelectionModal;
window.closeSelectionModal = closeSelectionModal;
window.handleModalSearch = handleModalSearch;
window.addBuildToCart = addBuildToCart;
window.printBuildQuotation = printBuildQuotation;

// Auto-initialize Custom PC Builder Page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPCBuilderPage);
} else {
    initPCBuilderPage();
}
window.addEventListener('productsReady', initPCBuilderPage);



