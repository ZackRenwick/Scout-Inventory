import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "{routes,islands,components}/**/*.{ts,tsx}",
  ],
  safelist: [
    // Card text — must always be generated so islands can use them reliably
    "text-white",
    "text-gray-900",
    "text-gray-200",
    "text-gray-300",
    "text-gray-400",
    "text-gray-500",
    "dark:text-white",
    "dark:text-gray-200",
    "dark:text-gray-300",
    "dark:text-gray-400",
    // Card backgrounds
    "dark:bg-gray-800",
    "dark:border-gray-700",
    // Border accents used dynamically in CategoryCard
    "border-t-blue-500", "border-t-green-500", "border-t-yellow-500",
    "border-t-red-500",  "border-t-purple-500", "border-t-indigo-500",
    "border-t-orange-500",
  ],
} satisfies Config;
