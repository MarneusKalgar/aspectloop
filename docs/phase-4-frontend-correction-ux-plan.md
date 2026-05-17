# Phase 4 Frontend Correction UX Plan

## Goal

Translate the `design/v1` HTML/CSS prototypes into true React + Material UI screens without carrying over the prototype DOM structure as-is.

Phase 4 should establish a real component system under `apps/web/src/components`, upgrade the current theme setup so it can represent the design tokens faithfully, and deliver the prioritized light-theme screens first:

- `login`
- `signup`
- `corrections-dashboard`

The following are explicitly deferred from the first Phase 4 implementation pass:

- all `correction-session*` screens
- all dark-theme screens
- `design/v1/prototype-app.js`

## Design Artifact Readout

The `design/v1/screens` files are not production HTML, but they are useful implementation specs because they already encode:

- intended MUI primitive mapping through `data-component`
- stable implementation anchors through `data-node-id`
- token groups repeated consistently across all screens
- separate desktop and mobile layouts where the layout is materially different, not just narrower

Key observations:

- Light and dark themes share the same component structure. The dark files mainly swap token values and a few state colors.
- Auth screens are the same conceptual page in two responsive variants: split marketing + form on desktop, compact centered form on mobile.
- The corrections dashboard is not a simple table that collapses with CSS. Desktop and mobile use different content presentations: table + stats cards versus card list + bottom nav.
- The correction session is also not a shrink-to-fit screen. Desktop uses a split evidence/workspace layout, while mobile becomes a tabbed workflow with a bottom action bar.
- The prototypes intentionally mirror MUI concepts like `MuiAppBar`, `MuiTextField`, `MuiAlert`, `MuiChip`, `MuiMenu`, `MuiDialog`, `MuiTabs`, and `MuiBottomNavigation`. Phase 4 should use real MUI components for these instead of rebuilding them in custom HTML.

## Scope Decisions

### Phase 4 Primary Scope

Deliver these in light theme only:

- sign-in page
- sign-up page
- corrections dashboard page
- responsive behavior for those pages
- reusable app shell and shared components in `apps/web/src/components`
- a production-grade MUI theme that matches the design language more closely than the current baseline theme

### Deferred Scope

Do not implement these in the first Phase 4 pass:

- correction session route UI
- dark theme activation or theme toggle
- fake profile destination from the mobile bottom navigation
- isolated Storybook-first design-system work before the main screens exist

The correction-session screen should still influence architecture in Phase 4, but not implementation priority.

## Theme And Token Strategy

### Decision

Store the source of truth in TypeScript theme tokens, not raw CSS variables.

Reasoning:

- the app already uses MUI and should let MUI own palette, typography, shape, spacing, component overrides, and breakpoint logic
- copying the prototype `:root` variables directly into global CSS would create a second theming system next to MUI
- TypeScript theme tokens are easier to type, test, refactor, and consume from MUI `sx`, `styled`, and component overrides
- dark theme is deferred, so the project does not need a CSS-variable-first runtime toggle yet

Practical rule:

- define tokens in TS
- build MUI themes from those tokens
- expose CSS custom properties only for the small number of values that genuinely need to be consumed outside standard MUI theme access

### Proposed Theme Files

Recommended structure under `apps/web/src/theme`:

- `tokens.ts`: raw light/dark token objects
- `theme.types.ts`: theme augmentation for custom fields
- `createAppTheme.ts`: `createTheme(...)` factory
- `componentOverrides.ts`: MUI component-level overrides
- `AppThemeProvider.tsx`: provider wrapper

### Main Design Tokens Per Theme

These tokens are consistent across the files in each theme and should become the core app design tokens.

#### Shared Token Categories

- brand: `primary`, `primaryDark`, `primaryLight`, `secondary`, `secondaryLight`
- semantic: `error`, `errorLight`, `warning`, `warningLight`, `success`, `successLight`
- text and borders: `textPrimary`, `textSecondary`, `textDisabled`, `divider`
- surfaces: `bg`, `surface`, `shellBg`, `shellSurface`, `shellBorder`, `shellText`, `shellMuted`
- elevation: `shadowSm`, `shadow1`, `shadow2`, `shadow4`, `shadow8`
- typography: `font`, `mono`
- shape: `r`, `rMd`, `rLg`

#### Light Theme Token Baseline

- primary: `oklch(64% 0.24 145)`
- primary dark: `oklch(50% 0.24 145)`
- primary light: `oklch(97% 0.07 145)`
- secondary: `oklch(58% 0.22 264)`
- error: `oklch(52% 0.24 27)`
- warning: `oklch(72% 0.18 65)`
- success: `oklch(60% 0.22 145)`
- text primary: `oklch(11% 0.025 255)`
- text secondary: `oklch(44% 0.018 255)`
- divider: `oklch(88% 0.008 250)`
- page background: `oklch(95.5% 0.009 252)`
- surface: `oklch(100% 0 0)`
- shell background: `oklch(13% 0.03 258)`
- shell surface: `oklch(18% 0.03 258)`
- shell border: `oklch(24% 0.025 258)`
- shell text: `oklch(95% 0.008 258)`
- radii: `6px`, `10px`, `16px`
- font families: `Inter` and `JetBrains Mono`

#### Dark Theme Token Baseline

- primary: same hue family as light theme
- primary light: `oklch(22% 0.08 145)`
- secondary: `oklch(62% 0.22 264)`
- error: `oklch(58% 0.24 27)`
- warning: `oklch(74% 0.18 65)`
- success: `oklch(64% 0.22 145)`
- text primary: `oklch(94% 0.008 258)`
- text secondary: `oklch(72% 0.015 258)`
- divider: `oklch(36% 0.025 258)`
- page background: `oklch(10% 0.025 258)`
- surface: `oklch(21% 0.03 258)`
- shell background: `oklch(7% 0.018 258)`
- shell surface: `oklch(11% 0.024 258)`
- shell border: `oklch(30% 0.022 258)`
- shell text: `oklch(95% 0.008 258)`
- the same radius and font system as light theme

### MUI Mapping

Map the prototype tokens into MUI as follows:

- `palette.primary.main` <- `primary`
- `palette.primary.dark` <- `primaryDark`
- `palette.secondary.main` <- `secondary`
- `palette.error.main` <- `error`
- `palette.warning.main` <- `warning`
- `palette.success.main` <- `success`
- `palette.text.primary` <- `textPrimary`
- `palette.text.secondary` <- `textSecondary`
- `palette.divider` <- `divider`
- `palette.background.default` <- `bg`
- `palette.background.paper` <- `surface`
- `shape.borderRadius` <- base radius, with custom shape tokens for medium and large cards/dialogs
- `typography.fontFamily` <- `font`

Add custom theme fields for tokens that do not fit MUI’s default palette model cleanly:

- `theme.custom.shell.bg`
- `theme.custom.shell.surface`
- `theme.custom.shell.border`
- `theme.custom.shell.text`
- `theme.custom.shell.muted`
- `theme.custom.monoFontFamily`
- `theme.custom.shadows.sm|1|2|4|8`
- `theme.custom.status.successSoft|warningSoft|errorSoft|primarySoft`

### Important MUI Translation Rule

Do not recreate the prototype `TextField`, `Button`, `Alert`, `Chip`, `Dialog`, or `Menu` in raw HTML/CSS wrappers.

Instead:

- use MUI primitives directly
- push recurring look-and-feel into theme overrides and small wrapper components only when there is repeated composition or state handling

This keeps the implementation consistent with the real app stack and avoids a prototype-to-production styling fork.

## Layout And App Shell Decisions

### Root App Layout

The current app wraps every route in a global `Container` in `App.tsx`. That conflicts with the design files, which expect some pages to be full-bleed and others to own their own width constraints.

Phase 4 should remove the app-wide route container and move width decisions into route-level layout components.

### Recommended Layout Templates

Create these top-level reusable templates under `apps/web/src/components/layout`:

- `PublicAppBar`
- `AuthenticatedAppBar`
- `AuthLayout`
- `AppPageShell`
- `PageIntro`

Responsibilities:

- `PublicAppBar`: brand logo plus auth navigation action
- `AuthenticatedAppBar`: logo or breadcrumb, nav, runtime/user actions, avatar menu
- `AuthLayout`: responsive public auth shell with desktop hero slot and compact mobile variant
- `AppPageShell`: protected page content container with responsive max width and spacing
- `PageIntro`: repeated page title + subtitle block

## Component System Map

All shared components should live primarily under `apps/web/src/components`.

### Important Component Structure Rule

The components directory should not be flat.

Preferred pattern:

```text
auth/
  AuthFormCard/
    AuthFormCard.style.ts
    index.tsx
```

Do not use this pattern for new shared components:

```text
auth/
  AuthFormCard.tsx
```

Rules:

- each reusable component gets its own folder
- components with custom styles get a dedicated `*.style.ts` file next to `index.tsx`
- route files under `pages/` may compose components, but shared visual building blocks should live under `components/`
- component-local helpers that are not reused outside the component may live in the same folder

Reasoning:

- Phase 4 will introduce more visual components with non-trivial MUI `styled` or `sx` composition
- per-component folders make later Storybook stories, tests, and subparts easier to co-locate
- this prevents `components/` from becoming a flat list of visually unrelated files

Recommended structure:

```text
apps/web/src/components/
  auth/
    AuthFormCard/
      AuthFormCard.style.ts
      index.tsx
    AuthHeroPanel/
      AuthHeroPanel.style.ts
      index.tsx
    PasswordField/
      PasswordField.style.ts
      index.tsx
    TestCredentialsHint/
      TestCredentialsHint.style.ts
      index.tsx
  brand/
    BrandLogo/
      BrandLogo.style.ts
      index.tsx
  feedback/
    EmptyState/
      EmptyState.style.ts
      index.tsx
    FormAlert/
      FormAlert.style.ts
      index.tsx
    RuntimeModeChip/
      RuntimeModeChip.style.ts
      index.tsx
  inbox/
    CorrectionSessionCard/
      CorrectionSessionCard.style.ts
      index.tsx
    CorrectionSessionCardList/
      CorrectionSessionCardList.style.ts
      index.tsx
    CorrectionSessionsTable/
      CorrectionSessionsTable.style.ts
      index.tsx
    InboxFilterChips/
      InboxFilterChips.style.ts
      index.tsx
    InboxSearchField/
      InboxSearchField.style.ts
      index.tsx
    InboxStatCard/
      InboxStatCard.style.ts
      index.tsx
    InboxStatsRow/
      InboxStatsRow.style.ts
      index.tsx
    SessionStatusChip/
      SessionStatusChip.style.ts
      index.tsx
  layout/
    AppPageShell/
      AppPageShell.style.ts
      index.tsx
    AuthLayout/
      AuthLayout.style.ts
      index.tsx
    AuthenticatedAppBar/
      AuthenticatedAppBar.style.ts
      index.tsx
    PageIntro/
      PageIntro.style.ts
      index.tsx
    PublicAppBar/
      PublicAppBar.style.ts
      index.tsx
  navigation/
    UserAvatarMenu/
      UserAvatarMenu.style.ts
      index.tsx
  session/
    deferred for later Phase 4 follow-up
```

## Stateful Versus Presentational Components

### Decision

Yes, Phase 4 will have stateful components, but they should be intentional and kept shallow.

The default split should be:

- stateful container or route component owns data loading, form state, router integration, auth integration, and derived view state
- presentational UI component receives serializable props and callbacks and focuses on rendering

### What Should Stay Stateful

- route-level pages such as `SignInPage` and `SignUpPage`
- components that bridge to router or auth context
- components that own local disclosure state with real interaction value, such as `UserAvatarMenu`
- future responsive switchers that choose between table and card presentations based on breakpoint

### What Should Stay Presentational

- `AuthFormCard`
- `AuthHeroPanel`
- `FormAlert`
- `EmptyState`
- `InboxStatCard`
- `CorrectionSessionCard`
- `SessionStatusChip`

### Why This Split Matters

- it keeps Testing Library tests cheap and targeted
- it makes later Storybook adoption straightforward
- it avoids burying auth and form logic inside reusable visual components
- it reduces the chance that one responsive variant grows its own hidden business behavior

### Practical Rule For Phase 4

When in doubt:

- page owns RHF, mutations, and navigation
- presentational component receives `title`, `subtitle`, `actions`, `children`, `status`, `error`, `items`, or similar explicit props
- if a reusable component starts owning network calls, translation lookups, and form registration at once, it should likely be split

## Screen-Level Component Map

### 1. Login Screen, Light Theme

Route target:

- existing `/signin`

Shared/template components:

- `PublicAppBar`
- `AuthLayout`
- `AuthHeroPanel` for desktop only
- `AuthFormCard`
- `FormAlert`
- `PasswordField`

Page-specific composition:

- `SignInPage` remains route-level composition
- use existing RHF/Zod/auth hooks
- add `TestCredentialsHint` only when mock mode or explicit dev mode is active

### 2. Sign-Up Screen, Light Theme

Route target:

- existing `/signup`

Shared/template components:

- `PublicAppBar`
- `AuthLayout`
- `AuthHeroPanel`
- `AuthFormCard`
- `FormAlert`
- `PasswordField`

Page-specific composition:

- `SignUpPage`
- reuse the same shell as sign-in, but with different hero text and additional fields

### 3. Corrections Dashboard Screen, Light Theme

Route target:

- existing `/corrections`

Shared/template components:

- `AuthenticatedAppBar`
- `AppPageShell`
- `PageIntro`
- `UserAvatarMenu`
- `RuntimeModeChip`
- `InboxSearchField`
- `InboxFilterChips`
- `SessionStatusChip`
- `EmptyState`

Desktop components:

- `InboxStatsRow`
- `InboxStatCard`
- `CorrectionSessionsTable`

Mobile components:

- `CorrectionSessionCardList`
- `CorrectionSessionCard`

Data note:

- the current `correctionSessions` query only returns `id`, `documentId`, `documentType`, `status`, `version`, and `updatedAt`
- desktop stats should initially be derived client-side from the session list instead of waiting for a dedicated summary endpoint
- “Assigned to me” can be interpreted as the current list length until backend ownership/assignment semantics become richer

### 4. Correction Session Screen, Deferred

Do not build in the first Phase 4 pass, but reserve the component architecture now.

Future shared components:

- `CorrectionSessionHeader`
- `EvidencePane`
- `ProvenanceList`
- `ValidationSummaryBar`
- `ReviewFirstBanner`
- `ConfidenceChip`
- `CorrectionFieldRow`
- `CorrectionFieldCard`
- `SubmitCorrectionsDialog`

Future layout templates:

- `CorrectionSessionDesktopLayout`
- `CorrectionSessionMobileLayout`

## Responsive Design Assumptions

### Decision

Implement one route per screen and switch between layout variants inside React using MUI breakpoints and a small number of major layout branches.

Do not create separate desktop and mobile routes.

Do not port the prototype files one-to-one into separate React pages.

### Auth Screens

Best fit for current setup:

- desktop split layout from `md` upward
- compact centered layout below `md`

Why:

- the mobile auth variants are the same task flow with a smaller presentation
- the differences are mostly layout and visual density, not data model changes

### Corrections Dashboard

Best fit for current setup:

- desktop table + stats layout from `md` upward
- card list layout below `md`

Why:

- the prototype shows a true representation change, not just a narrower table
- small screens should not rely on horizontal table scrolling for the primary experience

Bottom navigation decision:

- do not ship a fake second destination just to match the prototype
- only introduce `BottomNavigation` when there are at least two real mobile destinations in the protected area

### Correction Session

Best fit when this screen is implemented later:

- desktop split evidence/form workspace at `lg` and above
- dedicated tabbed mobile layout below `lg`

Why:

- the correction-session mobile prototype is a different workflow model with tabs and summary grouping
- trying to make the desktop split pane collapse purely with CSS would produce a worse UX than the prototype intends

### Responsive Implementation Rules

- use responsive `sx` props for spacing, typography, and simple show/hide behavior
- use `useMediaQuery` only for major layout switches such as table versus cards or split pane versus tabs
- keep the same data hooks and business state across layout variants
- only swap presentation components, not route contracts or form ownership

## Storybook Decision

### Decision

Introduce Storybook now that the first shared auth and dashboard components exist, but keep it as a support track rather than a blocker for route delivery.

### Why This Fits The Current State Better

- the app now has a real shared component tree under `apps/web/src/components`, which is the right maturity point for colocated stories
- auth and inbox components already have clear presentational boundaries, so Storybook can document them without forcing a storybook-first API design loop
- pages remain the primary integration surface, while Storybook becomes the faster visual review surface for reusable parts

### Story Placement Rule

Story files should be colocated with the parent component, mirroring the preferred unit-test layout.

Recommended pattern:

```text
apps/web/src/components/auth/AuthFormCard/
  AuthFormCard.style.ts
  AuthFormCard.stories.tsx
  index.tsx
```

### Guardrails

- keep stories focused on presentational states and composition variants
- use Storybook decorators to provide routing, i18n, and theme context centrally
- do not move page-owned auth, RHF, or data-loading logic into Storybook-only wrappers
- do not block page implementation on exhaustive story coverage for every state on day one

## Testing Plan

### E2E Tests With Playwright

Phase 4 should plan Playwright coverage only for sign-in and sign-up.

Do not add dashboard or correction-session E2E coverage in this pass.

Recommended scope:

- sign-in happy path in mock mode
- sign-in backend or mock auth failure banner
- sign-up happy path with redirect to sign-in and success message
- sign-up backend or mock failure banner

Recommended future file layout:

```text
apps/web/e2e/
  auth/
    signin.spec.ts
    signup.spec.ts
```

Execution notes:

- run against the web app in mock GraphQL mode
- prefer deterministic MSW-backed flows over live backend coupling
- keep assertions focused on visible behavior, navigation, and accessibility-friendly selectors

### Unit And Integration Tests With Testing Library + MSW

Phase 4 should plan unit and integration coverage only for sign-in and sign-up.

Recommended scope:

- `SignInPage` renders expected fields and CTA actions
- `SignInPage` submits credentials and navigates on success
- `SignInPage` surfaces server-returned error messages
- `SignUpPage` renders expected fields and CTA actions
- `SignUpPage` redirects to sign-in with success state on success
- `SignUpPage` surfaces server-returned error messages
- focused tests for shared auth presentation components once they exist, especially `PasswordField` and `FormAlert`

Validation-specific assertions are intentionally out of scope here. RHF and resolver-library behavior should not be retested unless Elemika adds custom validation behavior of its own.

Recommended future file layout:

```text
apps/web/src/pages/
  SignInPage.test.tsx
  SignUpPage.test.tsx

apps/web/src/integration/
  auth/
    signin.integration.test.tsx
    signup.integration.test.tsx

apps/web/src/components/auth/PasswordField/
  PasswordField.test.tsx
```

Test harness notes:

- use React Testing Library for user-visible behavior
- use MSW to control GraphQL mutation outcomes where page integration with auth operations needs to be exercised
- avoid over-mocking internal implementation details like RHF field registration
- keep auth-provider test wrappers thin and reusable
- keep unit tests colocated with their parent file or component folder
- keep integration tests under a dedicated `integration/` folder and E2E tests under a dedicated `e2e/` folder

## Phase 4 Execution Order

### Task 1: Theme Foundation Refactor

- replace the current minimal `AppThemeProvider` theme with token-driven theme construction
- add custom theme extensions for shell colors, mono font, soft status surfaces, and shadow tokens
- remove the route-global container from `App.tsx`
- move page width and spacing into layout components

### Task 2: Shared Public/Auth Shell

- add `BrandLogo`, `PublicAppBar`, `AuthLayout`, `AuthHeroPanel`, `AuthFormCard`, `FormAlert`, `PasswordField`
- migrate `/signin` and `/signup` to these shared components
- keep existing RHF, Zod, auth hooks, i18n, and server error behavior intact

### Task 3: Dashboard Shell And Shared Inbox Components

- add `AuthenticatedAppBar`, `UserAvatarMenu`, `PageIntro`, `RuntimeModeChip`
- add `SessionStatusChip`, `InboxSearchField`, `InboxFilterChips`, `EmptyState`
- derive simple dashboard stats from the current `correctionSessions` query result

### Task 4: Responsive Dashboard Variants

- implement desktop `CorrectionSessionsTable`
- implement mobile `CorrectionSessionCardList`
- use one responsive route component that selects layout variants at the breakpoint boundary

### Task 5: Stabilization

- tighten component prop APIs after the first page pass
- add focused component tests for the most reused pieces
- add colocated Storybook stories for stable shared components

### Task 6: Storybook Enablement

- add Storybook configuration for the web app without introducing a second theming path
- colocate stories with shared components under `apps/web/src/components/**`
- prioritize auth and inbox presentational components first

### Task 7: Auth Test Coverage

- add Playwright E2E coverage for sign-in and sign-up only
- add Testing Library + MSW tests for sign-in and sign-up only
- keep validation-library behavior out of scope unless custom Elemika validation logic is introduced
- keep dashboard and correction-session tests out of scope for this first Phase 4 delivery

## Acceptance Criteria

Phase 4 should be considered complete for this scoped pass when:

- `/signin` matches the light-theme design direction in a true MUI implementation
- `/signup` matches the light-theme design direction in a true MUI implementation
- `/corrections` matches the light-theme design direction in both desktop and mobile layouts
- the app theme reflects the Phase 4 tokens instead of the current placeholder palette
- shared UI pieces live under `apps/web/src/components`
- the app no longer depends on a single global `Container` for all route layouts
- correction-session UI remains deferred without blocking the shared architecture
- dark theme remains deferred without forcing another theme refactor later
- Storybook is available as a colocated component review tool for the shared Phase 4 components

## Out Of Scope For This Phase 4 Pass

- real correction-session editing UI
- PDF/image evidence preview implementation
- line-item and nested-row editing UX
- dark theme activation and testing
- storybook-first development workflow
- mobile bottom navigation with fake destinations
