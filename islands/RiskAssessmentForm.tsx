import { useSignal } from "@preact/signals";
import {
  type RiskAssessment,
  type RiskAssessmentRisk,
  type RiskLevel,
} from "../types/risk.ts";

interface FormRisk {
  id: string;
  hazards: string;
  posedRisks: string;
  affectedWho: string;
  initialRiskLevel: RiskLevel;
  precautionsTaken: string;
  furtherActionNeeded: string;
}

interface Props {
  csrfToken: string;
  actionValue: "create_assessment" | "update_assessment";
  submitLabel: string;
  assessmentId?: string;
  initialName?: string;
  initialRisks?: RiskAssessment["risks"];
  compact?: boolean;
  annualCheckMode?: boolean;
  inlineCheckMode?: boolean;
}

const DEFAULT_RISK: FormRisk = {
  id: "",
  hazards: "",
  posedRisks: "",
  affectedWho: "",
  initialRiskLevel: "Medium",
  precautionsTaken: "",
  furtherActionNeeded: "",
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
const areaClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-20";

function resizeTextarea(el: HTMLTextAreaElement) {
  // Reset first so scrollHeight reflects current content after deletions.
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, 80)}px`;
}

function autosizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  resizeTextarea(el);
}

function createBlankRisk(): FormRisk {
  return {
    ...DEFAULT_RISK,
    id: crypto.randomUUID(),
  };
}

function normalizeRisks(risks?: RiskAssessmentRisk[]): FormRisk[] {
  if (!risks || risks.length === 0) return [createBlankRisk()];
  return risks.map((risk) => ({
    ...risk,
    id: risk.id || crypto.randomUUID(),
  }));
}

function sanitizeForSubmission(risks: FormRisk[]): RiskAssessmentRisk[] {
  return risks.map((risk) => ({
    id: risk.id || crypto.randomUUID(),
    hazards: risk.hazards.trim(),
    posedRisks: risk.posedRisks.trim(),
    affectedWho: risk.affectedWho.trim(),
    initialRiskLevel: risk.initialRiskLevel,
    precautionsTaken: risk.precautionsTaken.trim(),
    furtherActionNeeded: risk.furtherActionNeeded.trim(),
  })).filter((risk) =>
    risk.hazards || risk.posedRisks || risk.affectedWho ||
    risk.precautionsTaken ||
    risk.furtherActionNeeded
  );
}

function summarizeHazard(hazards: string): string {
  const cleaned = hazards.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > 90 ? `${cleaned.slice(0, 90).trim()}...` : cleaned;
}

export default function RiskAssessmentForm(props: Props) {
  const name = useSignal(props.initialName ?? "");
  const risks = useSignal<FormRisk[]>(normalizeRisks(props.initialRisks));
  const collapseRowsByDefault = props.actionValue === "update_assessment";
  const checkMode = props.annualCheckMode
    ? "annual"
    : props.inlineCheckMode
    ? "inline"
    : "none";
  const isCheckMode = checkMode !== "none";
  const checkTitle = checkMode === "annual"
    ? "Annual check confirmation"
    : "Ad hoc check confirmation";
  const checkMessage = checkMode === "annual"
    ? "I confirm that I have reviewed and made necessary changes to this risk assessment."
    : "I confirm that I have reviewed this risk assessment and made any necessary updates.";

  function updateRisk(id: string, patch: Partial<FormRisk>) {
    risks.value = risks.value.map((risk) =>
      risk.id === id ? { ...risk, ...patch } : risk
    );
  }

  function addRiskRow() {
    risks.value = [...risks.value, createBlankRisk()];
  }

  function removeRiskRow(id: string) {
    if (risks.value.length === 1) {
      risks.value = [createBlankRisk()];
      return;
    }
    risks.value = risks.value.filter((risk) => risk.id !== id);
  }

  return (
    <form method="POST" class="space-y-4">
      <input type="hidden" name="_csrf" value={props.csrfToken} />
      <input type="hidden" name="action" value={props.actionValue} />
      {props.assessmentId && (
        <input type="hidden" name="assessmentId" value={props.assessmentId} />
      )}
      <input
        type="hidden"
        name="riskRows"
        value={JSON.stringify(sanitizeForSubmission(risks.value))}
      />
      {props.annualCheckMode && (
        <input type="hidden" name="annual_check_mode" value="yes" />
      )}
      {props.inlineCheckMode && (
        <input type="hidden" name="inline_check_mode" value="yes" />
      )}

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Assessment Name
        </label>
        <input
          required
          maxLength={120}
          name="name"
          value={name.value}
          onInput={(event) =>
            name.value = (event.currentTarget as HTMLInputElement).value}
          class={inputClass}
          placeholder="e.g. Summer Camp Cooking Activity"
        />
      </div>

      <div class="space-y-3">
        {risks.value.map((risk, index) => (
          <details
            key={risk.id}
            class="rounded-lg border border-gray-200 dark:border-gray-700"
            open={!collapseRowsByDefault}
            onToggle={(event) => {
              const details = event.currentTarget as HTMLDetailsElement;
              if (!details.open) return;
              details
                .querySelectorAll("textarea[data-autosize='1']")
                .forEach((textarea) =>
                  resizeTextarea(textarea as HTMLTextAreaElement)
                );
            }}
          >
            <summary class="px-4 py-3 cursor-pointer select-none font-semibold text-gray-900 dark:text-gray-100">
              {`Risk ${index + 1}`}
              {summarizeHazard(risk.hazards)
                ? (
                  <span class="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                    - {summarizeHazard(risk.hazards)}
                  </span>
                )
                : null}
            </summary>

            <div class="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <div class="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeRiskRow(risk.id)}
                  class="px-2.5 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  Remove
                </button>
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Risk Level
                </label>
                <select
                  value={risk.initialRiskLevel}
                  onChange={(event) =>
                    updateRisk(risk.id, {
                      initialRiskLevel:
                        (event.currentTarget as HTMLSelectElement)
                          .value as RiskLevel,
                    })}
                  class={inputClass}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  What are the Hazards?
                </label>
                <textarea
                  value={risk.hazards}
                  onInput={(event) => {
                    const textarea = event.currentTarget as HTMLTextAreaElement;
                    resizeTextarea(textarea);
                    updateRisk(risk.id, {
                      hazards: textarea.value,
                    });
                  }}
                  ref={autosizeTextarea}
                  data-autosize="1"
                  class={areaClass}
                  maxLength={1000}
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  What risks do they pose?
                </label>
                <textarea
                  value={risk.posedRisks}
                  onInput={(event) => {
                    const textarea = event.currentTarget as HTMLTextAreaElement;
                    resizeTextarea(textarea);
                    updateRisk(risk.id, {
                      posedRisks: textarea.value,
                    });
                  }}
                  ref={autosizeTextarea}
                  data-autosize="1"
                  class={areaClass}
                  maxLength={1000}
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Who is affected?
                </label>
                <textarea
                  value={risk.affectedWho}
                  onInput={(event) => {
                    const textarea = event.currentTarget as HTMLTextAreaElement;
                    resizeTextarea(textarea);
                    updateRisk(risk.id, {
                      affectedWho: textarea.value,
                    });
                  }}
                  ref={autosizeTextarea}
                  data-autosize="1"
                  class={areaClass}
                  maxLength={1000}
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  What precautions have been taken to reduce the risk?
                </label>
                <textarea
                  value={risk.precautionsTaken}
                  onInput={(event) => {
                    const textarea = event.currentTarget as HTMLTextAreaElement;
                    resizeTextarea(textarea);
                    updateRisk(risk.id, {
                      precautionsTaken: textarea.value,
                    });
                  }}
                  ref={autosizeTextarea}
                  data-autosize="1"
                  class={areaClass}
                  maxLength={1000}
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  What has changed that needs to be thought about and
                  controlled?
                </label>
                <textarea
                  value={risk.furtherActionNeeded}
                  onInput={(event) => {
                    const textarea = event.currentTarget as HTMLTextAreaElement;
                    resizeTextarea(textarea);
                    updateRisk(risk.id, {
                      furtherActionNeeded: textarea.value,
                    });
                  }}
                  ref={autosizeTextarea}
                  data-autosize="1"
                  class={areaClass}
                  maxLength={1000}
                />
              </div>
            </div>
          </details>
        ))}
      </div>

      <div class="space-y-3 pt-1">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={addRiskRow}
            class="w-full sm:w-auto px-4 py-2 font-medium border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            + Add Another Risk
          </button>

          {!isCheckMode && (
            <button
              type="submit"
              class="w-full sm:w-auto px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700"
            >
              {props.submitLabel}
            </button>
          )}
        </div>

        {isCheckMode && (
          <div
            class={`rounded-lg p-3 sm:p-4 space-y-3 ${
              checkMode === "annual"
                ? "border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                : "border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
            }`}
          >
            <p
              class={`text-sm font-medium ${
                checkMode === "annual"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-blue-900 dark:text-blue-200"
              }`}
            >
              {checkTitle}
            </p>
            <label
              class={`flex items-start gap-3 text-sm ${
                checkMode === "annual"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-blue-900 dark:text-blue-200"
              }`}
            >
              <input
                type="checkbox"
                name="check_confirmed"
                value="yes"
                required
                class="mt-1"
              />
              <span>
                {checkMessage}
              </span>
            </label>

            <div class="flex justify-start sm:justify-end">
              <button
                type="submit"
                class={`w-full sm:w-auto px-5 py-2 text-white font-semibold rounded-md ${
                  checkMode === "annual"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {props.submitLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
