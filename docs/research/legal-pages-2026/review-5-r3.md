# Review 5: adversariale Prüfung, Runde 3 (Code und Recht), 2026-09-28

Prüfer: Claude (kein Anwalt). Ich habe nur gelesen: `C:\dev\unslop-legal` (HEAD 5fcec5d), keine DB-Abfragen, keine Änderungen.
Gegenstand: alle 10 Dateien unter `docs/legal/`, Schwerpunkt auf den in Runde 2 eingefügten oder geänderten Stellen. Platzhalter und Marker zählen nicht als Befund.

**Selbst abgerufene Primärquellen (2026-09-28):**
- Paddle MSA, gültig ab 08.10.2025, https://www.paddle.com/legal/terms, Ziff. 10.1, 10.2 und 10.4
- Paddle Buyer Terms, 31.03.2026, https://www.paddle.com/legal/checkout-buyer-terms, Ziff. 3, 5, 6 und 15
- Paddle Refund Policy, 31.03.2026, https://www.paddle.com/legal/refund-policy
- § 257 HGB, https://www.gesetze-im-internet.de/hgb/__257.html

**Code:** siehe Datei:Zeile bei den einzelnen Befunden.

---

## Ergebnis in Kürze

- **Hoch:** keine.
- **Mittel:** 2 (R3-01, R3-02).
- **Niedrig, eindeutig falsch oder widersprüchlich:** 5 (R3-03 bis R3-06, R3-08).
- **Verdacht:** 1 (R3-07), wäre mittel, falls bestätigt.

Paddle-Kompatibilität der neuen Ziffern 11.4 und 12.1: **kein Widerspruch.**
- MSA 10.1: „If you agree with the Buyer to issue a refund … you will … inform Paddle of what you have agreed and Paddle will make the relevant refund.“ Eine anteilige Erstattung, die unslop zusagt und über Paddle veranlasst, ist damit vorgesehen. Die Kosten trägt unslop nach MSA 10.4.
- Buyer Terms Ziff. 5 (iii): Paddle darf beenden, wenn „the Supplier modifies, suspends or discontinues your access“.
- Die Kündigung per API ist im Code schon vorhanden: `src/app/api/billing/subscription/cancel/route.ts:31-33`, `subscriptions.cancel(..., { effectiveFrom: 'next_billing_period' })`.

---

## R3-01 (mittel): Beendet unslop den Vertrag, läuft das bezahlte Abo weiter, und es gibt keine Erstattung

**Fundstellen:**
- Terms 11.4 greift nur, wenn „**Sie**“ beenden (DE und EN).
- Terms 17.2 S. 6: „beide Seiten können den Vertrag dann zum Zeitpunkt des Inkrafttretens kündigen“.
- AVV/DPA § 16 Abs. 1 S. 2: „beide Parteien können den Hauptvertrag dann zum geplanten Zeitpunkt kündigen“.
- Terms 12.2 S. 2: Kündigung aus wichtigem Grund durch beide Seiten.
- Terms 17.1 S. 3: „beide Seiten können den Vertrag dann **nach Ziffer 11 und 12** beenden“.

**Problem:**
1. Terms 12.2 S. 1 lässt eine ordentliche Kündigung durch uns nur zu, wenn kein bezahltes Abo läuft. 17.2 und AVV § 16 Abs. 1 geben uns aber ein Kündigungsrecht auch bei laufendem Jahresabo.
2. Kündigen wir so, gilt 11.4 nicht. Das Abo bei Paddle verlängert sich weiter. Nach Buyer Terms Ziff. 5 bleibt der Käufer bei einer Beendigung für die bis dahin fälligen Beträge haftbar. Eine automatische Erstattung gibt es nicht.
3. Dasselbe gilt, wenn wir aus einem wichtigen Grund kündigen, den der Kunde nicht zu vertreten hat, etwa weil wir den Dienst einstellen.
4. Das ist genau die Lücke, die J2-03 für die Kündigung durch den Kunden geschlossen hat, nur spiegelbildlich. Rechtsgrundlage ist § 307 Abs. 1 und 2 BGB, dazu das Leitbild der Rückgewähr vorausbezahlter Entgelte (§§ 547, 628 Abs. 1 S. 3 BGB; wie in Runde 2 nicht selbst abgerufen).
5. Zusätzlich widerspricht 17.1 der Ziffer 11.4:
   - 11.4 nennt „Ziffer 17“ als Fall mit sofortiger Kündigung und anteiliger Erstattung.
   - 17.1 verweist für die Beendigung aber auf Ziffer 11 und 12, und nach 12.1 endet der Vertrag erst zum Periodenende, ohne Erstattung.
   - Nach § 305c Abs. 2 BGB geht das zulasten von unslop. Transparent ist es nicht.
6. Refund §4 („Sie beenden den Vertrag nach Ziffer 11.4“) behandelt 11.4 als Kündigungsgrund. 11.4 regelt aber nur Folgen.

**Ersatztext Terms 11.4:**
- DE: „11.4 Endet der Nutzungsvertrag vor dem Ende einer bezahlten Abrechnungsperiode, weil Sie ihn nach Ziffer 9.2, 9.3 oder 17, nach § 7 Abs. 3 oder 5 oder § 16 Abs. 1 unseres Auftragsverarbeitungsvertrags oder aus einem wichtigen Grund beenden, den wir zu vertreten haben, oder weil wir ihn nach Ziffer 17.2 oder § 16 Abs. 1 unseres Auftragsverarbeitungsvertrags oder aus einem wichtigen Grund beenden, den Sie nicht zu vertreten haben, kündigen wir Ihr Abonnement bei Paddle zum selben Zeitpunkt und veranlassen über Paddle die anteilige Erstattung bereits bezahlter Zeiträume nach diesem Zeitpunkt. [VORBEDINGUNG V9: Kündigung über die Paddle-API umgesetzt]“
- EN: „11.4 If the usage contract ends before the end of a paid billing period because you end it under section 9.2, 9.3 or 17, under § 7(3) or (5) or § 16(1) of our data processing agreement or for good cause for which we are responsible, or because we end it under section 17.2 or § 16(1) of our data processing agreement or for good cause for which you are not responsible, we cancel your subscription with Paddle as of the same date and arrange, through Paddle, a pro-rata refund of periods already paid after that date. [VORBEDINGUNG V9: Kündigung über die Paddle-API umgesetzt]“

**Ersatztext Terms 17.1 S. 3:**
- DE: „Stimmen Sie nicht zu, gelten die bisherigen Bedingungen weiter; Sie können den Vertrag dann nach Ziffer 12.1 beenden, wir nach Ziffer 12.2.“
- EN: „If you do not agree, the previous terms continue to apply; you may then end the contract under section 12.1, and we under section 12.2.“

Dann „oder 17“ in 11.4 zu „oder 17.2“ ändern (DE und EN).

**Ersatztext Refund §4, letzter Satz:**
- DE: „… es sei denn, Abschnitt 2, 3 oder 6 greift, es liegt ein Fall der Ziffer 11.4 unserer Nutzungsbedingungen vor, oder Paddle erstattet nach seinem Ermessen.“
- EN: „… unless section 2, 3 or 6 applies, a case under section 11.4 of our Terms of Service applies, or Paddle grants a refund at its discretion.“

---

## R3-02 (mittel): Ziffer 12.1 macht aus einem Löschantrag eine Kündigung zum Periodenende

**Fundstellen:** Terms 12.1 und 18.2, DE und EN.

**Problem:**
1. Nach 12.1 S. 1 beendet man den Vertrag, indem man „um Löschung Ihres Kontos bitte[t]“. Nach S. 2 endet der Vertrag bei laufendem Abo aber erst zum Periodenende, „es sei denn, Sie verlangen die sofortige Löschung“.
   - Die Erklärung, die den Vertrag beendet, ist also selbst schon eine Bitte um Löschung. Ob sie eine „sofortige“ Löschung ist, bleibt offen (§ 305c Abs. 2, § 307 Abs. 1 S. 2 BGB).
   - Bei einem Jahresabo kann das bedeuten, dass das Konto trotz ausdrücklicher Löschbitte noch bis zu einem Jahr bestehen bleibt. Das steht in Spannung zu Art. 17 Abs. 1 DSGVO („unverzüglich“).
2. Terms 18.2 verspricht „jederzeit ohne Frist“. Nach 12.1 ist mit Abo das Periodenende der Normalfall.

**Ersatztext Terms 12.1:**
- DE: „12.1 Sie können den Nutzungsvertrag jederzeit per E-Mail an uns beenden. [ODER, NACH UMSETZUNG: oder im Dashboard.] Haben Sie ein laufendes Abonnement, kündigen wir es mit Ihrer Erklärung bei Paddle zum Ende der laufenden Abrechnungsperiode; der Nutzungsvertrag endet dann zu diesem Zeitpunkt, und bis dahin können Sie den Dienst weiter nutzen. Verlangen Sie die sofortige Beendigung oder die Löschung Ihres Kontos, endet der Nutzungsvertrag sofort, und wir löschen Ihr Konto nach unserer Datenschutzerklärung; für den Rest der laufenden Periode gibt es dann keine anteilige Erstattung (Erstattungsrichtlinie Abschnitt 4). [VORBEDINGUNG V9: Kündigung über die Paddle-API umgesetzt]“
- EN: „12.1 You can end the usage contract at any time by email to us. [ODER, NACH UMSETZUNG: or in the dashboard.] If you have a running subscription, we cancel it with Paddle upon your declaration as of the end of the current billing period; the usage contract then ends at that time, and you can keep using the Service until then. If you ask for immediate termination or for deletion of your account, the usage contract ends immediately and we delete your account as described in our Privacy Policy; there is then no pro-rata refund for the rest of the current period (Refund Policy section 4). [VORBEDINGUNG V9: Kündigung über die Paddle-API umgesetzt]“

**Ersatztext Terms 18.2, letzter Satz:**
- DE: „Sie können den Nutzungsvertrag jederzeit und ohne Angabe von Gründen beenden, auf Wunsch mit sofortiger Wirkung (Ziffer 12.1; ein laufendes Abonnement kündigen wir dabei mit).“
- EN: „You can end the usage contract at any time without giving reasons, with immediate effect if you wish (section 12.1; we cancel a running subscription at the same time).“

---

## R3-03 (niedrig, eindeutig falsch im Hauptfall): Beim OAuth-Pfad steht der Review bei eigenen PRs nur als Kommentar, nicht als „Changes requested“

**Fundstellen:** DSE §6.1 („Repository-Anbindung ohne GitHub App“), §6.2 (Klammer „als Review mit angeforderten Änderungen“), AVV/DPA Anlage 2 Nr. 5. DE und EN.

**Beleg:**
- `src/lib/pipeline/steps/github-reporter-step.ts:119-150`: Im OAuth-Modus wird zuerst `REQUEST_CHANGES` versucht. GitHub antwortet mit 422 „Can not request changes on your own pull request“. Dann folgt ein Fallback auf `'COMMENT'`.
- Wer mit dem eigenen Token den eigenen PR prüfen lässt, also der typische Solo-Fall, bekommt deshalb keinen „Changes requested“-Review.
- Ohne Findings gibt es gar keinen Review, sondern nur einen Kommentar (`:38-42`, `postApprovalComment`).

**Ersatztext DSE §6.1:**
- DE: „… Sie erscheinen dort unter Ihrem GitHub-Benutzernamen statt als Check Run: bei Hinweisen als Review mit angeforderten Änderungen („Changes requested“), bei Ihren eigenen Pull Requests als einfacher Review-Kommentar, weil GitHub dort keine Änderungsanforderung zulässt; auch Hinweis-Kommentare und das Schließen von Diskussionen laufen dann unter Ihrem Namen.“
- EN: „… They appear there under your GitHub username instead of as a check run: where there are findings, as a review requesting changes, or, on your own pull requests, as a plain review comment because GitHub does not allow requesting changes there; notice comments and resolving discussions then also happen under your name.“

**Ersatztext DSE §6.2, Klammer:**
- DE: „(bei der Repository-Anbindung ohne GitHub App als Review unter Ihrem Namen, Abschnitt 6.1)“
- EN: „(for a repository connected without the GitHub App, as a review under your name, section 6.1)“

**Ersatztext AVV Anlage 2 Nr. 5:**
- DE: „(beim Repository-Webhook stattdessen als Review unter dem GitHub-Konto des Nutzers, der Änderungen anfordert oder, bei eigenen Pull Requests des Nutzers, nur kommentiert)“
- EN: „(for a repository webhook instead as a review under the user's GitHub account that requests changes or, on the user's own pull requests, only comments)“

---

## R3-04 (niedrig, eindeutig falsch, nur EN): Terms 3.4 nennt die Schaltfläche anders, als sie heißt

**Fundstelle:** terms.en.md:35: „You click "Sign in with GitHub"“.

**Beleg:** `messages/en.json:17` lautet `"loginWithGitHub": "Login with GitHub"`. DE stimmt: `messages/de.json:17` lautet „Mit GitHub anmelden“.

**Warum es zählt:** Art. 246c Nr. 1 EGBGB verlangt die Angabe der „technischen Schritte“. Eine falsche Beschriftung ist dafür ungenau.

**Ersatz:**
- EN: „You click "Login with GitHub" …“
- Alternativ die UI-Beschriftung auf „Sign in with GitHub“ ändern; dann den Terms-Satz lassen.
- DE bleibt unverändert.

---

## R3-05 (niedrig, widersprüchlich): Terms 3.4 nennt zwei Vertragssprachen, Ziffer 20 lässt nur die deutsche gelten

**Fundstelle:** Terms 3.4: „Vertragssprachen sind Deutsch und Englisch (Ziffer 20)“. Ziffer 20: „Die englische Fassung dient der Information. Bei Abweichungen gilt die deutsche Fassung.“ EN gleich.

**Problem:** „Vertragssprache“ heißt maßgebliche Sprache. Die Angabe nach Art. 246c Nr. 4 EGBGB („die für den Vertragsschluss zur Verfügung stehenden Sprachen“) passt deshalb nicht zu Ziffer 20.

**Ersatz:**
- DE: „Den Vertrag können Sie auf Deutsch oder Englisch schließen; maßgeblich ist die deutsche Fassung (Ziffer 20).“
- EN: „You can conclude the contract in German or English; the German version is authoritative (section 20).“

---

## R3-06 (niedrig, Marker-Lücke): AVV/DPA § 4 enthält die weitestgehende Zusage ohne V20-Marker

**Fundstelle:** avv.de.md:37 und dpa.en.md § 4: „nicht für eigene Zwecke, insbesondere nicht … für Benchmarks oder zur Verbesserung von Prüfregeln“.

**Beleg:**
- `docs/specs/SPEC.md:481` (G2: „at least 10 come from live diffs“) ist unverändert.
- `src/lib/telemetry/llm-call-log.ts:43` lautet: „Vollständige Verdicts … Audit-Grundlage für False Refutations“.
- Terms 7.3 und 18.2 sowie DSE §2 tragen den V20-Marker, die AVV an der entscheidenden Stelle nicht.
- Weil V20 zu Stufe A gehört und die AVV zu Stufe C, ist das nur Hygiene. Der Guard würde die AVV aber nicht aufhalten, wenn V20 übersprungen wird.

**Ersatz:** an avv.de.md § 4 und dpa.en.md § 4 jeweils anhängen:
„[VORBEDINGUNG V20: keine Auswertung von Kundendaten außerhalb des einzelnen Auftrags; SPEC §12.4 G2 auf eigene Repos, OSS oder Opt-in umgestellt; Verdict-Audit auf Fehleranalyse des einzelnen Auftrags beschränkt]“

---

## R3-07 (Verdacht, mittel, falls bestätigt): Der dokumentierte Betriebsweg schickt Auftragsdaten an einen nicht genannten Dienstleister und speichert sie dauerhaft auf dem Arbeitsgerät

**Fundstellen:**
- AVV/DPA § 12 Abs. 3 (neu): „ruft … einzelne Datensätze … vom Arbeitsgerät aus ab, ohne sie dort dauerhaft zu speichern“
- Anlage 3 Nr. 2: „Auftragsdaten werden auf dem Arbeitsgerät nicht dauerhaft gespeichert“
- Anlage 4: keine Liste von KI-Dienstleistern außer Google

**Beleg:**
- `scripts/db-query.ts:1-60` liest mit Service-Role jede Tabelle, standardmäßig `--columns '*'`. Das schließt `review_jobs` mit Diffs und Findings ein.
- Die Projekt-`CLAUDE.md` in `C:\dev\unslop` schreibt Coding-Agents (Claude Code) genau dieses Skript für die Live-Verifikation vor.
- Die Ausgabe landet damit (a) im Kontext eines Anthropic-Modells, also bei einem Dienstleister, der weder in Anlage 4 noch in DSE §11 steht, und (b) in den lokalen Sitzungsprotokollen des Agents (`~/.claude/projects/…`), also dauerhaft auf dem Arbeitsgerät.

**Nicht verifiziert:** Ob solche Abfragen jemals Daten fremder Kunden enthielten. Bisher sind es belegt nur Test-Repos wie `unslopai/test`.

**Korrektur**, eine der beiden Varianten:
- **(a) Neue Vorbedingung V21 (Stufe A):** `db-query.ts` für Tabellen mit Auftragsdaten auf Zähl- und ID-/Status-Spalten beschränken, per Allowlist und ohne `*` für `review_jobs`, `review_job_llm_calls`, `code_chunks`, `finding_*`. Dazu eine Betriebsregel: keine Auftragsdaten in KI-Agent-Sitzungen. Die AVV-Sätze bleiben dann stehen.
- **(b) Offenlegen:** Anthropic als Unterauftragsverarbeiter in Anlage 4 und DSE §11 aufnehmen, mit DPA, Ort, Übermittlungsgrundlage und Aufbewahrung. Die Sätze in § 12 Abs. 3 und Anlage 3 Nr. 2 dann anpassen, DE: „… ohne sie dort über die Fehleranalyse hinaus zu speichern“.

---

## R3-08 (niedrig, Spec-Lücke): V9 deckt nicht ab, was 11.4 und 12.1 versprechen

**Fundstelle:** Spec §4 V9: „Kündigungsbutton … Kündigung über Paddle-API | E2E gegen Paddle-Sandbox“. Die Marker in Terms 11.4 und 12.1 verweisen auf V9.

**Problem:**
- 11.4 verlangt eine Kündigung zum Beendigungszeitpunkt (Paddle `effective_from: immediately`, ausgelöst am Stichtag) und eine anteilige Erstattung über eine Paddle-Adjustment/Refund-Anfrage nach MSA 10.1.
- 12.1 verlangt, dass eine Beendigung oder Kontolöschung die Abo-Kündigung auslöst.
- Der Code kann heute nur zum Periodenende kündigen (`cancel/route.ts:31-33`). V9 ist als Button-Paket beschrieben, sein Receipt beweist die beiden anderen Wege nicht.

**Ersatz Spec §4, V9:** „Kündigungsbutton … ohne Login …; **zusätzlich** (a) Kündigung zum Periodenende bei Beendigung des Nutzungsvertrags/Kontolöschung (Terms 12.1), (b) sofortige Kündigung und anteilige Erstattung über Paddle in den Fällen der Terms 11.4 | Receipt: E2E gegen Paddle-Sandbox für Button, (a) und (b)“.

---

## Geprüft ohne belastbaren Befund

- **Terms 3.4:**
  - Übrige Angaben nach Art. 246c: Speicherung, Korrektur, Kodizes und Zugangsbestätigung mit V12-Marker sind vollständig.
  - DE-Button „Mit GitHub anmelden“ stimmt (`messages/de.json:17`).
- **Terms 7.3:** Die Aussage zu KI-Anbietern ist durch die Google-Training-Restriction gedeckt, V20-Marker gesetzt.
- **Terms 18.1:**
  - Das gesetzliche Widerrufsrecht besteht gegenüber Paddle, passend zu Buyer Terms Ziff. 15 und Refund Policy („14-day statutory right“).
  - Die Widerrufsfunktion im Paddle-Portal ist in r4 (Refund Policy 3.1.1) belegt.
  - Die paddle.net-Alternative steht in Buyer Terms Ziff. 6.
- **Refund §3:** Schweiz und neue 14-Tage-Frist nach der Probezeit stehen wörtlich in der Paddle Refund Policy.
- **Refund §4:** Querverweis auf 11.4 korrekt (Formulierung siehe R3-01).
- **Querverweise:** AVV § 7 Abs. 3 → Terms 11.4, Refund §3 → Terms 18, Refund §8 → Terms 12.3, Terms 18.1 → 18.2 und Terms 3.4 → 20 existieren und passen inhaltlich (Ausnahme R3-05).
- **DSE §4, Token-Cookie:** `@supabase/ssr` maxAge 400 Tage und Entfernen erst beim Refresh wie in Runde 2 belegt. `unslop_locale` 1 Jahr (`src/i18n/set-locale-action.ts:25`).
- **DSE §6.1:**
  - `next.config.*`, Dateiliste und Manifeste wie in Runde 2 belegt.
  - Der Webhook-Pfad unter Nutzername stimmt (Einschränkung siehe R3-03).
- **DSE §6.2:** Kommentare nur zur Dublettenvermeidung lesen und Diskussion schließen: belegt.
- **DSE §12:** § 257 Abs. 4 HGB: 10 Jahre für Bücher und Abschlüsse, 8 Jahre für Buchungsbelege, 6 Jahre für Handelsbriefe; so selbst abgerufen, korrekt.
- **AVV § 14 Abs. 3:** jetzt ohne falschen Anlagenverweis.
- **AVV Anlage 2:**
  - Nr. 1 und Nr. 6 stimmen mit dem Code überein.
  - Log-Zeile: `rag.ts:198-199` loggt `substring(0, 100)`. „Bei jeder Prüfung“ ist leicht zu weit, weil der Aufruf nur mit verbundenem Repo oder Ökosystem-Gate kommt (`rag.ts:194`). Das ist konservativ und kein Befund.
- **AVV Anlage 3:**
  - Nr. 1: AES-256-GCM (`src/lib/crypto.ts:10`) und SHA-256 (`src/lib/api-keys.ts:37`) stimmen.
  - Nr. 2: Die Revoke-Liste in Migration 038 deckt alle Tabellen mit Auftragsdaten ab. `billing_customers` fehlt dort, enthält aber keine Auftragsdaten.
- **AVV Anlage 4, GitHub:** 3 Tage sowie App-Verwaltung bzw. Repo-Einstellungen wie in Runde 2 an der GitHub-Doku belegt.
- **DE/EN:** Alle neuen Stellen habe ich satzweise verglichen. Außer R3-04 gibt es keine inhaltlichen Abweichungen.
