import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import AddButton from "./AddButton.tsx";
import Poster from "./Poster.tsx";
import TypeTabs from "./TypeTabs.tsx";
import { api, errorMessage, unwrap } from "./lib/api.ts";
import { fieldClass } from "./lib/ui.ts";

function Search() {
  const { t } = useTranslation();
  const { type, q } = useSearch({ from: "/search" });
  const navigate = useNavigate({ from: "/search" });
  const label = t(`search.placeholder.${type}`);

  const results = useQuery({
    queryKey: ["search", type, q],
    queryFn: () => unwrap(api.search.get({ query: { type, q } })),
    enabled: q !== "",
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    navigate({ search: { type, q: String(form.get("q")).trim() } });
  }

  return (
    <section className="space-y-4">
      <TypeTabs
        value={type}
        onChange={(next) => navigate({ search: { type: next, q } })}
      />
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          // Remount so the field shows the query from the URL.
          key={q}
          name="q"
          type="search"
          defaultValue={q}
          placeholder={label}
          aria-label={label}
          className={`${fieldClass} flex-1`}
        />
        <button type="submit" className={fieldClass}>
          {t("search.submit")}
        </button>
      </form>

      {results.isFetching && <p>{t("search.searching")}</p>}
      {results.isError && (
        <p role="alert" className="text-red-600">
          {t("search.failed", { message: errorMessage(results.error) })}
        </p>
      )}
      {results.data && results.data.results.length === 0 && (
        <p>{t("search.noResults")}</p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {results.data?.results.map((result) => (
          <li key={result.mediaId} className="space-y-2">
            <Poster src={result.image} title={result.title} />
            <p className="text-sm font-medium">
              {result.mediaType === "tv" ? (
                <Link
                  to="/tv/$mediaId"
                  params={{ mediaId: result.mediaId }}
                  className="hover:underline"
                >
                  {result.title}
                </Link>
              ) : (
                result.title
              )}
              {result.year && (
                <span className="text-neutral-500"> ({result.year})</span>
              )}
            </p>
            {result.tracked ? (
              <p className="text-sm text-neutral-500">{t("search.inList")}</p>
            ) : (
              <AddButton mediaType={type} mediaId={result.mediaId} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default Search;
