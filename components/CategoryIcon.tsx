// Component for displaying category icons
import type { ItemCategory } from "../types/inventory.ts";
import { getCategoryEmoji, getCategoryLabel } from "../types/inventory.ts";

interface CategoryIconProps {
  category: ItemCategory;
  size?: "sm" | "md" | "lg";
}

export default function CategoryIcon({ category, size = "md" }: CategoryIconProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };
  
  return (
    <span class={`inline-flex items-center ${sizeClasses[size]}`} title={getCategoryLabel(category)}>
      {getCategoryEmoji(category)}
    </span>
  );
}
