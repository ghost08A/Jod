# CLAUDE.md

This file provides guidance to AI coding agents (Claude Code, Codex, etc.) when working with code in this repository

## Routing — read first, even for trivial edits

Before touching any file under a path below, you MUST Read the matching file
first — no exceptions for small changes.

| Path prefix | Read this file first |
| --- | --- |
| `client/**` | `client/CLAUDE.md` |
| `backend/**` | `backend/CLAUDE.md` |

## Security Rules

- DO NOT hardcode API keys, tokens, passwords, or credentials in source code
- DO NOT log sensitive data (passwords, tokens, secrets, connection strings)
- DO NOT commit `.env`, `.env.local`, or any file containing secrets or credentials
- `.env.example` is the only env file allowed in version control — placeholder values only
- Never expose stack traces or internal error details in API responses
- `appsettings.Example.json` is also an acceptable config template alongside `.env.example` — placeholder values only

## Definition of Done

A task is complete only when

- Build succeeds
- Tests pass
- Formatting and any configured analyzers pass, verified in CI and not only locally
- Existing behavior is preserved
- Requested functionality is implemented
- No unnecessary files are added
- No unrelated code is modified

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`ghost08A/Jod`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
