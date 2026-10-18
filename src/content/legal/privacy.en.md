# Privacy Policy

Effective: [DATUM DES INKRAFTTRETENS]

This policy explains which personal data we process when you visit unslop.codes, create an account, or use our service: the GitHub App, the command-line tool (CLI), the VS Code extension and the MCP server. It describes only what actually happens.

## 1. Controller

unslop UG (haftungsbeschränkt)
Hegenstraße 8, 36179 Bebra, Germany
Represented by its managing director Luca Maximilian Zell
Email: unslopai@protonmail.com
Phone: [TELEFONNUMMER]

We have not appointed a data protection officer because we are not legally required to (Art. 37 GDPR, § 38 BDSG). You can reach us about any data protection question at the email address above.

## 2. Overview: what we are responsible for, and what our customers are

- **We are the controller** for data we process for our own purposes: visits to the website, your account and sign-in, billing, the waitlist, and your messages to us.
- **For the source code that businesses send us for review, we are their processor** once we have concluded a data processing agreement (DPA) under Art. 28 GDPR with them. The customer chooses the code, and we process it only to produce the review for them. Code can contain personal data, for example names and email addresses in comments, configuration or test data. The customer is then responsible for that data. If you contribute to a repository of such a customer, please direct questions about that data to the customer.
- **If you use unslop as a consumer or without a DPA**, we are also the controller for processing your code (section 6.5).

We do not use code you send us for review for our own purposes. We do not train AI models with it, and neither do our service providers (section 6.3). [VORBEDINGUNG V1: Vercel Pro aktiv, Model Training in Vercel abgeschaltet] [VORBEDINGUNG V20: keine Auswertung von Kundendaten außerhalb des einzelnen Auftrags; SPEC §12.4 G2 auf eigene Repos, OSS oder Opt-in umgestellt; Verdict-Audit auf Fehleranalyse des einzelnen Auftrags beschränkt]

## 3. Visiting the website and hosting

The website and the application are hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA, as our processor. [VORBEDINGUNG V1: Vercel Pro mit DPA aktiv] The server functions run in Vercel's Frankfurt region (`fra1`). Requests are received by the Vercel network node closest to you and forwarded; the preliminary check whether you are signed in may also run there.

For every request, Vercel processes technically necessary data: your IP address, date and time, the requested address including parameters, the HTTP status, your browser type (user agent) and the network region. These data end up in Vercel's runtime logs. Our application also writes its own log lines there, such as repository and file names, GitHub account names, Paddle IDs, a short excerpt of the search query derived from a reviewed diff and, in case of errors, short excerpts of the model response and therefore of the reviewed code. Vercel makes runtime logs available to us for one day on our plan; how long Vercel retains them internally is determined by Vercel. [VORBEDINGUNG V1]

The legal basis is Art. 6(1)(f) GDPR. Our legitimate interest is to deliver the website, find errors and fend off attacks.

## 4. Cookies and local storage

We only use cookies and local storage that are strictly necessary for the service you asked for (§ 25(2) no. 2 TDDDG). We use no analytics, advertising or tracking tools. This is why there is no consent banner.

| Name | Purpose | Duration | Where |
|---|---|---|---|
| `sb-…-auth-token` (split into `.0`, `.1`, … for large sessions) | keeps you signed in; contains your session with your GitHub account details and, after sign-in, also your GitHub access token until your session is first refreshed (on the first visit after the sign-in expires, by default after one hour; if you do not return, until you sign out, at most 400 days) [ENTFÄLLT NACH V19] | until you sign out, at most 400 days | sign-in and dashboard |
| `sb-…-auth-token-code-verifier` | secures the sign-in with GitHub (PKCE) | until sign-in completes; if sign-in is aborted, at most 400 days | sign-in |
| `unslop_locale` | remembers the language you chose in the dashboard; contains only `de` or `en` | 1 year | sign-in and dashboard, only if you switch the language |
| `unslop.onboarding.path` (browser local storage) | remembers which setup path you chose in the dashboard | until you clear your browser storage | dashboard |

The marketing pages on unslop.codes set no cookies of their own. If you are signed in to the dashboard, your session is also refreshed when you open these pages. The language follows the address (`/en` or `/de`).

On the billing page in the dashboard, your browser loads Paddle's payment script (section 8). Paddle is responsible for the technologies it uses there. [PADDLE-COOKIES: nach Browser-Prüfung konkret benennen oder Satz belassen]

## 5. Signing in with GitHub and your account

You create an account by signing in with your GitHub account. There is no other way to sign in. Sign-in and the database are operated by Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, as our processor. Your data is stored in the Supabase region Frankfurt (eu-central-1).

When you sign in, GitHub gives us your GitHub user ID, username, email address and the profile details GitHub transmits. You grant us the GitHub scopes `user:email` (reading the email addresses of your GitHub account, including private ones), `repo` (access to your repositories, including private ones), `admin:repo_hook` (webhooks in repositories) and `read:org` (your organization memberships). We store the resulting access token encrypted in our database (AES-256-GCM). We use it to show you your repositories for selection, to check your permission for a GitHub App installation, to connect and review selected repositories, and to publish the results there (section 6).

We also store with your account: connected repositories and GitHub App installations, your subscription and usage counters (section 8), your API keys (section 7) and the results of your reviews (section 6).

During sign-in and in the dashboard, your browser connects directly to Supabase, in the dashboard also to keep the status of your repositories up to date (Realtime). Supabase processes and logs your IP address and browser type; on our plan Supabase keeps these logs for [SUPABASE-LOGFRIST].

The legal basis is Art. 6(1)(b) GDPR (the contract for using unslop); for the logs, Art. 6(1)(f) GDPR (security and troubleshooting).

## 6. Reviewing code

### 6.1 What data we process

- **GitHub App:** After you or your organization install the app, GitHub sends us events about installations, pull requests and check runs. From these we read the repository ID, its name, the pull request number, URL and commit ID, and the installation ID. We fetch code through the GitHub API: the changes (diff) of the pull request and, where needed, the full content of changed files and of individual related configuration files (such as `next.config.*`). We do not evaluate the title, description or author details of the pull request. For each installation we store its ID, the account name and the account type (user or organization).
- **Connecting a repository without the GitHub App:** If you connect a repository in the dashboard, via the CLI, the VS Code extension or the MCP server, we create a webhook in that repository using your GitHub access token. GitHub then sends us pull request events, which we process as for the GitHub App. We publish the results on the pull request using your token. They appear there under your GitHub username instead of as a check run: where there are findings, as a review requesting changes, or, on your own pull requests, as a plain review comment because GitHub does not allow requesting changes there; notice comments and resolving discussions then also happen under your name.
- **Project context:** For connected repositories we read the file list, individual manifest files such as `package.json` (from which we store only the detected ecosystems) and the JavaScript and TypeScript files, and from the latter we store essentially their structure: signatures, interfaces, type definitions and class outlines. The selection is automatic and can include individual further lines of code, such as initial values of class fields.
- **CLI, VS Code extension and MCP server:** These tools send us the diff of your local changes, the repository name from your Git configuration and the commit IDs. They do not send commit messages or Git author details. Before sending, they check the diff for secrets such as access keys or private keys (the VS Code extension through the CLI). If they find one, they stop instead of sending it. On your command, the tools also trigger connecting a repository or the review of a pull request, which we then fetch from GitHub, and they send your reasoning when you mark a finding as resolved.

### 6.2 What we do with it

We review the code in several steps, with fixed rules and with AI models (section 6.3). The result consists of findings with location, quoted code, reasoning and, where applicable, a suggested fix. For pull requests we publish it as a check run (for a repository connected without the GitHub App, as a review under your name, section 6.1), as review comments and, where needed, as a notice comment on the pull request, where anyone who can see the pull request can see it. We read existing comments on the pull request only to avoid posting findings twice, and our own review comments to be able to resolve findings later; we store their IDs for that purpose. If you mark a finding as resolved, we resolve the related discussion. With the other tools you receive the result directly. **The findings are generated by fixed rules and by AI. They can be incomplete or wrong.**

We make no automated decision about individuals within the meaning of Art. 22 GDPR. We assess code, not the person who wrote it. Whether a failed check or a requested change prevents a pull request from being merged is decided solely by the customer in their GitHub settings.

To check whether a package or model used by your code actually exists, we query the public registries npm, PyPI, crates.io and Hugging Face. We only send the package or model name as it appears in the code (it may contain the account name of the package author), and no data about you.

### 6.3 AI processing with Google Vertex AI

We run the AI review with Gemini models on Google Cloud Vertex AI. Our contracting party and processor is Google Cloud EMEA Limited, 70 Sir John Rogerson's Quay, Dublin 2, Ireland.

- **Where processing happens:** We call the review models through Vertex AI's EU endpoint. For these models, Google commits that processing takes place in EU member states.
- **Search vectors:** We convert the structural data of your repository (section 6.1) and, for each review, an excerpt of the diff (file names and up to 30 added lines) into search vectors with a Google model, likewise with processing in the EU. We do not store the vectors derived from the diff. [VORBEDINGUNG V18: Suchvektoren über einen Endpunkt mit EU-Residenzzusage erzeugt]
- [OPTIONAL, NUR SOLANGE DER ROLLBACK-PFAD EXISTIERT: If a standard model fails, we may exceptionally fall back, for individual review steps, to a model that Google offers only through a global endpoint. Processing can then take place in any Google data center, including in the USA (section 11).]
- **No training:** Google does not use your data to train or fine-tune AI models (Google Cloud Service Specific Terms, "Training Restriction").
- **Caching at Google:** Google keeps inputs and outputs in memory for up to 24 hours to respond faster; the data stays in the selected region. In addition, Google may store inputs for up to 90 days if its automated systems suspect a violation of its usage policies. That storage then serves only to examine the suspicion and takes place in the same region. [ANPASSEN, FALLS GOOGLE DIE AUSNAHME VOM PROMPT-LOGGING BEWILLIGT ODER WIR DEN ZWISCHENSPEICHER ABSCHALTEN]
- **Our own cache at Google** contains only our review rules, no data from your code.

### 6.4 What we store

In our database at Supabase we store for each review:

- the request: repository, pull request and commit IDs and, for the CLI, VS Code extension and MCP server, the diff you sent;
- the result with the findings, including the quoted code and suggested fixes;
- technical logs of the model calls: model, duration and usage, and the intermediate results of the review steps, which can refer to the reviewed code. If a review fails, the error message can contain a short excerpt of the model response and therefore of the reviewed code.

We store the structural data of your repositories (section 6.1) together with the search vectors while the repository is connected. If you disconnect a repository or remove it from the GitHub App, we stop using them and delete them at the latest 30 days afterwards, together with the repository connection. [VORBEDINGUNG V4: Migration 052 angewendet]

If you deliberately mark a finding as resolved or not applicable, we store that decision with your reasoning, the time, the commit ID and the user account as a record.

Retention: see section 12.

### 6.5 Legal bases for the review

- If we have concluded a DPA with you as a business, we process the code on your behalf (Art. 28 GDPR); the legal basis then follows from your processing.
- Otherwise we process the code as the controller to perform the contract concluded with you (Art. 6(1)(b) GDPR). If the code contains personal data of third parties, for example co-developers or test data, the legal basis is Art. 6(1)(f) GDPR; our legitimate interest, and yours, is to review the code as requested.

## 7. API keys and local configuration

For the CLI, VS Code extension and MCP server you create an API key in the dashboard or have `unslop login` create one. Of the key we store only a cryptographic hash and its prefix, together with its label, creation date, time of last use and, if applicable, its revocation. If `unslop login` creates the key, its label consists of `cli-` and your computer's name. This label is also sent in the sign-in address and therefore appears in Vercel's runtime logs (section 3).

On your computer, the tool stores the key in the file `~/.config/unslop/config.json`, readable only by your user account. In the VS Code extension you can alternatively store it in the settings. The CLI, extension and MCP server send no usage statistics and do not check for updates on their own. They connect only to unslop.codes and, to compare with the repository, to your own Git server. [VORBEDINGUNG V5: Google-Fonts-Einbindung der Login-Bestätigungsseite in packages/cli/src/login.ts entfernt]

The legal basis is Art. 6(1)(b) GDPR.

## 8. Subscriptions and payment through Paddle

Paid subscriptions are sold by Paddle as our reseller and Merchant of Record: Paddle.com Market Limited, 30 Old Bailey, London EC4M 7AU, United Kingdom; for buyers in the USA Paddle.com Inc., 3811 Ditmars Blvd. #1071, Astoria, NY 11105-1803, USA; for buyers in Canada Paddle.com (Canada) Ltd., 22 Adelaide Street West, Suite 3400, Toronto, Ontario M5H 4E3, Canada. You conclude the purchase contract with Paddle. Paddle collects your payment and billing data as an **independent controller**. Details are in Paddle's privacy notice: https://www.paddle.com/legal/privacy.

- **We send Paddle**, when you start checkout, your email address (if Paddle does not yet know you as a customer), the internal IDs of your user and billing account, and the interface language. When you open the billing page in the dashboard, your browser loads a script from Paddle (`cdn.paddle.com`); Paddle thereby receives your IP address.
- **We receive from Paddle**, under the agreement between Paddle and us, buyers' name, address, email address and purchase history. Of these we store only Paddle's IDs for customer, subscription and price, and the subscription status with trial and billing period end. We fetch invoices from Paddle when you view them in the dashboard and do not store them ourselves.

Legal bases: Art. 6(1)(b) GDPR for providing the service you bought. For retaining billing records, Art. 6(1)(c) GDPR in conjunction with § 257 HGB and § 147 AO.

## 9. Waitlist

If you join the waitlist on our website, we store your email address, the language, the place on the page where you signed up, and the time. To limit abuse we also store a hash computed from your IP address, the current date and a secret key. We do not store the IP address itself. Because the date is part of the input, the same IP address produces a different hash each day, so entries from different days cannot be linked.

Brevo (Brevo GmbH, Köpenicker Str. 126, 10179 Berlin, Germany) sends the emails as our processor, with servers in the EU. [BESTÄTIGEN: Brevo-Gesellschaft, die Partei des Auftragsverarbeitungsvertrags ist] Brevo sends you an email with a confirmation link (double opt-in). Only once you click it does Brevo add you to the mailing list. Brevo logs the time of sign-up, the sending of the confirmation email including the consent text, and the time of your confirmation. These logs serve as our proof of your consent. We do not measure whether you open our emails or click links in them. [VORBEDINGUNG V6: Öffnungs- und Klickmessung im Brevo-Konto abgeschaltet]

We will email you when the private beta opens, and about nothing else.

The legal basis for the waitlist is your consent (Art. 6(1)(a) GDPR). You can withdraw it at any time through the unsubscribe link in every email or by emailing us. Withdrawal takes effect for the future. We process the hash for abuse prevention on the basis of Art. 6(1)(f) GDPR; our legitimate interest is to fend off mass or automated sign-ups. We keep the proof of your consent on the basis of Art. 6(1)(c) and (f) GDPR so that we can provide it in case of a dispute.

## 10. Contacting us by email

If you write to us, we process your email address, your message and the information you send us in order to answer your request. Our mailbox is operated by Proton AG, Route de la Galaise 32, 1228 Plan-les-Ouates, Switzerland, as our processor. Proton stores the data on servers in Switzerland, Germany or Norway.

The legal basis is Art. 6(1)(b) GDPR if your request concerns a contract with us, otherwise Art. 6(1)(f) GDPR. Our legitimate interest is to answer requests.

## 11. Recipients and transfers to third countries

| Recipient | Role | Location | Basis for transfers outside the EU |
|---|---|---|---|
| Vercel Inc. (hosting) | processor | USA | EU-US Data Privacy Framework adequacy decision (Vercel is certified), plus EU Standard Contractual Clauses [VORBEDINGUNG V1: Vercel Pro mit DPA aktiv] |
| Supabase Pte. Ltd. (database, sign-in) | processor | Singapore; data in Frankfurt (eu-central-1) | Singapore (contracting party) and USA (Supabase's sub-processors): EU Standard Contractual Clauses (Art. 46(2)(c) GDPR) |
| Google Cloud EMEA Limited (AI processing) | processor | Ireland | Processing in the EU; where Google's sub-processors access data from third countries (for example for support), EU Standard Contractual Clauses. [OPTIONAL, NUR SOLANGE DER ROLLBACK-PFAD EXISTIERT: When the global endpoint is used: EU-US Data Privacy Framework adequacy decision (Google LLC is certified) and EU Standard Contractual Clauses] |
| Brevo GmbH (waitlist) | processor | Germany; servers in the EU | Hosting in the EU; for sub-processors outside the EU, EU Standard Contractual Clauses or the EU-US Data Privacy Framework (per Brevo's DPA) |
| Proton AG (email) | processor | Switzerland | adequacy decision for Switzerland |
| GitHub, Inc. | independent controller; your platform, from which we fetch data and to which we write results back | USA | EU-US Data Privacy Framework adequacy decision (GitHub is certified) |
| Paddle.com Market Limited / Paddle.com Inc. / Paddle.com (Canada) Ltd. | independent controller | United Kingdom / USA / Canada | adequacy decision for the United Kingdom; for Paddle.com Inc. EU Standard Contractual Clauses; for Paddle.com (Canada) Ltd. [BESTÄTIGEN: Angemessenheitsbeschluss für Kanada oder EU-Standardvertragsklauseln] |

You can request a copy of the Standard Contractual Clauses by emailing us.

## 12. Retention

We keep personal data as long as we need it for the respective purpose and delete it afterwards, unless a statutory retention obligation applies.

| Data | Retention |
|---|---|
| Vercel runtime logs | visible to us for 1 day; internal retention determined by Vercel [VORBEDINGUNG V1] |
| Supabase logs | [SUPABASE-LOGFRIST] |
| Account, sign-in data, GitHub access token, API keys | until your account is deleted; then deletion within 30 days [VORBEDINGUNG V4: Migration 052 angewendet] |
| Review requests, diffs, results and model call logs | 90 days from receipt of the request; the diff text uploaded by the CLI, the VS Code extension or the MCP server is deleted after 30 days; earlier if the repository or your account is deleted [VORBEDINGUNG V3: Migration 052 angewendet] |
| Structural data and search vectors of a repository | while the repository is connected; then deletion at the latest 30 days after disconnection [VORBEDINGUNG V4] |
| Findings marked as resolved or not applicable | until the repository or your account is deleted [VORBEDINGUNG V4: Migration 052 angewendet] |
| Waitlist | [SPEICHERFRIST-WAITLIST]; unconfirmed entries [SPEICHERFRIST-WAITLIST-UNBESTÄTIGT]; the proof of consent beyond that until [NACHWEISFRIST-WAITLIST] |
| Email correspondence | until the request is resolved; business correspondence 6 years (§ 257 HGB) |
| Billing records | 8 years (accounting vouchers) or 10 years (books and financial statements) under § 257 HGB and § 147 AO |

## 13. Do you have to provide data?

To use the service we need the data described in sections 5 to 7. Without it we cannot conclude or perform a contract with you. The waitlist is voluntary. There is no statutory obligation to provide data to us.

## 14. Your rights

You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and data portability (Art. 20). You can withdraw consent at any time with effect for the future (Art. 7(3)). Just send us an email. If your request concerns code that a customer sent us for review under a DPA, we forward it to that customer.

> **Right to object (Art. 21 GDPR)**
>
> Where we process data on the basis of legitimate interests (Art. 6(1)(f) GDPR), you can object at any time on grounds relating to your particular situation. We will then stop processing the data unless we demonstrate compelling legitimate grounds that override your interests, or the processing serves the establishment, exercise or defence of legal claims. You can object informally, most easily by email to unslopai@protonmail.com.

## 15. Right to lodge a complaint

You can lodge a complaint with a data protection supervisory authority (Art. 77 GDPR). The authority responsible for us is:

Der Hessische Beauftragte für Datenschutz und Informationsfreiheit (Hessian Commissioner for Data Protection and Freedom of Information)
Wilhelmstraße 7, 65185 Wiesbaden, Germany
Phone: +49 611 1408-0
Email: poststelle@datenschutz.hessen.de
Website: https://datenschutz.hessen.de

## 16. Changes

We update this policy when our service or the law changes. The version with the effective date above applies. This English version is provided for information; if the versions differ, the German version prevails.
