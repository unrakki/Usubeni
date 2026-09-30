import { useTranslation } from "react-i18next";

export type ListType = "movie" | "tv";

const TYPES: ListType[] = ["movie", "tv"];

function TypeTabs({
  value,
  onChange,
}: {
  value: ListType;
  onChange: (type: ListType) => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="tablist" className="flex gap-1">
      {TYPES.map((type) => (
        <button
          key={type}
          type="button"
          role="tab"
          aria-selected={value === type}
          onClick={() => onChange(type)}
          className="rounded px-3 py-1 aria-selected:bg-neutral-200 dark:aria-selected:bg-neutral-800"
        >
          {t(`mediaTypes.${type}`)}
        </button>
      ))}
    </div>
  );
}

export default TypeTabs;
