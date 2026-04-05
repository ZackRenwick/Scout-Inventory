import { Handlers } from "$fresh/server.ts";
import { csrfFailed, csrfOk, forbidden, type Session } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";
import { recordFirstAidCheckCompletion } from "../../db/kv.ts";

interface FirstAidShortage {
  kitId: string;
  kitName: string;
  itemId: string;
  itemName: string;
  quantityTarget: number;
  countedQty: number;
}

interface FirstAidCheckPayload {
  kitCount: number;
  itemCount: number;
  skippedCount: number;
  checkScope: "overall" | "kit";
  checkedKitIds: string[];
  shortages: FirstAidShortage[];
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isValidShortage(value: unknown): value is FirstAidShortage {
  if (!value || typeof value !== "object") return false;
  const shortage = value as Record<string, unknown>;
  return (
    typeof shortage.kitId === "string" && shortage.kitId.length > 0 &&
    typeof shortage.kitName === "string" && shortage.kitName.length > 0 &&
    typeof shortage.itemId === "string" && shortage.itemId.length > 0 &&
    typeof shortage.itemName === "string" && shortage.itemName.length > 0 &&
    isNonNegativeInteger(shortage.quantityTarget) &&
    isNonNegativeInteger(shortage.countedQty) &&
    shortage.countedQty <= shortage.quantityTarget
  );
}

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session) return forbidden();
    if (session.role === "explorer") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    let body: FirstAidCheckPayload;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (
      !isNonNegativeInteger(body.kitCount) ||
      !isNonNegativeInteger(body.itemCount) ||
      !isNonNegativeInteger(body.skippedCount) ||
      (body.checkScope !== "overall" && body.checkScope !== "kit") ||
      !Array.isArray(body.checkedKitIds) ||
      !body.checkedKitIds.every((kitId) =>
        typeof kitId === "string" && kitId.trim().length > 0
      ) ||
      !Array.isArray(body.shortages)
    ) {
      return Response.json({ error: "Invalid payload." }, { status: 400 });
    }

    if (body.shortages.length > 1000) {
      return Response.json({ error: "Too many shortage entries." }, {
        status: 400,
      });
    }

    const allShortagesValid = body.shortages.every((shortage) =>
      isValidShortage(shortage)
    );
    if (!allShortagesValid) {
      return Response.json({ error: "Invalid shortage entry." }, {
        status: 400,
      });
    }

    const kitsBelowSpec =
      new Set(body.shortages.map((shortage) => shortage.kitId)).size;

    await recordFirstAidCheckCompletion(
      body.checkedKitIds,
      body.checkScope === "overall",
    );

    await logActivity({
      username: session.username,
      action: "first_aid.check_completed",
      details:
        `Checked ${body.kitCount} kit${body.kitCount === 1 ? "" : "s"}, ` +
        `${body.itemCount} item${body.itemCount === 1 ? "" : "s"}, ` +
        `${body.shortages.length} shortage${
          body.shortages.length === 1 ? "" : "s"
        }` +
        (kitsBelowSpec > 0
          ? ` across ${kitsBelowSpec} kit${kitsBelowSpec === 1 ? "" : "s"}`
          : "") +
        (body.skippedCount > 0 ? `, ${body.skippedCount} skipped` : ""),
    });

    return Response.json({ ok: true });
  },
};
