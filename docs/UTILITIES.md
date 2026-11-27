# Adding a utility tab

A utility is a top-level page that is not a library: FeatureScripts, the
Version Manager, Auto Assembly and Mass Analysis. Each is one value of
`UtilityTab` in `src/frontend/lib/app-tab.ts`, and each is wired into the same
places. This guide walks through them in order. Copy Mass Analysis where in
doubt: it is the newest and the smallest.

`tsc` finds most of the places for you. Every list of utilities is an
exhaustive `switch` over `UtilityTab`, so a new value without a case fails to
compile. The steps below cover the places a `switch` doesn't reach.

## 1. Name the tab

- Add the value to `UtilityTab` in `src/frontend/lib/app-tab.ts`. It is the
  url segment, `/app/<value>`, and what `uiState.tabId` stores.
- In `src/frontend/lib/tabs.ts`, give it a name (`getUtilityName`), an icon
  (`getUtilityIcon`) and a color (`getUtilityColor`). The name is a message,
  `<feature>TabName`.
- Add its color to `AppColor` in `src/frontend/theme.ts`, with a comment on why
  it has that color. Add a branch to `useAppColor` so the page themes the app
  in it.

## 2. Add the route

- Create `src/frontend/routes/app/<value>.tsx`, as
  `src/frontend/routes/app/mass-analysis.tsx` does. Its `onEnter` calls
  `updateUiState({ tabId })`, so entry resumes there next time.
- Add a `useIs<Feature>` hook to the feature's `navigation.ts`, matching the
  route. The page picker and `useAppColor` use it to know the page is showing.
- In `src/frontend/routes/index.tsx`, add the route to `utilityRoute`. Add a
  case to `canResume`: whether `/` may resume into the page, given what
  Onshape launched with. A page that needs an element or a workspace resumes
  only when the launch has one.

## 3. Add it to the page picker

`useAppPages` in `src/frontend/components/app-navbar.tsx` lists every page the
picker offers. Add the utility under Utilities, and add its `useIs<Feature>`
check to `PagePicker`'s `current`.

List it everywhere, standalone included. A page that cannot run without
Onshape says so itself (step 5), so the picker never hides a page.

## 4. Add it to the splash screen

The splash screen (`src/frontend/components/splash-screen.tsx`) is where a new
user picks a page to start in.

- Add the tab to `UTILITIES`, in the page picker's order.
- Add a case to `describeUtility`: one short line saying what it does, as a
  message `splashScreen<Feature>Description`.
- Add the card's row to `docs/strings/library.md`.
- Add its name to the "offers every utility" case in
  `src/frontend/components/splash-screen.test.tsx`.

## 5. Give it zero states

Every state where the page cannot do its work shows a `PageNotice` in its
place, never a blank page or an error. Check each of these, in this order:

1. **Standalone.** Opened outside Onshape, with no launch
   (`useIsConnectedToOnshape` is false). Title "\<Feature\> is not available";
   description "To use \<Feature\>, open FRCDesignApp in an Onshape
   \<document or assembly\>." Skip it only if the page works standalone, as
   FeatureScripts' browsing does.
2. **The wrong place in Onshape.** Launched on an element the page can't act
   on: a Part Studio for an assembly tool, a version for a workspace tool. Say
   what to open, in a title that names the action ("Open an assembly to weigh
   it").
3. **Signed out.** `useNeedsSignIn`: a notice with a sign-in button
   (`startSignIn`).
4. **Nothing yet.** The page can run but has nothing to show, such as the
   Version Manager before anything is linked. Welcome the user and offer the
   first step, as `VersionManagerZeroState` does.

Each notice takes the same icon: the utility's own, as an `AppIcon` at
`IconSize.PAGE` in `PrimaryColor.FILLED`. Declare it once as `PAGE_ICON` at the
top of the route file. A loading or failed read uses `PageLoading` and
`PageError`, with the feature's `FeedbackTopic` if it has one.

Cover the notices in `src/frontend/routes/app/-utility-pages.test.tsx`. The
leading `-` keeps the router from reading the file as a route.

## 6. Give it a dot

A new utility is pointed out with a dot and a **New** badge in the page
picker, until the user first opens it. Auto Assembly's is the example.

- Add a value to `Hint` in `src/backend/features/hints/contract.ts`:
  `OPENED_<FEATURE>`.
- Add a `useIs<Feature>New` hook to the feature's `navigation.ts`, as
  `useIsAutoAssemblyNew` does. It reads `useHasSeenHint`, and is false
  standalone, so nobody is pointed at a page that can't run.
- On the page, call `useMarkHintSeen` in an effect, so opening it clears the
  dot on every computer the user uses.
- In `useAppPages`, give the page `isNew` and a `NewBadge` while the hook says
  so.
- Add a `NudgeKind.DOT` entry to `NUDGES` in
  `src/frontend/features/dashboard/nudges.ts`, with no `day` until it reaches
  `main`. The splash screen card is a nudge too: add a
  `NudgeKind.SPLASH_SCREEN` entry beside it.

## 7. Graph its usage

Every utility records its use, so the dashboard's feature usage graph has a
line for it. [analytics.md](./architecture/analytics.md) covers the area; the
steps are:

- Decide what one use is: the finished action, recorded on the server. A
  Version Manager run, a FeatureScript added, an assembly's masses read.
- If it is a new kind of event, add an `EventType` in
  `src/backend/features/analytics/usage.ts` and decide its columns in
  `src/backend/features/analytics/logged-event.ts`.
- Add a `track<Event>` function to
  `src/backend/features/analytics/tracking.ts`, as `trackMassReport` does. It
  records through `runInBackground`, so tracking never slows or fails the
  request. Call it from the route once the work has succeeded.
- Add an `AppFeature` value, and map the event to it in `featuresOf`
  (`src/backend/features/analytics/feature-reach.ts`). That is what writes the
  `dailyFeatureUsers` rows the graph reads.
- On the dashboard, give it a label (`featureLabel` in
  `src/frontend/features/dashboard/feature-reach.ts`) and say what one use is
  called (`formatTimes` in
  `src/frontend/features/dashboard/feature-reach-section.tsx`).
- Add a `RELEASES` entry in `src/frontend/features/dashboard/nudges.ts` once it
  reaches production, so the graph marks the day it shipped.
- Cover the new event in the analytics tests, and list it under Recording in
  [analytics.md](./architecture/analytics.md).

## 8. Write it down

- Give the feature its own document in `docs/architecture/`, in the shape
  [the index](./architecture/README.md) sets out, and a row in that index. Its
  **Finding the page** flow says where the picker and splash screen list it,
  and what each zero state shows.
- Give it a strings file in `docs/strings/`, and a row in
  [its index](./strings/README.md). List the zero states' notices with the
  state that shows each.
- Run `npm run check:docs`, which fails on a path a document names that does
  not exist.
