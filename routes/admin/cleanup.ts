// POST /admin/cleanup — purges orphaned KV data and old returned loans
import type { Handlers } from "$fresh/server.ts";
import { cleanUpDb } from "../../db/kv.ts";
import { cleanUpOrphanedSessions, type Session, csrfOk, csrfFailed, forbidden } from "../../lib/auth.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role !== "admin") return forbidden();
    if (!csrfOk(req, session)) return csrfFailed();

    try {
      const [report, orphanedSessions] = await Promise.all([
        cleanUpDb(),
        cleanUpOrphanedSessions(),
      ]);
      const total = report.orphanedIndexes + report.oldReturnedLoans + orphanedSessions;
      return Response.json({
        ok: true,
        ...report,
        orphanedSessions,
        message: total === 0
          ? "Nothing to clean up — database is already tidy."
          : `Removed ${total} stale record(s): ${report.orphanedIndexes} orphaned index entries, ${report.oldReturnedLoans} old loan records, ${orphanedSessions} orphaned session entries.`,
      });
    } catch (err) {
      console.error("[admin/cleanup] failed:", err);
      return Response.json({ error: "Cleanup failed." }, { status: 500 });
    }
  },
};
