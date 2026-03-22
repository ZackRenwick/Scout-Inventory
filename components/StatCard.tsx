// Component for displaying statistics cards on dashboard
interface StatCardProps {
  title: string;
  value: number | string;
  icon?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
  subtitle?: string;
}

export default function StatCard({ title, value, icon, color = "blue", subtitle }: StatCardProps) {
  const colorClasses = {
    blue:   "bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-600",
    green:  "bg-green-100 text-green-800 border-green-400 dark:bg-green-900 dark:text-green-100 dark:border-green-600",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-400 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-600",
    red:    "bg-red-100 text-red-800 border-red-400 dark:bg-red-900 dark:text-red-100 dark:border-red-600",
    purple: "bg-purple-100 text-purple-800 border-purple-400 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-500",
  };
  
  return (
    <div class={`border-2 rounded-lg p-3 max-[380px]:p-2.5 sm:p-4 lg:p-3.5 h-full ${colorClasses[color]}`}>
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs max-[380px]:text-[11px] sm:text-sm font-medium leading-tight">{title}</p>
          <p class="text-2xl max-[380px]:text-xl sm:text-[1.7rem] lg:text-2xl font-bold mt-1 max-[380px]:mt-0.5 sm:mt-1.5">{value}</p>
          {subtitle && <p class="text-xs max-[380px]:text-[10px] mt-1 max-[380px]:mt-0.5 opacity-70 leading-tight">{subtitle}</p>}
        </div>
        {icon && (
          <div class="text-2xl max-[380px]:text-xl sm:text-3xl lg:text-[1.9rem] shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
