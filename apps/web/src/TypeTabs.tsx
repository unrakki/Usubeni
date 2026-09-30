export type ListType = "movie" | "tv";

const LABELS: Record<ListType, string> = { movie: "Movies", tv: "TV shows" };

function TypeTabs({
  value,
  onChange,
}: {
  value: ListType;
  onChange: (type: ListType) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1">
      {(Object.keys(LABELS) as ListType[]).map((type) => (
        <button
          key={type}
          type="button"
          role="tab"
          aria-selected={value === type}
          onClick={() => onChange(type)}
          className="rounded px-3 py-1 aria-selected:bg-neutral-200 dark:aria-selected:bg-neutral-800"
        >
          {LABELS[type]}
        </button>
      ))}
    </div>
  );
}

export default TypeTabs;
