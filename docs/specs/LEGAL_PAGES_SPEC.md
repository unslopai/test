# LEGAL_PAGES_SPEC.md — Impressum, Datenschutzerklärung, Nutzungsbedingungen, Erstattungsrichtlinie, AVV

Status: **Freigegeben 2026-09-29 (Luca, Entscheidungen E1–E23 bestätigt) und gebaut** (Phase 3, §5; PR `feat/legal-pages`). Live geht nichts vor dem HR-Eintrag: das Flag bleibt leer, der Guard hält Seiten mit Platzhaltern auf 404. Offen sind die Vorbedingungen je Stufe (§4) und die Platzhalterwerte (§6).
Kontext: ROADMAP §0 „Ship-Blocker DE-Markt“, §2 „Rechtsseiten fehlen“, §4 Paddle-Domain-Approval, §10 Waitlist-Go-Live (d). Entscheidung Luca 2026-09-22: **nichts Öffentliches vor dem HR-Eintrag** (§ 11 Abs. 2 GmbHG, kein Privat-Impressum).

> **Ohne Anwalt entstanden.** Die Texte unter `docs/legal/` beruhen auf Primärquellen-Research (`docs/research/legal-pages-research-2026.md` mit sieben Anhängen) und einer adversarialen Gegenprüfung, aber auf keiner anwaltlichen Prüfung. Empfehlung: Vor dem Paddle-Production-Cutover (erster Verkauf) die Nutzungsbedingungen (Haftung Ziffer 14, Widerruf Ziffer 18, Änderungen Ziffer 17) und den AVV (§§ 12, 15) anwaltlich prüfen lassen. Dieser Hinweis gehört hierher, nicht auf die Seiten.

## §1 Ziel und Umfang

Fünf Rechtstexte, jeweils DE und EN, die (a) die Pflichten aus § 5 DDG, Art. 13/14 DSGVO, §§ 305 ff., 312k, 327 ff., 356a BGB und Art. 28 DSGVO erfüllen, (b) Paddles Domain-Approval-Anforderungen erfüllen und (c) **nur behaupten, was der Code oder die Anbieter-Dokumentation belegt.**

| Text | DE | EN | Route | Pflicht für |
|---|---|---|---|---|
| Impressum | `docs/legal/impressum.de.md` | `legal-notice.en.md` | `/{locale}/impressum` | jede öffentliche Seite ab Eintragungstag |
| Datenschutzerklärung | `datenschutz.de.md` | `privacy.en.md` | `/{locale}/privacy` | Eintragungstag (Waitlist-Consent verlinkt sie bereits) |
| Nutzungsbedingungen | `nutzungsbedingungen.de.md` | `terms.en.md` | `/{locale}/terms` | Paddle-Domain-Approval, erster Verkauf |
| Erstattungsrichtlinie | `erstattung.de.md` | `refund.en.md` | `/{locale}/refund` | Paddle-Domain-Approval |
| AVV / DPA | `avv.de.md` | `dpa.en.md` | `/{locale}/dpa` (Empfehlung E11) | erster B2B-Kunde |

**Nicht im Umfang:** Pricing-Seite (PAngV-Bruttopreise, ROADMAP §4), Kündigungsbutton nach § 312k und Widerrufslink nach § 356a (eigene Arbeitspakete, §4 V9/V10), Aufbewahrungs- und Löschroutine (§4 V3/V4), KI-Kennzeichnung der Ausgaben (§4 V11). Diese Pakete sind aber **Vorbedingungen** für einzelne Seiten; die Texte verweisen darauf mit `[VORBEDINGUNG: …]`, und der Platzhalter-Guard (§5.4) verhindert, dass eine Seite live geht, solange so ein Marker drinsteht.

## §2 Wichtigste Research-Befunde (Details: `docs/research/legal-pages-research-2026.md`)

1. **Vercel Hobby ist laut Vercel-ToS nur für „personal or non-commercial use“.** Werbung für ein Produkt gilt schon als kommerziell. Der Vercel-DPA gilt nur für Pro und Enterprise, und auf Hobby darf Vercel „Your Content“ für KI-Training nutzen und an Dritte geben (ToS 01.06.2026; Opt-out in den Team-Settings möglich). Der Account ist laut ROADMAP §5 Hobby. ⇒ **Vorbedingung V1**, und eine Sofortmaßnahme ohne Kosten (E20).
2. **Supabase kontrahiert über Supabase Pte. Ltd (Singapur)**, nicht DPF-zertifiziert ⇒ Grundlage EU-Standardvertragsklauseln. Projektregion: Frankfurt (eu-central-1), s. V7.
3. **Vertex:** Google Cloud EMEA Ltd (Dublin), kein Training, In-Memory-Cache 24 h, Abuse-Logging bis 90 Tage (Ausnahme beantragbar), `eu`-Multiregion für 3.8/3.6 Flash garantiert, **Global-Endpoint ohne Residenzgarantie** (nur Rollback-Pfad).
4. **Paddle ist eigener Verantwortlicher** (MSA, Data Sharing Addendum). Die Terms müssen den Pflichtsatz aus dem Seller Handbook enthalten und Paddle als Reseller zeigen; unslop darf nicht selbst abrechnen oder erstatten.
5. **§ 356a BGB (Widerrufsbutton) gilt seit 19.06.2026**; § 356 wurde umnummeriert (Dienstleistungen jetzt Abs. 5). § 312k: Paddle schiebt den Kündigungsbutton per MSA 11.1(iii) auf den Supplier; Paddles Portal hat einen Retention-Flow.
6. **§§ 327 ff. BGB treffen unslop selbst** (Nutzungsvertrag, auch ohne Entgelt über § 327 Abs. 3) ⇒ Leistungsänderungsklausel nach § 327r, zwingende Mängelrechte.
7. **AI Act Art. 50 gilt seit 02.08.2026.** Review-Kommentare sind als Fließtext grundsätzlich markierungspflichtig (Abs. 2); Code-Vorschläge nicht. Übergangsfrist bis 02.12.2026 nur, wenn unslop vor dem 02.08.2026 in Verkehr gebracht wurde. Heute tragen Kommentare und Check Runs **kein KI-Label**.
8. **ODR-Link entfällt** (VO 524/2013 aufgehoben zum 20.07.2025); VSBG-Negativerklärung freiwillig; keine DSB-Pflicht; BFSG-Ausnahme für Kleinstunternehmen.
9. **Code-Befunde, die Aussagen in den Texten verhindern** (Research §3, C1–C14): keine Speicherfrist für `review_jobs` (Diffs, Code-Zitate unbefristet), kein Konto-Löschpfad (Suppression-FK blockiert), Waitlist unbefristet, CLI-Login lädt Google Fonts, Hostname im API-Key-Label, bis 500 Zeichen Modellausgabe in Fehlermeldungen, kein Secret-Filter im PR-Pfad, Landing-FAQ behauptet „wir speichern keinen Code“ und „europe-west3“, kein Terms-Zustimmungsschritt beim Login.

## §3 Offene Entscheidungen für Luca (jeweils mit Empfehlung)

Die Entwürfe sind nach den Empfehlungen geschrieben; weicht Luca ab, ändern sich die genannten Stellen.

| # | Frage | Optionen | Empfehlung | Betrifft |
|---|---|---|---|---|
| E1 | Verbraucher zulassen? | (a) zulassen; (b) nur Unternehmer (Hinweis + Bestätigung im Checkout) | **(a)**: Solo-Entwickler sind Zielgruppe, und Paddles Checkout erzwingt kein B2B, Verbraucherrechte gegenüber Paddle blieben ohnehin. Kosten: § 312k-Button, § 356a-Link, Widerrufsbelehrung, Bruttopreise. | Terms Ziff. 1.4, 9.2, 13.1, 17.1, 18; Refund §3 |
| E2 | Sprachvorrang | (a) DE maßgeblich; (b) gleichrangig; (c) B2B EN, B2C DE | **(a)**: einfach und deckt die KG-Rechtsprechung zu englischen AGB ab | alle EN-Fassungen |
| E3 | Gerichtsstand | Sitz Bebra für Kaufleute und Auslandskunden ohne Gerichtsstand in DE | **so wie entworfen** (§ 38 ZPO) | Terms Ziff. 19.2 |
| E4 | Erstattungsregel | A nur gesetzlich · **B 14 Tage bedingungslos auf die erste Zahlung** · B′ 14 Tage mit Scan-Grenze · C 30 Tage | **B**: deckt sich mit Paddles 14-Tage-Ermessen, bedingungslos = geringstes Domain-Review-Risiko, die Probezeit mit Karte fängt das Ausprobieren vorher ab | Refund §2 |
| E5 | Haftungshöchstbetrag B2B | fester Betrag je Schadensfall; Jahresgesamtgrenze | **fester Betrag je Schadensfall**, anwaltlich festlegen (Startvorschlag 10.000 €); eine Jahresgesamtgrenze kann bei Kardinalpflichten unter dem vorhersehbaren Schaden liegen (Gegenprüfung J-12) | Terms Ziff. 14.3 `[HAFTUNGSHÖCHSTBETRAG]` |
| E6 | Speicherfristen | siehe §6 Platzhalter | **Review-Daten 90 Tage** (Diff-Text von CLI/MCP schon nach 30 Tagen leeren); Dismissals mit dem Repository bzw. Konto löschen; Kontolöschung binnen 30 Tagen; Waitlist bis 6 Monate nach Launch oder bis zum Widerruf, Einwilligungsnachweis danach 3 Jahre ab Jahresende (regelmäßige Verjährung, §§ 195, 199 BGB); AVV-Löschung 30 Tage nach dem 30-Tage-Exportfenster | Datenschutz §12, AVV Anlage 2, § 14 |
| E7 | Telefonnummer | (a) VoIP-/virtuelle Nummer; (b) keine | **(a)**: Paddle Handbook verlangt „email and phone number“, die IHK-Merkblätter auch; EuGH C-298/07 würde ein Kontaktformular genügen lassen, Paddle nicht | Impressum, alle Kopfzeilen |
| E8 | Vertex-Rollback-Pfad `global` | (a) entfernen (ROADMAP §5, ab ~01.10. geplant); (b) behalten und offenlegen | **(a)**, und zwar beide Wege: `UNSLOP_ESCALATION_LEGACY_PRO` **und** den Draft-Override `UNSLOP_DRAFT_MODEL_OVERRIDE_ENDPOINT=global` (`src/lib/pipeline/models.ts:192-195`, Gegenprüfung P1-16); dann entfallen alle `[OPTIONAL, NUR SOLANGE DER ROLLBACK-PFAD EXISTIERT]`-Absätze | Datenschutz 6.3/§11, AVV Anlagen 3/4 |
| E9 | Vertex Abuse-Logging, In-Memory-Cache | (a) Ausnahme beantragen, Cache behalten; (b) beides lassen; (c) beides abschalten | **(a)**: der Antrag kostet nichts; der 24-h-Cache bleibt in der Region und verletzt laut Google keine Zero-Data-Retention. **Nachtrag 2026-09-29:** Ab 2026-10-15 macht Google den impliziten Cache standardmäßig „durable“, dann liegen die Daten auf Datenträgern. Damit „im Arbeitsspeicher“ wahr bleibt, wird die Retention auf `EPHEMERAL` gesetzt (`scripts/vertex-cache-config.ts`, ROADMAP §0). Das Feld ist bei Google noch nicht freigeschaltet | Datenschutz 6.3, AVV Anlage 4 |
| E10 | SPEC §12.4 Gate G2 (menschliche Labels an Live-Traffic) vs. AVV § 4 | (a) AVV schließt Eigennutzung aus, G2 nur mit eigenen Repos/OSS-PRs, die unslop selbst prüft, oder mit Opt-in; (b) AVV erlaubt „Qualitätssicherung“ | **(a)**: nach EDPB 07/2020 Rn. 80 f. und Art. 28 Abs. 10 macht Eigennutzung unslop insoweit zum Verantwortlichen; SPEC §12.4 G2 dann umformulieren (Spec-Divergenz, DOC-001 Regel 4). Dasselbe gilt für die auftragsübergreifende Auswertung der gespeicherten `verdicts` als „Audit-Grundlage für False Refutations“ (`src/lib/telemetry/llm-call-log.ts:44`, Gegenprüfung P1-26): AVV § 4 erlaubt nur die Fehleranalyse einzelner Aufträge | AVV § 4, Datenschutz §2, Terms 7.3 |
| E11 | AVV öffentlich unter `/{locale}/dpa` inkl. Unterauftragsverarbeiter-Liste | ja / nur als PDF auf Anfrage | **ja**: EDPB Opinion 22/2024 verlangt die Kette „readily available“; die Liste braucht eine stabile URL (`[URL DER UNTERAUFTRAGSVERARBEITER-LISTE]` = `/de/dpa#anlage-4`) | AVV § 7 |
| E12 | Flag-Verhalten | (a) Flag aus ⇒ **404** (wie die Waitlist-Route), dazu `noindex`; (b) Flag aus ⇒ Seite erreichbar, aber `noindex` und ungelinkt | **(a)**: (b) machte das Impressum mit UG-Daten vor der Eintragung öffentlich erreichbar, gegen die Entscheidung vom 22.09. Abweichung vom Auftragswortlaut „noindex solange das Flag aus ist“, begründet | §5.2 |
| E13 | Zustimmung zu Terms/Datenschutz beim Login | (a) Hinweiszeile unter „Mit GitHub anmelden“ (Phase 3) + protokollierte Zustimmung mit Version (eigene Migration, vor Paddle-Live); (b) nur Hinweiszeile | **(a)**: § 305 Abs. 2 BGB, Paddle Handbook („buyer accepts … before purchase“), BayLDA (AVV-Abschluss beweiskräftig dokumentieren) | Terms 3.1, AVV § 1 Abs. 2 |
| E14 | Brevo-Öffnungs-/Klicktracking | abschalten / lassen | **abschalten**: sonst Pixel-Tracking ohne Einwilligung, Datenschutz §9 müsste es offenlegen | Datenschutz §9 |
| E15 | Google Fonts auf der CLI-Login-Seite | entfernen (System-Schrift) / offenlegen | **entfernen** in Phase 3 (zwei `@import`-Zeilen in `packages/cli/src/login.ts`) | Datenschutz §7 |
| E16 | Landing-FAQ „Do you store or train on our source code? No“ und „europe-west3“ | korrigieren / lassen | **korrigieren in Phase 3**: widerspricht dem Ist-Stand (C1, eu-Multiregion seit 17.09.) und der Datenschutzerklärung; § 5 UWG. Vorschlag: „We don't train on it, and neither does Google. We store diffs and findings for [Frist] …“ (MARKETING_CLAIMS-Disziplin) | `messages/{en,de}.json:476-477` |
| E17 | KI-Kennzeichnung der Ausgaben | (a) sichtbares Label „AI-generated“ + HTML-Kommentar-Marker in Kommentaren/Check Runs + Feld in CLI-JSON; (b) nur Label | **(a)**. Faktenlage laut Luca 2026-09-28: noch keine Bereitstellung an Dritte ⇒ kein Übergang bis 02.12.2026, Art. 50 Abs. 2 gilt **ab dem ersten Tag**, an dem Dritte den Dienst nutzen | Terms 5.1, eigenes Arbeitspaket V11 |
| E18 | Slugs | locale-unabhängig `/impressum`, `/privacy`, `/terms`, `/refund`, `/dpa` | **so**: der Waitlist-Consent verlinkt schon `/{locale}/privacy`; EN-Linktext „Legal Notice (Impressum)“ | §5.1 |
| E19 | Rendering der Texte | (a) Markdown-Dateien + `react-markdown`/`remark-gfm` in Server-Komponenten (zwei neue Abhängigkeiten, kein Client-JS, kein Roh-HTML); (b) JSX je Sprache | **(a)**: die Texte bleiben als Prosa prüfbar und identisch mit dem, was Luca freigibt | §5.3 |
| E20 | Vercel Hobby bis zum Eintragungstag | (a) sofort in den Team-Settings Model Training abschalten (kostenlos, laut ToS auf jedem Plan möglich), Pro am Eintragungstag; (b) nichts tun | **(a)**: der Beta-Betrieb verarbeitet heute Kundencode auf Hobby; das Upgrade selbst bleibt *blocked: incorporation* (ROADMAP §0). Die ToS sagen „You may opt-out of Model Training at any time by adjusting your Team account settings“; ob der Schalter auf Hobby sichtbar ist, ist nicht verifiziert | V1 |
| E21 | Mindestalter | 18 / keins | **18** (Terms 3.1): Verträge Minderjähriger sind schwebend unwirksam; die Zielgruppe ist beruflich | Terms 3.1 |
| E23 | Auftragsdaten in KI-gestützten Arbeitssitzungen (`scripts/db-query.ts` liest per Default alle Spalten, auch Diffs und Findings aus `review_jobs`; CLAUDE.md schreibt das Skript für Live-Verifikation vor; die Ausgabe landet bei Anthropic und in lokalen Sitzungsprotokollen) | (a) V21: Spalten-Allowlist für Tabellen mit Auftragsdaten (nur Kennungen, Status, Zähler) plus Betriebsregel; (b) Anthropic als Unterauftragsverarbeiter offenlegen (DPA, Ort, Übermittlung, Aufbewahrung) | **(a)**: kleiner Code-Eingriff, hält die AVV-Zusagen wahr, und Kunden müssen keinen weiteren KI-Anbieter akzeptieren. Ob bisher Daten fremder Kunden betroffen waren, ist nicht geprüft; belegt sind nur Test-Repos (Gegenprüfung R3-07) | AVV § 12 Abs. 3, Anlage 3 Nr. 2 |
| E22 | Widerruf beim Nutzungsvertrag | (a) keine Belehrung für den unentgeltlichen Nutzungsvertrag; Kauf-Widerruf bei Paddle, Nutzungsvertrag jederzeit beendbar; (b) freiwilliges Widerrufsrecht mit Belehrung und eigener Online-Widerrufsfunktion, Weiterleitung an Paddle | **(a)**: für den unentgeltlichen Vertrag besteht wegen § 312 Abs. 1a Satz 2 BGB voraussichtlich kein gesetzliches Widerrufsrecht (Daten nur zur Leistungserbringung); eine Belehrung weckte falsche Erwartungen an Erstattungen, die nur Paddle leistet (Gegenprüfung J-04). **Trägt nur, wenn V20 erfüllt ist**: § 312 Abs. 1a Satz 2 verlangt, dass die Daten „zu keinem anderen Zweck“ verarbeitet werden (Gegenprüfung J2-01). Bleibt G2 an Live-Traffic (E10 b), gilt (b) mit Belehrung, eigener § 356a-Funktion und § 360-Regelung gegenüber Paddle **vor** Stufe B. Anwaltlich bestätigen lassen | Terms Ziff. 18, Refund §3 |

## §4 Vorbedingungen (was vor welchem Schritt erledigt sein muss)

Stufe **A** = Eintragungstag (Impressum + Datenschutz + Waitlist live). Stufe **B** = Paddle-Domain-Approval und erster Verkauf (Terms + Refund live). Stufe **C** = erster B2B-AVV.

| # | Vorbedingung | Stufe | Wer | Beleg (Receipt) |
|---|---|---|---|---|
| V1 | Vercel Pro (DPA, kommerzielle Nutzung). Model-Training-Opt-out ist laut Luca 2026-09-28 bereits gesetzt (E20 erledigt); Plan aktuell Hobby | A | Luca (Geld, *blocked: incorporation*) | Vercel-Team-Plan im Dashboard/MCP |
| V2 | Platzhalter mit Firmendaten gefüllt (§6) | A | Luca liefert, Claude trägt ein | Guard-Test grün mit Flag an |
| V3 | Speicherfristen entschieden (E6) **und** umgesetzt (pg_cron-Löschjob für `review_jobs` inkl. Diff-Leerung, Waitlist-Aufräumjob) | A | Claude baut, Luca führt Migration im SQL-Editor aus | `scripts/db-query.ts review_jobs --count` vor/nach, Cron-Eintrag |
| V4 | Löschpfad für Konten und Repositories trotz `finding_suppressions` (C2) — heute blockiert schon **ein** Dismissal auf einem abgelaufenen Repo den gesamten 30-Tage-Cron, weil `028_fix_ttl_cleanup_interval.sql:27` alle Repos mit einem einzigen `DELETE` löscht (Gegenprüfung P2-06); Code-Skelette auch beim Entfernen aus der GitHub App deaktivieren (`src/lib/app-installation.ts:512-537`, P1-13); 10-s-Testwert in `src/lib/skeleton.ts:349` durch 30 Tage ersetzen | A | Claude baut (Spec-Amendment nötig) | Tests + manuelle Löschung eines Test-Kontos |
| V5 | Google Fonts aus CLI-Login entfernt (E15) | A | Claude, Phase 3 | Test/grep |
| V6 | Brevo-Tracking aus (E14) | A | Luca im Brevo-Konto | Screenshot der Einstellung |
| ~~V7~~ | Supabase-Region: **Frankfurt (eu-central-1)**, Angabe Luca 2026-09-28 (Dashboard; Management-API *blocked: tooling*) | erledigt | — | eingetragen |
| V8 | Landing-FAQ korrigiert (E16) | A | Claude, Phase 3, Copy-Freigabe Luca | Diff in `messages/*.json` |
| V9 | Kündigungsbutton „Verträge hier kündigen“ (§ 312k) ohne Login, Bestätigungsseite ohne Halteangebote, Kündigung über Paddle-API; **zusätzlich** (a) Kündigung zum Periodenende, wenn der Nutzungsvertrag endet oder das Konto gelöscht wird (Terms 12.1), (b) sofortige Kündigung plus anteilige Erstattung über Paddle (MSA 10.1, Kosten nach 10.4 bei unslop) in den Fällen der Terms 11.4. Heute kann der Code nur zum Periodenende kündigen (`src/app/api/billing/subscription/cancel/route.ts:31-33`) | B | eigenes Arbeitspaket | E2E gegen Paddle-Sandbox für Button, (a) und (b) |
| V10 | Link „Vertrag widerrufen“ (§ 356a) auf unslop.codes, ständig sichtbar, führt zu Paddles Widerrufsfunktion (E22a: keine eigene Widerrufsfunktion für den Nutzungsvertrag) | B | eigenes Arbeitspaket | Sichtprüfung |
| V11 | KI-Kennzeichnung der Ausgaben (E17) | vor der ersten Nutzung durch Dritte (Beta) | eigenes Arbeitspaket | Screenshot eines PR-Kommentars |
| V12 | Zustimmung beim Login protokolliert (E13) | B/C | eigenes Arbeitspaket + Migration | DB-Zeile mit Version |
| V13 | Paddle.js-Cookies auf der Billing-Seite im Browser erhoben | B | Claude (Browser-Receipt gegen Sandbox) | DevTools-Liste, Text in Datenschutz §4 |
| V14 | Vertex-Entscheidungen E8/E9 umgesetzt (Pfad entfernt, Ausnahme beantragt) | A (E8) / C (E9) | Claude (Code) / Luca (Antrag) | Code-Diff / Google-Bestätigung |
| V15 | Feld „Datenschutz-Kontaktadresse“ im Dashboard oder AVV-Text auf Konto-E-Mail festlegen | C | Entscheidung bei V12 | — |
| V16 | Supabase-Tarif und Sicherungen geklärt (Free: keine Backups) | C | Luca | Tarif im Dashboard |
| V17 | 2FA auf allen Admin-Konten, Festplattenverschlüsselung, keine dauerhafte Speicherung von Auftragsdaten auf dem Arbeitsgerät; Branch-Schutz/PR-Pflicht auf `main` oder AVV-Satz kürzen (AVV Anlage 3 `[BESTÄTIGEN]`) | C | Luca | Selbstauskunft |
| V18 | Suchvektoren (`text-embedding-005`) über einen Endpunkt mit EU-Residenzzusage erzeugen: Googles Tabelle (Stand 2026-09-25, HTML ausgewertet) sagt für `text-embedding-005` „Supported“ nur für US-/EU-Multiregion und Indien, **nicht für Deutschland (`europe-west3`)**, den der Code heute nutzt (`src/lib/embeddings.ts` über `getVertexClient()`). Widerspruch in Googles Doku: „Supported capabilities“ nennt die Multiregion-Endpunkte „exclusively for the Gemini 3 family“ ⇒ Umstellung auf `eu` per Testaufruf belegen oder auf ein Embedding-Modell mit DE-/EU-Zusage wechseln | A | Claude (Code), Receipt per Live-Aufruf | Test + ein echter Embedding-Aufruf über den neuen Endpunkt |
| V20 | E10 umgesetzt: keine auftragsübergreifende Auswertung von Kundendaten (SPEC §12.4 G2 auf eigene Repos/OSS/Opt-in umgestellt, Verdict-Audit auf Fehleranalyse einzelner Aufträge beschränkt). Trägt E22 und die Zusagen in Terms 7.3/18.2 und Datenschutz §2 | A | Luca entscheidet E10, Claude ändert SPEC §12.4 | SPEC-Diff |
| V21 | E23a umgesetzt, **über alle Wege**: `scripts/db-query.ts` verweigert für `review_jobs`, `review_job_llm_calls`, `code_chunks`, `finding_*` alles außer Kennungen, Status, Zeitstempeln und Zählern; Betriebsregel in CLAUDE.md, dass Supabase-MCP `execute_sql` auf diesen Tabellen nur solche Spalten liest und Vercel-Laufzeitprotokolle (die Diff-Auszüge und Modellantworten enthalten) nicht in KI-Sitzungen gelesen werden, solange fremde Kunden aktiv sind; alternativ E23b (Offenlegung) (Gegenprüfung R4-01) | A (vor dem ersten fremden Kunden) | Claude | Test des Skripts |
| V19 | GitHub-`provider_token` nach dem Speichern aus der Supabase-Session entfernen und/oder Auth-Cookies `httpOnly` (P1-08: heute liegt das Token mit `repo`-Scope kurz nach der Anmeldung im JS-lesbaren Cookie). Der Text legt das offen; Fix ist Hygiene, kein Blocker | nach A | Claude | Test + Cookie-Inhalt im Browser |

## §5 Umsetzung (Phase 3, erst nach Freigabe)

### 5.1 Routen
**Gebaut als** ein dynamisches Segment `src/app/(marketing)/[locale]/[legalSlug]/page.tsx` (statt fünf Ordnern): unbekannter Slug ⇒ `notFound()`, Registry in `src/lib/legal/legal-pages.ts`. Statische Nachbarrouten (`waitlist/confirmed`) haben Vorrang. Das bestehende Layout liefert Nav, Footer und die `isSupportedLocale`-Prüfung; der Proxy setzt die Pfad-Locale (i18n_Spec §6 Pfad-Präfix für Marketing). Unbekannte Locale ⇒ `notFound()` wie in `waitlist/confirmed/page.tsx`.

### 5.2 Flag
- `NEXT_PUBLIC_LEGAL_PAGES_LIVE` = kommagetrennte Liste der freigeschalteten Slugs, z. B. `impressum,privacy` am Eintragungstag, später `impressum,privacy,terms,refund,dpa`. Einziger Leseort `src/lib/legal/legal-pages-flag.ts` mit `isLegalPageLive(slug)`, zur Laufzeit gelesen (Muster `src/lib/waitlist/waitlist-flag.ts`), damit Tests per `stubEnv` schalten.
- Seite nicht freigeschaltet ⇒ `notFound()` (E12). Freigeschaltet ⇒ normal indexierbar; `generateMetadata` setzt Titel, `canonical` und `alternates.languages` (DE/EN).
- **Sichtprüfung vor der Eintragung:** `LEGAL_PAGES_PREVIEW_PLACEHOLDERS=true` rendert Seiten mit offenen Platzhaltern samt Warnbanner — nur wirksam, wenn `VERCEL_ENV !== 'production'` (lokal, Vercel-Preview). In Production gilt der Guard ohne Ausnahme (Test `legal-pages.test.ts`).
- Footer (`MarketingFooter.tsx`, `FooterBottomRow`): Links nur für freigeschaltete Slugs. DE: „Impressum“, „Datenschutz“, „Nutzungsbedingungen“, „Erstattung“, „AVV“; EN: „Legal Notice (Impressum)“, „Privacy“, „Terms“, „Refunds“, „DPA“. Die Login-Seite bekommt dieselben Links in ihrer Fußzeile (Impressumspflicht auf jeder Seite).
- `sitemap.ts` nimmt freigeschaltete Rechtsseiten auf; `robots.ts` bleibt unverändert.

### 5.3 Inhalte
- Die freigegebenen Texte ziehen mit `git mv` von `docs/legal/` nach `src/content/legal/{slug}.{locale}.md`; `docs/legal/README.md` verweist dorthin (eine Quelle).
- Rendering: `react-markdown` + `remark-gfm` + `remark-breaks` in einer Server-Komponente `LegalDocument`, kein `'use client'`, kein Roh-HTML (`skipHtml`). `remark-breaks` macht einfache Zeilenumbrüche (Adressblöcke) zu `<br>`; das ist gefahrlos, weil jeder Absatz der Quelltexte eine Zeile ist. Styling als `.legal-document`-Regeln in `globals.css`. Die Dateien werden per `fs` gelesen; `outputFileTracingIncludes` in `next.config.ts` nimmt `src/content/legal/*.md` ins Deployment.
- Überschriften-Anker (`#anlage-4`) sind **nicht** gebaut (remark-gfm erzeugt keine IDs); `[URL DER UNTERAUFTRAGSVERARBEITER-LISTE]` zeigt deshalb auf `/de/dpa` ohne Fragment, bis ein Slug-Plugin nachgezogen ist.
- Copy außerhalb der Texte (Footer-Labels, Seitentitel) in `messages/{en,de}.json` unter `marketing.legal`; der Catalog-Parity-Test greift automatisch.

### 5.4 Platzhalter-Guard (fail-closed)
`findUnresolvedPlaceholders(markdown)` findet jedes `[…]`, das mit einem Großbuchstaben beginnt und **nicht** von `(` gefolgt wird (also kein Markdown-Link). Eine freigeschaltete Seite mit offenen Platzhaltern rendert **404** und loggt `legal_page_unresolved_placeholders` mit Slug und Liste. So kann weder `[HRB-NUMMER]` noch ein `[VORBEDINGUNG: …]` versehentlich live gehen.

### 5.5 Nachzieher im selben PR
- `WAITLIST_SPEC.md` §5 nennt `/{locale}/datenschutz`, der Code `/privacy`: Spec korrigieren (DOC-001 Regel 4).
- E15 (Google Fonts), E16 (FAQ-Copy), Hinweiszeile beim Login (E13a), soweit freigegeben.

## §6 Platzhalter

| Platzhalter | Quelle | Wann |
|---|---|---|
| `[HRB-NUMMER]` | Eintragungsbekanntmachung / Handelsregisterauszug AG Bad Hersfeld | Eintragungstag |
| `[USt-IdNr.]` | Bestätigung des BZSt nach Antrag (§ 27a UStG) | sobald erteilt; bis dahin Zeile weglassen (§ 5 Abs. 1 Nr. 6 DDG: „besitzen“) |
| `[W-IdNr.]` | BZSt, automatische Vergabe (Körperschaften ab Q4 2026) bzw. Mitteilung bei Einrichtung des Steuerkontos | sobald zugeteilt; bis dahin Zeile weglassen; in `docs/company/fristenkalender.md` aufnehmen |
| `[TELEFONNUMMER]` | E7 | Eintragungstag |
| `[DATUM DES INKRAFTTRETENS]` | Tag der Freischaltung | je Seite |
| `[AVV-VERSION]` | `1.0` bei Erstveröffentlichung | Stufe C |
| ~~`[SUPABASE-REGION]`~~ | **erledigt 2026-09-28**: Frankfurt (eu-central-1), Angabe Luca aus dem Dashboard | — |
| `[SUPABASE-LOGFRIST]` | Supabase-Tarif: Free 1 Tag, Pro 7 Tage (supabase.com/pricing, Gegenprüfung P1-07) | Stufe A |
| `[SPEICHERFRIST-REVIEWDATEN]`, `[SPEICHERFRIST-DISMISSALS]`, `[SPEICHERFRIST-WAITLIST]`, `[SPEICHERFRIST-WAITLIST-UNBESTÄTIGT]`, `[NACHWEISFRIST-WAITLIST]`, `[LÖSCHFRIST-NACH-KONTOLÖSCHUNG]`, `[LÖSCHFRIST-NACH-VERTRAGSENDE]` | E6, erst eintragen, wenn V3/V4 gebaut sind | Stufe A (Stufe C für AVV) |
| ~~`[HAFTUNGSHÖCHSTBETRAG]`~~ | **erledigt 2026-09-29**: 10.000 € je Schadensfall (E5, ohne Anwalt gesetzt) | — |
| `[URL DER UNTERAUFTRAGSVERARBEITER-LISTE]` | E11 (`https://unslop.codes/de/dpa`, Anker siehe §5.3) | Stufe C |
| `[PADDLE-COOKIES: …]` | V13 | Stufe B |
| `[SICHERUNGSKOPIEN: …]` | V16 | Stufe C |
| `[OPTIONAL, NUR SOLANGE DER ROLLBACK-PFAD EXISTIERT: …]` | E8 — entfällt, wenn der Pfad entfernt ist | Stufe A |
| `[ANPASSEN, FALLS …]` (Vertex) | E9 | Stufe A |
| `[VORBEDINGUNG …]` | §4 | je Stufe |
| `[BESTÄTIGEN …]` | V17 (AVV Anlage 3); Brevo-DPA-Partei (Datenschutz §9); Übermittlungsgrundlage für Paddle.com (Canada) Ltd. (Datenschutz §11) | Stufe A (Datenschutz) / C (AVV) |
| `[ODER, NACH UMSETZUNG: …]` (Konto im Dashboard löschen) | V4 | wenn gebaut |
| `[VORBEDINGUNG V1/V4/V5/V6/V9/V10/V12/V18/V20/V21]` | §4 | je Stufe |
| `[ENTFÄLLT NACH V19]` (Token im Cookie, Datenschutz §4) | V19: mit dem Fix den Halbsatz streichen | nach Stufe A |

## §7 Tests (Phase 3; THE LAW gilt auch hier)

| Test | Beweist |
|---|---|
| `legal-pages-flag.test.ts` | leere/fehlende Variable ⇒ nichts live; Liste wird getrimmt; unbekannte Slugs ignoriert |
| `legal-page-render.test.ts` (je Slug, beide Locales) | Flag aus ⇒ `notFound`; Flag an ⇒ Überschrift in der richtigen Sprache; unbekannte Locale ⇒ `notFound` |
| `legal-placeholders.test.ts` | Guard findet `[HRB-NUMMER]`, `[VORBEDINGUNG: x]`, ignoriert `[Text](/de/terms)`; freigeschaltete Seite mit Platzhalter ⇒ 404 |
| `legal-content-parity.test.ts` | DE und EN je Text haben dieselbe Zahl an Abschnitten (`##`) und dieselben Platzhalter, verglichen am Marker-Kopf vor dem ersten Doppelpunkt (einige Marker sind bewusst übersetzt, Gegenprüfung R4-04) |
| `landing-render.test.ts` (erweitert) | Footer zeigt nur freigeschaltete Rechtslinks; Flag leer ⇒ keine Rechtslinks (Regressionsschutz) |
| `sitemap.test.ts` | Rechtsseiten nur bei Freischaltung in der Sitemap |

Receipts in Phase 3: `npm run lint`, `npm run build`, `npm test`; lokaler Render beider Locales mit gesetztem Flag und Screenshots. Kein Deploy-Cutover, kein Flag in Vercel: das setzt Luca am Eintragungstag.

## §8 Gegenprüfung

Zwei unabhängige Prüf-Subagenten (Opus), adversarial, Primärquellen selbst abgerufen. Berichte unter `docs/research/legal-pages-2026/review-1-code.md` und `review-2-recht.md`.

**Runde 1 (2026-09-28).**
- *Prüfer 1, Datenschutz/AVV gegen Code und Anbieter-Doku:* 2 hoch, 12 mittel, 10 niedrig, 2 Verdachtsfälle. Alle übernommen. Die wichtigsten: fehlende V1-Marker bei allen Vercel-Aussagen (P1-01); Anwendungsprotokolle bei Vercel enthalten Repo-/Dateinamen und Code-Ausschnitte (P1-02); zweiter Datenfluss über Repo-Webhooks mit dem OAuth-Token (P1-03); Suchvektoren auch aus dem Diff (P1-04); GitHub-Scope `user:email`, den Supabase Auth immer voranstellt, selbst an der Quelle bestätigt (P1-06); Supabase-Protokolle mit IP (P1-07); GitHub-Token vorübergehend im JS-lesbaren Session-Cookie (P1-08, ⇒ V19); „automatisierter Test“ und „Pull Requests“ in den TOMs ohne CI nicht haltbar (P1-09/10); Zugangsdaten auch auf dem Arbeitsgerät (P1-11); Löschung beim Entfernen aus der GitHub App fehlt (P1-13, ⇒ V4). Die beiden Verdachtsfälle (Brevo-Unterauftragsverarbeiter in Drittländern, Auswertung der `verdicts`) sind als vorsichtige Formulierung bzw. E10 aufgenommen.
- *Prüfer 2, alle Texte gegen Rechtsquellen:* 5 hoch, 19 mittel, 6 niedrig. 29 übernommen, J-04 anders gelöst (E22): Statt einer freiwilligen Widerrufsbelehrung mit eigener Online-Funktion und Weiterleitung an Paddle stellen die Terms klar, dass der Kauf bei Paddle widerrufen wird und der unentgeltliche Nutzungsvertrag jederzeit endet. Das beseitigt die Fehlerwartung (Widerruf bei uns ⇒ Erstattung) ohne neue Pflichten. Übernommen u. a.: Gestaltungshinweis 3 ist damit gegenstandslos (J-01); Paddle.com (Canada) Ltd. fehlte (J-02); Gerichtsstand nur für Unternehmer (J-03); kein Notfall-Austausch von Unterauftragsverarbeitern ohne Vorab-Information (J-05); AVV-Änderungen nur mit Zustimmung (J-20, EDPB 07/2020 Rn. 110); Einspruch ohne Begründungspflicht, auch gegen Kettenänderungen (J-21/22); Wahl der Prüfungsart beim Kunden (J-23); Rückgabe aller Auftragsdaten (J-24); „KI-Fehler kein Mangel“ nur gegenüber Unternehmern (J-10); Art.-82-Ansprüche uneingeschränkt (J-11).
- *Eigener Zusatzbefund bei der Einarbeitung:* Googles Residency-Tabelle deckt `text-embedding-005` in `europe-west3` nicht ab (V18).

**Runde 2 (2026-09-28), frische Prüf-Agenten, Berichte `review-3-code-r2.md` und `review-4-recht-r2.md`.**
- *Rechtsprüfung:* alle J-01…J-30 korrekt umgesetzt, DE/EN deckungsgleich; 6 neue Befunde, alle übernommen: E22 hängt an E10 ⇒ V20 und Marker (J2-01, hoch); Pflichtangaben nach § 312i BGB/Art. 246c EGBGB als neue Terms-Ziffer 3.4 (J2-02); Beendigung wegen eigener Änderungen kündigt das Paddle-Abo mit und erstattet anteilig, neue Ziffer 11.4 (J2-03); Beendigung des Nutzungsvertrags kündigt ein laufendes Abo zum Periodenende mit statt es weiterlaufen zu lassen (J2-04); Widerrufsrecht für den Kauf ist gesetzlich, Paddle regelt nur die Ausübung (J2-05); AVV § 14 Abs. 3 verwies auf nicht vorhandene Fristen (J2-06).
- *Code-Prüfung:* alle P1-01…P1-26 korrekt umgesetzt; 3 mittel, 3 niedrig, 1 Verdacht, alle übernommen: im OAuth-Pfad erscheint der Review unter dem GitHub-Namen des Nutzers als „Changes requested“, kein Check Run (P2-01); ein Diff-Auszug landet bei **jeder** Prüfung im Log, nicht nur im Fehlerfall (P2-02); das GitHub-Token bleibt bis zum ersten Session-Refresh, schlimmstenfalls 400 Tage, im Cookie (P2-03); gelesen werden auch `next.config.*`, Dateiliste und Manifeste (P2-04); Zustellprotokolle beim Repo-Webhook liegen in den Repo-Einstellungen (P2-05); V4 deckt den blockierten Gesamt-Cron ab (P2-06); Token-Schlüssel und Repo-Metadaten-Abrufe auf dem Arbeitsgerät ehrlich benannt (P2-07, Verdacht, vorsorglich übernommen).

**Runde 3 (2026-09-28), kombinierter Prüfer auf die Änderungen der Runde 2, Bericht `review-5-r3.md`.** Kein hoher Befund. Paddle-Kompatibilität von 11.4/12.1 an MSA 10.1/10.4 und Buyer Terms Ziff. 5 (iii) bestätigt. Übernommen: 11.4 deckt auch Beendigungen durch unslop ab, die der Kunde nicht zu vertreten hat, 17.1 verweist sauber auf 12.1/12.2 (R3-01); 12.1 trennt Beendigung zum Periodenende von sofortiger Beendigung/Kontolöschung (R3-02); OAuth-Pfad postet bei eigenen PRs nur einen Kommentar, weil GitHub dort kein „Changes requested“ zulässt (R3-03); Button heißt „Login with GitHub“ (R3-04); eine maßgebliche Vertragssprache (R3-05); V20-Marker im AVV § 4 (R3-06); Auftragsdaten in KI-Sitzungen ⇒ E23/V21 (R3-07, Verdacht, vorsorglich); V9 erweitert (R3-08).

**Runde 4 (2026-09-28), Bericht `review-6-r4.md`.** Alle R3-Korrekturen korrekt; kein hoher Befund; Terms 12.1 AGB-rechtlich als haltbar bewertet. Übernommen: V21 gilt über alle Wege inkl. Supabase-MCP und Vercel-Logs (R4-01, mittel); AVV § 7 ohne „für die betroffene Leistung“, weil die Terms keine Teilleistungen kennen (R4-02); zweiter Lesezweck für eigene Review-Kommentare (R4-03); Paritätstest vergleicht Marker-Köpfe (R4-04).

**Abbruchkriterium erreicht:** Die Befunde sind von Runde zu Runde weniger und schwächer geworden (Runde 1: 7 hoch / 31 mittel; Runde 2: 1/6; Runde 3: 0/2; Runde 4: 0/1, und der betraf nur den Umfang einer internen Vorbedingung). Eine fünfte Runde würde nach dieser Kurve nur Formulierungen finden. Die verbleibenden Risiken liegen nicht im Text, sondern in den offenen Entscheidungen (§3) und Vorbedingungen (§4) sowie in der fehlenden anwaltlichen Prüfung (Kopfhinweis).

## §9 Quellen

`docs/research/legal-pages-research-2026.md` (Synthese mit eigener Stichprobenprüfung) und die Anhänge `docs/research/legal-pages-2026/r0` bis `r6`, alle Abrufe 2026-09-28.
