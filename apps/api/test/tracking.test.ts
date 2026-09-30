import { describe, expect, test } from "bun:test";
import {
  applyTrackingRules,
  refreshCaughtUp,
  seasonStatus,
  showStatus,
} from "../src/media/tracking.ts";

const now = new Date("2026-09-30T12:34:56.789Z");
const today = "2026-09-30T12:34:00.000Z";
const earlier = new Date("2026-01-01T00:00:00.000Z");
const base = {
  status: "Planning" as const,
  progress: 0,
  startDate: null,
  endDate: null,
};
const statusChange = { progress: false, status: true };
const progressChange = { progress: true, status: false };

describe("applyTrackingRules", () => {
  test("completing sets progress to the maximum and the end date", () => {
    const result = applyTrackingRules(
      { ...base, status: "Completed" },
      statusChange,
      1,
      now,
    );
    expect(result).toMatchObject({ status: "Completed", progress: 1 });
    expect(result.endDate?.toISOString()).toBe(today);
  });

  test("completing keeps an end date that is already set", () => {
    const result = applyTrackingRules(
      { ...base, status: "Completed", endDate: earlier },
      statusChange,
      1,
      now,
    );
    expect(result.endDate).toBe(earlier);
  });

  test("starting sets the start date only when empty", () => {
    const started = applyTrackingRules(
      { ...base, status: "In progress" },
      statusChange,
      1,
      now,
    );
    expect(started.startDate?.toISOString()).toBe(today);

    const kept = applyTrackingRules(
      { ...base, status: "In progress", startDate: earlier },
      statusChange,
      1,
      now,
    );
    expect(kept.startDate).toBe(earlier);
  });

  test("reaching the maximum while in progress completes with an end date", () => {
    const result = applyTrackingRules(
      { ...base, status: "In progress", progress: 1 },
      progressChange,
      1,
      now,
    );
    expect(result.status).toBe("Completed");
    expect(result.endDate?.toISOString()).toBe(today);
  });

  test("progress above the maximum is clamped while in progress", () => {
    const result = applyTrackingRules(
      { ...base, status: "In progress", progress: 5 },
      progressChange,
      1,
      now,
    );
    expect(result.progress).toBe(1);
  });

  test("progress is left alone outside of in progress", () => {
    const result = applyTrackingRules(
      { ...base, status: "Paused", progress: 5 },
      progressChange,
      1,
      now,
    );
    expect(result).toMatchObject({ status: "Paused", progress: 5 });
  });

  test("unchanged fields trigger no rule", () => {
    const state = { ...base, status: "Completed" as const, progress: 1 };
    expect(
      applyTrackingRules(state, { progress: false, status: false }, 1, now),
    ).toEqual(state);
  });

  test("without a maximum, completing leaves progress alone", () => {
    const result = applyTrackingRules(
      { ...base, status: "Completed" },
      statusChange,
      null,
      now,
    );
    expect(result.progress).toBe(0);
    expect(result.endDate?.toISOString()).toBe(today);
  });
});

describe("seasonStatus", () => {
  test("nothing watched keeps the current status", () => {
    expect(seasonStatus("Planning", { watched: 0, aired: 0, total: 8 })).toBe(
      "Planning",
    );
  });

  test("follows what has aired and been watched", () => {
    const counts = { aired: 8, total: 16 };
    expect(seasonStatus("Planning", { ...counts, watched: 3 })).toBe(
      "In progress",
    );
    expect(seasonStatus("In progress", { ...counts, watched: 8 })).toBe(
      "Caught up",
    );
    expect(
      seasonStatus("Caught up", { watched: 16, aired: 16, total: 16 }),
    ).toBe("Completed");
  });
});

describe("showStatus", () => {
  test("a returning show is caught up, an ended one completed", () => {
    const counts = { watched: 54, aired: 54 };
    expect(showStatus("In progress", { ...counts, ended: false })).toBe(
      "Caught up",
    );
    expect(showStatus("In progress", { ...counts, ended: true })).toBe(
      "Completed",
    );
  });
});

describe("refreshCaughtUp", () => {
  test("only moves caught-up entries", () => {
    expect(refreshCaughtUp("Caught up", "In progress")).toBe("In progress");
    expect(refreshCaughtUp("Paused", "In progress")).toBe("Paused");
  });
});
