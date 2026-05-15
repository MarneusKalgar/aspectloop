# Phase 3 Frontend Implementation Plan

## Goal

Turn the completed backend correction flow into a usable frontend application foundation without coupling the web app to backend source code.

Phase 3 is split into two parts so that the repo does not mix protocol plumbing with UI surface detail:

- Part 1: backend refactoring/additions and frontend foundations
- Part 2: UI/UX flows and component breakdown

Phase 3 should stop before advanced correction editing, real document preview, and continuous-learning product flows.

## Current Baseline

The current repository already provides:

- `apps/web` Vite shell
- React Router baseline
- Material UI baseline
- backend GraphQL endpoint in local development

The current repository does not yet provide:

- Apollo Client integration
- GraphQL code generation in the frontend
- i18next
- auth state management
- sign-out flow
- corrections inbox route
- mock GraphQL runtime
- Storybook
- usable seed data for frontend UX work

## Non-Negotiable Phase 3 Rules

### 1. Internationalization First

Phase 3 must add `i18next` from the start.

Rules:

- no inline user-facing strings in React components
- all labels, banners, button text, empty states, and dialogs go through `i18next`
- Phase 3 ships only the `en` locale, but the app must be structurally ready for more locales later
- use semantic ids as locale keys from the start

Pragmatic note:

- Phase 3 should avoid string-key churn by keeping ids stable even while only the `en` locale exists

### 2. Continuous Learning Is Explicitly Deferred

“Continuous Learning” is not a Phase 3 deliverable.

Allowed in Phase 3:

- brief UI messaging that corrections are captured and sent downstream

Not allowed in Phase 3:

- training dashboards
- model feedback controls
- accuracy trend reporting
- any fake ML settings surface

### 3. Treat Backend As A Separate Repository

Frontend planning must assume the backend is an external Java service, even if the current workspace still contains backend code.

This means:

- the frontend must not import backend TypeScript files or generated backend artifacts directly
- the frontend must consume the backend schema over a contract boundary
- the frontend must generate its own operation types from the schema it receives

## GraphQL Contract Consumption Strategy

### Recommended Tooling Choice

Use `@graphql-codegen/client-preset` with `@apollo/client`.

Reasoning:

- the current GraphQL Code Generator React/Vue guide uses the `client` preset as the primary modern path
- the `client` preset is explicitly compatible with Apollo Client
- it generates typed GraphQL documents that work directly with Apollo `useQuery` and `useMutation`
- it keeps the frontend less coupled than generated hook wrappers tied to one specific runtime pattern

Do not base Phase 3 on direct backend type imports.

Do not use `typescript-react-apollo` as the primary Phase 3 strategy.

### Schema Source

Preferred inputs for frontend codegen, in order:

1. a versioned schema artifact exported by the backend repository
2. a non-production GraphQL endpoint used by codegen in CI/dev
3. a committed schema snapshot refreshed by a dedicated sync command

The frontend should own:

- `codegen.ts`
- frontend GraphQL documents
- generated `src/gql/*` artifacts

### Protecting Contract Consumption

Separate codegen-time access from runtime access.

Codegen-time variables, not exposed to the browser:

- `GQL_SCHEMA_URL`
- `GQL_SCHEMA_AUTH_HEADER`

Runtime variables, safe for the browser:

- `VITE_API_URL`
- `VITE_MOCK_GQL_RUNTIME=true|false`

Frontend runtime configuration should be validated with `zod`.

Recommended Part 1 pattern:

- centralize web env parsing in one `env.ts` module
- validate required `VITE_*` values at startup
- fail fast on invalid configuration instead of letting Apollo or router setup fail later

Rules:

- never expose schema introspection credentials through `VITE_*`
- keep codegen auth in local private env files or CI secrets only
- runtime GraphQL requests should use the signed-in user token via `Authorization: Bearer <token>`
- if the backend later requires a public client header, treat it as a separate non-secret runtime config

Optional hardening follow-up, not required for Phase 3:

- persisted operations / allow-listed operations on the backend

## Mocking Strategy

Use MSW for GraphQL mocking.

Reasoning:

- it intercepts real network requests instead of replacing the client layer
- it works with Apollo Client without introducing a separate fake GraphQL client
- the same handlers can be reused in local development, tests, and Storybook

### Minimal Phase 3 Mock Surface

Do not invent extra mock operations.

Part 1 mock handlers should cover only:

- `signUp`
- `signIn`
- `signOut`
- `me`
- the new corrections inbox query from the backend, recommended name: `correctionSessions`
- `correctionSession(sessionId)`

Part 2 may add handlers for:

- `correctionDocument(sessionId)`
- `saveCorrectionSessionDraft`
- `submitCorrections`

## State Management Decision

Phase 3 should postpone global state management.

Recommended ownership model:

- Apollo cache owns server state
- React local state owns isolated view state
- forms own field-local draft state

Part 1 should not add `RTK`, `Zustand`, or `Jotai`.

Introduce a separate state library only in a later phase if the correction workspace starts needing cross-component client-only coordination.

Best candidate if needed later:

- `Zustand` for client-only workspace UI state

Good `Zustand` use cases:

- active field selection
- evidence focus target
- split-pane size
- expanded or collapsed sections
- local review filters
- unsaved client-only UI flags

Do not use `Zustand` for:

- canonical GraphQL entities
- auth user data already stored in Apollo or auth context
- server synchronization state

Why not `RTK` in Phase 3:

- too much structure for the current frontend size
- duplicates Apollo’s job for remote data

Why not `Jotai` in Phase 3:

- useful for atom-heavy UIs, but unnecessary before the correction workspace becomes materially more interactive

## Backend Capability Check Against Common Data-Correction UX Features

### Side-by-Side View

Supported now:

- split-pane workspace layout
- evidence placeholder panel

Not supported now:

- real PDF/image preview backed by backend asset URLs

### Confidence Scoring And Highlighting

Supported now:

- field confidence UI patterns
- low-confidence prioritization

Partially supported now:

- real confidence-rich experience, because seed/runtime provenance data is still thin

### Data Validation

Supported now:

- metadata-driven field validation from schema/registry metadata

Not supported now:

- true business-rule validation such as totals reconciliation or vendor lookups unless the backend adds dedicated rules

### Data Linking

Supported now:

- interaction contracts between field selection and evidence panel

Not supported now:

- real highlight on the original source document because no document asset surface exists yet

### Continuous Learning

Explicit status:

- deferred beyond Phase 3

## Part 1: Backend Additions And Frontend Foundations

### Part 1 Goal

Create the contract, authentication, runtime, localization, and inbox foundations the UI will sit on.

### Required Backend Additions For Part 1

#### 1. Refactor Sign-Up Contract

Current issue:

- `signUp` returns `AuthPayload`, which implies immediate authentication

Required change:

- `signUp` should return a dedicated success payload without `accessToken`

Recommended outcome:

- account creation succeeds
- frontend redirects the user to sign in
- sign-in remains the only way to obtain an access token

#### 2. Add Sign-Out Contract

Current issue:

- no `signOut` mutation exists

Required change:

- add `signOut` to the backend contract

Implementation note:

- if backend auth remains stateless JWT-only in Phase 3, the frontend must still clear its local token immediately
- the backend mutation still gives the product an explicit contract for audit, consistency, and later revocation support

#### 3. Add Corrections Inbox Resolver

Current issue:

- there is no query for the default corrections landing page

Required change:

- add a resolver/query for the current user’s correction sessions inbox

Recommended query name:

- `correctionSessions`

Minimum list fields needed by the frontend:

- `id`
- `documentId`
- `documentType`
- `status`
- `version`
- `updatedAt`

#### 4. Extend Backend Seed Data Only For Supported Surfaces

Current issue:

- the current seed path does not provide usable frontend scenarios

Current note for this repository:

- `createSeedDocuments()` already provides a valid `supplier_invoice` payload for `demo-invoice-001`
- do not change the persistence seed document unless a concrete Part 1 frontend/backend gap requires it

If seed changes become necessary, keep them limited to supported surfaces.

Allowed seed additions in Part 1:

- demo users for sign-in
- correction sessions for the inbox list
- session states with realistic timestamps and versions
- provenance-rich sample data only where the backend already supports it

Do not seed unsupported futures:

- source PDF/image assets if the backend does not expose them
- continuous-learning controls
- fake business-rule outcomes unsupported by the backend

If no seed change is required, the backend handoff should instead document the manual GraphQL operations and inputs needed to create the initial users and sessions.

### Part 1 Frontend Foundations

#### Route Baseline

Recommended route behavior:

- `/` redirects to `/corrections` when authenticated
- `/` redirects to `/signin` when signed out
- `/signin`
- `/signup`
- `/corrections`

The detailed correction workspace route remains part of Part 2.

#### Task 1: GraphQL Codegen And Apollo Foundation

Outcomes:

- add Apollo Client
- add GraphQL Code Generator with `client` preset
- colocate frontend GraphQL operations with components or feature modules
- generate typed documents under a frontend-owned `src/gql/` directory
- add i18next bootstrapping with semantic ids in the `en` resource
- add `zod`-based env validation for frontend runtime config

Expected files:

- `apps/web/package.json`
- `apps/web/codegen.ts` or equivalent
- `apps/web/src/config/env.ts`
- `apps/web/src/gql/*`
- `apps/web/src/providers/ApolloAppProvider.tsx`
- `apps/web/src/providers/I18nProvider.tsx`
- `apps/web/src/i18n/*`

#### Task 2: Real And Mock GraphQL Runtime

Outcomes:

- runtime switch controlled by `VITE_MOCK_GQL_RUNTIME=true|false`
- real mode uses Apollo `HttpLink` against `${VITE_API_URL}/graphql`
- mock mode uses MSW GraphQL handlers
- the same frontend operations work in both modes

Expected files:

- `apps/web/src/graphql/runtime/createGraphqlClient.ts`
- `apps/web/src/mocks/browser.ts`
- `apps/web/src/mocks/handlers/*.ts`

#### Task 3: Auth And Corrections Inbox Foundations

Outcomes:

- sign-up submits successfully and redirects to sign-in
- sign-in stores the access token in memory-first auth state
- `me` hydrates the current user
- sign-out clears local auth state and calls backend `signOut`
- `/corrections` renders the inbox list using the new backend resolver
- all visible copy on these routes goes through `i18next`

Expected files:

- `apps/web/src/auth/*`
- `apps/web/src/pages/SignInPage.tsx`
- `apps/web/src/pages/SignUpPage.tsx`
- `apps/web/src/pages/CorrectionsInboxPage.tsx`
- `apps/web/src/router.tsx`

### Part 1 Exit Criteria

Part 1 is complete when:

- the frontend generates its own GraphQL artifacts and does not import backend source types
- codegen can run against a backend-provided schema artifact or schema endpoint
- `VITE_MOCK_GQL_RUNTIME` cleanly switches between live and MSW-backed runtime modes
- frontend runtime env values are validated through `zod`
- sign-up no longer returns an access token
- sign-in, `me`, and sign-out work in real mode
- `/corrections` works in real mode and mock mode
- all Phase 3 Part 1 copy is resolved through `i18next`
- semantic locale ids are used from the start
- backend seed data is only extended if `createSeedDocuments()` or related supported surfaces actually require it

## Part 2: UI/UX Flows And Component Breakdown

### Part 2 Goal

Define the correction workspace experience, Storybook surface, and design-system component map without overcommitting to unsupported backend features.

### UI/UX Design Brief

#### Product Positioning

The correction UI should feel like a precision workbench, not a generic CRUD admin screen.

Core principle:

- every editable value should feel tied to evidence, even when the evidence panel is still a placeholder in live mode

#### Visual Direction

Recommended aesthetic:

- “Evidence Desk”

Design traits:

- light-first workspace
- quiet surfaces with clear borders
- strong distinction between draft value, original value, and review confidence
- denser information layout than a typical marketing-style app

#### Layout Principles

- `/corrections` is the default authenticated landing page
- `/corrections/:sessionId` is the correction workspace route
- the workspace should retain a split-pane structure even before a real document viewer exists
- validation, conflict, and publish status should be visible in persistent surfaces, not only toast notifications

### Main User Flows And Text Schemas

Each text string below should be implemented through `i18next`. For Phase 3, the `en` resource can act as the initial key/value source.

Implementation note:

- use semantic ids such as `auth.signIn.title` and `corrections.inbox.empty.title`, not English phrases as keys

#### 1. Sign Up

Purpose:

- create a corrector account without auto-signing in

Flow:

- submit sign-up form
- show success state
- redirect to sign-in

Text schema:

- page title: `Create your review workspace`
- supporting copy: `Create an account to access the correction inbox.`
- primary CTA: `Create account`
- secondary CTA: `I already have an account`
- success banner: `Account created. Sign in to continue.`

#### 2. Sign In

Purpose:

- authenticate and land on the corrections inbox

Flow:

- submit credentials
- receive token
- load `me`
- redirect to `/corrections`

Text schema:

- page title: `Review extracted data with evidence at hand`
- supporting copy: `Sign in to open your correction inbox.`
- primary CTA: `Sign in`
- secondary CTA: `Create account`
- error banner: `Could not sign you in. Check your email and password and try again.`

#### 3. Corrections Inbox

Purpose:

- show the current user’s list of sessions at `/corrections`

Flow:

- load inbox query
- show list or empty state
- navigate to a selected session

Text schema:

- page title: `Correction inbox`
- supporting copy: `Open an active review session and continue where you left off.`
- empty state title: `No correction sessions yet`
- empty state body: `New sessions will appear here when documents are ready for review.`
- row action: `Open session`

#### 4. Correction Workspace

Purpose:

- show one session in an evidence-first review layout

Flow:

- open session from inbox
- load session detail data
- render workspace shell with layout placeholders where backend gaps still exist

Text schema:

- workspace title: `Supplier invoice review`
- evidence panel title: `Source evidence`
- evidence placeholder: `Document preview is not yet connected to a source asset.`
- review-first title: `Review first`

#### 5. Sign Out

Purpose:

- let the user end the active session cleanly

Flow:

- trigger sign-out action
- clear local token immediately
- call backend `signOut`
- redirect to `/signin`

Text schema:

- menu action: `Sign out`
- progress label: `Signing out…`

#### 6. Version Conflict

Purpose:

- explain optimistic-lock conflicts without hiding what happened

Text schema:

- banner title: `This session changed before your submit completed`
- banner body: `Reload the latest session state, compare your edits, and submit again.`
- primary CTA: `Reload session`

### Design System Plan With MUI Mapping

#### Theme Foundations

Back the design tokens with MUI theme configuration.

Theme switching should be allowed by the architecture in Part 2.

Phase 3 expectation:

- implement theme tokens in a way that supports both light and dark palettes
- ship light mode first
- defer full dark-mode product polish to a later phase if time is tight

Mappings:

- color tokens -> `createTheme({ palette })`
- typography tokens -> `createTheme({ typography })`
- spacing scale -> `theme.spacing`
- radius -> `shape.borderRadius`
- elevation -> `shadows`
- motion -> `transitions`

Color-token rule:

- tokens should be semantic and theme-aware, not hardcoded only for one palette

#### Primitive Components

MUI candidates:

- `AppShell` -> `AppBar`, `Toolbar`, `Container`, `Drawer`, `Box`
- `PageHeader` -> `Stack`, `Typography`, `Breadcrumbs`
- `SectionCard` -> `Card`, `CardHeader`, `CardContent`
- `StatusBadge` -> `Chip`
- `ConfidenceBadge` -> `Chip`, `Tooltip`, optional `LinearProgress`
- `FieldLabel` -> `InputLabel`, `FormLabel`, `Typography`
- `FieldHint` -> `FormHelperText`, `Tooltip`
- `PrimaryButton` -> `Button` with `contained`
- `SecondaryButton` -> `Button` with `outlined` or `text`
- `InlineBanner` -> `Alert`
- `EmptyState` -> `Paper`, `Stack`, `Typography`, `Button`
- `LoadingState` -> `Skeleton`, `CircularProgress`, `LinearProgress`

#### Correction Components

MUI candidates:

- `CorrectionWorkspaceHeader` -> `Paper`, `Stack`, `Chip`, `Divider`
- `EvidencePanel` -> `Paper`, `Drawer`, `Tabs`, `Stack`
- `EvidencePlaceholder` -> `Paper`, `Alert`, `Typography`
- `LowConfidenceList` -> `List`, `ListItem`, `Chip`, `Badge`
- `CorrectionFieldRow` -> `Grid`, `TextField`, `Select`, `FormControl`
- `CorrectionFieldGroup` -> `Accordion`, `Card`, `Stack`
- `ProvenancePopover` -> `Popover`, `Tooltip`, `List`
- `ValidationSummary` -> `Alert`, `List`, `Link`
- `AuditTimeline` -> `Timeline` from MUI Lab or `List` fallback
- `SubmitConfirmDialog` -> `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`
- `ConflictBanner` -> `Alert`, `Collapse`

#### Auth Components

MUI candidates:

- `AuthShell` -> `Container`, `Paper`, `Stack`, `Grid`
- `SignInForm` -> `TextField`, `Button`, `FormControl`, `Alert`
- `SignUpForm` -> `TextField`, `Button`, `FormControl`, `Alert`
- `AuthStatusBanner` -> `Alert`, `Snackbar`

### Storybook Scope

Part 2 should establish Storybook for the design system and route shells.

Required outcomes:

- token stories
- primitive component stories
- auth screen stories
- corrections inbox row/list stories
- correction workspace shell story
- mock/runtime decorator setup where needed

### Part 2 Tasks

#### Task 4: Correction Route Shell

Outcomes:

- add `/corrections/:sessionId`
- render workspace shell against real backend data where possible
- add placeholder states for unsupported evidence features

#### Task 5: Design System And Storybook Setup

Outcomes:

- wire MUI theme tokens
- add Storybook
- create the first primitive, inbox, auth, and workspace stories

#### Task 6: UX Copy And Scenario Breakdown

Outcomes:

- keep all route and component copy inside `i18next` resources
- expand mock surface only when the related UI route/component is being built
- keep “continuous learning” explicitly marked as deferred in UX documentation and Storybook labels

### Part 2 Exit Criteria

Part 2 is complete when:

- `/corrections/:sessionId` exists as a stable workspace shell
- Storybook covers the main route shells and primitives
- all proposed Phase 3 components have a clear MUI implementation candidate
- the plan still distinguishes between supported, partial, and deferred correction UX capabilities
- “continuous learning” remains out of scope for implementation

## Validation Checklist

When implementing this plan, validate at least:

- codegen against the backend schema source succeeds
- real mode sign-up redirects to sign-in and does not auto-authenticate
- real mode sign-in, `me`, sign-out, and inbox load succeed
- mock mode handles the minimal operation set only
- `i18next` covers all visible copy in the implemented surfaces
- locale resources use semantic ids instead of English phrase keys
- frontend runtime env parsing fails fast on invalid config
- Storybook stories render with the MUI theme once Part 2 begins
