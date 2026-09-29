import { useQuery } from "@tanstack/react-query";
import { api } from "./lib/api.ts";

function App() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.health.get();
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="font-mono text-lg">
        API:{" "}
        {health.isPending
          ? "checking…"
          : health.isError
            ? "unreachable"
            : health.data.status}
      </p>
    </main>
  );
}

export default App;
