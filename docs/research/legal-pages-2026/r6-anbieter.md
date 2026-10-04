# Research 6 – Anbieter-Fakten für Datenschutzerklärung und AVV (unslop)

**Abrufdatum aller Quellen: 2026-09-28** (sofern nicht anders vermerkt). Nur Primärquellen des Anbieters bzw. von Behörden. Sekundäres ist als „Sekundär“ markiert. Was nicht belegbar war, steht als **„nicht verifiziert“** im Text.

> Methodik DPF: Die Liste auf dataprivacyframework.gov ist eine JavaScript-App. Abgefragt wurde deshalb die öffentliche JSON-API, die die Seite selbst nutzt (`POST https://dpfapi.azurewebsites.net/api/participants` mit `Search`/`Status`, Details über `GET …/api/participants/{OrganizationId}`). Den API-Endpunkt habe ich aus dem Seiten-Bundle `https://www.dataprivacyframework.gov/assets/index-DHP4VEMY.js` ausgelesen. Die Felder `InstallDate` und `UsageEndDate` gebe ich roh wieder. Dass `UsageEndDate` die nächste Rezertifizierungsfrist ist, ist meine Interpretation und nicht amtlich bestätigt.

---

## 1. Vercel (Hosting, Serverless Functions)

**Vertragsentität**
- **Vercel Inc.**, Delaware corporation, 440 N Barranca Ave #4133, Covina, CA 91723, USA. Quelle: DPA, https://vercel.com/legal/dpa. In den ToS (https://vercel.com/legal/terms, „Last Updated June 1, 2026“) heißt es wörtlich: "Vercel Inc." … provides access to Vercel's Services. Eine EU-Vertragsentität nennt die Privacy Notice nicht (https://vercel.com/legal/privacy-policy, Effective Date June 1, 2026).
- Anwendbares Recht der ToS: Kalifornien ("governed by the laws of the State of California").

**DPA/AVV**
- URL: https://vercel.com/legal/dpa. Stand: „Last Updated March 17, 2026“, „Effective Date March 31, 2026“.
- Abschluss: Es gibt keinen separaten Klick. Die ToS verweisen per Inkorporation: "We will process the personal information in Your Content, Account Information, and System Data as a data controller or data processor in accordance with Vercel's Data Processing Addendum ("DPA"), which is incorporated by reference" (https://vercel.com/legal/terms). Im DPA selbst: "This Addendum shall become legally binding upon Customer entering into the Agreement or upon execution of this Addendum."
- **🔴 Geltungsbereich:** Das DPA sagt selbst: "This Addendum applies to Vercel's Processing of Personal Data as a Processor under the Agreement for Customers who are on **Enterprise and Pro plans**." Für den **Hobby-Plan** ist die AVV-Abdeckung damit fraglich. Hinzu kommen zwei ToS-Klauseln:
  - "You shall only use the Services under a Hobby plan for your personal or **non-commercial use**."
  - "if you are on a Hobby plan or trial Pro plan, you agree that we may use Your Content to **train our artificial intelligence ("AI") and machine learning models**, and we may share Your Content with third parties … If you are on a paid Pro plan, Model Training is not enabled by default … You may opt-out of Model Training at any time by adjusting your Team account settings" (https://vercel.com/legal/terms).
  - **Folgerung (eigene Wertung):** Ein kommerzieller Betrieb von unslop auf Hobby widerspricht den ToS, das DPA greift laut Wortlaut nicht, und Model Training ist per Default aktiv. Welcher Plan aktuell genutzt wird, muss der User prüfen.
- SCC: Die 2021er SCC sind inkorporiert, mit Module One (C2C), Two (C2P) und Three (P2P). Wortlaut: "By entering into the Agreement, Data Exporter is deemed to have signed these Standard Contractual Clauses". Für UK gilt das UK IDTA ("UK IDTA will be deemed entered into"). Schweiz ist über Schedule 3 abgedeckt (https://vercel.com/legal/dpa).
- Das DPA erwähnt das DPF nicht (Volltext durchsucht nach „Privacy Framework“/„DPF“, kein Treffer).

**Drittland-Grundlage**
- **DPF: Vercel Inc. ist aktiv.** Quelle ist die DPF-API (OrganizationId 6847, LegalName „Vercel Inc.“, Covina CA):
  - EU-US: Active, HR- und Non-HR-Daten, InstallDate 2019-06-20, UsageEndDate 2027-04-29.
  - Swiss-US: Active, gleiche Daten.
  - UK Extension: Active, InstallDate 2024-05-06, UsageEndDate 2027-04-29.
- Vercel bestätigt das selbst: "Vercel is certified under the EU-U.S. Data Privacy Framework" (https://vercel.com/docs/security/compliance, last_updated 2026-09-08) sowie in der Privacy Notice.
- Das DPA sagt: "as of the Effective Date, Vercel's primary processing facilities are in the United States … may … transfer and process Customer Data to and in the United States and anywhere else in the world".

**Regionen**
- 19 Compute-Regionen, darunter **fra1 = eu-central-1 Frankfurt**, außerdem cdg1, dub1, arn1 und lhr1. Default für Functions ist **iad1 (Washington, D.C.)** "for all new projects". Die Region lässt sich über die Projekt-Settings, `vercel.json` `"regions"` oder die CLI ändern (https://vercel.com/docs/regions, last_updated 2026-08-11; https://vercel.com/docs/functions/configuring-functions/region).
- Das Edge-Netz ist global: "over 126 PoPs"; "TLS termination: The Vercel region the request is routed to handles TLS". "Vercel deploys Routing Middleware to all regions by default, regardless of your region settings" (dieselben Quellen).
- Failover-Reihenfolge der Default-Region iad1: fra1 steht erst auf P8 (https://vercel.com/docs/regions).
- Zum Datenort sagt die Compliance-Seite: "The default location for Vercel functions is the U.S. … Additionally, Vercel may transfer data to and in the United States and anywhere else in the world". Weiter: "Our core database and data plane is a globally replicated database". Backups werden alle 2 h erstellt und 30 Tage gehalten, "globally replicated" (https://vercel.com/docs/security/compliance).
- Wo Build- und Runtime-Logs gespeichert werden, ist **nicht verifiziert**. Eine explizite Regionsangabe habe ich nicht gefunden.

**Web Analytics / Speed Insights** (nur relevant, falls genutzt)
- Web Analytics arbeitet "without using any third-party cookies, instead end users are identified by a hash created from the incoming request. The lifespan of a visitor session … is automatically discarded after 24 hours." Datenpunkte sind Zeitstempel, URL, Referrer, gefilterte Query-Params, Geolocation, OS, Browser und Gerätetyp (https://vercel.com/docs/analytics/privacy-policy, last_updated 2026-06-26).
- Speed Insights: "does not collect or store information that would enable us to reconstruct a browsing session … or identify a user". Erfasst werden Route/URL, Netz, Browser, Gerät, Land und Web Vitals (https://vercel.com/docs/speed-insights/privacy-policy, last_updated 2026-03-18).

**Zertifikate**
- "Vercel has a SOC 2 Type 2 attestation for Security, Confidentiality, and Availability" und "Vercel is ISO 27001:2022 certified". Zertifikat: https://www.schellman.com/certificate-directory?certificateNumber=1868222-4. Dazu kommen PCI DSS (SAQ-D/SAQ-A AOC), HIPAA-BAA und TISAX AL2 (https://vercel.com/docs/security/compliance).
- Das Trust Center https://security.vercel.com listet SOC 2 Type 2 (2026-Report, Schellman), SOC 3 und ISO/IEC 27001:2022. Diese Angaben habe ich über WebFetch zusammengefasst, nicht wörtlich.

**Subprozessoren**
- https://security.vercel.com (laut DPA: "A list of Vercel's Subprocessors, including their functions and locations, is available at https://security.vercel.com").
- Sichtbar waren u. a. AWS, Google Cloud, Microsoft Azure, Datadog, Honeycomb sowie KI-Anbieter (SpaceXAI LLC, Cerebras, Baseten, Fireworks AI, Groq). Das ist eine Zusammenfassung per WebFetch. Die vollständige Liste mit Standorten ist **nicht verifiziert**.

---

## 2. Supabase (Postgres, Auth, Storage)

**Vertragsentität**
- **🔴 Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513.** Quellen: ToS https://supabase.com/terms und DPA https://supabase.com/legal/dpa.
- Das ist also **nicht** Supabase, Inc. (USA) und keine EU-Entität. Supabase, Inc. taucht in der Subprozessorliste auf ("Provision of support services").
- Anwendbares Recht der ToS: Kalifornien. Ein Stand-Datum der ToS stand im abgerufenen Inhalt nicht (**nicht verifiziert**).

**DPA/AVV**
- URL: https://supabase.com/legal/dpa, „Version 1 — August 1, 2026“.
- Abschluss automatisch. ToS: "The Parties agree to comply with the Data Processing Addendum, which is incorporated into this Agreement." DPA: "acceptance of the Agreement shall have the same effect as signing the SCCs."
- SCC: Module Two (C2P) und Three (P2P), Module One und Four für sonstige Fälle. UK: "template addendum, version B.1.0 issued by the UK Information Commissioner" (Schedule 2). Kein Hinweis auf das DPF.
- Datenort laut DPA: "Supabase may Process Covered Data anywhere that Supabase or its Sub-processors maintain facilities" und "Where Customer directs Supabase to Process Covered Data in a specific geographical region, Supabase shall ensure that such Covered Data is stored and primarily Processed in that region."
- Subprozessor-Änderungen werden 30 Tage vorab angekündigt, Widerspruch ist innerhalb von 5 Tagen möglich (WebFetch-Zusammenfassung des DPA).

**Drittland-Grundlage**
- Singapur hat **keinen** EU-Angemessenheitsbeschluss. Die Liste auf https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en enthält Singapur nicht. Grundlage ist damit **SCC** (im DPA inkorporiert).
- DPF: Die API-Suche nach „Supabase“ (Active und alle Status) ergab **0 Treffer**. Supabase, Inc. ist also nicht DPF-zertifiziert (Stand 2026-09-28).

**Regionen**
- EU-Regionen: eu-central-1 (Frankfurt), eu-west-1 (Irland), eu-west-2 (London), eu-west-3 (Paris), eu-central-2 (Zürich), eu-north-1 (Stockholm) (https://supabase.com/docs/guides/platform/regions). Die Doku sagt: "Region selection is a data-location control, not proof of regulatory compliance".
- Zum Umfang der Region: "your Postgres database, Auth service, and Storage objects are hosted in that region" (https://supabase.com/security, WebFetch-Zitat).
- Logs, Backups und Edge Functions: Die Doku nennt sie nur als Risikofaktoren ("Backups, logs, data exported to external systems, Edge Function execution, and sub-processors can affect your data residency", https://supabase.com/docs/guides/security/gdpr-compliance). **Wo Logs (Logflare) und Backups verarbeitet werden, ist nicht verifiziert.** Retention "depends on your pricing plan" (https://supabase.com/docs/guides/telemetry/logs).

**Zertifikate**
- "Supabase is SOC 2 Type 2 compliant", "Supabase is ISO 27001 certified" und "HIPAA compliant". Berichte und Zertifikat gibt es für Team/Enterprise im Dashboard (https://supabase.com/security, WebFetch-Zitat).

**Subprozessoren**
- https://supabase.com/legal/customer-resources/subprocessor-list, PDF „Subprocessor List – Updated June 1, 2026“: https://supabase.com/legal/subprocessor-list/June-1-2026.pdf (vollständig gelesen).
- Enthaltene Firmen: Supabase, Inc. (Support), ActiveCampaign/Postmark, **Amazon Web Services** (Hosting), Atlassian (Statuspage), Braintrust, Clay Labs, Clazar, **Cloudflare** (Hosting), ConfigCat Kft., **Google LLC** (Hosting), **Fly.io** (Hosting), FrontApp, Sentry, **GitHub, Inc.** ("Authorized Users account authentication"), Hex, HubSpot, Notion, Sublime Security, Latacora, **OpenAI, LLC** ("natural language processing and generation services"), PandaDoc, Slack, Upstash, Vercel.
- Das PDF nennt **keine Standorte** der Subprozessoren.

---

## 3. Google Cloud Vertex AI („Gemini Enterprise Agent Platform, formerly Vertex AI“)

Hinweis: Google hat Vertex AI umbenannt. Die Doku-Seiten tragen jetzt den Titel „Gemini Enterprise Agent Platform“ (Subprozessorliste: "AI Platform/Gemini Enterprise Agent Platform (formerly Vertex AI)").

**Vertragsentität**
- Für „EMEA except France, Italy and Poland“ ist es **Google Cloud EMEA Limited, 70 Sir John Rogerson’s Quay, Dublin 2, Ireland** (https://cloud.google.com/terms/google-entity, „Last modified June 30, 2026“). Für eine deutsche UG heißt das: Vertragspartner ist Google Cloud EMEA Ltd. (Irland, EU).

**DPA/AVV (Cloud Data Processing Addendum, CDPA)**
- URL: https://cloud.google.com/terms/data-processing-addendum, „Last modified June 8, 2026“.
- Abschluss: "This Cloud Data Processing Addendum … is incorporated into the Agreement(s) … between Google and Customer." "Addendum Effective Date" ist "the date on which Customer accepted, or the parties otherwise agreed to, this Addendum". Es wird also mit den GCP-Nutzungsbedingungen akzeptiert.
- Datenort: "Customer Data may be processed in any country where Google or its Subprocessors maintain facilities", vorbehaltlich der Data-Location-Zusagen in den Service Specific Terms (CDPA §10.1).
- Transfers (CDPA, European Data Protection Law terms §4.1): Transfers in ein „Adequate Country“ brauchen keine SCC. Für Restricted Transfers gilt entweder eine „Alternative Transfer Solution“ (z. B. "a data protection framework recognized as ensuring … adequate protection"), oder SCC. Weil die Google-Adresse in Irland (EU) liegt, gelten für die Weitergabe an Subprozessoren die "SCCs (Processor-to-Processor, Google Exporter)" (https://cloud.google.com/terms/sccs/eu-p2p-google-exporter).
- DPF: **Google LLC ist aktiv** (DPF-API, OrganizationId 5780): EU-US Active (InstallDate 2016-09-22), Swiss-US Active, UK Extension Active, jeweils HR- und Non-HR-Daten, UsageEndDate 2027-09-13. Scope laut Eintrag: "Google LLC and its wholly-owned U.S. subsidiaries". Die Google Cloud Privacy Notice ist als Policy hinterlegt.

**Training**
- Service Specific Terms, Abschnitt **18 „Training Restriction (formerly Section 17 (Training Restriction))“**: "Google will not use Customer Data to train or fine-tune any AI/ML models without Customer's prior permission or instruction." (https://cloud.google.com/terms/service-terms, „Last modified September 24, 2026“)
- Die Doku ergänzt: "This applies to all managed models on Gemini Enterprise Agent Platform, including GA and pre-GA models." (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance, Last updated 2026-09-25)

**Aufbewahrung / Caching / Abuse Monitoring** (alle Zitate aus https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance, Last updated 2026-09-25)
- **In-memory-Caching (Default an):** "By default, Google's published Gemini models cache Customer Data (inputs, outputs, and derived data) in-memory to reduce latency and accelerate responses. This data is stored only in-memory (not at-rest), is isolated at the project level, and has a 24-hour TTL. Cached data … adheres to all Data Residency requirements for the selected location and does not violate zero data retention. This feature can be disabled at the project level." Das geht per `PATCH …/v1/projects/PROJECT_ID/cacheConfig` mit `"disableCache": true`. "the change applies to all Google Cloud regions."
- **Prompt-Logging für Abuse Monitoring:** "Only customers whose use of Google Cloud is governed by the Google Cloud Platform Terms of Service are subject to prompt logging for abuse monitoring. If you are in scope … and want zero data retention, you can request an exception." Details stehen auf https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/abuse-monitoring:
  - "If automated safety classifiers detect suspicious activity … Google may log customer prompts solely for the purpose of examining whether a violation of the AUP or Prohibited Use Policy has occurred. This data won't be used to train or fine-tune any AI/ML models. This data is stored securely for **up to 90 days in the same region or multi-region selected by the customer** … Prompt logs for the purposes of abuse monitoring are not encrypted by Customer-managed encryption keys (CMEK)."
  - "customers with a Google Cloud Master Agreement are exempt from prompt logging for this abuse monitoring by default."
  - Opt-out: "Customers may request for an exception by filling out this form. If approved, Google won't store any prompts".
  - Vertragliche Grundlage: GCP ToS §4.3 „Generative AI Safety and Abuse for GCP Services“ (https://cloud.google.com/terms, „Last modified September 2, 2026“).
- **„Advanced AI“-Logging (30 Tage):** Gilt nur für Modelle, die als „Advanced AI“ eingestuft sind. Genannt werden Claude Mythos, Claude Fable und Claude Opus ≥4.7/Sonnet ≥5 im CVP. **Gemini-Modelle stehen nicht auf dieser Liste** (abuse-monitoring-Seite). Die Consent-Pflicht nach dem Advanced AI Safety Addendum gilt pro Projekt.
- **Explicit Context Caching:** "Update a context cache's expiration time (Time to Live, or TTL) past the default 60 minutes." Mindest-TTL 1 Minute; "There isn't a maximum cache duration". "For explicit caching, there are also storage costs based on how long caches are stored." "Explicit caches interact with implicit caching, potentially leading to additional caching beyond the specified contents when creating a cache. To prevent cache data retention, disable implicit caching and avoid creating explicit caches." (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview, Last updated 2026-09-25)
  - Gespeichert bleibt also bis zum Ablauf der TTL oder bis zum Löschen. Explicit Caching wird u. a. für Gemini 3.8 Flash, 3.6 Flash, 3.1 Pro (preview) und 2.5 Flash unterstützt.
- **Request-Response-Logging (BigQuery):** "disabled by default … To achieve zero data retention, do not enable this feature."
- **Grounding mit Google Search:** Logs mit "queries derived from End User prompts and contextual information … for up to three (3) days … There is no way to disable the storage". Grounding with Google Maps: 30 Tage. Ob unslop Grounding nutzt, ist **nicht verifiziert** (Code nicht geprüft; laut Auftrag nicht Teil der Recherche).
- **Interactions API:** `store` ist per Default true. Für ZDR muss `store = false` gesetzt werden. Nur relevant, wenn diese API genutzt wird.

**Datenregionen** (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency, Last updated 2026-09-25)
- Multi-Region „eu“: "When you use jurisdictional endpoints, ML processing stays within that specific geographical region (such as the United States or the European Union)." Wichtig: "The European Union multi-region (eu) endpoint strictly covers data residency within EU member states. Geographies outside the European Union political boundary, including the United Kingdom and Switzerland, are excluded from this endpoint."
- Laut Modelltabelle (Häkchen „EU multi-region“ ausgelesen) ist ML-Processing in der EU-Multiregion zugesagt für **gemini-3.8-flash ✅**, **gemini-3.6-flash ✅**, 3.7-flash, 3.5-flash(-lite), 3.1-flash-lite und 2.5-flash/pro.
- **gemini-2.5-flash, 128k in Germany (europe-west3): ✅** (lokale Verarbeitung in DE). Für 2.5 Flash 1M ist Germany **nicht** angehakt.
- **gemini-3.1-pro-preview steht nicht in der Tabelle.** Damit gibt es keine Residency-Zusage.
- **Global-Endpoint:** "Requests submitted to a global endpoint may be processed in any Google Cloud location around the world, and therefore don't provide any data residency guarantees." Und: "Global endpoints route and process data anywhere globally … they don't provide regional isolation or data residency guarantees."
  - Folge für unslop: Der Rollback-Pfad `UNSLOP_ESCALATION_LEGACY_PRO` (3.1-pro-preview, global) bedeutet Verarbeitung potenziell weltweit, auch in den USA. Das muss in die DSE bzw. den AVV.
- Data-at-rest: "Data stored at rest in the customer selected location remains at rest in that location, independent of the Agent Platform endpoint called".
- Unterstützte Funktionen (https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/supported-capabilities, Last updated 2026-09-25):
  - "Jurisdictional multi-region endpoints … are designed exclusively for the Gemini 3 family … Older models (like Gemini 2.5 and earlier) are not supported on these endpoints."
  - Tabelle: **Context caching = Supported** auf Jurisdictional-Multi-Region-Endpoints. Grounding with Google Search ist dort nicht unterstützt.
  - "If a capability is not explicitly listed, ML processing is not guaranteed to occur in a specific location."

**Zertifikate**
- https://cloud.google.com/security/compliance/services-in-scope: „Gemini Enterprise Agent Platform“ ist in Scope für ISO 27001/27017/27018, SOC 1/2/3, PCI DSS und Pentest. „Generative AI on Vertex AI“ ist in Scope für ISO 27001/27017/27018 und SOC 1/2/3.
- https://cloud.google.com/security/compliance/iso-27001: "The Google Cloud Services ISMS has received an accredited ISO/IEC 27001 certification"; die Liste enthält "Gemini Enterprise Agent Platform (formerly Vertex AI Platform)".

**Subprozessoren**
- https://cloud.google.com/terms/subprocessors („Previous versions (Last modified August 20, 2026)“). Die Liste enthält Spalten für Land der Verarbeitung und Region sowie eigene Einträge für „AI Platform/Gemini Enterprise Agent Platform (formerly Vertex AI), Generative AI Services …“. Nicht einzeln ausgewertet.

---

## 4. GitHub (GitHub App, Webhooks, Checks, PR-Reviews, OAuth-Login)

**Entitäten**
- ToS (https://docs.github.com/en/site-policy/github-terms/github-terms-of-service, Effective April 27, 2026): "'GitHub,' 'We,' and 'Us' refer to GitHub, Inc.". Die ToS enthalten keine DPA-Inkorporation.
- Privacy Statement (https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement, Effective April 27, 2026): "It applies to the Personal Data that **GitHub, Inc. or GitHub B.V.**, processes as the “Data Controller” …". Adressen: GitHub B.V., Prins Bernhardplein 200, Amsterdam 1097JB, und GitHub, Inc., 88 Colin P. Kelly Jr. St., San Francisco. Welche der beiden Entitäten für EEA-Nutzer Verantwortlicher ist, sagt das Statement **nicht eindeutig** (nicht verifiziert).
- **Rolle für unslop (eigene Wertung):** GitHub ist bei Account und Plattform eigener Verantwortlicher. unslop als GitHub App erhält Daten auf Weisung der Nutzer. Das Statement sagt dazu: "Upon your instruction, we may share Personal Data with third-party applications available on our Marketplace. You are responsible for the data you instruct us to share with these applications." und "When you use third-party extensions, integrations … the privacy policies of these third parties apply".

**DPA**
- https://github.com/customer-terms/github-data-protection-agreement (Version October 2025). Es "forms part of the GitHub Customer Agreement between Customer ('You') and GitHub, Inc.". SCC Module One/Two/Three sowie UK/Swiss sind enthalten, das DPF wird referenziert.
- Relevant ist es nur, wenn unslop selbst GitHub-Kunde unter dem Customer Agreement ist (z. B. eine Org mit Paid-Plan). Für die App-Beziehung zu fremden Repos ist es nicht der passende Rahmen (eigene Wertung).

**DPF**
- **GitHub aktiv** (DPF-API, OrganizationId 6174, LegalName „GitHub“, San Francisco): EU-US Active (InstallDate 2017-01-26), Swiss-US Active und UK Extension Active, nur **Non-HR-Daten**, UsageEndDate 2027-08-03.
- Das Privacy Statement sagt: "GitHub has certified to the U.S. Department of Commerce that it adheres to the EU-U.S. Data Privacy Framework Principles".

**Was die App erhält**
- Gemeinsame Payload-Objekte (https://docs.github.com/en/webhooks/webhook-events-and-payloads):
  - `sender` ("A GitHub user": login, id, avatar_url usw.)
  - `repository`
  - `installation` ("Webhook payloads contain the installation property when the event is configured for and sent to a GitHub App")
  - `organization`
- push-Event: `commits` ("An array of commit objects … maximum of 2048 commits"), `head_commit` und `pusher` ("Metaproperties for Git author/committer information").
- Das Schema der Author/Committer-Metadaten im GitHub-Repo octokit/webhooks (Schema-Repo der GitHub-Org, als Entwickler-Schema Sekundär-nah) enthält `name` ("The git author's name.") und `email` ("The git author's email address.", string oder null) als required, dazu `username` und `date`. Quelle: https://raw.githubusercontent.com/octokit/webhooks/main/payload-schemas/api.github.com/common/committer.schema.json.
- **Folge:** Webhook-Payloads können Git-Autor-E-Mail-Adressen enthalten. Ob unslop das push-Event abonniert, ist **nicht verifiziert** (App-Konfiguration nicht geprüft). pull_request-Payloads enthalten `user`- bzw. `assignee`-Objekte (Login, ID, Avatar).
- Diff- und Code-Inhalte (Quellcode, ggf. mit personenbezogenen Daten) kommen über API-Abrufe dazu.

**Marketplace / Privacy-Policy-Pflicht**
- "Listings must have a valid link to a privacy policy." Außerdem: Support-Link oder -E-Mail ist Pflicht; für Paid-Plans "must be owned by an organization that is a verified publisher" (https://docs.github.com/en/apps/github-marketplace/creating-apps-for-github-marketplace/requirements-for-listing-an-app).
- GitHub Marketplace Developer Agreement (Effective May 27, 2025, https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement):
  - "Developer must provide End Users their privacy policy which identifies itself as responsible for the collection, processing, privacy, security, and integrity of all data it collects"
  - "may not sell the Personal Data"
  - "comply with Applicable Data Protection Laws; and (ii) abide by the requirements of European Economic Area and Swiss data protection laws"
- Eine Pflicht zur Privacy-Policy-URL für **nicht gelistete** öffentliche Apps außerhalb des Marketplace ist **nicht verifiziert**.

**Zertifikate:** Nicht recherchiert, weil nicht angefragt (Punkt 9 nennt GitHub nicht).

**Subprozessoren:** https://github.com/subprocessors, leitet weiter auf https://docs.github.com/en/site-policy/privacy-policies/github-subprocessors (HTTP 200). Inhalt nicht ausgewertet.

---

## 5. Paddle (Paddle Billing, Merchant of Record, Paddle.js)

**Vertragsentität** (MSA, https://www.paddle.com/legal/terms, WebFetch: „Last updated 8 October 2025“)
- Definition wörtlich: "Paddle" means for sales to Buyers based in the United States: **Paddle.com Inc.**; and for sales to the rest of the world: Paddle Payments Limited (for Suppliers based in the United Kingdom for VAT purposes) or **Paddle.com Market Limited** (for all other Suppliers).
- Für eine deutsche UG heißt das:
  - Paddle.com Market Ltd., 30 Old Bailey, London EC4M 7AU, UK (Verkäufe außerhalb USA)
  - Paddle.com Inc., 3811 Ditmars Blvd #1071, Astoria, NY, USA (Verkäufe an US-Käufer)

**Rollen / Datenweitergabe**
- MSA: "The Parties acknowledge that each party acts as an **independent Controller** … comply with … the terms of the Data Sharing Addendum." Paddle ist also kein Auftragsverarbeiter, es braucht keinen AVV im Sinne von Art. 28. Stattdessen gilt das Data Sharing Addendum.
- Data Sharing Addendum (https://www.paddle.com/legal/data-sharing-addendum, „Last Updated: 1 January 2023“):
  - Geteilte Daten (4.1): "Names and Addresses of Buyers; Email addresses of Buyers; Buyer’s purchasing history; All transactional analytics available to Supplier on the Paddle Dashboard for which Personal Data is processed".
  - SCC Module One (C2C) inkl. UK Addendum. "The Annexes shall be deemed executed upon execution of the Agreement". Aufsicht: Irish DPC, Recht Irlands.
  - 5.4: Der Data Receiver muss Betroffene nach Art. 14 informieren. Das ist eine **Pflicht für unslop in der DSE**.
- GDPR-Seite (https://www.paddle.com/legal/gdpr):
  - "We collect buyer data during our checkout process … These include name, location, contact details, and billing information."
  - "legitimate interest to use buyer provided data for product fulfilment, order processing, fraud prevention, and product support. We will pass buyer data to sellers to enable these use cases".
  - "anonymised data is also shared with a number of GDPR compliant fraud monitoring platforms."
- Privacy Notice (https://www.paddle.com/legal/privacy, „last updated on 16 March 2026“): Verantwortliche sind Paddle.com Market Ltd (UK), Paddle.com Inc. (USA), Paddle Payments Ltd (Irland) und Paddle.com Canada Ltd. Transfers: "we use Standard Contractual Clauses and other appropriate safeguards".
- **Separates Auftragsverarbeitungs-DPA** (https://www.paddle.com/legal/data-processing-addendum, „LAST UPDATED: 1 February 2023“): "Provider means **Paddle.com Inc.**" mit Paddle als Processor. Security-Doku verweist auf profitwell.com/security. Gilt vermutlich für Retain/Metrics (ProfitWell), wo Paddle Auftragsverarbeiter ist. Das ist eine eigene Wertung, der genaue Anwendungsbereich ist **nicht verifiziert**.

**Drittland-Grundlage**
- UK: **EU-Angemessenheit verlängert.** Commission Implementing Decision C(2025) 8771 final vom 19.12.2025 ändert den Beschluss (EU) 2021/1772. Der neue Art. 4 lautet: "This Decision shall expire on **27 December 2031**, unless extended in accordance with the procedure referred to in Article 93(2) of Regulation (EU) 2016/679."
  - Quelle: https://commission.europa.eu/document/download/b36eedab-43b8-46eb-ac30-a8d1e6e69f51_en?filename=Renewal+UK+adequacy+GDPR.pdf (39 S., gelesen).
  - Im Amtsblatt ist das der Durchführungsbeschluss (EU) 2025/2574 (https://eur-lex.europa.eu/eli/dec_impl/2025/2574/oj/eng). **EUR-Lex war nicht ladbar** (leere Antwort bzw. Bot-Schutz); die Nummer stammt aus den Suchergebnis-Titeln.
- USA (Paddle.com Inc.): Die DPF-API-Suche nach „Paddle“ und „Paddle.com“ (alle Status) ergab **0 Treffer**. Grundlage sind damit SCC (DSA Annex 2).

**Paddle.js / Cookies / Fraud**
- Die Paddle-eigene Cookie-Policy (iubenda, https://www.iubenda.com/privacy-policy/83216669/cookie-policy, Stand September 21, 2026, Verantwortlicher Paddle.com Market Ltd.) deckt die **Paddle-Sites** ab (Marketing-Tracker wie HubSpot, Hotjar, Meta Pixel, Vector.co mit "Device Fingerprint"). Checkout und Paddle.js werden dort nicht erwähnt. Für die Seller-Website ist sie nicht maßgeblich.
- Die Privacy Notice definiert "Site" als "any website operated, or maintained, by us or on our behalf". Ob das Checkout-Overlay/-Iframe darunterfällt, ist **nicht verifiziert**.
- Fraud: "Every transaction … is allocated a fraud score … Paddle also uses various 3rd party anti-fraud software" (https://www.paddle.com/help/manage/risk-prevention/how-does-paddle-prevent-fraud).
- **Retain:** "Paddle Retain is automatically integrated with Paddle.js—use the same client-side token for both Billing and Retain features without additional configuration". "Retain only runs on live accounts" (https://developer.paddle.com/paddlejs/include-paddlejs). Für authentifizierte Seiten braucht es `pwCustomer`.
  - Folge (eigene Wertung): Wer Paddle.js live einbindet, lädt Retain-Code mit. Ob Retain aktiv ist, hängt am Paddle-Account.
- **Welche Cookies oder localStorage-Einträge Paddle.js bzw. der Checkout auf der Seller-Domain setzt, ist in der Doku nicht beschrieben (nicht verifiziert).** Empfehlung: empirisch im Browser (DevTools → Application/Network) auf der Live-Seite prüfen.

**Zertifikate**
- https://www.paddle.com/legal/soc-2-compliance nennt SOC 2 Type 2 mit Prüfzeitraum "July 1, 2022 to December 31, 2022" (Security, Availability, Confidentiality). Die Seite ist veraltet.
- Laut Suchergebnis-Snippet (**Sekundär/indirekt**) gibt es einen SOC 2 Type II Report für 1.1.–31.12.2025, ausgestellt am 31.01.2026. Die Quelle (trust.paddle.com) war **nicht ladbar** (JS-App, auch per Browser kein Text). **Nicht verifiziert.** ISO 27001: nicht verifiziert.

**Subprozessoren**
- https://trust.paddle.com/subprocessors (HTTP 200, Inhalt JS-gerendert, **nicht ladbar**). Laut Suchsnippet (Sekundär): AWS, Snowflake, Onfido, Salesforce, Cloudflare. **Nicht verifiziert.**

---

## 6. Brevo (ehem. Sendinblue)

**Vertragsentität** (ToS, https://www.brevo.com/legal/termsofuse/, „Version : October 1st, 2025“)
- Allgemein: "Sendinblue, a simplified joint-stock company registered with the Paris Trade and Companies Register under number 498 019 298 with its registered office at 9-17, rue Salneuve 75017 Paris".
- **Für Kunden mit Sitz in Deutschland, der Schweiz oder Österreich:** "Brevo GmbH, a company registered with Commercial Court Berlin-Charlottenburg under number HRB 133191 with its registered office at Köpenicker Str. 126, 10179 Berlin, Germany … is the signatory and billing entity under these supplemental terms."
  - Für eine deutsche UG ist Vertragspartner also **Brevo GmbH, Berlin**. Das ergibt sich aus den Supplemental Terms in Appendix 2. Ob das auch für den DPA-Vertragspartner gilt, sagt der Text nicht ausdrücklich (**nicht verifiziert**; das DPA spricht von "Us").

**DPA/AVV**
- Das DPA ist **Appendix 3 der ToS**: "This Data Processing Agreement and its Annex (collectively, the “DPA”) is part of the Terms of Service between You and Us". Es gilt automatisch mit den ToS. Die separate URL /legal/dpa/ liefert 404.
- Rollen: "You are the Controller and Brevo is the Processor".
- Transfers (§9): "including Standard Contractual Clauses and supplementary measures. We may rely on the EU-US Data Privacy Framework for transfers to the US, as long as this framework remains valid."
- Subprozessor-Änderungen werden per E-Mail angekündigt, mit Kündigungsrecht binnen 30 Tagen bei begründetem Einwand (§7.3).

**DPF**
- **Aktiv:** DPF-API, OrganizationId 10010, LegalName „Seninblue, Inc.“ (sic), Display „Brevo, Inc.“, Austin TX. EU-US, Swiss-US und UK Extension sind jeweils Active, Non-HR, InstallDate 2026-02-26, UsageEndDate 2027-02-26.
- Scope laut Eintrag: nur Kundensupport. Wörtlich: "This processing does not involve any hosting of personal data by Brevo, Inc."

**Serverstandort**
- "Our servers are located in the EU" (https://www.brevo.com/features/data-security/).
- Subprozessorliste (ToS Annex 2): OVH, Hosting, Serverstandort **Frankreich**; Google Cloud Platform, Hosting, Serverstandort **Belgien** (DPF und SCC); Cloudflare (USA/EU); Zendesk (EU/USA); Omni (EU); optional SMS-Provider, Integry, Convrrt (USA), OpenAI ("EU/USA") u. a.

**Double Opt-in** (https://help.brevo.com/hc/en-us/articles/208733449-Double-opt-in-DOI-What-it-is-and-how-to-track-user-sign-ups)
- Bei Formular-Absendung landen in den Event-Logs: "The event of the subscription (i.e., Form submitted). The time of the form submission. The email address of the subscriber." Der Kontakt steht noch nicht in der Liste.
- Beim Versand der DOI-Mail landen in den Transaktions-Logs "date and time the DOI email was sent" und "The content of the DOI email sent, including the confirmation link and consent text".
- Bestätigung: "within 30 days … After 30 days, the confirmation link expires." "The date and time of the confirmation are logged in the transactional logs". Brevo empfiehlt, die Logs regelmäßig zu exportieren; "You can delete those logs."
- **Dass die IP-Adresse beim Opt-in bzw. bei der Bestätigung gespeichert wird, nennt die Doku nicht (nicht verifiziert).**
- Über die API gibt es `POST https://api.brevo.com/v3/contacts/doubleOptinConfirmation` mit email, includeListIds, templateId und redirectionUrl (https://developers.brevo.com/reference/create-doi-contact). Zu Logging oder Link-Gültigkeit steht dort nichts.

**Tracking in Mails**
- "By default, Brevo embeds a tracking pixel in your emails to measure opens, and uses individualized links to measure clicks, recording per-contact engagement data for both." (https://help.brevo.com/hc/en-us/articles/37113920427922-About-email-tracking-pixels-and-the-CNIL-recommendation-in-Brevo). **Das Tracking ist also standardmäßig an.**
- Optionen:
  - „Per-contact pixel tracking consent“ unter Settings > Contacts, mit dem Default „Track contacts whose consent is unknown“ = Yes/No. Brevo empfiehlt No.
  - Attribut `_PIXEL_TRACKING_CONSENT` und ein Revoke-Link im Footer.
- Nach der CNIL-Empfehlung (April 14, 2026, Frist July 14, 2026; gilt für Empfänger in Frankreich) braucht Pixel-Tracking eine Einwilligung.
- Anonymisierung für Transaktionsmails: Settings > Automations > Transactional emails > Tracking > "Anonymous email tracking". Das stammt aus dem Suchsnippet zu https://help.brevo.com/hc/en-us/articles/11643306229906-… Die Seite wurde heruntergeladen, aber nicht wörtlich zitiert, deshalb als **Sekundär** markiert.
- DPA Annex 1: "tracking technologies (pixel and URL tracking) … allow the collection of metadata, including Personal Data related to the recipient's e-mail address: IP address, timestamp, click log, and open log."

**Zertifikate**
- "ISO 27001:2022-certified" (https://www.brevo.com/features/data-security/, mit Download-Link zum Zertifikat).
- Das per Suche gefundene PDF-Zertifikat FR078144 (Issue date 26 October 2022, https://www.brevo.com/wp-content/uploads/2022/11/SENDINBLUE-ISO27001-Certificate.pdf) wurde nicht geöffnet; ob es das aktuelle 2022er-Normzertifikat ist, ist **nicht verifiziert**.
- SOC 2: **nicht verifiziert**.

**Subprozessoren:** ToS Appendix 3, Annex 2 „List of Sub-Processors“ unter https://www.brevo.com/legal/termsofuse/. Eine eigene Seite gibt es nicht (/legal/list-of-sub-processors/ liefert 404).

---

## 7. Proton (Proton Mail, Geschäfts-E-Mail)

**Entität**
- **Proton AG, Route de la Galaise 32, 1228 Plan-les-Ouates (Genf), Schweiz**, CHE-354.686.492. Quellen: DPA https://proton.me/legal/dpa (Last modified: February 10, 2026) und ToS https://proton.me/legal/terms (Last modified: June 23, 2026). Für Business-Kunden gilt Schweizer Recht.

**DPA/AVV**
- "This Data Processing Agreement … forms part of the Contract for Services under Proton AG’s Terms and Conditions … between Proton AG … and the Company using Proton’s services". Es ist Teil der ToS, ein separater Abschluss ist nicht erkennbar.
- Proton ist Processor. Die Subprozessoren stehen in der Privacy Policy. Recht: Schweiz, Gerichtsstand Genf.
- Transfers (§11): "the Processor shall only transfer … to countries within Switzerland, the EU and/or countries subject to an adequacy decision, as provided for in art. 45 GDPR and art. 16 Swiss FADP"; andernfalls gelten SCC. SCC für EU→CH sind im DPA nicht nötig, weil ein Angemessenheitsbeschluss besteht.

**Drittland-Grundlage Schweiz**
- EU-Angemessenheitsbeschluss **2000/518/EG**. Die Kommissionsseite listet Switzerland unter den Ländern mit Angemessenheitsbeschluss und verweist auf den Bericht vom 15.01.2024 zur ersten Überprüfung der elf Altbeschlüsse, einschließlich Schweiz (https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en).
- Die EUR-Lex-Fassung (https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32000D0518) und die Pressemitteilung IP/24/161 waren **nicht ladbar**. Das Ergebnis des Reviews („weiterhin angemessen“) habe ich deshalb nicht wörtlich belegt (**nicht verifiziert**, nur über Suchsnippet).

**Serverstandort**
- "Data is always stored in encrypted format on our servers, which are exclusively located in **Switzerland, Germany or Norway** … Backups are kept for up to 30 days." Hide-my-email-Aliase laufen teils "on European cloud servers contracted through Proton subsidiary SimpleLogin SAS" (https://proton.me/mail/privacy-policy, Last modified: September 14th, 2026).
- Metadaten: "sender and recipient email addresses, the IP address incoming messages originated from, attachment name, message subject, and message sent and received times" sind für Proton zugänglich (dieselbe Quelle).

**Zertifikate:** "ISO 27001 certified" (https://proton.me/business/mail/security).

**Subprozessoren:** https://proton.me/legal/privacy (Last modified: 12th May 2026), Abschnitt 4:
- ProtonLabs DOOEL Skopje (Nordmazedonien, Support)
- ProtonLabs Taiwan (Support)
- Zendesk (USA, SCC/BCR)
- Stripe (USA, SCC)
- PayPal (USA/Singapur, SCC)
- Chargebee (USA, SCC)
- Atlassian (EU/USA/UK)

---

## Übersichtstabelle

| Anbieter | Entität + Sitz (für DE-UG) | DPA-URL / Abschluss | Drittland-Grundlage | Region | Training / Retention | Zertifikate | Subprozessorliste |
|---|---|---|---|---|---|---|---|
| **Vercel** | Vercel Inc., Covina CA, USA | vercel.com/legal/dpa (17.03./31.03.2026); per ToS inkorporiert. 🔴 DPA gilt laut Wortlaut für **Pro/Enterprise**; Hobby nur nicht-kommerziell | DPF aktiv (EU-US, CH, UK; bis 2027-04-29) + SCC 2021 (M1–3) + UK IDTA | Functions-Region wählbar (fra1); Default iad1; Edge/PoPs global; Middleware in allen Regionen; Logs: nicht verifiziert | 🔴 Hobby/Trial-Pro: Model Training auf „Your Content“ per Default AN; Paid Pro: Opt-in; Backups 30 Tage | SOC 2 Type 2, ISO 27001:2022, PCI DSS, TISAX AL2 | security.vercel.com |
| **Supabase** | 🔴 Supabase Pte. Ltd., Singapur | supabase.com/legal/dpa (v1, 01.08.2026); automatisch mit ToS | **Nur SCC** (M2/M3, UK B.1.0); Singapur ohne Angemessenheit; Supabase nicht im DPF | DB/Auth/Storage in gewählter Region (z. B. eu-central-1); Logs/Backups/Edge: nicht verifiziert | – (nicht recherchiert/keine Aussage gefunden) | SOC 2 Type 2, ISO 27001, HIPAA | supabase.com/legal/customer-resources/subprocessor-list (PDF 01.06.2026, ohne Standorte) |
| **Google Vertex AI** | Google Cloud EMEA Ltd., Dublin, IE | cloud.google.com/terms/data-processing-addendum (08.06.2026); mit Vertrag akzeptiert | Vertragspartner in EU; Google LLC DPF aktiv (bis 2027-09-13); SCC P2P Google Exporter für Subprozessoren | „eu“-Multiregion: ML-Processing in EU-Mitgliedstaaten für 3.8/3.6 Flash; Context Caching unterstützt; europe-west3: 2.5 Flash 128k in DE; **global: keine Residency-Garantie**; 3.1-pro-preview ohne Zusage | Training-Restriction (SST §18); In-memory-Cache 24 h (abschaltbar); Abuse-Prompt-Logging bis 90 Tage in gewählter Region (Opt-out-Antrag); Explicit Cache = TTL (Default 60 min, kein Max) | ISO 27001/17/18, SOC 1/2/3, PCI DSS (Agent Platform) | cloud.google.com/terms/subprocessors |
| **GitHub** | GitHub, Inc. (ToS); Controller „GitHub, Inc. oder GitHub B.V.“ | Nicht einschlägig für App-Beziehung (eigene Verantwortlichkeit); DPA nur unter Customer Agreement | DPF aktiv (Non-HR; bis 2027-08-03) + SCC | USA (nicht weiter recherchiert) | – | nicht recherchiert | docs.github.com/…/github-subprocessors |
| **Paddle** | Paddle.com Market Ltd., London (Nicht-US-Käufer) / Paddle.com Inc., NY (US-Käufer) | Kein AVV: **eigene Verantwortliche**; Data Sharing Addendum (01.01.2023) mit SCC M1 + UK Addendum, mit MSA ausgeführt | UK: EU-Angemessenheit bis **27.12.2031** (C(2025) 8771); Paddle.com Inc.: kein DPF → SCC | nicht verifiziert | Datenweitergabe an Seller: Name, Adresse, E-Mail, Kaufhistorie; Paddle.js-Cookies nicht dokumentiert | SOC 2 Type 2 (2022 belegt; 2025-Report nur sekundär) | trust.paddle.com/subprocessors (nicht ladbar) |
| **Brevo** | **Brevo GmbH, Berlin** (Supplemental Terms DE/CH/AT); sonst Sendinblue SAS, Paris | ToS Appendix 3 (Version 01.10.2025), automatisch | Hosting EU (OVH FR, GCP BE); Brevo, Inc. DPF aktiv (nur Support; bis 2027-02-26); SCC | EU | Öffnungs-/Klick-Tracking per Default AN, per-contact-Consent/Anonymisierung einstellbar; DOI-Logs: E-Mail + Zeitstempel (IP nicht belegt) | ISO 27001:2022 | ToS Appendix 3, Annex 2 |
| **Proton** | Proton AG, Plan-les-Ouates/Genf, CH | proton.me/legal/dpa (10.02.2026); Teil der ToS | EU-Angemessenheit Schweiz (2000/518/EG) | Server CH/DE/NO; Backups ≤30 Tage | – | ISO 27001 | proton.me/legal/privacy §4 |

---

## Offene Fragen / To-Dos

1. **🔴 Vercel-Plan prüfen.** Auf Hobby: kommerzielle Nutzung ist ToS-widrig, das DPA gilt laut Wortlaut nur für Pro/Enterprise, und Model Training auf Code und Inhalte ist per Default aktiv. Auf Paid Pro: prüfen, dass das Model-Training-Opt-in in den Team-Settings aus ist. (Laut Memory steht das Pro-Upgrade noch aus; siehe `unslop-prescan-standalone-live`.)
2. **Vercel-Function-Region selbst prüfen** (fra1 statt Default iad1). Middleware läuft unabhängig davon global. Wo Logs gespeichert werden, ist offen.
3. **Supabase = Singapur-Entität.** In DSE/AVV SCC als Transfergrundlage nennen, nicht DPF. Ort von Logs und Backups offen; bei Supabase anfragen oder im Dashboard prüfen.
4. **Vertex-Global-Rollback** (`UNSLOP_ESCALATION_LEGACY_PRO`, 3.1-pro-preview): keine Residency-Garantie. In der DSE offenlegen oder den Pfad deaktivieren.
5. **Vertex Abuse-Prompt-Logging:** Opt-out beantragen, falls ZDR gewünscht. Prüfen, ob der Account unter GCP ToS läuft (dann in scope) oder unter einem Master Agreement. In-memory-Cache (24 h) ggf. per `cacheConfig` abschalten; Auswirkung auf Implicit Caching und Kosten beachten.
6. **Grounding / Interactions API:** Prüfen, ob unslop sie nutzt (3 Tage bzw. 30 Tage Speicherung, nicht abschaltbar).
7. **GitHub-Webhook-Events:** Prüfen, welche Events abonniert sind. Bei push-Events kommen Git-Autor-E-Mails mit. Klären, welche Controller-Entität (Inc. oder B.V.) für EEA gilt.
8. **Paddle.js:** Cookies und Storage auf der eigenen Domain empirisch prüfen (DevTools). Klären, ob Retain aktiv ist, denn dann ist Paddle ggf. Auftragsverarbeiter nach dem separaten DPA mit Paddle.com Inc. SOC-2-Report 2025 und Subprozessoren im Trust Center (JS) manuell ansehen.
9. **Brevo:** Wird die IP beim DOI gespeichert? Das ist nicht belegt; beim Support anfragen oder die Log-Exports prüfen. Tracking-Default auf „No“ bzw. anonymisiert setzen. Klären, ob die Brevo GmbH auch DPA-Vertragspartner ist.
10. **Schweiz:** Das Ergebnis des Reviews vom 15.01.2024 ist nicht wörtlich belegt (EUR-Lex und Pressecorner waren nicht ladbar).
11. **EUR-Lex (EU) 2025/2574** war nicht ladbar. Belegt ist der Inhalt über das Kommissions-PDF C(2025) 8771 final.
