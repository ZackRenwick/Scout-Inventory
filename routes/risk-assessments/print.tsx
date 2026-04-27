import { Handlers, PageProps } from "$fresh/server.ts";
import type { Session } from "../../lib/auth.ts";
import { getAllRiskAssessments } from "../../db/kv.ts";
import type { RiskAssessment } from "../../types/risk.ts";

interface RiskAssessmentPrintData {
  assessments: RiskAssessment[];
  session?: Session;
}

export const handler: Handlers<RiskAssessmentPrintData> = {
  async GET(req, ctx) {
    const session = ctx.state.session as Session;
    const url = new URL(req.url);
    const assessmentId = url.searchParams.get("assessment")?.trim();
    const all = await getAllRiskAssessments();
    const assessments = assessmentId
      ? all.filter((assessment) => assessment.id === assessmentId)
      : all;

    return ctx.render({ assessments, session });
  },
};

function formatDate(date: Date | null | undefined): string {
  if (!date) return "Never";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RiskAssessmentPrintPage(
  { data }: PageProps<RiskAssessmentPrintData>,
) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Risk Assessments Export</title>
        <style>
          {` 
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; }
          .page { max-width: 1200px; margin: 0 auto; padding: 16px; }
          .toolbar { margin-bottom: 12px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
          .btn { background: #7c3aed; color: #fff; border: 1px solid #6d28d9; border-radius: 6px; padding: 8px 12px; cursor: pointer; text-decoration: none; }
          .sheet { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px; margin-bottom: 16px; page-break-inside: avoid; }
          .meta { color: #4b5563; font-size: 12px; margin-top: 4px; margin-bottom: 10px; }
          /* Desktop table view */
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; }
          .risk-level { text-align: center; width: 140px; }
          /* Mobile card view */
          .risk-cards { display: none; }
          .risk-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
          .risk-card dt { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; margin-top: 8px; }
          .risk-card dt:first-child { margin-top: 0; }
          .risk-card dd { margin: 2px 0 0; font-size: 13px; }
          .risk-card .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
          .risk-card .badge-low { background: #dcfce7; color: #166534; }
          .risk-card .badge-medium { background: #fef9c3; color: #854d0e; }
          .risk-card .badge-high { background: #fee2e2; color: #991b1b; }
          @media screen and (max-width: 768px) {
            table { display: none; }
            .risk-cards { display: block; }
          }
          @page { size: A4 landscape; margin: 10mm; }
          @media print {
            .toolbar { display: none; }
            .risk-cards { display: none; }
            table { display: table; }
            .page { max-width: none; padding: 0; }
            .sheet { border: none; border-radius: 0; padding: 0; margin: 0 0 8mm; }
            .sheet + .sheet { page-break-before: always; }
          }
        `}
        </style>
      </head>
      <body>
        <div class="page">
          <div class="toolbar">
            <a class="btn" href="javascript:window.print()">
              Print / Save as PDF
            </a>
            <a
              href="/risk-assessments"
              style="font-size: 13px; color: #374151;"
            >
              Back to Risk Assessments
            </a>
          </div>

          {data.assessments.length === 0
            ? <p>No risk assessment selected for export.</p>
            : data.assessments.map((assessment) => (
              <section class="sheet" key={assessment.id}>
                <h2>{assessment.name}</h2>
                <p class="meta">
                  Last inline review: {formatDate(assessment.lastReviewedAt)}
                  {" "}
                  | Last annual check:{" "}
                  {formatDate(assessment.lastAnnualCheckAt)} | Last checked by:
                  {" "}
                  {assessment.lastAnnualCheckedBy ?? "Not recorded"}
                </p>

                <table>
                  <thead>
                    <tr>
                      <th>Hazards</th>
                      <th>What risks do they pose?</th>
                      <th>Who is affected?</th>
                      <th class="risk-level">Risk Level</th>
                      <th>Precautions Taken</th>
                      <th>
                        What has changed that needs to be thought about and
                        controlled?
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.risks.map((risk) => (
                      <tr key={risk.id}>
                        <td>{risk.hazards}</td>
                        <td>{risk.posedRisks}</td>
                        <td>{risk.affectedWho}</td>
                        <td class="risk-level">{risk.initialRiskLevel}</td>
                        <td>{risk.precautionsTaken}</td>
                        <td>{risk.furtherActionNeeded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div class="risk-cards">
                  {assessment.risks.map((risk) => (
                    <div class="risk-card" key={risk.id}>
                      <dl>
                        <dt>Hazards</dt>
                        <dd>{risk.hazards}</dd>
                        <dt>What risks do they pose?</dt>
                        <dd>{risk.posedRisks}</dd>
                        <dt>Who is affected?</dt>
                        <dd>{risk.affectedWho}</dd>
                        <dt>Risk Level</dt>
                        <dd>
                          <span
                            class={`badge badge-${risk.initialRiskLevel.toLowerCase()}`}
                          >
                            {risk.initialRiskLevel}
                          </span>
                        </dd>
                        <dt>Precautions Taken</dt>
                        <dd>{risk.precautionsTaken}</dd>
                        <dt>
                          What has changed that needs to be thought about and
                          controlled?
                        </dt>
                        <dd>{risk.furtherActionNeeded || "—"}</dd>
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      </body>
    </html>
  );
}
