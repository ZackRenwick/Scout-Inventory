import type { FeedbackRequest } from "./feedback.ts";
import type {
  FirstAidCatalogItem,
  FirstAidCheckState,
  FirstAidKit,
} from "./firstAid.ts";
import type {
  CampPlan,
  CampTemplate,
  CheckOut,
  InventoryItem,
} from "./inventory.ts";
import type { Meal } from "./meals.ts";
import type { RiskAssessment } from "./risk.ts";

export interface BackupPhotoRecord {
  photoId: string;
  contentType: string;
  objectKey: string;
  byteLength: number;
}

export interface BackupNeckerMetrics {
  inStock: number;
  created: number;
  totalMade: number;
  adultCreated: number;
  adultTotalMade: number;
}

export interface InventoryBackupSnapshot {
  schemaVersion: 2;
  createdAt: string;
  source: "cron" | "manual";
  deploymentId: string;
  items: InventoryItem[];
  photoRecords: BackupPhotoRecord[];
  checkOuts: CheckOut[];
  neckers: BackupNeckerMetrics;
  campPlans: CampPlan[];
  campTemplates: CampTemplate[];
  firstAidKits: FirstAidKit[];
  firstAidCatalog: FirstAidCatalogItem[];
  firstAidChecks: {
    overall: FirstAidCheckState | null;
    kits: Record<string, FirstAidCheckState>;
  };
  riskAssessments: RiskAssessment[];
  meals: Meal[];
  feedbackRequests: FeedbackRequest[];
}

export interface InventoryBackupMeta {
  objectKey: string;
  byteLength: number;
  createdAt: string;
  itemCount: number;
  source: "cron" | "manual";
}
