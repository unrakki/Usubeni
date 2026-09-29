import { treaty } from "@elysiajs/eden";
import type { App } from "@usubeni/shared";

export const api = treaty<App>("http://localhost:3000");
