# CLAUDE.md

This file provides guidance to AI coding agents (Claude Code, Codex, etc.) when working with code in this repository

> **Backend App:** see [../backend/CLAUDE.md](../backend/CLAUDE.md)

## Tech Stack

- React 19 + TypeScript (`strict`)
- Vite 8 (build/dev server; `/api` is proxied to the backend), ESLint 10 + typescript-eslint, Vitest
- Styling: plain CSS (`src/index.css`, `src/App.css`) — nothing else detected yet

## Architecture

- `client/` is a standalone SPA that talks to the ASP.NET Core API in `../backend`
- Keep components and business/data logic separate — see Project Structure rules below
- API calls live in `services/`, never inside components

## Project Structure

Layout (`modules/weather` is the sample module — copy its shape for new features):

```
src/
    core/                     # app-wide wiring
        http/                 # http client (base URL, interceptors)
        router/               # route setup
        providers/
    modules/                  # features
        <module_name>/
            components/       # module components
            constants/
            hooks/            # hooks wrapping services
            services/         # API calls (http client)
            utils/            # pure functions (unit-testable)
            types/
    shared/                   # reusable across modules
        components/
        constants/
        hooks/
        utils/                # pure functions (unit-testable)
        types/
    assets/
    App.tsx
    main.tsx
.env.example                  # environment template only — fake values
```

### Rules

- Never put side effects inside presentational components
- New features are added as a module under `modules/`
- Do not create a new abstraction for one-off usage
- Component filename MUST match its exported name

## Coding Convention

### Naming

| Pattern              | Use for                                                      |
| -------------------- | --------------------------------------------------------------- |
| `PascalCase`         | Components, types, interfaces — file name matches for component files |
| `camelCase`          | Functions, variables                                            |
| `use` + `camelCase`  | Custom hooks (e.g. `useAuth`) — file name matches                |
| `kebab-case`         | Non-component file names (e.g. `date-utils.ts`)                 |
| `UPPER_SNAKE_CASE`   | Module-level constant                                            |

### Coding Rules

- Keep components simple under 200 lines **unless the complexity genuinely justifies it
- Descriptive variable names — no abbreviations like `qty` for `quantity`
- No dead code without comment
- Comments only when intent is non-obvious
- Extract repeated logic into hooks
- Handle errors at the call site
- **Money precision**: never use `float`/`number` math for money, quantity, rate, or
  FX — carry it as string/decimal from the API and format at the display edge only

### For Typescript

- Strict mode on, avoid `any` — prefer `unknown` + narrowing when the real type isn't known yet
- Named exports only — plays better with refactors and auto-import than default exports
- Prefer `undefined` for "no value yet" (optional props, uninitialized state — it's TS/JS's native absence); use `null` only when a value is intentionally, explicitly empty (e.g. mirrors a nullable API/DB field) — don't use the two interchangeably
- `async/await` over `.then` chains
- Avoid the non-null assertion (`!`) — narrow the type instead; `!` compiles clean but is a top cause of "compiles fine, crashes at runtime" bugs

### Editor Config

This repo enforces formatting via `.editorconfig` at the repo root. An AI agent has no
built-in mechanism to auto-load editor config files the way an IDE does — the concrete
rule is restated here so it's actually in context. Match it in every file you write or
edit; don't infer indentation by eyeballing surrounding code.

- Indent: 4 spaces (repo-wide default)
- Line endings: LF, UTF-8, final newline required
- Trailing whitespace trimmed (except Markdown, where it's meaningful for line breaks)
- Line endings are enforced by `.gitattributes` at the repo root, not by your local Git
  settings — never "fix" them by hand, and never change `core.autocrlf` to work around a
  complaint from a formatter
- `.vscode/settings.json` is committed and pins the same rules for the editor. It is not
  personal configuration — do not add themes, fonts, or machine-specific paths to it, and
  do not relax its formatting keys to match a file that is already wrong

If a formatter reports a line-ending or whitespace failure across files you did not
touch, that is a repository configuration problem, not a code problem. Report it and
leave it alone. Do not answer it with a repo-wide reformat, and never let unrelated
reformatted files ride along in a change.

### Formatting Display

- Date: `YYYY-MM-DD`
- DateTime: `YYYY-MM-DD HH:mm:ss`
- Time only: `HH:mm` / `HH:mm:ss`
- Money / amounts: 2 decimal places
- Yield / percentage return: 6 decimal places

### UI & Design System

- Every interactive element needs `hover`, `focus`, `active`, `disabled` state
- Clickable element gets `cursor: pointer`, and `cursor: not-allowed` when disabled
- Forms must be scannable and mobile-friendly
- Meet WCAG 2.1 AA for contrast and color blindness
- Support keyboard navigation
- CTA button: Solid primary only — no ghost buttons for main action
- Define colors/spacing as CSS custom properties once (`:root`) and reuse them — no repeated literal values

### Comment Code

- `// Note:` — allowed for context that aids understanding
- `// TODO:` — if encountered **in files you are editing**, flag it to the user before proceeding

### Before Creating New Code

Before creating a new component, hook, util, or type — search whether an equivalent implementation
already exists and reuse it whenever possible. Before introducing any new type, ask the
user to confirm its name unless the name is explicitly specified in the requirement.

### Loading Indicator

Classify by what's on screen, not by how long a call might take — an agent can always
tell from the markup/template whether something is static, fetched, or a triggered
action; it can never know a call's real-world latency ahead of time.

| UI pattern                                                                                                    | Treatment                                                       |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Static text / content that never depends on a fetch                                                                 | No indicator                                                           |
| View is populated by fetched data — lists, detail pages, dropdown options, any `[label]: [input]` field backed by an API call | Skeleton UI                                                            |
| User-triggered action — submit, save, delete, any button that mutates data                                           | Spinner — disable the control and show the spinner inline/on the button |

#### Rules

- A dropdown/select whose options come from an API counts as fetched data even though it's a small control — skeleton it, don't treat it as static just because it's compact
- Use a full-screen/backdrop spinner only when the action blocks the entire view (e.g. a multi-step wizard submit) — otherwise keep the spinner scoped to the triggering control
- If a similar case already has a loading treatment elsewhere in the repo, match it — consistency beats re-deriving the pattern from scratch

### Commands

Run from `client/`:

```bash
npm run dev          # Start dev server (Vite)
npm run build        # TypeScript check + Vite build
npm run test         # Vitest (once)
npm run lint         # ESLint check
npm run preview      # Preview production build
```

## Testing & Quality

Before marking task complete:

1. Run `npm run lint` — fix all ESLint errors
2. Run `npm run test` — fix all failing tests
3. Run `npm run build` — fix all TypeScript + build errors

### Test Runner

- Test runner is Vitest. `npm run test` runs once; `npm run test:watch` watches. Tests are pure-logic only (`*.test.ts`, node env, no DOM), co-located next to the code under test.

### Unit Test Rules

Unit test required for:

- Calculation logic
- Form validation
- Unit / currency formatting

Do not write unit tests for:

- Presentational components with no logic
- Third-party library behavior

To test logic embedded in a component, extract it into a pure function (e.g. `/utils/`).

### Rules

- **DO NOT edit a test to make a failure pass.** When a test breaks after a code change, stop and report which tests failed and why — decide whether the _code_ regressed or the expected behavior genuinely changed, summarize the impact, and wait for explicit approval before touching any test. Do not assume the test is wrong just because it is red.

## Security Rules and Definition of Done

Root-wide rules (security, Definition of Done) live in
[../CLAUDE.md](../CLAUDE.md) — this file only covers
what's specific to the client.
