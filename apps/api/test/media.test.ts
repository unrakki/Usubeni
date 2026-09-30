import { describe, expect, test } from "bun:test";
import { app } from "../src/app.ts";
import { env } from "../src/env.ts";
import { call, tmdbRoutes } from "./helpers.ts";

const matrix = {
  id: 603,
  title: "The Matrix",
  poster_path: "/matrix.jpg",
  release_date: "1999-03-30",
  overview: "A hacker learns the truth.",
  runtime: 136,
  genres: [{ name: "Action" }],
  vote_average: 8.2,
  status: "Released",
};

tmdbRoutes.set("/3/search/movie", () =>
  Response.json({
    page: 1,
    total_pages: 1,
    results: [{ ...matrix }, { id: 604, title: "Reloaded", poster_path: null }],
  }),
);
tmdbRoutes.set("/3/movie/603", () => Response.json(matrix));
// Fictional ids simulating provider failures.
tmdbRoutes.set("/3/movie/offline", () => {
  throw new TypeError("Unable to connect");
});
tmdbRoutes.set(
  "/3/movie/malformed",
  () => new Response("<html>maintenance</html>"),
);
tmdbRoutes.set(
  "/3/movie/down",
  () => new Response("Internal error", { status: 500 }),
);

describe("auth guard", () => {
  test("rejects requests without a session", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/media"),
    );
    expect(response.status).toBe(401);
  });
});

describe("movies", () => {
  let entryId = 0;

  test("search maps TMDB results", async () => {
    const response = await call("GET", "/search?type=movie&q=matrix");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.results).toEqual([
      {
        mediaId: "603",
        source: "tmdb",
        mediaType: "movie",
        title: "The Matrix",
        image: "https://image.tmdb.org/t/p/w500/matrix.jpg",
        year: 1999,
        tracked: false,
      },
      {
        mediaId: "604",
        source: "tmdb",
        mediaType: "movie",
        title: "Reloaded",
        image: "",
        year: null,
        tracked: false,
      },
    ]);
  });

  test("adding a completed movie sets progress from TMDB metadata", async () => {
    const response = await call("POST", "/media", {
      source: "tmdb",
      mediaType: "movie",
      mediaId: "603",
      status: "Completed",
      score: 9,
    });
    expect(response.status).toBe(201);
    const entry = await response.json();
    expect(entry).toMatchObject({
      status: "Completed",
      progress: 1,
      score: 9,
      item: { mediaId: "603", title: "The Matrix" },
    });
    entryId = entry.id;
  });

  test("search flags tracked movies", async () => {
    const data = await (
      await call("GET", "/search?type=movie&q=matrix")
    ).json();
    expect(data.results.map((r: { tracked: boolean }) => r.tracked)).toEqual([
      true,
      false,
    ]);
  });

  test("reaching the maximum while in progress completes the entry", async () => {
    await call("PATCH", `/media/${entryId}`, {
      status: "In progress",
      progress: 0,
    });
    const response = await call("PATCH", `/media/${entryId}`, { progress: 1 });
    expect(response.status).toBe(200);
    const entry = await response.json();
    expect(entry.status).toBe("Completed");
    expect(entry.endDate).not.toBeNull();
  });

  test("dates are accepted as ISO strings", async () => {
    const response = await call("PATCH", `/media/${entryId}`, {
      startDate: "2026-01-02T00:00:00.000Z",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).startDate).toBe("2026-01-02T00:00:00.000Z");
  });

  test("invalid values are rejected", async () => {
    expect(
      (await call("PATCH", `/media/${entryId}`, { score: 11 })).status,
    ).toBe(422);
    expect(
      (await call("PATCH", `/media/${entryId}`, { status: "Watching" })).status,
    ).toBe(422);
    expect(
      (await call("PATCH", `/media/${entryId}`, { progress: -1 })).status,
    ).toBe(422);
  });

  test("the list includes the item", async () => {
    const response = await call("GET", "/media?type=movie");
    const entries = await response.json();
    expect(entries).toHaveLength(1);
    expect(entries[0].item.title).toBe("The Matrix");
  });

  test("the list is unfiltered unless a filter is given", async () => {
    // A rewatch in another status than the existing Completed entry.
    const planned = await call("POST", "/media", {
      source: "tmdb",
      mediaType: "movie",
      mediaId: "603",
      status: "Planning",
    });
    const plannedId = (await planned.json()).id;

    const statuses = async (path: string) =>
      ((await (await call("GET", path)).json()) as { status: string }[])
        .map((entry) => entry.status)
        .sort();
    expect(await statuses("/media")).toEqual(["Completed", "Planning"]);
    expect(await statuses("/media?type=movie")).toEqual([
      "Completed",
      "Planning",
    ]);
    expect(await statuses("/media?status=Planning")).toEqual(["Planning"]);
    expect(await statuses("/media?type=tv")).toEqual([]);

    await call("DELETE", `/media/${plannedId}`);
  });

  test("the detail page returns metadata and entries", async () => {
    const data = await (await call("GET", "/media/tmdb/movie/603")).json();
    expect(data).toMatchObject({ title: "The Matrix", runtime: 136 });
    expect(data.entries).toHaveLength(1);
  });

  test("an unknown TMDB id is a 404", async () => {
    const response = await call("POST", "/media", {
      source: "tmdb",
      mediaType: "movie",
      mediaId: "999",
      status: "Planning",
    });
    expect(response.status).toBe(404);
  });

  test("TMDB failures answer 502 with the reason", async () => {
    const detail = async (mediaId: string) => {
      const response = await call("GET", `/media/tmdb/movie/${mediaId}`);
      return { status: response.status, ...(await response.json()) };
    };
    expect(await detail("offline")).toEqual({
      status: 502,
      message: "TMDB request failed: Unable to connect",
    });
    expect(await detail("malformed")).toEqual({
      status: 502,
      message: "TMDB returned a malformed response",
    });
    expect(await detail("down")).toEqual({
      status: 502,
      message: "TMDB responded with 500",
    });
  });

  test("a movie can't be caught up", async () => {
    const response = await call("POST", "/media", {
      source: "tmdb",
      mediaType: "movie",
      mediaId: "603",
      status: "Caught up",
    });
    expect(response.status).toBe(422);
  });

  test("adding requires a status", async () => {
    const response = await call("POST", "/media", {
      source: "tmdb",
      mediaType: "movie",
      mediaId: "603",
    });
    expect(response.status).toBe(422);
  });

  test("TMDB routes answer 503 without an API key", async () => {
    const key = env.TMDB_API;
    env.TMDB_API = undefined;
    try {
      expect((await call("GET", "/search?type=movie&q=matrix")).status).toBe(
        503,
      );
    } finally {
      env.TMDB_API = key;
    }
  });

  test("deleting removes the entry", async () => {
    expect((await call("DELETE", `/media/${entryId}`)).status).toBe(204);
    expect((await call("DELETE", `/media/${entryId}`)).status).toBe(404);
  });
});
