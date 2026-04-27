// POST /admin/backup — manually trigger an inventory backup into R2
import type { Handlers } from "$fresh/server.ts";
import type { Session } from "../../lib/auth.ts";
import { csrfFailed, csrfOk, forbidden } from "../../lib/auth.ts";
import { logActivity } from "../../lib/activityLog.ts";
import { createInventoryBackup } from "../../lib/inventoryBackups.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    try {
      const result = await createInventoryBackup("manual");
      await logActivity({
        username: session.username,
        action: "inventory.backup_exported",
        resource: result.objectKey,
        details:
          `manual backup · ${result.itemCount} items · ${result.byteLength} bytes`,
      });
      return Response.json({
        ok: true,
        message: `Backup created: ${result.objectKey}`,
        objectKey: result.objectKey,
        createdAt: result.createdAt,
        itemCount: result.itemCount,
        byteLength: result.byteLength,
        source: result.source,
      });
    } catch (err) {
      console.error("[admin/backup] Error:", err);
      return Response.json(
        { ok: false, message: "Backup failed. See server logs for details." },
        { status: 500 },
      );
    }
  },
};
