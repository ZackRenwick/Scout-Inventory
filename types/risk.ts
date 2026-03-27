export const RISK_LEVELS = ["Low", "Medium", "High"] as const;

export type RiskLevel = typeof RISK_LEVELS[number];

export interface RiskAssessmentRisk {
  id: string;
  hazards: string;
  posedRisks: string;
  affectedWho: string;
  initialRiskLevel: RiskLevel;
  precautionsTaken: string;
  furtherActionNeeded: string;
}

export interface RiskAssessment {
  id: string;
  name: string;
  risks: RiskAssessmentRisk[];
  lastReviewedAt: Date | null;
  lastAnnualCheckAt: Date | null;
  lastAnnualCheckedBy: string | null;
  annualReminderDismissedUntil: Date | null;
  createdBy: string;
  createdAt: Date;
  lastUpdated: Date;
}
