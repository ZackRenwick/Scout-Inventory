import type { FirstAidCatalogItem, FirstAidKitEntry, FirstAidKitProfile } from "../types/firstAid.ts";

export const DEFAULT_FIRST_AID_CATALOG: FirstAidCatalogItem[] = [
  { id: "gloves-pairs", name: "Disposable gloves", section: "PPE" },
  { id: "cpr-shield", name: "CPR masks", section: "PPE" },
  { id: "sanitizer", name: "Hand sanitizer", section: "PPE" },
  { id: "gauze-5", name: "Gauze pads (small)", section: "Wound care" },
  { id: "gauze-10", name: "Gauze pads (large)", section: "Wound care" },
  { id: "non-adherent", name: "Non-adherent dressings", section: "Wound care" },
  { id: "triangular-bandages", name: "Triangular bandages", section: "Bandages" },
  { id: "roller-bandages", name: "Conforming roller bandages", section: "Bandages" },
  { id: "elastic-bandages", name: "Elastic wrap bandage", section: "Bandages" },
  { id: "micropore-tape", name: "Medical tape", section: "Bandages" },
  { id: "plasters", name: "Adhesive bandages", section: "Wound care" },
  { id: "blister-plasters", name: "Blister plasters", section: "Wound care" },
  { id: "butterfly-closures", name: "Butterfly wound closures", section: "Wound care" },
  { id: "antibacterial-ointment", name: "Antibacterial ointment", section: "Wound care" },
  { id: "antiseptic-wipes", name: "Antiseptic wipes", section: "Wound care" },
  { id: "eye-wash", name: "Eye wash sterile pods", section: "Irrigation" },
  { id: "saline-wash", name: "Sterile saline solution", section: "Irrigation" },
  { id: "burn-gel", name: "Burn gel dressings", section: "Burn care" },
  { id: "aloe-gel", name: "Aloe gel (sunburn treatment)", section: "Medical support" },
  { id: "cold-pack", name: "Instant cold packs", section: "Sprains" },
  { id: "heating-pad", name: "Heating pad", section: "Sprains" },
  { id: "sam-splint", name: "Splint", section: "Immobilization" },
  { id: "finger-splints", name: "Finger splints", section: "Immobilization" },
  { id: "foil-blankets", name: "Emergency Blanket", section: "Exposure" },
  { id: "trauma-shears", name: "Scissors", section: "Tools" },
  { id: "tweezers", name: "Tweezers", section: "Tools" },
  { id: "thermometer", name: "Digital thermometer", section: "Assessment" },
  { id: "tourniquet", name: "Tourniquet", section: "Emergency" },
  { id: "tick-tool", name: "Tick removal tool", section: "Tools" },
  { id: "duct-tape", name: "Duct tape", section: "Tools" },
  { id: "safety-pins", name: "Safety pins", section: "Bandages" },
  { id: "headlamp", name: "Torch/headlamp for treatment", section: "Tools" },
  { id: "waste-bags", name: "Resealable clinical waste bags", section: "Hygiene" },
  { id: "incident-log", name: "Notepad incident log", section: "Documentation" },
  { id: "marker-pen", name: "Waterproof marker pen", section: "Documentation" },
  { id: "guidance-card", name: "First aid manuals", section: "Documentation" },
  { id: "emergency-sheet", name: "Emergency contact sheet", section: "Documentation" },
  { id: "anti-diarrheal", name: "Anti-diarrheal medication", section: "Medications" },
  { id: "antihistamines", name: "Antihistamines (children and adults)", section: "Medications" },
  { id: "eye-drops", name: "Eye drops", section: "Medications" },
  { id: "hydrocortisone", name: "Hydrocortisone cream", section: "Medications" },
  { id: "insect-repellent", name: "Insect repellent", section: "Medications" },
  { id: "pain-relief", name: "Pain relievers (children and adults)", section: "Medications" },
  { id: "personal-meds", name: "Personal medications", section: "Medications" },
  { id: "ors", name: "Oral rehydration salts sachets", section: "Medical support" },
  { id: "glucose", name: "Oral glucose tablets", section: "Medical support" },
];

export const FIRST_AID_PROFILES: FirstAidKitProfile[] = [
  {
    id: "camp-full",
    label: "Camp Full Profile",
    description: "Multiday camp loadout with deeper stock levels.",
    items: [
      { itemId: "gloves-pairs", quantityTarget: 20 },
      { itemId: "cpr-shield", quantityTarget: 2 },
      { itemId: "sanitizer", quantityTarget: 2 },
      { itemId: "gauze-5", quantityTarget: 30 },
      { itemId: "gauze-10", quantityTarget: 20 },
      { itemId: "non-adherent", quantityTarget: 12 },
      { itemId: "triangular-bandages", quantityTarget: 8 },
      { itemId: "roller-bandages", quantityTarget: 10 },
      { itemId: "elastic-bandages", quantityTarget: 6 },
      { itemId: "micropore-tape", quantityTarget: 4 },
      { itemId: "plasters", quantityTarget: 100 },
      { itemId: "blister-plasters", quantityTarget: 20 },
      { itemId: "butterfly-closures", quantityTarget: 20 },
      { itemId: "eye-wash", quantityTarget: 12 },
      { itemId: "saline-wash", quantityTarget: 4 },
      { itemId: "burn-gel", quantityTarget: 6 },
      { itemId: "cold-pack", quantityTarget: 4 },
      { itemId: "sam-splint", quantityTarget: 2 },
      { itemId: "finger-splints", quantityTarget: 4 },
      { itemId: "foil-blankets", quantityTarget: 6 },
      { itemId: "trauma-shears", quantityTarget: 2 },
      { itemId: "tweezers", quantityTarget: 2 },
      { itemId: "thermometer", quantityTarget: 1 },
      { itemId: "tick-tool", quantityTarget: 2 },
      { itemId: "safety-pins", quantityTarget: 20 },
      { itemId: "headlamp", quantityTarget: 1 },
      { itemId: "waste-bags", quantityTarget: 10 },
      { itemId: "incident-log", quantityTarget: 1 },
      { itemId: "marker-pen", quantityTarget: 2 },
      { itemId: "guidance-card", quantityTarget: 1 },
      { itemId: "emergency-sheet", quantityTarget: 1 },
      { itemId: "ors", quantityTarget: 20 },
      { itemId: "glucose", quantityTarget: 6 },
    ],
  },
  {
    id: "events-light",
    label: "Events Light Profile",
    description: "Meetings and local events with lower stock depth.",
    items: [
      { itemId: "gloves-pairs", quantityTarget: 12 },
      { itemId: "cpr-shield", quantityTarget: 1 },
      { itemId: "sanitizer", quantityTarget: 1 },
      { itemId: "gauze-5", quantityTarget: 15 },
      { itemId: "gauze-10", quantityTarget: 10 },
      { itemId: "non-adherent", quantityTarget: 8 },
      { itemId: "triangular-bandages", quantityTarget: 4 },
      { itemId: "roller-bandages", quantityTarget: 6 },
      { itemId: "elastic-bandages", quantityTarget: 4 },
      { itemId: "micropore-tape", quantityTarget: 2 },
      { itemId: "plasters", quantityTarget: 60 },
      { itemId: "blister-plasters", quantityTarget: 12 },
      { itemId: "butterfly-closures", quantityTarget: 10 },
      { itemId: "eye-wash", quantityTarget: 6 },
      { itemId: "saline-wash", quantityTarget: 2 },
      { itemId: "burn-gel", quantityTarget: 4 },
      { itemId: "cold-pack", quantityTarget: 2 },
      { itemId: "sam-splint", quantityTarget: 1 },
      { itemId: "finger-splints", quantityTarget: 2 },
      { itemId: "foil-blankets", quantityTarget: 4 },
      { itemId: "trauma-shears", quantityTarget: 1 },
      { itemId: "tweezers", quantityTarget: 1 },
      { itemId: "thermometer", quantityTarget: 1 },
      { itemId: "tick-tool", quantityTarget: 1 },
      { itemId: "safety-pins", quantityTarget: 10 },
      { itemId: "headlamp", quantityTarget: 1 },
      { itemId: "waste-bags", quantityTarget: 6 },
      { itemId: "incident-log", quantityTarget: 1 },
      { itemId: "marker-pen", quantityTarget: 1 },
      { itemId: "guidance-card", quantityTarget: 1 },
      { itemId: "emergency-sheet", quantityTarget: 1 },
      { itemId: "ors", quantityTarget: 10 },
      { itemId: "glucose", quantityTarget: 4 },
    ],
  },
];

export function buildEntriesFromProfile(
  profileId: string,
  catalog: FirstAidCatalogItem[],
): FirstAidKitEntry[] {
  const profile = FIRST_AID_PROFILES.find((p) => p.id === profileId);
  if (!profile) return [];

  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  return profile.items
    .map((p) => {
      const catalog = catalogById.get(p.itemId);
      if (!catalog) return null;
      return {
        itemId: catalog.id,
        name: catalog.name,
        quantityTarget: p.quantityTarget,
      };
    })
    .filter((v): v is FirstAidKitEntry => v !== null);
}

export function getCatalogItemName(
  itemId: string,
  catalog: FirstAidCatalogItem[],
): string | null {
  return catalog.find((item) => item.id === itemId)?.name ?? null;
}
