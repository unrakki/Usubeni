import { useQuery } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import AuthForm from "./AuthForm.tsx";
import { api } from "./lib/api.ts";
import { authClient } from "./lib/auth.ts";
import { router } from "./router.tsx";

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

  return <RouterProvider router={router} />;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      {children}
    </main>
  );
}

export default App;
