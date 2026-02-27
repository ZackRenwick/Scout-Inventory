// Date utility functions for inventory management

/** Formats a date as "27 Feb 2026" (en-GB short). Accepts a Date, ISO string, or undefined. */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Formats a date + time as "27 Feb 2026, 14:30" (en-GB). */
export function formatDateTime(date: Date | string | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function getDaysUntil(targetDate: Date): number {
  const now = new Date();
  return Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDaysAgo(pastDate: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - pastDate.getTime()) / (1000 * 60 * 60 * 24));
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
