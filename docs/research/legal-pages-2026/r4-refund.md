# Research 4: Refund Policy für unslop unter Paddle Billing (MoR), Stand 2026-09-28

> Recherche, keine Rechtsberatung. Alle Abrufe am **2026-09-28**, sofern nicht anders angegeben. „Sekundär“ = keine Primärquelle. „nicht verifiziert“ = nicht belegbar. „blocked: tooling“ = Quelle war technisch nicht abrufbar (kein Negativbefund).
>
> Methodischer Hinweis: Paddle-Seiten wurden über ein Abruf-Tool gelesen, das Seiten vor der Ausgabe zusammenfasst. Wörtlich markierte Paddle-Zitate stammen aus Abrufen, in denen der Wortlaut ausdrücklich verlangt wurde. Vor einer Veröffentlichung sollten sie trotzdem einmal manuell im Browser gegengelesen werden. BGB- und UK-Texte wurden roh (curl) von gesetze-im-internet.de und legislation.gov.uk gezogen und sind wörtlich.

## 0. Projektkontext (aus dem Repo, nicht aus dem Recht)

- `docs/specs/PADDLE_SPEC.md`: **ein** Pro-Plan, €29/Monat, **14-Tage-Trial mit Karte** (`trial_period.requires_payment_method: true`), Pro = 500 Scans/Monat, 50 Pro-Eskalationen/Monat. Trial = 100 Scans + 5 Eskalationen, gezählt über die gesamte Laufzeit. Kündigung per API mit `effectiveFrom: 'next_billing_period'`. Aktuell gibt es keine Upgrades oder Downgrades zwischen Plänen und keinen Jahresplan.
- Laut PADDLE_SPEC Z. 52 ist die Refund Policy **noch nicht vorhanden**. Sie gehört zu den Voraussetzungen der Paddle-Website-Freigabe und ist damit ein Billing-Go-Live-Blocker. `src/` enthält keine Refund-Seite (Grep „refund|erstattung|widerruf“ findet nur API-Key-/Token-Widerruf).

---

## 1. Paddles eigene Refund-Regeln für Käufer

### 1.1 Dokumente und Fassungen
| Dokument | URL | Fassung |
|---|---|---|
| Paddle Buyer Terms | https://www.paddle.com/legal/checkout-buyer-terms (auch /legal/buyer-terms) | **31 March 2026** |
| Paddle Refund Policy (Teil der Buyer Terms) | https://www.paddle.com/legal/refund-policy | **31 March 2026** |
| Paddle Master Services Agreement (Seller) | https://www.paddle.com/legal/terms | **Last updated 8 October 2025** |

Beim Konflikt gilt laut Refund Policy: „This Policy forms part of Paddle Buyer Terms and Conditions … If there is any inconsistency, Paddle Buyer Terms and Conditions will apply.“ (refund-policy, 2026-09-28)

### 1.2 Grundregel: kein Refund, außer gesetzlich vorgeschrieben oder nach Paddles Ermessen
Refund Policy, Fassung 31.03.2026 (https://www.paddle.com/legal/refund-policy):
- 1.1: „Unless required by applicable law, all Transactions are non-refundable and non-exchangeable.“
- 1.2: „Paddle may issue refunds on a discretionary basis (see section 7 below) or if you exercise an applicable statutory withdrawal or refund right (see section 2 below).“
- 1.3: „Refunds will not be issued where there is evidence of fraud, refund abuse, or other manipulative behaviour.“
- 1.6: „If you receive a refund in accordance with this Policy, access to the relevant Product will cease.“
- Präambel: „If local consumer protection laws or a Supplier of a Product provides you with additional or non-waivable rights, the highest level of rights will always apply.“ **Ein freiwilliges Versprechen des Sellers (z. B. „30 Tage Geld zurück“) wird damit gegenüber dem Käufer Teil des Rechtsrahmens.**

### 1.3 Gesetzliches Widerrufsrecht EU/EEA/CH/UK in Paddles Umsetzung
Refund Policy 2.2 (31.03.2026):
- 2.2.1: „Consumers have a 14-day statutory right to withdraw from some digital content and service contracts and receive a full refund.“
- 2.2.2: „The right to withdraw applies to one-off purchases and to the first payment under a Subscription contract. It does not apply to subsequent Subscription payments, except in the circumstances described in section 2.2.3 below. **If a Subscription includes a free trial period, then, as soon as that free trial period ends, you will again have a period of 14 calendar days to exercise your right to withdraw.**“
- 2.2.3: Bei **UK**-Jahresabos beginnt mit der automatischen Verlängerung eine neue 14-Tage-Frist.
- 2.2.4: „The right to withdraw does not apply to the supply of digital content Products that have started to be downloaded, streamed or otherwise used, when you have given express consent to waive your withdrawal rights.“
- 2.2.5: Die Anfrage muss innerhalb von 14 Tagen ab Transaktionsdatum gestellt werden.
- Weitere Länderregeln: TR/IL 14 Tage, KR/BR/CN 7 Tage, CA 7 Tage, SG 5 Tage (2.3–2.6).

Buyer Terms, Abschnitt 15 (31.03.2026; https://www.paddle.com/legal/checkout-buyer-terms): „You have the right to withdraw from the Agreement for any reason within 14 days of completing a Transaction“ mit voller Erstattung. Das gilt nicht, wenn der Käufer innerhalb der Frist mit Download, Streaming, Nutzung oder dem „benefiting from the Product“ begonnen hat, nachdem er beim Kauf der Bereitstellung vor Fristende zugestimmt hat (Wortlaut sinngemäß aus dem Abruf, Kern-Halbsatz „started downloading, streaming, using or benefiting from the Product“ wörtlich).

**Für unslop relevant:** Wegen 2.2.2 bekommt ein EU-Verbraucher mit dem 14-Tage-Trial **zwei** Fenster: ab Vertragsschluss (Trial-Start) und nach Trial-Ende ab der ersten Zahlung noch einmal 14 Kalendertage. Faktisch kann ein Verbraucher also bis etwa Tag 28 widerrufen und die erste €29-Zahlung zurückbekommen, vorbehaltlich 2.2.4.

**Mögliche Spannung zum deutschen Recht (siehe §4):** Paddle lässt das Widerrufsrecht schon bei Nutzungsbeginn entfallen („digital content … started to be … used“). Nach § 356 Abs. 5 BGB erlischt es bei **Dienstleistungen** erst mit **vollständiger** Erbringung. SaaS ist nach § 327 Abs. 2 BGB eine „digitale Dienstleistung“. Welche Kategorie für Widerrufszwecke gilt, ist hier **nicht verifiziert** (Kommentar- oder EU-Leitlinienlage wurde nicht geprüft). In jedem Fall gilt Paddles eigene Klausel „highest level of rights will always apply“.

### 1.4 Widerrufsbutton, Refund-Anfrage, Kündigung (Käuferportal)
Refund Policy 3.1 (31.03.2026):
- 3.1.1 (EU consumers): „An online withdrawal button is available in the Paddle Customer Portal for eligible transactions during the 14-day withdrawal period.“ Zugang erfolgt über „Manage subscription“/„Manage transaction“ in der Bestätigungsmail oder über Paddle.net. „Select the withdrawal option (e.g., "Request withdrawal") … The button appears in the language of your checkout.“ und „If you withdraw within the withdrawal period, we will refund you within 14 days of receiving your request.“
- UK consumers widerrufen über die Kontaktwege aus 3.1.2.
- 3.1.2 Refunds: „submit a request via the support link provided in your receipt or within your account's billing page; or visit Paddle.net and select "Request refund".“
- 3.1.3 Cancellation: „Cancel subscription“ im Customer Portal oder über Paddle.net. „Cancellation will take effect at the end of the applicable billing period and will prevent any further payments from being taken.“
- 3.2: Erstattung auf dieselbe Zahlungsart „within 14 days of approval“.

**Befund:** Paddle hat den EU-Widerrufsbutton (RL 2023/2673, § 356a BGB) im eigenen Customer Portal umgesetzt. Ob das für die Online-Benutzeroberfläche des Sellers genügt, ist offen (§4.4).

### 1.5 Ermessens-Refunds (Paddles Kulanz)
Refund Policy 7 (31.03.2026):
- 7.1: „Paddle may, at its sole discretion, issue a refund if a request is submitted within 14 days of your Transaction date. Submission of a request within this 14‑day period does not guarantee a refund.“
- 7.2: „All refund requests are reviewed on a case-by-case basis. Paddle may consider relevant factors including the nature of the Product, the reason for the request, usage or consumption, and any applicable contractual terms. Paddle may approve a refund in full, approve a partial refund, or decline the request.“
- 7.3: „Any discretionary refund granted by Paddle is voluntary and does not create an obligation to provide refunds in the future …“

**Widerspruch mit dem Auftrag:** Eine Paddle-Ermessensfrist von 30 oder 60 Tagen findet sich in der aktuellen Fassung **nicht**. Das Paddle-Ermessen reicht bis **14 Tage**.

### 1.6 Wer über Refunds entscheidet: Paddle gegenüber dem Seller
MSA (8 Oct 2025), Klausel 10.2 (https://www.paddle.com/legal/terms), wörtlich:
> „As the seller, Paddle shall be entitled to cancel a Transaction and grant the Buyer a refund of the full price paid if: (i) the Buyer requests a refund within fourteen (14) days of the date of a one-off Transaction or, in the case of a subscription service, within 14 days from the date on which the subscription was last renewed and Paddle determines, in its sole discretion, that a refund is appropriate; (ii) Paddle reasonably believes that the Transaction was made in error or fraudulently; (iii) Paddle reasonably believes the Transaction may become subject to a Chargeback; or (iv) required by any applicable law, regulation, payment method provider or Payment Scheme Rules.“

Klausel 10.4: „If Paddle prevents a Chargeback or refunds a Buyer (including, but not limited to, as a result of a Chargeback or Pre-Chargeback Alert), Paddle is entitled to receive from you: (i) the full amount of the refund or Chargeback; (ii) any fees and expenses incurred by Paddle in processing the refund or Chargeback; and (iii) in the case of a Chargeback or Pre-Chargeback Alert, a fee of up to 20 GBP, USD or EUR, or 40 AUD or CAD …“

**Ergebnis:** Paddle kann **ohne Zustimmung des Sellers** erstatten. Das gilt auch für **jede Abo-Verlängerung** innerhalb von 14 Tagen, nicht nur für die erste Zahlung. Der Seller trägt den Betrag und die Gebühren. Die Seller-Policy kann also Paddle nicht binden, sondern nur zusätzliche Rechte versprechen.

### 1.7 Wie der Seller Refunds auslöst (Paddle Billing)
- Dashboard: Transactions → Order → „Refund“, voll oder teilweise, mit Grund, der im Webhook erscheint. Karten-Refunds nur bei Transaktionen „less than 120 days old“, PayPal unter 179 Tagen. Credit Balances aus Proration werden beim Refund automatisch reduziert (https://www.paddle.com/help/manage/your-customers/how-do-i-issue-refunds; kein Datum ausgewiesen).
- API: Adjustment mit `action: refund`, `type: full|partial` (partial mit `items[]` und Betrag pro Position; Beträge standardmäßig inkl. Steuer, `tax_mode: external` möglich). **Freigabe:** Die meisten Live-Refunds landen zuerst in `pending_approval` (Prüfung durch Paddle). Automatische Freigabe erfolgt, wenn der Account verifiziert und aktiv ist, der Refund ≤ 400 USD oder Gegenwert beträgt, unter dem Balance liegt und keine Überweisungszahlung war. `action: credit` ist nur für manuell eingezogene Rechnungen möglich und braucht keine Freigabe (https://developer.paddle.com/build/transactions/create-transaction-adjustments/).
- Gebühren beim Refund: Laut Changelog vom 22.09.2025 gibt es das Feld `retained_fee` („Paddle fees retained for this adjustment or transaction“) (https://developer.paddle.com/changelog/2025/retained-fees-payout-totals). Die Aussage „Paddle will retain the original processing fee“ tauchte nur in einer Such-Zusammenfassung auf; im Wortlaut einer Paddle-Seite ist sie **nicht verifiziert**. MSA 10.4 (ii) lässt die Weiterbelastung von Bearbeitungskosten ausdrücklich zu.

**Paddle Classic gegenüber Billing (Sekundär: Paddle-Migrationsdoku, Such-Zusammenfassung):** In Classic mussten alle Refunds freigegeben werden, Rechnungs-Refunds liefen nur per API. In Billing gibt es Dashboard und Adjustments-API mit teilweiser Auto-Freigabe (https://developer.paddle.com/migrate/paddle-classic/features). **Buyer Terms, Refund Policy und MSA unterscheiden nicht zwischen Classic und Billing.** Unterschiede bestehen nach dem Gefundenen nur bei Tooling und Freigabe. Das Trial-Compliance-Hilfsdokument (§5.3) bezieht sich teils auf die Classic-„Charges API“.

### 1.8 Chargebacks
- Buyer Terms 4 (31.03.2026): „We encourage you to contact Paddle directly prior to disputing a Charge.“ Bei betrügerischen oder missbräuchlichen Chargebacks „the Supplier may suspend your access to the Product while we investigate, and block your access if our investigation finds fraud or abuse.“
- Refund Policy 6.2: „access to the relevant Product may be temporarily suspended“. 6.3: Paddle übermittelt dem Zahlungsdienstleister Zahlungsdaten und „where relevant, your consent to waive statutory rights“.
- Help Center (https://www.paddle.com/help/manage/risk-prevention/understanding-chargebacks-with-paddle, undatiert): „the dispute is raised against Paddle rather than you, the seller“. Gebühr 20 USD/GBP/EUR bzw. 40 CAD/AUD; „the chargeback fee will not be refunded, because the payment provider's processing fee is non-refundable“, auch bei gewonnenem Fall. „additional evidence submitted by sellers is not required or accepted“. Bei Pre-Chargeback-Alerts erstattet Paddle voll, bevor der Chargeback final ist. Akzeptable Chargeback-Rate: unter 0,65 % pro Monat.
- Seller Handbook (https://www.paddle.com/seller-guides/seller-handbook): „Chargebacks incur a fee of 20 USD/GBP/EUR or 40 CAD/AUD …“

### 1.9 Refund-Missbrauch und Teil-Refunds
- Missbrauch: Refund Policy 1.3 (oben). Ermessensprüfung nach „usage or consumption“ (7.2).
- Teil-Refunds: Paddle darf nach 7.2 „approve a partial refund“. Seller-seitig sind sie per Dashboard oder `type: partial` möglich (1.7).
- Add-ons: 5.3 „Items that are delivered and fully accessible immediately may be non-refundable once delivered, except where required by law.“

### 1.10 Defekte und Nichtleistung
Refund Policy 4 (31.03.2026): Bei „persistent technical issues“ oder einem „material defect“ soll der Käufer zuerst den Supplier kontaktieren, dann Paddle. „where there is evidence of a material technical or Product defect, Paddle will issue a refund in accordance with applicable consumer protection laws.“ Buyer Terms 2: Wenn der Supplier wegen technischer Probleme nicht oder unangemessen spät liefert, „you are entitled to a replacement or refund of the relevant Charges paid“.

---

## 2. Paddles Anforderungen an die Refund Policy des Sellers (Domain Review)

### 2.1 Primär belegt
- Domain Review (https://www.paddle.com/help/start/account-verification/what-is-domain-verification): Pflicht sind „Terms and Conditions, Refund Policy, and Privacy Policy (these must be clearly accessible via navigation on your website)“. Dazu kommen Produktbeschreibung, Preise, Firmenname in den AGB und HTTPS. **Zu Inhalt, Mindestfrist oder „no refunds“ sagt der Artikel nichts.**
- MSA 9.2 (8 Oct 2025), wörtlich: „The Supplier shall ensure that the Supplier URLs provide clear and accurate information about the Product, **clearly reflect Paddle's status as a reseller** and comply with Paddle's policies, the Payment Scheme Rules and applicable law in the jurisdictions in which the Products are sold.“
- Seller Handbook (https://www.paddle.com/seller-guides/seller-handbook, undatiert): Unter „Best practices“ / „We recommend the following:“ steht „Have at least a 30-day money-back guarantee as part of their refund policy.“ Das ist laut Abruf eine **Empfehlung und keine Pflicht**. An gleicher Stelle werden genannt: T&C, Refund Policy und Support-Kontakt (E-Mail und Telefon) klar auf der Website, „Make sure the buyer accepts their terms & conditions and refund policy before they make a purchase“, Klarheit über das Abo.

### 2.2 Mindest-Refundfrist? „No refunds“ erlaubt?
- **Eine Mindestfrist als Pflicht ist primär nicht belegt.** Die 30 Tage sind in der Primärquelle nur eine Best-Practice-Empfehlung.
- **„No refunds“:** Ein ausdrückliches Verbot fand sich nicht in Primärquellen. Paddles eigene Policy beginnt mit „all Transactions are non-refundable“ (1.1), überlagert von gesetzlichen Rechten und Paddle-Ermessen. Ein Seller-Satz „no refunds“ wäre aber gegenüber EU-Verbrauchern irreführend (Widerrufsrecht, § 312m BGB, UWG) und widerspräche Paddles 2.2 und 7. **Nicht empfehlenswert.**
- **Sekundär / Widerspruch:** Ein Erfahrungsbericht (dev.to, Pavel Gajvoronski, 23.04.2026, https://dev.to/pavelbuild/paddle-rejected-my-saas-3-times-heres-what-they-check-that-isnt-in-their-docs-5dnn) berichtet, Paddle habe eine Policy mit Einschränkungen abgelehnt: „Refund policy contains qualifiers. Please provide unconditional refund terms matching our standard policy.“ Akzeptiert wurde „30-day money-back guarantee. No questions asked. …“. **Dagegen** steht die öffentliche Policy von TailAdmin (https://tailadmin.com/refund-policy, Sekundär): Sie ist ausdrücklich bedingt (14 Tage, Ausschluss bei Nutzung oder Meinungsänderung) und läuft offenbar unter Paddle. Recall (https://www.joinrecall.com/refunds) nutzt 7 Tage ohne Bedingungen. Die Praxis im Review ist uneinheitlich. Bedingungslose, klar befristete Formulierungen haben das geringste Ablehnungsrisiko (Einzelberichte, nicht verifiziert als Paddle-Regel).

---

## 3. Muster: Formulierung ohne Widerspruch zu Paddle (alle Sekundär)
| Beispiel | Frist | Muster |
|---|---|---|
| Renosaur (https://renosaur.app/refund) | 30 Tage, „for any reason“ | „Refunds are processed by our payment provider and Merchant of Record, Paddle.“ Kündigung im eigenen Account oder über paddle.net, Zugang bis Periodenende. Gesetzliche Rechte bleiben unberührt. |
| Recall (https://www.joinrecall.com/refunds) | 7 Tage nach der ersten Belastung nach Trial | „Payments and refunds … are processed by Paddle.com ("Paddle"), our Merchant of Record.“ Dazu eine eigene Klausel für Fehler, Abweichungen und Fehlbuchungen „regardless of the 7-day window“ sowie Abschnitte zu Chargebacks und Jahresplänen. |
| TailAdmin (https://tailadmin.com/refund-policy) | 14 Tage, bedingt | „Paddle acts as the merchant of record“. Alle Anfragen laufen über Paddles Support; Abschnitte „When Refunds May Be Granted / Are Not Granted“. |

Wiederkehrende Bausteine: (1) Paddle als Merchant of Record und Reseller benennen (MSA 9.2), (2) Anfrageweg paddle.net oder Link im Beleg, parallel eigener Support, (3) eigene Garantie als **zusätzliches** Recht („in addition to your statutory rights and Paddle's Refund Policy“), (4) Kündigung zum Periodenende, (5) Klausel „gesetzliche Rechte bleiben unberührt“, (6) Hinweis „vor einem Chargeback bitte Kontakt aufnehmen“.

---

## 4. Gesetzliches Widerrufsrecht EU-Verbraucher (DE-Recht, Primärtexte wörtlich)

### 4.1 Wer ist der Unternehmer?
Unter MoR ist **Paddle** Vertragspartner des Käufers („Paddle acts as the authorised reseller“, Refund Policy, Präambel). Die Pflichten aus §§ 355 ff., 356a BGB treffen damit primär Paddle. Zur Mitverantwortung des Sellers siehe 4.4 und 5.2.

### 4.2 § 356 BGB (aktuelle Fassung auf gesetze-im-internet.de, abgerufen 2026-09-28)
**Achtung zur Nummerierung:** In der abgerufenen Fassung steht der Dienstleistungs-Tatbestand in **Abs. 5** und der Tatbestand für digitale Inhalte in **Abs. 6**, nicht in Abs. 4/5 wie im Auftrag. Abs. 4 ist jetzt die Höchstfrist von 12 Monaten und 14 Tagen. Durch welches Gesetz umnummeriert wurde, ist nicht verifiziert (vermutlich BGBl. 2026 I Nr. 28).
- Abs. 2 Nr. 2: Die Frist beginnt bei „nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten, mit Vertragsschluss“. Für Dienstleistungen beginnt sie nach § 355 Abs. 2 ebenfalls mit Vertragsschluss (§ 355 nicht separat abgerufen, **nicht verifiziert**).
- Abs. 5 Nr. 2 (Dienstleistungen, entgeltlich): Das Widerrufsrecht erlischt „mit der vollständigen Erbringung der Dienstleistung, wenn der Verbraucher vor Beginn der Erbringung a) ausdrücklich zugestimmt hat, dass der Unternehmer mit der Erbringung der Dienstleistung vor Ablauf der Widerrufsfrist beginnt, b) [nur außerhalb von Geschäftsräumen] … und c) seine Kenntnis davon bestätigt hat, dass sein Widerrufsrecht mit vollständiger Vertragserfüllung durch den Unternehmer erlischt“.
- Abs. 6 Nr. 2 (digitale Inhalte, entgeltlich): Es erlischt, wenn „a) der Unternehmer mit der Vertragserfüllung begonnen hat, b) der Verbraucher ausdrücklich zugestimmt hat, dass der Unternehmer mit der Vertragserfüllung vor Ablauf der Widerrufsfrist beginnt, c) der Verbraucher seine Kenntnis davon bestätigt hat, dass durch seine Zustimmung nach Buchstabe b mit Beginn der Vertragserfüllung sein Widerrufsrecht erlischt, und d) der Unternehmer dem Verbraucher eine Bestätigung gemäß § 312f zur Verfügung gestellt hat.“

### 4.3 Wertersatz, § 357a BGB (wörtlich)
- Abs. 2: „Der Verbraucher hat Wertersatz für die bis zum Widerruf erbrachten Dienstleistungen, für die der Vertrag die Zahlung eines Preises vorsieht, … zu leisten, wenn 1. der Verbraucher von dem Unternehmer ausdrücklich verlangt hat, dass mit der Leistung vor Ablauf der Widerrufsfrist begonnen werden soll, … und 3. der Unternehmer den Verbraucher nach Artikel 246a § 1 Absatz 2 Satz 1 Nummer 1 und 3 EGBGB ordnungsgemäß informiert hat. Bei der Berechnung des Wertersatzes ist der vereinbarte Gesamtpreis zu Grunde zu legen. Ist der vereinbarte Gesamtpreis unverhältnismäßig hoch, so ist der Wertersatz auf der Grundlage des Marktwerts der erbrachten Leistung zu berechnen.“
- Abs. 3: „Widerruft der Verbraucher einen Vertrag über die Bereitstellung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten, so hat er keinen Wertersatz zu leisten.“

**Konsequenz für SaaS, wenn man es als Dienstleistung einordnet:** Bei einem Monatsabo ist die Leistung vor Ende der 14 Tage nicht „vollständig erbracht“. Das Widerrufsrecht bleibt also bestehen. Hat der Verbraucher den vorzeitigen Beginn verlangt und wurde er korrekt belehrt, schuldet er anteiligen Wertersatz. Ob der Anteil nach Zeit oder nach verbrauchtem Kontingent berechnet werden darf, ist **nicht verifiziert** (s. §6). In der Praxis entscheidet Paddle; Paddles Policy nennt Wertersatz nicht, sondern „full refund“ oder Ausschluss (2.2.4) bzw. Ermessen (7.2).

### 4.4 Widerrufsbutton: RL (EU) 2023/2673 und § 356a BGB
- **Deutsche Umsetzung:** „Gesetz zur Änderung des Verbrauchervertrags- und des Versicherungsvertragsrechts sowie zur Änderung des Behandlungsvertragsrechts“, **BGBl. 2026 I Nr. 28**, verkündet 05.02.2026, **in Kraft 19.06.2026** (Sekundär: Noerr, 13.03.2026, https://www.noerr.com/de/insights/umsetzungsgesetz-zum-widerrufsbutton-veroeffentlicht). BGBl-Fundstelle nicht im Original abgerufen. **Der Normtext von § 356a BGB ist aber live auf gesetze-im-internet.de:** https://www.gesetze-im-internet.de/bgb/__356a.html
- § 356a Abs. 1 (wörtlich): „Bei Fernabsatzverträgen, die über eine Online-Benutzeroberfläche geschlossen werden, hat der Unternehmer sicherzustellen, dass der Verbraucher auf der Online-Benutzeroberfläche durch das Nutzen einer Widerrufsfunktion eine Widerrufserklärung abgeben kann. Die Widerrufsfunktion muss gut lesbar mit „Vertrag widerrufen“ oder einer anderen gleichbedeutenden eindeutigen Formulierung beschriftet sein. Sie muss während des Laufs der Widerrufsfrist auf der Online-Benutzeroberfläche ständig verfügbar, hervorgehoben platziert und für den Verbraucher leicht zugänglich sein.“ Abs. 2: Name, Vertragsidentifikation, elektronischer Kontaktweg. Abs. 3: Bestätigungsfunktion „Widerruf bestätigen“. Abs. 4: unverzügliche Eingangsbestätigung auf einem dauerhaften Datenträger mit Datum und Uhrzeit. Abs. 5: Der Widerruf ist fristgerecht, wenn er vor Ablauf über die Funktion abgesendet wurde.
- EU-Text Art. 11a RL 2011/83/EU (eingefügt durch 2023/2673): **blocked: tooling** (EUR-Lex lieferte eine AWS-WAF-Challenge und leere Seiten). Anwendbarkeit ab 19.06.2026 laut mehreren Sekundärquellen, z. B. https://www.hlc.com/en/publications/eu-consumer-protection-law-update-new-mandatory-withdrawal-button-what-online-traders-need-to-know.
- **Wer muss den Button beim MoR anbieten?** Primär ist Paddle als Unternehmer verpflichtet, und Paddle bietet den Button im Customer Portal an (Refund Policy 3.1.1). Sekundär: IHK Stuttgart (18.05.2026, https://www.ihk.de/stuttgart/fuer-unternehmen/recht-und-steuern/it-recht/ecommerce/faq-zur-widerrufsfunktion-widerrufsbutton--7052360): „unabhängig davon, wer die Plattform betreibt“. Die Funktion soll „von jeder Unterseite der Online-Benutzeroberfläche unmittelbar zugänglich sein“ und „grundsätzlich auch ohne Login erreichbar sein“. Login genügt nur, wenn der Vertrag selbst ein Kundenkonto voraussetzte. Nach Ablauf der Frist ist die Funktion nicht mehr zwingend. Noerr (Sekundär): Der Unternehmer bleibt auch bei Vertragsschluss über Drittplattformen verantwortlich. e-recht24 (22.06.2026, Sekundär): Eine pauschale Anzeige ist nicht irreführend.
  **Offene Rechtsfrage (nicht verifiziert):** Der Vertrag kommt auf **unslop.codes** zustande (Paddle-Overlay). Reicht dann Paddles Portal-Button (erreichbar über den Mail-Link oder paddle.net) als „auf der Online-Benutzeroberfläche“? Vorsichtige Lösung: dauerhaft und hervorgehoben auf unslop.codes einen Link „Vertrag widerrufen“ zeigen, der auf Paddles Widerrufsflow (paddle.net) führt. Analog dazu hat die Rechtsprechung zum Kündigungsbutton den Reseller für die Partnerseite verantwortlich gemacht (§5.2).

### 4.5 UK (kurz)
Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (https://www.legislation.gov.uk/uksi/2013/3134), wörtlich:
- reg 30(2): Für Service-Verträge und digitale Inhalte endet die Frist „at the end of 14 days after the day on which the contract is entered into“.
- reg 36(2): Das Kündigungsrecht erlischt bei einem Service erst, wenn er „has been fully performed“, auf Verlangen und mit Bestätigung. reg 36(4)(b): Zu zahlen ist ein Betrag „which is in proportion to what has been supplied, in comparison with the full coverage of the contract“.
- reg 37(2): Bei digitalen Inhalten erlischt das Recht mit Beginn der Lieferung nach Zustimmung und Bestätigung.
- DMCC Act 2024 Subscription-Regime (Sekundär): Neue 14-Tage-Frist nach Trial-Ende oder nach einer Verlängerung von 12 Monaten oder mehr, anteilige Erstattung. Start ursprünglich Frühjahr 2027, laut TLT (11.08.2026) am 10.08.2026 auf **Januar 2027** vorgezogen (https://www.tlt.com/insights-and-events/insight/dmcc-act-subscription-contracts-regime-brought-forward-by-the-pm-what-do-businesses-need-to-know). Sekundärverordnungen sind laut Artikel noch nicht veröffentlicht. Paddle bildet die Frist nach dem Trial und die UK-Jahresverlängerung schon ab (Refund Policy 2.2.2/2.2.3).

---

## 5. Abo-Kündigung, Proration, Trials, Nichtleistung, Missbrauch

### 5.1 § 309 Nr. 9 BGB (wörtlich, AGB bei Dauerschuldverhältnissen)
Unwirksam ist „a) eine den anderen Vertragsteil länger als zwei Jahre bindende Laufzeit des Vertrags, b) eine den anderen Vertragsteil bindende stillschweigende Verlängerung des Vertragsverhältnisses, es sei denn das Vertragsverhältnis wird nur auf unbestimmte Zeit verlängert und dem anderen Vertragsteil wird das Recht eingeräumt, das verlängerte Vertragsverhältnis jederzeit mit einer Frist von höchstens einem Monat zu kündigen, oder c) eine zu Lasten des anderen Vertragsteils längere Kündigungsfrist als einen Monat vor Ablauf der zunächst vorgesehenen Vertragsdauer“.
→ Ein monatliches Abo mit Kündigung zum Periodenende ist unproblematisch. Paddle: „You can cancel a Subscription at any time with effect from the end of your current billing period.“ (Buyer Terms 6). Für einen **Jahresplan** gilt: Die Verlängerung darf gegenüber Verbrauchern nur unbefristet mit höchstens einem Monat Kündigungsfrist erfolgen. Ob Paddle nach der Verlängerung eines Jahresabos eine monatliche Kündigung technisch abbildet, ist **nicht verifiziert** und muss vor Einführung eines Jahresplans geklärt werden.

### 5.2 § 312k BGB Kündigungsbutton (wörtlich, Auszug)
Abs. 2: Der Unternehmer hat sicherzustellen, dass der Verbraucher „auf der Webseite eine Erklärung zur ordentlichen oder außerordentlichen Kündigung … über eine Kündigungsschaltfläche abgeben kann. Die Kündigungsschaltfläche muss gut lesbar mit nichts anderem als den Wörtern „Verträge hier kündigen“ oder mit einer entsprechenden eindeutigen Formulierung beschriftet sein.“ Danach folgen die Bestätigungsseite und „jetzt kündigen“. „Die Schaltflächen und die Bestätigungsseite müssen ständig verfügbar sowie unmittelbar und leicht zugänglich sein.“ Abs. 6: Bei Verstoß ist eine Kündigung „jederzeit und ohne Einhaltung einer Kündigungsfrist“ möglich.
- **Reseller-Konstellation (Sekundär):** LG Hildesheim, 09.01.2024, 3 O 109/23 (vzbv, https://www.vzbv.de/urteile/kuendigungsbutton-auch-bei-verkauf-von-online-abos-auf-webseiten-dritter): Digistore24 (Reseller) war für den fehlenden Kündigungsbutton auf der Partnerwebseite verantwortlich. Zum Abrufzeitpunkt nicht rechtskräftig, Berufung beim OLG Celle; der Ausgang ist **nicht verifiziert**. **Übertragen auf unslop:** Der Vertrag entsteht auf unslop.codes. Deshalb sollte unslop.codes einen ständig verfügbaren Button „Verträge hier kündigen“ führen, idealerweise ohne Login. Er kann auf den eigenen Flow (`POST /api/billing/subscription/cancel`) oder auf Paddles Cancel-Flow führen. Ob Paddles Portal allein § 312k auf der unslop-Seite erfüllt, ist **nicht verifiziert**.
- **BGH, 16.07.2026, I ZR 200/25** (Sekundär: Wettbewerbszentrale, https://www.wettbewerbszentrale.de/bgh-bestaetigungsseite-nach-kuendigungsbutton-darf-keine-alternativen-anbieten/): Die Bestätigungsseite darf „ausschließlich der Kündigung dienen“, also keine Halteangebote und keine Pausenhinweise. Für den eigenen Kündigungsflow relevant: keine „Downgrade statt kündigen“-Hinweise auf der Bestätigungsseite.
- B2B: § 312k schützt Verbraucher (Sekundär, itmr-legal).

### 5.3 Proration bei Up- und Downgrades (Paddle Billing)
- `proration_billing_mode` (https://developer.paddle.com/concepts/subscriptions/proration), wörtlich: `prorated_immediately` „Prorated amount is calculated now. The customer is billed the prorated amount now.“; `full_immediately` „Prorated amount isn't calculated. The customer is billed the full amount now.“; `prorated_next_billing_period` „… billed the prorated amount on their next renewal.“; `full_next_billing_period` „… billed for the full amount on their next renewal.“; `do_not_bill` „… isn't billed for the prorated amount or the full amount.“
- Downgrades (https://developer.paddle.com/build/customers/get-customer-credit-balances/, Such-Zusammenfassung, Wortlaut nicht einzeln geprüft): Ein Prorations-Überschuss wird zu einer **Customer Credit Balance** (pro Währung), die Paddle automatisch mit künftigen Transaktionen verrechnet. Das ist **kein** Cash-Refund. Beim Refund einer Transaktion, die eine Credit Balance erzeugt hat, reduziert Paddle diese automatisch (Help: how-do-i-issue-refunds).
- Für unslop derzeit nicht relevant (ein Plan). In der Policy trotzdem eine Zeile vorsehen: „Downgrades wirken zum nächsten Abrechnungszeitraum; Guthaben aus Planwechseln wird verrechnet, nicht ausgezahlt.“

### 5.4 Trials
- Arten (https://developer.paddle.com/concepts/subscriptions/trials/): „Free trials“ mit Kartenangabe, „Paid trials“, „Cardless trials“. Cardless ist laut Changelog 2025 in **early access / developer preview** (https://developer.paddle.com/changelog/2025/cardless-trials-developer-preview/). unslop nutzt Karte-Pflicht (PADDLE_SPEC).
- Erinnerung: „When the trial period is getting close to ending, Paddle sends an email to the customer to remind them that the trial is ending.“ (Trials-Doku). Konkrete Vorlaufzeit bei Billing: **nicht verifiziert**. Das Help-Dokument „Are my trial subscriptions compliant?“ (https://www.paddle.com/help/start/intro-to-paddle/are-my-trial-subscriptions-compliant) nennt Visa-Regeln (Welcome-Mail, „Enhanced Notification Email“, Initial-Transaction-Mail, Link zum Kündigen). Bei Standard-Abos erledigt Paddle das; nur Nutzer der (Classic-)„Charges API“ müssen „7+ days before“ selbst mailen.
- Buyer Terms 3: „If you wish to cancel before we start charging your payment method, you must do so before the end of the trial period.“ Paddle sendet „reminder notices about your Subscription where required by law“ und holt bei Preiserhöhungen die Zustimmung ein, wo gesetzlich nötig.
- US/Kalifornien: Seit 01.07.2025 zeigt der Paddle-Checkout für kalifornische Kunden bei Auto-Renew-Abos inklusive Trials eine Consent-Checkbox (CARL, FTC Negative Option Rule) (https://developer.paddle.com/changelog/2025/explicit-consent-negative-option/).

### 5.5 Ausfall und Nichtleistung (Verbraucher, §§ 327 ff. BGB, wörtlich)
- § 327 Abs. 2: Digitale Dienstleistungen sind solche, die „die Erstellung, die Verarbeitung oder die Speicherung von Daten in digitaler Form oder den Zugang zu solchen Daten ermöglichen“. SaaS fällt darunter.
- § 327c Abs. 1: Stellt der Unternehmer „auf Aufforderung des Verbrauchers nicht unverzüglich“ bereit, „so kann der Verbraucher den Vertrag beenden“.
- § 327i: Bei Mängeln gibt es Nacherfüllung (§ 327l), Vertragsbeendigung (§ 327m) oder **Minderung (§ 327n)** sowie Schadensersatz.
- § 327m Abs. 2: Keine Beendigung, „wenn der Mangel unerheblich ist“.
- § 327s Abs. 1: Abweichungen zum Nachteil des Verbrauchers sind unwirksam. Ein Ausschluss von Refunds bei Ausfall ist gegenüber Verbrauchern also nicht wirksam.
- § 327r Abs. 3: Bei einer nachteiligen Produktänderung kann der Verbraucher „innerhalb von 30 Tagen unentgeltlich beenden“.
- Paddle-Seite: Refund Policy 4 (siehe 1.10).

### 5.6 Missbrauchsklausel
Paddle schließt Refunds bei „evidence of fraud, refund abuse, or other manipulative behaviour“ aus (1.3) und sperrt bei missbräuchlichem Chargeback den Zugang (Buyer Terms 4). Eine Seller-Klausel darf nur die **freiwillige** Garantie beschränken (z. B. „einmal pro Kunde/Organisation“, „nicht bei wiederholten Neuanmeldungen zur Umgehung des Trials“). Gesetzliche Rechte darf sie nicht beschränken (§ 312m Abs. 1 BGB: „nicht zum Nachteil des Verbrauchers … abgewichen werden“). **Achtung:** Laut dem Sekundärbericht (§2.2) können solche Einschränkungen beim Domain Review Ärger machen. Sicherer ist es, sie in die AGB zu verlagern oder ganz auf Paddles 1.3 zu verweisen.

---

## 6. Kontingent verbraucht: Refund?
- **Kontingent als Ermessenskriterium:** Paddle nennt ausdrücklich „usage or consumption“ (Refund Policy 7.2) als Kriterium für Ermessens-Refunds. Eine transparente Seller-Regel wie „Freiwillige Erstattung nur, wenn im Abrechnungszeitraum höchstens X Scans verbraucht wurden“ ist als **freiwillige Kulanz** inhaltlich mit Paddle vereinbar. Sie kollidiert aber möglicherweise mit dem Review-Wunsch nach bedingungslosen Formulierungen (Sekundär, §2.2).
- **Gesetzlicher Widerruf (Verbraucher):** Das Kontingent kann das Widerrufsrecht nicht per AGB ausschließen (§ 312m). Bei Einordnung als Dienstleistung (§ 356 Abs. 5) bleibt das Recht bis zur vollständigen Erbringung bestehen. Es gibt nur **Wertersatz** nach § 357a Abs. 2 auf Basis des Gesamtpreises, anteilig; UK reg 36(4)(b): „in proportion to what has been supplied, in comparison with the full coverage of the contract“. Ob „vollständig erbracht“ schon vorliegt, wenn 500/500 Scans verbraucht sind, und ob der Anteil verbrauchsbasiert statt zeitbasiert berechnet werden darf, ist **nicht verifiziert** und ein Punkt für anwaltliche Klärung. Paddle entscheidet solche Fälle ohnehin selbst.
- **Transparenzgebot:** Wer Kontingentverbrauch berücksichtigt, sollte es vorab klar sagen (Checkout-/Preisseite und Policy), Zahl und Zeitraum nennen und „Ihre gesetzlichen Rechte bleiben unberührt“ ergänzen. Die AGB-rechtliche Transparenzkontrolle (§ 307 Abs. 1 S. 2 BGB) wurde nicht separat abgerufen: **nicht verifiziert**.
- **B2B:** Ohne Widerrufsrecht kann der Seller Kulanz frei nach Kontingent staffeln. Paddle kann trotzdem nach MSA 10.2 innerhalb von 14 Tagen nach Ermessen erstatten.

---

## (a) Gliederungsvorschlag Refund Policy (DE + EN, Link im Footer neben AGB und Datenschutz)
1. **Wer verkauft:** „Unser Bestellprozess wird von Paddle.com Market Ltd als Reseller und Merchant of Record abgewickelt. Paddle ist Ihr Vertragspartner für den Kauf.“ (MSA 9.2). Links auf Paddle Buyer Terms und Paddle Refund Policy.
2. **Ihre gesetzlichen Rechte** (EU/EEA/UK-Verbraucher): 14-Tage-Widerruf, erneute 14 Tage nach Trial-Ende (Paddle 2.2.2), Weg über den Paddle-Widerrufsbutton (paddle.net / „Manage subscription“). **Link „Vertrag widerrufen“** ständig sichtbar auf unslop.codes (§ 356a).
3. **Unsere zusätzliche Garantie** (je nach Option (b)): Frist, bedingungslos formuliert, Anfrageweg (support@… und paddle.net), Bearbeitung durch Paddle, Rückbuchung auf die ursprüngliche Zahlart.
4. **Kündigung:** jederzeit zum Ende des Abrechnungszeitraums; Button „Verträge hier kündigen“ (§ 312k); Zugang bleibt bis Periodenende; keine anteilige Rückzahlung bei Kündigung mitten in der Periode (außerhalb von 2/3 und 6).
5. **Trial:** 14 Tage, Karte nötig, keine Belastung bei Kündigung vor Trial-Ende, Erinnerungsmail durch Paddle.
6. **Planwechsel:** Wirkung und Proration; Guthaben wird verrechnet, nicht ausgezahlt.
7. **Störungen und Mängel:** erst Support, dann Paddle; gesetzliche Rechte (§§ 327c, 327i ff. BGB) unberührt; ggf. eigene SLA-Gutschrift.
8. **Chargebacks:** bitte zuerst Kontakt; Zugang kann während der Prüfung gesperrt werden (Paddle 6.2).
9. **Missbrauch:** Verweis auf Paddle 1.3. Eine eigene Einschränkung, wenn überhaupt, nur für die freiwillige Garantie.
10. **Business-Kunden:** kein gesetzliches Widerrufsrecht, die freiwillige Garantie gilt aber gleichermaßen.
11. **Kontakt, Stand, Versionsdatum.**

## (b) Optionen für die unslop-Refund-Regel
| Option | Inhalt | Vorteile | Nachteile / Risiken | Paddle-Konformität |
|---|---|---|---|---|
| **A: Nur gesetzlich** | Nur Verweis auf Paddle Buyer Terms/Refund Policy und gesetzliche Rechte, keine eigene Garantie | Geringste Kosten; kein Kulanzrisiko bei LLM-Kosten (Vertex-Kosten pro Scan fallen sofort an) | B2B-Kunden haben faktisch nur Paddles 14-Tage-Ermessen; wirkt wenig kundenfreundlich; Handbook-Empfehlung (30 Tage) wird ignoriert; laut Einzelbericht (Sekundär) steigt das Review-Risiko | Primär zulässig (keine Mindestfrist-Pflicht gefunden). Review-Risiko: nicht verifiziert |
| **B: 14 Tage bedingungslos** | „Volle Erstattung der ersten Zahlung, wenn innerhalb von 14 Tagen angefragt, ohne Angabe von Gründen“ | Deckt sich mit Paddles 14-Tage-Ermessen (7.1) und MSA 10.2; bedingungsloser Wortlaut ist review-freundlich (Sekundär); überschaubares Risiko, weil der 14-Tage-Trial vorgeschaltet ist | Trial und erste Zahlung zusammen ergeben bis zu 28 Tage Nutzung mit Rückgaberecht; Missbrauch durch Kontingent-Ausnutzung möglich (500 Scans und 50 Eskalationen verursachen echte Vertex-Kosten) | Konform; kein Widerspruch zu Paddle |
| **B′: 14 Tage, kontingentgebunden** | wie B, aber nur bei höchstens X Scans | Schützt vor Kostenmissbrauch | Laut Sekundärbericht Ablehnungsgrund („qualifiers“); muss ausdrücklich als zusätzlich zu gesetzlichen Rechten formuliert werden | Inhaltlich vereinbar (Paddle 7.2 „usage“), Review-Risiko erhöht (nicht verifiziert) |
| **C: 30 Tage bedingungslos** | Handbook-Best-Practice | Maximal vertrauensbildend; entspricht der Paddle-Empfehlung | Paddle erstattet nach eigener Policy nur bis 14 Tage nach Ermessen. Über 14 Tage hinaus muss unslop selbst per Dashboard oder API auslösen (Auto-Freigabe bis 400 USD); Kostenrisiko wie bei B, verdoppelt | Konform, entspricht der Empfehlung |

**Einschätzung (keine Rechtsberatung):** B ist der pragmatische Mittelweg: bedingungslos, deckungsgleich mit Paddles 14-Tage-Mechanik, und der Trial mit Kartenpflicht fängt das Probierverhalten schon vorher ab. Missbrauch sollte über Paddles 1.3 und die Trial-Regel „nur ein Trial pro Account“ (PADDLE_SPEC) laufen, nicht über Einschränkungen in der Policy.

## (c) Offene Fragen
1. **§ 356a:** Genügt Paddles Portal-Button, oder braucht unslop.codes einen eigenen, dauerhaft sichtbaren „Vertrag widerrufen“-Link? (Empfehlung: Link anbieten; anwaltlich klären.)
2. **§ 312k:** Wer schuldet den Kündigungsbutton auf unslop.codes? LG Hildesheim spricht analog für eine Mitverantwortung. Muss der Button ohne Login funktionieren? Kann ein Link auf Paddles Flow genügen?
3. **SaaS-Einordnung:** Dienstleistung (§ 356 Abs. 5, Wertersatz) oder digitaler Inhalt (Abs. 6)? Paddles Klausel „started … using“ ist eher auf digitale Inhalte zugeschnitten. Welche Zustimmungs- und Kenntnisbestätigung holt der Paddle-Checkout bei EU-Verbrauchern konkret ein? Nicht verifiziert; im Sandbox-Checkout mit EU-Adresse prüfen.
4. **Kontingent und Wertersatz:** Ist eine verbrauchsbasierte Berechnung (Scans) statt einer zeitbasierten zulässig? Ist die Leistung nach 500/500 Scans „vollständig erbracht“?
5. **Domain Review:** Lehnt Paddle bedingte Policies tatsächlich ab? Primär nicht belegt, nur ein Sekundärbericht; Gegenbeispiel TailAdmin. Vor der Einreichung ggf. beim Paddle-Seller-Support (sellers@paddle.com) nachfragen.
6. **Refund-Gebühren:** Behält Paddle beim Refund die ursprüngliche Transaktionsgebühr? `retained_fee` belegt, dass es Einbehalte gibt; die Höhe ist nicht verifiziert (Paddle-Pricing oder Handbook prüfen).
7. **Trial-Erinnerung in Billing:** Wie viele Tage vor Trial-Ende mailt Paddle? Nicht verifiziert.
8. **Jahresplan (falls geplant):** Kann Paddle die Pflichten aus § 309 Nr. 9 lit. b (nach Verlängerung monatlich kündbar) und aus dem UK-DMCC-Regime (ab Jan 2027, Renewal-Cooling-off mit anteiliger Erstattung) abbilden?
9. **EU-Richtlinientext** (Art. 11a und Art. 16 lit. a/m RL 2011/83/EU in aktueller Fassung): **blocked: tooling** (EUR-Lex-WAF). Bei Bedarf manuell im Browser gegenlesen.
10. **Umnummerierung § 356 BGB:** Seit wann gilt die neue Zählung (Abs. 5/6 statt 4/5), und durch welches Gesetz? Nicht verifiziert.
11. **Ausgang OLG Celle** (Berufung gegen LG Hildesheim 3 O 109/23): nicht verifiziert.

## Quellenverzeichnis (alle abgerufen 2026-09-28)
Primär, Paddle: https://www.paddle.com/legal/refund-policy · https://www.paddle.com/legal/checkout-buyer-terms · https://www.paddle.com/legal/terms · https://www.paddle.com/seller-guides/seller-handbook · https://www.paddle.com/help/start/account-verification/what-is-domain-verification · https://www.paddle.com/help/manage/your-customers/how-do-i-issue-refunds · https://www.paddle.com/help/manage/risk-prevention/understanding-chargebacks-with-paddle · https://www.paddle.com/help/start/intro-to-paddle/are-my-trial-subscriptions-compliant · https://developer.paddle.com/build/transactions/create-transaction-adjustments/ · https://developer.paddle.com/concepts/subscriptions/proration · https://developer.paddle.com/concepts/subscriptions/trials/ · https://developer.paddle.com/build/customers/get-customer-credit-balances/ · https://developer.paddle.com/changelog/2025/retained-fees-payout-totals · https://developer.paddle.com/changelog/2025/cardless-trials-developer-preview/ · https://developer.paddle.com/changelog/2025/explicit-consent-negative-option/ · https://developer.paddle.com/migrate/paddle-classic/features
Primär, Recht: https://www.gesetze-im-internet.de/bgb/__356.html · __356a · __357a · __312k · __309 · __312g · __312m · __327 · __327b · __327c · __327d · __327i · __327m · __327r · __327s · https://www.legislation.gov.uk/uksi/2013/3134/regulation/29 · /30 · /36 · /37
Sekundär: Noerr 13.03.2026 · IHK Stuttgart 18.05.2026 · e-recht24 22.06.2026 · Wettbewerbszentrale 16.07.2026 · vzbv (LG Hildesheim) · datenschutz-rv.de 04.04.2024 · TLT 11.08.2026 · dev.to/pavelbuild 23.04.2026 · tailadmin.com/refund-policy · joinrecall.com/refunds · renosaur.app/refund · hlc.com
blocked: tooling: eur-lex.europa.eu (RL 2023/2673, RL 2011/83/EU konsolidiert)
