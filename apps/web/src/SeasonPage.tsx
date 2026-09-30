import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import AddButton from "./AddButton.tsx";
import EntryControls from "./EntryControls.tsx";
import { api, errorMessage, toDateInput, unwrap } from "./lib/api.ts";
import { fieldClass } from "./lib/ui.ts";

function SeasonPage() {
  const { mediaId, seasonNumber } = useParams({
    from: "/tv/$mediaId/season/$seasonNumber",
  });
  const queryClient = useQueryClient();
  const seasonApi = api.media.tmdb.tv({ mediaId }).season({ seasonNumber });

  const season = useQuery({
    queryKey: ["season", mediaId, seasonNumber],
    queryFn: () => unwrap(seasonApi.get()),
  });
  // Watching can change the show, the season and the list; refresh them all.
  const refresh = () => queryClient.invalidateQueries();
  const watch = useMutation({
    mutationFn: (episodeNumber: number) =>
      unwrap(seasonApi.episode({ episodeNumber }).watch.post()),
    onSuccess: refresh,
  });
  const unwatch = useMutation({
    mutationFn: (episodeNumber: number) =>
      unwrap(seasonApi.episode({ episodeNumber }).watch.delete()),
    onSuccess: refresh,
  });
  const busy = watch.isPending || unwatch.isPending;
  const error = watch.error ?? unwatch.error;

  if (season.isPending) return <p>Loading…</p>;
  if (season.isError) {
    return (
      <p role="alert" className="text-red-600">
        {errorMessage(season.error)}
      </p>
    );
  }
  const data = season.data;

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <Link
          to="/tv/$mediaId"
          params={{ mediaId }}
          className="text-sm text-neutral-500 hover:underline"
        >
          ← {data.showTitle}
        </Link>
        <h2 className="text-2xl font-semibold">{data.title}</h2>
        {data.entry ? (
          <EntryControls entry={data.entry} />
        ) : (
          <AddButton
            mediaType="season"
            mediaId={mediaId}
            seasonNumber={seasonNumber}
          />
        )}
      </header>

      {error && (
        <p role="alert" className="text-red-600">
          {errorMessage(error)}
        </p>
      )}

      <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {data.episodes.map((episode) => {
          const watched = episode.viewings.length > 0;
          const last = episode.viewings.at(-1);
          // Matches the API: dated episodes can't be watched before they air.
          const upcoming = episode.airDate !== null && !episode.aired;
          return (
            <li
              key={episode.episodeNumber}
              className="flex items-center gap-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={watched}
                disabled={busy || (upcoming && !watched)}
                onChange={() =>
                  watched
                    ? unwatch.mutate(episode.episodeNumber)
                    : watch.mutate(episode.episodeNumber)
                }
                aria-label={`Watched episode ${episode.episodeNumber}`}
              />
              <span className="w-8 text-neutral-500">
                {episode.episodeNumber}
              </span>
              <span className="flex-1">{episode.title}</span>
              <span className="text-neutral-500">
                {episode.aired
                  ? episode.airDate
                  : `Airs ${episode.airDate ?? "later"}`}
              </span>
              {watched && (
                <span className="text-neutral-500">
                  {episode.viewings.length > 1 &&
                    `×${episode.viewings.length} · `}
                  {last?.endDate ? toDateInput(last.endDate) : "date unknown"}
                </span>
              )}
              {watched && (
                <button
                  type="button"
                  onClick={() => watch.mutate(episode.episodeNumber)}
                  disabled={busy}
                  className={fieldClass}
                >
                  Rewatch
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export default SeasonPage;
