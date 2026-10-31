/**
 * GearUp Gadgets Enterprise ERP & Business Operating System (GUG_DB)
 * ==================================================================
 * Professional, connected, reactive data engine for e-commerce, 
 * multi-warehouse inventory, serial tracking, CRM, logistics, finance, 
 * HR, returns/RMA, marketing, approvals, global search, and granular 10-role RBAC.
 */

(function(window) {
    'use strict';

    // Immediately disable automatic browser scroll restoration to prevent scroll-up jump glitches
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // Immediately detect if loaded inside iframe / staff_view to suppress internal sidebar before first paint
    try {
        if (typeof window !== 'undefined') {
            const isInsideIframe = (window.self !== window.top) || (window.location && window.location.search && window.location.search.includes('staff_view=1'));
            if (isInsideIframe && typeof document !== 'undefined' && document.documentElement) {
                document.documentElement.classList.add('is-embedded');
                if (document.body) document.body.classList.add('is-embedded');
            }
        }
    } catch(e) {}

    // Zero-Tolerance Purge for any foreign cosmetics/Meliora residual data in localStorage
    (function purgeForeignCosmetics() {
        try {
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

    // Universal HTML entity sanitizer available globally across all ERP & Admin panels
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    window.escapeHtml = escapeHtml;

    // ---------------------------------------------------------
    // 1. RBAC PERMISSIONS MATRIX & ROLES DEFINITION
    // ---------------------------------------------------------
    const ROLES = {
        SUPER_ADMIN: 'Super Admin',
        ADMIN: 'Admin',
        HR_MANAGER: 'HR Manager',
        SALES_MANAGER: 'Sales Manager',
        SALES_EMPLOYEE: 'Sales Employee',
        INVENTORY_MANAGER: 'Inventory Manager',
        WAREHOUSE_STAFF: 'Warehouse Staff',
        WEBSITE_MANAGER: 'Website Manager',
        ACCOUNTANT: 'Accountant',
        CUSTOMER_SUPPORT: 'Customer Support',
        MARKETING_MANAGER: 'Marketing Manager'
    };

    // 14 Standard Granular Enterprise Modules
    const ERP_MODULES = [
        { key: 'products', name: 'Products & Catalog', icon: 'fa-boxes-stacked', file: 'products.html', navId: 'nav-products', desc: 'Product specs, pricing, variants, categories & SEO' },
        { key: 'banners', name: 'Banners & Theme Builder', icon: 'fa-image', file: 'admin-sales.html', navId: 'nav-sales', desc: 'Sales campaign banners, event themes & website appearance' },
        { key: 'crm', name: 'Customer CRM & Coupons', icon: 'fa-users-viewfinder', file: 'admin-crm.html', navId: 'nav-crm', extraFiles: ['admin-marketing.html'], desc: 'Customer 360 profiles, lifetime value & promotional coupons' },
        { key: 'inventory', name: 'Multi-Warehouse & Stock Inventory', icon: 'fa-warehouse', file: 'admin-inventory.html', navId: 'nav-inventory', desc: 'Multi-hub stock levels (Karachi, Lahore, Islamabad) & transfers' },
        { key: 'purchasing', name: 'Purchasing & Suppliers', icon: 'fa-truck-ramp-box', file: 'admin-purchasing.html', navId: 'nav-purchasing', desc: 'Supplier vendors, Purchase Orders (PO) & GRN stock inward' },
        { key: 'orders', name: 'Sales Orders Pipeline & POS', icon: 'fa-cart-shopping', file: 'orders.html', navId: 'nav-orders', desc: 'Order tracking, dispatching, invoices & manual order generation' },
        { key: 'logistics', name: 'Logistics, Couriers & COD', icon: 'fa-truck-fast', file: 'admin-logistics.html', navId: 'nav-logistics', desc: 'Courier manifests (TCS, Leopard, Trax) & COD reconciliation' },
        { key: 'returns', name: 'Returns & Warranty Management', icon: 'fa-rotate-left', file: 'admin-returns.html', navId: 'nav-returns', desc: 'RMA warranty diagnostics, serial lookups, replacements & refunds' },
        { key: 'finance', name: 'Finance, Expenses & P&L Ledger', icon: 'fa-file-invoice-dollar', file: 'admin-finance.html', navId: 'nav-finance', desc: 'Double-entry ledger, operational expenses & monthly Profit & Loss' },
        { key: 'hr', name: 'HR, Employee Payroll & Attendance', icon: 'fa-user-tie', file: 'admin-staff.html', navId: 'nav-staff', desc: 'Employee onboarding, credentials, payroll & role permissions' },
        { key: 'tasks', name: 'Tasks & Workflow Management', icon: 'fa-list-check', file: 'admin-tasks.html', navId: 'nav-tasks', desc: 'Operational Kanban board, task assignment & SLA tracking' },
        { key: 'dealers', name: 'B2B Dealers & Wholesale Ledger', icon: 'fa-handshake', file: 'admin-dealers.html', navId: 'nav-dealers', desc: 'Dealer accounts, B2B wholesale stock ledger, payments & balance reconciliation' },
        { key: 'reports', name: 'Business Reports & Analytics', icon: 'fa-chart-column', file: 'admin-reports.html', navId: 'nav-reports', desc: 'Cross-departmental reporting, valuation summaries & CSV exports' },
        { key: 'audit', name: 'Security, Audit Logs & Users', icon: 'fa-fingerprint', file: 'admin-audit.html', navId: 'nav-audit', desc: 'Immutable cryptographic-style audit logs & change tracking' },
        { key: 'settings', name: 'System Settings & APIs', icon: 'fa-sliders', file: 'admin-settings.html', navId: 'nav-settings', desc: 'Courier API credentials, bank details & system backups' }
    ];

    // Password Hashing Helper
    function hashStringSync(str) {
        if (!str) return '';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'sha256_' + Math.abs(hash).toString(16).padStart(8, '0');
    }

    const ROLE_PERMISSIONS = {
        [ROLES.SUPER_ADMIN]: {
            dashboard: ['view', 'export', 'switch_role'],
            website: ['view', 'create', 'edit', 'delete'],
            catalog: ['view', 'create', 'edit', 'delete', 'export'],
            inventory: ['view', 'create', 'edit', 'delete', 'adjust', 'transfer', 'export'],
            serials: ['view', 'create', 'edit', 'delete', 'export'],
            purchasing: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
            orders: ['view', 'create', 'edit', 'delete', 'cancel', 'process', 'refund', 'export', 'print'],
            crm: ['view', 'create', 'edit', 'delete', 'export'],
            logistics: ['view', 'create', 'edit', 'reconcile', 'export'],
            returns: ['view', 'create', 'edit', 'approve', 'refund'],
            finance: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'print'],
            expenses: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
            hr: ['view', 'create', 'edit', 'delete', 'payroll', 'approve', 'export'],
            tasks: ['view', 'create', 'edit', 'delete', 'assign'],
            marketing: ['view', 'create', 'edit', 'delete', 'export'],
            approvals: ['view', 'approve', 'reject'],
            reports: ['view', 'export', 'print'],
            audit: ['view', 'export'],
            settings: ['view', 'edit']
        },
        [ROLES.ADMIN]: {
            dashboard: ['view', 'export'],
            website: ['view', 'create', 'edit'],
            catalog: ['view', 'create', 'edit', 'delete', 'export'],
            inventory: ['view', 'create', 'edit', 'adjust', 'transfer', 'export'],
            serials: ['view', 'create', 'edit', 'export'],
            purchasing: ['view', 'create', 'edit', 'approve', 'export'],
            orders: ['view', 'create', 'edit', 'cancel', 'process', 'export', 'print'],
            crm: ['view', 'create', 'edit', 'export'],
            logistics: ['view', 'create', 'edit', 'reconcile', 'export'],
            returns: ['view', 'create', 'edit', 'approve'],
            finance: ['view', 'create', 'edit', 'export', 'print'],
            expenses: ['view', 'create', 'edit', 'approve', 'export'],
            hr: ['view', 'create', 'edit', 'payroll', 'approve', 'export'],
            tasks: ['view', 'create', 'edit', 'assign'],
            marketing: ['view', 'create', 'edit'],
            approvals: ['view', 'approve', 'reject'],
            reports: ['view', 'export', 'print'],
            audit: ['view'],
            settings: ['view']
        },
        [ROLES.HR_MANAGER]: {
            dashboard: ['view_dept'],
            hr: ['view', 'create', 'edit', 'payroll', 'approve', 'export', 'print'],
            expenses: ['view_payroll'],
            tasks: ['view', 'create', 'edit', 'assign'],
            approvals: ['view', 'approve', 'reject'],
            reports: ['view_hr']
        },
        [ROLES.SALES_MANAGER]: {
            dashboard: ['view_dept'],
            catalog: ['view'],
            inventory: ['view'],
            orders: ['view', 'create', 'edit', 'cancel', 'process', 'export', 'print'],
            crm: ['view', 'create', 'edit', 'export'],
            returns: ['view', 'create'],
            tasks: ['view', 'create', 'edit', 'assign'],
            reports: ['view_sales']
        },
        [ROLES.SALES_EMPLOYEE]: {
            dashboard: ['view_dept'],
            catalog: ['view'],
            inventory: ['view'],
            orders: ['view', 'create', 'edit', 'print'],
            crm: ['view', 'create'],
            tasks: ['view', 'edit_status']
        },
        [ROLES.INVENTORY_MANAGER]: {
            dashboard: ['view_dept'],
            catalog: ['view', 'create', 'edit', 'export'],
            inventory: ['view', 'create', 'edit', 'adjust', 'transfer', 'export'],
            serials: ['view', 'create', 'edit', 'export'],
            purchasing: ['view', 'create', 'edit', 'export'],
            orders: ['view'],
            tasks: ['view', 'create', 'edit', 'assign'],
            reports: ['view_inventory']
        },
        [ROLES.WAREHOUSE_STAFF]: {
            dashboard: ['view_dept'],
            catalog: ['view'],
            inventory: ['view', 'adjust', 'transfer'],
            serials: ['view', 'create'],
            purchasing: ['view_grn', 'create_grn'],
            orders: ['view_packing', 'process_pack', 'process_ship'],
            logistics: ['view_manifest'],
            returns: ['view_inspection', 'edit_inspection'],
            tasks: ['view', 'edit_status']
        },
        [ROLES.WEBSITE_MANAGER]: {
            dashboard: ['view_dept'],
            website: ['view', 'create', 'edit', 'delete'],
            catalog: ['view', 'create', 'edit'],
            marketing: ['view', 'create', 'edit'],
            tasks: ['view', 'edit_status']
        },
        [ROLES.ACCOUNTANT]: {
            dashboard: ['view_dept'],
            catalog: ['view'],
            inventory: ['view_valuation'],
            purchasing: ['view_bills', 'pay_vendor'],
            orders: ['view_invoices', 'print'],
            logistics: ['reconcile_cod'],
            finance: ['view', 'create', 'edit', 'approve', 'export', 'print'],
            expenses: ['view', 'create', 'edit', 'approve', 'export'],
            hr: ['view_payroll_run', 'payroll'],
            approvals: ['view', 'approve', 'reject'],
            reports: ['view_finance'],
            tasks: ['view', 'edit_status']
        },
        [ROLES.CUSTOMER_SUPPORT]: {
            dashboard: ['view_dept'],
            catalog: ['view'],
            orders: ['view', 'edit_address', 'track'],
            crm: ['view', 'create', 'edit'],
            logistics: ['view_tracking'],
            returns: ['view', 'create', 'edit'],
            serials: ['view', 'lookup_warranty'],
            tasks: ['view', 'edit_status']
        },
        [ROLES.MARKETING_MANAGER]: {
            dashboard: ['view_dept'],
            website: ['view', 'edit_banners', 'edit_themes'],
            catalog: ['view'],
            orders: ['view_analytics'],
            crm: ['view_segments'],
            marketing: ['view', 'create', 'edit', 'delete', 'export'],
            expenses: ['view_marketing', 'create_marketing_expense'],
            tasks: ['view', 'create', 'edit', 'assign'],
            reports: ['view_marketing']
        }
    };

    // ---------------------------------------------------------
    // 2. CENTRAL DATA KEYS & SEED DATA INITIALIZERS
    // ---------------------------------------------------------
    const STORAGE_KEYS = {
        PRODUCTS: 'gug_erp_products',
        CATEGORIES: 'gug_erp_categories',
        BRANDS: 'gug_erp_brands',
        WAREHOUSES: 'gug_erp_warehouses',
        SERIALS: 'gug_erp_serials',
        SUPPLIERS: 'gug_erp_suppliers',
        PURCHASE_ORDERS: 'gug_erp_purchase_orders',
        ORDERS: 'admin_orders',
        CUSTOMERS: 'gug_erp_customers',
        EXPENSES: 'gug_erp_expenses',
        EMPLOYEES: 'gug_erp_employees',
        ATTENDANCE: 'gug_erp_attendance',
        LEAVES: 'gug_erp_leaves',
        TASKS: 'gug_erp_tasks',
        AUDIT_LOGS: 'gug_erp_audit_logs',
        LOGISTICS_SHIPMENTS: 'gug_erp_shipments',
        RETURNS: 'gug_erp_returns',
        COUPONS: 'gug_erp_coupons',
        CAMPAIGNS: 'gug_erp_campaigns',
        REVIEWS: 'gug_erp_reviews',
        APPROVALS: 'gug_erp_approvals',
        SETTINGS: 'gug_erp_settings',
        THEME_SETTINGS: 'gug_event_theme_config',
        BANNERS: 'gug_sales_banners',
        DEALERS: 'gug_erp_dealers',
        DEALER_LEDGER: 'gug_erp_dealer_ledger',
        INVENTORY_CITIES: 'gug_custom_inventory_cities',
        PC_BUILDS: 'admin_pc_build_requests'
    };

    // Seed Categories - Complete Gear Up Gadgets computer hardware, gaming, and gadget catalog
    const SEED_CATEGORIES = [
        { id: 'CAT-01', name: 'Monitors', slug: 'monitors', icon: 'fa-tv', subcategories: ['4K Ultra HD', '144Hz-240Hz Esports', 'Curved Ultrawide', 'IPS Gaming'] },
        { id: 'CAT-02', name: 'Laptops & Notebooks', slug: 'laptops', icon: 'fa-laptop', subcategories: ['Gaming Laptops', 'Business Notebooks', 'Student Ultrabooks', 'MacBooks'] },
        { id: 'CAT-03', name: 'Desktop Computers', slug: 'desktops', icon: 'fa-desktop', subcategories: ['Custom PC Builds', 'Office Desktops', 'All-in-One PCs', 'Workstations'] },
        { id: 'CAT-04', name: 'Processors & CPUs', slug: 'processors', icon: 'fa-microchip', subcategories: ['Intel Core i9 / i7 / i5', 'AMD Ryzen 9 / 7 / 5'] },
        { id: 'CAT-05', name: 'Motherboards', slug: 'motherboards', icon: 'fa-chess-board', subcategories: ['Intel Z790 / B760', 'AMD X670 / B650', 'Mini-ITX'] },
        { id: 'CAT-06', name: 'Graphics Cards', slug: 'graphics-cards', icon: 'fa-vr-cardboard', subcategories: ['NVIDIA GeForce RTX 4090/4080', 'AMD Radeon RX 7900'] },
        { id: 'CAT-07', name: 'Mechanical Keyboards', slug: 'keyboards', icon: 'fa-keyboard', subcategories: ['RGB Optical Mechanical', 'Wireless Custom 75%', 'Hot-swappable'] },
        { id: 'CAT-08', name: 'Gaming Mice', slug: 'mice', icon: 'fa-mouse', subcategories: ['Ultralight Wireless', 'Ergonomic Esports', 'Optical Sensor'] },
        { id: 'CAT-09', name: 'Audio & Headsets', slug: 'audio', icon: 'fa-headphones', subcategories: ['ANC Wireless Headsets', 'Studio Monitors', 'Surround 7.1'] },
        { id: 'CAT-10', name: 'Audio & Speakers', slug: 'speakers', icon: 'fa-volume-high', subcategories: ['Desktop Soundbars', '2.1 RGB Speakers', 'Studio Reference'] },
        { id: 'CAT-11', name: 'RAM & Memory', slug: 'ram', icon: 'fa-memory', subcategories: ['DDR5 RGB 6000MHz+', 'DDR4 Gaming Kits', 'Laptop SO-DIMM'] },
        { id: 'CAT-12', name: 'NVMe SSDs', slug: 'storage', icon: 'fa-hard-drive', subcategories: ['PCIe Gen4 M.2 SSD', 'External Portable SSD', 'High Capacity HDD'] },
        { id: 'CAT-13', name: 'Casings & Towers', slug: 'casings', icon: 'fa-server', subcategories: ['Tempered Glass Mid-Tower', 'Full Tower Showcase', 'Dual Chamber Mini-ITX'] },
        { id: 'CAT-14', name: 'Printers & Scanners', slug: 'printers', icon: 'fa-print', subcategories: ['All-in-One InkTank', 'Wireless Laser Printers', 'Photo Scanners'] },
        { id: 'CAT-15', name: 'Mobile Phones & Gadgets', slug: 'mobiles', icon: 'fa-mobile-screen-button', subcategories: ['Flagship Smartphones', 'Foldables', 'Handheld Gadgets'] },
        { id: 'CAT-16', name: 'Smartwatches & Wearables', slug: 'smartwatches', icon: 'fa-clock', subcategories: ['AMOLED Smartwatches', 'Fitness Trackers', 'Titanium Bands'] },
        { id: 'CAT-17', name: 'Apple MacBooks', slug: 'macbooks', icon: 'fa-laptop-code', subcategories: ['MacBook Pro M3/M2', 'MacBook Air'] },
        { id: 'CAT-18', name: 'Apple iPads & Accessories', slug: 'ipads', icon: 'fa-tablet-screen-button', subcategories: ['iPad Pro M4', 'Apple Pencil', 'Magic Keyboard'] },
        { id: 'CAT-19', name: 'Gaming Controllers', slug: 'controllers', icon: 'fa-gamepad', subcategories: ['Wireless Gamepads', 'Hall-Effect Triggers', 'Flight Sticks'] },
        { id: 'CAT-20', name: 'Accessories & Cables', slug: 'accessories', icon: 'fa-plug', subcategories: ['Thunderbolt 4 Cables', 'USB-C Hubs & Docks', 'Monitor Arms', 'Mousepads'] },
        { id: 'CAT-21', name: 'Power & GaN Chargers', slug: 'chargers', icon: 'fa-bolt', subcategories: ['140W Desktop GaN', '65W Fast Chargers', 'Modular ATX 3.0 PSUs'] },
        { id: 'CAT-22', name: 'Mice & Pointing Devices', slug: 'mice-devices', icon: 'fa-mouse', subcategories: ['Silent Office Mice', 'Air Mouse', 'Bluetooth Multi-Device', 'Esports Optical'] },
        { id: 'CAT-23', name: 'Keyboards & Keypads', slug: 'keyboards-keypads', icon: 'fa-keyboard', subcategories: ['Wireless Slim', 'Mechanical Esports', 'Numeric Keypads', 'Combos'] },
        { id: 'CAT-24', name: 'Headphones & Headsets', slug: 'headphones-headsets', icon: 'fa-headphones-simple', subcategories: ['Office USB Headsets', '7.1 RGB Gaming', 'TWS Earbuds', 'Wireless ANC'] },
        { id: 'CAT-25', name: 'Webcams & Cameras', slug: 'webcams', icon: 'fa-video', subcategories: ['1080P Full HD', '2K Auto-Focus', '4K Ultra Streaming', 'Gaming Webcams'] },
        { id: 'CAT-26', name: 'Audio & Acoustics', slug: 'audio-acoustics', icon: 'fa-volume-high', subcategories: ['Desktop Soundbars', 'Hi-Fi RGB Speakers', 'Studio Monitors'] },
        { id: 'CAT-27', name: 'Gaming Controllers & Gear', slug: 'gaming-gear', icon: 'fa-gamepad', subcategories: ['Wireless Gamepads', 'Esports Mousepads', 'Headphone Stands', 'Monitor Arms'] },
        { id: 'CAT-28', name: 'Networking & Wireless', slug: 'networking-wireless', icon: 'fa-wifi', subcategories: ['Wi-Fi 6E/7 Routers', 'Deco Mesh Systems', 'Range Extenders', 'Gigabit Switches', 'Omada Access Points', 'Outdoor CPE Antennas', 'Wi-Fi Adapters', 'Security Cameras'] },
        { id: 'CAT-29', name: 'Mobiles', slug: 'mobiles', icon: 'fa-mobile-screen-button', subcategories: ['5G Flagships', 'Smartphones', 'Feature Phones', 'Foldables', 'Gaming Phones'] },
        { id: 'CAT-30', name: 'Mouse', slug: 'mouse', icon: 'fa-mouse', subcategories: ['Wireless Mice', 'Gaming Mice', 'Silent Office Mice', 'Ergonomic Mice', 'Combos'] },
        { id: 'CAT-31', name: 'TV & Home Entertainment', slug: 'tv-entertainment', icon: 'fa-tv', subcategories: ['4K QLED TVs', 'Smart TVs', 'Android TV Boxes', 'Smart Projectors'] },
        { id: 'CAT-32', name: 'Tablets & Pads', slug: 'tablets-pads', icon: 'fa-tablet-screen-button', subcategories: ['Android Tablets', 'Pads with Keyboards', 'Stylus Pens', 'Drawing Tablets'] },
        { id: 'CAT-33', name: 'Smart Home & Appliances', slug: 'smart-home', icon: 'fa-house-signal', subcategories: ['Inverter ACs', 'Air Purifiers', 'Robot Vacuums', 'Security Cameras', 'Smart Lighting', 'Lifestyle & Personal Care'] }
    ];

    // Seed Brands
    const SEED_BRANDS = [
        { id: 'BRD-01', name: 'ASUS', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'ROG & ProArt premium hardware' },
        { id: 'BRD-02', name: 'Intel', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Core i9/i7/i5 high-performance computing' },
        { id: 'BRD-03', name: 'AMD', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Ryzen and Radeon performance architecture' },
        { id: 'BRD-04', name: 'NVIDIA', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'GeForce RTX graphics solutions' },
        { id: 'BRD-05', name: 'Corsair', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Gaming components, coolers & RAM' },
        { id: 'BRD-06', name: 'Logitech', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'G-Pro esports mice and mechanical keyboards' },
        { id: 'BRD-07', name: 'Razer', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'For Gamers By Gamers peripherals' },
        { id: 'BRD-08', name: 'MSI', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Gaming motherboards & monitors' },
        { id: 'BRD-09', name: 'Gigabyte', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'AORUS high-end gaming hardware' },
        { id: 'BRD-10', name: 'Kingston', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'FURY gaming memory & NVMe storage' },
        { id: 'BRD-11', name: 'Samsung', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Odyssey gaming monitors & 990 Pro SSDs' },
        { id: 'BRD-12', name: 'Western Digital', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'WD Black high performance NVMe storage' },
        { id: 'BRD-13', name: 'Apple', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'MacBooks, iPads, and genuine accessories' },
        { id: 'BRD-14', name: 'Dell', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Alienware & UltraSharp enterprise systems' },
        { id: 'BRD-15', name: 'HP', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'OMEN gaming & LaserJet printer hardware' },
        { id: 'BRD-16', name: 'Lenovo', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Legion gaming laptops & ThinkPad series' },
        { id: 'BRD-17', name: 'Redragon', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Affordable gaming peripherals & keyboards' },
        { id: 'BRD-18', name: 'HyperX', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Cloud gaming headsets & audio' },
        { id: 'BRD-19', name: 'SteelSeries', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Apex Pro mechanical keyboards & Arctis audio' },
        { id: 'BRD-20', name: 'GearUp Pro', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Official flagship Gear Up Gadgets distribution' },
        { id: 'BRD-21', name: 'A4Tech', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Fstyler silent office mice, keypads, webcams & accessories' },
        { id: 'BRD-22', name: 'Bloody', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Esports gaming mice, mechanical keyboards, 7.1 headsets, pads & gear' },
        { id: 'BRD-23', name: 'EVNIA', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Philips EVNIA Fast IPS, 4K UHD, 240Hz-540Hz esports & curved gaming monitors' },
        { id: 'BRD-24', name: 'Philips', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Philips UltraSharp visual displays & high-performance monitors' },
        { id: 'BRD-25', name: 'TP-Link', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Wi-Fi 6E/7 Routers, Deco Mesh Systems, Gigabit Switches & Omada Access Points' },
        { id: 'BRD-26', name: 'Tapo', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Smart Home Security Wi-Fi Cameras, Outdoor 2K Cameras & Pan/Tilt Devices' },
        { id: 'BRD-27', name: 'Motorola', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Official Motorola Moto G & Edge 5G series smartphones' },
        { id: 'BRD-28', name: 'Xiaomi', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Official Xiaomi smartphones, Smart TVs, smart wearables & lifestyle IoT ecosystem' },
        { id: 'BRD-29', name: 'Redmi', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Redmi Note series smartphones, Redmi Pads, smart watches & audio' },
        { id: 'BRD-30', name: 'Poco', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Poco performance-oriented speed smartphones' },
        { id: 'BRD-31', name: 'Honor', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Honor X series smartphones and TWS audio' },
        { id: 'BRD-32', name: 'Infinix', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Infinix Note, Hot, GT gaming smartphones, power banks & smartwatches' },
        { id: 'BRD-33', name: 'Tecno', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Tecno Spark & Camon photography smartphones' },
        { id: 'BRD-34', name: 'Realme', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Realme C series & number series smartphones' },
        { id: 'BRD-35', name: 'Vivo', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Vivo V series 5G & Y series smartphones' },
        { id: 'BRD-36', name: 'Oppo', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Oppo Reno portrait flagships & A series smartphones' },
        { id: 'BRD-37', name: 'ZTE Nubia', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'ZTE Nubia gaming & photography smartphones' },
        { id: 'BRD-38', name: 'Itel', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Itel smartphones, feature phones & mobile accessories' },
        { id: 'BRD-39', name: 'VgoTel', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'VgoTel smartphones & reliable mobile devices' },
        { id: 'BRD-40', name: 'Dcode', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Dcode Cygnal smartphones built for performance' },
        { id: 'BRD-41', name: 'Nothing', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Nothing Phone transparent design & Glyph interface smartphones' },
        { id: 'BRD-42', name: 'Sego', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Sego Smart & Note mobile devices' },
        { id: 'BRD-43', name: 'Villaon', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Villaon smartphones & accessories' },
        { id: 'BRD-44', name: 'Nokia', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Nokia classic feature phones & mobile hardware' },
        { id: 'BRD-45', name: 'HMD', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'HMD mobile phones & devices' },
        { id: 'BRD-46', name: 'GFive', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'GFive classic mobile handsets' },
        { id: 'BRD-47', name: 'Hisense', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Hisense T3 Inverter Air Conditioners & home comfort systems' },
        { id: 'BRD-48', name: 'Mijia', logo: 'assets/images/logo.png', status: 'Active', isFeatured: true, description: 'Mijia smart air purifiers & precision home appliances' }
    ];

    // Seed Warehouses
    const SEED_WAREHOUSES = [
        { id: 'WH-01', name: 'Karachi Central Hub', code: 'KHI-HQ', city: 'Karachi', address: 'Plot 45-C, Phase 6, DHA Commercial', capacity: '15,000 units', manager: 'Bilal Khan', isDefault: true },
        { id: 'WH-02', name: 'Lahore North Hub', code: 'LHR-01', city: 'Lahore', address: 'Industrial Area, Block H, Gulberg III', capacity: '8,000 units', manager: 'Hamza Tariq', isDefault: false },
        { id: 'WH-03', name: 'Islamabad Capital Hub', code: 'ISB-01', city: 'Islamabad', address: 'Sector I-9/2 Industrial Area', capacity: '5,000 units', manager: 'Usman Ali', isDefault: false }
    ];

    // Seed Suppliers
    const SEED_SUPPLIERS = [
        { id: 'SUP-101', name: 'Nexus Tech Global Ltd', company: 'Nexus Technologies Shenzhen', contactPerson: 'Chen Wei', email: 'sales@nexustech.cn', phone: '+86 21 5888 1234', category: 'Smartphones & Smartwatches', balancePayable: 450000, paymentTerms: 'Net 30', status: 'Active', address: 'Bldg 4, Nanshan High-Tech Park, Shenzhen' },
        { id: 'SUP-102', name: 'AudioPro Sound Components', company: 'AudioPro Acoustic Labs', contactPerson: 'Markus Vance', email: 'orders@audiopro.de', phone: '+49 30 901820', category: 'Audio & ANC Headsets', balancePayable: 185000, paymentTerms: 'Net 15', status: 'Active', address: 'Gewerbepark 12, 10115 Berlin, Germany' },
        { id: 'SUP-103', name: 'HyperPower Accessories', company: 'HyperPower Electronics Pakistan', contactPerson: 'Tariq Mehmood', email: 'tariq@hyperpower.pk', phone: '+92 300 4567890', category: 'GaN Chargers & Cables', balancePayable: 95000, paymentTerms: 'COD / Net 7', status: 'Active', address: 'Plaza 22, Hall Road, Lahore' },
        { id: 'SUP-104', name: 'Apex Gaming Peripherals', company: 'Apex Gaming USA Inc.', contactPerson: 'Sarah Jenkins', email: 'supply@apexgaming.us', phone: '+1 415 555 0199', category: 'Keyboards & Mice', balancePayable: 0, paymentTerms: 'Net 30', status: 'Active', address: '450 Mission St, San Francisco, CA' }
    ];

    // Seed Employees with Full Personal Details, Authentication Credentials & Granular 14-Module Permissions
    const ALL_MODULE_KEYS = ['products', 'banners', 'crm', 'inventory', 'purchasing', 'orders', 'logistics', 'returns', 'finance', 'hr', 'tasks', 'dealers', 'reports', 'audit', 'settings'];

    const SEED_EMPLOYEES = [
        { 
            id: 'EMP-001', 
            name: 'Khan Super Admin', 
            role: ROLES.SUPER_ADMIN, 
            department: 'Executive', 
            email: 'admin@gearupgadgets.com', 
            phone: '+92 300 1112233', 
            whatsapp: '+92 300 1112233', 
            cnic: '42201-1234567-1', 
            address: 'Penthouse 12, Creek Vistas, Phase 8 DHA, Karachi',
            basicSalary: 350000, 
            status: 'Active', 
            username: 'admin', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: [...ALL_MODULE_KEYS],
            joinDate: '2024-01-01' 
        },
        { 
            id: 'EMP-002', 
            name: 'Farhan Zaidi', 
            role: ROLES.ACCOUNTANT, 
            department: 'Finance & Accounts', 
            email: 'farhan@gearupgadgets.com', 
            phone: '+92 321 8887766', 
            whatsapp: '+92 321 8887766', 
            cnic: '42101-7654321-3', 
            address: 'House 45-A, Block 13-D, Gulshan-e-Iqbal, Karachi',
            basicSalary: 120000, 
            status: 'Active', 
            username: 'accountant', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['finance', 'orders', 'purchasing', 'logistics', 'reports', 'tasks'],
            joinDate: '2024-03-15' 
        },
        { 
            id: 'EMP-003', 
            name: 'Zeeshan Qureshi', 
            role: ROLES.INVENTORY_MANAGER, 
            department: 'Supply Chain', 
            email: 'zeeshan@gearupgadgets.com', 
            phone: '+92 333 4455667', 
            whatsapp: '+92 333 4455667', 
            cnic: '42301-9876543-5', 
            address: 'Flat 302, Al-Rauf Classic, North Nazimabad, Karachi',
            basicSalary: 110000, 
            status: 'Active', 
            username: 'inventory', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['inventory', 'products', 'purchasing', 'returns', 'reports', 'tasks'],
            joinDate: '2024-04-01' 
        },
        { 
            id: 'EMP-004', 
            name: 'Ayesha Siddiqui', 
            role: ROLES.SALES_MANAGER, 
            department: 'Sales & Orders', 
            email: 'ayesha@gearupgadgets.com', 
            phone: '+92 312 9900112', 
            whatsapp: '+92 312 9900112', 
            cnic: '42201-5544332-2', 
            address: 'B-88, Sector 11-A, Buffer Zone, Karachi',
            basicSalary: 115000, 
            status: 'Active', 
            username: 'sales', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['orders', 'crm', 'products', 'returns', 'reports', 'tasks'],
            joinDate: '2024-02-10' 
        },
        { 
            id: 'EMP-005', 
            name: 'Rashid Minhas', 
            role: ROLES.WAREHOUSE_STAFF, 
            department: 'Warehouse & Logistics', 
            email: 'rashid@gearupgadgets.com', 
            phone: '+92 345 6677889', 
            whatsapp: '+92 345 6677889', 
            cnic: '42501-1122334-9', 
            address: 'Plot 12, Korangi Industrial Area, Karachi',
            basicSalary: 55000, 
            status: 'Active', 
            username: 'warehouse', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['inventory', 'orders', 'logistics', 'returns', 'tasks'],
            joinDate: '2024-05-01' 
        },
        { 
            id: 'EMP-006', 
            name: 'Mariam Noor', 
            role: ROLES.CUSTOMER_SUPPORT, 
            department: 'Customer Experience', 
            email: 'mariam@gearupgadgets.com', 
            phone: '+92 301 3344556', 
            whatsapp: '+92 301 3344556', 
            cnic: '42201-6677889-4', 
            address: 'Apartment 5-C, City Heights, PECHS Block 2, Karachi',
            basicSalary: 60000, 
            status: 'Active', 
            username: 'support', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['crm', 'orders', 'returns', 'products', 'tasks'],
            joinDate: '2024-06-15' 
        },
        { 
            id: 'EMP-007', 
            name: 'Danish Khan', 
            role: ROLES.HR_MANAGER, 
            department: 'Human Resources', 
            email: 'danish@gearupgadgets.com', 
            phone: '+92 315 2233445', 
            whatsapp: '+92 315 2233445', 
            cnic: '42101-4455667-7', 
            address: 'Plot 77, Street 14, Phase 5 DHA, Karachi',
            basicSalary: 125000, 
            status: 'Active', 
            username: 'hr', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['hr', 'tasks', 'reports', 'audit'],
            joinDate: '2024-02-01' 
        },
        { 
            id: 'EMP-008', 
            name: 'Saad Ahmed', 
            role: ROLES.MARKETING_MANAGER, 
            department: 'Marketing', 
            email: 'saad@gearupgadgets.com', 
            phone: '+92 334 7788990', 
            whatsapp: '+92 334 7788990', 
            cnic: '42301-8899001-3', 
            address: 'House 19, Cavalry Ground, Lahore',
            basicSalary: 105000, 
            status: 'Active', 
            username: 'marketing', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['banners', 'crm', 'products', 'reports', 'tasks'],
            joinDate: '2024-07-01' 
        },
        { 
            id: 'EMP-009', 
            name: 'Umar Farooq', 
            role: 'Catalog & Store Specialist', 
            department: 'Marketing & Catalog', 
            email: 'umar@gearupgadgets.com', 
            phone: '+92 300 5544332', 
            whatsapp: '+92 300 5544332', 
            cnic: '42201-3322114-5', 
            address: 'House 88, Block 4, Clifton, Karachi',
            basicSalary: 85000, 
            status: 'Active', 
            username: 'umar', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['products'],
            joinDate: '2024-08-01' 
        },
        { 
            id: 'EMP-010', 
            name: 'Ahsaan', 
            role: 'Sales Employee', 
            department: 'Sales & Orders', 
            email: 'ahsaan@gearupgadgets.com', 
            phone: '+92 300 7766554', 
            whatsapp: '+92 300 7766554', 
            cnic: '42101-9988776-3', 
            address: 'PECHS Block 3, Karachi',
            basicSalary: 75000, 
            status: 'Active', 
            username: 'ahsaan', 
            password: 'admingug',
            passwordHash: hashStringSync('admingug'),
            permissions: ['products', 'crm', 'orders'],
            joinDate: '2024-08-15' 
        }
    ];

    // Seed Products
    const SEED_PRODUCTS = [
        {
            id: 'PROD-001',
            title: 'GearUp Ultra Smartwatch Pro Max',
            category: 'Smartwatches',
            brand: 'GearUp Pro',
            sku: 'GUG-SW-PRO-01',
            barcode: '896400112201',
            purchasePrice: 16500,
            costPrice: 17200,
            sellingPrice: 24999,
            wholesalePrice: 21000,
            image: 'assets/images/products/product-01.jpg',
            description: '1.96-inch AMOLED Display, Titanium Casing, ECG & Optical Heart Sensor, 7-day battery life.',
            stock: { 'WH-01': 48, 'WH-02': 22, 'WH-03': 15 },
            lowStockThreshold: 15,
            variants: [
                { name: 'Space Black / Titanium', sku: 'GUG-SW-PRO-01-BLK', price: 24999, stock: 45 },
                { name: 'Alpine Silver / Orange Strap', sku: 'GUG-SW-PRO-01-SLV', price: 24999, stock: 40 }
            ],
            warrantyMonths: 12,
            hasSerialTracking: true,
            isFeatured: false,
            isBestSeller: true,
            status: 'Published'
        },
        {
            id: 'PROD-002',
            title: 'PulseANC Wireless Studio Headphones',
            category: 'Audio & Headsets',
            brand: 'PulseAudio',
            sku: 'GUG-AUD-ANC-02',
            barcode: '896400112202',
            purchasePrice: 11000,
            costPrice: 11500,
            sellingPrice: 18500,
            wholesalePrice: 15000,
            image: 'assets/images/products/product-02.jpg',
            description: 'Active Noise Cancellation (-42dB), 40mm Beryllium Drivers, 50h Playback, Hi-Res LDAC Wireless.',
            stock: { 'WH-01': 35, 'WH-02': 18, 'WH-03': 10 },
            lowStockThreshold: 10,
            variants: [
                { name: 'Midnight Black', sku: 'GUG-AUD-ANC-02-BLK', price: 18500, stock: 35 },
                { name: 'Smoky Platinum', sku: 'GUG-AUD-ANC-02-SLV', price: 18500, stock: 28 }
            ],
            warrantyMonths: 12,
            hasSerialTracking: true,
            isFeatured: false,
            isBestSeller: true,
            status: 'Published'
        },
        {
            id: 'PROD-003',
            title: 'HyperGaN 140W Multi-Port Desktop Charger',
            category: 'Power & GaN Chargers',
            brand: 'HyperGaN',
            sku: 'GUG-PWR-140W-03',
            barcode: '896400112203',
            purchasePrice: 5200,
            costPrice: 5500,
            sellingPrice: 8999,
            wholesalePrice: 7200,
            image: 'assets/images/products/product-03.jpg',
            description: 'Gallium Nitride 3x USB-C PD 3.1 + 1x USB-A QC4.0, LED Real-Time Power Monitor, Multi-Voltage.',
            stock: { 'WH-01': 85, 'WH-02': 40, 'WH-03': 25 },
            lowStockThreshold: 20,
            variants: [
                { name: 'Matte Gunmetal', sku: 'GUG-PWR-140W-03-MET', price: 8999, stock: 150 }
            ],
            warrantyMonths: 18,
            hasSerialTracking: false,
            isFeatured: false,
            isBestSeller: false,
            status: 'Published'
        },
        {
            id: 'PROD-004',
            title: 'Vortex Mechanical RGB Wireless Gaming Keyboard',
            category: 'Gaming Keyboards',
            brand: 'Vortex Mechanical',
            sku: 'GUG-KB-VRX-04',
            barcode: '896400112204',
            purchasePrice: 9500,
            costPrice: 9900,
            sellingPrice: 15999,
            wholesalePrice: 13000,
            image: 'assets/images/products/product-04.jpg',
            description: 'Hot-swappable Gateron Red Pro switches, Tri-Mode (BT5.1 / 2.4G / Type-C), Sound dampening foam.',
            stock: { 'WH-01': 20, 'WH-02': 8, 'WH-03': 4 },
            lowStockThreshold: 10,
            variants: [
                { name: 'Red Linear Switches', sku: 'GUG-KB-VRX-04-RED', price: 15999, stock: 18 },
                { name: 'Brown Tactile Switches', sku: 'GUG-KB-VRX-04-BRN', price: 15999, stock: 14 }
            ],
            warrantyMonths: 12,
            hasSerialTracking: true,
            isFeatured: false,
            isBestSeller: true,
            status: 'Published'
        },
        {
            id: 'PROD-005',
            title: 'SoundWave RGB Bluetooth Gaming Soundbar',
            category: 'Audio & Headsets',
            brand: 'PulseAudio',
            sku: 'GUG-SND-RGB-05',
            barcode: '896400112205',
            purchasePrice: 4200,
            costPrice: 4400,
            sellingPrice: 7499,
            wholesalePrice: 5800,
            image: 'assets/images/products/product-05.jpg',
            description: 'Dual 52mm drivers with dedicated bass radiator, Dynamic RGB audio visualizer, Bluetooth 5.3.',
            stock: { 'WH-01': 60, 'WH-02': 25, 'WH-03': 15 },
            lowStockThreshold: 15,
            variants: [
                { name: 'Cyber Black', sku: 'GUG-SND-RGB-05-BLK', price: 7499, stock: 100 }
            ],
            warrantyMonths: 6,
            hasSerialTracking: false,
            isFeatured: false,
            isBestSeller: false,
            status: 'Published'
        }
    ];

    // Seed Customers (CRM)
    const SEED_CUSTOMERS = [
        {
            id: 'CUST-1001',
            name: 'Shahmeer Farooqi',
            phone: '+92 300 9876543',
            email: 'shahmeer@gmail.com',
            city: 'Karachi',
            address: 'B-14, Block 7, Clifton, Karachi',
            segment: 'VIP',
            totalOrders: 6,
            lifetimeSpend: 148500,
            pendingBalance: 0,
            customerSince: '2024-03-12',
            notes: 'High-value customer, prefers evening delivery.'
        },
        {
            id: 'CUST-1002',
            name: 'Dr. Zainab Tariq',
            phone: '+92 321 4455667',
            email: 'zainab.t@hotmail.com',
            city: 'Lahore',
            address: 'House 88, Street 4, DHA Phase 5, Lahore',
            segment: 'Returning',
            totalOrders: 3,
            lifetimeSpend: 54900,
            pendingBalance: 0,
            customerSince: '2024-06-20',
            notes: 'Studio headphone repeat buyer.'
        },
        {
            id: 'CUST-1003',
            name: 'Adnan Mustafa',
            phone: '+92 333 1122334',
            email: 'adnan.m@yahoo.com',
            city: 'Islamabad',
            address: 'Apartment 4B, Silver Oaks, F-10, Islamabad',
            segment: 'Returning',
            totalOrders: 4,
            lifetimeSpend: 86490,
            pendingBalance: 0,
            customerSince: '2024-04-18',
            notes: 'Corporate bulk purchaser for IT accessories.'
        },
        {
            id: 'CUST-1004',
            name: 'Bilal Chaudhry',
            phone: '+92 345 5566778',
            email: 'bilal.c@gmail.com',
            city: 'Faisalabad',
            address: 'Plot 12, Main Boulevard, People Colony, Faisalabad',
            segment: 'New',
            totalOrders: 1,
            lifetimeSpend: 24999,
            pendingBalance: 0,
            customerSince: '2026-08-18',
            notes: 'First-time smartwatch buyer.'
        }
    ];

    // Seed Serial Numbers
    const SEED_SERIALS = [
        { serial: 'SN-GUG-SW-2026-8812', productId: 'PROD-001', productTitle: 'GearUp Ultra Smartwatch Pro Max', warehouse: 'WH-01', status: 'Sold', poId: 'PO-2026-089', orderId: 'GUG-8821', customerName: 'Shahmeer Farooqi', warrantyStart: '2026-08-19', warrantyEnd: '2027-08-19' },
        { serial: 'SN-GUG-SW-2026-8813', productId: 'PROD-001', productTitle: 'GearUp Ultra Smartwatch Pro Max', warehouse: 'WH-01', status: 'In Stock', poId: 'PO-2026-089', orderId: null, customerName: null, warrantyStart: null, warrantyEnd: null },
        { serial: 'SN-GUG-AUD-2026-4411', productId: 'PROD-002', productTitle: 'PulseANC Wireless Studio Headphones', warehouse: 'WH-02', status: 'Sold', poId: 'PO-2026-089', orderId: 'GUG-8820', customerName: 'Dr. Zainab Tariq', warrantyStart: '2026-08-18', warrantyEnd: '2027-08-18' },
        { serial: 'SN-GUG-KB-2026-9021', productId: 'PROD-004', productTitle: 'Vortex Mechanical RGB Wireless Gaming Keyboard', warehouse: 'WH-03', status: 'Sold', poId: 'PO-2026-089', orderId: 'GUG-8819', customerName: 'Adnan Mustafa', warrantyStart: '2026-08-16', warrantyEnd: '2027-08-16' }
    ];

    // Seed Returns & RMA
    const SEED_RETURNS = [
        {
            id: 'RMA-501',
            orderId: 'GUG-8820',
            customerName: 'Dr. Zainab Tariq',
            phone: '+92 321 4455667',
            productId: 'PROD-002',
            productTitle: 'PulseANC Wireless Studio Headphones',
            serial: 'SN-GUG-AUD-2026-4411',
            reason: 'Ordered wrong color (wanted Smoky Platinum instead of Midnight Black)',
            status: 'Completed',
            diagnosticNotes: 'Sealed package verified without any damage. Restocked in WH-02.',
            resolution: 'Replacement Exchanged',
            refundAmount: 0,
            date: '2026-08-18'
        },
        {
            id: 'RMA-502',
            orderId: 'GUG-8790',
            customerName: 'Kashif Mehmood',
            phone: '+92 300 7788991',
            productId: 'PROD-001',
            productTitle: 'GearUp Ultra Smartwatch Pro Max',
            serial: 'SN-GUG-SW-2026-8790',
            reason: 'Battery not holding charge past 6 hours under normal usage',
            status: 'Under Diagnostic',
            diagnosticNotes: 'Lab testing battery voltage at Karachi Central Hub service desk.',
            resolution: 'Pending Lab Approval',
            refundAmount: 24999,
            date: '2026-08-19'
        }
    ];

    // Seed Coupons
    const SEED_COUPONS = [
        { code: 'GEARUP10', type: 'Percentage', value: 10, minOrder: 3000, maxDiscount: 2500, expiry: '2026-12-31', usageLimit: 500, usageCount: 42, status: 'Active', description: '10% Storewide Welcome Discount' },
        { code: 'WELCOME5', type: 'Percentage', value: 5, minOrder: 1500, maxDiscount: 1000, expiry: '2026-12-31', usageLimit: 1000, usageCount: 88, status: 'Active', description: '5% First Order Coupon' },
        { code: 'FREESHIP', type: 'Free Shipping', value: 250, minOrder: 5000, maxDiscount: 500, expiry: '2026-10-31', usageLimit: 300, usageCount: 65, status: 'Active', description: 'Free Delivery Across Pakistan on Rs 5,000+' }
    ];

    // Seed System Settings
    const SEED_SETTINGS = {
        company: {
            name: 'GearUp Gadgets Pakistan (Pvt) Ltd',
            tagline: 'Your Premier Destination for Cutting-Edge Tech & Gear',
            ntn: '8821902-4',
            strn: '3277876123451',
            phone: '+92 21 35881122',
            supportEmail: 'support@gearupgadgets.com',
            salesEmail: 'orders@gearupgadgets.com',
            address: 'Plot 45-C, Phase 6 Commercial, DHA, Karachi, Pakistan',
            currency: 'PKR (Rs.)',
            taxRate: 0
        },
        couriers: {
            leopard: { name: 'Leopard Courier Express', apiKey: 'LEO-PK-PROD-88912', codEnabled: true, standardFee: 250 },
            tcs: { name: 'TCS Express Pakistan', apiKey: 'TCS-CORP-99014', codEnabled: true, standardFee: 300 },
            trax: { name: 'Trax Logistics', apiKey: 'TRX-LIVE-44102', codEnabled: true, standardFee: 220 }
        },
        paymentGateways: {
            cod: { name: 'Cash on Delivery (COD)', enabled: true },
            bank: { name: 'Direct Bank Wire (Meezan / HBL / Alfalah)', enabled: true, account: '0101-0105882910' },
            jazzcash: { name: 'JazzCash Merchant API', enabled: true, merchantId: 'JC-MERCH-8821' },
            easypaisa: { name: 'EasyPaisa Business IPN', enabled: true, storeId: 'EP-ST-4419' }
        },
        approvals: {
            poThreshold: 100000,
            refundThreshold: 10000,
            expenseThreshold: 25000,
            requireAdminApprovalForPriceChange: true
        }
    };

    // ---------------------------------------------------------
    // 3. CORE STORE CONTROLLER & SYNCHRONIZATION ENGINE
    // ---------------------------------------------------------
    class GugErpCore {
        constructor() {
            this._cachedStorefrontProducts = null;
            this._cacheTimestamp = 0;
            this.init();
        }

        init() {
            this._ensureCategoriesSeed();
            this._ensureBrandsSeed();
            this._ensureSeed(STORAGE_KEYS.WAREHOUSES, SEED_WAREHOUSES);
            this._ensureSeed(STORAGE_KEYS.SUPPLIERS, SEED_SUPPLIERS);
            this._ensureEmployeesSeed();
            this._ensureSeed(STORAGE_KEYS.CUSTOMERS, SEED_CUSTOMERS);
            this._ensureSeed(STORAGE_KEYS.SERIALS, SEED_SERIALS);
            this._ensureSeed(STORAGE_KEYS.RETURNS, SEED_RETURNS);
            this._ensureSeed(STORAGE_KEYS.COUPONS, SEED_COUPONS);
            this._ensureSeed(STORAGE_KEYS.SETTINGS, SEED_SETTINGS);
            this._ensureProductsSeed();
            this._ensureOrdersSeed();
            this._ensureAuditLogSeed();
            this._ensureDealerSeed();
        }

        _ensureSeed(key, defaultData) {
            try {
                const existing = localStorage.getItem(key);
                if (!existing || existing === '[]' || existing === '{}') {
                    localStorage.setItem(key, JSON.stringify(defaultData));
                }
            } catch (e) {
                console.error(`Error initializing ${key}:`, e);
            }
        }

        _ensureCategoriesSeed() {
            try {
                let existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
                if (!Array.isArray(existing)) existing = [];
                const catMap = new Map();
                SEED_CATEGORIES.forEach(c => catMap.set(c.name.toLowerCase(), { ...c }));
                existing.forEach(c => {
                    if (c && c.name) catMap.set(c.name.toLowerCase(), { ...c });
                });
                const merged = Array.from(catMap.values());
                localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
            } catch(e){}
        }

        _ensureBrandsSeed() {
            try {
                let existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.BRANDS) || '[]');
                if (!Array.isArray(existing)) existing = [];
                const brdMap = new Map();
                SEED_BRANDS.forEach(b => brdMap.set(b.name.toLowerCase(), { ...b }));
                existing.forEach(b => {
                    if (b && b.name) brdMap.set(b.name.toLowerCase(), { ...b });
                });
                const merged = Array.from(brdMap.values());
                localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(merged));
            } catch(e){}
        }

        _ensureEmployeesSeed() {
            try {
                let deletedEmps = [];
                try {
                    deletedEmps = JSON.parse(localStorage.getItem('admin_deleted_employees') || '[]').map(s => String(s).toLowerCase());
                } catch(e) { deletedEmps = []; }

                const isSeeded = localStorage.getItem('gug_employees_seeded_flag_v2') === 'true';
                let existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES) || '[]');
                if (!Array.isArray(existing)) existing = [];

                if (!isSeeded) {
                    // Initial one-time seed: only add non-deleted seed records
                    const initial = SEED_EMPLOYEES.filter(e => !deletedEmps.includes(String(e.id).toLowerCase()) && (!e.username || !deletedEmps.includes(String(e.username).toLowerCase())));
                    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(initial));
                    localStorage.setItem('gug_employees_seeded_flag_v2', 'true');
                    return;
                }

                // If already seeded: NEVER resurrect deleted dummy seed employees!
                // Filter existing list strictly against deletedEmps
                const cleaned = existing.filter(e => e && e.id && !deletedEmps.includes(String(e.id).toLowerCase()) && (!e.username || !deletedEmps.includes(String(e.username).toLowerCase())));
                localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(cleaned));
            } catch(e){}
        }

        _ensureProductsSeed() {
            try {
                // One-time master reset of auto-populated product flags to clean default state
                const resetKey = 'gug_product_flags_reset_v4';
                if (!localStorage.getItem(resetKey)) {
                    let oldProducts = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
                    if (Array.isArray(oldProducts) && oldProducts.length > 0) {
                        oldProducts.forEach(p => {
                            p.isFeatured = false;
                            p.onSale = false;
                            p.originalPrice = null;
                            p.saleDiscountPercent = 0;
                        });
                        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(oldProducts));
                    }
                    let customProducts = JSON.parse(localStorage.getItem('admin_custom_products') || '[]');
                    if (Array.isArray(customProducts) && customProducts.length > 0) {
                        customProducts.forEach(p => {
                            p.isFeatured = false;
                            p.onSale = false;
                            p.originalPrice = null;
                            p.saleDiscountPercent = 0;
                        });
                        localStorage.setItem('admin_custom_products', JSON.stringify(customProducts));
                    }
                    localStorage.setItem(resetKey, 'true');
                }

                let existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
                const masterCatalog = (typeof window !== 'undefined' && window.productDatabase) ? window.productDatabase : (typeof productDatabase !== 'undefined' ? productDatabase : []);
                
                if (Array.isArray(masterCatalog) && masterCatalog.length > 0) {
                    const productMap = new Map();
                    masterCatalog.forEach(p => {
                        if (p && p.id) productMap.set(String(p.id), this.sanitizeProductObj({ ...p }));
                    });
                    if (Array.isArray(existing)) {
                        existing.forEach(p => {
                            if (p && p.id) {
                                const base = productMap.get(String(p.id)) || {};
                                productMap.set(String(p.id), { ...base, ...p });
                            }
                        });
                    }
                    const merged = Array.from(productMap.values());
                    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
                    if (typeof window !== 'undefined') {
                        window.PRODUCTS_DATA = merged;
                        window.productDatabase = merged;
                    }
                    // Auto-consolidate duplicates and sum inventory counts
                    this.consolidateDuplicates();
                }
            } catch (e) {
                console.error("Error ensuring product seed:", e);
            }
        }

        _ensureOrdersSeed() {
            try {
                let existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
                if (!existing || existing.length === 0) {
                    const seedOrders = [
                        {
                            id: 'GUG-8821',
                            customer: { name: 'Shahmeer Farooqi', phone: '+92 300 9876543', email: 'shahmeer@gmail.com', city: 'Karachi', address: 'B-14, Block 7, Clifton, Karachi' },
                            items: [{ id: 'PROD-001', title: 'GearUp Ultra Smartwatch Pro Max', quantity: 1, price: 24999, costPrice: 17200, sku: 'GUG-SW-PRO-01' }],
                            subtotal: 24999,
                            shipping: 250,
                            total: 25249,
                            paymentMethod: 'Cash on Delivery (COD)',
                            paymentStatus: 'Pending',
                            orderStatus: 'Processing',
                            courier: 'Leopard Express',
                            trackingNumber: 'LEO-99882211',
                            warehouse: 'WH-01',
                            date: new Date(Date.now() - 3600000 * 2).toISOString(),
                            notes: 'Please deliver after 2:00 PM'
                        },
                        {
                            id: 'GUG-8820',
                            customer: { name: 'Dr. Zainab Tariq', phone: '+92 321 4455667', email: 'zainab.t@hotmail.com', city: 'Lahore', address: 'House 88, Street 4, DHA Phase 5, Lahore' },
                            items: [{ id: 'PROD-002', title: 'PulseANC Wireless Studio Headphones', quantity: 1, price: 18500, costPrice: 11500, sku: 'GUG-AUD-ANC-02' }],
                            subtotal: 18500,
                            shipping: 250,
                            total: 18750,
                            paymentMethod: 'Online Payment (JazzCash)',
                            paymentStatus: 'Paid',
                            orderStatus: 'Shipped',
                            courier: 'Trax Logistics',
                            trackingNumber: 'TRX-77441199',
                            warehouse: 'WH-02',
                            date: new Date(Date.now() - 3600000 * 18).toISOString(),
                            notes: 'Call before arriving'
                        },
                        {
                            id: 'GUG-8819',
                            customer: { name: 'Adnan Mustafa', phone: '+92 333 1122334', email: 'adnan.m@yahoo.com', city: 'Islamabad', address: 'Apartment 4B, Silver Oaks, F-10, Islamabad' },
                            items: [
                                { id: 'PROD-003', title: 'HyperGaN 140W Multi-Port Desktop Charger', quantity: 2, price: 8999, costPrice: 5500, sku: 'GUG-PWR-140W-03' },
                                { id: 'PROD-004', title: 'Vortex Mechanical RGB Wireless Gaming Keyboard', quantity: 1, price: 15999, costPrice: 9900, sku: 'GUG-KB-VRX-04' }
                            ],
                            subtotal: 33997,
                            shipping: 0,
                            total: 33997,
                            paymentMethod: 'Bank Transfer (Meezan Bank)',
                            paymentStatus: 'Paid',
                            orderStatus: 'Delivered',
                            courier: 'TCS Express',
                            trackingNumber: 'TCS-11223344',
                            warehouse: 'WH-03',
                            date: new Date(Date.now() - 3600000 * 48).toISOString(),
                            notes: 'Urgent office deployment'
                        }
                    ];
                    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(seedOrders));
                }
            } catch (e) {
                console.error('Error seeding orders:', e);
            }
        }

        _ensureAuditLogSeed() {
            try {
                let logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || '[]');
                if (!logs || logs.length === 0) {
                    const initialLogs = [
                        {
                            id: 'AUD-001',
                            timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
                            user: 'Khan Super Admin',
                            role: ROLES.SUPER_ADMIN,
                            action: 'SYSTEM_BOOTSTRAP',
                            entity: 'ERP_SYSTEM',
                            entityId: 'CORE-INIT',
                            previousValue: 'None',
                            newValue: 'Commercial Enterprise ERP Initialized',
                            reason: 'System initialization and seed verification',
                            ip: '127.0.0.1'
                        },
                        {
                            id: 'AUD-002',
                            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
                            user: 'Zeeshan Qureshi',
                            role: ROLES.INVENTORY_MANAGER,
                            action: 'STOCK_ADJUSTMENT',
                            entity: 'PRODUCT',
                            entityId: 'PROD-001',
                            previousValue: 'Total Stock: 80',
                            newValue: 'Total Stock: 85 (WH-01: +5 units)',
                            reason: 'Received returned unit verified by warehouse diagnostic',
                            ip: '192.168.1.45'
                        },
                        {
                            id: 'AUD-003',
                            timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
                            user: 'Storefront Checkout',
                            role: 'Customer',
                            action: 'ORDER_PLACED',
                            entity: 'ORDER',
                            entityId: 'GUG-8821',
                            previousValue: 'Cart',
                            newValue: 'Order Total: Rs 25,249 (Stock Reserved in WH-01)',
                            reason: 'Customer placed COD order on web storefront',
                            ip: '39.40.112.5'
                        }
                    ];
                    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(initialLogs));
                }
            } catch (e) {
                console.error('Error seeding audit logs:', e);
            }
        }

        _ensureDealerSeed() {
            try {
                let dealers = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEALERS) || '[]');
                if (!dealers || dealers.length === 0) {
                    const seedDealers = [
                        {
                            id: 'DLR-101',
                            name: 'Muhammad Tariq',
                            shopName: 'Tariq Tech & Gaming Hub',
                            shopNumber: 'Shop # 14-B, 2nd Floor, Hafeez Center, Lahore',
                            cnic: '35201-1234567-1',
                            phone: '0300-1234567',
                            whatsapp: '0300-1234567',
                            residentialAddress: 'House 12, Street 4, Sector G, DHA Phase 5, Lahore',
                            city: 'Lahore',
                            username: 'tariqtech',
                            password: 'dealer123',
                            passwordHash: hashStringSync('dealer123'),
                            status: 'Active',
                            creditLimit: 1500000,
                            openingBalance: 1000000,
                            totalAmount: 1500000,
                            paidAmount: 500000,
                            balanceAmount: 1000000,
                            isAmountClear: false,
                            paymentHistory: [
                                {
                                    id: 'PAY-101-1',
                                    installmentNo: 1,
                                    amount: 500000,
                                    date: '20/10/2026',
                                    day: 'Tuesday',
                                    time: '11:30:00 AM',
                                    balanceAfter: 1000000,
                                    notes: 'Initial deposit via Online Transfer'
                                }
                            ],
                            createdAt: '2026-01-15',
                            notes: 'Authorized wholesale partner for central Punjab'
                        },
                        {
                            id: 'DLR-102',
                            name: 'Kashif Ali',
                            shopName: 'Apex Computer Systems',
                            shopNumber: 'Shop # G-22, Ground Floor, Techno City Mall, Karachi',
                            cnic: '42101-7654321-9',
                            phone: '0321-9876543',
                            whatsapp: '0321-9876543',
                            residentialAddress: 'Flat 402, Al-Ghafoor Tower, Gulshan-e-Iqbal Block 13, Karachi',
                            city: 'Karachi',
                            username: 'apexkarachi',
                            password: 'dealer123',
                            passwordHash: hashStringSync('dealer123'),
                            status: 'Active',
                            creditLimit: 2000000,
                            openingBalance: 0,
                            totalAmount: 2000000,
                            paidAmount: 2000000,
                            balanceAmount: 0,
                            isAmountClear: true,
                            paymentHistory: [
                                {
                                    id: 'PAY-102-1',
                                    installmentNo: 1,
                                    amount: 1000000,
                                    date: '01/10/2026',
                                    day: 'Thursday',
                                    time: '10:15:00 AM',
                                    balanceAfter: 1000000,
                                    notes: '1st Installment Bank PayOrder'
                                },
                                {
                                    id: 'PAY-102-2',
                                    installmentNo: 2,
                                    amount: 1000000,
                                    date: '15/10/2026',
                                    day: 'Thursday',
                                    time: '03:45:00 PM',
                                    balanceAfter: 0,
                                    notes: 'Final Settlement via Cheque (Clear)'
                                }
                            ],
                            createdAt: '2026-02-01',
                            notes: 'High-volume GPU and processor partner'
                        },
                        {
                            id: 'DLR-103',
                            name: 'Bilal Ahmed',
                            shopName: 'Capital Gaming & Rendering Rigs',
                            shopNumber: 'Shop # 08, Mezzanine Floor, Blue Area Computer Plaza, Islamabad',
                            cnic: '61101-3456789-5',
                            phone: '0333-5556677',
                            whatsapp: '0333-5556677',
                            residentialAddress: 'House 88, Street 19, Sector F-8/2, Islamabad',
                            city: 'Islamabad',
                            username: 'capitalrigs',
                            password: 'dealer123',
                            passwordHash: hashStringSync('dealer123'),
                            status: 'Active',
                            creditLimit: 1000000,
                            openingBalance: 750000,
                            totalAmount: 1000000,
                            paidAmount: 250000,
                            balanceAmount: 750000,
                            isAmountClear: false,
                            paymentHistory: [
                                {
                                    id: 'PAY-103-1',
                                    installmentNo: 1,
                                    amount: 250000,
                                    date: '18/10/2026',
                                    day: 'Sunday',
                                    time: '02:00:00 PM',
                                    balanceAfter: 750000,
                                    notes: 'Advance Cash Deposit'
                                }
                            ],
                            createdAt: '2026-02-15',
                            notes: 'Specializes in custom AI workstation rigs'
                        }
                    ];
                    localStorage.setItem(STORAGE_KEYS.DEALERS, JSON.stringify(seedDealers));
                }

                let ledger = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEALER_LEDGER) || '[]');
                if (!ledger || ledger.length === 0) {
                    const seedLedger = [
                        {
                            id: 'DLG-1001',
                            dealerId: 'DLR-101',
                            date: new Date(Date.now() - 3600000 * 24 * 12).toISOString(),
                            type: 'STOCK_ISSUED',
                            referenceNo: 'INV-B2B-1042',
                            description: 'B2B Wholesale Dispatch: 4x RTX 4070 Ti SUPER 16GB + 3x Core i7-14700K',
                            items: [
                                { productId: 'PROD-001', name: 'ASUS TUF RTX 4070 Ti SUPER 16GB', qty: 4, unitPrice: 245000, total: 980000 },
                                { productId: 'PROD-002', name: 'Intel Core i7-14700K Processor', qty: 3, unitPrice: 118000, total: 354000 }
                            ],
                            debit: 1334000,
                            credit: 0,
                            paymentMethod: 'Credit Invoice',
                            recordedBy: 'Khan Super Admin',
                            notes: 'Dispatched via Leopards Overnight to Hafeez Center outlet'
                        },
                        {
                            id: 'DLG-1002',
                            dealerId: 'DLR-101',
                            date: new Date(Date.now() - 3600000 * 24 * 7).toISOString(),
                            type: 'PAYMENT_RECEIVED',
                            referenceNo: 'PAY-MEEZAN-9842',
                            description: 'Bank Transfer Payment via Meezan Bank (A/C: 0102030405)',
                            items: [],
                            debit: 0,
                            credit: 800000,
                            paymentMethod: 'Bank Transfer (Meezan Bank)',
                            recordedBy: 'Farhan Zaidi',
                            notes: 'Partial settlement for Invoice INV-B2B-1042'
                        },
                        {
                            id: 'DLG-1003',
                            dealerId: 'DLR-101',
                            date: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
                            type: 'ADVANCE_PAYMENT',
                            referenceNo: 'ADV-HBL-1102',
                            description: 'Advance Deposit for upcoming RTX 50-Series Stock Allocation',
                            items: [],
                            debit: 0,
                            credit: 200000,
                            paymentMethod: 'Bank Transfer (HBL)',
                            recordedBy: 'Farhan Zaidi',
                            notes: 'Advance security deposit'
                        },
                        {
                            id: 'DLG-1004',
                            dealerId: 'DLR-102',
                            date: new Date(Date.now() - 3600000 * 24 * 9).toISOString(),
                            type: 'STOCK_ISSUED',
                            referenceNo: 'INV-B2B-1055',
                            description: 'Stock Dispatch: 6x Corsair RM850e 850W Gold PSU + 10x 32GB DDR5 Kits',
                            items: [
                                { productId: 'PROD-005', name: 'Corsair RM850e 850W ATX 3.0 Gold PSU', qty: 6, unitPrice: 34500, total: 207000 },
                                { productId: 'PROD-006', name: 'G.Skill Trident Z5 RGB 32GB (2x16GB) DDR5-6000', qty: 10, unitPrice: 32000, total: 320000 }
                            ],
                            debit: 527000,
                            credit: 0,
                            paymentMethod: 'Credit Invoice',
                            recordedBy: 'Khan Super Admin',
                            notes: 'Hand delivered to Techno City Ground Floor outlet'
                        },
                        {
                            id: 'DLG-1005',
                            dealerId: 'DLR-102',
                            date: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
                            type: 'PAYMENT_RECEIVED',
                            referenceNo: 'PAY-CASH-3310',
                            description: 'Cash Payment at Techno City Outlet',
                            items: [],
                            debit: 0,
                            credit: 300000,
                            paymentMethod: 'Cash',
                            recordedBy: 'Ayesha Siddiqui',
                            notes: 'Cash received & deposited to finance desk'
                        }
                    ];
                    localStorage.setItem(STORAGE_KEYS.DEALER_LEDGER, JSON.stringify(seedLedger));
                }
            } catch (e) {
                console.error('Error seeding dealers/ledger:', e);
            }
        }

        // ---------------------------------------------------------
        // 4. AUDIT LOGGER
        // ---------------------------------------------------------
        logAudit({ action, entity, entityId, previousValue = 'N/A', newValue = 'N/A', reason = 'Regular Operation', user = null, role = null }) {
            try {
                const currentUser = user || localStorage.getItem('admin_username') || 'System';
                const currentRole = role || localStorage.getItem('admin_role') || ROLES.ADMIN;
                const logs = this.getAuditLogs();
                
                const entry = {
                    id: 'AUD-' + Date.now().toString(36).toUpperCase(),
                    timestamp: new Date().toISOString(),
                    user: currentUser,
                    role: currentRole,
                    action: action.toUpperCase(),
                    entity: entity.toUpperCase(),
                    entityId: String(entityId || 'N/A'),
                    previousValue: typeof previousValue === 'object' ? JSON.stringify(previousValue) : String(previousValue),
                    newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue),
                    reason: reason,
                    ip: '127.0.0.1 (Local Session)'
                };

                logs.unshift(entry);
                if (logs.length > 500) logs.pop();
                localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
                return entry;
            } catch (e) {
                console.error('Error logging audit record:', e);
            }
        }

        getAuditLogs() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || '[]');
        }

        // ---------------------------------------------------------
        // 5. RBAC & GRANULAR MODULE PERMISSION CHECKER
        // ---------------------------------------------------------
        getModulesList() {
            return ERP_MODULES;
        }

        getRoleDefaultPermissions(role) {
            if (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
                return ALL_MODULE_KEYS;
            }
            if (role === ROLES.HR_MANAGER) {
                return ['hr', 'tasks', 'reports', 'audit'];
            }
            if (role === ROLES.SALES_MANAGER) {
                return ['products', 'crm', 'orders', 'returns', 'tasks', 'reports'];
            }
            if (role === ROLES.SALES_EMPLOYEE) {
                return ['products', 'crm', 'orders', 'tasks'];
            }
            if (role === ROLES.INVENTORY_MANAGER) {
                return ['products', 'inventory', 'purchasing', 'returns', 'tasks', 'reports'];
            }
            if (role === ROLES.WAREHOUSE_STAFF) {
                return ['products', 'inventory', 'purchasing', 'orders', 'logistics', 'returns', 'tasks'];
            }
            if (role === ROLES.ACCOUNTANT) {
                return ['orders', 'logistics', 'finance', 'purchasing', 'reports', 'hr', 'tasks'];
            }
            if (role === ROLES.CUSTOMER_SUPPORT) {
                return ['products', 'crm', 'orders', 'logistics', 'returns', 'tasks'];
            }
            if (role === ROLES.MARKETING_MANAGER) {
                return ['products', 'banners', 'crm', 'tasks', 'reports'];
            }
            return ['products', 'orders', 'tasks'];
        }

        hasPermission(moduleKey, action = 'view') {
            const user = this.getCurrentUser();
            if (!user.isLoggedIn) return false;
            if (user.role === ROLES.SUPER_ADMIN || user.username === 'admin') return true;

            // Check custom module permissions array
            if (Array.isArray(user.permissions) && user.permissions.length > 0) {
                if (user.permissions.includes(moduleKey) || user.permissions.includes('*')) return true;
                // 'products' permission includes access to 'banners' (Sales Campaign & Top Banner)
                if (moduleKey === 'banners' && user.permissions.includes('products')) return true;
                return false;
            }

            // Fallback to role-level default matrix
            const perms = ROLE_PERMISSIONS[user.role];
            if (!perms) return false;
            const modulePerms = perms[moduleKey];
            if (!modulePerms) return false;
            return modulePerms.includes(action) || modulePerms.includes('view_dept') || modulePerms.includes('all');
        }

        getCurrentUser() {
            const path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname.split('/').pop() : '';
            const isStaffPortal = path === 'employee-portal.html' || path === 'staff-login.html';
            const isDealerPortal = path === 'dealer-portal.html' || path === 'dealer-login.html';
            const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : new URLSearchParams();
            const isStaffView = urlParams.get('staff_view') === '1';
            const isStaffLoggedIn = localStorage.getItem('staff_logged_in') === 'true';
            const isAdminLoggedIn = localStorage.getItem('admin_logged_in') === 'true';

            // 1. If actively in Staff View, Staff Portal, or Staff session without an active admin session
            if (isStaffView || isStaffPortal || (isStaffLoggedIn && !isAdminLoggedIn)) {
                const username = localStorage.getItem('staff_username') || 'staff';
                const staffId = localStorage.getItem('staff_user_id');
                const role = localStorage.getItem('staff_role') || ROLES.WAREHOUSE_STAFF;
                
                // Actively check live employee database first for the freshest permissions
                let permissions = [];
                try {
                    const employees = this.getEmployees();
                    const cleanId = String(staffId || '').toLowerCase();
                    const cleanUser = String(username || '').toLowerCase();
                    const emp = employees.find(e => 
                        (e.id && String(e.id).toLowerCase() === cleanId) || 
                        (e.username && String(e.username).toLowerCase() === cleanUser)
                    );
                    if (emp && Array.isArray(emp.permissions) && emp.permissions.length > 0) {
                        permissions = [...emp.permissions];
                        try { localStorage.setItem('staff_permissions', JSON.stringify(permissions)); } catch(e) {}
                    }
                } catch(e) {}

                if (!permissions || permissions.length === 0) {
                    try {
                        const storedPerms = localStorage.getItem('staff_permissions');
                        if (storedPerms) permissions = JSON.parse(storedPerms);
                    } catch(e) {}
                }

                if ((!permissions || permissions.length === 0) && username) {
                    if (role === ROLES.SUPER_ADMIN || username === 'admin') {
                        permissions = [...ALL_MODULE_KEYS];
                    } else {
                        permissions = this.getRoleDefaultPermissions(role);
                    }
                }

                return {
                    id: localStorage.getItem('staff_user_id') || 'EMP-005',
                    name: localStorage.getItem('staff_name') || 'Staff Member',
                    username: username,
                    role: role,
                    department: localStorage.getItem('staff_department') || 'Operations',
                    permissions: permissions,
                    isLoggedIn: true,
                    isStaff: true
                };
            }

            // 2. Default to Master Super Admin session
            const adminName = localStorage.getItem('admin_name') || 'Khan (Super Admin)';
            const adminUsername = localStorage.getItem('admin_username') || 'admin';
            return {
                id: 'EMP-001',
                name: adminName,
                username: adminUsername,
                role: ROLES.SUPER_ADMIN,
                department: 'Executive Administration',
                permissions: [...ALL_MODULE_KEYS],
                isLoggedIn: isAdminLoggedIn,
                isStaff: false
            };
        }

        getStaffSession() {
            const isStaff = localStorage.getItem('staff_logged_in') === 'true';
            const isAdmin = localStorage.getItem('admin_logged_in') === 'true';
            if (!isStaff && !isAdmin) return null;

            const user = this.getCurrentUser();
            const emp = this.getEmployeeById(user.id) || this.getEmployeeByUsername(user.username);
            return {
                ...user,
                empRecord: emp || null
            };
        }

        staffLogout() {
            const user = this.getCurrentUser();
            if (user && (user.id || user.username)) {
                this.recordEmployeeLogout(user.id || user.username);
            }
            this.logAudit({
                action: 'STAFF_PORTAL_LOGOUT',
                entity: 'AUTH_SESSION',
                entityId: user.id || user.username,
                newValue: 'Session Terminated',
                reason: 'Employee logged out of Staff Workspace Portal',
                user: user.name,
                role: user.role
            });

            localStorage.removeItem('staff_logged_in');
            localStorage.removeItem('staff_username');
            localStorage.removeItem('staff_user_id');
            localStorage.removeItem('staff_name');
            localStorage.removeItem('staff_role');
            localStorage.removeItem('staff_permissions');
            localStorage.removeItem('staff_department');
            sessionStorage.removeItem('gug_staff_auth_session');
            // Retain admin session if present so Super Admin testing remains seamless

            window.location.href = 'admin.html';
        }

        normalizePhoneNumber(raw) {
            if (!raw) return { raw: '', local: '', e164: '', intl: '', isLandline: false };
            const str = String(raw).trim().replace(/[\s\-\(\)]/g, '');
            const isLandline = /^(\+92|92|0)?(21|42|51|22|41|55|61|81)/.test(str);
            let clean = str;
            let local = str;
            let intl = str;
            let e164 = str;

            if (clean.startsWith('+92')) {
                intl = clean.substring(1);
                local = '0' + clean.substring(3);
                e164 = clean;
            } else if (clean.startsWith('92')) {
                intl = clean;
                local = '0' + clean.substring(2);
                e164 = '+' + clean;
            } else if (clean.startsWith('0')) {
                local = clean;
                intl = '92' + clean.substring(1);
                e164 = '+92' + clean.substring(1);
            } else if (clean.startsWith('+')) {
                e164 = clean;
                intl = clean.substring(1);
                local = clean;
            } else {
                intl = '92' + clean;
                e164 = '+92' + clean;
                local = '0' + clean;
            }

            return { raw, local, intl, e164, isLandline };
        }

        getAdminAccount() {
            try {
                const stored = localStorage.getItem('gug_admin_account');
                const isManuallyEnabled = localStorage.getItem('gug_admin_2fa_manual_active') === 'true';
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.username) {
                        return {
                            username: parsed.username || 'admin',
                            name: parsed.name || 'Khan (Super Admin)',
                            email: parsed.email || 'admin@gearupgadgets.com',
                            phone: parsed.phone || '021 34832214',
                            password: parsed.password || 'admingug',
                            twoFactorEnabled: isManuallyEnabled && (parsed.twoFactorEnabled === true),
                            twoFactorMethod: parsed.twoFactorMethod || 'both',
                            smsGatewayProvider: parsed.smsGatewayProvider || 'custom',
                            smsGatewayUrl: parsed.smsGatewayUrl || '',
                            smsApiToken: parsed.smsApiToken || '',
                            smsSenderId: parsed.smsSenderId || 'GearUp',
                            emailWebhookUrl: parsed.emailWebhookUrl || ''
                        };
                    }
                }
            } catch(e) {}

            const defaultAccount = {
                username: 'admin',
                name: 'Khan (Super Admin)',
                email: 'admin@gearupgadgets.com',
                phone: '021 34832214',
                password: 'admingug',
                twoFactorEnabled: false,
                twoFactorMethod: 'both',
                smsGatewayProvider: 'custom',
                smsGatewayUrl: '',
                smsApiToken: '',
                smsSenderId: 'GearUp',
                emailWebhookUrl: ''
            };
            try {
                localStorage.setItem('gug_admin_account', JSON.stringify(defaultAccount));
            } catch(e) {}
            return defaultAccount;
        }

        saveAdminAccount(accountData) {
            if (!accountData) return { success: false, message: 'Account data is required.' };
            
            const currentAccount = this.getAdminAccount();
            const username = (accountData.username || currentAccount.username).trim().toLowerCase();
            const name = (accountData.name || currentAccount.name).trim();
            const email = (accountData.email || currentAccount.email).trim();
            const phone = (accountData.phone || currentAccount.phone).trim();
            const twoFactorEnabled = Boolean(accountData.twoFactorEnabled === true);
            const twoFactorMethod = accountData.twoFactorMethod || currentAccount.twoFactorMethod || 'both';
            const smsGatewayProvider = accountData.smsGatewayProvider || currentAccount.smsGatewayProvider || 'custom';
            const smsGatewayUrl = (accountData.smsGatewayUrl !== undefined ? accountData.smsGatewayUrl : (currentAccount.smsGatewayUrl || '')).trim();
            const smsApiToken = (accountData.smsApiToken !== undefined ? accountData.smsApiToken : (currentAccount.smsApiToken || '')).trim();
            const smsSenderId = (accountData.smsSenderId !== undefined ? accountData.smsSenderId : (currentAccount.smsSenderId || 'GearUp')).trim();
            const emailWebhookUrl = (accountData.emailWebhookUrl !== undefined ? accountData.emailWebhookUrl : (currentAccount.emailWebhookUrl || '')).trim();
            
            if (twoFactorEnabled) {
                localStorage.setItem('gug_admin_2fa_manual_active', 'true');
            } else {
                localStorage.setItem('gug_admin_2fa_manual_active', 'false');
            }
            
            // Password change check if provided
            let newPassword = currentAccount.password;
            if (accountData.newPassword) {
                if (accountData.currentPassword && accountData.currentPassword !== currentAccount.password) {
                    return { success: false, message: 'The current password you entered is incorrect.' };
                }
                if (accountData.newPassword.length < 5) {
                    return { success: false, message: 'New password must be at least 5 characters long.' };
                }
                newPassword = accountData.newPassword;
            }

            const updated = {
                username,
                name,
                email,
                phone,
                password: newPassword,
                twoFactorEnabled,
                twoFactorMethod,
                smsGatewayProvider,
                smsGatewayUrl,
                smsApiToken,
                smsSenderId,
                emailWebhookUrl,
                updatedAt: new Date().toISOString()
            };

            localStorage.setItem('gug_admin_account', JSON.stringify(updated));

            // Keep EMP-001 in employees list synchronized
            try {
                const employees = this.getEmployees();
                const emp001 = employees.find(e => e.id === 'EMP-001' || e.role === ROLES.SUPER_ADMIN);
                if (emp001) {
                    emp001.name = name;
                    emp001.username = username;
                    emp001.email = email;
                    emp001.phone = phone;
                    emp001.passwordHash = hashStringSync(newPassword);
                    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
                }
            } catch(e) {}

            // If admin is currently logged in, sync session variables
            if (localStorage.getItem('admin_logged_in') === 'true') {
                localStorage.setItem('admin_username', username);
                localStorage.setItem('admin_name', name);
            }

            this.logAudit({
                action: 'ADMIN_ACCOUNT_UPDATED',
                entity: 'ADMIN_SECURITY',
                entityId: username,
                newValue: `Admin: ${name} (@${username}) • 2FA: ${twoFactorEnabled ? 'Enabled (' + twoFactorMethod + ')' : 'Disabled'}`,
                reason: 'Super Admin updated profile credentials or 2FA security preferences',
                user: name,
                role: 'Super Admin'
            });

            // Trigger cloud sync if active
            try {
                if (window.GUG_FIREBASE_SYNC && typeof window.GUG_FIREBASE_SYNC.pushToFirebase === 'function') {
                    window.GUG_FIREBASE_SYNC.pushToFirebase('settings');
                }
            } catch(e) {}

            return { success: true, message: 'Admin account settings and security preferences saved successfully.', account: updated };
        }

        // Two-Factor Authentication methods
        generate2FACode() {
            const admin = this.getAdminAccount();
            const code = String(Math.floor(100000 + Math.random() * 900000));
            const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
            const method = admin.twoFactorMethod || 'both';

            const sessionData = {
                code: code,
                expiresAt: expiresAt,
                phone: admin.phone,
                email: admin.email,
                method: method,
                attempts: 0
            };

            sessionStorage.setItem('gug_admin_2fa_session', JSON.stringify(sessionData));

            // Log security audit without exposing raw code
            this.logAudit({
                action: '2FA_OTP_DISPATCHED',
                entity: 'AUTH_2FA',
                entityId: admin.username,
                newValue: `OTP security challenge dispatched via channel: ${method} (Phone: ${admin.phone || 'N/A'}, Email: ${admin.email || 'N/A'})`,
                reason: 'Two-Factor Authentication challenge triggered on login',
                user: admin.name,
                role: 'Super Admin'
            });

            // Execute real API dispatch according to configured channels
            this.dispatch2FAChannels(admin, code, method);

            // SECURITY: Never return code in client-facing return object!
            return {
                success: true,
                phone: admin.phone,
                email: admin.email,
                method: method,
                expiresInSeconds: 300
            };
        }

        dispatch2FAChannels(admin, code, method) {
            const shouldSendSMS = (method === 'phone' || method === 'both');
            const shouldSendEmail = (method === 'email' || method === 'both');
            const normPhone = this.normalizePhoneNumber(admin.phone);
            const smsText = `Gear Up Gadgets ERP: Your 2FA security OTP verification code is ${code}. Valid for 5 minutes. Do not share this code.`;
            const encodedSms = encodeURIComponent(smsText);

            // 1. Email Channel Dispatch (Sends to registered Gmail)
            if (shouldSendEmail && admin.email) {
                const emailSubject = `Gear Up Gadgets ERP - Admin 2FA Verification Code: ${code}`;
                const emailBodyText = `Your One-Time Password (OTP) verification code for Gear Up Gadgets Admin Portal is: ${code}\n\nThis code will expire in 5 minutes.\nIf you did not attempt to log in, please secure your account immediately.`;

                // A. Direct Web3Forms REST API (Sends actual email directly to Gmail from client)
                try {
                    fetch('https://api.web3forms.com/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({
                            access_key: '5b1a62dc-d6f7-4148-9366-07f0f63ecfc6',
                            email: admin.email,
                            from_name: 'Gear Up Gadgets Security',
                            subject: emailSubject,
                            message: emailBodyText
                        })
                    }).catch(() => {});
                } catch(e) {}

                // B. Custom Email Webhook if provided by admin
                const emailApiUrl = (admin.emailWebhookUrl || (this.getSetting && this.getSetting('admin_email_api_url')) || '').trim();
                if (emailApiUrl) {
                    try {
                        const targetEmailUrl = emailApiUrl
                            .replace(/\{\{EMAIL\}\}/g, encodeURIComponent(admin.email))
                            .replace(/\{\{CODE\}\}/g, encodeURIComponent(code))
                            .replace(/\{\{SUBJECT\}\}/g, encodeURIComponent(emailSubject));
                        
                        if (targetEmailUrl.includes('?') || targetEmailUrl.toLowerCase().includes('get')) {
                            fetch(targetEmailUrl, { method: 'GET', mode: 'no-cors' }).catch(() => {});
                        } else {
                            fetch(targetEmailUrl, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    to: admin.email,
                                    email: admin.email,
                                    subject: emailSubject,
                                    code: code,
                                    message: emailBodyText
                                })
                            }).catch(() => {});
                        }
                    } catch(e) {}
                }

                // C. Firestore 'mail' collection (Firebase Trigger Email Extension)
                try {
                    if (window.db && typeof window.db.collection === 'function') {
                        window.db.collection('mail').add({
                            to: admin.email,
                            message: {
                                subject: emailSubject,
                                text: emailBodyText,
                                html: `<div style="font-family: Arial, sans-serif; max-width: 500px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 10px; background: #0b0f13; color: #ffffff;">
                                    <h3 style="color: #db2724; margin-top: 0;">Gear Up Gadgets ERP</h3>
                                    <p style="color: #cbd5e1; font-size: 14px;">A login attempt was initiated for your Master Admin account. Use the verification code below to authorize entry:</p>
                                    <div style="background: #14191f; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
                                        <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #ffffff;">${code}</span>
                                    </div>
                                    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Code validity: 5 minutes. Do not share this OTP with anyone.</p>
                                </div>`
                            }
                        }).catch(() => {});
                    }
                } catch(e) {}
            }

            // 2. SMS Channel Dispatch (Sends to registered Mobile Phone)
            if (shouldSendSMS && admin.phone) {
                const gatewayUrl = (admin.smsGatewayUrl || (this.getSetting && this.getSetting('admin_sms_gateway_url')) || '').trim();
                const sender = admin.smsSenderId || 'GearUp';
                const token = admin.smsApiToken || '';

                if (gatewayUrl) {
                    try {
                        const targetUrl = gatewayUrl
                            .replace(/\{\{PHONE\}\}/g, encodeURIComponent(normPhone.intl))
                            .replace(/\{\{E164\}\}/g, encodeURIComponent(normPhone.e164))
                            .replace(/\{\{LOCAL_PHONE\}\}/g, encodeURIComponent(normPhone.local))
                            .replace(/\{\{RAW_PHONE\}\}/g, encodeURIComponent(normPhone.raw))
                            .replace(/\{\{CODE\}\}/g, encodeURIComponent(code))
                            .replace(/\{\{MESSAGE\}\}/g, encodedSms)
                            .replace(/\{\{MSG\}\}/g, encodedSms)
                            .replace(/\{\{SENDER\}\}/g, encodeURIComponent(sender))
                            .replace(/\{\{TOKEN\}\}/g, encodeURIComponent(token));

                        if (targetUrl.includes('?') || targetUrl.toLowerCase().includes('get')) {
                            fetch(targetUrl, { method: 'GET', mode: 'no-cors' })
                                .then(() => console.log('2FA SMS GET request dispatched successfully'))
                                .catch(err => console.warn('2FA SMS GET error:', err));
                        } else {
                            fetch(targetUrl, {
                                method: 'POST',
                                mode: 'no-cors',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    to: normPhone.e164,
                                    phone: normPhone.intl,
                                    receiver: normPhone.local,
                                    rawPhone: normPhone.raw,
                                    message: smsText,
                                    code: code,
                                    sender: sender,
                                    token: token
                                })
                            }).then(() => console.log('2FA SMS POST request dispatched successfully'))
                              .catch(err => console.warn('2FA SMS POST error:', err));
                        }
                    } catch(e) {
                        console.warn('SMS dispatch exception:', e);
                    }
                }

                // Record in Firestore 'otp_dispatches' for carrier logs and webhooks
                try {
                    if (window.db && typeof window.db.collection === 'function') {
                        window.db.collection('otp_dispatches').add({
                            recipient: normPhone.e164 || admin.phone,
                            localPhone: normPhone.local,
                            intlPhone: normPhone.intl,
                            type: 'sms',
                            email: admin.email,
                            channel: method,
                            code: code,
                            status: 'dispatched',
                            gatewayUrl: gatewayUrl ? (gatewayUrl.substring(0, 30) + '...') : 'unconfigured',
                            createdAt: new Date().toISOString()
                        }).catch(() => {});
                    }
                } catch(e) {}
            }
        }

        async testSMSGateway(phone, gatewayUrl, token, sender) {
            if (!phone) return { success: false, message: 'Please enter a valid phone number to test.' };
            const norm = this.normalizePhoneNumber(phone);
            if (norm.isLandline) {
                return { success: false, message: `The number "${phone}" is a landline. Landline numbers cannot receive SMS. Please enter a valid mobile number (e.g. 0300 1234567 or +92 300 1234567).` };
            }
            if (!gatewayUrl) {
                return { success: false, message: 'SMS Gateway URL is empty. Please enter your SMS provider API or Webhook URL.' };
            }

            const testCode = String(Math.floor(100000 + Math.random() * 900000));
            const smsText = `Gear Up Gadgets ERP: Test OTP is ${testCode}. SMS Gateway connection verified.`;
            const encodedSms = encodeURIComponent(smsText);

            const targetUrl = gatewayUrl
                .replace(/\{\{PHONE\}\}/g, encodeURIComponent(norm.intl))
                .replace(/\{\{E164\}\}/g, encodeURIComponent(norm.e164))
                .replace(/\{\{LOCAL_PHONE\}\}/g, encodeURIComponent(norm.local))
                .replace(/\{\{RAW_PHONE\}\}/g, encodeURIComponent(norm.raw))
                .replace(/\{\{CODE\}\}/g, encodeURIComponent(testCode))
                .replace(/\{\{MESSAGE\}\}/g, encodedSms)
                .replace(/\{\{MSG\}\}/g, encodedSms)
                .replace(/\{\{SENDER\}\}/g, encodeURIComponent(sender || 'GearUp'))
                .replace(/\{\{TOKEN\}\}/g, encodeURIComponent(token || ''));

            try {
                if (targetUrl.includes('?') || targetUrl.toLowerCase().includes('get')) {
                    await fetch(targetUrl, { method: 'GET', mode: 'no-cors' });
                } else {
                    await fetch(targetUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: norm.e164,
                            phone: norm.intl,
                            receiver: norm.local,
                            message: smsText,
                            code: testCode,
                            sender: sender || 'GearUp',
                            token: token || ''
                        })
                    });
                }
                return { success: true, message: `Test SMS request successfully sent to ${norm.e164} via Gateway. Check your mobile device.` };
            } catch(e) {
                return { success: false, message: 'Network request to SMS Gateway failed: ' + e.message };
            }
        }

        async testEmailGateway(email, webhookUrl) {
            if (!email || !email.includes('@')) {
                return { success: false, message: 'Please enter a valid email address (e.g. yourname@gmail.com).' };
            }
            const testCode = String(Math.floor(100000 + Math.random() * 900000));
            const emailSubject = `Gear Up Gadgets ERP - Test Verification: ${testCode}`;
            const emailBody = `Your test 2FA OTP code is ${testCode}. Valid for 5 minutes. Gear Up Gadgets ERP Security.`;

            try {
                // Direct Web3Forms REST
                await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        access_key: '5b1a62dc-d6f7-4148-9366-07f0f63ecfc6',
                        email: email,
                        from_name: 'Gear Up Gadgets Security',
                        subject: emailSubject,
                        message: emailBody
                    })
                });

                if (webhookUrl && webhookUrl.trim()) {
                    fetch(webhookUrl.trim(), {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: email, subject: emailSubject, code: testCode, message: emailBody })
                    }).catch(() => {});
                }

                return { success: true, message: `Test email dispatched to ${email}! Please check your Gmail inbox (and Spam/Promotions folder).` };
            } catch(e) {
                return { success: false, message: 'Email dispatch error: ' + e.message };
            }
        }

        verify2FACode(inputCode) {
            try {
                const sessionRaw = sessionStorage.getItem('gug_admin_2fa_session');
                if (!sessionRaw) {
                    return { success: false, message: 'No active 2FA verification session found. Please try logging in again.' };
                }

                const session = JSON.parse(sessionRaw);
                if (Date.now() > session.expiresAt) {
                    sessionStorage.removeItem('gug_admin_2fa_session');
                    return { success: false, message: 'Verification code has expired. Please request a new code.' };
                }

                if (session.attempts >= 5) {
                    sessionStorage.removeItem('gug_admin_2fa_session');
                    return { success: false, message: 'Too many incorrect attempts. Please initiate login again.' };
                }

                const cleanInput = String(inputCode || '').trim();
                if (cleanInput === String(session.code)) {
                    sessionStorage.removeItem('gug_admin_2fa_session');
                    return { success: true, message: 'Verification successful.' };
                } else {
                    session.attempts = (session.attempts || 0) + 1;
                    sessionStorage.setItem('gug_admin_2fa_session', JSON.stringify(session));
                    const remaining = 5 - session.attempts;
                    return { success: false, message: `Incorrect verification code. ${remaining} attempt(s) remaining.` };
                }
            } catch(e) {
                return { success: false, message: 'Verification failed: ' + e.message };
            }
        }

        authenticateStaff(username, password) {
            if (!username || !password) return { success: false, message: 'Username and password are required.' };
            
            const cleanUser = username.toString().trim().toLowerCase();
            const cleanPass = password.toString().trim();
            const passHash = hashStringSync(cleanPass);
            const employees = this.getEmployees();

            // Check against Master Admin (Exact dynamic credentials)
            const adminAcc = this.getAdminAccount();
            if ((cleanUser === (adminAcc.username || 'admin').toLowerCase() || cleanUser === 'superadmin') && 
                (cleanPass === adminAcc.password || passHash === hashStringSync(adminAcc.password))) {
                return {
                    success: true,
                    employee: {
                        id: 'EMP-001',
                        name: adminAcc.name || 'Khan (Super Admin)',
                        username: adminAcc.username || 'admin',
                        email: adminAcc.email,
                        phone: adminAcc.phone,
                        role: ROLES.SUPER_ADMIN,
                        department: 'Executive',
                        permissions: [...ALL_MODULE_KEYS]
                    }
                };
            }

            // Check dynamically registered employees
            const match = employees.find(e => {
                const eUser = (e.username || '').toLowerCase();
                const eEmail = (e.email || '').toLowerCase();
                const eId = (e.id || '').toLowerCase();
                return (eUser === cleanUser || eEmail === cleanUser || eId === cleanUser);
            });

            if (!match) {
                return { success: false, message: 'Invalid username or password.' };
            }

            if (match.isPaused || match.status === 'Paused' || match.status === 'Suspended' || this.isEmployeeSuspended(match.id)) {
                return { 
                    success: false, 
                    isPaused: true, 
                    message: '⛔ Your employee ID has been PAUSED / SUSPENDED by Administrator. Access to Management Staff Panel is restricted. Please contact HR or Super Admin.' 
                };
            }

            if (match.status === 'Inactive') {
                return { success: false, message: 'Your employee account has been deactivated. Please contact HR or Super Admin.' };
            }

            // Check password hash or plain check with assigned password
            const isMatch = (match.passwordHash && match.passwordHash === passHash) || 
                            (match.password && match.password === password);

            if (!isMatch) {
                return { success: false, message: 'Invalid username or password.' };
            }

            return {
                success: true,
                employee: match
            };
        }

        enforceAccessControl() {
            const user = this.getCurrentUser();
            const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('?')[0].split('#')[0];

            // Allow login pages and employee portal to manage their own view
            if (path === 'admin.html' || path === 'staff-login.html' || path === 'employee-portal.html' || path === 'dealer-login.html' || path === 'dealer-portal.html') {
                if (path === 'dealer-portal.html' && localStorage.getItem('dealer_logged_in') !== 'true') {
                    window.location.href = 'dealer-login.html';
                }
                return;
            }

            // 0. Strict Dealer Isolation Check: Dealer sessions cannot access Master Admin Panel or Staff routes
            const isDealerSession = localStorage.getItem('dealer_logged_in') === 'true';
            if (isDealerSession && localStorage.getItem('admin_logged_in') !== 'true' && localStorage.getItem('staff_logged_in') !== 'true') {
                window.location.href = 'dealer-portal.html';
                return;
            }

            // 1. Check if inside an iframe / embedded staff view
            const urlParams = new URLSearchParams(window.location.search);
            const isEmbedded = (window.self !== window.top) || (urlParams.get('staff_view') === '1');
            if (isEmbedded) {
                document.body.classList.add('is-embedded');
                const internalSidebar = document.querySelector('.admin-sidebar');
                if (internalSidebar) internalSidebar.style.display = 'none';
                const mainEl = document.querySelector('.admin-main');
                if (mainEl) {
                    mainEl.style.marginLeft = '0';
                    mainEl.style.padding = '15px 25px';
                }
            }

            // 2. Check suspension if staff
            if (user.isStaff && user.id) {
                if (this.isEmployeeSuspended(user.id) || this.isEmployeeSuspended(user.username)) {
                    const staffName = user.name || localStorage.getItem('staff_name') || 'Staff Member';
                    if (typeof showStaffPausedLockdownModal === 'function') {
                        showStaffPausedLockdownModal(staffName, user.id);
                    }
                    return;
                }
            }

            // 3. Super Admin has absolute master access: NOTHING is ever hidden or removed
            if (user.role === ROLES.SUPER_ADMIN || user.username === 'admin' || (!user.isStaff && localStorage.getItem('admin_logged_in') === 'true')) {
                this._filterSidebarNav(user);
                return;
            }

            // 4. Page-level permission check for Staff:
            const pageToModuleMap = {
                'products.html': 'products',
                'admin-sales.html': 'banners',
                'admin-crm.html': 'crm',
                'admin-marketing.html': 'crm',
                'admin-inventory.html': 'inventory',
                'admin-purchasing.html': 'purchasing',
                'orders.html': 'orders',
                'admin-logistics.html': 'logistics',
                'admin-returns.html': 'returns',
                'admin-finance.html': 'finance',
                'admin-staff.html': 'hr',
                'admin-tasks.html': 'tasks',
                'admin-dealers.html': 'dealers',
                'admin-reports.html': 'reports',
                'admin-audit.html': 'audit',
                'admin-settings.html': 'settings',
                'dashboard.html': 'dashboard'
            };

            const requiredModule = pageToModuleMap[path];
            const userPerms = Array.isArray(user.permissions) ? user.permissions : [];

            // If user has 'products' access, grant access to 'banners' (Sales Campaign & Top Banner)
            const hasModuleAccess = requiredModule && (userPerms.includes(requiredModule) || (requiredModule === 'banners' && userPerms.includes('products')));

            if (requiredModule && !hasModuleAccess) {
                // Staff member lacks permission for this page!
                // Redirect them to their first allowed page or employee-portal
                const moduleKeyToFileMap = {
                    'products': 'products.html',
                    'banners': 'admin-sales.html',
                    'crm': 'admin-crm.html',
                    'inventory': 'admin-inventory.html',
                    'purchasing': 'admin-purchasing.html',
                    'orders': 'orders.html',
                    'logistics': 'admin-logistics.html',
                    'returns': 'admin-returns.html',
                    'dealers': 'admin-dealers.html',
                    'finance': 'admin-finance.html',
                    'hr': 'admin-staff.html',
                    'tasks': 'admin-tasks.html',
                    'reports': 'admin-reports.html',
                    'audit': 'admin-audit.html',
                    'settings': 'admin-settings.html'
                };
                const firstAllowedKey = userPerms.find(k => moduleKeyToFileMap[k]);
                const targetFile = firstAllowedKey ? moduleKeyToFileMap[firstAllowedKey] : 'employee-portal.html';
                console.warn(`[RBAC] Access denied for module "${requiredModule}". Redirecting to ${targetFile}...`);
                window.location.replace(targetFile);
                return;
            }

            // 5. Filter and hide unauthorized sidebar navigation items
            this._filterSidebarNav(user);
        }

        _filterSidebarNav(user) {
            const sidebar = document.querySelector('.admin-sidebar');
            if (!sidebar) return;

            // If user is Super Admin: EVERYTHING must be visible
            if (!user || user.role === ROLES.SUPER_ADMIN || user.username === 'admin' || (!user.isStaff && localStorage.getItem('admin_logged_in') === 'true')) {
                ERP_MODULES.forEach(mod => {
                    const navLink = sidebar.querySelector('#' + mod.navId);
                    if (navLink) {
                        navLink.style.display = 'flex';
                        navLink.removeAttribute('data-rbac-hidden');
                    }
                });
                const dashLink = sidebar.querySelector('#nav-dashboard');
                if (dashLink) {
                    dashLink.style.display = 'flex';
                    dashLink.removeAttribute('data-rbac-hidden');
                }

                // Ensure all accordion groups are visible
                sidebar.querySelectorAll('.sidebar-accordion-group').forEach(grp => {
                    grp.style.display = 'block';
                });
                const settingsSec = sidebar.querySelector('#nav-settings')?.closest('.mt-3.pt-3.border-top');
                if (settingsSec) settingsSec.style.display = 'block';

                const empWs = sidebar.querySelector('a[href="employee-portal.html"]');
                if (empWs) empWs.style.display = 'flex';
                const dealerV = sidebar.querySelector('a[href="dealer-portal.html"]');
                if (dealerV) dealerV.style.display = 'flex';
                return;
            }

            // User is Staff: Strictly hide any module without permission
            const userPerms = Array.isArray(user.permissions) ? user.permissions : [];

            // 1. Dashboard link:
            const dashLink = sidebar.querySelector('#nav-dashboard');
            if (dashLink) {
                if (userPerms.includes('dashboard')) {
                    dashLink.style.display = 'flex';
                    dashLink.removeAttribute('data-rbac-hidden');
                } else {
                    dashLink.style.display = 'none';
                    dashLink.setAttribute('data-rbac-hidden', 'true');
                }
            }

            // 2. Module links:
            ERP_MODULES.forEach(mod => {
                const navLink = sidebar.querySelector('#' + mod.navId);
                if (navLink) {
                    if (userPerms.includes(mod.key)) {
                        navLink.style.display = 'flex';
                        navLink.removeAttribute('data-rbac-hidden');
                    } else {
                        navLink.style.display = 'none';
                        navLink.setAttribute('data-rbac-hidden', 'true');
                    }
                }
            });

            // 3. Extra links in CRM/Marketing
            const mktLink = sidebar.querySelector('#nav-marketing');
            if (mktLink) {
                if (userPerms.includes('crm') || userPerms.includes('marketing')) {
                    mktLink.style.display = 'flex';
                    mktLink.removeAttribute('data-rbac-hidden');
                } else {
                    mktLink.style.display = 'none';
                    mktLink.setAttribute('data-rbac-hidden', 'true');
                }
            }

            // 4. Accordion groups: hide completely if 0 visible links
            const accordionGroups = sidebar.querySelectorAll('.sidebar-accordion-group');
            accordionGroups.forEach(grp => {
                const visibleLinks = Array.from(grp.querySelectorAll('.admin-nav-link')).filter(l => l.style.display !== 'none' && !l.getAttribute('data-rbac-hidden'));
                if (visibleLinks.length === 0) {
                    grp.style.display = 'none';
                } else {
                    grp.style.display = 'block';
                    // Auto-open accordion containing visible items
                    const header = grp.querySelector('.sidebar-accordion-header');
                    const body = grp.querySelector('.sidebar-accordion-body');
                    if (header && body) {
                        header.classList.add('open');
                        body.classList.add('open');
                    }
                }
            });

            // 5. Standalone section: System & Settings
            const settingsSec = sidebar.querySelector('#nav-settings')?.closest('.mt-3.pt-3.border-top');
            if (settingsSec) {
                const visibleLinks = Array.from(settingsSec.querySelectorAll('.admin-nav-link')).filter(l => l.style.display !== 'none' && !l.getAttribute('data-rbac-hidden'));
                if (visibleLinks.length === 0) {
                    settingsSec.style.display = 'none';
                } else {
                    settingsSec.style.display = 'block';
                }
            }

            // 6. Bottom links: hide redundant Employee Workspace link and Dealer Portal (if not in dealers)
            const empWs = sidebar.querySelector('a[href="employee-portal.html"]');
            if (empWs) empWs.style.display = 'none';
            const dealerV = sidebar.querySelector('a[href="dealer-portal.html"]');
            if (dealerV && !userPerms.includes('dealers')) dealerV.style.display = 'none';

            // 7. Inject Staff Identity Card in Sidebar (if not already present)
            if (!sidebar.querySelector('#staff-sidebar-profile-card')) {
                const brandHeader = sidebar.querySelector('.d-flex.align-items-center.mb-3.px-2');
                if (brandHeader) {
                    const badgeHtml = `
                    <div id="staff-sidebar-profile-card" class="px-2.5 py-2 mb-2 rounded-3 border border-danger border-opacity-40" style="background: rgba(220, 38, 38, 0.12);">
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <span class="badge bg-danger py-0.5 px-2 fw-bold" style="font-size: 9.5px; letter-spacing: 0.5px;">STAFF WORKSPACE</span>
                            <code class="text-white-50" style="font-size: 10px;">${user.id || 'STAFF'}</code>
                        </div>
                        <div class="fw-bold text-white small text-truncate">${user.name}</div>
                        <div class="text-white-50" style="font-size: 11px;">@${user.username} &bull; ${user.role}</div>
                        <div class="text-secondary" style="font-size: 10.5px;"><i class="fas fa-building text-danger me-1"></i> ${user.department || 'Operations'}</div>
                    </div>`;
                    brandHeader.insertAdjacentHTML('afterend', badgeHtml);
                }
            }

            // 8. Update Sign Out link to staff logout
            const signOutBtn = sidebar.querySelector('.admin-nav-link.text-danger[onclick*="admin_logged_in"]');
            if (signOutBtn) {
                signOutBtn.setAttribute('onclick', "if(window.GUG_DB) window.GUG_DB.staffLogout(); else { localStorage.removeItem('staff_logged_in'); window.location.href='staff-login.html'; } return false;");
                signOutBtn.innerHTML = '<i class="fas fa-sign-out-alt me-2"></i> Exit Workspace';
            }
        }

        _renderStaffIsolationBlockedPage(user) {
            const mainEl = document.querySelector('.admin-main') || document.querySelector('.container') || document.body;
            mainEl.innerHTML = `
                <div class="container py-5">
                    <div class="card border-0 shadow-sm mx-auto text-center p-4 p-md-5" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; border-top: 5px solid var(--accent-red) !important;">
                        <div class="mb-4">
                            <span class="badge bg-danger bg-opacity-10 text-danger p-3 rounded-circle" style="font-size: 34px;">
                                <i class="fas fa-shield-cat"></i>
                            </span>
                        </div>
                        <h3 class="text-dark fw-bold mb-2">Staff Panel Isolation Active</h3>
                        <p class="text-secondary mb-3" style="font-size: 14px;">
                            You are currently authenticated in the <strong>Management Staff Portal</strong> as <strong class="text-dark">${user.name}</strong> (@${user.username} &bull; <span class="badge bg-danger">${user.role}</span>).
                        </p>
                        <div class="alert alert-warning text-dark small text-start mb-4">
                            <i class="fas fa-lock text-danger me-2"></i>
                            <strong>Strict Panel Separation:</strong> Master Admin ERP routes are strictly reserved for Super Administrators. All your assigned operational tools and permitted modules must be operated directly inside your <strong>Staff Workspace</strong>.
                        </div>
                        <div class="d-flex justify-content-center gap-2 flex-wrap">
                            <a href="employee-portal.html" class="btn btn-danger btn-sm px-4 fw-bold"><i class="fas fa-id-badge me-1"></i> Open My Staff Portal Workspace</a>
                            <a href="index.html" class="btn btn-outline-dark btn-sm px-3" target="_blank"><i class="fas fa-store me-1"></i> View Live Storefront</a>
                        </div>
                    </div>
                </div>
            `;
            // Hide sidebar if present
            const sidebar = document.querySelector('.admin-sidebar');
            if (sidebar) sidebar.style.display = 'none';
            if (mainEl.classList.contains('admin-main')) mainEl.style.marginLeft = '0';
        }

        _renderAccessDeniedPage(moduleKey, user) {
            const modInfo = ERP_MODULES.find(m => m.key === moduleKey) || { name: moduleKey, icon: 'fa-lock' };
            const mainEl = document.querySelector('.admin-main') || document.querySelector('.container') || document.body;

            mainEl.innerHTML = `
                <div class="container py-5">
                    <div class="card border-0 shadow-sm mx-auto text-center p-4 p-md-5" style="max-width: 650px; background-color: #ffffff; border-radius: 16px; border-top: 5px solid var(--accent-red) !important;">
                        <div class="mb-4">
                            <span class="badge bg-danger bg-opacity-10 text-danger p-3 rounded-circle" style="font-size: 32px;">
                                <i class="fas fa-shield-halved"></i>
                            </span>
                        </div>
                        <h3 class="text-dark fw-bold mb-2">Access Restricted to ${modInfo.name}</h3>
                        <p class="text-secondary mb-4" style="font-size: 14.5px;">
                            Your user account (<strong>@${user.username}</strong> &bull; <span class="badge bg-secondary">${user.role}</span>) does not currently have permission to access the <strong>${modInfo.name}</strong> module.
                        </p>
                        <div class="p-3 bg-light rounded-3 mb-4 text-start border border-secondary border-opacity-25" style="font-size: 13px;">
                            <div class="text-dark fw-bold mb-1"><i class="fas fa-info-circle text-danger me-2"></i> How to get access:</div>
                            <span class="text-secondary">Please contact your HR Administrator or Super Admin to update your module permissions in the <strong>HR, Payroll & Role Access Control</strong> module.</span>
                        </div>
                        <div class="d-flex justify-content-center gap-2 flex-wrap">
                            <a href="employee-portal.html" class="btn btn-danger btn-sm px-3"><i class="fas fa-id-badge me-1"></i> Return to Staff Workspace</a>
                            <a href="index.html" class="btn btn-outline-dark btn-sm px-3" target="_blank"><i class="fas fa-store me-1"></i> Verify Storefront</a>
                        </div>
                    </div>
                </div>
            `;
            // Also filter sidebar
            this._filterSidebarNav(user);
        }

        // ---------------------------------------------------------
        // 6. GLOBAL SEARCH ENGINE (Across All Entities)
        // ---------------------------------------------------------
        globalSearch(query) {
            const q = (query || '').toLowerCase().trim();
            if (!q || q.length < 2) return [];

            const results = [];
            const products = this.getProducts();
            const orders = this.getOrders();
            const customers = this.getCustomers();
            const suppliers = this.getSuppliers();
            const serials = this.getSerials();
            const returns = this.getReturns();
            const employees = this.getEmployees();

            // 1. Search Products
            products.forEach(p => {
                if (p.title.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q))) {
                    results.push({
                        type: 'Product',
                        title: p.title,
                        subtitle: `SKU: ${p.sku} | Price: Rs. ${p.sellingPrice.toLocaleString()}`,
                        badge: 'Catalog',
                        link: `products.html?search=${encodeURIComponent(p.sku || p.title)}`
                    });
                }
            });

            // 2. Search Orders
            orders.forEach(o => {
                const custName = (o.customer && o.customer.name) || o.name || '';
                const custPhone = (o.customer && o.customer.phone) || o.phone || '';
                if (o.id.toLowerCase().includes(q) || custName.toLowerCase().includes(q) || custPhone.includes(q) || (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q))) {
                    results.push({
                        type: 'Order',
                        title: `Order #${o.id} - ${custName}`,
                        subtitle: `Total: Rs. ${(o.total || 0).toLocaleString()} | Status: ${o.orderStatus || o.status}`,
                        badge: 'Sales',
                        link: `orders.html?search=${encodeURIComponent(o.id)}`
                    });
                }
            });

            // 3. Search Serial Numbers
            serials.forEach(s => {
                if (s.serial.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Serial Number',
                        title: `Serial: ${s.serial}`,
                        subtitle: `${s.productTitle} | Warehouse: ${s.warehouse} | Status: ${s.status}`,
                        badge: 'Hardware Tracking',
                        link: `admin-returns.html?serial=${encodeURIComponent(s.serial)}`
                    });
                }
            });

            // 4. Search Customers
            customers.forEach(c => {
                if (c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Customer',
                        title: `${c.name} (${c.segment} Segment)`,
                        subtitle: `${c.city} | Orders: ${c.totalOrders} | Spent: Rs. ${c.lifetimeSpend.toLocaleString()}`,
                        badge: 'CRM',
                        link: `admin-crm.html?search=${encodeURIComponent(c.name)}`
                    });
                }
            });

            // 5. Search Suppliers
            suppliers.forEach(s => {
                if (s.name.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)) {
                    results.push({
                        type: 'Supplier',
                        title: `${s.name}`,
                        subtitle: `Contact: ${s.contactPerson} | Payable: Rs. ${s.balancePayable.toLocaleString()}`,
                        badge: 'Purchasing',
                        link: `admin-purchasing.html?search=${encodeURIComponent(s.name)}`
                    });
                }
            });

            // 6. Search Employees
            employees.forEach(e => {
                if (e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || (e.department && e.department.toLowerCase().includes(q))) {
                    results.push({
                        type: 'Staff',
                        title: `${e.name} - ${e.role}`,
                        subtitle: `${e.department} | ${e.email}`,
                        badge: 'HR',
                        link: `admin-staff.html?search=${encodeURIComponent(e.name)}`
                    });
                }
            });

            return results.slice(0, 10);
        }

        // ---------------------------------------------------------
        // 7. GETTERS & MUTATORS FOR ALL CONNECTED DOMAINS
        // ---------------------------------------------------------
        sanitizeProductText(str) {
            if (!str || typeof str !== 'string') return (str || '');
            return str
                .replace(/\(\+\u00F6E\s*<\s*2\s*\)/gi, '')
                .replace(/\+\u00F6E\s*\\?u003c\s*2\s*/gi, '')
                .replace(/\+\u00F6E\s*<\s*2\s*/gi, '')
                .replace(/\(\+\u00F6E\s*<\)/gi, '')
                .replace(/\+\u00F6E\s*</gi, '')
                .replace(/\+\u00F6E/gi, '')
                .replace(/\(\+\s*<\s*\)/g, '')
                .replace(/-\u00C7\u00F4/g, ' - ')
                .replace(/-\u00C7\u00E6/g, '-')
                .replace(/-\u00C7\u00A6/g, '"')
                .replace(/-\u00E4\u00F3/g, '')
                .replace(/RTX\u00E4\u00F3/g, 'RTX')
                .replace(/Intel-\u00AB/g, 'Intel')
                .replace(/Core-\u00E4\u00F3/g, 'Core')
                .replace(/PCIe-\u00AB/g, 'PCIe')
                .replace(/NVMe-\u00AB/g, 'NVMe')
                .replace(/262-\u00A6/g, '270\u00B0')
                .replace(/\+\u00F9/g, 'x')
                .replace(/\u00C2\u00B0/g, '\u00B0')
                .replace(/\u00C3\u00A2\u201A\u00AC\u00A8/g, 'Rs. ')
                .replace(/\u00C3\u00A2\u201A\u00AC\u201D/g, ' - ')
                .replace(/\s{2,}/g, ' ')
                .trim();
        }

        sanitizeProductObj(product) {
            if (!product) return product;
            if (product.title) product.title = this.sanitizeProductText(product.title);
            if (product.name) product.name = this.sanitizeProductText(product.name);
            if (product.description) product.description = this.sanitizeProductText(product.description);
            if (product.shortDescription) product.shortDescription = this.sanitizeProductText(product.shortDescription);
            return product;
        }

        getProducts() {
            const now = Date.now();
            if (this._cachedProducts && Array.isArray(this._cachedProducts) && (now - (this._cachedProductsTime || 0) < 4000)) {
                return this._cachedProducts;
            }
            const sanitizeProductObj = (product) => this.sanitizeProductObj(product);

            const master = (typeof window !== 'undefined' && window.productDatabase) ? window.productDatabase : (typeof productDatabase !== 'undefined' ? productDatabase : (window.PRODUCTS_DATA || []));
            let saved = [];
            let customAdded = [];
            let deletedIds = [];

            try {
                saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
            } catch(e){ saved = []; }

            try {
                customAdded = JSON.parse(localStorage.getItem('admin_custom_products') || '[]');
            } catch(e){ customAdded = []; }

            try {
                deletedIds = JSON.parse(localStorage.getItem('admin_deleted_products') || '[]').map(String);
            } catch(e){ deletedIds = []; }

            const productMap = new Map();

            // 1. Load all master products (133 computer hardware, laptops, peripherals, gadgets)
            if (Array.isArray(master)) {
                master.forEach(p => {
                    if (p && p.id && !deletedIds.includes(String(p.id))) {
                        productMap.set(String(p.id), this.sanitizeProductObj({ ...p }));
                    }
                });
            }

            // 2. Overlay any saved modifications from localStorage
            if (Array.isArray(saved)) {
                saved.forEach(p => {
                    if (p && p.id && !deletedIds.includes(String(p.id))) {
                        productMap.set(String(p.id), this.sanitizeProductObj({ ...p }));
                    }
                });
            }

            // 3. Overlay any custom added items from admin/staff panels
            if (Array.isArray(customAdded)) {
                customAdded.forEach(p => {
                    if (p && p.id && !deletedIds.includes(String(p.id))) {
                        productMap.set(String(p.id), this.sanitizeProductObj({ ...p }));
                    }
                });
            }

            const unifiedProducts = Array.from(productMap.values());

            // High-Performance O(1) Hash Map Deduplication
            const uniqueMap = new Map();
            const skuLookup = new Map();
            const nameLookup = new Map();
            const normalize = (s) => (s ? String(s).toLowerCase().trim().replace(/[^a-z0-9]/g, '') : '');

            unifiedProducts.forEach(p => {
                if (!p) return;
                const normSku = normalize(p.sku);
                const normName = normalize(p.title || p.name);

                let foundKey = null;
                if (normSku && skuLookup.has(normSku)) {
                    foundKey = skuLookup.get(normSku);
                } else if (normName && nameLookup.has(normName)) {
                    foundKey = nameLookup.get(normName);
                }

                if (!foundKey) {
                    const pKey = String(p.id);
                    uniqueMap.set(pKey, { ...p });
                    if (normSku) skuLookup.set(normSku, pKey);
                    if (normName) nameLookup.set(normName, pKey);
                } else {
                    const master = uniqueMap.get(foundKey);
                    if (master) {
                        const mStock = this.normalizeProductStock(master.stock);
                        const dStock = this.normalizeProductStock(p.stock);
                        Object.keys(dStock).forEach(city => {
                            mStock[city] = (mStock[city] || 0) + (Number(dStock[city]) || 0);
                        });
                        let tot = 0;
                        Object.values(mStock).forEach(q => tot += Number(q || 0));
                        master.stock = mStock;
                        master.totalStock = tot;
                        if (p.isFeatured) master.isFeatured = true;
                        if (p.onSale) master.onSale = true;
                        if (normSku && !skuLookup.has(normSku)) skuLookup.set(normSku, foundKey);
                        if (normName && !nameLookup.has(normName)) nameLookup.set(normName, foundKey);
                    }
                }
            });

            const consolidatedProducts = Array.from(uniqueMap.values());
            this._cachedProducts = consolidatedProducts;
            this._cachedProductsTime = now;
            
            // Sync to window global
            if (typeof window !== 'undefined') {
                window.PRODUCTS_DATA = consolidatedProducts;
                if (!window.productDatabase || window.productDatabase.length !== consolidatedProducts.length) {
                    window.productDatabase = consolidatedProducts;
                }
            }

            return consolidatedProducts;
        }

        getProductStockCount(p) {
            if (!p) return 0;
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
        }

        formatStockBadge(stockCount, options = {}) {
            const count = Math.max(0, Number(stockCount || 0));
            const compact = options.compact || false;
            if (count > 5) {
                const text = `${count} stocks available`;
                if (compact) {
                    return `<span class="stock-badge in-stock" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);padding:2px 6px;border-radius:4px;white-space:nowrap;"><i class="fas fa-boxes-stacked" style="font-size:9px;"></i> ${text}</span>`;
                }
                return `<span class="stock-badge in-stock" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#10b981;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);padding:3px 8px;border-radius:4px;white-space:nowrap;"><i class="fas fa-boxes-stacked"></i> ${text}</span>`;
            } else if (count > 0) {
                const text = count === 1 ? `Only 1 stock left` : `Only ${count} stocks are left`;
                if (compact) {
                    return `<span class="stock-badge low-stock" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.35);padding:2px 6px;border-radius:4px;white-space:nowrap;"><i class="fas fa-fire" style="font-size:9px;"></i> ${text}</span>`;
                }
                return `<span class="stock-badge low-stock" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.35);padding:3px 8px;border-radius:4px;white-space:nowrap;"><i class="fas fa-fire"></i> ${text}</span>`;
            } else {
                const text = `Out of stock`;
                if (compact) {
                    return `<span class="stock-badge out-of-stock" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);padding:2px 6px;border-radius:4px;white-space:nowrap;"><i class="fas fa-circle-xmark" style="font-size:9px;"></i> ${text}</span>`;
                }
                return `<span class="stock-badge out-of-stock" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);padding:3px 8px;border-radius:4px;white-space:nowrap;"><i class="fas fa-circle-xmark"></i> ${text}</span>`;
            }
        }

        invalidateProductCache() {
            this._cachedProducts = null;
            this._cachedProductsTime = 0;
            this._cachedStorefrontProducts = null;
            this._cacheTimestamp = 0;
            if (typeof window !== 'undefined') {
                window._shopCatalogCache = null;
                window._shopCatalogCacheTime = 0;
            }
        }

        getStorefrontProducts() {
            const now = Date.now();
            if (this._cachedStorefrontProducts && Array.isArray(this._cachedStorefrontProducts) && (now - this._cacheTimestamp < 5000)) {
                return this._cachedStorefrontProducts;
            }
            const products = this.getProducts();
            const storefront = products.filter(p => p.status !== 'Draft').map(p => {
                const cleanPrice = typeof p.sellingPrice === 'number' ? p.sellingPrice : parseFloat(String(p.sellingPrice || p.price || 0).replace(/[^0-9.]/g, '')) || 0;
                let totalStock = this.getProductStockCount(p);
                const origPrice = (p.onSale && p.originalPrice) ? (typeof p.originalPrice === 'number' ? p.originalPrice : parseFloat(String(p.originalPrice).replace(/[^0-9.]/g, '')) || null) : null;
                const stockText = totalStock > 5 
                    ? `${totalStock} stocks available` 
                    : (totalStock > 0 ? (totalStock === 1 ? `Only 1 stock left` : `Only ${totalStock} stocks are left`) : `Out of stock`);

                return {
                    ...p,
                    id: p.id,
                    numericId: p.numericId || p.id,
                    name: p.title || p.name,
                    title: p.title || p.name,
                    category: p.category || 'Accessories',
                    brand: p.brand || 'GearUp Pro',
                    price: cleanPrice,
                    sellingPrice: cleanPrice,
                    originalPrice: origPrice,
                    image: p.image || 'assets/images/logo.png',
                    description: p.description || '',
                    inStock: totalStock > 0,
                    totalStock: totalStock,
                    stockQuantity: totalStock,
                    stockText: stockText,
                    isNew: Boolean(p.isNew),
                    isFeatured: Boolean(p.isFeatured),
                    isBestSeller: Boolean(p.isBestSeller),
                    onSale: Boolean(p.onSale)
                };
            });
            this._cachedStorefrontProducts = storefront;
            this._cacheTimestamp = now;
            return storefront;
        }

        saveProduct(productData) {
            this.invalidateProductCache();
            const products = this.getProducts();
            const idx = products.findIndex(p => p.id === productData.id || (productData.sku && p.sku === productData.sku));
            const isEdit = idx !== -1;
            const previous = isEdit ? products[idx] : null;

            if (isEdit) {
                products[idx] = { ...products[idx], ...productData };
            } else {
                productData.id = productData.id || 'PROD-' + String(products.length + 1).padStart(3, '0');
                productData.name = productData.name || productData.title;
                productData.title = productData.title || productData.name;
                productData.price = productData.sellingPrice;
                products.unshift(productData);
            }

            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

            // Auto-register custom category if new
            if (productData.category && typeof productData.category === 'string') {
                const catTrimmed = productData.category.trim();
                if (catTrimmed) {
                    try {
                        let cats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
                        if (!cats.some(c => c.name && c.name.toLowerCase() === catTrimmed.toLowerCase())) {
                            cats.push({
                                id: 'CAT-' + String(cats.length + 1).padStart(2, '0'),
                                name: catTrimmed,
                                slug: catTrimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                                icon: 'fa-box',
                                subcategories: []
                            });
                            localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
                        }
                    } catch(e){}
                }
            }

            // Auto-register custom brand if new
            if (productData.brand && typeof productData.brand === 'string') {
                const brandTrimmed = productData.brand.trim();
                if (brandTrimmed) {
                    try {
                        let brds = JSON.parse(localStorage.getItem(STORAGE_KEYS.BRANDS) || '[]');
                        if (!brds.some(b => b.name && b.name.toLowerCase() === brandTrimmed.toLowerCase())) {
                            brds.push({
                                id: 'BRD-' + String(brds.length + 1).padStart(2, '0'),
                                name: brandTrimmed,
                                logo: 'assets/images/logo.png',
                                status: 'Active',
                                isFeatured: false,
                                description: `${brandTrimmed} official product distribution`
                            });
                            localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(brds));
                        }
                    } catch(e){}
                }
            }

            // Auto-register custom inventory cities from stock
            if (productData.stock && typeof productData.stock === 'object') {
                Object.keys(productData.stock).forEach(city => {
                    this.saveInventoryCity(city);
                });
            }

            // Synchronize with global window data & custom override storage for storefront
            if (typeof window !== 'undefined') {
                window.PRODUCTS_DATA = products;
                if (window.productDatabase) {
                    window.productDatabase = products;
                }
                window.dispatchEvent(new CustomEvent('productsReady', { detail: { products } }));
                window.dispatchEvent(new CustomEvent('gugProductsUpdated', { detail: { product: productData } }));
            }

            // Sync with legacy admin_custom_products for backwards compatibility
            try {
                let custom = JSON.parse(localStorage.getItem('admin_custom_products') || '[]');
                const cIdx = custom.findIndex(c => c.id === productData.id);
                if (cIdx !== -1) custom[cIdx] = productData;
                else custom.unshift(productData);
                localStorage.setItem('admin_custom_products', JSON.stringify(custom));
            } catch(e){}

            this.logAudit({
                action: isEdit ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
                entity: 'PRODUCT',
                entityId: productData.id,
                previousValue: previous ? `${previous.title} (Rs. ${previous.sellingPrice})` : 'New Product',
                newValue: `${productData.title} (Rs. ${productData.sellingPrice})`,
                reason: isEdit ? 'Admin modified product details' : 'Admin added new catalog product'
            });
            return productData;
        }

        deleteProduct(id) {
            this.invalidateProductCache();
            let products = this.getProducts();
            const prod = products.find(p => p.id === id);
            products = products.filter(p => p.id !== id);
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

            // Sync with global window data & storefront
            if (typeof window !== 'undefined') {
                window.PRODUCTS_DATA = products;
                if (window.productDatabase) {
                    window.productDatabase = products;
                }
                window.dispatchEvent(new CustomEvent('productsReady', { detail: { products } }));
                window.dispatchEvent(new CustomEvent('gugProductsUpdated', { detail: { deletedId: id } }));
            }

            try {
                let deleted = JSON.parse(localStorage.getItem('admin_deleted_products') || '[]');
                if (!deleted.includes(String(id))) deleted.push(String(id));
                localStorage.setItem('admin_deleted_products', JSON.stringify(deleted));
            } catch(e){}

            this.logAudit({
                action: 'PRODUCT_DELETED',
                entity: 'PRODUCT',
                entityId: id,
                previousValue: prod ? prod.title : id,
                newValue: 'Deleted from Catalog'
            });
            return true;
        }

        consolidateDuplicates() {
            // 1. Gather all current products across all layers
            const master = (typeof window !== 'undefined' && window.productDatabase) ? window.productDatabase : (typeof productDatabase !== 'undefined' ? productDatabase : (window.PRODUCTS_DATA || []));
            let saved = [];
            let customAdded = [];
            let deletedIds = [];

            try {
                saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
            } catch(e){ saved = []; }

            try {
                customAdded = JSON.parse(localStorage.getItem('admin_custom_products') || '[]');
            } catch(e){ customAdded = []; }

            try {
                deletedIds = JSON.parse(localStorage.getItem('admin_deleted_products') || '[]').map(String);
            } catch(e){ deletedIds = []; }

            const productMap = new Map();
            if (Array.isArray(master)) {
                master.forEach(p => {
                    if (p && p.id && !deletedIds.includes(String(p.id))) {
                        productMap.set(String(p.id), this.sanitizeProductObj({ ...p }));
                    }
                });
            }
            if (Array.isArray(saved)) {
                saved.forEach(p => {
                    if (p && p.id && !deletedIds.includes(String(p.id))) {
                        productMap.set(String(p.id), this.sanitizeProductObj({ ...p }));
                    }
                });
            }
            if (Array.isArray(customAdded)) {
                customAdded.forEach(p => {
                    if (p && p.id && !deletedIds.includes(String(p.id))) {
                        productMap.set(String(p.id), this.sanitizeProductObj({ ...p }));
                    }
                });
            }

            const allProducts = Array.from(productMap.values());
            if (allProducts.length === 0) {
                return { status: 'empty', message: 'No products loaded in database.' };
            }

            const normalize = (str) => {
                if (!str || typeof str !== 'string') return '';
                return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            };

            // Group by normalized SKU or normalized Title/Name using O(1) Hash Maps
            const groups = new Map();
            const skuToGroupKey = new Map();
            const nameToGroupKey = new Map();

            allProducts.forEach(p => {
                const normSku = normalize(p.sku);
                const normName = normalize(p.title || p.name);

                let foundKey = null;
                if (normSku && skuToGroupKey.has(normSku)) {
                    foundKey = skuToGroupKey.get(normSku);
                } else if (normName && nameToGroupKey.has(normName)) {
                    foundKey = nameToGroupKey.get(normName);
                }

                const targetKey = foundKey || (normSku ? `sku:${normSku}` : `name:${normName}`);
                if (!groups.has(targetKey)) {
                    groups.set(targetKey, []);
                }
                groups.get(targetKey).push(p);

                if (normSku && !skuToGroupKey.has(normSku)) skuToGroupKey.set(normSku, targetKey);
                if (normName && !nameToGroupKey.has(normName)) nameToGroupKey.set(normName, targetKey);
            });

            let groupsConsolidated = 0;
            let duplicatesRemoved = 0;
            let totalStockMerged = 0;
            const duplicateIdsToDelete = [];
            const masterProductsToUpdate = [];
            const details = [];

            for (let [groupKey, items] of groups.entries()) {
                if (items.length <= 1) continue;

                groupsConsolidated++;

                // Elect Master:
                // 1. Avoid entries with '-copy' in id/title
                // 2. Prefer standard prefix ID (PROD-001, PROD-A4T, PROD-BLD, PROD-NET, PROD-EVN)
                // 3. Shortest ID or lowest numeric
                items.sort((a, b) => {
                    const aCopy = String(a.id).includes('copy') || String(a.title || '').includes('copy');
                    const bCopy = String(b.id).includes('copy') || String(b.title || '').includes('copy');
                    if (aCopy && !bCopy) return 1;
                    if (!aCopy && bCopy) return -1;
                    return String(a.id).localeCompare(String(b.id));
                });

                const master = { ...items[0] };
                const duplicates = items.slice(1);

                // Consolidate stock
                let combinedStock = this.normalizeProductStock(master.stock);
                let stockAddedForThisProduct = 0;

                duplicates.forEach(dup => {
                    duplicateIdsToDelete.push(String(dup.id));
                    const dStock = this.normalizeProductStock(dup.stock);
                    Object.keys(dStock).forEach(city => {
                        const qty = Number(dStock[city]) || 0;
                        combinedStock[city] = (combinedStock[city] || 0) + qty;
                        stockAddedForThisProduct += qty;
                    });

                    // Enrich master attributes if missing
                    if (!master.barcode && dup.barcode) master.barcode = dup.barcode;
                    if ((!master.image || master.image.includes('placeholder')) && dup.image) master.image = dup.image;
                    if (!master.description && dup.description) master.description = dup.description;
                    if (!master.shortDescription && dup.shortDescription) master.shortDescription = dup.shortDescription;
                    if (!master.brand && dup.brand) master.brand = dup.brand;
                    if (!master.category && dup.category) master.category = dup.category;
                    if (!master.warranty && dup.warranty) master.warranty = dup.warranty;
                    if (!master.isFeatured && dup.isFeatured) master.isFeatured = true;
                    if (!master.onSale && dup.onSale) master.onSale = true;
                });

                let totalStockUnits = 0;
                Object.values(combinedStock).forEach(q => totalStockUnits += Number(q || 0));

                master.stock = combinedStock;
                master.totalStock = totalStockUnits;

                totalStockMerged += stockAddedForThisProduct;
                duplicatesRemoved += duplicates.length;

                masterProductsToUpdate.push(master);
                details.push({
                    masterId: master.id,
                    title: master.title || master.name,
                    sku: master.sku,
                    duplicateCount: duplicates.length,
                    duplicateIds: duplicates.map(d => d.id),
                    stockAdded: stockAddedForThisProduct,
                    finalTotalStock: totalStockUnits,
                    stockBreakdown: combinedStock
                });
            }

            if (duplicatesRemoved === 0) {
                return {
                    status: 'clean',
                    message: 'No duplicate products found. Catalog is 100% unique and consolidated.',
                    totalProducts: allProducts.length,
                    groupsConsolidated: 0,
                    duplicatesRemoved: 0,
                    totalStockMerged: 0
                };
            }

            // Step 1: Securely update and save all Master Listings FIRST
            let updatedSaved = [...saved];
            masterProductsToUpdate.forEach(m => {
                const idx = updatedSaved.findIndex(p => p.id === m.id);
                if (idx !== -1) {
                    updatedSaved[idx] = m;
                } else {
                    updatedSaved.push(m);
                }
            });

            // Step 2: Only after master listings are updated, permanently remove duplicates
            const cleanSaved = updatedSaved.filter(p => !duplicateIdsToDelete.includes(String(p.id)));
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(cleanSaved));

            // Clean admin_custom_products
            try {
                let custom = JSON.parse(localStorage.getItem('admin_custom_products') || '[]');
                if (Array.isArray(custom)) {
                    masterProductsToUpdate.forEach(m => {
                        const cIdx = custom.findIndex(p => p.id === m.id);
                        if (cIdx !== -1) custom[cIdx] = m;
                    });
                    const cleanCustom = custom.filter(p => !duplicateIdsToDelete.includes(String(p.id)));
                    localStorage.setItem('admin_custom_products', JSON.stringify(cleanCustom));
                }
            } catch(e){}

            // Register deleted IDs into admin_deleted_products so they never reappear
            try {
                let deleted = JSON.parse(localStorage.getItem('admin_deleted_products') || '[]');
                if (!Array.isArray(deleted)) deleted = [];
                const deletedSet = new Set(deleted.map(String));
                duplicateIdsToDelete.forEach(id => deletedSet.add(String(id)));
                localStorage.setItem('admin_deleted_products', JSON.stringify(Array.from(deletedSet)));
            } catch(e){}

            // Sync with global window objects & notify live components
            this.invalidateProductCache();
            const refreshed = this.getProducts();
            if (typeof window !== 'undefined') {
                window.PRODUCTS_DATA = refreshed;
                window.productDatabase = refreshed;
                window.dispatchEvent(new CustomEvent('productsReady', { detail: { products: refreshed } }));
                window.dispatchEvent(new CustomEvent('gugProductsUpdated', { detail: { action: 'consolidate', duplicatesRemoved } }));
            }

            // Step 3: Record ERP Audit Log
            this.logAudit({
                action: 'CATALOG_CONSOLIDATION',
                entity: 'PRODUCTS',
                entityId: 'BATCH-DEDUPLICATION',
                previousValue: `${allProducts.length} listings`,
                newValue: `${allProducts.length - duplicatesRemoved} unique listings`,
                reason: `Consolidated ${groupsConsolidated} duplicate groups, merged ${totalStockMerged} stock units, and permanently deleted ${duplicatesRemoved} duplicate entries.`
            });

            return {
                status: 'success',
                message: `Successfully consolidated ${groupsConsolidated} duplicate groups! Removed ${duplicatesRemoved} duplicate listings and safely merged ${totalStockMerged} stock units into master products.`,
                totalScanned: allProducts.length,
                uniqueProducts: allProducts.length - duplicatesRemoved,
                groupsConsolidated,
                duplicatesRemoved,
                totalStockMerged,
                details
            };
        }

        getCategories() {
            let saved = [];
            try {
                saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
            } catch(e){ saved = []; }
            if (!Array.isArray(saved)) saved = [];

            const products = this.getProducts();
            const prodCats = [...new Set(products.map(p => p.category).filter(Boolean))];

            const catMap = new Map();
            SEED_CATEGORIES.forEach(c => catMap.set(c.name.toLowerCase(), { ...c }));
            saved.forEach(c => {
                if (c && c.name) catMap.set(c.name.toLowerCase(), { ...c });
            });
            prodCats.forEach(catName => {
                if (!catMap.has(catName.toLowerCase())) {
                    catMap.set(catName.toLowerCase(), {
                        id: 'CAT-' + String(catMap.size + 1).padStart(2, '0'),
                        name: catName,
                        slug: catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                        icon: 'fa-box',
                        subcategories: []
                    });
                }
            });

            return Array.from(catMap.values());
        }

        getBrands() {
            let saved = [];
            try {
                saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.BRANDS) || '[]');
            } catch(e){ saved = []; }
            if (!Array.isArray(saved)) saved = [];

            const products = this.getProducts();
            const prodBrands = [...new Set(products.map(p => p.brand).filter(Boolean))];

            const brdMap = new Map();
            SEED_BRANDS.forEach(b => brdMap.set(b.name.toLowerCase(), { ...b }));
            saved.forEach(b => {
                if (b && b.name) brdMap.set(b.name.toLowerCase(), { ...b });
            });
            prodBrands.forEach(brandName => {
                if (!brdMap.has(brandName.toLowerCase())) {
                    brdMap.set(brandName.toLowerCase(), {
                        id: 'BRD-' + String(brdMap.size + 1).padStart(2, '0'),
                        name: brandName,
                        logo: 'assets/images/logo.png',
                        status: 'Active',
                        isFeatured: true,
                        description: `${brandName} official product distribution`
                    });
                }
            });

            return Array.from(brdMap.values());
        }

        getInventoryCities() {
            let cities = ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Rawalpindi', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad'];
            try {
                const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY_CITIES) || '[]');
                if (Array.isArray(stored)) {
                    stored.forEach(c => {
                        if (c && typeof c === 'string') {
                            const trimmed = c.trim();
                            if (trimmed && !cities.some(x => x.toLowerCase() === trimmed.toLowerCase())) {
                                cities.push(trimmed);
                            }
                        }
                    });
                }
            } catch(e) {}

            try {
                const prods = this.getProducts();
                prods.forEach(p => {
                    if (p.stock && typeof p.stock === 'object') {
                        Object.keys(p.stock).forEach(k => {
                            if (k && !k.startsWith('WH-')) {
                                const trimmed = k.trim();
                                if (trimmed && !cities.some(x => x.toLowerCase() === trimmed.toLowerCase())) {
                                    cities.push(trimmed);
                                }
                            }
                        });
                    }
                });
            } catch(e) {}

            return cities;
        }

        saveInventoryCity(cityName) {
            if (!cityName || typeof cityName !== 'string') return;
            const trimmed = cityName.trim();
            if (!trimmed || trimmed.startsWith('WH-')) return;
            try {
                let stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY_CITIES) || '[]');
                if (!Array.isArray(stored)) stored = [];
                if (!stored.some(c => c && c.toLowerCase() === trimmed.toLowerCase())) {
                    stored.push(trimmed);
                    localStorage.setItem(STORAGE_KEYS.INVENTORY_CITIES, JSON.stringify(stored));
                }
            } catch(e) {}
        }

        normalizeProductStock(stock) {
            if (!stock) return { 'Karachi': 0 };
            if (typeof stock === 'number') return { 'Karachi': Number(stock) };
            if (typeof stock !== 'object') return { 'Karachi': 0 };

            const result = {};
            const legacyMap = {
                'WH-01': 'Karachi',
                'WH-02': 'Lahore',
                'WH-03': 'Islamabad'
            };

            Object.keys(stock).forEach(key => {
                const cityName = legacyMap[key] || key;
                const qty = Number(stock[key]) || 0;
                result[cityName] = (result[cityName] || 0) + qty;
            });

            if (Object.keys(result).length === 0) {
                result['Karachi'] = 0;
            }
            return result;
        }

        getWarehouses() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.WAREHOUSES) || '[]');
        }

        getSerials() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.SERIALS) || '[]');
        }

        registerSerial(serialObj) {
            const serials = this.getSerials();
            serials.unshift(serialObj);
            localStorage.setItem(STORAGE_KEYS.SERIALS, JSON.stringify(serials));
            return serialObj;
        }

        lookupSerial(serialCode) {
            const serials = this.getSerials();
            return serials.find(s => s.serial.toLowerCase() === (serialCode || '').toLowerCase().trim());
        }

        getCustomers() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
        }

        saveCustomer(cust) {
            const customers = this.getCustomers();
            const idx = customers.findIndex(c => c.id === cust.id || c.email === cust.email);
            if (idx !== -1) {
                customers[idx] = { ...customers[idx], ...cust };
            } else {
                cust.id = cust.id || 'CUST-' + (customers.length + 1001);
                cust.customerSince = cust.customerSince || new Date().toISOString().split('T')[0];
                cust.totalOrders = cust.totalOrders || 0;
                cust.lifetimeSpend = cust.lifetimeSpend || 0;
                cust.segment = cust.segment || 'New';
                customers.unshift(cust);
            }
            localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
            return cust;
        }

        getCustomerOrders(customerId) {
            if (!customerId) return [];
            const customers = this.getCustomers();
            const cleanId = String(customerId).trim().toLowerCase();
            const customer = customers.find(c => String(c.id).trim().toLowerCase() === cleanId);
            const allOrders = this.getOrders();
            if (!customer) {
                return allOrders.filter(o => {
                    const oCustId = String((o.customer && o.customer.id) || o.customerId || '').trim().toLowerCase();
                    return oCustId && oCustId === cleanId;
                });
            }
            return this.filterOrdersByCustomer(customer, allOrders);
        }

        filterOrdersByCustomer(customer, allOrders) {
            if (!customer || !Array.isArray(allOrders)) return [];
            const custId = customer.id ? String(customer.id).trim().toLowerCase() : '';
            const custEmail = customer.email ? String(customer.email).trim().toLowerCase() : '';
            const custName = customer.name ? String(customer.name).trim().toLowerCase() : '';

            const normalizeDigits = (str) => String(str || '').replace(/[^0-9]/g, '');
            const custPhoneDigits = normalizeDigits(customer.phone);
            const custPhoneKey = custPhoneDigits.length >= 10 ? custPhoneDigits.slice(-10) : (custPhoneDigits.length >= 7 ? custPhoneDigits : '');

            return allOrders.filter(order => {
                if (!order) return false;

                const oCust = order.customer || {};
                const oCustId = String(oCust.id || order.customerId || '').trim().toLowerCase();
                const oEmail = String(oCust.email || order.email || '').trim().toLowerCase();
                const oName = String(oCust.name || order.name || '').trim().toLowerCase();

                const oPhoneDigits = normalizeDigits(oCust.phone || order.phone);
                const oPhoneKey = oPhoneDigits.length >= 10 ? oPhoneDigits.slice(-10) : (oPhoneDigits.length >= 7 ? oPhoneDigits : '');

                // 1. Strict Conflict Exclusion: Order belongs to another Customer ID
                if (oCustId && custId && oCustId !== custId) {
                    return false;
                }

                // 2. Strict ID Match
                if (custId && oCustId && custId === oCustId) {
                    return true;
                }

                // 3. Strict Email Conflict Exclusion
                if (custEmail && oEmail && custEmail !== oEmail) {
                    return false;
                }

                // 4. Strict Email Match
                if (custEmail && oEmail && custEmail === oEmail) {
                    return true;
                }

                // 5. Strict Phone Conflict Exclusion
                if (custPhoneKey && oPhoneKey && custPhoneKey !== oPhoneKey) {
                    return false;
                }

                // 6. Strict Phone Match
                if (custPhoneKey && oPhoneKey && custPhoneKey === oPhoneKey) {
                    return true;
                }

                // 7. Strict Full Name Fallback only if order lacks both email and phone
                if (!oEmail && !oPhoneKey && custName && oName && custName === oName && custName.length >= 3) {
                    return true;
                }

                return false;
            });
        }

        getPcBuildRequests() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.PC_BUILDS) || '[]');
        }

        savePcBuildRequest(buildData) {
            const builds = this.getPcBuildRequests();
            const id = buildData.id || buildData.buildId || ('GUG-PC-' + Math.floor(100000 + Math.random() * 900000));
            buildData.id = id;
            buildData.buildId = id;
            buildData.date = buildData.date || new Date().toISOString();
            buildData.status = buildData.status || 'New Lead';

            const idx = builds.findIndex(b => (b.id === id || b.buildId === id));
            if (idx !== -1) {
                builds[idx] = { ...builds[idx], ...buildData };
            } else {
                builds.unshift(buildData);
            }
            localStorage.setItem(STORAGE_KEYS.PC_BUILDS, JSON.stringify(builds));
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('gugPcBuildsUpdated', { detail: builds }));
                window.dispatchEvent(new Event('pcBuildsReady'));
            }
            this.logAudit({
                action: 'PC_BUILD_REQUEST_CREATED',
                entity: 'PC_BUILD',
                entityId: id,
                newValue: `${buildData.category || buildData.buildTier || 'Custom PC'} for ${buildData.fullName || buildData.name} (Budget: ${buildData.budget || 'N/A'})`,
                reason: 'Customer submitted custom PC build configuration'
            });
            return buildData;
        }

        updatePcBuildStatus(id, newStatus, salesNotes) {
            const builds = this.getPcBuildRequests();
            const target = builds.find(b => (b.id === id || b.buildId === id));
            if (target) {
                target.status = newStatus;
                if (salesNotes !== undefined) target.salesNotes = salesNotes;
                localStorage.setItem(STORAGE_KEYS.PC_BUILDS, JSON.stringify(builds));
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('gugPcBuildsUpdated', { detail: builds }));
                }
                this.logAudit({
                    action: 'PC_BUILD_STATUS_UPDATED',
                    entity: 'PC_BUILD',
                    entityId: id,
                    newValue: `Status: ${newStatus}`,
                    reason: salesNotes || 'Sales representative updated build status'
                });
            }
            return target;
        }

        deletePcBuild(id) {
            let builds = this.getPcBuildRequests();
            builds = builds.filter(b => (b.id !== id && b.buildId !== id));
            localStorage.setItem(STORAGE_KEYS.PC_BUILDS, JSON.stringify(builds));
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('gugPcBuildsUpdated', { detail: builds }));
            }
            return true;
        }

        getSuppliers() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPPLIERS) || '[]');
        }

        saveSupplier(sup) {
            const suppliers = this.getSuppliers();
            const idx = suppliers.findIndex(s => s.id === sup.id);
            if (idx !== -1) {
                suppliers[idx] = sup;
            } else {
                sup.id = sup.id || 'SUP-' + (suppliers.length + 101);
                suppliers.push(sup);
            }
            localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
            this.logAudit({
                action: idx !== -1 ? 'SUPPLIER_UPDATED' : 'SUPPLIER_CREATED',
                entity: 'SUPPLIER',
                entityId: sup.id,
                newValue: sup.name
            });
            return sup;
        }

        getPurchaseOrders() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.PURCHASE_ORDERS) || '[]');
        }

        createPurchaseOrder(po) {
            const pos = this.getPurchaseOrders();
            po.id = po.id || 'PO-' + new Date().getFullYear() + '-' + String(pos.length + 101);
            po.orderDate = po.orderDate || new Date().toISOString().split('T')[0];
            po.status = po.status || 'Approved';
            po.paymentStatus = po.paymentStatus || 'Unpaid';
            po.paidAmount = po.paidAmount || 0;

            // Recalculate total amount from items if present
            if (po.items && Array.isArray(po.items)) {
                let total = 0;
                po.items.forEach(it => {
                    const qty = Number(it.quantity || 0);
                    const cost = Number(it.unitCost || 0);
                    it.totalCost = it.totalCost !== undefined ? Number(it.totalCost) : (qty * cost);
                    it.unit = it.unit || 'Pieces';
                    total += it.totalCost;
                });
                po.totalAmount = total;
            }

            // Auto-register new custom supplier if not in database
            if (po.supplierName && typeof po.supplierName === 'string') {
                const trimmedSup = po.supplierName.trim();
                const suppliers = this.getSuppliers();
                let sup = suppliers.find(s => s.id === po.supplierId || s.name.toLowerCase() === trimmedSup.toLowerCase());
                if (!sup && trimmedSup) {
                    sup = {
                        id: 'SUP-' + (suppliers.length + 101),
                        name: trimmedSup,
                        contactPerson: 'Vendor Rep',
                        category: 'Hardware & Accessories',
                        email: 'procurement@' + trimmedSup.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
                        phone: '+92 300 1234567',
                        paymentTerms: po.paymentTerms || 'Net 30 Days',
                        balancePayable: 0
                    };
                    suppliers.push(sup);
                    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
                    po.supplierId = sup.id;
                } else if (sup) {
                    po.supplierId = sup.id;
                    po.supplierName = sup.name;
                }
            }

            pos.unshift(po);
            localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(pos));

            this.logAudit({
                action: 'PO_CREATED',
                entity: 'PURCHASE_ORDER',
                entityId: po.id,
                newValue: `Supplier: ${po.supplierName}, Amount: Rs. ${(po.totalAmount || 0).toLocaleString()}`,
                reason: 'Created new manual purchase order'
            });
            return po;
        }

        receiveGoodsReceiptNote(poId, receivedWarehouseId = 'Karachi') {
            const pos = this.getPurchaseOrders();
            const po = pos.find(p => p.id === poId);
            if (!po) return { success: false, message: 'PO not found' };

            const prevStatus = po.status;
            po.status = 'Received';
            localStorage.setItem(STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(pos));

            // Map target warehouse/city name
            const targetCity = receivedWarehouseId === 'WH-01' ? 'Karachi' :
                               receivedWarehouseId === 'WH-02' ? 'Lahore' :
                               receivedWarehouseId === 'WH-03' ? 'Islamabad' : receivedWarehouseId;

            // Increase product stock
            const products = this.getProducts();
            if (po.items && Array.isArray(po.items)) {
                po.items.forEach(item => {
                    const prod = products.find(p => p.id === item.productId || (p.title && item.name && p.title.toLowerCase() === item.name.toLowerCase()));
                    if (prod) {
                        if (!prod.stock || typeof prod.stock !== 'object') {
                            prod.stock = this.normalizeProductStock(prod.stock);
                        }
                        const currentStock = Number(prod.stock[targetCity] || 0);
                        prod.stock[targetCity] = currentStock + Number(item.quantity || 0);
                        item.received = item.quantity;
                        this.saveInventoryCity(targetCity);
                    }
                });
                localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
                this.invalidateProductCache();
            }

            // Update supplier payable
            const suppliers = this.getSuppliers();
            const sup = suppliers.find(s => s.id === po.supplierId || s.name === po.supplierName);
            if (sup) {
                const unpaid = (po.totalAmount || 0) - (po.paidAmount || 0);
                sup.balancePayable = (sup.balancePayable || 0) + unpaid;
                localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
            }

            this.logAudit({
                action: 'GRN_RECEIVED',
                entity: 'PURCHASE_ORDER',
                entityId: po.id,
                previousValue: prevStatus,
                newValue: `Received & Stock Added to ${targetCity}`,
                reason: 'Goods received note verified and stock added'
            });

            return { success: true, po };
        }

        getOrders() {
            let orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
            
            // Ensure orders exist
            if (!orders || orders.length === 0) {
                this._ensureOrdersSeed();
                orders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
            }

            // Ensure GUG-ORD-375173 exists with complete visual items
            const existing375173 = orders.find(o => String(o.id) === 'GUG-ORD-375173');
            if (!existing375173) {
                const sample375173 = {
                    id: 'GUG-ORD-375173',
                    customer: {
                        name: 'Shahmeer Farooqi',
                        phone: '+92 300 9876543',
                        email: 'shahmeer@gmail.com',
                        city: 'Karachi',
                        address: 'B-14, Block 7, Clifton, Karachi'
                    },
                    name: 'Shahmeer Farooqi',
                    phone: '+92 300 9876543',
                    email: 'shahmeer@gmail.com',
                    city: 'Karachi',
                    address: 'B-14, Block 7, Clifton, Karachi',
                    items: [
                        {
                            id: 'PROD-IPHONE-18-PROMAX',
                            title: 'iPhone 18 Pro Max',
                            name: 'iPhone 18 Pro Max',
                            price: 690000,
                            costPrice: 580000,
                            quantity: 1,
                            sku: 'GUG-IPH18-PM-512',
                            image: 'assets/images/products/iphone_18_promax_glacier.jpg',
                            category: 'Mobiles'
                        },
                        {
                            id: 'PROD-001',
                            title: 'Asus ProArt Display PA279CRV Professional Monitor 27-inch IPS 4K UHD',
                            name: 'Asus ProArt Display PA279CRV Professional Monitor 27-inch IPS 4K UHD',
                            price: 169999,
                            costPrice: 122399,
                            quantity: 1,
                            sku: 'GUG-MON-001',
                            image: 'assets/images/products/Asus_ProArt_Display_PA279CRV_Professional_Monitor_.jpg',
                            category: 'Monitors'
                        },
                        {
                            id: 'PROD-MOUSE-01',
                            title: 'Logitech G-Pro X Superlight 2 Wireless Gaming Mouse',
                            name: 'Logitech G-Pro X Superlight 2 Wireless Gaming Mouse',
                            price: 38500,
                            costPrice: 28000,
                            quantity: 1,
                            sku: 'GUG-MS-GPRO-02',
                            image: 'assets/images/products/Logitech_G_PRO_X_Superlight_2_Wireless_Gaming_Mous.jpg',
                            category: 'Mice'
                        }
                    ],
                    subtotal: 898499,
                    shipping: 0,
                    total: 898499,
                    paymentMethod: 'Direct Bank Transfer (Meezan Bank)',
                    paymentStatus: 'Paid',
                    orderStatus: 'Processing',
                    courier: 'Leopard Express VIP Desk',
                    trackingNumber: 'LEO-VIP-77331199',
                    warehouse: 'WH-01',
                    date: new Date(Date.now() - 3600000 * 3).toISOString(),
                    notes: 'VIP Client - Include Official Warranty Certificates and PTA Approval Documents with shipment.'
                };
                orders.unshift(sample375173);
                localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
            } else if (!existing375173.items || existing375173.items.length === 0) {
                // If order exists in localStorage but was placed without items, enrich it
                existing375173.items = [
                    {
                        id: 'PROD-IPHONE-18-PROMAX',
                        title: 'iPhone 18 Pro Max',
                        name: 'iPhone 18 Pro Max',
                        price: 690000,
                        costPrice: 580000,
                        quantity: 1,
                        sku: 'GUG-IPH18-PM-512',
                        image: 'assets/images/products/iphone_18_promax_glacier.jpg',
                        category: 'Mobiles'
                    },
                    {
                        id: 'PROD-001',
                        title: 'Asus ProArt Display PA279CRV Professional Monitor 27-inch IPS 4K UHD',
                        name: 'Asus ProArt Display PA279CRV Professional Monitor 27-inch IPS 4K UHD',
                        price: 169999,
                        costPrice: 122399,
                        quantity: 1,
                        sku: 'GUG-MON-001',
                        image: 'assets/images/products/Asus_ProArt_Display_PA279CRV_Professional_Monitor_.jpg',
                        category: 'Monitors'
                    },
                    {
                        id: 'PROD-MOUSE-01',
                        title: 'Logitech G-Pro X Superlight 2 Wireless Gaming Mouse',
                        name: 'Logitech G-Pro X Superlight 2 Wireless Gaming Mouse',
                        price: 38500,
                        costPrice: 28000,
                        quantity: 1,
                        sku: 'GUG-MS-GPRO-02',
                        image: 'assets/images/products/Logitech_G_PRO_X_Superlight_2_Wireless_Gaming_Mous.jpg',
                        category: 'Mice'
                    }
                ];
                localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
            }

            return orders;
        }

        processStorefrontOrder(orderData) {
            const orders = this.getOrders();
            const orderId = orderData.id || 'GUG-' + Math.floor(1000 + Math.random() * 9000);
            
            const newOrder = {
                id: orderId,
                customer: orderData.customer,
                items: orderData.items,
                subtotal: orderData.subtotal || orderData.total,
                discount: Number(orderData.discount || 0),
                coupon: orderData.coupon || null,
                shipping: orderData.shipping || 0,
                total: orderData.total,
                paymentMethod: orderData.paymentMethod || 'Cash on Delivery (COD)',
                paymentStatus: orderData.paymentStatus || (orderData.paymentMethod && orderData.paymentMethod.includes('Online') ? 'Paid' : 'Pending'),
                paidAmount: Number(orderData.paidAmount || 0),
                balanceAmount: Number(orderData.balanceAmount !== undefined ? orderData.balanceAmount : orderData.total),
                paymentHistory: Array.isArray(orderData.paymentHistory) ? orderData.paymentHistory : [],
                orderStatus: 'New Order',
                warehouse: 'WH-01',
                courier: 'Leopard Express (Auto-Assigned)',
                trackingNumber: 'TRK-' + Math.floor(10000000 + Math.random() * 90000000),
                date: new Date().toISOString(),
                notes: orderData.notes || 'Order placed via Customer Storefront'
            };

            orders.unshift(newOrder);
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

            // Reduce stock from default warehouse
            const products = this.getProducts();
            newOrder.items.forEach(item => {
                const prod = products.find(p => p.id === item.id || p.sku === item.sku || p.title === item.title);
                if (prod && prod.stock) {
                    const currentWhStock = prod.stock['WH-01'] || 0;
                    const deduction = item.quantity || 1;
                    prod.stock['WH-01'] = Math.max(0, currentWhStock - deduction);
                }
            });
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
            this.invalidateProductCache();

            // Synchronize Customer Profile (CRM)
            const customers = this.getCustomers();
            const custName = newOrder.customer.name;
            const custEmail = newOrder.customer.email;
            let existingCust = customers.find(c => c.email === custEmail || c.name === custName);
            if (existingCust) {
                existingCust.totalOrders = (existingCust.totalOrders || 0) + 1;
                existingCust.lifetimeSpend = (existingCust.lifetimeSpend || 0) + newOrder.total;
                if (existingCust.totalOrders >= 5) existingCust.segment = 'VIP';
                else existingCust.segment = 'Returning';
            } else {
                customers.unshift({
                    id: 'CUST-' + (customers.length + 1001),
                    name: custName,
                    phone: newOrder.customer.phone || '',
                    email: custEmail || '',
                    city: newOrder.customer.city || '',
                    address: newOrder.customer.address || '',
                    segment: 'New',
                    totalOrders: 1,
                    lifetimeSpend: newOrder.total,
                    pendingBalance: 0,
                    customerSince: new Date().toISOString().split('T')[0],
                    notes: 'Registered via web storefront checkout'
                });
            }
            localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));

            // Create Warehouse Packing Task
            this.createTask({
                title: `Pack & Label Order #${orderId} (${newOrder.customer.name})`,
                department: 'Warehouse & Logistics',
                assignedTo: 'Rashid Minhas',
                priority: 'High',
                deadline: new Date(Date.now() + 3600000 * 6).toISOString(),
                status: 'To Do',
                relatedEntity: `Order #${orderId}`
            });

            // Log Audit Entry
            this.logAudit({
                action: 'ORDER_PLACED',
                entity: 'ORDER',
                entityId: orderId,
                previousValue: 'Website Checkout',
                newValue: `Order Total: Rs. ${newOrder.total}`,
                reason: 'Customer placed order on website storefront',
                user: newOrder.customer.name,
                role: 'Customer'
            });

            return newOrder;
        }

        updateOrderStatus(orderId, newStatus, reason = '') {
            const orders = this.getOrders();
            const order = orders.find(o => o.id === orderId);
            if (!order) return false;

            const oldStatus = order.orderStatus;
            order.orderStatus = newStatus;
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

            this.logAudit({
                action: 'ORDER_STATUS_CHANGED',
                entity: 'ORDER',
                entityId: orderId,
                previousValue: oldStatus,
                newValue: newStatus,
                reason: reason || `Order status updated from ${oldStatus} to ${newStatus}`
            });

            return order;
        }

        cancelOrder(orderId, reason = '') {
            const orders = this.getOrders();
            const cleanId = String(orderId).trim().toLowerCase();
            const order = orders.find(o => String(o.id).trim().toLowerCase() === cleanId);
            if (!order) return { success: false, message: 'Order not found in database.' };

            const previousStatus = order.orderStatus || 'Pending';
            const nowIso = new Date().toISOString();
            order.orderStatus = 'Cancelled';
            order.status = 'Cancelled';
            order.cancelledAt = nowIso;
            order.cancelReason = reason || 'Cancelled by Admin in Customer CRM';

            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

            // Synchronize with admin_orders key
            try {
                let adminOrders = JSON.parse(localStorage.getItem('admin_orders') || '[]');
                const aIdx = adminOrders.findIndex(o => String(o.id).trim().toLowerCase() === cleanId);
                if (aIdx !== -1) {
                    adminOrders[aIdx].orderStatus = 'Cancelled';
                    adminOrders[aIdx].status = 'Cancelled';
                    adminOrders[aIdx].cancelledAt = nowIso;
                    adminOrders[aIdx].cancelReason = order.cancelReason;
                    localStorage.setItem('admin_orders', JSON.stringify(adminOrders));
                }
            } catch(e) {}

            // Sync with Cloud Firestore via firebase-sync engine
            if (window.gugFirebaseSync && typeof window.gugFirebaseSync.updateOrderStatus === 'function') {
                try {
                    window.gugFirebaseSync.updateOrderStatus(order.id, 'Cancelled');
                } catch(err) {
                    console.warn('[GUG Firebase] Error updating order status to Cancelled:', err);
                }
            } else if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.updateOrderStatus === 'function') {
                try {
                    window.GUG_FIREBASE.updateOrderStatus(order.id, 'Cancelled');
                } catch(err) {}
            }

            this.logAudit({
                action: 'ORDER_CANCELLED_BY_ADMIN',
                entity: 'ORDER',
                entityId: order.id,
                previousValue: previousStatus,
                newValue: 'Cancelled',
                reason: reason || 'Admin cancelled customer order from CRM Panel',
                user: (this.getCurrentUser() || {}).name || 'Admin'
            });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('gugOrdersUpdated', { detail: orders }));
                window.dispatchEvent(new Event('ordersReady'));
            }

            return { success: true, order, message: `Order #${order.id} has been cancelled successfully.` };
        }

        getReturns() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.RETURNS) || '[]');
        }

        saveReturn(retObj) {
            const returns = this.getReturns();
            const idx = returns.findIndex(r => r.id === retObj.id);
            if (idx !== -1) {
                returns[idx] = retObj;
            } else {
                retObj.id = retObj.id || 'RMA-' + Math.floor(500 + Math.random() * 500);
                retObj.date = retObj.date || new Date().toISOString().split('T')[0];
                returns.unshift(retObj);
            }
            localStorage.setItem(STORAGE_KEYS.RETURNS, JSON.stringify(returns));
            return retObj;
        }

        getCoupons() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.COUPONS) || '[]');
        }

        saveCoupon(coupon) {
            const coupons = this.getCoupons();
            const idx = coupons.findIndex(c => c.code.toUpperCase() === coupon.code.toUpperCase());
            if (idx !== -1) {
                coupons[idx] = coupon;
            } else {
                coupon.usageCount = coupon.usageCount || 0;
                coupons.unshift(coupon);
            }
            localStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
            return coupon;
        }

        getShippingConfig() {
            const defaultCfg = {
                rate: 350,
                freeThreshold: 0,
                deliveryTime: '2-4 Business Days',
                courierName: 'Leopards / TCS Express'
            };
            try {
                const stored = localStorage.getItem('gug_shipping_config');
                if (stored) {
                    return { ...defaultCfg, ...JSON.parse(stored) };
                }
                const oldRate = localStorage.getItem('gug_shipping_rate');
                if (oldRate !== null && !isNaN(Number(oldRate))) {
                    return { ...defaultCfg, rate: Number(oldRate) };
                }
            } catch(e) {}
            return defaultCfg;
        }

        saveShippingConfig(cfg) {
            const updated = {
                rate: Number(cfg.rate !== undefined ? cfg.rate : 350),
                freeThreshold: Number(cfg.freeThreshold || 0),
                deliveryTime: cfg.deliveryTime || '2-4 Business Days',
                courierName: cfg.courierName || 'Leopards / TCS Express'
            };
            localStorage.setItem('gug_shipping_config', JSON.stringify(updated));
            localStorage.setItem('gug_shipping_rate', String(updated.rate));

            this.logAudit({
                action: 'SHIPPING_RATE_UPDATED',
                entity: 'LOGISTICS_CONFIG',
                entityId: 'SHIPPING_FEE',
                newValue: `Flat Shipping Fee: Rs. ${updated.rate} (Transit: ${updated.deliveryTime})`,
                reason: 'Admin updated storewide shipping rate in Logistics section'
            });
            return updated;
        }

        validateCoupon(code, subtotal = 0) {
            if (!code) return { valid: false, message: 'Please enter a coupon code.' };
            const cleanCode = String(code).trim().toUpperCase();
            const coupons = this.getCoupons();

            let coupon = coupons.find(c => (c.code || '').toUpperCase() === cleanCode);
            if (!coupon) {
                if (cleanCode === 'GEARUP10') {
                    coupon = { code: 'GEARUP10', type: 'percentage', value: 10, minOrder: 0, active: true, description: '10% Welcome Discount' };
                } else if (cleanCode === 'WELCOME5') {
                    coupon = { code: 'WELCOME5', type: 'percentage', value: 5, minOrder: 0, active: true, description: '5% First Order Coupon' };
                } else if (cleanCode === 'FREESHIP' || cleanCode === 'FREESHIPPING') {
                    coupon = { code: 'FREESHIP', type: 'free_shipping', value: 0, minOrder: 0, active: true, description: 'Free Shipping Nationwide' };
                }
            }

            if (!coupon) {
                return { valid: false, message: `Coupon code "${cleanCode}" is not recognized.` };
            }

            if (coupon.active === false || ['inactive', 'paused', 'expired'].includes(String(coupon.status || '').toLowerCase())) {
                return { valid: false, message: `Coupon code "${cleanCode}" is deactivated or expired.` };
            }

            const minSpend = Number(coupon.minOrder || 0);
            if (minSpend > 0 && subtotal < minSpend) {
                return { valid: false, message: `Minimum order amount of Rs. ${minSpend.toLocaleString()} is required for coupon ${coupon.code}.` };
            }

            const rawType = String(coupon.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
            const isFreeShipping = ['free_shipping', 'freeship', 'freeshipping'].includes(rawType) ||
                (!rawType && ['FREESHIP', 'FREESHIPPING'].includes(cleanCode));
            const discountType = isFreeShipping ? 'free_shipping' :
                (rawType.includes('fixed') || rawType.includes('amount') ? 'fixed' : 'percentage');
            const discountValue = Number(coupon.value || 0);
            const calcDiscount = discountType === 'free_shipping' ? 0 :
                (discountType === 'fixed' ? discountValue : subtotal * (discountValue / 100));
            const discountAmount = discountType === 'percentage' ? Math.round(calcDiscount) : calcDiscount;

            return {
                valid: true,
                coupon: coupon,
                code: coupon.code,
                type: discountType,
                value: discountType === 'free_shipping' ? 0 : discountValue,
                discountAmount: discountAmount,
                isFreeShipping: isFreeShipping,
                description: coupon.description || (isFreeShipping ? 'Free Shipping Nationwide' :
                    (discountType === 'fixed' ? `Rs. ${discountValue.toLocaleString()} Off` : `${discountValue}% Off`))
            };
        }

        getSettings() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        }

        saveSettings(settings) {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            this.logAudit({
                action: 'SETTINGS_UPDATED',
                entity: 'SYSTEM_SETTINGS',
                entityId: 'CONFIG',
                newValue: 'Updated Company & Gateway settings'
            });
            return settings;
        }

        getTasks() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
        }

        createTask(task) {
            const tasks = this.getTasks();
            task.id = task.id || 'TSK-' + Math.floor(100 + Math.random() * 900);
            task.status = task.status || 'To Do';
            task.progress = task.progress || 0;
            tasks.unshift(task);
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
            return task;
        }

        updateTaskStatus(taskId, status, progress = null) {
            const tasks = this.getTasks();
            const t = tasks.find(item => item.id === taskId);
            if (t) {
                t.status = status;
                if (progress !== null) t.progress = progress;
                if (status === 'Completed') t.progress = 100;
                localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
            }
            return t;
        }

        getExpenses() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES) || '[]');
        }

        recordExpense(exp) {
            const expenses = this.getExpenses();
            exp.id = exp.id || 'EXP-' + Math.floor(100 + Math.random() * 900);
            exp.date = exp.date || new Date().toISOString().split('T')[0];
            exp.status = exp.status || 'Approved';
            expenses.unshift(exp);
            localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));

            this.logAudit({
                action: 'EXPENSE_RECORDED',
                entity: 'EXPENSE',
                entityId: exp.id,
                newValue: `${exp.category}: Rs. ${exp.amount} (${exp.title})`,
                reason: 'Operational expense recorded'
            });
            return exp;
        }

        getEmployees(forceRefresh = false) {
            if (forceRefresh) {
                this._employeesCache = null;
            }
            let deletedEmps = [];
            try {
                deletedEmps = JSON.parse(localStorage.getItem('admin_deleted_employees') || '[]').map(s => String(s).toLowerCase());
            } catch(e) { deletedEmps = []; }

            if (this._employeesCache && Array.isArray(this._employeesCache) && this._employeesCache.length > 0) {
                return this._employeesCache.filter(e => e && e.id && !deletedEmps.includes(String(e.id).toLowerCase()) && (!e.username || !deletedEmps.includes(String(e.username).toLowerCase())));
            }
            let employees = [];
            try {
                employees = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMPLOYEES) || '[]');
            } catch(e) { employees = []; }

            // Migration fallback: if gug_erp_employees is empty, check if employees were stored in gug_finance_salaries
            if (!Array.isArray(employees) || employees.length === 0) {
                try {
                    const legacy = JSON.parse(localStorage.getItem('gug_finance_salaries') || '[]');
                    if (Array.isArray(legacy) && legacy.length > 0) {
                        const realEmps = legacy.filter(e => e && ((e.id && String(e.id).startsWith('EMP-')) || e.username || e.permissions));
                        if (realEmps.length > 0) {
                            employees = realEmps;
                        }
                    }
                } catch(e) {}
            }

            if (!Array.isArray(employees) || employees.length === 0) {
                employees = SEED_EMPLOYEES.filter(e => !deletedEmps.includes(String(e.id).toLowerCase()) && (!e.username || !deletedEmps.includes(String(e.username).toLowerCase())));
            }

            // Strictly filter out any permanently deleted employees
            employees = employees.filter(e => e && e.id && !deletedEmps.includes(String(e.id).toLowerCase()) && (!e.username || !deletedEmps.includes(String(e.username).toLowerCase())));

            let modified = false;
            employees.forEach(emp => {
                if (!emp.id) {
                    emp.id = 'EMP-' + Math.floor(100 + Math.random() * 900);
                    modified = true;
                }
                if (!emp.password) {
                    emp.password = (emp.username === 'admin' || emp.id === 'EMP-001') ? 'admingug' : 'admingug';
                    modified = true;
                }
                if (!emp.passwordHash && emp.password) {
                    emp.passwordHash = hashStringSync(emp.password);
                    modified = true;
                }
            });

            if (modified || !localStorage.getItem(STORAGE_KEYS.EMPLOYEES)) {
                localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
            }

            this._employeesCache = employees;
            return employees;
        }

        getEmployeeById(id) {
            if (!id) return null;
            const employees = this.getEmployees();
            const clean = String(id).trim().toLowerCase();
            return employees.find(e => String(e.id).toLowerCase() === clean);
        }

        getEmployeeByUsername(username) {
            if (!username) return null;
            const employees = this.getEmployees();
            const clean = String(username).toLowerCase().trim();
            return employees.find(e => (e.username && e.username.toLowerCase() === clean));
        }

        getDepartments() {
            const defaultDepts = [
                'Warehouse & Logistics',
                'Supply Chain',
                'Finance & Accounts',
                'Sales & Orders',
                'Customer Experience',
                'Human Resources',
                'Marketing',
                'Executive'
            ];
            let customDepts = [];
            try {
                customDepts = JSON.parse(localStorage.getItem('gug_custom_departments') || '[]');
            } catch(e) { customDepts = []; }
            const employees = this.getEmployees();
            const empDepts = employees.map(e => e.department).filter(Boolean);
            return [...new Set([...defaultDepts, ...customDepts, ...empDepts])];
        }

        getRoles() {
            const defaultRoles = [
                'Warehouse Staff',
                'Customer Support',
                'Sales Employee',
                'Sales Manager',
                'Inventory Manager',
                'Accountant',
                'HR Manager',
                'Marketing Manager',
                'Admin',
                'Super Admin'
            ];
            let customRoles = [];
            try {
                customRoles = JSON.parse(localStorage.getItem('gug_custom_roles') || '[]');
            } catch(e) { customRoles = []; }
            const employees = this.getEmployees();
            const empRoles = employees.map(e => e.role).filter(Boolean);
            return [...new Set([...defaultRoles, ...customRoles, ...empRoles])];
        }

        saveEmployee(empData) {
            this._employeesCache = null;
            const employees = this.getEmployees();

            // Determine if edit mode
            let targetId = empData.editId || (empData.isEdit ? empData.id : null);
            let idx = -1;
            if (targetId) {
                idx = employees.findIndex(e => String(e.id).toLowerCase() === String(targetId).toLowerCase());
            } else if (empData.id && empData.isEdit !== false) {
                idx = employees.findIndex(e => String(e.id).toLowerCase() === String(empData.id).toLowerCase());
            }

            const isEdit = idx !== -1;
            const previous = isEdit ? employees[idx] : null;

            // Generate clean unique username
            let cleanUser = (empData.username || (empData.name ? empData.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'staff')).toLowerCase().trim();
            if (!cleanUser) cleanUser = 'staff' + Math.floor(100 + Math.random() * 900);

            // Ensure username uniqueness
            const existingUser = employees.find(e => e.username && e.username.toLowerCase() === cleanUser && (!isEdit || e.id !== (previous ? previous.id : null)));
            if (existingUser) {
                if (empData.username && empData.username.trim()) {
                    return { success: false, message: `Username "${empData.username}" is already assigned to ${existingUser.name}. Please choose a unique username.` };
                } else {
                    cleanUser = `${cleanUser}${Math.floor(10 + Math.random() * 90)}`;
                }
            }

            // Auto-register custom department
            if (empData.department) {
                try {
                    let customDepts = JSON.parse(localStorage.getItem('gug_custom_departments') || '[]');
                    if (!customDepts.includes(empData.department)) {
                        customDepts.push(empData.department);
                        localStorage.setItem('gug_custom_departments', JSON.stringify(customDepts));
                    }
                } catch(e) {}
            }

            // Auto-register custom role
            if (empData.role) {
                try {
                    let customRoles = JSON.parse(localStorage.getItem('gug_custom_roles') || '[]');
                    if (!customRoles.includes(empData.role)) {
                        customRoles.push(empData.role);
                        localStorage.setItem('gug_custom_roles', JSON.stringify(customRoles));
                    }
                } catch(e) {}
            }

            // Handle password saving & hashing
            let plainPassword = (empData.password && empData.password.trim()) 
                ? empData.password.trim() 
                : (previous && previous.password ? previous.password : 'admingug');
            let passwordHash = hashStringSync(plainPassword);

            // Generate unique sequential employee ID if new
            let empId = empData.id;
            if (!isEdit) {
                const maxNum = employees.reduce((max, e) => {
                    const num = parseInt((e.id || '').replace(/\D/g, ''), 10);
                    return !isNaN(num) && num > max ? num : max;
                }, 0);
                empId = 'EMP-' + String(maxNum + 1).padStart(3, '0');
            }

            const perms = Array.isArray(empData.permissions) && empData.permissions.length > 0 
                ? empData.permissions 
                : (empData.role === 'Super Admin' ? [...ALL_MODULE_KEYS] : this.getRoleDefaultPermissions(empData.role || ROLES.WAREHOUSE_STAFF));

            const formattedEmp = {
                id: isEdit ? previous.id : empId,
                name: (empData.name || 'Staff Member').trim(),
                role: empData.role || ROLES.WAREHOUSE_STAFF,
                designation: empData.designation || empData.role || (previous ? previous.designation : 'Staff Member'),
                department: empData.department || 'Operations',
                email: empData.email || `${cleanUser}@gearupgadgets.com`,
                phone: empData.phone || '+92 300 0000000',
                whatsapp: empData.whatsapp || empData.phone || '+92 300 0000000',
                cnic: empData.cnic || empData.nic || 'Pending HR Verification',
                address: empData.address || 'Karachi, Pakistan',
                basicSalary: Number(empData.basicSalary || empData.salary || 65000),
                allowance: Number(empData.allowance !== undefined ? empData.allowance : (previous ? previous.allowance : 0)),
                deductions: Number(empData.deductions !== undefined ? empData.deductions : (previous ? previous.deductions : 0)),
                salaryPayments: Array.isArray(empData.salaryPayments)
                    ? empData.salaryPayments
                    : (previous && Array.isArray(previous.salaryPayments) ? previous.salaryPayments : []),
                status: empData.status || (previous ? previous.status : 'Active'),
                username: cleanUser,
                password: plainPassword,
                passwordHash: passwordHash,
                permissions: perms,
                joinDate: empData.joinDate || (previous ? previous.joinDate : new Date().toISOString().split('T')[0]),
                avatar: empData.avatar || (previous ? previous.avatar : null),
                idPostedNotification: !isEdit,
                idPostedMessage: 'Your ID is posted from admin department.',
                idPostedAt: new Date().toISOString(),
                idAcknowledged: isEdit ? Boolean(previous && previous.idAcknowledged) : false
            };

            if (isEdit) {
                employees[idx] = { ...previous, ...formattedEmp };
            } else {
                employees.push(formattedEmp);
            }

            localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
            this._employeesCache = employees;

            // If the saved employee is the currently active staff user, sync staff_permissions immediately
            try {
                const currentStaffId = localStorage.getItem('staff_user_id');
                const currentStaffUser = localStorage.getItem('staff_username');
                if ((currentStaffId && String(currentStaffId).toLowerCase() === String(formattedEmp.id).toLowerCase()) ||
                    (currentStaffUser && String(currentStaffUser).toLowerCase() === String(formattedEmp.username).toLowerCase())) {
                    localStorage.setItem('staff_permissions', JSON.stringify(formattedEmp.permissions || []));
                    localStorage.setItem('staff_name', formattedEmp.name);
                    localStorage.setItem('staff_role', formattedEmp.role);
                    localStorage.setItem('staff_department', formattedEmp.department || 'Operations');
                }
            } catch(e) {}

            // Remove from admin_deleted_employees if it was previously marked deleted
            try {
                let deletedEmps = JSON.parse(localStorage.getItem('admin_deleted_employees') || '[]');
                deletedEmps = deletedEmps.filter(d => String(d).toLowerCase() !== String(formattedEmp.id).toLowerCase() && (!formattedEmp.username || String(d).toLowerCase() !== String(formattedEmp.username).toLowerCase()));
                localStorage.setItem('admin_deleted_employees', JSON.stringify(deletedEmps));
            } catch(e) {}

            // Sync to Cloud Firestore immediately
            if (typeof window !== 'undefined' && window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveEmployee === 'function') {
                try { window.GUG_FIREBASE.saveEmployee(formattedEmp); } catch(e) {}
            }

            // Register in persistent pending ID notifications registry only for new employee onboarding
            if (!isEdit) {
                try {
                    let pendingMap = JSON.parse(localStorage.getItem('gug_staff_pending_id_notifications') || '{}');
                    const notifEntry = {
                        id: formattedEmp.id,
                        username: formattedEmp.username,
                        name: formattedEmp.name,
                        role: formattedEmp.role,
                        department: formattedEmp.department,
                        message: 'Your ID is posted from admin department.',
                        timestamp: Date.now()
                    };
                    pendingMap[formattedEmp.id] = notifEntry;
                    pendingMap[formattedEmp.id.toLowerCase()] = notifEntry;
                    if (formattedEmp.username) {
                        pendingMap[formattedEmp.username.toLowerCase()] = notifEntry;
                    }
                    localStorage.setItem('gug_staff_pending_id_notifications', JSON.stringify(pendingMap));
                } catch(e) {}
            }

            // Invalidate suspended cache
            this._suspendedCache = null;

            // Dispatch global events for instant cross-tab / real-time reactivity
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new CustomEvent('gugEmployeesUpdated', { detail: employees }));
                window.dispatchEvent(new Event('employeesReady'));
                window.dispatchEvent(new CustomEvent('gugEmployeePermissionsUpdated', {
                    detail: {
                        id: formattedEmp.id,
                        username: formattedEmp.username,
                        permissions: formattedEmp.permissions,
                        isEdit,
                        previousPermissions: previous ? previous.permissions : []
                    }
                }));
                window.dispatchEvent(new CustomEvent('gugStaffIdPosted', {
                    detail: {
                        id: formattedEmp.id,
                        username: formattedEmp.username,
                        name: formattedEmp.name,
                        message: 'Your ID is posted from admin department.'
                    }
                }));
            }

            this.logAudit({
                action: isEdit ? 'EMPLOYEE_UPDATED' : 'EMPLOYEE_REGISTERED',
                entity: 'HR_STAFF',
                entityId: formattedEmp.id,
                previousValue: previous ? `${previous.name} (${previous.role} - Rs. ${previous.basicSalary})` : 'New Employee Record',
                newValue: `${formattedEmp.name} (${formattedEmp.role} - Rs. ${formattedEmp.basicSalary}) • Permissions: ${formattedEmp.permissions.length} modules`,
                reason: isEdit ? 'Admin modified employee profile & permissions' : 'New employee onboarded with granular module access control'
            });

            return { success: true, employee: formattedEmp };
        }

        deleteEmployee(id) {
            this._employeesCache = null;
            let employees = this.getEmployees();
            const cleanId = String(id).trim().toLowerCase();
            const target = employees.find(e => String(e.id).toLowerCase() === cleanId || (e.username && String(e.username).toLowerCase() === cleanId));
            if (!target) return { success: false, message: 'Employee not found.' };

            if (target.username === 'admin' || target.id === 'EMP-001' || target.role === ROLES.SUPER_ADMIN) {
                return { success: false, message: 'Super Admin account cannot be deleted.' };
            }

            // If the deleted employee was active staff, clear staff session
            try {
                const currentStaffId = localStorage.getItem('staff_user_id');
                const currentStaffUser = localStorage.getItem('staff_username');
                if ((currentStaffId && String(currentStaffId).toLowerCase() === String(target.id).toLowerCase()) ||
                    (currentStaffUser && String(currentStaffUser).toLowerCase() === String(target.username).toLowerCase())) {
                    localStorage.removeItem('staff_permissions');
                    localStorage.removeItem('staff_logged_in');
                }
            } catch(e) {}

            // Track permanently in admin_deleted_employees so page refresh or seed never restores it
            try {
                let deletedEmps = JSON.parse(localStorage.getItem('admin_deleted_employees') || '[]');
                if (!deletedEmps.includes(target.id)) deletedEmps.push(target.id);
                if (!deletedEmps.includes(target.id.toLowerCase())) deletedEmps.push(target.id.toLowerCase());
                if (target.username && !deletedEmps.includes(target.username.toLowerCase())) {
                    deletedEmps.push(target.username.toLowerCase());
                }
                localStorage.setItem('admin_deleted_employees', JSON.stringify(deletedEmps));
            } catch(e) {}

            // Clean secondary local storage employee cache
            try {
                let fbEmps = JSON.parse(localStorage.getItem('gug_erp_employees') || '[]');
                fbEmps = fbEmps.filter(e => e.id !== target.id && (!target.username || e.username !== target.username));
                localStorage.setItem('gug_erp_employees', JSON.stringify(fbEmps));
            } catch(e) {}

            // Delete from Cloud Firestore immediately
            if (typeof window !== 'undefined' && window.GUG_FIREBASE && typeof window.GUG_FIREBASE.deleteEmployee === 'function') {
                try { window.GUG_FIREBASE.deleteEmployee(target.id); } catch(e) {}
            }

            // Clean active sessions & activity records
            try {
                let activeSessions = JSON.parse(localStorage.getItem('gug_active_staff_sessions') || '{}');
                delete activeSessions[target.id];
                if (target.username) delete activeSessions[target.username.toLowerCase()];
                localStorage.setItem('gug_active_staff_sessions', JSON.stringify(activeSessions));
            } catch(e) {}

            try {
                let suspendedList = JSON.parse(localStorage.getItem('gug_suspended_staff_ids') || '[]');
                suspendedList = suspendedList.filter(s => String(s).toLowerCase() !== target.id.toLowerCase() && (!target.username || String(s).toLowerCase() !== target.username.toLowerCase()));
                localStorage.setItem('gug_suspended_staff_ids', JSON.stringify(suspendedList));
            } catch(e) {}

            try {
                let alerts = JSON.parse(localStorage.getItem('gug_staff_paused_alerts') || '{}');
                delete alerts[target.id];
                delete alerts[target.id.toLowerCase()];
                if (target.username) delete alerts[target.username.toLowerCase()];
                localStorage.setItem('gug_staff_paused_alerts', JSON.stringify(alerts));
            } catch(e) {}

            try {
                let notifs = JSON.parse(localStorage.getItem('gug_staff_pending_id_notifications') || '{}');
                delete notifs[target.id];
                delete notifs[target.id.toLowerCase()];
                if (target.username) delete notifs[target.username.toLowerCase()];
                localStorage.setItem('gug_staff_pending_id_notifications', JSON.stringify(notifs));
            } catch(e) {}

            this._suspendedCache = null;

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new CustomEvent('gugEmployeesUpdated', { detail: employees }));
                window.dispatchEvent(new Event('employeesReady'));
                window.dispatchEvent(new CustomEvent('gugStaffActivityUpdated', { detail: { type: 'DELETE', empId: target.id } }));
            }

            this.logAudit({
                action: 'EMPLOYEE_DELETED',
                entity: 'HR_STAFF',
                entityId: target.id,
                previousValue: `${target.name} (${target.role})`,
                newValue: 'Account Removed',
                reason: 'HR administrator removed employee record from workforce directory'
            });

            return { success: true, message: `Employee ${target.name} (${target.id}) successfully deleted.` };
        }

        toggleEmployeeStatus(id) {
            const employees = this.getEmployees();
            const target = employees.find(e => e.id === id);
            if (!target) return { success: false, message: 'Employee not found.' };

            if (target.username === 'admin' || target.id === 'EMP-001') {
                return { success: false, message: 'Super Admin account cannot be deactivated.' };
            }

            const oldStatus = target.status || 'Active';
            target.status = oldStatus === 'Active' ? 'Inactive' : 'Active';
            localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));

            this.logAudit({
                action: 'EMPLOYEE_STATUS_TOGGLED',
                entity: 'HR_STAFF',
                entityId: id,
                previousValue: oldStatus,
                newValue: target.status,
                reason: `Employee account status set to ${target.status}`
            });

            return { success: true, status: target.status, employee: target };
        }

        pauseEmployee(id, shouldPause = true) {
            const employees = this.getEmployees();
            const cleanId = String(id).trim().toLowerCase();
            const target = employees.find(e => String(e.id).toLowerCase() === cleanId || String(e.username || '').toLowerCase() === cleanId);
            if (!target) return { success: false, message: 'Employee not found.' };

            if (target.username === 'admin' || target.id === 'EMP-001') {
                return { success: false, message: 'Super Admin account cannot be paused or suspended.' };
            }

            const nowIso = new Date().toISOString();
            target.isPaused = Boolean(shouldPause);
            target.status = shouldPause ? 'Paused' : 'Active';

            let suspendedList = [];
            try {
                suspendedList = JSON.parse(localStorage.getItem('gug_suspended_staff_ids') || '[]');
            } catch(e) { suspendedList = []; }

            let pausedAlerts = {};
            try {
                pausedAlerts = JSON.parse(localStorage.getItem('gug_staff_paused_alerts') || '{}');
            } catch(e) { pausedAlerts = {}; }

            if (shouldPause) {
                target.isOnline = false;
                target.pausedAt = nowIso;
                target.lastLogout = nowIso;

                if (!suspendedList.map(s => String(s).toLowerCase()).includes(target.id.toLowerCase())) {
                    suspendedList.push(target.id);
                }
                if (target.username && !suspendedList.map(s => String(s).toLowerCase()).includes(target.username.toLowerCase())) {
                    suspendedList.push(target.username.toLowerCase());
                }

                const alertEntry = {
                    id: target.id,
                    username: target.username,
                    name: target.name,
                    pausedAt: nowIso,
                    message: "Your ID is paused by the Admin"
                };
                pausedAlerts[target.id] = alertEntry;
                pausedAlerts[target.id.toLowerCase()] = alertEntry;
                if (target.username) {
                    pausedAlerts[target.username.toLowerCase()] = alertEntry;
                }

                // Close any open activity session immediately
                this.recordEmployeeLogout(target.id);
            } else {
                target.pausedAt = null;
                suspendedList = suspendedList.filter(s => {
                    const l = String(s).toLowerCase();
                    return l !== target.id.toLowerCase() && l !== (target.username || '').toLowerCase();
                });
                delete pausedAlerts[target.id];
                delete pausedAlerts[target.id.toLowerCase()];
                if (target.username) delete pausedAlerts[target.username.toLowerCase()];
            }

            localStorage.setItem('gug_suspended_staff_ids', JSON.stringify(suspendedList));
            localStorage.setItem('gug_staff_paused_alerts', JSON.stringify(pausedAlerts));
            localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
            this._suspendedCache = null;
            this._employeesCache = employees;

            // Sync to Cloud Firestore
            if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveEmployee === 'function') {
                try {
                    window.GUG_FIREBASE.saveEmployee(target);
                } catch(e) {}
            }

            this.logAudit({
                action: shouldPause ? 'EMPLOYEE_ACCOUNT_PAUSED' : 'EMPLOYEE_ACCOUNT_RESUMED',
                entity: 'HR_STAFF',
                entityId: target.id,
                newValue: shouldPause ? 'Suspended / Restricted' : 'Active / Unrestricted',
                reason: shouldPause ? 'Administrator paused employee ID. Portal access restricted.' : 'Administrator resumed employee ID. Access restored.',
                user: (this.getCurrentUser() || {}).name || 'Admin'
            });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new CustomEvent('gugEmployeePaused', { detail: { id: target.id, username: target.username, isPaused: shouldPause, message: "Your ID is paused by the Admin" } }));
            }

            return { success: true, isPaused: target.isPaused, status: target.status, employee: target };
        }

        isEmployeeSuspended(idOrUsername) {
            if (!idOrUsername) return false;
            const clean = String(idOrUsername).trim().toLowerCase();

            // Check high-speed in-memory cache (fresh within 3 seconds)
            const now = Date.now();
            if (this._suspendedCache && (now - (this._suspendedCacheTime || 0) < 3000)) {
                return Boolean(this._suspendedCache[clean]);
            }

            let suspendedMap = {};
            try {
                const suspendedList = JSON.parse(localStorage.getItem('gug_suspended_staff_ids') || '[]');
                suspendedList.forEach(s => {
                    if (s) suspendedMap[String(s).trim().toLowerCase()] = true;
                });
                const pausedAlerts = JSON.parse(localStorage.getItem('gug_staff_paused_alerts') || '{}');
                Object.keys(pausedAlerts).forEach(k => {
                    if (k) suspendedMap[k.trim().toLowerCase()] = true;
                });
            } catch(e) {}

            try {
                const employees = this.getEmployees();
                employees.forEach(e => {
                    if (e && (e.isPaused || e.status === 'Paused' || e.status === 'Suspended')) {
                        if (e.id) suspendedMap[String(e.id).trim().toLowerCase()] = true;
                        if (e.username) suspendedMap[String(e.username).trim().toLowerCase()] = true;
                    }
                });
            } catch(e) {}

            this._suspendedCache = suspendedMap;
            this._suspendedCacheTime = now;
            return Boolean(suspendedMap[clean]);
        }

        getPendingIdNotification(idOrUsername) {
            if (!idOrUsername) return null;
            const clean = String(idOrUsername).trim().toLowerCase();
            try {
                // If acknowledged or dismissed in this browser session, suppress stuck re-rendering
                if (typeof sessionStorage !== 'undefined') {
                    if (sessionStorage.getItem('gug_id_notif_dismissed_session') === 'true' ||
                        sessionStorage.getItem('gug_id_notif_dismissed_' + clean) === 'true') {
                        return null;
                    }
                }
                const pending = JSON.parse(localStorage.getItem('gug_staff_pending_id_notifications') || '{}');
                for (const key of Object.keys(pending)) {
                    if (key.trim().toLowerCase() === clean) {
                        return pending[key];
                    }
                }
                const employees = this.getEmployees();
                const emp = employees.find(e => String(e.id).toLowerCase() === clean || String(e.username || '').toLowerCase() === clean);
                if (emp && emp.idPostedNotification && !emp.idAcknowledged) {
                    return {
                        id: emp.id,
                        username: emp.username,
                        name: emp.name,
                        role: emp.role,
                        department: emp.department,
                        message: emp.idPostedMessage || 'Your ID is posted from admin department.',
                        timestamp: emp.idPostedAt || Date.now()
                    };
                }
            } catch(e) {}
            return null;
        }

        clearPendingIdNotification(idOrUsername) {
            if (!idOrUsername) return;
            const clean = String(idOrUsername).trim().toLowerCase();
            try {
                let pending = JSON.parse(localStorage.getItem('gug_staff_pending_id_notifications') || '{}');
                const employees = this.getEmployees();
                const emp = employees.find(e => String(e.id).toLowerCase() === clean || String(e.username || '').toLowerCase() === clean);
                
                // Case-insensitive deletion across all aliases
                Object.keys(pending).forEach(key => {
                    const k = key.trim().toLowerCase();
                    if (k === clean || (emp && (k === String(emp.id).toLowerCase() || k === String(emp.username || '').toLowerCase()))) {
                        delete pending[key];
                    }
                });

                if (emp) {
                    emp.idPostedNotification = false;
                    emp.idAcknowledged = true;
                    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
                    this._employeesCache = employees;
                }
                localStorage.setItem('gug_staff_pending_id_notifications', JSON.stringify(pending));
                localStorage.removeItem('gug_show_id_posted_alert');

                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('gug_id_notif_dismissed_session', 'true');
                    sessionStorage.setItem('gug_id_notif_dismissed_' + clean, 'true');
                    if (emp) {
                        sessionStorage.setItem('gug_id_notif_dismissed_' + String(emp.id).toLowerCase(), 'true');
                        if (emp.username) sessionStorage.setItem('gug_id_notif_dismissed_' + String(emp.username).toLowerCase(), 'true');
                    }
                }
            } catch(e) {}
        }

        recordEmployeeLogin(empId, initialSectionKey = 'dashboard', initialSectionName = 'Workspace Overview') {
            const employees = this.getEmployees();
            const cleanId = String(empId).trim().toLowerCase();
            const emp = employees.find(e => String(e.id).toLowerCase() === cleanId || String(e.username || '').toLowerCase() === cleanId || String(e.name || '').toLowerCase() === cleanId);
            if (!emp) return null;

            const nowIso = new Date().toISOString();
            emp.isOnline = true;
            emp.lastLogin = nowIso;
            emp.lastActive = Date.now();
            emp.currentSectionKey = initialSectionKey || 'dashboard';
            emp.currentSectionName = initialSectionName || 'Workspace Overview';

            localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
            this._employeesCache = employees;

            // If the saved employee is the currently active staff user, sync staff_permissions immediately
            try {
                const currentStaffId = localStorage.getItem('staff_user_id');
                const currentStaffUser = localStorage.getItem('staff_username');
                if ((currentStaffId && String(currentStaffId).toLowerCase() === String(formattedEmp.id).toLowerCase()) ||
                    (currentStaffUser && String(currentStaffUser).toLowerCase() === String(formattedEmp.username).toLowerCase())) {
                    localStorage.setItem('staff_permissions', JSON.stringify(formattedEmp.permissions || []));
                    localStorage.setItem('staff_name', formattedEmp.name);
                    localStorage.setItem('staff_role', formattedEmp.role);
                    localStorage.setItem('staff_department', formattedEmp.department || 'Operations');
                }
            } catch(e) {}

            // Activity Log tracking
            let activityLogs = [];
            try {
                activityLogs = JSON.parse(localStorage.getItem('gug_staff_activity_logs') || '[]');
            } catch(e) { activityLogs = []; }

            // Check if there is already an open session for this employee
            let openLog = activityLogs.find(l => (String(l.employeeId).toLowerCase() === String(emp.id).toLowerCase() || String(l.username || '').toLowerCase() === String(emp.username || '').toLowerCase()) && !l.logoutTime);
            if (openLog) {
                openLog.currentSection = emp.currentSectionName;
                openLog.currentSectionKey = emp.currentSectionKey;
                openLog.lastActive = nowIso;
                openLog.status = 'Active Session';
            } else {
                openLog = {
                    id: 'ACT-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900),
                    employeeId: emp.id,
                    employeeName: emp.name,
                    username: emp.username,
                    role: emp.role,
                    department: emp.department || 'Operations',
                    loginTime: nowIso,
                    logoutTime: null,
                    status: 'Active Session',
                    currentSection: emp.currentSectionName,
                    currentSectionKey: emp.currentSectionKey,
                    lastActive: nowIso,
                    ipAddress: 'Office / Local Network'
                };
                activityLogs.unshift(openLog);
            }

            if (activityLogs.length > 500) activityLogs = activityLogs.slice(0, 500);
            localStorage.setItem('gug_staff_activity_logs', JSON.stringify(activityLogs));

            // Active sessions registry for instant dashboard lookup
            try {
                let activeSessions = JSON.parse(localStorage.getItem('gug_active_staff_sessions') || '{}');
                activeSessions[emp.id] = {
                    id: emp.id,
                    username: emp.username,
                    name: emp.name,
                    role: emp.role,
                    department: emp.department || 'Operations',
                    isOnline: true,
                    loginTime: nowIso,
                    currentSectionKey: emp.currentSectionKey,
                    currentSectionName: emp.currentSectionName,
                    lastHeartbeat: Date.now()
                };
                localStorage.setItem('gug_active_staff_sessions', JSON.stringify(activeSessions));
            } catch(e) {}

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('gugStaffActivityUpdated', { detail: { type: 'LOGIN', emp, logEntry: openLog } }));
                window.dispatchEvent(new CustomEvent('gugStaffHeartbeat', { detail: { empId: emp.id, section: emp.currentSectionName } }));
            }

            return openLog;
        }

        updateEmployeeActiveSection(empId, sectionKey, sectionName) {
            if (!empId) return;
            const employees = this.getEmployees();
            const cleanId = String(empId).trim().toLowerCase();
            const emp = employees.find(e => String(e.id).toLowerCase() === cleanId || String(e.username || '').toLowerCase() === cleanId);
            if (!emp) return;

            const nowIso = new Date().toISOString();
            emp.isOnline = true;
            emp.lastActive = Date.now();
            emp.currentSectionKey = sectionKey || emp.currentSectionKey || 'dashboard';
            emp.currentSectionName = sectionName || emp.currentSectionName || 'Workspace Overview';

            localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));

            // Update open log
            let activityLogs = [];
            try {
                activityLogs = JSON.parse(localStorage.getItem('gug_staff_activity_logs') || '[]');
            } catch(e) { activityLogs = []; }

            const openLog = activityLogs.find(l => (String(l.employeeId).toLowerCase() === cleanId || String(l.username || '').toLowerCase() === cleanId) && !l.logoutTime);
            if (openLog) {
                openLog.currentSection = emp.currentSectionName;
                openLog.currentSectionKey = emp.currentSectionKey;
                openLog.lastActive = nowIso;
                localStorage.setItem('gug_staff_activity_logs', JSON.stringify(activityLogs));
            }

            // Update active session
            try {
                let activeSessions = JSON.parse(localStorage.getItem('gug_active_staff_sessions') || '{}');
                activeSessions[emp.id] = {
                    id: emp.id,
                    username: emp.username,
                    name: emp.name,
                    role: emp.role,
                    department: emp.department || 'Operations',
                    isOnline: true,
                    loginTime: emp.lastLogin || nowIso,
                    currentSectionKey: emp.currentSectionKey,
                    currentSectionName: emp.currentSectionName,
                    lastHeartbeat: Date.now()
                };
                localStorage.setItem('gug_active_staff_sessions', JSON.stringify(activeSessions));
            } catch(e) {}

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('gugStaffActivityUpdated', { detail: { type: 'SECTION_CHANGE', empId, sectionKey, sectionName } }));
                window.dispatchEvent(new CustomEvent('gugStaffHeartbeat', { detail: { empId: emp.id, section: emp.currentSectionName } }));
            }
        }

        recordEmployeeLogout(empId) {
            const employees = this.getEmployees();
            const cleanId = String(empId).trim().toLowerCase();
            const emp = employees.find(e => String(e.id).toLowerCase() === cleanId || String(e.username || '').toLowerCase() === cleanId || String(e.name || '').toLowerCase() === cleanId);
            const nowIso = new Date().toISOString();

            if (emp) {
                emp.isOnline = false;
                emp.lastLogout = nowIso;
                emp.lastActive = Date.now();
                localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
                this._employeesCache = employees;
            }

            // Close active log in activity log
            let activityLogs = [];
            try {
                activityLogs = JSON.parse(localStorage.getItem('gug_staff_activity_logs') || '[]');
            } catch(e) { activityLogs = []; }

            const openLog = activityLogs.find(l => (String(l.employeeId).toLowerCase() === cleanId || String(l.username || '').toLowerCase() === cleanId || (emp && String(l.employeeId).toLowerCase() === String(emp.id).toLowerCase())) && !l.logoutTime);
            if (openLog) {
                openLog.logoutTime = nowIso;
                openLog.status = 'Completed';
                const durationMin = Math.max(1, Math.round((new Date(nowIso) - new Date(openLog.loginTime)) / 60000));
                openLog.duration = durationMin < 60 ? `${durationMin} mins` : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;
            }
            localStorage.setItem('gug_staff_activity_logs', JSON.stringify(activityLogs));

            // Remove from active sessions
            try {
                let activeSessions = JSON.parse(localStorage.getItem('gug_active_staff_sessions') || '{}');
                delete activeSessions[cleanId];
                if (emp) delete activeSessions[emp.id];
                localStorage.setItem('gug_active_staff_sessions', JSON.stringify(activeSessions));
            } catch(e) {}

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('gugStaffActivityUpdated', { detail: { type: 'LOGOUT', empId, nowIso } }));
            }
        }

        getEmployeeActivityLogs(empId = null) {
            let logs = [];
            try {
                logs = JSON.parse(localStorage.getItem('gug_staff_activity_logs') || '[]');
            } catch(e) { logs = []; }

            if (empId) {
                const cleanId = String(empId).trim().toLowerCase();
                return logs.filter(l => String(l.employeeId).toLowerCase() === cleanId || String(l.username || '').toLowerCase() === cleanId);
            }
            return logs;
        }

        updateEmployeeHeartbeat(empId, sectionKey = null, sectionName = null) {
            if (!empId) return;
            const employees = this.getEmployees();
            const cleanId = String(empId).trim().toLowerCase();
            const emp = employees.find(e => String(e.id).toLowerCase() === cleanId || String(e.username || '').toLowerCase() === cleanId);
            if (emp) {
                emp.isOnline = true;
                emp.lastActive = Date.now();
                if (sectionKey) emp.currentSectionKey = sectionKey;
                if (sectionName) emp.currentSectionName = sectionName;
                localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));

                try {
                    let activeSessions = JSON.parse(localStorage.getItem('gug_active_staff_sessions') || '{}');
                    activeSessions[emp.id] = {
                        id: emp.id,
                        username: emp.username,
                        name: emp.name,
                        role: emp.role,
                        department: emp.department || 'Operations',
                        isOnline: true,
                        loginTime: emp.lastLogin || new Date().toISOString(),
                        currentSectionKey: emp.currentSectionKey || 'dashboard',
                        currentSectionName: emp.currentSectionName || 'Workspace Overview',
                        lastHeartbeat: Date.now()
                    };
                    localStorage.setItem('gug_active_staff_sessions', JSON.stringify(activeSessions));
                } catch(e) {}

                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('gugStaffHeartbeat', { detail: { empId: emp.id, section: emp.currentSectionName } }));
                }
            }
        }

        getActiveStaffSessions() {
            try {
                return JSON.parse(localStorage.getItem('gug_active_staff_sessions') || '{}');
            } catch(e) { return {}; }
        }

        resetEmployeePassword(id, newPassword) {
            if (!newPassword || newPassword.length < 4) {
                return { success: false, message: 'Password must be at least 4 characters.' };
            }
            const employees = this.getEmployees();
            const target = employees.find(e => e.id === id);
            if (!target) return { success: false, message: 'Employee not found.' };

            target.password = newPassword.trim();
            target.passwordHash = hashStringSync(newPassword.trim());
            localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));

            if (window.GUG_FIREBASE && typeof window.GUG_FIREBASE.saveEmployee === 'function') {
                try { window.GUG_FIREBASE.saveEmployee(target); } catch(e) {}
            }

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new CustomEvent('gugEmployeePermissionsUpdated', { detail: { id: target.id, username: target.username } }));
            }

            this.logAudit({
                action: 'EMPLOYEE_PASSWORD_RESET',
                entity: 'HR_STAFF',
                entityId: id,
                newValue: `Password explicitly updated for @${target.username} (${target.name})`,
                reason: `Admin reset password for employee ${target.name} (@${target.username})`
            });

            return { success: true, message: `Password for ${target.name} (@${target.username}) has been successfully updated to: ${target.password}` };
        }

        // ---------------------------------------------------------
        // 7.5. B2B DEALER & WHOLESALE LEDGER MANAGEMENT
        // ---------------------------------------------------------
        getDealers() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.DEALERS) || '[]');
        }

        getDealerById(id) {
            const dealers = this.getDealers();
            return dealers.find(d => d.id === id);
        }

        getDealerByUsername(username) {
            const dealers = this.getDealers();
            const clean = (username || '').toLowerCase().trim();
            return dealers.find(d => (d.username && d.username.toLowerCase() === clean));
        }

        saveDealer(dealerData) {
            const dealers = this.getDealers();
            const idx = dealers.findIndex(d => d.id === dealerData.id || (dealerData.username && d.username && d.username.toLowerCase() === dealerData.username.toLowerCase() && d.id === dealerData.id));
            const isEdit = idx !== -1;
            const previous = isEdit ? dealers[idx] : null;

            // Ensure username uniqueness
            if (dealerData.username) {
                const existingUser = dealers.find(d => d.username && d.username.toLowerCase() === dealerData.username.toLowerCase() && (!isEdit || d.id !== dealerData.id));
                if (existingUser) {
                    return { success: false, message: `Username "${dealerData.username}" is already assigned to ${existingUser.name} (${existingUser.shopName}).` };
                }
            }

            // Handle password hashing
            let passwordHash = isEdit ? previous.passwordHash : '';
            if (dealerData.password) {
                passwordHash = hashStringSync(dealerData.password);
            }

            const totalAmount = Number(dealerData.totalAmount !== undefined ? dealerData.totalAmount : (dealerData.creditLimit !== undefined ? dealerData.creditLimit : (previous ? (previous.totalAmount || previous.creditLimit) : 1000000)));
            const rawPaymentHistory = Array.isArray(dealerData.paymentHistory) ? dealerData.paymentHistory : (previous && Array.isArray(previous.paymentHistory) ? previous.paymentHistory : []);
            // Strictly deduplicate paymentHistory so that the final payment (Balance = 0) is stored ONLY ONCE
            const paymentHistory = [];
            let seenZero = false;
            for (let i = 0; i < rawPaymentHistory.length; i++) {
                const p = rawPaymentHistory[i];
                const isZero = (p.balanceAfter !== undefined && Number(p.balanceAfter) <= 0);
                if (seenZero && isZero) continue;
                paymentHistory.push(p);
                if (isZero) seenZero = true;
            }
            const calculatedPaid = paymentHistory.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const paidAmount = Number(dealerData.paidAmount !== undefined ? dealerData.paidAmount : (previous && previous.paidAmount !== undefined ? previous.paidAmount : calculatedPaid));
            const balanceAmount = Number(dealerData.balanceAmount !== undefined ? dealerData.balanceAmount : Math.max(0, totalAmount - paidAmount));
            const isAmountClear = Boolean(dealerData.isAmountClear !== undefined ? dealerData.isAmountClear : ((totalAmount > 0 && balanceAmount <= 0) || (totalAmount === 0 && paidAmount > 0)));

            const formattedDealer = {
                id: isEdit ? previous.id : (dealerData.id || 'DLR-' + String(dealers.length + 101)),
                name: dealerData.name || 'B2B Dealer',
                shopName: dealerData.shopName || dealerData.businessName || 'Tech Store',
                shopNumber: dealerData.shopNumber || dealerData.shopAddress || '',
                cnic: dealerData.cnic || '',
                phone: dealerData.phone || '',
                whatsapp: dealerData.whatsapp || dealerData.phone || '',
                residentialAddress: dealerData.residentialAddress || dealerData.homeAddress || '',
                city: dealerData.city || 'Karachi',
                status: dealerData.status || (previous ? previous.status : 'Active'),
                totalAmount: totalAmount,
                paidAmount: paidAmount,
                balanceAmount: balanceAmount,
                isAmountClear: isAmountClear,
                paymentHistory: paymentHistory,
                creditLimit: totalAmount,
                openingBalance: balanceAmount,
                username: (dealerData.username || (dealerData.name ? dealerData.name.toLowerCase().replace(/\s+/g, '') : 'dealer')).toLowerCase().trim(),
                password: dealerData.password || (previous ? previous.password : 'dealer123'),
                passwordHash: passwordHash || (previous ? previous.passwordHash : hashStringSync('dealer123')),
                createdAt: dealerData.createdAt || (previous ? previous.createdAt : new Date().toISOString().split('T')[0]),
                notes: dealerData.notes || (previous ? previous.notes : '')
            };

            if (isEdit) {
                dealers[idx] = { ...previous, ...formattedDealer };
            } else {
                dealers.push(formattedDealer);
            }

            localStorage.setItem(STORAGE_KEYS.DEALERS, JSON.stringify(dealers));

            this.logAudit({
                action: isEdit ? 'DEALER_UPDATED' : 'DEALER_REGISTERED',
                entity: 'B2B_DEALER',
                entityId: formattedDealer.id,
                previousValue: previous ? `${previous.name} (${previous.shopName})` : 'New Dealer Record',
                newValue: `${formattedDealer.name} (${formattedDealer.shopName}) &bull; Username: @${formattedDealer.username} &bull; Total: Rs. ${formattedDealer.totalAmount.toLocaleString()} &bull; Balance: Rs. ${formattedDealer.balanceAmount.toLocaleString()} &bull; Status: ${formattedDealer.isAmountClear ? 'AMOUNT CLEAR' : 'PENDING'}`,
                reason: isEdit ? 'Admin updated B2B dealer profile & payment ledger' : 'New B2B dealer account onboarded with portal access'
            });

            return { success: true, dealer: formattedDealer };
        }

        recordDealerPayment(dealerId, paymentData) {
            const dealers = this.getDealers();
            const idx = dealers.findIndex(d => d.id === dealerId);
            if (idx === -1) return { success: false, message: 'Dealer not found' };
            const dealer = dealers[idx];
            if (!Array.isArray(dealer.paymentHistory)) dealer.paymentHistory = [];

            const now = new Date();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const currentDay = dayNames[now.getDay()];
            const currentDate = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear();
            const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

            const amount = Number(paymentData.amount || 0);
            const prevPaid = dealer.paymentHistory.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const total = Number(dealer.totalAmount !== undefined ? dealer.totalAmount : (dealer.creditLimit || 0));
            const prevBalance = Math.max(0, total - prevPaid);

            // Prevent duplicate payments if balance is already fully cleared (Balance = 0)
            if (total > 0 && prevBalance <= 0) {
                return { success: false, message: 'Account balance is already fully cleared. No additional payment entry can be logged.', dealer: dealer };
            }
            if (dealer.paymentHistory.some(p => p.balanceAfter !== undefined && Number(p.balanceAfter) <= 0)) {
                return { success: false, message: 'Final payment clearing the account is already recorded.', dealer: dealer };
            }

            const balanceAfter = Math.max(0, prevBalance - amount);
            const installmentNo = dealer.paymentHistory.length + 1;

            const paymentEntry = {
                id: paymentData.id || ('PAY-' + dealer.id + '-' + Date.now().toString().slice(-4)),
                installmentNo: installmentNo,
                amount: amount,
                date: paymentData.date || currentDate,
                day: paymentData.day || currentDay,
                time: paymentData.time || currentTime,
                balanceAfter: balanceAfter,
                notes: paymentData.notes || `Installment #${installmentNo}`
            };

            dealer.paymentHistory.push(paymentEntry);
            dealer.paidAmount = prevPaid + amount;
            dealer.balanceAmount = balanceAfter;
            dealer.isAmountClear = Boolean((total > 0 && balanceAfter <= 0) || (total === 0 && dealer.paidAmount > 0));
            dealer.openingBalance = balanceAfter;

            dealers[idx] = dealer;
            localStorage.setItem(STORAGE_KEYS.DEALERS, JSON.stringify(dealers));

            this.logAudit({
                action: 'DEALER_PAYMENT_RECORDED',
                entity: 'B2B_DEALER',
                entityId: dealer.id,
                previousValue: `Balance: Rs. ${prevBalance.toLocaleString()}`,
                newValue: `Paid: Rs. ${amount.toLocaleString()} &bull; Balance After: Rs. ${balanceAfter.toLocaleString()} &bull; Status: ${dealer.isAmountClear ? 'AMOUNT CLEAR' : 'PENDING'}`,
                reason: `Installment #${installmentNo} logged for dealer ${dealer.name}`
            });

            return { success: true, payment: paymentEntry, dealer: dealer };
        }

        deleteDealer(id) {
            let dealers = this.getDealers();
            const target = dealers.find(d => d.id === id);
            if (!target) return { success: false, message: 'Dealer not found.' };

            dealers = dealers.filter(d => d.id !== id);
            localStorage.setItem(STORAGE_KEYS.DEALERS, JSON.stringify(dealers));

            // Also clean up ledger entries if any
            let ledger = this.getDealerLedger();
            ledger = ledger.filter(l => l.dealerId !== id);
            localStorage.setItem(STORAGE_KEYS.DEALER_LEDGER, JSON.stringify(ledger));

            this.logAudit({
                action: 'DEALER_DELETED',
                entity: 'B2B_DEALER',
                entityId: id,
                previousValue: `${target.name} (${target.shopName})`,
                newValue: 'Account & Ledger Purged',
                reason: 'Admin removed dealer and associated transaction records'
            });

            return { success: true, message: `Dealer ${target.name} (${target.shopName}) has been deleted.` };
        }

        toggleDealerStatus(id) {
            const dealers = this.getDealers();
            const target = dealers.find(d => d.id === id);
            if (!target) return { success: false, message: 'Dealer not found.' };

            const oldStatus = target.status || 'Active';
            target.status = oldStatus === 'Active' ? 'Suspended' : 'Active';
            localStorage.setItem(STORAGE_KEYS.DEALERS, JSON.stringify(dealers));

            this.logAudit({
                action: 'DEALER_STATUS_TOGGLED',
                entity: 'B2B_DEALER',
                entityId: id,
                previousValue: oldStatus,
                newValue: target.status,
                reason: `Dealer account status set to ${target.status}`
            });

            return { success: true, status: target.status, dealer: target };
        }

        resetDealerPassword(id, newPassword) {
            if (!newPassword || newPassword.length < 4) {
                return { success: false, message: 'Password must be at least 4 characters long.' };
            }
            const dealers = this.getDealers();
            const target = dealers.find(d => d.id === id);
            if (!target) return { success: false, message: 'Dealer not found.' };

            target.password = newPassword.trim();
            target.passwordHash = hashStringSync(newPassword.trim());
            localStorage.setItem(STORAGE_KEYS.DEALERS, JSON.stringify(dealers));

            this.logAudit({
                action: 'DEALER_PASSWORD_RESET',
                entity: 'B2B_DEALER',
                entityId: id,
                newValue: 'Password Updated (SHA-256)',
                reason: `Admin reset portal password for dealer ${target.name} (@${target.username})`
            });

            return { success: true, message: `Password for dealer ${target.name} (@${target.username}) has been updated.` };
        }

        authenticateDealer(username, password) {
            if (!username || !password) return { success: false, message: 'Username and password are required.' };
            
            const cleanUser = username.trim().toLowerCase();
            const passHash = hashStringSync(password.trim());
            const dealers = this.getDealers();

            const match = dealers.find(d => {
                const dUser = (d.username || '').toLowerCase();
                const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
                const cleanPhone = cleanUser.replace(/[^0-9]/g, '');
                return dUser === cleanUser || (cleanPhone && dPhone === cleanPhone);
            });

            if (!match) {
                return { success: false, message: 'Dealer account not found. Please verify your credentials or contact Gear Up Gadgets admin.' };
            }

            if (match.status === 'Suspended' || match.status === 'Inactive') {
                return { success: false, message: 'Your B2B Dealer account is currently suspended. Please contact Accounts Department.' };
            }

            const isMatch = (match.passwordHash && match.passwordHash === passHash) || 
                            (match.password && match.password === password);

            if (!isMatch) {
                return { success: false, message: 'Incorrect password for dealer portal.' };
            }

            // Set dealer session
            localStorage.setItem('dealer_logged_in', 'true');
            localStorage.setItem('dealer_id', match.id);
            localStorage.setItem('dealer_username', match.username);
            localStorage.setItem('dealer_name', match.name);
            localStorage.setItem('dealer_shop', match.shopName);

            this.logAudit({
                action: 'DEALER_PORTAL_LOGIN',
                entity: 'DEALER_SESSION',
                entityId: match.id,
                newValue: `Authenticated: ${match.name} (${match.shopName})`,
                reason: 'Dealer authenticated into B2B Portal',
                user: match.name,
                role: 'B2B Dealer'
            });

            return {
                success: true,
                dealer: match
            };
        }

        getDealerSession() {
            const isDealer = localStorage.getItem('dealer_logged_in') === 'true';
            if (!isDealer) return null;

            const dealerId = localStorage.getItem('dealer_id');
            const username = localStorage.getItem('dealer_username');
            const dealer = this.getDealerById(dealerId) || this.getDealerByUsername(username);
            return dealer || null;
        }

        dealerLogout() {
            const dealerId = localStorage.getItem('dealer_id') || 'Unknown';
            const dealerName = localStorage.getItem('dealer_name') || 'Dealer';

            this.logAudit({
                action: 'DEALER_PORTAL_LOGOUT',
                entity: 'DEALER_SESSION',
                entityId: dealerId,
                newValue: 'Session Terminated',
                reason: 'Dealer logged out of B2B Portal',
                user: dealerName,
                role: 'B2B Dealer'
            });

            localStorage.removeItem('dealer_logged_in');
            localStorage.removeItem('dealer_id');
            localStorage.removeItem('dealer_username');
            localStorage.removeItem('dealer_name');
            localStorage.removeItem('dealer_shop');

            window.location.href = 'dealer-login.html';
        }

        // --- Dealer Ledger Operations ---
        getDealerLedger(dealerId = null) {
            const ledger = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEALER_LEDGER) || '[]');
            if (dealerId) {
                return ledger.filter(l => l.dealerId === dealerId).sort((a, b) => new Date(a.date) - new Date(b.date));
            }
            return ledger.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        addDealerLedgerEntry(entryData) {
            const ledger = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEALER_LEDGER) || '[]');
            const dealer = this.getDealerById(entryData.dealerId);
            if (!dealer) return { success: false, message: 'Invalid dealer selected.' };

            const isStockIssue = entryData.type === 'STOCK_ISSUED';
            const isStockReturn = entryData.type === 'STOCK_RETURNED';
            const isPayment = entryData.type === 'PAYMENT_RECEIVED' || entryData.type === 'ADVANCE_PAYMENT';
            const paymentDetails = entryData.paymentDetails || {};

            const debit = Number(entryData.debit || (isStockIssue ? entryData.amount : 0) || 0);
            const credit = Number(entryData.credit || (isPayment || isStockReturn ? entryData.amount : 0) || 0);

            const newEntry = {
                id: entryData.id || 'DLG-' + String(Date.now()).slice(-6),
                dealerId: entryData.dealerId,
                dealerName: dealer.name,
                shopName: dealer.shopName,
                date: entryData.date || paymentDetails.transactionAt || new Date().toISOString(),
                type: entryData.type || 'STOCK_ISSUED', // 'STOCK_ISSUED', 'STOCK_RETURNED', 'PAYMENT_RECEIVED', 'ADVANCE_PAYMENT', 'ADJUSTMENT'
                referenceNo: entryData.referenceNo || (isPayment ? '' : 'REF-' + Math.floor(1000 + Math.random() * 9000)),
                description: entryData.description || (isStockIssue ? 'B2B Wholesale Stock Dispatch' : 'Payment Received'),
                items: Array.isArray(entryData.items) ? entryData.items : [],
                debit: debit,
                credit: credit,
                paymentMethod: paymentDetails.paymentMethod || entryData.paymentMethod || (isStockIssue ? 'Credit Invoice' : 'Bank Transfer'),
                bankNetwork: paymentDetails.bankNetwork || '',
                chequeNumber: paymentDetails.chequeNumber || '',
                bankAccountNumber: paymentDetails.bankAccountNumber || '',
                transactionReference: paymentDetails.transactionReference || '',
                paidAmount: Number(paymentDetails.paidAmount || (isPayment ? credit : 0)),
                balanceAmount: Number(paymentDetails.balanceAmount || 0),
                receiptName: paymentDetails.receiptName || '',
                receiptData: paymentDetails.receiptData || '',
                transactionAt: paymentDetails.transactionAt || entryData.date || new Date().toISOString(),
                recordedBy: entryData.recordedBy || this.getCurrentUser().name,
                notes: entryData.notes || ''
            };

            ledger.push(newEntry);
            localStorage.setItem(STORAGE_KEYS.DEALER_LEDGER, JSON.stringify(ledger));

            // Log Audit
            this.logAudit({
                action: 'DEALER_LEDGER_TRANSACTION',
                entity: 'DEALER_LEDGER',
                entityId: newEntry.id,
                newValue: `${dealer.shopName} (${newEntry.type}) &bull; Debit: Rs. ${debit.toLocaleString()} &bull; Credit: Rs. ${credit.toLocaleString()}`,
                reason: `B2B transaction recorded under ref #${newEntry.referenceNo}`
            });

            return { success: true, entry: newEntry };
        }

        deleteDealerLedgerEntry(entryId) {
            let ledger = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEALER_LEDGER) || '[]');
            const target = ledger.find(l => l.id === entryId);
            if (!target) return { success: false, message: 'Ledger entry not found.' };

            ledger = ledger.filter(l => l.id !== entryId);
            localStorage.setItem(STORAGE_KEYS.DEALER_LEDGER, JSON.stringify(ledger));

            this.logAudit({
                action: 'DEALER_LEDGER_DELETED',
                entity: 'DEALER_LEDGER',
                entityId: entryId,
                previousValue: `Ref #${target.referenceNo} (${target.type} - Rs. ${target.debit || target.credit})`,
                newValue: 'Record Removed',
                reason: 'Admin purged incorrect ledger transaction'
            });

            return { success: true, message: 'Ledger transaction successfully deleted.' };
        }

        calculateDealerSummary(dealerId) {
            const dealer = this.getDealerById(dealerId);
            if (!dealer) return null;

            const entries = this.getDealerLedger(dealerId);
            let totalDebit = 0;
            let totalCredit = 0;
            let runningBalance = Number(dealer.openingBalance || 0);

            const calculatedEntries = entries.map(entry => {
                const debit = Number(entry.debit || 0);
                const credit = Number(entry.credit || 0);
                totalDebit += debit;
                totalCredit += credit;
                runningBalance += (debit - credit);
                return {
                    ...entry,
                    runningBalance: runningBalance
                };
            });

            const totalAmt = Number(dealer.totalAmount !== undefined ? dealer.totalAmount : (dealer.creditLimit || 0));
            const payments = Array.isArray(dealer.paymentHistory) ? dealer.paymentHistory : [];
            const paidAmt = payments.length
                ? payments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
                : Number(dealer.paidAmount || 0);
            const calculatedBal = (Number(dealer.openingBalance || 0) + totalDebit) - totalCredit;
            const currentBalance = payments.length
                ? Math.max(0, totalAmt - paidAmt)
                : (dealer.balanceAmount !== undefined ? Number(dealer.balanceAmount) : calculatedBal);
            const isAmountClear = Boolean(dealer.isAmountClear !== undefined ? dealer.isAmountClear : ((totalAmt > 0 && currentBalance <= 0) || (totalAmt === 0 && paidAmt > 0)));

            // If no explicit legacy ledger entries exist in storage, map paymentHistory directly into ledgerEntries
            let finalEntries = [...calculatedEntries];
            if (finalEntries.length === 0 && (payments.length > 0 || totalAmt > 0)) {
                let runBal = totalAmt;
                const ords = ['th', 'st', 'nd', 'rd'];
                if (payments.length === 0 && totalAmt > 0) {
                    finalEntries.push({
                        id: `DEAL-${dealer.id}`,
                        dealerId: dealer.id,
                        referenceNo: `DEAL-${dealer.id}`,
                        date: dealer.createdAt || new Date().toISOString(),
                        type: 'STOCK_ISSUED',
                        description: '1st Payment Schedule (Initial Deal)',
                        scheduleTitle: '1st Payment Schedule',
                        debit: totalAmt,
                        credit: 0,
                        runningBalance: totalAmt,
                        paymentMethod: 'Wholesale Invoice'
                    });
                } else {
                    const cleanPayments = [];
                    let seenZero = false;
                    for (let i = 0; i < payments.length; i++) {
                        const p = payments[i];
                        const isZero = (p.balanceAfter !== undefined && Number(p.balanceAfter) <= 0);
                        if (seenZero && isZero) continue;
                        cleanPayments.push(p);
                        if (isZero) seenZero = true;
                    }
                    finalEntries = cleanPayments.map((p, idx) => {
                        const v = (idx + 1) % 100;
                        const schedTitle = (idx + 1) + (ords[(v - 20) % 10] || ords[v] || ords[0]) + ' Payment Schedule';
                        const pAmt = Number(p.amount || 0);
                        runBal = Math.max(0, runBal - pAmt);
                        const balAfter = (p.balanceAfter !== undefined) ? Number(p.balanceAfter) : runBal;
                        return {
                            id: p.id || `PAY-${dealer.id}-${idx + 1}`,
                            dealerId: dealer.id,
                            referenceNo: p.id || `PAY-${idx + 1}`,
                            date: p.date || dealer.createdAt || new Date().toISOString(),
                            day: p.day || '',
                            time: p.time || '',
                            type: 'PAYMENT_RECEIVED',
                            description: schedTitle,
                            scheduleTitle: schedTitle,
                            debit: (idx === 0 ? totalAmt : 0),
                            credit: pAmt,
                            runningBalance: balAfter,
                            paymentMethod: p.notes || 'Payment Schedule',
                            notes: p.notes || ''
                        };
                    });
                }
            }

            const stockIssuedVal = (totalDebit > 0) ? totalDebit : totalAmt;
            const paymentsClearedVal = (totalCredit > 0) ? totalCredit : paidAmt;

            return {
                dealer: dealer,
                totalAmount: totalAmt,
                paidAmount: paidAmt,
                balanceAmount: currentBalance,
                isAmountClear: isAmountClear,
                paymentHistory: payments,
                totalStockIssued: stockIssuedVal,
                totalPayments: paymentsClearedVal,
                openingBalance: Number(dealer.openingBalance || 0),
                currentBalance: currentBalance, // > 0 = dealer owes money, < 0 = surplus credit
                availableCredit: Math.max(0, (dealer.creditLimit || totalAmt) - currentBalance),
                ledgerEntries: finalEntries,
                transactionCount: finalEntries.length,
                lastTransactionDate: finalEntries.length ? finalEntries[finalEntries.length - 1].date : dealer.createdAt
            };
        }

        calculateAllDealersSummary() {
            const dealers = this.getDealers();
            let grandTotalReceivables = 0;
            let grandTotalStockIssued = 0;
            let grandTotalPayments = 0;
            const dealerSummaries = [];

            dealers.forEach(dealer => {
                const summary = this.calculateDealerSummary(dealer.id);
                if (summary) {
                    dealerSummaries.push(summary);
                    grandTotalReceivables += summary.currentBalance;
                    grandTotalStockIssued += summary.totalStockIssued;
                    grandTotalPayments += summary.totalPayments;
                }
            });

            return {
                totalDealers: dealers.length,
                activeDealers: dealers.filter(d => d.status === 'Active').length,
                grandTotalReceivables: grandTotalReceivables,
                grandTotalStockIssued: grandTotalStockIssued,
                grandTotalPayments: grandTotalPayments,
                dealerSummaries: dealerSummaries
            };
        }

        // ---------------------------------------------------------
        // 8. FINANCIAL & EXECUTIVE METRICS CALCULATOR
        // ---------------------------------------------------------
        calculateExecutiveMetrics() {
            const orders = this.getOrders();
            const products = this.getProducts();
            const expenses = this.getExpenses();
            const suppliers = this.getSuppliers();
            const employees = this.getEmployees();
            const customers = this.getCustomers();
            const returns = this.getReturns();

            const todayStr = new Date().toISOString().split('T')[0];
            
            let totalRevenue = 0;
            let totalCOGS = 0;
            let todayRevenue = 0;
            let todayOrdersCount = 0;
            let pendingOrders = 0;
            let deliveredOrders = 0;
            let cancelledOrders = 0;

            orders.forEach(o => {
                const isCancelled = o.orderStatus === 'Cancelled' || o.orderStatus === 'Refunded';
                if (!isCancelled) {
                    totalRevenue += Number(o.total || 0);
                    if (o.items && Array.isArray(o.items)) {
                        o.items.forEach(it => {
                            const cost = Number(it.costPrice || (it.price * 0.65) || 0);
                            totalCOGS += cost * (it.quantity || 1);
                        });
                    }
                }

                if (o.date && o.date.startsWith(todayStr)) {
                    todayOrdersCount++;
                    if (!isCancelled) todayRevenue += Number(o.total || 0);
                }

                if (o.orderStatus === 'New Order' || o.orderStatus === 'Processing' || o.orderStatus === 'Confirmed' || o.orderStatus === 'Packed') {
                    pendingOrders++;
                } else if (o.orderStatus === 'Delivered') {
                    deliveredOrders++;
                } else if (isCancelled) {
                    cancelledOrders++;
                }
            });

            let inventoryValuation = 0;
            let lowStockCount = 0;
            let outOfStockCount = 0;
            let totalStockUnits = 0;

            products.forEach(p => {
                let totalItemStock = 0;
                if (p.stock && typeof p.stock === 'object') {
                    Object.values(p.stock).forEach(qty => totalItemStock += Number(qty || 0));
                } else {
                    totalItemStock = Number(p.stock || 0);
                }
                totalStockUnits += totalItemStock;

                const itemCost = Number(p.costPrice || p.purchasePrice || (p.sellingPrice * 0.7));
                inventoryValuation += (totalItemStock * itemCost);

                if (totalItemStock === 0) {
                    outOfStockCount++;
                } else if (totalItemStock <= (p.lowStockThreshold !== undefined ? Number(p.lowStockThreshold) : 10)) {
                    lowStockCount++;
                }
            });

            let totalExpenses = 0;
            expenses.forEach(e => totalExpenses += Number(e.amount || 0));

            let monthlyPayroll = 0;
            employees.forEach(emp => monthlyPayroll += Number(emp.basicSalary || emp.salary || 0));

            let totalPayables = 0;
            suppliers.forEach(s => totalPayables += Number(s.balancePayable || 0));

            const grossProfit = totalRevenue - totalCOGS;
            const netProfit = grossProfit - totalExpenses;

            return {
                todayRevenue,
                todayOrdersCount,
                totalRevenue,
                totalCOGS,
                grossProfit,
                totalExpenses,
                monthlyPayroll,
                netProfit,
                pendingOrders,
                deliveredOrders,
                cancelledOrders,
                totalOrders: orders.length,
                inventoryValuation,
                totalStockUnits,
                lowStockCount,
                outOfStockCount,
                totalPayables,
                totalCustomers: customers.length,
                activeReturns: returns.filter(r => r.status !== 'Completed' && r.status !== 'Rejected').length
            };
        }

        // ---------------------------------------------------------
        // 9. BEGINNER-FRIENDLY HELP, TOASTS & GLOBAL UI GENERATORS
        // ---------------------------------------------------------
        showToast(message, type = 'success', title = '', duration = 3500) {
            let container = document.getElementById('gug-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'gug-toast-container';
                container.className = 'gug-toast-container';
                document.body.appendChild(container);
            }

            const icons = {
                success: '<i class="fas fa-check-circle"></i>',
                error: '<i class="fas fa-exclamation-circle"></i>',
                warning: '<i class="fas fa-exclamation-triangle"></i>',
                info: '<i class="fas fa-info-circle"></i>'
            };

            const titles = {
                success: title || 'Success',
                error: title || 'Action Required',
                warning: title || 'Notice',
                info: title || 'Information'
            };

            const toast = document.createElement('div');
            toast.className = `gug-toast toast-${type}`;
            toast.innerHTML = `
                <div class="toast-icon">${icons[type] || icons.info}</div>
                <div class="toast-content">
                    <div class="toast-title">${titles[type]}</div>
                    <div class="toast-message">${message}</div>
                </div>
                <button class="toast-close" onclick="this.parentElement.classList.remove('show'); setTimeout(() => this.parentElement.remove(), 300);">&times;</button>
            `;

            container.appendChild(toast);

            // Trigger animation
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            // Auto dismiss
            setTimeout(() => {
                if (toast && toast.parentElement) {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);

            return toast;
        }

        validateInput(inputEl, isValid, errorMessage = '') {
            if (!inputEl) return true;
            const parent = inputEl.closest('.mb-3') || inputEl.closest('.col-md-6') || inputEl.parentElement;
            
            // Remove previous error message if any
            const existingErr = parent ? parent.querySelector('.form-feedback-error') : null;
            if (existingErr) existingErr.remove();

            if (!isValid) {
                inputEl.classList.add('is-invalid-modern');
                if (errorMessage && parent) {
                    const errDiv = document.createElement('div');
                    errDiv.className = 'form-feedback-error';
                    errDiv.innerHTML = `<i class="fas fa-circle-exclamation text-danger"></i> ${errorMessage}`;
                    parent.appendChild(errDiv);
                }
                inputEl.addEventListener('input', () => {
                    inputEl.classList.remove('is-invalid-modern');
                    const err = parent ? parent.querySelector('.form-feedback-error') : null;
                    if (err) err.remove();
                }, { once: true });
                return false;
            } else {
                inputEl.classList.remove('is-invalid-modern');
                return true;
            }
        }

        renderBeginnerHelpBanner(containerId, { whereAmI, whatCanIDo, whatNext }) {
            const el = document.getElementById(containerId);
            if (!el) return;

            el.innerHTML = `
                <div class="beginner-help-card d-flex align-items-start gap-3">
                    <div class="help-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <div class="flex-grow-1" style="font-size: 13.5px;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <strong class="text-dark"><i class="fas fa-map-marker-alt text-danger me-1"></i> ${whereAmI}</strong>
                            <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 small fw-semibold">Fresh Employee Guide</span>
                        </div>
                        <p class="text-secondary mb-2" style="line-height: 1.5;">${whatCanIDo}</p>
                        <div class="d-flex align-items-center gap-2 bg-white bg-opacity-75 p-2 rounded-2 border border-success border-opacity-25 text-dark small">
                            <i class="fas fa-arrow-circle-right text-success fs-6"></i>
                            <div><strong>Recommended Next Step:</strong> <span class="text-secondary">${whatNext}</span></div>
                        </div>
                    </div>
                </div>
            `;
        }

        signOut() {
            ['admin_logged_in', 'staff_logged_in', 'dealer_logged_in', 'staff_user_id', 'staff_username',
                'staff_name', 'staff_role', 'staff_department', 'staff_permissions', 'admin_role', 'admin_username']
                .forEach(key => localStorage.removeItem(key));
            sessionStorage.removeItem('gug_admin_auth_session');
            sessionStorage.removeItem('gug_staff_auth_session');
            localStorage.setItem('gug_has_logged_out', 'true');
            window.location.href = 'admin.html';
        }

        renderGlobalHeader(containerId, activeTitle = 'Enterprise ERP', extraBadgeHtml = '') {
            const el = document.getElementById(containerId);
            if (!el) return;

            const currentUser = this.getCurrentUser();
            const escapedTitle = String(activeTitle || 'Enterprise ERP').replace(/'/g, "\\'");

            el.innerHTML = `
                <!-- Mobile Navigation Topbar (< 768px) -->
                <div class="admin-mobile-topbar d-flex d-md-none align-items-center justify-content-between mb-3 p-2 rounded-3 border border-secondary border-opacity-25" style="background: rgba(10, 10, 15, 0.85); backdrop-filter: blur(20px);">
                    <button type="button" class="btn btn-outline-danger btn-sm px-2.5 py-1.5 fw-bold d-flex align-items-center gap-2" onclick="window.GUG_DB.toggleAdminMobileSidebar()">
                        <i class="fas fa-bars"></i>
                        <span>Menu</span>
                    </button>
                    <span class="text-white fw-bold small text-truncate" style="max-width: 170px;">${activeTitle}</span>
                    <div class="d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-outline-danger btn-sm py-1 px-2 no-print" title="Print Professional Module Slip" onclick="window.GUG_DB.printModuleSlip('${escapedTitle}')">
                            <i class="fas fa-print"></i>
                        </button>
                        <a href="index.html" target="_blank" class="btn btn-outline-secondary btn-sm py-1 px-2" title="Storefront"><i class="fas fa-store"></i></a>
                        <a href="admin.html" class="btn btn-outline-danger btn-sm py-1 px-2" title="Logout" onclick="window.GUG_DB.signOut(); return false;"><i class="fas fa-sign-out-alt"></i></a>
                    </div>
                </div>

                <div class="d-none d-md-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 pb-3 border-bottom border-secondary border-opacity-25">
                    <div>
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                            <h3 class="fw-bold text-dark mb-0">${activeTitle}</h3>
                            ${extraBadgeHtml || ''}
                        </div>
                        <small class="text-secondary">GearUp Gadgets Central Operating System &bull; Active Role: <strong class="text-danger">${currentUser.role}</strong></small>
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <!-- Universal Print Slip Launcher -->
                        <button class="btn btn-outline-danger btn-sm px-3 fw-bold d-flex align-items-center gap-2 no-print" onclick="window.GUG_DB.printModuleSlip('${escapedTitle}')" title="Print Professional Module Slip">
                            <i class="fas fa-print"></i>
                            <span>Print Slip</span>
                        </button>

                        <!-- Global Search Launcher -->
                        <button class="btn btn-outline-secondary btn-sm px-3 d-flex align-items-center gap-2" onclick="window.GUG_DB.openGlobalSearchModal()">
                            <i class="fas fa-search text-danger"></i>
                            <span>Search everything...</span>
                            <kbd class="bg-light text-dark border ms-2 small">Ctrl + K</kbd>
                        </button>

                        <!-- Role Switcher for Demo / Testing -->
                        <div class="dropdown">
                            <button class="btn btn-dark btn-sm dropdown-toggle px-3" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-user-shield text-danger me-1"></i> Switch Role View
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow">
                                <li><h6 class="dropdown-header">Select Perspective</h6></li>
                                <li><a class="dropdown-item" href="#" onclick="window.GUG_DB.switchCurrentRole('Super Admin')"><i class="fas fa-crown text-warning me-2"></i> Owner / Super Admin</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.GUG_DB.switchCurrentRole('Sales Manager')"><i class="fas fa-chart-line text-primary me-2"></i> Sales Manager</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.GUG_DB.switchCurrentRole('Inventory Manager')"><i class="fas fa-warehouse text-info me-2"></i> Inventory Manager</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.GUG_DB.switchCurrentRole('Warehouse Staff')"><i class="fas fa-boxes text-secondary me-2"></i> Warehouse Staff</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.GUG_DB.switchCurrentRole('Accountant')"><i class="fas fa-calculator text-success me-2"></i> Accountant</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.GUG_DB.switchCurrentRole('HR Manager')"><i class="fas fa-users text-danger me-2"></i> HR Manager</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.GUG_DB.switchCurrentRole('Customer Support')"><i class="fas fa-headset text-warning me-2"></i> Customer Support</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.GUG_DB.switchCurrentRole('Marketing Manager')"><i class="fas fa-bullhorn text-purple me-2"></i> Marketing Manager</a></li>
                            </ul>
                        </div>

                        <!-- User Profile / Logout -->
                        <a href="admin.html" class="btn btn-outline-danger btn-sm" onclick="window.GUG_DB.signOut(); return false;"><i class="fas fa-sign-out-alt"></i></a>
                    </div>
                </div>
            `;

            // Enforce access permissions & filter sidebar on header render
            this.enforceAccessControl();
            this.initAdminMobileExperience();
        }

        printModuleSlip(customTitle) {
            const activeTitle = customTitle || document.title.replace('| Gear Up Gadgets', '').replace('| GearUp Gadgets ERP', '').trim() || 'Enterprise Module Slip';
            const currentUser = (typeof this.getCurrentUser === 'function') ? this.getCurrentUser() : { name: 'Admin', role: 'Super Admin' };

            const now = new Date();
            const dateFormatted = now.toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            const timeFormatted = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const refCode = 'GUG-SLIP-' + Date.now().toString().slice(-8);

            // Clean up old print containers if re-triggered
            const oldHeader = document.getElementById('gug-print-slip-header');
            if (oldHeader) oldHeader.remove();
            const oldFooter = document.getElementById('gug-print-slip-footer');
            if (oldFooter) oldFooter.remove();

            // Dynamic Print Slip Header
            const printHeader = document.createElement('div');
            printHeader.id = 'gug-print-slip-header';
            printHeader.className = 'gug-print-only mb-4';
            printHeader.innerHTML = `
                <div class="gug-print-slip-box">
                    <div class="gug-print-top-brand text-center">
                        <img src="assets/images/logo.png" alt="Gear Up Gadgets" class="gug-print-logo gug-print-logo-img" style="max-height: 52px; height: 52px; object-fit: contain; margin: 0 auto 6px auto; display: block; background: transparent !important;">
                        <div class="gug-print-company-sub" style="font-size: 11px; color: #333; margin-top: 2px;">
                            Enterprise Resource Planning &bull; Central Operating System &bull; Technology Solutions &amp; Hardware
                        </div>
                        <div class="gug-print-company-contact" style="font-size: 10px; color: #555; margin-top: 2px;">
                            Shop F6, Technocity Mall, Hasrat Mohani Road, Karachi, Pakistan &bull; WhatsApp / UAN: +92 300 1234567 &bull; support@gearupgadgets.com
                        </div>
                    </div>
                    
                    <div class="gug-print-meta-bar mt-3 pt-2 pb-2 px-3 border-top border-bottom" style="border-color: #000 !important; background: #f8f9fa; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #000;">
                        <div>
                            <strong>DOCUMENT:</strong> <span class="text-uppercase fw-bold text-danger">${activeTitle}</span>
                        </div>
                        <div>
                            <strong>REF #:</strong> <code>${refCode}</code>
                        </div>
                        <div>
                            <strong>PRINTED:</strong> <span>${dateFormatted} at ${timeFormatted}</span>
                        </div>
                        <div>
                            <strong>OPERATOR:</strong> <span>${currentUser.name || currentUser.username || 'Authorized Staff'} (${currentUser.role})</span>
                        </div>
                    </div>
                </div>
            `;

            // Dynamic Print Slip Footer
            const printFooter = document.createElement('div');
            printFooter.id = 'gug-print-slip-footer';
            printFooter.className = 'gug-print-only mt-4 pt-3 border-top';
            printFooter.style.borderColor = '#999';
            printFooter.innerHTML = `
                <div class="d-flex justify-content-between align-items-center" style="font-size: 9.5px; color: #444;">
                    <div>
                        <strong>Gear Up Gadgets ERP Central Operating System</strong> &bull; Official Computer Generated Slip &bull; Valid Without Physical Signature
                    </div>
                    <div>
                        Page 1 of 1 &bull; System Verified &bull; ${dateFormatted}
                    </div>
                </div>
            `;

            const mainEl = document.querySelector('.admin-main') || document.querySelector('.content-area') || document.body;
            mainEl.insertBefore(printHeader, mainEl.firstChild);
            mainEl.appendChild(printFooter);

            // Check if on an entity page where multi-page batch printing of all records is expected
            const isTestRunner = window.__GUG_TEST_RUNNER || document.getElementById('results') || (window.location && window.location.pathname.includes('test-runner'));
            if (!isTestRunner) {
                const lowerTitle = String(activeTitle).toLowerCase();
                const path = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';

                if (path.includes('crm') || lowerTitle.includes('customer') || document.getElementById('crm-customer-list') || document.getElementById('crm-customer-table')) {
                    if (typeof this.printBatchCustomerSlips === 'function') {
                        return this.printBatchCustomerSlips();
                    }
                } else if (path.includes('staff') || lowerTitle.includes('hr') || lowerTitle.includes('payroll') || lowerTitle.includes('employee') || document.getElementById('staff-table-body')) {
                    if (typeof this.printBatchEmployeeSlips === 'function') {
                        return this.printBatchEmployeeSlips();
                    }
                } else if (path.includes('dealer') || lowerTitle.includes('dealer') || lowerTitle.includes('b2b') || document.getElementById('dealers-table-body')) {
                    if (typeof this.printBatchDealerSlips === 'function') {
                        return this.printBatchDealerSlips();
                    }
                }
            }

            // Execute print
            setTimeout(() => {
                window.print();
            }, 120);

            return { success: true, title: activeTitle, refCode, timestamp: now.toISOString() };
        }

        exportEmployeesToExcel() {
            if (window.__gug_is_exporting) {
                console.warn('[HR Export] Export already in progress, suppressing duplicate call.');
                return { success: false, message: 'Already exporting' };
            }
            window.__gug_is_exporting = true;
            setTimeout(() => { window.__gug_is_exporting = false; }, 1500);

            const employees = (typeof this.getEmployees === 'function') ? this.getEmployees() : [];
            if (!employees || employees.length === 0) {
                if (typeof this.showToast === 'function') {
                    this.showToast('No employee records available to export.', 'warning', 'HR Export');
                } else {
                    alert('No employee records available to export.');
                }
                return { success: false, message: 'No employee records' };
            }

            const headers = [
                "Employee ID",
                "Full Name",
                "Username",
                "Email Address",
                "Phone Number",
                "CNIC",
                "Department",
                "Role / Designation",
                "Monthly Basic Salary (PKR)",
                "Employment Status",
                "Duty Hub / Warehouse",
                "Permissions Count",
                "Allowed Modules",
                "Last Login",
                "Current Action"
            ];

            const escapeCsv = (val) => {
                if (val === null || val === undefined) return '""';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            };

            const rows = employees.map(emp => {
                const perms = Array.isArray(emp.permissions) ? emp.permissions : [];
                const salary = Number(emp.basicSalary || emp.salary || 0);
                return [
                    escapeCsv(emp.id || ''),
                    escapeCsv(emp.name || ''),
                    escapeCsv(emp.username || ''),
                    escapeCsv(emp.email || ''),
                    escapeCsv(emp.phone || ''),
                    escapeCsv(emp.cnic || ''),
                    escapeCsv(emp.department || ''),
                    escapeCsv(emp.role || emp.designation || ''),
                    escapeCsv(salary),
                    escapeCsv(emp.status || 'Active'),
                    escapeCsv(emp.dutyHub || emp.hub || 'Central'),
                    escapeCsv(perms.length),
                    escapeCsv(perms.join('; ')),
                    escapeCsv(emp.lastLogin || 'N/A'),
                    escapeCsv(emp.currentAction || 'Offline')
                ].join(',');
            });

            // Prepend UTF-8 BOM (\uFEFF) so Excel opens UTF-8 encoded text correctly without mojibake
            const csvContent = "\uFEFF" + headers.map(h => `"${h}"`).join(',') + "\r\n" + rows.join("\r\n");

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const today = new Date().toISOString().split('T')[0];
            const fileName = `gearup_gadgets_hr_payroll_export_${today}.csv`;

            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }

            if (typeof this.showToast === 'function') {
                this.showToast(`HR Payroll exported successfully (${employees.length} records) to ${fileName}`, 'success', 'Excel Export');
            }
            return { success: true, count: employees.length, fileName: fileName };
        }

        generateSingleCustomerSlipHtml(c, orders, totalSpend, currentUser, isLast = false) {
            const now = new Date();
            const dateFormatted = now.toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            const timeFormatted = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const refCode = 'CUST-SLIP-' + c.id + '-' + Date.now().toString().slice(-6);
            const printText = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[character]);
            const paymentRows = orders.flatMap(order => {
                const history = Array.isArray(order.paymentHistory) ? order.paymentHistory : [];
                if (history.length) return history.map(payment => ({
                    date: payment.timestamp || payment.date || order.date || '',
                    method: payment.paymentMethod || payment.method || order.paymentMethod || 'Not recorded',
                    network: payment.bankNetwork || '',
                    reference: payment.transactionReference || payment.reference || payment.id || order.id,
                    paid: Number(payment.amount || 0),
                    balance: Number(payment.balanceAfter != null ? payment.balanceAfter : payment.balanceAmount || 0)
                }));
                const paid = Number(order.paidAmount || (String(order.paymentStatus).toLowerCase() === 'paid' ? order.total : 0));
                return paid > 0 ? [{
                    date: order.transactionAt || order.date || '',
                    method: order.paymentMethod || order.payment || 'Not recorded',
                    network: order.bankNetwork || '',
                    reference: order.paymentReference || order.id,
                    paid,
                    balance: Number(order.balanceAmount || Math.max(0, Number(order.total || 0) - paid))
                }] : [];
            });
            const paymentRowsHtml = paymentRows.map(payment => `
                <tr>
                    <td>${printText(payment.date)}</td>
                    <td>${printText(payment.network ? `${payment.method} · ${payment.network}` : payment.method)}</td>
                    <td>${printText(payment.reference)}</td>
                    <td>Rs. ${Number(payment.paid).toLocaleString()}</td>
                    <td>Rs. ${Number(payment.balance).toLocaleString()}</td>
                </tr>`).join('');

            return `
                <div class="gug-individual-slip ${isLast ? '' : 'gug-slip-page-break'}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #000000 !important; background: #ffffff !important; background-color: #ffffff !important; max-width: 800px; margin: 0 auto ${isLast ? '0' : '30px'}; padding: 25px; box-sizing: border-box; ${isLast ? 'page-break-after: auto !important; break-after: auto !important;' : 'page-break-after: always !important; break-after: page !important;'}">
                    <!-- Brand Header (Colored Logo for Print) -->
                    <div class="text-center mb-2 pb-2 gug-slip-brand-header" style="border-bottom: 1.5px solid #000000 !important; background: #ffffff !important;">
                        <img src="assets/images/logo.png" alt="Gear Up Gadgets" class="gug-print-logo-img" style="max-height: 52px; height: 52px; object-fit: contain; margin: 0 auto 4px auto; display: block; background: transparent !important;">
                        <div style="font-size: 8.5pt; font-weight: 700 !important; text-transform: uppercase; color: #000000 !important; letter-spacing: 0.5px; margin-top: 2px;">
                            ENTERPRISE CRM DIVISION &bull; CUSTOMER 360&deg; ACCOUNT DOSSIER
                        </div>
                        <div style="font-size: 8pt; color: #374151 !important; margin-top: 2px;">
                            Shop F6, Technocity Mall, Hasrat Mohani Road, Karachi, Pakistan &bull; WhatsApp / UAN: +92 300 1234567 &bull; support@gearupgadgets.com
                        </div>
                    </div>

                    <!-- Slip Meta Bar -->
                    <div style="border-top: 1.5px solid #000000 !important; border-bottom: 1.5px solid #000000 !important; padding: 8px 4px; margin-bottom: 14px; display: grid; grid-template-columns: 2fr 1.6fr 1.3fr 1.3fr; gap: 8px; align-items: start; font-size: 8.5pt; color: #000000 !important; background: #ffffff !important;">
                        <div>
                            <strong style="color: #000000 !important;">DOCUMENT:</strong> 
                            <span style="color: #dc2626 !important; font-weight: 700 !important; text-transform: uppercase;">CUSTOMER PROFILE &amp;<br>PURCHASE DOSSIER</span>
                        </div>
                        <div>
                            <div style="font-weight: 700 !important; color: #000000 !important; margin-bottom: 2px;">REF #:</div>
                            <div style="border: 1px solid #fca5a5 !important; background: #ffffff !important; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                                <code class="order-id text-danger" style="color: #dc2626 !important; font-weight: 700 !important; font-family: monospace; font-size: 8pt;">${refCode}</code>
                            </div>
                        </div>
                        <div>
                            <strong style="color: #000000 !important;">DATE:</strong> <span style="color: #000000 !important;">${dateFormatted}</span><br>
                            <span style="color: #000000 !important;">${timeFormatted}</span>
                        </div>
                        <div>
                            <strong style="color: #000000 !important;">ISSUER:</strong> <span style="color: #000000 !important;">${currentUser.name || 'Khan'} (${currentUser.role || 'Super Admin'})</span><br>
                            <span style="color: #666666 !important;">(${currentUser.role || 'Super Admin'})</span>
                        </div>
                    </div>

                    <!-- Customer Core Details -->
                    <div class="gug-print-box gug-print-customer-info" style="border: 1px solid #d1d5db !important; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; color: #000000 !important; page-break-inside: auto !important; break-inside: auto !important;">
                        <h4 style="font-size: 11pt; font-weight: 700 !important; margin: 0 0 10px 0; color: #000000 !important; border-bottom: 1px solid #e5e7eb !important; padding-bottom: 6px;">
                            1. Customer Identification &amp; Account Parameters
                        </h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 9pt; color: #000000 !important;">
                            <div><strong style="color: #000000 !important;">Customer Name:</strong> <span style="color: #000000 !important; font-weight: 600;">${c.name}</span></div>
                            <div><strong style="color: #000000 !important;">Customer ID:</strong> <code class="order-id text-danger" style="color: #dc2626 !important; font-weight: 700 !important; background: #ffffff !important; border: 1px solid #fca5a5 !important; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${c.id}</code></div>
                            <div><strong style="color: #000000 !important;">Phone / WhatsApp:</strong> <span style="color: #000000 !important;">${c.phone || 'N/A'}</span></div>
                            <div><strong style="color: #000000 !important;">Email Address:</strong> <span style="color: #000000 !important;">${c.email || 'N/A'}</span></div>
                            <div><strong style="color: #000000 !important;">Shipping City / Area:</strong> <span style="color: #000000 !important;">${c.city || 'Karachi'}</span></div>
                            <div><strong style="color: #000000 !important;">Account Classification:</strong> <span style="font-weight: 700 !important; color: #2563eb !important;">${c.segment || (orders.length >= 5 ? 'VIP Client' : 'New')}</span></div>
                            <div><strong style="color: #000000 !important;">Total Orders Count:</strong> <span style="color: #000000 !important; font-weight: 600;">${orders.length} Orders</span></div>
                            <div><strong style="color: #000000 !important;">Total Lifetime Spend:</strong> <strong style="color: #16a34a !important; font-size: 10.5pt; font-weight: 800 !important;">Rs. ${totalSpend.toLocaleString()}</strong></div>
                        </div>
                    </div>

                    <!-- Customer Order History Data Boxes (Section 2 - Row-wise Layout for Large Orders) -->
                    <div class="gug-print-box gug-print-section-orders order-history-section" style="border: 1px solid #d1d5db !important; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; color: #000000 !important; page-break-before: auto !important; break-before: auto !important; page-break-inside: auto !important; break-inside: auto !important; height: auto !important; max-height: none !important;">
                        <h4 style="font-size: 11pt; font-weight: 700 !important; margin: 0 0 10px 0; color: #000000 !important; border-bottom: 1px solid #e5e7eb !important; padding-bottom: 6px;">
                            <span style="color: #dc2626 !important; margin-right: 6px;">📕</span> 2. Specific Customer Purchase Order History (${orders.length} Records)
                        </h4>
                        ${orders.length === 0 ? '<div style="font-size: 9pt; color: #000000 !important; padding: 10px 0;">No prior purchases logged for this customer profile.</div>' : (() => {
                            let allProducts = [];
                            orders.forEach(o => {
                                if (Array.isArray(o.items) && o.items.length > 0) {
                                    o.items.forEach(it => {
                                        const name = it.title || it.name || it.productName || 'Gear Up Gadget Item';
                                        const specs = it.specs || it.description || '';
                                        const details = specs ? `${name} - ${specs}` : name;
                                        const qty = Number(it.quantity || it.qty || 1);
                                        const unitPrice = Number(it.price || it.unitPrice || (o.items.length === 1 ? Number(o.total || 0) : Math.round(Number(o.total || 0) / o.items.length)));
                                        const totalPrice = unitPrice * qty;
                                        allProducts.push({
                                             orderId: o.id,
                                             details: details,
                                             price: unitPrice,
                                             qty: qty,
                                             total: totalPrice
                                        });
                                    });
                                } else {
                                    const rawItems = o.productSummary ? o.productSummary.split(',').map(s => s.trim()).filter(Boolean) : ['Storefront Gadget Order'];
                                    const totalAmount = Number(o.total || 0);
                                    const splitPrice = Math.round(totalAmount / rawItems.length);
                                    rawItems.forEach(itemText => {
                                        const qtyMatch = itemText.match(/^(\d+)x\s*(.*)$/);
                                        const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
                                        const details = qtyMatch ? qtyMatch[2] : itemText;
                                        const unitPrice = splitPrice;
                                        const totalPrice = unitPrice * qty;
                                        allProducts.push({
                                             orderId: o.id,
                                             details: details,
                                             price: unitPrice,
                                             qty: qty,
                                             total: totalPrice
                                        });
                                    });
                                }
                            });

                            const firstOrder = orders[0] || {};
                            const totalOrdersAmount = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

                            return `
                                <!-- Compact Top Row: Order #, Date, Fulfillment, Payment, Total Amount -->
                                <div class="order-meta-top-row d-flex flex-wrap justify-content-between align-items-end pb-2 mb-2" style="border-bottom: none !important; gap: 8px;">
                                    <div class="order-data-box">
                                        <small class="order-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">ORDER #</small>
                                        <code class="order-id text-danger" style="color: #dc2626 !important; font-weight: 700 !important; font-family: monospace; font-size: 8.5pt;">${orders.map(o => o.id).join(', ')}</code>
                                    </div>
                                    <div class="order-data-box">
                                        <small class="order-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">DATE</small>
                                        <span class="order-data-val" style="color: #000000 !important; font-size: 8.5pt; font-weight: 500;">${firstOrder.date ? new Date(firstOrder.date).toLocaleDateString('en-GB') : 'Recent'}</span>
                                    </div>
                                    <div class="order-data-box">
                                        <small class="order-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">FULFILLMENT</small>
                                        <span class="order-data-val" style="color: ${firstOrder.orderStatus === 'Cancelled' ? '#dc2626' : '#000000'} !important; font-size: 8.5pt; font-weight: ${firstOrder.orderStatus === 'Cancelled' ? '700' : '500'};">${firstOrder.orderStatus || 'New Order'}</span>
                                    </div>
                                    <div class="order-data-box">
                                        <small class="order-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">PAYMENT</small>
                                        <span class="order-data-val" style="color: #000000 !important; font-size: 8.5pt; font-weight: 500;">${(!firstOrder.paymentStatus || firstOrder.paymentStatus === 'Pending') ? 'Cash on Delivery' : firstOrder.paymentStatus}</span>
                                    </div>
                                    <div class="order-data-box text-end">
                                        <small class="order-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px; text-align: right;">TOTAL AMOUNT</small>
                                        <strong class="order-amount-red text-danger" style="color: #dc2626 !important; font-size: 11pt; font-weight: 800 !important; display: block; text-align: right;">Rs. ${totalOrdersAmount.toLocaleString()}</strong>
                                    </div>
                                </div>

                                <div class="customer-payment-history" style="margin: 8px 0; font-size: 8.5pt; color: #000000 !important;">
                                    <strong>Payment Receipts:</strong>
                                    ${paymentRows.length ? `<table style="width: 100%; border-collapse: collapse; margin-top: 4px;"><thead><tr><th style="border: 1px solid #000; padding: 4px;">Date &amp; Time</th><th style="border: 1px solid #000; padding: 4px;">Payment Method</th><th style="border: 1px solid #000; padding: 4px;">Reference</th><th style="border: 1px solid #000; padding: 4px;">Paid Amount</th><th style="border: 1px solid #000; padding: 4px;">Balance</th></tr></thead><tbody>${paymentRowsHtml}</tbody></table>` : '<span> No payments recorded.</span>'}
                                </div>

                                <!-- Product Details Section: Strict Native HTML Table (Excel Spreadsheet Layout) -->
                                <div class="order-products-fullwidth w-100" style="width: 100% !important; margin-top: 6px;">
                                    <table class="order-products-table" style="border-collapse: collapse !important; width: 100% !important; border: 1px solid #000 !important; margin: 0 !important; background: #ffffff !important; table-layout: fixed !important;">
                                        <thead>
                                            <tr>
                                                <th style="border: 1px solid #000 !important; padding: 4px !important; width: 5%; text-align: center !important; font-weight: 700; color: #000000 !important; font-size: 8.5pt;">S.NO.</th>
                                                <th style="border: 1px solid #000 !important; padding: 4px !important; width: 60%; text-align: center !important; font-weight: 700; color: #000000 !important; font-size: 8.5pt;">PRODUCT DETAIL</th>
                                                <th style="border: 1px solid #000 !important; padding: 4px !important; width: 15%; text-align: center !important; font-weight: 700; color: #000000 !important; font-size: 8.5pt;">PRICE</th>
                                                <th style="border: 1px solid #000 !important; padding: 4px !important; width: 5%; text-align: center !important; font-weight: 700; color: #000000 !important; font-size: 8.5pt;">QTY</th>
                                                <th style="border: 1px solid #000 !important; padding: 4px !important; width: 15%; text-align: center !important; font-weight: 700; color: #000000 !important; font-size: 8.5pt;">TOTAL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${allProducts.map((p, idx) => `
                                                <tr>
                                                    <td style="border: 1px solid #000 !important; padding: 4px !important; width: 5%; text-align: center !important; color: #000000 !important; font-size: 8.5pt;">${idx + 1}</td>
                                                    <td style="border: 1px solid #000 !important; padding: 4px !important; width: 60%; text-align: left !important; color: #000000 !important; font-size: 8.5pt;">${p.details}</td>
                                                    <td style="border: 1px solid #000 !important; padding: 4px !important; width: 15%; text-align: center !important; color: #000000 !important; font-size: 8.5pt;">Rs. ${Number(p.price || 0).toLocaleString()}</td>
                                                    <td style="border: 1px solid #000 !important; padding: 4px !important; width: 5%; text-align: center !important; color: #000000 !important; font-size: 8.5pt;">${p.qty}</td>
                                                    <td style="border: 1px solid #000 !important; padding: 4px !important; width: 15%; text-align: center !important; color: #000000 !important; font-weight: bold; font-size: 8.5pt;">Rs. ${Number(p.total || 0).toLocaleString()}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `;
                        })()}
                    </div>

                    <!-- Official Seal & Disclaimer (Permanently Hidden in Print) -->
                    <div class="gug-slip-footer-disclaimer print-signature-block no-print" style="display: none !important; margin-top: 30px; padding-top: 15px; border-top: 1px dashed #cccccc !important; font-size: 8.5pt; color: #000000 !important;">
                        <div>
                            <div><strong style="color: #000000 !important;">Gear Up Gadgets Enterprise Systems</strong></div>
                            <div style="color: #000000 !important;">Official Customer Account Statement &bull; Valid without physical signature</div>
                            <div style="color: #000000 !important;">Computer Generated on ${dateFormatted} at ${timeFormatted}</div>
                        </div>
                        <div style="text-align: center; border-top: 1px solid #000000 !important; width: 180px; padding-top: 4px;">
                            <strong style="color: #000000 !important;">Customer CRM Officer</strong>
                        </div>
                    </div>
                </div>
            `;
        }

        generateSingleEmployeeSlipHtml(emp, currentUser, isLast = false) {
            const now = new Date();
            const dateFormatted = now.toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            const timeFormatted = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const refCode = 'EMP-SLIP-' + emp.id + '-' + Date.now().toString().slice(-6);
            const printText = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[character]);
            const payrollRecords = JSON.parse(localStorage.getItem('gug_finance_salaries') || '[]')
                .filter(salary => salary && (
                    String(salary.employeeId || '') === String(emp.id) ||
                    (!salary.employeeId && String(salary.name || '').toLowerCase() === String(emp.name || '').toLowerCase())
                ))
                .sort((first, second) => new Date(second.transactionAt || second.date || 0) - new Date(first.transactionAt || first.date || 0));
            const payrollRecord = payrollRecords[0] || {};
            const payrollPaid = Number(payrollRecord.paidAmount || (payrollRecord.status === 'Paid' ? payrollRecord.net : 0)) || 0;
            const payrollBalance = Number(payrollRecord.balanceAmount != null
                ? payrollRecord.balanceAmount
                : Math.max(0, Number(payrollRecord.net || 0) - payrollPaid)) || 0;
            const payrollPaymentDetails = `
                <div class="employee-payment-slip" style="border: 1px solid #cccccc !important; padding: 10px; margin-top: 10px; font-size: 9pt; color: #000000 !important; background: #ffffff !important;">
                    <strong>Payroll Payment Details</strong><br>
                    <strong>Payment Method:</strong> ${printText(payrollRecord.paymentMethod || payrollRecord.method || 'Not recorded')}<br>
                    ${payrollRecord.bankNetwork ? `<strong>Bank / Network:</strong> ${printText(payrollRecord.bankNetwork)}<br>` : ''}
                    <strong>Reference Number:</strong> ${printText(payrollRecord.transactionReference || payrollRecord.ref || payrollRecord.id || '—')}<br>
                    <strong>Paid Amount:</strong> Rs. ${payrollPaid.toLocaleString()}<br>
                    <strong>Balance Amount:</strong> Rs. ${payrollBalance.toLocaleString()}<br>
                    <strong>Payment Date &amp; Time:</strong> ${printText(payrollRecord.transactionAt || payrollRecord.date || 'Not recorded')}
                </div>`;

            const perms = Array.isArray(emp.permissions) ? emp.permissions : [];
            const baseSal = Number(emp.basicSalary || emp.salary || 0);
            const allowances = Number(emp.allowance || 0);
            const deductions = Number(emp.deductions || 0);
            const netSal = Math.max(0, baseSal + allowances - deductions);
            const cleanPhone = emp.phone || emp.whatsapp || 'N/A';

            return `
                <div class="gug-individual-slip ${isLast ? '' : 'gug-slip-page-break'}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #000000 !important; background: #ffffff !important; background-color: #ffffff !important; max-width: 800px; margin: 0 auto ${isLast ? '0' : '30px'}; padding: 25px; box-sizing: border-box; ${isLast ? 'page-break-after: auto !important; break-after: auto !important;' : 'page-break-after: always !important; break-after: page !important;'}">
                    <!-- Brand Header (Optimized Black & White Logo for Print) -->
                    <div class="text-center mb-3 pb-3 border-bottom gug-slip-brand-header" style="border-color: #000000 !important; background: #ffffff !important;">
                        <img src="assets/images/logo.png" alt="Gear Up Gadgets" class="gug-print-logo-img" style="max-height: 55px; height: 55px; object-fit: contain; margin: 0 auto 6px auto; display: block; background: transparent !important;">
                        <div style="font-size: 9pt; font-weight: 700 !important; text-transform: uppercase; color: #000000 !important; letter-spacing: 0.5px; margin-top: 2px;">
                            Central Enterprise Operating System &bull; Human Resources Division
                        </div>
                        <div style="font-size: 8.5pt; color: #000000 !important; margin-top: 2px;">
                            Shop F6, Technocity Mall, Hasrat Mohani Road, Karachi, Pakistan &bull; WhatsApp / UAN: +92 300 1234567 &bull; hr@gearupgadgets.com
                        </div>
                    </div>

                    <!-- Slip Meta Bar -->
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff !important; background-color: #ffffff !important; padding: 8px 12px; border-top: 1px solid #000000 !important; border-bottom: 1px solid #000000 !important; margin-bottom: 20px; font-size: 9pt; color: #000000 !important;">
                        <div><strong style="color: #000000 !important;">DOCUMENT:</strong> <span style="font-weight: 700 !important; color: #dc2626 !important; text-transform: uppercase;">Employee Service &amp; Payroll Record</span></div>
                        <div><strong style="color: #000000 !important;">REF #:</strong> <code class="order-id" style="color: #dc2626 !important; font-weight: 700 !important; background: #ffffff !important; border: 1px solid #cccccc !important; padding: 2px 6px; border-radius: 4px;">${refCode}</code></div>
                        <div><strong style="color: #000000 !important;">DATE:</strong> <span style="color: #000000 !important;">${dateFormatted} ${timeFormatted}</span></div>
                        <div><strong style="color: #000000 !important;">ISSUER:</strong> <span style="color: #000000 !important;">${currentUser.name || 'Admin'} (${currentUser.role})</span></div>
                    </div>

                    <!-- Employee Core Profile -->
                    <div class="gug-print-box gug-print-hr-profile" style="border: 1px solid #cccccc !important; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; color: #000000 !important;">
                        <h4 style="font-size: 12pt; font-weight: 700 !important; margin: 0 0 12px 0; color: #000000 !important; border-bottom: 1px solid #cccccc !important; padding-bottom: 6px;">
                            1. Personnel Identification &amp; Credentials
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 9.5pt; color: #000000 !important;">
                            <div><strong style="color: #000000 !important;">Full Name:</strong> <span style="color: #000000 !important; font-weight: 600;">${emp.name}</span></div>
                            <div><strong style="color: #000000 !important;">Employee ID:</strong> <code class="order-id text-danger" style="color: #dc2626 !important; font-weight: 700 !important; background: #ffffff !important; border: 1px solid #cccccc !important; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${emp.id}</code></div>
                            <div><strong style="color: #000000 !important;">Username:</strong> <span style="color: #2563eb !important; font-weight: 600;">@${emp.username || 'staff'}</span></div>
                            <div><strong style="color: #000000 !important;">Department:</strong> <span style="color: #000000 !important;">${emp.department || 'Operations'}</span></div>
                            <div><strong style="color: #000000 !important;">Designation / Role:</strong> <span style="color: #2563eb !important; font-weight: 600;">${emp.designation || emp.role}</span></div>
                            <div><strong style="color: #000000 !important;">Duty Hub / Warehouse:</strong> <span style="color: #2563eb !important;">${emp.dutyHub || emp.hub || 'WH-01 Central'}</span></div>
                            <div><strong style="color: #000000 !important;">CNIC:</strong> <span style="color: #000000 !important;">${emp.cnic || 'N/A'}</span></div>
                            <div><strong style="color: #000000 !important;">Phone / WhatsApp:</strong> <span style="color: #000000 !important;">${cleanPhone}</span></div>
                            <div><strong style="color: #000000 !important;">Email Address:</strong> <span style="color: #000000 !important;">${emp.email || 'N/A'}</span></div>
                            <div><strong style="color: #000000 !important;">Employment Status:</strong> <span style="font-weight: 700 !important; color: ${emp.status === 'Inactive' ? '#dc2626' : '#16a34a'} !important;">${emp.status || 'Active'}</span></div>
                        </div>
                    </div>

                    <!-- Remuneration & Compensation (HR Panel - Section 2) -->
                    <div class="gug-print-box hr-payroll-section gug-print-hr-compensation" style="border: 1px solid #cccccc !important; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; color: #000000 !important;">
                        <h4 style="font-size: 12pt; font-weight: 700 !important; margin: 0 0 12px 0; color: #000000 !important; border-bottom: 1px solid #cccccc !important; padding-bottom: 6px;">
                            <i class="fas fa-money-check-alt text-danger" style="color: #dc2626 !important; margin-right: 6px;"></i> 2. Monthly Compensation &amp; Payroll Breakdown
                        </h4>
                        <!-- Compensation Data Boxes: Small labels directly above data values -->
                        <div class="hr-compensation-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px;">
                            <div class="hr-compensation-box hr-data-box p-3 border rounded" style="background: #ffffff !important; background-color: #ffffff !important; border: 1px solid #cccccc !important;">
                                <small class="hr-label hr-data-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Basic Salary</small>
                                <span class="hr-data-val fw-bold" style="font-size: 10.5pt; font-weight: 700 !important; color: #000000 !important; display: block;">Rs. ${baseSal.toLocaleString()}</span>
                            </div>
                            <div class="hr-compensation-box hr-data-box p-3 border rounded" style="background: #ffffff !important; background-color: #ffffff !important; border: 1px solid #cccccc !important;">
                                <small class="hr-label hr-data-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Allowances / Bonus</small>
                                <span class="hr-data-val hr-allowance text-success fw-bold" style="font-size: 10.5pt; font-weight: 700 !important; color: #16a34a !important; display: block;">+ Rs. ${allowances.toLocaleString()}</span>
                            </div>
                            <div class="hr-compensation-box hr-data-box p-3 border rounded" style="background: #ffffff !important; background-color: #ffffff !important; border: 1px solid #cccccc !important;">
                                <small class="hr-label hr-data-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Deductions / Penalties</small>
                                <span class="hr-data-val hr-deduction text-danger fw-bold" style="font-size: 10.5pt; font-weight: 700 !important; color: #dc2626 !important; display: block;">- Rs. ${deductions.toLocaleString()}</span>
                            </div>
                            <div class="hr-compensation-box hr-data-box p-3 border rounded" style="background: #ffffff !important; background-color: #ffffff !important; border: 1px solid #cccccc !important;">
                                <small class="hr-label hr-data-label" style="font-size: 8pt; font-weight: bold !important; font-weight: 700 !important; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Net Monthly Remuneration</small>
                                <strong class="hr-data-val hr-net-salary text-success fw-bold" style="font-size: 11pt; font-weight: 800 !important; color: #16a34a !important; display: block;">Rs. ${netSal.toLocaleString()}</strong>
                            </div>
                        </div>

                        <!-- Itemized Payroll Table breakdown -->
                        <table class="hr-payroll-table" style="width: 100%; border-collapse: collapse; font-size: 9pt; background: #ffffff !important; background-color: #ffffff !important; color: #000000 !important; border: 1px solid #cccccc !important;">
                            <thead>
                                <tr style="background: #ffffff !important; background-color: #ffffff !important; text-align: left;">
                                    <th style="padding: 8px 10px; border: 1px solid #cccccc !important; background: #ffffff !important; color: #000000 !important; font-weight: 700 !important; font-size: 8.5pt; text-transform: uppercase;">Basic Salary</th>
                                    <th style="padding: 8px 10px; border: 1px solid #cccccc !important; background: #ffffff !important; color: #000000 !important; font-weight: 700 !important; font-size: 8.5pt; text-transform: uppercase;">Allowances / Bonus</th>
                                    <th style="padding: 8px 10px; border: 1px solid #cccccc !important; background: #ffffff !important; color: #000000 !important; font-weight: 700 !important; font-size: 8.5pt; text-transform: uppercase;">Deductions / Penalties</th>
                                    <th style="padding: 8px 10px; border: 1px solid #cccccc !important; background: #ffffff !important; color: #000000 !important; font-weight: 700 !important; font-size: 8.5pt; text-transform: uppercase;">Net Payable Salary</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="background: #ffffff !important; background-color: #ffffff !important;">
                                    <td data-label="Basic Salary" style="padding: 8px 10px; border: 1px solid #cccccc !important; font-weight: 700 !important; color: #000000 !important;">Rs. ${baseSal.toLocaleString()}</td>
                                    <td data-label="Allowances / Bonus" style="padding: 8px 10px; border: 1px solid #cccccc !important; color: #16a34a !important; font-weight: 700 !important;">+ Rs. ${allowances.toLocaleString()}</td>
                                    <td data-label="Deductions / Penalties" style="padding: 8px 10px; border: 1px solid #cccccc !important; color: #dc2626 !important; font-weight: 700 !important;">- Rs. ${deductions.toLocaleString()}</td>
                                    <td data-label="Net Payable Salary" style="padding: 8px 10px; border: 1px solid #cccccc !important; font-weight: 800 !important; font-size: 10.5pt; color: #16a34a !important;">Rs. ${netSal.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                        ${payrollPaymentDetails}
                    </div>

                    <!-- Access & Permissions Summary -->
                    <div class="gug-print-box" style="border: 1px solid #cccccc !important; border-radius: 6px; padding: 15px; margin-bottom: 15px; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; color: #000000 !important;">
                        <h4 style="font-size: 12pt; font-weight: 700 !important; margin: 0 0 12px 0; color: #000000 !important; border-bottom: 1px solid #cccccc !important; padding-bottom: 6px;">
                            3. ERP Security &amp; Authorized Modules (${perms.length} Granted)
                        </h4>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 8.5pt;">
                            ${perms.length > 0 ? perms.map(p => `<span style="border: 1px solid #cccccc !important; background: #ffffff !important; color: #000000 !important; padding: 3px 8px; border-radius: 4px; font-weight: 600 !important;">${p}</span>`).join('') : '<span style="color: #000000 !important;">No modules assigned</span>'}
                        </div>
                    </div>

                    <!-- Official Seal & Disclaimer (Permanently Hidden in Print) -->
                    <div class="gug-slip-footer-disclaimer print-signature-block no-print" style="display: none !important; margin-top: 30px; padding-top: 15px; border-top: 1px dashed #cccccc !important; font-size: 8.5pt; color: #000000 !important;">
                        <div>
                            <div><strong style="color: #000000 !important;">Gear Up Gadgets Enterprise Systems</strong></div>
                            <div style="color: #000000 !important;">Confidential Personnel Record &bull; Valid without physical signature</div>
                            <div style="color: #000000 !important;">Computer Generated on ${dateFormatted} at ${timeFormatted}</div>
                        </div>
                        <div style="text-align: center; border-top: 1px solid #000000 !important; width: 180px; padding-top: 4px;">
                            <strong style="color: #000000 !important;">Authorized HR Officer</strong>
                        </div>
                    </div>
                </div>
            `;
        }

        generateSingleDealerSlipHtml(d, summary, currentUser, isLast = false) {
            const now = new Date();
            const dateFormatted = now.toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            const timeFormatted = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const currentDay = dayNames[now.getDay()];
            const refCode = 'DLR-SLIP-' + d.id + '-' + Date.now().toString().slice(-6);

            const totalAmount = Number(summary && summary.totalAmount !== undefined
                ? summary.totalAmount
                : (d.totalAmount !== undefined ? d.totalAmount : (d.creditLimit || 0)));
            const ledgerPayments = summary && Array.isArray(summary.ledgerEntries)
                ? summary.ledgerEntries.filter(entry => ['PAYMENT_RECEIVED', 'ADVANCE_PAYMENT'].includes(entry.type) && Number(entry.credit || 0) > 0)
                    .map(entry => ({
                        ...entry,
                        amount: Number(entry.credit || 0),
                        paymentMethod: entry.paymentMethod,
                        transactionReference: entry.transactionReference || '',
                        balanceAfter: entry.runningBalance,
                        bankNetwork: entry.bankNetwork,
                        chequeNumber: entry.chequeNumber,
                        bankAccountNumber: entry.bankAccountNumber
                    }))
                : [];
            const payments = ledgerPayments.length
                ? ledgerPayments
                : (Array.isArray(d.paymentHistory) && d.paymentHistory.length > 0
                    ? d.paymentHistory
                    : (summary && Array.isArray(summary.paymentHistory) ? summary.paymentHistory : []));
            const calculatedPaid = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
            const paidAmount = Number(summary && summary.paidAmount !== undefined
                ? summary.paidAmount
                : (d.paidAmount !== undefined ? d.paidAmount : calculatedPaid));
            const calculatedBalance = Math.max(0, totalAmount - paidAmount);
            const balanceAmount = Number(summary && summary.balanceAmount !== undefined
                ? summary.balanceAmount
                : (d.balanceAmount !== undefined ? d.balanceAmount : calculatedBalance));
            const isAmountClear = Boolean(d.isAmountClear !== undefined ? d.isAmountClear : (totalAmount > 0 ? balanceAmount <= 0 : true));

            // Ordinal payment schedule naming helper (1 -> 1st Payment Schedule, 2 -> 2nd Payment Schedule, etc.)
            const getInstallmentTitle = (index) => {
                const s = ['th', 'st', 'nd', 'rd'];
                const v = (index + 1) % 100;
                return (index + 1) + (s[(v - 20) % 10] || s[v] || s[0]) + ' Payment Schedule';
            };
            const parsePaymentDate = (value) => {
                const legacyDate = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (legacyDate) {
                    return new Date(Number(legacyDate[3]), Number(legacyDate[2]) - 1, Number(legacyDate[1]));
                }
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? now : parsed;
            };

            // Strictly deduplicate payment history: ensure the final 'Amount Clear' entry is rendered only ONCE
            const cleanPayments = [];
            let zeroBalanceReached = false;
            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                const isZero = (p.balanceAfter !== undefined && Number(p.balanceAfter) <= 0);
                if (zeroBalanceReached && isZero) {
                    // Suppress duplicate Amount Clear entry
                    continue;
                }
                cleanPayments.push(p);
                if (isZero) {
                    zeroBalanceReached = true;
                }
            }

            // Build dynamic payment schedule cards (Strict 4-Row Architecture: Row 4 contains Paid & Balance, Row 5 removed)
            let cardsHtml = '';
            if (cleanPayments.length === 0) {
                // If the initial payment was 0, it still counts as the 1st Payment Schedule
                cardsHtml = `
                    <div class="dealer-ledger-box dealer-transaction-card payment-schedule-card" style="border: 1px solid #000000 !important; border-radius: 3px; padding: 3px 5px !important; margin-bottom: 3px !important; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; page-break-inside: avoid !important; break-inside: avoid !important;">
                        <!-- Row 1: Payment Schedule Title (Single, Full-Width, Left-Aligned Ordinal Header) -->
                        <div class="card-row-1" style="display: block; width: 100%; text-align: left; border-bottom: 1px solid #000000 !important; padding-bottom: 2px !important; margin-bottom: 2px !important;">
                            <strong class="dealer-label payment-schedule-title" style="font-size: 8pt; font-weight: 800 !important; color: #000000 !important; text-transform: uppercase; display: block; text-align: left;">1st Payment Schedule</strong>
                        </div>
                        <!-- Row 2: Date, Day, Time -->
                        <div class="card-row-2" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; border-bottom: 1px dotted #cccccc !important; padding-bottom: 2px !important; margin-bottom: 2px !important; font-size: 7.5pt; line-height: 1.2;">
                            <div><strong class="dealer-label" style="color: #000000 !important;">DATE:</strong> <span style="color: #000000 !important;">${d.createdAt || dateFormatted}</span></div>
                            <div><strong class="dealer-label" style="color: #000000 !important;">DAY:</strong> <span style="color: #000000 !important;">${currentDay}</span></div>
                            <div><strong class="dealer-label" style="color: #000000 !important;">TIME:</strong> <span style="color: #000000 !important;">${timeFormatted}</span></div>
                        </div>
                        <!-- Row 3: Total Amount (Debit) -->
                        <div class="card-row-3" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dotted #cccccc !important; padding-bottom: 2px !important; margin-bottom: 2px !important; font-size: 7.5pt;">
                            <strong class="dealer-label" style="color: #000000 !important;">DEBIT (TOTAL AMOUNT):</strong>
                            <span style="color: #dc2626 !important; font-weight: 700 !important;">Rs. ${totalAmount.toLocaleString()} (Total)</span>
                        </div>
                        <!-- Row 4: Left half = Paid Amount, Right half = Remaining Balance -->
                        <div class="card-row-4" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 7.5pt; align-items: center;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid #000000 !important; padding: 2px 4px !important; background: #ffffff !important;">
                                <strong class="dealer-label" style="color: #000000 !important;">CREDIT (PAID):</strong>
                                <span style="color: #16a34a !important; font-weight: 700 !important;">+ Rs. 0 (Paid)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid #000000 !important; padding: 2px 4px !important; background: #ffffff !important;">
                                <strong class="dealer-label" style="color: #000000 !important;">BALANCE:</strong>
                                <span style="color: ${totalAmount <= 0 ? '#16a34a' : '#000000'} !important; font-weight: 800 !important;">Rs. ${totalAmount.toLocaleString()} (Balance)</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                let runningBalance = totalAmount;
                cardsHtml = cleanPayments.map((p, idx) => {
                    const amt = Number(p.amount || 0);
                    runningBalance = Math.max(0, runningBalance - amt);
                    const balAfter = (p.balanceAfter !== undefined) ? Number(p.balanceAfter) : runningBalance;
                    const installmentTitle = getInstallmentTitle(idx);
                    const validPaymentDate = p.date ? parsePaymentDate(p.date) : now;
                    const paymentDateLabel = validPaymentDate.toLocaleDateString('en-PK');
                    const paymentDayLabel = p.day || dayNames[validPaymentDate.getDay()];
                    const paymentTimeLabel = p.time || validPaymentDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    const paymentReference = p.transactionReference || p.reference || p.paymentReference || '';

                    return `
                        <div class="dealer-ledger-box dealer-transaction-card payment-schedule-card" style="border: 1px solid #000000 !important; border-radius: 3px; padding: 3px 5px !important; margin-bottom: 3px !important; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; page-break-inside: avoid !important; break-inside: avoid !important;">
                            <!-- Row 1: Payment Schedule Title (Single, Full-Width, Left-Aligned Ordinal Header) -->
                            <div class="card-row-1" style="display: block; width: 100%; text-align: left; border-bottom: 1px solid #000000 !important; padding-bottom: 2px !important; margin-bottom: 2px !important;">
                                <strong class="dealer-label payment-schedule-title" style="font-size: 8pt; font-weight: 800 !important; color: #000000 !important; text-transform: uppercase; display: block; text-align: left;">${installmentTitle}</strong>
                            </div>
                            <!-- Row 2: Date, Day, Time -->
                            <div class="card-row-2" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; border-bottom: 1px dotted #cccccc !important; padding-bottom: 2px !important; margin-bottom: 2px !important; font-size: 7.5pt; line-height: 1.2;">
                                <div><strong class="dealer-label" style="color: #000000 !important;">DATE:</strong> <span style="color: #000000 !important;">${paymentDateLabel}</span></div>
                                <div><strong class="dealer-label" style="color: #000000 !important;">DAY:</strong> <span style="color: #000000 !important;">${paymentDayLabel}</span></div>
                                <div><strong class="dealer-label" style="color: #000000 !important;">TIME:</strong> <span style="color: #000000 !important;">${paymentTimeLabel}</span></div>
                            </div>
                            <div class="payment-method-reference" style="font-size: 7.5pt; line-height: 1.3; border-bottom: 1px dotted #cccccc !important; padding: 2px 0; margin-bottom: 2px;">
                                <strong>PAYMENT METHOD:</strong> ${p.paymentMethod || p.method || p.notes || 'Not recorded'}
                                ${p.bankNetwork ? ` &bull; <strong>BANK / NETWORK:</strong> ${p.bankNetwork}` : ''}
                                ${paymentReference ? `<br><strong>REFERENCE NUMBER:</strong> ${paymentReference}` : ''}
                            </div>
                            <!-- Row 3: Total Amount (Debit) -->
                            <div class="card-row-3" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dotted #cccccc !important; padding-bottom: 2px !important; margin-bottom: 2px !important; font-size: 7.5pt;">
                                <strong class="dealer-label" style="color: #000000 !important;">DEBIT (TOTAL AMOUNT):</strong>
                                <span style="color: ${idx === 0 ? '#dc2626' : '#000000'} !important; font-weight: 700 !important;">
                                    ${idx === 0 ? ('Rs. ' + totalAmount.toLocaleString() + ' (Total)') : '-'}
                                </span>
                            </div>
                            <!-- Row 4: Left half = Paid Amount, Right half = Remaining Balance -->
                            <div class="card-row-4" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 7.5pt; align-items: center;">
                                <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid #000000 !important; padding: 2px 4px !important; background: #ffffff !important;">
                                    <strong class="dealer-label" style="color: #000000 !important;">CREDIT (PAID):</strong>
                                    <span style="color: #16a34a !important; font-weight: 700 !important;">+ Rs. ${amt.toLocaleString()} (Paid)</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid #000000 !important; padding: 2px 4px !important; background: #ffffff !important;">
                                    <strong class="dealer-label" style="color: #000000 !important;">BALANCE:</strong>
                                    <span style="color: ${balAfter <= 0 ? '#16a34a' : '#000000'} !important; font-weight: 800 !important;">Rs. ${balAfter.toLocaleString()} (Balance)</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            const dealerMarket = d.shopNumber || d.market || (d.city ? d.city + ' Commercial Market' : 'Commercial Center');
            const dealerHeadOffice = d.headOffice || d.residentialAddress || (d.city ? d.city + ' Head Office' : 'Osif Center Unit');

            return `
                <div class="gug-individual-slip ${isLast ? '' : 'gug-slip-page-break'}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #000000 !important; background: #ffffff !important; background-color: #ffffff !important; max-width: 800px; margin: 0 auto; padding: 4px 8px !important; box-sizing: border-box; page-break-inside: avoid !important; break-inside: avoid !important; ${isLast ? 'page-break-after: auto !important; break-after: auto !important;' : 'page-break-after: always !important; break-after: page !important;'}">
                    <!-- Brand Header (Strict 'Dealer Slip' Header at the Top with Both Addresses) -->
                    <div class="text-center gug-slip-brand-header" style="border-bottom: 1px solid #000000 !important; background: #ffffff !important; margin-bottom: 3px !important; padding-bottom: 3px !important;">
                        <img src="assets/images/logo.png" alt="Gear Up Gadgets" class="gug-print-logo-img" style="max-height: 32px; height: 32px; object-fit: contain; margin: 0 auto 1px auto; display: block; background: transparent !important;">
                        <div class="gug-dealer-slip-title" style="font-size: 13pt; font-weight: 900 !important; text-transform: uppercase; color: #000000 !important; letter-spacing: 0.5px; margin: 1px 0; line-height: 1.1;">
                            Dealer Slip
                        </div>
                        <div style="font-size: 7.5pt; font-weight: 700 !important; text-transform: uppercase; color: #000000 !important; letter-spacing: 0.3px; margin: 0; line-height: 1.1;">
                            B2B Wholesale &bull; Payment Ledger &amp; Account Statement
                        </div>
                        <div style="font-size: 6.5pt; color: #000000 !important; margin: 1px 0 0 0; line-height: 1.25;">
                            <strong>Company / Shop Address:</strong> Shop F6, Technocity Mall, Hasrat Mohani Road, Karachi, Pakistan<br>
                            <strong>Head Office Address:</strong> D-5, 4th floor, Osif Center, Block 13 A, University Road Gulshan-e-Iqbal, Karachi-Pakistan<br>
                            <strong>Queries / WhatsApp:</strong> 021 34832214 &bull; <strong>Email:</strong> sales@gearupgadget.com
                        </div>
                    </div>

                    <!-- Slip Meta Bar -->
                    <div class="gug-slip-meta-bar" style="display: flex; justify-content: space-between; align-items: center; background: #ffffff !important; background-color: #ffffff !important; padding: 2px 6px !important; border-top: 1px solid #000000 !important; border-bottom: 1px solid #000000 !important; margin-bottom: 4px !important; font-size: 7.5pt; line-height: 1.15; color: #000000 !important;">
                        <div><strong style="color: #000000 !important;">DOCUMENT:</strong> <span style="font-weight: 800 !important; color: #dc2626 !important; text-transform: uppercase;">DEALER SLIP</span></div>
                        <div><strong style="color: #000000 !important;">REF #:</strong> <code class="order-id" style="color: #dc2626 !important; font-weight: 700 !important; background: #ffffff !important; border: 1px solid #000000 !important; padding: 0 3px; border-radius: 2px; font-size: 7.5pt;">${refCode}</code></div>
                        <div><strong style="color: #000000 !important;">DATE:</strong> <span style="color: #000000 !important;">${dateFormatted} ${timeFormatted}</span></div>
                        <div><strong style="color: #000000 !important;">ISSUER:</strong> <span style="color: #000000 !important;">${currentUser.name || 'Admin'} (${currentUser.role})</span></div>
                    </div>

                    <!-- Section 1: Dealer Profile & Ledger Summary (Ultra-Compact Minimum Vertical Height, Direct Inline Labels & Values) -->
                    <div class="gug-print-box dealer-overview-section" style="border: 1px solid #000000 !important; border-radius: 3px; padding: 3px 6px !important; margin-bottom: 4px !important; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; color: #000000 !important;">
                        <div style="font-size: 8pt; font-weight: 800 !important; margin: 0 0 2px 0 !important; color: #000000 !important; border-bottom: 1px solid #000000 !important; padding-bottom: 1px !important; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">
                            1. Dealer Identification &amp; Ledger Overview
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px 16px !important; font-size: 7.5pt; line-height: 1.2; color: #000000 !important; text-align: left;">
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; border-bottom: 1px dotted #e2e8f0; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Dealer Name:</strong>
                                <span style="color: #000000 !important; font-weight: 600; text-align: left;">${d.name}</span>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; border-bottom: 1px dotted #e2e8f0; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Dealer ID:</strong>
                                <code class="order-id text-danger" style="color: #dc2626 !important; font-weight: 700 !important; background: #ffffff !important; border: 1px solid #000000 !important; padding: 0 3px; border-radius: 2px; font-family: monospace; font-size: 7.5pt; text-align: left;">${d.id}</code>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; border-bottom: 1px dotted #e2e8f0; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Shop / Enterprise:</strong>
                                <span style="color: #2563eb !important; font-weight: 700; text-align: left;">${d.shopName}</span>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; border-bottom: 1px dotted #e2e8f0; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Market &amp; Head Office:</strong>
                                <span style="color: #000000 !important; text-align: left; font-size: 7pt; line-height: 1.15;">${dealerMarket} &bull; ${dealerHeadOffice}</span>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; border-bottom: 1px dotted #e2e8f0; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Phone / WhatsApp:</strong>
                                <span style="color: #000000 !important; text-align: left;">${d.phone || d.whatsapp || 'N/A'}</span>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; border-bottom: 1px dotted #e2e8f0; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">CNIC:</strong>
                                <span style="color: #000000 !important; text-align: left;">${d.cnic || 'N/A'}</span>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; border-bottom: 1px dotted #e2e8f0; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Total Deal Amount:</strong>
                                <span style="color: #000000 !important; font-weight: 700; text-align: left;">Rs. ${totalAmount.toLocaleString()} (Total)</span>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; border-bottom: 1px dotted #e2e8f0; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Total Paid Amount:</strong>
                                <span style="color: #16a34a !important; font-weight: 700; text-align: left;">Rs. ${paidAmount.toLocaleString()} (Paid)</span>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Remaining Balance:</strong>
                                <strong style="font-size: 8pt; font-weight: 800 !important; color: ${balanceAmount <= 0 ? '#16a34a' : '#dc2626'} !important; text-align: left;">Rs. ${balanceAmount.toLocaleString()} (Balance)</strong>
                            </div>
                            <div style="display: flex; justify-content: flex-start; align-items: center; gap: 6px; padding: 0; text-align: left;">
                                <strong style="color: #000000 !important; white-space: nowrap;">Payment Status:</strong>
                                ${isAmountClear || balanceAmount <= 0 
                                    ? '<span class="badge" style="background-color: #16a34a !important; color: #ffffff !important; font-weight: 800 !important; padding: 0 4px; border-radius: 2px; font-size: 7pt; border: 1px solid #16a34a !important; text-align: left;">AMOUNT CLEAR</span>' 
                                    : '<span class="badge" style="background-color: #dc2626 !important; color: #ffffff !important; font-weight: 800 !important; padding: 0 4px; border-radius: 2px; font-size: 7pt; border: 1px solid #dc2626 !important; text-align: left;">PENDING BALANCE</span>'}
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: Dealer Payment Schedule Timeline Cards (Compact 4-Row Cards) -->
                    <div class="gug-print-box dealer-ledger-section gug-print-dealer-ledger" style="border: 1px solid #000000 !important; border-radius: 3px; padding: 3px 6px !important; margin-bottom: 4px !important; background: #ffffff !important; background-color: #ffffff !important; box-shadow: none !important; color: #000000 !important; page-break-inside: avoid !important; break-inside: avoid !important;">
                        <div style="font-size: 8pt; font-weight: 800 !important; margin: 0 0 3px 0 !important; color: #000000 !important; border-bottom: 1px solid #000000 !important; padding-bottom: 1px !important; text-transform: uppercase; letter-spacing: 0.5px;">
                            <i class="fas fa-file-invoice-dollar text-danger" style="color: #dc2626 !important; margin-right: 3px;"></i> 2. Dealer Ledger &amp; Multi-Payment Schedule Timeline
                        </div>

                        <div class="dealer-ledger-cards-container dealer-ledger-table" style="margin-top: 2px !important;">
                            ${cardsHtml}
                        </div>

                        <!-- Final Summary Bar -->
                        <div class="dealer-ledger-summary-bar" style="border: 1px solid #000000 !important; border-radius: 2px; padding: 2px 4px !important; margin-top: 2px !important; background: #ffffff !important; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; font-size: 7.5pt; font-weight: 700; color: #000000 !important;">
                            <div><strong style="color: #000000 !important;">TOTAL DEAL:</strong> <span style="color: #dc2626 !important; font-weight: 700;">Rs. ${totalAmount.toLocaleString()} (Total)</span></div>
                            <div><strong style="color: #000000 !important;">TOTAL PAID:</strong> <span style="color: #16a34a !important; font-weight: 700;">Rs. ${paidAmount.toLocaleString()} (Paid)</span></div>
                            <div><strong style="color: #000000 !important;">FINAL BALANCE:</strong> <span style="color: ${balanceAmount <= 0 ? '#16a34a' : '#000000'} !important; font-weight: 800;">Rs. ${balanceAmount.toLocaleString()} (Balance)</span></div>
                        </div>
                    </div>
                </div>
            `;
        }

        printBatchCustomerSlips() {
            const customers = (typeof this.getCustomers === 'function') ? this.getCustomers() : [];
            if (!customers || customers.length === 0) {
                if (typeof this.showToast === 'function') this.showToast('No customer records available to print.', 'warning', 'Batch Print');
                return { success: false, message: 'No customer records' };
            }
            const currentUser = (typeof this.getCurrentUser === 'function') ? this.getCurrentUser() : { name: 'Admin', role: 'Super Admin' };
            const allOrders = (typeof this.getOrders === 'function') ? this.getOrders() : [];

            let printContainer = document.getElementById('gug-individual-print-container');
            if (!printContainer) {
                printContainer = document.createElement('div');
                printContainer.id = 'gug-individual-print-container';
                document.body.appendChild(printContainer);
            }

            const slipsHtml = customers.map((c, index) => {
                const orders = (typeof this.filterOrdersByCustomer === 'function')
                    ? this.filterOrdersByCustomer(c, allOrders)
                    : allOrders.filter(o => o.customer && (o.customer.id === c.id || o.customer.email === c.email || o.customer.phone === c.phone));
                
                let totalSpend = 0;
                orders.forEach(o => {
                    if (o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded') {
                        totalSpend += Number(o.total || o.totalAmount || 0);
                    }
                });

                const isLast = (index === customers.length - 1);
                return this.generateSingleCustomerSlipHtml(c, orders, totalSpend, currentUser, isLast);
            }).join('');

            printContainer.innerHTML = slipsHtml;

            document.body.classList.add('gug-individual-print-active');
            setTimeout(() => {
                window.print();
            }, 120);

            window.addEventListener('afterprint', () => {
                document.body.classList.remove('gug-individual-print-active');
            }, { once: true });
            setTimeout(() => {
                document.body.classList.remove('gug-individual-print-active');
            }, 3000);

            return { success: true, count: customers.length, mode: 'batch_customers' };
        }

        printBatchEmployeeSlips() {
            const employees = (typeof this.getEmployees === 'function') ? this.getEmployees() : [];
            if (!employees || employees.length === 0) {
                if (typeof this.showToast === 'function') this.showToast('No employee records available to print.', 'warning', 'Batch Print');
                return { success: false, message: 'No employee records' };
            }
            const currentUser = (typeof this.getCurrentUser === 'function') ? this.getCurrentUser() : { name: 'Admin', role: 'Super Admin' };

            let printContainer = document.getElementById('gug-individual-print-container');
            if (!printContainer) {
                printContainer = document.createElement('div');
                printContainer.id = 'gug-individual-print-container';
                document.body.appendChild(printContainer);
            }

            const slipsHtml = employees.map((emp, index) => {
                const isLast = (index === employees.length - 1);
                return this.generateSingleEmployeeSlipHtml(emp, currentUser, isLast);
            }).join('');

            printContainer.innerHTML = slipsHtml;

            document.body.classList.add('gug-individual-print-active');
            setTimeout(() => {
                window.print();
            }, 120);

            window.addEventListener('afterprint', () => {
                document.body.classList.remove('gug-individual-print-active');
            }, { once: true });
            setTimeout(() => {
                document.body.classList.remove('gug-individual-print-active');
            }, 3000);

            return { success: true, count: employees.length, mode: 'batch_employees' };
        }

        applyDealerSlipTheme(printContainer) {
            if (!printContainer) return;
            printContainer.querySelectorAll('.gug-individual-slip').forEach(slip => {
                slip.style.setProperty('color', '#000000', 'important');
                slip.style.setProperty('background', '#ffffff', 'important');
                slip.style.setProperty('border', '1px solid #cbd5e1', 'important');
                slip.style.setProperty('padding', '12px 16px', 'important');
                slip.style.setProperty('page-break-inside', 'auto', 'important');
                slip.style.setProperty('break-inside', 'auto', 'important');

                slip.querySelectorAll('*').forEach(element => {
                    element.style.setProperty('color', '#000000', 'important');
                });

                const applyPanel = (selector, background, border) => {
                    slip.querySelectorAll(selector).forEach(element => {
                        element.style.setProperty('background', background, 'important');
                        element.style.setProperty('color', '#000000', 'important');
                        if (border) element.style.setProperty('border-color', border, 'important');
                    });
                };

                const header = slip.querySelector('.gug-slip-brand-header');
                if (header) {
                    header.style.setProperty('background', 'transparent', 'important');
                    header.style.setProperty('background-color', 'transparent', 'important');
                    header.style.setProperty('color', '#000000', 'important');
                    header.style.setProperty('border', '0', 'important');
                    header.style.setProperty('padding', '0 0 3px', 'important');
                    header.querySelectorAll('*').forEach(element => {
                        element.style.setProperty('color', '#000000', 'important');
                    });
                    const logo = header.querySelector('.gug-print-logo-img');
                    if (logo) {
                        logo.style.setProperty('background', 'transparent', 'important');
                        logo.style.setProperty('border', '0', 'important');
                        logo.style.setProperty('box-shadow', 'none', 'important');
                    }
                }

                applyPanel('.gug-slip-meta-bar', '#eaf2ff', '#93c5fd');
                applyPanel('.dealer-overview-section', '#f1f5f9', '#cbd5e1');
                applyPanel('.dealer-ledger-section', '#fff7ed', '#fdba74');
                applyPanel('.payment-schedule-card', '#f8fafc', '#94a3b8');
                applyPanel('.payment-schedule-card .card-row-1', '#dbeafe');
                applyPanel('.payment-schedule-card .card-row-4 > div:first-child', '#dcfce7', '#86efac');
                applyPanel('.payment-schedule-card .card-row-4 > div:last-child', '#fef3c7', '#fcd34d');
                applyPanel('.dealer-ledger-summary-bar', '#e0f2fe', '#7dd3fc');
                slip.querySelectorAll('.dealer-overview-section .badge').forEach(badge => {
                    const isClear = badge.textContent.toLowerCase().includes('clear');
                    badge.style.setProperty('background', isClear ? '#dcfce7' : '#fee2e2', 'important');
                    badge.style.setProperty('border-color', isClear ? '#86efac' : '#fca5a5', 'important');
                    badge.style.setProperty('color', '#000000', 'important');
                });
                slip.querySelectorAll('.dealer-ledger-section').forEach(section => {
                    section.style.setProperty('page-break-inside', 'auto', 'important');
                    section.style.setProperty('break-inside', 'auto', 'important');
                });

                slip.querySelectorAll('.payment-schedule-card').forEach(card => {
                    card.style.setProperty('border-left', '3px solid #dc2626', 'important');
                    card.style.setProperty('padding', '6px 8px', 'important');
                    card.style.setProperty('margin-bottom', '6px', 'important');
                });
            });
        }

        printBatchDealerSlips() {
            const dealers = (typeof this.getDealers === 'function') ? this.getDealers() : [];
            if (!dealers || dealers.length === 0) {
                if (typeof this.showToast === 'function') this.showToast('No dealer records available to print.', 'warning', 'Batch Print');
                return { success: false, message: 'No dealer records' };
            }
            const currentUser = (typeof this.getCurrentUser === 'function') ? this.getCurrentUser() : { name: 'Admin', role: 'Super Admin' };

            let printContainer = document.getElementById('gug-individual-print-container');
            if (!printContainer) {
                printContainer = document.createElement('div');
                printContainer.id = 'gug-individual-print-container';
                document.body.appendChild(printContainer);
            }

            const slipsHtml = dealers.map((d, index) => {
                const summary = this.calculateDealerSummary(d.id);
                const isLast = (index === dealers.length - 1);
                return this.generateSingleDealerSlipHtml(d, summary, currentUser, isLast);
            }).join('');

            printContainer.innerHTML = slipsHtml;
            this.applyDealerSlipTheme(printContainer);

            document.body.classList.add('gug-individual-print-active');
            setTimeout(() => {
                window.print();
            }, 120);

            window.addEventListener('afterprint', () => {
                document.body.classList.remove('gug-individual-print-active');
            }, { once: true });
            setTimeout(() => {
                document.body.classList.remove('gug-individual-print-active');
            }, 3000);

            return { success: true, count: dealers.length, mode: 'batch_dealers' };
        }

        printEmployeeSlip(employeeId) {
            const emp = this.getEmployeeById(employeeId);
            if (!emp) {
                if (typeof this.showToast === 'function') this.showToast('Employee record not found!', 'danger', 'HR Slip');
                return { success: false, message: 'Employee not found' };
            }
            const currentUser = (typeof this.getCurrentUser === 'function') ? this.getCurrentUser() : { name: 'Admin', role: 'Super Admin' };
            const refCode = 'EMP-SLIP-' + emp.id + '-' + Date.now().toString().slice(-6);

            let printContainer = document.getElementById('gug-individual-print-container');
            if (!printContainer) {
                printContainer = document.createElement('div');
                printContainer.id = 'gug-individual-print-container';
                document.body.appendChild(printContainer);
            }

            printContainer.innerHTML = this.generateSingleEmployeeSlipHtml(emp, currentUser, true);

            document.body.classList.add('gug-individual-print-active');
            setTimeout(() => {
                window.print();
            }, 120);

            window.addEventListener('afterprint', () => {
                document.body.classList.remove('gug-individual-print-active');
            }, { once: true });
            setTimeout(() => {
                document.body.classList.remove('gug-individual-print-active');
            }, 3000);

            return { success: true, employeeId: emp.id, refCode };
        }

        printCustomerSlip(customerId) {
            const customers = this.getCustomers();
            const cleanId = String(customerId).trim().toLowerCase();
            const c = customers.find(item => String(item.id).trim().toLowerCase() === cleanId);
            if (!c) {
                if (typeof this.showToast === 'function') this.showToast('Customer record not found!', 'danger', 'CRM Slip');
                return { success: false, message: 'Customer not found' };
            }
            const currentUser = (typeof this.getCurrentUser === 'function') ? this.getCurrentUser() : { name: 'Admin', role: 'Super Admin' };
            const allOrders = this.getOrders();
            const orders = (typeof this.filterOrdersByCustomer === 'function')
                ? this.filterOrdersByCustomer(c, allOrders)
                : allOrders.filter(o => o.customer && (o.customer.id === c.id || o.customer.email === c.email || o.customer.phone === c.phone));

            const refCode = 'CUST-SLIP-' + c.id + '-' + Date.now().toString().slice(-6);

            let totalSpend = 0;
            orders.forEach(o => {
                if (o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded') {
                    totalSpend += Number(o.total || o.totalAmount || 0);
                }
            });

            let printContainer = document.getElementById('gug-individual-print-container');
            if (!printContainer) {
                printContainer = document.createElement('div');
                printContainer.id = 'gug-individual-print-container';
                document.body.appendChild(printContainer);
            }

            printContainer.innerHTML = this.generateSingleCustomerSlipHtml(c, orders, totalSpend, currentUser, true);

            document.body.classList.add('gug-individual-print-active');
            setTimeout(() => {
                window.print();
            }, 120);

            window.addEventListener('afterprint', () => {
                document.body.classList.remove('gug-individual-print-active');
            }, { once: true });
            setTimeout(() => {
                document.body.classList.remove('gug-individual-print-active');
            }, 3000);

            return { success: true, customerId: c.id, refCode };
        }

        printDealerSlip(dealerId) {
            const summary = this.calculateDealerSummary(dealerId);
            if (!summary || !summary.dealer) {
                if (typeof this.showToast === 'function') this.showToast('Dealer record not found!', 'danger', 'Dealer Slip');
                return { success: false, message: 'Dealer not found' };
            }
            const d = summary.dealer;
            const currentUser = (typeof this.getCurrentUser === 'function') ? this.getCurrentUser() : { name: 'Admin', role: 'Super Admin' };
            const refCode = 'DLR-SLIP-' + d.id + '-' + Date.now().toString().slice(-6);

            let printContainer = document.getElementById('gug-individual-print-container');
            if (!printContainer) {
                printContainer = document.createElement('div');
                printContainer.id = 'gug-individual-print-container';
                document.body.appendChild(printContainer);
            }

            printContainer.innerHTML = this.generateSingleDealerSlipHtml(d, summary, currentUser, true);
            this.applyDealerSlipTheme(printContainer);

            document.body.classList.add('gug-individual-print-active');
            setTimeout(() => {
                window.print();
            }, 120);

            window.addEventListener('afterprint', () => {
                document.body.classList.remove('gug-individual-print-active');
            }, { once: true });
            setTimeout(() => {
                document.body.classList.remove('gug-individual-print-active');
            }, 3000);

            return { success: true, dealerId: d.id, refCode };
        }

        toggleAdminMobileSidebar(force) {
            const sidebar = document.querySelector('.admin-sidebar');
            let backdrop = document.getElementById('admin-sidebar-backdrop');
            if (!sidebar) return;

            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'admin-sidebar-backdrop';
                backdrop.className = 'admin-sidebar-backdrop';
                backdrop.onclick = () => this.toggleAdminMobileSidebar(false);
                document.body.appendChild(backdrop);
            }

            const isCurrentlyOpen = sidebar.classList.contains('mobile-open') || sidebar.classList.contains('show');
            const shouldOpen = (force !== undefined) ? Boolean(force) : !isCurrentlyOpen;

            if (shouldOpen) {
                sidebar.classList.add('mobile-open');
                sidebar.classList.add('show');
                backdrop.classList.add('show');
                backdrop.classList.add('active');
                document.body.style.overflow = 'hidden';
            } else {
                sidebar.classList.remove('mobile-open');
                sidebar.classList.remove('show');
                backdrop.classList.remove('show');
                backdrop.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        initAdminMobileExperience() {
            if (typeof document === 'undefined') return;

            // 1. Ensure backdrop exists and sidebar has mobile close button
            const sidebar = document.querySelector('.admin-sidebar');
            if (sidebar) {
                let backdrop = document.getElementById('admin-sidebar-backdrop');
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.id = 'admin-sidebar-backdrop';
                    backdrop.className = 'admin-sidebar-backdrop';
                    backdrop.onclick = () => this.toggleAdminMobileSidebar(false);
                    document.body.appendChild(backdrop);
                }

                // Close button inside sidebar on mobile
                if (!sidebar.querySelector('.admin-sidebar-close-btn')) {
                    const closeBtn = document.createElement('button');
                    closeBtn.type = 'button';
                    closeBtn.className = 'btn btn-sm btn-outline-danger d-md-none admin-sidebar-close-btn';
                    closeBtn.style.cssText = 'position: absolute; right: 12px; top: 14px; z-index: 10; width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;';
                    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
                    closeBtn.onclick = () => this.toggleAdminMobileSidebar(false);
                    sidebar.prepend(closeBtn);
                }

                // Auto-close sidebar when clicking links on mobile
                sidebar.querySelectorAll('.admin-nav-link').forEach(link => {
                    if (!link.dataset.mobileBound) {
                        link.dataset.mobileBound = 'true';
                        link.addEventListener('click', () => {
                            if (window.innerWidth <= 768) {
                                this.toggleAdminMobileSidebar(false);
                            }
                        });
                    }
                });
            }

            // 2. Initialize Responsive Card Tables with dynamic data-label injection
            this.initResponsiveTableCards();
        }

        initResponsiveTableCards() {
            if (typeof document === 'undefined') return;

            const applyLabels = () => {
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
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

            // Observe dynamic table re-renders across ERP
            if (typeof MutationObserver !== 'undefined' && !this._tableCardObserver && document.body) {
                this._tableCardObserver = new MutationObserver(() => {
                    applyLabels();
                });
                this._tableCardObserver.observe(document.body, { childList: true, subtree: true });
            }
        }

        switchCurrentRole(newRole) {
            localStorage.setItem('admin_role', newRole);
            const defaultPerms = this.getRoleDefaultPermissions(newRole);
            localStorage.setItem('admin_permissions', JSON.stringify(defaultPerms));

            this.logAudit({
                action: 'ROLE_VIEW_SWITCHED',
                entity: 'SESSION',
                newValue: `${newRole} (Permissions: ${defaultPerms.length} modules)`,
                reason: 'User switched dashboard perspective'
            });
            window.location.reload();
        }

        openGlobalSearchModal() {
            let modalEl = document.getElementById('gugGlobalSearchModal');
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = 'gugGlobalSearchModal';
                modalEl.className = 'modal fade';
                modalEl.innerHTML = `
                    <div class="modal-dialog modal-dialog-centered modal-lg">
                        <div class="modal-content shadow-lg border-0">
                            <div class="modal-header border-bottom p-3">
                                <div class="input-group">
                                    <span class="input-group-text bg-white border-0 fs-5 text-danger"><i class="fas fa-search"></i></span>
                                    <input type="text" id="gug-global-search-input" class="form-control border-0 fs-5 shadow-none" placeholder="Type to search Products, Orders, Serials, Customers, Suppliers..." autocomplete="off">
                                </div>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body p-0" style="max-height: 420px; overflow-y: auto;">
                                <div id="gug-global-search-results" class="list-group list-group-flush">
                                    <div class="text-center text-muted p-4">
                                        <i class="fas fa-keyboard fs-3 mb-2 d-block text-secondary"></i>
                                        Search across orders (#GUG-8821), serials (SN-GUG-SW-...), customer names, or product SKUs.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modalEl);

                const input = document.getElementById('gug-global-search-input');
                input.addEventListener('input', (e) => {
                    const val = e.target.value;
                    const results = this.globalSearch(val);
                    const container = document.getElementById('gug-global-search-results');
                    if (!val) {
                        container.innerHTML = `<div class="text-center text-muted p-4"><i class="fas fa-keyboard fs-3 mb-2 d-block text-secondary"></i>Start typing to search...</div>`;
                        return;
                    }
                    if (results.length === 0) {
                        container.innerHTML = `<div class="text-center text-muted p-4"><i class="fas fa-box-open fs-3 mb-2 d-block text-secondary"></i>No matching records found for "${val}".</div>`;
                        return;
                    }
                    container.innerHTML = results.map(r => `
                        <a href="${r.link}" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3">
                            <div>
                                <span class="badge bg-light text-dark border me-2">${r.badge}</span>
                                <strong class="text-dark">${r.title}</strong>
                                <div class="text-secondary small mt-1">${r.subtitle}</div>
                            </div>
                            <i class="fas fa-arrow-right text-muted small"></i>
                        </a>
                    `).join('');
                });
            }
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
            setTimeout(() => {
                const inp = document.getElementById('gug-global-search-input');
                if (inp) { inp.value = ''; inp.focus(); }
            }, 300);
        }

        navigateToAdminPage(url) {
            const sidebar = document.querySelector('.admin-sidebar');
            if (sidebar) {
                sessionStorage.setItem('gug_admin_sidebar_scroll', sidebar.scrollTop);
            }
            window.location.href = url;
        }

        initSidebarScrollManager() {
            const sidebar = document.querySelector('.admin-sidebar');
            if (!sidebar) return;

            // Ensure manual scroll restoration
            if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
                history.scrollRestoration = 'manual';
            }

            const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
            
            // 1. Sync Active Nav Link
            const navLinks = sidebar.querySelectorAll('.admin-nav-link');
            let activeLink = null;
            navLinks.forEach(link => {
                const href = (link.getAttribute('href') || '').split('/').pop().split('?')[0].split('#')[0];
                if (href && (href === currentPath || (currentPath === '' && href === 'dashboard.html'))) {
                    link.classList.add('active');
                    activeLink = link;
                } else if (href && !link.getAttribute('onclick')) {
                    link.classList.remove('active');
                }
            });

            // 2. Initialize Collapsible Accordions
            const accordionHeaders = sidebar.querySelectorAll('.sidebar-accordion-header');
            const savedAccordionStates = JSON.parse(sessionStorage.getItem('gug_admin_accordion_states') || '{}');

            accordionHeaders.forEach(header => {
                const targetId = header.getAttribute('data-target');
                const body = targetId ? sidebar.querySelector('#' + targetId) : header.nextElementSibling;
                if (!body) return;

                // Check if this accordion group contains the active link
                const hasActiveChild = body.querySelector('.admin-nav-link.active') !== null;

                // Auto-open if contains active child or previously opened by user
                if (hasActiveChild) {
                    header.classList.add('open', 'active-category');
                    body.classList.add('open');
                } else if (savedAccordionStates[targetId] === true || (savedAccordionStates[targetId] === undefined && !header.classList.contains('start-collapsed'))) {
                    header.classList.add('open');
                    body.classList.add('open');
                } else if (savedAccordionStates[targetId] === false) {
                    header.classList.remove('open');
                    body.classList.remove('open');
                }

                // Prevent multiple listeners
                if (!header.dataset.accordionInit) {
                    header.dataset.accordionInit = 'true';
                    header.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const currentScroll = sidebar.scrollTop;
                        const isOpen = body.classList.contains('open');
                        if (isOpen) {
                            body.classList.remove('open');
                            header.classList.remove('open');
                            if (targetId) savedAccordionStates[targetId] = false;
                        } else {
                            body.classList.add('open');
                            header.classList.add('open');
                            if (targetId) savedAccordionStates[targetId] = true;
                        }

                        sessionStorage.setItem('gug_admin_accordion_states', JSON.stringify(savedAccordionStates));
                        sessionStorage.setItem('gug_admin_sidebar_scroll', currentScroll);
                        sidebar.scrollTop = currentScroll;
                    });
                }
            });

            // 2.5 Ensure every sidebar navigation link has an explicit active routing handler
            navLinks.forEach(link => {
                if (!link.dataset.adminRouteBound) {
                    link.dataset.adminRouteBound = 'true';
                    link.addEventListener('click', function(e) {
                        const href = this.getAttribute('href');
                        if (this.getAttribute('target') === '_blank') return;
                        if (this.getAttribute('onclick')) return;

                        if (href && href !== '#' && !href.startsWith('javascript:')) {
                            e.preventDefault();
                            sessionStorage.setItem('gug_admin_sidebar_scroll', sidebar.scrollTop);
                            window.location.href = href;
                        }
                    });
                }
            });

            // 3. Save exact scroll position continuously & synchronously on scroll & mousedown
            sidebar.addEventListener('scroll', () => {
                sessionStorage.setItem('gug_admin_sidebar_scroll', sidebar.scrollTop);
            }, { passive: true });

            sidebar.addEventListener('mousedown', () => {
                sessionStorage.setItem('gug_admin_sidebar_scroll', sidebar.scrollTop);
            }, { passive: true });

            // 4. Preserve sidebar scroll position on admin link navigation (zero scroll jump)
            if (!window.__gug_admin_nav_bound) {
                window.__gug_admin_nav_bound = true;

                document.addEventListener('click', (e) => {
                    const link = e.target.closest('a');
                    if (!link) return;

                    const href = link.getAttribute('href');
                    if (!href) return;

                    if (sidebar) {
                        sessionStorage.setItem('gug_admin_sidebar_scroll', sidebar.scrollTop);
                    }
                }, { passive: true });
            }

            // 5. Instant scroll restoration without visual jump
            const restoreScroll = () => {
                const savedScroll = sessionStorage.getItem('gug_admin_sidebar_scroll');
                if (savedScroll !== null && !isNaN(savedScroll)) {
                    sidebar.scrollTop = parseFloat(savedScroll);
                } else if (activeLink) {
                    const linkTop = activeLink.offsetTop;
                    const linkHeight = activeLink.offsetHeight;
                    const sidebarHeight = sidebar.clientHeight;
                    if (linkTop < sidebar.scrollTop || (linkTop + linkHeight) > (sidebar.scrollTop + sidebarHeight)) {
                        sidebar.scrollTop = Math.max(0, linkTop - Math.floor(sidebarHeight / 3));
                    }
                }
            };

            restoreScroll();
            requestAnimationFrame(restoreScroll);
            window.addEventListener('pageshow', restoreScroll);
        }
    }

    // Tab Switching & Viewport Scroll Isolation (Zero Scroll Jump Glitch)
    document.addEventListener('show.bs.tab', () => {
        window.__gug_tab_scroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    }, { passive: true });
    
    document.addEventListener('shown.bs.tab', () => {
        if (typeof window.__gug_tab_scroll === 'number') {
            window.scrollTo({ top: window.__gug_tab_scroll, behavior: 'instant' });
            requestAnimationFrame(() => {
                if (typeof window.__gug_tab_scroll === 'number') {
                    window.scrollTo({ top: window.__gug_tab_scroll, behavior: 'instant' });
                }
            });
        }
    }, { passive: true });

    document.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('[data-bs-toggle="tab"], [data-bs-toggle="pill"], .nav-link');
        if (tabBtn && tabBtn.closest('.nav-tabs, .nav-pills, .custom-nav-pills, .nav-tabs-erp, .modal-nav-tabs')) {
            const lockedY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
            window.__gug_tab_scroll = lockedY;
            setTimeout(() => {
                if (typeof window.__gug_tab_scroll === 'number') {
                    window.scrollTo({ top: window.__gug_tab_scroll, behavior: 'instant' });
                }
            }, 0);
            setTimeout(() => {
                if (typeof window.__gug_tab_scroll === 'number') {
                    window.scrollTo({ top: window.__gug_tab_scroll, behavior: 'instant' });
                }
            }, 50);
        }
    }, { capture: true, passive: true });

    // Global prevention of empty '#' hash jumps that reset window scroll to top
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href="#"]');
        if (link && !link.getAttribute('data-bs-toggle') && !link.getAttribute('role')) {
            e.preventDefault();
        }
    }, { capture: true });

    // Keyboard shortcut for Ctrl+K
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (window.GUG_DB) window.GUG_DB.openGlobalSearchModal();
        }
    });

    // Global Theme & Dynamic Background Synchronizer for all ERP & Portal Panels
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
    if (!window.hexToRgba) window.hexToRgba = hexToRgba;

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

        const glassCardBg = hexToRgba(bgCard, 0.45);
        const glassHeaderBg = hexToRgba(navbarBg, 0.55);
        const glassTopbarBg = hexToRgba(topbarBg, 0.60);
        const glassFooterBg = hexToRgba(footerBg, 0.65);
        const glassSidebarBg = hexToRgba(navbarBg, 0.60);
        const glassDropdownBg = hexToRgba(navbarBg, 0.85);
        const accentGlow = hexToRgba(accentRed, 0.25);
        const accentHoverBorder = hexToRgba(accentRed, 0.55);

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
            const rawBgImg = (cfg.bgImage !== undefined && cfg.bgImage !== null && cfg.bgImage !== '') 
                ? cfg.bgImage 
                : (cfg.bgType !== 'none' && cfg.bgType !== 'video' ? 'assets/images/custom-bg.jpg' : null);
            const hasValidImage = !!(rawBgImg && String(rawBgImg).trim() && rawBgImg !== 'null');
            const isImageType = cfg.bgType === 'image' || (!cfg.bgType && hasValidImage) || (hasValidImage && cfg.bgType !== 'none' && cfg.bgType !== 'video');

            if (isImageType && hasValidImage) {
                const cleanImg = String(rawBgImg).replace(/^url\(["']?/, '').replace(/["']?\)$/, '').trim();
                bgImage = `linear-gradient(${overlayColor}, ${overlayColor}), url("${cleanImg}")`;
                bgSize = 'cover, cover';
                bgRepeat = 'no-repeat, no-repeat';
                bgPosition = 'center top, center top';
                bgAttachment = `${bgAttachment}, ${bgAttachment}`;
            } else {
                const encodedAccent = encodeURIComponent(accentRed);
                bgImage = `radial-gradient(ellipse at 50% 0%, ${hexToRgba(accentRed, 0.18)} 0%, transparent 60%), radial-gradient(ellipse at 85% 100%, ${hexToRgba(accentRed, 0.12)} 0%, transparent 50%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg id='hex-mesh' fill='${encodedAccent}' fill-opacity='0.12' fill-rule='nonzero'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v13.2l11 6.35 11-6.35V17.9L14 11.55 3 17.9zm11 1.73l9 5.2v10.38l-9 5.2-9-5.2V24.83l9-5.2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;
                bgSize = 'cover, cover, 28px 49px';
                bgRepeat = 'no-repeat, no-repeat, repeat';
                bgPosition = 'center top, center top, center top';
                bgAttachment = 'fixed, fixed, fixed';
            }
        }

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
            root.style.setProperty('--ios-glass-bg-sidebar', glassSidebarBg);
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
                --ios-glass-bg-sidebar: ${glassSidebarBg} !important;
                --ios-glass-bg-dropdown: ${glassDropdownBg} !important;
                --accent-glow: ${accentGlow} !important;
                --accent-hover-border: ${accentHoverBorder} !important;
            }
            html, body {
                background-color: ${bgColor} !important;
                background-image: ${bgImage} !important;
                background-size: ${bgSize} !important;
                background-attachment: ${bgAttachment} !important;
                background-repeat: ${bgRepeat} !important;
                background-position: ${bgPosition} !important;
                color: #ffffff !important;
            }
            .tf-header, .portal-header {
                background: ${glassHeaderBg} !important;
                backdrop-filter: blur(24px) saturate(200%) !important;
                -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4) !important;
                ${stickyNavbar ? '' : 'position: relative !important;'}
            }
            .admin-sidebar {
                background: ${glassSidebarBg} !important;
                backdrop-filter: blur(24px) saturate(200%) !important;
                -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
                border-right: 1px solid rgba(255, 255, 255, 0.1) !important;
            }
            .card, .product-card, .shop-card, .card-product, .cat-card, .custom-pc-card, .home-repair-card,
            .erp-card, .admin-card, .portal-card, .dealer-card, .kpi-card, .task-item, .widget-card {
                background: ${glassCardBg} !important;
                background-color: ${glassCardBg} !important;
                backdrop-filter: blur(24px) saturate(200%) !important;
                -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
                color: #ffffff !important;
            }
            .card:hover, .product-card:hover, .cat-card:hover, .custom-pc-card:hover, .home-repair-card:hover,
            .erp-card:hover, .admin-card:hover, .portal-card:hover, .dealer-card:hover, .task-item:hover, .widget-card:hover {
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
            .form-switch, .form-check.form-switch {
                display: inline-flex !important;
                align-items: center !important;
                padding-left: 3.3em !important;
                min-height: 1.6rem !important;
                position: relative !important;
                vertical-align: middle !important;
            }
            .form-switch .form-check-input, .form-check.form-switch .form-check-input {
                width: 2.85em !important;
                height: 1.5em !important;
                min-width: 2.85em !important;
                min-height: 1.5em !important;
                margin-left: -3.3em !important;
                margin-top: 0 !important;
                margin-right: 0.5em !important;
                vertical-align: middle !important;
                border-radius: 2em !important;
                -webkit-appearance: none !important;
                -moz-appearance: none !important;
                appearance: none !important;
                cursor: pointer !important;
                flex-shrink: 0 !important;
                opacity: 1 !important;
                visibility: visible !important;
                display: inline-block !important;
                background-color: #1e293b !important;
                border: 1.5px solid rgba(255, 255, 255, 0.45) !important;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5) !important;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e") !important;
                background-position: left center !important;
                background-repeat: no-repeat !important;
                background-size: contain !important;
                transition: background-position 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease !important;
            }
            .form-switch .form-check-input:hover, .form-check.form-switch .form-check-input:hover {
                border-color: rgba(255, 255, 255, 0.8) !important;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5), 0 0 8px rgba(255, 255, 255, 0.25) !important;
            }
            .form-switch .form-check-input:focus, .form-check.form-switch .form-check-input:focus,
            .form-switch .form-check-input:focus:not(:checked), .form-check.form-switch .form-check-input:focus:not(:checked) {
                background-color: #1e293b !important;
                border-color: rgba(255, 255, 255, 0.7) !important;
                box-shadow: 0 0 0 3px rgba(229, 3, 3, 0.35), inset 0 2px 4px rgba(0, 0, 0, 0.5) !important;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e") !important;
                background-position: left center !important;
                background-repeat: no-repeat !important;
                background-size: contain !important;
                outline: none !important;
            }
            .form-switch .form-check-input:checked, .form-check.form-switch .form-check-input:checked {
                background-color: ${accentRed} !important;
                border-color: ${accentRed} !important;
                box-shadow: 0 0 14px ${accentGlow}, inset 0 1px 2px rgba(255, 255, 255, 0.2) !important;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e") !important;
                background-position: right center !important;
                background-repeat: no-repeat !important;
                background-size: contain !important;
            }
            .form-switch .form-check-input:focus:checked, .form-switch .form-check-input:checked:focus,
            .form-check.form-switch .form-check-input:focus:checked, .form-check.form-switch .form-check-input:checked:focus {
                background-color: ${accentRed} !important;
                border-color: ${accentRed} !important;
                box-shadow: 0 0 0 3px rgba(229, 3, 3, 0.4), 0 0 16px ${accentGlow} !important;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e") !important;
                background-position: right center !important;
                background-repeat: no-repeat !important;
                background-size: contain !important;
                outline: none !important;
            }
        `;
    }

    if (!window.applyGlobalTheme) {
        window.applyGlobalTheme = applyGlobalTheme;
    }

    try { applyGlobalTheme(); } catch(e) {}

    window.addEventListener('storage', (e) => {
        if (!e || !e.key || e.key === 'gug_event_theme_config') {
            try { applyGlobalTheme(); } catch(err) {}
        }
        if (!e || !e.key || e.key === STORAGE_KEYS.EMPLOYEES || e.key === 'staff_permissions' || e.key === 'admin_deleted_employees') {
            if (window.GUG_DB) window.GUG_DB._employeesCache = null;
        }
    });

    window.addEventListener('gugThemeUpdated', () => {
        try { applyGlobalTheme(); } catch(err) {}
    });

    // =========================================================================
    // GLOBAL SECURITY & PASSWORD INPUT SHOW/HIDE TOGGLE SYSTEM
    // =========================================================================
    window.togglePasswordVisibility = function(target, iconTarget) {
        let input = null;
        let icon = null;

        if (!target) {
            if (window.event && window.event.currentTarget) {
                const btn = window.event.currentTarget;
                icon = btn.querySelector('i');
                const group = btn.closest('.input-group') || btn.parentElement;
                if (group) input = group.querySelector('input');
            }
            if (!input) {
                input = document.getElementById('admin-password') || 
                        document.getElementById('dealer-password') || 
                        document.getElementById('staff-password');
            }
        } else if (typeof target === 'string') {
            input = document.getElementById(target);
        } else if (target instanceof HTMLElement) {
            if (target.tagName === 'INPUT') {
                input = target;
            } else {
                icon = target.querySelector('i');
                const group = target.closest('.input-group') || target.parentElement;
                if (group) input = group.querySelector('input');
            }
        }

        if (!icon && iconTarget) {
            if (typeof iconTarget === 'string') {
                icon = document.getElementById(iconTarget);
            } else if (iconTarget instanceof HTMLElement) {
                icon = iconTarget.tagName === 'I' ? iconTarget : iconTarget.querySelector('i');
            }
        }

        if (input && !icon) {
            const group = input.closest('.input-group') || input.parentElement;
            if (group) icon = group.querySelector('.fa-eye, .fa-eye-slash');
        }

        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                icon.setAttribute('title', 'Hide');
                if (icon.parentElement) icon.parentElement.setAttribute('title', 'Hide');
            }
        } else {
            input.type = 'password';
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                icon.setAttribute('title', 'Show');
                if (icon.parentElement) icon.parentElement.setAttribute('title', 'Show');
            }
        }
    };

    window.initSecurityInputToggles = function() {
        const selector = 'input[type="password"], input.security-input, input.api-key-input, input[data-toggle-security]';
        const inputs = document.querySelectorAll(selector);

        inputs.forEach(input => {
            const parent = input.parentElement;
            if (!parent) return;

            const existingBtn = parent.querySelector('.btn-security-toggle, .btn-pw-toggle, [onclick*="togglePasswordVisibility"], [onclick*="toggleModalPwVisibility"]');
            if (existingBtn) {
                if (!existingBtn.querySelector('i')) {
                    existingBtn.innerHTML = '<i class="fas fa-eye"></i>';
                }
                return;
            }

            // Ensure masked default state
            input.type = 'password';

            let group = input.closest('.input-group');
            if (!group) {
                group = document.createElement('div');
                const isSm = input.classList.contains('form-control-sm');
                group.className = 'input-group ' + (isSm ? 'input-group-sm' : '');
                input.parentNode.insertBefore(group, input);
                group.appendChild(input);
            }

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-outline-secondary btn-security-toggle';
            btn.title = 'Show/Hide';
            btn.setAttribute('aria-label', 'Toggle security visibility');
            btn.innerHTML = '<i class="fas fa-eye"></i>';

            btn.addEventListener('click', function(e) {
                e.preventDefault();
                window.togglePasswordVisibility(input, btn.querySelector('i'));
            });

            if (input.nextSibling) {
                group.insertBefore(btn, input.nextSibling);
            } else {
                group.appendChild(btn);
            }
        });
    };

    // Auto-enforce Access Control & Sidebar Scroll Persistence on DOM Content Loaded
    document.addEventListener('DOMContentLoaded', () => {
        try { applyGlobalTheme(); } catch(e) {}
        if (window.GUG_DB) {
            window.GUG_DB.enforceAccessControl();
            window.GUG_DB.initSidebarScrollManager();
            window.GUG_DB.initAdminMobileExperience();
        }
        try { window.initSecurityInputToggles(); } catch(e) {}
    });

    document.addEventListener('shown.bs.modal', () => {
        try { window.initSecurityInputToggles(); } catch(e) {}
    });

    // Attach to global window
    // Universal Media Detection & Dynamic Rendering Utilities
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

    window.GUG_DB = new GugErpCore();
    window.GUG_ROLES = ROLES;
    window.GUG_ROLE_PERMISSIONS = ROLE_PERMISSIONS;
    window.GUG_ERP_MODULES = ERP_MODULES;

    window.printModuleSlip = function(title) {
        if (window.GUG_DB && typeof window.GUG_DB.printModuleSlip === 'function') {
            return window.GUG_DB.printModuleSlip(title);
        }
        window.print();
    };

    window.exportEmployeesToExcel = function(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (window.GUG_DB && typeof window.GUG_DB.exportEmployeesToExcel === 'function') {
            return window.GUG_DB.exportEmployeesToExcel();
        }
    };

    window.printEmployeeSlip = function(id) {
        if (window.GUG_DB && typeof window.GUG_DB.printEmployeeSlip === 'function') {
            return window.GUG_DB.printEmployeeSlip(id);
        }
    };

    window.printCustomerSlip = function(id) {
        if (window.GUG_DB && typeof window.GUG_DB.printCustomerSlip === 'function') {
            return window.GUG_DB.printCustomerSlip(id);
        }
    };

    window.printDealerSlip = function(id) {
        if (window.GUG_DB && typeof window.GUG_DB.printDealerSlip === 'function') {
            return window.GUG_DB.printDealerSlip(id);
        }
    };

    window.printBatchCustomerSlips = function() {
        if (window.GUG_DB && typeof window.GUG_DB.printBatchCustomerSlips === 'function') {
            return window.GUG_DB.printBatchCustomerSlips();
        }
    };

    window.printBatchEmployeeSlips = function() {
        if (window.GUG_DB && typeof window.GUG_DB.printBatchEmployeeSlips === 'function') {
            return window.GUG_DB.printBatchEmployeeSlips();
        }
    };

    window.printBatchDealerSlips = function() {
        if (window.GUG_DB && typeof window.GUG_DB.printBatchDealerSlips === 'function') {
            return window.GUG_DB.printBatchDealerSlips();
        }
    };

})(window);
