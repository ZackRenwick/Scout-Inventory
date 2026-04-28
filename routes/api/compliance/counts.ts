import { Handlers } from "$fresh/server.ts";
import {
  getAllFirstAidKitIds,
  getAllItems,
  getAllRiskAssessments,
  getFirstAidKitCheckStates,
  getFirstAidOverallCheckState,
} from "../../../db/kv.ts";
import { forbidden, type Session } from "../../../lib/auth.ts";
import {
  getDaysUntil,
  isDismissed,
  isMonthlyDue,
  isYearlyDue,
} from "../../../lib/date-utils.ts";

export const handler: Handlers = {
  async GET(_req, ctx) {
    const session = ctx.state.session as Session | undefined;
    if (!session || session.role === "explorer") {
      return forbidden();
    }

    const [kitIds, kitStates, overallState, assessments, items] =
      await Promise.all([
        getAllFirstAidKitIds(),
        getFirstAidKitCheckStates(),
        getFirstAidOverallCheckState(),
        getAllRiskAssessments(),
        getAllItems(),
      ]);

    // Count first aid kits with monthly check overdue (excluding dismissed reminders)
    let firstAidDue = 0;
    for (const kitId of kitIds) {
      const state = kitStates[kitId];
      if (
        isMonthlyDue(state?.lastCheckedAt ?? null) &&
        !isDismissed(state?.dismissedUntil ?? null)
      ) {
        firstAidDue++;
      }
    }
    // Also include overall first-aid health check if due and not dismissed
    if (
      isMonthlyDue(overallState?.lastCheckedAt ?? null) &&
      !isDismissed(overallState?.dismissedUntil ?? null)
    ) {
      firstAidDue++;
    }

    // Count risk assessments with annual review overdue (not dismissed)
    const riskDue = assessments.filter(
      (a) =>
        isYearlyDue(a.lastAnnualCheckAt) &&
        !isDismissed(a.annualReminderDismissedUntil),
    ).length;

    // Count items with overdue maintenance inspection
    const maintenanceDue = items.filter(
      (item) =>
        item.nextInspectionDate != null &&
        getDaysUntil(item.nextInspectionDate) < 0,
    ).length;

    return Response.json({ firstAidDue, riskDue, maintenanceDue }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  },
};
