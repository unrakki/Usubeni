# Usubeni

Bun + Turborepo monorepo.

## Stack

| Workspace         | Stack                                                              |
| ----------------- | ------------------------------------------------------------------ |
| `apps/api`        | Elysia, Drizzle ORM (SQLite via `bun:sqlite`), better-auth, BullMQ |
| `apps/web`        | React, Vite, Tailwind CSS v4, TanStack Query, Eden Treaty          |
| `packages/shared` | API types (`App`) shared with the web client                       |

Validation uses TypeBox (`t` from Elysia).

## Prerequisites

- [Bun](https://bun.sh) 1.4.2
- Docker (for Redis)

## Setup

```sh
bun install
cp .env.example .env   # then set BETTER_AUTH_SECRET
docker compose up -d
(cd apps/api && bun run db:migrate)
```

On first launch the web app asks you to create the account. Sign-up closes once it exists.

## Scripts

Run from the repository root:

| Command               | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `bun run dev`         | API on http://localhost:3000, web on http://localhost:5173 |
| `bun run build`       | Build all workspaces                                       |
| `bun run check-types` | Type-check all workspaces                                  |
| `bun run lint`        | Lint with oxlint                                           |
| `bun run format`      | Format with Prettier                                       |

From `apps/api`:

| Command               | Description                                     |
| --------------------- | ----------------------------------------------- |
| `bun run db:generate` | Generate SQL migrations from `src/db/schema.ts` |
| `bun run db:migrate`  | Apply pending migrations to `db.sqlite`         |
