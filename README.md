This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Running locally

Requires Node.js 22.4+ (the test suite uses `--no-experimental-webstorage`, a flag Node 20 rejects — see `.github/workflows/ci.yml` for details).

1. Copy `.env.example` to `.env.local` and fill in the two required variables (`DATABASE_URL` from your Neon project's pooled connection string, `BETTER_AUTH_SECRET` generated via `openssl rand -base64 32`).
2. `npm install`
3. `npm run db:push` — applies the Drizzle schema to your Neon database.
4. `npm run dev` — starts the full stack against the real Neon database.

## E2E tests

`npm run test:e2e` runs the full Playwright suite locally against whatever `DATABASE_URL` is already configured in `.env.local` — there is no isolated branch when run locally (see `e2e/global-setup.ts`'s CI-only guard).

In CI, the same suite runs against a throwaway, isolated Neon branch that is created before the run and destroyed afterward, whether the tests pass or fail (see the `e2e` job in `.github/workflows/ci.yml`).

This repo also ships a pre-configured `.mcp.json` for `@playwright/mcp`, so a Claude Code (or other MCP-aware) session can drive/inspect the running dev server directly for interactive test authoring/debugging — start `npm run dev` first, then the Playwright MCP tools become available in-session.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
