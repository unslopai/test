# Rechtsseiten für unslop: Research 2026 (Synthese)

Stand: **2026-09-28**. Erstellt für `docs/specs/LEGAL_PAGES_SPEC.md` und die Entwürfe unter `docs/legal/`.
Keine Rechtsberatung. Die Texte sind ohne Anwalt entstanden; das steht in der Spec, nicht auf den Seiten.

## 0. Methode und Quellenlage

- Sechs parallele Research-Subagenten (Opus), jeweils mit der Vorgabe: Primärquellen zuerst, jede Aussage mit URL und Abrufdatum, Unbelegtes als „nicht verifiziert“. Dazu eine Code-Inventur aller Datenflüsse mit Datei:Zeile-Fundstellen. Die vollständigen Berichte mit allen Quellen liegen unverändert unter `docs/research/legal-pages-2026/`:

| Datei | Thema |
|---|---|
| `r0-code-inventur.md` | Was der Code tatsächlich tut: Empfänger, Tabellen, Fristen, Cookies, Clients |
| `r1-impressum.md` | § 5 DDG, § 5a/§ 35a GmbHG, VSBG, ODR, MStV, UG i.G., DSA, BFSG, PAngV |
| `r2-datenschutz.md` | Art. 13/14 DSGVO, Rollen, Rechtsgrundlagen, DPF, Vertex, § 25 TDDDG, DOI, Fristen, HBDI, DSB |
| `r3-terms-ai-act.md` | Paddle Buyer Terms/MSA/Handbook, AGB-Recht, §§ 327 ff., § 356a, § 312k, AI Act Art. 50 |
| `r4-refund.md` | Paddle Refund Policy, Widerruf, Chargebacks, Proration, Refund-Optionen |
| `r5-avv.md` | Art. 28, EDPB 07/2020 und Opinion 22/2024, SCC 2021/915, Muster, TOMs |
| `r6-anbieter.md` | Vercel, Supabase, Vertex, GitHub, Paddle, Brevo, Proton: Entitäten, DPAs, Regionen |

- **Technische Grenze:** EUR-Lex blockiert automatisierte Abrufe (Bot-Schutz). Die Agenten haben EU-Rechtsakte stattdessen aus dem Cellar des Amtsblatts (publications.europa.eu) bzw. der BfDI-Textausgabe bezogen; wo das nicht ging, steht „blocked: tooling“ im Bericht. Das ist kein Negativbefund.
- **Eigene Gegenprüfung (Stichproben, 2026-09-28).** Ich habe die folgenden Aussagen selbst an der Quelle geöffnet. Alle bestätigt:

| Aussage | Quelle | Ergebnis |
|---|---|---|
| § 356 BGB: Dienstleistungen jetzt Abs. 5, digitale Inhalte Abs. 6 | https://www.gesetze-im-internet.de/bgb/__356.html | bestätigt |
| Paddle Buyer Terms Fassung 31.03.2026, Ziff. 15 Widerruf/Erlöschen bei Nutzung | https://www.paddle.com/legal/invoiced-consumer-terms | bestätigt |
| § 36 Abs. 3 VSBG: ≤ 10 Beschäftigte am 31.12. des Vorjahres, nur Abs. 1 Nr. 1 | https://www.gesetze-im-internet.de/vsbg/__36.html | bestätigt |
| W-IdNr.: Körperschaften ab Q4 2026, USt-Pflichtige seit 11/2024 | https://www.bzst.de/DE/Unternehmen/Identifikationsnummern/Wirtschafts-Identifikationsnummer/wirtschaftsidentifikationsnummer_node.html | bestätigt |
| Vercel-DPA gilt nur für „Enterprise and Pro plans“ (Last Updated 17.03.2026) | https://vercel.com/legal/dpa | bestätigt |
| Vercel Hobby „non-commercial personal use only“; „Advertising the sale of a product or service“ ist kommerziell | https://vercel.com/docs/limits/fair-use-guidelines (last_updated 2026-09-14) | bestätigt |
| Vercel ToS: Hobby/Trial-Pro ⇒ „Your Content“ darf für KI-Training genutzt und an Dritte gegeben werden | https://vercel.com/legal/terms (01.06.2026) | bestätigt |
| Supabase-DPA: Vertragspartner Supabase Pte. Ltd, Singapur; SCC Modul 2/3; automatisch mit den ToS | https://supabase.com/legal/dpa (Version 1, 01.08.2026) | bestätigt |
| Vertex In-Memory-Cache 24 h; Abuse-Logging bis 90 Tage; Global-Endpoint „don't provide any data residency guarantees“; Training Restriction | Rohtexte der Agenten aus docs.cloud.google.com (Stand 2026-09-25) und cloud.google.com/terms/service-terms | Wortlaut in den geladenen Rohtexten bestätigt |
| Digital Omnibus = VO (EU) 2026/1744 vom 08.07.2026, ABl. 24.07.2026 | Amtsblatt-Rohtext (Cellar) | bestätigt |
| AI-Act-Leitlinien C(2026) 5054 vom 20.07.2026: „code review chatbots available only to professional developers“ als Offensichtlichkeits-Beispiel; Source Code inkl. integraler Kommentare nicht von Art. 50 Abs. 2 erfasst | Kommissions-Annex (Rohtext) | bestätigt |

- **Sekundär belegte Aussagen**, die in die Texte einfließen, sind in der Spec gekennzeichnet. Nur-sekundär sind insbesondere: KG Berlin 5 U 156/14 (deutsche AGB für Verbraucher), BGH VIII ZR 121/04 (Kardinalpflicht erläutern), BGH I ZR 200/25 vom 16.07.2026 (keine Halteangebote auf der Kündigungs-Bestätigungsseite), LG Hildesheim 3 O 109/23 (Reseller haftet für fehlenden Kündigungsbutton).

## 1. Widersprüche zwischen den Berichten und ihre Auflösung

| Thema | Widerspruch | Auflösung |
|---|---|---|
| Google-Vertragspartner | r2: „nicht verifiziert“; r6: Google Cloud EMEA Ltd, Dublin | r6 hat die Primärquelle geöffnet (cloud.google.com/terms/google-entity, 30.06.2026). **Google Cloud EMEA Limited** gilt. |
| Brevo-Vertragspartner | WAITLIST_SPEC §3 „Sendinblue GmbH / Brevo SAS“; r2 „Sendinblue SAS, Paris“; r6 „Brevo GmbH, Berlin für DE/CH/AT laut Supplemental Terms“ | r6 zitiert die Supplemental Terms wörtlich. Für den Hauptvertrag ist die **Brevo GmbH, Berlin** Vertragspartner; ob sie auch DPA-Partei ist, sagt der Text nicht. Die Datenschutzerklärung nennt deshalb Brevo GmbH als Vertragspartner und die Konzernmutter Sendinblue SAS; beides EU. **Offene Frage 14.** |
| EDPB 07/2020 Version | Auftrag „2.0“, r5 „2.1“ | Aktuell ist **2.1** (Minor Corrections 2022). Randnummern nach 2.1. |
| § 356 BGB Absätze | Auftrag „Abs. 4/5“ | Seit 19.06.2026 **Abs. 5 (Dienstleistungen) / Abs. 6 (digitale Inhalte)**, selbst geprüft. |
| Paddle-Ermessensfrist | Auftrag vermutete 30/60 Tage | Aktuelle Refund Policy (31.03.2026) Ziff. 7.1: **14 Tage**. |
| Refund-Policy-Anforderungen Paddle | dev.to-Bericht (Sekundär): Paddle lehnt bedingte Policies ab; Gegenbeispiel TailAdmin | Primär gibt es **keine Mindestfrist und kein Bedingungsverbot**. Bedingungslose, befristete Formulierung hat das geringste Review-Risiko. |
| Telefonnummer | EuGH C-298/07: Kontaktformular genügt; IHK-Merkblätter: Telefon; Paddle Handbook: „email and phone number“ | Rechtlich genügt ein zweiter elektronischer Weg. Paddle verlangt die Nummer aber für die Domain-Freigabe. **Entscheidung E7.** |
| Vertex-Explicit-Cache | r2/r5: Inhalt „nur plausibel“ | Code-Beleg: Cache-Prefix hängt nur von Regel-IDs und Law-Block ab, „keine Diff-Daten“ (`src/lib/pipeline/prompt-builder.ts:47`, `context-cache.ts:355-359`). Der Cache enthält **keine Kundendaten**. |
| Kundencode für eigene Zwecke? | r2/r5: offene Frage (Art. 28 Abs. 10) | Code-Beleg: Benchmarks und Replays legen eigene Fixture-Jobs an (`scripts/lib/cascade-replay.ts:162-164`, `payload: { replay: true, fixture }`) und lesen keine Kunden-Payloads. Die Zusage „nur zur Diensterbringung“ ist haltbar. |

## 2. Ergebnisse je Thema (Kurzfassung, Belege in den Anhängen)

### 2.1 Impressum (r1)
- § 5 Abs. 1 DDG verlangt für die UG: Firma exakt „unslop UG (haftungsbeschränkt)“ (§ 5a Abs. 1 GmbHG), ladungsfähige Anschrift, Geschäftsführer, E-Mail plus einen zweiten schnellen Kontaktweg, Registergericht und HRB ab Eintragung, USt-IdNr. und W-IdNr., sobald vorhanden („besitzen“). Kapitalangaben nur, wenn man sie macht; Empfehlung: weglassen.
- § 18 Abs. 1 MStV verlangt Name **und Anschrift** des Vertretungsberechtigten; die Geschäftsanschrift genügt.
- **ODR-Link entfällt ersatzlos:** VO (EU) 524/2013 ist mit Wirkung vom 20.07.2025 aufgehoben (Art. 1 VO (EU) 2024/3228); ein fortgeführter Hinweis gilt teils als irreführend.
- **VSBG:** Keine Pflichtangabe bei ≤ 10 Beschäftigten (§ 36 Abs. 3), freiwillige Negativerklärung empfohlen. § 37 VSBG (Hinweis im konkreten Streitfall) gilt unabhängig von der Größe; § 30 Abs. 6 VSBG fingiert Teilnahmebereitschaft, wenn man einen Antrag der Universalschlichtungsstelle nicht binnen drei Wochen ablehnt.
- **DSA Art. 11/12:** Ob unslop ein Hostingdienst ist (gespeicherte CLI-Diffs, Scan-Historie), ist offen. Eine Kontaktstellen-Zeile kostet nichts und neutralisiert das Restrisiko.
- **BFSG:** Kleinstunternehmen, die Dienstleistungen erbringen, sind ausgenommen (§ 3 Abs. 3 BFSG, Art. 4 Abs. 5 RL 2019/882), auch von der Barrierefreiheitserklärung.
- **§ 35a GmbHG** gilt für E-Mails an bestimmte Empfänger: Pflichtangaben in die Signatur und in Transaktionsmails (Brevo-DOI-Template).
- **PAngV § 3 Abs. 1:** Wer gegenüber Verbrauchern mit Preisen wirbt, muss Gesamtpreise inkl. USt nennen, auch wenn Paddle verkauft. Betrifft die künftige Pricing-Seite.
- **Vor der Eintragung:** Rechtlich wäre ein Auftritt als „UG (haftungsbeschränkt) i.G.“ möglich; die Handelndenhaftung (§ 11 Abs. 2 GmbHG) spricht aber für die getroffene Entscheidung, nichts vor der Eintragung zu veröffentlichen.

### 2.2 Datenschutzerklärung (r2, r6, r0)
- **Rollen:** Verantwortlicher für Website, Konto, Login, Abrechnungsdaten, Waitlist, Support. **Auftragsverarbeiter** des Kunden für den Code, den Kunden zur Prüfung übermitteln (EDPB 07/2020 Rn. 80 f.). Die Art.-14-Information gegenüber Commit-Autoren in Kunden-Repos trifft dann den Kunden.
- **Paddle ist eigener Verantwortlicher** (MSA: „independent Controller“; Data Sharing Addendum 01.01.2023 mit SCC Modul 1). unslop erhält laut Addendum Name, Anschrift, E-Mail und Kaufhistorie und muss darüber nach Art. 14 informieren (DSA 5.4). Im Code gespeichert werden heute nur Paddle-IDs und der Abo-Status (`src/lib/billing/paddle-webhook.ts:180-194`).
- **Drittland:** DPF gültig (EuG T-553/23 vom 03.09.2025; Rechtsmittel C-703/25 P anhängig). Aktiv zertifiziert: Vercel Inc., GitHub (nur Non-HR), Google LLC. **Nicht** zertifiziert: Supabase, Paddle. UK-Angemessenheit verlängert bis 27.12.2031 (C(2025) 8771). Schweiz: Angemessenheitsbeschluss 2000/518/EG.
- **Supabase** kontrahiert über **Supabase Pte. Ltd (Singapur)**; Singapur hat keinen Angemessenheitsbeschluss ⇒ Grundlage SCC. Datenbank, Auth und Storage liegen in der gewählten Region; die Projektregion ist **blocked: tooling** (Management-Ebene defekt, SU-457471). `README.md:20` nennt eu-central-1, ein Beleg aus der Datenebene war nicht möglich (Antwort über Cloudflare-Edge FRA, kein Regionsheader).
- **Vertex AI:** Vertragspartner Google Cloud EMEA Ltd; kein Training (Service Specific Terms Nr. 18); In-Memory-Cache 24 h (abschaltbar); Abuse-Prompt-Logging bis 90 Tage in der gewählten Region für Kunden unter den GCP-ToS (Opt-out per Antrag); Multiregion `eu` garantiert ML-Verarbeitung in EU-Mitgliedstaaten für 3.8 und 3.6 Flash; **Global-Endpoint ohne Residenzgarantie** (nur Rollback-Pfad `UNSLOP_ESCALATION_LEGACY_PRO`). Embeddings (`text-embedding-005`) laufen auf `europe-west3`.
- **Cookies (§ 25 TDDDG):** Nur unbedingt erforderliche Speicherungen: Supabase-Session-Cookies (Paket-Default 400 Tage, `SameSite=Lax`), `unslop_locale` (1 Jahr, nur Login/Dashboard), `localStorage` `unslop.onboarding.path`. Kein Analytics, kein Tracking. Nach DSK OH Digitale Dienste Rn. 116 ist dann **kein Banner** nötig; Information gehört in die Datenschutzerklärung. Paddle.js (nur Billing-Seite) setzt möglicherweise eigene Cookies: **nicht dokumentiert, empirisch zu prüfen.**
- **Waitlist:** Einwilligung (Art. 6 Abs. 1 lit. a, Art. 7) und § 7 Abs. 2 Nr. 2 UWG; Nachweis nach BGH I ZR 164/09 (sekundär) vollständig dokumentieren. Brevo loggt DOI-Mailversand samt Einwilligungstext und Bestätigung; IP-Speicherung nicht belegt. **Brevo-Öffnungs- und Klicktracking ist standardmäßig an.**
- **Fristen:** HGB § 257 und AO § 147: Buchungsbelege 8, Bücher 10, Handelsbriefe 6 Jahre (aktueller Normtext).
- **Aufsicht:** HBDI, Wilhelmstraße 7, 65185 Wiesbaden (Impressum des HBDI; die alte Anschrift Gustav-Stresemann-Ring ist nicht mehr aktuell).
- **DSB:** Keine Pflicht (§ 38 BDSG unter 20 Personen, keine DSFA-Pflicht, weil Code bewertet wird und keine Personen). Kippt, falls Metriken je Entwickler dazukommen.
- **Art. 22:** Nicht einschlägig; ob ein Check den Merge blockiert, entscheidet der Kunde über Branch Protection.

### 2.3 Terms of Service (r3)
- Zwei Verträge: Kauf bei Paddle (Buyer Terms), Nutzung bei unslop („Supplier Agreement“). unslops Terms regeln Leistung, Nutzung, Rechte an Code und Ausgaben, Gewährleistung, Haftung, Änderungen, Kündigung des Kontos, Recht und Gerichtsstand. Zahlung, Steuern, Rechnung und Erstattung regelt Paddle; unslop darf nicht selbst abrechnen oder erstatten (MSA 10.1).
- **Paddle-Pflichten für die Website:** Firmenname in den Terms; Terms, Refund Policy und Privacy Policy über die Navigation erreichbar; Paddle als Reseller klar erkennbar (MSA 9.2); Pflichtsatz aus dem Seller Handbook; Support-Kontakt mit E-Mail und Telefon; Zustimmung zu Terms und Refund Policy vor dem Kauf.
- **AGB-Recht:** Haftungsklausel nach § 309 Nr. 7 mit ausformulierter Kardinalpflicht; keine Zustimmungsfiktion bei Terms-Änderungen gegenüber Verbrauchern (BGH XI ZR 26/20); keine dynamische Verweisung „in der jeweils gültigen Fassung“ (BGH III ZR 59/24, sekundär); Gerichtsstandsvereinbarung nur unter Kaufleuten (§ 38 ZPO); Rechtswahl mit Verbrauchervorbehalt (Rom I Art. 6 Abs. 2, EuGH C-191/15).
- **§§ 327 ff. BGB** treffen unslop selbst, weil der Nutzungsvertrag gegenüber Verbrauchern auch ohne eigenes Entgelt über § 327 Abs. 3 erfasst ist (Bereitstellung personenbezogener Daten). Mängelrechte sind zwingend (§ 327s); Produktänderungen brauchen eine Klausel nach § 327r mit triftigen Gründen und 30-Tage-Beendigungsrecht. Modellwechsel sind so ein Grund.
- **§ 356a BGB (Widerrufsbutton)** gilt seit 19.06.2026 (BGBl. 2026 I Nr. 28). Paddle bietet ihn im Customer Portal. Ob das auf unslop.codes genügt, ist ungeklärt; vorsichtig ist ein dauerhafter Link „Vertrag widerrufen“ auf unslop.codes.
- **§ 312k BGB (Kündigungsbutton):** Paddle verlagert die Pflicht per MSA 11.1(iii) auf den Supplier („direct link to enable cancellation … if it is required“). Paddles Portal schaltet seit 09.01.2026 einen Retention-Flow vor. Empfehlung: eigener Button „Verträge hier kündigen“ mit Bestätigungsseite, der über die Paddle-API kündigt.
- **Paddle-AUP:** KI-Code-Review ist nicht verboten; Wording nicht als „Geräte-Security“ formulieren.

### 2.4 Refund Policy (r4)
- Paddle Refund Policy 31.03.2026: Grundsatz „non-refundable“, außer gesetzlich oder nach Paddles Ermessen **bis 14 Tage**; EU-Verbraucher: 14 Tage Widerruf, **nach Ende eines Gratis-Trials erneut 14 Tage**; Widerrufsbutton im Portal; „the highest level of rights will always apply“ (freiwillige Seller-Zusagen werden Teil des Rahmens).
- Paddle darf nach MSA 10.2 ohne Zustimmung des Sellers binnen 14 Tagen nach jeder Verlängerung erstatten; der Seller trägt Betrag und Gebühren. Chargebacks führt Paddle allein, 20 EUR Gebühr, auch bei Gewinn.
- SaaS ist eine **digitale Dienstleistung** (§ 327 Abs. 2): Widerruf nach Beginn führt zu anteiligem Wertersatz (§ 357a Abs. 2), nicht zum Erlöschen. Paddles „digital content“-Formulierung passt nur ungenau; das ist Paddles Risiko als Verkäufer, unslops Texte dürfen nichts Gegenteiliges behaupten.
- Optionen A (nur gesetzlich) / B (14 Tage bedingungslos) / B′ (14 Tage mit Scan-Grenze) / C (30 Tage). Empfehlung der Recherche: **B**.

### 2.5 AVV (r5)
- Art. 28 Abs. 3 lit. a–h vollständig abbilden; elektronischer Abschluss zulässig, aber beweiskräftig dokumentieren (BayLDA). Änderungen des AVV **direkt** mitteilen; bloße Veröffentlichung genügt nicht (EDPB 07/2020 Rn. 110).
- EDPB Opinion 22/2024: Der Kunde muss die **gesamte Kette** der Unterauftragsverarbeiter kennen (Name, Anschrift, Kontakt, Tätigkeit); unslop liefert das proaktiv und gibt Sub-Verträge auf Anfrage heraus.
- SCC 2021/915 **nicht** 1:1 verwenden (Klausel 2 verbietet Änderungen, Klausel 7.7 e verlangt eine Drittbegünstigtenklausel mit jedem Sub, die gegenüber Google/Vercel/Supabase nicht durchsetzbar ist). Eigener AVV mit der Anhangstruktur I–IV.
- TOMs ehrlich: keine eigene Zertifizierung, physische Sicherheit bei den Subs, Solo-Betrieb ohne Vertretung offen benennen, Meldefrist 48 h statt 24 h.
- Unterauftragsverarbeiter: Google Cloud EMEA (Vertex), Supabase Pte. Ltd (DB/Auth), Vercel Inc. (Hosting, **DPA nur auf Pro**). GitHub ist Plattform des Kunden (Empfänger auf Weisung), nicht Sub von unslop; Webhook-Zustellprotokolle bleiben 3 Tage bei GitHub. Paddle und Brevo gehören nicht in den Kunden-AVV. Proton nur, falls Support-Mails Auftragsdaten enthalten.

### 2.6 AI Act (r3 §6)
- Art. 50 gilt seit 02.08.2026; der Digital Omnibus hat Art. 50 Abs. 1–6 nicht verschoben. Übergangsfrist nur für Abs. 2 (maschinenlesbare Markierung) bis **02.12.2026** für Systeme, die **vor dem 02.08.2026** in Verkehr gebracht wurden.
- unslop ist **Anbieter eines KI-Systems** (nicht GPAI). Abs. 1 (Interaktion) greift für professionelle Entwickler wegen Offensichtlichkeit eher nicht, ist aber restriktiv auszulegen. **Review-Kommentare als Fließtext fallen grundsätzlich unter Abs. 2**; Code-Vorschläge und kurze Labels nicht. Die B2B-Ausnahme scheitert, sobald Kommentare in öffentlichen Repos stehen.
- Code of Practice (10.06.2026): Wasserzeichen für Freitext über 200 Token; Stützung auf den Modellanbieter erlaubt. Ob Gemini auf Vertex Text-Wasserzeichen setzt: **nicht verifiziert**.
- Code-Befund: Review-Kommentare und Check Runs tragen **kein ausdrückliches KI-Label** (`src/lib/check-run.ts:57-58,164-165`; `src/lib/pipeline/review-posting.ts`). Hinweise nur in Terms oder Datenschutzerklärung genügen nach Leitlinien Rn. 38 nicht.

## 3. Befunde aus dem Code, die über die Rechtsseiten hinausgehen

Aus der Inventur (`r0-code-inventur.md`), selbst an den Fundstellen nachgeprüft:

| # | Befund | Fundstelle | Wirkung auf die Texte |
|---|---|---|---|
| C1 | `review_jobs` wird nie gelöscht: CLI-Diffs bis 300 KB, Findings mit Code-Zitaten und Fix-Snippets bleiben unbefristet | `src/lib/stale-jobs.ts:64-67`, Migration 004 | Keine Speicherfrist behauptbar ⇒ Platzhalter, Aufbewahrungsregel vor Go-Live bauen |
| C2 | Kein Löschpfad für Konten; `finding_suppressions` (append-only, FK ohne CASCADE) blockiert User- und Repo-Löschung | Migration 037; ROADMAP §6 | Art. 17 nur manuell erfüllbar; Löschroutine nötig |
| C3 | Waitlist-Einträge unbefristet; `confirmed` wird nie gesetzt; kein Consent-Text/-Version gespeichert | Migration 045; `signup-store.ts:40-46` | Frist + Nachweisaufbewahrung festlegen |
| C4 | Code-Skelette werden bei Re-Ingestion schon nach 10 s gelöscht („Zu Testzwecken“), Kommentar sagt 30 Tage | `src/lib/skeleton.ts:348-356` | Datenschutzfreundlich, aber Doku ≠ Code; Fehler beheben |
| C5 | CLI-Login-Seite lädt die Schrift Inter von fonts.googleapis.com (IP des Nutzers an Google) | `packages/cli/src/login.ts:92,98` | Entweder offenlegen oder entfernen (Empfehlung: entfernen) |
| C6 | Rechnername im API-Key-Label `cli-<hostname>`, in Datenbank und Request-Log | `packages/cli/src/login.ts:35` | offenlegen |
| C7 | Bis 500 Zeichen Modellausgabe (meist Kunden-Code) können in Logs und `review_jobs.error_message` landen | `src/lib/pipeline/helpers.ts:152-156` | offenlegen oder kürzen |
| C8 | Kein Secret-Filter im PR-/Webhook-Pfad (nur CLI/MCP brechen bei Treffern ab) | `packages/shared/src/node/secret-filter.ts`; kein Aufruf unter `src/` | TOMs dürfen keinen serverseitigen Secret-Filter behaupten |
| C9 | Paket-Registries (npm, PyPI, crates.io, Hugging Face) erhalten Paketnamen aus Kunden-Code; keine personenbezogenen Daten | `packages/prescan/src/engines/registry-engine.ts:246-249` | transparent erwähnen, kein Sub |
| C10 | Landing-FAQ: „Do you store … our source code? No“ und Vertex „pinned to … europe-west3“ | `messages/en.json:476-477` (DE analog) | **widerspricht C1 und dem Ist-Stand** (eu-Multiregion seit 17.09.); Copy korrigieren, sonst irreführend (§ 5 UWG) und widersprüchlich zur Datenschutzerklärung |
| C11 | `README.md:21` nennt noch europe-west3 und gemini-2.5 | `README.md:21` | Doku-Hygiene |
| C12 | Kein Terms-Zustimmungsschritt bei der GitHub-Anmeldung | `src/app/login/page.tsx` | § 305 Abs. 2 BGB und Paddle Handbook verlangen Einbeziehung; AVV-Abschluss muss protokolliert werden |
| C13 | Kein globaler noindex; `robots.ts` erlaubt `/` | `src/app/robots.ts:4-14` | Rechtsseiten brauchen eigene Metadaten |
| C14 | Vercel läuft laut ROADMAP §5 (MCP-Receipt 2026-09-17) auf **Hobby** | ROADMAP §5 | Nicht-kommerziell laut ToS, kein DPA, KI-Training auf „Your Content“ per Default ⇒ **Blocker** |

Ergänzungen aus der Gegenprüfung (Runde 1, Berichte `legal-pages-2026/review-1-code.md` und `review-2-recht.md`), selbst nachgeprüft:

| # | Befund | Fundstelle | Wirkung auf die Texte |
|---|---|---|---|
| C15 | Zweiter Datenfluss: Repos, die über Dashboard/CLI/Extension/MCP verbunden werden, bekommen mit dem OAuth-Token des Nutzers einen eigenen Webhook | `src/lib/connect-repository.ts:196-240` | in Datenschutz §6.1 und AVV Anlage 2 aufgenommen |
| C16 | Supabase Auth stellt bei GitHub immer `user:email` voran | https://raw.githubusercontent.com/supabase/auth/master/internal/api/provider/github.go (abgerufen 2026-09-28): `oauthScopes := []string{"user:email",}` | Scope-Liste in Datenschutz §5 ergänzt |
| C17 | Für jede Prüfung gehen Dateinamen und bis zu 30 hinzugefügte Diff-Zeilen an das Embedding-Modell; ein 100-Zeichen-Auszug davon landet im Log | `src/lib/rag.ts:199,238-267` | Datenschutz §3/§6.3, AVV Anlage 2 |
| C18 | Googles Residency-Tabelle (HTML ausgewertet, Stand 2026-09-25): `text-embedding-005` „Supported“ nur für US-Multiregion, EU-Multiregion und Indien, **nicht** für Deutschland (`europe-west3`), das der Code nutzt; `gemini-3.8-flash`/`gemini-3.6-flash` für US und EU | docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency; `src/lib/embeddings.ts`, `src/lib/vertex.ts:52-57` | Vorbedingung V18 |
| C19 | Nach dem Login liegt das GitHub-`provider_token` bis zum ersten Refresh in der Supabase-Session im JS-lesbaren Cookie (Paketcode, zur Laufzeit nicht beobachtet) | `@supabase/auth-js` `GoTrueClient.js` `_saveSession`; `@supabase/ssr` Cookie-Defaults | offengelegt in Datenschutz §4; Fix V19 |
| C20 | Kein CI im Repo (`.github/` fehlt); der Grants-Guard-Test überspringt sich ohne Credentials | `src/lib/supabase/private-grants.integration.test.ts:14-16` | TOMs ehrlich formuliert |

## 4. Offene Fragen an Luca (nur Fakten, die ich nicht selbst klären kann)

Die Entscheidungen mit Empfehlung stehen in der Spec (§3). Hier die reinen Faktenfragen:

1. **Supabase-Projektregion** (Dashboard → Project Settings → General; die Management-API ist defekt). Ohne Beleg bleibt der Platzhalter `[SUPABASE-REGION]`.
2. **Vercel-Plan** heute (laut ROADMAP Hobby) und, falls Pro: Model-Training-Opt-in in den Team-Settings aus?
3. **Google Cloud:** Läuft das Projekt unter den GCP-ToS (dann Abuse-Logging in Scope)? Soll die Ausnahme beantragt werden? In-Memory-Cache abschalten (`cacheConfig.disableCache`)?
4. **Sind `UNSLOP_ESCALATION_LEGACY_PRO` oder Model-Overrides in Prod gesetzt?** (Env-Werte sind nicht im Repo.)
5. **Brevo:** Tracking-Einstellungen im Account (Öffnungs-/Klick-Tracking); welche Brevo-Entität ist DPA-Partei.
6. **Paddle:** Ist Retain im Account aktiv? Welche Cookies setzt Paddle.js auf der Billing-Seite (Browser-Prüfung)?
7. **Datum des ersten Inverkehrbringens** von unslop (erste Bereitstellung an Dritte im Rahmen einer Geschäftstätigkeit, auch unentgeltlich, z. B. Beta-Grants). Entscheidet, ob die AI-Act-Markierungspflicht seit 02.08.2026 oder ab 02.12.2026 gilt.
8. **Telefonnummer** (für Impressum und Paddle): vorhanden oder VoIP-Nummer einrichten?
