# 🏕️ 7th Whitburn Scouts Inventory

A web-based inventory management system for the 7th Whitburn Scout troop store, built with [Fresh](https://fresh.deno.dev/) on [Deno](https://deno.land/). Track equipment, food, and supplies across structured physical storage locations, with role-based access control for wardens and leaders.

**Live:** https://7thwhitburnscoutsinventory.co.uk

---

## Features

### 📦 Inventory Management
Four item categories, each with their own tracked fields:

| Category | Extra Fields |
|---|---|
| ⛺ **Tents** | Type, capacity, size, condition, brand, year purchased |
| 🍳 **Cooking Equipment** | Equipment type (incl. box/kit with contents list), material, fuel type, capacity, condition |
| 🥫 **Food** | Food type, expiry date, storage requirements, allergens, weight, servings |
| 🪓 **Camping Tools** | Tool type, condition, material, brand, year purchased |
| 🎮 **Games** | Game type, condition, player count, year purchased |

### 🧣 Necker Tracking
A dedicated counter on the dashboard tracks the number of neckers (scout neckerchiefs) in stock. The count updates instantly across tabs via a shared signal. An alert banner appears when stock falls at or below the threshold (default: 10, configurable via `NECKER_MIN_THRESHOLD`).

### 🔍 Search & Filtering
- Full-text search across name, location, and notes
- Filter by category
- Toggle low-stock-only view
- Toggle needs-repair-only view
- Clickable table rows for quick item access

### ⚠️ Alerts
- **Low stock** — items at or below their minimum threshold
- **Neckers low** — necker count at or below configurable threshold
- **Needs repair** — items with `condition: needs-repair`
- **Food expiry** — four tiers: expired, expiring soon (≤7 days), expiring warning (≤30 days), fresh

### 📍 Structured Storage Locations
Items are assigned to a specific physical location via a two-step cascading dropdown:

- **Plastic Shelves** 1–3, Levels 1–4 (plus top surface on shelves 2 & 3)
- **Wooden Shelves** 1–3
- **Metal Shelves** 1–4, Slots 1–4
- **Filing Cabinet** — Drawers 1–4
- **Boxes** — Blue, Red, Green, Yellow, Kestrels, Eagles
- **Other** — Axe/Saw Hanging Space, On Top of Red/Green Box, Cubby Hole, N/A

### 🔐 Authentication & Roles
All routes are protected. Three roles:

| Role | Permissions |
|---|---|
| **Admin** | Full access — manage items, manage users, export/import data, admin panel |
| **Editor** | Add, edit, and delete items |
| **Viewer** | Read-only access to inventory and reports |

Sessions expire after 15 minutes of inactivity. Passwords are hashed with bcrypt (12 rounds). Legacy SHA-256 hashes are automatically migrated on next login. CSRF tokens are validated on all mutating requests.

### 🛠️ Admin Panel
- Create, edit, and delete user accounts with inline password change
- Assign roles (viewer / editor / admin)
- JSON export of full inventory
- Bulk JSON import with per-item success/failure reporting
- Rebuild KV secondary indexes
- Trigger email notifications manually (low stock, expiry, or both)
- View activity log

### 📋 Reports
- **Expiring Food** — items grouped by expiry tier with days-remaining display

### 🔔 Email Notifications
Sent via the [Resend](https://resend.com/) API. Checks run automatically at 08:30 UTC on Wednesday + Friday (on Deno Deploy, only when `ENABLE_NOTIFY_CRON=true`) and can also be triggered manually from the admin panel:

- **Low stock alert** — inventory items at or below threshold + neckers if low
- **Food expiry alert** — food items expired or expiring within 30 days

Required environment variables:

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | API key from resend.com |
| `NOTIFY_EMAIL` | Recipient address for all alert emails |
| `NOTIFY_FROM_EMAIL` | *(optional)* Sender address — defaults to `noreply@7thwhitburnscoutsinventory.co.uk` |
| `NECKER_MIN_THRESHOLD` | *(optional)* Necker low-stock threshold — defaults to `10` |
| `ENABLE_NOTIFY_CRON` | Set to `true` only in the one deployment that should run scheduled notifications |

If `RESEND_API_KEY` or `NOTIFY_EMAIL` are unset the notification functions are safe no-ops (they log to console), so local dev works without any email configuration.

### 📜 Activity Log
All significant actions are logged to KV with a 90-day TTL and viewable at `/admin/activity`. Logged events include: user login, item created/updated/deleted, bulk import, user management, and password changes.

---

## Tech Stack

| | |
|---|---|
| **Framework** | [Fresh 1.7](https://fresh.deno.dev/) — file-based routing, islands architecture |
| **Runtime** | [Deno](https://deno.land/) — TypeScript-native, secure by default |
| **Database** | [Deno KV](https://deno.com/kv) — built-in key-value store, no setup required |
| **Styling** | Tailwind CSS 3 |
| **UI** | Preact with signals — islands for all interactive components |
| **Auth** | Custom session-based auth with bcrypt password hashing |
| **Email** | [Resend](https://resend.com/) REST API |
| **Deployment** | [Deno Deploy](https://deno.com/deploy) |

---

## Getting Started

### Prerequisites
- [Deno](https://deno.land/) v2.6+

### Setup

```bash
# Start the development server (hot reload enabled)
deno task start
```

The app will be available at `http://localhost:8000`.

A default admin account is created automatically on first start if no users exist. Check the console output for the generated credentials.

```bash
# Optionally seed the database with sample data
deno task seed
```

### Available Commands

```bash
deno task start      # Start dev server with hot reload
deno task seed       # Populate database with sample items
deno task build      # Build for production
deno task preview    # Preview production build
deno task check      # Type check, lint, and format check
```

---

## Project Structure

```
scout-inventory/
├── components/              # Server-rendered UI components
│   ├── Layout.tsx           # Page shell with nav, theme toggle
│   ├── StatCard.tsx         # Dashboard stat cards
│   ├── ExpiryBadge.tsx      # Food expiry status badge
│   └── CategoryIcon.tsx     # Category emoji icons
├── db/
│   ├── kv.ts                # All Deno KV operations (with in-memory cache)
│   └── seed.ts              # Sample data seeder
├── islands/                 # Client-side interactive Preact components
│   ├── InventoryTable.tsx   # Searchable, filterable, sortable inventory list
│   ├── ItemForm.tsx         # Add/edit item form with cascading location picker
│   ├── CampChecklist.tsx    # Camp packing/return checklist
│   ├── CampPlanForm.tsx     # Create/edit camp plan form
│   ├── CampPlanList.tsx     # Camp plans grid with progress bars
│   ├── TemplateBuilder.tsx  # Equipment template creator
│   ├── MealForm.tsx         # Create/edit meal recipe
│   ├── MealPlannerForm.tsx  # Interactive camp meal planner + shopping list
│   ├── LoanForm.tsx         # Record a new equipment loan
│   ├── MobileNav.tsx        # Mobile navigation drawer
│   ├── ThemeToggle.tsx      # Dark/light mode toggle
│   ├── PasswordInput.tsx    # Password field with show/hide toggle
│   ├── ConfirmDeleteForm.tsx # Inline confirm-before-delete for user management
│   ├── NeckerCounter.tsx    # Live necker stock counter with +/− controls
│   ├── NeckerAlert.tsx      # Homepage alert when neckers are low
│   ├── SpaceDashboard.tsx   # Storage space breakdown visualisation
│   ├── NotificationButtons.tsx # Admin panel — trigger notification emails
│   ├── BulkImport.tsx       # Admin panel — JSON bulk import form
│   └── RebuildIndexes.tsx   # Admin panel — rebuild KV secondary indexes
├── lib/
│   ├── auth.ts              # Session management, bcrypt hashing, user CRUD
│   ├── activityLog.ts       # KV-based activity log (90-day TTL)
│   ├── notifications.ts     # Resend API email notifications
│   ├── neckerSignal.ts      # Shared Preact signal for necker count
│   ├── date-utils.ts        # Date formatting and expiry calculations
│   └── validation.ts        # Input validation helpers
├── routes/
│   ├── _app.tsx             # HTML shell (lang, meta, theme script)
│   ├── _middleware.ts       # Auth guard, security headers, static asset cache
│   ├── index.tsx            # Dashboard
│   ├── login.tsx            # Login page
│   ├── inventory/
│   │   ├── index.tsx        # Inventory list
│   │   ├── add.tsx          # Add item
│   │   ├── [id].tsx         # Item detail view
│   │   └── edit/[id].tsx    # Edit item
│   ├── camps/
│   │   ├── index.tsx        # Camp plans list
│   │   ├── new.tsx          # New camp plan
│   │   ├── templates.tsx    # Equipment templates
│   │   ├── [id].tsx         # Camp detail / checklist
│   │   └── [id]/
│   │       ├── edit.tsx     # Edit camp plan
│   │       └── print.tsx    # Print-friendly packing list
│   ├── meals/
│   │   ├── index.tsx        # Meal planner + recipe list
│   │   ├── new.tsx          # New meal
│   │   └── [id]/
│   │       └── edit.tsx     # Edit meal
│   ├── reports/
│   │   └── expiring.tsx     # Expiring food report
│   ├── admin/
│   │   ├── admin-panel.tsx  # Admin overview
│   │   ├── activity.tsx     # Activity log viewer
│   │   ├── export.ts        # JSON export
│   │   ├── import.ts        # JSON bulk import
│   │   ├── notify.ts        # Manually trigger notification emails
│   │   └── rebuild-indexes.ts # Rebuild KV secondary indexes
│   ├── account/
│   │   └── settings.tsx     # Change own password
│   └── api/
│       ├── items/
│       │   ├── index.ts     # GET all / POST new item
│       │   └── [id].ts      # GET / PUT / DELETE item by ID
│       ├── camps/
│       │   ├── index.ts     # GET all / POST new camp plan
│       │   └── [id].ts      # GET / PATCH / DELETE camp plan
│       ├── meals/
│       │   ├── index.ts     # GET all / POST new meal
│       │   └── [id].ts      # GET / PUT / DELETE meal
│       ├── neckers.ts       # GET / POST necker count
│       ├── stats.ts         # Dashboard statistics
│       ├── logout.ts        # Session logout
│       └── ping.ts          # Health check (used by warmup cron)
├── types/
│   ├── inventory.ts         # Item, camp plan, template types + location enums
│   └── meals.ts             # Meal and ingredient types
└── static/
    ├── styles.css           # Global styles
    └── inventory-import-template.json  # Template for bulk import
```

---

## Deployment

The app is deployed to Deno Deploy via GitHub. Push to `main` to trigger a deploy.

One notification `Deno.cron` job runs at 08:30 UTC on Wednesday + Friday (only when `ENABLE_NOTIFY_CRON=true`):
- Low stock check — emails if any inventory items or neckers are below threshold
- Food expiry check — emails if any food items are expired or expiring within 30 days
- Overdue loans check — emails if any loans are overdue

A third cron runs every 5 minutes to self-ping the app and keep the isolate warm, reducing cold-start latency. Set `APP_URL` in the Deno Deploy dashboard to the production URL.

---

## Security

- No SQL — uses Deno KV (key-value), immune to SQL injection
- Passwords hashed with bcrypt (12 rounds); legacy SHA-256 hashes are auto-migrated on next login
- CSRF tokens validated on all state-mutating requests (`POST`, `PUT`, `DELETE`)
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Strict`
- Security headers on all responses: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`
- All client-side interactivity is in Preact islands; the only inline script is a minimal theme-detection snippet that runs before first paint to avoid flash of unstyled content
- All routes except `/login`, `/styles.css`, and `/api/ping` require an authenticated session

---

## 💡 Ideas

### 📋 Stocktake Wizard
A guided flow for running a periodic stock-take — walking through every item in turn, confirming quantities and conditions, and applying all changes in one atomic batch.

### 📊 Expanded Reports
- **Loans report** — items currently on loan, overdue returns, loan history per item
- **Condition report** — all items needing repair grouped by category
- **Space utilisation** — how full each physical storage location is

### 📅 Calendar View
A timeline view showing upcoming camps from camp plans, food expiry deadlines, and loan return dates on a single calendar.

---
