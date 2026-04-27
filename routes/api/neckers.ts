// API route for necker count management
// GET  /api/neckers          → { count: number, inStock: number, created: number, totalMade: number }
// POST /api/neckers          →
//   {
//     delta?: number; value?: number; made?: number; moveToStock?: number;
//     adultMade?: number; adultDelivered?: number;
//     setTotalMade?: number; setAdultTotalMade?: number;
//     resetCreated?: boolean; resetAdultCreated?: boolean
//   }
//   → { count: number, inStock: number, created: number, totalMade: number, adultCreated: number, adultTotalMade: number }
import { Handlers } from "$fresh/server.ts";
import {
  adjustNeckerCount,
  deliverAdultNeckers,
  getNeckerMetrics,
  moveCreatedToStock,
  recordAdultNeckersMade,
  recordNeckersMade,
  resetAdultNeckersCreated,
  resetNeckersCreated,
  setAdultNeckersTotalMade,
  setNeckerCount,
  setNeckersTotalMade,
} from "../../db/kv.ts";
import { csrfFailed, csrfOk, forbidden, type Session } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";

export const handler: Handlers = {
  async GET() {
    try {
      const metrics = await getNeckerMetrics();
      return Response.json({
        count: metrics.inStock,
        ...metrics,
      });
    } catch (_e) {
      return Response.json({ error: "Failed to fetch necker count" }, {
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
      const isManagerOrAdmin = session.role === "admin" ||
        session.role === "manager";
      const requestedDelta =
        typeof body.delta === "number" && Number.isFinite(body.delta) &&
          Number.isInteger(body.delta)
          ? body.delta
          : null;

      // Editors can only add stock from the dashboard (+delta). All other necker actions are manager/admin only.
      if (
        !isManagerOrAdmin && !(requestedDelta !== null && requestedDelta > 0)
      ) {
        return forbidden();
      }

      if (body.resetCreated === true) {
        const metrics = await resetNeckersCreated();
        void logActivity({
          username: session.username,
          action: "neckers.created_reset",
          resource: "Neckers",
          details:
            `created reset to ${metrics.created}; in-stock ${metrics.inStock}; total-made ${metrics.totalMade}`,
        });
        return Response.json({ count: metrics.inStock, ...metrics });
      }

      if (body.resetAdultCreated === true) {
        const metrics = await resetAdultNeckersCreated();
        void logActivity({
          username: session.username,
          action: "neckers.created_reset",
          resource: "Adult Neckers",
          details:
            `adult-created reset to ${metrics.adultCreated}; adult-total-made ${metrics.adultTotalMade}`,
        });
        return Response.json({ count: metrics.inStock, ...metrics });
      }

      if (
        typeof body.made === "number" && Number.isFinite(body.made) &&
        Number.isInteger(body.made)
      ) {
        if (body.made <= 0) {
          return Response.json({ error: "'made' must be a positive integer" }, {
            status: 400,
          });
        }
        const metrics = await recordNeckersMade(body.made);
        void logActivity({
          username: session.username,
          action: "neckers.made",
          resource: "Neckers",
          details:
            `made +${body.made}; created ${metrics.created}; total-made ${metrics.totalMade}; in-stock ${metrics.inStock}`,
        });
        return Response.json({ count: metrics.inStock, ...metrics });
      }

      if (
        typeof body.adultMade === "number" && Number.isFinite(body.adultMade) &&
        Number.isInteger(body.adultMade)
      ) {
        if (body.adultMade <= 0) {
          return Response.json({
            error: "'adultMade' must be a positive integer",
          }, { status: 400 });
        }
        const metrics = await recordAdultNeckersMade(body.adultMade);
        void logActivity({
          username: session.username,
          action: "neckers.made",
          resource: "Adult Neckers",
          details:
            `adult made +${body.adultMade}; adult-created ${metrics.adultCreated}; adult-total-made ${metrics.adultTotalMade}`,
        });
        return Response.json({ count: metrics.inStock, ...metrics });
      }

      if (
        typeof body.adultDelivered === "number" &&
        Number.isFinite(body.adultDelivered) &&
        Number.isInteger(body.adultDelivered)
      ) {
        if (body.adultDelivered <= 0) {
          return Response.json({
            error: "'adultDelivered' must be a positive integer",
          }, { status: 400 });
        }
        const { metrics, delivered } = await deliverAdultNeckers(
          body.adultDelivered,
        );
        if (delivered <= 0) {
          return Response.json({
            error: "No adult neckers currently marked as created",
          }, { status: 400 });
        }
        void logActivity({
          username: session.username,
          action: "neckers.created_reset",
          resource: "Adult Neckers",
          details:
            `adult delivered ${delivered}; adult-created ${metrics.adultCreated}; adult-total-made ${metrics.adultTotalMade}`,
        });
        return Response.json({ count: metrics.inStock, delivered, ...metrics });
      }

      if (
        typeof body.moveToStock === "number" &&
        Number.isFinite(body.moveToStock) &&
        Number.isInteger(body.moveToStock)
      ) {
        if (body.moveToStock <= 0) {
          return Response.json({
            error: "'moveToStock' must be a positive integer",
          }, { status: 400 });
        }
        const { metrics, moved } = await moveCreatedToStock(body.moveToStock);
        if (moved <= 0) {
          return Response.json({
            error: "No created neckers available to move into stock",
          }, { status: 400 });
        }
        void logActivity({
          username: session.username,
          action: "neckers.stock_adjusted",
          resource: "Neckers",
          details:
            `moved ${moved} from created to stock; created ${metrics.created}; in-stock ${metrics.inStock}`,
        });
        return Response.json({ count: metrics.inStock, moved, ...metrics });
      }

      if (
        typeof body.setTotalMade === "number" &&
        Number.isFinite(body.setTotalMade) &&
        Number.isInteger(body.setTotalMade)
      ) {
        if (body.setTotalMade < 0) {
          return Response.json({
            error: "'setTotalMade' must be a non-negative integer",
          }, { status: 400 });
        }
        const metrics = await setNeckersTotalMade(body.setTotalMade);
        void logActivity({
          username: session.username,
          action: "neckers.total_set",
          resource: "Neckers",
          details:
            `total-made set to ${metrics.totalMade}; in-stock ${metrics.inStock}; created ${metrics.created}`,
        });
        return Response.json({ count: metrics.inStock, ...metrics });
      }

      if (
        typeof body.setAdultTotalMade === "number" &&
        Number.isFinite(body.setAdultTotalMade) &&
        Number.isInteger(body.setAdultTotalMade)
      ) {
        if (body.setAdultTotalMade < 0) {
          return Response.json({
            error: "'setAdultTotalMade' must be a non-negative integer",
          }, { status: 400 });
        }
        const metrics = await setAdultNeckersTotalMade(body.setAdultTotalMade);
        void logActivity({
          username: session.username,
          action: "neckers.total_set",
          resource: "Adult Neckers",
          details:
            `adult-total-made set to ${metrics.adultTotalMade}; adult-created ${metrics.adultCreated}`,
        });
        return Response.json({ count: metrics.inStock, ...metrics });
      }

      const requestedValue =
        typeof body.value === "number" && Number.isFinite(body.value) &&
          Number.isInteger(body.value)
          ? body.value
          : null;

      if (
        typeof body.value === "number" && Number.isFinite(body.value) &&
        Number.isInteger(body.value)
      ) {
        await setNeckerCount(body.value);
      } else if (
        typeof body.delta === "number" && Number.isFinite(body.delta) &&
        Number.isInteger(body.delta)
      ) {
        await adjustNeckerCount(body.delta);
      } else {
        return Response.json({
          error:
            "Provide integer 'delta', 'value', positive 'made', positive 'moveToStock', positive 'adultMade', positive 'adultDelivered', integer 'setTotalMade', integer 'setAdultTotalMade', 'resetCreated', or 'resetAdultCreated'",
        }, {
          status: 400,
        });
      }

      const metrics = await getNeckerMetrics();
      void logActivity({
        username: session.username,
        action: "neckers.stock_adjusted",
        resource: "Neckers",
        details: requestedValue !== null
          ? `set in-stock to ${metrics.inStock}; total-made ${metrics.totalMade}`
          : `adjust in-stock by ${
            requestedDelta ?? 0
          }; in-stock ${metrics.inStock}; total-made ${metrics.totalMade}`,
      });
      return Response.json({ count: metrics.inStock, ...metrics });
    } catch (_e) {
      return Response.json({ error: "Failed to update necker count" }, {
        status: 500,
      });
    }
  },
};
