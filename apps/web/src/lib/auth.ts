import { createAuthClient } from "better-auth/react";

// Defaults to /api/auth on the current origin.
export const authClient = createAuthClient();
