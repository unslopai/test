# Review 3 – Code-Abgleich DSE/AVV, zweite Runde (adversarial)

Geprüft: `docs/legal/datenschutz.de.md`, `privacy.en.md`, `avv.de.md`, `dpa.en.md` im Worktree `C:\dev\unslop-legal` (HEAD `5fcec5d`), 2026-09-28. Ich habe nur gelesen. Das Paketverhalten habe ich in `C:\dev\unslop\node_modules` geprüft (`@supabase/auth-js` 2.105.3, `@supabase/ssr` 0.10.2, `@paddle/paddle-js`). Die Datenbank habe ich nicht abgefragt. Live-Werte wie die Supabase-JWT-Laufzeit und der Inhalt von `.env.local` sind deshalb **blocked: tooling / nicht geprüft**.

---

## 1. Umsetzung der Runde-1-Befunde

| Befund | Stand |
|---|---|
| P1-01 | Weitgehend umgesetzt: V1 steht an DSE §2/§3/§11 und AVV Anl. 3/4, die Formulierung „zur Einsicht“ ist drin. Offen ist nur die Marker-Hygiene, siehe P2-06. |
| P1-02 | DSE §3 ist korrekt umgesetzt. In der AVV ist die Tabellenzeile zu eng, siehe **P2-02**. |
| P1-03 | Umgesetzt (DSE §6.1, AVV Anl. 2 Nr. 1, Anl. 4). Die neuen Sätze stimmen mit `connect-repository.ts:196-240` und `github.ts:406` (`events: ['pull_request']`) überein. Dabei ist eine neue Lücke entstanden, siehe **P2-01** und **P2-05**. |
| P1-04 | Umgesetzt. „Dateinamen und bis zu 30 hinzugefügte Zeilen“ stimmt mit `rag.ts:238-267` überein. „Vektoren aus dem Diff speichern wir nicht“ stimmt ebenfalls: Sie werden nur in `matchCodeChunks` verwendet (`rag.ts:201-205`). Die V18-Markierung ist gesetzt. |
| P1-05, P1-06, P1-07, P1-09, P1-11, P1-12, P1-14 bis P1-26 | Korrekt umgesetzt. „Integrationstest … wenn mit Zugangsdaten ausgeführt“ passt zu `private-grants.integration.test.ts:14-47`. Die Tabellenliste deckt alle Tabellen mit Auftragsdaten ab. |
| P1-08 | Umgesetzt. Die Formulierung „vorübergehend“ bzw. „briefly“ ist aber zu weich, siehe **P2-03**. |
| P1-10 | Der Satz trägt die Markierung `[BESTÄTIGEN …]`. In Ordnung. |
| P1-13 | Umgesetzt, mit V4. `detachRepositories` setzt `status: 'deactivated'` (`app-installation.ts:506-537`). Damit greift der 30-Tage-Cron grundsätzlich auch beim Entfernen der App (Hinweis in P2-06). |

---

## 2. Befunde

### P2-01 – mittel – Beim Repo-Webhook-Pfad erscheint das Ergebnis unter dem GitHub-Konto des Nutzers und als „Änderungen angefordert“. Es gibt dort keinen Check Run.

- **Fundstellen**
  - DSE §6.1, „Repository-Anbindung ohne GitHub App“: „… die Ergebnisse veröffentlichen wir mit Ihrem Token im Pull Request.“
  - DSE §6.2: „Bei Pull Requests veröffentlichen wir es als Check Run, als Review-Kommentare …“
  - DSE §6.2, Art. 22: „Ob ein fehlgeschlagener Check das Zusammenführen eines Pull Requests verhindert, legt allein der Kunde … fest.“
  - EN entsprechend.
- **Beleg**
  - `src/lib/pipeline/steps/github-reporter-step.ts:8-12`: „'oauth': User. Kein Check Run möglich, deshalb REQUEST_CHANGES als Gate“.
  - Dieselbe Datei, `:119-140`: „posten also als der PR-Autor selbst … REQUEST_CHANGES … mit COMMENT-Fallback“.
  - `src/lib/github.ts:851`: „Check Runs (nur mit Installation-Token — OAuth-Tokens dürfen keine erstellen)“.
  - Auch Hinweis-Kommentare (`postPRComment`) und das Auflösen von Diskussionen (`findings/resolve/route.ts:228-235` über `resolveRepoAccessToken`) laufen im OAuth-Modus mit dem Nutzer-Token. Sie erscheinen also im Namen des Nutzers.
- **Warum es zählt**
  - Der Name des Nutzers wird dabei gegenüber allen sichtbar, die den Pull Request sehen können.
  - Die Merge-Sperre läuft hier über einen Review mit „Changes requested“, nicht über einen Check.
- **Ersatztext**
  - DSE §6.1, DE: „… GitHub schickt uns dann Pull-Request-Ereignisse, die wir wie bei der GitHub App verarbeiten. Die Ergebnisse veröffentlichen wir mit Ihrem Token im Pull Request. Sie erscheinen dort unter Ihrem GitHub-Benutzernamen, als Review mit angeforderten Änderungen („Changes requested“) statt als Check Run.“
  - DSE §6.1, EN: „… GitHub then sends us pull request events, which we process as for the GitHub App. We publish the results on the pull request using your token. They appear there under your GitHub username, as a review requesting changes instead of a check run.“
  - DSE §6.2, Art.-22-Satz, DE: „Ob ein fehlgeschlagener Check oder eine angeforderte Änderung das Zusammenführen eines Pull Requests verhindert, legt allein der Kunde in seinen GitHub-Einstellungen fest.“
  - DSE §6.2, Art.-22-Satz, EN: „Whether a failed check or a requested change prevents a pull request from being merged is decided solely by the customer in their GitHub settings.“

### P2-02 – mittel – AVV/DPA Anlage 2: Code-Ausschnitte landen bei jeder Prüfung in den Laufzeitprotokollen, nicht nur im Fehlerfall

- **Fundstelle**
  - AVV Anl. 2, Tabelle: „Laufzeitprotokolle beim Hosting-Anbieter (Repository- und Dateinamen, im Fehlerfall kurze Code-Ausschnitte)“.
  - DPA Annex 2: „short code excerpts in case of errors“.
- **Beleg**
  - `src/lib/rag.ts:198-199` loggt bei **jeder** Prüfung `searchQuery.substring(0, 100)`.
  - Die Query setzt sich aus Dateinamen und hinzugefügten Diff-Zeilen zusammen (`rag.ts:238-267`). Das geschieht auch ohne verbundenes Repo, sobald Ökosysteme gegatet sind (`rag.ts:194`).
  - Die DSE §3 sagt das bereits richtig („einen kurzen Auszug der Suchanfrage aus einem geprüften Diff“). AVV und DSE widersprechen sich also.
- **Ersatztext**
  - DE: „Laufzeitprotokolle beim Hosting-Anbieter (Repository- und Dateinamen, bei jeder Prüfung ein Auszug von bis zu 100 Zeichen aus der aus dem Diff gebildeten Suchanfrage, im Fehlerfall kurze Ausschnitte der Modellantwort) | …“
  - EN: „Runtime logs at the hosting provider (repository and file names, for each review an excerpt of up to 100 characters of the search query built from the diff, in case of errors short excerpts of the model response) | …“

### P2-03 – mittel (Paketcode belegt, Laufzeit nicht beobachtet) – Das GitHub-Token bleibt nicht nur „vorübergehend“ im Cookie

- **Fundstelle**
  - DSE §4, `sb-…-auth-token`: „unmittelbar nach der Anmeldung vorübergehend auch Ihr GitHub-Zugriffstoken“.
  - EN: „briefly after sign-in“.
- **Beleg**
  - `src/app/auth/callback/route.ts:28-34`: `exchangeCodeForSession` schreibt die Session mit `provider_token` über den Server-Client ins Cookie.
  - `@supabase/ssr` `dist/main/utils/constants.js:7,10` setzt das Cookie mit `httpOnly: false` und `maxAge` 400 Tage.
  - Entfernt wird das Token erst, wenn `_refreshAccessToken` (`GoTrueClient.js:3753`) eine neue Session ohne `provider_token` liefert und `_saveSession` (`:3978`) sie speichert.
  - Der Refresh läuft nur bei einem Aufruf nach Ablauf des Access-Tokens: Proxy `getUser()` in `src/lib/supabase/middleware.ts:40` oder Auto-Refresh im offenen Dashboard.
  - Wer sich anmeldet und die Seite nicht wieder aufruft, behält das Token mit `repo`-Scope also bis zu 400 Tage im JS-lesbaren Cookie.
  - Die JWT-Laufzeit des Projekts ist **blocked: tooling**; der Supabase-Standard ist 1 Stunde.
- **Ersatztext**
  - DE: „… nach der Anmeldung auch Ihr GitHub-Zugriffstoken, bis Ihre Sitzung zum ersten Mal erneuert wird (beim ersten Aufruf nach Ablauf der Anmeldung, standardmäßig nach einer Stunde; rufen Sie unslop danach nicht mehr auf, bis zur Abmeldung, höchstens 400 Tage)“
  - EN: „… after sign-in also your GitHub access token, until your session is first refreshed (on the first visit after the sign-in expires, by default after one hour; if you do not return, until you sign out, at most 400 days)“
  - Alternative: V19 umsetzen (Token nach dem Speichern aus der Session entfernen) und den Halbsatz dann ganz streichen.

### P2-04 – niedrig (eindeutig unvollständig) – Bei GitHub wird mehr gelesen als „Diff und geänderte Dateien“ bzw. „JS/TS-Dateien“

- **Fundstelle**
  - DSE §6.1, GitHub App: „die Änderungen (Diff) … und bei Bedarf den vollständigen Inhalt geänderter Dateien“.
  - DSE §6.1, Projektkontext: „lesen wir die JavaScript- und TypeScript-Dateien“.
  - AVV Anl. 2 Nr. 6. EN entsprechend.
- **Beleg**
  - `src/lib/prescan/companion-loader.ts:1-15,51-60`, aufgerufen in `pre-scanner-step.ts:81`: Bei jeder Prüfung werden **unveränderte** `next.config.*`-Dateien und Verzeichnislisten beim Head-Commit gelesen.
  - `src/lib/skeleton.ts:437-460` und `ecosystem-detection.ts:43,51-52,97-111`: Beim Anbinden werden der vollständige Dateibaum (alle Pfade) und bis zu 3 Manifest-Dateien je Familie gelesen (`package.json` samt Abhängigkeiten, `pyproject.toml`, `pom.xml` usw.). Gespeichert werden davon nur die erkannten Ökosysteme (`repositories.detected_ecosystems`).
- **Ersatztext**
  - DE, GitHub App: „… und bei Bedarf den vollständigen Inhalt geänderter Dateien sowie einzelner zugehöriger Konfigurationsdateien (etwa `next.config.*`).“
  - DE, Projektkontext: „Für verbundene Repositories lesen wir die Dateiliste, einzelne Manifest-Dateien wie `package.json` (daraus speichern wir nur die erkannten Programmierumgebungen) und die JavaScript- und TypeScript-Dateien …“
  - EN, GitHub App: „… and, where needed, the full content of changed files and of individual related configuration files (such as `next.config.*`).“
  - EN, Projektkontext: „For connected repositories we read the file list, individual manifest files such as `package.json` (from which we store only the detected ecosystems) and the JavaScript and TypeScript files …“
  - AVV Anl. 2 Nr. 6 sinngemäß ergänzen.

### P2-05 – niedrig (eindeutig falsch seit P1-03) – Webhook-Zustellprotokolle liegen beim Repo-Webhook nicht in der App-Verwaltung

- **Fundstelle**
  - AVV Anl. 4, GitHub: „… bleiben 3 Tage in der App-Verwaltung bei GitHub einsehbar.“
  - DPA: „in the app settings at GitHub“.
- **Beleg**
  - https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries (abgerufen 2026-09-28): „from the past 3 days“.
  - Repository-Webhooks: „Only people with admin access to a repository can view deliveries“, zu finden unter Repository Settings.
  - App-Webhooks: für den App-Owner.
- **Ersatztext**
  - DE: „… bleiben 3 Tage einsehbar: bei der GitHub App in der App-Verwaltung des Auftragsverarbeiters, beim Repository-Webhook in den Repository-Einstellungen für Personen mit Admin-Rechten am Repository.“
  - EN: „… remain visible for 3 days: for the GitHub App in the Processor's app settings, for a repository webhook in the repository settings to people with admin access to the repository.“

### P2-06 – niedrig – Marker-Hygiene, und V4 reicht weiter als beschrieben

- **1-Tag-Aussagen ohne V1-Markierung.** DSE §3 Absatz 2 („einen Tag lang“) und die DSE-§12-Zeile „für uns 1 Tag einsehbar“ tragen keine V1-Markierung. Auf Hobby gilt 1 Stunde, nicht 1 Tag. P1-01 hatte §12 ausdrücklich genannt. Funktional ist das harmlos, weil der Guard die ganze Seite sperrt. Beim Auflösen von V1 geht es aber leicht unter.
- **30-Tage-Zeile ohne V4-Markierung.** DSE §12, Zeile „Strukturdaten … Löschung spätestens 30 Tage nach der Trennung“, hat keine V4-Markierung, anders als §6.4 und die AVV-Tabelle.
- **Zusatz zu V4 (belegt aus Migrationen, live blocked: tooling).** Der Cron `028_fix_ttl_cleanup_interval.sql:27` löscht alle Zeilen mit **einem** `DELETE`. `finding_suppressions.repository_id` hat keine Kaskade (`037:15`), und der Append-only-Trigger verbietet `DELETE`.
  - Hat auch nur ein deaktiviertes Repo, das älter als 30 Tage ist, einen Dismissal, scheitert die ganze Anweisung.
  - Dann wird **kein** Repo gelöscht.
  - Die 30-Tage-Zusage fällt damit für alle Nutzer, nicht nur für Repos mit Dismissals.
  - V4 in Spec §4 sollte das ausdrücklich abdecken.

### P2-07 – Verdacht, nicht verifiziert – Der Token-Schlüssel und Repo-Abrufe auf dem Arbeitsgerät

- **Fundstellen**
  - AVV Anl. 3 Nr. 1: „GitHub-Zugriffstoken … verschlüsselt (AES-256-GCM, Schlüssel nur in der Laufzeitumgebung)“.
  - Anl. 3 Nr. 2: Die Liste der Zugangsdaten auf dem Arbeitsgerät nennt den Token-Schlüssel nicht.
  - § 12 Abs. 3: „ruft … einzelne Datensätze … ab“.
- **Beleg**
  - `scripts/backfill-ecosystems.ts:28-29,47-91` lädt `.env.local` und löst über `resolveRepoAccessToken` bei OAuth-Repos `decryptToken` aus (`src/lib/repo-auth.ts:65`, Schlüssel `TOKEN_ENCRYPTION_KEY`, `src/lib/crypto.ts:21`).
  - Anschließend holt das Skript Dateibaum und Manifeste des Kunden-Repos **vom Arbeitsgerät aus** bei GitHub.
  - Ob `TOKEN_ENCRYPTION_KEY` tatsächlich in `.env.local` liegt, habe ich nicht eingesehen. Belegt ist nur, dass das Skript dafür gebaut ist.
- **Falls bestätigt, Ersatztext**
  - Anl. 3 Nr. 1, DE: „… Schlüssel als Umgebungsvariable beim Hosting-Anbieter und in der nicht versionierten Datei nach Nr. 2“. EN entsprechend.
  - Anl. 3 Nr. 2: „Token-Schlüssel“ in die Aufzählung aufnehmen.
  - § 12 Abs. 3, DE: „… ruft der Geschäftsführer im Einzelfall einzelne Datensätze oder Repository-Metadaten vom Arbeitsgerät aus ab …“. EN entsprechend.
  - Alternative: `backfill-ecosystems.ts` nur noch für App-Repos zulassen und den Schlüssel nicht lokal halten.

---

## 3. Neu eingeführte Sätze, geprüft und korrekt

- **Repo-Webhook-Anlage per OAuth-Token, nur `pull_request`-Events:** `connect-repository.ts:185-201,236-240`, `github.ts:406`.
- **Suchvektor aus Diff-Auszug, nicht gespeichert:** `rag.ts:198-205,238-267`.
- **Supabase-Logs mit IP und User-Agent, Browser direkt zu Supabase inklusive Realtime:** `supabase/client.ts`, `useDashboardSync.ts`, Migration 038 (Realtime auf `repositories`).
- **`provider_token` im Cookie:** siehe P2-03. Die Tatsache stimmt, nur die Dauer ist unpräzise.
- **Paddle.js lädt beim Seitenaufruf von `cdn.paddle.com`:** `BillingClient.tsx:117-138`, `@paddle/paddle-js` `dist/index.js` → `https://cdn.paddle.com/paddle/v2/paddle.js`.
- **Übertragene Paddle-Daten:** E-Mail nur ohne Kunden-ID, `account_id`/`user_id`, `locale` (`checkout/route.ts:53-59`, `BillingClient.tsx:151-156`).
- **Von Paddle gespeichert:** IDs, Status, Probe- und Periodenende (`paddle-webhook.ts:180-194`; dazu `cancel_at_period_end`, unkritisch).
- **Rechnungen nur live abgerufen:** `billing/invoices/route.ts`.
- **Hinweis-Kommentare, Dublettenprüfung und Thread-Auflösung:** `github.ts:688-790,806-834`. Gelesen werden auch die Reviews (`listPullRequestReviews`, `github.ts:539`), ebenfalls nur für das idempotente Posten; das ist vom Satz gedeckt.
- **Integrationstest mit Credentials:** `private-grants.integration.test.ts`, Migration 038/045.
- **30-Tage-Löschung nach App-Entfernung:** `detachRepositories` setzt `deactivated`, der Cron löscht (V4-Vorbehalt, P2-06).
- **Dismissal-Ledger:** Begründung, Zeitpunkt, Commit, Nutzer; zusätzlich `api_key_id`, `pr_number`, `source` (Migration 037). Das ist gedeckt.
- **Warteliste:** Felder `email`, `locale`, `source` (`landing_hero`/`landing_closing`), IP-Hash `sha256(salt:Tag:ip)`, Rate-Limit 5/h (`waitlist/route.ts`, `signup-*.ts`, `client-ip-hash.ts`). An Brevo gehen nur E-Mail, Template, Redirect-URL und Liste.
- **Clients:**
  - Keine Telemetrie.
  - Keine eigenen Update-Checks. Das `npm i -g @unslop/cli` im Erweiterungs-Dialog startet der Nutzer selbst.
  - Einziger weiterer Netzzugriff ist `git ls-remote` (`shared/src/node/git.ts:100`).
  - Secret-Prüfung über den ganzen Payload (`api-client.ts:48-54`).
  - Die Bezeichnung `cli-<hostname>` steht in der URL (`cli/src/login.ts:35-41`).
- **Keine weiteren KI- oder Tracking-Anbieter:** Ich habe nach openai, anthropic, sentry, posthog, resend und analytics gesucht, ohne Treffer. `next/font/google` wird zur Build-Zeit selbst gehostet.
- **Keine weiteren Cookies und kein weiterer Browser-Speicher:** außer den gelisteten (`cookies()`-/`localStorage`-Suche).
- **Registries:** nur npm, PyPI, crates.io, Hugging Face (`registry-engine.ts:246-249`). Die Namen werden zusätzlich in `prescan_registry_cache` ohne Mandantenbezug gespeichert. Das ist kein Befund.

## 4. DE/EN-Abgleich

Die Tatsachenaussagen sind inhaltlich deckungsgleich, einschließlich AVV §§ 1-17 und der Anlagen 1-4. Die einzige Nuance, „unmittelbar nach der Anmeldung vorübergehend“ gegen „briefly after sign-in“, erledigt sich mit P2-03.

## 5. Ergebnis

Hoch: keine. Mittel: 3 (P2-01, P2-02, P2-03). Niedrig: 3 (P2-04, P2-05, P2-06). Verdacht: 1 (P2-07). Weitere belastbare Befunde habe ich nicht gefunden.
