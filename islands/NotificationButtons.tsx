// Island — notification trigger buttons on the admin panel.
// Runs client-side so no inline scripts are needed.
import { useState } from "preact/hooks";

interface Props {
  csrfToken: string;
}

type Status = { ok: boolean; message: string } | null;

async function callNotify(type: string | null, csrfToken: string): Promise<Status> {
  const url = type ? `/admin/notify?type=${type}` : "/admin/notify";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    });
    const data = await res.json();
    return { ok: res.ok, message: data.message ?? (res.ok ? "Done." : "An error occurred.") };
  } catch {
    return { ok: false, message: "Network error — please try again." };
  }
}

export default function NotificationButtons({ csrfToken }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  async function trigger(type: string | null, label: string) {
    setLoading(label);
    setStatus(null);
    const result = await callNotify(type, csrfToken);
    setStatus(result);
    setLoading(null);
  }

  const btnBase =
    "inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50";

  return (
    <div>
      <div class="flex flex-wrap gap-3 mb-3">
        <button
          type="button"
          class={`${btnBase} bg-amber-600 hover:bg-amber-700`}
          disabled={loading !== null}
          onClick={() => trigger("low-stock", "⚠️ Send Low Stock Alert")}
        >
          {loading === "⚠️ Send Low Stock Alert" ? "⏳ Sending…" : "⚠️ Send Low Stock Alert"}
        </button>
        <button
          type="button"
          class={`${btnBase} bg-orange-600 hover:bg-orange-700`}
          disabled={loading !== null}
          onClick={() => trigger("expiry", "🥫 Send Expiry Alert")}
        >
          {loading === "🥫 Send Expiry Alert" ? "⏳ Sending…" : "🥫 Send Expiry Alert"}
        </button>
        <button
          type="button"
          class={`${btnBase} bg-purple-600 hover:bg-purple-700`}
          disabled={loading !== null}
          onClick={() => trigger(null, "📧 Send All Alerts")}
        >
          {loading === "📧 Send All Alerts" ? "⏳ Sending…" : "📧 Send All Alerts"}
        </button>
      </div>
      {status && (
        <p class={`text-sm ${status.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}
