// GET /admin/export-templates-json — downloads camp templates as JSON.
// Protected by routes/admin/_middleware.ts (admin-only).
import type { Handlers } from "$fresh/server.ts";
import { getAllCampTemplates } from "../../db/kv.ts";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const session = ctx.state.session as { role?: string } | undefined;
    if (!session || session.role !== "admin") {
      return new Response(null, { status: 302, headers: { location: "/admin/admin-panel" } });
    }

    const templates = await getAllCampTemplates();
    templates.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const json = JSON.stringify(templates, null, 2);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `camp-templates-export-${today}.json`;

    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
};
