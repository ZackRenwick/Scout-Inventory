import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../components/Layout.tsx";
import RiskAssessmentForm from "../../islands/RiskAssessmentForm.tsx";
import type { Session } from "../../lib/auth.ts";
import {
  createRiskAssessment,
  deleteRiskAssessment,
  dismissRiskAssessmentAnnualReminder,
  getAllRiskAssessments,
  getRiskAssessmentById,
  mergeRiskAssessmentsFromBackup,
  replaceAllRiskAssessmentsFromBackup,
} from "../../db/kv.ts";
import { logActivity } from "../../lib/activityLog.ts";
import {
  type RiskAssessment,
  type RiskAssessmentRisk,
  type RiskLevel,
} from "../../types/risk.ts";

interface RiskAssessmentsPageData {
  assessments: Awaited<ReturnType<typeof getAllRiskAssessments>>;
  annualDueCount: number;
  session?: Session;
  error?: string;
  flash?: string;
  flashType?: "success" | "error";
}

const YEARLY_CHECK_DAYS = 365;
const VALID_LEVELS = new Set<RiskLevel>(["Low", "Medium", "High"]);

function isDismissed(dismissedUntil: Date | null | undefined): boolean {
  return !!dismissedUntil && dismissedUntil.getTime() > Date.now();
}

function isYearlyDue(lastCheckedAt: Date | null | undefined): boolean {
  if (!lastCheckedAt) return true;
  const ageMs = Date.now() - lastCheckedAt.getTime();
  return ageMs >= YEARLY_CHECK_DAYS * 24 * 60 * 60 * 1000;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "Never";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAnnualDueDate(
  lastAnnualCheckAt: Date | null | undefined,
  dismissedUntil: Date | null | undefined,
): string {
  const annualDue = lastAnnualCheckAt
    ? new Date(
      lastAnnualCheckAt.getTime() + YEARLY_CHECK_DAYS * 24 * 60 * 60 * 1000,
    )
    : null;

  let dueDate: Date | null = annualDue;
  if (annualDue && dismissedUntil) {
    dueDate = annualDue.getTime() > dismissedUntil.getTime()
      ? annualDue
      : dismissedUntil;
  } else if (!annualDue && dismissedUntil) {
    dueDate = dismissedUntil;
  }

  if (!dueDate) return "Now";
  return dueDate.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseRiskRows(raw: string): RiskAssessmentRisk[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const risks: RiskAssessmentRisk[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const risk = row as Record<string, unknown>;

    const initial = String(risk.initialRiskLevel ?? "").trim() as RiskLevel;
    if (!VALID_LEVELS.has(initial)) {
      continue;
    }

    risks.push({
      id: typeof risk.id === "string" && risk.id.trim().length > 0
        ? risk.id
        : crypto.randomUUID(),
      hazards: String(risk.hazards ?? "").trim(),
      posedRisks: String(risk.posedRisks ?? "").trim(),
      affectedWho: String(risk.affectedWho ?? "").trim(),
      initialRiskLevel: initial,
      precautionsTaken: String(risk.precautionsTaken ?? "").trim(),
      furtherActionNeeded: String(risk.furtherActionNeeded ?? "").trim(),
    });
  }

  return risks;
}

function parseDateInput(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBackupPayload(
  raw: string,
  fallbackUsername: string,
): { assessments: RiskAssessment[]; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { assessments: [], error: "Backup file is not valid JSON." };
  }

  let records: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    records = parsed;
  } else if (parsed && typeof parsed === "object") {
    const container = parsed as Record<string, unknown>;
    if (Array.isArray(container.assessments)) {
      records = container.assessments;
    }
  }

  if (!records) {
    return {
      assessments: [],
      error: "Backup file must contain an assessments array.",
    };
  }

  if (records.length > 1000) {
    return {
      assessments: [],
      error: "Backup file is too large (maximum 1000 assessments).",
    };
  }

  const assessments: RiskAssessment[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (!row || typeof row !== "object") {
      return {
        assessments: [],
        error: `Invalid assessment record at row ${i + 1}.`,
      };
    }

    const obj = row as Record<string, unknown>;
    const name = String(obj.name ?? "").trim();
    if (!name) {
      return {
        assessments: [],
        error: `Assessment name is missing at row ${i + 1}.`,
      };
    }

    const rawRisks = Array.isArray(obj.risks) ? obj.risks : [];
    if (rawRisks.length === 0) {
      return {
        assessments: [],
        error: `Assessment '${name}' has no risk rows in backup.`,
      };
    }

    const parsedRisks: RiskAssessmentRisk[] = [];
    for (const riskRow of rawRisks) {
      if (!riskRow || typeof riskRow !== "object") continue;
      const risk = riskRow as Record<string, unknown>;
      const level = String(risk.initialRiskLevel ?? "").trim() as RiskLevel;
      parsedRisks.push({
        id: typeof risk.id === "string" && risk.id.trim()
          ? risk.id
          : crypto.randomUUID(),
        hazards: String(risk.hazards ?? "").trim(),
        posedRisks: String(risk.posedRisks ?? "").trim(),
        affectedWho: String(risk.affectedWho ?? "").trim(),
        initialRiskLevel: VALID_LEVELS.has(level) ? level : "Medium",
        precautionsTaken: String(risk.precautionsTaken ?? "").trim(),
        furtherActionNeeded: String(risk.furtherActionNeeded ?? "").trim(),
      });
    }

    if (parsedRisks.length === 0) {
      return {
        assessments: [],
        error: `Assessment '${name}' has no valid risk rows in backup.`,
      };
    }

    const now = new Date();
    let id = typeof obj.id === "string" && obj.id.trim()
      ? obj.id
      : crypto.randomUUID();
    if (seenIds.has(id)) {
      id = crypto.randomUUID();
    }
    seenIds.add(id);

    assessments.push({
      id,
      name,
      risks: parsedRisks,
      lastReviewedAt: parseDateInput(obj.lastReviewedAt),
      lastAnnualCheckAt: parseDateInput(obj.lastAnnualCheckAt),
      lastAnnualCheckedBy:
        typeof obj.lastAnnualCheckedBy === "string" && obj.lastAnnualCheckedBy.trim()
          ? obj.lastAnnualCheckedBy.trim()
          : null,
      annualReminderDismissedUntil: parseDateInput(obj.annualReminderDismissedUntil),
      createdBy: typeof obj.createdBy === "string" && obj.createdBy.trim()
        ? obj.createdBy.trim()
        : fallbackUsername,
      createdAt: parseDateInput(obj.createdAt) ?? now,
      lastUpdated: parseDateInput(obj.lastUpdated) ?? now,
    });
  }

  return { assessments };
}

async function buildPageData(
  session: Session,
  error?: string,
  flash?: string,
  flashType?: "success" | "error",
): Promise<RiskAssessmentsPageData> {
  const assessments = await getAllRiskAssessments();
  const annualDueCount = assessments.filter((assessment) =>
    isYearlyDue(assessment.lastAnnualCheckAt) &&
    !isDismissed(assessment.annualReminderDismissedUntil)
  ).length;

  return {
    assessments,
    annualDueCount,
    session,
    error,
    flash,
    flashType,
  };
}

function flashFromCode(
  code: string | null,
): { message: string; type: "success" | "error" } | null {
  if (code === "annual_check_saved") {
    return { message: "Annual check recorded successfully.", type: "success" };
  }
  if (code === "inline_check_saved") {
    return { message: "Ad hoc check recorded successfully.", type: "success" };
  }
  if (code === "backup_restored") {
    return {
      message: "Risk assessment backup restored successfully.",
      type: "success",
    };
  }
  if (code === "backup_merged") {
    return {
      message: "Risk assessment backup merged successfully.",
      type: "success",
    };
  }
  return null;
}

export const handler: Handlers<RiskAssessmentsPageData> = {
  async GET(req, ctx) {
    const session = ctx.state.session as Session;
    const url = new URL(req.url);
    const flash = flashFromCode(url.searchParams.get("flash"));

    return ctx.render(
      await buildPageData(session, undefined, flash?.message, flash?.type),
    );
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (!session) return new Response("Forbidden", { status: 403 });

    const form = await req.formData();
    const csrfFromForm = form.get("_csrf")?.toString();
    if (csrfFromForm !== session.csrfToken) {
      return new Response("Invalid CSRF token", { status: 403 });
    }

    const action = form.get("action")?.toString();

    if (action === "export_backup") {
      if (!(session.role === "admin" || session.role === "manager")) {
        return new Response("Forbidden", { status: 403 });
      }
      const assessments = await getAllRiskAssessments();
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        app: "scout-inventory",
        assessments,
      };
      await logActivity({
        username: session.username,
        action: "risk_assessment.backup_exported",
        details: `Exported ${assessments.length} risk assessment backup record${assessments.length === 1 ? "" : "s"}`,
      });

      const filename = `risk-assessments-backup-${new Date().toISOString().slice(0, 10)}.json`;
      return new Response(JSON.stringify(payload, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (session.role === "viewer") {
      return new Response("Forbidden", { status: 403 });
    }

    if (action === "create_assessment") {
      const name = form.get("name")?.toString().trim() ?? "";
      const riskRows = parseRiskRows(form.get("riskRows")?.toString() ?? "[]");

      if (!name) {
        return ctx.render(
          await buildPageData(session, "Assessment name is required."),
        );
      }
      if (name.length > 120) {
        return ctx.render(
          await buildPageData(
            session,
            "Assessment name must be 120 characters or fewer.",
          ),
        );
      }
      if (riskRows.length === 0) {
        return ctx.render(
          await buildPageData(
            session,
            "Add at least one risk row before saving.",
          ),
        );
      }

      const created = await createRiskAssessment(name, riskRows, session.username);
      await logActivity({
        username: session.username,
        action: "risk_assessment.created",
        resource: created.name,
        resourceId: created.id,
        details: `Created with ${created.risks.length} risk row${created.risks.length === 1 ? "" : "s"}`,
      });

      return new Response(null, {
        status: 303,
        headers: { Location: "/risk-assessments" },
      });
    }

    if (action === "delete_assessment") {
      const assessmentId = form.get("assessmentId")?.toString() ?? "";
      const existing = await getRiskAssessmentById(assessmentId);
      if (existing) {
        await deleteRiskAssessment(assessmentId);
        await logActivity({
          username: session.username,
          action: "risk_assessment.deleted",
          resource: existing.name,
          resourceId: existing.id,
        });
      }
      return new Response(null, {
        status: 303,
        headers: { Location: "/risk-assessments" },
      });
    }

    if (action === "duplicate_assessment") {
      const assessmentId = form.get("assessmentId")?.toString() ?? "";
      const existing = await getRiskAssessmentById(assessmentId);
      if (existing) {
        const duplicateName = `${existing.name} (Copy)`;
        const duplicated = await createRiskAssessment(
          duplicateName,
          existing.risks.map((risk) => ({ ...risk, id: crypto.randomUUID() })),
          session.username,
        );
        await logActivity({
          username: session.username,
          action: "risk_assessment.created",
          resource: duplicated.name,
          resourceId: duplicated.id,
          details: `Duplicated from ${existing.name}`,
        });
      }
      return new Response(null, {
        status: 303,
        headers: { Location: "/risk-assessments" },
      });
    }

    if (action === "dismiss_annual_reminder") {
      const assessmentId = form.get("assessmentId")?.toString() ?? "";
      if (assessmentId) {
        await dismissRiskAssessmentAnnualReminder(assessmentId);
      }
      return new Response(null, {
        status: 303,
        headers: { Location: "/risk-assessments" },
      });
    }

    if (action === "restore_backup") {
      if (!(session.role === "admin" || session.role === "manager")) {
        return new Response("Forbidden", { status: 403 });
      }

      const restoreMode = form.get("restoreMode")?.toString() === "merge"
        ? "merge"
        : "replace";

      const backupFile = form.get("backupFile");
      if (!(backupFile instanceof File)) {
        return ctx.render(
          await buildPageData(session, "Please choose a backup JSON file to restore."),
        );
      }

      const parsed = parseBackupPayload(await backupFile.text(), session.username);
      if (parsed.error) {
        return ctx.render(await buildPageData(session, parsed.error));
      }

      if (restoreMode === "merge") {
        const merged = await mergeRiskAssessmentsFromBackup(parsed.assessments);
        await logActivity({
          username: session.username,
          action: "risk_assessment.backup_restored",
          details: `Merged backup: ${merged.total} total (${merged.created} created, ${merged.updated} updated)`,
        });

        return new Response(null, {
          status: 303,
          headers: { Location: "/risk-assessments?flash=backup_merged" },
        });
      }

      const restored = await replaceAllRiskAssessmentsFromBackup(
        parsed.assessments,
      );
      await logActivity({
        username: session.username,
        action: "risk_assessment.backup_restored",
        details: `Replaced with ${restored} risk assessment${restored === 1 ? "" : "s"} from backup`,
      });

      return new Response(null, {
        status: 303,
        headers: { Location: "/risk-assessments?flash=backup_restored" },
      });
    }

    return new Response(null, {
      status: 303,
      headers: { Location: "/risk-assessments" },
    });
  },
};

export default function RiskAssessmentsPage(
  { data }: PageProps<RiskAssessmentsPageData>,
) {
  const canEdit = data.session?.role !== "viewer";
  const canManageBackups =
    data.session?.role === "admin" || data.session?.role === "manager";

  return (
    <Layout
      title="Risk Assessments"
      username={data.session?.username}
      role={data.session?.role}
    >
      <div class="mb-6">
        <p class="text-gray-600 dark:text-gray-400">
          Manage activities and hazards with ad hoc checks plus a separate
          annual review reminder cycle.
        </p>
        <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
          Annual checks due now: <strong>{data.annualDueCount}</strong>
        </p>
      </div>

      {data.error && (
        <div class="mb-5 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {data.error}
        </div>
      )}

      {data.flash && (
        <div
          class={`mb-5 p-3 rounded-md text-sm ${
            data.flashType === "error"
              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
          }`}
        >
          {data.flash}
        </div>
      )}

      {canManageBackups && (
        <div class="mb-6 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Backup and Restore
          </h3>
          <p class="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3">
            Download a JSON backup of all risk assessments and restore it later if needed.
          </p>
          <div class="grid gap-3 xl:grid-cols-2">
            <form
              method="post"
              class="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 space-y-2"
            >
              <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
              <input type="hidden" name="action" value="export_backup" />
              <p class="text-xs font-medium text-gray-700 dark:text-gray-300">
                Create backup
              </p>
              <button
                type="submit"
                class="w-full px-4 py-2 text-sm font-semibold rounded-md bg-blue-700 text-white hover:bg-blue-800"
              >
                Download Backup JSON
              </button>
            </form>

            <form
              method="post"
              encType="multipart/form-data"
              class="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 space-y-3"
            >
              <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
              <input type="hidden" name="action" value="restore_backup" />
              <p class="text-xs font-medium text-gray-700 dark:text-gray-300">
                Restore backup
              </p>
              <div class="max-w-3xl space-y-2">
                <input
                  type="file"
                  name="backupFile"
                  accept=".json,application/json"
                  required
                  class="w-full text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-gray-300 dark:file:border-gray-500 file:bg-gray-100 dark:file:bg-gray-800 file:text-gray-900 dark:file:text-gray-100"
                />
                <select
                  name="restoreMode"
                  class="w-full sm:max-w-xs px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="replace">Replace Existing</option>
                  <option value="merge">Merge Into Existing</option>
                </select>
              </div>
              <div class="flex justify-start">
                <button
                  type="submit"
                  class="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700"
                >
                  Restore Backup
                </button>
              </div>
              <p class="mt-2 text-xs text-amber-800 dark:text-amber-200">
                Replace clears current records first. Merge keeps existing items and
                updates or adds from backup.
              </p>
            </form>
          </div>
        </div>
      )}

      {canEdit && (
        <details
          class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700"
          open={Boolean(data.error)}
        >
          <summary class="px-5 sm:px-6 py-4 cursor-pointer text-base font-semibold text-gray-900 dark:text-white select-none">
            Add New Assessment
          </summary>
          <div class="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <RiskAssessmentForm
              csrfToken={data.session?.csrfToken ?? ""}
              actionValue="create_assessment"
              submitLabel="Create Assessment"
            />
          </div>
        </details>
      )}

      {data.assessments.length === 0
        ? (
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-400">
            No risk assessments yet. Create one above.
          </div>
        )
        : (
          <div class="space-y-4">
            {data.assessments.map((assessment) => {
              const annualDue = isYearlyDue(assessment.lastAnnualCheckAt) &&
                !isDismissed(assessment.annualReminderDismissedUntil);

              return (
                <details
                  key={assessment.id}
                  class="group bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700"
                >
                  <summary class="list-none p-4 sm:p-5 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-start gap-3 min-w-0">
                        <span class="mt-1 inline-block text-gray-500 dark:text-gray-400 transition-transform group-open:rotate-90">
                          ▸
                        </span>
                      <div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {assessment.name}
                        </h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {assessment.risks.length} risk row{assessment.risks.length === 1 ? "" : "s"}
                        </p>
                        <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          Last ad hoc check: <strong>{formatDate(assessment.lastReviewedAt)}</strong>
                        </p>
                        <p class="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                          Next annual due: <strong>{formatAnnualDueDate(assessment.lastAnnualCheckAt, assessment.annualReminderDismissedUntil)}</strong>
                        </p>
                        {annualDue && (
                          <p class="mt-2 inline-flex rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                            Annual reminder due
                          </p>
                        )}
                      </div>
                      </div>
                      <p class="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">
                        <span class="group-open:hidden">Expand</span>
                        <span class="hidden group-open:inline">Collapse</span>
                      </p>
                    </div>
                  </summary>

                  <div class="border-t border-gray-200 dark:border-gray-700">
                    <div class="p-4 sm:p-5">
                      <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p class="text-sm text-gray-600 dark:text-gray-300">
                            Last annual check: <strong>{formatDate(assessment.lastAnnualCheckAt)}</strong>
                          </p>
                          <p class="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                            Last checked by: <strong>{assessment.lastAnnualCheckedBy ?? "Not recorded"}</strong>
                          </p>
                        </div>

                        <div class="flex gap-2 flex-wrap">
                          {canEdit && (
                            <>
                              <a
                                href={`/risk-assessments/${assessment.id}/edit?inline=1`}
                                class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              >
                                Run Ad Hoc Check
                              </a>
                              <a
                                href={`/risk-assessments/${assessment.id}/edit?annual=1`}
                                class="px-3 py-1.5 text-sm bg-green-700 text-white rounded-md hover:bg-green-800"
                              >
                                Run Annual Check
                              </a>
                              {annualDue && (
                                <form method="post">
                                  <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                                  <input type="hidden" name="action" value="dismiss_annual_reminder" />
                                  <input type="hidden" name="assessmentId" value={assessment.id} />
                                  <button
                                    type="submit"
                                    class="px-3 py-1.5 text-sm border border-amber-400 dark:border-amber-600 rounded-md text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                                  >
                                    Dismiss Reminder
                                  </button>
                                </form>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {annualDue && (
                        <p class="mt-3 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-md px-3 py-2">
                          Annual reminder due for this assessment.
                        </p>
                      )}

                      {canEdit && (
                        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 flex-wrap">
                          <a
                            href={`/risk-assessments/${assessment.id}/edit`}
                            class="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Edit
                          </a>
                          <form method="post">
                            <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                            <input type="hidden" name="action" value="duplicate_assessment" />
                            <input type="hidden" name="assessmentId" value={assessment.id} />
                            <button
                              type="submit"
                              class="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              Duplicate
                            </button>
                          </form>
                          <form method="post">
                            <input type="hidden" name="_csrf" value={data.session?.csrfToken ?? ""} />
                            <input type="hidden" name="action" value="delete_assessment" />
                            <input type="hidden" name="assessmentId" value={assessment.id} />
                            <button
                              type="submit"
                              class="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                              Delete
                            </button>
                          </form>
                          <a
                            href={`/risk-assessments/print?assessment=${assessment.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Export PDF
                          </a>
                        </div>
                      )}
                    </div>

                    <div class="md:hidden p-4 space-y-3">
                      {assessment.risks.map((risk, riskIndex) => (
                        <article
                          key={`mobile-${risk.id}`}
                          class="rounded-md border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/30 space-y-3"
                        >
                          <p class="text-sm font-extrabold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                            Risk {riskIndex + 1}
                          </p>
                          <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <p class="text-base font-bold text-gray-800 dark:text-gray-100">Hazards to Health and Safety</p>
                            <p class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{risk.hazards || "-"}</p>
                          </div>
                          <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <p class="text-base font-bold text-gray-800 dark:text-gray-100">What risks do they pose?</p>
                            <p class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{risk.posedRisks || "-"}</p>
                          </div>
                          <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <p class="text-base font-bold text-gray-800 dark:text-gray-100">Who is affected?</p>
                            <p class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{risk.affectedWho || "-"}</p>
                          </div>
                          <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <p class="text-base font-bold text-gray-800 dark:text-gray-100">Risk Level</p>
                            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{risk.initialRiskLevel}</p>
                          </div>
                          <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <p class="text-base font-bold text-gray-800 dark:text-gray-100">Precautions Taken</p>
                            <p class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{risk.precautionsTaken || "-"}</p>
                          </div>
                          <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <p class="text-base font-bold text-gray-800 dark:text-gray-100">What has changed that needs to be thought about and controlled?</p>
                            <p class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{risk.furtherActionNeeded || "-"}</p>
                          </div>
                        </article>
                      ))}
                    </div>

                    <div class="hidden md:block overflow-x-auto bg-white dark:bg-gray-800">
                      <table class="min-w-full text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        <thead class="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                          <tr>
                            <th class="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-600">Hazards to Health and Safety</th>
                            <th class="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-600">What risks do they pose?</th>
                            <th class="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-600">Who is affected?</th>
                            <th class="px-3 py-2 text-center border-b border-gray-200 dark:border-gray-600">Risk Level (Low/Medium/High)</th>
                            <th class="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-600">Precautions Taken</th>
                            <th class="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-600">What has changed that needs to be thought about and controlled?</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                          {assessment.risks.map((risk) => (
                            <tr key={risk.id} class="align-top bg-white even:bg-gray-50 dark:bg-gray-800 dark:even:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700">
                              <td class="px-3 py-2 whitespace-pre-wrap text-gray-900 dark:text-gray-100">{risk.hazards}</td>
                              <td class="px-3 py-2 whitespace-pre-wrap text-gray-900 dark:text-gray-100">{risk.posedRisks}</td>
                              <td class="px-3 py-2 whitespace-pre-wrap text-gray-900 dark:text-gray-100">{risk.affectedWho}</td>
                              <td class="px-3 py-2 text-center font-semibold text-gray-900 dark:text-gray-100">{risk.initialRiskLevel}</td>
                              <td class="px-3 py-2 whitespace-pre-wrap text-gray-900 dark:text-gray-100">{risk.precautionsTaken}</td>
                              <td class="px-3 py-2 whitespace-pre-wrap text-gray-900 dark:text-gray-100">{risk.furtherActionNeeded}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
    </Layout>
  );
}
