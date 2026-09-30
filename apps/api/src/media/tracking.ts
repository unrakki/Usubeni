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

// Episode counts are distinct episodes, so a rewatch doesn't count twice.
export interface SeasonCounts {
  watched: number;
  aired: number;
  total: number;
}

// With nothing watched, statuses derived from watching no longer hold; the
// ones the user picked (Planning, Paused, Dropped) stay.
const withNothingWatched = (current: Status): Status =>
  current === "Completed" || current === "Caught up" ? "In progress" : current;

// Status a season takes after an episode is watched or unwatched.
export function seasonStatus(current: Status, counts: SeasonCounts): Status {
  if (counts.watched === 0) return withNothingWatched(current);
  if (counts.total > 0 && counts.watched >= counts.total) return "Completed";
  if (counts.watched >= counts.aired) return "Caught up";
  return "In progress";
}

// Specials (season 0) are left out of both counts.
export interface ShowCounts {
  watched: number;
  aired: number;
  ended: boolean;
}

// Status a show takes after one of its episodes is watched or unwatched.
export function showStatus(current: Status, counts: ShowCounts): Status {
  if (counts.watched === 0) return withNothingWatched(current);
  if (counts.watched >= counts.aired) {
    return counts.ended ? "Completed" : "Caught up";
  }
  return "In progress";
}

// On read, only a caught-up entry moves on its own: new episodes aired, or
// the show ended. Other statuses are the user's choice until they watch.
export function refreshCaughtUp(current: Status, next: Status): Status {
  return current === "Caught up" ? next : current;
}
