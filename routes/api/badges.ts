// API route for core badge stock management
// GET  /api/badges  → { [badgeType]: number, ... } for every type in CORE_BADGE_TYPES
// POST /api/badges  → { type: CoreBadgeType; delta: number } or { setDelta: number } (applies to every badge type)
//   → same shape as GET
import { Handlers } from "$fresh/server.ts";
import {
  adjustCoreBadgeSet,
  adjustCoreBadgeStock,
  getCoreBadgeStock,
} from "../../db/kv.ts";
import { CORE_BADGE_TYPES, type CoreBadgeType } from "../../types/badges.ts";
import { csrfFailed, csrfOk, forbidden, type Session } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";

function isCoreBadgeType(value: unknown): value is CoreBadgeType {
  return typeof value === "string" &&
    (CORE_BADGE_TYPES as readonly string[]).includes(value);
}

export const handler: Handlers = {
  async GET() {
    try {
      const stock = await getCoreBadgeStock();
      return Response.json(stock);
    } catch (_e) {
      return Response.json({ error: "Failed to fetch badge stock" }, {
        status: 500,
      });
    }
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "viewer") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    try {
      const body = await req.json();

      if (
        typeof body.setDelta === "number" && Number.isFinite(body.setDelta) &&
        Number.isInteger(body.setDelta)
      ) {
        if (body.setDelta === 0) {
          return Response.json({ error: "'setDelta' must be non-zero" }, {
            status: 400,
          });
        }
        const stock = await adjustCoreBadgeSet(body.setDelta);
        void logActivity({
          username: session.username,
          action: "badges.set_adjusted",
          resource: "Core Badges",
          details: `set adjusted by ${body.setDelta} across all badge types`,
        });
        return Response.json(stock);
      }

      if (
        isCoreBadgeType(body.type) && typeof body.delta === "number" &&
        Number.isFinite(body.delta) && Number.isInteger(body.delta)
      ) {
        const type: CoreBadgeType = body.type;
        const delta: number = body.delta;
        const stock = await adjustCoreBadgeStock(type, delta);
        void logActivity({
          username: session.username,
          action: "badges.stock_adjusted",
          resource: "Core Badges",
          details: `${type} adjusted by ${delta}; now ${stock[type]}`,
        });
        return Response.json(stock);
      }

      return Response.json({
        error:
          "Provide { type: CoreBadgeType, delta: integer } or { setDelta: integer }",
      }, { status: 400 });
    } catch (_e) {
      return Response.json({ error: "Failed to update badge stock" }, {
        status: 500,
      });
    }
  },
};
