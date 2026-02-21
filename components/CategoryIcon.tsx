// Component for displaying category icons
interface CategoryIconProps {
  category: "tent" | "cooking" | "food" | "camping-tools" | "games";
  size?: "sm" | "md" | "lg";
}

export default function CategoryIcon({ category, size = "md" }: CategoryIconProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };
  
  const icons: Record<string, string> = {
    tent: "⛺",
    cooking: "🍳",
    food: "🥫",
    "camping-tools": "🪓",
    games: "🎮",
  };
  
  const labels: Record<string, string> = {
    tent: "Tent",
    cooking: "Cooking",
    food: "Food",
    "camping-tools": "Camping Tools",
    games: "Games",
  };
  
  return (
    <span class={`inline-flex items-center ${sizeClasses[size]}`} title={labels[category]}>
      {icons[category]}
    </span>
  );
}
