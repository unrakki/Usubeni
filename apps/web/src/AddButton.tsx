import { useMutation, useQueryClient } from "@tanstack/react-query";
import { statusesFor } from "@usubeni/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, errorMessage, type Status, unwrap } from "./lib/api.ts";
import { fieldClass } from "./lib/ui.ts";

type Target =
  | { mediaType: "movie" | "tv"; mediaId: string }
  | { mediaType: "season"; mediaId: string; seasonNumber: number };

// Adds a movie, show or season to the list with the chosen status.
function AddButton(target: Target) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("Planning");
  const add = useMutation({
    mutationFn: () =>
      unwrap(api.media.post({ source: "tmdb", ...target, status })),
    // Adding can create the show entry too; refresh everything.
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="flex flex-wrap gap-1 text-sm">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value as Status)}
        aria-label={t("common.status")}
        className={fieldClass}
      >
        {statusesFor(target.mediaType).map((value) => (
          <option key={value} value={value}>
            {t(`status.${value}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => add.mutate()}
        disabled={add.isPending}
        className={`${fieldClass} disabled:opacity-50`}
      >
        {t("entry.add")}
      </button>
      {add.isError && (
        <p role="alert" className="w-full text-red-600">
          {errorMessage(add.error)}
        </p>
      )}
    </div>
  );
}

export default AddButton;
