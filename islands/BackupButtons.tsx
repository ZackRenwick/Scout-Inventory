import { useState } from "preact/hooks";

interface BackupMeta {
  objectKey: string;
  byteLength: number;
  createdAt: string;
  itemCount: number;
  source: "cron" | "manual";
}

interface Props {
  csrfToken: string;
  latestBackup: BackupMeta | null;
}

type Status = { ok: boolean; message: string; latestBackup?: BackupMeta } | null;

async function runBackup(csrfToken: string): Promise<Status> {
  try {
    const res = await fetch("/admin/backup", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      message: data.message ?? (res.ok ? "Backup created." : "Backup failed."),
      latestBackup: res.ok
        ? {
          objectKey: data.objectKey,
          byteLength: data.byteLength,
          createdAt: data.createdAt,
          itemCount: data.itemCount,
          source: data.source,
        }
        : undefined,
    };
  } catch {
    return { ok: false, message: "Network error — please try again." };
  }
}

export default function BackupButtons({ csrfToken, latestBackup }: Props) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [currentBackup, setCurrentBackup] = useState<BackupMeta | null>(latestBackup);

  async function trigger() {
    setRunning(true);
    setStatus(null);
    const result = await runBackup(csrfToken);
    setStatus(result);
    if (result?.ok && result.latestBackup) {
      setCurrentBackup(result.latestBackup);
    }
    setRunning(false);
  }

  return (
    <div>
      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        disabled={running}
        onClick={trigger}
      >
        {running ? "⏳ Creating Backup…" : "🗄️ Run Backup Now"}
      </button>
      {currentBackup && (
        <div class="mt-4 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-3 text-sm text-sky-900 dark:text-sky-100">
          <p class="font-medium">Latest successful backup</p>
          <p class="mt-1 break-all">{currentBackup.objectKey}</p>
          <p class="mt-1 text-sky-700 dark:text-sky-300">
            {new Date(currentBackup.createdAt).toLocaleString()} · {currentBackup.itemCount} items · {Math.round(currentBackup.byteLength / 1024)} KB · {currentBackup.source}
          </p>
        </div>
      )}
      {status && (
        <p class={`mt-3 text-sm ${status.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}