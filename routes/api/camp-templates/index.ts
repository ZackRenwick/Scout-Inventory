// GET /api/camp-templates     — list all templates
// POST /api/camp-templates    — create a new template
import { Handlers } from "$fresh/server.ts";
import type { Session } from "../../../lib/auth.ts";
import { csrfOk, forbidden, csrfFailed } from "../../../lib/auth.ts";
import type { CampTemplateItem } from "../../../types/inventory.ts";
import { getAllCampTemplates, createCampTemplate } from "../../../db/kv.ts";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const templates = await getAllCampTemplates();
    return Response.json(templates);
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    let body: { name?: string; description?: string; items?: CampTemplateItem[] };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const name = body.name?.trim();
    if (!name) {
      return Response.json({ error: "Template name is required." }, { status: 400 });
    }
    if (name.length > 80) {
      return Response.json({ error: "Name must be 80 characters or fewer." }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return Response.json({ error: "Template must contain at least one item." }, { status: 400 });
    }

    const template = await createCampTemplate(
      name,
      body.items,
      session.username,
      body.description?.trim() || undefined,
    );
    return Response.json(template, { status: 201 });
  },
};
