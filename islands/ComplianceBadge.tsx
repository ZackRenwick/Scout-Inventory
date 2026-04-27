import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface ComplianceCounts {
  firstAidDue: number;
  riskDue: number;
  maintenanceDue: number;
}

// Module-level cache so all badge instances share a single fetch
let cachedCounts: ComplianceCounts | null = null;
let fetchPromise: Promise<ComplianceCounts | null> | null = null;

function getComplianceCounts(): Promise<ComplianceCounts | null> {
  if (cachedCounts !== null) return Promise.resolve(cachedCounts);
  if (fetchPromise !== null) return fetchPromise;

  fetchPromise = fetch("/api/compliance/counts", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then((res) => {
      if (!res.ok) return null;
      return res.json() as Promise<ComplianceCounts>;
    })
    .then((data) => {
      cachedCounts = data;
      return data;
    })
    .catch(() => null);

  return fetchPromise;
}

interface ComplianceBadgeProps {
  type: "first-aid" | "risk" | "maintenance";
  className?: string;
}

export default function ComplianceBadge({
  type,
  className =
    "ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white",
}: ComplianceBadgeProps) {
  const count = useSignal<number>(0);

  useEffect(() => {
    let cancelled = false;

    getComplianceCounts().then((data) => {
      if (cancelled || !data) return;
      if (type === "first-aid") count.value = data.firstAidDue;
      else if (type === "risk") count.value = data.riskDue;
      else count.value = data.maintenanceDue;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!count.value) return null;

  return <span class={className}>{count.value}</span>;
}
