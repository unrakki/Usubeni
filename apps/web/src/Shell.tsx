import { Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authClient } from "./lib/auth.ts";

const navClass =
  "rounded px-3 py-1 data-[status=active]:bg-neutral-200 dark:data-[status=active]:bg-neutral-800";

function Shell() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Usubeni</h1>
        <nav className="flex gap-1">
          <Link to="/list" search={{ type: "movie" }} className={navClass}>
            {t("nav.myList")}
          </Link>
          <Link
            to="/search"
            search={{ type: "movie", q: "" }}
            className={navClass}
          >
            {t("nav.search")}
          </Link>
        </nav>
        <button
          type="button"
          onClick={() => authClient.signOut()}
          className="ml-auto rounded border border-neutral-300 px-3 py-1 dark:border-neutral-700"
        >
          {t("nav.signOut")}
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Shell;
