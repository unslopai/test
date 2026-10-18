# SPEC: Native GitHub App (Dual-Auth, Bot Identity, Check Runs)

> Status: approved (Interview 2026-07-13). Ergänzt SPEC.md (Router Cascade) und
> STRIPE_SPEC.md (Paid-only-Gate). Bricht keinen bestehenden Flow.

## 1. Context (Ist-Zustand)

Das System kennt heute **genau eine** GitHub-Identität: das persönliche OAuth-User-Token aus
`github_tokens` (AES-256-GCM verschlüsselt, Supabase-GitHub-Login liefert es als
`provider_token`). Daran hängen **alle** Produkt-Pfade:

| Pfad | Nutzt User-Token für |
| --- | --- |
| Dashboard (`/api/repos/*`) | Repo-Liste, Connect, Disconnect, Webhook-Health/Repair |
| CLI + VS Code (`/api/cli/*`, API-Keys) | Repo-Auto-Connect (`fetchRepoByFullName`) |
| `connect-repository.ts` | Repo-Webhook anlegen, Skeleton-Ingestion |
| `worker.ts` → Pipeline | PR-Diff laden, Review posten |
| `billing-paused-comment.ts` | Gate-Kommentare |

Konsequenzen des Ist-Zustands, die diese Spec adressiert:

1. **Identität**: Reviews erscheinen im Namen des Repo-Owners. Ist der Owner zugleich
   PR-Autor, lehnt GitHub `REQUEST_CHANGES` mit 422 ab — daher der COMMENT-Fallback in
   `github-reporter-step.ts`. Ein Bot hat dieses Problem strukturell nicht.
2. **Kein Merge-Gating**: Nur GitHub Apps dürfen Check Runs erstellen. Mit OAuth-Tokens
   gibt es keinen `required check`, den ein Team in den Branch-Protection-Rules verankern kann.
3. **Token-Lebensdauer**: Ein User-Token stirbt mit dem Re-Login/Revoke des Users. Ein
   Installation-Token wird ephemer aus dem App-Key abgeleitet und überlebt jeden User-Wechsel.

**Diese Spec fügt eine dritte Auth-Option hinzu. Sie ersetzt nichts.** OAuth bleibt der Pfad
für CLI, VS Code und Dashboard; die GitHub App ist der Pfad für vollautomatisierte
Webhook-Überwachung.

## 2. Decisions (aus dem Interview, mit Begründung)

- **D1 — Kein stiller Auth-Fallback.** Ist für ein App-Repo kein Installation-Token
  beschaffbar (App deinstalliert/suspended, Key rotiert, GitHub 5xx), **failt der Job hart**
  (`review_jobs.status = 'error'`, strukturierter Grund). Es wird **nicht** heimlich auf das
  User-Token zurückgefallen: ein Review, das plötzlich wieder unter dem Namen des Users
  erscheint, ist ein stiller Identitätswechsel und beim B2B-Kunden ein Compliance-Problem.
- **D2 — `installation_id` ist die einzige Wahrheit.** `repositories.installation_id IS NOT NULL`
  ⇒ App-Modus, sonst OAuth-Modus. Keine redundante `auth_mode`-Spalte, die divergieren kann.
  Lifecycle (linked/suspended/deleted) liegt in `github_app_installations`.
- **D3 — Check-Run-Lebenszyklus**: `in_progress` sofort bei Job-Annahme (der PR-Autor sieht,
  dass der Gatekeeper läuft), `completed` am Ende der Pipeline. Conclusion: `failure` **nur**
  bei mindestens einem CRITICAL-Finding, sonst `neutral` (WARNING-only) bzw. `success`
  (sauber). Ein Pipeline-Crash schließt den Check mit `failure` + Fehlertext ab, statt ihn
  ewig hängen zu lassen.
- **D4 — Findings bleiben Review-Comments.** Im App-Modus wird das Review-Event hart auf
  `COMMENT` gesetzt (der Check Run trägt das Gating, nicht `REQUEST_CHANGES`), die
  Inline-Comments laufen unverändert über `partitionIssuesByAnchor`/`buildInlineComments`.
  Keine Check-Run-Annotations: die verlieren Reply-Threads und würden den
  Unanchored-Findings-Pfad duplizieren.
- **D5 — Installation legt Repos an, aber ingestiert nichts.** Neue Repos aus einer
  Installation landen als `status = 'pending_activation'` in der DB. Skeleton-Ingestion
  (Embedding-Kosten) und Reviews starten erst nach expliziter, entitlement-geprüfter
  Aktivierung. Das schließt den *Trial Skeleton Ingestion Leak* (ROADMAP §8), statt ihn auf
  20 Repos pro Klick zu skalieren.
- **D6 — Orphan-Installations werden geparkt.** `installation.created` trifft ein, bevor der
  Setup-Callback den User kennt. Die Zeile wird mit `user_id = NULL` angelegt; der
  Setup-Callback (Cookie-Session) verknüpft sie nach. Kein Auto-Mapping über `account.login`
  — das wäre eine Zuordnung anhand eines frei wählbaren, umbenennbaren Namens.
- **D7 — Belt & Suspenders gegen Doppel-Deliveries.** Beim Verknüpfen wird ein vorhandener
  Legacy-Repo-Hook via User-Token gelöscht und `webhook_id`/`webhook_secret` genullt.
  **Zusätzlich** hart in der Route: kommt eine Legacy-Delivery (kein `installation`-Node im
  Payload) für ein Repo, das über die App läuft, wird sie mit 200 verworfen. Der Guard hält
  auch dann, wenn das Löschen fehlschlägt (Token weg, Admin-Recht verloren).

  **Präzisierung (Nachtrag 2026-07-14, aus dem Audit):** Der Guard darf **nicht** allein an
  „Repo hat `installation_id`" hängen. Eine Legacy-Delivery, deren Signatur zu **keiner**
  Legacy-Zeile passt, ist mehrdeutig — sie kann von einem toten, adoptierten Hook stammen
  (harmloses Duplikat) **oder** von einem Kunden, dessen `webhook_secret` nicht mehr zum Hook
  auf GitHub passt (DB-Restore, handeditierter Hook, halbe Reparatur). Beide Fälle erzeugen
  **byte-identischen** Input; es gibt keine Information, die sie trennt. Ein pauschales 200
  würde deshalb den zweiten Fall still töten: GitHub zeigt dem Kunden grüne Deliveries,
  während seine Reviews für immer ausbleiben. Die Route entscheidet daher so
  (`selectLegacyTarget`, `src/lib/webhook-delivery.ts:80-114`):
  1. Eine Legacy-Zeile trägt die Signatur ⇒ `legacy` (normaler OAuth-Pfad).
  2. Es existiert **mindestens eine** Legacy-Zeile, aber keine trägt die Signatur ⇒ **401**
     (`invalid_signature`) — laut scheitern statt still. GitHub deaktiviert einen dauerhaft
     401-enden Hook irgendwann selbst, was den Zombie-Hook ebenfalls erledigt.
  3. Es existiert **keine** Legacy-Zeile, aber eine App-Zeile ⇒ **200** (`legacy_duplicate`) —
     das ist der eigentliche D7-Fall.
  Konsequenz im D13-Zwei-Tenant-Fall (A über OAuth, B über die App mit überlebendem Hook):
  Bs tote Delivery fällt in Zweig 2 und ergibt 401, nicht 200. Das ist gewollt.
  Getestet in `webhook-delivery.test.ts:97` (Zweig 3) und `:116` (Zweig 2).
- **D8 — Uninstall deaktiviert, löscht aber keine Chunks.** `code_chunks` sind ein teuer
  bezahlter Embedding-Cache. `installation.deleted` ⇒ Repos `deactivated`, `installation_id`
  genullt, Installation als `deleted` markiert. Eine Re-Installation trifft denselben
  `repositories`-Datensatz (Unique `(user_id, github_repo_id)`) und ist ein Cache-Hit.
  **Nachtrag 2026-09-30 (LEGAL_PAGES_SPEC §4a.2):** Beim Lösen von der Installation
  (`installation.deleted`, `installation_repositories.removed`) bekommen die Chunks zusätzlich
  `deactivated_at`, wie beim Trennen im Dashboard. Gelöscht wird weiterhin nichts sofort; die
  Re-Ingestion reaktiviert sie über den Hash, der Cache-Hit bleibt. Nach 30 Tagen löscht der
  Cron das Repo samt Chunks.
  `installation.suspend` ⇒ nur die Installation wird als `suspended` markiert; die Repos
  behalten ihre `installation_id`, damit `unsuspend` sie ohne Rekonstruktion zurückholt.
  **Der Repo-Sync hebt niemals einen `deactivated`-Status an** (Nachtrag aus Review 3): ein
  deaktiviertes Repo ist entweder bewusst abbestellt oder von einer Deinstallation
  übriggeblieben, und eine automatische Wiederbelebung würde dem Kunden auf einem
  abbestellten Repo wieder Bot-Kommentare und — bei einem `required check` — unmergebare PRs
  bescheren. Der Rückweg ist der Aktivieren-Button (entitlement-geprüft), der an der
  `installation_id` erkennt, dass er die App-Aktivierung statt eines neuen Webhooks auslösen muss.
  Merke: GitHub vergibt bei **jeder** Neuinstallation eine **frische** `installation_id` —
  ein `installation.created` ist deshalb immer unverknüpft (`user_id NULL`) und synchronisiert
  keine Repos; das tut ausschließlich der Setup-Callback (D6) bzw. `installation_repositories`.
- **D9 — JEDER übersprungene Review erzeugt einen Check Run.** Wird ein PR abgewiesen (kein
  Abo, Quota/Trial erschöpft, Repo nicht aktiviert **oder Repo abbestellt**), wird im
  App-Modus ein Check Run direkt als `completed` + `action_required` erstellt, mit Grund und
  Link im Output. Sonst wartet ein als `required` konfigurierter Check ewig auf ein Ergebnis,
  das nie kommt — ein stiller Merge-Blocker, dessen Ursache nirgends steht. Das gilt
  ausdrücklich auch für `deactivated`: nach einem Disconnect bleibt die App installiert und
  GitHub liefert weiter, der Check muss also aufgelöst werden. Der Dedupe-Kommentar bleibt,
  aber nur beim Öffnen des PRs — bei `synchronize` (jeder Push) wird ausschließlich der
  Check Run gesetzt, sonst kostete jeder Push des Angreifers zusätzlich einen
  `listPRComments`-Call gegen das Rate-Limit des Kunden. Ein abbestelltes Repo (`deactivated`)
  bekommt **gar keinen** Kommentar, nur den Check Run.
- **D10 — `pending_activation` ist gegen Denial-of-Wallet dicht.** Ein PR auf ein noch nicht
  aktiviertes Repo triggert **niemals** eine Ingestion: kein LLM-Call, kein Embedding, nur
  genau ein Dedupe-Kommentar mit Aktivierungs-Aufforderung. Sonst könnte ein Fremder durch
  Öffnen eines PRs die Kosten des Repo-Owners auslösen.
- **D11 — Eine Installation muss man sich verdienen (Nachtrag aus dem Adversarial Review).**
  Die `installation_id` im Setup-Callback ist ein frei wählbarer Query-Parameter. Wer sie
  ungeprüft an die Session bindet, baut eine Enumerations-Lücke: ein beliebiger Trial-User
  probiert fremde IDs durch, hängt die Installation an sich, und der anschließende Repo-Sync
  indexiert die **privaten Repos des Opfers** unter seiner eigenen `user_id`. Deshalb muss der
  User beweisen, dass er den Account kontrolliert:
  - User-Installation → die numerische GitHub-Account-ID muss seiner eigenen entsprechen
    (die **ID**, nicht der Login: Logins sind umbenennbar und nachbesetzbar).
  - Org-Installation → er muss **Org-Admin (Owner)** sein, geprüft über
    `GET /user/memberships/orgs/{org}` (`role === 'admin'`). Repo-Admin genügt ausdrücklich
    **nicht**: das ist auch ein externer Collaborator mit Admin auf *einem* Repo, und er
    könnte damit eine Installation über 200 Repos an sich binden, von denen er 199 nicht
    lesen darf. Dafür wird der Login-Scope um `read:org` erweitert; ein Alt-Token ohne den
    Scope liefert 403 → das ist **kein „nein"**, sondern `reauth_required` (Re-Login), sonst
    entschiede ein fehlender Scope über die Berechtigung.
  Eine bereits beanspruchte Installation wird nie an einen anderen User umgehängt, und ihr
  Status bleibt erhalten (ein Setup-Aufruf hebt eine **suspendierte** Installation nicht
  heimlich auf `active` — das erzeugte nur eine Serie an Jobs, die am Token sterben).
  **Der Beweis ist nur so viel wert wie die Tabelle, die er schützt:** `github_app_installations`
  läuft deshalb mit RLS ohne Policy (nur Service-Role). Ohne das hinge die Tabelle über
  PostgREST am öffentlichen Anon-Key und `user_id` wäre direkt aus dem Browser überschreibbar —
  am Beweis vorbei.
- **D12 — Der Check Run gehört dem Worker, nicht dem Reporter (Nachtrag).** Er wird in der
  Route eröffnet und **nach** `runPipeline` geschlossen — nicht im `github-reporter`-Step.
  Zwei Gründe: der Reporter ist per `pipeline_config` abschaltbar (der Check bliebe sonst für
  immer in `in_progress` und würde einen `required check` dauerhaft blockieren), und ein
  GitHub-Fehler beim Check-Abschluss darf das bereits gepostete und persistierte Review nicht
  nachträglich auf `error` kippen. Der Abschluss ist deshalb best-effort mit lautem Log; der
  Fehlerpfad des Jobs schließt den Check mit `failure`. Konsequenz fürs Schema: die
  `check_run_id` steht **nicht** im `PipelineContext` — kein Step soll sie überhaupt anfassen
  können.
- **D13 — Zwei Tenants auf einem Repo bleiben zwei Reviews (bewusst).** Unique ist
  `(user_id, github_repo_id)`: zwei Kunden dürfen dasselbe Repo verbinden. Läuft Kunde A über
  OAuth und Kunde B über die App, bekommt der PR zwei Reviews und beide zahlen einen Scan.
  Das ist korrekt — es sind zwei Abos — und **nicht** der Fall, den der Dupe-Guard (D7)
  abfängt: der adressiert *einen* Kunden mit zwei Zustellwegen.

## 3. Auth-Matrix (was gilt wann)

| Job-Quelle | `repositories.installation_id` | Token | Review-Event | Check Run |
| --- | --- | --- | --- | --- |
| `source='cli'` | egal | *keins* (spricht nie mit GitHub) | — | — |
| `source='webhook'` | `NULL` | User-OAuth (`github_tokens`) | `REQUEST_CHANGES` → 422-Fallback `COMMENT` | nein |
| `source='webhook'` | gesetzt | Installation-Token (ephemer) | immer `COMMENT` | ja |

Der Legacy-Pfad (Zeile 2) bleibt **byte-identisch** zum heutigen Verhalten, inklusive des
Self-Author-Fallbacks und seiner Tests.

## 4. Architektur

### 4.1 Neue Dateien

| Datei | Verantwortung |
| --- | --- |
| `src/lib/github-app.ts` | RS256-JWT (Node `crypto`, keine Fremd-Lib), Installation-Token-Abruf + In-Memory-Cache (inkl. Invalidierung bei Suspend/Uninstall), App-Webhook-Secret |
| `src/lib/repo-auth.ts` | Eine Funktion, die aus einer Repo-Zeile das richtige Token zieht (App oder OAuth). Einziger Ort, an dem die Dual-Auth-Entscheidung fällt. Beherbergt auch `resolveGithubToken` (aus `worker.ts` hierher gezogen, damit `repo-auth` nicht zyklisch auf den Worker zeigt) |
| `src/lib/github-webhook-payload.ts` | Strukturelle Validierung der Webhook-Payloads (ARCH-002-Grenze; kein `as`-Casting) |
| `src/lib/app-installation.ts` | Installations-Lifecycle: Events verarbeiten, Installation beanspruchen (**inkl. Ownership-Beweis, D11**), Repos synchronisieren, Legacy-Hook abräumen |
| `src/lib/check-run.ts` | Der Gatekeeper-Check-Run: eröffnen, abschließen, Conclusion aus den Findings ableiten (D3) |
| `src/lib/gate-notice.ts` | Ein Ort für alle Gate-Skips: Dedupe-Kommentar + blockierender Check Run (D9/D10) |
| `src/app/api/github/app/setup/route.ts` | Setup-Callback nach der Installation: Installation beanspruchen (D11), Repos syncen |
| `src/app/api/repos/[id]/activate/route.ts` | Aktivierung eines `pending_activation`-Repos (entitlement- + cap-geprüft, startet Ingestion) |
| `supabase/migrations/027_create_github_app_installations.sql` | Schema |

### 4.2 Geänderte Dateien

| Datei | Änderung | Bricht Bestehendes? |
| --- | --- | --- |
| `src/lib/github.ts` | `+ createCheckRun`, `+ updateCheckRun`, `+ fetchInstallationRepositories`, `+ fetchAuthenticatedUser` (Ownership-Beweis), Check-Run-Typen | nein (rein additiv) |
| `src/app/api/webhook/route.ts` | Dispatcher: App- vs. Repo-Hook-Delivery, `installation`-Events, Dupe-Guard, Gate-Check-Runs | nein (Legacy-Zweig unverändert) |
| `src/lib/worker.ts` | Token-Auflösung über `repo-auth.ts`; schließt den Check Run nach der Pipeline (D12) und bei Job-Fehler mit `failure`; Repo-Lookup filtert jetzt nach `user_id` [DATA-001] | nein (`resolveGithubToken` ist nach `repo-auth.ts` gezogen, alle Importeure sind mitgezogen) |
| `src/lib/pipeline/types.ts` | `PipelineContext` += `authMode` (die `check_run_id` steht bewusst NICHT im Kontext, D12) | nein |
| `src/lib/pipeline/steps/github-reporter-step.ts` | App-Modus postet `COMMENT` statt `REQUEST_CHANGES`; OAuth-Modus inkl. 422-Fallback unverändert | nein |
| `src/lib/billing/billing-paused-comment.ts` | Token wird injiziert statt selbst aufgelöst; `+ postActivationRequiredCommentOnce` | nein (Aufrufer ist nur die Webhook-Route) |
| `src/lib/connect-repository.ts` | `+ activateAppRepository`; Connect erkennt App-Repos und aktiviert sie, statt einen zweiten Webhook zu bauen; Repo-Cap zählt `pending_activation` nicht mit | nein (OAuth-Connect unverändert) |
| `src/app/api/repos/[id]/webhook-health/route.ts` | App-Repos melden `app_managed` statt `not_configured`; Repair auf App-Repos → 409 (kein Zweit-Hook) | nein |
| `src/app/api/repos/route.ts`, `DashboardClient.tsx`, `RepoActions.tsx` | Status `pending_activation` sichtbar; „Aktivieren" nutzt denselben Connect-Endpoint | nein |
| `src/app/login/page.tsx` | reicht `?next=` an den OAuth-Callback durch | nein (ohne `next` unverändertes Verhalten) |

### 4.3 `src/lib/github-app.ts` — Auth Engine

```
createAppJwt(): string
  header  {alg:'RS256', typ:'JWT'}
  payload {iat: now-60 (Clock-Skew), exp: now+540 (<10min Limit), iss: GITHUB_APP_ID}
  sign    crypto.createSign('RSA-SHA256').sign(pem)  → base64url
```

- **Private Key**: `GITHUB_APP_PRIVATE_KEY_BASE64` (Base64 des PEM). Base64 statt rohem PEM,
  weil mehrzeilige Werte in Vercel-Env-Vars zuverlässig kaputtgehen — dasselbe Muster wie
  `GOOGLE_SERVICE_ACCOUNT_BASE64`.
- **`getInstallationToken(installationId)`**: `POST /app/installations/{id}/access_tokens` mit
  dem JWT. Antwort wird **strukturell validiert** (kein Cast). Ergebnis landet in einer
  Modul-lokalen `Map<number, {token, expiresAtMs}>` und wird 120 s vor Ablauf verworfen.
  **Der Token wird niemals persistiert** — kein DB-Feld, kein Log, kein Payload.
- **`GitHubAppAuthError`** mit `reason: 'not_configured' | 'installation_invalid' | 'github_error'`
  — Voraussetzung für D1 (harter Fail mit lesbarem Grund statt generischem 500).

### 4.4 Webhook-Route — Dispatch

```
POST /api/webhook
  ├─ kein X-GitHub-Event            → 400
  ├─ ping                           → 200 pong
  ├─ Delivery-Art = payload.installation.id vorhanden ? 'app' : 'legacy'
  ├─ installation / installation_repositories   [nur 'app']
  │     → Signatur gegen GITHUB_APP_WEBHOOK_SECRET → handleInstallationEvent
  ├─ check_run [nur 'app', §4.8]
  │     action != 'rerequested' → 200 ignored · pull_requests leer → 200 (kein PR)
  │     sonst → identische Kette wie pull_request ab resolveDeliveryTarget()
  ├─ pull_request → resolveDeliveryTarget(): Zeile finden UND Signatur prüfen
  │     'app'    ⇒ globales App-Secret; Zeile über installation_id
  │     'legacy' ⇒ die Zeile, deren webhook_secret die Signatur TRÄGT (s.u.)
  │     → unknown_repo → 404 · invalid_signature → 401
  │     → legacy_duplicate (D7): Repo läuft über die App, Delivery kam vom alten Hook → 200
  │     → Installation suspendiert/gelöscht → 200 (kein Job, der am Token stirbt)
  │     → Status-Gates: deactivated → 200 · pending_activation → Aktivierungs-Hinweis (D10)
  │     → Paid-Gate + Quota  → Kommentar + (App) Check Run 'action_required' (D9)
  │     → Job anlegen · (App) Check Run 'in_progress' → check_run_id am Job
  │     → after(processReviewJob)
  └─ sonst                          → 200 ignored
```

**Warum das Secret die Zeile auswählt (nicht die DB-Reihenfolge):** Unique ist
`(user_id, github_repo_id)` — zwei User dürfen dasselbe Repo verbinden, es kann also mehrere
Zeilen zu einer `github_repo_id` geben. Welche davon die Delivery geschickt bekam, sagt einzig
die HMAC-Signatur. Ein `find()` auf die erste Legacy-Zeile würde bei zwei Tenants zufällig die
falsche wählen und die Delivery des einen gegen das Secret des anderen prüfen: 401, und GitHub
deaktiviert den Hook des Kunden irgendwann von selbst.

**Reihenfolge (sicherheitsrelevant):** Jede Aktion mit Seiteneffekt (Job, LLM-Call,
GitHub-Write) liegt hinter der Signaturprüfung. Der Dupe-Guard und die Repo-Suche lesen den
Payload nur, um **nichts** zu tun; ein gefälschter Payload erzeugt maximal ein wirkungsloses 200.

### 4.5 Installations-Events

| Event | Wirkung |
| --- | --- |
| `installation.created` | Upsert `github_app_installations` (`status='active'`; `user_id` bleibt NULL bis zum Setup-Callback, bestehendes `user_id` bleibt bei Re-Install erhalten) |
| `installation.deleted` | Installation `deleted`; zugehörige Repos → `deactivated`, `installation_id = NULL`. Chunks bleiben (D8) |
| `installation.suspend` | Installation `suspended`. Repos unverändert (D8) |
| `installation.unsuspend` | Installation `active` |
| `installation_repositories.added` | Nur bei verknüpfter Installation: neue Repos als `pending_activation` anlegen, bestehende adoptieren (`installation_id` setzen) |
| `installation_repositories.removed` | Repos → `deactivated`, `installation_id = NULL` |

Unverknüpfte Installationen legen **keine** `repositories`-Zeilen an (`user_id` ist dort
`NOT NULL`); der Setup-Callback holt den kompletten Repo-Bestand per
`GET /installation/repositories` nach.

### 4.6 Setup-Callback

`GET /api/github/app/setup?installation_id=<id>&setup_action=install`

1. Cookie-Session prüfen; ohne Session → Redirect `/login?next=<selbe URL>`. Die Login-Seite
   reicht `next` an `/auth/callback` durch (das es bereits kennt und auf repo-interne Pfade
   einschränkt) — sonst landete der User nach dem Login stumm auf `/dashboard` und die
   Installation bliebe für immer eine Waise.
2. **Installation beanspruchen (D11)**: Account-Daten via `GET /app/installations/{id}`
   (App-JWT) → Ownership-Beweis mit dem User-OAuth-Token → erst dann `user_id` setzen.
   Abgelehnt wird mit `?github_app=not_owner` bzw. `already_linked`.
3. Repos syncen (`GET /installation/repositories`, Installation-Token), **synchron und
   gebatcht** — eine Handvoll Queries statt einer pro Repo:
   - Unbekannte Repos → **ein** Upsert mit `status='pending_activation'`,
     `onConflict: (user_id, github_repo_id), ignoreDuplicates` — der Setup-Callback und ein
     gleichzeitig eintreffendes `installation_repositories`-Event dürfen sich nicht an einer
     Unique-Verletzung gegenseitig abschießen.
   - Bekannte Repos → **ein** Update: `installation_id` setzen, **Status unangetastet** (D8).
   - Repos mit Legacy-Hook → Hook via User-Token löschen, `webhook_id`/`webhook_secret` nullen
     (D7). Schlägt das Löschen fehl, wird es geloggt — der Route-Guard fängt die
     Doppel-Delivery trotzdem.
   - Warum synchron: hinter dem Redirect könnte der Sync nur noch loggen, während der User
     längst ein grünes „verbunden" liest — dabei ist die leere Repo-Liste genau der Zustand,
     den er sehen muss. Fehler → `?github_app=sync_failed` mit „Erneut versuchen"-Link.
4. Redirect → `/dashboard?github_app=connected`.

Jeder Fehlerausgang (`not_owner`, `already_linked`, `reauth_required`, `link_failed`,
`sync_failed`) wird im Dashboard angezeigt **und bietet eine Handlung an** (neu anmelden bzw.
Installation erneut konfigurieren). Ohne das wäre ein abgelehnter Claim eine Sackgasse: GitHub
leitet nur bei Installation/Konfiguration auf die Setup-URL, der User bekäme also nie einen
zweiten Versuch.

### 4.7 Check Runs

| Situation | Status | Conclusion |
| --- | --- | --- |
| Job angenommen | `in_progress` | — |
| Findings, mind. 1 CRITICAL | `completed` | `failure` |
| Findings, nur WARNING | `completed` | `neutral` |
| Keine Findings | `completed` | `success` |
| Abort (keine reviewbaren Dateien) | `completed` | `neutral` |
| Pipeline-Fehler | `completed` | `failure` (Titel: Fehlermeldung) |
| Gate-Skip (Abo/Quota/Trial) | `completed` (direkt) | `action_required` |

`Severity` kennt laut `@unslop/shared` nur `CRITICAL | WARNING` — die Tabelle ist damit
vollständig. Der Check-Name ist konstant `Anti-Slop Gatekeeper` (Voraussetzung dafür, dass
er als `required check` konfigurierbar ist).

### 4.8 Check-Run Re-Runs (`check_run` / `rerequested`) — ergänzt 2026-08-08

Der „Re-run"-Button in der GitHub-UI sendet das Event `check_run` mit der Action
**`rerequested`** (EIN Wort — so heißt GitHubs Enum-Wert, nicht `re_requested`). GitHub
liefert diese Action ausschließlich an GitHub Apps mit `checks: write`; Repo-Hooks
erhalten nur `created`/`completed`. Der Pfad ist damit strukturell App-only.

**Produktentscheidung (2026-08-08): Ein Re-Run ist ein NEUER Scan und zählt gegen die
Quota.** Er durchläuft exakt dieselbe Gate-Kette wie `pull_request` (§4.4): Signatur
gegen das globale App-Secret, Installation aktiv, Status-Gates, Paid-Gate +
`consume_scan_quota`. Ohne das wäre der Re-run-Button ein kostenloser LLM-Bypass an
der Kosten-Schranke vorbei.

Mechanik:
- PR-Zuordnung aus `check_run.pull_requests[0].number`; HEAD-SHA aus dem top-level
  `check_run.head_sha` (laut GitHub-Docs auch dann zuverlässig, wenn das Array leer ist).
- `pull_requests` ist bei Fork-PRs und reinen Pushes **leer** → 200 „kein PR", kein
  Review. Wir reviewen ausschließlich Pull Requests.
- Es wird ein **neuer** Check Run `in_progress` am selben HEAD-SHA eröffnet (der
  konstante Check-Name sorgt dafür, dass GitHub den neuesten Run anzeigt); der Job
  entsteht mit `source='webhook'` und `payload.action='rerequested'`.
- Alle anderen `check_run`-Actions (`created`, `completed`, `requested_action`) → 200
  ignoriert; strukturell unbrauchbare Payloads → 400 [ARCH-002].

## 5. Datenbank — `027_create_github_app_installations.sql`

```sql
create table github_app_installations (
    installation_id bigint primary key,              -- GitHub-ID, keine Surrogat-ID
    user_id uuid references auth.users(id) on delete cascade,  -- NULL = orphan (D6)
    account_login text not null,
    account_type text not null,
    status text not null default 'active'
        check (status in ('active', 'suspended', 'deleted')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
create index idx_github_app_installations_user_id on github_app_installations(user_id);

-- RLS ohne Policy = nur der Service-Role-Key kommt dran (D11).
alter table github_app_installations enable row level security;

-- Vorbestehende Lücke, hier mitgeschlossen: 011 legte eine SELECT-Policy auf
-- repositories an, schaltete RLS aber nie ein — die Policy war wirkungslos und
-- die Tabelle über den Anon-Key sogar schreibbar. Alle Backend-Pfade nutzen den
-- Service-Role-Key (umgeht RLS), das Dashboard liest nur.
alter table repositories enable row level security;

alter table repositories
    add column installation_id bigint
    references github_app_installations(installation_id) on delete set null;
create index idx_repositories_installation_id on repositories(installation_id);

-- 'pending_activation' (D5): App installiert, aber noch nicht ingestiert.
alter table repositories drop constraint repositories_status_check;
alter table repositories add constraint repositories_status_check
    check (status in ('active','syncing','error','deactivated','pending_activation'));

-- Check-Run-Referenz des Jobs; NULL im OAuth- und CLI-Pfad.
alter table review_jobs add column check_run_id bigint;
```

### `028_fix_ttl_cleanup_interval.sql` (Voraussetzung für D8)

Migration 013 hat einen **Testwert** ausgerollt: ein `pg_cron`-Job löschte jede Minute jedes
`deactivated` Repo, das älter als **10 Sekunden** war — und `code_chunks` hängt per
`ON DELETE CASCADE` daran. Damit war jede Zusage über den Chunk-Cache falsch: D8
(„Re-Installation ist ein Cache-Hit") ebenso wie der bestehende Soft-Delete des Disconnects
(„KEIN DELETE, sonst CASCADE löscht die Chunks"). 028 stellt den in 013 selbst dokumentierten
Produktionswert scharf: einmal täglich, TTL 30 Tage.

`review_jobs.source` bleibt unverändert (`manual|webhook|cli`) — der Auth-Modus ist eine
Eigenschaft des **Repos**, nicht des Jobs (D2).

## 6. Environment

| Variable | Zweck |
| --- | --- |
| `GITHUB_APP_ID` | `iss` im App-JWT |
| `GITHUB_APP_PRIVATE_KEY_BASE64` | Base64-kodiertes PEM (RS256-Signatur) |
| `GITHUB_APP_WEBHOOK_SECRET` | Globales HMAC-Secret aller App-Deliveries |
| `GITHUB_APP_SLUG` | Installations-/Aktivierungs-Links in Kommentaren |

Fehlen sie, ist der App-Pfad schlicht inaktiv (`isGitHubAppConfigured() === false`) — der
OAuth-Pfad läuft davon unbeeinflusst weiter. **Kein Startup-Crash**: eine Deployment-Umgebung
ohne App-Credentials muss das bestehende Produkt weiter bedienen können.

**Erforderliche App-Permissions**: `checks: write`, `pull_requests: write`, `contents: read & write`,
`metadata: read`. **Events**: `pull_request`, `installation`, `installation_repositories`.

*(contents von read auf read & write erhöht am 2026-08-09: die GraphQL-Mutation
`resolveReviewThread` — MCP_SPEC Phase 3, `unslop_resolve_finding` — verlangt für
Installation-Tokens Contents-Write (community #44650). unslop-Code schreibt nie
Repo-Inhalte; die Erweiterung ist allein diese GitHub-Koppelung. Achtung Quirk:
`viewerCanResolve` meldet für App-Viewer false, obwohl die Mutation gelingt —
niemals als Gate benutzen, Versuch + Fehlerklassifikation ist die robuste Form.)*

**Setup-URL der App** (GitHub-App-Settings): `<APP_BASE_URL>/api/github/app/setup`, „Redirect on
update" aktiviert.

**Zwei Konfigurationsschritte außerhalb des Codes** (sonst läuft der App-Pfad ins Leere):
1. **OAuth-Scope** `read:org` ist neu (D11). Bestandskunden tragen ihn erst nach einem
   Re-Login im Token; bis dahin liefert ein Org-Claim `reauth_required` (der Fehlerfall wird
   im Dashboard angezeigt). Der OAuth-Pfad selbst funktioniert unverändert weiter.
2. **Supabase Redirect-Allowlist**: `redirectTo` trägt jetzt ein `?next=`. Die Allowlist
   matcht inklusive Query-String — ohne einen Wildcard-Eintrag
   (`<APP_BASE_URL>/auth/callback**`) fällt Supabase still auf `SITE_URL` zurück und der
   Login-Bounce des Setup-Callbacks verpufft.

## 7. Architektur-Gesetze (Verifikations-Checkliste)

- [SEC-001] Installation-Tokens **nur** im Memory (Modul-Cache mit TTL), nie in DB/Log/Payload.
- [SEC-001] Alle Signaturen weiter über `crypto.timingSafeEqual` (`verifyWebhookSignature` wird
  wiederverwendet, nicht neu implementiert).
- [ARCH-002] Webhook-Payloads werden an der Systemgrenze strukturell geparst
  (`github-webhook-payload.ts`), kein `as`-Casting von externem Input.
- [MAINT-001] Kein Exception-Swallowing: jeder `catch` loggt strukturiert **und** setzt einen
  Zustand (Job `error`, Check Run `failure`) oder re-throwt.
- [DATA-001] Alle Queries selektieren explizite Spalten und filtern nach Repo/User.
- [ARCH-001] Kognitive Komplexität < 15, Methoden < 50 Zeilen — die Webhook-Route wird in
  Handler zerlegt, keine God-Function.
- Verbot von `any`, `@ts-ignore`, generischen Namen (`data`, `result`, `temp`).

## 8. Verifikationsplan

1. `npx tsc --noEmit` — sauber.
2. `npm test` — bestehende Suite grün, insbesondere `github-reporter-step.test.ts`
   (Self-Author-Fallback bleibt im OAuth-Modus intakt).
3. Neue Unit-Tests:
   - `github-app.test.ts`: JWT gegen einen Test-Keypair verifizierbar, Claims innerhalb der
     GitHub-Grenzen, Token-Cache liefert bei nahendem Ablauf ein frisches Token, eine
     widerrufene Installation ergibt `installation_invalid` (Basis für D1).
   - `check-run.test.ts`: nur CRITICAL blockiert (`failure`), WARNING bleibt `neutral`.
   - `github-reporter-step.test.ts`: App-Modus postet `COMMENT` (nie `REQUEST_CHANGES`);
     der OAuth-Pfad inkl. 422-Fallback bleibt unverändert und fasst nie einen Check Run an.
   - `github-webhook-payload.test.ts`: Payload-Parser weist unvollständige Payloads ab.
4. Adversarial Subagent-Review gegen diese Spec.

## 9. Vorerst Out-of-Scope (Folge-Tickets)
- **Check-Run Re-Reruns**: Das Behandeln von `check_run` `re_requested` (wenn der User in GitHub auf "Re-run" klickt) ist noch nicht implementiert (Siehe Roadmap).
- **GitHub App als *Login*-Provider** (User-to-Server-OAuth): bewusst nicht verfolgt. Login
  bleibt Supabase-GitHub-OAuth (`signInWithOAuth`, provider `github`).
