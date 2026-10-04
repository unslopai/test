# Server-Security-Audit 2026-09 — AuthN/AuthZ, Webhooks, API-Keys, Quota, Supabase, SSRF/Secrets

**Stand:** 2026-09-28, Commit `5fcec5d` (main). **Methode:** statische Prüfung jeder Route unter `src/app/api/**` samt der aufgerufenen Libs (`src/lib/*` außer `pipeline/**`), Migrationshistorie als Sekundärquelle, bestehende Route-Tests als Belege. **Keine** Requests gegen Produktion, **keine** Schreibzugriffe, **keine** Migrationen. Tabu eingehalten: `src/lib/pipeline/**`, `packages/prescan/**`, `fixtures/rule-recall/**` wurden weder gelesen noch angefasst.

**Vorgänger:** `SECURITY_AUDIT_REPORT.md` (Client-Seite, Prompt-Injection) und `SECURITY_HARDENING_ADVICE.md` §8 („Tenant isolation was not actually proven“). Dieser Audit schließt genau diese Lücke.

---

## Verdict

| # | Scope | Verdict | Schwerstes Ergebnis |
|---|---|---|---|
| 1 | AuthN/AuthZ jeder Route (27 Routen) | **hält** — jede Fach-Query auf Service-Role-Client filtert nach `user_id` bzw. nach einem zuvor owner-geprüften `repository_id`; keine IDOR gefunden | MEDIUM: unauthentifiziertes Registrierungs-Orakel auf `/api/webhook` (M1) |
| 2 | Webhook-Echtheit (GitHub, Paddle) | **hält** — Raw Body, HMAC via `timingSafeEqual`, fail-closed bei fehlendem Secret, Paddle-Replay-Fenster 300 s + Watermark | LOW: GitHub-Deliveries ohne Delivery-ID-Idempotenz (L6) |
| 3 | API-Keys | **hält** — 256 Bit Zufall, nur SHA-256-Hash gespeichert, Widerruf greift sofort, kein Key im Query-String; Ausmaß eines geleakten Keys unten dokumentiert | bekanntes To-Do: kein Scope/Ablauf |
| 4 | Billing/Quota | **hält** — Quota-RPC atomar (Migration 035), Trial-Lifetime-Zähler überleben Re-Subscription, Gates vor jedem LLM-Call | MEDIUM: Paddle-Mirror vertraut client-gesetztem `custom_data.account_id` (M2); MEDIUM: Fremd-PRs verbrauchen Owner-Quota (M3) |
| 5 | Supabase (Tabellen, RLS, Grants, Service-Role-Nutzung) | **hält** (Live-Prüfung 2026-09-29, §5): Tabellen, Funktionen, Grants aus 038/045 und die einzige Policy entsprechen der Historie; kein Cross-Tenant-Pfad | LOW: Verdacht S1 **bestätigt** als L9 — der Owner liest sein eigenes `webhook_secret` und `pipeline_config` per PostgREST und Realtime; Fix-Vorschlag §5a, nicht angewendet |
| 6 | SSRF / Injection / Secrets / Operator-Gate | **hält** — alle ausgehenden Hosts fest (`api.github.com`, Paddle-SDK, Brevo, Vertex), Operator-Gate fail-closed, keine Secrets in Logs/Responses gefunden | LOW: Shared-Secret-Vergleich mit `===` (L2), rohe Fehlertexte in drei 500-Antworten (L4) |

**Ergebnis:** 0 CRITICAL, 0 HIGH, 3 MEDIUM, 8 LOW. Es gibt deshalb **keine Fix-Commits** in diesem Audit; MEDIUM/LOW stehen als To-Do in `ROADMAP.md` §6.
**Nachtrag 2026-09-29:** Mit der Live-Prüfung von Scope 5 sind es 9 LOW (L9 = bestätigter Verdacht S1). Weiterhin keine Fix-Commits; über den S1-Fix entscheidet der Gründer (§5a).

---

## 1. Route-Matrix (Scope 1)

Auth-Arten: **Cookie** = Supabase-Session (`createClient().auth.getUser()`), **Key** = `x-api-key` (`resolveApiKey`), **HMAC** = Webhook-Signatur, **Secret** = Shared Secret im Header, **offen** = keine Auth.

| Route | Auth | Ownership serverseitig | Beleg |
|---|---|---|---|
| `GET /api/repos` | Cookie | `github_tokens`/`repositories` `.eq('user_id', user.id)` | `repos/route.ts:75-107` |
| `POST /api/repos/connect` | Cookie | `connectRepository(user.id, …)` — Zeile per `(user_id, github_repo_id)`, Webhook-Anlage braucht Admin-Recht des User-Tokens | `connect-repository.ts:171-176, 239` |
| `POST /api/repos/disconnect` | Cookie | `.eq('user_id').eq('github_repo_id')` | `disconnect/route.ts:52-57` |
| `POST /api/repos/[id]/activate` | Cookie | `activateAppRepository` `.eq('id').eq('user_id')` | `connect-repository.ts:100-105` |
| `GET /api/repos/[id]/scans` | Cookie | Repo-Lookup `.eq('id').eq('user_id')` **vor** dem Job-Read, byte-gleiche 404 | `scans/route.ts:47-55`; Test `scans-route.test.ts:122` |
| `GET/PUT /api/repos/[id]/settings` | Cookie + Operator | `isOperatorUser` fail-closed, dann `.eq('id').eq('user_id')`; PUT prüft Row-Match | `settings/route.ts:40-53, 102-118`; `operator-gate.test.ts` |
| `GET/POST /api/repos/[id]/webhook-health` | Cookie | `authorizeRepoAccess` `.eq('id').eq('user_id')`; `full_name` aus der DB-Zeile | `webhook-health/route.ts:71-76` |
| `GET/POST /api/keys`, `DELETE /api/keys/[id]` | Cookie | alle Writes `.eq('user_id', user.id)` | `keys/route.ts:22-26, 60-65, 90-97`; `keys/[id]/route.ts:22-29` |
| `POST /api/billing/checkout`, `GET status`, `GET invoices`, `POST cancel/resume` | Cookie | Account über `billing_account_members.user_id` (Unique-Index, Migration 032) | `billing/accounts.ts:254-269` |
| `DELETE /api/cli/auth` | Key | widerruft genau `apiKey.keyId` | `cli/auth/route.ts:16-20` |
| `POST /api/cli/scan` | Key + Entitlement + Quota | `.eq('full_name').eq('user_id')`, Job mit `repoRow.id`, Worker mit `repoRow.user_id` | `cli/scan/route.ts:76-85, 110` |
| `GET /api/cli/scan/[jobId]` | Key | Job `source in (cli,mcp)`, dann Repo `.eq('id', job.repository_id).eq('user_id')` — fremder Job ⇒ 404 | `[jobId]/route.ts:40-61`; Test `poll-route.test.ts:285` |
| `POST /api/cli/pr/review` | Key + Entitlement + Quota | `.eq('full_name').eq('user_id')`, App-only, Installation-Token der eigenen Zeile | `cli/pr/review/route.ts:64-85` |
| `POST /api/cli/findings/resolve` | Key | Repo `.eq('full_name').eq('user_id')`; Finding-ID muss in einem `done`-Job **dieses** Repos vorkommen (rule/severity serverseitig aufgelöst); `finding_comments` nach `repository_id` | `resolve/route.ts:50-63, 165-193, 210-219`; Test `resolve-route.test.ts:155,164` |
| `POST /api/cli/repos/connect` | Key | Repo-ID/Admin-Recht kommen von GitHub mit dem Token des Key-Owners, nicht aus dem Request | `cli/repos/connect/route.ts:33-50`; Test `tenant-scope.test.ts:109-158` |
| `GET /api/cli/repos/status` | Key | `.eq('full_name').eq('user_id')` | `status/route.ts:20-25`; Test `tenant-scope.test.ts:80` |
| `POST /api/webhook` | HMAC (pro Zeile bzw. App-global) | Zeile über `github_repo_id` + Secret bzw. `installation_id`; Owner = `repoRow.userId` der signierenden Zeile | `webhook-delivery.ts:55-114`; Tests `webhook-delivery.test.ts` |
| `GET /api/github/app/setup` | Cookie | `claimInstallation` verlangt Ownership-Beweis gegen GitHub (Account-ID bzw. Org-Admin), `already_linked` wird nie umgehängt | `app-installation.ts:183-229`, `installation-ownership.ts:340-375`; Tests `installation-ownership.test.ts` |
| `POST /api/paddle/webhook` | HMAC | Ziel-Account aus `custom_data.account_id` (siehe M2) | `paddle-webhook.ts:167-198` |
| `POST /api/internal/prescan` | Secret | — (kein Tenant-Kontext) | `internal/prescan/route.ts:71-81`; Test `route.test.ts:55,64` |
| `GET /api/test` | Secret | — | `test/route.ts:24-26` |
| `GET /api/cron/reap-stale-jobs` | Secret (`CRON_SECRET`) | — (globaler Reaper); ohne Secret 503. In `vercel.json` gibt es keinen `crons`-Block, die Route ist derzeit toter Code | `cron/reap-stale-jobs/route.ts:19-30` |
| `POST /api/waitlist` | offen (Flag-gated) | — | `waitlist/route.ts` |

**`api/test` und `api/internal/*` in Produktion:** beide sind deploybar und erreichbar, aber nur mit `WORKER_INTERNAL_SECRET`; fehlt das Secret, antwortet `internal/prescan` 503 und `test` 401 (fail-closed, `api-keys.ts:95-102`). Restrisiko siehe L2 (Vergleich) und L7 (`/api/test` kostet pro Aufruf einen LLM-Call und gibt Vertex-/Supabase-Fehlertexte an den Secret-Inhaber zurück).

---

## 2. Befunde

### M1 — Unauthentifiziertes Registrierungs-Orakel auf `POST /api/webhook` (MEDIUM)

**Beleg:** `src/app/api/webhook/route.ts:270-288`. Die Antwort unterscheidet **vor** jeder erfolgreichen Signaturprüfung drei Zustände: `404 Repository nicht registriert` (kein Kunde), `401 Ungültige Webhook-Signatur` (Kunde vorhanden), `200 Repo läuft über die GitHub App — Legacy-Delivery ignoriert` (Kunde, App-Modus, keine Legacy-Zeile mehr; `webhook-delivery.ts:104-110`).

**Angreifer-Voraussetzung:** keine. GitHub-Repo-IDs sind öffentlich (`GET https://api.github.com/repos/<owner>/<name>` liefert `id`) und für private Repos sequentiell ratbar.

**Ablauf:** `POST /api/webhook` mit `x-github-event: pull_request`, `x-hub-signature-256: sha256=00…`, Body `{"action":"opened","repository":{"id":<ID>,"full_name":"x/y"},"pull_request":{"number":1}}` ⇒ 404 vs. 401 vs. 200 verrät, ob und wie das Repo Kunde ist. Kein Rate-Limit auf der Route.

**Wirkung:** Kundenliste (welche GitHub-Repos unslop nutzen, App- vs. OAuth-Modus) ist enumerierbar. Kein Datenzugriff, keine Kosten.

**Empfehlung (nicht umgesetzt, MEDIUM):** alle nicht verifizierbaren Deliveries einheitlich beantworten (ein Statuscode, ein Body), Unterscheidung nur ins Log. GitHub retried Webhooks ohnehin nicht. Bestehende Tests, die 404/401 unterscheiden (`billing-gate.test.ts:171,180`), müssten mitziehen.

### M2 — Paddle-Mirror vertraut dem client-gesetzten `custom_data.account_id` (MEDIUM, Defense-in-Depth)

**Beleg:** `src/lib/billing/paddle-webhook.ts:167-198` schreibt jeden signierten Subscription-Snapshot auf `billing_accounts.id = custom_data.account_id`. `custom_data` setzt **der Browser** in `Paddle.Checkout.open()` (`src/app/dashboard/settings/billing/BillingClient.tsx:151-154`) mit den Werten aus `POST /api/billing/checkout` — Paddle.js läuft clientseitig, ein Angreifer kann `items`, `customData` und `customer` frei wählen.

**Angreifer-Voraussetzung:** eingeloggter User **und** Kenntnis der `billing_accounts.id` (UUID) eines Opfers. Ein Leck-Pfad für diese UUID wurde nicht gefunden (kein Endpoint gibt sie an Dritte zurück; `GET /api/billing/status` liefert sie nicht einmal dem Owner) — deshalb MEDIUM, nicht HIGH.

**Ablauf (mit bekannter UUID):** Checkout mit `customData.account_id = <Opfer>` abschließen, dann die eigene Subscription kündigen ⇒ `subscription.canceled` spiegelt `status='canceled'` auf den Opfer-Account (Watermark greift nur gegen ältere Events) ⇒ Opfer verliert Entitlement, bis Paddle für **dessen** Subscription das nächste Event schickt.

**Selbst-Missbrauch geprüft und sauber:** ein zweiter Trial über den Trial-Price ist möglich (die Trial-Weiche in `checkout/route.ts:51-55` ist nur UI), aber wirtschaftlich wirkungslos: `trial_scan_count`/`trial_escalation_count` sind Lifetime-Zähler auf dem Account, werden vom Mirror nie zurückgesetzt und in den RPCs bei `status='trialing'` weitergezählt (Migration 032/035) — pro Account bleiben es maximal 100 Gratis-Scans, egal wie oft der Trial-Status neu gesetzt wird.

**Empfehlung:** Mirror-Write zusätzlich an `paddle_customer_id` binden (Account mit gesetztem `paddle_customer_id` akzeptiert nur Events desselben `customer_id`), langfristig serverseitig erzeugte Transaktion (`transactions.create` mit `custom_data`) statt clientseitigem `Checkout.open`.

### M3 — Fremde Pull Requests verbrauchen die Quota des Repo-Owners (MEDIUM, Produktentscheidung)

**Beleg:** `src/app/api/webhook/route.ts:439-475`: jede `pull_request`-Delivery (`opened`/`synchronize`/`reopened`) auf einem aktiven Repo konsumiert `consumeScanQuota(repoRow.userId, …, 'webhook')`. Wer den PR geöffnet hat, spielt keine Rolle.

**Angreifer-Voraussetzung:** Recht, PRs gegen das Repo zu öffnen — bei öffentlichen Repos jeder GitHub-Account.

**Ablauf:** PR öffnen, per Push-Spam `synchronize`-Events erzeugen ⇒ 60 Scans/h, 500/Monat (`plan-config.ts:215-222`) sind nach ~8 h verbraucht; alle weiteren PRs des Kunden bekommen bis zum Monatswechsel „Review übersprungen: Scan-Quota erschöpft“ (`quota_exceeded`-Notice, für App-Repos als blockierender Check Run).

**Wirkung:** Denial-of-Service auf die Reviews eines Kunden plus LLM-Kosten bis zum Plan-Cap. Der Cap begrenzt den Schaden (Unit Economics §8), er verhindert ihn nicht. Bewusst MEDIUM: das ist ein Design, kein Bug — aber pre-launch sollte entschieden werden, ob Fork-PRs bzw. PRs von Nicht-Collaboratoren gegated werden (Payload liefert `pull_request.head.repo.fork` und `author_association`).

### L1 — `POST /api/cli/scan` belastet die Quota, bevor das Repo geprüft wird (LOW)

`src/app/api/cli/scan/route.ts:62-85`: `consumeScanQuota` läuft vor dem Repo-Lookup; ein Scan auf ein nicht verbundenes oder nicht aktives Repo (404 `repository_not_connected`) kostet trotzdem einen Scan. `cli/pr/review` hat dieselbe Reihenfolge (`:53-73`). Nur Selbstschädigung des Key-Owners; ein fehlerhaft konfiguriertes CLI kann so das Stundenfenster leer laufen lassen. Reihenfolge tauschen (Repo-Lookup, dann Quota).

### L2 — Shared Secrets werden mit `===` verglichen (LOW)

`src/lib/api-keys.ts:101` (`x-internal-secret`, `/api/test`), `src/app/api/internal/prescan/route.ts:77`, `src/app/api/cron/reap-stale-jobs/route.ts:28`. Nicht timing-safe; bei 32+ Byte Zufalls-Secrets über das Netz praktisch nicht ausnutzbar, aber SEC-001 verlangt `timingSafeEqual` und `hasValidInternalSecret` existiert bereits als gemeinsame Stelle — beide Routen sollten sie nutzen (die Prescan-Route dupliziert die Logik).

### L3 — Lazy Reaper wird vor der Signaturprüfung geplant (LOW)

`src/app/api/webhook/route.ts:68`: `scheduleLazyReap('webhook')` läuft für **jeden** POST, auch ohne gültige Signatur; der CLI-Poll setzt ihn bewusst erst nach der Key-Prüfung (`[jobId]/route.ts:34-36`). Ein Unauthentifizierter kann damit im Minutentakt pro Instanz einen Scan aller `processing`-Jobs plus GitHub-Calls auslösen. Durch die Drossel (`LAZY_REAP_MIN_INTERVAL_MS`) gedeckelt; hinter die Triage ziehen.

### L4 — Rohe Fehlertexte in 500-Antworten (LOW)

`src/app/api/repos/route.ts:171-176`, `src/app/api/repos/connect/route.ts:69`, `src/app/api/repos/[id]/activate/route.ts:59` geben `extractErrorMessage(err)` zurück. `GitHubApiError.message` enthält den vollständigen GitHub-Response-Body (`github.ts:54-61`), `decryptToken` nennt im Fehlerfall den Env-Variablennamen (`crypto.ts:23-27`). Nur der eigene User sieht es; auf Codes umstellen (die CLI-Routen tun das bereits).

### L5 — Dashboard-Connect/Disconnect validieren `fullName`, `defaultBranch`, `repoId` nicht (LOW)

`src/app/api/repos/connect/route.ts:30-42`, `src/app/api/repos/disconnect/route.ts:42-49, 91-95`: `fullName` fließt unvalidiert in GitHub-Pfade (`/repos/${fullName}/hooks`, `/git/trees/${branch}`) — nur mit dem **eigenen** Token, Host bleibt `api.github.com`, daher keine SSRF. Ein frei gewähltes `repoId` erzeugt eine Zeile `(user, github_repo_id=X, full_name=Y)` mit inkonsistenter Zuordnung; Cross-Tenant ausgeschlossen, weil Webhook-Deliveries über das Secret bzw. die `installation_id` der Zeile matchen (`webhook-delivery.ts`). Regex wie in den CLI-Routen (`^[\w.-]+\/[\w.-]+$`) übernehmen; `disconnect` sollte `full_name` aus der DB-Zeile nehmen statt aus dem Body.

### L6 — GitHub-Webhook ohne Delivery-Idempotenz (LOW)

Kein Code liest `X-GitHub-Delivery` (grep leer). Eine identische, korrekt signierte Delivery erzeugt bei jeder Zustellung einen neuen Job und verbraucht Quota. Wer replayen kann (GitHub-„Redeliver“ = Repo-Admin bzw. App-Owner), kann ohnehin PRs pushen — kein Cross-Tenant, nur Hygiene. Delivery-ID im Job-Payload speichern und per Unique-Index verwerfen.

### L7 — `GET /api/test` in Produktion (LOW)

`src/app/api/test/route.ts`: Health-Check mit echtem Vertex-Call und Supabase-Count, nur mit `WORKER_INTERNAL_SECRET`. Für den Secret-Inhaber ein kostenpflichtiger Endpoint mit Fehlertext-Rückgabe; vor Launch entfernen oder auf einen Nicht-LLM-Check reduzieren.

### L8 — Caps für API-Keys und aktive Repos sind nicht atomar (LOW)

`src/app/api/keys/route.ts:75-86` (count, dann insert) und `src/lib/connect-repository.ts:70-79, 167` (count, dann Webhook + insert/ingest): parallele Requests desselben Users überschreiten `maxApiKeys`/`maxActiveRepos`. Beim Repo-Cap kostet jeder Überlauf eine Skeleton-Ingestion (Embeddings). Nur zahlende Kunden gegen sich selbst; Unique-Partial-Index oder RPC.

**Info (kein Befund):** `src/app/auth/callback/route.ts:49` schreibt `scopes: 'repo,admin:repo_hook,read:org'` hart, unabhängig von den tatsächlich gewährten Scopes; die Ownership-Prüfung liest die Scopes korrekt aus dem `X-OAuth-Scopes`-Header (`github.ts:259-297`), die Spalte ist also nur Anzeige.

---

## 3. Was ein geleakter `usk_`-Key erlaubt (Scope 3)

| Aktion | Möglich | Kostet den Owner |
|---|---|---|
| Scans einreichen (`cli/scan`), PR-Reviews auslösen (`cli/pr/review`) | ja, bis Quota | LLM-Kosten bis Plan-Cap, Reviews auf eigenen Repos |
| Ergebnisse lesen (`cli/scan/[jobId]`) | nur CLI/MCP-Jobs eigener Repos | — |
| Findings dismissen (`cli/findings/resolve`) | ja, mit GitHub-Thread-Resolution unter Bot-/User-Identität | Audit-Ledger-Einträge mit `api_key_id` (rückverfolgbar) |
| **Neue Repos verbinden** (`cli/repos/connect`) | ja — mit dem gespeicherten **OAuth-Token des Owners** wird ein Webhook angelegt und die Ingestion gestartet | Embedding-Kosten, Webhooks in den GitHub-Repos des Owners (bis `maxActiveRepos`) |
| Keys erzeugen/auflisten/löschen, Billing, Disconnect, Settings | nein (Cookie-only) | — |
| Sich selbst widerrufen (`DELETE cli/auth`) | ja | — |

Erzeugung/Hashing/Vergleich: `randomBytes(32)` base64url, SHA-256-Hex ohne Pepper (bei 256 Bit Entropie ausreichend), Lookup per `.eq('key_hash')` auf Unique-Spalte, `revoked_at` wird bei jedem Request geprüft (`api-keys.ts:27-82`). Key nur im Header (`x-api-key`), nie im Query-String (CLI/Extension/MCP geprüft). Kein Ablauf, kein Scope — bekanntes To-Do §6.

---

## 4. Geprüft und sauber

- **Tenant-Grenze auf dem Service-Role-Client** (Kernfrage des Hardening-Advice §8): Alle Fach-Queries in den Routen und in `worker.ts:loadRepoRow` (`:420-424`, beide Pfade `.eq('user_id')`), `connect-repository.ts`, `app-installation.ts` (`loadKnownRepos`, `adoptKnownRepositories`, `detachLegacyWebhook` je `.eq('user_id')`) filtern nach User oder nach einem zuvor owner-geprüften `repository_id`. Job-Ownership wird beim Poll (`[jobId]/route.ts:52-61`), beim Dismissal (`resolve/route.ts:165-173`) und in der Scan-Historie (`scans/route.ts:47-69`) neu geprüft. Belegt durch die Cross-Tenant-Fälle in `poll-route.test.ts:285`, `resolve-route.test.ts:155`, `scans-route.test.ts:122`, `tenant-scope.test.ts:80-97`, `operator-gate.test.ts:94,131`.
- **Webhook-Zuordnung bei Mehrfach-Tenants:** `selectLegacyTarget` wählt die Zeile über das Secret, das die Delivery signiert hat, nicht über die DB-Reihenfolge; ein Angreifer mit eigenem Hook auf demselben Repo landet immer auf der eigenen Zeile (`webhook-delivery.ts:82-114`; `webhook-delivery.test.ts:79-116`). App-Deliveries brauchen das globale App-Secret **und** eine Zeile mit passender `installation_id`; fehlt die App-Konfiguration, wird fail-closed abgelehnt (`:60-79`; Test `:65`).
- **GitHub-Signatur:** Raw Body (`request.text()`), `sha256=`-HMAC, Längencheck + `crypto.timingSafeEqual` (`github.ts:1067-1084`). **Paddle-Signatur:** `ts:body`-HMAC, alle `h1`-Kandidaten timing-safe, `|now − ts| ≤ 300 s`, fehlendes Secret ⇒ 500 (`paddle-webhook.ts:64-87`, `paddle/webhook/route.ts:20-24`). Idempotenz: `paddle_last_event_at`-Watermark mit `lt` verwirft identische und ältere Events (`:196-197`; Tests `paddle-webhook.test.ts:59,187`).
- **App-Installation-Claim (D11):** `installation_id` aus der Query wird gegen GitHub bewiesen (numerische Account-ID bzw. Org-Admin-Rolle, Scope aus `X-OAuth-Scopes`, 403 ⇒ Re-Login statt Ablehnung); bereits verknüpfte Installationen werden nie umgehängt (`app-installation.ts:189-195`). CSRF über den GET-Callback ist dadurch wirkungslos: ein untergeschobenes `installation_id` scheitert am Beweis.
- **Quota-Atomarität:** `consume_scan_quota` prüft die Would-be-Zähler im `WHERE` desselben `UPDATE` (Migration 035) — parallele Requests können weder überbuchen noch verbraucht ein Deny etwas. Aufrufer behandeln RPC-Fehler fail-closed (`entitlements.ts:125-129`). Trial-Lifetime-Zähler siehe M2.
- **Operator-Gate:** `OPERATOR_USER_IDS` leer/unset ⇒ niemand, auch nicht der Operator (`operator.ts:22-28`; `operator.test.ts:18-28`); Operator sieht nur eigene Repos; Nicht-Operator bekommt die byte-gleiche 404 ohne DB-Zugriff.
- **Fehlertexte an Clients:** `error_message` erreicht den CLI-Client nur als stabiler Code (`classifyJobFailure`, `[jobId]/route.ts:69-79`; Test `poll-route.test.ts:204`); die Scan-Historie selektiert `error_message` gar nicht erst.
- **Secrets in Logs:** kein `console.*` gibt Token, Secret, Key-Klartext oder Signatur aus (grep über `src/`); Installation-Tokens leben nur im Prozess-Cache (`github-app.ts:164`); der API-Key-Klartext wird genau einmal im 201 zurückgegeben (`keys/route.ts:106-109`; Test `keys/billing-gate.test.ts:166`).
- **Ausgehende Requests:** `githubFetch` präfixt jeden relativen Pfad mit `https://api.github.com` (`github.ts:110`); Prescan-Client ruft `siteBaseUrl()` aus `APP_BASE_URL`/`VERCEL_URL` (`internal-client.ts:45`, `site-base-url.ts`); Brevo und Paddle über SDK/feste Hosts. Keine nutzergesteuerte URL erreicht einen `fetch`.
- **CSRF:** alle Cookie-authentifizierten Mutationen sind `POST/PUT/DELETE`; Supabase-SSR-Cookies sind `SameSite=Lax`, cross-site `fetch` mit JSON braucht einen Preflight. Die einzigen GETs mit Seiteneffekt (`app/setup`, `auth/callback`) sind durch Ownership-Beweis bzw. PKCE-Code geschützt.
- **Redirects:** `auth/callback` akzeptiert `next` nur mit führendem `/` und hängt es an den Origin an (`//evil` bleibt ein Pfad auf dem eigenen Host); `app/setup` baut Ziele nur aus `request.url.origin`.

---

## 5. Supabase-Live-Stand (Scope 5)

### Nachtrag 2026-09-29: Live-Prüfung durchgeführt

**Methode:** Supabase-MCP `execute_sql` gegen `ypjgdqkrsnetiiosspix`, nur lesend. Die Rollen-Proben liefen als `DO`-Block, der mit `RAISE EXCEPTION` endet: die Transaktion wird dadurch in jedem Fall zurückgerollt, das Ergebnis steht in der Fehlermeldung. Ausgegeben wurden nur Längen und Wahrheitswerte, nie ein Secret.

| # | Frage (Liste unten) | Ergebnis | Beleg |
|---|---|---|---|
| 1 | Tabellen/Views/RPCs wie in der Historie? | **ja**: 16 Tabellen, exakt die Liste unten, alle mit `relrowsecurity = true`; 0 Views, 0 Materialized Views. 8 Funktionen in `public`: `consume_scan_quota`, `consume_pro_escalation_quota`, `match_golden_standards`, `match_reference_practices`, `match_code_chunks` (zwei Overloads, s. Nebenbefund), `finding_suppressions_append_only`, `rls_auto_enable` (Supabase-Event-Trigger); alle mit festem `search_path` (Migration 049) | `pg_class`, `pg_proc` |
| 2 | Gelten die Grants aus 038/045? | **ja**: `role_table_grants` für `anon`/`authenticated` liefert genau eine Zeile, `repositories / authenticated / SELECT`. Die 15 übrigen Tabellen haben im `relacl` nur `postgres` und `service_role`. Kein `EXECUTE` für `anon`/`authenticated` auf einer der 8 Funktionen | `information_schema.role_table_grants`, `pg_class.relacl`, `pg_proc.proacl`, `has_function_privilege` |
| 3 | Ist `authenticated` auf `repositories` spaltenweise eingeschränkt? | **nein**: `relacl` enthält `authenticated=rm/postgres` (Tabellen-Grant SELECT + MAINTAIN), `pg_attribute.attacl` ist für jede Spalte `NULL`. Die 13 Zeilen in `column_privileges`, darunter `webhook_secret` und `pipeline_config`, leiten sich aus dem Tabellen-Grant ab | `pg_class.relacl`, `pg_attribute.attacl`, `information_schema.column_privileges` |
| 4 | Gibt es Policies, die die Historie nicht kennt? | **nein**: genau eine, `Users can view their own repositories`, `SELECT`, Rollen `{public}`, `qual = (auth.uid() = user_id)` | `pg_policies` |

Die Erwartung aus der Historie (unten) trifft in allen vier Punkten zu. Zu Punkt 3 lautete sie „kein Spalten-Grant, also alle Spalten“, und genau deshalb ist S1 real.

**Verdacht S1: bestätigt**, geführt als **L9 (LOW)**:

- *PostgREST-Pfad, Request als `authenticated`:* `SET LOCAL ROLE authenticated` plus `request.jwt.claims = {sub: <Owner der einzigen Zeile mit Secret>, role: authenticated}`, also genau die Session, die PostgREST für einen eingeloggten User setzt. Ergebnis: `visible_rows=1 foreign_rows=0 webhook_secret_length=64 pipeline_config_visible=t`. Der Owner liest sein eigenes Hook-Secret im Klartext und seine `pipeline_config`; fremde Zeilen sieht er nicht.
- *Gegenprobe `anon`:* `SELECT count(*) FROM repositories` als `anon` ergibt `42501 permission denied for table repositories`.
- *Realtime-Pfad:* `repositories` steht mit **allen 13 Spalten** in der Publication `supabase_realtime` (`pg_publication_tables.attnames`, ohne Spaltenliste und Row-Filter, Replica Identity `default`). `realtime.apply_rls` (Quelle live gelesen) setzt pro Spalte `is_selectable = has_column_privilege(working_role, entity_, name, 'SELECT')` und gibt in `record`/`old_record` genau die lesbaren Spalten aus. Live liefert `has_column_privilege('authenticated', 'public.repositories', …, 'SELECT')` für `webhook_secret` und `pipeline_config` jeweils `true`, also enthält jedes UPDATE-Event an den eingeloggten Owner beide Werte. Ein mitgeschnittenes Payload gibt es nicht, weil zum Prüfzeitpunkt keine Subscription aktiv war (`realtime.subscription` leer). Belegt ist der Pfad über Publication, `apply_rls` und das Spaltenrecht.
- *Kein Cross-Tenant:* Die Policy filtert `auth.uid() = user_id` (Probe: `foreign_rows=0`).
- *Warum LOW:* Betroffen ist nur die eigene Zeile. `pipeline_config` enthält live die Schlüssel `activeConditionIds`, `cascade`, `enabledStepIds` und `overrideSmartDetection`: operator-interne Tuning-Werte, keine Secrets, aber ein Widerspruch zu OPERATOR_SETTINGS_SPEC D4. Das eigentliche Risiko ist `webhook_secret`. Wer einmal eine Session des Owners hat (XSS, fremder Rechner), kann mit dem Secret auch nach dem Logout signierte Deliveries für dieses Repo fälschen (Quota verbrauchen, Reviews auslösen), bis das Secret rotiert wird. Secrets pro Zeile gibt es nur im Legacy-Modus; live trägt 1 von 5 Zeilen eines.
- *Nebenbefund `MAINTAIN`:* Migration 038 entzieht `authenticated` auf `repositories` eine feste Liste (`INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`). Das Recht `MAINTAIN`, das es seit Postgres 17 gibt (VACUUM, ANALYZE, REINDEX, CLUSTER, LOCK TABLE), fehlt in dieser Liste und ist live erteilt. Über PostgREST und Realtime ist es nicht auslösbar, weil beide kein freies SQL ausführen. Hygiene; der Fix in §5a nimmt es mit.
- *Nebenbefund `match_code_chunks`:* Live existiert auch der Overload `(query_embedding, match_threshold, match_count)` ohne `target_repository_id`, der über alle Mandanten sucht. Ausführen darf ihn nur `service_role`, und `src/lib/rag.ts:92` ruft ausschließlich den Overload mit Repo-Filter auf. Das ist toter, mandantenblinder Code (ROADMAP §6, Kandidat für DROP).
- *Advisor* (`get_advisors security`, 2026-09-29 15:42 UTC): meldet S1 nicht, weil er nur RLS und die Existenz von Policies prüft, keine Spaltenrechte.

### Stand am Audit-Tag (2026-09-28), zur Nachvollziehbarkeit unverändert

In dieser Session gab es **keinen** Lesezugriff auf die Live-Datenbank:

- Der Supabase-MCP hat sich nicht verbunden (`ERR_PROXY_TUNNEL` beim Dial auf `mcp.supabase.com` — ein Netz-Symptom dieser Umgebung, **nicht** der in `CLAUDE.md` beschriebene `-32600`-Zustand; beide Zustände sind unabhängig voneinander möglich).
- `scripts/db-query.ts` liest `.env.local`; die Datei existiert im Checkout nicht, `SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL` sind nicht in der Umgebung.
- `src/lib/supabase/private-grants.integration.test.ts` (Grant-Guard gegen das Remote-Projekt) skippt ohne Credentials — das sind die 21 Skips im `npm test`-Lauf.

Damit ist **ungeprüft** (weder Befund noch Entwarnung):

1. Welche Tabellen/Views/RPCs live existieren und ob sie der Migrationshistorie entsprechen (Historie: `repositories`, `github_tokens`, `code_chunks`, `golden_standards`, `reference_practices`, `review_jobs`, `review_job_llm_calls`, `api_keys`, `github_app_installations`, `billing_accounts`, `billing_account_members`, `prescan_registry_cache`, `vertex_context_caches`, `finding_comments`, `finding_suppressions`, `waitlist_signups`; RPCs `consume_scan_quota`, `consume_pro_escalation_quota`, `match_*`).
2. Ob die Grants aus Migration 038/045 live gelten (`REVOKE ALL … FROM anon, authenticated` auf 14 Tabellen + 6 RPCs; `repositories` behält `authenticated SELECT`).
3. Ob `authenticated` auf `repositories` **spaltenweise** eingeschränkt ist (siehe S1).
4. Ob es live Policies gibt, die die Historie nicht kennt (die Historie kennt genau eine: `Users can view their own repositories`, Migration 011).

**So wird es nachgeholt** (nur Lesen, Service-Role-Pfad der App):

```
npx tsx scripts/db-query.ts repositories --columns id,user_id,github_repo_id,installation_id --limit 1
```

und im SQL-Editor des Users (read-only):

```sql
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
order by table_name, grantee;

select column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'repositories' and grantee = 'authenticated';

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies where schemaname = 'public';
```

Erwartung laut Historie: Zeile 1 listet nur `repositories/authenticated/SELECT`; Zeile 2 ist leer (kein Spalten-Grant, also alle Spalten); Zeile 3 zeigt genau eine Policy.

**Service-Role-Nutzung, wo ein User-Kontext reichen würde:** Nach Code-Lage könnten `GET /api/repos/[id]/scans`, `GET/DELETE /api/keys*`, `GET /api/billing/status` und die Dashboard-Server-Components mit einem User-Client unter RLS laufen. Das setzt aber Policies auf `review_jobs`, `api_keys`, `billing_accounts` voraus, die es (laut Historie) bewusst nicht gibt, weil Migration 038 gerade die Client-Grants entzogen hat. Die Verteidigungslinie ist heute allein der `user_id`-Filter — genau die Aussage des Hardening-Advice. Zweite Linie ohne Client-Grants: ein dedizierter DB-Role mit RLS statt Service-Role in den Lese-Routen (To-Do §6).

### 5a. Fix-Vorschlag S1/L9 (NICHT angewendet, Entscheidung des Gründers)

**Keine View.** Realtime `postgres_changes` hängt an der logischen Replikation. Views erzeugen keine WAL-Einträge und können nicht in eine Publication aufgenommen werden, „Realtime auf eine schmale View“ ist also nicht umsetzbar. Tragfähig ist das spaltenweise Grant:

```sql
-- S1/L9: authenticated sieht auf repositories nur noch, was das Dashboard-Abo braucht.
-- Ein Spalten-REVOKE neben einem Tabellen-Grant wirkt in Postgres nicht; deshalb den
-- Tabellen-Grant ganz entziehen (nimmt MAINTAIN mit) und spaltenweise neu erteilen.
-- `id` ist Pflicht: ohne lesbaren Primärschlüssel antwortet Realtime mit "Error 401".
REVOKE ALL ON TABLE public.repositories FROM authenticated;
GRANT SELECT (id, github_repo_id, status, updated_at) ON TABLE public.repositories TO authenticated;
```

`user_id` muss nicht in die Liste. Realtime prüft die RLS mit `select exists(select 1 from repositories where id = …)` als Abonnenten-Rolle (`realtime.build_prepared_statement_sql`, live gelesen); dafür reicht das Spaltenrecht auf `id`, und Policy-Ausdrücke brauchen kein Spaltenrecht des Aufrufers.

**Trockenlauf (zurückgerollt, 2026-09-29):** REVOKE und GRANT wie oben, danach als `authenticated` mit den Claims des Owners: `visible_rows=1 status_readable=t webhook_secret=denied pipeline_config=denied select_star=denied`, `has_column_privilege(webhook_secret)=f`, `has_column_privilege(status)=t`. Die Policy greift also weiter, obwohl `user_id` nicht lesbar ist. Nach dem Rollback ist der Live-Stand unverändert: `relacl` = `authenticated=rm/postgres`, 0 Spalten-ACLs.

**Folgen für `src/app/dashboard/useDashboardSync.ts`:**

- Das Abo (`:263-268`, `event: 'UPDATE'` auf die ganze Tabelle) bleibt wie es ist. `parseRepoStatusRow` (`:234-257`) liest nur `new.id`, `new.github_repo_id` und `new.status`, alle drei bleiben lesbar. Es ist keine Code-Änderung nötig.
- `apply_rls` lässt nicht lesbare Spalten aus `record`/`old_record` weg, statt das Event zu verwerfen. `payload.new` enthält danach nur noch die vier erteilten Spalten. Es gibt keinen weiteren `postgres_changes`-Handler in `src/`.
- Braucht das Dashboard später eine weitere Spalte per Realtime, muss sie ins Grant, sonst fehlt sie ohne Fehlermeldung im Payload. Das gehört als Kommentar an `RepoStatusRow`.
- Serverseitig ändert sich nichts: alle Reads von `repositories` laufen über den Service-Role-Client (`src/lib/supabase.ts`); die Cookie-Clients rufen nur `auth.getUser()` auf (grep über `src/`: kein `.from(` auf einem `createClient()`-Client).
- Ein `select('*')` über einen User-Client auf `repositories` scheitert danach mit `42501` (im Trockenlauf belegt). Das ist gewollt, DATA-001 verbietet es ohnehin.

**Folgen für Tests:** `src/lib/supabase/private-grants.integration.test.ts` prüft heute nur, dass `anon` an `repositories` scheitert. Mit dem Fix kommt ein Fall dazu: `authenticated` mit Session-JWT bekommt für `select=webhook_secret` und für `select=pipeline_config` jeweils `42501`, für `select=id,status` 200. Dieser Fall ist der Regressions-Guard für L9.

**Optional, zweite Linie (nicht getestet):** Eine Spaltenliste in der Publication (`ALTER PUBLICATION supabase_realtime DROP TABLE …` und `ADD TABLE public.repositories (id, github_repo_id, status, updated_at)`, nicht `SET TABLE`, das die ganze Publication ersetzt). Dann verlassen Secret und Config das WAL-Decoding gar nicht erst. Für den Befund reicht das Grant.

**Secret rotieren?** Die Exposition betraf nur den jeweiligen Owner selbst (live eine Legacy-Zeile). Ein Rotationszwang folgt daraus nicht. Wer rotieren will, erledigt das zusammen mit der ohnehin offenen Secrets-Rotation (ROADMAP §6, Offboarding Phase 3/4).

---

## 6. Ungeprüfte Verdachtsmomente

- **S1: bestätigt am 2026-09-29, jetzt L9 (Belege §5, Fix-Vorschlag §5a). Die Hypothese vom Audit-Tag bleibt hier zur Nachvollziehbarkeit stehen: `webhook_secret` und `pipeline_config` erreichen den Browser des Owners.** Migration 011 gibt `authenticated` eine `SELECT`-Policy auf `repositories` (alle Spalten), Migration 038 lässt das Grant bewusst stehen, `useDashboardSync.ts:263-268` abonniert `postgres_changes` auf der ganzen Tabelle. Wenn live kein Spalten-Grant existiert, kann der Owner per PostgREST (`/rest/v1/repositories?select=webhook_secret,pipeline_config` mit Anon-Key + Session-JWT) und über jedes Realtime-UPDATE-Payload sein eigenes Hook-Secret und die operator-only `pipeline_config` lesen — Letzteres widerspricht OPERATOR_SETTINGS_SPEC D4 (Kunde darf die Settings nicht sehen). Kein Cross-Tenant (Policy filtert `auth.uid() = user_id`). Verifikation: die zweite SQL-Abfrage in §5. Falls bestätigt: Realtime auf eine View mit `id, status, updated_at` umstellen oder `REVOKE SELECT (webhook_secret, pipeline_config) ON repositories FROM authenticated` (Spalten-REVOKE nach Table-Grant ist in Postgres nicht möglich; stattdessen Table-Grant entziehen und `GRANT SELECT (id, status, …)` spaltenweise erteilen).
- **S2 — `x-forwarded-host` im Auth-Callback** (`auth/callback/route.ts:7-16`) bestimmt das Redirect-Ziel. Auf Vercel setzt die Plattform den Header selbst; ob ein vom Client gesendeter Wert überschrieben wird, ist hier nicht belegt. Wenn nicht: Open Redirect nach Login. Prüfen per `curl -H 'x-forwarded-host: evil.example' https://unslop.codes/auth/callback` (erwartet: Redirect auf `unslop.codes`).
- **S3 — Waitlist-Rate-Limit vertraut dem ersten `x-forwarded-for`-Eintrag** (`client-ip-hash.ts:19-26`). Auf Vercel plattformgesetzt; wenn Client-Werte vorangestellt bleiben, ist das Limit pro gefälschter IP umgehbar (Kosten: Brevo-DOI-Mails). Nur relevant, sobald `NEXT_PUBLIC_WAITLIST_LIVE=true`.
- **S4 — Cache-Header auf authentifizierten JSON-Routen** sind nirgends explizit gesetzt (grep leer). Next.js markiert Route-Handler mit `cookies()`/Headers als dynamisch, Vercel cached dynamische Antworten nicht — nicht belegt. Ein `Cache-Control: private, no-store` auf den Cookie-/Key-Routen kostet nichts.
- **S5 — Leck-Pfad für `billing_accounts.id`** (Voraussetzung für M2 cross-tenant): keiner gefunden; Vercel-Logs (`[PaddleWebhook] … account=<uuid>`) und Paddle-Dashboard sind die einzigen Orte, an denen die UUID auftaucht.

---

## 7. Empfohlene Reihenfolge

1. ~~S1 live verifizieren~~ erledigt 2026-09-29 (bestätigt, L9). Offen: Entscheidung über das Spalten-Grant aus §5a.
2. M1 (einheitliche Antwort) und L3 (Reaper hinter die Triage) — zwei kleine Änderungen in `webhook/route.ts`.
3. M2 (`paddle_customer_id`-Bindung im Mirror) vor Paddle-Live.
4. M3 als Produktentscheidung vor Launch (Fork-/Nicht-Collaborator-Gate).
5. L1, L2, L4, L5, L7 als Hygiene-Sammel-PR; L6/L8 bei Gelegenheit.
