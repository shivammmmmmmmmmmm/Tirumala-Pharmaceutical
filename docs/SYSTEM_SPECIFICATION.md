# Medical Product Distribution System — SRS / PRD / Technical Architecture

**Version:** 1.1.0  
**Audience:** Pharmaceutical distributors, medical shops, sales teams, administrators  
**Stack:** Next.js 15 (frontend) · Express + TypeScript (backend) · MySQL / SQLite

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Roles & Access](#2-roles--access)
3. [Feature Catalog (Implemented Status)](#3-feature-catalog)
4. [Admin Features](#4-admin-features)
5. [Sales Person Features](#5-sales-person-features)
6. [User (Retailer) Features](#6-user-retailer-features)
7. [Search System (Deep Dive)](#7-search-system-deep-dive)
8. [Credit System](#8-credit-system)
9. [Ledger System](#9-ledger-system)
10. [Commission System](#10-commission-system)
11. [Payment System](#11-payment-system)
12. [Reporting System](#12-reporting-system)
13. [Security](#13-security)
14. [Future / Roadmap Features](#14-future--roadmap-features)
15. [Software Architecture](#15-software-architecture)
16. [Database Design](#16-database-design)
17. [API Structure](#17-api-structure)
18. [Frontend Structure](#18-frontend-structure)
19. [Deployment & Scalability](#19-deployment--scalability)

---

## 1. Executive Summary

This platform digitizes **B2B pharmaceutical distribution**: catalog browsing, credit-based ordering, sales-force coverage, commission tracking, and admin control. A medical shop owner can search by **ingredient** when they do not know the brand name. Admins approve new retailers, manage stock, dispatch orders, and view financial reports.

**Real-time behavior:** Order lists, dashboards, ledgers, approvals, and admin orders refresh via **polling** (10–20s intervals). Search uses **debounced AJAX** (300–400ms) against the REST API.

---

## 2. Roles & Access

| Role | Code | Primary users |
|------|------|----------------|
| Admin (Owner) | `ADMIN` | Company owner, operations head |
| Sales Person | `SALES_PERSON` | Field reps, territory managers |
| User (Retailer) | `USER` | Pharmacies, clinics, hospitals, distributors |

**RBAC:** JWT bearer token + `roleMiddleware` on routes. Row-level scoping (SP sees assigned customers only; USER sees own orders/ledger).

---

## 3. Feature Catalog

| Feature | Status | Notes |
|---------|--------|-------|
| Product CRUD | ✅ | Admin `/admin/products` |
| Categories | ✅ | String field + filter; distinct list API |
| Ingredients on products | ✅ | Column + ingredient search mode |
| Inventory / stock | ✅ | `quantity`, decrement on order, restore on cancel |
| Advanced search | ✅ | Name, ingredient, company, strength, ranking |
| User registration | ✅ | Self-register → **pending approval** for retailers |
| SP / customer creation | ✅ | Admin + SP flows |
| Customer approval | ✅ | `/admin/approvals` |
| Credit limits | ✅ | Default ₹50,000; admin can change |
| Ledger | ✅ | DEBIT/CREDIT on credit orders & payments |
| Orders & workflow | ✅ | PENDING → APPROVED → DISPATCHED → DELIVERED → COMPLETED |
| Cart / checkout | ✅ | Client-side cart; single API place order |
| Payments | ✅ | CREDIT, UPI, BANK_TRANSFER, CASH + partial payments |
| Commissions | ✅ | Auto % on SP orders; admin payout |
| Areas / territory | ✅ | `areas` table + `users.territory` |
| Reports | ✅ | Sales, area-wise, products, CSV export |
| Invoices | ✅ | JSON invoice + browser print/PDF |
| Audit logs | ✅ | Table + admin UI; hooks on approve/area |
| File uploads | ✅ | Base64 → `/uploads` (Aadhaar, photo) |
| Role-based pricing at checkout | ✅ | `product_pricing` tiers applied via `resolveUnitPrice` |
| Server-side cart | ✅ | `cart_items` + `/api/cart` + `/user/checkout` |
| Category CRUD | ✅ | `/admin/categories` |
| Accounting dashboard | ✅ | `/admin/accounting` |
| Inventory / stock alerts | ✅ | `/admin/inventory` + expiry count |
| GST billing (12%) | ✅ | On orders + invoices |
| Delivery tracking | ✅ | SP `/sp/delivery` + tracking code |
| SP performance | ✅ | `/sp/performance` |
| Document uploads | ✅ | Register license, SP Aadhaar/photo, API |
| Bank details (SP) | ✅ | On SP create form |
| User payments page | ✅ | `/user/payments` |
| WebSockets | 🔜 | Polling used instead |
| AI / ML recommendations | 🔜 | Roadmap |
| True PDF/Excel export | 🔜 | CSV + print; pdfkit roadmap |
| Multi-admin | 🔜 | Roadmap |

---

## 4. Admin Features

### 4.1 Admin Login

- **Purpose:** Secure access to all management functions.
- **Why:** Protect pricing, credit limits, and customer data.
- **Role:** ADMIN
- **Data:** `users` (email, password_hash, role, is_active, is_blocked)
- **Workflow:** POST `/api/auth/login` → JWT (24h) → `/admin/dashboard`
- **Validation:** Email required; bcrypt verify; blocked/inactive rejected
- **Security:** JWT secret, HTTPS in production
- **Tables:** `users`
- **UX:** Login at `/login` or home page

### 4.2 Dashboard

- **Purpose:** KPI snapshot (users, orders, revenue, low stock, pending commissions).
- **API:** `GET /api/dashboard`
- **Tables:** `users`, `products`, `orders`, `commissions`

### 4.3 Product CRUD

- **Purpose:** Maintain medicine catalog (name, SKU, prices, stock, ingredients).
- **Workflow:** List → Create/Edit → Soft-delete (`is_active=0`)
- **API:** `GET/POST/PUT/DELETE /api/products`
- **Tables:** `products`

### 4.4 Order Management (Approval, Dispatch, Completion)

- **Statuses:** PENDING → APPROVED → DISPATCHED → DELIVERED → COMPLETED (or CANCELLED)
- **API:** `PATCH /api/orders/:id/status`
- **Business logic:** Cancel restores stock and credit on CREDIT orders
- **Real-time:** Admin orders page polls every 12s

### 4.5 Credit Limit & User Blocking

- **API:** `PATCH /api/users/:id/credit`, `PUT /api/users/:id` (`isBlocked`)
- **Logic:** Order blocked if `credit_used + order_total > credit_limit` or `is_blocked`

### 4.6 Ledger Management

- View customer ledger from `/admin/users` modal
- **API:** `GET /api/users/:id/ledger`

### 4.7 Customer Approvals (NEW)

- Self-registered USER accounts: `approval_status=PENDING`, `is_active=0`
- **API:** `PATCH /api/users/:id/approve` `{ approved: true, creditLimit? }`
- **UI:** `/admin/approvals` (10s polling)

### 4.8 Reports & Audit

- **Reports:** `/admin/reports` — sales summary, area-wise, top products, CSV export
- **Audit:** `/admin/audit-logs` — `audit_logs` table

---

## 5. Sales Person Features

| Feature | Route | API |
|---------|-------|-----|
| Dashboard | `/sp/dashboard` | `/api/dashboard` |
| Customer registration | `/sp/customers/new` | `POST /api/users` (role USER, auto `assigned_sp_id`) |
| Place order for customer | `/sp/place-order` | `POST /api/orders` + `targetUserId` |
| Order tracking / delivery | `/sp/orders` | Status updates for own `sp_id` orders |
| Payment collection | `/sp/orders` | `POST /api/orders/:id/payment` |
| Commissions | `/sp/commissions` | `GET /api/commissions` |

**SP registration:** Created by Admin only (not public self-register). Document upload API available for Aadhaar/photo when UI is wired on SP profile forms.

---

## 6. User (Retailer) Features

| Feature | Route |
|---------|-------|
| Registration | `/register` (pending approval for pharmacy/clinic/etc.) |
| Dashboard + credit monitor | `/user/dashboard` (15s poll) |
| Ingredient-aware search + cart | `/user/products` |
| Orders + invoice | `/user/orders` |
| Ledger | `/user/ledger` (20s poll) |

---

## 7. Search System (Deep Dive)

### 7.1 Capabilities

| Mode | Query param | Min length | Fields searched |
|------|-------------|------------|-----------------|
| General | `search` | 2 | name, sku, category, description, manufacturer, company, **ingredients**, strength, dosage_form |
| Ingredient only | `ingredient` | 2 | `ingredients` LIKE |
| Company | `company` | 1 | company_name, manufacturer |
| Strength | `strength` | 1 | strength |
| Category filter | `category` | — | exact match |

### 7.2 Ranking (relevance)

When using `search`, results sort by:

1. Name match  
2. Ingredient match  
3. SKU match  
4. Company match  
5. Category match  
6. Then alphabetical name  

### 7.3 Live / AJAX / Debounce

- **Frontend:** 300ms `setTimeout` debounce (user products); 400ms `useDebounce` (admin products)
- **Backend:** Stateless REST — each keystroke (after debounce) → `GET /api/products?...`
- **No WebSocket** — suitable for hundreds of concurrent users; upgrade to SSE/WS at scale

### 7.4 Ingredient search example (real world)

> Shop owner knows the patient needs **Paracetamol** but not whether to order Crocin, Dolo, or Calpol.

1. Open **Browse Products** → select **Ingredient** tab  
2. Type `Paracetamol`  
3. API: `GET /api/products?ingredient=Paracetamol`  
4. All products with `ingredients` containing Paracetamol are listed with stock and price  

### 7.5 Performance

- Indexes on `name`, `ingredients`, `category` (SQLite/MySQL)
- Pagination: `page`, `pageSize` (max 100)
- **Future ML search:** Embedding index over `name + ingredients + description` (roadmap)

---

## 8. Credit System

| Concept | Implementation |
|---------|----------------|
| Credit limit | `users.credit_limit` |
| Used credit | `users.credit_used` |
| Available | `credit_limit - credit_used` |
| On CREDIT order | Increase `credit_used`; ledger DEBIT |
| On payment | Decrease `credit_used`; ledger CREDIT |
| Blocking | `is_blocked=1` OR over limit → order rejected |
| Restoration | Full/partial payment reduces `credit_used` |

---

## 9. Ledger System

| Type | Meaning |
|------|---------|
| DEBIT | Customer owes more (credit order) |
| CREDIT | Payment received / order cancelled |

**Table:** `ledger` — `amount`, `balance_after`, `reference_id` (order), `description`  
**UX:** `/user/ledger` with 20s auto-refresh

---

## 10. Commission System

- On order with assigned SP having `commission_pct > 0` → row in `commissions`
- **Formula:** `commission_amount = order_total * commission_pct / 100`
- **Statuses:** PENDING → PAID (admin `PATCH /api/commissions/:id/pay`)
- **Future:** Product-based, fixed, area-based, monthly incentives

---

## 11. Payment System

| Method | Code | Collection |
|--------|------|------------|
| Credit account | CREDIT | Ledger + credit_used |
| UPI | UPI | Recorded on order; verification manual |
| Bank transfer | BANK_TRANSFER | Admin/SP records payment |
| Cash | CASH | SP collection via `recordPayment` |

**Statuses:** PENDING → PARTIAL → PAID (`paid_amount` vs `total_amount`)

---

## 12. Reporting System

| Report | Endpoint |
|--------|----------|
| Sales summary | `GET /api/reports/sales` |
| Area-wise | `GET /api/reports/area-wise` |
| Top products | `GET /api/reports/products` |
| Pending payments | `GET /api/reports/pending-payments` |
| Commission summary | `GET /api/reports/commissions` |
| CSV export | `GET /api/reports/export?type=sales|users|products` |

**PDF:** Invoice print from browser; full PDF engine (e.g. pdfkit) is roadmap.

---

## 13. Security

| Control | Implementation |
|---------|----------------|
| Authentication | JWT (24h), Bearer header |
| Password hashing | bcrypt (10 rounds) |
| RBAC | `roleMiddleware('ADMIN', ...)` |
| SQL injection | Parameterized queries only |
| File upload | 5MB max; allowed extensions; stored outside web root with static route |
| Audit | `audit_logs` for sensitive actions |
| Session | Stateless JWT (no server session store) |

---

## 14. Future / Roadmap Features

- Expiry dates per batch; FEFO picking  
- Low-stock email/SMS alerts from `reorder_level`  
- GST line items on invoices  
- GPS delivery tracking  
- Multi-admin with fine-grained permissions  
- AI product recommendations & demand forecasting  
- Automated PO to manufacturers  

---

## 15. Software Architecture

```
┌─────────────┐     HTTPS/JSON      ┌──────────────────┐
│  Next.js    │ ◄──────────────────►│  Express API     │
│  (port 3000)│     JWT Bearer      │  (port 3001)     │
└─────────────┘                     └────────┬─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │ MySQL or SQLite  │
                                    └──────────────────┘
```

---

## 16. Database Design

**Core tables:** `users`, `products`, `orders`, `order_items`, `ledger`, `commissions`, `product_pricing`  
**Extended:** `audit_logs`, `areas`, `user_documents`

See `backend/database/schema.sql` and `backend/src/db/sqlite.ts`.

---

## 17. API Structure

| Prefix | Module |
|--------|--------|
| `/api/auth` | register, login, me |
| `/api/products` | catalog + search |
| `/api/orders` | orders, status, payment |
| `/api/users` | users, ledger, credit, approve |
| `/api/commissions` | list, pay |
| `/api/dashboard` | role dashboards |
| `/api/reports` | analytics + CSV |
| `/api/invoices` | invoice payload |
| `/api/audit` | audit log list |
| `/api/areas` | territory CRUD |
| `/api/uploads` | document upload |

---

## 18. Frontend Structure

```
frontend/app/
  admin/     dashboard, products, orders, users, approvals, reports, areas, audit-logs, ...
  user/      dashboard, products, orders, ledger
  sp/        dashboard, orders, customers, place-order, commissions
  login/ register/
frontend/lib/   api.ts, auth-client.ts, use-auth.ts, nav-links.ts
```

---

## 19. Deployment & Scalability

- **Dev:** XAMPP MySQL or `DB_DRIVER=sqlite`  
- **Prod:** Node backend + MySQL; Next.js on Vercel/static; env `JWT_SECRET`, `NEXT_PUBLIC_API_URL`  
- **Scale:** Read replicas, Redis cache for product search, CDN for images, horizontal API instances behind load balancer  

**Growth strategy:** Onboard territories per SP → credit-led adoption for pharmacies → analytics upsell → GST/compliance module.

---

*This document is the canonical reference for features, business logic, and architecture. Implementation details live in source under `backend/src` and `frontend/app`.*
