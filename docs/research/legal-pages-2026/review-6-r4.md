# Review 6: adversariale Prüfung, Runde 4 (Code und Recht), 2026-09-28

Prüfer: Claude (kein Anwalt). Ich habe nur gelesen: `C:\dev\unslop-legal` (HEAD 9a19055), ohne DB-Abfragen und ohne Änderungen.
Gegenstand: die 10 Dateien unter `docs/legal/`. Schwerpunkt waren die Stellen, die in Runde 3 geändert wurden. Danach habe ich alle Dateien noch einmal ganz gelesen. Platzhalter und Marker zählen nicht als Befund.

## Ergebnis in Kürze

- **Hoch:** keine.
- **Mittel:** 1 (R4-01, betrifft Spec und Marker, nicht den veröffentlichten Text).
- **Niedrig, eindeutig widersprüchlich oder falsch:** 3 (R4-02 bis R4-04).
- Alle Umsetzungen aus Runde 3 (R3-01 bis R3-08) sind korrekt eingearbeitet. DE und EN stimmen dort überein.

---

## R4-01 (mittel): V21 deckt nur `db-query.ts` ab, der Marker verspricht aber „keine Auftragsdaten in KI-gestützten Arbeitssitzungen“

**Fundstellen:**
- AVV/DPA § 12 Abs. 3 und Anlage 3 Nr. 2, jeweils mit dem Marker `[VORBEDINGUNG V21: … keine Auftragsdaten in KI-gestützten Arbeitssitzungen]`.
- Spec §4 V21: „`scripts/db-query.ts` verweigert … ; CLAUDE.md-Workaround entsprechend angepasst | Test des Skripts“.

**Problem:** Das Skript ist nur einer von mehreren Wegen, auf denen Auftragsdaten in eine Claude-Code-Sitzung gelangen. Diese Wege sind aktiv oder vorgesehen:

1. **Supabase-MCP `execute_sql`.** Die Projekt-`CLAUDE.md` nennt ihn als *primären* Weg (Z. 14: „Query it with the Supabase MCP: `execute_sql`“). `db-query.ts` ist nur der Workaround, solange der MCP ausfällt (Z. 16). Sobald Supabase den Rechte-Bug behebt, liest der Agent `review_jobs` wieder uneingeschränkt, und die Allowlist aus V21 greift dort nicht. Dasselbe gilt für `query_logs`.
2. **Vercel-MCP `get_runtime_logs`.** Die Laufzeitprotokolle enthalten nach AVV Anlage 2 selbst „bei jeder Prüfung einen Auszug von bis zu 100 Zeichen aus der aus dem Diff gebildeten Suchanfrage“ und „im Fehlerfall kurze Ausschnitte der Modellantwort“. Sie sind damit Auftragsdaten. Das Auslesen dieser Logs gehört zur dokumentierten Arbeitsweise:
   - `docs/ROADMAP_ARCHIVE.md:410` („Watch `[Memory]` lines in the Vercel runtime logs“)
   - `docs/specs/DEADLINE_GUARD_SPEC.md:123` (Messung der Reserve aus Prod-Logs)

Ist V21 so erfüllt, wie die Spec es beschreibt (Receipt: Test des Skripts), bleibt die Zusage im Marker für diese beiden Wege unwahr. Die Folgen sind dieselben wie bei R3-07:
- Anthropic wird zu einem nicht offengelegten Empfänger.
- Die Daten bleiben dauerhaft in den Sitzungsprotokollen unter `~/.claude/projects/…`.
- Das widerspricht AVV § 5 Abs. 1 („Zugriff … nur der Geschäftsführer“), § 12 Abs. 3 und Anlage 3 Nr. 2.

**Ersatz Spec §4, Zeile V21:**
„E23a umgesetzt, und zwar für **jeden** Weg, auf dem ein KI-Agent Live-Daten liest: (a) `scripts/db-query.ts` verweigert für `review_jobs`, `review_job_llm_calls`, `code_chunks` und `finding_*` alles außer Kennungen, Status, Zeitstempeln und Zählern; (b) Betriebsregel in `CLAUDE.md` (nicht nur im Workaround-Absatz): Supabase-MCP `execute_sql` auf diesen Tabellen nur mit expliziter Spaltenliste aus derselben Allowlist, kein `select *`; `query_logs` (Supabase) und `get_runtime_logs` (Vercel) nur für Zeiträume und Deployments ohne Kundenaufträge oder gefiltert auf Zeilen ohne Diff- und Modellausschnitte, sonst im Browser-Dashboard statt im Agenten; (c) ab dem ersten fremden Kunden Log-Zeilen mit Diff-Auszug (`rag.ts`) und Modellausschnitt (Fehlerpfad) hinter ein Debug-Flag | A (vor dem ersten fremden Kunden) | Claude | Test des Skripts + CLAUDE.md-Diff + grep auf die beiden Log-Stellen“

**Marker in avv.de.md und dpa.en.md** (§ 12 Abs. 3 und Anlage 3 Nr. 2). Die Marker sind in beiden Sprachfassungen deutsch; der neue Wortlaut lautet:
„[VORBEDINGUNG V21: Abfragen von Auftragsdaten vom Arbeitsgerät auf Kennungen, Status, Zeitstempel und Zähler beschränkt, über Skript, Supabase-MCP und Vercel-MCP; keine Auftragsdaten in KI-gestützten Arbeitssitzungen]“

Die Alternative (b) aus E23 bleibt möglich: Anthropic offenlegen. Dann entfällt der Marker, und die Sätze in § 12 Abs. 3 und Anlage 3 Nr. 2 ändern sich wie in R3-07 (b) beschrieben.

---

## R4-02 (niedrig, widersprüchlich): AVV § 7 Abs. 3 und 5 erlauben eine Teilkündigung „für die betroffene Leistung“, Terms 11.4 setzt aber voraus, dass der ganze Nutzungsvertrag endet

**Fundstellen:**
- AVV § 7 Abs. 3 S. 4: „… kann der Verantwortliche den Hauptvertrag für die betroffene Leistung außerordentlich kündigen; es gilt Ziffer 11.4 der Nutzungsbedingungen.“
- AVV § 7 Abs. 5 S. 3: dieselbe Wendung.
- Terms 11.4 greift nur, wenn „der Nutzungsvertrag … endet“.

DPA und Terms EN lauten entsprechend: „for the affected service“ und „If the usage contract ends“.

**Problem:**
- Die Nutzungsbedingungen kennen keine Teilleistungen. Es gibt ein Konto und ein Abonnement pro Konto.
- Kündigt der Kunde nur „für die betroffene Leistung“, endet der Nutzungsvertrag nicht. 11.4 greift dann nach seinem Wortlaut nicht, obwohl § 7 Abs. 3 ausdrücklich darauf verweist.
- Offen bleibt, was mit dem Abonnement und einer Erstattung geschieht. Nach § 305c Abs. 2 BGB geht das zulasten von unslop, und transparent im Sinne von § 307 Abs. 1 S. 2 BGB ist es nicht.
- Praktisch betrifft ein Wechsel des Unterauftragsverarbeiters (Vertex, Supabase, Vercel) ohnehin den ganzen Dienst.

**Ersatz AVV § 7 Abs. 3 S. 4:**
- DE: „Gelingt das nicht, kann der Verantwortliche den Hauptvertrag außerordentlich kündigen; es gilt Ziffer 11.4 der Nutzungsbedingungen.“
- EN: „If none is found, the Controller may terminate the Main Agreement for cause; section 11.4 of the Terms of Service applies.“

**Ersatz AVV § 7 Abs. 5 S. 3:**
- DE: „… lässt sich keine Lösung finden, kann er den Hauptvertrag außerordentlich kündigen; es gilt Ziffer 11.4 der Nutzungsbedingungen.“
- EN: „… if no solution is found, it may terminate the Main Agreement for cause; section 11.4 of the Terms of Service applies.“

---

## R4-03 (niedrig, eindeutig unvollständig wegen „nur“): Gelesen werden auch die eigenen Review-Kommentare, und zwar für die spätere Auflösung

**Fundstellen:**
- DSE §6.2: „Vorhandene Kommentare im Pull Request lesen wir nur, um keine Hinweise doppelt zu posten.“
- EN: „We read existing comments on the pull request only to avoid posting findings twice.“
- AVV/DPA Anlage 2 Nr. 5: „Lesen vorhandener Kommentare im Pull Request nur zur Vermeidung doppelter Hinweise“.

**Beleg:**
- `src/lib/pipeline/steps/github-reporter-step.ts:228-247` (`loadPostedCommentIds`) liest nach jedem Review mit Findings dessen Inline-Kommentare zurück (`fetchReviewComments`). Daraus baut der Code die Zuordnung Finding → Kommentar-ID und speichert sie in `finding_comments` (`:170-218`). Zweck: `unslop_resolve_finding` soll den Thread später schließen können. Das ist ein zweiter Zweck.
- `src/lib/pipeline/review-posting.ts:73-81` liest bei einem 5xx außerdem alle Reviews des PR. Das dient der Dublettenvermeidung und ist durch den bisherigen Satz gedeckt.

**Ersatz DSE §6.2:**
- DE: „Vorhandene Kommentare und Reviews im Pull Request lesen wir nur, um keine Hinweise doppelt zu posten und um unsere eigenen Hinweise später der richtigen Diskussion zuordnen und sie schließen zu können.“
- EN: „We read existing comments and reviews on the pull request only to avoid posting findings twice and to link our own findings to their discussion so that we can resolve it later.“

**Ersatz AVV Anlage 2 Nr. 5:**
- DE: „Lesen vorhandener Kommentare und Reviews im Pull Request nur zur Vermeidung doppelter Hinweise und zur Zuordnung der eigenen Hinweise zu ihrer Diskussion; Schließen der Diskussion zu einem als erledigt markierten Hinweis;“
- EN: „reading existing pull request comments and reviews only to avoid duplicate findings and to link the Processor's own findings to their discussion; resolving the discussion of a finding marked as resolved;“

---

## R4-04 (niedrig, Spec-Lücke): Der Paritätstest in Spec §7 würde an den Entwürfen scheitern

**Fundstelle:** Spec §7, `legal-content-parity.test.ts`: „DE und EN je Text haben … dieselben Platzhalter“.

**Beleg:** Einige Marker haben absichtlich übersetzten Inhalt. Ein Vergleich der Zeichenketten ergibt Abweichungen in drei Paaren:
- DSE/Privacy: 2× `[OPTIONAL, NUR SOLANGE DER ROLLBACK-PFAD EXISTIERT: …]`
- AVV/DPA: 2× OPTIONAL, 1× `[SICHERUNGSKOPIEN: …]`
- Terms: 1× `[ODER, NACH UMSETZUNG: …]`

Ein Test, der wie spezifiziert gebaut wird, schlägt fehl. Ein Test, der auf die Entwürfe angepasst wird, prüft stillschweigend weniger.

**Ersatz Spec §7, Zeile Paritätstest:**
„DE und EN je Text haben dieselbe Zahl an Abschnitten (`##`) und dieselben Platzhalter, verglichen am Schlüssel vor dem ersten Doppelpunkt (z. B. `VORBEDINGUNG V21`, `OPTIONAL, NUR SOLANGE DER ROLLBACK-PFAD EXISTIERT`), in derselben Reihenfolge und Anzahl“

---

## Geprüft ohne belastbaren Befund

**Terms 3.4:**
- Der Button heißt in DE „Mit GitHub anmelden“ (`messages/de.json:17`) und in EN „Login with GitHub“ (`messages/en.json:17`, gerendert in `src/app/login/GitHubLoginButton.tsx:53`).
- Sprachen: „Den Vertrag können Sie auf Deutsch oder Englisch schließen; maßgeblich ist die deutsche Fassung (Ziffer 20)“ passt zu Ziffer 20. Damit sind Art. 246c Nr. 4 EGBGB und die Sprachvorrangregel vereinbar.

**Terms 11.4:**
- Die Fälle stimmen mit ihren Quellen überein: 9.2 (§ 327r), 9.3, 17.2 (Widerspruch des Unternehmers, beide Seiten), AVV § 7 Abs. 3/5 und § 16 Abs. 1 (beide Seiten) sowie der wichtige Grund, spiegelbildlich nach Verantwortung.
- AVV § 7 Abs. 3 verweist zurück auf 11.4. Einschränkung dazu: R4-02.
- Bei einer Beendigung durch unslop aus einem Grund, den der Kunde zu vertreten hat, gibt es keine Erstattung von unslop. Das ist unbedenklich: Der Nutzungsvertrag ist unentgeltlich (18.2). Das Entgelt schuldet der Kunde aus dem Kaufvertrag mit Paddle. Seine gesetzlichen Ansprüche gegen Paddle bleiben unberührt, und Refund §1 sagt das ausdrücklich („schränkt keine Rechte ein …, günstigste Regel“).

**Terms 12.1 (AGB-Kontrolle, §§ 307, 308 Nr. 7, 309 Nr. 5/6, 327 ff. BGB): haltbar.**
- Der Normalfall ist die Beendigung zum Periodenende mit Weiternutzung. Sofortige Beendigung oder Kontolöschung wählt der Kunde selbst.
- Der Verzicht auf den Rest der Periode ist keine Vertragsstrafe und kein pauschalierter Schadensersatz. Er ist die Folge der eigenen Wahl. Die Gegenleistung liegt im Paddle-Vertrag; wird die Leistung vom Kunden aus unmöglich, gilt der Rechtsgedanke des § 326 Abs. 2 BGB.
- Das Abo wird auch im Sofortfall zum Periodenende gekündigt (S. 2 gilt für beide Varianten). Es wird also nichts weiter abgebucht.
- Der Verweis auf Refund §4 zieht dessen Ausnahmen mit, insbesondere die 14-Tage-Zusage nach §2.
- Art. 17 und Art. 12 Abs. 5 DSGVO: Die Löschung selbst ist kostenlos. Verloren geht nur eine vorausbezahlte Leistung, die nach der Löschung nicht mehr erbracht werden kann.
- Gegenüber Unternehmern mit AVV ist die Löschbitte eine Weisung und steht nicht im Konflikt mit dem Exportfenster in AVV § 14 Abs. 1.

**Terms 17.1 und 18.2:** Die Verweise auf 12.1/12.2 sind konsistent. 12.2 schließt eine ordentliche Kündigung durch uns bei laufendem Abo aus, und 11.4 deckt die verbleibenden Fälle ab.
- EN 18.2 „we cancel a running subscription at the same time“ ist etwas weniger klar als DE „kündigen wir dabei mit“. Der Klammerverweis auf 12.1 und Ziffer 20 lösen das auf. Kein Befund.

**Refund §4:** Die Wendung „es liegt ein Fall der Ziffer 11.4 … vor“ ist korrekt, und der Rückverweis aus Terms 12.1 passt.

**DSE §6.1 und §6.2, AVV Anlage 2 Nr. 5 (OAuth-Pfad):**
- Der Text stimmt mit dem Code überein: `github-reporter-step.ts:125-157` versucht `REQUEST_CHANGES` und fällt bei 422 „your own pull request“ auf `COMMENT` zurück. Im App-Modus gibt es immer `COMMENT` plus Check Run (`:106-113`).
- Ohne Findings wird ein `COMMENT`-Review gepostet (`:249-265`). Der Text behauptet für diesen Fall nichts Gegenteiliges.
- Neuer idempotenter Pfad (`review-posting.ts`): Er erzeugt keine neuen Datenflüsse, abgesehen von dem in R4-03 genannten Lesezugriff.

**AVV § 4:** Der V20-Marker ist gesetzt, DE und EN sind gleich.

**AVV § 12 Abs. 3 und Anlage 3 Nr. 2:** Die Sätze selbst stimmen, sobald V21 vollständig erfüllt ist (siehe R4-01).

**Querverweise:** Alle Querverweise sind vorhanden und passen inhaltlich (Einschränkung zu AVV § 7 Abs. 3: siehe R4-02):
- Terms 11.4 → AVV § 7 Abs. 3/5 und § 16 Abs. 1
- AVV § 7 Abs. 3 → Terms 11.4
- Terms 12.1 → Refund §4
- Terms 17.1 → 12.1/12.2
- Terms 18.1 → 18.2
- Terms 18.2 → 12.1
- Refund §3 → Terms 18
- Refund §8 → Terms 12.3
- Terms 3.4 → 20

**DE/EN:**
- Die Zahl der Abschnitte ist in allen fünf Paaren gleich (21/21, 22/22, 10/10, 21/21, 6/6), ebenso die Zahl der Marker (30/30, 15/15, 2/2, 30/30, 4/4).
- Die geänderten Stellen habe ich Satz für Satz verglichen und keine inhaltliche Abweichung gefunden.

**Gesamtdurchgang Impressum, DSE §§ 1–5 und 7–16, Terms 1–10 und 13–22, Refund §§ 1–3 und 5–10, AVV §§ 1–3, 5–6, 8–11, 13–17 sowie Anlagen 1, 4:** Gegenüber den Runden 1 bis 3 ist nichts Neues aufgefallen, und keine der dort übernommenen Korrekturen ist beschädigt.
