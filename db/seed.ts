// Seed data for development and testing
import type { InventoryItem } from "../types/inventory.ts";
import type { MealPayload } from "../types/meals.ts";
import { createItem, createMeal, rebuildIndexes } from "./kv.ts";

const CAMP_STORE = "camp-store" as const;

// Stable IDs for food items so meal ingredients can link to them
const FOOD_IDS = {
  beans:      "seed-food-beans-001",
  oatmeal:    "seed-food-oatmeal-001",
  trailMix:   "seed-food-trailmix-001",
  freezeDried:"seed-food-freezedried-001",
  apples:     "seed-food-apples-001",
  hotChoc:    "seed-food-hotchoc-001",
} as const;

export async function seedDatabase() {
  const sampleItems: InventoryItem[] = [
    // Tents
    {
      id: crypto.randomUUID(),
      name: "Coleman Sundome 4-Person Tent",
      category: "tent",
      space: CAMP_STORE,
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
      space: CAMP_STORE,
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
      space: CAMP_STORE,
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
      space: CAMP_STORE,
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
      space: CAMP_STORE,
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
      space: CAMP_STORE,
      equipmentType: "cooler",
      capacity: "48 quart",
      condition: "good",
      quantity: 5,
      minThreshold: 2,
      location: "On Top of Plastic Shelf 2",
      addedDate: new Date("2024-04-01"),
      lastUpdated: new Date("2024-04-01"),
      notes: "Keeps ice for 3 days",
    },
    {
      id: crypto.randomUUID(),
      name: "Water Container - 5 Gallon",
      category: "cooking",
      space: CAMP_STORE,
      equipmentType: "water-container",
      capacity: "5 gallon",
      condition: "excellent",
      quantity: 6,
      minThreshold: 3,
      location: "Plastic Shelf 2 - Level 1",
      addedDate: new Date("2025-01-05"),
      lastUpdated: new Date("2025-01-05"),
      notes: "Collapsible with spigot",
    },
    
    // Food Items
    // Pre-assigned IDs so meals can reference them as linked ingredients
    {
      id: FOOD_IDS.beans,
      name: "Canned Beans - Variety Pack",
      category: "food",
      space: CAMP_STORE,
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
      id: FOOD_IDS.oatmeal,
      name: "Instant Oatmeal Packets",
      category: "food",
      space: CAMP_STORE,
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
      id: FOOD_IDS.trailMix,
      name: "Trail Mix - Bulk",
      category: "food",
      space: CAMP_STORE,
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
      id: FOOD_IDS.freezeDried,
      name: "Freeze-Dried Camping Meals",
      category: "food",
      space: CAMP_STORE,
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
      id: FOOD_IDS.apples,
      name: "Fresh Apples",
      category: "food",
      space: CAMP_STORE,
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
      id: FOOD_IDS.hotChoc,
      name: "Hot Chocolate Mix",
      category: "food",
      space: CAMP_STORE,
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

  // ===== MEALS =====
  const sampleMeals: MealPayload[] = [
    {
      name: "Porridge Breakfast",
      description: "Simple hot oat porridge — quick to prepare for large groups",
      ingredients: [
        { name: "Instant Oatmeal Packets", servingsPerUnit: 1 },
        { name: "Honey", servingsPerUnit: 20 },
        { name: "Raisins (handful)", servingsPerUnit: 10 },
      ],
    },
    {
      name: "Campfire Bean Stew",
      description: "Hearty one-pot stew, great over rice or with bread",
      ingredients: [
        { name: "Canned Beans - Variety Pack", servingsPerUnit: 4 },
        { name: "Chopped Tomatoes (400g tin)", servingsPerUnit: 6 },
        { name: "Onion", servingsPerUnit: 8 },
        { name: "Vegetable Stock Cube", servingsPerUnit: 12 },
        { name: "Mixed Spice / Cumin", servingsPerUnit: 30 },
      ],
    },
    {
      name: "Afternoon Trail Snack",
      description: "Quick no-cook energy snack between activities",
      ingredients: [
        { name: "Trail Mix - Bulk", servingsPerUnit: 6 },
        { name: "Fresh Apples", servingsPerUnit: 1 },
      ],
    },
    {
      name: "Freeze-Dried Camp Dinner",
      description: "No-fuss hot dinner — just add boiling water",
      ingredients: [
        { name: "Freeze-Dried Camping Meals", servingsPerUnit: 1 },
      ],
    },
    {
      name: "Evening Hot Chocolate",
      description: "Warm wind-down drink around the campfire",
      ingredients: [
        { name: "Hot Chocolate Mix", servingsPerUnit: 20 },
        { name: "Milk (pint)", servingsPerUnit: 4 },
      ],
    },
  ];

  console.log("\nSeeding database with sample meals...");

  for (const meal of sampleMeals) {
    const created = await createMeal(meal);
    console.log(`✓ Added meal: ${created.name}`);
  }

  console.log(`\n${sampleMeals.length} meals seeded!`);
}

// Run this file directly to seed the database
if (import.meta.main) {
  await seedDatabase();
  console.log("\nRebuilding indexes and precomputed stats...");
  await rebuildIndexes();
  console.log("✓ Indexes rebuilt.");
  console.log("Seeding complete. You can now start the app.");
  Deno.exit(0);
}
