# Code-Inventur: Verarbeitung personenbezogener Daten & Drittanbieter

Stand: Worktree `C:\dev\unslop-legal`, HEAD `5fcec5d` (Merge PR #16), gelesen am 2026-09-28. Nur Code gelesen, nichts ausgeführt, keine DB-Abfrage.

Legende:
- **AKTIV**: im Code aktiv, ohne Flag.
- **FLAG**: hinter Env-/Feature-Flag.
- **DOKU**: nur in Doku/Spec/README erwähnt, nicht im Code.
- **MIGRATION NNN**: Schema laut Migrationsdatei (Historie, nicht verifizierter Live-Stand; Live-Verifikation war nicht Teil dieses Auftrags).
- **PAKET**: Verhalten einer npm-Abhängigkeit (geprüft in `C:\dev\unslop\node_modules`, gleiche `package.json`), nicht im Repo-Code.

---

## 1. Env-Variablen (nach Anbieter)

Referenzdatei: `.env.example:1-65`. Weitere `.env*.example` gibt es nicht. `vercel.json` hat nur `regions` (`vercel.json:2`), `next.config.ts` liest keine Env-Variablen.

### Google Vertex AI
| Var | Zweck | Fundstelle |
|---|---|---|
| `GOOGLE_PROJECT_ID` | GCP-Projekt | `src/lib/vertex.ts:16` |
| `GOOGLE_SERVICE_ACCOUNT_BASE64` | Service-Account-Key, wird nach `os.tmpdir()/vertex-key.json` geschrieben | `src/lib/vertex.ts:17-26` |
| `GOOGLE_APPLICATION_CREDENTIALS` | wird zur Laufzeit gesetzt (ADC) | `src/lib/vertex.ts:26` |
| `GOOGLE_CLIENT_EMAIL` | nur in `.env.example:5`, im Code nicht gelesen | `.env.example:5` |
| `VERTEX_CONTEXT_CACHE_DISABLED` | Kill-Switch für den Explicit Cache | `src/lib/pipeline/context-cache.ts:123` |
| `VERTEX_CACHE_TTL_SECONDS` | Cache-TTL, Default 3600 s | `src/lib/pipeline/context-cache.ts:115-119` |
| `UNSLOP_DRAFT_MODEL_OVERRIDE`, `UNSLOP_DRAFT_MODEL_OVERRIDE_ENDPOINT` | Modell-/Endpoint-Override (A/B) | `src/lib/pipeline/models.ts:25,194` |
| `UNSLOP_VERIFIER_MODEL_OVERRIDE`, `UNSLOP_ESCALATION_MODEL_OVERRIDE` | Modell-Overrides | `src/lib/pipeline/models.ts:68,106` |
| `UNSLOP_FLASH_LEGACY_25` | Rollback auf gemini-2.5 @ europe-west3 | `src/lib/pipeline/models.ts:33-34` |
| `UNSLOP_ESCALATION_LEGACY_PRO` | Rollback auf gemini-3.1-pro-preview @ **global** | `src/lib/pipeline/models.ts:84-85` |
| `UNSLOP_*_THINKING_LEVEL_OVERRIDE` | Thinking-Level | `src/lib/pipeline/models.ts` (mehrere Stellen) |
| `UNSLOP_JOB_BUDGET_MS` | Zeitbudget pro Job | `src/lib/pipeline/deadline.ts:71` |

### Supabase
| Var | Zweck | Fundstelle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Projekt-URL (auch im Browser-Bundle) | `src/lib/supabase/client.ts:6`, `src/lib/supabase.ts:4` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-Key (Browser/SSR, nur Auth + Realtime) | `src/lib/supabase/client.ts:7`, `server.ts:11`, `middleware.ts:13` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-Client im Backend (umgeht RLS) | `src/lib/supabase.ts:6-13` |

### GitHub
| Var | Zweck | Fundstelle |
|---|---|---|
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_BASE64`, `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_SLUG` | GitHub App (JWT, Webhook-Signatur, Install-Link) | `src/lib/github-app.ts:58-66,94,113` |
| `TOKEN_ENCRYPTION_KEY` | AES-Schlüssel für gespeicherte GitHub-OAuth-Tokens | `src/lib/crypto.ts:21` |
| `WEBHOOK_BASE_URL` / `NEXT_PUBLIC_VERCEL_URL` | Ziel-URL für Repo-Webhooks (OAuth-Pfad) | `src/lib/connect-repository.ts:34-35` |

### Paddle
| Var | Zweck | Fundstelle |
|---|---|---|
| `PADDLE_API_KEY` | Server-SDK | `src/lib/billing/paddle.ts:15` |
| `PADDLE_WEBHOOK_SECRET` | Webhook-Signatur | `src/app/api/paddle/webhook/route.ts:20` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV` | Paddle.js im Browser, sandbox/production | `src/app/dashboard/settings/billing/BillingClient.tsx:119-125` |
| `PADDLE_PRICE_PRO_MONTHLY(_TRIAL)` | Price-IDs | `src/app/api/billing/checkout/route.ts:23-24`, `src/lib/billing/plan-config.ts:73-74` |

### Brevo (Waitlist)
| Var | Zweck | Fundstelle |
|---|---|---|
| `NEXT_PUBLIC_WAITLIST_LIVE` | Feature-Flag (`'true'` = aktiv) | `src/lib/waitlist/waitlist-flag.ts:10` |
| `BREVO_API_KEY`, `BREVO_WAITLIST_LIST_ID`, `BREVO_DOI_TEMPLATE_ID_EN/DE` | DOI-Call | `src/lib/waitlist/brevo.ts:55-59` |
| `WAITLIST_IP_SALT` | Salt für den IP-Hash | `src/lib/waitlist/brevo.ts:56` |

### App / Sonstiges
| Var | Zweck | Fundstelle |
|---|---|---|
| `APP_BASE_URL` / `VERCEL_URL` | kanonischer Origin (SEO, Links in PR-Kommentaren, Billing) | `src/lib/site-base-url.ts:9-10`, `src/lib/check-run.ts:33`, `src/lib/gate-notice.ts:51-55` |
| `OPERATOR_USER_IDS` | Allowlist von Supabase-User-UUIDs für Operator-Settings | `src/lib/operator.ts:20` |
| `WORKER_INTERNAL_SECRET` | interne Service-Calls | `src/lib/api-keys.ts:96`, `src/lib/prescan/internal-client.ts:34`, `src/app/api/internal/prescan/route.ts:72` |
| `CRON_SECRET` | Cron-Route (laut Code-Kommentar in Prod nicht gesetzt) | `src/app/api/cron/reap-stale-jobs/route.ts:19`, `src/lib/lazy-reaper.ts:5-6` |
| `NEXT_PUBLIC_CLI_DISTRIBUTION_LIVE` | UI-Flag Onboarding | `src/app/dashboard/OnboardingChecklist.tsx:57` |

### Clients (CLI / MCP / VS Code)
| Var | Zweck | Fundstelle |
|---|---|---|
| `UNSLOP_API_KEY`, `UNSLOP_BASE_URL` | API-Key/Backend, hat Vorrang vor der Config-Datei | `packages/shared/src/node/credentials.ts:43-45`, `packages/vscode-extension/src/cliConfig.ts:35-39` |
| `UNSLOP_REROLL_LIMIT` | Re-roll-Schwelle | `packages/shared/src/node/credentials.ts:83` |

---

## 2. Drittanbieter-Integrationen

### Abhängigkeiten (alle Workspaces)
- Root: `@google/genai`, `@paddle/paddle-js`, `@paddle/paddle-node-sdk`, `@supabase/ssr`, `@supabase/supabase-js`, `next`, `next-intl`, `csv-parse`, `date-fns` (`package.json:15-29`).
- `packages/mcp`: `@modelcontextprotocol/sdk`, `zod`. `packages/prescan`: eslint + Plugins, `tree-sitter-wasms`, `web-tree-sitter`, `yaml`. `packages/cli`, `packages/shared` und `packages/vscode-extension` haben keine Laufzeit-Dependencies.
- **Nicht im Code gefunden**: `@vercel/analytics`, `@vercel/speed-insights`, Sentry, PostHog, Plausible, Google Analytics/gtag/GTM, Hotjar, Intercom, Crisp, Logtail/BetterStack, Datadog, Mixpanel, Amplitude, Upstash/Redis, Resend/SendGrid/Mailgun, OpenAI, Anthropic, Cloudflare. Eine Keyword-Suche über `src/` und `packages/*` ergab keinen Integrationstreffer; `sk-` in `packages/prescan/src/engines/regex-engine.ts:27` ist nur ein Secret-Erkennungsmuster.

### Vercel — AKTIV (Hosting)
- Functions-Region `fra1`: `vercel.json:2`. Kein `preferredRegion` und kein `runtime` in den Route-Segmenten (nicht im Code gefunden).
- Die Laufzeit verwendet `after()` (z. B. `src/app/api/cli/scan/route.ts:106`). Die Logs landen per `console.*` in Vercel (siehe §8).
- Kein `crons`-Block in `vercel.json`. Laut Kommentar ist er auf dem Hobby-Plan nicht deploybar, deshalb gibt es Lazy Reaping (`src/lib/lazy-reaper.ts:1-12`).

### Supabase — AKTIV
- Clients: Browser `createBrowserClient` (`src/lib/supabase/client.ts:4-9`), SSR (`src/lib/supabase/server.ts:6-31`), Proxy/Middleware (`src/lib/supabase/middleware.ts:5-43`), Service-Role-Admin (`src/lib/supabase.ts:13`).
- **Auth-Provider: nur GitHub OAuth.** `signInWithOAuth({ provider: 'github', scopes: 'repo admin:repo_hook read:org' })` steht in `src/app/login/GitHubLoginButton.tsx:33-43`. E-Mail/Magic-Link/Passwort (`signInWithOtp`, `signInWithPassword`, `signUp`) wurde nicht im Code gefunden.
- Realtime: Der Browser abonniert `repositories` per `postgres_changes` (`src/app/dashboard/useDashboardSync.ts:230ff.`; Publication laut MIGRATION 010 `010_enable_realtime_repositories.sql:5`).
- Storage-Buckets: nicht im Code gefunden (kein `.storage.` genutzt).
- `supabase/config.toml` existiert nicht. Region/URL sind im Code nicht sichtbar (nur per Env). `README.md:20` nennt `eu-central-1` (Frankfurt) → **DOKU**.
- pg_cron: Laut MIGRATION 013/028 löscht ein Job deaktivierte Repos nach 30 Tagen (`028_fix_ttl_cleanup_interval.sql:21-31`).

### Google Vertex AI — AKTIV
- Drei Clients (`src/lib/vertex.ts`):
  - `europe-west3` für Embeddings und den 2.5-Legacy-Pfad (`vertex.ts:52-57`).
  - `eu`-Multiregion für Draft, Eskalation und Verifier (`vertex.ts:66-71`).
  - `global` nur für gemini-3.1-pro-preview (`vertex.ts:83-88`).
- Routing: `src/lib/pipeline/models.ts:192-206`. Default-Modelle: Draft `gemini-3.8-flash`, Verifier `gemini-3.6-flash`, Eskalation `gemini-3.8-flash` (`models.ts:51-52,99,114-116`). Der `global`-Pfad ist nur aktiv mit `UNSLOP_ESCALATION_LEGACY_PRO=1|true` oder einem Override auf `gemini-3.1-pro*` bzw. `UNSLOP_DRAFT_MODEL_OVERRIDE_ENDPOINT=global` → **FLAG**.
- Embeddings: `text-embedding-005` über den europe-west3-Client (`models.ts:173`, `src/lib/embeddings.ts:36-39,85-92`).
- **Explicit Context Cache**: Er enthält nur den Regel-Prefix als `systemInstruction`, weder Diff- noch Kundendaten. Belege:
  - `src/lib/pipeline/prompt-builder.ts:47`: „Kein Varianten-Text, keine Diff-Daten, keine Zeitstempel“.
  - `src/lib/pipeline/context-cache.ts:355-359`: `caches.create` mit `systemInstruction: cachedPrefix`.
  - TTL Default 3600 s, sliding (`context-cache.ts:115-119,304-314`).
  - Die Registry-Tabelle `vertex_context_caches` enthält keine personenbezogenen Daten (MIGRATION 033).
- **Was in den Prompt geht** (User-Prompt, uncached):
  - Die kombinierte Diff: `=== FILE: <filename> (<status>) ===\n<patch>` pro Datei (`src/lib/pipeline/helpers.ts:406-409`, zusammengesetzt in `src/lib/pipeline/steps/draft-reviewer-step.ts:174-194`).
  - Optional RAG-Kontext: Code-Skelette aus `code_chunks` (`src/lib/pipeline/steps/rag-loader-step.ts:42`).
  - Referenz-Practices und Prescan-Tupel `(ruleId, path, line)` (`prompt-builder.ts:85-90`).
  - Verifier/Eskalation erhalten Claims inklusive zitiertem Code (`exactQuote`).
  - **Nicht im Prompt** (im PR-Pfad nicht aus dem Webhook gelesen): PR-Titel, PR-Beschreibung, Autor, Commit-Metadaten. Der PR-Parser liest nur `action`, `repository.id`, `repository.full_name`, `pull_request.number`, `html_url`, `head.sha` und `installation.id` (`src/lib/github-webhook-payload.ts:74-100`). Den Repo-Namen im Prompt-Text konnte ich im User-Prompt-Builder nicht finden.
  - Embeddings: Die Skelett-Texte des Repos (Signaturen, Interfaces, Exporte) gehen an text-embedding-005 (`src/lib/skeleton.ts:546`). Die Suchanfrage aus dem Diff läuft über `src/lib/rag.ts:81`.
- Vertex-Labels/Metadaten: nur `displayName: unslop-law-<hash>` am Cache (`context-cache.ts:360`).
- Health-Check-Route `/api/test` (mit internem Secret) sendet einen festen Text an Vertex (`src/app/api/test/route.ts:52-56`).

### GitHub — AKTIV
- API-Basis `https://api.github.com` (`src/lib/github.ts:9`), GraphQL (`github.ts:617`).
- **OAuth** über Supabase:
  - Scopes `repo admin:repo_hook read:org` (`GitHubLoginButton.tsx:40`).
  - Der Provider-Token wird mit AES-256-GCM verschlüsselt in `github_tokens` gespeichert, zusammen mit `github_username` (`src/app/auth/callback/route.ts:34-54`; MIGRATION 003).
  - `/user` wird für den Ownership-Beweis abgefragt: `id`, `login`, Scopes (`src/lib/github.ts:259-291`).
  - Die Org-Rolle kommt aus `fetchOrgMembershipRole` (`github.ts:216`).
- **GitHub App** (Webhook `POST /api/webhook`):
  - Events: `ping`, `installation`, `installation_repositories`, `check_run`, `pull_request`; alle anderen werden ignoriert (`src/app/api/webhook/route.ts:60,83-107`).
  - Gespeichert aus `installation`: `installation_id`, `account.login`, `account.type` (`github-webhook-payload.ts:172-192`; Tabelle `github_app_installations`, MIGRATION 027).
  - Avatar, E-Mail und Sender aus Payloads werden **nicht** gelesen (nicht im Code gefunden).
  - Permissions: Kein App-Manifest im Repo. Laut `docs/specs/GITHUB_APP_SPEC.md:401-402` gelten `checks: write`, `pull_requests: write`, `contents: read & write`, `metadata: read` → **DOKU**.
- Lesezugriffe:
  - PR-Files/Patches (`github.ts:471-477`).
  - Voller Dateiinhalt bei headSha für den Prescan (`src/lib/prescan/file-content-loader.ts:1-8`).
  - Ganzer Repo-Tree und Dateiinhalte für die Skelett-Ingestion (`github.ts:335-367`, `src/lib/skeleton.ts:340ff.`).
- Schreibzugriffe:
  - PR-Reviews mit Inline-Kommentaren, die Findings samt Code-Zitat und Fix-Snippet enthalten (`github.ts:497-506`, `src/lib/pipeline/steps/github-reporter-step.ts:71-90`).
  - Check Runs (`github.ts:893-939`).
  - PR-Kommentare, z. B. „billing paused“ (`src/lib/billing/billing-paused-comment.ts:75-92`).
  - Repo-Webhooks anlegen/löschen im OAuth-Pfad (`github.ts:394-424`).

### Paddle — AKTIV
- **Paddle.js im Browser**, nur auf der Dashboard-Billing-Seite: `initializePaddle` beim Mount (`BillingClient.tsx:117-138`). Das Paket lädt `https://cdn.paddle.com/paddle/v2/paddle.js` (**PAKET**, `@paddle/paddle-js/dist`). Auf der Marketing-Site gibt es kein Paddle.js (nicht im Code gefunden).
- Checkout: Der Server liefert `customData: { account_id, user_id }` und, falls noch keine Customer-ID existiert, `customer: { email: user.email }` (`src/app/api/billing/checkout/route.ts:54-59`). **Die E-Mail des Users geht damit an Paddle.** `Checkout.open` erhält zusätzlich die Locale (`BillingClient.tsx:147-152`).
- Webhook `POST /api/paddle/webhook` speichert nur `paddle_customer_id`, `paddle_subscription_id`, `paddle_price_id`, `status`, `trial_ends_at`, `current_period_end`, `cancel_at_period_end` und `paddle_last_event_at` (`src/lib/billing/paddle-webhook.ts:180-194`). Name, Adresse, E-Mail und Zahlungsdaten werden **nicht** gespeichert (nicht im Code gefunden).
- Rechnungen: Die Liste und PDF-URLs werden live von Paddle geholt, nicht gespeichert (`src/app/api/billing/invoices/route.ts:42-66`).

### Brevo — FLAG (`NEXT_PUBLIC_WAITLIST_LIVE === 'true'`)
- Genau ein Call, `POST https://api.brevo.com/v3/contacts/doubleOptinConfirmation`, mit `email`, `templateId` (je Locale), `redirectionUrl` (`/{locale}/waitlist/confirmed`) und `includeListIds` (`src/lib/waitlist/brevo.ts:13,112-126`). Übertragen werden nur E-Mail und implizit die Sprache (über die Template-Wahl).
- Tracking-Einstellungen (Öffnungs-/Klick-Tracking) leben im Brevo-Account, nicht im Code. Laut `docs/specs/WAITLIST_SPEC.md:122` gibt es Branding-Subdomains `mail`, `r.mail` und `img.mail` → **DOKU**. Ob Tracking aktiv ist: nicht im Code belegbar.
- Laut Spec (`WAITLIST_SPEC.md:37`) hält Brevo den DOI-Nachweis (Zeitstempel, IP der Bestätigung) → **DOKU**.

### Proton
- Im Code nicht gefunden. `unslopai@protonmail.com` erscheint nur in der Doku als Brevo-Account und Reply-To (`WAITLIST_SPEC.md:121,123`) → **DOKU**.

### Weitere Empfänger, die man leicht übersieht
- **npm, PyPI, crates.io, Hugging Face — AKTIV (serverseitig)**: Der Pre-Scanner prüft Paketnamen aus dem Kunden-Code per HEAD/GET auf `registry.npmjs.org`, `pypi.org`, `crates.io` und `huggingface.co/api/models` (`packages/prescan/src/engines/registry-engine.ts:246-249,373-383`). Übertragen werden Paket-/Modellname und die Server-IP (Vercel), keine User-Daten. Cache-Tabelle `prescan_registry_cache` (MIGRATION 031); TTL 7 Tage für existierende, 1 Stunde für nicht existierende Pakete (`registry-engine.ts:27-29`).
- **Google Fonts (fonts.googleapis.com) — AKTIV, im CLI**: Die lokale Callback-Seite von `unslop login` bindet Inter per `@import url('https://fonts.googleapis.com/…')` ein (`packages/cli/src/login.ts:92,98`). Der Browser des Nutzers lädt also beim CLI-Login Fonts direkt von Google (IP-Übertragung).
- **arXiv**: nur ausgehende Links im Footer (`src/app/(marketing)/components/MarketingFooter.tsx:52-58`), keine eingebetteten Ressourcen.

---

## 3. Datenbank: Tabellen mit personenbezogenen Daten (laut Migrationen)

| Tabelle | Personenbezogene Felder / Inhalte | Löschkaskade | Fundstelle |
|---|---|---|---|
| `auth.users` (Supabase-intern) | GitHub-Identität; Code liest `email` und `user_metadata.user_name` | – | `src/app/dashboard/page.tsx:34-35`, `src/app/auth/callback/route.ts:36` |
| `github_tokens` | verschlüsselter GitHub-OAuth-Token (+IV, Tag), Scopes, `github_username` | `ON DELETE CASCADE` auf auth.users | MIGRATION 003 `003_create_github_tokens.sql:6-16` |
| `repositories` | `user_id`, `github_repo_id`, `full_name` (enthält Owner-Login), Webhook-ID/-Secret, `installation_id`, `pipeline_config` | CASCADE auf auth.users | MIGRATION 002:5-19, 014, 027:47-49 |
| `github_app_installations` | `installation_id`, `user_id`, `account_login`, `account_type`, Status (bei `deleted` bleibt die Zeile) | CASCADE auf auth.users | MIGRATION 027:7-15; `src/lib/app-installation.ts:95-102` |
| `review_jobs` | `payload` (CLI/MCP: **vollständiger Diff-Text** bis 300 KB, `repo_full_name`, base/head-SHA; PR: `repo_full_name`, `pr_number`, `pr_url`, `pr_head_sha`), `result` (Findings mit `path`, `line`, **`exactQuote` (Code-Zitat)**, `critique`, **`fixedCodeSnippet`**, Summary), `partial_result`, `error_message` (kann bis 500 Zeichen Modellausgabe enthalten, siehe §4) | `repository_id ON DELETE SET NULL` (die Jobs bleiben verwaist bestehen) | MIGRATION 001, 004:5-9, 034; `src/app/api/cli/scan/route.ts:89-101`; `src/app/api/webhook/route.ts:497-509`; `src/lib/pipeline/steps/result-persister-step.ts:51-80`; `src/lib/pipeline/types.ts:23-55` |
| `review_job_llm_calls` | Token/Latenz/Modell sowie `verdicts` jsonb (verificationQuestion, blindAnswer; können Code referenzieren) | CASCADE auf review_jobs; `repo_id SET NULL` | MIGRATION 021:7-28, 025:7-8; `src/lib/telemetry/llm-call-log.ts:50-66` |
| `code_chunks` | Code-Skelette des Repos im Klartext + Embeddings, `file_path` | CASCADE auf repositories | MIGRATION 007:7-22, 009 |
| `api_keys` | `user_id`, SHA-256-Hash, Prefix, **`label`** (beim CLI-Login `cli-<hostname>`, siehe §6), `last_used_at`, `revoked_at` | CASCADE auf auth.users | MIGRATION 015:7-18; `src/lib/api-keys.ts:73-79` |
| `billing_accounts` / `billing_account_members` | `owner_user_id`, Paddle-Customer-/Subscription-/Price-ID, Status, Trial/Periodenende, Nutzungszähler | CASCADE auf auth.users | MIGRATION 032:13-61 |
| `finding_comments` | job/repo/PR-Nummer, finding_id, GitHub-Comment-ID | CASCADE | MIGRATION 036:8-16 |
| `finding_suppressions` | `user_id`, `repository_id`, `rationale` (Freitext ≥ 30 Zeichen), `commit_sha`, `pr_number`, `api_key_id`, Quelle. **Append-only per Trigger, FK ohne CASCADE** | **blockiert die Löschung** von User/Repo | MIGRATION 037:13-41 (Kommentar Z. 7-10) |
| `waitlist_signups` | `email`, `locale`, `status` (pending/confirmed), `source`, **`ip_hash`** (SHA-256 aus Salt, Tagesdatum und IP), `created_at`, `confirmed_at`. Keine IP, kein User-Agent, **kein Consent-Text und keine Consent-Version** | – | MIGRATION 045:10-19; `src/lib/waitlist/signup-store.ts:40-46` |
| `vertex_context_caches`, `prescan_registry_cache`, `golden_standards`, `reference_practices` | keine personenbezogenen Daten | – | MIGRATION 033, 031 |
| Webhook-Logs / Audit-Logs | eigene Tabellen wurden nicht gefunden | – | – |

Hinweis: Laut `ROADMAP.md:250` ist Migration 045 (waitlist_signups) möglicherweise noch nicht live angewendet („blocked: tooling“). Ungeprüft.

---

## 4. Speicherfristen, TTL und Löschung

| Datum | Frist laut Code | Fundstelle |
|---|---|---|
| `review_jobs` (inkl. Diff, Findings, Code-Zitate) | **Keine Löschung und keine TTL im Code.** Reaper/Lazy Reaping setzen hängende Jobs nur auf `error` (`src/lib/stale-jobs.ts:64-67`, `src/lib/lazy-reaper.ts`). Diffs werden nach dem Review **nicht** entfernt. Einmalige Bereinigung nur für Replay-Waisen (MIGRATION 041). Der Code-Kommentar „TTL-Horizont“ (`src/app/api/cli/findings/resolve/route.ts:27,163`) meint ein Query-Limit, keine Löschung. | – |
| `repositories` (deaktiviert) | Löschung nach 30 Tagen per pg_cron täglich um 03:00 (laut MIGRATION 028:21-31). **Folge:** `review_jobs` bleiben mit `repository_id = NULL` bestehen (MIGRATION 004:5). Die Löschung scheitert, wenn `finding_suppressions` auf das Repo zeigen (FK ohne CASCADE, MIGRATION 037:14). | `supabase/migrations/028_fix_ttl_cleanup_interval.sql` |
| `code_chunks` | Soft-Delete beim Disconnect (`src/app/api/repos/disconnect/route.ts:102-108`); Kommentar: „Vektoren bleiben 30 Tage“. **Ist-Code löscht deaktivierte Chunks bei der nächsten Ingestion bereits nach 10 Sekunden** („Zu Testzwecken auf 10 Sekunden gestellt“, `src/lib/skeleton.ts:348-356`). Außerdem CASCADE, wenn das Repo per Cron gelöscht wird. | – |
| Vertex Context Cache | 3600 s sliding (`context-cache.ts:115`). Enthält nur Regeln. | – |
| `prescan_registry_cache` | 7 Tage / 1 Stunde (`registry-engine.ts:27-29`); nur Paketnamen. | – |
| `github_tokens` | keine Ablaufzeit; lebt bis zur Löschung des auth.users-Eintrags. | MIGRATION 003 |
| `waitlist_signups` | keine Löschung, keine TTL. `status` wird nirgends auf `confirmed` gesetzt; laut MIGRATION 045:5-6 ist das für „Phase 2 per Brevo-Webhook“ vorgesehen. Unbestätigte Einträge bleiben also unbefristet. IP-Hash wechselt täglich. | `src/lib/waitlist/client-ip-hash.ts:27-30` |
| `api_keys` | Revoke setzt `revoked_at`; die Zeile bleibt. | MIGRATION 015 |
| `github_app_installations` | Bei `installation.deleted` wird nur `status='deleted'` gesetzt; die Zeile bleibt. | `src/lib/app-installation.ts:95-102` |
| **Account-Löschung** | **Kein Löschpfad im Code** (kein `auth.admin.deleteUser`, keine Route). Laut `ROADMAP.md:219` würde eine User-Löschung am `finding_suppressions`-FK scheitern. | – |
| Logs (Vercel) | Frist nicht im Code, liegt bei Vercel. | – |

**Logs mit Inhalten** (landen in Vercel-Runtime-Logs):
- Kann das Modell-JSON nicht geparst werden, landet eine **Response-Preview von 500 Zeichen** der Modellausgabe (typischerweise zitierter Kunden-Code) in der Exception (`src/lib/pipeline/helpers.ts:152-156`). Sie wird geloggt (z. B. `src/lib/pipeline/reviewer-call.ts:152-155`) und kann in `review_jobs.error_message` stehen (`src/lib/worker.ts:549-558`; bestätigt in `src/app/api/cli/scan/[jobId]/route.ts:70-72`).
- Repo-Namen, PR-Nummern und Dateinamen werden geloggt, z. B.:
  - `src/app/api/repos/disconnect/route.ts:137`
  - `src/lib/prescan/file-content-loader.ts:72-74` (Dateiname@SHA)
  - `src/lib/skeleton.ts:346`
- GitHub-Account-Login bei Installation: `src/lib/app-installation.ts:92`.
- Paddle Account-/Subscription-IDs: `src/lib/billing/paddle-webhook.ts:215-218`.
- Der Diff-Text selbst wird nicht geloggt; nur die Länge (`src/lib/pipeline/steps/diff-loader-step.ts:56-58`).
- E-Mail-Adressen der Waitlist werden nicht direkt geloggt. `providerError` (Brevo-Fehlertext) wird vollständig geloggt (`src/app/api/waitlist/route.ts:80`); ob Brevo darin die Adresse spiegelt, ist nicht im Code belegbar.
- Der Hostname landet über die URL `?label=cli-<hostname>` in Vercel-Request-Logs (siehe §6).

---

## 5. Cookies, Storage und externe Ressourcen

- **Supabase-Auth-Cookies** (**PAKET** `@supabase/ssr` 0.10.2):
  - Name `sb-<projekt-ref>-auth-token` (bei Größe gechunkt `.0`, `.1`, …) und `…-auth-token-code-verifier` (PKCE).
  - Default: `path=/`, `sameSite=lax`, `httpOnly=false`, **`maxAge` 400 Tage** (`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-10`). Der Code überschreibt diese Optionen nicht (`src/lib/supabase/middleware.ts:31-32`, `src/lib/supabase/server.ts:19-20`).
  - Gesetzt werden sie nur bei Login bzw. Session. Der Proxy ruft `auth.getUser()` für **alle** Pfade auf, auch für Marketing (`src/proxy.ts:5-16,18-31`, `middleware.ts:40`).
- **Locale-Cookie** `unslop_locale` (`src/i18n/config.ts:10`): `maxAge` 1 Jahr, `sameSite=lax`, `path=/` (`src/i18n/set-locale-action.ts:7,22-26`). Er wird nur durch den LocaleSwitcher gesetzt, der auf der Login-Seite und im Dashboard sitzt (`src/app/login/page.tsx:53`, `src/app/dashboard/DashboardNav.tsx:52`). Die Marketing-Site wechselt die Sprache über Pfad-Links, ohne Cookie (`MarketingFooter.tsx:100-113`). Gelesen wird der Cookie zusammen mit `Accept-Language` (`src/i18n/request.ts:15-18`).
- **localStorage** `unslop.onboarding.path` (Wert `github`/CLI-Weg, keine personenbezogenen Daten), nur im Dashboard (`src/app/dashboard/onboarding-progress.ts:51`, `src/app/dashboard/useOnboardingSignals.ts:94,108`).
- Theme-Cookie, `sessionStorage`, `document.cookie`, IndexedDB: nicht im Code gefunden.
- **Paddle.js** (Billing-Seite im Dashboard): lädt ein Drittskript von `cdn.paddle.com` (**PAKET**). Welche Cookies/Storage Paddle.js setzt, ist nicht im Repo belegbar.
- **Supabase direkt aus dem Browser**: Auth-Calls und Realtime-WebSocket gehen an `NEXT_PUBLIC_SUPABASE_URL` (`src/lib/supabase/client.ts`, `GitHubLoginButton.tsx:31-43`).
- **Fonts**: `next/font/google` (Geist, Geist_Mono, Silkscreen) wird zur Build-Zeit geladen und selbst gehostet (`src/app/layout.tsx:2`, `src/app/(marketing)/[locale]/layout.tsx:1`, `src/app/login/page.tsx:1`, `src/app/dashboard/layout.tsx:9`). Im Web kein `<link>` und kein `@import` zu fonts.googleapis.com (`src/app/globals.css:1`). Das OG-Image liest lokale TTFs (`src/app/(marketing)/[locale]/opengraph-image.tsx:46-48`). Ausnahme: die CLI-Callback-Seite (siehe §2/§6).
- Externe Scripts: nur JSON-LD inline (`src/app/(marketing)/[locale]/page.tsx:110-113`). Kein `next/script`.
- Bilder von Drittdomains (Avatare): nicht im Code gefunden (kein `<img>`, kein `next/image`, kein `avatar`).
- Embeds: nicht im Code gefunden.

---

## 6. Clients: CLI, VS-Code-Extension, MCP-Server, Prescan

- **Telemetrie**: Nicht im Code gefunden, weder in CLI, MCP noch Extension. Auch keine Update-Checks.
- **API-Key-Speicherort**:
  - CLI/MCP: `~/.config/unslop/config.json`, Modus 0600 (`packages/shared/src/node/credentials.ts:22-24,56-64`). `UNSLOP_API_KEY` hat Vorrang (`:43`).
  - VS Code: dieselbe Datei; optional die Einstellung `unslop.apiKey` im Klartext in `settings.json` (`packages/vscode-extension/package.json:56-60`, `packages/vscode-extension/src/cliConfig.ts:35-39`). **Kein VS-Code-SecretStorage** (nicht im Code gefunden).
- **An die API gesendet** (`POST /api/cli/scan`): `repoFullName`, `diff` (`git diff --no-color --no-ext-diff -U3 <merge-base>`, `packages/shared/src/node/git.ts:220`), `baseSha`, `headSha`, `dirty`, `source`, `rerollLimit` (`packages/shared/src/node/api-client.ts:37-63`). Der Repo-Name stammt aus `git remote get-url origin` (`git.ts:47`).
  - Git-Autor, E-Mail und Commit-Messages werden **nicht** gesendet: `git diff` enthält sie nicht, `git log` wird nicht aufgerufen.
  - Weitere Endpunkte: `findings/resolve` (rationale, commitSha, prNumber; `api-client.ts:207-214`), `repos/connect`, `repos/status`, PR-Review.
- **Hostname**: `unslop login` baut das Key-Label `cli-${os.hostname()}` (`packages/cli/src/login.ts:35`). Es geht als URL-Parameter an `/dashboard/settings/cli-auth` (`login.ts:41`) und wird als `api_keys.label` gespeichert (`src/app/dashboard/settings/cli-auth/CliAuthClient.tsx:31`, `src/app/api/keys/route.ts:96`).
- **Secret-Filter vor dem Senden**:
  - Gefiltert werden Private-Key-Header, bekannte Präfixe (`sk-`, `sk_live_`, `rk_live_`, `ghp_`/`gho_`/`ghu_`/`ghs_`, `github_pat_`, `usk_`, `xoxb-`/`xoxp-`, AWS `AKIA`/`ASIA`), Env-förmige Zuweisungen (`SECRET|TOKEN|PASSWORD|API_KEY|…=`), GCP-Service-Account-JSON und eine Shannon-Entropie-Heuristik (≥ 4,2 bit/Zeichen, ≥ 24 Zeichen) (`packages/shared/src/node/secret-filter.ts:34-68`).
  - Bei einem Treffer wird der Upload hart abgebrochen, nicht geschwärzt (`diff-upload-guard.ts:38-54`, zweite Prüfung am Netz-Rand `api-client.ts:51-54`).
  - Genutzt von CLI (`packages/cli/src/scan.ts:155`) und MCP (`packages/mcp/src/tools/scan.ts:70`); die Extension startet das CLI.
  - **Wichtig**: Für den GitHub-PR-Pfad (Webhook) gibt es **keinen** serverseitigen Secret-Filter. Die PR-Patches gehen ungefiltert an Vertex (Filter-Aufrufe unter `src/` nicht gefunden).
- **Netzwerk zu Dritten aus den Clients**:
  - `git ls-remote origin` (eigenes Remote des Nutzers, `git.ts:100`).
  - Google Fonts auf der lokalen Login-Callback-Seite (`login.ts:92,98`).
  - Sonst nur `unslop.codes` bzw. `UNSLOP_BASE_URL` (`credentials.ts:15`).
- **Prescan** läuft nur serverseitig (`src/lib/pipeline/steps/pre-scanner-step.ts`, `/api/internal/prescan`). Er ruft die Paket-Registries auf (§2).

---

## 7. E-Mails

- Die App selbst verschickt keine E-Mails (kein Mail-SDK, kein SMTP; nicht im Code gefunden).
- Supabase-Auth-Mails: Da nur GitHub OAuth genutzt wird, löst der Code keine Supabase-Mails aus (Konfiguration im Supabase-Dashboard nicht einsehbar).
- **Brevo** verschickt die DOI-Mail der Waitlist (**FLAG**, `brevo.ts:112-126`), Absender laut Doku `noreply@unslop.codes` (`WAITLIST_SPEC.md:123`, **DOKU**).
- **Paddle** verschickt als MoR Belege und Rechnungen. Das ist nicht im Code, sondern Paddle-Verhalten; der Code übergibt die E-Mail (`checkout/route.ts:59`).
- **GitHub** benachrichtigt über PR-Reviews und Kommentare (GitHub-Verhalten), ausgelöst durch die Review-Posts.

---

## 8. Logging und Monitoring

- Error-Tracking (Sentry o. ä.): nicht im Code gefunden. Alles läuft über `console.*`, also in die Vercel-Logs.
- Memory-Logs ohne personenbezogene Daten (`src/lib/memory-log.ts:10-17`).
- Inhalte in Logs: siehe §4 (500-Zeichen-Modell-Preview, Repo-/Dateinamen, GitHub-Login, Paddle-IDs, Hostname in der URL).
- **Rate-Limiting mit IP-Bezug**: nur die Waitlist, 5 Einträge pro Stunde je IP-Hash (`src/app/api/waitlist/route.ts:19-20,42-51`).
  - Die IP kommt aus dem ersten Eintrag von `x-forwarded-for`, sonst aus `x-real-ip` (`client-ip-hash.ts:18-25`).
  - Gespeichert wird `sha256(salt:YYYY-MM-DD:ip)` (`:27-30`), keine Klar-IP.
- Scan-Quotas sind per User bzw. Account, ohne IP (MIGRATION 032:100-155).
- Eigene Zugriffs-, Webhook- oder Audit-Log-Tabellen: nicht gefunden. `finding_suppressions` ist der einzige Audit-Ledger.

---

## 9. Marketing-Site

- **Routen** unter `src/app/(marketing)/[locale]/`: `page.tsx` (Landing) und `waitlist/confirmed/page.tsx`, dazu `opengraph-image.tsx` und `layout.tsx`. Unterstützte Locales `en`, `de` (`src/i18n/config.ts:7`). **Seiten für Impressum, Datenschutz (`/privacy`), AGB oder Refund gibt es nicht** (nicht im Code gefunden). Laut `ROADMAP.md:175` ist das ein Ship-Blocker.
- **Footer**: `src/app/(marketing)/components/MarketingFooter.tsx`. Die untere Zeile `FooterBottomRow` (`:67-87`) enthält nur Login, Dashboard und Sprachumschalter; **keine Rechtslinks**. Neue Links gehören in das `<nav>` bei `:76-84`. Das Copyright steht bei `:30-32` (`messages/*.json:548`). Die Login-Seite hat eine eigene Mini-Fußzeile ohne Rechtslinks (`src/app/login/page.tsx:58-60`).
- **Waitlist-Consent-Text** (`messages/en.json:512`, `messages/de.json:512`):
  - EN: „Double opt-in. We email you when the private beta opens, nothing else. <privacy>Privacy policy</privacy>“
  - DE: „Double-Opt-In. Wir schreiben dir, wenn die private Beta öffnet, sonst nichts. <privacy>Datenschutz</privacy>“
  - Der Link führt auf `/${locale}/privacy` (`src/app/(marketing)/components/WaitlistCta.tsx:34-40`), also `/de/privacy` und `/en/privacy`. Die Route existiert noch nicht; aktuell ergäbe das einen 404. Die Spec nennt alternativ `/{locale}/datenschutz` (`WAITLIST_SPEC.md:103`); der Code nutzt `/privacy`.
  - Es gibt keine Checkbox; der Consent wird nicht gespeichert (keine Spalte, MIGRATION 045).
- **`NEXT_PUBLIC_WAITLIST_LIVE`**:
  - Einziger Leseort ist `src/lib/waitlist/waitlist-flag.ts:9-11` (`=== 'true'`, zur Laufzeit gelesen).
  - Wirkt in `HeroSection.tsx:61` und `ClosingCta.tsx:26` (Formular statt Standard-CTA) sowie in `src/app/api/waitlist/route.ts:25-27` (sonst 404).
  - Die Seite `waitlist/confirmed` prüft das Flag **nicht**; sie ist immer erreichbar und `noindex` (`confirmed/page.tsx:17-27`).
  - Weil es eine `NEXT_PUBLIC_`-Variable ist, wird sie in Client-Code beim Build eingebacken. Die Leser sind hier Server-Komponenten bzw. die Route, also wird sie zur Laufzeit gelesen.
- **robots/sitemap/metadata**:
  - `robots.ts`: `allow: '/'`, `disallow: ['/api/', '/auth/', '/dashboard', '/login']` (`src/app/robots.ts:4-14`).
  - Sitemap nur `/en` und `/de` (`src/app/sitemap.ts`).
  - Die Landing hat Canonical, hreflang, OpenGraph und Twitter (`[locale]/page.tsx:24-53`).
  - **Kein globaler noindex-Mechanismus**. `noindex` gibt es nur auf `waitlist/confirmed`. Die Landing ist indexierbar, sobald sie deployed ist.
- **Proxy/Middleware für die Locale**: `src/proxy.ts:5-16` setzt den Header `x-unslop-path-locale` für `/en…` und `/de…` und ruft Supabase `updateSession` auf. `/` leitet angemeldete User nach `/dashboard` und anonyme nach `/{locale}` weiter (Cookie oder Accept-Language, `src/app/page.tsx:5-20`).

---

## 10. Geografie (alle Stellen, die Regionen festlegen)

| Komponente | Region | Status | Fundstelle |
|---|---|---|---|
| Vercel Functions | `fra1` | AKTIV | `vercel.json:2` |
| Vertex Draft/Verifier/Eskalation | `eu` (Multiregion) | AKTIV (Default) | `src/lib/vertex.ts:66-71`, `src/lib/pipeline/models.ts:201-206` |
| Vertex Embeddings (text-embedding-005) | `europe-west3` | AKTIV | `vertex.ts:52-57`, `src/lib/embeddings.ts:36` |
| Vertex gemini-2.5-Legacy | `europe-west3` | FLAG `UNSLOP_FLASH_LEGACY_25` | `models.ts:33-38` |
| Vertex gemini-3.1-pro-preview | **`global`** (keine EU-Garantie) | FLAG `UNSLOP_ESCALATION_LEGACY_PRO` bzw. Overrides | `vertex.ts:83-88`, `models.ts:84-99,192-194` |
| Supabase | nicht im Code; `README.md:20` sagt `eu-central-1` | DOKU | – |
| Brevo | nicht im Code; Spec sagt EU (FR/BE) | DOKU | `WAITLIST_SPEC.md:29,37` |
| Paddle, GitHub, npm/PyPI/crates/HF, Google Fonts | nicht im Code | – | – |

Hinweis: `README.md:21` nennt für Vertex noch `europe-west3` und `gemini-2.5-flash`. Das ist veraltet gegenüber dem Code (eu-Multiregion, 3.6/3.8).

---

## (a) Verarbeitungsübersicht

| Verarbeitung | Datenkategorien | Empfänger/Anbieter | Speicherort/Region | Speicherdauer laut Code | Fundstelle |
|---|---|---|---|---|---|
| Hosting/Aufruf Website & API | IP, User-Agent, URL (inkl. Query wie `?label=cli-<hostname>`), Request-Logs | Vercel | `fra1` (Functions) | nicht im Code (Vercel) | `vercel.json:2` |
| Login per GitHub OAuth | GitHub-ID, Login, E-Mail, OAuth-Token | Supabase Auth, GitHub | Supabase (Region nur DOKU) | unbefristet (kein Löschpfad) | `GitHubLoginButton.tsx:33-43`, `auth/callback/route.ts:34-54` |
| Speicherung GitHub-Token | verschlüsselter Token, Username, Scopes | Supabase | Supabase | unbefristet | MIGRATION 003 |
| GitHub-App-Installation | installation_id, account_login/-type | GitHub → Supabase | Supabase | unbefristet (bei Löschung nur Status) | MIGRATION 027; `app-installation.ts:95-102` |
| Repo-Verbindung & Skelett-Index | Repo-Name (Owner), Code-Skelette, Dateipfade, Embeddings | GitHub (Quelle), Vertex (Embedding), Supabase | Vertex `europe-west3`; Supabase | Chunks: Soft-Delete, Ist-Code löscht nach 10 s bei Re-Ingestion; Repo 30 Tage nach Deaktivierung (Cron) | `skeleton.ts:348-356,546`; MIGRATION 007/028 |
| PR-Review (Webhook) | PR-Patches, Dateinamen, voller Dateiinhalt (Prescan), Repo/PR-Nummer/URL/SHA | GitHub, Vertex, Supabase | Vertex `eu` (FLAG: `global`) | Findings/Payload in `review_jobs`: **unbefristet** | `diff-loader-step.ts`, `helpers.ts:406-409`, `webhook/route.ts:497-509` |
| CLI/MCP-Scan | vollständiger lokaler Diff, Repo-Name, SHAs | Supabase, Vertex | Vertex `eu`; Supabase | Diff in `review_jobs.payload`: **unbefristet** | `cli/scan/route.ts:89-101` |
| Veröffentlichung Findings | Code-Zitate, Fix-Snippets, Kritik | GitHub (PR-Reviews/Check Runs) | GitHub | GitHub-seitig | `github-reporter-step.ts:71-90` |
| LLM-Telemetrie | Tokens, Latenz, Verdicts (inkl. Prüffragen/Antworten) | Supabase | Supabase | CASCADE mit Job, also unbefristet | `llm-call-log.ts:50-66` |
| Paket-Existenzprüfung | Paket-/Modellnamen | npm, PyPI, crates.io, Hugging Face | Drittanbieter | Cache 7 Tage / 1 h | `registry-engine.ts:27-29,246-249` |
| API-Keys | Hash, Prefix, Label (Hostname), last_used_at | Supabase | Supabase | unbefristet (Revoke = Flag) | MIGRATION 015; `login.ts:35` |
| Finding-Dismissal | user_id, Begründung (Freitext), commit_sha, PR | Supabase | Supabase | **append-only, nicht löschbar** | MIGRATION 037 |
| Billing | E-Mail (an Paddle), account_id/user_id als custom_data, Paddle-IDs, Abo-Status | Paddle (MoR), Supabase | Paddle; Supabase | Mirror unbefristet | `checkout/route.ts:54-59`, `paddle-webhook.ts:180-194` |
| Waitlist (FLAG) | E-Mail, Locale, Quelle, tagesrotierender IP-Hash | Supabase, Brevo | Supabase; Brevo (EU laut DOKU) | **unbefristet**, `confirmed` nie gesetzt | `waitlist/route.ts`, `signup-store.ts:40-46`, `brevo.ts:112-126` |
| Operator-Zugriff | User-UUID-Allowlist | – | Env | – | `src/lib/operator.ts:20` |
| CLI-Login-Callback-Seite | IP des Nutzer-Browsers | **Google Fonts** | Google | nicht im Code | `packages/cli/src/login.ts:92,98` |
| Fehler-Logs | bis 500 Zeichen Modellausgabe (Code), Repo-/Dateinamen, GitHub-Login | Vercel; `review_jobs.error_message` | Vercel; Supabase | Vercel: nicht im Code; DB: unbefristet | `helpers.ts:152-156`, `worker.ts:549-558` |

## (b) Cookies und Storage

| Name | Zweck | Lebensdauer | gesetzt durch | Fundstelle |
|---|---|---|---|---|
| `sb-<projekt-ref>-auth-token` (ggf. `.0`, `.1` …) | Supabase-Session (Login) | 400 Tage (Paket-Default), `httpOnly=false`, `SameSite=Lax` | `@supabase/ssr` (Proxy/Server/Browser) | `src/lib/supabase/middleware.ts:31-32`; PAKET `constants.js:4-10` |
| `sb-<projekt-ref>-auth-token-code-verifier` | PKCE beim OAuth-Start | Paket-Default (400 Tage max.); wird nach dem Code-Exchange entfernt | `@supabase/ssr` Browser-Client | `GitHubLoginButton.tsx:31-33`; PAKET `auth-js GoTrueClient.js:674,686` |
| `unslop_locale` | gewählte Sprache (Login/Dashboard) | 1 Jahr, `SameSite=Lax`, `path=/` | Server-Action `setLocale` | `src/i18n/set-locale-action.ts:7,22-26`; `src/i18n/config.ts:10` |
| localStorage `unslop.onboarding.path` | gewählter Onboarding-Weg | unbegrenzt (localStorage) | Dashboard-Client | `onboarding-progress.ts:51`, `useOnboardingSignals.ts:108` |
| Paddle.js (Cookies/Storage unbekannt) | Checkout-Overlay | nicht im Repo belegbar | Paddle-CDN-Script, nur Billing-Seite | `BillingClient.tsx:117-138` |

Die Marketing-Site selbst setzt keinen Cookie. Supabase-Cookies entstehen dort nur, wenn schon eine Session besteht, weil `updateSession` auf allen Pfaden läuft (`src/proxy.ts:15`).

## (c) Nicht im Code belegbar / offene Fragen

1. Supabase-Region (nur `README.md:20`: eu-central-1). Die Live-Projektregion muss im Dashboard geprüft werden.
2. Paddle.js: gesetzte Cookies/Storage und Drittdomains zur Laufzeit. Sie liegen nicht im Repo.
3. Brevo: ob Öffnungs-/Klick-Tracking in DOI-Mails aktiv ist. Die Doku nennt `r.mail`/`img.mail` (`WAITLIST_SPEC.md:122`). Die Account-Einstellungen sind nicht im Code.
4. GitHub-App-Permissions: kein Manifest im Repo, nur Spec (`GITHUB_APP_SPEC.md:401-402`). Abgleich mit den Live-App-Settings nötig.
5. Supabase `auth.users`: Welche GitHub-Felder Supabase selbst speichert (z. B. avatar_url, name, E-Mail in `raw_user_meta_data`), ist Supabase-Verhalten und nicht im Code. Der Code liest nur `email` und `user_name`.
6. Vercel-Log-Retention, Vercel-Firewall/WAF-Logging, Edge-Netzwerk außerhalb `fra1`: nicht im Code.
7. Vertex: Googles Abuse-Monitoring/Prompt-Logging (Zero-Data-Retention-Status) ist nicht im Code konfigurierbar oder belegbar.
8. Ob Migration 045 live angewendet ist, ist offen (`ROADMAP.md:250`).
9. Ob `UNSLOP_ESCALATION_LEGACY_PRO` bzw. Model-Overrides in Prod gesetzt sind (dann `global`-Verarbeitung): Env-Werte sind nicht im Repo.
10. **Widersprüche/Risiken für die DSE**:
    - (a) Keine Löschung von `review_jobs` (Diffs und Code-Zitate unbefristet).
    - (b) Kein Account-Löschpfad; der `finding_suppressions`-FK blockiert.
    - (c) Waitlist-`pending`-Einträge unbefristet, `confirmed` wird nie gesetzt.
    - (d) `skeleton.ts:349` löscht Chunks nach 10 s statt der kommentierten 30 Tage.
    - (e) Kein Secret-Filter im PR-/Webhook-Pfad.
    - (f) `/privacy` verlinkt, aber nicht vorhanden; Footer ohne Rechtslinks.
    - (g) Hostname im Key-Label.
    - (h) Google Fonts auf der CLI-Callback-Seite.
    - (i) Kein noindex auf der Landing.
