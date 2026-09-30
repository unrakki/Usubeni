import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { statusesFor } from "@usubeni/shared";
import MyList from "./MyList.tsx";
import Search from "./Search.tsx";
import SeasonPage from "./SeasonPage.tsx";
import Shell from "./Shell.tsx";
import ShowPage from "./ShowPage.tsx";
import type { ListType } from "./TypeTabs.tsx";
import type { Status } from "./lib/api.ts";

// Search params come from the URL, so anything unexpected falls back.
const listType = (value: unknown): ListType =>
  value === "tv" ? "tv" : "movie";

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/list", search: { type: "movie" } });
  },
});

const listRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/list",
  validateSearch: (
    search: Record<string, unknown>,
  ): { type: ListType; status?: Status } => {
    const type = listType(search.type);
    const status = statusesFor(type).find((s) => s === search.status);
    return status ? { type, status } : { type };
  },
  component: MyList,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  validateSearch: (search: Record<string, unknown>) => ({
    type: listType(search.type),
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: Search,
});

const showRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tv/$mediaId",
  component: ShowPage,
});

const seasonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tv/$mediaId/season/$seasonNumber",
  params: {
    parse: (params) => ({
      ...params,
      seasonNumber: Number(params.seasonNumber),
    }),
    stringify: (params) => ({
      ...params,
      seasonNumber: String(params.seasonNumber),
    }),
  },
  component: SeasonPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    listRoute,
    searchRoute,
    showRoute,
    seasonRoute,
  ]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
