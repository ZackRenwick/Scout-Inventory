// Calendar view for camp plans
import { useSignal } from "@preact/signals";
import type { CampPlan, CampPlanStatus } from "../types/inventory.ts";

interface CampCalendarProps {
  plans: CampPlan[];
}

const STATUS_COLORS: Record<CampPlanStatus, string> = {
  planning: "bg-blue-500 text-white",
  packing: "bg-yellow-500 text-black",
  active: "bg-green-500 text-white",
  returning: "bg-orange-500 text-white",
  completed: "bg-gray-400 text-white",
};

const STATUS_LABELS: Record<CampPlanStatus, string> = {
  planning: "Planning",
  packing: "Packing",
  active: "Active",
  returning: "Returning",
  completed: "Completed",
};

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Returns 0 (Mon) – 6 (Sun) */
function dayOfWeekMon(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CampCalendar({ plans: rawPlans }: CampCalendarProps) {
  const today = startOfDay(new Date());
  const currentYear = useSignal(today.getFullYear());
  const currentMonth = useSignal(today.getMonth());

  // Normalise dates (may arrive as ISO strings from JSON serialisation)
  const plans = rawPlans.map((p) => ({
    ...p,
    campDate: startOfDay(new Date(p.campDate)),
    endDate: p.endDate ? startOfDay(new Date(p.endDate)) : startOfDay(new Date(p.campDate)),
  }));

  function prevMonth() {
    if (currentMonth.value === 0) {
      currentMonth.value = 11;
      currentYear.value -= 1;
    } else {
      currentMonth.value -= 1;
    }
  }

  function nextMonth() {
    if (currentMonth.value === 11) {
      currentMonth.value = 0;
      currentYear.value += 1;
    } else {
      currentMonth.value += 1;
    }
  }

  function goToday() {
    currentYear.value = today.getFullYear();
    currentMonth.value = today.getMonth();
  }

  const firstDay = new Date(currentYear.value, currentMonth.value, 1);
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0);

  // Build grid: start on Monday of the first week, end on Sunday of the last week
  const gridStart = addDays(firstDay, -dayOfWeekMon(firstDay));
  const gridEnd = addDays(lastDay, 6 - dayOfWeekMon(lastDay));

  const weeks: Date[][] = [];
  let cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  const monthName = firstDay.toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {/* Calendar header */}
      <div class="flex items-center justify-between mb-4 gap-2">
        <button
          type="button"
          onClick={prevMonth}
          class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          aria-label="Previous month"
        >
          ← Prev
        </button>
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">{monthName}</h3>
          <button
            type="button"
            onClick={goToday}
            class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Today
          </button>
        </div>
        <button
          type="button"
          onClick={nextMonth}
          class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          aria-label="Next month"
        >
          Next →
        </button>
      </div>

      {/* Day-of-week headers */}
      <div class="grid grid-cols-7 border-l border-t border-gray-200 dark:border-gray-700 rounded-t-lg overflow-hidden">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            class="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2 bg-gray-50 dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div class="border-l border-gray-200 dark:border-gray-700 rounded-b-lg overflow-hidden">
        {weeks.map((week, wi) => {
          const weekStart = week[0];
          const weekEnd = week[6];

          // Camps overlapping this week
          const weekCamps = plans
            .filter((p) => p.campDate <= weekEnd && (p.endDate ?? p.campDate) >= weekStart)
            .sort((a, b) => a.campDate.getTime() - b.campDate.getTime());

          return (
            <div key={wi} class="border-b border-gray-200 dark:border-gray-700">
              {/* Date number row */}
              <div class="grid grid-cols-7">
                {week.map((day, di) => {
                  const isToday = isSameDay(day, today);
                  const inMonth = day.getMonth() === currentMonth.value;
                  return (
                    <div
                      key={di}
                      class={`border-r border-gray-200 dark:border-gray-700 p-1.5 min-h-[2rem] ${
                        inMonth
                          ? "bg-white dark:bg-gray-900"
                          : "bg-gray-50 dark:bg-gray-800/60"
                      }`}
                    >
                      <span
                        class={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                          isToday
                            ? "bg-purple-600 text-white"
                            : inMonth
                            ? "text-gray-800 dark:text-gray-200"
                            : "text-gray-400 dark:text-gray-600"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Event bars row — CSS grid with 7 columns, events span their day range */}
              {weekCamps.length > 0 && (
                <div class="grid grid-cols-7 gap-y-0.5 pb-1 px-px">
                  {weekCamps.map((camp) => {
                    const clampedStart = camp.campDate < weekStart ? weekStart : camp.campDate;
                    const clampedEnd =
                      (camp.endDate ?? camp.campDate) > weekEnd
                        ? weekEnd
                        : (camp.endDate ?? camp.campDate);
                    const startCol = dayOfWeekMon(clampedStart) + 1; // CSS grid is 1-based
                    const span =
                      dayOfWeekMon(clampedEnd) - dayOfWeekMon(clampedStart) + 1;

                    const colorClass =
                      STATUS_COLORS[camp.status as CampPlanStatus] ?? "bg-purple-500 text-white";

                    const continuesBefore = camp.campDate < weekStart;
                    const continuesAfter = (camp.endDate ?? camp.campDate) > weekEnd;

                    return (
                      <a
                        key={`${camp.id}-w${wi}`}
                        href={`/camps/${camp.id}`}
                        class={`text-xs font-medium px-1.5 py-0.5 truncate transition-opacity hover:opacity-80 ${colorClass} ${
                          continuesBefore ? "rounded-r" : continuesAfter ? "rounded-l" : "rounded"
                        }`}
                        style={{ gridColumn: `${startCol} / span ${span}` }}
                        title={`${camp.name}${camp.location ? ` · ${camp.location}` : ""}`}
                      >
                        {continuesBefore ? "↩ " : ""}{camp.name}
                        {continuesAfter ? " →" : ""}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
        {(Object.entries(STATUS_COLORS) as [CampPlanStatus, string][]).map(([status, cls]) => (
          <span key={status} class="flex items-center gap-1.5">
            <span class={`w-3 h-3 rounded-sm inline-block ${cls.split(" ")[0]}`} />
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      {/* Empty state */}
      {plans.length === 0 && (
        <div class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          No camps scheduled — create a camp plan to see it here.
        </div>
      )}
    </div>
  );
}
