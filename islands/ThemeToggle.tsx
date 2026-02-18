// Toggle between light and dark (purple) theme
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

export default function ThemeToggle() {
  const isDark = useSignal(false);

  useEffect(() => {
    isDark.value = document.documentElement.classList.contains("dark");
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    if (isDark.value) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      isDark.value = false;
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      isDark.value = true;
    }
  };

  return (
    <button
      onClick={toggle}
      class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
             bg-white/20 hover:bg-white/30 text-white transition-colors"
      title={isDark.value ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span>{isDark.value ? "☀️" : "🌙"}</span>
      <span class="hidden sm:inline">{isDark.value ? "Light" : "Dark"}</span>
    </button>
  );
}
