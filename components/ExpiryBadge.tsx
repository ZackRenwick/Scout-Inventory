// Reusable component for displaying expiry status badges
import { getDaysUntil } from "../lib/date-utils.ts";

interface ExpiryBadgeProps {
  expiryDate: Date | string;
}

export default function ExpiryBadge({ expiryDate }: ExpiryBadgeProps) {
  const date = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  const days = getDaysUntil(date);
  
  let status: string;
  let colorClass: string;
  
  if (days < 0) {
    status = `Expired ${Math.abs(days)} days ago`;
    colorClass = "bg-red-100 text-red-800 border-red-300";
  } else if (days === 0) {
    status = "Expires today!";
    colorClass = "bg-red-100 text-red-800 border-red-300";
  } else if (days <= 7) {
    status = `${days} day${days === 1 ? "" : "s"} left`;
    colorClass = "bg-orange-100 text-orange-800 border-orange-300";
  } else if (days <= 30) {
    status = `${days} days left`;
    colorClass = "bg-yellow-100 text-yellow-800 border-yellow-300";
  } else {
    status = `${days} days left`;
    colorClass = "bg-green-100 text-green-800 border-green-300";
  }
  
  return (
    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {status}
    </span>
  );
}
