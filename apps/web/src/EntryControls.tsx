import { useMutation, useQueryClient } from "@tanstack/react-query";
import { statusesFor } from "@usubeni/shared";
import { useState } from "react";
import {
  api,
  type Entry,
  type EntryChanges,
  errorMessage,
  fromDateInput,
  type Status,
  toDateInput,
  unwrap,
} from "./lib/api.ts";
import { fieldClass } from "./lib/ui.ts";

type EntryFields = Pick<
  Entry,
  "id" | "status" | "score" | "progress" | "startDate" | "endDate"
> & { item: Pick<Entry["item"], "mediaType"> };

// Status, score, dates and delete for one tracking entry. Shows and seasons
// derive progress and dates from watched episodes, so those are read-only.
function EntryControls({ entry }: { entry: EntryFields }) {
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Any change can cascade (a season completing its show), so refresh all.
  const refresh = () => queryClient.invalidateQueries();

  const update = useMutation({
    mutationFn: (changes: EntryChanges) =>
      unwrap(api.media({ id: entry.id }).patch(changes)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.media({ id: entry.id }).delete()),
    onSuccess: refresh,
  });
  const error = update.error ?? remove.error;
  const derived = entry.item.mediaType !== "movie";

  return (
    <div className="flex flex-1 flex-wrap items-end gap-3 text-sm">
      <label className="space-y-1">
        <span className="block text-neutral-500">Status</span>
        <select
          value={entry.status}
          onChange={(event) =>
            update.mutate({ status: event.target.value as Status })
          }
          className={fieldClass}
        >
          {statusesFor(entry.item.mediaType).map((value) => (
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
      {derived ? (
        <p className="space-y-1 text-neutral-500">
          <span className="block">
            {entry.progress} episode{entry.progress === 1 ? "" : "s"} watched
          </span>
          <span className="block">
            {entry.startDate ? toDateInput(entry.startDate) : "…"} →{" "}
            {entry.endDate ? toDateInput(entry.endDate) : "…"}
          </span>
        </p>
      ) : (
        <>
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
        </>
      )}
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
  );
}

export default EntryControls;
