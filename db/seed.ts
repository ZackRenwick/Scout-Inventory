// Seed data for development and testing
import type { InventoryItem } from "../types/inventory.ts";
import { createItem } from "./kv.ts";

export async function seedDatabase() {
  const sampleItems: InventoryItem[] = [
    // Tents
    {
      id: crypto.randomUUID(),
      name: "Coleman Sundome 4-Person Tent",
      category: "tent",
      tentType: "dome",
      capacity: 4,
      size: "4-person",
      condition: "good",
      brand: "Coleman",
      quantity: 3,
      minThreshold: 1,
      location: "Metal Shelf 1 - Slot 1",
      yearPurchased: 2024,
      addedDate: new Date("2024-03-15"),
      lastUpdated: new Date("2024-03-15"),
      notes: "Waterproof, includes rainfly",
    },
    {
      id: crypto.randomUUID(),
      name: "Patrol Scout Tent 8-Person",
      category: "tent",
      tentType: "patrol",
      capacity: 8,
      size: "8-person",
      condition: "excellent",
      quantity: 2,
      minThreshold: 1,
      location: "Metal Shelf 1 - Slot 2",
      yearPurchased: 2025,
      addedDate: new Date("2025-01-10"),
      lastUpdated: new Date("2025-01-10"),
      notes: "Large patrol tent for group camping",
    },
    {
      id: crypto.randomUUID(),
      name: "Bell Tent Canvas 5m",
      category: "tent",
      tentType: "bell",
      capacity: 10,
      size: "5-meter diameter",
      condition: "fair",
      quantity: 1,
      minThreshold: 1,
      location: "Metal Shelf 2 - Slot 1",
      yearPurchased: 2020,
      addedDate: new Date("2024-06-01"),
      lastUpdated: new Date("2024-06-01"),
      notes: "Needs minor repairs to base canvas",
    },
    
    // Cooking Equipment
    {
      id: crypto.randomUUID(),
      name: "Camp Stove - 2 Burner",
      category: "cooking",
      equipmentType: "stove",
      fuelType: "propane",
      condition: "excellent",
      quantity: 4,
      minThreshold: 2,
      location: "Plastic Shelf 1 - Level 2",
      addedDate: new Date("2024-05-20"),
      lastUpdated: new Date("2024-05-20"),
      notes: "Includes windscreen and carrying case",
    },
    {
      id: crypto.randomUUID(),
      name: "Large Cooking Pot Set",
      category: "cooking",
      equipmentType: "pots",
      material: "stainless steel",
      capacity: "5L, 8L, 12L",
      condition: "good",
      quantity: 2,
      minThreshold: 1,
      location: "Plastic Shelf 1 - Level 3",
      addedDate: new Date("2024-02-14"),
      lastUpdated: new Date("2024-02-14"),
      notes: "Set of 3 pots with lids",
    },
    {
      id: crypto.randomUUID(),
      name: "Cooler - 48 Quart",
      category: "cooking",
      equipmentType: "cooler",
      capacity: "48 quart",
      condition: "good",
      quantity: 5,
      minThreshold: 2,
      location: "On Top of Plastic Shelf 2",
      lastUpdated: new Date("2024-04-01"),
      notes: "Keeps ice for 3 days",
    },
    {
      id: crypto.randomUUID(),
      name: "Water Container - 5 Gallon",
      category: "cooking",
      equipmentType: "water-container",
      capacity: "5 gallon",
      condition: "excellent",
      quantity: 6,
      minThreshold: 3,
      location: "Plastic Shelf 2 - Level 1",
      lastUpdated: new Date("2025-01-05"),
      notes: "Collapsible with spigot",
    },
    
    // Food Items
    {
      id: crypto.randomUUID(),
      name: "Canned Beans - Variety Pack",
      category: "food",
      foodType: "canned",
      expiryDate: new Date("2027-08-15"),
      storageRequirements: "cool-dry",
      quantity: 48,
      minThreshold: 12,
      location: "Plastic Shelf 3 - Level 1",
      servings: 96,
      addedDate: new Date("2025-01-20"),
      lastUpdated: new Date("2025-01-20"),
      notes: "Black beans, pinto beans, kidney beans",
    },
    {
      id: crypto.randomUUID(),
      name: "Instant Oatmeal Packets",
      category: "food",
      foodType: "packaged",
      expiryDate: new Date("2026-12-01"),
      storageRequirements: "cool-dry",
      quantity: 120,
      minThreshold: 30,
      location: "Plastic Shelf 3 - Level 2",
      allergens: ["gluten", "may contain nuts"],
      addedDate: new Date("2025-02-01"),
      lastUpdated: new Date("2025-02-01"),
      notes: "Assorted flavors - maple, apple cinnamon, original",
    },
    {
      id: crypto.randomUUID(),
      name: "Trail Mix - Bulk",
      category: "food",
      foodType: "packaged",
      expiryDate: new Date("2026-06-30"),
      storageRequirements: "cool-dry",
      quantity: 15,
      minThreshold: 5,
      location: "Plastic Shelf 3 - Level 3",
      allergens: ["nuts", "may contain dairy"],
      addedDate: new Date("2025-12-15"),
      lastUpdated: new Date("2025-12-15"),
      notes: "Peanuts, raisins, M&Ms, cashews",
    },
    {
      id: crypto.randomUUID(),
      name: "Freeze-Dried Camping Meals",
      category: "food",
      foodType: "dried",
      expiryDate: new Date("2028-03-15"),
      storageRequirements: "cool-dry",
      quantity: 24,
      minThreshold: 8,
      location: "Plastic Shelf 3 - Level 4",
      servings: 24,
      addedDate: new Date("2024-11-10"),
      lastUpdated: new Date("2024-11-10"),
      notes: "Various flavors - chicken pasta, beef stew, vegetarian chili",
    },
    {
      id: crypto.randomUUID(),
      name: "Fresh Apples",
      category: "food",
      foodType: "fresh",
      expiryDate: new Date("2026-02-25"), // Soon!
      storageRequirements: "cool-dry",
      quantity: 30,
      minThreshold: 10,
      location: "Wooden Shelf 1",
      weight: "~5 lbs",
      servings: 30,
      addedDate: new Date("2026-02-12"),
      lastUpdated: new Date("2026-02-12"),
      notes: "Granny Smith - use soon",
    },
    {
      id: crypto.randomUUID(),
      name: "Hot Chocolate Mix",
      category: "food",
      foodType: "packaged",
      expiryDate: new Date("2026-03-01"), // Expiring soon!
      storageRequirements: "cool-dry",
      quantity: 2,
      minThreshold: 1,
      location: "Plastic Shelf 2 - Level 2",
      servings: 40,
      addedDate: new Date("2024-01-05"),
      lastUpdated: new Date("2024-01-05"),
      notes: "Large container, marshmallows included",
    },
  ];

  console.log("Seeding database with sample inventory items...");
  
  for (const item of sampleItems) {
    await createItem(item);
    console.log(`✓ Added: ${item.name}`);
  }
  
  console.log(`\nDatabase seeded with ${sampleItems.length} items!`);
}

// Run this file directly to seed the database
if (import.meta.main) {
  await seedDatabase();
  console.log("Seeding complete. You can now start the app.");
  Deno.exit(0);
}
