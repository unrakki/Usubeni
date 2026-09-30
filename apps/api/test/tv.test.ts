import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { tmdbPaths } from "./fixtures/breaking-bad.ts";
import { call, tmdbRoutes } from "./helpers.ts";

for (const [path, handler] of Object.entries(tmdbPaths)) {
  tmdbRoutes.set(path, handler);
}

const SHOW = "/media/tmdb/tv/1396";

// Noon UTC, so the date is the same whatever the local time zone.
const at = (date: string) => setSystemTime(new Date(`${date}T12:00:00Z`));

async function json(method: string, path: string, body?: unknown) {
  const response = await call(method, path, body);
  if (!response.ok) {
    throw new Error(
      `${method} ${path}: ${response.status} ${await response.text()}`,
    );
  }
  return response.status === 204 ? null : response.json();
}

const show = () => json("GET", SHOW);
const season = (n: number) => json("GET", `${SHOW}/season/${n}`);
const watch = (s: number, e: number, body?: unknown) =>
  json("POST", `${SHOW}/season/${s}/episode/${e}/watch`, body);
const statusOf = (
  data: {
    seasons: { seasonNumber: number; entry: { status: string } | null }[];
  },
  n: number,
) => data.seasons.find((s) => s.seasonNumber === n)?.entry?.status ?? null;

beforeAll(async () => {
  // Sign up on the real clock, so the session isn't dated in 2012.
  await call("GET", "/health");
});

afterAll(async () => {
  setSystemTime();
  const data = await show();
  if (data.entry) await call("DELETE", `/media/${data.entry.id}`);
});

describe("tv shows", () => {
  test("search finds shows", async () => {
    const data = await json("GET", "/search?type=tv&q=breaking");
    expect(data.results[0]).toEqual({
      mediaId: "1396",
      source: "tmdb",
      mediaType: "tv",
      title: "Breaking Bad",
      image: "https://image.tmdb.org/t/p/w500/breaking-bad.jpg",
      year: 2008,
      tracked: false,
    });
  });

  test("watching the first episode creates the show and season entries", async () => {
    at("2012-10-01");
    const view = await watch(1, 1);
    expect(view.entry).toMatchObject({ status: "In progress", progress: 1 });
    expect(view.episodes[0].viewings).toHaveLength(1);
    expect(view.episodes[0].viewings[0].endDate).toBe(
      "2012-10-01T12:00:00.000Z",
    );

    const data = await show();
    expect(data.entry).toMatchObject({ status: "In progress", progress: 1 });
    expect(statusOf(data, 1)).toBe("In progress");
  });

  test("a rewatch is a new viewing but counts once", async () => {
    const view = await watch(1, 1);
    expect(view.entry.progress).toBe(1);
    expect(view.episodes[0].viewings).toHaveLength(2);
  });

  test("completing a season fills aired episodes with an unknown date", async () => {
    const before = await season(1);
    await json("PATCH", `/media/${before.entry.id}`, { status: "Completed" });

    const view = await season(1);
    expect(view.entry).toMatchObject({ status: "Completed", progress: 7 });
    expect(view.episodes[1].viewings).toEqual([
      { id: expect.any(Number), endDate: null },
    ]);
    expect(view.episodes[0].viewings).toHaveLength(2);
  });

  test("completing a returning show leaves it caught up", async () => {
    const before = await show();
    await json("PATCH", `/media/${before.entry.id}`, { status: "Completed" });

    const data = await show();
    // Seasons 1 to 4 and the aired half of season 5: 7 + 3 × 13 + 8.
    expect(data.entry).toMatchObject({ status: "Caught up", progress: 54 });
    expect([2, 3, 4].map((n) => statusOf(data, n))).toEqual([
      "Completed",
      "Completed",
      "Completed",
    ]);
    expect(statusOf(data, 5)).toBe("Caught up");
    // Specials aren't completed along with the show.
    expect(statusOf(data, 0)).toBeNull();
  });

  test("an episode can't be watched before it airs", async () => {
    // Still October 2012: the second half of season 5 airs in 2013.
    const response = await call("POST", `${SHOW}/season/5/episode/9/watch`);
    expect(response.status).toBe(422);
  });

  test("new episodes move caught-up entries back to in progress", async () => {
    at("2013-08-20");
    const data = await show();
    expect(data.entry.status).toBe("In progress");
    expect(statusOf(data, 5)).toBe("In progress");
  });

  test("watching the last episode after the finale completes the show", async () => {
    at("2013-10-01");
    for (let e = 9; e <= 16; e++) await watch(5, e);

    const data = await show();
    expect(statusOf(data, 5)).toBe("Completed");
    expect(data.entry).toMatchObject({ status: "Completed", progress: 62 });
  });

  test("specials don't count towards the show", async () => {
    const view = await watch(0, 1, { endDate: null });
    expect(view.entry.status).toBe("In progress");
    expect(view.episodes[0].viewings[0].endDate).toBeNull();

    const data = await show();
    expect(data.entry).toMatchObject({ status: "Completed", progress: 62 });
  });

  test("unwatching reopens the season and the show", async () => {
    await json("DELETE", `${SHOW}/season/5/episode/16/watch`);
    const data = await show();
    expect(statusOf(data, 5)).toBe("In progress");
    expect(data.entry).toMatchObject({ status: "In progress", progress: 61 });
  });

  test("unwatching an episode that isn't watched is a 404", async () => {
    const response = await call("DELETE", `${SHOW}/season/0/episode/2/watch`);
    expect(response.status).toBe(404);
  });

  test("the list derives progress and dates from episodes", async () => {
    const [entry] = await json("GET", "/media?type=tv");
    expect(entry).toMatchObject({
      progress: 61,
      startDate: "2012-10-01T12:00:00.000Z",
      endDate: "2013-10-01T12:00:00.000Z",
    });
  });

  test("shows and seasons reject progress and dates", async () => {
    const data = await show();
    const response = await call("PATCH", `/media/${data.entry.id}`, {
      progress: 3,
    });
    expect(response.status).toBe(422);
  });

  test("a show or season can't be added twice", async () => {
    const add = (body: object) =>
      call("POST", "/media", {
        source: "tmdb",
        mediaId: "1396",
        status: "Planning",
        ...body,
      });
    expect((await add({ mediaType: "tv" })).status).toBe(409);
    expect((await add({ mediaType: "season", seasonNumber: 1 })).status).toBe(
      409,
    );
  });

  test("dropping a show drops its seasons in progress", async () => {
    const before = await show();
    await json("PATCH", `/media/${before.entry.id}`, { status: "Dropped" });

    const data = await show();
    expect(data.entry.status).toBe("Dropped");
    expect([0, 1, 5].map((n) => statusOf(data, n))).toEqual([
      "Dropped",
      "Completed",
      "Dropped",
    ]);
  });

  test("deleting the show removes its seasons and episodes", async () => {
    const before = await show();
    await json("DELETE", `/media/${before.entry.id}`);

    const data = await show();
    expect(data.entry).toBeNull();
    expect(await json("GET", "/media?type=season")).toEqual([]);
  });
});
