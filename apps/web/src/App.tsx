import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import AuthForm from "./AuthForm.tsx";
import MyList from "./MyList.tsx";
import Search from "./Search.tsx";
import { api } from "./lib/api.ts";
import { authClient } from "./lib/auth.ts";

function App() {
  const session = authClient.useSession();
  const setup = useQuery({
    queryKey: ["setup"],
    queryFn: async () => {
      const { data, error } = await api.setup.get();
      if (error) throw error;
      return data;
    },
  });

  if (session.isPending || setup.isPending) {
    return <Centered>Loading…</Centered>;
  }
  if (setup.isError) {
    return <Centered>API unreachable</Centered>;
  }
  if (!session.data) {
    return <AuthForm mode={setup.data.needsSetup ? "setup" : "login"} />;
  }

  return <Shell />;
}

const TABS = { list: "My list", search: "Search" } as const;

function Shell() {
  const [tab, setTab] = useState<keyof typeof TABS>("list");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">Usubeni</h1>
        <nav className="flex gap-1">
          {Object.entries(TABS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key as keyof typeof TABS)}
              className="rounded px-3 py-1 aria-[current=page]:bg-neutral-200 dark:aria-[current=page]:bg-neutral-800"
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => authClient.signOut()}
          className="ml-auto rounded border border-neutral-300 px-3 py-1 dark:border-neutral-700"
        >
          Sign out
        </button>
      </header>
      <main>{tab === "list" ? <MyList /> : <Search />}</main>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      {children}
    </main>
  );
}

export default App;
