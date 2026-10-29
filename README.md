# Gear Up Gadgets - Enterprise ERP & E-Commerce Ecosystem

Welcome to the **Gear Up Gadgets** codebase. This project is a fully integrated, high-performance E-Commerce storefront and Enterprise Resource Planning (ERP) suite engineered with zero server-side latency via a client-side reactive database architecture (`GUG_DB`).

---

## 🏛️ Architecture Overview

The ecosystem is divided into four strictly isolated portals:

1. **🛍️ Customer Storefront (`index.html`, `shop.html`, etc.)**: Public browsing, dynamic category filtering, product detail views, real-time shopping cart, multi-step checkout, PC builder configurator, order tracking, and repair booking.
2. **🛡️ Super Admin ERP Panel (`dashboard.html`, `products.html`, etc.)**: Executive suite featuring 14 comprehensive operational modules: Dashboard, Products/Catalog, Banners & Themes, CRM & Inquiries, Coupons/Marketing, Inventory Management, Purchasing/Suppliers, Returns/RMA, Logistics/Couriers, Sales Orders Pipeline, B2B Dealers & Ledgers, Financial Accounting (P&L, Balance Sheet), Business Analytics & Reports, Staff RBAC Management, Task Board, Audit Security Logs, and Global Settings.
3. **👔 Management Staff Portal (`staff-login.html`, `employee-portal.html`)**: Dedicated employee workspace enforcing granular Role-Based Access Control (RBAC) permissions (Catalog Manager, Orders Fulfillment, Customer Support, Inventory Specialist, and Finance Officer).
4. **🤝 B2B Dealer Portal (`dealer-login.html`, `dealer-portal.html`)**: Wholesale partner self-service portal for real-time ledger statements, stock dispatches tracking, available credit checks, and printable official financial balance statements with company letterhead.

---

## 📁 Project Directory & File Manifest

```text
Gear Up Gadgets/
├── assets/
│   ├── css/
│   │   ├── bootstrap.min.css        # Base grid and component styles
│   │   ├── custom.css               # Global theme variables, dark mode styling, and high-contrast rules
│   │   ├── styles.css               # Main compiled storefront layout stylesheet
│   │   └── swiper-bundle.min.css    # Carousel and slider styles
│   ├── fonts/
│   │   ├── font-icons.css           # Icon bundle import
│   │   └── fonts.css                # Typography and web font definitions
│   ├── icon/
│   │   └── icomoon/                 # Custom UI vector icons and font glyphs
│   ├── images/
│   │   ├── blog/                    # Promotional & news imagery
│   │   ├── item/                    # Category badges & accessory thumbnails
│   │   ├── logo/                    # Official company logos
│   │   ├── partner/                 # Brand partner logos
│   │   ├── products/                # High-resolution hardware catalog photos
│   │   ├── section/                 # Promotional banners and showcase images
│   │   ├── slider/                  # Homepage hero slider graphics
│   │   ├── team/                    # Staff and support team headshots
│   │   └── video/                   # Video background assets
│   ├── js/
│   │   ├── admin.js                 # Admin sidebar active routing and accordion controls
│   │   ├── cart.js                  # Customer shopping cart reactive engine
│   │   ├── checkout.js              # Order checkout workflow & validation
│   │   ├── common.js                # Global header/footer injector, search drawer, & navigation
│   │   ├── gug-erp-core.js          # Core ERP single source of truth (GUG_DB engine, RBAC, ledger, sync)
│   │   ├── home.js                  # Homepage hardware showcase card renderer helper
│   │   ├── jquery.min.js            # Base helper utility library
│   │   ├── pc-builder.js            # Custom PC hardware compatibility builder
│   │   ├── product.js               # Product detail gallery, sale badges, & related item renderer
│   │   ├── products-data.js         # Master initial catalog dataset (product specifications & prices)
│   │   └── swiper-bundle.min.js     # Touch slider & carousel engine
│   └── scss/                        # Source SCSS stylesheets (for sass compiler)
│
├── Customer Storefront Pages:
│   ├── index.html                   # Homepage (Hero banners, categories, featured products)
│   ├── shop.html                    # E-commerce catalog with search, category filtering & pagination
│   ├── product.html                 # Single product details view
│   ├── cart.html                    # Interactive shopping cart
│   ├── checkout.html                # Multi-step checkout with instant order generation
│   ├── sales.html                   # Promotional discount campaign & clearance showcase
│   ├── repair.html                  # Public repair & diagnostics request form
│   ├── track.html                   # Public order & repair ticket status tracker
│   ├── pc-builder.html              # Custom PC configuration tool
│   ├── about.html                   # Company background & story
│   ├── contact.html                 # Contact info & inquiry submission form
│   ├── privacy.html                 # Privacy policy
│   └── terms.html                   # Terms & conditions
│
├── Master Admin ERP Suite:
│   ├── admin.html                   # Super Admin Authentication Gateway
│   ├── dashboard.html               # Executive Real-Time Dashboard (Financial & Sales KPIs)
│   ├── products.html                # Products & Catalog (Important items, percentage discount modal)
│   ├── admin-sales.html             # Homepage Banner Manager, Sales Campaigns, & Theme Color Customizer
│   ├── admin-crm.html               # Customer CRM, Inquiries Stream, & Loyalty Points
│   ├── admin-marketing.html         # Coupons, Promo Codes, & Discount Campaigns
│   ├── admin-inventory.html         # Multi-warehouse stock tracking, bin locations, & low-stock alerts
│   ├── admin-purchasing.html        # Supplier Management & Purchase Orders (PO)
│   ├── admin-returns.html           # RMA, Warranty Claims, & Repair Diagnostics Pipeline
│   ├── admin-logistics.html         # Courier Integrations, Consignment Slips, & Dispatch
│   ├── orders.html                  # Sales Orders Pipeline, Invoices, & POS Counter
│   ├── admin-dealers.html           # B2B Wholesale Dealers, Dispatches, & Double-Entry Ledger
│   ├── admin-finance.html           # Accounting, Expense Tracking, P&L Statements, & Balance Sheets
│   ├── admin-reports.html           # Executive Business Intelligence, Analytics, & CSV Data Exports
│   ├── admin-staff.html             # Employee Roster & Granular RBAC Permissions
│   ├── admin-tasks.html             # Internal Staff Kanban / Task Board
│   ├── admin-audit.html             # Comprehensive Security & Action Audit Trail
│   └── admin-settings.html          # Global ERP Configuration, Currency, & Backup/Restore
│
├── Staff & Dealer Portals:
---

## ⚙️ Core Data Layer & Synchronization (`GUG_DB`)

The central data engine resides in `assets/js/gug-erp-core.js`. It exposes the global `GUG_DB` singleton object which acts as the **Single Source of Truth** across the entire application:

- **Product Catalog (`gug_erp_products`)**: Manages products, categories, stock, regular pricing, sale percentage discounts (`saleDiscountPercent`), and homepage featured toggles (`isFeatured`).
- **Wholesale Dealers & Ledgers (`gug_erp_dealers`, `gug_erp_dealer_ledger`)**: Tracks wholesale partners, credit limits, stock dispatches with itemized lines, cash deposits, bank transfers, and real-time net balances.
- **Sales & Orders (`admin_orders`, `gug_erp_orders`)**: Synchronizes checkout orders with admin order pipelines, courier tracking, and inventory deductions.
- **Finance & P&L (`admin-finance.html`, `assets/js/admin-finance-ledger.js`)**: Builds date-filtered customer, dealer, supplier, payroll, advance and petty-cash ledgers from CRM orders, dealer receipts, supplier payment histories and salary records. Finance-only edits/exclusions are retained as ledger overrides; source module records are not deleted.
- **Global payment capture (`assets/js/payment-methods.js`)**: Uses Cash, Online Transfer, and Bank Transfer across CRM orders, dealer receipts, supplier payments, payroll, checkout, and COD reconciliation. Each recorded payment stores its method, timestamp, paid/balance amounts, digital reference/network details, and optional image receipt with the source record for Finance and printable slips. Receipt images are limited to 2 MB and stored in browser-local records; they are not uploaded to remote file storage.
- **Finance local records (`gug_finance_ledger_manual`, `gug_finance_ledger_overrides`, `gug_finance_petty_expenses`, `gug_finance_payroll_expenses`, `gug_finance_receipt_files`)**: Stores manual ledger entries, receipt metadata/files and daily expenses in browser storage, with same-tab refresh events and cross-tab storage refresh.
- **Audit Logs (`gug_erp_audit_logs`)**: Automatically logs critical actions (product edits, ledger postings, staff logins, price adjustments) with timestamps and user identities.

---

## 🎨 Design & Styling Guidelines

- **Typography & High Contrast**: All text on light or white backgrounds is styled with `#000000` or `#1e293b` to eliminate low-contrast visibility issues.
- **Primary Brand Color**: `--accent-red: #db2724` (or custom configured theme color via `admin-sales.html`).
- **Dark Mode Backgrounds**: Main panels use `#0d1117` and cards use `#161b22` / `#ffffff` with crisp borders (`#222` / `#e2e8f0`).
- **Modals & Dialogs**: Standardized on **Bootstrap 5.3.2** (`bootstrap.bundle.min.js`).

---

## 🛠️ How to Open & Test Directly in Browser

No local server (PHP, Apache, or Node) is required. You can simply double click or open any of the `.html` files directly in your web browser:
- **Customer Storefront**: `index.html` (or `shop.html`)
- **Super Admin ERP Panel**: `admin.html` (or `dashboard.html`)
- **Management Staff Portal**: `staff-login.html` (or `employee-portal.html`)
- **B2B Wholesale Dealer Portal**: `dealer-login.html` (or `dealer-portal.html`)

---

© 2026 Gear Up Gadgets. All rights reserved.