import { spyOn } from "bun:test";
import { app } from "../src/app.ts";

// Test files share one in-memory database and the app allows one account, so
// they share one session and one TMDB stand-in.

type Handler = () => Response;

// TMDB paths (e.g. "/3/movie/603") to the response the stand-in returns.
export const tmdbRoutes = new Map<string, Handler>();

spyOn(globalThis, "fetch").mockImplementation((async (
  input: string | URL | Request,
) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const handler = tmdbRoutes.get(url.pathname);
  return handler ? handler() : new Response("Not found", { status: 404 });
}) as typeof fetch);

let cookie: Promise<string> | undefined;

function signUp() {
  return app
    .handle(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          origin: "http://localhost:5173",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Test",
          email: "test@example.com",
          password: "password123",
        }),
      }),
    )
    .then((response) => {
      if (response.status !== 200) {
        throw new Error(`Test sign-up failed with ${response.status}`);
      }
      return response.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
    });
}

export async function call(method: string, path: string, body?: unknown) {
  cookie ??= signUp();
  return app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        cookie: await cookie,
        origin: "http://localhost:5173",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
