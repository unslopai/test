# Anti-AI-Slop Gatekeeper

Deterministic review for AI-generated code, before it reaches a pull request. The extension scans your **uncommitted local changes** against Unslop's rule corpus — 119 research-backed rules with verdicts no single LLM votes on — and surfaces confirmed findings right in the editor.

## What it does

- **One-click scan of your working tree**: the status bar shield scans the diff between your working tree and the merge-base with your default branch — exactly what a PR reviewer would see.
- **Findings as native diagnostics**: confirmed findings land in the Problems panel at the offending line, with the violated rule and a customer-safe explanation. Ranges track your edits; findings on lines you have since rewritten are marked stale instead of pointing at the wrong code.
- **Approved fixes, applied locally**: findings that carry a verified fix offer an *Apply fix* action. Nothing is written without your click, and never outside the workspace folder.
- **Guided setup instead of dead ends**: no git repo, no origin, no commits yet, signed out, CLI missing — each state gets a status-bar action that fixes it (`git init`, GitHub publish, fetch, sign-in) rather than an error toast.

## Requirements

- The **Unslop CLI** (`@unslopcodes/cli`, provides the `unslop` binary) installed and on your `PATH`, or configured via `unslop.cliPath`.
- An **Unslop account**: sign in with `unslop login`, which stores an API key for this machine.
- A **git repository** with a GitHub `origin` that is connected to the Gatekeeper (the extension offers the connect flow on first scan).

## How it works

The extension is a thin client: it shells out to the `unslop` CLI, which sends your change diff to the hosted review pipeline (a complexity-routed cascade of a draft reviewer, a blind claim verifier, and an escalation model, scored for cognitive integrity). No analysis happens locally and no rules ship in this package. Currently reviewable file types: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`.

Every transmitted byte passes a secret filter (key/token patterns plus high-entropy detection) before upload.

## Extension settings

| Setting | Description |
| --- | --- |
| `unslop.cliPath` | Path to the `unslop` CLI binary. Leave empty to use `unslop` from `PATH`. |
| `unslop.apiKey` | Gatekeeper API key (`usk_…`). Prefer `unslop login` — this setting is stored in plain text and overrides the CLI config. |
| `unslop.baseUrl` | Gatekeeper backend URL. Leave empty for the default (`https://unslop.codes`). |

## Commands

| Command | Description |
| --- | --- |
| `Unslop: Scan Current Changes` | Scan the working tree's diff against the merge-base of your default branch. |

## Links

- [unslop.codes](https://unslop.codes) — product, dashboard, and account
- [GitHub App](https://unslop.codes) — the same gate as a PR check run
