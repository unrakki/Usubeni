import { treaty } from "@elysiajs/eden";
import type { App, statusesFor } from "@usubeni/shared";
import i18n from "./i18n.ts";

// The API is served under /api on the same origin (Vite proxies it in dev).
// parseDate is off: Eden would turn any date-looking string into a Date,
// including calendar days like air dates, which then shift across time zones.
export const api = treaty<App>(window.location.origin, {
  parseDate: false,
}).api;

// Responses keep dates as the ISO strings JSON carries them in.
type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

export type Status = ReturnType<typeof statusesFor>[number];
export type Entry = Serialized<
  NonNullable<Awaited<ReturnType<typeof api.media.get>>["data"]>[number]
>;
export type EntryChanges = Parameters<ReturnType<typeof api.media>["patch"]>[0];

// Eden resolves errors instead of throwing; TanStack Query needs a throw.
export async function unwrap<R extends { data: unknown; error: unknown }>(
  request: Promise<R>,
): Promise<Serialized<NonNullable<R["data"]>>> {
  const { data, error } = await request;
  if (error) throw error;
  return data as Serialized<NonNullable<R["data"]>>;
}

// Date inputs work in YYYY-MM-DD in local time, so a date the API set
// automatically ("now") shows the viewer's day, not the UTC one.
export function toDateInput(date: string | null) {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateInput(value: string) {
  if (!value) return null;
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function errorMessage(error: unknown) {
  // Eden errors carry the response body in `value`.
  const value = (error as { value?: { message?: string } }).value;
  return (
    value?.message ??
    (error instanceof Error ? error.message : i18n.t("common.error"))
  );
}
