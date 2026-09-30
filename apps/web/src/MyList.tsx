import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { statusesFor } from "@usubeni/shared";
import { useTranslation } from "react-i18next";
import EntryControls from "./EntryControls.tsx";
import Poster from "./Poster.tsx";
import TypeTabs from "./TypeTabs.tsx";
import {
  api,
  type Entry,
  errorMessage,
  type Status,
  unwrap,
} from "./lib/api.ts";
import { fieldClass } from "./lib/ui.ts";

function MyList() {
  const { t } = useTranslation();
  const { type, status } = useSearch({ from: "/list" });
  const navigate = useNavigate({ from: "/list" });
  const entries = useQuery({
    queryKey: ["media", type, status],
    queryFn: () => unwrap(api.media.get({ query: { type, status } })),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <TypeTabs
          value={type}
          onChange={(next) => navigate({ search: { type: next } })}
        />
        <select
          value={status ?? ""}
          onChange={(event) =>
            navigate({
              search: {
                type,
                status: (event.target.value || undefined) as Status | undefined,
              },
            })
          }
          aria-label={t("list.filterByStatus")}
          className={fieldClass}
        >
          <option value="">{t("list.allStatuses")}</option>
          {statusesFor(type).map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
      </div>

      {entries.isPending && <p>{t("common.loading")}</p>}
      {entries.isError && (
        <p role="alert" className="text-red-600">
          {errorMessage(entries.error)}
        </p>
      )}
      {entries.data?.length === 0 && <p>{t("list.empty")}</p>}

      <ul className="space-y-3">
        {entries.data?.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  const title =
    entry.item.mediaType === "tv" ? (
      <Link
        to="/tv/$mediaId"
        params={{ mediaId: entry.item.mediaId }}
        className="hover:underline"
      >
        {entry.item.title}
      </Link>
    ) : (
      entry.item.title
    );

  return (
    <li className="flex gap-4 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="w-16 shrink-0">
        <Poster src={entry.item.image} title={entry.item.title} />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-base font-medium">{title}</p>
        <EntryControls entry={entry} />
      </div>
    </li>
  );
}

export default MyList;
