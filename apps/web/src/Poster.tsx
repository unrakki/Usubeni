function Poster({ src, title }: { src: string; title: string }) {
  // TMDB has no poster for some titles; the API stores an empty string then.
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="aspect-[2/3] w-full rounded object-cover"
    />
  ) : (
    <div className="flex aspect-[2/3] w-full items-center justify-center rounded bg-neutral-200 p-2 text-center text-xs text-neutral-500 dark:bg-neutral-800">
      {title}
    </div>
  );
}

export default Poster;
