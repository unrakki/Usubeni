// A TS module rather than JSON: `as const` keeps the literal strings, so the
// type checker catches unknown keys and misnamed interpolation variables.
const en = {
  common: {
    loading: "Loading…",
    error: "Error",
    apiUnreachable: "API unreachable",
    status: "Status",
  },
  status: {
    Completed: "Completed",
    "In progress": "In progress",
    "Caught up": "Caught up",
    Planning: "Planning",
    Paused: "Paused",
    Dropped: "Dropped",
  },
  mediaTypes: {
    movie: "Movies",
    tv: "TV shows",
  },
  auth: {
    setupTitle: "Create your account",
    setupSubmit: "Create account",
    signIn: "Sign in",
    name: "Name",
    email: "Email",
    password: "Password",
    genericError: "Something went wrong",
  },
  nav: {
    myList: "My list",
    search: "Search",
    signOut: "Sign out",
  },
  list: {
    filterByStatus: "Filter by status",
    allStatuses: "All statuses",
    empty: "Nothing here yet. Use Search to add some.",
  },
  search: {
    placeholder: {
      movie: "Search movies",
      tv: "Search TV shows",
    },
    submit: "Search",
    searching: "Searching…",
    failed: "Search failed: {{message}}",
    noResults: "No results.",
    inList: "In your list",
  },
  entry: {
    add: "Add",
    score: "Score",
    started: "Started",
    finished: "Finished",
    episodesWatched_one: "{{count}} episode watched",
    episodesWatched_other: "{{count}} episodes watched",
    delete: "Delete",
    confirmDelete: "Confirm delete",
    cancel: "Cancel",
  },
  show: {
    seasons: "Seasons",
    airedCount: "{{aired}}/{{total}} aired",
    episodeCount_one: "{{count}} episode",
    episodeCount_other: "{{count}} episodes",
    watchedCount_one: "{{count}} watched",
    watchedCount_other: "{{count}} watched",
  },
  season: {
    watchedEpisode: "Watched episode {{number}}",
    airs: "Airs {{date}}",
    airsLater: "Airs later",
    viewings: "×{{count}}",
    dateUnknown: "date unknown",
    rewatch: "Rewatch",
  },
} as const;

export default en;
