// Master Admin Authentication & Guard
(function checkAdminAuth() {
    const page = (window.location.pathname.split('/').pop() || 'dashboard.html').split('?')[0].split('#')[0];
    if (page === 'admin.html' || page === 'staff-login.html' || page === 'dealer-login.html') return;
    
    const hasValidSession = () =>
        (localStorage.getItem('admin_logged_in') === 'true' &&
            sessionStorage.getItem('gug_admin_auth_session') === 'authenticated') ||
        (localStorage.getItem('staff_logged_in') === 'true' &&
            sessionStorage.getItem('gug_staff_auth_session') === 'authenticated');
    const isAdmin = localStorage.getItem('admin_logged_in') === 'true' &&
        sessionStorage.getItem('gug_admin_auth_session') === 'authenticated';
    const isStaff = localStorage.getItem('staff_logged_in') === 'true' &&
        sessionStorage.getItem('gug_staff_auth_session') === 'authenticated';
    const isDealer = localStorage.getItem('dealer_logged_in') === 'true' &&
        sessionStorage.getItem('gug_dealer_auth_session') === 'authenticated';
    
    if (isDealer && !isAdmin) {
        window.location.href = 'dealer-portal.html';
        return;
    }
    
    if (!isAdmin && !isStaff) {
        document.documentElement.style.visibility = 'hidden';
        window.location.replace('admin.html');
        return;
    }
    window.addEventListener('pageshow', () => {
        if (!hasValidSession()) {
            document.documentElement.style.visibility = 'hidden';
            window.location.replace('admin.html');
        }
    });
})();

document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('a') : null;
    if (!target) return;
    const label = (target.textContent || '').trim().toLowerCase();
    if (!label.includes('sign out') && target.getAttribute('title') !== 'Logout') return;

    ['admin_logged_in', 'staff_logged_in', 'dealer_logged_in', 'dealer_id', 'dealer_username',
        'dealer_name', 'dealer_shop', 'staff_user_id', 'staff_username',
        'staff_name', 'staff_role', 'staff_department', 'staff_permissions', 'admin_role', 'admin_username']
        .forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem('gug_admin_auth_session');
    sessionStorage.removeItem('gug_staff_auth_session');
    sessionStorage.removeItem('gug_dealer_auth_session');
    localStorage.setItem('gug_has_logged_out', 'true');
}, true);

// Initialize Data
let lsRepairs = JSON.parse(localStorage.getItem('admin_repair_requests')) || [];
let lsOrders = JSON.parse(localStorage.getItem('admin_orders')) || [];
let lsContacts = JSON.parse(localStorage.getItem('admin_contact_inquiries')) || [];
let customProducts = JSON.parse(localStorage.getItem('admin_custom_products')) || [];
let deletedProductIds = JSON.parse(localStorage.getItem('admin_deleted_products')) || [];

// Category & Search State
let currentCategoryFilter = 'All Products';
let currentProductSearch = '';

// Hydrate Products
let normalizedData = (window.PRODUCTS_DATA || []).map(p => {
    let numericPrice = typeof p.price === 'number' ? p.price : Number((p.price || "0").toString().replace(/[^0-9.-]+/g,"")) || 0;
    let numericOrigPrice = p.originalPrice ? (typeof p.originalPrice === 'number' ? p.originalPrice : Number(p.originalPrice.toString().replace(/[^0-9.-]+/g,""))) : null;
    return { ...p, price: numericPrice, originalPrice: numericOrigPrice };
});
let LIVE_PRODUCTS = normalizedData.filter(p => !deletedProductIds.includes(p.id));
customProducts.forEach(cp => {
    let index = LIVE_PRODUCTS.findIndex(p => p.id == cp.id);
    if(index > -1) LIVE_PRODUCTS[index] = cp;
    else LIVE_PRODUCTS.push(cp);
});

// Render UI Safely
function render() {
    const sRepairs = document.getElementById('stat-repairs');
    if (sRepairs) {
        sRepairs.innerText = lsRepairs.length;
        document.getElementById('stat-orders').innerText = lsOrders.length;
        document.getElementById('stat-contacts').innerText = lsContacts.length;
        document.getElementById('stat-products').innerText = LIVE_PRODUCTS.length;
    }

    const tRepairs = document.getElementById('table-repairs');
    if (tRepairs) {
        tRepairs.innerHTML = lsRepairs.map((r, i) => `
            <tr class="${r.archived ? 'status-archived' : (r.seen ? '' : 'status-unseen')}">
                <td>
                    <strong class="text-dark d-block">ID: ${r.diagnoseId || 'N/A'}</strong>
                    <small class="text-secondary">${r.name || 'N/A'}<br>${r.phone || 'N/A'}</small>
                </td>
                <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1e293b;" title="${r.details || 'No details'}">${r.details || 'No details'}</td>
                <td>
                    <select class="form-select form-select-sm mb-1" onchange="updateRepairStatus(${i}, this.value)">
                        <option value="Pending" ${r.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Device Received" ${r.status === 'Device Received' ? 'selected' : ''}>Device Received</option>
                        <option value="Diagnosing" ${r.status === 'Diagnosing' ? 'selected' : ''}>Diagnosing</option>
                        <option value="Waiting for Parts" ${r.status === 'Waiting for Parts' ? 'selected' : ''}>Waiting for Parts</option>
                        <option value="Repair in Progress" ${r.status === 'Repair in Progress' ? 'selected' : ''}>Repair in Progress</option>
                        <option value="Ready for Collection" ${r.status === 'Ready for Collection' ? 'selected' : ''}>Ready for Collection</option>
                    </select>
                </td>
                <td>
                    <textarea class="form-control" rows="2" placeholder="Enter diagnosis notes..." onblur="updateRepairNotes(${i}, this.value)" style="font-size: 12px; resize: none;">${r.diagnosisNotes || ''}</textarea>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary mb-1 w-100" onclick="archiveEntry('repairs', ${i})">Archive</button>
                    <button class="btn btn-sm btn-danger w-100" onclick="delEntry('repairs', ${i})"><i class="fas fa-trash"></i> Delete</button>
                </td>
            </tr>
        `).join('');
    }

    const tOrders = document.getElementById('table-orders');
    if (tOrders) {
        tOrders.innerHTML = lsOrders.map((o, i) => {
            let itemsHtml = o.items.map(item => (item.title || item.name) + ' (x'+(item.quantity || item.qty)+')').join('<br>');
            let total = o.total || o.items.reduce((s, it) => s + (it.price * (it.quantity || it.qty)), 0);
            return `<tr class="${o.archived ? 'status-archived' : ''}">
                <td>
                    <strong class="text-dark d-block mb-1">ID: ${o.id || 'N/A'}</strong>
                    <small class="text-secondary">${(o.customer && o.customer.name) || o.name || 'N/A'}<br>${(o.customer && o.customer.phone) || o.phone || 'N/A'}<br>${(o.customer && o.customer.address) || o.address || 'N/A'}</small>
                </td>
                <td style="color: #1e293b;"><small>${itemsHtml}</small></td>
                <td class="text-danger fw-bold">Rs. ${Number(total).toLocaleString()}</td>
                <td>
                    <select class="form-select form-select-sm mb-1" onchange="updateOrderStatus(${i}, this.value)">
                        <option value="New Order" ${o.orderStatus === 'New Order' || o.status === 'Pending' ? 'selected' : ''}>New Order</option>
                        <option value="Confirmed" ${o.orderStatus === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Processing" ${o.orderStatus === 'Processing' ? 'selected' : ''}>Processing</option>
                        <option value="Packed" ${o.orderStatus === 'Packed' ? 'selected' : ''}>Packed</option>
                        <option value="Shipped" ${o.orderStatus === 'Shipped' || o.status === 'Dispatched' ? 'selected' : ''}>Shipped</option>
                        <option value="Delivered" ${o.orderStatus === 'Delivered' || o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Cancelled" ${o.orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary mb-1 w-100" onclick="archiveEntry('orders', ${i})">Archive</button>
                    <button class="btn btn-sm btn-danger w-100" onclick="delEntry('orders', ${i})"><i class="fas fa-trash"></i> Delete</button>
                </td>
            </tr>`;
        }).join('');
    }

    const tContacts = document.getElementById('table-contacts');
    if (tContacts) {
        tContacts.innerHTML = lsContacts.map((c, i) => `
            <tr class="${c.archived ? 'status-archived' : ''}">
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td><small>${c.message}</small></td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="archiveEntry('contacts', ${i})">Save/Store</button>
                    <button class="btn btn-sm btn-success me-1" onclick="downloadCSV('contacts', ${i})">Download</button>
                    <button class="btn btn-sm btn-danger" onclick="delEntry('contacts', ${i})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    const categoryNavContainer = document.getElementById('category-nav-container');
    const categoryTablesContainer = document.getElementById('category-tables-container');
    
    if (categoryNavContainer && categoryTablesContainer) {
        const categories = ["All Products", "Keyboard", "CPU", "SSD", "ROM", "Accessories", "Mouse", "CPU Casing", "Hardware", "Laptop", "Headphones", "Monitor", "Cooling Fan", "RAM", "Computer"];
        
        let mappedCats = {
            "Keyboard": ["keyboards", "keyboard"],
            "CPU": ["processors", "cpu"],
            "SSD": ["storage", "ssd"],
            "ROM": ["storage", "rom"],
            "Accessories": ["accessories", "monitor-arms", "apple-products"],
            "Mouse": ["mouse", "mice"],
            "CPU Casing": ["casing", "case"],
            "Hardware": ["hardware", "motherboards", "graphics-cards"],
            "Laptop": ["laptops", "laptop"],
            "Headphones": ["headphones", "audio"],
            "Monitor": ["monitors", "monitor"],
            "Cooling Fan": ["cooling-solutions", "cooling", "fan"],
            "RAM": ["ram", "memory"],
            "Computer": ["computer", "desktop"]
        };
        
        // 1. Render Nav Buttons
        let navHtml = '';
        categories.forEach(cat => {
            let isActive = (currentCategoryFilter === cat);
            let btnClass = isActive ? 'btn-danger' : 'btn-outline-danger';
            
            // Calculate count for badge using the mapping
            let count = LIVE_PRODUCTS.length;
            if (cat !== "All Products") {
                let matchTargets = mappedCats[cat] || [cat.toLowerCase()];
                count = LIVE_PRODUCTS.filter(p => {
                    if (!p.category) return false;
                    let pCat = p.category.toLowerCase();
                    return matchTargets.some(mt => pCat.includes(mt));
                }).length;
            }
            
            navHtml += `<button class="btn ${btnClass} btn-sm fw-bold" onclick="setCategoryFilter('${cat}')">${cat} <span class="badge bg-light text-dark ms-1">${count}</span></button>`;
        });
        categoryNavContainer.innerHTML = navHtml;
        
        // 2. Render Single Selected Category Table
        let filteredProducts = LIVE_PRODUCTS.filter(p => {
            return currentProductSearch === '' || p.name.toLowerCase().includes(currentProductSearch);
        });
        
        if (currentCategoryFilter !== "All Products") {
            let matchTargets = mappedCats[currentCategoryFilter] || [currentCategoryFilter.toLowerCase()];
            filteredProducts = LIVE_PRODUCTS.filter(p => {
                if (!p.category) return false;
                let pCat = p.category.toLowerCase();
                let matchesCategory = matchTargets.some(mt => pCat.includes(mt));
                let matchesSearch = currentProductSearch === '' || p.name.toLowerCase().includes(currentProductSearch);
                return matchesCategory && matchesSearch;
            });
        }
            
        if (window.location.pathname.includes('admin-sales.html')) {
            filteredProducts = LIVE_PRODUCTS.filter(p => p.onSale === true && (currentProductSearch === '' || p.name.toLowerCase().includes(currentProductSearch)));
            currentCategoryFilter = "Active Sale Products";
        }
        
        let tableHtml = '';
        
        if (filteredProducts.length > 0) {
            tableHtml += `
              <div class="mb-5">
                  <h4 class="text-white mb-3 pb-2" style="border-bottom: 2px solid var(--accent-red); display: inline-block;">${currentCategoryFilter}</h4>
                  <div style="background-color: #fff; border-radius: 6px; padding: 20px; overflow-x: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                      <table class="table table-borderless align-middle m-0" style="color: #222;">
                          <thead>
                              <tr style="border-bottom: 1px solid #eee;">
                                  <th style="width: 80px; color: #888; font-weight: bold; padding-bottom: 15px;">Image</th>
                                  <th style="width: 40%; color: #888; font-weight: bold; padding-bottom: 15px;">Name</th>
                                  <th style="width: 15%; color: #888; font-weight: bold; padding-bottom: 15px;">Price</th>
                                  <th style="width: 15%; color: #888; font-weight: bold; padding-bottom: 15px; text-align: center;">Category</th>
                                  <th style="width: 180px; color: #888; font-weight: bold; padding-bottom: 15px; line-height: 1.2; text-align: left;">Status (Sale /<br>Important)</th>
                                  <th style="width: 80px; color: #888; font-weight: bold; padding-bottom: 15px; text-align: center;">Actions</th>
                              </tr>
                          </thead>
                      <tbody>
                          ${filteredProducts.map(p => {
                              let priceColumn = `Rs. ${(p.price ? p.price.toLocaleString() : 0)}`;
                              if (p.onSale && p.originalPrice) {
                                  let orig = parseFloat(p.originalPrice.toString().replace(/,/g, '').replace("Rs.", ""));
                                  let curr = parseFloat((p.price || 0).toString().replace(/,/g, '').replace("Rs.", ""));
                                  let perc = Math.round(((orig - curr) / orig) * 100);
                                  if (isNaN(perc)) perc = 0;
                                  
                                  priceColumn = `<div class="d-flex flex-column">
                                      <span class="text-secondary text-decoration-line-through" style="font-size: 12px;">Rs. ${p.originalPrice}</span>
                                      <span class="text-success fw-bold" style="font-size: 14px;">Rs. ${p.price}</span>
                                      <span class="badge bg-danger mt-1" style="width: max-content;">${perc}% OFF</span>
                                  </div>`;
                              }
                              return `
                              <tr style="border-bottom: 1px solid #f8f9fa;">
                                  <td style="padding: 15px 10px 15px 0;"><img src="${p.image}" width="65" height="65" style="object-fit:cover; border-radius:6px; border: 1px solid #eee;"></td>
                                  <td style="padding: 15px 10px; font-size: 14px; color: #333;">${p.name}</td>
                                  <td style="padding: 15px 10px;">${priceColumn}</td>
                                  <td style="padding: 15px 10px; text-align: center;"><span class="badge" style="background-color: #6c757d; font-weight: normal; font-size: 12px; padding: 5px 10px; border-radius: 6px;">${p.category}</span></td>
                                  <td style="padding: 15px 10px; text-align: left;">
                                      <div class="form-check form-switch mb-2 d-flex align-items-center">
                                          <input class="form-check-input mt-0 me-2" type="checkbox" onchange="toggleProductSale('${p.id}', this.checked)" ${p.onSale ? 'checked' : ''} id="sale-toggle-${p.id}">
                                          <label class="form-check-label small" style="color: #ffc107; font-size: 13px;" for="sale-toggle-${p.id}">Sale</label>
                                      </div>
                                      <div class="form-check form-switch d-flex align-items-center">
                                          <input class="form-check-input mt-0 me-2" type="checkbox" onchange="toggleProductImportant('${p.id}', this.checked)" ${p.isFeatured ? 'checked' : ''} id="important-toggle-${p.id}">
                                          <label class="form-check-label small" style="color: #ffc107; font-size: 13px;" for="important-toggle-${p.id}">Important</label>
                                      </div>
                                  </td>
                                  <td style="padding: 15px 0; text-align: center;">
                                      <div class="d-flex flex-column gap-2 align-items-center">
                                          <button class="btn btn-sm text-white" style="background-color: #0d6efd; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; border: none;" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button>
                                          <button class="btn btn-sm text-white" style="background-color: #e50303; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; border: none;" onclick="delProduct('${p.id}')"><i class="fas fa-trash"></i></button>
                                      </div>
                                  </td>
                              </tr>
                          `;
                          }).join('')}
                    </tbody>
                </table>
            </div>`;
        } else {
            tableHtml = `<div class="admin-card text-center text-secondary py-5">No products found in ${currentCategoryFilter}. Add a new product to get started!</div>`;
        }
        
        categoryTablesContainer.innerHTML = tableHtml;
    }
}

// Nav Category Click
window.handleProductSearch = () => {
    let input = document.getElementById('product-search-input');
    if (input) {
        currentProductSearch = input.value.toLowerCase().trim();
        render();
    }
};

window.setCategoryFilter = (cat) => {
    currentCategoryFilter = cat;
    render();
};

// Global Actions
function saveAndRender(key, data) { localStorage.setItem(key, JSON.stringify(data)); render(); }

window.archiveEntry = (type, i) => {
    if (type === 'repairs') {
        lsRepairs[i].archived = !lsRepairs[i].archived;
        saveAndRender('admin_repair_requests', lsRepairs);
        if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.updateRepairStatus === 'function') {
            window.GUG_FIREBASE.updateRepairStatus(lsRepairs[i].diagnoseId || lsRepairs[i].id, lsRepairs[i].status, lsRepairs[i].diagnosisNotes);
        }
    }
    if (type === 'orders') {
        lsOrders[i].archived = !lsOrders[i].archived;
        saveAndRender('admin_orders', lsOrders);
        if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.updateOrderStatus === 'function') {
            window.GUG_FIREBASE.updateOrderStatus(lsOrders[i].id, lsOrders[i].orderStatus || lsOrders[i].status);
        }
    }
    if (type === 'contacts') {
        lsContacts[i].archived = !lsContacts[i].archived;
        saveAndRender('admin_contact_inquiries', lsContacts);
        if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.updateContactStatus === 'function') {
            window.GUG_FIREBASE.updateContactStatus(lsContacts[i].id, lsContacts[i].status, lsContacts[i].archived);
        }
    }
};

window.delEntry = (type, i) => {
    if(!confirm('Permanently delete this entry?')) return;
    if (type === 'repairs') {
        const item = lsRepairs[i];
        lsRepairs.splice(i, 1);
        saveAndRender('admin_repair_requests', lsRepairs);
        if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.deleteRepair === 'function' && item) {
            window.GUG_FIREBASE.deleteRepair(item.diagnoseId || item.id);
        }
    }
    if (type === 'orders') {
        lsOrders.splice(i, 1);
        saveAndRender('admin_orders', lsOrders);
    }
    if (type === 'contacts') {
        const item = lsContacts[i];
        lsContacts.splice(i, 1);
        saveAndRender('admin_contact_inquiries', lsContacts);
        if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.deleteContact === 'function' && item) {
            window.GUG_FIREBASE.deleteContact(item.id);
        }
    }
};

window.downloadCSV = (type, i) => {
    let dataObj = null;
    let filename = '';
    
    if (type === 'repairs') { dataObj = lsRepairs[i]; filename = 'repair_request_' + i + '.csv'; }
    if (type === 'orders') { dataObj = lsOrders[i]; filename = 'order_' + i + '.csv'; }
    if (type === 'contacts') { dataObj = lsContacts[i]; filename = 'inquiry_' + i + '.csv'; }
    
    if (!dataObj) return;

    // Convert object to CSV
    let headers = [];
    let values = [];
    
    for (let key in dataObj) {
        if (key === 'items' && type === 'orders') {
            headers.push('items_ordered');
            values.push(`"` + dataObj.items.map(it => it.name + ' (x' + it.qty + ')').join(', ') + `"`);
        } else if (key !== 'seen' && key !== 'archived') {
            headers.push(key);
            let val = String(dataObj[key]).replace(/"/g, '""');
            values.push(`"` + val + `"`);
        }
    }
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\\n" + values.join(',');
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Products 2-Step Workflow
window.nextStepModal = () => {
    let catSelect = document.getElementById('p-category');
    if (!catSelect.value) {
        if (window.GUG_DB && window.GUG_DB.showToast) {
            window.GUG_DB.showToast("Please select a category first.", "warning", "Category Required");
        } else {
            alert("Please select a category first.");
        }
        return;
    }
    document.getElementById('modal-step-1').style.display = 'none';
    document.getElementById('modal-step-2').style.display = 'block';
};

window.prevStepModal = () => {
    document.getElementById('modal-step-2').style.display = 'none';
    document.getElementById('modal-step-1').style.display = 'block';
};

window.delProduct = id => {
    if(!confirm('Delete this product from live site?')) return;
    deletedProductIds.push(id);
    localStorage.setItem('admin_deleted_products', JSON.stringify(deletedProductIds));
    LIVE_PRODUCTS = LIVE_PRODUCTS.filter(p => p.id != id);
    render();
};

// Order & Repair Updates
window.updateOrderStatus = function(index, newStatus) {
    lsOrders[index].status = newStatus;
    lsOrders[index].orderStatus = newStatus;
    localStorage.setItem('admin_orders', JSON.stringify(lsOrders));
    if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.updateOrderStatus === 'function') {
        window.GUG_FIREBASE.updateOrderStatus(lsOrders[index].id, newStatus);
    }
};

window.updateOrderTracking = function(index, id) {
    lsOrders[index].trackingId = id;
    localStorage.setItem('admin_orders', JSON.stringify(lsOrders));
    if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveOrder === 'function') {
        window.GUG_FIREBASE.saveOrder(lsOrders[index]);
    }
};

window.updateRepairStatus = function(index, newStatus) {
    lsRepairs[index].status = newStatus;
    localStorage.setItem('admin_repair_requests', JSON.stringify(lsRepairs));
    if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.updateRepairStatus === 'function') {
        window.GUG_FIREBASE.updateRepairStatus(lsRepairs[index].diagnoseId || lsRepairs[index].id, newStatus, lsRepairs[index].diagnosisNotes);
    }
};

window.updateRepairNotes = function(index, notes) {
    lsRepairs[index].diagnosisNotes = notes;
    localStorage.setItem('admin_repair_requests', JSON.stringify(lsRepairs));
    if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.updateRepairStatus === 'function') {
        window.GUG_FIREBASE.updateRepairStatus(lsRepairs[index].diagnoseId || lsRepairs[index].id, lsRepairs[index].status, notes);
    }
};

// Global Real-time listeners for admin data
window.addEventListener('gugOrdersUpdated', (e) => {
    lsOrders = e.detail || JSON.parse(localStorage.getItem('admin_orders') || '[]');
    if (typeof render === 'function') render();
});
window.addEventListener('gugRepairsUpdated', (e) => {
    lsRepairs = e.detail || JSON.parse(localStorage.getItem('admin_repair_requests') || '[]');
    if (typeof render === 'function') render();
});
window.addEventListener('gugContactsUpdated', (e) => {
    lsContacts = e.detail || JSON.parse(localStorage.getItem('admin_contact_inquiries') || '[]');
    if (typeof render === 'function') render();
});
window.addEventListener('gugRecoveryUpdated', (e) => {
    window.lsRecovery = e.detail || JSON.parse(localStorage.getItem('admin_recovery_requests') || '[]');
    if (typeof render === 'function') render();
    if (typeof renderRecoveryTable === 'function') renderRecoveryTable();
});

window.openProductModal = (p = null) => {
    document.getElementById('product-form').reset();
    
    let step1 = document.getElementById('modal-step-1');
    let step2 = document.getElementById('modal-step-2');
    
    if(p) {
        // Editing existing product -> Jump to Step 2
        document.getElementById('p-id').value = p.id;
        document.getElementById('p-name').value = p.name;
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-origPrice').value = p.originalPrice || '';
        document.getElementById('p-image').value = p.image;
        document.getElementById('p-description').value = p.description || '';
        document.getElementById('p-category').value = p.category;
        document.getElementById('p-onSale').checked = !!p.onSale;
        document.getElementById('p-important').checked = !!p.isFeatured;
        
        step1.style.display = 'none';
        step2.style.display = 'block';
    } else {
        // New Product -> Start at Step 1
        document.getElementById('p-id').value = Date.now().toString(); 
        
        // Auto-select current category filter if it's not "All Products"
        if (currentCategoryFilter !== 'All Products') {
            document.getElementById('p-category').value = currentCategoryFilter;
        }
        
        step1.style.display = 'block';
        step2.style.display = 'none';
    }
    document.getElementById('productModal').style.display = 'flex';
};

window.editProduct = id => {
    let p = LIVE_PRODUCTS.find(x => x.id == id);
    if(p) openProductModal(p);
};

window.toggleProductSale = (id, checked) => {
    let lIndex = LIVE_PRODUCTS.findIndex(x => x.id == id);
    if(lIndex > -1) {
        let prod = LIVE_PRODUCTS[lIndex];
        
        if (checked) {
            let discountStr = prompt(`Enter discount percentage for ${prod.name} (e.g., 10, 20, 50):`, "10");
            if (discountStr === null) {
                // User cancelled, revert the checkbox UI
                document.getElementById(`sale-toggle-${id}`).checked = false;
                return;
            }
            
            let discount = parseFloat(discountStr.replace('%', ''));
            if (isNaN(discount) || discount <= 0 || discount >= 100) {
                if (window.GUG_DB && window.GUG_DB.showToast) {
                    window.GUG_DB.showToast("Invalid discount percentage. Please enter a number between 1 and 99.", "error", "Invalid Discount");
                } else {
                    alert("Invalid discount percentage. Please enter a number between 1 and 99.");
                }
                document.getElementById(`sale-toggle-${id}`).checked = false;
                return;
            }
            
            // Clean and parse the original price
            let currentPriceRaw = (prod.originalPrice || prod.price || "").toString().replace("Rs.", "").replace(/,/g, "").trim();
            let numericPrice = parseFloat(currentPriceRaw);
            
            if (isNaN(numericPrice)) {
                if (window.GUG_DB && window.GUG_DB.showToast) {
                    window.GUG_DB.showToast("Could not parse the product price for calculation.", "error", "Price Parsing Error");
                } else {
                    alert("Could not parse the product price for calculation.");
                }
                document.getElementById(`sale-toggle-${id}`).checked = false;
                return;
            }
            
            // Calculate new price
            let newPrice = numericPrice - (numericPrice * (discount / 100));
            
            prod.onSale = true;
            prod.originalPrice = numericPrice.toLocaleString();
            prod.price = Math.round(newPrice).toLocaleString();
        } else {
            // Revert sale
            prod.onSale = false;
            if (prod.originalPrice) {
                prod.price = prod.originalPrice;
                prod.originalPrice = null;
            }
        }
        
        let cIndex = customProducts.findIndex(x => x.id == id);
        if(cIndex > -1) {
            customProducts[cIndex] = prod;
        } else {
            customProducts.push(prod);
        }
        localStorage.setItem('admin_custom_products', JSON.stringify(customProducts));
        
        if (window.GUG_DB && typeof window.GUG_DB.saveProduct === 'function') {
            window.GUG_DB.saveProduct(prod);
        }
        if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveProduct === 'function') {
            window.GUG_FIREBASE.saveProduct(prod);
        }
        window.dispatchEvent(new CustomEvent('gugCatalogUpdated', { detail: LIVE_PRODUCTS }));
        window.dispatchEvent(new Event('productsReady'));
        
        if (typeof render === 'function') render();
    }
};

window.toggleProductImportant = (id, checked) => {
    let lIndex = LIVE_PRODUCTS.findIndex(x => x.id == id);
    if(lIndex > -1) {
        LIVE_PRODUCTS[lIndex].isFeatured = checked;
        
        let cIndex = customProducts.findIndex(x => x.id == id);
        if(cIndex > -1) {
            customProducts[cIndex].isFeatured = checked;
        } else {
            customProducts.push(LIVE_PRODUCTS[lIndex]);
        }
        localStorage.setItem('admin_custom_products', JSON.stringify(customProducts));

        if (window.GUG_DB && typeof window.GUG_DB.saveProduct === 'function') {
            window.GUG_DB.saveProduct(LIVE_PRODUCTS[lIndex]);
        }
        if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveProduct === 'function') {
            window.GUG_FIREBASE.saveProduct(LIVE_PRODUCTS[lIndex]);
        }
        window.dispatchEvent(new CustomEvent('gugCatalogUpdated', { detail: LIVE_PRODUCTS }));
        window.dispatchEvent(new Event('productsReady'));
    }
};

const pForm = document.getElementById('product-form');
if (pForm) {
    pForm.addEventListener('submit', e => {
        e.preventDefault();
        let existingProduct = LIVE_PRODUCTS.find(x => x.id == document.getElementById('p-id').value) || {};
        let p = {
            ...existingProduct,
            id: document.getElementById('p-id').value || Date.now().toString(),
            name: document.getElementById('p-name').value,
            price: Number(document.getElementById('p-price').value),
            originalPrice: document.getElementById('p-origPrice').value ? Number(document.getElementById('p-origPrice').value) : null,
            image: document.getElementById('p-image').value,
            description: document.getElementById('p-description').value,
            category: document.getElementById('p-category').value,
            onSale: document.getElementById('p-onSale').checked,
            isFeatured: document.getElementById('p-important').checked
        };
        
        let cIndex = customProducts.findIndex(x => x.id == p.id);
        if(cIndex > -1) customProducts[cIndex] = p;
        else customProducts.push(p);
        localStorage.setItem('admin_custom_products', JSON.stringify(customProducts));
        
        let lIndex = LIVE_PRODUCTS.findIndex(x => x.id == p.id);
        if(lIndex > -1) LIVE_PRODUCTS[lIndex] = p;
        else LIVE_PRODUCTS.unshift(p);
        
        if (window.GUG_DB && typeof window.GUG_DB.saveProduct === 'function') {
            window.GUG_DB.saveProduct(p);
        }
        if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveProduct === 'function') {
            window.GUG_FIREBASE.saveProduct(p);
        }

        document.getElementById('productModal').style.display = 'none';
        render();
    });
}

render();

// Staff Dashboard Initialization
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || '';
    if (currentPage === 'staff-dashboard.html' && localStorage.getItem('admin_role') === 'staff') {
        const username = localStorage.getItem('admin_username') || 'Staff';
        const nameEl = document.getElementById('staff-name');
        if (nameEl) nameEl.textContent = username;

        const liveProducts = LIVE_PRODUCTS;
        const totalEl = document.getElementById('staff-total-products');
        if (totalEl) totalEl.textContent = liveProducts.length;

        const grid = document.getElementById('staff-overview-grid');
        if (grid) {
            grid.innerHTML = liveProducts.map(p => {
                const price = p.onSale && p.originalPrice 
                    ? `<span class="text-danger">Rs. ${p.price.toLocaleString()}</span> <small class="text-decoration-line-through text-secondary">Rs. ${p.originalPrice.toLocaleString()}</small>` 
                    : `Rs. ${p.price.toLocaleString()}`;
                return `
                <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                    <div class="card bg-dark border-secondary h-100">
                        <img src="${p.image}" class="card-img-top" alt="${p.name}" style="height: 150px; object-fit: contain; padding: 10px;">
                        <div class="card-body">
                            <h6 class="card-title text-white">${p.name}</h6>
                            <p class="card-text text-secondary mb-1"><small>${p.category}</small></p>
                            <div class="card-text text-white">${price}</div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }
    }
});
// // Sales Page Management Toggle
document.addEventListener('DOMContentLoaded', () => {
    const saleToggle = document.getElementById('master-sale-toggle');
    const saleLabel = document.getElementById('master-sale-label');
    
    if (saleToggle) {
        const isSalesActive = localStorage.getItem('gug_sales_page_active') === 'true';
        saleToggle.checked = isSalesActive;
        saleLabel.textContent = isSalesActive ? 'ON' : 'OFF';
        saleLabel.className = isSalesActive ? 'form-check-label text-success fw-bold ms-2' : 'form-check-label text-secondary ms-2';

        saleToggle.addEventListener('change', (e) => {
            const isActive = e.target.checked;
            localStorage.setItem('gug_sales_page_active', isActive);
            saleLabel.textContent = isActive ? 'ON' : 'OFF';
            saleLabel.className = isActive ? 'form-check-label text-success fw-bold ms-2' : 'form-check-label text-secondary ms-2';
            window.dispatchEvent(new Event('storage'));
            if (window.GUG_DB && window.GUG_DB.showToast) {
                window.GUG_DB.showToast(`Storefront Sales page is now ${isActive ? 'ACTIVATED and visible' : 'DEACTIVATED and hidden'}.`, isActive ? 'success' : 'info', 'Sales Page Status');
            }
        });
    }
});

// =============================================
// GLOBAL VISUAL THEME & LAYOUT BUILDER LOGIC
// =============================================

const DEFAULT_THEME = {
    bgMain: '#0b0f13',
    bgCard: '#14191f',
    navbar: '#070a0d',
    topbarBg: '#050709',
    navbarTextColor: '#f0f6fc',
    footer: '#070a0d',
    footerTextColor: '#8b949e',
    accentRed: '#E50303',
    cardBorderColor: '#1f262e',
    stickyNavbar: true,
    
    // Pre-Footer Top Bar
    footerTopBarEnabled: true,
    footerTopBarTitle: 'Our Official Partners',
    footerTopBarSubtitle: 'Authorized hardware distributors and certified premium brands in Pakistan',
    footerFeaturesEnabled: true,
    footerPartnersEnabled: true,

    // Dynamic Multi-Contact Arrays
    queriesPhones: ['021 34832214'],
    whatsappNumbers: [],
    supportEmails: ['sales@gearupgadget.com'],
    generalPhones: ['021 34832214'],

    // Contact Numbers (Legacy Single String Compatibility)
    footerPhone: '021 34832214',
    footerPhoneLabel: 'Queries:',
    footerWhatsapp: '',
    footerEmail: 'sales@gearupgadget.com',
    topbarPhone: '021 34832214',
    topbarEmail: 'sales@gearupgadget.com',
    topbarAddress: 'F6 Technocity Mall',

    // Store Hours & Locations
    footerStoreHours: '12:00 PM - 8:00 PM',
    footerStoreDays: 'Monday - Saturday (Sunday Closed)',
    footerShopAddress: 'FA-06, 1st floor, Techno City Mall, Karachi.',
    footerHeadOffice: 'D-5, 4th floor, Osif Center, Block 13 A, University Road Gulshan-e-Iqbal, Karachi-Pakistan.',
    footerAbout: "Pakistan's premier high-end computer store. Servicing tech enthusiasts, gaming communities, and rendering professionals since 2012 with premium hardware, graphics cards, custom PC assembly, and unmatched support.",
    footerCopyright: 'Copyright 2021 to 2026 Gear Up Gadgets All rights reserved. [POWERED BY PHOENIX TECHNOLOGY]',

    bgAttachment: 'fixed',
    bgOpacity: 85,
    bgType: 'image',
    bgImage: 'assets/images/custom-bg.jpg',
    themePreset: 'gear_dark'
};

const THEME_PRESETS = {
    gear_dark: {
        bgMain: '#0b0f13',
        bgCard: '#14191f',
        navbar: '#070a0d',
        topbarBg: '#050709',
        navbarTextColor: '#f0f6fc',
        footer: '#070a0d',
        footerTextColor: '#8b949e',
        accentRed: '#E50303',
        cardBorderColor: '#1f262e'
    },
    zah_dark: {
        bgMain: '#0b0f13',
        bgCard: '#14191f',
        navbar: '#070a0d',
        topbarBg: '#050709',
        navbarTextColor: '#f0f6fc',
        footer: '#070a0d',
        footerTextColor: '#8b949e',
        accentRed: '#E50303',
        cardBorderColor: '#1f262e'
    },
    midnight_oled: {
        bgMain: '#000000',
        bgCard: '#0a0a0a',
        navbar: '#000000',
        topbarBg: '#050505',
        navbarTextColor: '#f0f6fc',
        footer: '#000000',
        footerTextColor: '#94a3b8',
        accentRed: '#00d2ff',
        cardBorderColor: '#1e293b'
    },
    cyber_red: {
        bgMain: '#0f172a',
        bgCard: '#1e293b',
        navbar: '#0b1120',
        topbarBg: '#080d1a',
        navbarTextColor: '#ffffff',
        footer: '#0b1120',
        footerTextColor: '#94a3b8',
        accentRed: '#ff385c',
        cardBorderColor: '#334155'
    },
    emerald: {
        bgMain: '#07140f',
        bgCard: '#0e261d',
        navbar: '#040a08',
        topbarBg: '#020604',
        navbarTextColor: '#f0fdf4',
        footer: '#040a08',
        footerTextColor: '#86efac',
        accentRed: '#10b981',
        cardBorderColor: '#164e3b'
    },
    clean_slate: {
        bgMain: '#f8fafc',
        bgCard: '#ffffff',
        navbar: '#ffffff',
        topbarBg: '#f1f5f9',
        navbarTextColor: '#0f172a',
        footer: '#ffffff',
        footerTextColor: '#64748b',
        accentRed: '#2563eb',
        cardBorderColor: '#e2e8f0'
    }
};

// Sync color picker <-> hex text input, update swatch & live preview
function bindColorSync(pickerId, hexId, swatchId) {
    const picker = document.getElementById(pickerId);
    const hex    = document.getElementById(hexId);
    const swatch = swatchId ? document.getElementById(swatchId) : null;
    if (!picker || !hex) return;

    const updateSwatch = (color) => {
        if (swatch) swatch.style.background = color;
        if (typeof window.updateLiveThemePreview === 'function') {
            window.updateLiveThemePreview();
        }
    };

    picker.addEventListener('input', () => {
        hex.value = picker.value;
        updateSwatch(picker.value);
    });
    hex.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) {
            picker.value = hex.value;
            updateSwatch(hex.value);
        }
    });
}

window.applyThemePreset = function(presetKey) {
    const preset = THEME_PRESETS[presetKey];
    if (!preset) return;

    const setColor = (pickerId, hexId, swatchId, val) => {
        if (!val) return;
        const p = document.getElementById(pickerId);
        const h = document.getElementById(hexId);
        const s = document.getElementById(swatchId);
        if (p) p.value = val;
        if (h) h.value = val;
        if (s) s.style.background = val;
    };

    setColor('theme-bg-main', 'theme-bg-main-hex', 'theme-bg-main-swatch', preset.bgMain);
    setColor('theme-bg-card', 'theme-bg-card-hex', 'theme-bg-card-swatch', preset.bgCard);
    setColor('theme-navbar', 'theme-navbar-hex', 'theme-navbar-swatch', preset.navbar);
    setColor('theme-topbar', 'theme-topbar-hex', 'theme-topbar-swatch', preset.topbarBg);
    setColor('theme-navbar-text', 'theme-navbar-text-hex', 'theme-navbar-text-swatch', preset.navbarTextColor);
    setColor('theme-footer', 'theme-footer-hex', 'theme-footer-swatch', preset.footer);
    setColor('theme-footer-text', 'theme-footer-text-hex', 'theme-footer-text-swatch', preset.footerTextColor);
    setColor('theme-accent-color', 'theme-accent-color-hex', 'theme-accent-color-swatch', preset.accentRed);
    setColor('theme-card-border', 'theme-card-border-hex', 'theme-card-border-swatch', preset.cardBorderColor);

    window.updateLiveThemePreview();

    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Applied preset theme palette. Click "Save & Apply Theme" to activate live.`, 'info', 'Theme Preset Loaded');
    }
};

window.updateLiveThemePreview = function() {
    const box = document.getElementById('live-theme-preview-box');
    if (!box) return;

    const bgMain = document.getElementById('theme-bg-main-hex')?.value || '#0b0f13';
    const bgCard = document.getElementById('theme-bg-card-hex')?.value || '#14191f';
    const navbar = document.getElementById('theme-navbar-hex')?.value || '#070a0d';
    const topbar = document.getElementById('theme-topbar-hex')?.value || '#050709';
    const navText = document.getElementById('theme-navbar-text-hex')?.value || '#ffffff';
    const footer = document.getElementById('theme-footer-hex')?.value || '#070a0d';
    const footerText = document.getElementById('theme-footer-text-hex')?.value || '#8b949e';
    const accent = document.getElementById('theme-accent-color-hex')?.value || '#E50303';
    const cardBorder = document.getElementById('theme-card-border-hex')?.value || '#1f262e';
    const bgType = document.getElementById('theme-bg-type')?.value || 'none';
    const bgImageUrl = document.getElementById('theme-bg-image-url')?.value?.trim() || '';
    const bgOpacity = Number(document.getElementById('theme-bg-opacity')?.value || 85);

    const rgbaCard = (window.hexToRgba ? window.hexToRgba(bgCard, 0.45) : 'rgba(10, 10, 15, 0.45)');
    const rgbaHeader = (window.hexToRgba ? window.hexToRgba(navbar, 0.6) : 'rgba(10, 10, 15, 0.6)');
    const rgbaTopbar = (window.hexToRgba ? window.hexToRgba(topbar, 0.65) : 'rgba(8, 8, 12, 0.65)');
    const rgbaFooter = (window.hexToRgba ? window.hexToRgba(footer, 0.65) : 'rgba(10, 10, 15, 0.65)');

    if (bgType === 'image' && bgImageUrl) {
        const overlayAlpha = Math.min(1, Math.max(0, bgOpacity / 100));
        const overlayColor = window.hexToRgba ? window.hexToRgba(bgMain, overlayAlpha) : 'rgba(0,0,0,0.8)';
        box.style.background = `${overlayColor}`;
        box.style.backgroundImage = `linear-gradient(${overlayColor}, ${overlayColor}), url("${bgImageUrl}")`;
        box.style.backgroundSize = 'cover';
        box.style.backgroundPosition = 'center';
    } else {
        box.style.background = bgMain;
        box.style.backgroundImage = `radial-gradient(ellipse at 50% 0%, ${window.hexToRgba ? window.hexToRgba(accent, 0.2) : 'rgba(229,3,3,0.2)'} 0%, transparent 60%)`;
    }

    const prevTopbar = document.getElementById('prev-topbar');
    if (prevTopbar) {
        prevTopbar.style.background = rgbaTopbar;
        prevTopbar.style.backdropFilter = 'blur(16px)';
        prevTopbar.style.webkitBackdropFilter = 'blur(16px)';
    }

    const prevNavbar = document.getElementById('prev-navbar');
    if (prevNavbar) {
        prevNavbar.style.background = rgbaHeader;
        prevNavbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.1)';
        prevNavbar.style.backdropFilter = 'blur(16px)';
        prevNavbar.style.webkitBackdropFilter = 'blur(16px)';
    }

    const prevLinks = [document.getElementById('prev-nav-link1'), document.getElementById('prev-nav-link2')];
    prevLinks.forEach(l => { if (l) l.style.color = navText; });

    const prevSaleLink = document.getElementById('prev-nav-link3');
    if (prevSaleLink) prevSaleLink.style.color = accent;

    const prevCta = document.getElementById('prev-cta-btn');
    if (prevCta) prevCta.style.background = accent;

    const prevCard = document.getElementById('prev-card');
    if (prevCard) {
        prevCard.style.background = rgbaCard;
        prevCard.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        prevCard.style.backdropFilter = 'blur(16px)';
        prevCard.style.webkitBackdropFilter = 'blur(16px)';
    }

    const prevBadge = document.getElementById('prev-badge-sale');
    if (prevBadge) prevBadge.style.background = accent;

    const prevPrice = document.getElementById('prev-price');
    if (prevPrice) prevPrice.style.color = accent;

    const prevFooter = document.getElementById('prev-footer');
    if (prevFooter) {
        prevFooter.style.background = rgbaFooter;
        prevFooter.style.color = footerText;
        prevFooter.style.borderTopColor = 'rgba(255, 255, 255, 0.1)';
        prevFooter.style.backdropFilter = 'blur(16px)';
        prevFooter.style.webkitBackdropFilter = 'blur(16px)';
    }

    // Dynamic Live Preview Text Updates
    const queriesPhones = (typeof window.getDynamicContacts === 'function')
        ? window.getDynamicContacts('queries')
        : [(document.getElementById('theme-footer-phone')?.value || '021 34832214').trim()];
    const phone = queriesPhones[0] || '021 34832214';
    const phoneDisplay = queriesPhones.length > 1 ? queriesPhones.slice(0, 2).join(' / ') : phone;
    const phoneLabel = document.getElementById('theme-footer-phone-label')?.value || 'Queries:';
    const hours = document.getElementById('theme-footer-hours')?.value || '12:00 PM - 8:00 PM';
    const topbarTitle = document.getElementById('theme-footer-topbar-title')?.value || 'Our Official Partners';
    const topbarShow = document.getElementById('theme-footer-topbar-toggle')?.checked ?? true;
    const shopAddr = document.getElementById('theme-footer-shop-addr')?.value || 'FA-06, 1st floor, Techno City Mall, Karachi.';
    const copyText = 'Copyright 2021 to 2026 Gear Up Gadgets All rights reserved. [POWERED BY PHOENIX TECHNOLOGY]';

    const prevTopPhone = document.getElementById('prev-topbar-phone');
    if (prevTopPhone) prevTopPhone.innerHTML = `<i class="fas fa-phone text-danger me-1"></i> ${phoneLabel} ${phone}`;

    const prevTopHours = document.getElementById('prev-topbar-hours');
    if (prevTopHours) prevTopHours.textContent = hours;

    const prevFootTopbar = document.getElementById('prev-footer-topbar');
    if (prevFootTopbar) {
        prevFootTopbar.style.display = topbarShow ? 'block' : 'none';
        prevFootTopbar.textContent = topbarTitle;
    }

    const prevFootPhone = document.getElementById('prev-footer-phone');
    if (prevFootPhone) prevFootPhone.textContent = `${phoneLabel} ${phoneDisplay}`;

    const prevFootAddr = document.getElementById('prev-footer-addr');
    if (prevFootAddr) prevFootAddr.textContent = shopAddr;

    const prevFootCopy = document.getElementById('prev-footer-copy');
    if (prevFootCopy) prevFootCopy.innerHTML = copyText;
};

window.switchBgType = (type) => {
    const imgSection = document.getElementById('theme-bg-image-section');
    const vidSection = document.getElementById('theme-bg-video-section');
    if (imgSection) imgSection.style.display = (type === 'image') ? 'block' : 'none';
    if (vidSection) vidSection.style.display = (type === 'video') ? 'block' : 'none';
    const typeSelect = document.getElementById('theme-bg-type');
    if (typeSelect && typeSelect.value !== type) typeSelect.value = type;
    window.updateLiveThemePreview();
};

window.previewBgImage = (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (window.GUG_DB && window.GUG_DB.showToast) {
            window.GUG_DB.showToast('Optimizing & loading background image...', 'info', 'Theme Wallpaper');
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const rawDataUrl = e.target.result;
            // Compress large images with Canvas to prevent localStorage & Firestore quota exhaustion
            const img = new Image();
            img.onload = () => {
                // Resize to max 1280x720 for crisp desktop wallpaper (< 200KB)
                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 720;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                    if (width / height > MAX_WIDTH / MAX_HEIGHT) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    } else {
                        width = Math.round((width * MAX_HEIGHT) / height);
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                let compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
                if (compressedDataUrl.length > 250000) {
                    compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
                }

                const preview = document.getElementById('theme-bg-preview');
                const wrapper = document.getElementById('theme-bg-preview-wrapper');
                const urlInput = document.getElementById('theme-bg-image-url');
                const typeSelect = document.getElementById('theme-bg-type');

                if (preview) preview.src = compressedDataUrl;
                if (wrapper) wrapper.style.display = 'block';
                if (urlInput) urlInput.value = compressedDataUrl;

                // Crucial: Automatically switch background media selector to 'image' and reveal controls
                if (typeSelect) typeSelect.value = 'image';
                window.switchBgType('image');

                // Update live mini preview box
                window.updateLiveThemePreview();

                // Instantly apply the background image preview to the page
                try {
                    const bgMain = (document.getElementById('theme-bg-main-hex')?.value || '#0b0f13').trim();
                    const bgOpacity = Number(document.getElementById('theme-bg-opacity')?.value || 85);
                    const overlayAlpha = Math.min(1, Math.max(0, bgOpacity / 100));
                    const overlayColor = window.hexToRgba ? window.hexToRgba(bgMain, overlayAlpha) : 'rgba(11,15,19,0.85)';
                    const previewBgCss = `linear-gradient(${overlayColor}, ${overlayColor}), url("${compressedDataUrl}")`;
                    document.documentElement.style.setProperty('--gug-bg-image', previewBgCss);
                    if (document.body) {
                        document.body.style.setProperty('--gug-bg-image', previewBgCss);
                        document.body.style.backgroundImage = previewBgCss;
                    }
                } catch(e) {}

                if (window.GUG_DB && window.GUG_DB.showToast) {
                    window.GUG_DB.showToast('Background image loaded & previewed! Click "Save & Apply Theme" to activate permanently.', 'success', 'Wallpaper Ready');
                }
            };
            img.onerror = () => {
                const preview = document.getElementById('theme-bg-preview');
                const wrapper = document.getElementById('theme-bg-preview-wrapper');
                const urlInput = document.getElementById('theme-bg-image-url');
                const typeSelect = document.getElementById('theme-bg-type');
                if (preview) preview.src = rawDataUrl;
                if (wrapper) wrapper.style.display = 'block';
                if (urlInput) urlInput.value = rawDataUrl;
                if (typeSelect) typeSelect.value = 'image';
                window.switchBgType('image');
                window.updateLiveThemePreview();
            };
            img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);
    }
};

window.clearBgImage = () => {
    const input = document.getElementById('theme-bg-image-input');
    const preview = document.getElementById('theme-bg-preview');
    const wrapper = document.getElementById('theme-bg-preview-wrapper');
    const urlInput = document.getElementById('theme-bg-image-url');
    if (input) input.value = '';
    if (preview) preview.src = '';
    if (wrapper) wrapper.style.display = 'none';
    if (urlInput) urlInput.value = '';

    const config = JSON.parse(localStorage.getItem('gug_event_theme_config') || '{}');
    config.bgImage = null;
    delete config.bgImage;
    if (config.bgType === 'image') config.bgType = 'none';
    config.updatedAt = Date.now();

    const typeSelect = document.getElementById('theme-bg-type');
    if (typeSelect && typeSelect.value === 'image') {
        typeSelect.value = 'none';
        window.switchBgType('none');
    }

    localStorage.setItem('gug_event_theme_config', JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('gugThemeUpdated', { detail: config }));
    window.dispatchEvent(new Event('storage'));
    if (typeof window.applyGlobalTheme === 'function') window.applyGlobalTheme();
    window.updateLiveThemePreview();

    // Sync removal to Cloud Firestore
    if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveThemeConfig === 'function') {
        window.GUG_FIREBASE.saveThemeConfig(config);
    }

    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast('Background image removed and reset to default.', 'info', 'Theme Reset');
    }
};

window.previewBgVideo = (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 5 * 1024 * 1024) {
            alert('Note: This video file is ' + (file.size / 1024 / 1024).toFixed(1) + 'MB. Storing large video files in browser localStorage may reach storage limits. You can also specify a relative video path (e.g. assets/videos/bg.mp4) or hosted URL in the path field.');
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('theme-bg-video-preview');
            const wrapper = document.getElementById('theme-bg-video-preview-wrapper');
            const urlInput = document.getElementById('theme-bg-video-url');
            if (preview) {
                preview.src = e.target.result;
                preview.load();
                preview.play().catch(() => {});
            }
            if (wrapper) wrapper.style.display = 'block';
            if (urlInput) urlInput.value = e.target.result;
            window.updateLiveThemePreview();
        };
        reader.readAsDataURL(file);
    }
};

window.clearBgVideo = () => {
    const input = document.getElementById('theme-bg-video-input');
    const preview = document.getElementById('theme-bg-video-preview');
    const wrapper = document.getElementById('theme-bg-video-preview-wrapper');
    const urlInput = document.getElementById('theme-bg-video-url');
    if (input) input.value = '';
    if (preview) { preview.pause(); preview.src = ''; }
    if (wrapper) wrapper.style.display = 'none';
    if (urlInput) urlInput.value = '';

    const config = JSON.parse(localStorage.getItem('gug_event_theme_config') || '{}');
    config.bgVideo = null;
    delete config.bgVideo;
    if (config.bgType === 'video') config.bgType = 'none';
    const typeSelect = document.getElementById('theme-bg-type');
    if (typeSelect && typeSelect.value === 'video') typeSelect.value = 'none';

    localStorage.setItem('gug_event_theme_config', JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('gugThemeUpdated', { detail: config }));
    window.dispatchEvent(new Event('storage'));
    if (typeof window.applyGlobalTheme === 'function') window.applyGlobalTheme();
    window.updateLiveThemePreview();

    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast('Background video removed and reset to default.', 'info', 'Theme Reset');
    }
};

window.saveGlobalThemeConfig = async () => {
    const bgMain = (document.getElementById('theme-bg-main-hex')?.value || '#0b0f13').trim();
    const bgCard = (document.getElementById('theme-bg-card-hex')?.value || '#14191f').trim();
    const navbar = (document.getElementById('theme-navbar-hex')?.value || '#070a0d').trim();
    const topbarBg = (document.getElementById('theme-topbar-hex')?.value || '#050709').trim();
    const navbarTextColor = (document.getElementById('theme-navbar-text-hex')?.value || '#f0f6fc').trim();
    const footer = (document.getElementById('theme-footer-hex')?.value || '#070a0d').trim();
    const footerTextColor = (document.getElementById('theme-footer-text-hex')?.value || '#8b949e').trim();
    const accentRed = (document.getElementById('theme-accent-color-hex')?.value || '#E50303').trim();
    const cardBorderColor = (document.getElementById('theme-card-border-hex')?.value || '#1f262e').trim();

    const stickyNavbar = document.getElementById('theme-sticky-navbar')?.checked ?? true;

    // Pre-Footer Top Bar
    const footerTopBarEnabled = document.getElementById('theme-footer-topbar-toggle')?.checked ?? true;
    const footerTopBarTitle = (document.getElementById('theme-footer-topbar-title')?.value || 'Our Official Partners').trim();
    const footerTopBarSubtitle = (document.getElementById('theme-footer-topbar-subtitle')?.value || '').trim();
    const footerFeaturesEnabled = document.getElementById('theme-footer-features-toggle')?.checked ?? true;
    const footerPartnersEnabled = document.getElementById('theme-footer-partners')?.checked ?? true;

    // Dynamic Multi-Contact Lists
    const queriesPhones = (typeof window.getDynamicContacts === 'function')
        ? window.getDynamicContacts('queries')
        : [(document.getElementById('theme-footer-phone')?.value || '021 34832214').trim()];
    const whatsappNumbers = (typeof window.getDynamicContacts === 'function')
        ? window.getDynamicContacts('whatsapp')
        : [(document.getElementById('theme-footer-whatsapp')?.value || '').trim()].filter(Boolean);
    const supportEmails = (typeof window.getDynamicContacts === 'function')
        ? window.getDynamicContacts('email')
        : [(document.getElementById('theme-footer-email')?.value || 'sales@gearupgadget.com').trim()];
    const generalPhones = (typeof window.getDynamicContacts === 'function')
        ? window.getDynamicContacts('phone')
        : [(document.getElementById('theme-topbar-phone')?.value || '021 34832214').trim()];

    // Contact Numbers (Legacy Single String Compatibility Fallback)
    const footerPhone = queriesPhones[0] || '021 34832214';
    const footerPhoneLabel = (document.getElementById('theme-footer-phone-label')?.value || 'Queries:').trim();
    const footerWhatsapp = whatsappNumbers[0] || '';
    const footerEmail = supportEmails[0] || 'sales@gearupgadget.com';
    const topbarPhone = footerPhone;
    const topbarEmail = footerEmail;
    const topbarAddress = (document.getElementById('theme-footer-topbar-address')?.value || document.getElementById('theme-topbar-address')?.value || 'F6 Technocity Mall').trim();

    // Store Hours & Locations
    const footerStoreHours = (document.getElementById('theme-footer-hours')?.value || '12:00 PM - 8:00 PM').trim();
    const footerStoreDays = (document.getElementById('theme-footer-days')?.value || 'Monday - Saturday (Sunday Closed)').trim();
    const footerShopAddress = (document.getElementById('theme-footer-shop-addr')?.value || 'FA-06, 1st floor, Techno City Mall, Karachi.').trim();
    const footerHeadOffice = (document.getElementById('theme-footer-office-addr')?.value || 'D-5, 4th floor, Osif Center, Block 13 A, University Road Gulshan-e-Iqbal, Karachi-Pakistan.').trim();
    const footerAbout = (document.getElementById('theme-footer-about')?.value || '').trim();
    const footerCopyright = 'Copyright 2021 to 2026 Gear Up Gadgets All rights reserved. [POWERED BY PHOENIX TECHNOLOGY]';

    const bgAttachment = document.getElementById('theme-bg-attachment')?.value || 'fixed';
    const bgOpacity = Number(document.getElementById('theme-bg-opacity')?.value || 85);
    let bgType = document.getElementById('theme-bg-type')?.value || 'none';
    const bgImageUrl = (document.getElementById('theme-bg-image-url')?.value || '').trim();
    const bgVideoUrl = (document.getElementById('theme-bg-video-url')?.value || '').trim();
    const previewImg = document.getElementById('theme-bg-preview');
    const previewSrc = (previewImg && previewImg.src && !previewImg.src.endsWith('#') && previewImg.style.display !== 'none') ? previewImg.src : '';

    const activeBgImg = bgImageUrl || previewSrc;

    // Auto-detect media type: if user provided or uploaded an image, ensure bgType is 'image'
    if (activeBgImg && bgType !== 'video') {
        bgType = 'image';
        const typeSelect = document.getElementById('theme-bg-type');
        if (typeSelect && typeSelect.value !== 'image') typeSelect.value = 'image';
    } else if (bgVideoUrl && bgType !== 'image') {
        bgType = 'video';
        const typeSelect = document.getElementById('theme-bg-type');
        if (typeSelect && typeSelect.value !== 'video') typeSelect.value = 'video';
    }

    const existing = JSON.parse(localStorage.getItem('gug_event_theme_config') || '{}');

    let resolvedBgImage = null;
    let resolvedBgVideo = null;
    if (bgType === 'image') {
        resolvedBgImage = activeBgImg || existing.bgImage || null;
    } else if (bgType === 'video') {
        resolvedBgVideo = bgVideoUrl || existing.bgVideo || null;
    }

    const config = Object.assign({}, existing, {
        bgMain,
        bgCard,
        navbar,
        topbarBg,
        navbarTextColor,
        footer,
        footerTextColor,
        accentRed,
        cardBorderColor,
        stickyNavbar,
        footerTopBarEnabled,
        footerTopBarTitle,
        footerTopBarSubtitle,
        footerFeaturesEnabled,
        footerPartnersEnabled,
        queriesPhones: queriesPhones.length ? queriesPhones : ['021 34832214'],
        whatsappNumbers,
        supportEmails: supportEmails.length ? supportEmails : ['sales@gearupgadget.com'],
        generalPhones: generalPhones.length ? generalPhones : ['021 34832214'],
        footerPhone,
        footerPhoneLabel,
        footerWhatsapp,
        footerEmail,
        topbarPhone,
        topbarEmail,
        topbarAddress,
        footerStoreHours,
        footerStoreDays,
        footerShopAddress,
        footerHeadOffice,
        footerAbout,
        footerCopyright,
        bgAttachment,
        bgOpacity,
        bgType,
        bgImage: resolvedBgImage,
        bgVideo: resolvedBgVideo,
        updatedAt: Date.now()
    });

    try {
        localStorage.setItem('gug_event_theme_config', JSON.stringify(config));
    } catch(err) {
        if (err.name === 'QuotaExceededError') {
            console.warn('[Theme Save] QuotaExceededError encountered, clearing temporary cache...');
            try {
                localStorage.removeItem('gug_temp_cache');
                localStorage.setItem('gug_event_theme_config', JSON.stringify(config));
            } catch(retryErr) {
                console.error('[Theme Save] Critical storage error:', retryErr);
                alert('Browser storage capacity reached. The theme is applied for your current session and synced to the cloud database.');
            }
        } else {
            console.warn('[Theme Save] Local storage error:', err);
        }
    }

    // Broadcast update across all open tabs and pages
    window.dispatchEvent(new CustomEvent('gugThemeUpdated', { detail: config }));
    window.dispatchEvent(new Event('storage'));

    if (typeof window.applyGlobalTheme === 'function') {
        window.applyGlobalTheme();
    }
    if (typeof window.updateLiveThemePreview === 'function') {
        window.updateLiveThemePreview();
    }

    // Sync to Cloud Firestore in realtime
    if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveThemeConfig === 'function') {
        try {
            await window.GUG_FIREBASE.saveThemeConfig(config);
        } catch(cloudErr) {
            console.warn('[Theme Save] Cloud sync notice:', cloudErr);
        }
    }

    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast('Global theme & background image saved and synced live across website & cloud!', 'success', 'Theme Saved & Applied');
    } else {
        alert('Settings saved & activated! Changes are live across storefront and synced to cloud.');
    }
};

window.resetGlobalTheme = () => {
    if (!confirm('Reset all website theme settings and color palettes to factory defaults?')) return;
    localStorage.removeItem('gug_event_theme_config');
    localStorage.setItem('gug_event_theme_config', JSON.stringify(DEFAULT_THEME));
    if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveThemeConfig === 'function') {
        window.GUG_FIREBASE.saveThemeConfig(DEFAULT_THEME);
    }
    window.dispatchEvent(new CustomEvent('gugThemeUpdated', { detail: DEFAULT_THEME }));
    window.dispatchEvent(new Event('storage'));
    location.reload();
};

// Aliases for compatibility
window.saveEventConfig = window.saveGlobalThemeConfig;
window.resetEventTheme = window.resetGlobalTheme;
window.saveEventName = function() {
    const el = document.getElementById('event-sale-name');
    const name = el ? el.value.trim() : '';
    if (name) {
        localStorage.setItem('gug_sales_event_name', name);
    } else {
        localStorage.removeItem('gug_sales_event_name');
    }
    window.dispatchEvent(new Event('storage'));
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Campaign event name updated to "${name || 'Sales'}".`, 'success', 'Event Saved');
    }
};

// =============================================
// HOMEPAGE HERO SLIDER & BANNER MANAGEMENT
// =============================================

const DEFAULT_HERO_SLIDES = [
    {
        id: "slide-1",
        active: true,
        subtitle: "ULTIMATE PORTABILITY & POWER",
        title: "NEXT-GEN HIGH-PERFORMANCE GAMING LAPTOPS",
        titleHighlight: "GAMING LAPTOPS",
        desc: "Unleash desktop-class performance on the go. Featuring ultra-fast refresh rates, advanced thermal cooling, and the latest mobile GPUs for flawless gaming and rendering anywhere.",
        btnText: "SHOP LAPTOPS",
        btnLink: "shop.html?category=laptops",
        image: "assets/images/slider/laptop.png"
    },
    {
        id: "slide-2",
        active: true,
        subtitle: "ULTRA-FAST STORAGE",
        title: "PCIe 5.0 NVMe BLAZING SPEEDS",
        titleHighlight: "BLAZING SPEEDS",
        desc: "Load your games instantly and transfer terabytes in seconds. Unleash the true potential of your system with our latest high-end Gen 5 SSDs.",
        btnText: "UPGRADE NOW",
        btnLink: "shop.html?category=nvme ssds",
        image: "assets/images/slider/ssd.png"
    },
    {
        id: "slide-3",
        active: true,
        subtitle: "MAXIMUM BANDWIDTH",
        title: "DDR5 RGB MEMORY KITS",
        titleHighlight: "MEMORY KITS",
        desc: "Push your framerates higher and multitask flawlessly with ultra-low latency, high-frequency DDR5 memory tailored for elite overclocking.",
        btnText: "BOOST PERFORMANCE",
        btnLink: "shop.html?category=ram",
        image: "assets/images/slider/ram.png"
    },
    {
        id: "slide-4",
        active: true,
        subtitle: "RAW COMPUTING POWER",
        title: "INTEL & AMD FLAGSHIP CPUs",
        titleHighlight: "FLAGSHIP CPUs",
        desc: "Dominate workloads and demanding AAA games with the latest processors featuring revolutionary hybrid core architectures.",
        btnText: "BUILD YOUR CORE",
        btnLink: "shop.html?category=processors",
        image: "assets/images/slider/pro.png"
    },
    {
        id: "slide-5",
        active: true,
        subtitle: "TACTILE PRECISION",
        title: "MECHANICAL RGB KEYBOARDS",
        titleHighlight: "RGB KEYBOARDS",
        desc: "Elevate your typing and gaming with aerospace-grade aluminum frames, hot-swappable switches, and per-key RGB lighting.",
        btnText: "TYPE IN STYLE",
        btnLink: "shop.html?category=mechanical keyboards",
        image: "assets/images/slider/key.png"
    },
    {
        id: "slide-6",
        active: true,
        subtitle: "ESPORTS READY",
        title: "ULTRALIGHT GAMING MOUSE",
        titleHighlight: "GAMING MOUSE",
        desc: "Achieve pixel-perfect tracking with advanced optical sensors and ultra-low latency wireless technology designed for pros.",
        btnText: "GET THE EDGE",
        btnLink: "shop.html?category=gaming mice",
        image: "assets/images/slider/mouse.png"
    }
];

const DEFAULT_HOMEPAGE_BANNERS = {
    enabled: true,
    promoCardsEnabled: true,
    bannerMonitors: {
        active: true,
        image: "assets/images/banner1.png",
        link: "shop.html?category=monitors",
        title: "Featured Monitors Banner"
    },
    bannerLaptops: {
        active: true,
        image: "assets/images/laptops-banner.png",
        link: "shop.html?category=laptops",
        title: "Featured Laptops Banner"
    },
    bannerProcessors: {
        active: true,
        image: "assets/images/components-banner.png",
        link: "shop.html?category=processors",
        title: "PC Components Banner"
    },
    promo1: {
        active: true,
        image: "assets/images/promo-laptops.jpg",
        link: "shop.html?category=laptops",
        title: "Built to Dominate (Laptops)"
    },
    promo2: {
        active: true,
        image: "assets/images/promo-cases.png",
        link: "shop.html?category=components",
        title: "Show Off Your Rig (PC Cases)"
    },
    promo3: {
        active: true,
        image: "assets/images/promo-peripherals.png",
        link: "shop.html?category=accessories",
        title: "Precision At Your Fingertips"
    },
    promo4: {
        active: true,
        image: "assets/images/promo-apple.png",
        link: "shop.html?brand=apple",
        title: "Pure Performance Iconic Design"
    }
};

window.toggleMasterHeroSlider = function(enabled) {
    localStorage.setItem('gug_hero_slider_enabled', enabled);
    const label = document.getElementById('master-hero-slider-label');
    if (label) {
        label.textContent = enabled ? 'ON' : 'OFF';
        label.className = enabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
    }
    window.dispatchEvent(new CustomEvent('gugSlidesUpdated'));
    window.dispatchEvent(new Event('storage'));
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Homepage Hero Slider is now ${enabled ? 'ACTIVATED and visible' : 'DEACTIVATED and hidden'}.`, enabled ? 'success' : 'info', 'Hero Slider Toggle');
    }
};

window.toggleCategoryBannersSection = function(enabled) {
    const banners = window.getHomepageBanners();
    banners.enabled = enabled;
    window.saveHomepageBanners(banners);
    const label = document.getElementById('master-category-banners-label');
    if (label) {
        label.textContent = enabled ? 'ON' : 'OFF';
        label.className = enabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
    }
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Category Section Strip Banners are now ${enabled ? 'ENABLED' : 'HIDDEN'}.`, enabled ? 'success' : 'info', 'Category Banners');
    }
};

window.togglePromoCardsSection = function(enabled) {
    const banners = window.getHomepageBanners();
    banners.promoCardsEnabled = enabled;
    window.saveHomepageBanners(banners);
    const label = document.getElementById('master-promo-cards-label');
    if (label) {
        label.textContent = enabled ? 'ON' : 'OFF';
        label.className = enabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
    }
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Promotional 4-Grid Cards are now ${enabled ? 'ENABLED' : 'HIDDEN'}.`, enabled ? 'success' : 'info', 'Promo Cards');
    }
};

window.toggleHeroSlideActive = function(slideId, active) {
    let slides = window.getHomepageSlides();
    const s = slides.find(item => item.id === slideId);
    if (s) {
        s.active = active;
        window.saveHomepageSlides(slides);
        window.renderHeroSlidesManager();
        if (window.GUG_DB && window.GUG_DB.showToast) {
            window.GUG_DB.showToast(`Slide #${s.id} is now ${active ? 'ACTIVE' : 'INACTIVE'}.`, active ? 'success' : 'info', 'Slide Status');
        }
    }
};

window.getHomepageSlides = function() {
    try {
        const stored = localStorage.getItem('gug_homepage_slides');
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_HERO_SLIDES));
};

window.saveHomepageSlides = function(slides) {
    localStorage.setItem('gug_homepage_slides', JSON.stringify(slides));
    window.dispatchEvent(new CustomEvent('gugSlidesUpdated', { detail: slides }));
    window.dispatchEvent(new Event('storage'));
};

window.getHomepageBanners = function() {
    try {
        const stored = localStorage.getItem('gug_homepage_banners');
        if (stored) return Object.assign({}, DEFAULT_HOMEPAGE_BANNERS, JSON.parse(stored));
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_BANNERS));
};

window.saveHomepageBanners = function(banners) {
    localStorage.setItem('gug_homepage_banners', JSON.stringify(banners));
    window.dispatchEvent(new CustomEvent('gugBannersUpdated', { detail: banners }));
    window.dispatchEvent(new Event('storage'));
};

window.isMediaVideo = function(url, explicitType) {
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
};

window.renderMediaTag = function(mediaSrc, options = {}) {
    if (!mediaSrc) return '';
    const src = typeof mediaSrc === 'object' ? (mediaSrc.url || mediaSrc.src || mediaSrc.image || '') : String(mediaSrc);
    const isVid = window.isMediaVideo(mediaSrc, options.explicitType);
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
};

window.renderHeroSlidesManager = function() {
    const container = document.getElementById('hero-slides-list-container');
    if (!container) return;
    const slides = window.getHomepageSlides();
    if (!slides || slides.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-warning">No slides configured. Click "Reset to Defaults" to restore original slides.</div></div>';
        return;
    }
    container.innerHTML = slides.map((s, idx) => {
        const isActive = s.active !== false;
        const isVid = s.mediaType === 'video' || window.isMediaVideo(s.image);
        return `
        <div class="col-md-6 col-xl-4 mb-3">
            <div class="card h-100 border shadow-sm ${isActive ? '' : 'opacity-75'}">
                <div class="card-header bg-light d-flex justify-content-between align-items-center py-2">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge ${isActive ? 'bg-danger' : 'bg-secondary'}">Slide #${idx + 1}</span>
                        <div class="form-check form-switch m-0">
                            <input class="form-check-input" type="checkbox" id="slide-active-toggle-${s.id}" ${isActive ? 'checked' : ''} onchange="toggleHeroSlideActive('${s.id}', this.checked)" title="Toggle slide ON/OFF">
                        </div>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openHeroSlideModal('${s.id}')" title="Edit Slide"><i class="fas fa-edit me-1"></i> Edit</button>
                        <button class="btn btn-outline-danger" onclick="deleteHeroSlide('${s.id}')" title="Delete Slide"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="text-center p-3 bg-dark d-flex align-items-center justify-content-center position-relative" style="height: 140px; overflow: hidden;">
                    ${isVid ? 
                        `<video src="${s.image}" autoplay muted loop playsinline style="max-height: 120px; max-width: 100%; object-fit: contain;"></video>
                         <span class="badge bg-warning text-dark position-absolute top-0 end-0 m-2" style="font-size:10px;"><i class="fas fa-video me-1"></i> VIDEO</span>` :
                        `<img src="${s.image}" alt="${s.title}" style="max-height: 120px; max-width: 100%; object-fit: contain;">
                         <span class="badge bg-secondary position-absolute top-0 end-0 m-2" style="font-size:10px;"><i class="fas fa-image me-1"></i> IMAGE</span>`
                    }
                </div>
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-secondary" style="font-size:10px;">${s.subtitle || 'SLIDE SUBTITLE'}</span>
                        <span class="badge ${isActive ? 'bg-success' : 'bg-danger'}" style="font-size:9px;">${isActive ? 'ACTIVE' : 'DISABLED'}</span>
                    </div>
                    <h6 class="card-title fw-bold text-dark text-truncate mb-1">${s.title}</h6>
                    <p class="card-text text-muted small mb-2" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 11.5px;">${s.desc || ''}</p>
                    <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                        <small class="text-primary fw-bold"><i class="fas fa-link me-1"></i> ${s.btnText || 'SHOP'}</small>
                        <small class="text-muted text-truncate" style="max-width: 140px;">${s.btnLink || '#'}</small>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
};

window.toggleMasterHeroSlider = function(enabled) {
    localStorage.setItem('gug_hero_slider_enabled', enabled ? 'true' : 'false');
    const label = document.getElementById('master-hero-slider-label');
    if (label) {
        label.textContent = enabled ? 'ON' : 'OFF';
        label.className = enabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('gugSlidesUpdated'));
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Homepage Hero Swiper is now ${enabled ? 'ENABLED' : 'DISABLED'}.`, enabled ? 'success' : 'info', 'Hero Slider');
    }
};

window.toggleHeroSlideActive = function(slideId, isActive) {
    let slides = window.getHomepageSlides();
    const idx = slides.findIndex(s => s.id === slideId);
    if (idx >= 0) {
        slides[idx].active = !!isActive;
        window.saveHomepageSlides(slides);
        window.renderHeroSlidesManager();
        if (window.GUG_DB && window.GUG_DB.showToast) {
            window.GUG_DB.showToast(`Slide "${slides[idx].title || slideId}" is now ${isActive ? 'ACTIVE' : 'DISABLED'}.`, isActive ? 'success' : 'info', 'Slide Status');
        }
    }
};

window.toggleCategoryBannersSection = function(enabled) {
    let banners = window.getHomepageBanners();
    banners.enabled = !!enabled;
    window.saveHomepageBanners(banners);
    const label = document.getElementById('master-category-banners-label');
    if (label) {
        label.textContent = enabled ? 'ON' : 'OFF';
        label.className = enabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
    }
    const grid = document.getElementById('category-banners-grid-wrapper');
    if (grid) {
        grid.style.opacity = enabled ? '1' : '0.5';
    }
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Category Section Strip Banners are now ${enabled ? 'ENABLED' : 'HIDDEN'}.`, enabled ? 'success' : 'info', 'Category Banners');
    }
};

window.togglePromoCardsSection = function(enabled) {
    let banners = window.getHomepageBanners();
    banners.promoCardsEnabled = !!enabled;
    window.saveHomepageBanners(banners);
    const label = document.getElementById('master-promo-cards-label');
    if (label) {
        label.textContent = enabled ? 'ON' : 'OFF';
        label.className = enabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
    }
    const grid = document.getElementById('promo-cards-grid-wrapper');
    if (grid) {
        grid.style.opacity = enabled ? '1' : '0.5';
    }
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Promotional 4-Grid Cards are now ${enabled ? 'ENABLED' : 'HIDDEN'}.`, enabled ? 'success' : 'info', 'Promo Cards');
    }
};

window.updateSlideModalPreview = function(src, type) {
    const isVid = (type === 'video') || window.isMediaVideo(src);
    const container = document.getElementById('slide-form-media-preview-container');
    if (!container) return;
    if (isVid) {
        container.innerHTML = `<video src="${src || ''}" autoplay muted loop playsinline style="max-height:100px;max-width:100%;object-fit:contain;"></video>`;
    } else {
        container.innerHTML = `<img src="${src || 'assets/images/slider/laptop.png'}" style="max-height:100px;max-width:100%;object-fit:contain;">`;
    }
};

window.openHeroSlideModal = function(slideId) {
    const modalEl = document.getElementById('heroSlideModal');
    if (!modalEl) return;
    const slides = window.getHomepageSlides();
    const slide = slideId ? slides.find(s => s.id === slideId) : null;
    
    document.getElementById('slide-form-id').value = slide ? slide.id : ('slide-' + Date.now());
    const activeCheck = document.getElementById('slide-form-active');
    if (activeCheck) {
        activeCheck.checked = slide ? (slide.active !== false) : true;
        const activeLabel = document.getElementById('slide-form-active-label');
        if (activeLabel) activeLabel.textContent = activeCheck.checked ? 'ACTIVE / VISIBLE' : 'DISABLED / HIDDEN';
    }

    const mediaType = slide ? (slide.mediaType || (window.isMediaVideo(slide.image) ? 'video' : 'image')) : 'image';
    const mediaTypeSelect = document.getElementById('slide-form-media-type');
    if (mediaTypeSelect) mediaTypeSelect.value = mediaType;

    document.getElementById('slide-form-subtitle').value = slide ? (slide.subtitle || '') : '';
    document.getElementById('slide-form-title').value = slide ? (slide.title || '') : '';
    document.getElementById('slide-form-highlight').value = slide ? (slide.titleHighlight || '') : '';
    document.getElementById('slide-form-desc').value = slide ? (slide.desc || '') : '';
    document.getElementById('slide-form-btn-text').value = slide ? (slide.btnText || '') : 'SHOP NOW';
    document.getElementById('slide-form-btn-link').value = slide ? (slide.btnLink || '') : 'shop.html';
    
    const mediaUrl = slide ? (slide.image || '') : 'assets/images/slider/laptop.png';
    document.getElementById('slide-form-image-url').value = mediaUrl;
    window.updateSlideModalPreview(mediaUrl, mediaType);
    
    const fileInput = document.getElementById('slide-form-image-file');
    if (fileInput) fileInput.value = '';
    
    const modalTitle = document.getElementById('heroSlideModalLabel');
    if (modalTitle) {
        modalTitle.innerHTML = slide ? `<i class="fas fa-pen text-danger me-2"></i> Edit Hero Slide (${slide.id})` : `<i class="fas fa-plus text-danger me-2"></i> Add New Hero Slide`;
    }
    
    if (window.bootstrap && window.bootstrap.Modal) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } else {
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
        modalEl.removeAttribute('aria-hidden');
        modalEl.setAttribute('aria-modal', 'true');
        let backdrop = document.getElementById('heroSlideModalBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'heroSlideModalBackdrop';
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }
        document.body.classList.add('modal-open');
    }
};

window.closeHeroSlideModal = function() {
    const modalEl = document.getElementById('heroSlideModal');
    if (modalEl) {
        if (window.bootstrap && window.bootstrap.Modal) {
            const inst = bootstrap.Modal.getInstance(modalEl);
            if (inst) inst.hide();
        }
        modalEl.classList.remove('show');
        modalEl.style.display = 'none';
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.removeAttribute('aria-modal');
        const backdrop = document.getElementById('heroSlideModalBackdrop');
        if (backdrop) backdrop.remove();
        document.body.classList.remove('modal-open');
    }
};

window.handleSlideFileUpload = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const isVid = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov)$/i);
        if (file.size > 5 * 1024 * 1024) {
            alert('Note: This media file is ' + (file.size / 1024 / 1024).toFixed(1) + 'MB. Browser localStorage has a limit. For larger videos, please enter a relative path (e.g. assets/videos/hero.mp4) or hosted URL in the path field.');
        }
        const mediaTypeSelect = document.getElementById('slide-form-media-type');
        if (mediaTypeSelect) mediaTypeSelect.value = isVid ? 'video' : 'image';

        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            document.getElementById('slide-form-image-url').value = dataUrl;
            window.updateSlideModalPreview(dataUrl, isVid ? 'video' : 'image');
        };
        reader.readAsDataURL(file);
    }
};

window.saveHeroSlideForm = function(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('slide-form-id').value;
    const active = document.getElementById('slide-form-active').checked;
    const subtitle = document.getElementById('slide-form-subtitle').value.trim();
    const title = document.getElementById('slide-form-title').value.trim();
    const titleHighlight = document.getElementById('slide-form-highlight').value.trim();
    const desc = document.getElementById('slide-form-desc').value.trim();
    const btnText = document.getElementById('slide-form-btn-text').value.trim();
    const btnLink = document.getElementById('slide-form-btn-link').value.trim();
    const image = document.getElementById('slide-form-image-url').value.trim() || 'assets/images/slider/laptop.png';
    const mediaType = document.getElementById('slide-form-media-type')?.value || (window.isMediaVideo(image) ? 'video' : 'image');
    
    if (!title) {
        alert('Please provide a title for the slide.');
        return;
    }
    
    let slides = window.getHomepageSlides();
    const existingIndex = slides.findIndex(s => s.id === id);
    const slideData = { id, active, subtitle, title, titleHighlight, desc, btnText, btnLink, image, mediaType };
    
    if (existingIndex >= 0) {
        slides[existingIndex] = slideData;
    } else {
        slides.push(slideData);
    }
    
    try {
        window.saveHomepageSlides(slides);
        window.renderHeroSlidesManager();
        window.closeHeroSlideModal();
        
        if (window.GUG_DB && window.GUG_DB.showToast) {
            window.GUG_DB.showToast('Hero slide saved and updated live!', 'success', 'Slide Updated');
        } else {
            alert('Hero slide saved!');
        }
    } catch(err) {
        if (err.name === 'QuotaExceededError') {
            alert('Storage limit reached for local media upload. Please use a file path (e.g. assets/videos/hero.mp4) or hosted URL rather than raw embedded file.');
        } else {
            alert('Error saving slide: ' + err.message);
        }
    }
};

window.deleteHeroSlide = function(slideId) {
    if (!confirm('Are you sure you want to delete this hero slide?')) return;
    let slides = window.getHomepageSlides();
    slides = slides.filter(s => s.id !== slideId);
    window.saveHomepageSlides(slides);
    window.renderHeroSlidesManager();
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast('Hero slide deleted.', 'info', 'Slide Removed');
    }
};

window.resetHeroSlides = function() {
    if (!confirm('Reset all homepage slides to the factory default 6 slides?')) return;
    localStorage.removeItem('gug_homepage_slides');
    window.saveHomepageSlides(JSON.parse(JSON.stringify(DEFAULT_HERO_SLIDES)));
    window.renderHeroSlidesManager();
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast('Homepage hero slides restored to default hardware catalog.', 'success', 'Reset Complete');
    }
};

// --- Homepage Banners Manager ---
window.updateBannerCardPreview = function(prefix, src, type) {
    const isVid = (type === 'video') || window.isMediaVideo(src);
    const box = document.getElementById(`${prefix}-preview-box`);
    if (!box) return;
    if (isVid) {
        box.innerHTML = `<video src="${src || ''}" autoplay muted loop playsinline class="img-fluid rounded" style="max-height:85px;width:100%;object-fit:cover;"></video>`;
    } else {
        box.innerHTML = `<img src="${src || ''}" class="img-fluid rounded" style="max-height:85px;object-fit:cover;">`;
    }
};

window.renderHomepageBannersManager = function() {
    const banners = window.getHomepageBanners();

    // Master toggles
    const catMasterToggle = document.getElementById('master-category-banners-toggle');
    const catMasterLabel = document.getElementById('master-category-banners-label');
    if (catMasterToggle) {
        catMasterToggle.checked = banners.enabled !== false;
        if (catMasterLabel) {
            catMasterLabel.textContent = catMasterToggle.checked ? 'ON' : 'OFF';
            catMasterLabel.className = catMasterToggle.checked ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
        }
    }

    const promoMasterToggle = document.getElementById('master-promo-cards-toggle');
    const promoMasterLabel = document.getElementById('master-promo-cards-label');
    if (promoMasterToggle) {
        promoMasterToggle.checked = banners.promoCardsEnabled !== false;
        if (promoMasterLabel) {
            promoMasterLabel.textContent = promoMasterToggle.checked ? 'ON' : 'OFF';
            promoMasterLabel.className = promoMasterToggle.checked ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
        }
    }
    
    const populateField = (prefix, data) => {
        if (!data) return;
        const activeInput = document.getElementById(`${prefix}-active`);
        const imgInput = document.getElementById(`${prefix}-img-url`);
        const linkInput = document.getElementById(`${prefix}-link`);
        const typeSelect = document.getElementById(`${prefix}-media-type`);
        
        const mediaType = data.mediaType || (window.isMediaVideo(data.image) ? 'video' : 'image');
        if (activeInput) activeInput.checked = data.active !== false;
        if (imgInput) imgInput.value = data.image || '';
        if (linkInput) linkInput.value = data.link || '';
        if (typeSelect) typeSelect.value = mediaType;
        window.updateBannerCardPreview(prefix, data.image || '', mediaType);
    };
    
    populateField('bm-monitors', banners.bannerMonitors);
    populateField('bm-laptops', banners.bannerLaptops);
    populateField('bm-processors', banners.bannerProcessors);
    populateField('bm-promo1', banners.promo1);
    populateField('bm-promo2', banners.promo2);
    populateField('bm-promo3', banners.promo3);
    populateField('bm-promo4', banners.promo4);

    // Render custom banners if any
    const customBannersContainer = document.getElementById('custom-category-banners-container');
    if (customBannersContainer) {
        const customBanners = banners.customBanners || [];
        if (customBanners.length === 0) {
            customBannersContainer.innerHTML = '';
        } else {
            customBannersContainer.innerHTML = customBanners.map((cb, idx) => {
                const isVid = cb.mediaType === 'video' || window.isMediaVideo(cb.image);
                return `
                <div class="col-lg-4 mb-3">
                    <div class="card h-100 border p-3 shadow-sm position-relative">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-success">${cb.title || 'Custom Strip'}</span>
                            <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteCustomBanner(${idx})" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                        <div class="bg-dark rounded p-2 text-center mb-2" style="min-height: 85px; display:flex; align-items:center; justify-content:center;">
                            ${isVid ? `<video src="${cb.image}" autoplay muted loop playsinline class="img-fluid rounded" style="max-height:85px;width:100%;object-fit:cover;"></video>` : `<img src="${cb.image}" class="img-fluid rounded" style="max-height:85px;object-fit:cover;">`}
                        </div>
                        <p class="small text-truncate m-0 text-muted"><strong>Link:</strong> ${cb.link || '#'}</p>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // Render custom promos if any
    const customPromosContainer = document.getElementById('custom-promo-cards-container');
    if (customPromosContainer) {
        const customPromos = banners.customPromos || [];
        if (customPromos.length === 0) {
            customPromosContainer.innerHTML = '';
        } else {
            customPromosContainer.innerHTML = customPromos.map((cp, idx) => {
                const isVid = cp.mediaType === 'video' || window.isMediaVideo(cp.image);
                return `
                <div class="col-md-6 col-lg-3 mb-3">
                    <div class="card h-100 border p-3 shadow-sm position-relative">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-warning text-dark">${cp.title || 'Custom Promo'}</span>
                            <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteCustomPromo(${idx})" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                        <div class="bg-dark rounded p-2 text-center mb-2" style="min-height: 85px; display:flex; align-items:center; justify-content:center;">
                            ${isVid ? `<video src="${cp.image}" autoplay muted loop playsinline class="img-fluid rounded" style="max-height:85px;width:100%;object-fit:cover;"></video>` : `<img src="${cp.image}" class="img-fluid rounded" style="max-height:85px;object-fit:cover;">`}
                        </div>
                        <p class="small text-truncate m-0 text-muted"><strong>Link:</strong> ${cp.link || '#'}</p>
                    </div>
                </div>`;
            }).join('');
        }
    }
};

window.handleBannerFileUpload = function(input, previewBoxId, urlInputId, typeSelectId) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const isVid = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov)$/i);
        if (file.size > 5 * 1024 * 1024) {
            alert('Note: This media file is ' + (file.size / 1024 / 1024).toFixed(1) + 'MB. You can also specify a relative path (e.g. assets/videos/banner.mp4) or hosted URL in the path field.');
        }
        if (typeSelectId) {
            const selectEl = document.getElementById(typeSelectId);
            if (selectEl) selectEl.value = isVid ? 'video' : 'image';
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            const urlInput = document.getElementById(urlInputId);
            if (urlInput) urlInput.value = dataUrl;
            
            const prefix = urlInputId.replace('-img-url', '');
            window.updateBannerCardPreview(prefix, dataUrl, isVid ? 'video' : 'image');
        };
        reader.readAsDataURL(file);
    }
};

window.saveAllHomepageBanners = function() {
    const existing = window.getHomepageBanners();
    const banners = {
        enabled: document.getElementById('master-category-banners-toggle')?.checked ?? true,
        promoCardsEnabled: document.getElementById('master-promo-cards-toggle')?.checked ?? true,
        customBanners: existing.customBanners || [],
        customPromos: existing.customPromos || [],
        bannerMonitors: {
            active: document.getElementById('bm-monitors-active')?.checked ?? true,
            mediaType: document.getElementById('bm-monitors-media-type')?.value || 'image',
            image: document.getElementById('bm-monitors-img-url').value.trim() || 'assets/images/banner1.png',
            link: document.getElementById('bm-monitors-link').value.trim() || 'shop.html?category=monitors',
            title: 'Featured Monitors Banner'
        },
        bannerLaptops: {
            active: document.getElementById('bm-laptops-active')?.checked ?? true,
            mediaType: document.getElementById('bm-laptops-media-type')?.value || 'image',
            image: document.getElementById('bm-laptops-img-url').value.trim() || 'assets/images/laptops-banner.png',
            link: document.getElementById('bm-laptops-link').value.trim() || 'shop.html?category=laptops',
            title: 'Featured Laptops Banner'
        },
        bannerProcessors: {
            active: document.getElementById('bm-processors-active')?.checked ?? true,
            mediaType: document.getElementById('bm-processors-media-type')?.value || 'image',
            image: document.getElementById('bm-processors-img-url').value.trim() || 'assets/images/components-banner.png',
            link: document.getElementById('bm-processors-link').value.trim() || 'shop.html?category=processors',
            title: 'PC Components Banner'
        },
        promo1: {
            active: document.getElementById('bm-promo1-active')?.checked ?? true,
            mediaType: document.getElementById('bm-promo1-media-type')?.value || 'image',
            image: document.getElementById('bm-promo1-img-url').value.trim() || 'assets/images/promo-laptops.jpg',
            link: document.getElementById('bm-promo1-link').value.trim() || 'shop.html?category=laptops',
            title: 'Built to Dominate (Laptops)'
        },
        promo2: {
            active: document.getElementById('bm-promo2-active')?.checked ?? true,
            mediaType: document.getElementById('bm-promo2-media-type')?.value || 'image',
            image: document.getElementById('bm-promo2-img-url').value.trim() || 'assets/images/promo-cases.png',
            link: document.getElementById('bm-promo2-link').value.trim() || 'shop.html?category=components',
            title: 'Show Off Your Rig (PC Cases)'
        },
        promo3: {
            active: document.getElementById('bm-promo3-active')?.checked ?? true,
            mediaType: document.getElementById('bm-promo3-media-type')?.value || 'image',
            image: document.getElementById('bm-promo3-img-url').value.trim() || 'assets/images/promo-peripherals.png',
            link: document.getElementById('bm-promo3-link').value.trim() || 'shop.html?category=accessories',
            title: 'Precision At Your Fingertips'
        },
        promo4: {
            active: document.getElementById('bm-promo4-active')?.checked ?? true,
            mediaType: document.getElementById('bm-promo4-media-type')?.value || 'image',
            image: document.getElementById('bm-promo4-img-url').value.trim() || 'assets/images/promo-apple.png',
            link: document.getElementById('bm-promo4-link').value.trim() || 'shop.html?brand=apple',
            title: 'Pure Performance Iconic Design'
        }
    };
    
    try {
        window.saveHomepageBanners(banners);
        if (window.GUG_DB && window.GUG_DB.showToast) {
            window.GUG_DB.showToast('All homepage strip and promo banners saved successfully!', 'success', 'Banners Updated');
        } else {
            alert('Homepage banners saved successfully!');
        }
    } catch(err) {
        if (err.name === 'QuotaExceededError') {
            alert('Storage limit reached for local media upload. Please use file paths or hosted URLs rather than large raw embedded files.');
        } else {
            alert('Error saving banners: ' + err.message);
        }
    }
};

window.addNewCategoryBanner = function() {
    const title = prompt('Enter a title for the new Category Banner Strip:', 'Special Collection Banner');
    if (!title) return;
    const link = prompt('Enter the shop link URL for this banner:', 'shop.html');
    const image = prompt('Enter the image or video path/URL (e.g. assets/images/banner.png or assets/videos/banner.mp4):', 'assets/images/banner1.png');
    if (!image) return;

    const banners = window.getHomepageBanners();
    banners.customBanners = banners.customBanners || [];
    banners.customBanners.push({
        id: 'cb-' + Date.now(),
        title: title,
        link: link || 'shop.html',
        image: image,
        mediaType: window.isMediaVideo(image) ? 'video' : 'image',
        active: true
    });
    window.saveHomepageBanners(banners);
    window.renderHomepageBannersManager();
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast('New Category Strip Banner added on the fly!', 'success', 'Banner Added');
    }
};

window.deleteCustomBanner = function(index) {
    if (!confirm('Are you sure you want to delete this custom strip banner?')) return;
    const banners = window.getHomepageBanners();
    if (banners.customBanners && banners.customBanners[index]) {
        banners.customBanners.splice(index, 1);
        window.saveHomepageBanners(banners);
        window.renderHomepageBannersManager();
    }
};

window.addNewPromoCard = function() {
    const title = prompt('Enter a title for the new Promotional Card:', 'Seasonal Deal');
    if (!title) return;
    const link = prompt('Enter the shop link URL for this promo card:', 'shop.html');
    const image = prompt('Enter the image or video path/URL (e.g. assets/images/promo.png or assets/videos/promo.mp4):', 'assets/images/promo-laptops.jpg');
    if (!image) return;

    const banners = window.getHomepageBanners();
    banners.customPromos = banners.customPromos || [];
    banners.customPromos.push({
        id: 'cp-' + Date.now(),
        title: title,
        link: link || 'shop.html',
        image: image,
        mediaType: window.isMediaVideo(image) ? 'video' : 'image',
        active: true
    });
    window.saveHomepageBanners(banners);
    window.renderHomepageBannersManager();
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast('New Promotional Box added on the fly!', 'success', 'Promo Added');
    }
};

window.deleteCustomPromo = function(index) {
    if (!confirm('Are you sure you want to delete this custom promo box?')) return;
    const banners = window.getHomepageBanners();
    if (banners.customPromos && banners.customPromos[index]) {
        banners.customPromos.splice(index, 1);
        window.saveHomepageBanners(banners);
        window.renderHomepageBannersManager();
    }
};

window.resetHomepageBanners = function() {
    if (!confirm('Reset all homepage banners to factory hardware defaults?')) return;
    localStorage.removeItem('gug_homepage_banners');
    window.saveHomepageBanners(JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_BANNERS)));
    window.renderHomepageBannersManager();
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast('Homepage banners reset to default hardware graphics.', 'info', 'Banners Reset');
    }
};

// --- Persistent IndexedDB Media Storage for Unlimited Videos & Large Images ---
const GUG_MEDIA_DB = {
    dbName: 'GearUpGadgets_MediaDB',
    storeName: 'sales_banners',
    version: 1,
    _db: null,

    async open() {
        if (this._db) return this._db;
        return new Promise((resolve) => {
            if (typeof indexedDB === 'undefined') {
                return resolve(null);
            }
            try {
                const request = indexedDB.open(this.dbName, this.version);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'id' });
                    }
                };
                request.onsuccess = (e) => {
                    this._db = e.target.result;
                    resolve(this._db);
                };
                request.onerror = (e) => {
                    console.warn('IndexedDB unavailable or blocked, falling back to LocalStorage:', e);
                    resolve(null);
                };
            } catch (err) {
                console.warn('IndexedDB open error:', err);
                resolve(null);
            }
        });
    },

    async saveBanners(banners) {
        try {
            const db = await this.open();
            if (!db) return false;
            return new Promise((resolve) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                store.put({ id: 'primary_sales_banners', data: banners, updatedAt: Date.now() });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            console.warn('IndexedDB saveBanners failed:', e);
            return false;
        }
    },

    async getBanners() {
        try {
            const db = await this.open();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const req = store.get('primary_sales_banners');
                req.onsuccess = () => {
                    if (req.result && Array.isArray(req.result.data)) {
                        resolve(req.result.data);
                    } else {
                        resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }
};
window.GUG_MEDIA_DB = GUG_MEDIA_DB;

// Comprehensive Media Type Checker (Supports Objects, File Extensions, and Data URIs)
function checkIsVideo(mediaItem, explicitType) {
    if (explicitType === 'video') return true;
    if (explicitType === 'image') return false;
    if (!mediaItem) return false;
    if (typeof mediaItem === 'object') {
        if (mediaItem.type === 'video' || mediaItem.mediaType === 'video') return true;
        if (mediaItem.type === 'image' || mediaItem.mediaType === 'image') return false;
    }
    const src = typeof mediaItem === 'string' ? mediaItem : (mediaItem.url || mediaItem.src || mediaItem.image || '');
    if (!src) return false;
    const str = String(src).trim().toLowerCase();
    if (str.startsWith('data:video/')) return true;
    const clean = str.split('?')[0].split('#')[0];
    return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.mov') || 
           clean.endsWith('.ogg') || clean.endsWith('.mkv') || clean.endsWith('.m4v') || clean.endsWith('.avi');
}
window.checkIsVideo = checkIsVideo;

// --- Sales Top Banners Manager ---
window.toggleSalesBanners = function(enabled) {
    localStorage.setItem('gug_sales_banners_enabled', enabled);
    const label = document.getElementById('master-sales-banners-label');
    if (label) {
        label.textContent = enabled ? 'ON' : 'OFF';
        label.className = enabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
    }
    window.dispatchEvent(new Event('storage'));
    if (window.GUG_DB && window.GUG_DB.showToast) {
        window.GUG_DB.showToast(`Sales Page Hero Banners are now ${enabled ? 'ENABLED' : 'HIDDEN'}.`, enabled ? 'success' : 'info', 'Sales Banners');
    }
};

// --- Sales Top Banners Manager State & Operations ---
window.stagedSalesBanners = null;
window.hasUnsavedBannerChanges = false;

window.getSalesBanners = function() {
    if (window.stagedSalesBanners === null) {
        let loaded = [];
        try {
            const raw = localStorage.getItem('gug_sales_banners');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) loaded = parsed;
                else if (typeof parsed === 'string' && parsed.trim()) loaded = [parsed.trim()];
            }
        } catch (e) {
            loaded = [];
        }

        if (loaded.length === 0) {
            try {
                const single = localStorage.getItem('gug_sales_hero_banner') || localStorage.getItem('gug_sales_banner');
                if (single && single.trim()) loaded = [single.trim()];
            } catch(e) {}
        }

        window.stagedSalesBanners = loaded.map((b, idx) => {
            if (typeof b === 'string') {
                return {
                    id: 'banner_' + (idx + 1) + '_' + Date.now(),
                    url: b,
                    type: checkIsVideo(b) ? 'video' : 'image',
                    name: b.split('/').pop().split('?')[0] || `Banner #${idx + 1}`,
                    createdAt: new Date().toISOString()
                };
            }
            return b;
        });

        // Asynchronously check IndexedDB for large media/videos that might not fit in LocalStorage
        if (window.GUG_MEDIA_DB) {
            window.GUG_MEDIA_DB.getBanners().then((idbBanners) => {
                if (Array.isArray(idbBanners) && idbBanners.length > 0) {
                    const hasIdbReferences = window.stagedSalesBanners.some(b => b && (b.isIndexedDB || !b.url));
                    if (window.stagedSalesBanners.length === 0 || hasIdbReferences) {
                        window.stagedSalesBanners = idbBanners;
                        window.renderSalesBanners();
                    }
                }
            });
        }
    }
    return window.stagedSalesBanners;
};

// Canvas-based image optimizer to prevent browser localStorage QuotaExceededError
function compressBannerImageIfNeeded(file, callback) {
    if (!file) return;
    const isImage = (file.type && file.type.startsWith('image/')) || 
                    /\.(jpg|jpeg|png|webp|avif|bmp)$/i.test(file.name);
    
    if (isImage && !file.type.includes('svg') && !file.name.endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const maxWidth = 1920;
                const maxHeight = 800;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width / maxWidth > height / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', 0.8);
                callback(compressed, 'image');
            };
            img.onerror = function() {
                callback(e.target.result, 'image');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        const reader = new FileReader();
        reader.onload = function(e) {
            const isVid = (file.type && file.type.startsWith('video/')) || 
                          /\.(mp4|webm|mov|ogg|mkv|m4v|avi)$/i.test(file.name);
            callback(e.target.result, isVid ? 'video' : 'image');
        };
        reader.readAsDataURL(file);
    }
}
window.compressBannerImageIfNeeded = compressBannerImageIfNeeded;

// Robust commit function supporting IndexedDB (unlimited size) + LocalStorage with quota protection
window.commitSalesBanners = async function(banners, successMessage) {
    try {
        if (!Array.isArray(banners)) banners = [];

        // 1. Persist full banners (unlimited images & videos) to IndexedDB
        if (window.GUG_MEDIA_DB) {
            await window.GUG_MEDIA_DB.saveBanners(banners);
        }

        // 2. Persist to LocalStorage with automatic quota protection
        try {
            localStorage.setItem('gug_sales_banners', JSON.stringify(banners));
        } catch (quotaErr) {
            console.warn('LocalStorage quota limit reached, saving optimized references:', quotaErr);
            // Compact banners for localStorage by stripping oversized inline base64
            const compactBanners = banners.map(b => {
                if (typeof b === 'string') {
                    return b.length > 200000 ? { id: 'b_' + Date.now(), isIndexedDB: true, type: checkIsVideo(b) ? 'video' : 'image' } : b;
                }
                if (b && typeof b === 'object') {
                    const copy = Object.assign({}, b);
                    if (copy.url && copy.url.startsWith('data:') && copy.url.length > 200000) {
                        copy.isIndexedDB = true;
                        delete copy.url;
                    }
                    return copy;
                }
                return b;
            });
            try {
                localStorage.setItem('gug_sales_banners', JSON.stringify(compactBanners));
            } catch (e2) {
                console.warn('LocalStorage fallback save failed:', e2);
            }
        }

        localStorage.setItem('gug_sales_banners_enabled', 'true');
        
        // 3. Update toggle switch in UI
        const salesBannersToggle = document.getElementById('master-sales-banners-toggle');
        const salesBannersLabel = document.getElementById('master-sales-banners-label');
        if (salesBannersToggle) salesBannersToggle.checked = true;
        if (salesBannersLabel) {
            salesBannersLabel.textContent = 'ON';
            salesBannersLabel.className = 'form-check-label small ms-1 text-success fw-bold';
        }

        window.stagedSalesBanners = banners;
        window.hasUnsavedBannerChanges = false;
        window.renderSalesBanners();
        
        // 4. Broadcast events to immediately update storefront and open tabs
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('gugSalesBannersSaved', { detail: { banners } }));
        
        if (window.GUG_DB && window.GUG_DB.showToast) {
            window.GUG_DB.showToast(successMessage || `Saved ${banners.length} promotional banner(s)! Live storefront updated.`, 'success', 'Banners Saved');
        }
    } catch (err) {
        console.error('Failed to commit sales banners:', err);
    }
};

// Instant Pre-Upload Preview Engine
window.previewSelectedBannerFile = function(input) {
    const previewBox = document.getElementById('banner-instant-preview-box');
    const previewMedia = document.getElementById('banner-instant-preview-media');
    if (!previewBox || !previewMedia) return;

    const file = input && input.files ? input.files[0] : null;
    if (!file) {
        previewBox.style.display = 'none';
        previewMedia.innerHTML = '';
        return;
    }

    const isVid = (file.type && file.type.startsWith('video/')) || 
                  /\.(mp4|webm|mov|ogg|mkv|m4v|avi)$/i.test(file.name);

    const reader = new FileReader();
    reader.onload = function(e) {
        previewBox.style.display = 'block';
        if (isVid) {
            previewMedia.innerHTML = `<video src="${e.target.result}" autoplay muted loop playsinline style="max-height: 180px; max-width: 100%; object-fit: contain;"></video>`;
        } else {
            previewMedia.innerHTML = `<img src="${e.target.result}" style="max-height: 180px; max-width: 100%; object-fit: contain;" alt="Selected Banner Preview">`;
        }
    };
    reader.readAsDataURL(file);
};

window.previewEnteredBannerUrl = function(url) {
    const previewBox = document.getElementById('banner-instant-preview-box');
    const previewMedia = document.getElementById('banner-instant-preview-media');
    if (!previewBox || !previewMedia) return;

    const clean = (url || '').trim();
    if (!clean) {
        const fileInput = document.getElementById('banner-upload-input');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            previewBox.style.display = 'none';
            previewMedia.innerHTML = '';
        }
        return;
    }

    const isVid = checkIsVideo(clean);
    previewBox.style.display = 'block';
    if (isVid) {
        previewMedia.innerHTML = `<video src="${clean}" autoplay muted loop playsinline style="max-height: 180px; max-width: 100%; object-fit: contain;"></video>`;
    } else {
        previewMedia.innerHTML = `<img src="${clean}" style="max-height: 180px; max-width: 100%; object-fit: contain;" alt="URL Banner Preview" onerror="this.src='assets/images/logo.png'">`;
    }
};

window.clearBannerInputs = function() {
    const fileInput = document.getElementById('banner-upload-input');
    const urlInput = document.getElementById('banner-upload-url');
    const previewBox = document.getElementById('banner-instant-preview-box');
    const previewMedia = document.getElementById('banner-instant-preview-media');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    if (previewBox) previewBox.style.display = 'none';
    if (previewMedia) previewMedia.innerHTML = '';
};

window.renderSalesBanners = function() {
    const container = document.getElementById('banner-list-container');
    const badge = document.getElementById('banner-count-badge');
    const status = document.getElementById('banner-save-status');
    const saveBtn = document.getElementById('save-sales-banners-btn');
    if (!container) return;
    
    const banners = window.getSalesBanners();

    if (badge) {
        badge.textContent = `${banners.length} Active Banner${banners.length === 1 ? '' : 's'}`;
        badge.className = banners.length > 0 ? 'badge bg-success px-2 py-1 fw-bold' : 'badge bg-secondary px-2 py-1 fw-bold';
    }
    if (status) {
        if (window.hasUnsavedBannerChanges) {
            status.innerHTML = `<span class="text-warning fw-bold"><i class="fas fa-exclamation-circle me-1"></i> Unsaved changes pending — Click "Save Banners" to publish</span>`;
            if (saveBtn) {
                saveBtn.classList.remove('btn-secondary');
                saveBtn.classList.add('btn-success');
                saveBtn.innerHTML = `<i class="fas fa-save me-2"></i> Save Banners`;
            }
        } else {
            status.innerHTML = `<span class="text-success small fw-bold"><i class="fas fa-check-circle me-1"></i> All changes saved & live on storefront</span>`;
            if (saveBtn) {
                saveBtn.classList.remove('btn-secondary');
                saveBtn.classList.add('btn-success');
                saveBtn.innerHTML = `<i class="fas fa-save me-2"></i> Save Banners`;
            }
        }
    }

    if (banners.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="text-center py-4 p-3 rounded" style="background: rgba(13, 17, 23, 0.5); border: 1px dashed rgba(255,255,255,0.15);">
                    <i class="fas fa-images text-secondary mb-2" style="font-size: 28px;"></i>
                    <h6 class="text-white fw-bold mb-1">No Active Hero Banners</h6>
                    <p class="text-secondary small mb-0">Select an image/video file or enter a media URL above and click <strong>Add Media Banner</strong> or <strong>Save Banners</strong> to publish visual banners to the Sales Page.</p>
                </div>
            </div>`;
        return;
    }

    const cardsHtml = banners.map((banner, index) => {
        const src = typeof banner === 'string' ? banner : (banner?.url || banner?.src || banner?.image || '');
        const isVid = checkIsVideo(banner);
        const name = (typeof banner === 'object' && banner.name) ? banner.name : `Banner #${index + 1}`;
        
        return `
        <div class="col-md-4 col-sm-6">
            <div class="card bg-dark border-secondary overflow-hidden position-relative shadow-sm h-100" style="border-radius: 10px; border: 1px solid rgba(255,255,255,0.15);">
                <div class="position-relative" style="height: 140px; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    ${isVid ? 
                        `<video src="${src}" autoplay muted loop playsinline class="w-100 h-100" style="object-fit: cover;"></video>
                         <span class="badge bg-warning text-dark position-absolute bottom-0 start-0 m-2" style="font-size:10px; font-weight:700;"><i class="fas fa-video me-1"></i> Video</span>` : 
                        `<img src="${src}" class="w-100 h-100" style="object-fit: cover;" alt="${name}" onerror="this.src='assets/images/logo.png'">
                         <span class="badge bg-info text-dark position-absolute bottom-0 start-0 m-2" style="font-size:10px; font-weight:700;"><i class="fas fa-image me-1"></i> Image</span>`
                    }
                    <div class="position-absolute top-0 start-0 m-2">
                        <span class="badge bg-danger text-white shadow-sm" style="font-size:10px; font-weight:bold;">#${index + 1} ${index === 0 ? 'Primary' : 'Slide'}</span>
                    </div>
                    <div class="position-absolute top-0 end-0 m-2">
                        <button class="btn btn-danger btn-sm shadow" onclick="deleteSalesBanner(${index})" title="Remove Banner">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="p-2 px-3 bg-dark d-flex justify-content-between align-items-center border-top border-secondary border-opacity-25">
                    <div class="text-truncate me-2" style="max-width: 65%;">
                        <small class="text-white fw-bold d-block text-truncate" title="${name}">${name}</small>
                        <span class="badge bg-success-subtle text-success p-0" style="font-size: 9px;"><i class="fas fa-check-circle me-1"></i>Active Live</span>
                    </div>
                    <a href="sales.html" target="_blank" class="btn btn-outline-light btn-sm py-0 px-2" style="font-size: 11px;" title="View Live on Sales Page">
                        <i class="fas fa-eye"></i> View
                    </a>
                </div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="col-12 mb-2">
            <div class="alert alert-success d-flex align-items-center justify-content-between p-3 rounded-3 shadow-sm border-0 m-0" style="background: rgba(40, 167, 69, 0.15); border-left: 4px solid #28a745 !important;">
                <div class="d-flex align-items-center gap-2">
                    <i class="fas fa-check-circle text-success fs-5"></i>
                    <div>
                        <strong class="text-white d-block" style="font-size: 13px;">${banners.length} Banner(s) Currently Active &amp; Applied</strong>
                        <span class="text-secondary" style="font-size: 11px;">These visual media items are live and displayed at the header of the storefront Sales Page.</span>
                    </div>
                </div>
                <a href="sales.html" target="_blank" class="btn btn-sm btn-success fw-bold px-3">
                    <i class="fas fa-external-link-alt me-1"></i> Live Preview
                </a>
            </div>
        </div>
        ${cardsHtml}
    `;
};

window.uploadSalesBanner = function(onComplete) {
    const fileInput = document.getElementById('banner-upload-input');
    const urlInput = document.getElementById('banner-upload-url');
    const file = fileInput ? fileInput.files[0] : null;
    const directUrl = urlInput ? urlInput.value.trim() : '';

    if (!file && !directUrl) {
        if (window.GUG_DB && window.GUG_DB.showToast) {
            window.GUG_DB.showToast('Please select an image/video file or enter a media URL.', 'warning', 'No Media Selected');
        } else {
            alert('Please select an image/video file or enter a media URL.');
        }
        if (typeof onComplete === 'function') onComplete(false);
        return;
    }

    const banners = window.getSalesBanners();

    const finishUpload = async (newBannerItem, successMsg) => {
        banners.push(newBannerItem);
        window.clearBannerInputs();
        await window.commitSalesBanners(banners, successMsg);
        if (typeof onComplete === 'function') onComplete(true);
    };

    if (directUrl) {
        const isVid = checkIsVideo(directUrl);
        const bannerItem = {
            id: 'banner_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            url: directUrl,
            type: isVid ? 'video' : 'image',
            name: directUrl.split('/').pop().split('?')[0] || 'Media Banner',
            createdAt: new Date().toISOString()
        };
        finishUpload(bannerItem, 'Media banner added & saved permanently! Live storefront updated.');
        return;
    }

    if (file) {
        const isVid = (file.type && file.type.startsWith('video/')) || 
                      /\.(mp4|webm|mov|ogg|mkv|m4v|avi)$/i.test(file.name);

        if (isVid) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const bannerItem = {
                    id: 'banner_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    url: e.target.result,
                    type: 'video',
                    name: file.name,
                    size: file.size,
                    createdAt: new Date().toISOString()
                };
                finishUpload(bannerItem, `Video "${file.name}" uploaded & saved permanently! Live storefront updated.`);
            };
            reader.readAsDataURL(file);
        } else {
            compressBannerImageIfNeeded(file, (compressedData) => {
                const bannerItem = {
                    id: 'banner_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    url: compressedData,
                    type: 'image',
                    name: file.name,
                    size: file.size,
                    createdAt: new Date().toISOString()
                };
                finishUpload(bannerItem, `Image "${file.name}" uploaded & saved permanently! Live storefront updated.`);
            });
        }
    }
};

window.deleteSalesBanner = function(index) {
    const banners = window.getSalesBanners();
    if (index >= 0 && index < banners.length) {
        const removed = banners.splice(index, 1);
        const name = (removed && removed[0] && removed[0].name) ? removed[0].name : 'Banner';
        return window.commitSalesBanners(banners, `Removed "${name}". Storefront sales page updated.`);
    }
};

window.saveSalesBanners = async function() {
    const fileInput = document.getElementById('banner-upload-input');
    const urlInput = document.getElementById('banner-upload-url');
    const file = fileInput ? fileInput.files[0] : null;
    const directUrl = urlInput ? urlInput.value.trim() : '';

    if (file || directUrl) {
        return new Promise((resolve) => {
            window.uploadSalesBanner(resolve);
        });
    }

    const banners = window.getSalesBanners();
    return window.commitSalesBanners(banners, `Successfully saved all ${banners.length} promotional banner(s)! Live storefront updated.`);
};

// Initial render hook for admin-sales.html
document.addEventListener('DOMContentLoaded', () => {
    if(window.location.pathname.includes('admin-sales.html')) {
        // Bind color pickers
        bindColorSync('theme-bg-main', 'theme-bg-main-hex', 'theme-bg-main-swatch');
        bindColorSync('theme-bg-card', 'theme-bg-card-hex', 'theme-bg-card-swatch');
        bindColorSync('theme-navbar', 'theme-navbar-hex', 'theme-navbar-swatch');
        bindColorSync('theme-topbar', 'theme-topbar-hex', 'theme-topbar-swatch');
        bindColorSync('theme-navbar-text', 'theme-navbar-text-hex', 'theme-navbar-text-swatch');
        bindColorSync('theme-footer', 'theme-footer-hex', 'theme-footer-swatch');
        bindColorSync('theme-footer-text', 'theme-footer-text-hex', 'theme-footer-text-swatch');
        bindColorSync('theme-accent-color', 'theme-accent-color-hex', 'theme-accent-color-swatch');
        bindColorSync('theme-card-border', 'theme-card-border-hex', 'theme-card-border-swatch');

        // Restore saved theme configuration
        const savedConfig = JSON.parse(localStorage.getItem('gug_event_theme_config') || '{}');
        const cfg = Object.assign({}, DEFAULT_THEME, savedConfig);

        const restoreColor = (pickerId, hexId, swatchId, value) => {
            if (!value) return;
            const p = document.getElementById(pickerId);
            const h = document.getElementById(hexId);
            const s = document.getElementById(swatchId);
            if (p) p.value = value;
            if (h) h.value = value;
            if (s) s.style.background = value;
        };

        restoreColor('theme-bg-main', 'theme-bg-main-hex', 'theme-bg-main-swatch', cfg.bgMain);
        restoreColor('theme-bg-card', 'theme-bg-card-hex', 'theme-bg-card-swatch', cfg.bgCard);
        restoreColor('theme-navbar', 'theme-navbar-hex', 'theme-navbar-swatch', cfg.navbar);
        restoreColor('theme-topbar', 'theme-topbar-hex', 'theme-topbar-swatch', cfg.topbarBg);
        restoreColor('theme-navbar-text', 'theme-navbar-text-hex', 'theme-navbar-text-swatch', cfg.navbarTextColor);
        restoreColor('theme-footer', 'theme-footer-hex', 'theme-footer-swatch', cfg.footer);
        restoreColor('theme-footer-text', 'theme-footer-text-hex', 'theme-footer-text-swatch', cfg.footerTextColor);
        restoreColor('theme-accent-color', 'theme-accent-color-hex', 'theme-accent-color-swatch', cfg.accentRed);
        restoreColor('theme-card-border', 'theme-card-border-hex', 'theme-card-border-swatch', cfg.cardBorderColor);

        const stickyEl = document.getElementById('theme-sticky-navbar');
        if (stickyEl) stickyEl.checked = cfg.stickyNavbar !== false;

        // Restore Pre-Footer Top Bar
        const topbarShowEl = document.getElementById('theme-footer-topbar-toggle');
        if (topbarShowEl) topbarShowEl.checked = cfg.footerTopBarEnabled !== false;

        const topbarTitleEl = document.getElementById('theme-footer-topbar-title');
        if (topbarTitleEl && cfg.footerTopBarTitle) topbarTitleEl.value = cfg.footerTopBarTitle;

        const topbarSubEl = document.getElementById('theme-footer-topbar-subtitle');
        if (topbarSubEl && cfg.footerTopBarSubtitle !== undefined) topbarSubEl.value = cfg.footerTopBarSubtitle;

        const featToggleEl = document.getElementById('theme-footer-features-toggle');
        if (featToggleEl) featToggleEl.checked = cfg.footerFeaturesEnabled !== false;

        const partnersEl = document.getElementById('theme-footer-partners');
        if (partnersEl) partnersEl.checked = cfg.footerPartnersEnabled !== false;

        // Restore Contact Numbers & Dynamic Multi-Contact Lists
        if (typeof window.populateDynamicContacts === 'function') {
            window.populateDynamicContacts(cfg);
        }

        const footPhoneEl = document.getElementById('theme-footer-phone');
        if (footPhoneEl && (cfg.footerPhone || cfg.topbarPhone)) footPhoneEl.value = cfg.footerPhone || cfg.topbarPhone;

        const footPhoneLblEl = document.getElementById('theme-footer-phone-label');
        if (footPhoneLblEl && cfg.footerPhoneLabel) footPhoneLblEl.value = cfg.footerPhoneLabel;

        const footWaEl = document.getElementById('theme-footer-whatsapp');
        if (footWaEl && cfg.footerWhatsapp !== undefined) footWaEl.value = cfg.footerWhatsapp;

        const footEmailEl = document.getElementById('theme-footer-email');
        if (footEmailEl && (cfg.footerEmail || cfg.topbarEmail)) footEmailEl.value = cfg.footerEmail || cfg.topbarEmail;

        const topAddrEl = document.getElementById('theme-topbar-address');
        const footTopAddrEl = document.getElementById('theme-footer-topbar-address');
        const resolvedTopAddr = (cfg.topbarAddress && !cfg.topbarAddress.includes('Osif') && !cfg.topbarAddress.includes('FA-06') && !cfg.topbarAddress.includes('Pace')) ? cfg.topbarAddress : 'F6 Technocity Mall';
        if (topAddrEl) topAddrEl.value = resolvedTopAddr;
        if (footTopAddrEl) footTopAddrEl.value = resolvedTopAddr;

        // Restore Operating Hours & Addresses
        const footHoursEl = document.getElementById('theme-footer-hours');
        if (footHoursEl && cfg.footerStoreHours) footHoursEl.value = cfg.footerStoreHours;

        const footDaysEl = document.getElementById('theme-footer-days');
        if (footDaysEl && cfg.footerStoreDays) footDaysEl.value = cfg.footerStoreDays;

        const footShopEl = document.getElementById('theme-footer-shop-addr');
        if (footShopEl && cfg.footerShopAddress) footShopEl.value = cfg.footerShopAddress;

        const footOfficeEl = document.getElementById('theme-footer-office-addr');
        if (footOfficeEl && cfg.footerHeadOffice) footOfficeEl.value = cfg.footerHeadOffice;

        const footAboutEl = document.getElementById('theme-footer-about');
        if (footAboutEl && cfg.footerAbout) footAboutEl.value = cfg.footerAbout;

        const footCopyEl = document.getElementById('theme-footer-copyright');
        if (footCopyEl) footCopyEl.value = 'Copyright 2021 to 2026 Gear Up Gadgets All rights reserved. [POWERED BY PHOENIX TECHNOLOGY]';

        const bgAttachEl = document.getElementById('theme-bg-attachment');
        if (bgAttachEl && cfg.bgAttachment) bgAttachEl.value = cfg.bgAttachment;

        const bgOpacEl = document.getElementById('theme-bg-opacity');
        const bgOpacVal = document.getElementById('theme-bg-opacity-val');
        if (bgOpacEl && cfg.bgOpacity !== undefined) {
            bgOpacEl.value = cfg.bgOpacity;
            if (bgOpacVal) bgOpacVal.innerText = cfg.bgOpacity + '%';
        }

        const bgTypeEl = document.getElementById('theme-bg-type');
        const hasBgImage = !!(cfg.bgImage && String(cfg.bgImage).trim());
        const hasBgVideo = !!(cfg.bgVideo && String(cfg.bgVideo).trim());

        if (cfg.bgType === 'image' || (hasBgImage && cfg.bgType !== 'video' && cfg.bgType !== 'none')) {
            if (bgTypeEl) bgTypeEl.value = 'image';
            window.switchBgType('image');
        } else if (cfg.bgType === 'video' || (hasBgVideo && cfg.bgType !== 'image')) {
            if (bgTypeEl) bgTypeEl.value = 'video';
            window.switchBgType('video');
        } else {
            if (bgTypeEl) bgTypeEl.value = cfg.bgType || 'none';
            window.switchBgType(cfg.bgType || 'none');
        }

        if (hasBgImage) {
            const preview = document.getElementById('theme-bg-preview');
            const wrapper = document.getElementById('theme-bg-preview-wrapper');
            const urlInput = document.getElementById('theme-bg-image-url');
            if (preview) preview.src = cfg.bgImage;
            if (wrapper) wrapper.style.display = 'block';
            if (urlInput) urlInput.value = cfg.bgImage;
        }

        if (hasBgVideo) {
            const preview = document.getElementById('theme-bg-video-preview');
            const wrapper = document.getElementById('theme-bg-video-preview-wrapper');
            const urlInput = document.getElementById('theme-bg-video-url');
            if (preview) preview.src = cfg.bgVideo;
            if (wrapper) wrapper.style.display = 'block';
            if (urlInput) urlInput.value = cfg.bgVideo;
        }

        // Master Hero slider toggle state
        const heroSliderToggle = document.getElementById('master-hero-slider-toggle');
        const heroSliderLabel = document.getElementById('master-hero-slider-label');
        if (heroSliderToggle) {
            const isHeroEnabled = localStorage.getItem('gug_hero_slider_enabled') !== 'false';
            heroSliderToggle.checked = isHeroEnabled;
            if (heroSliderLabel) {
                heroSliderLabel.textContent = isHeroEnabled ? 'ON' : 'OFF';
                heroSliderLabel.className = isHeroEnabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
            }
        }

        // Sales event name
        const savedEventName = localStorage.getItem('gug_sales_event_name');
        const eventNameEl = document.getElementById('event-sale-name');
        if (eventNameEl && savedEventName) eventNameEl.value = savedEventName;

        // Sales banners master toggle
        const salesBannersToggle = document.getElementById('master-sales-banners-toggle');
        const salesBannersLabel = document.getElementById('master-sales-banners-label');
        if (salesBannersToggle) {
            const isSalesBannersEnabled = localStorage.getItem('gug_sales_banners_enabled') !== 'false';
            salesBannersToggle.checked = isSalesBannersEnabled;
            if (salesBannersLabel) {
                salesBannersLabel.textContent = isSalesBannersEnabled ? 'ON' : 'OFF';
                salesBannersLabel.className = isSalesBannersEnabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
            }
        }

        window.updateLiveThemePreview();
        window.renderSalesBanners();
        window.renderHeroSlidesManager();
        window.renderHomepageBannersManager();
    }

    // General sales campaign elements initializer (runs on products.html or wherever banner-list-container is present)
    const salesContainer = document.getElementById('banner-list-container');
    if (salesContainer) {
        const savedEventName = localStorage.getItem('gug_sales_event_name');
        const eventNameEl = document.getElementById('event-sale-name');
        if (eventNameEl && savedEventName) eventNameEl.value = savedEventName;

        const salesBannersToggle = document.getElementById('master-sales-banners-toggle');
        const salesBannersLabel = document.getElementById('master-sales-banners-label');
        if (salesBannersToggle) {
            const isSalesBannersEnabled = localStorage.getItem('gug_sales_banners_enabled') !== 'false';
            salesBannersToggle.checked = isSalesBannersEnabled;
            if (salesBannersLabel) {
                salesBannersLabel.textContent = isSalesBannersEnabled ? 'ON' : 'OFF';
                salesBannersLabel.className = isSalesBannersEnabled ? 'form-check-label small ms-1 text-success fw-bold' : 'form-check-label small ms-1 text-secondary';
            }
        }
        window.renderSalesBanners();
    }
});

