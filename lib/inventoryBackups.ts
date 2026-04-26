import {
  getAllCampPlans,
  getAllCampTemplates,
  getAllCheckOuts,
  getAllFeedbackRequests,
  getAllFirstAidCatalogItems,
  getAllFirstAidKits,
  getAllItemPhotoMetadataRecords,
  getAllItems,
  getAllMeals,
  getAllRiskAssessments,
  getFirstAidKitCheckStates,
  getFirstAidOverallCheckState,
  getNeckerMetrics,
  initKv,
} from "../db/kv.ts";
import {
  deletePhotoObject,
  isInventoryPhotoObjectKey,
  listR2ObjectsByPrefix,
  putR2Object,
} from "./r2Photos.ts";
import type {
  InventoryBackupMeta,
  InventoryBackupSnapshot,
} from "../types/inventoryBackup.ts";
import type { FeedbackRequest } from "../types/feedback.ts";
import type { FirstAidCheckState } from "../types/firstAid.ts";
import type {
  CampPlan,
  CampTemplate,
  CheckOut,
  InventoryItem,
} from "../types/inventory.ts";
import type { RiskAssessment } from "../types/risk.ts";

const DEFAULT_WEEKLY_BACKUP_CRON = "0 3 * * 7";
const DEFAULT_BACKUP_PREFIX = "backups/inventory";
const DEFAULT_BACKUP_KEEP_COUNT = 8;
const LATEST_BACKUP_KEY = ["inventory", "backups", "latest"] as const;

export function isWeeklyInventoryBackupEnabled(): boolean {
  return (Deno.env.get("ENABLE_INVENTORY_BACKUP_CRON") ?? "false").trim()
    .toLowerCase() === "true";
}

export function getWeeklyInventoryBackupSchedule(): string {
  const raw = (Deno.env.get("INVENTORY_BACKUP_CRON") ?? "").trim();
  return raw || DEFAULT_WEEKLY_BACKUP_CRON;
}

export function getInventoryBackupKeepCount(): number {
  const raw = (Deno.env.get("INVENTORY_BACKUP_KEEP_COUNT") ?? "").trim();
  if (!raw) return DEFAULT_BACKUP_KEEP_COUNT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_BACKUP_KEEP_COUNT;
  return parsed;
}

export async function getLatestInventoryBackup(): Promise<
  InventoryBackupMeta | null
> {
  const db = await initKv();
  const result = await db.get<InventoryBackupMeta>(LATEST_BACKUP_KEY);
  return result.value ?? null;
}

function reviveDateStrict(field: string, value: unknown): Date {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value for ${field}.`);
  }
  return date;
}

function ensureUniqueIds<T extends { id: string }>(
  entries: T[],
  label: string,
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || typeof entry.id !== "string") {
      throw new Error(`${label} contains an entry with missing id.`);
    }
    if (seen.has(entry.id)) {
      throw new Error(`${label} contains duplicate id '${entry.id}'.`);
    }
    seen.add(entry.id);
  }
}

function reviveInventoryItem(raw: Record<string, unknown>): InventoryItem {
  const item = {
    ...raw,
    addedDate: reviveDateStrict("items[].addedDate", raw.addedDate),
    lastUpdated: reviveDateStrict("items[].lastUpdated", raw.lastUpdated),
    lastInspectedDate: raw.lastInspectedDate
      ? reviveDateStrict("items[].lastInspectedDate", raw.lastInspectedDate)
      : undefined,
    nextInspectionDate: raw.nextInspectionDate
      ? reviveDateStrict("items[].nextInspectionDate", raw.nextInspectionDate)
      : undefined,
    maintenanceHistory: Array.isArray(raw.maintenanceHistory)
      ? raw.maintenanceHistory.map((entry) => ({
        ...(entry as Record<string, unknown>),
        date: reviveDateStrict(
          "items[].maintenanceHistory[].date",
          (entry as Record<string, unknown>).date,
        ),
      }))
      : undefined,
  } as InventoryItem;

  if (item.category === "food" && "expiryDate" in raw) {
    item.expiryDate = reviveDateStrict("items[].expiryDate", raw.expiryDate);
  }

  return item;
}

function reviveCheckOut(raw: Record<string, unknown>): CheckOut {
  return {
    ...raw,
    checkOutDate: reviveDateStrict("checkOuts[].checkOutDate", raw.checkOutDate),
    expectedReturnDate: reviveDateStrict(
      "checkOuts[].expectedReturnDate",
      raw.expectedReturnDate,
    ),
    actualReturnDate: raw.actualReturnDate
      ? reviveDateStrict("checkOuts[].actualReturnDate", raw.actualReturnDate)
      : undefined,
  } as CheckOut;
}

function reviveCampPlan(raw: Record<string, unknown>): CampPlan {
  return {
    ...raw,
    campDate: reviveDateStrict("campPlans[].campDate", raw.campDate),
    endDate: raw.endDate
      ? reviveDateStrict("campPlans[].endDate", raw.endDate)
      : undefined,
    createdAt: reviveDateStrict("campPlans[].createdAt", raw.createdAt),
    lastUpdated: reviveDateStrict("campPlans[].lastUpdated", raw.lastUpdated),
  } as CampPlan;
}

function reviveCampTemplate(raw: Record<string, unknown>): CampTemplate {
  return {
    ...raw,
    createdAt: reviveDateStrict("campTemplates[].createdAt", raw.createdAt),
    lastUpdated: reviveDateStrict("campTemplates[].lastUpdated", raw.lastUpdated),
  } as CampTemplate;
}

function reviveFirstAidCheckState(
  raw: Record<string, unknown>,
): FirstAidCheckState {
  return {
    lastCheckedAt: raw.lastCheckedAt
      ? reviveDateStrict("firstAidChecks.lastCheckedAt", raw.lastCheckedAt)
      : null,
    dismissedUntil: raw.dismissedUntil
      ? reviveDateStrict("firstAidChecks.dismissedUntil", raw.dismissedUntil)
      : null,
    updatedAt: reviveDateStrict("firstAidChecks.updatedAt", raw.updatedAt),
  };
}

function reviveRiskAssessment(raw: Record<string, unknown>): RiskAssessment {
  return {
    ...raw,
    createdAt: reviveDateStrict("riskAssessments[].createdAt", raw.createdAt),
    lastUpdated: reviveDateStrict("riskAssessments[].lastUpdated", raw.lastUpdated),
    lastReviewedAt: raw.lastReviewedAt
      ? reviveDateStrict("riskAssessments[].lastReviewedAt", raw.lastReviewedAt)
      : null,
    lastAnnualCheckAt: raw.lastAnnualCheckAt
      ? reviveDateStrict("riskAssessments[].lastAnnualCheckAt", raw.lastAnnualCheckAt)
      : null,
    annualReminderDismissedUntil: raw.annualReminderDismissedUntil
      ? reviveDateStrict(
        "riskAssessments[].annualReminderDismissedUntil",
        raw.annualReminderDismissedUntil,
      )
      : null,
  } as RiskAssessment;
}

function reviveIsoTimestamp(field: string, value: unknown): string {
  return reviveDateStrict(field, value).toISOString();
}

function reviveFeedbackRequest(raw: Record<string, unknown>): FeedbackRequest {
  const status = String(raw.status ?? "pending");
  const kind = String(raw.kind ?? "feature");
  if (!["feature", "bug"].includes(kind)) {
    throw new Error("Invalid feedback request kind.");
  }
  if (!["pending", "accepted", "rejected"].includes(status)) {
    throw new Error("Invalid feedback request status.");
  }

  const request: FeedbackRequest = {
    id: String(raw.id ?? "").trim(),
    kind: kind as FeedbackRequest["kind"],
    title: String(raw.title ?? "").trim(),
    description: String(raw.description ?? "").trim(),
    status: status as FeedbackRequest["status"],
    createdBy: String(raw.createdBy ?? "").trim().toLowerCase(),
    createdAt: reviveIsoTimestamp("feedbackRequests[].createdAt", raw.createdAt),
    reviewedBy: raw.reviewedBy ? String(raw.reviewedBy).trim().toLowerCase() : null,
    reviewedAt: raw.reviewedAt
      ? reviveIsoTimestamp("feedbackRequests[].reviewedAt", raw.reviewedAt)
      : null,
    reviewReason: raw.reviewReason ? String(raw.reviewReason).trim() : null,
  };

  if (raw.photoId) {
    request.photoId = String(raw.photoId).trim();
  }

  return request;
}

export function parseInventoryBackupPayload(text: string): {
  snapshot: InventoryBackupSnapshot | null;
  error?: string;
} {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return { snapshot: null, error: "Backup file is not valid JSON." };
  }

  if (typeof raw !== "object" || raw === null) {
    return { snapshot: null, error: "Backup file must be a JSON object." };
  }

  const itemsRaw = Array.isArray(raw.items) ? raw.items : null;
  if (!itemsRaw) {
    return {
      snapshot: null,
      error: "Backup file must contain an items array.",
    };
  }

  try {
    const parsedSchemaVersion = Number(raw.schemaVersion ?? 2);
    if (!Number.isInteger(parsedSchemaVersion) ||
      (parsedSchemaVersion !== 1 && parsedSchemaVersion !== 2)) {
      return {
        snapshot: null,
        error: "Unsupported backup schema version.",
      };
    }

    const photoRecords = Array.isArray(raw.photoRecords)
      ? raw.photoRecords.map((record) => {
        const rec = record as Record<string, unknown>;
        const photoId = String(rec.photoId ?? "").trim();
        const contentType = String(rec.contentType ?? "").trim();
        const objectKey = String(rec.objectKey ?? "").trim();
        const byteLength = Number(rec.byteLength ?? 0);
        if (!photoId || !contentType || !objectKey ||
          !Number.isFinite(byteLength) || byteLength < 0) {
          throw new Error("Invalid photo record in backup.");
        }
        if (!isInventoryPhotoObjectKey(objectKey)) {
          throw new Error(
            `Invalid photo object key '${objectKey}' outside allowed prefix.`,
          );
        }
        return { photoId, contentType, objectKey, byteLength };
      })
      : [];

    const snapshot: InventoryBackupSnapshot = {
      schemaVersion: 2,
      createdAt: String(raw.createdAt ?? new Date().toISOString()),
      source: raw.source === "manual" ? "manual" : "cron",
      deploymentId: String(raw.deploymentId ?? "unknown"),
      items: itemsRaw.map((item) =>
        reviveInventoryItem(item as Record<string, unknown>)
      ),
      photoRecords,
      checkOuts: Array.isArray(raw.checkOuts)
        ? raw.checkOuts.map((co) =>
          reviveCheckOut(co as Record<string, unknown>)
        )
        : [],
      neckers: {
        inStock: Number(
          (raw.neckers as Record<string, unknown> | undefined)?.inStock ??
            (raw.neckers as Record<string, unknown> | undefined)?.count ?? 0,
        ),
        created: Number(
          (raw.neckers as Record<string, unknown> | undefined)?.created ?? 0,
        ),
        totalMade: Number(
          (raw.neckers as Record<string, unknown> | undefined)?.totalMade ?? 0,
        ),
        adultCreated: Number(
          (raw.neckers as Record<string, unknown> | undefined)?.adultCreated ??
            0,
        ),
        adultTotalMade: Number(
          (raw.neckers as Record<string, unknown> | undefined)
            ?.adultTotalMade ?? 0,
        ),
      },
      campPlans: Array.isArray(raw.campPlans)
        ? raw.campPlans.map((plan) =>
          reviveCampPlan(plan as Record<string, unknown>)
        )
        : [],
      campTemplates: Array.isArray(raw.campTemplates)
        ? raw.campTemplates.map((template) =>
          reviveCampTemplate(template as Record<string, unknown>)
        )
        : [],
      firstAidKits: Array.isArray(raw.firstAidKits)
        ? raw.firstAidKits.map((kit) => ({
          ...(kit as Record<string, unknown>),
          createdAt: reviveDateStrict(
            "firstAidKits[].createdAt",
            (kit as Record<string, unknown>).createdAt,
          ),
          lastUpdated: reviveDateStrict(
            "firstAidKits[].lastUpdated",
            (kit as Record<string, unknown>).lastUpdated,
          ),
        })) as Awaited<ReturnType<typeof getAllFirstAidKits>>
        : [],
      firstAidCatalog: Array.isArray(raw.firstAidCatalog)
        ? raw.firstAidCatalog as Awaited<
            ReturnType<typeof getAllFirstAidCatalogItems>
          >
        : [],
      firstAidChecks: {
        overall: raw.firstAidChecks &&
            typeof raw.firstAidChecks === "object" &&
            (raw.firstAidChecks as Record<string, unknown>).overall
          ? reviveFirstAidCheckState(
            (raw.firstAidChecks as Record<string, unknown>)
              .overall as Record<string, unknown>,
          )
          : null,
        kits: raw.firstAidChecks &&
            typeof raw.firstAidChecks === "object" &&
            (raw.firstAidChecks as Record<string, unknown>).kits &&
            typeof (raw.firstAidChecks as Record<string, unknown>).kits ===
              "object"
          ? Object.fromEntries(
            Object.entries(
              (raw.firstAidChecks as Record<string, unknown>).kits as Record<
                string,
                unknown
              >,
            )
              .map(([kitId, state]) => [
                kitId,
                reviveFirstAidCheckState(state as Record<string, unknown>),
              ]),
          )
          : {},
      },
      riskAssessments: Array.isArray(raw.riskAssessments)
        ? raw.riskAssessments.map((assessment) =>
          reviveRiskAssessment(assessment as Record<string, unknown>)
        )
        : [],
      meals: Array.isArray(raw.meals)
        ? raw.meals as Awaited<ReturnType<typeof getAllMeals>>
        : [],
      feedbackRequests: Array.isArray(raw.feedbackRequests)
        ? raw.feedbackRequests.map((request) =>
          reviveFeedbackRequest(request as Record<string, unknown>)
        )
        : [],
    };

    if (!Number.isFinite(snapshot.neckers.inStock) ||
      !Number.isFinite(snapshot.neckers.created) ||
      !Number.isFinite(snapshot.neckers.totalMade) ||
      !Number.isFinite(snapshot.neckers.adultCreated) ||
      !Number.isFinite(snapshot.neckers.adultTotalMade)) {
      return {
        snapshot: null,
        error: "Backup file contains invalid necker metrics.",
      };
    }

    ensureUniqueIds(snapshot.items, "items");
    ensureUniqueIds(snapshot.checkOuts, "checkOuts");
    ensureUniqueIds(snapshot.campPlans, "campPlans");
    ensureUniqueIds(snapshot.campTemplates, "campTemplates");
    ensureUniqueIds(snapshot.firstAidKits, "firstAidKits");
    ensureUniqueIds(snapshot.riskAssessments, "riskAssessments");
    ensureUniqueIds(snapshot.meals, "meals");
    ensureUniqueIds(snapshot.feedbackRequests, "feedbackRequests");
    const photoIdSet = new Set<string>();
    for (const record of snapshot.photoRecords) {
      if (photoIdSet.has(record.photoId)) {
        return {
          snapshot: null,
          error: `Duplicate photoId '${record.photoId}' in backup.`,
        };
      }
      photoIdSet.add(record.photoId);
    }

    return { snapshot };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error
        ? error.message
        : "Backup file contains invalid data.",
    };
  }
}

function getBackupPrefix(): string {
  return (Deno.env.get("R2_BACKUP_PREFIX") ?? DEFAULT_BACKUP_PREFIX).trim()
    .replace(/\/+$/g, "");
}

function buildBackupObjectKey(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${getBackupPrefix()}/${year}/${month}/inventory-backup-${stamp}.json`;
}

async function pruneOldBackups(
  keepCount: number,
): Promise<{ deleted: number; remaining: number }> {
  const prefix = `${getBackupPrefix()}/`;
  const objects = await listR2ObjectsByPrefix(prefix);
  const jsonObjects = objects
    .filter((o) => o.key.endsWith(".json"))
    .sort((a, b) => b.key.localeCompare(a.key));

  const stale = jsonObjects.slice(keepCount);
  if (stale.length === 0) {
    return { deleted: 0, remaining: jsonObjects.length };
  }

  await Promise.all(stale.map((obj) => deletePhotoObject(obj.key)));
  return { deleted: stale.length, remaining: jsonObjects.length - stale.length };
}

export async function createInventoryBackup(source: "cron" | "manual" = "cron") {
  const [
    items,
    photoRecords,
    checkOuts,
    neckerMetrics,
    campPlans,
    campTemplates,
    firstAidKits,
    firstAidCatalog,
    firstAidOverall,
    firstAidKitStates,
    riskAssessments,
    meals,
    feedbackRequests,
  ] = await Promise.all([
    getAllItems(),
    getAllItemPhotoMetadataRecords(),
    getAllCheckOuts(),
    getNeckerMetrics(),
    getAllCampPlans(),
    getAllCampTemplates(),
    getAllFirstAidKits(),
    getAllFirstAidCatalogItems(),
    getFirstAidOverallCheckState(),
    getFirstAidKitCheckStates(),
    getAllRiskAssessments(),
    getAllMeals(),
    getAllFeedbackRequests(),
  ]);

  const now = new Date();
  const snapshot: InventoryBackupSnapshot = {
    schemaVersion: 2,
    createdAt: now.toISOString(),
    source,
    deploymentId: Deno.env.get("DENO_DEPLOYMENT_ID") ?? "local",
    items,
    photoRecords,
    checkOuts,
    neckers: neckerMetrics,
    campPlans,
    campTemplates,
    firstAidKits,
    firstAidCatalog,
    firstAidChecks: {
      overall: firstAidOverall,
      kits: firstAidKitStates,
    },
    riskAssessments,
    meals,
    feedbackRequests,
  };

  const json = JSON.stringify(snapshot, null, 2);
  const objectKey = buildBackupObjectKey(now);
  const stored = await putR2Object(
    objectKey,
    new TextEncoder().encode(json),
    "application/json; charset=utf-8",
    "private, max-age=0, no-store",
  );

  const latest: InventoryBackupMeta = {
    objectKey: stored.objectKey,
    byteLength: stored.byteLength,
    createdAt: snapshot.createdAt,
    itemCount: items.length,
    source,
  };

  const db = await initKv();
  await db.set(LATEST_BACKUP_KEY, latest);

  try {
    const keepCount = getInventoryBackupKeepCount();
    const pruned = await pruneOldBackups(keepCount);
    if (pruned.deleted > 0) {
      console.log(
        `[backup] Pruned ${pruned.deleted} old backup file(s); ${pruned.remaining} retained (keep=${keepCount}).`,
      );
    }
  } catch (error) {
    // Backup creation already succeeded; retention cleanup is best-effort.
    console.error("[backup] Failed to prune old backup files:", error);
  }

  return latest;
}
