/// <reference lib="deno.unstable" />
// Authentication helpers: users and sessions stored in Deno KV

const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8 hours

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "editor" | "viewer";
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  expiresAt: string;
}

// ===== PASSWORD HASHING =====

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

// ===== SESSION ID =====

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// ===== DB HELPERS =====

async function getKv(): Promise<Deno.Kv> {
  return await Deno.openKv();
}

// ===== USER OPERATIONS =====

export async function getUserByUsername(username: string): Promise<User | null> {
  const kv = await getKv();
  const result = await kv.get<User>(["auth", "users", username.toLowerCase()]);
  return result.value ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const kv = await getKv();
  // Scan users to find by id
  const entries = kv.list<User>({ prefix: ["auth", "users"] });
  for await (const entry of entries) {
    if (entry.value.id === id) return entry.value;
  }
  return null;
}

export async function getAllUsers(): Promise<User[]> {
  const kv = await getKv();
  const users: User[] = [];
  const entries = kv.list<User>({ prefix: ["auth", "users"] });
  for await (const entry of entries) {
    users.push(entry.value);
  }
  return users;
}

export async function createUser(
  username: string,
  password: string,
  role: "admin" | "editor" | "viewer" = "viewer",
): Promise<User> {
  const kv = await getKv();
  const user: User = {
    id: generateId(),
    username: username.toLowerCase(),
    passwordHash: await hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  };
  await kv.set(["auth", "users", user.username], user);
  return user;
}

export async function updateUserPassword(username: string, newPassword: string): Promise<boolean> {
  const kv = await getKv();
  const user = await getUserByUsername(username);
  if (!user) return false;
  user.passwordHash = await hashPassword(newPassword);
  await kv.set(["auth", "users", user.username], user);
  return true;
}

export async function deleteUser(username: string): Promise<boolean> {
  const kv = await getKv();
  const existing = await getUserByUsername(username);
  if (!existing) return false;
  await kv.delete(["auth", "users", username.toLowerCase()]);
  return true;
}

// Ensure at least one admin exists from env vars on startup
export async function ensureDefaultAdmin(): Promise<void> {
  const kv = await getKv();
  const entries = kv.list<User>({ prefix: ["auth", "users"] });
  let hasAdmin = false;
  for await (const entry of entries) {
    if (entry.value.role === "admin") { hasAdmin = true; break; }
  }
  if (hasAdmin) return;

  const username = Deno.env.get("ADMIN_USERNAME") ?? "admin";
  const password = Deno.env.get("ADMIN_PASSWORD") ?? "changeme";
  await createUser(username, password, "admin");
  console.log(`[auth] Created default admin user: ${username}`);
}

// ===== SESSION OPERATIONS =====

export async function createSession(user: User): Promise<Session> {
  const kv = await getKv();
  const session: Session = {
    id: generateId(),
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
  };
  await kv.set(["auth", "sessions", session.id], session, {
    expireIn: SESSION_DURATION_MS,
  });
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const kv = await getKv();
  const result = await kv.get<Session>(["auth", "sessions", sessionId]);
  if (!result.value) return null;
  // Check not expired (belt-and-suspenders; KV TTL handles it too)
  if (new Date(result.value.expiresAt) < new Date()) {
    await kv.delete(["auth", "sessions", sessionId]);
    return null;
  }
  return result.value;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const kv = await getKv();
  await kv.delete(["auth", "sessions", sessionId]);
}

// ===== COOKIE HELPERS =====

export function getSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "session") return rest.join("=");
  }
  return null;
}

export function makeSessionCookie(sessionId: string): string {
  return `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}`;
}

export function clearSessionCookie(): string {
  return `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
