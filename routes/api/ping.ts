// Lightweight health-check endpoint used by the self-warmup cron
export const handler = {
  GET() {
    return new Response("ok", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
