# Handoff: visual redesign of Budget Tracker

Written for a new Claude Code session. Facts were checked against the repo at commit `d2b3ca5`
("Replace xlsx 0.18.5 with SheetJS 0.20.3 from cdn.sheetjs.com (F15)"). If `git log` shows newer
commits, re-check anything you rely on.

Your job is a **visual redesign only**: styling and layout. Read sections 4 and 5 before touching
a file.

---

## 1. Project summary

**What it is.** A personal budget tracker web app: manual income/expense entry, credit-card
statement import (Isracard and Max `.xlsx` files), search, charts, saving suggestions. The UI is
**Hebrew, right-to-left**.

**Stack** (from `package.json`):
- React 18.2, Create React App (`react-scripts` 5.0.1), Tailwind CSS 3.4 (PostCSS + autoprefixer),
  react-router-dom 7.
- Firebase 11: Auth (email/password with required email verification, and Google) and Firestore.
- Recharts 3 for charts, lucide-react for icons, `@radix-ui/react-dialog` for dialogs, dayjs for dates.
- SheetJS `xlsx` 0.20.3 installed from `https://cdn.sheetjs.com` (see the README note; never switch it
  back to the npm registry).
- Hosting: Firebase Hosting (`firebase.json` serves `build/` with a single-page-app rewrite;
  `.firebaserc` default project `budget-tracker-13f97`).
- `public/index.html` has `<html lang="he" dir="rtl">`.

**Routes** (`src/App.js`): `/login` (public), `/dashboard`, `/transactions`, `/categories`,
`/analytics` (all behind `RequireAuth` and inside `MainLayout`); `/` and `*` redirect to `/login`.

**HEAD at the time of writing:** `d2b3ca5`. Tests at that point: 30 suites / 497 tests (`npm test`),
113 rules tests (`npm run test:rules`), and `CI=true npm run build` compiles with no warnings.

**Main areas of work completed so far** (all committed, see `git log`):
- **Security:** owner-only Firestore rules that also require a verified email (F1), email
  verification enforced in the route guards and signup flow (F2), rules tests that run in the
  emulator (`tests/rules/`).
- **Money:** integer-agorot storage (`amountAgorot`) with shared helpers in `src/lib/money.js`,
  validated writes, rules requiring a valid integer on create/update, and a one-off migration
  script (`scripts/migrate-amount-agorot.mjs`, dry-run by default).
- **Importer fixes:** local-date handling, saved merchant categories before keyword rules,
  idempotent batched import with deterministic transaction ids, parsers split into
  `src/lib/statementParsers.js`, precompiled keyword rules (F13).
- **Architecture:** `useTransactions` hook and component split (F16), one shared `DataProvider`
  for the Firestore listeners (F17), single-pass memoised summaries (F27), constants module (F25),
  one category normaliser (F23).
- **Features and quality:** real search/filter on the transactions page (F7), loading/error/empty
  states and an import result message (F31), Hebrew auth and write error messages (F14, F22),
  accessibility labels and a real login form (F30), listener-leak fix, auth snapshot fix (F28),
  subscription detection per merchant (F11), dev-only logging (F32).
- **Import hardening:** size/type check and a Hebrew read error before parsing; SheetJS replaced by
  0.20.3 from its CDN with frozen fixture tests (F15).

---

## 2. Architecture map

```
public/                 index.html (lang=he dir=rtl), favicons, manifest
screenshots/            README screenshots of the old UI (dashboard, actions, categories, analysis)
scripts/                migrate-amount-agorot.mjs, lib/amountMigration.mjs (one-off migration; do not touch)
tests/rules/            firestore.rules.test.js (node --test, needs the Firestore emulator)
firestore.rules         security rules (DO NOT CHANGE)
tailwind.config.js, postcss.config.js
src/
  index.js              mounts AuthProvider > DataProvider > App (React.StrictMode); imports index.css
  App.js                Router and routes
  firebase.js           Firebase init (do not touch)
  constants.js          TYPE, SOURCE, UNCATEGORIZED, CHART_COLORS, IMPORT_COLUMNS
  index.css             @tailwind directives + a few leftover element styles (see section 3)
  App.css               NOT imported anywhere (dead file)
  pages/                Login, Dashboard, TransactionsPage, CategoriesPage, AnalyticsPage
  layouts/MainLayout.jsx    sidebar + mobile menu around the pages
  components/
    PageState.jsx           loading / error / empty text states
    RouteGuards.jsx         RequireAuth, PublicRoute (logic only)
    TransactionRow.jsx      one transaction as a mobile card or a table row
    TransactionDialog.jsx   add/edit dialog (+ its trigger button)
    ConfirmDialog.js + .css delete confirmation (plain CSS, not Tailwind)
    Suggestions.jsx         saving-suggestions card (Dashboard)
    TransactionList.css     NOT imported anywhere (dead file)
    ui/                     button, card, dialog, input, label (small shadcn-style components)
  contexts/
    AuthContext.js          auth state (an immutable user snapshot) and sign-in/up/out functions
    DataContext.js          one transactions + one categories Firestore listener per user;
                            exposes { transactions, categories, categoryDocs, loading, error }
  hooks/useTransactions.js  write operations (save, delete, category update, batched import)
  insights/useSuggestions.js  pure suggestion logic (subscriptions, month-over-month, big one-offs)
  lib/
    money.js            integer-agorot helpers, formatMoney (THE way to display money)
    summaries.js        single-pass totals, per-category and per-month sums, grouping by day
    filterTransactions.js   pure search filter used by the transactions page
    categories.js       case-insensitive category helpers
    categorize.js       merchant normalisation and keyword categorisation
    statementParsers.js Isracard and Max sheet parsers
    importDates.js, amounts.js, transactionId.js   import date/amount parsing and deterministic ids
    importFile.js       size/type checks before parsing; importReport.js builds the import result text
    authErrors.js       Firebase auth error code -> Hebrew message
    devLog.js           console.log only outside production
    utils.js            cn() class joiner (a plain filter/join, NOT tailwind-merge)
    __fixtures__/       xlsx fixture workbooks + frozen expected results
  *.py                  category_api.py, smart_reclassify.py (unused ML helpers; not part of the web app)
```

### Presentational vs logic

**Presentational (safe to restyle, but keep the behaviour and attributes in section 4):**
`src/components/ui/*`, `PageState.jsx`, `ConfirmDialog.js` + `.css`, `Suggestions.jsx`,
`TransactionRow.jsx`, `TransactionDialog.jsx`, `layouts/MainLayout.jsx`, the JSX/markup of
`pages/*`, `tailwind.config.js`, `index.css`, `public/index.html` (font link only).

**Logic: do not touch** (this includes the logic inside the page components):
- Everything in `src/lib/`, `src/contexts/`, `src/hooks/`, `src/insights/`, `src/constants.js`
  (except you may *read* `CHART_COLORS`; changing the chart colour values is a styling change, but
  never change `TYPE`, `SOURCE` or `UNCATEGORIZED`).
- `src/firebase.js`, `firestore.rules`, `tests/rules/`, `scripts/`, `RouteGuards.jsx`, `App.js` routes.
- Inside pages: state, effects, handlers (`handleSave`, `handleProcessImport`, the search state, the
  `useMemo` derivations), the import flow, and the Firestore calls in `CategoriesPage`.
  Move markup around freely; do not move or rewrite the logic.

---

## 3. Current UI inventory

All styling is Tailwind utility classes in JSX, except the three small CSS files below. There is no
design system yet: colours are scattered (`text-green-600`, `bg-gray-50`, hex values in places).

**`tailwind.config.js`:** only three tokens, added in F19: `primary` `#16a34a` (green-600),
`input` `#d1d5db` (gray-300), `background` `#ffffff`. No fonts, no radius or spacing scale, no dark
mode. The tokens exist because `ui/` components use shadcn-style names (`border-input`,
`bg-background`, `bg-primary`).

**CSS files:**
- `src/index.css`: the three `@tailwind` directives, plus leftover global styles from the original
  template: `body { font-family: 'Arial'; background-color: #f6f8fa }`, a `.container` rule (500px
  centred white box) and a global `h1 { text-align: center; color: #333 }`. The `h1` rule affects
  the Dashboard title; check before removing.
- `src/components/ConfirmDialog.css`: plain CSS for the delete confirmation. This one **is**
  imported. `ConfirmDialog.test.js` and the TransactionsPage test use the `.confirm` class.
- `src/App.css` and `src/components/TransactionList.css`: **not imported anywhere** (dead). Delete
  them only as part of a styling step, and say so in the commit message.

**Components and pages** (what each shows):
- **`layouts/MainLayout.jsx`:** left/right sidebar (it renders on the right in RTL) with a "Balance"
  title, four nav links with lucide icons (home, transactions, categories, analytics), the user's
  email and a red logout button. On mobile there is a top bar with a menu button
  (`aria-label="תפריט"`, `aria-expanded`) that toggles the sidebar as a full-width block. The logout
  button uses an inline `style={{...}}` object with hard-coded colours instead of classes.
- **`pages/Login.jsx`:** a centred `w-80` white card on a gray full-height background, with a heading,
  email and password inputs inside a real `<form>`, inline error/info text (`role="alert"` /
  `role="status"`), a resend-verification link-button, submit button, mode toggle and a Google button.
- **`pages/Dashboard.jsx`:** title, three balance cards (balance, income, expenses), a 6-month income
  vs expense Recharts bar chart, an expense pie (fixed `width={300} height={300}`) next to a scrolling
  category list with colour dots, the five most recent transactions, and the `Suggestions` card.
- **`pages/TransactionsPage.jsx`** (largest file, 553 lines): header with the Search dialog trigger, the
  Add dialog (`TransactionDialog`) and the Import dialog; a search-active banner; a month picker; then
  transactions grouped by day, rendered as cards on mobile (`md:hidden`) and tables on desktop
  (`hidden md:block`) through `TransactionRow`. Also the delete `ConfirmDialog` and the
  "missing category" dialog.
- **`components/TransactionRow.jsx`:** card and table variants, coloured amount and type text
  (`text-green-600` / `text-red-500`), a "!" button for a missing category, edit/delete icon buttons
  (lucide `Trash2`).
- **`components/TransactionDialog.jsx`:** two steps (choose income/expense, then date/category/amount
  form with inline amount error and save error).
- **`pages/CategoriesPage.jsx`:** list of categories with delete buttons, an add field, inline errors,
  `ConfirmDialog`.
- **`pages/AnalyticsPage.jsx`:** date-range filters, an expense pie with legend list, an income vs
  expense bar chart.
- **`components/PageState.jsx`:** plain gray text for loading ("טוען נתונים…"), empty states, and red
  text for errors. No skeletons, no illustrations. It is used inside each page.
- **`components/ConfirmDialog.js`:** plain-CSS modal (`role="alertdialog"`), separate from the Radix
  dialog used elsewhere.
- **`components/ui/*`:** `button.jsx` (variants `default` = primary background unless the caller passes a
  `bg-*` class, and `outline`), `card.jsx`, `dialog.jsx` (Radix dialog), `input.jsx`, `label.jsx`.
- **Charts:** colours come from `CHART_COLORS` in `src/constants.js`: `palette`
  (`#FF6384 #36A2EB #FFCE56 #4CAF50 #FF9800 #9C27B0 #795548 #00BCD4`), `income` `#22c55e`,
  `expense` `#ef4444`. The pie legend dots use inline `style={{ backgroundColor }}` from the same array.
  Recharts is mocked in the page tests, so chart markup is not covered by tests.

**Known visual issues I am aware of** (not exhaustive; do your own review in step 8a):
- **RTL / physical classes still in markup:** `mr-2` on the month label and `text-left` on a table
  header (`TransactionsPage.jsx`), `pr-4` and `ml-2` in the Dashboard category list, hard
  `text-right` in several places. Use logical equivalents (see section 4).
- **`dir="rtl"` is on `<html>`.** Earlier, the sidebar flipped to the left because layout code had
  assumed `dir` was set lower down: fixed in `b409c8f` by using `md:flex-row` (the first child sits on
  the right in RTL) and the logical `md:border-e`. Keep that in mind when restructuring the layout:
  do not add `flex-row-reverse` or physical borders.
- **Dialog close button** uses the logical `end-4 top-4` (fixed in `cca866d`). The dialog content
  itself is centred with `left-1/2 ... -translate-x-1/2`, which is correct for centring.
- **Tokens from F19 are minimal** and the rest of the app does not use them (it uses raw Tailwind
  colours), so the palette is not centralised.
- **`ui/card.jsx`:** `CardTitle` has an `eslint-disable-next-line jsx-a11y/heading-has-content` because
  the heading content arrives through props. Keep it if you keep the pattern.
- **Plain-text states:** loading, empty and error states are unstyled gray/red text.
- **Mixed dialog systems:** Radix `Dialog` (ui/dialog.jsx) and the hand-written `ConfirmDialog` with its
  own CSS look different.
- **Logout button** is styled with an inline style object.
- **Fixed pie size** (300x300) on the Dashboard; `ResponsiveContainer width="100%"` elsewhere.
- **Typography:** system `Arial`; no Hebrew-tuned font, little hierarchy between page titles.
- **`cn()`** only joins strings, so conflicting Tailwind classes are not merged; `Button` works around
  this by checking whether the caller passed a `bg-*` class.

---

## 4. Rules the redesign must respect

1. **Styling and layout only.** Do not change logic, data handling, `firestore.rules`, money storage
   (`amountAgorot` and the legacy `amount` field), importer parsing and ID logic, or routes.
2. **RTL:** use logical properties: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`,
   `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s-*`/`rounded-e-*`. Do not use
   `left`/`right`-based classes for anything that should mirror in RTL. (Centring with
   `left-1/2 -translate-x-1/2` is fine.) Check every new layout with the document in RTL.
3. **Keep accessibility and test hooks.** Keep all existing `aria-*` attributes, `role`s, label
   associations (`htmlFor`/`id`), `name` attributes, `type` attributes and the Hebrew user-facing
   strings that tests rely on. Tests also select by some class names, so changing them can break a test:
   `.confirm` (ConfirmDialog), `.text-green-600` / `.text-red-500` (amount/type colours in
   `TransactionRow`), `button.text-amber-600` (missing-category button), `.font-semibold` (the merchant name in the `TransactionRow` card), the
   `underline` class on the login resend button, `bg-green-600` (the save button in the
   `TransactionDialog` test), and the
   `bg-primary` / `border-input` / `bg-background` classes asserted in `ui/button.test.js`. Other tests
   use ids such as `#selected-month` and `#search-text`, `form`, `input[name=...]` and table structure
   (`tbody tr td:first-child`).
   If a test must change because markup changed, change **only the selector**, never the behaviour
   assertion, and explain it in the commit message.
4. **Comments in English only. No Hebrew inside code** (identifiers, comments, test data). Hebrew is
   fine in user-facing strings. The stored values in `src/constants.js` (`TYPE.INCOME`, `TYPE.EXPENSE`,
   `UNCATEGORIZED`) are Hebrew strings written to Firestore and **must stay unchanged**.
5. **Money display always goes through `formatMoney` in `src/lib/money.js`.** Never format agorot or
   shekels by hand in markup.
6. **`CI=true npm run build` must pass with no warnings** (CI turns lint warnings into errors). Also keep
   `npm test` and `npm run test:rules` green.
7. If you add a dependency (for example a font package), say so before you do, and report any
   unrelated `package-lock.json` change.

---

## 5. Working agreements with the user

- **The user writes in Hebrew and wants replies in Hebrew, right-aligned (RTL).** Code comments stay
  in English only.
- **One commit per finding or step.** Before each commit run `npm test`, `npm run test:rules` and
  `CI=true npm run build`. Commit messages end with the attribution line the harness gives you.
- **Do not deploy and do not touch production data.** The user deploys manually:
  `npm run build && firebase deploy --only hosting`.
- **Stop and ask before any change that is not styling.**
- **One session per directory.** Do not run two Claude sessions in this folder at the same time (an
  earlier session saw another session's uncommitted work appear in the tree). Run `git status` and
  `git log --oneline -5` before you start and confirm the tree is clean.
- When a task has a "plan first" step, wait for approval before implementing.

---

## 6. Commands

| Command | Purpose |
|---|---|
| `npm start` | Dev server on http://localhost:3000 (uses the real Firebase project from `src/firebase.js`; sign-in is required to see the app) |
| `npm test` | Jest through react-scripts. Use `CI=true npm test` for a single non-watch run. Tests run with `TZ=Asia/Jerusalem` (see `src/jestGlobalSetup.js`) |
| `npm run test:rules` | Firestore rules tests. Starts the Firestore emulator through `firebase-tools` (a dev dependency) on port 8185 and runs `node --test tests/rules/*.test.js` |
| `CI=true npm run build` | Production build; must compile with no warnings |

---

## 7. Open items that are NOT part of the redesign

List only. Do not work on these unless the user asks.

- **Re-import overwrites manual edits.** Imported transactions have deterministic ids, so importing the
  same file again overwrites a document the user edited by hand. A "skip existing ids" decision is
  pending.
- **Cleanups:** F33 (restrict the Firebase API key), F34 (move the Python files to `/ml`), F36 (README
  is out of date, for example it still says there are no tests and that the rules are not in the repo),
  F37, and old pre-F6 duplicate transactions in existing data.

---

## 8. The redesign task

The user thinks the app looks unattractive and wants a visual redesign.

**The user may attach screenshots of the current UI and inspiration. If they are missing, ask for them
before step (b).** (`screenshots/` in the repo has four old README screenshots; they may be out of date.)

### Required process

**(a) Review the current UI.** Look at every page (Login, Dashboard, Transactions including its three
dialogs and the import result, Categories, Analytics) and list weaknesses: spacing, typography, colours,
hierarchy, contrast, mobile layout, charts, empty/loading/error states. Use the screenshots if you have
them; you cannot see the running app yourself unless you can run it.

**(b) Propose TWO design directions.** For each, give:
- Tailwind colour tokens (names and values; extend `tailwind.config.js`, keep `primary`, `input`,
  `background` working),
- a Hebrew-friendly font, for example **Heebo** or **Assistant**, and how it loads without breaking the
  build. Options: a `<link>` to Google Fonts in `public/index.html` (no dependency change), or a
  self-hosted package such as `@fontsource/heebo` (a new dependency: ask first and report the lockfile
  diff). Add a system-font fallback stack,
- a spacing and border-radius scale, card style, button style (and the `Button` variants),
- a chart palette (that is `CHART_COLORS` in `src/constants.js`; it needs enough contrast between slices
  and distinct income/expense colours, and should work with colour-blind viewers),
- the look of the sidebar, the dashboard and the transaction list (cards on mobile, table on desktop),
- optionally a dark-mode proposal if it is cheap (Tailwind `darkMode`, tokens as CSS variables).

**(c) WAIT for the user's choice.** Do not implement before they pick a direction.

**(d) Implement in small commits**, in this order:
1. Design tokens and font (`tailwind.config.js`, `index.css`, `public/index.html`).
2. Base `ui/` components (button, card, input, label, dialog) and `ConfirmDialog`.
3. Layout and sidebar (`MainLayout`, including the logout button and the mobile menu).
4. Login.
5. Dashboard and charts.
6. Transactions page, `TransactionRow` and `TransactionDialog`.
7. Categories and Analytics.
8. Loading, error and empty states (`PageState`; the states described in section 3).

After each step:
- run `npm test`, `npm run test:rules` and `CI=true npm run build`,
- **tell the user which pages and viewport sizes to check by eye**, because tests cannot verify
  appearance. For example: "Dashboard at 375 px, 768 px and 1280 px, in RTL; open the Add dialog; check
  the loading state by throttling the network". Be explicit about what could not be verified without a
  browser.
