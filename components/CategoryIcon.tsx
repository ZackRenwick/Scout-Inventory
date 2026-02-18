// Component for displaying category icons
interface CategoryIconProps {
  category: "tent" | "cooking" | "food" | "camping-tools";
  size?: "sm" | "md" | "lg";
}

export default function CategoryIcon({ category, size = "md" }: CategoryIconProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };
  
  const icons = {
    tent: "⛺",
    cooking: "🍳",
    food: "🥫",
    "camping-tools": "🪓",
  };
  
  const labels = {
    tent: "Tent",
    cooking: "Cooking",
    food: "Food",
    "camping-tools": "Camping Tools",
  };
  
  return (
    <span class={`inline-flex items-center ${sizeClasses[size]}`} title={labels[category]}>
      {icons[category]}
    </span>
  );
}
