# Household Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let registered users share one combined household ledger, with an owner who invites members as editors or viewers.

**Architecture:** All user data is scoped by a `ledgerId` instead of `userId`. A solo user's ledger id is their userId, so existing data only needs a field rename. A new `lib/household.ts` resolves the current user's ledger and role, and owns the `households`, `invites` and `userLedgers` collections. Pages and actions get `{ userId, ledgerId, role }` from `lib/session.ts`. Mutating actions require an editor or owner. Membership actions require the owner.

**Tech Stack:** Next.js 16 App Router (`cacheComponents`), React 19, MongoDB native driver, Better Auth, zod, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-18-household-sharing-design.md`

## Global Constraints

- **Never run this branch against the production database.** `.env.local` currently has `MONGODB_DB=expense-tracker`, which is likely the production DB, and the migration renames fields on first request. Before running anything, set `MONGODB_DB=expense-tracker-dev` in `.env.local` (Task 1, Step 1).
- There is no test suite. A task counts as verified when `bunx tsc --noEmit`, `bun run lint` and `bun run build` all pass, plus that task's check script or browser check.
- Cache Components rules from CLAUDE.md apply. Reads of the session or ledger go inside `<Suspense>`, with a sync page shell and an async inner component. Mutations call `refresh()` via `done()`.
- Every query on user data is scoped by `ledgerId`. Only `lib/data.ts` and `lib/household.ts` touch collections.
- Role type: `"owner" | "editor" | "viewer"`. Viewers can read and export. Every mutation returns `fail("You have view-only access to this household.")` for viewers. Membership actions by non-owners return `fail("Only the household owner can do that.")`.
- Invite emails are compared lowercased. Look users up in Better Auth's `user` collection (`_id` ObjectId, whose hex string is the userId; `name`, `email`, `image`).
- Conventional commits, with no `Co-Authored-By` lines. Don't commit `.vscode/`.

## Review Focus

1. **Stale invite:** accepting an invite that was cancelled, or after the invitee has already joined elsewhere, should show "This invite is no longer available." and never crash or half-merge. The Task 2 check covers this.
2. **Revoked mid-session:** a member removed (or demoted to viewer) while their page is open should have their next submit refused, because the role is read from the DB on every request. Task 6 covers this.
3. **Email case:** inviting `Partner@Gmail.com` should match a user stored as `partner@gmail.com`. Task 2 covers this.
4. **Fold under a system parent:** an invitee's custom subcategory "Dog food" under system "Pets", when the household also has an active "dog food" there, should fold, with the invitee's transactions re-pointed. Task 2 covers this.
5. **Owner accepting elsewhere:** an owner who still has other members tries to accept someone else's invite. This should be refused, with the banner explaining they must transfer ownership or remove members first. Task 2 covers this.

---

### Task 1: Ledger scoping, migration and session context

The app behaves exactly as before for solo users, but runs on `ledgerId`.

**Files:**
- Modify: `.env.local` (not committed)
- Modify: `lib/data.ts` (all functions, `ensureSetup`)
- Create: `lib/household.ts` (resolution only in this task)
- Modify: `lib/session.ts`
- Modify: `app/actions.ts`, `app/api/export/route.ts`
- Modify: `app/(app)/{dashboard,transactions,categories,budgets,settings}/page.tsx`

**Interfaces:**
- Produces (`lib/household.ts`):
  - `type Role = "owner" | "editor" | "viewer"`
  - `type LedgerContext = { userId: string; ledgerId: string; role: Role; householdId: string | null }`
  - `resolveLedger(userId: string): Promise<LedgerContext>`: calls `ensureSetup()`, then looks for a household with `members.userId === userId` (ledger and role come from it), else a `userLedgers` doc `{ _id: userId, ledgerId }`, else `{ ledgerId: userId, role: "owner", householdId: null }`.
- Produces (`lib/session.ts`):
  - `getLedger = cache(async (): Promise<LedgerContext & { user: SessionUser }>)`, which redirects like `getUser`.
  - `getLedgerContext(): Promise<LedgerContext | null>` for actions and route handlers.
- Produces (`lib/data.ts`):
  - `export function ensureSetup(): Promise<void>`
  - Every exported function's first parameter is renamed `ledgerId: string`.
  - `createTransaction(ledgerId: string, createdBy: string, input: TransactionInput)`
  - `Transaction` gains `createdBy: string`.

- [ ] **Step 1:** In `.env.local`, set `MONGODB_DB=expense-tracker-dev`. Confirm with `grep MONGODB_DB .env.local`.
- [ ] **Step 2:** In `lib/data.ts`, rename the `userId` field on `CategoryDoc`, `TransactionDoc` and `BudgetDoc` to `ledgerId`, and add `createdBy: string` to `TransactionDoc`. Rename `visibleTo` and `inRange` parameters. Change the error copy to "Only custom categories can be edited." and "Only custom categories can be removed."
- [ ] **Step 3:** Extend `ensureSetup()` so it runs these steps in order, before the existing indexes and seed:
  1. Backfill `createdBy` from `userId` on transactions: `updateMany({ userId: { $exists: true }, createdBy: { $exists: false } }, [{ $set: { createdBy: "$userId" } }])`.
  2. On `categories`, `transactions` and `budgets`: `updateMany({ userId: { $exists: true } }, { $rename: { userId: "ledgerId" } })`.
  3. Drop the old indexes `userId_1_type_1`, `userId_1_date_-1` and `userId_1_categoryId_1`, ignoring "index not found".
  4. Create the same indexes keyed on `ledgerId`.

  Export `ensureSetup`.
- [ ] **Step 4:** Create `lib/household.ts` (`import "server-only"`) with `Role`, `LedgerContext` and `resolveLedger`, plus collection handles. `households` doc shape: `{ _id: ObjectId; ledgerId: string; ownerId: string; members: { userId: string; role: Role; joinedAt: Date }[] }`. `userLedgers` doc shape: `{ _id: string /* userId */; ledgerId: string }`.
- [ ] **Step 5:** Add `getLedger` and `getLedgerContext` to `lib/session.ts`.
- [ ] **Step 6:** In `app/actions.ts`, replace `getUserId()` with two helpers:
  - `editorContext(): Promise<LedgerContext | ActionState>`, which returns the session-expired or view-only `fail`.
  - `ownerContext()`, the same but for the owner.

  Pass `ctx.ledgerId` to data calls and `ctx.userId` as `createdBy`. `/api/export` uses `getLedgerContext()` and allows any role.
- [ ] **Step 7:** Pages: swap `getUser()` for `getLedger()` and pass `ledgerId` to data calls. `UserMenu` keeps `getUser()`.
- [ ] **Step 8:** Verify: `bunx tsc --noEmit && bun run lint && bun run build`. Each must exit 0.
- [ ] **Step 9:** Check the migration against the dev DB.
  1. Write `<scratchpad>/check-migration.ts`, run with `NODE_OPTIONS=--conditions=react-server bunx tsx --env-file=.env.local`.
  2. It inserts a transaction, a custom category and a budget in the **old** shape (with `userId: "u-test"`, no `ledgerId`/`createdBy`).
  3. It resets the setup promise by calling `ensureSetup()` in a fresh process.
  4. It asserts that `listTransactions("u-test", …)` returns the row with `createdBy === "u-test"`, that no document still has a `userId` field, and that a second `ensureSetup()` changes nothing.
  5. It deletes its rows.

  Expected: prints `migration ok`.
- [ ] **Step 10:** Start `bun run dev` and sign in a test user (CLAUDE.md recipe). Dashboard, Daily, Categories, Budgets and Settings should render, adding a transaction should work, and so should the CSV export.
- [ ] **Step 11:** Commit: `refactor: scope user data by ledger id`.

### Task 2: Household data layer

**Files:**
- Modify: `lib/household.ts`

**Interfaces:**
- Consumes: `LedgerContext`, `resolveLedger`, `ensureSetup`; `client` from `lib/db.ts`.
- Produces (all in `lib/household.ts`; functions returning `string | null` return an error message or null, like `lib/data.ts`):
  - `type Member = { userId: string; name: string; email: string; image: string | null; role: Role }`
  - `type Household = { id: string; ownerId: string; members: Member[] }`
  - `type OutgoingInvite = { id: string; email: string; role: "editor" | "viewer" }`
  - `type IncomingInvite = { id: string; ownerName: string; role: "editor" | "viewer"; blocked: boolean /* invitee owns a household with other members */ }`
  - `type AcceptPreview = { transactions: number; categories: number; budgets: number; currency: string; householdCurrency: string }`
  - `getHousehold(householdId: string): Promise<Household | null>`
  - `listUsers(ids: string[]): Promise<Record<string, { name: string; image: string | null }>>`
  - `listOutgoingInvites(householdId: string): Promise<OutgoingInvite[]>`
  - `listIncomingInvites(ctx: LedgerContext, email: string): Promise<IncomingInvite[]>`
  - `createInvite(ctx: LedgerContext, email: string, role: "editor" | "viewer"): Promise<string | null>`
  - `cancelInvite(ctx: LedgerContext, inviteId: string): Promise<void>`
  - `declineInvite(email: string, inviteId: string): Promise<void>`
  - `getAcceptPreview(ctx: LedgerContext, email: string, inviteId: string): Promise<AcceptPreview | null>`
  - `acceptInvite(ctx: LedgerContext, email: string, inviteId: string, mode: "merge" | "replace"): Promise<string | null>`
  - `setMemberRole(ctx: LedgerContext, memberId: string, role: "editor" | "viewer"): Promise<string | null>`
  - `removeMember(ctx: LedgerContext, memberId: string): Promise<string | null>`
  - `transferOwnership(ctx: LedgerContext, memberId: string): Promise<string | null>`
  - `leaveHousehold(ctx: LedgerContext): Promise<string | null>`

Rules the implementer must follow (from the spec):

- [ ] **Step 1: `createInvite`.** Lowercase and trim the email, then refuse with these messages:
  - "No account uses that email. Ask them to sign in once first." when the email isn't found.
  - "That's you." when the email is the owner's own.
  - "They're already in your household." when they're a member.
  - "They already share a household with someone else." when they're in another household with more than one member.

  If `ctx.householdId` is null, insert the household `{ ledgerId: ctx.ledgerId, ownerId: ctx.userId, members: [{ userId, role: "owner", joinedAt }] }`. Upsert the invite on `(householdId, email)`. Indexes: `households` unique on `ledgerId` and on `members.userId`; `invites` unique on `{ householdId: 1, email: 1 }`.
- [ ] **Step 2: Membership edits** (owner only, guarded by `ctx.role === "owner"` inside each function as well).
  - `setMemberRole`: changes a non-owner member's role.
  - `removeMember`: pulls the member and gives them a fresh ledger with `userLedgers.updateOne({ _id: memberId }, { $set: { ledgerId: new ObjectId().toHexString() } }, { upsert: true })`. If only the owner remains afterwards, it deletes the household doc and its invites.
  - `transferOwnership`: sets the target's role to owner, the old owner's to editor, and updates `ownerId`.
  - `leaveHousehold`: refuses the owner when other members exist, with "Transfer ownership or remove everyone before leaving." Otherwise it does the same as removing yourself.
- [ ] **Step 3: `acceptInvite`.** Run it inside `client.withSession(s => s.withTransaction(...))`, passing `{ session }` to every operation.
  1. Re-load the invite by id **and** the invitee's email. If it's missing, return "This invite is no longer available."
  2. If the invitee owns a household with other members, return "Transfer ownership or remove everyone before joining another household." If they own a household with only themselves, delete that household and its invites.
  3. If `mode === "replace"`, delete every `transactions`, `budgets` and `settings` doc and every custom `categories` doc on `ctx.ledgerId`.
  4. If `mode === "merge"`, build an `idMap` from old category ids to new ones by walking the invitee's custom categories, top-level ones first.
     - An **active** category whose type matches, whose mapped `parentId` matches, and whose name matches case-insensitively one that is visible in the household (system or household-owned) and **active**: map it to that one, then set `archivedAt` and the household `ledgerId` on the source.
     - Otherwise: set the household `ledgerId` and the mapped `parentId`, and map it to itself.
     - Then remap the transactions' `categoryId`/`subcategoryId` through `idMap` and set the household `ledgerId`.
     - Budgets: drop the invitee's budget when the household already has one for the mapped category. Otherwise move it.
     - Delete the invitee's `settings`.
  5. Push `{ userId, role: invite.role, joinedAt }` to the household's members. Delete the invitee's `userLedgers` doc and every invite with their email.
- [ ] **Step 4:** `getAcceptPreview` returns counts on `ctx.ledgerId` plus both currencies (via `getSettings`). `listIncomingInvites` joins the owner's name from the `user` collection.
- [ ] **Step 5:** Verify with `bunx tsc --noEmit && bun run lint`.
- [ ] **Step 6:** Write `<scratchpad>/check-household.ts` (same run command as Task 1, Step 9). It creates users A and B via `(await auth.$context).internalAdapter.createUser`, with B's email in lowercase, and seeds data through `lib/data.ts`. Each item below must hold:
  - `createInvite(ctxA, emailB.toUpperCase(), "viewer")` returns null (case-insensitive match).
  - `createInvite(ctxA, "nobody@example.test", "editor")` returns the "No account" message.
  - B has a custom subcategory "Dog food" under system Pets with one transaction, and A has an active "dog food" under Pets. After `acceptInvite(ctxB, …, "merge")`, B's transaction's `subcategoryId` equals A's category id, and `resolveLedger(B)` gives A's ledger with role `viewer`.
  - Accepting the same invite id again returns "This invite is no longer available."
  - `leaveHousehold(ctxA)` returns the transfer message. After `removeMember(ctxA, B)`, `resolveLedger(B).ledgerId` is a new id with zero transactions, and A still has B's merged transaction.
  - A third user C owns a household with member D. C accepting an invite from A returns the "Transfer ownership…" message.
  - Replace mode deletes the invitee's prior transactions.

  The script cleans up all test users and data. Expected: prints `household ok`.
- [ ] **Step 7:** Commit: `feat: add household membership data layer`.

### Task 3: Membership server actions

**Files:**
- Modify: `app/actions.ts`

**Interfaces:**
- Consumes: Task 2 functions; `ownerContext`/`editorContext` from Task 1.
- Produces:
  - `sendInvite(_: ActionState, formData: FormData): Promise<ActionState>`, with fields `email` (zod email) and `role` (`"editor" | "viewer"`).
  - `cancelInviteAction(inviteId: string)`
  - `changeMemberRole(memberId: string, role: "editor" | "viewer")`
  - `removeMemberAction(memberId: string)`
  - `transferOwnershipAction(memberId: string)`
  - `leaveHouseholdAction()`
  - `respondToInvite(inviteId: string, response: "merge" | "replace" | "decline")`

  Each returns `Promise<ActionState>`.

- [ ] **Step 1:** Implement them. The owner-only ones use `ownerContext()`. `leaveHouseholdAction` and `respondToInvite` need only a session plus `getLedgerContext()`, and use the session user's email from `auth.api.getSession`. Validate role/response strings with zod enums. Call `done()` on success.
- [ ] **Step 2:** Verify with `bunx tsc --noEmit && bun run lint`.
- [ ] **Step 3:** Commit: `feat: add household server actions`.

### Task 4: Household management UI

**Files:**
- Create: `components/household-card.tsx` (client)
- Create: `components/invite-banner.tsx` (server) and `components/accept-invite.tsx` (client)
- Modify: `app/(app)/settings/page.tsx`, `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: Task 2 types and readers; Task 3 actions.
- Produces:
  - `HouseholdCard({ household, invites, viewerId, role }: { household: Household | null; invites: OutgoingInvite[]; viewerId: string; role: Role })`
  - `InviteBanner()` (async, no props)
  - `AcceptInvite({ invite, preview }: { invite: IncomingInvite; preview: AcceptPreview })`

- [ ] **Step 1: Settings → "Household" card,** in its own `<Suspense>` section after Currency.
  - Members: avatar, name, email and role for each.
  - The owner gets, for each non-owner, a role `<select aria-label={`Role for ${name}`}>`, a Remove button (`.btn-danger`, behind a confirm modal), and "Make owner" (also behind a confirm modal).
  - The owner also gets an invite form (email input + role select + submit, wired with `useActionState(sendInvite)`) and a pending-invite list, each with Cancel.
  - Non-owners see a read-only list plus "Leave household" behind a confirm modal that says "You'll start with an empty ledger. The household keeps everything."
  - With no household, show only the invite form under the line "Invite someone who has signed in to this app to share your ledger."
- [ ] **Step 2: `InviteBanner`.** It renders inside `<Suspense fallback={null}>` at the top of `<main>` in the app layout. For each incoming invite it shows "{ownerName} invited you to their household as {an editor|a viewer}." with Accept and Decline buttons.
  - If `blocked`, it replaces Accept with "Transfer ownership or remove your members in Settings first."
  - If the preview shows zero transactions, categories and budgets, Accept calls `respondToInvite(id, "merge")` directly.
- [ ] **Step 3: `AcceptInvite` modal** (`components/modal.tsx`). It offers two choices:
  - **"Merge my data"** with the counts, plus "Amounts aren't converted. The household uses {householdCurrency}." when the currencies differ.
  - **"Replace (delete my data)"** styled `.btn-danger`, with the text "Permanently deletes {n} transactions, {n} custom categories and {n} budgets." It needs a second confirm (a checkbox "I understand this can't be undone" that enables the button).
- [ ] **Step 4:** Verify with `bunx tsc --noEmit && bun run lint && bun run build`.
- [ ] **Step 5:** Browser check (dev server, two test users) using `playwright-cli`:
  1. A invites B.
  2. B sees the banner and opens Accept.
  3. Take a screenshot of the modal.
  4. Merge.
  5. B's Settings lists both members.
  6. Take a screenshot of A's Household card.
- [ ] **Step 6:** Commit: `feat: add household settings and invite flow`.

### Task 5: Viewer mode and transaction authors

**Files:**
- Modify: `components/add-transaction-button.tsx`, `components/transaction-list.tsx`, `components/category-manager.tsx`, `components/budget-row.tsx`, `components/settings-forms.tsx`
- Modify: the five pages, plus `app/(app)/layout.tsx` (badge)
- Modify: `lib/data.ts` (`listTransactions` maps `createdBy`)

**Interfaces:**
- Consumes: `getLedger()` (role, householdId), `getHousehold`, `listUsers`.
- Produces:
  - Prop `canEdit: boolean` on `AddTransactionButton`, `TransactionList`, `CategoryManager`, `BudgetForm` and `CurrencyForm`.
  - Prop `authors?: Record<string, { name: string; image: string | null }>` on `TransactionList`.

- [ ] **Step 1:** Pages compute `canEdit = role !== "viewer"`. When it's false, the add button is not rendered, transaction rows have no edit/delete, the category manager hides create/edit/archive, and the budget and currency inputs and their submit buttons are `disabled`.
- [ ] **Step 2:** A "View only" pill (token colors, `text-xs`) shows for viewers. In the sidebar it goes above `UserMenu`, and in the mobile header next to `Logo`. Load it in its own small async component inside `<Suspense fallback={null}>`.
- [ ] **Step 3:** Transactions page. When the household has more than one member, collect the distinct `createdBy` values, call `listUsers`, and pass `authors`. Each row shows a 20px avatar, or the first initial, with `title={name}` and an `aria-label` "Added by {name}". The dashboard doesn't change.
- [ ] **Step 4:** Verify with `bunx tsc --noEmit && bun run lint && bun run build`.
- [ ] **Step 5:** Commit: `feat: add viewer mode and transaction authors`.

### Task 6: End-to-end verification

**Files:** none committed. Scripts and screenshots go in the scratchpad.

- [ ] **Step 1:** With the dev server on the dev DB and two test users A and B (CLAUDE.md recipe, two cookies/contexts in `playwright-cli`), run through the spec's Verification list:
  1. **Viewer merge:** A invites B as viewer. B accepts with merge and sees the combined data, with no add/edit controls.
  2. **Revoked mid-session:** with B's Daily page open, A changes B to viewer and then removes B. B's next submit, made from the stale page or by POSTing the action, shows the view-only error, and after the removal B's ledger is empty.
  3. **Editor:** A changes B to editor. B adds a transaction, and A sees it with B's avatar.
  4. **Leave:** B leaves. B's ledger is empty, and A keeps everything.
  5. **Replace:** A re-invites B, and B accepts with replace. B's prior data is gone.
  6. **Owner can't leave:** A can't leave while B is a member. After "Make owner" on B, A can leave.
  7. **Unregistered email:** inviting an unregistered email shows the error.

  Take a screenshot of each step.
- [ ] **Step 2:** Delete the test users and all their ledgers, households and invites from the dev DB.
- [ ] **Step 3:** Update CLAUDE.md:
  - Data model: `ledgerId`, `createdBy`, `households`, `invites`, `userLedgers`.
  - Layers: `lib/household.ts`, `getLedger()`.
  - Testing section: use a non-production `MONGODB_DB`.

  Commit: `docs: document household sharing in CLAUDE.md`.
