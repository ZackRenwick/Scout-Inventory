// Island — clean up stale KV data from the admin panel.
import { useState } from "preact/hooks";

interface Props {
  csrfToken: string;
}

interface CleanUpResult {
  ok: boolean;
  message: string;
  orphanedIndexes?: number;
  oldReturnedLoans?: number;
  orphanedSessions?: number;
}

export default function DbCleanup({ csrfToken }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CleanUpResult | null>(null);

  async function handleCleanup() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/admin/cleanup", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
      });
      const json = await res.json();
      setResult({ ok: res.ok, message: res.ok ? json.message : (json.error ?? "An error occurred."), ...json });
    } catch {
      setResult({ ok: false, message: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleCleanup}
        class="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? "⏳ Cleaning…" : "🧹 Run Cleanup"}
      </button>
      {result && (
        <div class={`mt-3 text-sm ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
          <p>{result.ok ? "✅" : "❌"} {result.message}</p>
        </div>
      )}
    </div>
  );
}
