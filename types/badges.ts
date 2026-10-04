// Core Scout badges — tracked as simple stock counts. Usually bought together
// as a set, but can also be adjusted individually.
export const CORE_BADGE_TYPES = [
  "world-membership",
  "scotland",
  "region",
  "west-lothian",
  "seventh-whitburn",
] as const;

export type CoreBadgeType = (typeof CORE_BADGE_TYPES)[number];

export const CORE_BADGE_META: Record<
  CoreBadgeType,
  { label: string; icon: string }
> = {
  "world-membership": { label: "World Membership", icon: "🌍" },
  "scotland": { label: "Scotland", icon: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  "region": { label: "Forth Region", icon: "🗺️" },
  "west-lothian": { label: "West Lothian", icon: "📍" },
  "seventh-whitburn": { label: "7th Whitburn", icon: "🏕️" },
};

export type CoreBadgeStock = Record<CoreBadgeType, number>;
