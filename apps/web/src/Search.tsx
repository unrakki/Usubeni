import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STATUSES } from "@usubeni/shared";
import { type FormEvent, useState } from "react";
import Poster from "./Poster.tsx";
import { api, errorMessage, unwrap } from "./lib/api.ts";

type Status = (typeof STATUSES)[number];

const fieldClass =
  "rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900";

function Search() {
  const [query, setQuery] = useState("");

  const results = useQuery({
    queryKey: ["search", "movie", query],
    queryFn: () =>
      unwrap(api.search.get({ query: { type: "movie", q: query } })),
    enabled: query !== "",
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setQuery(String(form.get("q")).trim());
  }

  return (
    <section className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          name="q"
          type="search"
          placeholder="Search movies"
          aria-label="Search movies"
          className={`${fieldClass} flex-1`}
        />
        <button type="submit" className={fieldClass}>
          Search
        </button>
      </form>

      {results.isFetching && <p>Searching…</p>}
      {results.isError && (
        <p role="alert" className="text-red-600">
          Search failed: {errorMessage(results.error)}
        </p>
      )}
      {results.data && results.data.results.length === 0 && <p>No results.</p>}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {results.data?.results.map((movie) => (
          <li key={movie.mediaId} className="space-y-2">
            <Poster src={movie.image} title={movie.title} />
            <p className="text-sm font-medium">
              {movie.title}
              {movie.year && (
                <span className="text-neutral-500"> ({movie.year})</span>
              )}
            </p>
            {movie.tracked ? (
              <p className="text-sm text-neutral-500">In your list</p>
            ) : (
              <AddMovie mediaId={movie.mediaId} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AddMovie({ mediaId }: { mediaId: string }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("Planning");
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        api.media.post({ source: "tmdb", mediaType: "movie", mediaId, status }),
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["search"] }),
        queryClient.invalidateQueries({ queryKey: ["media"] }),
      ]),
  });

  return (
    <div className="flex flex-wrap gap-1 text-sm">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value as Status)}
        aria-label="Status"
        className={fieldClass}
      >
        {STATUSES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => add.mutate()}
        disabled={add.isPending}
        className={`${fieldClass} disabled:opacity-50`}
      >
        Add
      </button>
      {add.isError && (
        <p role="alert" className="w-full text-red-600">
          {errorMessage(add.error)}
        </p>
      )}
    </div>
  );
}

export default Search;
