# Household sharing — design

Date: 2026-10-18

## Intent

The owner and their partner both log household expenses and want to do it in **one combined ledger** that both of them can change. The app is deployed publicly (https://ledgerly-io.vercel.app/), so this has to be a general feature: any registered user can form a household with other registered users, not a special case for one couple.

Success: two people sign in with their own Google accounts and see the same dashboard, transactions, categories, budgets and currency. Anything one of them adds shows up for the other, and the person who created the household decides who's in it and whether each member can edit or only view.

## Goals

- A user can invite another **already registered** user by email into their household.
- The invitee sees the invite inside the app and can accept or decline it.
- On accepting, the invitee chooses whether to **merge** their existing data into the household or **replace** it, which permanently deletes their old data.
- Each member has a permission: **editor** (add/edit/delete transactions, categories, budgets, currency) or **viewer** (read-only).
- Only the **owner** (the creator) can invite, cancel invites, change permissions, remove members and transfer ownership.
- Every transaction records **who logged it**.
- Leaving or being removed gives the user a **fresh, empty ledger**. The household keeps all of its data, including anything the user merged in.
- The owner can't leave while other members remain. They transfer ownership to a member first, or remove everyone.

## Non-goals

- Private personal ledgers alongside the household. The household ledger **replaces** the personal one. A user belongs to exactly one ledger at a time.
- Belonging to several households, or switching between ledgers.
- Inviting people who have no account yet, and sending invite emails. There's no email service. Invites are in-app only.
- Per-transaction or per-category permissions, or editors who can only change their own entries.
- Restoring a user's pre-household data when they leave.
- Currency conversion during a merge.

## Anti-goals (would be a failure even if it "works")

- A user can read or change a ledger they aren't a member of, or a viewer can change data. Every check is server-side in the data layer or the actions, never only hidden buttons.
- "Replace" deletes data without an unmistakable warning.
- A removed member keeps access until their session expires. Membership must be checked against the database on every request.
- A household is left without an owner.

## Constraints from the existing app

- Every data query is in `lib/data.ts` and today is scoped by `userId`. Actions in `app/actions.ts` re-authenticate with `getUserId()`.
- Next 16 Cache Components rules apply (see CLAUDE.md). New pages and sections follow the sync shell + `<Suspense>` + async inner component pattern. Mutations call `refresh()`.
- Better Auth owns the `user` collection, which is how a registered email is looked up. Look up by lowercased email.
- No test suite. Verify with typecheck, lint, `bun run build`, and the signed-in testing recipe in CLAUDE.md, using **two** test users.

## Design

### The ledger concept

Introduce a **ledger id** (a string), which becomes the scope for all user data in place of `userId`.

- A solo user's ledger id is their own `userId`. This means existing data needs no copying, only a field rename.
- `categories`, `transactions` and `budgets` replace the `userId` field with **`ledgerId`**. `settings._id` becomes the ledger id. The existing values are already correct because solo ledger id = userId.
- Migration: an idempotent step in `ensureSetup()` runs `$rename: { userId: "ledgerId" }` on documents that still have `userId` (system categories keep `ledgerId: null`). Indexes move from `userId` to `ledgerId`. `ensureSetup()` must run before **every** data read and write, not only the three functions that call it today. The simplest place is the ledger resolution in `getLedger()`/`getLedgerContext()`.
- Rollout: a single deploy, **roll-forward only**. The owner accepted a brief window during that deploy where old instances show an empty ledger. Never roll back past this deploy once the migration has run: the old code's `userId: { $in: [null, id] }` filter matches every migrated doc (they no longer have `userId`), so it would show every user's custom categories to everyone, and recreating its unique `{ userId, categoryId }` budget index would fail on the migrated budgets. If something breaks, fix forward. The migration itself tolerates legacy docs that old instances write during the deploy window. No expand-and-contract.
- `transactions` gain **`createdBy: string`** (userId). The migration backfills existing transactions with `createdBy` = their current `userId` (my call: before households, every ledger had exactly one person). Every transaction then has an author.

### Households and membership

New collection **`households`**, created when a user sends their first invite:

```
{ _id: ObjectId, ledgerId: string, ownerId: string,
  members: [{ userId: string, role: "owner" | "editor" | "viewer", joinedAt: Date }] }
```

- Unique indexes on `ledgerId` and `members.userId`, so a user is in at most one household.
- Resolving the current user's ledger: find the household whose `members.userId` matches. If there is one, use its `ledgerId` and the member's `role`. Otherwise use ledger id = userId and role = owner (solo).
- The owner's ledger becomes the household ledger. The owner's existing data **is** the household's data from the start.

New collection **`invites`**:

```
{ _id: ObjectId, householdId: ObjectId, email: string (lowercased),
  role: "editor" | "viewer", invitedBy: string, createdAt: Date }
```

- Unique on `(householdId, email)`, so re-inviting just updates the role. Invites don't expire. The owner can cancel them.
- Sending an invite fails with a clear message when: no user has that email, the email is the owner's own, that user is already a member, or that user already belongs to another household with other members.

### Session and authorization

- `lib/session.ts` gains `getLedger()` (React `cache`, redirects like `getUser`), which returns `{ user, ledgerId, role }`, plus a nullable `getLedgerContext()` for actions and route handlers. Both read membership from the database on every request. They don't rely on the cookie cache.
- `lib/data.ts` functions take `ledgerId` instead of `userId`. `createTransaction` also takes the author's userId for `createdBy`.
- Every mutating action in `app/actions.ts` requires role `owner` or `editor` and otherwise returns `fail("You have view-only access to this household.")`. Membership actions require `owner`.
- `/api/export` uses the ledger. Viewers may export (my call: reading data you can already see).

### Accepting an invite: merge or replace

The invitee sees a banner in the app layout ("Alex invited you to their household as an editor") with **Accept** and **Decline**. Accept opens a modal with two choices:

- **Merge my data**: their transactions, custom categories and budgets move into the household ledger.
  - A custom category whose name matches an existing **active** household category (case-insensitive, same type, same parent) is folded into it. Archived household categories are never fold targets (my call), so live data is never moved onto a hidden category. Their transactions are re-pointed to it, and the duplicate is archived and moved. Other custom categories move as they are. System categories are shared already.
  - Budgets: when both have a budget for the same category, **the household's wins** (my call). The rest move.
  - Currency: the household's currency is used. If it differs from theirs, the modal says that amounts are not converted.
  - Their transactions keep `createdBy` (already backfilled by the migration).
- **Replace (delete my data)**: all of their transactions, custom categories, budgets and settings are permanently deleted. The option is styled as dangerous, states what will be deleted with counts, and needs explicit confirmation.
- A user with no data at all skips the choice and joins directly.
- A user who currently owns a household with other members can't accept until they transfer ownership or remove those members. The banner explains this.
- Accepting removes all other pending invites for that user. The whole accept runs in a MongoDB transaction where possible, so a half-merged state can't happen.

### Leaving, removal and ownership

- **Leave** (editor or viewer) or **removed by owner**: the member is pulled from `members`, and their own fresh ledger id is recorded so they start empty. Because the household's ledger id might equal their userId (if they were once the owner), store a per-user override in a small **`ledgers`** collection, or give them a new `ObjectId` hex string as their ledger id. *Left to the builder:* pick one mechanism that keeps "solo ledger id = userId" the default and handles this case.
- **Transfer ownership**: owner picks a member. That member becomes `owner` and the old owner becomes `editor`. Only after that can the old owner leave.
- When the owner removes the last other member, the household document can be deleted and the owner is a solo user again, with the same ledger and data.

### UI

- **Settings → Household card** (new): member list with avatar, name, email and role. The owner sees a role select and a remove button per member, a transfer-ownership action, an invite form (email + role select) and a list of pending invites with cancel. Non-owners see the list read-only plus a **Leave household** button with a confirmation.
- **Invite banner** in `app/(app)/layout.tsx` for pending incoming invites.
- **Viewer mode**: hide or disable add/edit/delete controls on transactions, categories, budgets and currency, and show a small "View only" badge. The server still enforces this.
- **Author on transactions**: when the household has more than one member, transaction rows show the author's avatar or initial.
- Copy changes from "your" to neutral where it's now shared, for example "Only your own categories can be edited" becomes "Only custom categories can be edited".
- Use the existing modal, `.btn-danger`, tokens and form patterns. `aria-label`s go on the new selects.

## Left to the builder

- Exact component split and file names.
- The fresh-ledger mechanism on leave (see above).
- Whether to use Mongo multi-document transactions (needs a replica set; Atlas has one) or careful ordering for merge, replace and leave.
- How author info is joined for display (lookup from the `user` collection by `createdBy`, batched per page).

## Verification

Typecheck, lint, `bun run build`. Then, with two test users (A, B) created through the CLAUDE.md recipe:

1. A invites B as viewer. B sees the banner, accepts with merge, and sees A's data plus their own. B's add/edit controls are hidden, and calling the actions directly is refused.
2. A changes B to editor. B adds a transaction. A sees it, with B as the author.
3. B leaves. B has an empty ledger, and A still has everything, including B's merged rows.
4. Re-invite with replace. B's prior data is gone.
5. A can't leave while B is a member. After a transfer, A can.
6. Inviting an unregistered email is refused.

Clean up both test users and their data afterwards.
