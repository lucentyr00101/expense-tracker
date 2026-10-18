# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read `AGENTS.md` first: this is Next.js 16.4 with breaking changes from older versions. Check `node_modules/next/dist/docs/` before using a Next.js API.

## Commands

Package manager is Bun (`bun.lock`); don't commit a `package-lock.json`.

```bash
bun install
bun run dev          # dev server on :3000
bun run build        # production build; also catches Cache Components errors (see below)
bun run lint         # eslint
bunx tsc --noEmit    # typecheck
bunx next typegen    # regenerate PageProps/LayoutProps route types after adding a route
```

There is no test suite. Verify changes with typecheck, lint, `bun run build`, and the running app (see "Testing signed-in pages").

If the dev server keeps serving old CSS after `app/globals.css` changes, the Turbopack disk cache is stale: stop the server, `rm -rf .next/dev`, restart.

## Environment

`.env.local` (gitignored): `MONGODB_URI` (no database in the URI), `MONGODB_DB` (default `expense-tracker`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

`BETTER_AUTH_URL` must be the deployment's own origin. It sets the Google OAuth `redirect_uri`, so leaving it as `http://localhost:3000` on Vercel sends users back to localhost after Google sign-in. If it is unset, `lib/auth.ts` falls back to `VERCEL_PROJECT_PRODUCTION_URL` and trusts the Vercel deployment URLs. Google's console needs `<origin>/api/auth/callback/google` as an authorized redirect URI.

## Architecture

**Stack:** Next.js App Router with `cacheComponents: true`, React 19, Tailwind v4, Better Auth (Google only) on the native `mongodb` driver (no Mongoose), Recharts, zod, lucide-react.

**Cache Components rules (most common build failure):**
- Any read of `cookies()`, `headers()` or `searchParams`, including `getUser()`, must sit inside a `<Suspense>` boundary. Pages follow one pattern: a sync `default export` renders a header plus `<Suspense fallback={<Skeleton/>}>`, and an inner async component awaits the data. The `searchParams` promise is passed down unawaited.
- Reading the clock (`new Date()`) during render needs `await connection()` first. `getToday()` in `lib/session.ts` does this; use it rather than `new Date()` in server components.
- Data is not cached (`use cache` isn't used). Server Actions call `refresh()` from `next/cache` after a mutation.

**Layers:**
- `lib/db.ts`: MongoClient singleton (kept on `globalThis` in dev). `lib/auth.ts` holds the Better Auth server config, `lib/auth-client.ts` the client one, and `app/api/auth/[...all]/route.ts` the auth handler.
- `proxy.ts` (Next 16's renamed middleware) only does optimistic cookie-presence redirects between `/` and the app routes. Add new protected routes to its `matcher`. Real authorization happens in the data layer.
- `lib/session.ts`: `getUser()` (React `cache`, redirects to `/`), `getLedger()` (user plus `{ ledgerId, role, householdId }`, redirects), `getLedgerContext()` (returns null; for actions and route handlers; replaces the removed `getUserId()`), `getToday()` (uses the viewer's timezone from the `tz` cookie, which `components/timezone-cookie.tsx` sets).
- `lib/data.ts`: the server-only data access layer and the only place that touches collections. Every query is scoped by `ledgerId` (the household's ledger, or the user's own id when solo), and writes record the `createdBy` user. Returns plain serializable objects (ids as hex strings).
- `lib/household.ts`: households, invites and membership. `resolveLedger(userId)` maps a user to their ledger and role (owner, editor, viewer) on every request, so removals and role changes apply immediately, even to stale pages. Pages take a `canEdit` prop and hide add/edit controls for viewers; the server check is what counts.
- `app/actions.ts`: Server Actions. They re-authenticate with `getLedgerContext()`, refuse viewers ("You have view-only access to this household."), validate with zod, call `lib/data.ts`, and return `ActionState` `{ ok, error? }` for `useActionState`. `app/api/export/route.ts` produces the CSV export.

**Data model (MongoDB collections):**
- `categories`: `ledgerId: null` marks system categories, seeded idempotently by `ensureSetup()` from `lib/category-defs.ts` (upsert on a stable `key`). Two levels only: `parentId` points to a top-level category. User categories are archived (`archivedAt`), never deleted, so old transactions keep their category.
- `transactions`: `amount` is integer **cents**, `date` is **UTC midnight** of the calendar day, and both `categoryId` (top level) and `subcategoryId` are stored. Picking a subcategory in the UI sends its id, and `resolveCategory` splits it into parent and sub.
- `ledgerId` (not `userId`) scopes `categories`, `transactions` and `budgets`. `transactions` also carry `createdBy`, shown as the author avatar. Legacy `userId` docs are renamed to `ledgerId` (with `createdBy` set) by the migration at the top of `ensureSetup()`, which `resolveLedger` runs on first use.
- `budgets`: one monthly amount per top-level expense category, repeating every month.
- `settings`: `_id` is the ledgerId; holds `currency` (display only, no conversion).
- `households`: `{ ledgerId, ownerId, members: [{ userId, role, joinedAt }] }`. One household per user (unique index on `members.userId`). Its ledger id is the original owner's. A household of one is dissolved and the owner keeps the ledger.
- `invites`: `{ householdId, email, role, invitedBy }`, for registered emails only. Accepting offers merge (move the invitee's data into the household) or replace (delete it). Leaving or removal gives the user an empty ledger.
- `userLedgers`: `_id` is the userId; pins a user to a fresh empty ledger after leaving or removal.
- Better Auth owns `user`, `session`, `account` and `verification`.

**Dates and ranges (`lib/dates.ts`, shared client/server):** calendar dates are `YYYY-MM-DD` strings, and all math is in UTC so the server's timezone never matters. `resolveRange()` turns dashboard URL params (`preset` = today|week|month|year|last|custom, `n`, `unit`, `offset`, `from`, `to`, `group`) into a concrete range and bar size, widening the grouping when it would produce more than 400 bars. Weeks start Monday. Aggregation buckets come from Mongo `$dateTrunc` with `timezone: "UTC"`, `startOfWeek: "monday"`, and empty buckets are filled by `buckets()`.

**UI:**
- Design tokens are CSS variables in `app/globals.css`, mapped to Tailwind colors in `@theme inline` (`bg-surface`, `text-muted`, `bg-primary`, `text-expense`…). The theme is light only (warm gold & plum). Reusable classes `.glass`, `.field`, `.label`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger` and `.icon-btn` are defined there. Use tokens, not raw hex.
- `design-system/expense-tracker/MASTER.md` records the palette and the reasons behind it. Chart series colors (`--series-expense`, `--series-income`) were checked for colorblind separation, so re-validate before changing them.
- Dialogs use `components/modal.tsx` (native `<dialog>`). Put `data-autofocus` on the field that should get focus. React's `autoFocus` doesn't work because it runs before `showModal()`.
- Give `<select>` and other form controls an explicit `aria-label` or `htmlFor` label. A wrapping `<label>` pulls the selected option's text into the accessible name.

## Testing signed-in pages

Google sign-in can't be automated. Point `MONGODB_DB` at a non-production database (e.g. `expense-tracker-dev`) and check it first. To render authenticated pages locally, create a test session through Better Auth's internal adapter in a tsx script run with `NODE_OPTIONS=--conditions=react-server` and `.env.local` loaded:

1. Get `(await auth.$context).internalAdapter`.
2. Call `createUser` and `createSession`.
3. Set the cookie `better-auth.session_token` to `encodeURIComponent(token + "." + base64(HMAC-SHA256(BETTER_AUTH_SECRET, token)))`.
4. Drive the browser with `playwright-cli` (`goto`, `screenshot`). `cookie-set` can fail with "Invalid cookie fields": `goto` the origin, then `eval "document.cookie='better-auth.session_token=<value>; path=/'"`. Use one named session (`-s=a`, `-s=b`) per user so each keeps its own cookie.
5. Delete the test users and their data afterwards (users, sessions, transactions, categories, budgets, settings, households, invites, `userLedgers`).

Scripts that import `lib/*.ts` run with `bun --conditions=react-server --env-file=.env.local` (`server-only` throws without that condition).

## Git

Conventional commits (`feat:`, `fix:`, `style:`, …). Don't add `Co-Authored-By` lines. `.vscode/` is the user's local editor config and should not be committed.
