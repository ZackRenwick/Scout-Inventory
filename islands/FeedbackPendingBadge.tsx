import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface FeedbackPendingBadgeProps {
  className?: string;
}

export default function FeedbackPendingBadge({
  className =
    "ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white",
}: FeedbackPendingBadgeProps) {
  const pendingCount = useSignal<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/feedback/pending-count", {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!res.ok) {
          return;
        }

        const body = await res.json();
        const count = typeof body?.pendingCount === "number"
          ? body.pendingCount
          : 0;
        if (!cancelled) {
          pendingCount.value = count;
        }
      } catch {
        // Silent fail: admin screens still work without the indicator.
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!pendingCount.value) {
    return null;
  }

  return <span class={className}>{pendingCount.value}</span>;
}
