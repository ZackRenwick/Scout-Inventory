import { Handlers, PageProps } from "$fresh/server.ts";
import Layout from "../../../components/Layout.tsx";
import RiskAssessmentForm from "../../../islands/RiskAssessmentForm.tsx";
import type { Session } from "../../../lib/auth.ts";
import {
  getRiskAssessmentById,
  markRiskAssessmentReviewed,
  recordRiskAssessmentAnnualCheck,
  updateRiskAssessment,
} from "../../../db/kv.ts";
import { logActivity } from "../../../lib/activityLog.ts";
import type { RiskAssessmentRisk, RiskLevel } from "../../../types/risk.ts";

interface EditRiskAssessmentPageData {
  assessment: Awaited<ReturnType<typeof getRiskAssessmentById>>;
  session?: Session;
  error?: string;
  annualMode?: boolean;
  inlineMode?: boolean;
}

type CheckMode = "none" | "annual" | "inline";

function getCheckModeFromUrl(url: URL): CheckMode {
  if (url.searchParams.get("annual") === "1") return "annual";
  if (url.searchParams.get("inline") === "1") return "inline";
  return "none";
}

function getCheckModeFromForm(form: FormData): CheckMode {
  if (form.get("annual_check_mode")?.toString() === "yes") return "annual";
  if (form.get("inline_check_mode")?.toString() === "yes") return "inline";
  return "none";
}

const VALID_LEVELS = new Set<RiskLevel>(["Low", "Medium", "High"]);

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

async function renderPage(
  ctx: {
    render: (data: EditRiskAssessmentPageData) => Response | Promise<Response>;
  },
  session: Session,
  assessmentId: string,
  checkMode: CheckMode,
  error?: string,
) {
  const assessment = await getRiskAssessmentById(assessmentId);
  if (!assessment) {
    return ctx.render({
      assessment: null,
      session,
      error: "Assessment not found.",
      annualMode: checkMode === "annual",
      inlineMode: checkMode === "inline",
    });
  }
  return ctx.render({
    assessment,
    session,
    error,
    annualMode: checkMode === "annual",
    inlineMode: checkMode === "inline",
  });
}

export const handler: Handlers<EditRiskAssessmentPageData> = {
  async GET(req, ctx) {
    const session = ctx.state.session as Session;
    if (session.role === "explorer") {
      return new Response("Forbidden", { status: 403 });
    }
    const assessmentId = ctx.params.id;
    const url = new URL(req.url);
    const checkMode = getCheckModeFromUrl(url);
    return await renderPage(ctx, session, assessmentId, checkMode);
  },

  async POST(req, ctx) {
    const session = ctx.state.session as Session;
    if (!session) return new Response("Forbidden", { status: 403 });
    if (session.role === "viewer" || session.role === "explorer") {
      return new Response("Forbidden", { status: 403 });
    }

    const assessmentId = ctx.params.id;
    const form = await req.formData();
    const csrfFromForm = form.get("_csrf")?.toString();
    if (csrfFromForm !== session.csrfToken) {
      return new Response("Invalid CSRF token", { status: 403 });
    }

    const action = form.get("action")?.toString();
    if (action !== "update_assessment") {
      return new Response(null, {
        status: 303,
        headers: { Location: `/risk-assessments/${assessmentId}/edit` },
      });
    }

    const checkMode = getCheckModeFromForm(form);

    const existing = await getRiskAssessmentById(assessmentId);
    if (!existing) {
      return new Response(null, {
        status: 303,
        headers: { Location: "/risk-assessments" },
      });
    }

    const name = form.get("name")?.toString().trim() ?? "";
    const riskRows = parseRiskRows(form.get("riskRows")?.toString() ?? "[]");

    if (!name) {
      return await renderPage(
        ctx,
        session,
        assessmentId,
        checkMode,
        "Assessment name is required.",
      );
    }
    if (name.length > 120) {
      return await renderPage(
        ctx,
        session,
        assessmentId,
        checkMode,
        "Assessment name must be 120 characters or fewer.",
      );
    }
    if (riskRows.length === 0) {
      return await renderPage(
        ctx,
        session,
        assessmentId,
        checkMode,
        "Add at least one risk row before saving.",
      );
    }

    if (checkMode !== "none" && form.get("check_confirmed")?.toString() !== "yes") {
      return await renderPage(
        ctx,
        session,
        assessmentId,
        checkMode,
        checkMode === "annual"
          ? "Please confirm the annual check affirmation before recording completion."
          : "Please confirm the ad hoc check affirmation before recording completion.",
      );
    }

    await updateRiskAssessment(assessmentId, {
      name,
      risks: riskRows,
    }, existing);

    await logActivity({
      username: session.username,
      action: "risk_assessment.updated",
      resource: name,
      resourceId: assessmentId,
      details: `Updated with ${riskRows.length} risk row${riskRows.length === 1 ? "" : "s"}`,
    });

    if (checkMode === "annual") {
      await recordRiskAssessmentAnnualCheck(assessmentId, session.username);
      await logActivity({
        username: session.username,
        action: "risk_assessment.annual_check_completed",
        resource: name,
        resourceId: assessmentId,
      });
    }

    if (checkMode === "inline") {
      await markRiskAssessmentReviewed(assessmentId);
      await logActivity({
        username: session.username,
        action: "risk_assessment.reviewed",
        resource: name,
        resourceId: assessmentId,
        details: "Ad hoc check completed through edit check flow",
      });
    }

    return new Response(null, {
      status: 303,
      headers: {
        Location: checkMode === "annual"
          ? "/risk-assessments?flash=annual_check_saved"
          : checkMode === "inline"
          ? "/risk-assessments?flash=inline_check_saved"
          : "/risk-assessments",
      },
    });
  },
};

export default function EditRiskAssessmentPage(
  { data }: PageProps<EditRiskAssessmentPageData>,
) {
  if (!data.assessment) {
    return (
      <Layout
        title="Risk Assessment Not Found"
        username={data.session?.username}
        role={data.session?.role}
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <p class="text-red-700 dark:text-red-300">Assessment not found.</p>
          <a
            href="/risk-assessments"
            class="mt-3 inline-block text-purple-600 dark:text-purple-400 hover:underline"
          >
            Back to Risk Assessments
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={`Edit: ${data.assessment.name}`}
      username={data.session?.username}
      role={data.session?.role}
    >
      <div class="mb-5">
        <a
          href="/risk-assessments"
          class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          ← Back to Risk Assessments
        </a>
      </div>

      {data.annualMode && (
        <div class="mb-5 p-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 text-sm">
          Review and make any necessary changes, then confirm completion to
          record the annual check.
        </div>
      )}

      {data.inlineMode && (
        <div class="mb-5 p-3 rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 text-sm">
          Review and make any necessary changes, then confirm completion to
          record the ad hoc check.
        </div>
      )}

      {data.error && (
        <div class="mb-5 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {data.error}
        </div>
      )}

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">
          Edit Assessment
        </h3>
        <RiskAssessmentForm
          csrfToken={data.session?.csrfToken ?? ""}
          actionValue="update_assessment"
          submitLabel={data.annualMode
            ? "Save Changes and Complete Annual Check"
            : data.inlineMode
            ? "Save Changes and Complete Ad Hoc Check"
            : "Save Changes"}
          assessmentId={data.assessment.id}
          initialName={data.assessment.name}
          initialRisks={data.assessment.risks}
          annualCheckMode={Boolean(data.annualMode)}
          inlineCheckMode={Boolean(data.inlineMode)}
        />
      </div>
    </Layout>
  );
}
