import { useQuery } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import AuthForm from "./AuthForm.tsx";
import { api } from "./lib/api.ts";
import { authClient } from "./lib/auth.ts";
import { router } from "./router.tsx";

function App() {
  const { t } = useTranslation();
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
    return <Centered>{t("common.loading")}</Centered>;
  }
  if (setup.isError) {
    return <Centered>{t("common.apiUnreachable")}</Centered>;
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
