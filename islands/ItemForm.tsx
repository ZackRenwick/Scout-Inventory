// Form for adding/editing inventory items
import { Signal, useSignal } from "@preact/signals";
import { ITEM_LOCATIONS, LOFT_LOCATIONS } from "../types/inventory.ts";

interface ItemFormProps {
  initialData?: any;
  isEdit?: boolean;
  csrfToken?: string;
}

export default function ItemForm({ initialData, isEdit = false, csrfToken = "" }: ItemFormProps) {
  const initialSpace = initialData?.space ?? (initialData?.category === "games" ? "scout-post-loft" : "camp-store");
  const space = useSignal<"camp-store" | "scout-post-loft">(initialSpace);
  const category = useSignal<"tent" | "cooking" | "food" | "camping-tools" | "games">(initialData?.category || "tent");
  const submitting = useSignal(false);
  const error = useSignal("");
  const success = useSignal("");

  // Find the group that contains the initial location value (for edit mode)
  const initialLocationList = initialSpace === "scout-post-loft" ? LOFT_LOCATIONS : ITEM_LOCATIONS;
  const initialGroup = initialData?.location
    ? (initialLocationList.find((g) => g.options.includes(initialData.location))?.group ?? initialLocationList[0].group)
    : initialLocationList[0].group;
  const locationGroup = useSignal<string>(initialGroup);
  const locationValue = useSignal<string>(
    initialData?.location ?? initialLocationList[0].options[0]
  );

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    submitting.value = true;
    error.value = "";
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const data: any = {
      name: formData.get("name"),
      category: category.value,
      space: space.value,
      quantity: parseInt(formData.get("quantity") as string),
      minThreshold: parseInt(formData.get("minThreshold") as string),
      location: formData.get("location"),
      notes: formData.get("notes") || undefined,
    };
    
    // Category-specific fields
    if (category.value === "tent") {
      data.tentType = formData.get("tentType");
      data.capacity = parseInt(formData.get("capacity") as string);
      data.size = formData.get("size");
      data.condition = formData.get("condition");
      data.brand = formData.get("brand") || undefined;
      data.yearPurchased = formData.get("yearPurchased") ? parseInt(formData.get("yearPurchased") as string) : undefined;
    } else if (category.value === "cooking") {
      data.equipmentType = formData.get("equipmentType");
      data.material = formData.get("material") || undefined;
      data.fuelType = formData.get("fuelType") || undefined;
      data.capacity = formData.get("capacityField") || undefined;
      data.condition = formData.get("condition");
    } else if (category.value === "camping-tools") {
      data.toolType = formData.get("toolType");
      data.condition = formData.get("condition");
      data.material = formData.get("material") || undefined;
      data.brand = formData.get("brand") || undefined;
      data.yearPurchased = formData.get("yearPurchased") ? parseInt(formData.get("yearPurchased") as string) : undefined;
    } else if (category.value === "games") {
      data.gameType = formData.get("gameType");
      data.condition = formData.get("condition");
      data.playerCount = formData.get("playerCount") || undefined;
      data.ageRange = formData.get("ageRange") || undefined;
      data.brand = formData.get("brand") || undefined;
      data.yearPurchased = formData.get("yearPurchased") ? parseInt(formData.get("yearPurchased") as string) : undefined;
    } else if (category.value === "food") {
      data.foodType = formData.get("foodType");
      data.expiryDate = formData.get("expiryDate");
      data.storageRequirements = formData.get("storageRequirements") || undefined;
      data.weight = formData.get("weight") || undefined;
      data.servings = formData.get("servings") ? parseInt(formData.get("servings") as string) : undefined;
      
      const allergens = formData.get("allergens") as string;
      if (allergens) {
        data.allergens = allergens.split(",").map(a => a.trim());
      }
    }
    
    try {
      const url = isEdit ? `/api/items/${initialData.id}` : "/api/items";
      const method = isEdit ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        success.value = isEdit ? "Item updated successfully!" : "Item added successfully!";
        setTimeout(() => { window.location.href = "/inventory"; }, 1200);
      } else {
        const result = await response.json();
        error.value = result.error || "Failed to save item";
      }
    } catch (err) {
      error.value = "Network error occurred";
    } finally {
      submitting.value = false;
    }
  };
  
  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-purple-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";

  return (
    <form onSubmit={handleSubmit} class="bg-white dark:bg-gray-900 rounded-lg shadow p-4 sm:p-6 w-full max-w-2xl">
      {success.value && (
        <div class="mb-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded flex items-center gap-2">
          <span>✓</span> {success.value}
        </div>
      )}
      {error.value && (
        <div class="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded">
          {error.value}
        </div>
      )}
      
      {/* Space Selection */}
      <div class="mb-4">
        <label class={labelClass}>Space *</label>
        <div class="flex gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="spaceRadio"
              value="camp-store"
              checked={space.value === "camp-store"}
              onChange={() => { space.value = "camp-store"; if (!isEdit) { category.value = "tent"; locationGroup.value = ITEM_LOCATIONS[0].group; locationValue.value = ITEM_LOCATIONS[0].options[0]; } }}
              disabled={isEdit}
              class="text-purple-600"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">🏪 Camp Store</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="spaceRadio"
              value="scout-post-loft"
              checked={space.value === "scout-post-loft"}
              onChange={() => { space.value = "scout-post-loft"; if (!isEdit) { category.value = "games"; locationGroup.value = LOFT_LOCATIONS[0].group; locationValue.value = LOFT_LOCATIONS[0].options[0]; } }}
              disabled={isEdit}
              class="text-purple-600"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">🏠 Scout Post Loft</span>
          </label>
        </div>
      </div>

      {/* Category Selection */}
      <div class="mb-6">
        <label class={labelClass}>
          Category *
        </label>
        <select
          value={category.value}
          onChange={(e) => category.value = (e.target as HTMLSelectElement).value as any}
          disabled={isEdit}
          class={inputClass}
          required
        >
          {space.value === "camp-store" ? (
            <>
              <option value="tent">⛺ Tent</option>
              <option value="cooking">🍳 Cooking Equipment</option>
              <option value="food">🥫 Food</option>
              <option value="camping-tools">🪓 Camping Tools</option>
            </>
          ) : (
            <>
              <option value="games">🎮 Games Equipment</option>
            </>
          )}
        </select>
      </div>
      
      {/* Common Fields */}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label class={labelClass}>
            Item Name *
          </label>
          <input type="text" name="name" defaultValue={initialData?.name} required class={inputClass} />
        </div>
        
        <div class="sm:col-span-2">
          <label class={labelClass}>Location *</label>
          <div class="flex gap-2">
            {/* Step 1: pick a category of storage */}
            <select
              class={inputClass}
              value={locationGroup.value}
              onChange={(e) => {
                const group = (e.target as HTMLSelectElement).value;
                locationGroup.value = group;
                const locs = space.value === "scout-post-loft" ? LOFT_LOCATIONS : ITEM_LOCATIONS;
                const firstOption = locs.find((g) => g.group === group)?.options[0] ?? locs[0].options[0];
                locationValue.value = firstOption;
              }}
            >
              {(space.value === "scout-post-loft" ? LOFT_LOCATIONS : ITEM_LOCATIONS).map(({ group }) => (
                <option key={group} value={group} selected={group === locationGroup.value}>{group}</option>
              ))}
            </select>
            {/* Step 2: pick the specific slot within that category */}
            <select
              name="location"
              required
              class={inputClass}
              value={locationValue.value}
              onChange={(e) => { locationValue.value = (e.target as HTMLSelectElement).value; }}
            >
              {(space.value === "scout-post-loft" ? LOFT_LOCATIONS : ITEM_LOCATIONS).find((g) => g.group === locationGroup.value)?.options.map((loc) => (
                <option key={loc} value={loc} selected={loc === locationValue.value}>{loc}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div>
          <label class={labelClass}>
            Quantity *
          </label>
          <input type="number" name="quantity" defaultValue={initialData?.quantity || 1} min="0" required class={inputClass} />
        </div>
        
        <div>
          <label class={labelClass}>
            Minimum Threshold *
          </label>
          <input type="number" name="minThreshold" defaultValue={initialData?.minThreshold ?? 0} min="0" required class={inputClass} />
        </div>
      </div>
      
      {/* Tent-specific fields */}
      {category.value === "tent" && (
        <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
          <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Tent Details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class={labelClass}>Type *</label>
              <select name="tentType" required class={inputClass}>
                <option value="dome" selected={initialData?.tentType === "dome"}>Dome</option>
                <option value="tunnel" selected={initialData?.tentType === "tunnel"}>Tunnel</option>
                <option value="patrol" selected={initialData?.tentType === "patrol"}>Patrol</option>
                <option value="ridge" selected={initialData?.tentType === "ridge"}>Ridge</option>
                <option value="bell" selected={initialData?.tentType === "bell"}>Bell</option>
                <option value="other" selected={initialData?.tentType === "other"}>Other</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Capacity (people) *</label>
              <input type="number" name="capacity" defaultValue={initialData?.capacity} required min="1" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Size Description *</label>
              <input type="text" name="size" defaultValue={initialData?.size} required placeholder="e.g., 4-person" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Condition *</label>
              <select name="condition" required class={inputClass}>
                <option value="excellent" selected={initialData?.condition === "excellent"}>Excellent</option>
                <option value="good" selected={initialData?.condition === "good"}>Good</option>
                <option value="fair" selected={initialData?.condition === "fair"}>Fair</option>
                <option value="needs-repair" selected={initialData?.condition === "needs-repair"}>Needs Repair</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Brand</label>
              <input type="text" name="brand" defaultValue={initialData?.brand} class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Year Purchased</label>
              <input type="number" name="yearPurchased" defaultValue={initialData?.yearPurchased} min="1900" max="2100" class={inputClass} />
            </div>
          </div>
        </div>
      )}
      
      {/* Cooking-specific fields */}
      {category.value === "cooking" && (
        <div class="mb-6 p-4 bg-orange-50 dark:bg-orange-950/40 rounded-lg">
          <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Cooking Equipment Details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class={labelClass}>Equipment Type *</label>
              <select name="equipmentType" required class={inputClass}>
                <option value="stove" selected={initialData?.equipmentType === "stove"}>Stove</option>
                <option value="pots" selected={initialData?.equipmentType === "pots"}>Pots</option>
                <option value="pans" selected={initialData?.equipmentType === "pans"}>Pans</option>
                <option value="utensils" selected={initialData?.equipmentType === "utensils"}>Utensils</option>
                <option value="cooler" selected={initialData?.equipmentType === "cooler"}>Cooler</option>
                <option value="water-container" selected={initialData?.equipmentType === "water-container"}>Water Container</option>
                <option value="other" selected={initialData?.equipmentType === "other"}>Other</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Condition *</label>
              <select name="condition" required class={inputClass}>
                <option value="excellent" selected={initialData?.condition === "excellent"}>Excellent</option>
                <option value="good" selected={initialData?.condition === "good"}>Good</option>
                <option value="fair" selected={initialData?.condition === "fair"}>Fair</option>
                <option value="needs-repair" selected={initialData?.condition === "needs-repair"}>Needs Repair</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Material</label>
              <input type="text" name="material" defaultValue={initialData?.material} placeholder="e.g., stainless steel" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Fuel Type</label>
              <input type="text" name="fuelType" defaultValue={initialData?.fuelType} placeholder="For stoves" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Capacity</label>
              <input type="text" name="capacityField" defaultValue={initialData?.capacity} placeholder="e.g., 5L, 48 quart" class={inputClass} />
            </div>
          </div>
        </div>
      )}
      
      {/* Camping Tools-specific fields */}
      {category.value === "camping-tools" && (
        <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg">
          <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Camping Tool Details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class={labelClass}>Tool Type *</label>
              <select name="toolType" required class={inputClass}>
                <option value="axe" selected={initialData?.toolType === "axe"}>Axe</option>
                <option value="saw" selected={initialData?.toolType === "saw"}>Saw</option>
                <option value="knife" selected={initialData?.toolType === "knife"}>Knife</option>
                <option value="shovel" selected={initialData?.toolType === "shovel"}>Shovel</option>
                <option value="rope" selected={initialData?.toolType === "rope"}>Rope</option>
                <option value="hammer" selected={initialData?.toolType === "hammer"}>Hammer</option>
                <option value="multi-tool" selected={initialData?.toolType === "multi-tool"}>Multi-tool</option>
                <option value="other" selected={initialData?.toolType === "other"}>Other</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Condition *</label>
              <select name="condition" required class={inputClass}>
                <option value="excellent" selected={initialData?.condition === "excellent"}>Excellent</option>
                <option value="good" selected={initialData?.condition === "good"}>Good</option>
                <option value="fair" selected={initialData?.condition === "fair"}>Fair</option>
                <option value="needs-repair" selected={initialData?.condition === "needs-repair"}>Needs Repair</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Material</label>
              <input type="text" name="material" defaultValue={initialData?.material} placeholder="e.g., carbon steel" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Brand</label>
              <input type="text" name="brand" defaultValue={initialData?.brand} class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Year Purchased</label>
              <input type="number" name="yearPurchased" defaultValue={initialData?.yearPurchased} min="1900" max="2100" class={inputClass} />
            </div>
          </div>
        </div>
      )}

      {/* Food-specific fields */}
      {category.value === "food" && (
        <div class="mb-6 p-4 bg-green-50 dark:bg-green-950/40 rounded-lg">
          <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Food Details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class={labelClass}>Food Type *</label>
              <select name="foodType" required class={inputClass}>
                <option value="canned" selected={initialData?.foodType === "canned"}>Canned</option>
                <option value="jarred" selected={initialData?.foodType === "jarred"}>Jarred</option>
                <option value="dried" selected={initialData?.foodType === "dried"}>Dried</option>
                <option value="packaged" selected={initialData?.foodType === "packaged"}>Packaged</option>
                <option value="fresh" selected={initialData?.foodType === "fresh"}>Fresh</option>
                <option value="frozen" selected={initialData?.foodType === "frozen"}>Frozen</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Expiry Date *</label>
              <input type="date" name="expiryDate" defaultValue={initialData?.expiryDate ? new Date(initialData.expiryDate).toISOString().split('T')[0] : ''} required class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Storage Requirements</label>
              <select name="storageRequirements" class={inputClass}>
                <option value="" selected={!initialData?.storageRequirements}>Not specified</option>
                <option value="frozen" selected={initialData?.storageRequirements === "frozen"}>Frozen</option>
                <option value="refrigerated" selected={initialData?.storageRequirements === "refrigerated"}>Refrigerated</option>
                <option value="cool-dry" selected={initialData?.storageRequirements === "cool-dry"}>Cool & Dry</option>
                <option value="room-temp" selected={initialData?.storageRequirements === "room-temp"}>Room Temperature</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Weight</label>
              <input type="text" name="weight" defaultValue={initialData?.weight} placeholder="e.g., 15oz" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Servings</label>
              <input type="number" name="servings" defaultValue={initialData?.servings} min="1" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Allergens</label>
              <input type="text" name="allergens" defaultValue={initialData?.allergens?.join(", ")} placeholder="Comma-separated" class={inputClass} />
            </div>
          </div>
        </div>
      )}
      
      {/* Games-specific fields */}
      {category.value === "games" && (
        <div class="mb-6 p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
          <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Games Details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class={labelClass}>Game Type *</label>
              <select name="gameType" required class={inputClass}>
                <option value="board-game" selected={initialData?.gameType === "board-game"}>Board Game</option>
                <option value="card-game" selected={initialData?.gameType === "card-game"}>Card Game</option>
                <option value="outdoor-game" selected={initialData?.gameType === "outdoor-game"}>Outdoor Game</option>
                <option value="sports" selected={initialData?.gameType === "sports"}>Sports Equipment</option>
                <option value="puzzle" selected={initialData?.gameType === "puzzle"}>Puzzle</option>
                <option value="other" selected={initialData?.gameType === "other"}>Other</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Condition *</label>
              <select name="condition" required class={inputClass}>
                <option value="excellent" selected={initialData?.condition === "excellent"}>Excellent</option>
                <option value="good" selected={initialData?.condition === "good"}>Good</option>
                <option value="fair" selected={initialData?.condition === "fair"}>Fair</option>
                <option value="needs-repair" selected={initialData?.condition === "needs-repair"}>Needs Repair</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Player Count</label>
              <input type="text" name="playerCount" defaultValue={initialData?.playerCount} placeholder="e.g. 2-4" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Age Range</label>
              <input type="text" name="ageRange" defaultValue={initialData?.ageRange} placeholder="e.g. 8+" class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Brand</label>
              <input type="text" name="brand" defaultValue={initialData?.brand} class={inputClass} />
            </div>
            <div>
              <label class={labelClass}>Year Purchased</label>
              <input type="number" name="yearPurchased" defaultValue={initialData?.yearPurchased} min="1900" max="2100" class={inputClass} />
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div class="mb-6">
        <label class={labelClass}>
          Notes
        </label>
        <textarea
          name="notes"
          rows={3}
          class={inputClass}
          placeholder="Additional notes or comments..."
        >{initialData?.notes ?? ""}</textarea>
      </div>
      
      {/* Submit Buttons */}
      <div class="flex gap-3">
        <button
          type="submit"
          disabled={submitting.value}
          class="px-6 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitting.value ? "Saving..." : (isEdit ? "Update Item" : "Add Item")}
        </button>
        <a
          href="/inventory"
          class="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
