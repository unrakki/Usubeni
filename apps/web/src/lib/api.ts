import { treaty } from "@elysiajs/eden";
import type { App } from "@usubeni/shared";

// The API is served under /api on the same origin (Vite proxies it in dev).
export const api = treaty<App>(window.location.origin).api;
