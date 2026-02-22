// Island — rebuild indexes button on the admin panel.
import { useState } from "preact/hooks";

interface Props {
  csrfToken: string;
}

type Status = { ok: boolean; message: string } | null;

export default function RebuildIndexes({ csrfToken }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function handleRebuild() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/admin/rebuild-indexes", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
      });
      const json = await res.json();
      setStatus({ ok: res.ok, message: res.ok ? json.message : json.error ?? "An error occurred." });
    } catch {
      setStatus({ ok: false, message: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={handleRebuild}
        class="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? "⏳ Rebuilding…" : "🔄 Rebuild Indexes"}
      </button>
      {status && (
        <p class={`mt-3 text-sm ${status.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
          {status.ok ? "✅" : "❌"} {status.message}
        </p>
      )}
    </div>
  );
}
