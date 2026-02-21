# Quick Start Guide - Scout Inventory

## 🚀 Get Started in 3 Steps

### Step 1: Seed the Database
```bash
deno task seed
```
This creates sample inventory items so you can immediately explore the system.

### Step 2: Start the Server
```bash
deno task start
```
The app will be running at: http://localhost:8000

### Step 3: Explore!
- **Dashboard** (/) - View statistics and alerts
- **Inventory** (/inventory) - Browse and manage all items
- **Add Item** (/inventory/add) - Add new equipment or food
- **Expiring Food** (/reports/expiring) - Check food expiry status

## 📝 Quick Tips

### Adding Your First Item
1. Click "Add Item" in the navigation
2. Choose category: Tent, Cooking, or Food
3. Fill in the required fields
4. Category-specific fields will appear based on your selection
5. Click "Add Item" to save

### Managing Low Stock
- Set a "Minimum Threshold" for each item
- Dashboard will alert you when stock falls below this level
- Filter inventory by "Show Low Stock Only"

### Food Expiry Tracking
- All food items require an expiry date
- Color-coded badges show status:
  - 🔴 Red = Expired or expiring within 7 days
  - 🟡 Yellow = Expiring within 30 days
  - 🟢 Green = Fresh (30+ days remaining)
- Check the "Expiring Food" report for detailed view

## 🎯 Sample Data Included

The seed command adds:
- **3 Tents** - Various types and capacities
- **4 Cooking Items** - Stoves, pots, coolers, water containers
- **6 Food Items** - Including some intentionally expiring soon for demo

## 🔧 Common Tasks

### Clear All Data
```bash
# Delete the Deno KV database file
rm ~/Library/Caches/deno/location_data/*/kv.sqlite3
```

### Re-seed Database
```bash
deno task seed
```

### Check for Errors
```bash
deno task check
```

## 💡 Next Steps

1. **Customize categories** - Edit `types/inventory.ts` to add fields
2. **Adjust thresholds** - Change expiry warning periods
3. **Add your own data** - Replace sample items with real inventory
4. **Deploy** - Push to Deno Deploy when ready

## 🆘 Troubleshooting

**Port 8000 already in use?**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
```

**Database not persisting?**
- Data is stored in Deno KV (local file)
- Location: `~/Library/Caches/deno/location_data/`
- Persists automatically between restarts

**Fresh compilation errors?**
```bash
# Restart the dev server
# Press Ctrl+C, then:
deno task start
```

## 📖 Full Documentation

See [README.md](README.md) for complete documentation, architecture details, and customization guides.

---

Happy Inventory Managing! 🏕️⛺🍳
