import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "./lib/auth.ts";

type Mode = "setup" | "login";

const inputClass =
  "w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900";

function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    setSubmitting(true);
    setError(null);
    const result =
      mode === "setup"
        ? await authClient.signUp.email({
            name: String(form.get("name")),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });
    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? t("auth.genericError"));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["setup"] });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">
          {mode === "setup" ? t("auth.setupTitle") : t("auth.signIn")}
        </h1>
        {mode === "setup" && (
          <label className="block space-y-1">
            <span className="text-sm">{t("auth.name")}</span>
            <input name="name" required className={inputClass} />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-sm">{t("auth.email")}</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm">{t("auth.password")}</span>
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "setup" ? "new-password" : "current-password"
            }
            minLength={8}
            required
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {mode === "setup" ? t("auth.setupSubmit") : t("auth.signIn")}
        </button>
      </form>
    </main>
  );
}

export default AuthForm;
