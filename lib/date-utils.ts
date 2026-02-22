// Date utility functions for inventory management

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
