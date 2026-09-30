import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import AddButton from "./AddButton.tsx";
import EntryControls from "./EntryControls.tsx";
import Poster from "./Poster.tsx";
import { api, errorMessage, unwrap } from "./lib/api.ts";

function ShowPage() {
  const { t } = useTranslation();
  const { mediaId } = useParams({ from: "/tv/$mediaId" });
  const show = useQuery({
    queryKey: ["show", mediaId],
    queryFn: () => unwrap(api.media.tmdb.tv({ mediaId }).get()),
  });

  if (show.isPending) return <p>{t("common.loading")}</p>;
  if (show.isError) {
    return (
      <p role="alert" className="text-red-600">
        {errorMessage(show.error)}
      </p>
    );
  }
  const data = show.data;

  return (
    <article className="space-y-6">
      <header className="flex gap-4">
        <div className="w-32 shrink-0">
          <Poster src={data.image} title={data.title} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">
            {data.title}
            {data.year && (
              <span className="text-neutral-500"> ({data.year})</span>
            )}
          </h2>
          <p className="text-sm text-neutral-500">
            {data.status}
            {data.genres.length > 0 && ` · ${data.genres.join(", ")}`}
          </p>
          <p className="text-sm">{data.synopsis}</p>
          {data.entry ? (
            <EntryControls entry={data.entry} />
          ) : (
            <AddButton mediaType="tv" mediaId={mediaId} />
          )}
        </div>
      </header>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">{t("show.seasons")}</h3>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {data.seasons.map((season) => (
            <li
              key={season.seasonNumber}
              className="flex items-center gap-3 py-2 text-sm"
            >
              <Link
                to="/tv/$mediaId/season/$seasonNumber"
                params={{ mediaId, seasonNumber: season.seasonNumber }}
                className="font-medium hover:underline"
              >
                {season.title}
              </Link>
              <span className="text-neutral-500">
                {season.airedEpisodeCount < season.episodeCount
                  ? t("show.airedCount", {
                      aired: season.airedEpisodeCount,
                      total: season.episodeCount,
                    })
                  : t("show.episodeCount", { count: season.episodeCount })}
              </span>
              {season.entry && (
                <span className="ml-auto text-neutral-500">
                  {t(`status.${season.entry.status}`)} ·{" "}
                  {t("show.watchedCount", { count: season.entry.progress })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

export default ShowPage;
