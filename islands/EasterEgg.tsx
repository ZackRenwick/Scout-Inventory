import { useSignal } from "@preact/signals";

export default function EasterEgg() {
  const clicks = useSignal(0);
  const joke = useSignal<string | null>(null);
  const loading = useSignal(false);

  async function handleClick() {
    clicks.value++;
    if (clicks.value < 3) return;

    loading.value = true;
    joke.value = null;
    try {
      const res = await fetch("/api/joke");
      joke.value = await res.text();
    } catch {
      joke.value = "Why do programmers prefer dark mode? Because light attracts bugs! 🐛";
    } finally {
      loading.value = false;
      clicks.value = 0;
    }
  }

  return (
    <span class="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        class="opacity-20 hover:opacity-60 transition-opacity duration-300 cursor-default select-none text-base"
        title={clicks.value > 0 ? `${3 - clicks.value} more...` : ""}
        aria-label="Easter egg"
      >
        🍋
      </button>
      {loading.value && (
        <span class="text-xs text-purple-300 dark:text-purple-400 italic animate-pulse">
          loading...
        </span>
      )}
      {joke.value && (
        <span class="max-w-xs text-xs text-purple-200 dark:text-purple-300 italic bg-purple-900/50 dark:bg-gray-800/80 border border-purple-700 dark:border-purple-800 rounded-lg px-3 py-2 mt-1">
          😄 {joke.value}
        </span>
      )}
    </span>
  );
}
