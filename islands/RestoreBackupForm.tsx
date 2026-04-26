import { useRef, useState } from "preact/hooks";

interface Props {
  csrfToken: string;
}

type Status = { ok: boolean; message: string } | null;

export default function RestoreBackupForm({ csrfToken }: Props) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: Event) {
    e.preventDefault();
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setStatus({ ok: false, message: "Choose a backup JSON file first." });
      return;
    }

    const confirmed = globalThis.confirm(
      "Restore this backup and replace current app data? This does not restore users/auth and will overwrite current inventory data.",
    );
    if (!confirmed) return;

    setRunning(true);
    setStatus(null);

    try {
      const form = new FormData();
      form.append("backupFile", file);
      const res = await fetch("/admin/restore-backup", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      setStatus({
        ok: res.ok,
        message: data.message ?? (res.ok ? "Backup restored." : "Restore failed."),
      });
      if (res.ok && input) {
        input.value = "";
      }
    } catch {
      setStatus({ ok: false, message: "Network error — please try again." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <form onSubmit={onSubmit} class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Restore Backup</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Upload a backup JSON created by this app to replace current app data. Photo metadata is restored, but photo objects must still exist in R2.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        class="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded-md file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-100"
      />
      <button
        type="submit"
        disabled={running}
        class="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {running ? "⏳ Restoring…" : "♻️ Restore Backup"}
      </button>
      {status && (
        <p class={`mt-3 text-sm ${status.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {status.message}
        </p>
      )}
    </form>
  );
}