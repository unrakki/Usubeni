import type { STATUSES } from "../db/constants.ts";

type Status = (typeof STATUSES)[number];

export interface TrackingState {
  status: Status;
  progress: number;
  startDate: Date | null;
  endDate: Date | null;
}

// Progress rules run first, since reaching the maximum changes the status.
// Dates are only filled when empty, never overwritten. Negative progress is
// rejected by the request schema, so it isn't clamped here.
export function applyTrackingRules<T extends TrackingState>(
  state: T,
  changed: { progress: boolean; status: boolean },
  maxProgress: number | null,
  now = new Date(),
): T {
  const next = { ...state };
  const today = new Date(now);
  today.setSeconds(0, 0);
  let statusChanged = changed.status;

  if (changed.progress && next.status === "In progress" && maxProgress) {
    next.progress = Math.min(next.progress, maxProgress);
    if (next.progress === maxProgress) {
      next.status = "Completed";
      statusChanged = true;
    }
  }

  if (statusChanged && next.status === "Completed") {
    if (maxProgress) next.progress = maxProgress;
    next.endDate ??= today;
  }
  if (statusChanged && next.status === "In progress") {
    next.startDate ??= today;
  }

  return next;
}
