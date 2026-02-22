/// <reference lib="deno.unstable" />
// Authentication helpers: users and sessions stored in Deno KV
import bcrypt from "bcryptjs";

const SESSION_DURATION_MS = 1000 * 60 * 15; // 15 minutes
const BCRYPT_ROUNDS = 12;

// SHA-256 hashes are 64 lowercase hex chars — used to detect legacy hashes
const SHA256_RE = /^[0-9a-f]{64}$/;

// ===== PASSWORD POLICY (NIST SP 800-63B) =====
// - Minimum 12 characters, maximum 128
// - No mandatory complexity rules (forced symbols/numbers are counterproductive)
// - Block a list of commonly used passwords
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234",
  "123456789012", "12345678901", "1234567890", "123456789", "12345678",
  "qwerty123456", "qwertyuiop", "letmein123", "iloveyou123",
  "welcome123", "admin12345", "monkey1234", "dragon1234",
  "passw0rd123", "p@ssword123", "abc123456789",
]);

/**
 * Validates a candidate password against the site policy.
 * Returns an error message string if invalid, or null if valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (password.length > PASSWORD_MAX) {
    return `Password must be no more than ${PASSWORD_MAX} characters.`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too commonly used. Please choose a more unique one.";
  }
  return null;
}

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
  csrfToken: string;
}

// ===== PASSWORD HASHING =====

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Verifies a password against a stored hash.
// Transparently handles legacy SHA-256 hashes and returns the new bcrypt hash
// when migration is needed (caller should re-persist the user).
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<{ valid: boolean; newHash?: string }> {
  // Legacy SHA-256 hash — verify the old way, then upgrade
  if (SHA256_RE.test(hash)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const sha256 = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    if (sha256 !== hash) {
      return { valid: false };
    }
    // Password correct — re-hash with bcrypt for next time
    return { valid: true, newHash: await hashPassword(password) };
  }
  // Modern bcrypt hash
  const valid = await bcrypt.compare(password, hash);
  return { valid };
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
    if (entry.value.id === id) {
      return entry.value;
    }
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

// newPassword: plain-text password to hash; or pass preHashedValue to store a hash directly (migration use)
export async function updateUserPassword(username: string, newPassword: string | undefined, preHashedValue?: string): Promise<boolean> {
  const kv = await getKv();
  const user = await getUserByUsername(username);
  if (!user) {
    return false;
  }
  user.passwordHash = preHashedValue ?? await hashPassword(newPassword!);
  await kv.set(["auth", "users", user.username], user);
  return true;
}

export async function deleteUser(username: string): Promise<boolean> {
  const kv = await getKv();
  const existing = await getUserByUsername(username);
  if (!existing) {
    return false;
  }
  await kv.delete(["auth", "users", username.toLowerCase()]);
  return true;
}

// ===== RATE LIMITING =====

const RATE_LIMIT_MAX = 5;           // max failures
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15-minute lockout

interface RateLimit { attempts: number; lockedUntil?: string; }

export async function checkRateLimit(identifier: string): Promise<{ blocked: boolean; remaining: number }> {
  const kv = await getKv();
  const entry = await kv.get<RateLimit>(["auth", "rate_limit", identifier]);
  const data = entry.value ?? { attempts: 0 };
  if (data.lockedUntil && new Date(data.lockedUntil) > new Date()) {
    return { blocked: true, remaining: 0 };
  }
  return { blocked: false, remaining: Math.max(0, RATE_LIMIT_MAX - data.attempts) };
}

export async function recordFailedLogin(identifier: string): Promise<void> {
  const kv = await getKv();
  const entry = await kv.get<RateLimit>(["auth", "rate_limit", identifier]);
  const data = entry.value ?? { attempts: 0 };
  // Clear stale lockout
  if (data.lockedUntil && new Date(data.lockedUntil) <= new Date()) {
    data.attempts = 0;
    data.lockedUntil = undefined;
  }
  data.attempts++;
  if (data.attempts >= RATE_LIMIT_MAX) {
    data.lockedUntil = new Date(Date.now() + RATE_LIMIT_WINDOW_MS).toISOString();
  }
  await kv.set(["auth", "rate_limit", identifier], data, { expireIn: RATE_LIMIT_WINDOW_MS });
}

export async function resetRateLimit(identifier: string): Promise<void> {
  const kv = await getKv();
  await kv.delete(["auth", "rate_limit", identifier]);
}

// Ensure at least one admin exists from env vars on startup
export async function ensureDefaultAdmin(): Promise<void> {
  const username = Deno.env.get("ADMIN_USERNAME") ?? "admin";
  const password = Deno.env.get("ADMIN_PASSWORD") ?? "changeme";

  const existing = await getUserByUsername(username);
  if (existing) {
    // Only migrate legacy SHA-256 hashes — don't overwrite bcrypt passwords
    // set via the admin UI (those changes would otherwise be lost on redeploy)
    if (SHA256_RE.test(existing.passwordHash)) {
      await updateUserPassword(existing.username, password);
      console.log(`[auth] Migrated legacy hash for admin: ${username}`);
    }
    return;
  }

  // No user with that username — create one
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
    csrfToken: generateId(),
  };
  await kv.set(["auth", "sessions", session.id], session, {
    expireIn: SESSION_DURATION_MS,
  });
  // Secondary index: lets us find all sessions for a user efficiently
  await kv.set(["auth", "user_sessions", user.id, session.id], true, {
    expireIn: SESSION_DURATION_MS,
  });
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const kv = await getKv();
  const result = await kv.get<Session>(["auth", "sessions", sessionId]);
  if (!result.value) {
    return null;
  }
  // Check not expired (belt-and-suspenders; KV TTL handles it too)
  if (new Date(result.value.expiresAt) < new Date()) {
    await kv.delete(["auth", "sessions", sessionId]);
    return null;
  }
  return result.value;
}

// Slide the session expiry forward by SESSION_DURATION_MS from now (rolling session).
// Returns the updated session, or null if it no longer exists.
export async function extendSession(sessionId: string): Promise<Session | null> {
  const kv = await getKv();
  const result = await kv.get<Session>(["auth", "sessions", sessionId]);
  if (!result.value) {
    return null;
  }
  const session = result.value;
  session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  await kv.set(["auth", "sessions", sessionId], session, { expireIn: SESSION_DURATION_MS });
  // Keep the secondary user→session index TTL in sync
  await kv.set(["auth", "user_sessions", session.userId, sessionId], true, { expireIn: SESSION_DURATION_MS });
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const kv = await getKv();
  // Also remove the secondary index entry
  const session = await kv.get<Session>(["auth", "sessions", sessionId]);
  if (session.value) {
    await kv.delete(["auth", "user_sessions", session.value.userId, sessionId]);
  }
  await kv.delete(["auth", "sessions", sessionId]);
}

// Invalidate every active session for a user (e.g. after password change)
export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  const kv = await getKv();
  const index = kv.list<boolean>({ prefix: ["auth", "user_sessions", userId] });
  const deletes: Promise<void>[] = [];
  for await (const entry of index) {
    const sessionId = entry.key[entry.key.length - 1] as string;
    deletes.push(kv.delete(["auth", "sessions", sessionId]));
    deletes.push(kv.delete(entry.key));
  }
  await Promise.all(deletes);
}

// ===== COOKIE HELPERS =====

export function getSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "session") {
      return rest.join("=");
    }
  }
  return null;
}

const IS_DEPLOYED = !!Deno.env.get("DENO_DEPLOYMENT_ID");

export function makeSessionCookie(sessionId: string): string {
  const secure = IS_DEPLOYED ? "; Secure" : "";
  return `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = IS_DEPLOYED ? "; Secure" : "";
  return `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

// ===== API RESPONSE HELPERS =====

/** Returns true only when the request carries a valid CSRF token matching the session. */
export function csrfOk(req: Request, session: Session): boolean {
  const header = req.headers.get("X-CSRF-Token");
  return !!header && header === session.csrfToken;
}

/**
 * Creates a fresh 403 Insufficient-permissions response.
 * Must be a factory function — Response bodies are consumed streams and cannot
 * be returned from multiple requests using a shared module-level constant.
 */
export function forbidden(): Response {
  return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

/** Creates a fresh 403 Invalid-CSRF-token response. */
export function csrfFailed(): Response {
  return new Response(JSON.stringify({ error: "Invalid CSRF token" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
