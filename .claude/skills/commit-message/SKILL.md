---
name: commit-message
description: Use before writing any git commit message in this repository — defines the required commit format. Trigger this any time you are about to run `git commit`, even for a small change.
---

# Commit Message Convention

Use semantic commit messages: `<type>(<scope>): <subject>`

- `type`: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `revert`
- `scope`: the affected area (feature folder, module, package) — omit it rather than invent one
- `subject`: imperative mood, lowercase, no trailing period
- One line only, ≤ 100 characters total — no body, no footer, even for a multi-file change
- One logical change per commit — never mix a refactor with a feature or a format-only sweep with a fix
- Breaking change: `!` before the colon (e.g. `feat!: drop the v1 auth endpoint`)

Examples:
- `feat(orders): add csv export to order list`
- `fix(auth): correct token refresh race condition`
- `docs: add commit message convention`
