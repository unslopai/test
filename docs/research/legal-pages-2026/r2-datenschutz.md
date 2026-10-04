# Recherche: Datenschutzerklärung für unslop (unslop.codes) nach DSGVO/TDDDG, Stand 2026-09-28

**Rolle:** Datenschutz-Researcher, kein Anwalt. Dies ist keine Rechtsberatung. Alle Quellen wurden am **2026-09-28** abgerufen, sofern nicht anders angegeben.
**Konventionen:** „**Primär**“ = Normtext, Behörde, Gericht, Anbieter-Doku/-Vertrag. „**Sekundär**“ = Kanzlei, Presse, Blog, Generator. „**nicht verifiziert**“ = Quelle nicht geöffnet oder nicht ladbar. „**Einschätzung**“ = eigene Subsumtion, nicht aus einer Quelle übernommen.

**Hinweis zum Normtext:** EUR-Lex lieferte über WebFetch und curl nur leere Antworten (Bot-Schutz, HTTP 202). Den DSGVO-Wortlaut habe ich deshalb aus der amtlichen Textausgabe der BfDI genommen: „DSGVO – BDSG, Texte und Erläuterungen“, Stand März 2026: https://www.bfdi.bund.de/SharedDocs/Downloads/DE/Broschueren/INFO1.pdf (im Folgenden **[BfDI-INFO1]**). BDSG, TDDDG, HGB, AO und UWG stammen von gesetze-im-internet.de.

---

## 1. Pflichtinhalte Art. 13 / Art. 14, Rollenabgrenzung

### 1.1 Art. 13 DSGVO (Erhebung bei der betroffenen Person), Primär [BfDI-INFO1, S. 157 f.]
Abs. 1 verlangt, zum Zeitpunkt der Erhebung mitzuteilen:
- a) Name und Kontaktdaten des Verantwortlichen (ggf. Vertreter)
- b) ggf. Kontaktdaten des DSB
- c) Zwecke und Rechtsgrundlage
- d) bei lit. f: die berechtigten Interessen
- e) Empfänger oder Kategorien von Empfängern
- f) Drittlandabsicht sowie das Vorhandensein oder Fehlen eines Angemessenheitsbeschlusses bzw. ein Verweis auf die Garantien nach Art. 46/47/49 Abs. 1 UAbs. 2 und wie man eine Kopie erhält

Abs. 2 verlangt zusätzlich:
- a) Speicherdauer oder, falls das nicht möglich ist, die Kriterien für ihre Festlegung
- b) Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Datenübertragbarkeit
- c) bei Einwilligung: jederzeitiger Widerruf
- d) Beschwerderecht
- e) ob die Bereitstellung gesetzlich oder vertraglich vorgeschrieben ist und welche Folgen die Nichtbereitstellung hat
- f) automatisierte Entscheidung nach Art. 22 Abs. 1 und 4, mit Logik und Tragweite

Abs. 3 regelt die Zweckänderung. Nach Abs. 4 entfällt die Pflicht, soweit die Person die Informationen bereits hat.

### 1.2 Art. 14 DSGVO (Daten nicht bei der Person erhoben), Primär [BfDI-INFO1, S. 158 f.]
Zusätzlich zu Art. 13 muss u. a. über die **Kategorien** personenbezogener Daten (Abs. 1 lit. d) und die **Quelle** informiert werden. Ausnahmen nach Abs. 5:
- a) Die Person hat die Informationen bereits.
- b) Die Information ist unmöglich oder erfordert einen unverhältnismäßigen Aufwand. Dann sind geeignete Maßnahmen zu treffen, „einschließlich der Bereitstellung dieser Informationen für die Öffentlichkeit“.
- c) Die Erlangung ist durch Rechtsvorschrift geregelt.
- d) Berufsgeheimnis.

### 1.3 Rollenabgrenzung nach EDPB Guidelines 07/2020, Primär
Quelle: EDPB Guidelines 07/2020 on the concepts of controller and processor, Version 2.0, final am 07.07.2021.
- Übersichtsseite: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en
- PDF: https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf

Was die Leitlinien sagen:
- **Rn. 29–30:** Maßgeblich ist der tatsächliche Einfluss („factual approach“), nicht das Vertragsetikett. Der Kunde muss dem vordefinierten Dienst eines Anbieters aktiv zustimmen.
- **Beispiel „standardised cloud storage service“ (nach Rn. 30):** Auch bei einem standardisierten Take-it-or-leave-it-Dienst bleibt der Kunde Verantwortlicher. Der Anbieter ist Auftragsverarbeiter, „insofar as the cloud service provider does not process the personal data for its own purposes“.
- **Rn. 40:** „Essential means“ bleiben beim Verantwortlichen: welche Daten, wie lange, welche Empfänger, welche Betroffenen. „Non-essential means“ darf der Auftragsverarbeiter wählen, etwa Soft-/Hardware und Detail-TOMs. **Einschätzung:** Die Wahl von Vertex/Gemini durch unslop ist ein „non-essential means“. Sie muss aber in der Subprozessorenliste transparent sein.
- **Rn. 80–81:** „On behalf of“ heißt Handeln im Interesse eines anderen. Nach Art. 28 Abs. 10 wird ein Auftragsverarbeiter, der eigene Zwecke verfolgt, insoweit selbst Verantwortlicher. Normtext Art. 28 Abs. 10 in [BfDI-INFO1, S. 172 f.].
- **Rn. 83 f. (Beispiel „General IT support“):** Ein Dienstleister, der bei seiner Leistung zwangsläufig systematisch auf personenbezogene Daten zugreift, ist Auftragsverarbeiter. Beim „IT-consultant fixing a software bug“ ist der Zugriff dagegen nur beiläufig; der Berater ist dann weder Auftragsverarbeiter noch Verantwortlicher.

**Einschätzung für unslop:**

| Verarbeitung | Rolle unslop | Begründung |
|---|---|---|
| (a) Marketing-Website, Server-Logs, Account/Login, Billing-Stammdaten, Support, Waitlist | **Verantwortlicher** | Eigene Zwecke (Vertrieb, Betrieb, Sicherheit, Vertragsverwaltung). |
| (b) Review des Kundencodes über GitHub App, CLI, Extension oder MCP: Diff, Commit-Metadaten, Autorennamen, E-Mails in Commits, Kommentare | **i. d. R. Auftragsverarbeiter des Kunden** | Der Kunde bestimmt, welche Repos und PRs geprüft werden und wer Zugriff hat. unslop verarbeitet in seinem Auftrag (EDPB Rn. 80 f., Cloud-Beispiel). Voraussetzung: ein AVV nach Art. 28 Abs. 3, und unslop nutzt Kundencode **nicht für eigene Zwecke**. |
| (b') Nutzung von Kundencode/Diffs für eigene Zwecke (Benchmark, Regel-Tuning, Fixtures, Qualitätsanalysen, Nutzungsstatistik mit Personenbezug) | **insoweit Verantwortlicher** (Art. 28 Abs. 10; EDPB Rn. 81) | Dafür braucht es eine eigene Rechtsgrundlage und eigene Transparenz. Siehe offene Fragen. |

**Art. 14 bei Dritten in Kunden-Repos** (Commit-Autoren, Co-Autoren, Reviewer):
- Soweit unslop Auftragsverarbeiter ist, trifft die Informationspflicht nach Art. 14 den **Kunden als Verantwortlichen**, nicht unslop. Die Pflichten nach Art. 13/14 sind an „den Verantwortlichen“ adressiert [BfDI-INFO1, S. 157 f.].
- unslop sollte das in der Datenschutzerklärung klarstellen. Empfohlen ist ein eigener Abschnitt „Verarbeitung im Auftrag unserer Kunden“ mit Verweis auf den AVV und die Subprozessorenliste.
- Soweit unslop eigene Zwecke verfolgt (b'), gilt Art. 14 für unslop selbst. Dann kommt es auf die Ausnahme nach Abs. 5 lit. b an (unverhältnismäßiger Aufwand, dann öffentliche Information). **Einschätzung**, nicht behördlich bestätigt.

**GitHub-OAuth-Login:** Daten wie Login-Name, E-Mail und Avatar kommen von GitHub, der Nutzer löst den Abruf aber selbst aus. Ob das rechtlich unter Art. 13 oder 14 fällt, konnte ich nicht in einer Primärquelle klären (**nicht verifiziert**). Pragmatisch sollte man die Quelle „GitHub“ und die Datenkategorien nennen; dann ist beides erfüllt.

---

## 2. Rechtsgrundlagen je Verarbeitung

Normtexte Art. 6 und Erwägungsgrund 49 in [BfDI-INFO1]. Die Zuordnungen sind **Einschätzung**, soweit nicht anders belegt.

| Verarbeitung | Rechtsgrundlage | Beleg / Anmerkung |
|---|---|---|
| Server-/Edge-Logs (IP, Zeitstempel, User-Agent) bei Vercel | Art. 6 Abs. 1 lit. f (Sicherheit, Stabilität, Missbrauchsabwehr) | EG 49: Die Gewährleistung der Netz- und Informationssicherheit ist ein berechtigtes Interesse, soweit „unbedingt notwendig und verhältnismäßig“ [BfDI-INFO1, S. 90]. Interessen nach Art. 13 Abs. 1 lit. d benennen und auf Art. 21 hinweisen. |
| Account, Login, Dashboard, Scan-Abwicklung, API-Keys | Art. 6 Abs. 1 lit. b | Vertragsdurchführung. Nach Art. 13 Abs. 2 lit. e angeben, dass ohne diese Daten kein Vertrag möglich ist. |
| Verarbeitung von Kundencode als Auftragsverarbeiter | keine eigene Rechtsgrundlage von unslop | Die Rechtmäßigkeit leitet sich vom Verantwortlichen ab: „The lawfulness of the processing … will be derived from the controller's activity“ (EDPB 07/2020, Rn. 80). |
| Waitlist mit Brevo-DOI | Art. 6 Abs. 1 lit. a, Art. 7 | Siehe Abschnitt 6. Bei Werbe-Mails zusätzlich § 7 Abs. 2 Nr. 2 UWG (Werbung per elektronischer Post nur mit vorheriger ausdrücklicher Einwilligung): https://www.gesetze-im-internet.de/uwg_2004/__7.html |
| Aufbewahrung von Buchungsbelegen (Paddle-Payout-Abrechnungen, Rechnungen) | Art. 6 Abs. 1 lit. c mit § 257 HGB und § 147 AO | Siehe Abschnitt 7. |
| Support-/Kontakt-E-Mails über Proton | lit. b (Vertragskunden) oder lit. f (allgemeine Anfragen) | Einschätzung. |
| Zahlungsabwicklung über Paddle | Paddle ist **eigener Verantwortlicher** | Siehe unten. unslop erhält Käuferdaten von Paddle. Paddle selbst nennt als Grundlage für diese Weitergabe berechtigtes Interesse (Fulfillment, Support, Betrugsprävention) und für Marketing Einwilligung. |

### Paddle als Merchant of Record, Primär
- **Paddle Privacy Notice** (zuletzt aktualisiert 16.03.2026): https://www.paddle.com/legal/privacy
  - Als Verantwortliche („controllers“) sind genannt: Paddle.com Market Limited (30 Old Bailey, London EC4M 7AU, UK), Paddle.com Inc. (New York, USA), Paddle Payments Limited (Dublin, Irland) und Paddle.com Canada Ltd.
  - Paddle nennt sich „licensed reseller“, also Merchant of Record.
  - Für Übermittlungen in nicht-adäquate Länder nutzt Paddle SCC bzw. das UK Addendum.
- **Paddle „GDPR readiness“:** https://www.paddle.com/legal/gdpr
  - Der Käufer kontrahiert mit Paddle, nicht mit dem Seller. Paddle braucht daher eine eigene Grundlage, um Daten an den Seller weiterzugeben.
  - Genannt werden berechtigte Interessen (order fulfillment, order and product support, ausdrücklich „exclude marketing“) und für Marketing die Einwilligung.
- **Paddle Data Sharing Addendum** (Last Updated 01.01.2023): https://www.paddle.com/legal/data-sharing-addendum
  - Controller-to-Controller-Rahmen („one Controller … discloses Personal Data to another Controller“).
  - Bei EU-DSGVO gelten SCC nach Durchführungsbeschluss 2021/914, bei UK-DSGVO mit UK Approved Addendum.
- **Paddle Data Processing Addendum** (Last Updated 01.02.2023): https://www.paddle.com/legal/data-processing-addendum
  - Gilt nur für Dienste, „wherein we act as a Processor“. Für MoR-Käuferdaten ist das nach dem obigen Rahmen **nicht** der Fall.

**Konsequenz für die Datenschutzerklärung (Einschätzung):**
- Paddle als eigenständigen Verantwortlichen für den Checkout benennen und auf die Paddle-Datenschutzerklärung verweisen.
- Bei unslop fallen dann nur noch die von Paddle übermittelten Käufer- und Transaktionsdaten an.
- Welche der vier Paddle-Gesellschaften für unslop konkret Vertragspartner ist, ergibt sich aus dem Seller-Vertrag. → **offene Frage**.

---

## 3. Drittlandübermittlung 2026

### 3.1 EU-US Data Privacy Framework
- **Angemessenheitsbeschluss vom 10.07.2023**, erste periodische Überprüfung am 09.10.2024. Primär, EU-Kommission: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
  - Die Nummer des Durchführungsbeschlusses habe ich nicht in einer geöffneten Primärquelle gesehen (**nicht verifiziert**).
- **EuG, Urteil vom 03.09.2025, T-553/23 Latombe/Kommission:** Klage abgewiesen; die USA gewährleisteten am Tag des Beschlusses ein angemessenes Schutzniveau. Der EuG betont die Pflicht der Kommission, den Rechtsrahmen laufend zu überwachen und den Beschluss ggf. auszusetzen, zu ändern oder aufzuheben. Primär, Pressemitteilung Nr. 106/25 des Gerichtshofs: https://curia.europa.eu/site/upload/docs/application/pdf/2025-09/cp250106en.pdf
- **Rechtsmittel C-703/25 P Latombe/Kommission**, Primär, InfoCuria: https://infocuria.curia.europa.eu/tabs/affair?lang=EN&searchTerm=%22C-703%2F25+P%22&publishedId=C-703%2F25+P
  - eingereicht am 31.10.2025
  - Status „**Pending**“, Gerichtshof, Verfahrenssprache FR
  - Rechtsmittelschrift im ABl. vom 22.12.2025
  - ein Beschluss vom 04.06.2026 (ECLI:EU:C:2026:465); Inhalt **nicht verifiziert**, er ließ sich nicht öffnen
  - Ein Urteil liegt Stand heute nicht vor.
  - Sekundär: Ein Termin für eine mündliche Verhandlung war bis Mai 2026 nicht bekannt (Digital Policy Alert / EDPL, Suchergebnisse, nicht weiter geprüft).
- **PCLOB:** Die Primärseite https://www.pclob.gov/About/HistoryMission beschreibt nur die Struktur (5 Mitglieder, Ernennung durch Präsident mit Senat). Die aktuelle Besetzung und Beschlussfähigkeit sind **nicht primär verifiziert**. Die Unterseite zu den Board-Mitgliedern leitete auf eine Fehlerseite um.
  - **Sekundär:** Seit der Abberufung von drei Mitgliedern am 27.01.2025 ist das Gremium nicht beschlussfähig (CDT, https://cdt.org/insights/what-the-pclob-firings-mean-for-the-eu-us-data-privacy-framework/; Suchergebnisse).
  - Den Stand von 2026 habe ich nur sekundär gesehen.
- **Einschätzung:** Das DPF ist am 2026-09-28 gültig. Es besteht ein Restrisiko durch das anhängige Rechtsmittel. Als Absicherung sollten zusätzlich die SCC in den Anbieter-DPAs aktiviert sein; bei Vercel und Google ist das der Fall (s. u.).

### 3.2 DPF-Einträge auf dataprivacyframework.gov
Geprüft am 2026-09-28 über die Suche auf https://www.dataprivacyframework.gov/list im Browser. Die Seite ist JS-gerendert, „Full Profile“ jeweils geöffnet.

| Organisation | Status | Umfang | Erstzertifizierung / nächste Fälligkeit |
|---|---|---|---|
| **Vercel Inc.** (Covina, CA) | EU-US DPF **Active**, UK Extension Active, Swiss-US Active | HR und Non-HR | EU: 06/20/2019; fällig 04/29/2027 |
| **GitHub** (San Francisco) | EU-US DPF **Active**, UK Extension Active, Swiss-US Active | **nur Non-HR** | EU: 01/26/2017; fällig 08/03/2027 |
| **Google LLC** (Mountain View) | EU-US DPF **Active**, UK Extension Active, Swiss-US Active | HR und Non-HR; gilt auch für 100%-US-Töchter; „Google Cloud Privacy Notice“ ist in der Policy-Liste aufgeführt | EU: 09/22/2016; fällig 09/13/2027 |
| **Microsoft Corporation** | „Active – Re-certification under Review“ (EU, Swiss, UK) | HR und Non-HR | nur Listenansicht, Profil nicht geöffnet |
| **Supabase** | **kein Treffer** (weder aktive noch inaktive Teilnehmer) | – | – |
| **Paddle** | **kein Treffer** unter den aktiven Teilnehmern | – | – |
| Sendinblue, Inc. (Brevo USA) | nicht auf der DPF-Seite geprüft. Laut Brevo-Datenschutzerklärung zertifiziert (Primär, aber Selbstauskunft): https://www.brevo.com/legal/privacypolicy/ | – | – |

### 3.3 Weitere Anbieter

**Supabase**
- Laut Supabase DPA „Version 1 — August 1, 2026“ (https://supabase.com/legal/dpa) ist Vertragspartner **Supabase Pte. Ltd, Singapur** (65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513). Supabase, Inc. wird im DPA nicht erwähnt.
- Transfermechanismen: **SCC Modul 2 und 3**, UK Addendum B.1.0 und Swiss Addendum.
- Datenstandort: primär in der vom Kunden gewählten Region.
- Die Subprozessorenliste steht nur als PDF bereit (Stand 01.06.2026): https://supabase.com/legal/customer-resources/subprocessor-list; Inhalt **nicht verifiziert**.
- Singapur steht nicht in der Liste der Angemessenheitsbeschlüsse auf der Kommissionsseite. Grundlage ist also Art. 46 mit SCC.
- → **Offene Frage:** In welcher Region liegt das Projekt `ypjgdqkrsnetiiosspix`?

**Paddle.com Market Ltd (UK)**
- Die Kommission hat die UK-Angemessenheitsbeschlüsse (DSGVO und LED, ursprünglich vom 28.06.2021) im **Dezember 2025 verlängert**. Primär, Kommissionsseite oben.
- Laufzeit bis 27.12.2031 und Beschlussnummer (EU) 2025/2574 sind nur **Sekundär** belegt (eucrim, Hunton u. a., Suchergebnisse).
- Paddle.com Inc. (USA) ist nicht DPF-zertifiziert. Soweit Daten dorthin gehen, verweist Paddle auf SCC.

**Brevo / Sendinblue SAS (Frankreich, EU)**
- Keine Drittlandübermittlung für den Kern.
- Registersitz laut AGB „9-17, rue Salneuve“, laut Datenschutzerklärung „17 rue Salneuve, 75017 Paris“. Die Hausnummer ist leicht widersprüchlich; beide Angaben sind oben verlinkt.
- Die Subprozessoren-Tabelle in den Brevo-AGB nennt u. a. Sendinblue Inc. (USA) mit „EU-U.S. Data Privacy Framework Standard Contractual Clauses“ für Customer Experience & Maintenance: https://www.brevo.com/legal/termsofuse/

**Proton AG (Schweiz)**
- Route de la Galaise 32, 1228 Plan-les-Ouates, Genf. Privacy Policy, Last modified 12.05.2026: https://proton.me/legal/privacy
- Die Schweiz hat einen Angemessenheitsbeschluss (Kommissionsseite oben, Verweis CELEX 32000D0518).

**SCC-Fallback:** Durchführungsbeschluss (EU) 2021/914 vom 04.06.2021. Belegt durch die Zitate in den Anbieterverträgen von Paddle und Vercel. Den EUR-Lex-Text konnte ich nicht öffnen (**Normtext nicht verifiziert**).

---

## 4. Google Vertex AI (Gemini)

Alle Seiten: docs.cloud.google.com, „Last updated 2026-09-25 UTC“.

**Datenresidenz:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency
- Bei **jurisdiktionalen Multi-Region-Endpunkten** bleibt die ML-Verarbeitung in der Region (USA oder EU).
- Der Endpunkt „eu“ deckt „strictly … data residency within EU member states“ ab; UK und Schweiz sind ausgeschlossen.
- **Globale Endpunkte** „may be processed in any Google Cloud location around the world“ und bieten „no data residency guarantees“.
- In der Modelltabelle sind **gemini-3.8-flash** und **gemini-3.6-flash** für „US multi-region“ und „**EU multi-region**“ als *Supported* markiert (im HTML-Quelltext geprüft).
- **gemini-3.1-pro-preview erscheint in der Tabelle nicht.** Das passt zu „nur global“.
- **Konsequenz:** Solange der Rollback-Pfad `UNSLOP_ESCALATION_LEGACY_PRO` aktiv ist, kann Code weltweit verarbeitet werden, also potenziell in den USA. Die Datenschutzerklärung bzw. die Subprozessoren-Info muss das erwähnen. Die Übermittlung an Google LLC ist über das DPF (aktiv, s. o.) oder die SCC im CDPA abgedeckt.

**Trainingsverbot und Datenaufbewahrung:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention
- **Training Restriction:** Laut Service Specific Terms Nr. 18 „Google will not use Customer Data to train or fine-tune any AI/ML models without Customer's prior permission or instruction“ (https://cloud.google.com/terms/service-terms). Laut ZDR-Seite gilt das für GA- und Pre-GA-Modelle.
- **In-Memory-Caching:** standardmäßig an, nur im Arbeitsspeicher, projektisoliert, **24 h TTL**. Es hält die Residency-Vorgaben ein und „does not violate zero data retention“. Es lässt sich pro Projekt abschalten (`cacheConfig.disableCache`).
- **Prompt-Logging zur Missbrauchserkennung:** betrifft nur Kunden unter den GCP Terms of Service, nicht unter einem Master Agreement.
  - Erkennen Klassifikatoren Verdachtsfälle, loggt Google Prompts **bis zu 90 Tage** in der gewählten Region bzw. Multi-Region, ohne CMEK und ohne Training.
  - Ein Opt-out lässt sich per Formular beantragen.
  - Quelle: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/abuse-monitoring
- **Advanced AI:** 30 Tage Prompt- und Response-Logging. Betrifft laut Seite Claude Mythos/Fable und CVP-Nutzungen, **nicht Gemini Flash**.
- **Grounding:** Google Search speichert bis zu 3 Tage, Google Maps 30 Tage, jeweils nicht abschaltbar. Nur relevant, wenn Grounding genutzt wird.
- **Request-Response-Logging:** standardmäßig aus.

**Explicit Context Caching:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview
- Standard-TTL **60 Minuten**, verlängerbar. Mindestens 1 Minute, **ohne Maximum**. Caches lassen sich löschen.
- Für explizite Caches fallen Speicherkosten an, die Inhalte liegen also persistiert bei Google.
- Ob explizite Caches unter die Residency-Zusage fallen, sagt die Seite nicht ausdrücklich. Die Unterseite „Supported capabilities“ war per curl nicht auswertbar (**nicht verifiziert**).
- **Empfehlung:** In der Datenschutzerklärung bzw. AVV-Anlage die konkret gesetzte TTL nennen.

**Cloud Data Processing Addendum**, Last modified 08.06.2026: https://cloud.google.com/terms/data-processing-addendum
- Ziff. 4.1: „Google is a processor and Customer is a controller or processor“.
- Ziff. 10.1: Verarbeitung dort, wo Google oder Subprozessoren Einrichtungen haben, vorbehaltlich der Standortzusagen.
- In Appendix 3 („Alternative Transfer Solution“, etwa ein Datenschutz-Framework) greifen andernfalls die SCC.
- Welche Google-Gesellschaft Vertragspartner ist (EMEA-Kunden), ist **nicht verifiziert**.

---

## 5. Cookies und LocalStorage nach § 25 TDDDG

- **§ 25 TDDDG**, Primär: https://www.gesetze-im-internet.de/ttdsg/__25.html
  - Abs. 1: Speichern oder Auslesen nur mit Einwilligung.
  - Abs. 2 Nr. 2: keine Einwilligung, wenn „unbedingt erforderlich …, damit der Anbieter eines digitalen Dienstes einen vom Nutzer ausdrücklich gewünschten digitalen Dienst zur Verfügung stellen kann“.
- **DSK, OH Digitale Dienste, Version 1.2, Stand November 2024**, Primär: https://www.datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf
  - Rn. 21: Auch **Local- und Session-Storage** sind „Speicherung von Informationen“.
  - Rn. 22: Auto-Update-Funktionen von Software können unter § 25 fallen. Das ist relevant für die CLI und die Extension.
  - Rn. 78: „unbedingt erforderlich“ ist streng und technisch zu verstehen; wirtschaftliche Erforderlichkeit reicht nicht.
  - Rn. 79: Zeitpunkt, Laufzeit, Inhalt und Domain müssen minimal sein.
  - Rn. 80: Regelmäßige Nutzung darf man nur bei anmeldepflichtigen Diensten unterstellen.
  - Rn. 81: Eine Sprachwahl ohne eindeutige ID, etwa `language: de`, ist erforderlich; eine UID dafür nicht.
  - Rn. 83: **Sicherheitscookies**, die das Login-System schützen, sind unbedingt erforderlich; eine pauschale Etikettierung reicht aber nicht.
  - Rn. 116: „**Einwilligungsbanner nur … wenn tatsächlich eine Einwilligung notwendig ist**“. Sonst entstehe der missverständliche Eindruck einer Wahl.
- **EDPB Guidelines 2/2023** on Technical Scope of Art. 5(3) ePD, v2.0, angenommen 07.10.2024, Primär: https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf
  - Rn. 4: Die Leitlinien behandeln **nicht** die Ausnahmen, die sind national zu beurteilen.
  - Rn. 44: Informationen, die nur im Gerät verarbeitet werden (Cookies, Local Storage), fallen nicht unter Art. 5(3), „as long as the information does not leave the device“. Sobald sie ausgelesen oder übertragen werden, gilt Art. 5(3).

**Einschätzung für unslop:**
- **Unbedingt erforderlich**, also ohne Einwilligung zulässig:
  - Supabase-Auth-Session-Cookies bzw. -Tokens im eingeloggten Dashboard
  - CSRF- und OAuth-State-Cookies
  - ein Locale-Cookie mit reinem Sprachwert, ohne UID (DSK Rn. 81)
  - Theme-Präferenz ohne ID
  - ein vom Nutzer lokal gespeicherter API-Key in CLI oder Extension; der Nutzer wünscht diese Funktion ausdrücklich
- **Einwilligungspflichtig:** Analytics (auch Vercel Web Analytics und Speed Insights, falls genutzt; nicht geprüft), Marketing-Pixel und Telemetrie der Extension.
- Für Extension-Telemetrie schreibt Microsoft zusätzlich vor, `isTelemetryEnabled` zu respektieren: https://code.visualstudio.com/api/extension-guides/telemetry
- **Banner:** Nutzt unslop nur unbedingt erforderliche Speicherungen, ist nach DSK Rn. 116 **kein** Einwilligungsbanner nötig. Informationen dazu gehören dann in die Datenschutzerklärung.
- Die tatsächlichen Cookies der Next.js-App habe ich **nicht im Code geprüft** (nicht Teil dieses Auftrags). → offene Frage.

---

## 6. Waitlist über Brevo mit Double-Opt-In

- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a in Verbindung mit Art. 7. Nach **Art. 7 Abs. 1** muss der Verantwortliche die Einwilligung „nachweisen können“ [BfDI-INFO1]. Bei Werbe-Mails zusätzlich **§ 7 Abs. 2 Nr. 2 UWG**, also vorherige ausdrückliche Einwilligung (Link oben).
  - **Einschätzung:** Eine reine Launch-Benachrichtigung über ein Produkt ist Werbung.
- **BGH, Urteil vom 10.02.2011, I ZR 164/09 („Double-opt-in-Verfahren“):**
  - Leitsatz b: Der Werbende muss die konkrete Einverständniserklärung jedes Verbrauchers „vollständig dokumentier[en]“. Bei elektronischer Erklärung setzt das „deren Speicherung und die jederzeitige Möglichkeit eines Ausdrucks“ voraus.
  - Leitsatz c: Die DOI-Bestätigungsmail belegt **kein** Einverständnis zu Telefonwerbung.
  - Leitsatz d: Nach DOI-Bestätigung trägt der Verbraucher die Darlegungslast, wenn er die E-Mail-Einwilligung bestreitet.
  - Leitsatz e: Weist er nach, dass die Bestätigung nicht von ihm stammt, bleibt die Werbung wettbewerbswidrig.
  - Quelle: **Sekundär**-Wiedergabe des Urteilstexts bei lexetius.com/2011,4717. Die BGH-Datenbank leitete auf die Startseite um; die Primärquelle ist **nicht ladbar**.
- **Brevo-Protokollierung**, Primär/Anbieter: https://help.brevo.com/hc/en-us/articles/208733449-Double-opt-in-DOI-What-it-is-and-how-to-track-user-sign-ups
  - Event-Logs erfassen Formularabsendung, Zeitpunkt und E-Mail.
  - Transaktions-Logs erfassen Versandzeit der DOI-Mail, **Inhalt inkl. Bestätigungslink und Einwilligungstext** sowie die finale Bestätigung.
  - Brevo empfiehlt, die Logs regelmäßig **zu exportieren und zu archivieren**. „Exporting both log types is essential to track the end-to-end DOI process.“
  - Eine IP-Adresse wird auf dieser Seite **nicht** als geloggt genannt.
- **Speicherung des Nachweises (Einschätzung):**
  - Nachweisdaten so lange aufbewahren, wie die Einwilligung genutzt wird, und danach für die Dauer möglicher Rechtsstreitigkeiten.
  - Eine konkrete Frist steht in keiner geöffneten Primärquelle (**nicht verifiziert**). Die Datenschutzerklärung sollte die „Kriterien“ nennen (Art. 13 Abs. 2 lit. a).
- **Pflichtangaben:** Widerruf jederzeit (Art. 13 Abs. 2 lit. c) und Brevo als Auftragsverarbeiter (Sitz Paris, EU).

---

## 7. Speicherdauern

- **Grundsätze:** Art. 5 Abs. 1 lit. e (Speicherbegrenzung) und Art. 13 Abs. 2 lit. a („Dauer … oder … Kriterien“) [BfDI-INFO1].
- **§ 257 Abs. 4 HGB**, Primär: https://www.gesetze-im-internet.de/hgb/__257.html
  - Handelsbücher und Abschlüsse **10 Jahre**
  - **Buchungsbelege 8 Jahre** (bei Kredit-/Finanzinstituten 10 Jahre)
  - Handelsbriefe **6 Jahre**
  - Fristbeginn mit Ende des Kalenderjahres
- **§ 147 Abs. 3 AO**, Primär: https://www.gesetze-im-internet.de/ao_1977/__147.html
  - Unterlagen nach Abs. 1 Nr. 1 und 4a: **10 Jahre**
  - **Buchungsbelege (Nr. 4): 8 Jahre**
  - sonstige: 6 Jahre
  - Verlängerung, solange die Festsetzungsfrist nicht abgelaufen ist
  - Die 8-Jahres-Frist für Buchungsbelege ist damit im **aktuellen Normtext bestätigt**. Die Übergangsregelung (EGAO) für Altbelege ist **nicht verifiziert**.
- **Relevanz für unslop:** Beim MoR-Modell ist Paddle Verkäufer. unslop hält vor allem Paddle-Auszahlungsabrechnungen und eigene Eingangsrechnungen als Buchungsbelege, also 8 Jahre. Personenbezogene Käuferdaten stehen dort nur, soweit Paddle sie ausweist.
- **Vorschlag für Kriterien (Einschätzung):**
  - Account-Daten: bis zur Löschung des Accounts
  - Scan-Ergebnisse und Code-Snippets: nach AVV bzw. Kundenkonfiguration
  - Server-Logs: kurze, feste Frist; die Vercel-Log-Retention ist **nicht geprüft**
  - Waitlist: bis zum Widerruf bzw. Launch plus Nachweisaufbewahrung

---

## 8. Betroffenenrechte und Aufsichtsbehörde

- Art. 15–22 und Art. 77 [BfDI-INFO1].
- **Art. 21 Abs. 4:** Auf das Widerspruchsrecht muss man spätestens bei der ersten Kommunikation „ausdrücklich“ hinweisen, und zwar „in einer verständlichen und von anderen Informationen **getrennten Form**“. Das spricht für einen eigenen, hervorgehobenen Abschnitt.
  - Abs. 1 gilt bei lit. e/f: Widerspruch aus Gründen der besonderen Situation.
  - Abs. 2/3 gelten bei Direktwerbung: Widerspruch jederzeit, ohne Abwägung.
- **Zuständige Aufsicht: Der Hessische Beauftragte für Datenschutz und Informationsfreiheit (HBDI)**
  - vertreten durch Prof. Dr. Alexander Roßnagel
  - **Wilhelmstraße 7, 65185 Wiesbaden**
  - Tel. 0611-1408 0
  - poststelle@datenschutz.hessen.de
  - Online-Beschwerdeformular über https://datenschutz.hessen.de/kontakt
  - Quelle: Impressum https://datenschutz.hessen.de/impressum, Primär
  - Eine Postfachanschrift ist **nicht verifiziert**.
  - Hinweis: Die früher häufig zitierte Anschrift „Gustav-Stresemann-Ring“ steht **nicht** mehr im Impressum. Musterbausteine sind hier also zu prüfen.

---

## 9. Datenschutzbeauftragter

- **§ 38 Abs. 1 BDSG**, Primär: https://www.gesetze-im-internet.de/bdsg_2018/__38.html
  - Satz 1: Benennung, soweit „in der Regel mindestens 20 Personen ständig mit der automatisierten Verarbeitung“ beschäftigt sind.
  - Satz 2: **unabhängig von der Personenzahl**, wenn Verarbeitungen einer DSFA nach Art. 35 unterliegen oder Daten geschäftsmäßig zur Übermittlung bzw. für Markt- und Meinungsforschung verarbeitet werden.
- **Art. 35 Abs. 3:** DSFA insbesondere bei
  - a) systematischer, umfassender Bewertung persönlicher Aspekte mit Rechtswirkung oder ähnlicher Beeinträchtigung
  - b) umfangreicher Verarbeitung besonderer Kategorien
  - c) systematischer umfangreicher Überwachung öffentlich zugänglicher Bereiche
  - [BfDI-INFO1]
- **DSK-Muss-Liste nicht-öffentlicher Bereich, Version 1.1 vom 17.10.2018**, Primär, gehostet beim BayLDA: https://www.lda.bayern.de/media/dsfa_muss_liste_dsk_de.pdf
  - **Nr. 11:** „Einsatz von künstlicher Intelligenz zur Verarbeitung personenbezogener Daten zur Steuerung der Interaktion mit den Betroffenen oder zur Bewertung persönlicher Aspekte der betroffenen Person“. Beispiele: KI-Kundensupport, Stimmungsanalyse von Anrufern.
  - **Nr. 8:** umfangreiche Verarbeitung von Beschäftigtenverhalten zur Bewertung ihrer Arbeitstätigkeit.
- **Einschätzung:**
  - Das KI-Code-Review **bewertet Code**, nicht persönliche Aspekte der Autoren. Personenbezogene Daten (Namen, E-Mails in Commits) sind Beifang, und unslop steuert keine Interaktion mit Betroffenen.
  - Nr. 11 und Art. 35 Abs. 3 lit. a greifen daher **nach meiner Einschätzung nicht**. Voraussetzung: unslop bildet keine Autoren- oder Entwicklerprofile, etwa „Slop-Score pro Entwickler“ oder Rankings.
  - Würde das Produkt Metriken **pro Person** auswerten und würden Arbeitgeber das zur Leistungsbewertung nutzen, rückt Nr. 8 und 11 nahe. Dann DSFA prüfen; die DSFA-Pflicht beträfe primär den Kunden als Verantwortlichen.
  - Als Ein-Personen-UG unterschreitet unslop die Schwelle von 20 Personen. Eine **DSB-Pflicht besteht nach dieser Einschätzung nicht**. Die Angabe nach Art. 13 Abs. 1 lit. b entfällt dann („gegebenenfalls“).
  - Die Muss-Liste ist von 2018. Eine neuere DSK-Fassung habe ich nicht gefunden (**nicht verifiziert**, ob es eine gibt).

---

## 10. Art. 22 und die Blockade eines PR durch den Check Run

- **Art. 22 Abs. 1:** Recht, nicht einer „ausschließlich auf einer automatisierten Verarbeitung … beruhenden **Entscheidung**“ unterworfen zu werden, „die ihr gegenüber rechtliche Wirkung entfaltet oder sie in ähnlicher Weise erheblich beeinträchtigt“ [BfDI-INFO1, S. 165 f.].
- **Einschätzung: in der Regel nicht erfasst.**
  1. Der Gegenstand der Entscheidung ist ein Code-Änderungsvorschlag, keine Bewertung der Person. Der Personenbezug ist nur mittelbar über die Urheberschaft.
  2. Ein fehlgeschlagener Check Run blockiert den Merge nur, wenn der Kunde ihn in den Branch-Protection-Regeln als „required“ konfiguriert. Die Entscheidung trifft also der Kunde bzw. seine Maintainer; sie können übersteuern, neu anstoßen oder die Regel ändern.
  3. Eine „rechtliche Wirkung“ oder „ähnlich erhebliche Beeinträchtigung“ gegenüber dem Autor liegt typischerweise nicht vor.
- **Grenzfall:** Knüpft ein Arbeitgeber arbeitsrechtliche Folgen automatisiert an unslop-Ergebnisse, wäre das eine Verarbeitung des Kunden. Keine Primärquelle hierzu geprüft (**EDPB/WP251 nicht geöffnet**).
- **Empfehlung:** In der Datenschutzerklärung erklären, dass keine automatisierte Entscheidung im Sinne von Art. 22 stattfindet. Dazu die Logik kurz beschreiben (KI-Analyse, Ergebnis als Hinweis oder Check-Status, menschliche Übersteuerung). Das deckt Art. 13 Abs. 2 lit. f vorsorglich ab und dient der Transparenz.

---

## 11. CLI, VS-Code-Extension, MCP und GitHub Marketplace

- **GitHub Marketplace**, Primär: https://docs.github.com/en/apps/github-marketplace/creating-apps-for-github-marketplace/requirements-for-listing-an-app
  - „Listings must have a **valid link to a privacy policy**.“
  - Ebenso verlangt: Kontaktangaben und ein Support-Link bzw. eine Support-E-Mail.
  - Das GitHub Marketplace Developer Agreement verpflichtet in Ziff. 5.2 zur Einhaltung eines Data Protection Addendum: https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement
  - Für eine GitHub App **ohne** Marketplace-Listing habe ich keine Pflicht zu einer Privacy-URL gefunden (**nicht verifiziert**).
- **VS Code Marketplace:** In der Publishing-Doku habe ich keine ausdrückliche Pflicht zu einer Privacy-URL gefunden: https://code.visualstudio.com/api/working-with-extensions/publishing-extension. Das ist **nicht verifiziert**, ob die Marketplace-Publisher-Bedingungen eine verlangen.
  - Für Telemetrie gilt: `isTelemetryEnabled` respektieren; eigene Telemetrie-Settings mit den Tags `telemetry` und `usesOnlineServices` versehen: https://code.visualstudio.com/api/extension-guides/telemetry
- **DSGVO-seitig (Einschätzung):**
  - CLI, Extension und MCP-Server schicken Code an die unslop-API. Für die Account- und Nutzungsdaten ist unslop Verantwortlicher, für den übermittelten Code Auftragsverarbeiter. Art. 13 gilt unabhängig vom Kanal, „zum Zeitpunkt der Erhebung“.
  - **Empfehlung:** Die Datenschutzerklärung in README, Marketplace-Listing, `--help` bzw. beim ersten Start oder Login verlinken. Einen eigenen Abschnitt „Nutzung von CLI, Extension und MCP“ aufnehmen.
  - Lokal gespeicherte API-Keys und Konfiguration: § 25 Abs. 2 Nr. 2 TDDDG. Update-Checks: DSK OH Rn. 22 beachten.

---

## 12. EU AI Act, nur der Bezug zur Datenschutzerklärung

- **EU-Kommission, FAQ zu Art. 50 AI Act**, Primär: https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
  - Art. 50 gilt **ab 02.08.2026**. Eine Schonfrist bis **02.12.2026** gibt es nur für die Kennzeichnungspflicht nach Art. 50 Abs. 2 bei Systemen, die vor dem 02.08.2026 in Verkehr gebracht wurden.
  - Art. 50 Abs. 1: Informieren, wenn Personen mit einem KI-System interagieren, „unless this is obvious“.
  - Art. 50 Abs. 2 (maschinenlesbare Markierung synthetischer Inhalte): Laut Leitlinien sind u. a. **„source code“** und Machine-to-Machine-Outputs ausgenommen, außerdem assistive Standardbearbeitung. Eine enge **B2B-Ausnahme** ist vorgesehen.
  - Art. 50 Abs. 4 betrifft nur Texte, die zur Information der Öffentlichkeit über Angelegenheiten von öffentlichem Interesse veröffentlicht werden. Das ist für PR-Kommentare **nicht einschlägig** (Einschätzung).
- **Sekundär** (Goodwin, Usercentrics u. a., Suchergebnisse): Der „Digital Omnibus“ ist am 27.07.2026 in Kraft getreten, hat die Hochrisiko-Fristen verschoben und Art. 50 nicht angetastet. Nicht primär verifiziert.
- **Empfehlung (Einschätzung):**
  - In der Datenschutzerklärung transparent machen, dass die Analyse mit generativer KI erfolgt (Anbieter Google, Modellfamilie Gemini, Region).
  - Review-Kommentare als KI-generiert kennzeichnen, etwa als „unslop (AI)“. Das erfüllt Art. 50 Abs. 1 vorsorglich, auch wenn es eine Produkt- und keine Datenschutzerklärungspflicht ist.

---

## 13. Gliederungsreferenzen, nur Sekundär

- **Sekundär: datenschutz-generator.de (Dr. Schwenke):** https://datenschutz-generator.de/
  - Grobe Module laut Seitenzusammenfassung: Verantwortlicher, Übersicht der Verarbeitungen, Rechtsgrundlagen, Datenkategorien und Betroffene, Empfänger, Drittlandübermittlung, Speicherdauer, Betroffenenrechte, Cookies, Dienste und Module (auch KI-Dienste), Begriffsdefinitionen.
  - Die Zusammenfassung stammt von einem Hilfsmodell. Die Gliederung ist **nicht im Detail geprüft**; Bausteine wurden nicht übernommen.
- **Sekundär: eRecht24, Muster-Datenschutzerklärung:** https://www.e-recht24.de/muster-datenschutzerklaerung.html
  - Grobe Gliederung laut Seitenzusammenfassung: Allgemeines, verantwortliche Stelle, DSB, Rechtsgrundlagen, Server-Logfiles, Cookies, Analyse, Newsletter, Zahlungsdienstleister, Betroffenenrechte, Widerspruch, Widerruf, Beschwerde.
  - Ebenfalls **nicht im Detail geprüft**.

---

## (a) Gliederungsvorschlag für die Datenschutzerklärung von unslop

1. **Verantwortlicher:** unslop UG (haftungsbeschränkt), Anschrift Bebra, Vertretung, E-Mail. Angabe, dass kein DSB benannt ist, weil keine Pflicht besteht (§ 38 BDSG).
2. **Überblick und Rollen:** Wo unslop Verantwortlicher ist (Website, Account, Billing, Waitlist, Support) und wo Auftragsverarbeiter (Code-Analyse für Kunden). Verweis auf AVV und Subprozessorenliste.
3. **Besuch der Website:** Hosting und Server-Logs (Vercel), Rechtsgrundlage lit. f, Speicherdauer.
4. **Cookies und lokale Speicherung:** Liste der unbedingt erforderlichen Einträge (Auth-Session, CSRF/OAuth-State, Locale, Theme) mit Zweck, Laufzeit und Domain. Ausdrücklicher Satz, dass keine einwilligungspflichtigen Speicherungen stattfinden und deshalb kein Banner nötig ist, falls das zutrifft (§ 25 Abs. 2 Nr. 2 TDDDG; DSK OH Rn. 116).
5. **Registrierung, Login mit GitHub (OAuth), Dashboard:** Datenkategorien, Quelle GitHub, lit. b, Supabase (Region, SCC).
6. **GitHub App:** Welche Berechtigungen, welche Daten (Diffs, Metadaten, Kommentare), Check Runs und Review-Kommentare, Rolle als Auftragsverarbeiter. Hinweis an Dritte in Kunden-Repos, dass ihr Ansprechpartner der Kunde ist.
7. **CLI, VS-Code-Extension, MCP-Server:** Übermittlung von Code an die API, API-Keys, lokale Speicherung, Telemetrie (falls vorhanden, nur mit Opt-in bzw. `isTelemetryEnabled`), Update-Checks.
8. **KI-Analyse mit Google Vertex AI (Gemini):**
   - EU-Multiregion als Standard
   - Ausnahme: der globale Endpoint beim Fallback, mit weltweiter Verarbeitung (DPF/SCC)
   - kein Training
   - In-Memory-Cache 24 h
   - Explicit Context Cache mit TTL
   - Abuse-Logging bis 90 Tage (bzw. Status des Opt-outs)
   - Transparenzhinweis zum KI-Einsatz
9. **Keine automatisierte Entscheidung nach Art. 22:** Erklärung zu Check Run und Branch-Protection.
10. **Zahlungen über Paddle (MoR):** Paddle als eigener Verantwortlicher, Link zur Paddle-Datenschutzerklärung, welche Daten unslop von Paddle erhält und warum.
11. **Waitlist und E-Mail-Benachrichtigungen (Brevo, DOI):** Einwilligung, Protokollierung, Widerruf, Speicherdauer des Nachweises.
12. **Kontakt und Support per E-Mail (Proton):** Rechtsgrundlage, Schweiz mit Angemessenheitsbeschluss.
13. **Empfänger und Auftragsverarbeiter:** Tabelle wie (b) unten.
14. **Drittlandübermittlungen:** DPF (Stand, Hinweis auf anhängiges C-703/25 P ist optional), SCC 2021/914, UK- und Schweiz-Angemessenheit, wie man eine Kopie erhält (Art. 13 Abs. 1 lit. f).
15. **Speicherdauern bzw. Kriterien:** inkl. 8/10 Jahre nach § 257 HGB und § 147 AO für Buchungsbelege.
16. **Pflicht zur Bereitstellung (Art. 13 Abs. 2 lit. e).**
17. **Ihre Rechte (Art. 15–20), Widerruf von Einwilligungen.**
18. **Widerspruchsrecht nach Art. 21:** eigener, optisch getrennter Kasten (Art. 21 Abs. 4).
19. **Beschwerderecht:** HBDI, Wilhelmstraße 7, 65185 Wiesbaden, poststelle@datenschutz.hessen.de.
20. **Änderungen und Stand.**
21. **Englische Fassung**, mit Hinweis, welche Fassung maßgeblich ist.

---

## (b) Anbieter → Rolle → Sitz → Übermittlungsgrundlage → Quelle

| Anbieter | Rolle ggü. unslop | Sitz (Vertragspartner) | Übermittlungsgrundlage | Quelle (abgerufen 2026-09-28) |
|---|---|---|---|---|
| Vercel Inc. | Auftragsverarbeiter (Hosting, Logs) | Delaware Corp., 440 N Barranca Ave #4133, Covina, CA, USA | **DPF aktiv** (EU, UK, CH; HR und Non-HR; fällig 04/29/2027) sowie SCC 2021/914 (Module 1–3) und UK IDTA im DPA | dataprivacyframework.gov (Profil Vercel Inc.); https://vercel.com/legal/dpa (Last Updated 17.03.2026) |
| Supabase Pte. Ltd | Auftragsverarbeiter (DB, Auth, Storage) | Singapur | **SCC Modul 2/3**, UK Addendum, Swiss Addendum; Region nach Kundenwahl; **nicht DPF-gelistet** | https://supabase.com/legal/dpa (v1, 01.08.2026); DPF-Suche ohne Treffer |
| Google (Vertex AI) | Auftragsverarbeiter (KI-Inferenz, Context Cache) | Vertragsgesellschaft **nicht verifiziert**; Google LLC (USA) ist DPF-zertifiziert | Standard: EU-Multiregion ohne Drittlandtransfer bei der ML-Verarbeitung; beim Global-Fallback weltweit, dann **DPF aktiv** (Google LLC, fällig 09/13/2027) oder SCC nach CDPA | Data-Residency-, ZDR- und Abuse-Seiten (Stand 25.09.2026); CDPA (08.06.2026); DPF-Profil Google LLC |
| GitHub, Inc. | eigener Verantwortlicher (Plattform/OAuth); Datenquelle für unslop | San Francisco, USA | **DPF aktiv** (EU, UK, CH; **nur Non-HR**; fällig 08/03/2027) | DPF-Profil GitHub |
| Paddle (Paddle.com Market Ltd u. a.) | **eigener Verantwortlicher** (MoR); Controller-to-Controller-Weitergabe an unslop | UK (London); weitere Gesellschaften in USA, Irland, Kanada | UK: Angemessenheitsbeschluss (im Dez. 2025 verlängert; Laufzeit bis 27.12.2031 nur sekundär belegt). USA: **nicht DPF-gelistet**, daher SCC laut Data Sharing Addendum | https://www.paddle.com/legal/privacy (16.03.2026); /legal/data-sharing-addendum; /legal/gdpr; Kommissionsseite zu Angemessenheitsbeschlüssen |
| Brevo (Sendinblue SAS) | Auftragsverarbeiter (Waitlist/DOI) | Paris, Frankreich (EU) | keine Drittlandübermittlung für den Kern; Unterauftragnehmer Sendinblue Inc. (USA) laut Brevo über DPF und SCC | https://www.brevo.com/legal/termsofuse/; https://www.brevo.com/legal/privacypolicy/ |
| Proton AG | Auftragsverarbeiter (E-Mail) | Plan-les-Ouates, Genf, Schweiz | **Angemessenheitsbeschluss Schweiz** | https://proton.me/legal/privacy (12.05.2026); Kommissionsseite |
| Microsoft Corp. | nur relevant, falls genutzt (VS Code Marketplace ist eigener Verantwortlicher) | Redmond, USA | DPF „Active – Re-certification under Review“ | DPF-Listenansicht |

---

## (c) Offene Fragen

1. **Eigene Zwecke mit Kundencode:** Nutzt unslop Diffs, Snippets oder Ergebnisse für Benchmarks, Fixtures, Regel-Tuning oder Qualitätsanalysen (z. B. `fixtures/rule-recall`)? Dann ist unslop insoweit Verantwortlicher (Art. 28 Abs. 10; EDPB Rn. 81). Das braucht eine eigene Rechtsgrundlage, Art.-14-Transparenz und eine Regelung im AVV.
2. **Gibt es einen AVV bzw. ein DPA für Kunden** (Art. 28 Abs. 3) und eine veröffentlichte Subprozessorenliste? Ohne AVV trägt die Rollenaussage „Auftragsverarbeiter“ nicht.
3. **Supabase-Projektregion** von `ypjgdqkrsnetiiosspix` (EU, z. B. Frankfurt?) und Inhalt der Subprozessoren-PDF (AWS?).
4. **Google-Vertragsgesellschaft** (Google Cloud EMEA Ltd?) und ob unslop unter den GCP Terms of Service läuft, also im Scope des Abuse-Prompt-Loggings (90 Tage). Ist ein Opt-out beantragt? Ist der In-Memory-Cache aktiv?
5. **Explicit-Context-Cache:** Welche TTL ist gesetzt, und enthält das gecachte Präfix Kundencode oder nur Regeln und Prompt? Falls nur statische Regeln gecacht werden, ist das datenschutzrechtlich unkritisch.
6. **Wie oft wird der Global-Fallback (`UNSLOP_ESCALATION_LEGACY_PRO`) tatsächlich genutzt**, und soll er nach der EOL-Bereinigung ganz entfallen? Davon hängt ab, ob die Datenschutzerklärung „weltweite Verarbeitung“ nennen muss.
7. **Tatsächliche Cookies und Storage-Einträge** der Next.js-App: Supabase-Auth-Cookie-Namen und Laufzeit, Locale-Cookie, Vercel Analytics oder Speed Insights ja/nein. Ohne diese Prüfung ist die Aussage „kein Banner nötig“ nicht belegt.
8. **Telemetrie und Update-Checks** in CLI, Extension und MCP: gibt es sie? Wenn ja, § 25 TDDDG, DSK OH Rn. 22 und VS-Code-Telemetrieregeln beachten.
9. **Paddle-Vertragspartner** für unslop (Market Ltd UK oder Inc. USA?) und welche Käuferdaten unslop konkret erhält bzw. speichert (Webhooks in Supabase?).
10. **Log-Retention** bei Vercel und Supabase, damit sich konkrete Fristen angeben lassen.
11. **Inhalt des EuGH-Beschlusses vom 04.06.2026** in C-703/25 P (ECLI:EU:C:2026:465): nicht öffnbar, **nicht verifiziert**.
12. **PCLOB-Besetzung 2026:** nur sekundär belegt.
13. **Primärtext BGH I ZR 164/09** und EUR-Lex-Texte (DSGVO-Originalfundstelle, 2021/914, DPF-Beschlussnummer, UK-Verlängerung 2025/2574): nicht ladbar bzw. nur über die BfDI-Textausgabe oder Sekundärquellen belegt.
14. **Personenbezogene Metriken** (Slop-Score je Entwickler, Ranking)? Falls geplant, DSFA-Frage (DSK-Muss-Liste Nr. 8/11) und Art. 22 neu prüfen.
15. **Anschrift in der Datenschutzerklärung:** Die UG ist noch nicht im Handelsregister eingetragen (Gründung läuft). Der Verantwortliche und seine Anschrift müssen zum Veröffentlichungszeitpunkt stimmen.
