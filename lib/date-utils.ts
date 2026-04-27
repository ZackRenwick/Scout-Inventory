// Date utility functions for inventory management

/** Formats a date as "27 Feb 2026" (en-GB short). Accepts a Date, ISO string, or undefined. */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats a date + time as "27 Feb 2026, 14:30" (en-GB). */
export function formatDateTime(date: Date | string | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDaysUntil(targetDate: Date): number {
  const now = new Date();
  return Math.floor(
    (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function getDaysAgo(pastDate: Date): number {
  const now = new Date();
  return Math.floor(
    (now.getTime() - pastDate.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function isExpired(expiryDate: Date): boolean {
  return expiryDate < new Date();
}

export function getExpiryColor(expiryDate: Date): string {
  const days = getDaysUntil(expiryDate);
  if (days < 0) {
    return "red";
  }
  if (days <= 7) {
    return "orange";
  }
  if (days <= 30) {
    return "yellow";
  }
  return "green";
}

/** Returns the same calendar day one month later (clamped to month end). */
export function addOneCalendarMonth(from: Date): Date {
  const next = new Date(from);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const daysInTargetMonth = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, daysInTargetMonth));
  return next;
}

/**
 * Returns true if the last check date is null (never checked) or at least one
 * full calendar month ago.
 */
export function isMonthlyDue(lastCheckedAt: Date | null | undefined): boolean {
  if (!lastCheckedAt) return true;
  return Date.now() >= addOneCalendarMonth(lastCheckedAt).getTime();
}

/** Returns true if the last check date is null or >= 365 days ago. */
export function isYearlyDue(lastCheckedAt: Date | null | undefined): boolean {
  if (!lastCheckedAt) return true;
  const ageMs = Date.now() - lastCheckedAt.getTime();
  return ageMs >= 365 * 24 * 60 * 60 * 1000;
}

/** Returns true if `dismissedUntil` is in the future. */
export function isDismissed(dismissedUntil: Date | null | undefined): boolean {
  return !!dismissedUntil && dismissedUntil.getTime() > Date.now();
}
