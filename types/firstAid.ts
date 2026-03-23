export const FIRST_AID_SECTIONS = [
  "PPE",
  "Wound care",
  "Bandages",
  "Irrigation",
  "Burn care",
  "Sprains",
  "Immobilization",
  "Exposure",
  "Tools",
  "Assessment",
  "Emergency",
  "Hygiene",
  "Documentation",
  "Medications",
  "Medical support",
  "General",
] as const;

export type FirstAidSection = typeof FIRST_AID_SECTIONS[number];

export interface FirstAidCatalogItem {
  id: string;
  name: string;
  section: FirstAidSection;
}

export interface FirstAidKitEntry {
  itemId: string;
  name: string;
  quantityTarget: number;
  notes?: string;
}

export interface FirstAidKit {
  id: string;
  name: string;
  profileId?: string;
  entries: FirstAidKitEntry[];
  createdBy: string;
  createdAt: Date;
  lastUpdated: Date;
}

export interface FirstAidKitProfileItem {
  itemId: string;
  quantityTarget: number;
}

export interface FirstAidKitProfile {
  id: string;
  label: string;
  description: string;
  items: FirstAidKitProfileItem[];
}
