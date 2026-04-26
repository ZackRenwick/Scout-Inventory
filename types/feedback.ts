export type FeedbackKind = "feature" | "bug";
export type FeedbackStatus = "pending" | "accepted" | "rejected";

export interface FeedbackRequest {
  id: string;
  kind: FeedbackKind;
  title: string;
  description: string;
  photoId?: string; // Optional photo ID in R2 (feedback/photos/)
  status: FeedbackStatus;
  createdBy: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
}
