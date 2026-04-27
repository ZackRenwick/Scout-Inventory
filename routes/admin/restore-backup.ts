// POST /admin/restore-backup — replace app data from an inventory backup JSON file
import type { Handlers } from "$fresh/server.ts";
import type { Session } from "../../lib/auth.ts";
import { csrfFailed, csrfOk, forbidden } from "../../lib/auth.ts";
import { replaceAllFromInventoryBackup } from "../../db/kv.ts";
import {
  createInventoryBackup,
  parseInventoryBackupPayload,
} from "../../lib/inventoryBackups.ts";
import { logActivity } from "../../lib/activityLog.ts";

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") {
      return forbidden();
    }
    if (!csrfOk(req, session)) {
      return csrfFailed();
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ ok: false, message: "Invalid form data." }, {
        status: 400,
      });
    }

    const file = formData.get("backupFile");
    if (!(file instanceof File)) {
      return Response.json({
        ok: false,
        message: "Choose a backup JSON file to restore.",
      }, { status: 400 });
    }
    if (file.size > MAX_BACKUP_BYTES) {
      return Response.json({
        ok: false,
        message: "Backup file is too large. Maximum size is 25 MB.",
      }, { status: 413 });
    }

    const parsed = parseInventoryBackupPayload(await file.text());
    if (!parsed.snapshot) {
      return Response.json({
        ok: false,
        message: parsed.error ?? "Backup file could not be parsed.",
      }, { status: 400 });
    }

    try {
      const safetyBackup = await createInventoryBackup("manual");
      await replaceAllFromInventoryBackup(parsed.snapshot);
      await logActivity({
        username: session.username,
        action: "inventory.backup_restored",
        resource: file.name,
        details:
          `restored ${parsed.snapshot.items.length} items · ${parsed.snapshot.photoRecords.length} photo records; pre-restore safety snapshot=${safetyBackup.objectKey}`,
      });
      return Response.json({
        ok: true,
        message:
          `Backup restored successfully from ${file.name}. Safety snapshot: ${safetyBackup.objectKey}`,
        itemCount: parsed.snapshot.items.length,
        photoCount: parsed.snapshot.photoRecords.length,
        safetyBackup: safetyBackup.objectKey,
      });
    } catch (err) {
      console.error("[admin/restore-backup] Error:", err);
      return Response.json(
        { ok: false, message: "Restore failed. See server logs for details." },
        { status: 500 },
      );
    }
  },
};
