# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Extension files

- The downloadable Facebook extension is sourced from `attached_assets/koren_extracted`.
- The public ZIP download is available as `artifacts/fb-extension-page/public/Shourov-Fb-AutoLogin.zip`.
- In Replit, the `Start application` workflow runs the Vite website on port 5000 and the `API server` workflow runs the API on port 8080. The website and admin panel are available at `/` and `/admin`.
- To start them manually, use `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/fb-extension-page run dev` and `PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev`.

## Render deployment

The root `render.yaml` configures one Node web service that builds the Vite website and API together. The API serves the website in production, including `/admin`, and exposes `/api/healthz` as its health check.

- Build: `pnpm install --frozen-lockfile && pnpm --filter @workspace/fb-extension-page run build && pnpm --filter @workspace/api-server run build`
- Start: `node --max-old-space-size=512 artifacts/api-server/dist/index.mjs`
- Required Render variables: `ADMIN_PASSWORD`, `API_BASE_URL` (the new Render service URL), and generated `SESSION_SECRET`
- Admin panel: `/admin`
- After creating the Render web service from this repository, set `ADMIN_PASSWORD` to the password you want to use and set `API_BASE_URL` to the service's public URL, for example `https://your-service.onrender.com`. Keep the generated `SESSION_SECRET` unchanged.
- After the first successful deploy, open `https://your-service.onrender.com/` for the website and `https://your-service.onrender.com/admin` for the admin panel. Render's health check is `https://your-service.onrender.com/api/healthz`.
- The same Render service serves both routes; do not create a separate static-site service for the frontend.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
