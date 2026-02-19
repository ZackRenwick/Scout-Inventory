import { Handlers } from "$fresh/server.ts";

// Lightweight health-check endpoint used by the self-warmup cron
export const handler: Handlers = {
  GET() {
    return new Response("ok", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
