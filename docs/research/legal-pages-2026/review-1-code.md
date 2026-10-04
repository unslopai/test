# Review 1: Code-Abgleich DSE / AVV (adversarial)

Geprüft: `docs/legal/datenschutz.de.md`, `privacy.en.md`, `avv.de.md`, `dpa.en.md` im Worktree `C:\dev\unslop-legal` (HEAD `5fcec5d`), am 2026-09-28. Nur gelesen. Paketverhalten geprüft in `C:\dev\unslop\node_modules` (`@supabase/ssr` 0.10.2, `@supabase/auth-js` 2.105.3). Keine DB-Abfragen, deshalb ist der Live-Stand von Migrationen und Env-Werten **blocked: tooling / nicht geprüft**.

Abkürzungen: DSE = Datenschutzerklärung, AVV = Auftragsverarbeitungsvertrag.

---

## Befunde

### P1-01 — hoch — Vercel: Trainingszusage, Rolle als Auftragsverarbeiter und „1 Tag“-Frist gelten erst ab Pro, und in der DSE fehlt die Vorbedingung
- **Fundstellen**
  - DSE §2: „Wir trainieren damit keine KI-Modelle, und auch unsere Dienstleister tun das nicht (Abschnitt 6.3).“
  - DSE §3: „… betreibt Vercel Inc. … als unser Auftragsverarbeiter“ und „Vercel speichert die Laufzeitprotokolle in unserem Tarif einen Tag lang.“
  - DSE §12: „Laufzeitprotokolle bei Vercel | 1 Tag“
  - AVV Anlage 3 Nr. 3: „Laufzeitprotokolle hält der Hosting-Anbieter einen Tag vor.“
  - EN-Fassungen entsprechend.
- **Beleg**
  - Vercel Runtime Logs, https://vercel.com/docs/logs/runtime (abgerufen 2026-09-28): „Hobby: 1 hour of logs · Pro: 1 day of logs“. Das sind Einsicht-Limits („observability limits“), keine zugesagte Löschfrist.
  - Vercel ToS (r6 §1): Auf Hobby darf Vercel „Your Content“ zum Training nutzen und an Dritte weitergeben (Opt-out möglich). Das DPA gilt nur für „Enterprise and Pro plans“.
  - Laut Spec §2 Nr. 1 und V1 läuft das Konto heute auf Hobby.
  - Über Vercel läuft Kundencode: Die Functions verarbeiten Diffs, und in den Logs landen Code-Ausschnitte (siehe P1-02).
  - In der AVV hat Anlage 4 die Markierung `[VORBEDINGUNG: Vercel Pro …]`. Der DSE fehlt jede V1-Markierung, ebenso AVV Anlage 3 Nr. 3.
- **Korrektur**
  - `[VORBEDINGUNG V1: Vercel Pro, Model Training aus]` an DSE §2, §3 und §12 sowie an AVV Anlage 3 Nr. 3 und 4 anhängen.
  - DSE §3 umformulieren:
    - DE: „Vercel stellt uns die Laufzeitprotokolle in unserem Tarif einen Tag lang zur Einsicht bereit; wie lange Vercel sie intern aufbewahrt, legt Vercel fest.“
    - EN: „Vercel makes runtime logs available to us for one day on our plan; how long Vercel retains them internally is determined by Vercel.“
  - DSE §12 anpassen:
    - DE: „Laufzeitprotokolle bei Vercel | für uns 1 Tag einsehbar“
    - EN: „Vercel runtime logs | visible to us for 1 day“

### P1-02 — hoch — Anwendungsprotokolle enthalten Inhalte: Code-Ausschnitte, Repo- und Dateinamen, GitHub-Login
- **Fundstellen**
  - DSE §3: Aufgezählt werden nur Metadaten (IP, Zeit, URL, Status, User-Agent, Region), dann: „Diese Daten landen in den Laufzeitprotokollen von Vercel.“
  - DSE §6.4 nennt Code-Ausschnitte nur für die Fehlermeldung in der Datenbank.
  - AVV Anlage 2 (Speicherfristen) führt die Vercel-Logs nicht auf.
  - AVV Anlage 3 Nr. 8 suggeriert, Code gehe nur an die KI.
- **Beleg**
  - `src/lib/pipeline/helpers.ts:152-156`: 500 Zeichen Modellantwort landen in der Exception und werden geloggt, z. B. `src/lib/pipeline/reviewer-call.ts:152-155`.
  - `src/lib/rag.ts:199`: `console.log(... Query: "${searchQuery.substring(0, 100)}...")`. Die Query besteht aus Dateinamen und hinzugefügten Diff-Zeilen (`rag.ts:238-267`).
  - Weitere Log-Inhalte:
    - Dateiname@SHA: `src/lib/prescan/file-content-loader.ts:72-74`
    - Repo-Namen: `src/lib/skeleton.ts:346`, `src/app/api/repos/disconnect/route.ts:137`
    - GitHub-Kontoname: `src/lib/app-installation.ts:92`
    - Paddle-IDs: `src/lib/billing/paddle-webhook.ts:215-218`
- **Korrektur**
  - DSE §3 ergänzen:
    - DE: „Außerdem schreibt unsere Anwendung Protokollzeilen in diese Laufzeitprotokolle, etwa Repository- und Dateinamen, GitHub-Kontonamen, Paddle-Kennungen und im Fehlerfall kurze Ausschnitte des geprüften Codes oder der Modellantwort.“
    - EN: „Our application also writes log lines to these runtime logs, such as repository and file names, GitHub account names, Paddle IDs and, in case of errors, short excerpts of the reviewed code or the model response.“
  - AVV Anlage 2, Speicherfristen, neue Zeile:
    - DE: „Laufzeitprotokolle bei Vercel mit Repository-/Dateinamen und kurzen Code-Ausschnitten | [VERCEL-LOGFRIST, nach V1: 1 Tag]“
    - EN entsprechend.
  - AVV Anlage 2 Nr. 4 ergänzen: „… und Protokolldaten, auch in den Laufzeitprotokollen des Hosting-Anbieters“.

### P1-03 — mittel (nahe hoch) — Der Webhook-Pfad über das GitHub-OAuth-Token fehlt, ebenso Repo-Anbindung und PR-Review aus CLI, MCP und VS Code
- **Fundstellen**
  - DSE §6.1 beschreibt GitHub-Daten nur unter „GitHub App: Nachdem Sie … die App installiert haben …“.
  - Für die Tools sagt DSE §6.1: „Diese Werkzeuge schicken uns den Diff …, den Namen des Repositorys … und die Commit-Kennungen.“
  - AVV Anlage 2 Nr. 1: „Abruf von Diffs und Dateien über die GitHub-Schnittstelle nach Installation der GitHub App“.
  - AVV Anlage 4 (GitHub): „mit der Installation der GitHub App“.
- **Beleg**
  - `src/lib/connect-repository.ts:196-201,236-240` („Der klassische OAuth-Connect: eigener Repo-Webhook … Unverändert der Pfad für CLI, VS Code und Dashboard-Repos ohne GitHub App“).
  - `src/lib/github-webhook-payload.ts:71` („null = Legacy-Repo-Hook“) und `src/lib/webhook-delivery.ts:87` (Signaturprüfung gegen das Secret pro Repository).
  - CLI, MCP und VS Code rufen außerdem weitere Endpunkte auf:
    - `/api/cli/repos/connect`: löst die Strukturdaten-Ingestion des ganzen Repos über GitHub aus (`packages/shared/src/node/api-client.ts:127-130`, `packages/vscode-extension/src/connectFlow.ts:31`).
    - `/api/cli/pr/review`: Der Server holt den PR von GitHub und postet Review-Kommentare (`api-client.ts:168-171`, `src/app/api/cli/pr/review/route.ts:100-111`).
    - `/api/cli/findings/resolve` sendet Begründung, Commit und PR (`api-client.ts:204-214`).
- **Korrektur**
  - DSE §6.1, neuer Punkt:
    - DE: „**Repository-Anbindung ohne GitHub App:** Verbinden Sie ein Repository im Dashboard, über die CLI, die VS-Code-Erweiterung oder den MCP-Server, legen wir mit Ihrem GitHub-Zugriffstoken einen Webhook in diesem Repository an. GitHub schickt uns dann Pull-Request-Ereignisse. Wir verarbeiten sie wie bei der GitHub App und veröffentlichen die Ergebnisse mit Ihrem Token im Pull Request.“
    - EN: „**Connecting a repository without the GitHub App:** If you connect a repository in the dashboard, via the CLI, the VS Code extension or the MCP server, we create a webhook in that repository using your GitHub access token. GitHub then sends us pull request events, which we process as for the GitHub App, and we publish the results on the pull request using your token.“
  - Tool-Punkt ergänzen:
    - DE: „Auf Ihren Befehl lösen die Werkzeuge außerdem die Anbindung eines Repositorys (Abschnitt 6.1, Strukturdaten) oder die Prüfung eines Pull Requests aus, den wir dann bei GitHub abrufen, und übermitteln Ihre Begründung, wenn Sie einen Hinweis als erledigt markieren.“
    - EN: „On your command, the tools also trigger connecting a repository (structural data, section 6.1) or the review of a pull request, which we then fetch from GitHub, and they send your reasoning when you mark a finding as resolved.“
  - AVV Anlage 2 Nr. 1:
    - DE: „… nach Installation der GitHub App oder über einen vom Verantwortlichen angelegten Repository-Webhook …“
    - EN entsprechend.

### P1-04 — mittel — Suchvektoren entstehen auch aus dem Diff, nicht nur aus den Strukturdaten
- **Fundstelle:** DSE §6.3: „Die Strukturdaten Ihres Repositorys (Abschnitt 6.1) wandeln wir in der Google-Region Frankfurt (`europe-west3`) in Suchvektoren um.“ AVV Anlage 2 Nr. 6 und Anlage 4 sinngemäß.
- **Beleg:** `src/lib/rag.ts:199-201,238-267` und `src/lib/embeddings.ts:38` über `getVertexClient()` = `europe-west3` (`src/lib/vertex.ts:52-57`). Bis zu 2.000 Zeichen (Dateinamen plus bis zu 30 hinzugefügte Diff-Zeilen) gehen an `text-embedding-005`. Die Region bleibt EU; die Aussage ist also unvollständig, nicht falsch in Bezug auf den Ort.
- **Korrektur**
  - DE: „Die Strukturdaten Ihres Repositorys (Abschnitt 6.1) und für jede Prüfung einen Auszug aus dem Diff (Dateinamen und bis zu 30 hinzugefügte Zeilen) wandeln wir in der Google-Region Frankfurt (`europe-west3`) in Suchvektoren um. Die Vektoren aus dem Diff speichern wir nicht.“
  - EN: „We convert the structural data of your repository (section 6.1) and, for each review, an excerpt of the diff (file names and up to 30 added lines) into search vectors in Google's Frankfurt region (`europe-west3`). We do not store the vectors derived from the diff.“
  - AVV Anlage 2 Nr. 3 und 6 sowie Anlage 4 entsprechend ergänzen.
  - Zusatz, **Verdacht, nicht verifiziert:** Dass Google für `text-embedding-005` in `europe-west3` die Verarbeitung vor Ort zusagt, belegt r6 nicht (dort ist nur die Gemini-Tabelle ausgewertet). Vor der Veröffentlichung gegen https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency prüfen.

### P1-05 — mittel — „keine Funktionsinhalte“ sagt der Code nicht zu
- **Fundstelle:** DSE §6.1: „… speichern daraus nur seine Struktur: Signaturen, Schnittstellen und Typdefinitionen, keine Funktionsinhalte.“ Ebenso AVV Anlage 2 Nr. 6.
- **Beleg:** `src/lib/skeleton.ts:51-150,171-205,263-326` ist eine Regex-Heuristik.
  - `extractBlock` liest bei `type X = …` ohne Semikolon weiter, bis eine `{…}`-Klammer schließt, maximal 100 Zeilen. Dabei können nachfolgende Funktionsrümpfe mitkommen.
  - `extractClassSkeleton` behält alle Zeilen, die das Methoden-Regex nicht trifft. Dazu gehören Klassenfelder mit Initialwerten und Arrow-Function-Properties samt Rumpf (`handler = () => { … }`) sowie mehrzeilige Methodensignaturen.
  - Interfaces und Typen werden vollständig gespeichert, bis zu 100 Zeilen.
  - Nur `.ts/.tsx/.js/.jsx/.mjs` werden ausgewertet (`skeleton.ts:333`).
- **Korrektur**
  - DE: „… speichern daraus im Wesentlichen seine Struktur: Signaturen, Schnittstellen, Typdefinitionen und Klassenaufbau aus JavaScript- und TypeScript-Dateien. Die Auswahl erfolgt automatisch und kann einzelne weitere Code-Zeilen enthalten, etwa Initialwerte von Klassenfeldern.“
  - EN: „… store essentially its structure: signatures, interfaces, type definitions and class outlines from JavaScript and TypeScript files. The selection is automatic and can include individual further lines of code, such as initial values of class fields.“
  - Alternative: den Extraktor härten und den Satz belassen, dann mit Test als Beleg.

### P1-06 — mittel — Es fehlt der GitHub-Scope `user:email`
- **Fundstelle:** DSE §5: „(GitHub-Berechtigungen `repo`, `admin:repo_hook`, `read:org`)“. EN entsprechend.
- **Beleg**
  - Supabase Auth setzt `user:email` immer voran. https://raw.githubusercontent.com/supabase/auth/master/internal/api/provider/github.go (abgerufen 2026-09-28): `oauthScopes := []string{"user:email"}`, danach werden die eigenen Scopes angehängt.
  - Der Code übergibt nur die drei Scopes (`src/app/login/GitHubLoginButton.tsx:40`).
- **Korrektur**
  - DE: „(GitHub-Berechtigungen `user:email`, `repo`, `admin:repo_hook`, `read:org`)“, dazu: „Mit `user:email` können wir die E-Mail-Adressen Ihres GitHub-Kontos lesen, auch nicht öffentliche.“
  - EN entsprechend.

### P1-07 — mittel — Supabase verarbeitet die IP-Adresse und protokolliert sie (Browser verbindet sich direkt)
- **Fundstelle:** DSE §5 („direkte Verbindung zu Supabase (Realtime)“) ohne Angabe der Verarbeitung. DSE §12 und AVV nennen keine Supabase-Logs.
- **Beleg**
  - Browser-Client und Realtime: `src/lib/supabase/client.ts:4-9`, `src/app/dashboard/useDashboardSync.ts:230ff.`. Den OAuth-Start übernimmt Supabase Auth (`GitHubLoginButton.tsx:31-43`).
  - Log-Felder, https://supabase.com/docs/guides/telemetry/log-field-reference (abgerufen 2026-09-28): Edge-Logs mit `cf_connecting_ip`, `x_real_ip`, User-Agent; Auth-Logs mit `remote_addr`.
  - Aufbewahrung, https://supabase.com/pricing (abgerufen 2026-09-28): „Free: 1 day · Pro: 7 days“.
- **Korrektur**
  - DSE §5, neuer Satz:
    - DE: „Dabei und bei der Anmeldung verarbeitet Supabase Ihre IP-Adresse und den Browser-Typ und protokolliert sie [SUPABASE-LOGFRIST: 1 Tag (Free) / 7 Tage (Pro)] lang.“
    - EN: „In doing so, and when you sign in, Supabase processes and logs your IP address and browser type for [SUPABASE-LOGFRIST].“
  - DSE §12: Zeile „Protokolle bei Supabase | [SUPABASE-LOGFRIST]“ ergänzen.

### P1-08 — mittel (Paketcode belegt, Laufzeit nicht beobachtet) — GitHub-Token und Profildaten liegen unverschlüsselt im Sitzungs-Cookie
- **Fundstellen**
  - DSE §5: „Das dabei ausgestellte Zugriffstoken speichern wir verschlüsselt (AES-256-GCM).“
  - DSE §4, Zeile `sb-…-auth-token`: „hält Sie nach der Anmeldung angemeldet“.
  - AVV Anlage 3 Nr. 1.
- **Beleg**
  - `@supabase/auth-js` 2.105.3, `GoTrueClient.js:3978-4005`: `_saveSession` speichert die ganze Session. Nach `exchangeCodeForSession` gehören dazu `provider_token` (GitHub-OAuth-Token mit `repo`-Scope) und das `user`-Objekt mit E-Mail und GitHub-Metadaten.
  - Speicher ist das Cookie, `httpOnly=false` (`@supabase/ssr/dist/main/utils/constants.js`).
  - Das Token bleibt dort bis zum ersten Refresh, dessen Antwort kein Provider-Token mehr enthält.
  - Verschlüsselt ist nur die Kopie in `github_tokens` (`src/app/auth/callback/route.ts:34-54`, `src/lib/crypto.ts:10`).
- **Korrektur**
  - Technisch: `provider_token` nach dem Speichern aus der Session entfernen, und/oder die Cookies `httpOnly` setzen.
  - Text, DSE §4:
    - DE: „`sb-…-auth-token` … enthält Ihre Sitzung einschließlich Ihrer GitHub-Kontoangaben; unmittelbar nach der Anmeldung vorübergehend auch Ihr GitHub-Zugriffstoken“
    - EN entsprechend.
  - DSE §5, DE: „In unserer Datenbank speichern wir das Zugriffstoken verschlüsselt (AES-256-GCM).“

### P1-09 — mittel — „durch einen automatisierten Test überwacht“ trägt nicht
- **Fundstelle:** AVV Anlage 3 Nr. 2: „Browser-Clients haben auf die Tabellen mit Auftragsdaten keinen Zugriff (Rechte entzogen, durch einen automatisierten Test überwacht)“. EN: „monitored by an automated test“.
- **Beleg**
  - Die Rechte sind entzogen: `supabase/migrations/038_revoke_client_grants_on_private_tables.sql` und `045_waitlist_signups.sql:32`.
  - Der Test `src/lib/supabase/private-grants.integration.test.ts:14-16` überspringt sich ohne Credentials. Sein Kommentar sagt „in CI werden sie injiziert“, aber im Repo gibt es **kein `.github/`** und kein CI.
  - `waitlist_signups` fehlt in `PRIVATE_TABLES` (Zeile 32-47).
  - Live-Stand: blocked: tooling.
- **Korrektur**
  - DE: „(Rechte per Datenbankmigration entzogen; ein Integrationstest gegen die Datenbank prüft das bei jeder Ausführung mit Zugangsdaten)“
  - EN: „(privileges revoked by database migration; an integration test against the database verifies this whenever it is run with credentials)“
  - Alternativ CI mit Secrets einrichten und `waitlist_signups` in den Test aufnehmen.

### P1-10 — mittel — „Änderungen erfolgen über Pull Requests mit automatisierten Tests“
- **Fundstelle:** AVV Anlage 3 Nr. 3, erster Punkt. EN entsprechend.
- **Beleg**
  - `git log --first-parent HEAD` zeigt bis 2026-09-22 durchgehend Direkt-Commits auf `main` (z. B. `e04f263`, `1965da5`, `ef14cd1`, `5328329`). Selbst am 2026-09-28 gibt es noch Direkt-Commits (`02bd4aa`, `d6be7f4`, allerdings nur `docs/company`).
  - Es gibt kein CI (kein `.github/workflows`); Tests laufen nur lokal.
- **Korrektur**
  - DE: „Änderungen am Dienst werden vor der Auslieferung lokal mit automatisierten Tests geprüft und seit [DATUM] über Pull Requests eingespielt; Auslieferungen sind in der Versionshistorie des Hosting-Anbieters nachvollziehbar.“
  - EN entsprechend.
  - Oder: CI einführen und Branch-Schutz auf `main` aktivieren, dann mit Beleg.

### P1-11 — mittel — Zugangsdaten und Auftragsdaten auch auf dem Arbeitsgerät
- **Fundstellen**
  - AVV Anlage 3 Nr. 2: „Dienst-Zugangsdaten (Datenbank-Dienstschlüssel, Google-Dienstkonto, …) liegen nur als Umgebungsvariablen beim Hosting-Anbieter“.
  - AVV § 12 Abs. 3: „die Verarbeitung der Auftragsdaten findet ausschließlich bei den Unterauftragsverarbeitern statt“.
- **Beleg**
  - `scripts/db-query.ts:18-21,79-80` lädt `SUPABASE_SERVICE_ROLE_KEY` aus `.env.local` auf dem Arbeitsgerät. Laut `CLAUDE.md` ist das der „echte Service-Role-Read“ für Live-Tabellen wie `review_jobs`. Weitere Skripte in `scripts/` (z. B. `simulate-webhook.ts`, `replay-golden-diffs.ts`) laufen ebenfalls lokal.
  - `src/lib/vertex.ts:23-26` schreibt den Dienstkonto-Schlüssel zur Laufzeit als Datei nach `os.tmpdir()/vertex-key.json`.
  - Der Inhalt von `.env.local` wurde nicht eingesehen (Rechte-Ablehnung). Belegt ist nur, dass der Code den Schlüssel dort erwartet.
- **Korrektur**
  - DE Anlage 3: „Dienst-Zugangsdaten liegen als Umgebungsvariablen beim Hosting-Anbieter und, für Wartung und Fehleranalyse, in einer nicht versionierten Datei auf dem verschlüsselten Arbeitsgerät des Geschäftsführers; nicht im Quellcode.“
  - DE § 12 Abs. 3: „… findet bei den Unterauftragsverarbeitern statt; zur Fehleranalyse ruft der Geschäftsführer einzelne Datensätze im Einzelfall vom Arbeitsgerät aus ab, ohne sie dort dauerhaft zu speichern.“
  - EN entsprechend.

### P1-12 — mittel — Rolle beim Kundencode ist in sich nicht schlüssig
- **Fundstellen**
  - DSE §2: „Wir sind Auftragsverarbeiter unserer Kunden für den Quellcode … Verantwortlich für diese Daten ist der Kunde.“ Das gilt dort pauschal.
  - DSE §6.4: „Sind Sie selbst unser Vertragspartner und nutzen unslop für eigenen Code, ist die Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO.“ Hier ist unslop Verantwortlicher.
  - AVV-Präambel: nur für Kunden, die „als Unternehmer“ nutzen.
  - AVV § 1 Abs. 2: Abschluss per Klick. V12 ist aber nicht gebaut, und laut Spec E1 sind Verbraucher zugelassen.
- **Problem**
  - Für Verbraucher und für Unternehmer vor dem AVV-Klick sagt §2 „Auftragsverarbeiter“, §6.4 aber „Verantwortlicher“.
  - Art. 6 Abs. 1 lit. b trägt die Daten Dritter im Code (Mitentwickler, Testdaten) nicht.
  - „Für Kunden, mit denen wir einen AVV geschlossen haben“ lässt offen, was für Unternehmer ohne AVV gilt.
- **Korrektur**
  - DSE §2, erster Unterpunkt:
    - DE: „**Wir sind Auftragsverarbeiter** für den Quellcode, den uns Unternehmer zur Prüfung übermitteln; dafür gilt unser AVV, den Unternehmer bei der Registrierung abschließen (Abschnitt 6).“
    - Neuer Unterpunkt: „Nutzen Sie unslop als Verbraucher, sind wir für die Verarbeitung Ihres Codes selbst Verantwortlicher; Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, für personenbezogene Daten Dritter in Ihrem Code Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes Interesse und Ihres ist, den Code wie beauftragt zu prüfen).“
  - DSE §6.4 entsprechend angleichen.
  - EN entsprechend.
  - AVV § 1 Abs. 2 mit `[VORBEDINGUNG V12]` markieren.

### P1-13 — mittel — Speicherdauer der Strukturdaten ist widersprüchlich, der Deaktivierungspfad unvollständig
- **Fundstellen**
  - DSE §12: „Strukturdaten und Suchvektoren eines Repositorys | solange das Repository verbunden ist“.
  - Dagegen DSE §6.4 und AVV Anlage 2: „… löschen sie 30 Tage nach der Trennung“.
  - DSE §6.4: „Trennen Sie ein Repository, deaktivieren wir sie sofort“.
- **Beleg**
  - Beim Entfernen der App (`installation.deleted`, `installation_repositories.removed`) setzt `src/lib/app-installation.ts:512-537` nur `repositories.status`. Die `code_chunks` werden **nicht** deaktiviert. Der Dashboard-Pfad deaktiviert sie dagegen (`src/app/api/repos/disconnect/route.ts:102-108`).
  - Bei erneuter Anbindung löscht `src/lib/skeleton.ts:348-356` deaktivierte Chunks schon nach 10 Sekunden. Der Kommentar dazu lautet „Zu Testzwecken“.
  - Der Cron-Job hängt an `repositories.updated_at` (`028_fix_ttl_cleanup_interval.sql:21-31`). Live-Stand: blocked: tooling.
- **Korrektur**
  - DSE §12, DE: „solange das Repository verbunden ist; danach Löschung spätestens 30 Tage nach der Trennung“. EN entsprechend.
  - DSE §6.4, DE: „Trennen Sie ein Repository oder entfernen Sie es aus der GitHub App, verwenden wir sie nicht mehr und löschen sie spätestens 30 Tage danach …“
  - Außerdem Code-To-Dos: App-Detach deaktiviert auch die Chunks, und der 10-s-Testwert kommt raus.

### P1-14 — mittel — AVV § 9 Abs. 2 verspricht eine Löschung, die heute technisch blockiert ist
- **Fundstelle:** AVV § 9 Abs. 2: „… insbesondere durch Export und Löschung der Daten eines Repositorys oder Kontos auf Weisung.“
- **Beleg**
  - `supabase/migrations/037_create_finding_suppressions.sql`: Die FKs haben kein CASCADE, und ein Append-only-Trigger verbietet `DELETE`. Damit scheitert die Löschung von Repo oder Konto, sobald es Dismissals gibt.
  - Einen Konto-Löschpfad gibt es im Code nicht (r0 §4).
  - § 14 Abs. 2 hat einen Platzhalter, § 9 Abs. 2 nicht.
- **Korrektur:** `[VORBEDINGUNG V4: Löschpfad für Konten und Repositories trotz finding_suppressions]` an § 9 Abs. 2 anhängen, in DE und EN.

### P1-15 — niedrig — Paddle.js lädt schon beim Aufruf der Seite; es gehen zwei interne IDs an Paddle
- **Fundstelle:** DSE §8: „… Ihre E-Mail-Adresse, die interne Kennung Ihres Kontos …“ und „Das Zahlungsfenster lädt ein Skript von Paddle“.
- **Beleg**
  - `src/app/api/billing/checkout/route.ts:56-59`: `customData: { account_id, user_id }`. Die E-Mail geht nur mit, wenn noch keine Paddle-Kunden-ID existiert.
  - `src/app/dashboard/settings/billing/BillingClient.tsx:117-138`: `initializePaddle` läuft beim Mount der Seite, nicht erst beim Öffnen des Zahlungsfensters. Paddle erhält also die IP bei jedem Aufruf der Abrechnungsseite.
- **Korrektur**
  - DE: „… Ihre E-Mail-Adresse (sofern Paddle Sie noch nicht kennt), die internen Kennungen Ihres Nutzer- und Abrechnungskontos und die Sprache. Beim Aufruf der Abrechnungsseite lädt Ihr Browser ein Skript von Paddle (`cdn.paddle.com`); dabei erhält Paddle Ihre IP-Adresse.“
  - EN entsprechend.

### P1-16 — niedrig — Der globale Endpunkt ist auch über den Draft-Override erreichbar
- **Fundstelle:** Der OPTIONAL-Absatz in DSE §6.3 und AVV Anlage 4 nennt nur den Rückfall der „abschließenden Prüfung“.
- **Beleg:** `src/lib/pipeline/models.ts:192-195`: Auch `UNSLOP_DRAFT_MODEL_OVERRIDE` plus `UNSLOP_DRAFT_MODEL_OVERRIDE_ENDPOINT=global` routet auf `global`.
- **Korrektur:** E8 um „Draft-Override `global` entfernen oder sperren“ erweitern. Sonst den OPTIONAL-Text auf „einzelne Prüfschritte“ ausweiten.

### P1-17 — niedrig — PKCE-Cookie kann bis zu 400 Tage bleiben
- **Fundstelle:** DSE §4: `sb-…-auth-token-code-verifier` „bis die Anmeldung abgeschlossen ist“.
- **Beleg:** `@supabase/ssr` setzt `maxAge` 400 Tage (`constants.js`). Entfernt wird das Cookie erst beim Code-Austausch (`GoTrueClient.js:3983`). Bricht die Anmeldung ab, bleibt es stehen.
- **Korrektur**
  - DE: „bis die Anmeldung abgeschlossen ist, bei abgebrochener Anmeldung höchstens 400 Tage“
  - EN: „until sign-in completes; if sign-in is aborted, at most 400 days“

### P1-18 — niedrig — Das GitHub-Token wird breiter genutzt als beschrieben
- **Fundstelle:** DSE §5: „Wir nutzen es nur, um die Repositories anzubinden und zu prüfen, die Sie auswählen.“
- **Beleg:** `src/lib/github.ts`:
  - `:174` listet alle Repositories für die Auswahl.
  - `:216-223` prüft die Mitgliedschaft in Organisationen.
  - `:259` liest die Identität.
  - `:394-449` verwaltet Webhooks und prüft ihren Zustand.
  - Im OAuth-Pfad postet es auch Reviews und Kommentare.
- **Korrektur**
  - DE: „Wir nutzen es, um Ihnen Ihre Repositories zur Auswahl anzuzeigen, Ihre Berechtigung für eine GitHub-App-Installation zu prüfen, ausgewählte Repositories anzubinden (Webhook) und zu prüfen und dort Ergebnisse zu veröffentlichen.“
  - EN entsprechend.

### P1-19 — niedrig — Ins Repository geschrieben und dort gelesen wird mehr als beschrieben
- **Fundstelle:** DSE §6.2 und AVV Anlage 2 Nr. 5 nennen nur „Check Run und Review-Kommentare“. DSE §6.2: „Die Hinweise erzeugt eine KI.“
- **Beleg**
  - PR-Kommentare, etwa „billing paused“ und Gate-Hinweise: `src/lib/billing/billing-paused-comment.ts:75-92`, `src/lib/gate-notice.ts`.
  - Review-Threads werden per GraphQL als erledigt markiert: `src/lib/github.ts:752`.
  - Alle PR-Kommentare, auch fremde, werden für die Dublettenprüfung gelesen: `src/lib/github.ts:818-824`, `billing-paused-comment.ts:92`.
  - Ein Teil der Hinweise stammt aus deterministischen Regeln des Pre-Scanners, nicht aus der KI.
- **Korrektur**
  - DE: „… als Check Run, als Review-Kommentare und bei Bedarf als Hinweis-Kommentar im Pull Request; markieren Sie einen Hinweis als erledigt, schließen wir die zugehörige Diskussion. Vorhandene Kommentare im Pull Request lesen wir nur, um keine Hinweise doppelt zu posten.“
  - DE, KI-Satz: „Die Hinweise erzeugen feste Regeln und eine KI …“
  - EN entsprechend.

### P1-20 — niedrig — Paketnamen können Benutzernamen enthalten
- **Fundstelle:** DSE §6.2 („nur den Paketnamen, keine Daten über Sie“), AVV Anlage 2 Nr. 2 und Anlage 4.
- **Beleg:** `packages/prescan/src/engines/registry-engine.ts:246-249`: npm-Scopes (`@user/pkg`) und Hugging-Face-IDs (`user/model`) enthalten Konto-Namen.
- **Korrektur**
  - DE: „Dabei übermitteln wir nur den Paket- oder Modellnamen, wie er im Code steht (er kann den Kontonamen des Paketautors enthalten), und keine Daten über Sie.“
  - EN entsprechend.

### P1-21 — niedrig — Nicht nur der Hash wird gespeichert
- **Fundstelle:** AVV Anlage 3 Nr. 1: „API-Schlüssel speichert der Dienst nur als SHA-256-Hash.“
- **Beleg:** `src/lib/api-keys.ts:28-37`. Laut Migration 015 wird das Präfix im Klartext gespeichert. Die DSE §7 sagt korrekt „Hash und das Präfix“.
- **Korrektur**
  - DE: „… nur als SHA-256-Hash und ein kurzes Präfix zur Wiedererkennung.“
  - EN entsprechend.

### P1-22 — niedrig — DE und EN sagen hier Verschiedenes
- DSE §9 DE: „Wir werten nicht aus, ob Sie unsere E-Mails öffnen“. EN: „We do not track whether you open …“. „Auswerten“ und „tracken“ sind nicht dasselbe. Vorschlag: DE „Wir messen nicht, ob …“ oder EN „We do not evaluate …“. Welche Variante passt, hängt an V6.
- AVV Anlage 3 Nr. 2 nennt beim Secret-Filter „CLI und MCP-Server“, DSE §6.1 dagegen „die Werkzeuge“ inklusive VS Code. Technisch trifft beides zu, weil die Erweiterung die CLI startet (`packages/vscode-extension/src/scanRunner.ts:29-60`). Für Einheitlichkeit: „CLI, MCP-Server und die VS-Code-Erweiterung (über die CLI)“.

### P1-23 — niedrig — Für Paddle.com Inc. fehlt die Anschrift
- **Fundstelle:** DSE §8: „für Käufer in den USA Paddle.com Inc.“ steht ohne Anschrift.
- **Beleg:** r6 §5 (MSA): Paddle.com Inc., 3811 Ditmars Blvd #1071, Astoria, NY, USA.
- **Korrektur:** Anschrift ergänzen, in DE und EN.

### P1-24 — niedrig — „Erst wenn Sie ihn anklicken, stehen Sie auf der Liste“
- **Fundstelle:** DSE §9.
- **Beleg:** `src/lib/waitlist/signup-store.ts:40-46` speichert den Eintrag sofort als `pending`. `status` wird im Code nie auf `confirmed` gesetzt (`045_waitlist_signups.sql:5-6`).
- **Korrektur**
  - DE: „Erst wenn Sie ihn anklicken, nimmt Brevo Sie in die Versandliste auf. Unbestätigte Einträge in unserer Datenbank löschen wir nach [SPEICHERFRIST-WAITLIST-UNBESTÄTIGT].“
  - EN entsprechend.

### P1-25 — Verdacht, nicht verifiziert — Brevo und Drittländer
- **Fundstelle:** DSE §11: Brevo „keine Übermittlung für den Versand“.
- **Hintergrund:** Brevos Subprozessor-Liste (r6 §6) nennt Cloudflare (USA/EU) und Zendesk (EU/USA). Ob beim Versand Daten über Cloudflare in die USA gehen, ist offen.
- **Vorschlag:** „Hosting in der EU; für Unterauftragsverarbeiter außerhalb der EU EU-Standardvertragsklauseln bzw. EU-US Data Privacy Framework (laut Brevo-AVV)“.

### P1-26 — Verdacht, nicht verifiziert — Dismissal-Verdicts als Qualitätsdaten
- **Fundstelle:** AVV § 4 schließt „Benchmarks oder … Verbesserung von Prüfregeln“ aus.
- **Beleg:** `src/lib/telemetry/llm-call-log.ts:44` bezeichnet die gespeicherten `verdicts` als „Audit-Grundlage für False Refutations“, also als Grundlage für Qualitätsarbeit am Verifier. Spec E10 behandelt das nur für SPEC §12.4 G2.
- **Vorschlag:** Klarstellen, dass die Auswertung der `verdicts` nur zur Fehleranalyse des einzelnen Auftrags erfolgt. Oder sie unter § 4 als Ausnahme mit Opt-in führen.

---

## Geprüft und korrekt (knapp)

**Hosting und Proxy**
- Die Vercel-Region `fra1` steht in `vercel.json:2`.
- Der Proxy ruft `updateSession` auf allen Seitenpfaden auf (`src/proxy.ts`). Die Aussage „Anmeldung wird auch auf Marketing-Seiten erneuert“ stimmt.
- Vercel: DPF aktiv, AES-256 at rest, SOC 2 Typ 2 und ISO 27001:2022 (vercel.com/docs/security/compliance, 2026-09-28).

**Cookies und lokaler Speicher**
- Supabase-Cookies: Namen, Aufteilung in Teile, 400 Tage `maxAge` (`@supabase/ssr` 0.10.2).
- Abmelden gibt es: `src/app/auth/signout/route.ts`.
- `unslop_locale`: 1 Jahr, nur `de`/`en`, wird nur über den LocaleSwitcher auf Login- und Dashboard-Seite gesetzt (`src/i18n/set-locale-action.ts`).
- Einzige localStorage-Nutzung ist `unslop.onboarding.path`. Kein sessionStorage, kein `document.cookie`, kein `next-intl`-Middleware-Cookie.
- Keine Analytics, kein `next/script`, keine externen Bilder oder Avatare, keine externen Fonts im Web.

**Konto und Anmeldung**
- Anmeldung nur per GitHub OAuth.
- GitHub-Token mit AES-256-GCM verschlüsselt in `github_tokens` (`src/lib/crypto.ts:10`).
- API-Schlüssel als SHA-256 plus Präfix. Das Label ist `cli-<hostname>` und läuft über die URL (`packages/cli/src/login.ts:35-41`).
- Konfigurationsdatei mit Modus 0600. Die VS-Code-Einstellung hat `scope: machine`, wird also nicht synchronisiert.

**Clients**
- Clients senden keine Telemetrie und suchen nicht nach Updates.
- Ausgehende Verbindungen gehen nur an `unslop.codes` und `git ls-remote`; Ausnahme ist Google Fonts, das als Platzhalter C5 markiert ist.
- Der Secret-Filter bricht vor dem Senden ab, statt zu schwärzen. Im PR-Pfad gibt es keinen solchen Filter, und die AVV sagt das zutreffend.

**GitHub-Webhooks**
- PR-Titel, -Beschreibung und -Autor werden nicht gelesen. Der Parser liest nur die in DSE §6.1 genannten Felder (`src/lib/github-webhook-payload.ts:74-100`).
- Ausgewertet werden nur die Events `installation`, `installation_repositories`, `check_run` und `pull_request`.
- Installationen speichern `installation_id`, `account.login` und `account.type`.
- Signaturprüfung: GitHub App über `route.ts:146`; Repo-Hooks über `webhook-delivery.ts:87`; Paddle über `paddle/webhook/route.ts:27-30`.

**Speicherung von Reviews**
- Den Diff speichert die Datenbank nur für CLI und MCP (`cli/scan/route.ts:93-100`). Im PR-Pfad und bei `/api/cli/pr/review` wird kein Diff gespeichert.
- Die Fehlermeldung kann Modellausgabe enthalten, wie beschrieben.
- `review_job_llm_calls` enthält Modell, Tokens, Latenz und Verdicts.
- Dismissal-Felder laut Migration 037.

**Google Vertex**
- Draft, Verifier und Eskalation laufen über den `eu`-Client (`src/lib/vertex.ts:66-71`, `models.ts:204-206`).
- Der globale Endpunkt wird nur per Flag oder Override genutzt.
- Der Explicit Cache enthält nur Regeln und Conditions (`prompt-builder.ts:47-54`). Diff, RAG und Prescan-Tupel stehen nur im User-Prompt (`draft-reviewer-step.ts:174-194`).
- Kein Grounding und keine Interactions API im Code gefunden.

**Paddle**
- Gespeichert werden nur IDs und Status (`paddle-webhook.ts:180-194`). Rechnungen werden live abgerufen.
- Paddle.js wird nur in `BillingClient.tsx` eingebunden.

**Warteliste**
- Felder laut Migration 045 und `signup-store.ts`.
- IP-Hash: `sha256(salt:YYYY-MM-DD:ip)`; die IP selbst wird nicht gespeichert.
- An Brevo gehen nur E-Mail, Template-ID je Sprache, Redirect-URL und Listen-ID.

**Datenbank-Rechte und Kryptografie**
- Die Client-Rechte werden per Migration 038/045 entzogen (Überwachung siehe P1-09).
- `repositories` ist nur mit `SELECT` für `authenticated` lesbar, eingeschränkt durch RLS (Migration 011).
- Die Operator-Allowlist ist fail-closed (`src/lib/operator.ts`).

**Anbieterangaben**
- Die Anschrift der Aufsichtsbehörde HBDI (Wilhelmstraße 7, 65185 Wiesbaden, 0611 1408-0) steht so im HBDI-Impressum (abgerufen 2026-09-28).
- Entitäten und Anschriften von Vercel, Supabase Pte. Ltd., Google Cloud EMEA, Brevo GmbH und Proton AG stimmen mit r6 überein.
- Transfergrundlagen: Supabase über EU-Standardvertragsklauseln (kein DPF), UK-Angemessenheitsbeschluss bis 27.12.2031, Paddle.com Inc. über EU-Standardvertragsklauseln (kein DPF).

**DE/EN**
- Abgesehen von P1-22 sind DE und EN bei den Tatsachen inhaltlich deckungsgleich.
