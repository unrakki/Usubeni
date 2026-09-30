import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STATUSES } from "@usubeni/shared";
import { useState } from "react";
import Poster from "./Poster.tsx";
import {
  api,
  errorMessage,
  fromDateInput,
  toDateInput,
  unwrap,
} from "./lib/api.ts";

type Status = (typeof STATUSES)[number];
type Entry = Awaited<ReturnType<typeof fetchMovies>>[number];
type Changes = Parameters<ReturnType<typeof api.media>["patch"]>[0];

const fieldClass =
  "rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900";

const fetchMovies = (status: Status | undefined) =>
  unwrap(api.media.get({ query: { type: "movie", status } }));

function MyList() {
  const [status, setStatus] = useState<Status | undefined>();
  const entries = useQuery({
    queryKey: ["media", "movie", status],
    queryFn: () => fetchMovies(status),
  });

  return (
    <section className="space-y-4">
      <select
        value={status ?? ""}
        onChange={(event) =>
          setStatus((event.target.value || undefined) as Status | undefined)
        }
        aria-label="Filter by status"
        className={fieldClass}
      >
        <option value="">All statuses</option>
        {STATUSES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>

      {entries.isPending && <p>Loading…</p>}
      {entries.isError && (
        <p role="alert" className="text-red-600">
          {errorMessage(entries.error)}
        </p>
      )}
      {entries.data?.length === 0 && (
        <p>Nothing here yet. Use Search to add movies.</p>
      )}

      <ul className="space-y-3">
        {entries.data?.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["media"] }),
      queryClient.invalidateQueries({ queryKey: ["search"] }),
    ]);

  const update = useMutation({
    mutationFn: (changes: Changes) =>
      unwrap(api.media({ id: entry.id }).patch(changes)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.media({ id: entry.id }).delete()),
    onSuccess: refresh,
  });
  const error = update.error ?? remove.error;

  return (
    <li className="flex gap-4 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="w-16 shrink-0">
        <Poster src={entry.item.image} title={entry.item.title} />
      </div>
      <div className="flex flex-1 flex-wrap items-end gap-3 text-sm">
        <p className="w-full text-base font-medium">{entry.item.title}</p>
        <label className="space-y-1">
          <span className="block text-neutral-500">Status</span>
          <select
            value={entry.status}
            onChange={(event) =>
              update.mutate({ status: event.target.value as Status })
            }
            className={fieldClass}
          >
            {STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-neutral-500">Score</span>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            defaultValue={entry.score ?? ""}
            onBlur={(event) => {
              const input = event.target;
              const score = input.value === "" ? null : Number(input.value);
              if (score === entry.score) return;
              update.mutate(
                { score },
                // Uncontrolled input: put the stored score back if rejected.
                { onError: () => (input.value = String(entry.score ?? "")) },
              );
            }}
            className={`${fieldClass} w-20`}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-neutral-500">Started</span>
          <input
            type="date"
            value={toDateInput(entry.startDate)}
            onChange={(event) =>
              update.mutate({ startDate: fromDateInput(event.target.value) })
            }
            className={fieldClass}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-neutral-500">Finished</span>
          <input
            type="date"
            value={toDateInput(entry.endDate)}
            onChange={(event) =>
              update.mutate({ endDate: fromDateInput(event.target.value) })
            }
            className={fieldClass}
          />
        </label>
        {confirmingDelete ? (
          <span className="flex gap-1">
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className={`${fieldClass} text-red-600`}
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className={fieldClass}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className={fieldClass}
          >
            Delete
          </button>
        )}
        {error && (
          <p role="alert" className="w-full text-red-600">
            {errorMessage(error)}
          </p>
        )}
      </div>
    </li>
  );
}

export default MyList;
