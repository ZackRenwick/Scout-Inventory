// Pure client-safe role constants and types — no Deno APIs.
// Import this from islands instead of lib/auth.ts to avoid bundling server code.

export const USER_ROLES = [
  "admin",
  "manager",
  "editor",
  "explorer",
  "viewer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ASSIGNABLE_USER_ROLES: Record<UserRole, readonly UserRole[]> = {
  admin: USER_ROLES,
  manager: ["manager", "editor", "explorer", "viewer"],
  editor: [],
  explorer: [],
  viewer: [],
};

export const USER_ROLE_META: Record<
  UserRole,
  { label: string; description: string }
> = {
  admin: { label: "Admin", description: "full access" },
  manager: { label: "Manager", description: "stock-take, exports & users" },
  editor: { label: "Editor", description: "manage inventory" },
  explorer: {
    label: "Explorer",
    description: "inventory only (no first aid / risk)",
  },
  viewer: { label: "Viewer", description: "read only" },
};

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}
