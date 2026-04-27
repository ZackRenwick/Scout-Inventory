// Seed data for development and testing
import type { CampPlan, InventoryItem } from "../types/inventory.ts";
import type { MealPayload } from "../types/meals.ts";
import { createCampPlan, createCampTemplate, createItem, createMeal, rebuildIndexes } from "./kv.ts";
import { logActivity } from "../lib/activityLog.ts";

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

const GEAR_IDS = {
  patrolTent: "seed-gear-patrol-tent-001",
  stove2Burner: "seed-gear-stove-001",
  bowSaw: "seed-gear-bowsaw-001",
  toolKit: "seed-gear-toolkit-001",
  rounders: "seed-gear-rounders-001",
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
      id: GEAR_IDS.patrolTent,
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
      yearPurchased: 2021,
      addedDate: new Date("2024-06-01"),
      lastUpdated: new Date("2024-06-01"),
      notes: "Needs minor repairs to base canvas",
    },
    
    // Cooking Equipment
    {
      id: GEAR_IDS.stove2Burner,
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

    // Camping Tools
    {
      id: crypto.randomUUID(),
      name: "Forest Axe - 600mm",
      category: "camping-tools",
      space: CAMP_STORE,
      toolType: "axe",
      condition: "good",
      material: "steel + hickory",
      brand: "Hultafors",
      yearPurchased: 2022,
      quantity: 2,
      minThreshold: 1,
      location: "Axe/Saw Hanging Space",
      addedDate: new Date("2024-09-12"),
      lastUpdated: new Date("2024-09-12"),
      notes: "Sharpened each season",
    },
    {
      id: GEAR_IDS.bowSaw,
      name: "Folding Bow Saw",
      category: "camping-tools",
      space: CAMP_STORE,
      toolType: "saw",
      condition: "excellent",
      material: "carbon steel",
      brand: "Bahco",
      yearPurchased: 2023,
      quantity: 3,
      minThreshold: 1,
      location: "Axe/Saw Hanging Space",
      addedDate: new Date("2025-03-03"),
      lastUpdated: new Date("2025-03-03"),
      notes: "24-inch blades",
    },

    // Fuel (gas storage)
    {
      id: crypto.randomUUID(),
      name: "Butane Canisters - 220g",
      category: "fuel",
      space: "gas-storage-box",
      fuelType: "butane canister",
      condition: "excellent",
      brand: "Coleman",
      yearPurchased: 2026,
      quantity: 18,
      minThreshold: 6,
      location: "Gas Storage Box",
      addedDate: new Date("2026-01-18"),
      lastUpdated: new Date("2026-01-18"),
      notes: "For portable stoves",
    },

    // Games (loft)
    {
      id: GEAR_IDS.rounders,
      name: "Rounders Set",
      category: "games",
      space: "scout-post-loft",
      gameType: "outdoor-game",
      condition: "good",
      playerCount: "8-20",
      yearPurchased: 2026,
      quantity: 2,
      minThreshold: 1,
      location: "Loft Shelf 2",
      addedDate: new Date("2024-07-08"),
      lastUpdated: new Date("2024-07-08"),
      notes: "Includes bats, bases and ball",
    },

    // Box / Kit
    {
      id: GEAR_IDS.toolKit,
      name: "Patrol Tool Kit Box",
      category: "kit",
      space: CAMP_STORE,
      kitType: "tool-kit",
      condition: "fair",
      brand: "Stanley",
      yearPurchased: 2024,
      quantity: 1,
      minThreshold: 1,
      location: "Red Box",
      contents: [
        { name: "Adjustable Spanner", quantity: 2 },
        { name: "Screwdriver Set", quantity: 1 },
        { name: "Duct Tape", quantity: 3 },
      ],
      quantityNeedsRepair: 1,
      addedDate: new Date("2024-10-02"),
      lastUpdated: new Date("2024-10-02"),
      notes: "Latch is loose and needs repair",
    },

    // Kilt outfits
    {
      id: crypto.randomUUID(),
      name: "Kilt Outfit - Medium",
      category: "kilt",
      space: CAMP_STORE,
      condition: "excellent",
      kiltComponents: ["kilt", "sporran", "socks", "flashes"],
      size: "M",
      brand: "McCalls",
      yearPurchased: 2025,
      quantity: 2,
      minThreshold: 1,
      location: "Green Box",
      addedDate: new Date("2025-05-16"),
      lastUpdated: new Date("2025-05-16"),
      notes: "Used for parade nights",
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

  // ===== CAMP TEMPLATES =====
  console.log("\nSeeding camp templates...");
  const createdBy = "seed.admin";

  const weekendTemplate = await createCampTemplate(
    "Weekend Patrol Camp",
    [
      {
        itemId: GEAR_IDS.patrolTent,
        itemName: "Patrol Scout Tent 8-Person",
        itemCategory: "tent",
        itemLocation: "Metal Shelf 1 - Slot 2",
        quantityPlanned: 1,
      },
      {
        itemId: GEAR_IDS.stove2Burner,
        itemName: "Camp Stove - 2 Burner",
        itemCategory: "cooking",
        itemLocation: "Plastic Shelf 1 - Level 2",
        quantityPlanned: 1,
      },
      {
        itemId: FOOD_IDS.beans,
        itemName: "Canned Beans - Variety Pack",
        itemCategory: "food",
        itemLocation: "Plastic Shelf 3 - Level 1",
        quantityPlanned: 8,
      },
      {
        itemId: FOOD_IDS.oatmeal,
        itemName: "Instant Oatmeal Packets",
        itemCategory: "food",
        itemLocation: "Plastic Shelf 3 - Level 2",
        quantityPlanned: 16,
      },
    ],
    createdBy,
    "Default list for short patrol weekends.",
  );

  const gamesNightTemplate = await createCampTemplate(
    "Campfire Activity Night",
    [
      {
        itemId: GEAR_IDS.rounders,
        itemName: "Rounders Set",
        itemCategory: "games",
        itemLocation: "Loft Shelf 2",
        quantityPlanned: 1,
      },
      {
        itemId: GEAR_IDS.toolKit,
        itemName: "Patrol Tool Kit Box",
        itemCategory: "kit",
        itemLocation: "Red Box",
        quantityPlanned: 1,
        notes: "Carry spare duct tape for shelter repairs.",
      },
    ],
    createdBy,
    "Optional activity and contingency equipment.",
  );

  console.log(`✓ Added template: ${weekendTemplate.name}`);
  console.log(`✓ Added template: ${gamesNightTemplate.name}`);

  // ===== CAMP PLANS =====
  console.log("\nSeeding camp plans...");
  const now = new Date();
  const upcomingCampDate = new Date(now.getFullYear(), now.getMonth() + 1, 14);
  const upcomingCampEnd = new Date(now.getFullYear(), now.getMonth() + 1, 16);
  const activeCampDate = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 2));
  const activeCampEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const samplePlans: CampPlan[] = [
    {
      id: crypto.randomUUID(),
      name: "Spring Patrol Weekend",
      campDate: upcomingCampDate,
      endDate: upcomingCampEnd,
      location: "Glenmore Campsite",
      notes: "Use template then add food top-up after headcount confirmation.",
      status: "planning",
      createdBy,
      createdAt: now,
      lastUpdated: now,
      items: [
        {
          itemId: GEAR_IDS.patrolTent,
          itemName: "Patrol Scout Tent 8-Person",
          itemCategory: "tent",
          itemLocation: "Metal Shelf 1 - Slot 2",
          quantityPlanned: 1,
          packedStatus: false,
          returnedStatus: false,
        },
        {
          itemId: GEAR_IDS.stove2Burner,
          itemName: "Camp Stove - 2 Burner",
          itemCategory: "cooking",
          itemLocation: "Plastic Shelf 1 - Level 2",
          quantityPlanned: 1,
          packedStatus: false,
          returnedStatus: false,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "District Skills Camp",
      campDate: activeCampDate,
      endDate: activeCampEnd,
      location: "Lochside Field",
      notes: "Active plan with mixed packed state for workflow testing.",
      status: "active",
      createdBy,
      createdAt: now,
      lastUpdated: now,
      items: [
        {
          itemId: GEAR_IDS.toolKit,
          itemName: "Patrol Tool Kit Box",
          itemCategory: "kit",
          itemLocation: "Red Box",
          quantityPlanned: 1,
          packedStatus: true,
          returnedStatus: false,
        },
        {
          itemId: GEAR_IDS.bowSaw,
          itemName: "Folding Bow Saw",
          itemCategory: "camping-tools",
          itemLocation: "Axe/Saw Hanging Space",
          quantityPlanned: 2,
          packedStatus: true,
          returnedStatus: false,
          notes: "One spare blade packed.",
        },
      ],
    },
  ];

  for (const plan of samplePlans) {
    const created = await createCampPlan(plan);
    console.log(`✓ Added camp plan: ${created.name}`);
  }

  // ===== ACTIVITY LOG =====
  console.log("\nSeeding activity log...");
  const activitySeed = [
    {
      username: createdBy,
      action: "camp.created" as const,
      resource: "Spring Patrol Weekend",
      details: "Created from seeded baseline flow",
    },
    {
      username: createdBy,
      action: "camp.updated" as const,
      resource: "District Skills Camp",
      details: "Status changed to active with partial packing",
    },
    {
      username: createdBy,
      action: "items.imported" as const,
      resource: "Seed Dataset",
      details: `${sampleItems.length} inventory items imported by seed script`,
    },
  ];

  for (const entry of activitySeed) {
    await logActivity(entry);
  }
  console.log(`✓ Added ${activitySeed.length} activity entries`);
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
