# 🏕️ Scout Inventory

A web-based inventory management system for a scout troop store, built with [Fresh](https://fresh.deno.dev/) on [Deno](https://deno.land/). Track equipment, food, and supplies across a structured set of physical storage locations, with role-based access control for wardens and leaders.

**Live:** https://scout-inventory.zackrenwick.deno.net

---

## Features

### 📦 Inventory Management
Four item categories, each with their own tracked fields:

| Category | Extra Fields |
|---|---|
| ⛺ **Tents** | Type, capacity, size, condition, brand, year purchased |
| 🍳 **Cooking Equipment** | Equipment type, material, fuel type, capacity, condition |
| 🥫 **Food** | Food type, expiry date, storage requirements, allergens, weight, servings |
| 🪓 **Camping Tools** | Tool type, condition, material, brand, year purchased |

### 🔍 Search & Filtering
- Full-text search across name, location, and notes
- Filter by category
- Toggle low-stock-only view
- Toggle needs-repair-only view
- Clickable table rows for quick item access

### ⚠️ Alerts
- **Low stock** — items at or below their minimum threshold
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
| **Admin** | Full access — manage items, manage users, export data |
| **Editor** | Add, edit, and delete items |
| **Viewer** | Read-only access to inventory and reports |

Sessions expire after 15 minutes of inactivity. Passwords are hashed with bcrypt (12 rounds). CSRF tokens are validated on all mutating API calls.

### 🛠️ Admin Panel
- Create, edit, and delete user accounts
- Assign roles
- CSV export of full inventory

### 📋 Reports
- **Expiring Food** — items grouped by expiry tier with days-remaining display

---

## Tech Stack

| | |
|---|---|
| **Framework** | [Fresh 1.7](https://fresh.deno.dev/) — file-based routing, islands architecture |
| **Runtime** | [Deno](https://deno.land/) — TypeScript-native, secure by default |
| **Database** | [Deno KV](https://deno.com/kv) — built-in key-value store, no setup required |
| **Styling** | Tailwind CSS 3 |
| **UI** | Preact with signals — islands for interactive components |
| **Auth** | Custom session-based auth with bcrypt password hashing |
| **Deployment** | [Deno Deploy](https://deno.com/deploy) |

---

## Getting Started

### Prerequisites
- [Deno](https://deno.land/) v1.37+

### Setup

```bash
# Start the development server (hot reload enabled)
deno task start
```

The app will be available at `http://localhost:8000`.

In development, authentication is bypassed when `DEV_BYPASS=true` is set in your `.env` file. You are automatically signed in as an admin.

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
├── islands/                 # Client-side interactive components
│   ├── InventoryTable.tsx   # Searchable, filterable inventory list
│   ├── ItemForm.tsx         # Add/edit item form with cascading location picker
│   ├── MobileNav.tsx        # Mobile navigation drawer
│   ├── ThemeToggle.tsx      # Dark/light mode toggle
│   └── PasswordInput.tsx    # Password field with show/hide toggle
├── lib/
│   ├── auth.ts              # Session management, bcrypt hashing, user CRUD
│   ├── date-utils.ts        # Date formatting and expiry calculations
│   └── validation.ts        # Input validation helpers
├── routes/
│   ├── _app.tsx             # HTML shell (lang, meta description)
│   ├── _middleware.ts       # Auth guard + cache headers for static assets
│   ├── index.tsx            # Dashboard
│   ├── login.tsx            # Login page
│   ├── inventory/
│   │   ├── index.tsx        # Inventory list
│   │   ├── add.tsx          # Add item
│   │   ├── [id].tsx         # Item detail view
│   │   └── edit/[id].tsx    # Edit item
│   ├── reports/
│   │   └── expiring.tsx     # Expiring food report
│   ├── admin/
│   │   ├── admin-panel.tsx  # Admin overview
│   │   ├── users.tsx        # User management
│   │   └── export.ts        # CSV export
│   ├── account/
│   │   └── settings.tsx     # Change password
│   └── api/
│       ├── items/
│       │   ├── index.ts     # GET all / POST new item
│       │   └── [id].ts      # GET / PUT / DELETE item by ID
│       ├── stats.ts         # Dashboard statistics
│       ├── logout.ts        # Session logout
│       └── ping.ts          # Health check (used by warmup cron)
├── types/
│   └── inventory.ts         # Item types, ItemLocation enum, ITEM_LOCATIONS
└── static/
    └── styles.css           # Global styles
```

---

## Deployment

The app is deployed to Deno Deploy via GitHub. Push to `main` to trigger a deploy.

A `Deno.cron` job runs every 5 minutes to self-ping the app and keep the isolate warm, reducing cold-start latency. The target URL is read from the `APP_URL` environment variable (set in the Deno Deploy dashboard).

---

## Security Notes

- No SQL — uses Deno KV (key-value), immune to SQL injection
- Passwords hashed with bcrypt (12 rounds); legacy SHA-256 hashes are auto-migrated on next login
- CSRF tokens validated on all state-mutating API calls (`POST`, `PUT`, `DELETE`)
- Session cookies are `HttpOnly` and `SameSite=Strict`
- All routes except `/login`, `/styles.css`, and `/api/ping` require an authenticated session

## 💡 Ideas

### 🏕️ Camp Planner
A planning tool that lets leaders build a camp schedule and automatically checks the inventory to confirm all required equipment is available. Could support:
- Creating a camp with a date range, expected headcount, and activity list
- Mapping activities to required inventory categories (e.g. hiking → camping tools, cooking session → stoves + pots)
- A readiness checklist showing which items are sufficiently stocked and flagging any shortfalls before the camp
- Generating a kit list PDF or printable checklist for leaders to pack from

### 🍽️ Meal Planner
A meal planning tool that works directly from the food inventory, helping leaders plan meals for camps without over- or under-ordering. Could support:
- Building a meal plan for a given number of days and people
- Pulling current food stock quantities and expiry dates to suggest items to use first
- Estimating servings remaining from inventory quantities and flagging items running low
- Marking items as "allocated" to a meal plan so stock figures stay accurate
