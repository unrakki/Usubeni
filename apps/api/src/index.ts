// Declared here so the web app, which imports the App type from this file, can
// type-check the Bun-specific modules it pulls in.
/// <reference types="bun-types" />
import { app } from "./app.ts";

app.listen(3000);

console.log(`API running at ${app.server?.url}`);

export type App = typeof app;
