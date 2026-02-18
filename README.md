# 🏕️ Scout Camp Loft Inventory System

A comprehensive inventory management system for scout camp lofts, built with Fresh (Deno's next-generation web framework). Track tents, cooking equipment, and food items with expiry date monitoring.

## Features

### 📦 Inventory Management
- **Three Main Categories:**
  - ⛺ **Tents** - Track capacity, type, condition, and purchase details
  - 🍳 **Cooking Equipment** - Manage stoves, pots, coolers, and utensils
  - 🥫 **Food Items** - Monitor expiry dates, storage requirements, and allergens

### 🎯 Key Functionality
- ✅ Add, edit, view, and delete inventory items
- 🔍 Search and filter by category, name, location
- ⚠️ Low stock alerts (configurable minimum thresholds)
- ⏰ Food expiry tracking with multi-tier warnings
- 📊 Real-time dashboard with statistics
- 📋 Detailed expiry reports for food items
- 🏷️ Category-specific fields for specialized tracking

### 🔔 Smart Alerts
- **Expired items** - Items past expiry date
- **Expiring soon** - Items expiring within 7 days
- **Expiring warning** - Items expiring within 30 days
- **Low stock** - Items at or below minimum threshold

## Tech Stack

- **Framework**: [Fresh](https://fresh.deno.dev/) - Deno's web framework
- **Runtime**: [Deno](https://deno.land/) - Modern, secure TypeScript runtime
- **Database**: Deno KV - Built-in key-value database (no setup required!)
- **Styling**: Tailwind CSS
- **UI**: Preact with Islands Architecture

## Getting Started

### Prerequisites
- Install [Deno](https://deno.land/) (v1.37 or later)

### Installation & Setup

1. **Navigate to the project directory:**
   ```bash
   cd /Users/zr/dev/workspace/scout-inventory
   ```

2. **Seed the database with sample data:**
   ```bash
   deno task seed
   ```
   This will populate your inventory with sample tents, cooking equipment, and food items.

3. **Start the development server:**
   ```bash
   deno task start
   ```
   The app will be available at `http://localhost:8000`

### Available Commands

```bash
deno task start      # Start development server with hot reload
deno task seed       # Populate database with sample data
deno task build      # Build for production
deno task preview    # Preview production build
deno task check      # Run type checking and linting
```

## Project Structure

```
scout-inventory/
├── components/          # Reusable UI components
│   ├── Layout.tsx      # Page layout with navigation
│   ├── StatCard.tsx    # Dashboard statistics cards
│   ├── ExpiryBadge.tsx # Food expiry status badges
│   └── CategoryIcon.tsx # Category icons
├── db/                 # Database layer
│   ├── kv.ts          # Deno KV operations (CRUD)
│   └── seed.ts        # Sample data seeding
├── islands/            # Interactive components (client-side)
│   ├── InventoryTable.tsx  # Interactive inventory table
│   └── ItemForm.tsx        # Add/edit item form
├── lib/                # Utility functions
│   ├── date-utils.ts   # Date formatting and calculations
│   └── validation.ts   # Input validation helpers
├── routes/             # File-based routing
│   ├── index.tsx       # Dashboard
│   ├── inventory/
│   │   ├── index.tsx   # Inventory list
│   │   ├── add.tsx     # Add new item
│   │   ├── [id].tsx    # Item details
│   │   └── edit/[id].tsx # Edit item
│   ├── reports/
│   │   └── expiring.tsx # Expiring food report
│   └── api/            # REST API endpoints
│       ├── items/
│       │   ├── index.ts    # GET all, POST new
│       │   └── [id].ts     # GET, PUT, DELETE by ID
│       └── stats.ts        # Dashboard statistics
├── types/              # TypeScript type definitions
│   └── inventory.ts    # Inventory item types
└── static/             # Static assets
    └── styles.css      # Global styles
```

## Usage Guide

### Dashboard
- View overview statistics for all inventory
- See alerts for low stock and expiring food
- Quick access to category breakdowns
- One-click navigation to common tasks

### Managing Inventory

**Adding Items:**
1. Click "Add Item" from dashboard or navigation
2. Select category (Tent, Cooking, or Food)
3. Fill in required fields (name, quantity, location, threshold)
4. Add category-specific details
5. Save to inventory

**Viewing Items:**
- Browse all items in the Inventory page
- Use search to find items by name, location, or notes
- Filter by category or show only low stock items
- Click "View" to see full item details

**Editing Items:**
- Open item details page
- Click "Edit" button
- Update any fields (category cannot be changed)
- Save changes

**Deleting Items:**
- From inventory list, click "Delete" on any item
- Confirm deletion

### Food Expiry Monitoring
- Navigate to "Expiring Food" from dashboard or navigation
- Items are organized into three categories:
  - **Expired** (red) - Remove immediately
  - **Expiring Soon** (orange) - Within 7 days
  - **Expiring Warning** (yellow) - Within 30 days

### Category-Specific Features

**Tents:**
- Type (dome, tunnel, patrol, ridge, bell)
- Capacity and size
- Condition tracking
- Brand and purchase year

**Cooking Equipment:**
- Equipment type (stove, pots, cooler, etc.)
- Material and fuel type
- Capacity specifications
- Condition tracking

**Food Items:**
- Food type (canned, dried, packaged, fresh, frozen)
- Expiry date with visual indicators
- Storage requirements
- Allergen tracking
- Weight and serving information

## Data Persistence

The app uses **Deno KV**, a built-in key-value database that:
- Requires no external database setup
- Stores data locally in development
- Automatically handles serialization
- Provides fast, simple key-value storage

Data persists between server restarts automatically.

## Customization

### Adding New Categories
1. Update `types/inventory.ts` with new category type
2. Add category-specific interface
3. Update form in `islands/ItemForm.tsx`
4. Add display logic in detail pages

### Modifying Expiry Thresholds
Edit the logic in `types/inventory.ts`:
```typescript
export function getExpiryStatus(expiryDate: Date): ExpiryStatus {
  const daysUntilExpiry = Math.floor(...);
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 7) return "expiring-soon";    // Change these
  if (daysUntilExpiry <= 30) return "expiring-warning"; // thresholds
  return "fresh";
}
```

## Future Enhancement Ideas

- 📤 Export inventory to CSV/Excel
- 📧 Email notifications for expiring items
- 🔄 Check-out/check-in system for borrowed equipment
- 📱 Mobile-responsive improvements
- 📷 Photo uploads for items
- 📈 Historical tracking and analytics
- 🔐 User authentication and roles
- 📦 Barcode/QR code scanning

## License

MIT License - Feel free to use and modify for your scout troop!

## Contributing

Contributions welcome! This is a community project designed to help scout organizations manage their equipment more effectively.

---

Built with ❤️ for scout troops everywhere using Fresh and Deno 🦕
