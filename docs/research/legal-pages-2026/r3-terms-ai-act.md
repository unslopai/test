# Research 3: Terms of Service für unslop (SaaS, Paddle als Merchant of Record), Stand 2026

**Erstellt:** 2026-09-28 · **Rolle:** Vertragsrechts-Research (keine Rechtsberatung) · **Abrufdatum aller Quellen:** 2026-09-28, sofern nicht anders vermerkt.

**Kennzeichnung:**
- **[P]** = Primärquelle (Gesetz, Amtsblatt, Gericht, Paddle-eigene Rechtstexte bzw. Help-Center, EU-Kommission)
- **[S]** = Sekundärquelle (Kanzlei-Artikel, Blogs, Drittanbieter). Nur zur Einordnung oder als Strukturreferenz.
- **[nicht verifiziert]** = konnte nicht mit Primärquelle belegt werden
- **[Bewertung]** = eigene Schlussfolgerung aus den Quellen, keine Quellenaussage

Methodik: Gesetzestexte wurden als Roh-HTML von gesetze-im-internet.de geladen und wörtlich extrahiert. Die Paddle-Seiten wurden als Roh-HTML geladen, und wörtliche Zitate stammen aus dem extrahierten Text, nicht aus einer KI-Zusammenfassung. AI Act und Digital-Omnibus wurden als amtliche Fassung aus dem Cellar des EU-Amtsblatts (publications.europa.eu) geladen, weil EUR-Lex hinter einer Bot-Sperre liegt.

---

## 0. Kernergebnisse (Kurzfassung)

1. **Zwei Verträge, zwei AGB-Werke.** Nach den Paddle Buyer Terms kauft der Kunde das Produkt **von Paddle**. Das Produkt selbst stellt der Supplier (unslop) „under the terms of their Supplier Agreement“ bereit. unslops Terms sind genau dieses „Supplier Agreement“. Sie regeln die **Nutzung**, nicht Kauf, Zahlung oder Steuern. [P, Paddle Buyer Terms]
2. **Paddle-Pflichtinhalte für die Website:** Terms mit **Firmenname** („company name“, bei Einzelunternehmern bevorzugt der legal name), Refund Policy und Privacy Policy **per Navigation erreichbar**. Hinzu kommen Produktbeschreibung, Preise, Features und HTTPS. Die Website muss Paddle „clearly“ als Reseller ausweisen (MSA 9.2). Im Seller Handbook steht dafür ein **wörtlich vorgegebener Satz**. [P]
3. **Paddle-AUP:** Für KI-Code-Review gibt es kein Verbot. Die KI-Verbote betreffen Likeness, Deepfakes, Face-Swaps, Voice-Impersonation sowie „automated decision-making or categorization of people“. Zu beachten ist die Kategorie „software … marketed to … improve the performance or security of an Electronic Device“ (Restricted). Sie betrifft Geräte, nicht Code. Das Marketing sollte trotzdem nicht als „Geräte-Security“ formulieren. [P + Bewertung]
4. **Seit 19.06.2026 in Kraft: § 356a BGB (elektronische Widerrufsfunktion).** Grundlage ist das Gesetz vom 03.02.2026 (BGBl. 2026 I Nr. 28). Paddle bietet laut eigener Refund Policy (31.03.2026) einen Online-Withdrawal-Button im Customer Portal an. Ob das für den Nutzungsvertrag mit unslop reicht, ist offen (siehe §§ 5, 10). [P]
5. **Der Kündigungsbutton nach § 312k BGB** trifft den Unternehmer, der über eine Webseite einen Dauerschuldvertrag abschließen lässt. Paddle verpflichtet den Supplier vertraglich zu einem „direct link to enable cancellation … if it is required“ (MSA 11.1(iii)). [P]
6. **AI Act:** Art. 50 gilt seit 02.08.2026. Der Digital-Omnibus (VO (EU) 2026/1744, ABl. 24.07.2026) hat Art. 50 Abs. 1–6 **nicht** verschoben. Für Art. 50 Abs. 2 (maschinenlesbare Markierung) gibt es nur eine Übergangsfrist bis **02.12.2026**, und nur für Systeme, die vor dem 02.08.2026 in Verkehr gebracht wurden. Art. 4 (KI-Kompetenz) wurde zu einer Förderpflicht („unterstützen“) abgeschwächt. [P]
7. **Leitlinien der Kommission zu Art. 50 (C(2026) 5054, 20.07.2026):** Nennen ausdrücklich „code review chatbots available only to professional developers“ als Beispiel für die **Offensichtlichkeits-Ausnahme** von Art. 50 Abs. 1. **Source Code** (einschließlich integraler Code-Kommentare) fällt **nicht** unter Art. 50 Abs. 2. Die **natürlichsprachlichen Review-Kommentare** von unslop sind dagegen „Text“ und damit grundsätzlich markierungspflichtig. Ausnahmen: „assistive function for standard editing“ und eine enge B2B-Ausnahme. [P]
8. **Englische AGB gegenüber deutschen Verbrauchern:** Das KG Berlin hat 2016 (5 U 156/14) rein englische AGB auf einer deutschen Website als intransparent gewertet. Für die Verbraucher-Fassung braucht es also eine **deutsche Fassung**. [S, Primärtext nicht abgerufen]

---

## 1. Paddle-Primärquellen

### 1.1 Paddle Buyer Terms (Checkout Buyer Terms)

- URL: https://www.paddle.com/legal/checkout-buyer-terms [P], Fassung **„31 March 2026“** (Datumszeile am Dokumentende). Changelog: https://www.paddle.com/legal/buyer-terms-privacy-notice-log-of-changes-31-03-2026 [P]
- Vertragspartner: für „Rest of world“ die **Paddle.com Market Limited** (England & Wales, Company No. 8172165, 30 Old Bailey, London EC4M 7AU). Für die USA ist es Paddle.com Inc., für Kanada Paddle.com (Canada) Ltd.

Wörtliche Kernaussagen:

> „Paddle is an authorised reseller of Products for Suppliers, which means you purchase the Product from Paddle using our Services, and the Product is made available to you by the Supplier under the terms of their Supplier Agreement.“

> „By completing a Transaction using our Services, you agree to the terms and conditions below and in the Supplier Agreement.“

> „"Supplier Agreement" means the Supplier's terms and conditions, applying between the Buyer and Supplier and governing the Buyer's use of the Product;“

> „"Product" means the product or service that the Buyer is purchasing using Paddle's Services, which is made available to the Buyer by the Supplier following purchase, including any licence keys, activation codes, upgrades, support services and add-ons;“

> (1. Acceptable Use) „You agree to use the Product and any third-party materials in compliance with the Supplier Agreement and any other applicable third-party terms.“

> (2. Payment) „If the Supplier fails or unreasonably delays in delivering the Product due to technical issues, you are entitled to a replacement or refund of the relevant Charges paid.“

> (3. Subscriptions) „Subscriptions automatically renew for further periods equal to your initial Subscription term, until you withdraw from or cancel your Subscription.“ … „We will notify you if the price of a Subscription increases and, if required by law, we will seek your consent before we charge you the increased Charges. If you do not accept a price increase, you or Paddle may cancel your Subscription with effect from the end of your current billing period.“

> (4. Chargebacks) „If you raise a chargeback that we reasonably believe constitutes fraud or abuse of payment protection mechanisms …, the Supplier may suspend your access to the Product while we investigate, and block your access if our investigation finds fraud or abuse.“

> (6. Cancellations) „You can cancel a Subscription at any time with effect from the end of your current billing period. … You can cancel your Subscription through our Buyer portal, which is accessible via the link in your Subscription confirmation email.“

> (8. IP) „The Product and any materials related to the Product are provided by the Supplier under the Supplier Agreement.“

> (11. Contract Changes) Paddle ändert seine Terms per E-Mail-Notice mit einer Frist von einem Monat und Zustimmungsfiktion: „If you do not terminate before the update takes effect, you will be deemed to have accepted the update, except where mandatory consumer law requires your express consent for a material change.“

> (12. Liability) „We are not liable for (i) any losses relating to the Product …“ … „You may benefit from a warranty from the relevant Supplier of the Product. Please refer to the Product documentation and Supplier Agreement for any details.“

> (13) Englisches Recht. Verbraucher können „in the courts of England or of the country they live in“ klagen. Für Businesses gilt exklusiv die Zuständigkeit englischer Gerichte, CISG ausgeschlossen.

> (14 Language) „If there is any inconsistency between this English version and any translated version, the terms of this English version will apply (unless to the extent otherwise required by mandatory consumer law …).“

> (15, EU/EEA/UK-Verbraucher) „You have the right to withdraw from the Agreement for any reason within 14 days of completing a Transaction in accordance with our Refund Policy. If you exercise this right, you will receive a full refund …, unless during that 14-day period, you started downloading, streaming, using or benefiting from the Product, when during your Transaction you agreed for us to make the Product available for your use before the end of that 14-day period.“

> (15, Consumers residing in Germany) „If we breach an essential contractual obligation in this Agreement, our liability is not excluded and is limited to the foreseeable damage typical for this type of agreement.“

**[Bewertung]** Paddle schließt jede Haftung für das Produkt aus und verweist für Gewährleistung ausdrücklich auf das Supplier Agreement. Leistungsqualität, Verfügbarkeit, Mängel und Haftung für das Produkt muss unslop deshalb vollständig selbst regeln.

### 1.2 Paddle Refund Policy

- URL: https://www.paddle.com/legal/refund-policy [P], Stand **„31 March 2026“**

Wörtlich:

> „1.1. Unless required by applicable law, all Transactions are non-refundable and non-exchangeable.“

> „2.2.2. The right to withdraw applies to one-off purchases and to the first payment under a Subscription contract. It does not apply to subsequent Subscription payments … If a Subscription includes a free trial period, then, as soon as that free trial period ends, you will again have a period of 14 calendar days to exercise your right to withdraw.“

> „2.2.4. The right to withdraw does not apply to the supply of digital content Products that have started to be downloaded, streamed or otherwise used, when you have given express consent to waive your withdrawal rights.“

> **„3.1.1. Withdrawal — EU consumers: An online withdrawal button is available in the Paddle Customer Portal for eligible transactions during the 14-day withdrawal period. You can access the Customer Portal using the “Manage subscription” or “Manage transaction” link in your Transaction confirmation email or by visiting Paddle.net. Select the withdrawal option (e.g., “Request withdrawal”) shown there and follow the on-screen instructions. The button appears in the language of your checkout.“**

> „3.1.3. Cancellation … access the Paddle Customer Portal using the “Manage subscription” link … and select “Cancel subscription”; or request cancellation via Paddle.net.“

> „4. … contact the Supplier first to attempt to resolve the issue or request a refund; if the issue cannot be resolved, contact Paddle's support team …“

> „7.1. Paddle may, at its sole discretion, issue a refund if a request is submitted within 14 days of your Transaction date.“

> „If local consumer protection laws or a Supplier of a Product provides you with additional or non-waivable rights, the highest level of rights will always apply.“

**Widerspruch/Spannung [Bewertung]:** Paddle spricht vom Erlöschen bei „digital content“. Ein SaaS-Abo ist nach deutschem Recht aber eine **digitale Dienstleistung** (§ 327 Abs. 2 S. 2 BGB). Für Dienstleistungen erlischt das Widerrufsrecht erst mit **vollständiger** Erbringung (§ 356 Abs. 5 Nr. 2 BGB, siehe 5.1). Bei einem Monatsabo ist das innerhalb von 14 Tagen praktisch nie der Fall. Die Folge eines Widerrufs wäre dann Wertersatz nach § 357a Abs. 2 BGB, kein Erlöschen. Das betrifft primär Paddle als Verkäufer. unslops eigene Terms sollten dem aber nicht widersprechen.

### 1.3 Paddle Master Services Agreement (Seller Terms)

- URL: https://www.paddle.com/legal/terms [P], **„Last updated: 8 October 2025“**

Wörtlich (relevante Klauseln):

> „2.1. You appoint Paddle as your non-exclusive reseller of the Product across all territories.“

> „3.4. As Merchant of Record, Paddle reserves the right to set the price or licence fee at which the Product is offered for sale to Buyers.“

> „6.1. Paddle agrees to provide first tier after-sales support to Buyers. First tier after-sales support includes invoicing, handling requests for refunds, payment, reconciliation and initial order related support.“

> „6.4. You warrant that you will provide any additional ongoing customer service and after-sales support in respect of the Product including but not limited to technical and/or delivery level support (e.g. Service Level Agreements) in accordance with the terms agreed between you and each Buyer.“

> **„9.2. The Supplier shall ensure that the Supplier URLs provide clear and accurate information about the Product, clearly reflect Paddle's status as a reseller and comply with Paddle's policies, the Payment Scheme Rules and applicable law in the jurisdictions in which the Products are sold.“**

> „9.3. Paddle may, in its discretion, request changes to the Supplier URLs (including any policies and/or terms displayed on the Supplier URLs) to: (i) ensure is it clear that Paddle acts as a reseller of the Product; (ii) ensure compliance with Paddle's policies, the Payment Scheme Rules and/or applicable law; and/or (iii) prevent or reduce Chargebacks.“

> „9.6. Paddle reserves the right to reject or suspend the sale … if … (iii) the Supplier fails to make changes to the Supplier URL(s) requested by Paddle in accordance with clause 9.3.“

> **„10.1. … as Paddle is the seller of the Product to the Buyer, you shall not issue any invoice or make any demand for payment to any Buyer in a Transaction. If you agree with the Buyer to issue a refund or repay any of the SRP you will not make this payment directly to the Buyer but will inform Paddle of what you have agreed and Paddle will make the relevant refund.“**

> „10.2. As the seller, Paddle shall be entitled to cancel a Transaction and grant the Buyer a refund of the full price paid if: (i) the Buyer requests a refund within fourteen (14) days … and Paddle determines, in its sole discretion, that a refund is appropriate; … (iv) required by any applicable law …“

> **„11.1 (iii) the Product complies with our Acceptable Use Policy and the sale of the Product is in compliance with all Payment Scheme Rules and applicable laws and you shall provide Buyers with access to Paddle's after sales support in a manner as it is required by the applicable law in the countries where the Buyers are based, including by way of a direct link to enable cancellation of a Product, if it is required;“**

> „11.1 (vi) the Product is free from defects and fit for any purpose agreed between you and the Buyer …“

> „11.1 (xii) … you will not conceal information required under Paddle's policies or applicable law from Buyers;“

> **„11.1 (xiv) you will properly display the full Paddle Checkout to each Buyer and will ensure that no part of the Paddle Checkout presented to Buyers is changed, obscured, contradicted or otherwise altered by any content or function of the Supplier URL;“**

> „19 … governed by … the law of England … English courts shall have exclusive jurisdiction“

**„Verbot widersprüchlicher Regelungen“:** Einen allgemeinen Satz wie „Supplier-Terms dürfen den Buyer Terms nicht widersprechen“ gibt es im MSA nicht **[P, Volltextsuche nach „inconsistent“ und „conflict“ ohne entsprechenden Treffer]**. Funktional wirken aber drei Klauseln so:
- 11.1(xiv): Der Checkout darf nicht „contradicted“ werden.
- 10.1: Der Supplier darf nicht selbst abrechnen oder erstatten.
- 9.3: Paddle kann Änderungen an den Terms auf der Website verlangen.

**[Bewertung]** unslops Terms dürfen daher keine eigenen Zahlungs-, Steuer-, Rechnungs- oder Erstattungszusagen enthalten, die am Paddle-Prozess vorbeigehen. Erstattungen laufen immer „über Paddle“.

### 1.4 Paddle Seller Handbook: Pflichtsatz in den T&Cs

- URL: https://www.paddle.com/seller-guides/seller-handbook [P, Paddle-eigene Seite; kein Datum angegeben]

Wörtlich unter „Our policies — We require that our software sellers:“

> **„Add this text on their website T&Cs - “Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns”.“**
>
> „Make it clear to buyers what products they're paying for and what amount they're committing to before the purchase (including making it clear if they're entering into a subscription).“
>
> „Keep the product description clear to ensure the product's capabilities and limitations are made very transparent.“
>
> „List their terms & conditions, refund policy, and buyer support details (email and phone number) clearly on their website.“
>
> „Include the company name or sole proprietor's brand (legal name preferred for sole proprietors) in the Terms & Conditions.“
>
> „Make sure the buyer accepts their terms & conditions and refund policy before they make a purchase.“
>
> „Ensure you notify us of any changes in your refund policy, product T&C or contact details …“

Best-Practice-Empfehlungen, keine Pflicht: „Have at least a 30-day money-back guarantee“, eine Complaint Policy und SSL.

**Hinweise [Bewertung]:**
- Der vorgeschriebene Satz „Paddle provides **all customer service inquiries**“ kollidiert mit MSA 6.1/6.4, wonach technischer Support beim Supplier liegt. In den Terms empfiehlt sich deshalb der Pflichtsatz wörtlich plus eine Klarstellung: „Paddle: Bestellung, Zahlung, Rechnung, Erstattung. unslop: technischer Produktsupport“.
- „buyer support details (email **and phone number**)“: Eine Telefonnummer wird als Pflicht formuliert. Das ist auch für das Impressum (§ 5 DDG) relevant. Das DDG wurde in diesem Report nicht geprüft.

### 1.5 Paddle Domain Review / Website-Verification

- URL: https://www.paddle.com/help/start/account-verification/what-is-domain-verification [P]

Wörtlich:

> „Ensure the following information is clearly available across your domain(s):
> - A clear description of your product or service
> - Pricing details or a pricing page (a screenshot is acceptable if not yet available)
> - Key features or deliverables included with the purchase
> - Terms and Conditions, Refund Policy, and Privacy Policy (these must be clearly accessible via navigation on your website)
> - Include the company name or sole proprietor's brand (legal name preferred for sole proprietors) in the Terms & Conditions
> - Site must be live and secured with an SSL certificate (HTTPS)
> - Custom/enterprise pricing sheet (if applicable)*“

> „Only submit domains that are directly related to the product you're selling via Paddle.“ … „you will only be allowed to sell through the domain(s) that have been approved … subdomain … approved separately.“

Mögliche Nachforderungen laut Seite: u. a. „Test account access – For some product categories, or subdomains requiring login, we may need a test account to verify functionality.“

**Antwort auf die Fragen:**
- *Muss der legale Name in den Terms stehen?* **Ja, der „company name“ ist Pflicht** (nur bei Einzelunternehmern „legal name preferred“). Für eine UG heißt das: „unslop UG (haftungsbeschränkt)“ nennen. Eine Rechtsformangabe ist nach deutschem Recht ohnehin nötig; das HGB wurde hier nicht geprüft, daher [nicht verifiziert im Rahmen dieses Reports].
- *Muss Paddle als MoR in den Terms genannt werden?* Die Domain-Review-Seite verlangt das **nicht ausdrücklich**. Das **Seller Handbook** verlangt es aber wörtlich („Add this text on their website T&Cs“), und MSA 9.2 fordert „clearly reflect Paddle's status as a reseller“. Ergebnis: faktisch **Pflicht**.

**Widerspruch Sekundär vs. Primär:** Ein Dev.to-Artikel behauptet, Paddle verlange eine Refund Policy „with zero exceptions“ (https://dev.to/pavelbuild/paddle-rejected-my-saas-3-times-heres-what-they-check-that-isnt-in-their-docs-5dnn [S]). Das ist in den Paddle-Primärquellen **nicht verifiziert**. Paddles eigene Refund Policy enthält selbst Ausnahmen (Fraud, Abuse).

### 1.6 Paddle Acceptable Use Policy (AUP)

- URL: https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle [P]. „Last updated“ laut Seite **13 April 2026** (per WebFetch ermittelt, im Rohtext nicht erneut geprüft).
- Das MSA verweist auf „https://paddle.com/support/aup/“. Die URL paddle.com/legal/acceptable-use-policy lieferte 404.

Wörtlich (per Abruf extrahiert):
- Verboten (Content Generation): „Any content generation using a person's likeness without that person's explicit consent“, „Face Swaps“, „Deep Fakes Images or Videos“, „Voice Impersonations“, „Automated decision-making or categorization of people“
- Restricted: „Human-like faces in realistic, stylized, or animated forms“
- „Technical support services, including any software or service, marketed to repair, maintain, or improve the performance or security of an Electronic Device (Restricted Category)“
- „System Health Products, including but not limited to: Device Cleaners, Antivirus“

**Ist KI-Code-Review erlaubt?** In der AUP gibt es **keinen Tatbestand**, der KI-Code-Review oder allgemein KI-Entwicklerwerkzeuge verbietet oder beschränkt. Die Suche nach „LLM“, „AI wrapper“ und „chatbot“ ergab keine Treffer. **[Bewertung]** Erlaubt, solange unslop nicht als „Security für Geräte“ vermarktet wird. „Security review of your code“ ist etwas anderes als „improve the security of an Electronic Device“. Das Wording auf der Website sollte das trotzdem auseinanderhalten.

Sekundär: Freemius-Blog, „AI-powered code editor … clear review on every major platform“ (https://freemius.com/blog/payment-platform-restrictions-ai-apps/ [S]).

### 1.7 Paddle Customer Portal (Kündigung/Widerruf)

- https://developer.paddle.com/concepts/customer-portal [P]: „When customers cancel their subscription, portal launches a cancellation flow.“ … „You can generate authenticated links to the customer portal for a customer in your app so they don't have to sign in again.“ … „For compliance, you must offer a way for customers to cancel their subscriptions, too.“ (per WebFetch extrahiert)
- https://developer.paddle.com/changelog/2026/cancellation-flows-customer-portal/ [P]: 09.01.2026, „dynamic offboarding experience … to prevent churn“. Ob sich der Flow deaktivieren lässt, steht dort nicht **[nicht verifiziert]**.

**[Bewertung]** § 312k Abs. 2 BGB verlangt, dass die Kündigungsschaltfläche „unmittelbar“ zu einer Bestätigungsseite führt. Vorgeschaltete Halteangebote wie Umfrage oder Rabatt sind damit schwer zu vereinbaren. Konkrete Rechtsprechung zu Retention-Screens wurde hier nicht geprüft **[nicht verifiziert]**. Empfehlung: Cancellation Flows für DE-Verbraucher prüfen oder abschalten, oder einen eigenen § 312k-konformen Pfad bauen.

---

## 2. Aufgabenteilung: Was regelt Paddle, was muss unslop regeln

Quelle für die Paddle-Spalte: Buyer Terms und Refund Policy (1.1, 1.2), MSA (1.3).

| Thema | Paddle Buyer Terms / Refund Policy | unslop Terms (Supplier Agreement) |
|---|---|---|
| Kaufvertrag, Verkäufer | Paddle ist Reseller/Verkäufer | nur Hinweis „Paddle ist MoR“ (Pflichtsatz) |
| Zahlung, Zahlungsmittel, Fehlschläge | geregelt (Ziff. 2, 3) | nicht regeln (MSA 10.1) |
| Steuern/USt, B2B-Reverse-Charge-Erstattung | geregelt (Ziff. 7) | nicht regeln |
| Rechnung | Paddle (MSA 6.1) | nicht regeln |
| Abo-Verlängerung, Trial-Umstellung | geregelt (Ziff. 3) | Leistungsumfang je Plan und Trial-Umfang beschreiben |
| Preiserhöhung | Paddle informiert, holt Zustimmung ein „if required by law“ | Preise setzt formal Paddle (MSA 3.4). unslop regelt nur leistungsseitige Änderungen |
| Kündigung des Abos | Paddle Portal, Ende der Periode (Ziff. 6) | auf Paddle verweisen und § 312k-Link bereitstellen (MSA 11.1(iii)). Außerdem Kündigung/Sperrung des **Accounts** durch unslop regeln |
| Widerruf (EU-Verbraucher) | Ziff. 15, Refund Policy 2.2/3.1.1 inkl. Withdrawal-Button | Belehrung für den Nutzungsvertrag, soweit unslop selbst Unternehmer ist (siehe 5.3). Verweis auf Paddle-Button |
| Refunds, Kulanz | Paddle, Ermessen (Refund Policy 7) | keine eigenen Zahlungen (MSA 10.1). Kulanz nur „über Paddle“ |
| Chargebacks | Paddle. Supplier darf Zugang während Prüfung sperren (Ziff. 4) | Sperrrecht spiegeln |
| Produktlizenz, Nutzungsrecht am Dienst | **nein**, verweist auf Supplier Agreement | **regeln** |
| Account, Zugangsdaten, Teams/Seats | nein | **regeln** |
| Acceptable Use des Dienstes | nur für Paddle-Services | **regeln** (Missbrauch, Rate Limits, Reverse Engineering, fremder Code ohne Berechtigung) |
| Rechte am Kundencode | nein | **regeln** (Kunde behält alle Rechte, Lizenz an unslop nur zur Leistungserbringung, keine Trainingsnutzung) |
| Rechte an KI-Output | nein | **regeln** (siehe 4.3) |
| Leistungsbeschreibung, Grenzen der KI | nein | **regeln** (keine Vollständigkeit, kein Ersatz für menschliches Review) |
| Verfügbarkeit, SLA, Support | nein (MSA 6.4: Supplier) | **regeln** |
| Mängelrechte, Gewährleistung | ausdrücklich Supplier („You may benefit from a warranty from the relevant Supplier“) | **regeln** (B2C: §§ 327 ff. zwingend, § 327s) |
| Haftung für das Produkt | Paddle schließt aus | **regeln** (§§ 307, 309 Nr. 7) |
| Freistellung | nein | **regeln** (nur B2B sinnvoll) |
| Änderungen des Dienstes | nein | **regeln** (§ 327r für B2C) |
| Änderungen der Terms | nur für Paddle-Terms | **regeln** (BGH XI ZR 26/20) |
| Datenschutz | Paddle Privacy Notice für Zahlungsdaten | **Verweis** auf eigene Datenschutzerklärung und **AVV** (B2B) |
| Recht, Gerichtsstand | englisches Recht (Paddle ↔ Buyer) | eigenes Recht und Gerichtsstand für den Nutzungsvertrag (Rom I Art. 6, § 38 ZPO) |
| Sprache | EN maßgeblich, außer zwingendes Verbraucherrecht | DE/EN-Fassungen und Vorrangregel |
| KI-Transparenz (AI Act) | nein | Hinweise in Terms, Datenschutz und UI (siehe 7) |

---

## 3. Deutsches AGB-Recht: Primärtexte (wörtlich, gesetze-im-internet.de)

### 3.1 § 305 Abs. 2 BGB (Einbeziehung)
https://www.gesetze-im-internet.de/bgb/__305.html [P]
> „(2) Allgemeine Geschäftsbedingungen werden nur dann Bestandteil eines Vertrags, wenn der Verwender bei Vertragsschluss 1. die andere Vertragspartei ausdrücklich … auf sie hinweist und 2. der anderen Vertragspartei die Möglichkeit verschafft, in zumutbarer Weise … von ihrem Inhalt Kenntnis zu nehmen, und wenn die andere Vertragspartei mit ihrer Geltung einverstanden ist.“

**[Bewertung, praktisch]** Paddle verlangt ohnehin „Make sure the buyer accepts their terms & conditions … before they make a purchase“ (Seller Handbook). Für die GitHub-App-Installation ohne Paddle-Kauf (Free Tier) und für CLI-/API-Keys braucht es einen **eigenen** Zustimmungsschritt beim Signup.

### 3.2 § 307 BGB (Inhaltskontrolle, Transparenz)
https://www.gesetze-im-internet.de/bgb/__307.html [P]
> „(1) Bestimmungen in Allgemeinen Geschäftsbedingungen sind unwirksam, wenn sie den Vertragspartner des Verwenders entgegen den Geboten von Treu und Glauben unangemessen benachteiligen. Eine unangemessene Benachteiligung kann sich auch daraus ergeben, dass die Bestimmung nicht klar und verständlich ist.
> (2) Eine unangemessene Benachteiligung ist im Zweifel anzunehmen, wenn eine Bestimmung 1. mit wesentlichen Grundgedanken der gesetzlichen Regelung, von der abgewichen wird, nicht zu vereinbaren ist oder 2. wesentliche Rechte oder Pflichten, die sich aus der Natur des Vertrags ergeben, so einschränkt, dass die Erreichung des Vertragszwecks gefährdet ist.“

### 3.3 § 309 Nr. 7 BGB (Haftungsausschluss)
https://www.gesetze-im-internet.de/bgb/__309.html [P]
> „7. (Haftungsausschluss bei Verletzung von Leben, Körper, Gesundheit und bei grobem Verschulden) a) (Verletzung von Leben, Körper, Gesundheit) ein Ausschluss oder eine Begrenzung der Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen Pflichtverletzung des Verwenders oder einer vorsätzlichen oder fahrlässigen Pflichtverletzung eines gesetzlichen Vertreters oder Erfüllungsgehilfen des Verwenders beruhen; b) (Grobes Verschulden) ein Ausschluss oder eine Begrenzung der Haftung für sonstige Schäden, die auf einer grob fahrlässigen Pflichtverletzung des Verwenders oder auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung eines gesetzlichen Vertreters oder Erfüllungsgehilfen des Verwenders beruhen;“

### 3.4 § 310 Abs. 1 BGB (B2B)
https://www.gesetze-im-internet.de/bgb/__310.html [P]
> „(1) § 305 Absatz 2 und 3, § 308 Nummer 1, 2 bis 9 und § 309 finden keine Anwendung auf Allgemeine Geschäftsbedingungen, die gegenüber einem Unternehmer … verwendet werden. § 307 Abs. 1 und 2 findet in den Fällen des Satzes 1 auch insoweit Anwendung, als dies zur Unwirksamkeit von in § 308 Nummer 1, 2 bis 9 und § 309 genannten Vertragsbestimmungen führt; auf die im Handelsverkehr geltenden Gewohnheiten und Gebräuche ist angemessen Rücksicht zu nehmen.“

**[Bewertung]** Die Wertungen des § 309 Nr. 7 strahlen über § 307 auch in B2B-Verträge aus. Eine B2B-Haftungsklausel sollte deshalb dieselbe Grundstruktur haben wie die B2C-Klausel, darf aber zusätzlich summenmäßig begrenzen.

### 3.5 Kardinalpflichten
- Verbreitete Definition: „wesentliche Vertragspflichten, deren Erfüllung die ordnungsgemäße Durchführung eines Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Vertragspartner regelmäßig vertrauen darf“. Nach der Sekundärquelle hat der BGH am 20.07.2005 (VIII ZR 121/04) entschieden, dass der Begriff „Kardinalpflicht“ in AGB ohne Erläuterung gegen § 307 Abs. 1 S. 2 verstößt. Quellen: https://de.wikipedia.org/wiki/Kardinalpflicht [S], https://www.damm-legal.de/olg-celle-die-begriffe-wesentliche-vertragspflicht-und-kardinalpflicht-in-agb-verstossen-gegen-das-transparenzgebot [S]. **Urteilstext nicht im Primärtext abgerufen → Aktenzeichen und Inhalt [nicht verifiziert (primär)].**
- **Paddle selbst** verwendet für DE-Verbraucher: „If we breach an essential contractual obligation …, our liability is not excluded and is limited to the foreseeable damage typical for this type of agreement.“ [P, Buyer Terms Ziff. 15]
- **[Bewertung]** Standardaufbau einer Haftungsklausel:
  - unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Leben/Körper/Gesundheit, nach ProdHaftG und bei Garantie;
  - bei leichter Fahrlässigkeit nur für die Verletzung wesentlicher Vertragspflichten, **mit ausformulierter Definition**, begrenzt auf den vertragstypisch vorhersehbaren Schaden;
  - sonst ausgeschlossen;
  - B2B zusätzlich eine Summenbegrenzung (z. B. Entgelt der letzten 12 Monate).

  Die Summenbegrenzung bei Kardinalpflichten ist auch B2B an § 307 zu messen. Rechtsprechung dazu wurde nicht geprüft **[nicht verifiziert]**.

### 3.6 Änderungsklauseln: BGH XI ZR 26/20 (27.04.2021)
- Pressemitteilung des BGH Nr. 088/2021: https://www.bundesgerichtshof.de/SharedDocs/Pressemitteilungen/DE/2021/2021088.html [P, per WebFetch extrahiert]. Wörtlich (Ausschnitte): Unwirksam sind „Klauseln, die ohne inhaltliche Einschränkung die Zustimmung des Kunden zu Änderungen der Allgemeinen Geschäftsbedingungen … fingieren“. Sie weichen „von wesentlichen Grundgedanken der § 305 Abs. 2, § 311 Abs. 1, §§ 145 ff. BGB ab“. „Für so weitreichende … Änderungen, die dem Abschluss eines neuen Vertrags gleichkommen können, ist vielmehr ein … Änderungsvertrag notwendig.“ Kläger war der vzbv (§ 1 UKlaG, Verbraucherverband).
- **Reichweite:**
  - Das Urteil betrifft Banken-AGB im Verbraucherverhältnis (XI. Senat).
  - Ob es auf andere Branchen übertragbar ist, sagt die Pressemitteilung nicht ausdrücklich. Die WebFetch-Zusammenfassung „does not extend to non-financial sectors“ ist eine **Interpretation, keine Aussage des BGH**.
  - **[Bewertung]** Tragend ist § 307 i. V. m. §§ 305 Abs. 2, 311 Abs. 1. Das gilt branchenunabhängig. Die Literatur überträgt das Urteil deshalb überwiegend auf SaaS **[S, nicht einzeln verifiziert]**.
- Ergänzend: **BGH, Urt. v. 10.07.2025, III ZR 59/24**. Ein Verweis auf im Internet abrufbare AGB **ohne Versionsangabe** („in der jeweils gültigen Fassung“) verstößt gegen das Transparenzgebot, weil er ein uneingeschränktes Änderungsrecht eröffnet. Quellen: https://www.eylaw.de/de_de/news/2026/bgh-zur-einbeziehung-von-agb-warum-dynamische-verweisungen-dem-transparenzgebot-nicht-genuegen [S], https://openjur.de/u/2530103.html [S, Urteilstext; nicht wörtlich ausgewertet]. Der Fall betraf einen Verbraucherverband gegen ein TK-Unternehmen.
- **B2B-Lage:** Keine spezifische höchstrichterliche Entscheidung zu Zustimmungsfiktionen in B2B-SaaS-AGB gefunden **[nicht verifiziert]**. Maßstab ist § 307 über § 310 Abs. 1. **[Bewertung]** Eine Zustimmungsfiktion ist B2B eher haltbar, wenn sie inhaltlich begrenzt ist:
  - keine Änderung der Hauptleistungspflichten und des Preises;
  - triftiger Grund;
  - angemessene Frist (z. B. 6 Wochen);
  - Widerspruchs- bzw. Sonderkündigungsrecht und ausdrücklicher Hinweis auf die Folgen des Schweigens.
- **B2C:** Bei Verbrauchern keine Zustimmungsfiktion für Terms-Änderungen. Stattdessen ausdrückliche Zustimmung, etwa per Klick beim nächsten Login. Für Änderungen **des digitalen Produkts** gilt § 327r BGB (siehe 5.4).

### 3.7 Gerichtsstand: § 38 ZPO
https://www.gesetze-im-internet.de/zpo/__38.html [P]
> „(1) Ein an sich unzuständiges Gericht des ersten Rechtszuges wird durch ausdrückliche oder stillschweigende Vereinbarung der Parteien zuständig, wenn die Vertragsparteien Kaufleute, juristische Personen des öffentlichen Rechts oder öffentlich-rechtliche Sondervermögen sind.
> (2) Die Zuständigkeit … kann ferner vereinbart werden, wenn mindestens eine der Vertragsparteien keinen allgemeinen Gerichtsstand im Inland hat. Die Vereinbarung muss schriftlich abgeschlossen oder … schriftlich bestätigt werden. …“

**[Bewertung]** Eine Gerichtsstandsklausel wirkt nur gegenüber **Kaufleuten** und juristischen Personen des öffentlichen Rechts. Freiberufler, Einzel-Entwickler und Nicht-Kaufleute sind nicht erfasst. Formulierung daher: „Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder … ist ausschließlicher Gerichtsstand [Sitz der UG]“. Für EU-Auslandskunden gilt die Brüssel-Ia-VO (Art. 25; Verbraucher Art. 17–19). Die **Primärtexte wurden nicht abgerufen [nicht verifiziert]**.

### 3.8 Rechtswahl: Rom I Art. 6
VO (EG) 593/2008, amtliche DE-Fassung aus dem Cellar (https://publications.europa.eu/resource/celex/32008R0593) [P]:
> „(1) Unbeschadet der Artikel 5 und 7 unterliegt ein Vertrag, den eine natürliche Person zu einem Zweck, der nicht ihrer beruflichen oder gewerblichen Tätigkeit zugerechnet werden kann („Verbraucher“), mit einer anderen Person geschlossen hat, die in Ausübung ihrer beruflichen oder gewerblichen Tätigkeit handelt („Unternehmer“), dem Recht des Staates, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, sofern der Unternehmer a) seine berufliche oder gewerbliche Tätigkeit in dem Staat ausübt, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, oder b) eine solche Tätigkeit auf irgend einer Weise auf diesen Staat oder auf mehrere Staaten, einschließlich dieses Staates, ausrichtet und der Vertrag in den Bereich dieser Tätigkeit fällt.
> (2) Ungeachtet des Absatzes 1 können die Parteien das auf einen Vertrag, der die Anforderungen des Absatzes 1 erfüllt, anzuwendende Recht nach Artikel 3 wählen. Die Rechtswahl darf jedoch nicht dazu führen, dass dem Verbraucher der Schutz entzogen wird, der ihm durch diejenigen Bestimmungen gewährt wird, von denen nach dem Recht, das nach Absatz 1 mangels einer Rechtswahl anzuwenden wäre, nicht durch Vereinbarung abgewichen werden darf.“

- **EuGH, 28.07.2016, C-191/15 (VKI/Amazon):** Eine Rechtswahlklausel in Verbraucher-AGB ist missbräuchlich, wenn sie den Verbraucher nicht darauf hinweist, dass ihm zusätzlich der Schutz der zwingenden Bestimmungen seines Aufenthaltsrechts zusteht. Quellen: https://www.lto.de/recht/hintergruende/h/eugh-c19115-amazon-agb-rechtswahlklausel-unwirksam [S], https://curia.europa.eu/juris/liste.jsf?language=de&num=C-191/15 [P-Fundstelle, **Urteilstext nicht abgerufen**].
- **[Bewertung]** Formulierung: „Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur, soweit dadurch nicht der Schutz entzogen wird, der durch zwingende Bestimmungen des Rechts des Staates gewährt wird, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat.“

### 3.9 Urheberrecht an KI-Output
- § 2 Abs. 2 UrhG [P, https://www.gesetze-im-internet.de/urhg/__2.html]: „Werke im Sinne dieses Gesetzes sind nur persönliche geistige Schöpfungen.“
- § 69a Abs. 3 UrhG [P, https://www.gesetze-im-internet.de/urhg/__69a.html]: „Computerprogramme werden geschützt, wenn sie individuelle Werke in dem Sinne darstellen, daß sie das Ergebnis der eigenen geistigen Schöpfung ihres Urhebers sind.“
- **[Bewertung]** Rein KI-generierte Review-Texte und Fix-Vorschläge haben mangels menschlicher Schöpfung wahrscheinlich keinen Werkschutz. Rechtsprechung dazu wurde nicht geprüft **[nicht verifiziert]**. Die Terms sollten deshalb keine „Übertragung des Urheberrechts“ versprechen. Stattdessen: „Soweit an Ausgaben Rechte von unslop bestehen, räumt unslop dem Kunden ein einfaches/ausschließliches, unbefristetes Nutzungsrecht ein. unslop übernimmt keine Gewähr, dass Ausgaben schutzfähig oder frei von Rechten Dritter sind.“

### 3.10 Sprachfassung
- **KG Berlin, Urt. v. 08.04.2016, 5 U 156/14 (vzbv ./. WhatsApp):** Rein englische AGB auf einer an deutsche Verbraucher gerichteten Website sind intransparent. „juristisches, vertragssprachliches und kommerzielles Englisch“ könne von Verbrauchern nicht erwartet werden. Quelle: https://www.vzbv.de/urteile/whatsapp-muss-agb-auf-deutsch-bereitstellen [S, Verbandsseite; Urteilstext nicht abgerufen].
- **[Bewertung]**
  - B2C: eine deutsche Fassung ist nötig, sobald die Website sich (auch) auf Deutsch an Verbraucher richtet. unslop hat /de.
  - Vorrangklausel: „Bei Widersprüchen geht die deutsche Fassung vor“, oder im Verbraucherfall „die für den Verbraucher günstigere“. Rechtsprechung zu Günstigkeits-Vorrangklauseln wurde nicht geprüft [nicht verifiziert].
  - B2B: englische AGB sind grundsätzlich zulässig, wenn Englisch Verhandlungs- bzw. Vertragssprache ist [nicht verifiziert, keine Primärquelle abgerufen].
- Der neue Art. 246b § 1 Abs. 1 Nr. 21 EGBGB (Finanzdienstleistungen) verlangt Angaben dazu, in welcher Sprache Vertragsbedingungen mitgeteilt werden (BGBl. 2026 I Nr. 28) [P]. Für unslop ist das **nicht einschlägig** (keine Finanzdienstleistung).

---

## 4. Inhaltliche Bausteine, die unslop selbst regeln muss

1. **Leistungsbeschreibung und KI-Grenzen.**
   - Die Findings sind KI-generierte Hinweise. unslop schuldet eine Analyse nach dem jeweiligen Stand des Dienstes, **keine** Vollständigkeit, Fehlerfreiheit oder Sicherheitsgarantie.
   - Der Dienst ersetzt kein menschliches Review. Die Entscheidung über Merge und Deployment liegt beim Kunden.
   - **Achtung B2C:** Die objektiven Anforderungen nach § 327e Abs. 3 BGB können nur unter den strengen Voraussetzungen des § 327h BGB abbedungen werden. Nötig sind „eigens“ Information vor Vertragsschluss und eine „ausdrücklich und gesondert“ vereinbarte Abweichung. Wortlaut § 327h [P, https://www.gesetze-im-internet.de/bgb/__327h.html]:
     > „Von den objektiven Anforderungen nach § 327e Absatz 3 Satz 1 Nummer 1 bis 5 und Satz 2, § 327f Absatz 1 und § 327g kann nur abgewichen werden, wenn der Verbraucher vor Abgabe seiner Vertragserklärung eigens davon in Kenntnis gesetzt wurde, dass ein bestimmtes Merkmal des digitalen Produkts von diesen objektiven Anforderungen abweicht, und diese Abweichung im Vertrag ausdrücklich und gesondert vereinbart wurde.“

     **[Bewertung]** Eine KI-Fehlerquote ist bei KI-Code-Review wohl ohnehin „üblich“ und damit Teil der objektiven Anforderungen. Der Hinweis gehört trotzdem **vor den Kauf** (Checkbox oder Hinweis im Checkout-Vorfeld).
2. **Kundencode / Input.**
   - Der Kunde behält alle Rechte.
   - Einfache, nicht übertragbare, auf die Vertragsdauer begrenzte Lizenz an unslop „ausschließlich zur Erbringung des Dienstes“, einschließlich Übermittlung an Subprozessoren (LLM-Anbieter) gemäß AVV bzw. Datenschutzerklärung.
   - Ausdrücklich keine Nutzung zum Training eigener oder fremder Modelle, falls das zutrifft.
   - Der Kunde versichert, zur Übermittlung berechtigt zu sein (Dritt-Repos, Arbeitgeber-Code).
3. **Output.** Siehe 3.9. Hinzu kommt der Hinweis, dass KI-Vorschläge Code Dritter reproduzieren können und keine Freiheit von Rechten Dritter garantiert wird.
4. **Account, Seats, GitHub-App-Berechtigungen.**
   - Verantwortung für Org-Admins.
   - Wer die App für eine Organisation installiert, handelt für diese (Vertretungsmacht).
5. **Acceptable Use.**
   - Kein Einsatz zur Umgehung von Sicherheitsmaßnahmen.
   - Keine Überlastung, kein Scraping der API und kein Reverse Engineering der Prompts oder Modelle.
   - Kein Einreichen fremden Codes ohne Recht dazu und keine rechtswidrigen Inhalte.
   - Einhaltung der Rate Limits.
6. **Verfügbarkeit / SLA.**
   - Kein SLA im Free- und Pro-Plan, oder z. B. „im Jahresmittel angestrebt“ ohne Rechtsfolge.
   - Wartungsfenster; Abhängigkeit von GitHub und LLM-Anbietern.
   - B2C: Mängelrechte nach §§ 327 ff. sind nicht abdingbar (§ 327s).
7. **Sperrung / Kündigung durch unslop.** Bei Verstoß gegen AUP, bei Chargeback-Missbrauch (spiegelt Buyer Terms Ziff. 4) und bei Sicherheitsrisiken. Ordentliche Kündigung des Nutzungsvertrags mit Frist und Erstattungsweg über Paddle.
8. **Freistellung (nur B2B).** Freistellung durch den Kunden bei Ansprüchen Dritter wegen rechtswidrig eingereichten Codes.
9. **Datenschutz.** Verweis auf die Datenschutzerklärung. Für Geschäftskunden eine **AVV nach Art. 28 DSGVO** als Anlage oder per Klick, weil Code personenbezogene Daten enthalten kann (Commit-Autoren, Secrets, Kundendaten in Fixtures). Die DSGVO wurde hier nicht vertieft [nicht verifiziert].
10. **Vertragspartner-Hinweis und Paddle-Pflichtsatz** (1.4).
11. **Kommunikation und Zugang von Erklärungen:** E-Mail oder Dashboard.

---

## 5. Verbraucher-Themen (Stand 28.09.2026)

### 5.1 § 356 BGB, aktuelle Fassung (seit 19.06.2026 neu nummeriert)
https://www.gesetze-im-internet.de/bgb/__356.html [P]. Das Gesetz vom 03.02.2026 hat die bisherigen Absätze 4 und 5 zu **Absätzen 5 und 6** gemacht und einen neuen Abs. 4 (Höchstfrist) eingefügt: BGBl. 2026 I Nr. 28, Art. 1 Nr. 7 (https://www.recht.bund.de/bgbl/1/2026/28/regelungstext.pdf) [P].

Wörtlich:
> „(4) Das Widerrufsrecht erlischt spätestens zwölf Monate und 14 Tage nach dem in Absatz 2 oder § 355 Absatz 2 Satz 2 genannten Zeitpunkt. …“

> „(5) Das Widerrufsrecht erlischt bei Verträgen über die Erbringung von Dienstleistungen auch unter folgenden Voraussetzungen: 1. bei einem Vertrag, der den Verbraucher nicht zur Zahlung eines Preises verpflichtet, wenn der Unternehmer die Dienstleistung vollständig erbracht hat, 2. bei einem Vertrag, der den Verbraucher zur Zahlung eines Preises verpflichtet, mit der vollständigen Erbringung der Dienstleistung, wenn der Verbraucher vor Beginn der Erbringung a) ausdrücklich zugestimmt hat, dass der Unternehmer mit der Erbringung der Dienstleistung vor Ablauf der Widerrufsfrist beginnt, b) bei einem außerhalb von Geschäftsräumen geschlossenen Vertrag die Zustimmung nach Buchstabe a auf einem dauerhaften Datenträger übermittelt hat und c) seine Kenntnis davon bestätigt hat, dass sein Widerrufsrecht mit vollständiger Vertragserfüllung durch den Unternehmer erlischt, …“

> „(6) Das Widerrufsrecht erlischt bei Verträgen über die Bereitstellung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten auch unter folgenden Voraussetzungen: … 2. bei einem Vertrag, der den Verbraucher zur Zahlung eines Preises verpflichtet, wenn a) der Unternehmer mit der Vertragserfüllung begonnen hat, b) der Verbraucher ausdrücklich zugestimmt hat, dass der Unternehmer mit der Vertragserfüllung vor Ablauf der Widerrufsfrist beginnt, c) der Verbraucher seine Kenntnis davon bestätigt hat, dass durch seine Zustimmung nach Buchstabe b mit Beginn der Vertragserfüllung sein Widerrufsrecht erlischt, und d) der Unternehmer dem Verbraucher eine Bestätigung gemäß § 312f zur Verfügung gestellt hat.“

§ 357a Abs. 2 BGB [P, https://www.gesetze-im-internet.de/bgb/__357a.html]:
> „Der Verbraucher hat Wertersatz für die bis zum Widerruf erbrachten Dienstleistungen, für die der Vertrag die Zahlung eines Preises vorsieht, … zu leisten, wenn 1. der Verbraucher von dem Unternehmer ausdrücklich verlangt hat, dass mit der Leistung vor Ablauf der Widerrufsfrist begonnen werden soll, … 3. der Unternehmer den Verbraucher nach Artikel 246a § 1 Absatz 2 Satz 1 Nummer 1 und 3 des Einführungsgesetzes zum Bürgerlichen Gesetzbuche ordnungsgemäß informiert hat. Bei der Berechnung des Wertersatzes ist der vereinbarte Gesamtpreis zu Grunde zu legen. …“
>
> „(3) Widerruft der Verbraucher einen Vertrag über die Bereitstellung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten, so hat er keinen Wertersatz zu leisten.“

**[Bewertung]** unslop (SaaS) ist eine **digitale Dienstleistung** (§ 327 Abs. 2 S. 2 Nr. 1: „die Erstellung, die Verarbeitung oder die Speicherung von Daten in digitaler Form … ermöglichen“). Einschlägig ist daher Abs. 5, nicht Abs. 6. Folge: Nach einem Widerruf innerhalb von 14 Tagen besteht Anspruch auf **anteiligen Wertersatz**, wenn der Kunde den sofortigen Beginn verlangt hat. Ein vollständiges Erlöschen tritt nicht ein. Paddles Formulierung („digital content … waive“) passt dazu nur ungenau. Das ist Paddles Risiko als Verkäufer. unslop sollte im Checkout-Vorfeld bzw. Signup nichts Gegenteiliges behaupten.

### 5.2 § 356a BGB: elektronische Widerrufsfunktion („Widerrufsbutton“)

**In Kraft seit 19.06.2026.** Belege:
- BGBl. 2026 I Nr. 28, ausgegeben 05.02.2026: „Gesetz zur Änderung des Verbrauchervertrags- und des Versicherungsvertragsrechts sowie zur Änderung des Behandlungsvertragsrechts“ vom 3. Februar 2026 [P].
- Art. 10 Abs. 1: „Dieses Gesetz tritt vorbehaltlich der Absätze 2 und 3 am 19. Juni 2026 in Kraft.“
- Umgesetzt wird u. a. die RL (EU) 2023/2673 (Fußnote des Gesetzes).

Wortlaut (https://www.gesetze-im-internet.de/bgb/__356a.html) [P]:
> „(1) Bei Fernabsatzverträgen, die über eine Online-Benutzeroberfläche geschlossen werden, hat der Unternehmer sicherzustellen, dass der Verbraucher auf der Online-Benutzeroberfläche durch das Nutzen einer Widerrufsfunktion eine Widerrufserklärung abgeben kann. Die Widerrufsfunktion muss gut lesbar mit „Vertrag widerrufen“ oder einer anderen gleichbedeutenden eindeutigen Formulierung beschriftet sein. Sie muss während des Laufs der Widerrufsfrist auf der Online-Benutzeroberfläche ständig verfügbar, hervorgehoben platziert und für den Verbraucher leicht zugänglich sein.
> (2) Die Widerrufsfunktion muss dem Verbraucher ermöglichen, eine Widerrufserklärung an den Unternehmer zu übermitteln und dem Unternehmer in oder mit der Widerrufserklärung ohne Weiteres folgende Informationen bereitzustellen oder zu bestätigen: 1. den Namen des Verbrauchers, 2. Angaben zur Identifizierung des Vertrags oder des Teils des Vertrags, den der Verbraucher widerrufen möchte, 3. Angaben zum elektronischen Kommunikationsmittel, mit welchem dem Verbraucher eine Eingangsbestätigung für den Widerruf zu übermitteln ist.
> (3) Sobald der Verbraucher die Informationen nach Absatz 2 bereitgestellt oder bestätigt hat, hat der Unternehmer dem Verbraucher zu ermöglichen, seine Widerrufserklärung und die Informationen dem Unternehmer mittels einer Bestätigungsfunktion zu übermitteln. Diese Bestätigungsfunktion muss gut lesbar und mit „Widerruf bestätigen“ oder einer anderen gleichbedeutenden eindeutigen Formulierung beschriftet sein.
> (4) Der Unternehmer hat dem Verbraucher, wenn dieser die Bestätigungsfunktion aktiviert hat, auf einem dauerhaften Datenträger unverzüglich eine Eingangsbestätigung zu übermitteln, die zumindest den Inhalt der Widerrufserklärung nach Absatz 2 sowie das Datum und die Uhrzeit ihres Eingangs enthält.
> (5) Die Widerrufserklärung des Verbrauchers gilt als dem Unternehmer innerhalb der Widerrufsfrist zugegangen, wenn er die Widerrufserklärung nach Absatz 3 vor Ablauf dieser Frist über die Widerrufsfunktion versandt hat.“

- **Bußgeld:** Art. 246e EGBGB, neue Nr. 14a: Ordnungswidrig ist, wenn die Widerrufsfunktion „nicht oder nicht nach Maßgabe von § 356a Absatz 1 bis 3 … zur Verfügung gestellt wird oder wenn dem Verbraucher keine Eingangsbestätigung … übermittelt wird“. Geldbuße bis 50.000 € bzw. bis 4 % des Jahresumsatzes bei über 1,25 Mio. € Umsatz. Das gilt **nur im Rahmen einer koordinierten Durchsetzungsmaßnahme nach Art. 21 VO (EU) 2017/2394** (BGBl. 2026 I Nr. 28, Art. 2 Nr. 4) [P].
- **Muster-Widerrufsbelehrung:** Neuer Gestaltungshinweis 3 in Anlage 1 zu Art. 246a EGBGB: „Sie können Ihr Widerrufsrecht auch online unter … [Internetadresse …] ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung …“ [P, BGBl. 2026 I Nr. 28].

**Wer muss den Button stellen? [Bewertung]**
- Adressat ist „der Unternehmer“ des Fernabsatzvertrags. Für den **Kaufvertrag** ist das Paddle. Paddle erfüllt das nach eigener Refund Policy über den Withdrawal-Button im Customer Portal.
- **Offene Frage:** „auf der Online-Benutzeroberfläche“, über die der Vertrag geschlossen wurde. Der Checkout läuft als Paddle-Overlay auf unslop.codes. Der Paddle-Button liegt dagegen im Portal (paddle.net bzw. E-Mail-Link). Ob das genügt, ist nicht höchstrichterlich geklärt **[nicht verifiziert]**.
- Vorsorglich sollte unslop auf der eigenen Oberfläche (Footer und Billing-Seite im Dashboard) einen Link „Vertrag widerrufen“ auf das Paddle-Portal bzw. paddle.net setzen. Das ist durch MSA 11.1(iii) gedeckt („access to Paddle's after sales support … as required by the applicable law“).
- Sekundär zur Pflicht allgemein: https://www.noerr.com/de/insights/umsetzungsgesetz-zum-widerrufsbutton-veroeffentlicht [S], https://www.twobirds.com/en/insights/2026/germany/mandatory-withdrawal-button-upcoming-in-germany-key-implications-for-online-sellers [S].

### 5.3 §§ 327 ff. BGB: Wer ist „Unternehmer“, wenn Paddle MoR ist?

§ 327 Abs. 1 [P]:
> „Die Vorschriften dieses Untertitels sind auf Verbraucherverträge anzuwenden, welche die Bereitstellung digitaler Inhalte oder digitaler Dienstleistungen (digitale Produkte) durch den Unternehmer gegen Zahlung eines Preises zum Gegenstand haben.“

§ 327 Abs. 3 [P]:
> „Die Vorschriften dieses Untertitels sind auch auf Verbraucherverträge über die Bereitstellung digitaler Produkte anzuwenden, bei denen der Verbraucher dem Unternehmer personenbezogene Daten bereitstellt oder sich zu deren Bereitstellung verpflichtet, es sei denn, die Voraussetzungen des § 312 Absatz 1a Satz 2 liegen vor.“

§ 327u Abs. 1 (Rückgriff in der Vertriebskette) [P]:
> „Der Unternehmer kann von dem Unternehmer, der sich ihm gegenüber zur Bereitstellung eines digitalen Produkts verpflichtet hat (Vertriebspartner), Ersatz der Aufwendungen verlangen, die ihm im Verhältnis zu einem Verbraucher wegen einer durch den Vertriebspartner verursachten unterbliebenen Bereitstellung … entstanden sind. Das Gleiche gilt für die nach § 327l Absatz 1 vom Unternehmer zu tragenden Aufwendungen, wenn der … Mangel bereits bei der Bereitstellung durch den Vertriebspartner vorhanden war oder in einer durch den Vertriebspartner verursachten Verletzung der Aktualisierungspflicht des Unternehmers nach § 327f Absatz 1 besteht.“

§ 327u Abs. 4:
> „Der Vertriebspartner kann sich nicht auf eine Vereinbarung berufen, die er vor Geltendmachung der in Absatz 1 bezeichneten Aufwendungsersatzansprüche mit dem Unternehmer getroffen hat und die zum Nachteil des Unternehmers von den Absätzen 1 bis 3 abweicht.“

§ 327s Abs. 1, 4 [P]:
> „(1) Auf eine Vereinbarung mit dem Verbraucher, die zum Nachteil des Verbrauchers von den Vorschriften dieses Untertitels abweicht, kann der Unternehmer sich nicht berufen …“
>
> „(4) Die Absätze 1 und 2 gelten nicht für den Ausschluss oder die Beschränkung des Anspruchs auf Schadensersatz.“

**[Bewertung]** Primärquellen oder Rechtsprechung speziell zu MoR-Konstellationen wurden nicht gefunden **[nicht verifiziert]**. Aus den Quellen ergibt sich folgende Kette:

- **Paddle → Verbraucher (Kaufvertrag):** Paddle verkauft das „Product“ und ist damit Unternehmer im Sinne von § 327 gegenüber dem Verbraucher, „gegen Zahlung eines Preises“. Paddle hat Regress gegen unslop über § 327u **und** MSA 11.1(vi).
- **unslop → Verbraucher (Supplier Agreement / Nutzungsvertrag):** unslop „makes available“ den Dienst direkt. Auch ohne eigene Preisabrede fällt dieser Vertrag über § 327 Abs. 3 regelmäßig in den Anwendungsbereich, weil der Verbraucher personenbezogene Daten bereitstellt (Account, GitHub-Identität). Beim **Free Tier** ist unslop in jedem Fall **alleiniger** Unternehmer.
- **Konsequenz:** unslops Terms müssen gegenüber Verbrauchern §§ 327 ff.-fest sein:
  - Mängelrechte (§§ 327i ff.) nicht einschränken, außer beim Schadensersatz;
  - Aktualisierungspflicht (§ 327f) während der Bereitstellungsdauer;
  - Änderungen nur nach § 327r.

§ 327f Abs. 1 S. 1–3 [P]:
> „Der Unternehmer hat sicherzustellen, dass dem Verbraucher während des maßgeblichen Zeitraums Aktualisierungen, die für den Erhalt der Vertragsmäßigkeit des digitalen Produkts erforderlich sind, bereitgestellt werden … Zu den erforderlichen Aktualisierungen gehören auch Sicherheitsaktualisierungen. Der maßgebliche Zeitraum … ist 1. bei einem Vertrag über die dauerhafte Bereitstellung eines digitalen Produkts der Bereitstellungszeitraum …“

### 5.4 § 327r BGB: Änderungen digitaler Produkte (B2C)
[P, https://www.gesetze-im-internet.de/bgb/__327r.html]:
> „(1) Bei einer dauerhaften Bereitstellung darf der Unternehmer Änderungen des digitalen Produkts, die über das zur Aufrechterhaltung der Vertragsmäßigkeit … erforderliche Maß hinausgehen, nur vornehmen, wenn 1. der Vertrag diese Möglichkeit vorsieht und einen triftigen Grund dafür enthält, 2. dem Verbraucher durch die Änderung keine zusätzlichen Kosten entstehen und 3. der Verbraucher klar und verständlich über die Änderung informiert wird.
> (2) Eine Änderung …, welche die Zugriffsmöglichkeit des Verbrauchers auf das digitale Produkt oder welche die Nutzbarkeit … beeinträchtigt, darf der Unternehmer nur vornehmen, wenn er den Verbraucher darüber hinaus innerhalb einer angemessenen Frist vor dem Zeitpunkt der Änderung mittels eines dauerhaften Datenträgers informiert. …
> (3) … so kann der Verbraucher den Vertrag innerhalb von 30 Tagen unentgeltlich beenden. …“

**[Bewertung]** Die Terms brauchen eine Leistungsänderungsklausel mit **konkreten triftigen Gründen**, z. B.:
- Wechsel oder Abkündigung zugrunde liegender KI-Modelle durch den Anbieter;
- Sicherheit;
- Rechtsänderung;
- Änderungen der GitHub-API;
- Weiterentwicklung ohne Nachteil.

Dazu kommen: keine Zusatzkosten, Vorab-Info in Textform und das 30-Tage-Beendigungsrecht. Für unslop ist das relevant, weil Modellwechsel (Gemini-Versionen) regelmäßig stattfinden.

### 5.5 § 312k BGB: Kündigungsbutton
[P, https://www.gesetze-im-internet.de/bgb/__312k.html]:
> „(1) Wird Verbrauchern über eine Webseite ermöglicht, einen Vertrag im elektronischen Geschäftsverkehr zu schließen, der auf die Begründung eines Dauerschuldverhältnisses gerichtet ist, das einen Unternehmer zu einer entgeltlichen Leistung verpflichtet, so treffen den Unternehmer die Pflichten nach dieser Vorschrift. …
> (2) Der Unternehmer hat sicherzustellen, dass der Verbraucher auf der Webseite eine Erklärung zur ordentlichen oder außerordentlichen Kündigung eines auf der Webseite abschließbaren Vertrags nach Absatz 1 Satz 1 über eine Kündigungsschaltfläche abgeben kann. Die Kündigungsschaltfläche muss gut lesbar mit nichts anderem als den Wörtern „Verträge hier kündigen“ oder mit einer entsprechenden eindeutigen Formulierung beschriftet sein. Sie muss den Verbraucher unmittelbar zu einer Bestätigungsseite führen, die 1. den Verbraucher auffordert und ihm ermöglicht Angaben zu machen a) zur Art der Kündigung sowie im Falle der außerordentlichen Kündigung zum Kündigungsgrund, b) zu seiner eindeutigen Identifizierbarkeit, c) zur eindeutigen Bezeichnung des Vertrags, d) zum Zeitpunkt, zu dem die Kündigung das Vertragsverhältnis beenden soll, e) zur schnellen elektronischen Übermittlung der Kündigungsbestätigung an ihn und 2. eine Bestätigungsschaltfläche enthält, über deren Betätigung der Verbraucher die Kündigungserklärung abgeben kann und die gut lesbar mit nichts anderem als den Wörtern „jetzt kündigen“ oder mit einer entsprechenden eindeutigen Formulierung beschriftet ist. Die Schaltflächen und die Bestätigungsseite müssen ständig verfügbar sowie unmittelbar und leicht zugänglich sein.
> …
> (6) Werden die Schaltflächen und die Bestätigungsseite nicht entsprechend den Absätzen 1 und 2 zur Verfügung gestellt, kann ein Verbraucher einen Vertrag, für dessen Kündigung die Schaltflächen und die Bestätigungsseite zur Verfügung zu stellen sind, jederzeit und ohne Einhaltung einer Kündigungsfrist kündigen. …“

**[Bewertung]**
- Die Pflicht hängt an der **Webseite**, über die der Vertrag geschlossen werden kann. Das ist unslop.codes (Pricing mit Paddle-Overlay).
- Paddle ist Unternehmer des Abo-Vertrags. unslop ist Unternehmer des Nutzungsvertrags und Betreiber der Webseite.
- Paddle verlagert die Umsetzung per MSA 11.1(iii) („direct link to enable cancellation … if it is required“) ausdrücklich auf den Supplier.
- Das Paddle-Portal bietet „Cancel subscription“, aber mit vorgeschaltetem **Cancellation Flow** (Retention). Ob das „unmittelbar“ im Sinne des Abs. 2 ist, ist fraglich [Bewertung, nicht verifiziert].
- **Empfehlung:** Ein Button „Verträge hier kündigen“ auf unslop.codes, ständig erreichbar ohne Login (Footer). Er führt zu einer unslop-Bestätigungsseite mit den Feldern a–e und „jetzt kündigen“. Serverseitig wird die Paddle-API aufgerufen (Kündigung zum Periodenende), und es folgt eine sofortige Textform-Bestätigung (Abs. 4).
- Sekundär: https://stripe.com/resources/more/mandatory-cancellation-button-germany [S], https://www.taylorwessing.com/en/insights-and-events/insights/2024/06/germany-two-years-of-cancellation-buttons [S].

---

## 6. EU AI Act (VO (EU) 2024/1689): Art. 50, Art. 4, Digital-Omnibus

### 6.1 Art. 50 (amtliche DE-Fassung, ABl. L 2024/1689, via Cellar [P])
> „(1) Die Anbieter stellen sicher, dass KI-Systeme, die für die direkte Interaktion mit natürlichen Personen bestimmt sind, so konzipiert und entwickelt werden, dass die betreffenden natürlichen Personen informiert werden, dass sie mit einem KI-System interagieren, es sei denn, dies ist aus Sicht einer angemessen informierten, aufmerksamen und verständigen natürlichen Person aufgrund der Umstände und des Kontexts der Nutzung offensichtlich. …
> (2) Anbieter von KI-Systemen, einschließlich KI-Systemen mit allgemeinem Verwendungszweck, die synthetische Audio-, Bild-, Video- oder Textinhalte erzeugen, stellen sicher, dass die Ausgaben des KI-Systems in einem maschinenlesbaren Format gekennzeichnet und als künstlich erzeugt oder manipuliert erkennbar sind. Die Anbieter sorgen dafür, dass — soweit technisch möglich — ihre technischen Lösungen wirksam, interoperabel, belastbar und zuverlässig sind … Diese Pflicht gilt nicht, soweit die KI-Systeme eine unterstützende Funktion für die Standardbearbeitung ausführen oder die vom Betreiber bereitgestellten Eingabedaten oder deren Semantik nicht wesentlich verändern oder wenn sie zur Aufdeckung, Verhütung, Ermittlung oder Verfolgung von Straftaten gesetzlich zugelassen sind.
> …
> (4) Betreiber eines KI-Systems, das Bild-, Ton- oder Videoinhalte erzeugt oder manipuliert, die ein Deepfake sind, müssen offenlegen … Betreiber eines KI-Systems, das Text erzeugt oder manipuliert, der veröffentlicht wird, um die Öffentlichkeit über Angelegenheiten von öffentlichem Interesse zu informieren, müssen offenlegen, dass der Text künstlich erzeugt oder manipuliert wurde. … oder wenn die durch KI erzeugten Inhalte einem Verfahren der menschlichen Überprüfung oder redaktionellen Kontrolle unterzogen wurden …
> (5) Die in den Absätzen 1 bis 4 genannten Informationen werden den betreffenden natürlichen Personen spätestens zum Zeitpunkt der ersten Interaktion oder Aussetzung in klarer und eindeutiger Weise bereitgestellt. Die Informationen müssen den geltenden Barrierefreiheitsanforderungen entsprechen.“

Art. 113 [P]: „Sie gilt ab dem 2. August 2026.“ Kapitel I und II (einschließlich Art. 4) gelten seit 02.02.2025.

### 6.2 Digital-Omnibus zur KI: beschlossen und in Kraft
- **VO (EU) 2026/1744** vom 08.07.2026, **ABl. L vom 24.7.2026**. Sie tritt „am dritten Tag nach ihrer Veröffentlichung“ in Kraft, also am 27.07.2026. Amtliche DE-Fassung via Cellar: https://publications.europa.eu/resource/cellar/b459c07f-86fb-11f1-bf5e-01aa75ed71a1.0004.03/DOC_1; EUR-Lex: https://eur-lex.europa.eu/eli/reg/2026/1744/oj [P]
- **Art. 50:**
  - Abs. 1–6 bleiben **unverändert**.
  - Abs. 7 wird neu gefasst (Praxisleitfäden: Kommission prüft Angemessenheit, ggf. Durchführungsrechtsakt).
  - **Neuer Art. 111 Abs. 4** [P, wörtlich]: „Anbieter von KI-Systemen, einschließlich KI-Systemen mit allgemeinem Verwendungszweck, die synthetische Audio-, Bild-, Video- oder Textinhalte erzeugen, die vor dem 2. August 2026 in Verkehr gebracht wurden, treffen die erforderlichen Maßnahmen, um Artikel 50 Absatz 2 bis zum 2. Dezember 2026 nachzukommen.“ (ErwG 38: „Übergangszeitraum von vier Monaten“)
- **Art. 4 neu** [P, wörtlich]: „(1) Die Anbieter und Betreiber von KI-Systemen ergreifen Maßnahmen, um die Entwicklung der KI-Kompetenz ihres Personals und anderer Personen zu unterstützen, die in ihrem Auftrag mit dem Betrieb und der Nutzung von KI-Systemen befasst sind … Diese Verpflichtung verpflichtet Anbieter oder Betreiber nicht, für irgendeine Person ein bestimmtes Niveau an KI-Kompetenz zu garantieren. (2) Die Kommission und die Mitgliedstaaten unterstützen und fördern die Bemühungen der Anbieter und Betreiber … insbesondere von KMU …“
- Der Kommissionsvorschlag vom Nov. 2025 wurde nicht separat abgerufen. Maßgeblich ist der beschlossene Text.

### 6.3 Kommissions-Leitlinien zu Art. 50 und FAQ
- **Leitlinien C(2026) 5054 final, 20.07.2026**, Annex: https://ec.europa.eu/newsroom/dae/redirection/document/131215, Landing page: https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems [P]
- **FAQ** („Last update 24 July 2026“): https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act [P]

Wörtlich, besonders relevant für unslop:

- **Anbieterbegriff (Leitlinien):** „a company provides a generative or interactive AI application (e.g. a chatbot, image generator, AI agent) on the Union market under its own name or trademark to consumers, professional users or other legal entities … The company is a provider responsible for compliance with the transparency obligations in Article 50(1) and/or (2) AI Act, regardless of whether the AI system is provided for free or for payment …“
  → **unslop ist Anbieter eines KI-Systems** (Art. 3 Nr. 3). Anbieter eines GPAI-Modells ist unslop nicht; das ist Google.
- **Art. 50 Abs. 1 im Anwendungsbereich:** „AI bots on social networks and media, **coding agents** and other AI agents capable of directly interacting with natural persons“.
- **Art. 50 Abs. 1 nicht einschlägig:** „AI-enabled text and code auto-completion techniques, … backend decision-support systems where the user only sees the AI output without possibility for direct interaction with the system“.
- **Offensichtlichkeits-Beispiel (Leitlinien Rn. 45):** „**AI-powered code assistance and code review chatbots available only to professional developers** who by virtue of their expertise and the context of use have no reasonable expectation of interacting with a human and can easily recognise that suggestions are generated by an AI system.“ Zugleich gilt: „The exception should be interpreted restrictively“. Ist ein System der Allgemeinheit bzw. Verbrauchern mit vulnerablen Gruppen zugänglich, „the exception cannot be relied upon“.
- **Ungeeignete Offenlegung (Rn. 38):** „Disclosures contained only in terms and conditions, URLs, or documentation (such disclosures may complement, though not replace, in-context disclosure)“ sowie „Technical or capability-based descriptions: statements solely referring to underlying technologies (e.g. “this system uses LLMs”)“.
- **Art. 50 Abs. 2, Definition Text:** „Text refers to discrete symbolic content composed of characters, or numbers arranged in a particular sequence, that are capable of being read and interpreted semantically by humans.“
- **Außerhalb von Art. 50 Abs. 2 (Rn. 68):** „Source code understood as content written in a programming, scripting, markup, query or configuration language that is intended to be interpreted, compiled or executed by a computing system, regardless of whether it is composed of text characters. This may also include natural-language comments and contextual information that form an integral part of the source code. Similarly excluded are Software Development Kits (SDKs), Structured Query Language (SQL), infrastructure-as-Code and … YAML, JavaScript Object Notation (JSON) configuration …“
- **Enge B2B-Ausnahme (Rn. 87),** nur kumulativ, und „excluding public and consumer-facing AI systems“:
  - „(i) … output … strictly technical in nature …;
  - (ii) … only intended to be perceived and processed by a limited pre-defined number of natural persons acting in a professional capacity within the organisation of the provider and the deployer;
  - (iii) … must not be intended to be shared outside the company or to be usable by external persons, with appropriate safeguards …“
- **Upstream-Markierung:** Anbieter „may rely on the marking solution implemented by an upstream model provider … Such reliance is without prejudice to the responsibility of the provider of the AI system to demonstrate compliance with Article 50(2)“.
- **Übergang (FAQ):** „Providers of such systems must comply with those obligations only as from 2 December 2026. Content generated prior to 2 August 2026 does not need to be labelled retroactively.“

### 6.4 Code of Practice on Transparency of AI-generated Content
- Final veröffentlicht am 10.06.2026. PDF: https://ec.europa.eu/newsroom/dae/redirection/document/129555, Policy-Seite: https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content [P]. Freiwillig. Laut FAQ wurde er von Kommission und AI Board als angemessen bewertet („assessed as adequate by both the Commission and the AI Board“).
- **Text, Measure 1.1** [P, wörtlich]:
  - „given that free-form text cannot transport metadata, a single-layer of marking as described in Sub-measure 1.1.2 is considered sufficient …“
  - Sub-measure 1.1.2: „Signatories will ensure that AI-generated or manipulated content is marked with an imperceptible watermark, with the exception of very short text. For free-form text longer than 200 tokens, watermarking still needs to be applied …“
  - „The marking techniques may be implemented at different stages of the value chain (e.g., by the provider of the AI system itself or by an upstream model provider) …“
- KMU: „simplified ways of compliance for SMEs and SMCs, including startups, should be possible, in a proportionate manner.“
- **[Bewertung]** Ob Vertex AI / Gemini für die von unslop genutzten Modelle ein Text-Wasserzeichen (z. B. SynthID Text) setzt, auf das unslop sich stützen könnte, ist **nicht verifiziert** und muss bei Google erfragt bzw. dokumentiert werden.

### 6.5 Anwendung auf unslop [Bewertung]

| Output / Kanal | Art. 50 Abs. 1 (Interaktion) | Art. 50 Abs. 2 (Markierung) |
|---|---|---|
| GitHub-PR-Review-Kommentare (Fließtext) als Bot | Eher kein „direct two-way exchange“. Falls doch, greift wohl die Offensichtlichkeit für professionelle Entwickler (Rn. 45). Da auch Verbraucher Kunden sein können: sichtbares Label empfohlen | **Ja, grundsätzlich.** Natürlichsprachlicher Text für Menschen, kein Source Code. B2B-Ausnahme scheitert an (iii), weil Kommentare in öffentlichen Repos für Externe sichtbar sind. Standardbearbeitung (Grammatik usw.) liegt nicht vor. Kurze Kommentare unter 200 Token: CoP sieht „very short text“ als Ausnahme vom Wasserzeichen |
| Vorgeschlagene Code-Fixes (suggestion blocks) | – | **Nein**, Source Code (Rn. 68) |
| Check-Run-Status/Scores (kurze Labels) | – | Nein, „short sequence of numbers, symbols or letters“ (Rn. 68) |
| CLI/VS-Code/MCP-Ausgaben an Entwickler | Offensichtlichkeit plausibel | Fließtext: grundsätzlich ja. Code: nein |
| Art. 50 Abs. 4 (öffentliche Texte) | – | Trifft den **Betreiber** (Kunden), nur bei Texten „to inform the public on matters of public interest“. Code-Reviews fallen nicht darunter |

- **Frist:** Wurde unslop vor dem 02.08.2026 „in Verkehr gebracht“ (entgeltlich oder unentgeltlich im Rahmen einer Geschäftstätigkeit bereitgestellt), gilt Art. 50 Abs. 2 ab **02.12.2026**, sonst schon seit 02.08.2026. Die Faktenlage (öffentliche Verfügbarkeit vor 02.08.) muss unslop klären; siehe offene Entscheidungen.
- **Art. 4:** Die Pflicht besteht seit 02.02.2025, seit 27.07.2026 in abgeschwächter Fassung. Sie betrifft das eigene Personal bzw. Solo-Gründer. Kein Terms-Thema, aber eine kurze interne Dokumentation ist sinnvoll.

---

## 7. Sekundäre Struktur-Referenzen (Paddle-SaaS)

- heylogin, „Terms & Conditions – Paddle“ (Stand 17.06.2026): https://www.heylogin.com/en/terms-paddle [S]. Eigene kurze Paddle-Seite (Billing, Consumer right to cancel) mit dem Wording „processed by our online reseller and Merchant of Record, Paddle.com“ und Verweis auf die Paddle-Policies. **Muster:** Die Paddle-Spezifika werden in einem separaten Abschnitt bzw. einer separaten Seite gebündelt, die Haupt-Terms regeln die Nutzung.
- Paddle Invoicing: Paddle verlangt, die Paddle Buyer Terms in eigene T&Cs „appended“ oder im Order Form referenziert zu haben (https://www.paddle.com/help/sell/invoicing-tool/which-terms-and-conditions-apply-when-using-paddle-invoicing [P]). Das ist nur relevant, falls unslop Enterprise-Rechnungen über Paddle Invoicing stellt.
- Weitere öffentliche SaaS-Terms unter Paddle wurden nicht systematisch ausgewertet **[nicht verifiziert]**.

---

## (a) Gliederungsvorschlag: unslop Terms of Service (DE maßgeblich, EN-Fassung)

0. **Kopf:** „Nutzungsbedingungen der unslop UG (haftungsbeschränkt)“, Anschrift, Registergericht/HRB (nach HR-Eintrag), Kontakt (E-Mail, Telefon), **Fassung vom [Datum]**, keine dynamische Verweisung (BGH III ZR 59/24).
1. **Geltungsbereich und Vertragspartner.** unslop ↔ Nutzer. Getrennte Regelung für Verbraucher und Unternehmer. **Paddle-Pflichtsatz wörtlich** (1.4) plus Klarstellung der Rollen. Die Paddle Buyer Terms gelten für den Kauf und gehen für Zahlung, Steuern und Erstattung vor.
2. **Begriffe:** Dienst, Kundencode, Findings/Ausgaben, Organisation, Seats, Plan.
3. **Vertragsschluss und Account:** Signup (GitHub OAuth), Zustimmung per Checkbox, Installation der GitHub App für Organisationen (Vertretungsmacht), API-Keys (CLI/MCP).
4. **Leistungsbeschreibung:** Pläne (Free/Trial/Pro), KI-Charakter, Modellanbieter; **keine Garantie für Vollständigkeit/Fehlerfreiheit**; kein Ersatz für menschliches Review.
5. **KI-Transparenz:** Kennzeichnung der Ausgaben als KI-generiert; Hinweis auf Markierung (AI Act Art. 50). Ergänzend zur UI-Offenlegung (Leitlinien Rn. 38).
6. **Pflichten und Acceptable Use des Kunden.**
7. **Rechte am Kundencode:** Verbleib beim Kunden, zweckgebundene Lizenz, kein Training, Subprozessoren, Löschung.
8. **Rechte an Ausgaben:** Nutzungsrecht, soweit Rechte bestehen; keine Gewähr für Schutzfähigkeit oder Rechte Dritter.
9. **Verfügbarkeit, Wartung, Support:** kein SLA außer bei gesonderter Vereinbarung; technischer Support durch unslop, Order-Support durch Paddle.
10. **Änderungen des Dienstes:** B2C nach § 327r mit Gründekatalog, Info in Textform und 30-Tage-Recht; B2B mit angemessener Frist.
11. **Preise, Zahlung, Laufzeit:** Verweis auf Paddle; Verlängerung; Trial; keine eigenen Zahlungsforderungen (MSA 10.1).
12. **Kündigung:**
    - ordentlich über das Paddle-Portal bzw. den „Verträge hier kündigen“-Button auf unslop.codes (§ 312k);
    - außerordentlich;
    - Sperrung durch unslop (AUP-Verstoß, Chargeback-Missbrauch, Sicherheit);
    - Folgen: Datenexport und Löschung.
13. **Widerrufsbelehrung (Verbraucher)** für den Nutzungsvertrag mit unslop, abgestimmt auf die Paddle-Belehrung. Hinweis auf die Online-Widerrufsfunktion (§ 356a) und Wertersatz (§ 357a Abs. 2). Alternativ ein Verweis, falls Paddle alleiniger Widerrufsadressat sein soll; siehe offene Entscheidungen.
14. **Gewährleistung:** B2C nach §§ 327 ff. (Hinweis auf gesetzliche Rechte); B2B Nacherfüllung und Frist.
15. **Haftung** (§ 309 Nr. 7-konform, Kardinalpflicht ausformuliert, B2B-Cap).
16. **Freistellung** (nur B2B).
17. **Datenschutz und AVV:** Verweis auf die Datenschutzerklärung; AVV für Geschäftskunden.
18. **Änderungen dieser Bedingungen:** B2C ausdrückliche Zustimmung; B2B begrenzte Fiktion mit Widerspruchsrecht.
19. **Anwendbares Recht:** deutsches Recht, CISG ausgeschlossen, Verbrauchervorbehalt (Rom I Art. 6 Abs. 2, EuGH C-191/15).
20. **Gerichtsstand:** nur für Kaufleute usw. (§ 38 ZPO).
21. **Sprachfassungen:** DE maßgeblich; EN zur Information bzw. für B2B; Vorrang.
22. **Streitbeilegung / Verbraucherschlichtung:** Hinweis nach VSBG. Primärtext hier nicht geprüft [nicht verifiziert]; siehe separater Research.
23. **Schlussbestimmungen:** Salvatorische Klausel, Textform, Abtretung.

**Separate Seiten (Paddle-Navigation):** Refund Policy (spiegelt Paddle + 14 Tage und gesetzliche Rechte), Privacy Policy, Pricing, Widerrufsbelehrung/Widerrufsformular, Impressum, Button „Verträge hier kündigen“, Link „Vertrag widerrufen“.

---

## (b) Tabelle: „geregelt durch Paddle Buyer Terms“ vs. „muss unslop regeln“

| Geregelt durch Paddle (Buyer Terms 31.03.2026 / Refund Policy 31.03.2026) | Muss unslop regeln |
|---|---|
| Verkäufer/Vertragspartner des Kaufs (Paddle.com Market Ltd. u. a.) | Eigene Identität (Firma, Anschrift) in den Terms (Paddle-Pflicht) |
| Zahlung, Zahlungsmittel, Zahlungsbestätigung | Pflichtsatz „Our order process is conducted by our online reseller Paddle.com …“ |
| Steuern, B2B-Steuererstattung (60 Tage) | Leistungsbeschreibung, Pläne, Trial-Umfang |
| Abo-Autoverlängerung, Trial-Umstellung, Reminder | Account, Organisationen, GitHub-App-Installation, API-Keys |
| Preiserhöhungs-Notice und -Zustimmung „if required by law“ | Acceptable Use des Dienstes |
| Kündigung zum Periodenende, Buyer Portal | § 312k-Button auf unslop.codes (MSA 11.1(iii)); Account-Kündigung/Sperrung |
| Widerrufsrecht EU/UK-Verbraucher, Withdrawal-Button im Portal | Belehrung für den Nutzungsvertrag (sofern unslop Unternehmer); Link „Vertrag widerrufen“ auf der eigenen Oberfläche (vorsorglich) |
| Refunds (Ermessen, 14 Tage), Refund-Abwicklung | Keine eigenen Refund-Zahlungen (MSA 10.1); Kulanz nur über Paddle |
| Chargebacks (Supplier darf sperren) | Sperrrecht spiegeln |
| Haftung von Paddle (schließt Produkthaftung aus) | Haftung für den Dienst (§§ 307, 309 Nr. 7) |
| Paddle-IP und Paddle-Materials | Lizenz am Dienst, Rechte am Kundencode, Rechte an Ausgaben |
| Datenschutz für Zahlungsdaten (Paddle Privacy Notice) | Datenschutzerklärung und AVV für Code-Verarbeitung |
| Englisches Recht, Gerichtsstand England (Paddle ↔ Buyer) | Recht und Gerichtsstand des Nutzungsvertrags (DE, Rom I, § 38 ZPO) |
| Sprachvorrang EN (Paddle-Terms) | DE/EN-Fassungen und Vorrangregel (KG 5 U 156/14) |
| Paddle-eigene Terms-Änderungen (Fiktion mit 1 Monat) | Eigene Änderungsklauseln (BGH XI ZR 26/20; § 327r) |
| – | Gewährleistung, Mängelrechte, Aktualisierungen (§§ 327e, 327f, 327s) |
| – | Verfügbarkeit, SLA, technischer Support (MSA 6.4) |
| – | KI-Hinweise, Grenzen, AI-Act-Transparenz |
| – | Freistellung (B2B) |

---

## (c) AI-Act-Maßnahmenliste

**Produkt-UI**
1. **Sichtbares Label an jedem Review-Kommentar und jeder Check-Run-Summary**, z. B. „🤖 AI-generated by unslop (Gemini-based) — may be incomplete or wrong“.
   - Sichert Art. 50 Abs. 1/5 auch für Verbraucher ab. Die Offensichtlichkeits-Ausnahme gilt nur für „professional developers“ und ist „restrictively“ auszulegen.
   - Nicht nur „uses LLMs“ schreiben; Funktion und Folgen benennen (Leitlinien Rn. 38).
   - Barrierefrei: Text, nicht nur ein Icon.
2. **Maschinenlesbare Markierung der Fließtext-Ausgaben** (Art. 50 Abs. 2), spätestens am 02.12.2026 bei Inverkehrbringen vor dem 02.08.2026, sonst jetzt:
   - (a) Prüfen und dokumentieren, ob der Upstream-Anbieter (Google Vertex/Gemini) Text-Wasserzeichen setzt, auf die sich unslop stützen kann (Leitlinien: Upstream-Reliance erlaubt, Verantwortung bleibt bei unslop).
   - (b) Zusätzlich ein Metadaten-Marker, wo das Format ihn trägt: HTML-Kommentar im GitHub-Markdown, z. B. `<!-- ai-generated: unslop; model=…; ts=… -->`; ein Feld in der Check-Run-API; ein Feld in CLI-JSON-Ausgaben.

     Ob ein unsignierter HTML-Kommentar die Anforderungen „wirksam, interoperabel, belastbar, zuverlässig“ erfüllt, ist **nicht verifiziert**. Der CoP nennt für metadatenfähige Formate „digitally signed“ Metadaten und für Freitext ein Wasserzeichen.
   - (c) Code-Vorschläge (suggestion blocks) und kurze Status-Labels brauchen keine Markierung (Rn. 68).
3. **Detektion:** Art. 50 Abs. 2 verlangt „erkennbar“, der CoP eine Detection-Möglichkeit. Minimal-Variante: eine öffentliche Doku, wie unslop-Kommentare erkannt werden (Marker, Bot-Account `unslop[bot]`).

**Terms**
4. Eine Klausel „KI-generierte Ausgaben“ mit folgendem Inhalt:
   - Ausgaben werden durch KI erzeugt;
   - Kennzeichnung und Markierung erfolgen;
   - der Kunde darf Marker nicht entfernen, wenn er Ausgaben weiterveröffentlicht (Soll, keine Pflicht aus dem AI Act; CoP Measure 1.2 „Non-removal“ betrifft Signatories);
   - keine Gewähr für Richtigkeit;
   - menschliche Prüfung bleibt Aufgabe des Kunden.
5. Hinweis, dass der Kunde als **Betreiber** eigene Pflichten haben kann, etwa Art. 50 Abs. 4, wenn er Ausgaben als Text zur Information der Öffentlichkeit veröffentlicht. Für Code-Reviews unwahrscheinlich.

**Datenschutzerklärung**
6. Zwecke und Empfänger: Übermittlung von Code und Diff an den LLM-Anbieter (Google, Region), Speicherdauer, kein Training (falls zutreffend); Protokollierung zur Markierung bzw. Detection, falls Logs verwendet werden.
7. Die KI-Offenlegung **nicht nur** in der Datenschutzerklärung oder den Terms: Nach Leitlinien Rn. 38 ist das allein unzureichend.

**Intern**
8. Art. 4: Kurze Dokumentation zur KI-Kompetenz (Solo-Gründer/Personal). Seit Omnibus eine Förderpflicht ohne Niveaugarantie.
9. Datum des Inverkehrbringens dokumentieren (erste öffentliche oder entgeltliche Bereitstellung). Es entscheidet über die Frist 02.12.2026.
10. Beitritt zum Code of Practice prüfen (freiwillig, „legal certainty“) oder alternative Nachweise dokumentieren.

---

## (d) Offene Entscheidungen mit Optionen

1. **Wer ist Widerrufsadressat für Verbraucher?**
   - **A:** Nur Paddle (Button im Portal). unslop verweist darauf und setzt einen Link „Vertrag widerrufen“ auf der eigenen Seite. Risiko: der Nutzungsvertrag mit unslop bleibt ohne eigene Belehrung.
   - **B:** Zusätzlich eine eigene Belehrung und eine eigene § 356a-Funktion für den Nutzungsvertrag, gekoppelt an den Paddle-Widerruf.
   - **C:** B2B-only-Vertrieb (Verbraucher per Checkbox und Organisationspflicht ausschließen). Paddle kennt „Business“ und „Consumer“; ob ein Ausschluss mit Paddle-Checkout praktisch durchsetzbar ist, ist nicht verifiziert.
2. **§ 312k-Umsetzung.**
   - **A:** Eigener Button, eigene Bestätigungsseite und Paddle-API (empfohlen).
   - **B:** Direkter Link auf ein authentifiziertes Paddle-Portal. Risiko: Login und Retention-Flow sind nicht „unmittelbar“.
   - **C:** Paddle Cancellation Flows für DE deaktivieren und Portal-Link nutzen. Ob das möglich ist, ist nicht verifiziert.
3. **Free Tier und Verbraucher.** Free Tier nur mit Terms-Zustimmung (eigener Signup-Schritt). Klären, ob §§ 327 ff. über § 327 Abs. 3 (Datenbereitstellung) greifen: Wahrscheinlich ja. Dann gelten Aktualisierungspflicht und Mängelrechte auch gratis.
4. **Sprachfassung.**
   - **A:** DE maßgeblich, EN als Übersetzung.
   - **B:** Zwei gleichrangige Fassungen, bei Widerspruch DE.
   - **C:** B2B EN maßgeblich, B2C DE maßgeblich.

   Empfehlung: A. Einfach und KG-fest.
5. **Terms-Änderungsmechanismus.**
   - **A:** Immer ausdrückliche Zustimmung (Klick beim Login), sonst Kündigungsrecht beider Seiten.
   - **B:** B2B-Fiktion mit Frist und Widerspruch, B2C Zustimmung.
6. **Haftungs-Cap B2B:** 12-Monats-Entgelt vs. Pauschalbetrag vs. beides (der höhere Wert). Ein Free-Tier-Cap von 0 € wäre unwirksam, wo § 309 Nr. 7 bzw. die Kardinalpflicht greift.
7. **Output-Rechte:** einfaches oder ausschließliches Nutzungsrecht; ob unslop anonymisierte Findings für Benchmark und Qualität nutzen darf (dann Opt-in bzw. AVV-Weisung nötig).
8. **Trainings- und Verbesserungsnutzung von Kundencode:** „nie“ (Vertrauensargument) oder Opt-in.
9. **AI-Act-Markierung.**
   - **A:** Upstream-Wasserzeichen (falls vorhanden) plus HTML-Marker plus sichtbares Label.
   - **B:** Nur Label plus Marker, mit Dokumentation, warum das „soweit technisch möglich“ genügt.
   - **C:** CoP-Beitritt.

   Vorher Faktum klären: Datum des Inverkehrbringens (vor oder nach 02.08.2026).
10. **SLA:** keins vs. „Ziel 99 %“ ohne Credits vs. Credits (nur Enterprise). Credits laufen wegen MSA 10.1 ohnehin über Paddle.
11. **Telefonnummer:** Das Seller Handbook verlangt „buyer support details (email and phone number)“. Entscheidung: Nummer (ggf. virtuell) angeben oder Risiko der Paddle-Nachforderung tragen. Gehört auch zum Impressum und zu den Memory-Beschränkungen: nichts Öffentliches vor HR-Eintrag.

---

## Quellenverzeichnis (alle abgerufen 2026-09-28)

**Paddle [P]**
- Buyer Terms: https://www.paddle.com/legal/checkout-buyer-terms (Fassung 31.03.2026)
- Changelog Buyer Terms: https://www.paddle.com/legal/buyer-terms-privacy-notice-log-of-changes-31-03-2026
- Refund Policy: https://www.paddle.com/legal/refund-policy (31.03.2026)
- Master Services Agreement: https://www.paddle.com/legal/terms (Last updated 08.10.2025)
- Seller Handbook: https://www.paddle.com/seller-guides/seller-handbook
- Domain Review: https://www.paddle.com/help/start/account-verification/what-is-domain-verification
- AUP: https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle
- Invoicing Terms-Hinweis: https://www.paddle.com/help/sell/invoicing-tool/which-terms-and-conditions-apply-when-using-paddle-invoicing
- Customer Portal: https://developer.paddle.com/concepts/customer-portal
- Changelog Cancellation Flows: https://developer.paddle.com/changelog/2026/cancellation-flows-customer-portal/

**Gesetze [P]**
- BGB §§ 13, 305, 307, 309, 310, 312k, 327, 327f, 327h, 327r, 327s, 327u, 356, 356a, 357a: https://www.gesetze-im-internet.de/bgb/ (Einzel-URLs im Text)
- ZPO § 38: https://www.gesetze-im-internet.de/zpo/__38.html
- UrhG §§ 2, 69a: https://www.gesetze-im-internet.de/urhg/__2.html, https://www.gesetze-im-internet.de/urhg/__69a.html
- BGBl. 2026 I Nr. 28: https://www.recht.bund.de/bgbl/1/2026/28/regelungstext.pdf
- Rom I (VO 593/2008): https://publications.europa.eu/resource/celex/32008R0593
- AI Act (VO 2024/1689), DE: https://publications.europa.eu/resource/cellar/dc8116a1-3fe6-11ef-865a-01aa75ed71a1.0004.03/DOC_1
- Digital-Omnibus KI (VO 2026/1744), DE: https://publications.europa.eu/resource/cellar/b459c07f-86fb-11f1-bf5e-01aa75ed71a1.0004.03/DOC_1 ; ELI: https://eur-lex.europa.eu/eli/reg/2026/1744/oj

**EU-Kommission [P]**
- Leitlinien Art. 50, C(2026) 5054, Annex: https://ec.europa.eu/newsroom/dae/redirection/document/131215
- FAQ Art. 50 (Last update 24.07.2026): https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- Code of Practice (10.06.2026): https://ec.europa.eu/newsroom/dae/redirection/document/129555 ; https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content

**Gerichte**
- BGH PM 088/2021 zu XI ZR 26/20: https://www.bundesgerichtshof.de/SharedDocs/Pressemitteilungen/DE/2021/2021088.html [P]
- BGH III ZR 59/24: https://openjur.de/u/2530103.html ; https://www.eylaw.de/de_de/news/2026/bgh-zur-einbeziehung-von-agb-warum-dynamische-verweisungen-dem-transparenzgebot-nicht-genuegen [S]
- EuGH C-191/15: https://curia.europa.eu/juris/liste.jsf?language=de&num=C-191/15 [P-Fundstelle, nicht ausgewertet] ; https://www.lto.de/recht/hintergruende/h/eugh-c19115-amazon-agb-rechtswahlklausel-unwirksam [S]
- KG Berlin 5 U 156/14: https://www.vzbv.de/urteile/whatsapp-muss-agb-auf-deutsch-bereitstellen [S]
- BGH VIII ZR 121/04 (Kardinalpflicht): https://www.damm-legal.de/olg-celle-die-begriffe-wesentliche-vertragspflicht-und-kardinalpflicht-in-agb-verstossen-gegen-das-transparenzgebot ; https://de.wikipedia.org/wiki/Kardinalpflicht [S]

**Sonstige [S]**
- https://www.noerr.com/de/insights/umsetzungsgesetz-zum-widerrufsbutton-veroeffentlicht
- https://www.twobirds.com/en/insights/2026/germany/mandatory-withdrawal-button-upcoming-in-germany-key-implications-for-online-sellers
- https://stripe.com/resources/more/mandatory-cancellation-button-germany
- https://freemius.com/blog/payment-platform-restrictions-ai-apps/
- https://dev.to/pavelbuild/paddle-rejected-my-saas-3-times-heres-what-they-check-that-isnt-in-their-docs-5dnn
- https://www.heylogin.com/en/terms-paddle
- https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/
