import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { user } from "./db/auth-schema.ts";
import { db } from "./db/index.ts";
import { env } from "./env.ts";

export const hasUser = () =>
  db.select({ id: user.id }).from(user).limit(1).get() !== undefined;

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  databaseHooks: {
    user: {
      create: {
        // Single-user: sign-up only exists to create the first account. This
        // gives a clear error; the user_singleton trigger (migration 0002)
        // covers concurrent sign-ups that both pass this check.
        before: async () => {
          if (hasUser()) {
            throw new APIError("FORBIDDEN", {
              message: "An account already exists",
            });
          }
        },
      },
    },
  },
});
