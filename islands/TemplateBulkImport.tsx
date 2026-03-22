// Island — bulk import form for camp templates on the admin panel.
import { useRef, useState } from "preact/hooks";

interface Props {
  csrfToken: string;
}

type Status =
  | { type: "success"; imported: number }
  | { type: "partial"; imported: number; errors: { row: number; name?: string; error: string }[] }
  | { type: "error"; message: string; errors?: { row: number; name?: string; error: string }[] }
  | { type: "network" }
  | null;

export default function TemplateBulkImport({ csrfToken }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!fileRef.current?.files?.length) {
      setStatus({ type: "error", message: "Please select a file." });
      return;
    }
    setLoading(true);
    setStatus(null);

    try {
      const fd = new FormData(formRef.current!);
      const res = await fetch("/admin/import-templates", { method: "POST", body: fd });
      const json = await res.json();
      if (res.status === 201 || res.ok) {
        setStatus({ type: "success", imported: json.imported });
        formRef.current?.reset();
      } else if (res.status === 207) {
        setStatus({ type: "partial", imported: json.imported, errors: json.errors });
      } else {
        setStatus({ type: "error", message: json.error ?? "Import failed.", errors: json.errors });
      }
    } catch {
      setStatus({ type: "network" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} class="mt-2" onSubmit={handleSubmit}>
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <div class="flex items-center gap-3 flex-wrap">
        <input
          ref={fileRef}
          id="importTemplatesFile"
          type="file"
          name="file"
          accept=".json,application/json"
          required
          class="text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-sky-50 file:text-sky-700 dark:file:bg-sky-900/40 dark:file:text-sky-300 hover:file:bg-sky-100"
        />
        <button
          type="submit"
          disabled={loading}
          class="inline-flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "⏳ Importing…" : "📤 Import Templates"}
        </button>
      </div>

      {status && (
        <div class="mt-3 text-sm">
          {status.type === "success" && (
            <p class="text-green-700 dark:text-green-400">
              ✅ Imported <strong>{status.imported}</strong> template{status.imported !== 1 ? "s" : ""} successfully.
            </p>
          )}
          {status.type === "partial" && (
            <div class="text-orange-700 dark:text-orange-400">
              <p>⚠️ Imported <strong>{status.imported}</strong> templates, but <strong>{status.errors.length}</strong> failed:</p>
              <ul class="mt-1 list-disc list-inside">
                {status.errors.map((e) => (
                  <li key={e.row}>Row {e.row}{e.name ? ` (${e.name})` : ""}: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
          {status.type === "error" && (
            <div class="text-red-700 dark:text-red-400">
              <p>❌ {status.message}</p>
              {status.errors && (
                <ul class="mt-1 list-disc list-inside">
                  {status.errors.map((e) => (
                    <li key={e.row}>Row {e.row}{e.name ? ` (${e.name})` : ""}: {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {status.type === "network" && (
            <p class="text-red-700 dark:text-red-400">❌ Request failed. Check your network connection.</p>
          )}
        </div>
      )}
    </form>
  );
}
