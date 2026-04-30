import type { FreshContext } from "$fresh/server.ts";

const API_SLOW_REQUEST_MS = Number(
  Deno.env.get("API_SLOW_REQUEST_MS") ?? "1200",
);
const API_HARD_TIMEOUT_MS = Number(Deno.env.get("API_HARD_TIMEOUT_MS") ?? "0");
const API_LOG_ALL_REQUESTS = Deno.env.get("API_LOG_ALL_REQUESTS") === "true";

async function withTimeout<T>(
  name: string,
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`[api] ${name} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function makeTimeoutResponse(requestId: string): Response {
  return new Response(
    JSON.stringify({
      error: "Gateway Timeout",
      message: "API handler exceeded timeout",
      requestId,
    }),
    {
      status: 504,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function handler(req: Request, ctx: FreshContext): Promise<Response> {
  const startedAt = Date.now();
  const path = new URL(req.url).pathname;
  const requestId = crypto.randomUUID().slice(0, 8);
  const label = `${req.method} ${path}`;

  try {
    const nextPromise = ctx.next();
    const res = API_HARD_TIMEOUT_MS > 0
      ? await withTimeout(label, nextPromise, API_HARD_TIMEOUT_MS)
      : await nextPromise;

    const elapsed = Date.now() - startedAt;
    if (API_LOG_ALL_REQUESTS || elapsed >= API_SLOW_REQUEST_MS) {
      const level = elapsed >= API_SLOW_REQUEST_MS ? "warn" : "log";
      console[level](
        `[api] ${label} -> ${res.status} (${elapsed}ms) id=${requestId}`,
      );
    }

    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (error) {
    const elapsed = Date.now() - startedAt;

    if (
      error instanceof Error &&
      error.message.includes("timed out") &&
      API_HARD_TIMEOUT_MS > 0
    ) {
      console.error(`[api] timeout ${label} (${elapsed}ms) id=${requestId}`, error);
      return makeTimeoutResponse(requestId);
    }

    console.error(`[api] error ${label} (${elapsed}ms) id=${requestId}`, error);
    throw error;
  }
}
