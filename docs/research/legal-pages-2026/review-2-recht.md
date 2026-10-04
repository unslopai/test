# Review 2: adversariale juristische Prüfung der Rechtstexte (docs/legal/)

Prüfer: Claude (kein Anwalt), Stand 2026-09-28. Geprüft wurden alle zehn Entwürfe unter `C:\dev\unslop-legal\docs\legal\`. Die Primärquellen habe ich selbst abgerufen, alle am **2026-09-28**. Wo ein Abruf nicht gelang, steht „nicht verifiziert“ dabei. Platzhalter und `[VORBEDINGUNG …]`-Marker zählen nicht als Befund. Ein Befund ist es aber, wenn ein Marker **fehlt**, obwohl die Spec die Aussage an eine Vorbedingung knüpft; dann greift der Platzhalter-Guard (Spec §5.4) nicht.

Abgerufene Primärquellen (alle am 2026-09-28):
- Paddle MSA (Stand 8 Oct 2025): https://www.paddle.com/legal/terms (Klauseln 9.2, 10.1, 10.2, 11.1(iii))
- Paddle Buyer Terms (Stand 31 Mar 2026): https://www.paddle.com/legal/checkout-buyer-terms
- Paddle Refund Policy (Stand 31 Mar 2026): https://www.paddle.com/legal/refund-policy
- Paddle Seller Handbook (Pflichtsatz, über Suchergebnis): https://www.paddle.com/seller-guides/seller-handbook
- BGBl. 2026 I Nr. 28, Art. 2 Nr. 7 (Anlage 1 EGBGB, Gestaltungshinweise 3 und 6): https://www.recht.bund.de/bgbl/1/2026/28/regelungstext.pdf?__blob=publicationFile&v=1
- BGB § 312, § 327e, § 327h, § 327r, § 360; ZPO § 38; VSBG §§ 36, 37: https://www.gesetze-im-internet.de/
- EDPB Guidelines 07/2020 v2.1, Rn. 110, 144 f., 152, 157 f.: https://www.edpb.europa.eu/system/files/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf
- EDPB Opinion 22/2024, Rn. 58, 104–111 und Executive Summary: https://www.edpb.europa.eu/system/files/2024-10/edpb_opinion_202422_relianceonprocessors-sub-processors_en.pdf
- HBDI-Impressum: https://datenschutz.hessen.de/impressum (Wilhelmstraße 7 bestätigt)
- Vercel Runtime Logs, Abschnitt Limits: https://vercel.com/docs/logs/runtime
- **Nicht abrufbar:** EUR-Lex VO (EU) 1215/2012 (Brüssel Ia); der Abruf lieferte eine leere Seite. Aussagen zu Art. 17–19 Brüssel Ia sind deshalb **nicht verifiziert**.

---

## Hohe Befunde

### J-01 (hoch): Die Belehrung zur Online-Widerrufsfunktion weicht vom amtlichen Gestaltungshinweis 3 ab
- **Fundstelle:** `nutzungsbedingungen.de.md` Ziff. 18: „Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung über einen solchen Widerruf.“ In `terms.en.md` Ziff. 18 steht dasselbe.
- **Quelle:** BGBl. 2026 I Nr. 28, Art. 2 Nr. 7 lit. a, neuer Gestaltungshinweis 3 (PDF oben). Der amtliche Einfügetext lautet: „… übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung **mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs**.“ Dazu kommt § 356a BGB, dessen Normtext in r3 zitiert ist; die Bestätigungsinhalte von Abs. 4 habe ich nicht selbst abgerufen.
- **Problem:** Der Entwurf kürzt den Mustersatz und lässt Pflichtinhalte der Eingangsbestätigung weg. Die Belehrung ist dann nicht mehr musterkonform und sagt dem Verbraucher weniger, als das Gesetz ihm gibt.
- **Korrektur DE:** „Sie können Ihr Widerrufsrecht auch online unter [URL DER WIDERRUFSFUNKTION] ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.“
- **Korrektur EN:** „You can also exercise your right of withdrawal online at [URL DER WIDERRUFSFUNKTION]. If you use this online function, we will send you without delay, on a durable medium (for example by email), an acknowledgement of receipt containing information on the content of your withdrawal statement and the date and time of its receipt.“
- **Folgearbeit:** Die Bestätigungsmail aus V10 muss diese Felder enthalten.

### J-02 (hoch): Paddles kanadische Verkäuferin fehlt, die Angabe zum Vertragspartner ist deshalb für Kanada falsch
- **Fundstellen:**
  - `impressum.de.md` / `legal-notice.en.md`, „Zahlungsabwicklung“: „für Käufer in den USA ist es die Paddle.com Inc.“
  - `datenschutz.de.md` / `privacy.en.md` §8 und Tabelle §11
  - `nutzungsbedingungen.de.md` / `terms.en.md` Ziff. 1.3: „mit Sitz in den USA mit Paddle.com Inc.“
  - `erstattung.de.md` / `refund.en.md` §1
- **Quelle:** Paddle Buyer Terms (31.03.2026) nennen drei Verkäuferinnen: „Paddle.com Inc. … 3811 Ditmars Blvd. #1071, Astoria, New York, NY 11105-1803, USA“, „Paddle.com (Canada) Ltd. … 22 Adelaide Street West, Suite 3400, Toronto, Ontario, M5H 4E3, Canada“ und für den Rest der Welt „Paddle.com Market Limited … 30 Old Bailey, London … EC4M 7AU“.
- **Problem:** Käufer in Kanada bekommen einen falschen Vertragspartner genannt. In der Datenschutzerklärung fehlt außerdem ein Empfänger mit Sitz in Kanada samt Übermittlungsgrundlage (Art. 13 Abs. 1 lit. e und f DSGVO).
- **Korrektur DE (Terms 1.3, sinngemäß auch Impressum und Refund):** „Den Kaufvertrag schließen Sie mit Paddle.com Market Limited (30 Old Bailey, London EC4M 7AU, Vereinigtes Königreich). Haben Sie Ihren Sitz in den USA, ist Ihr Vertragspartner die Paddle.com Inc. (3811 Ditmars Blvd. #1071, Astoria, NY 11105-1803, USA), in Kanada die Paddle.com (Canada) Ltd. (22 Adelaide Street West, Suite 3400, Toronto, Ontario M5H 4E3, Kanada).“
- **Korrektur EN:** „You conclude the purchase contract with Paddle.com Market Limited (30 Old Bailey, London EC4M 7AU, United Kingdom). If you are based in the USA, your contracting party is Paddle.com Inc. (3811 Ditmars Blvd. #1071, Astoria, NY 11105-1803, USA); if you are based in Canada, it is Paddle.com (Canada) Ltd. (22 Adelaide Street West, Suite 3400, Toronto, Ontario M5H 4E3, Canada).“
- **Datenschutz §11:** Die Paddle-Zeile um „Paddle.com (Canada) Ltd. / Kanada / Angemessenheitsbeschluss 2002/2/EG (nur für Organisationen unter PIPEDA)“ ergänzen. Ob PIPEDA hier greift, ist **nicht verifiziert**; sonst ist die Grundlage Art. 49 Abs. 1 lit. b DSGVO (Vertragserfüllung). Das muss Luca vor der Veröffentlichung klären.

### J-03 (hoch): Die Gerichtsstandsklausel gilt ohne Einschränkung auch für Verbraucher ohne Gerichtsstand in Deutschland
- **Fundstelle:** `nutzungsbedingungen.de.md` Ziff. 19.2 Satz 2: „Dasselbe gilt, wenn Sie keinen allgemeinen Gerichtsstand in Deutschland haben.“ In `terms.en.md` 19.2: „The same applies if you have no general place of jurisdiction in Germany.“
- **Quelle:** § 38 Abs. 2 ZPO (abgerufen). Bei fehlendem Inlandsgerichtsstand ist eine Vereinbarung zulässig, „muss schriftlich abgeschlossen oder … schriftlich bestätigt werden“; ein Klick in AGB erfüllt das zweifelhaft. Nach § 38 Abs. 3 ZPO sind andere Vereinbarungen nur ausdrücklich, schriftlich und nach Entstehen der Streitigkeit zulässig. Art. 17–19 Brüssel Ia VO (EU) 1215/2012: Gegenüber Verbrauchern mit Wohnsitz in der EU sind Gerichtsstandsvereinbarungen vor Entstehen der Streitigkeit grundsätzlich unwirksam (Wortlaut **nicht verifiziert**, EUR-Lex-Abruf gescheitert).
- **Problem:** Satz 2 ist nicht auf Unternehmer beschränkt. Er erfasst Verbraucher in Österreich, Frankreich usw., die nach Brüssel Ia nur an ihrem Wohnsitz verklagt werden können. Die Klausel ist insoweit voraussichtlich unwirksam, täuscht Verbraucher über ihre Rechte und macht die Klausel abmahnfähig (§ 307 Abs. 1 S. 2 BGB).
- **Korrektur DE:** „19.2 Sind Sie Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag unser Sitz in Bebra. Dasselbe gilt, wenn Sie als Unternehmer keinen allgemeinen Gerichtsstand in Deutschland haben. Wir dürfen Sie auch an Ihrem allgemeinen Gerichtsstand verklagen. Für Verbraucher gelten die gesetzlichen Gerichtsstände.“
- **Korrektur EN:** „19.2 If you are a merchant (Kaufmann), a legal entity under public law or a special fund under public law, the exclusive place of jurisdiction for all disputes arising from this contract is our registered office in Bebra, Germany. The same applies if you are a business and have no general place of jurisdiction in Germany. We may also sue you at your general place of jurisdiction. For consumers, the statutory places of jurisdiction apply.“

### J-04 (hoch): Die Folgen des Widerrufs zwischen Nutzungsvertrag und Paddle-Kauf passen nicht zusammen
- **Fundstelle:** `nutzungsbedingungen.de.md` Ziff. 18, „Folgen des Widerrufs“: „Wenn Sie diesen Vertrag widerrufen, endet er, und wir löschen Ihr Konto … Zahlungen für ein Abonnement erstattet Paddle nach dessen Bedingungen.“ Dazu Ziff. 12.1 („die Löschung des Kontos kündigt es nicht automatisch“) und `erstattung.de.md` §3 („Für den Nutzungsvertrag mit uns gilt die Widerrufsbelehrung in unseren Nutzungsbedingungen“). EN gleichlautend.
- **Quellen:**
  - § 360 Abs. 1 und 2 BGB (abgerufen): Wer einen Vertrag wirksam widerruft, ist auch an einen damit „zusammenhängenden Vertrag“ nicht mehr gebunden. Zusammenhängend ist ein Vertrag, der eine Leistung betrifft, die „von einem Dritten auf der Grundlage einer Vereinbarung zwischen dem Dritten und dem Unternehmer des widerrufenen Vertrags erbracht wird“; das trifft auf Paddle-Kauf und unslop-Nutzung wechselseitig zu.
  - § 312 Abs. 1 und 1a BGB (abgerufen): Das Fernabsatzrecht gilt nur, wenn der Verbraucher einen Preis zahlt oder Daten bereitstellt. Die Ausnahme greift, wenn die Daten ausschließlich zur Leistungserbringung verarbeitet werden.
  - Paddle Refund Policy (31.03.2026): Paddle erstattet nur nach einem Widerruf **gegenüber Paddle** oder nach eigenem Ermessen.
- **Problem:**
  1. Für den unentgeltlichen Nutzungsvertrag besteht wegen § 312 Abs. 1a S. 2 BGB wahrscheinlich gar kein **gesetzliches** Widerrufsrecht. Die Belehrung gibt es trotzdem als „Widerrufsrecht“ aus. Freiwillig ist das zulässig, aber dann gehört klar gesagt, dass es freiwillig ist.
  2. Der Satz „Zahlungen für ein Abonnement erstattet Paddle“ weckt die Erwartung, der Widerruf gegenüber unslop löse eine Erstattung aus. Das tut er nach Paddles Bedingungen nicht. Der Verbraucher verliert dann den Zugang und bleibt an das Abo gebunden.
  3. Besteht doch ein gesetzliches Widerrufsrecht, wirkt § 360 BGB kraft Gesetzes auf den Paddle-Kauf. Die Texte sagen dazu nichts, und Paddles Prozess bildet es nicht ab.
- **Korrektur DE (Ersatz für den Absatz „Folgen des Widerrufs“):** „Wenn Sie diesen Vertrag widerrufen, endet er, und wir löschen Ihr Konto nach unserer Datenschutzerklärung. Für den Nutzungsvertrag haben Sie an uns keine Zahlungen geleistet. Haben Sie über Paddle ein Abonnement gekauft, geben wir Ihren Widerruf unverzüglich als Widerruf auch des Kaufvertrags an Paddle weiter; Paddle erstattet Ihnen dann die Zahlungen für das Abonnement nach den Käuferbedingungen und der Erstattungsrichtlinie von Paddle. Unabhängig davon können Sie den Kaufvertrag jederzeit innerhalb der Widerrufsfrist direkt gegenüber Paddle widerrufen.“
- **Korrektur EN:** „If you withdraw from this contract, it ends and we delete your account as described in our Privacy Policy. You have made no payments to us under the usage contract. If you bought a subscription through Paddle, we will forward your withdrawal to Paddle without delay as a withdrawal from the purchase contract as well; Paddle will then refund your subscription payments under Paddle's buyer terms and refund policy. Independently of this, you can withdraw from the purchase contract directly with Paddle at any time within the withdrawal period.“
- **Zusatz:** Soll das Widerrufsrecht für den unentgeltlichen Vertrag freiwillig bleiben, über die Belehrung setzen: „Für den unentgeltlichen Nutzungsvertrag räumen wir Ihnen ein Widerrufsrecht ein, das dem gesetzlichen entspricht.“ EN: „For the free usage contract we grant you a right of withdrawal equivalent to the statutory one.“ Ob die Weiterleitung an Paddle mit MSA und Portal machbar ist, muss V10 klären (anwaltlich prüfen lassen).

### J-05 (hoch): Der Notfall-Austausch eines Unterauftragsverarbeiters ohne vorherige Information bleibt hinter Art. 28 Abs. 2 DSGVO zurück
- **Fundstelle:** `avv.de.md` § 7 Abs. 4: „Ist ein sofortiger Wechsel nötig … darf der Auftragsverarbeiter ihn ohne Vorankündigung ersetzen. Er informiert den Verantwortlichen dann unverzüglich; das Einspruchsrecht nach Absatz 3 beginnt mit dieser Mitteilung.“ In `dpa.en.md` § 7(4) steht dasselbe.
- **Quelle:** Art. 28 Abs. 2 DSGVO: vorherige Genehmigung; bei allgemeiner Genehmigung Information über jede „beabsichtigte“ Änderung, damit der Verantwortliche Einspruch erheben kann. EDPB 07/2020 Rn. 152: „the processor must obtain the controller's authorisation in writing before any personal data processing is entrusted to the subprocessor.“
- **Problem:** Die Klausel erlaubt, Auftragsdaten einem Unterauftragsverarbeiter zu übergeben, bevor der Kunde widersprechen konnte. Das ist ein Verstoß gegen Art. 28 Abs. 2 DSGVO, unabhängig davon, wie dringend der Wechsel ist.
- **Korrektur DE:** „(4) Stellt ein Unterauftragsverarbeiter ein akutes Sicherheitsrisiko dar oder fällt er aus, darf der Auftragsverarbeiter die betroffene Verarbeitung aussetzen. Einen Ersatz setzt er nur ein, wenn dieser in Anlage 4 bereits als Ersatz-Unterauftragsverarbeiter genehmigt ist oder das Verfahren nach Absatz 2 und 3 durchlaufen ist. Er informiert den Verantwortlichen unverzüglich über die Aussetzung.“
- **Korrektur EN:** „(4) If a sub-processor poses an acute security risk or fails, the Processor may suspend the affected processing. It uses a replacement only if the replacement is already authorized as a backup sub-processor in Annex 4 or the procedure under paragraphs 2 and 3 has been completed. It informs the Controller of the suspension without undue delay.“

---

## Mittlere Befunde

### J-06 (mittel): Die Änderungsklausel für Unternehmer schützt nur die Pflichten des Kunden, nicht die von unslop
- **Fundstelle:** `nutzungsbedingungen.de.md` 17.2: „**Ihre** Hauptleistungspflichten, die Preise und das Verhältnis von Leistung und Gegenleistung ändern wir auf diesem Weg nicht.“ In `terms.en.md` 17.2: „We do not change **your** main obligations …“
- **Quelle:** § 307 Abs. 1 und 2 BGB (Maßstab nach BGH XI ZR 26/20: eine Zustimmungsfiktion darf nicht in die Hauptleistungen eingreifen; das Urteil betrifft Verbraucher und strahlt über § 307 auf B2B aus). Das Urteil habe ich **nicht selbst abgerufen**.
- **Problem:** Wörtlich dürfte unslop per Schweigen die eigene Hauptleistung ändern. Dazu kommt „Änderung des Dienstes nach Ziffer 9“ als Änderungsgrund, der durch 9.1 („Weiterentwicklung“) sehr weit ist. Das Unwirksamkeitsrisiko ist erhöht.
- **Korrektur DE:** „Die Hauptleistungspflichten beider Seiten, die Preise und das Verhältnis von Leistung und Gegenleistung ändern wir auf diesem Weg nicht.“
- **Korrektur EN:** „We do not change the main obligations of either party, the prices or the balance between performance and consideration in this way.“

### J-07 (mittel): Paddles Widerrufsfunktion ist falsch bezeichnet
- **Fundstelle:** Terms 18 DE: „über die Funktion „Vertrag widerrufen“ im Kundenportal von Paddle“. Refund §3 DE ebenso; EN: „the "withdraw from contract" function in Paddle's customer portal“.
- **Quelle:** Paddle Refund Policy (31.03.2026): „An online withdrawal button is available in the Paddle Customer Portal … Select the withdrawal option (e.g., 'Request withdrawal') …“ Die Buyer Terms nennen nur „Buyer portal … via the link in your Subscription confirmation email“ und paddle.net. Wie die Schaltfläche auf Deutsch heißt: **nicht verifiziert**.
- **Problem:** Der Text behauptet eine Beschriftung, die Paddle so nicht belegt. Den Link-Namen „Abonnement verwalten“ belegt Paddle ebenfalls nicht.
- **Korrektur DE:** „… über die Widerrufsfunktion im Kundenportal von Paddle (erreichbar über den Link in Ihrer Bestätigungs-E-Mail oder unter https://paddle.net) …“
- **Korrektur EN:** „… through the withdrawal function in Paddle's customer portal (reachable through the link in your confirmation email or at https://paddle.net) …“

### J-08 (mittel): Die Erstattungsrichtlinie nennt für die Schweiz ein „gesetzliches“ Widerrufsrecht
- **Fundstelle:** `erstattung.de.md` §3: „Wenn Sie als Verbraucher in der EU, im EWR, in der Schweiz oder im Vereinigten Königreich kaufen, haben Sie zusätzlich ein gesetzliches Widerrufsrecht von 14 Tagen.“ EN gleich („statutory“).
- **Quelle:** Paddle Refund Policy (31.03.2026) gewährt EU/EWR/CH/UK-Verbrauchern 14 Tage. Dass das Schweizer OR kein allgemeines Widerrufsrecht für Online-Käufe kennt, habe ich **nicht verifiziert** (Art. 40a ff. OR nicht abgerufen).
- **Problem:** Für die Schweiz ist das Recht vertraglich (Paddle), nicht gesetzlich. Die Aussage ist voraussichtlich falsch und damit irreführend.
- **Korrektur DE:** „Wenn Sie als Verbraucher in der EU, im EWR oder im Vereinigten Königreich kaufen, haben Sie zusätzlich ein gesetzliches Widerrufsrecht von 14 Tagen; Verbrauchern in der Schweiz räumt Paddle nach seinen Bedingungen ein gleichwertiges Widerrufsrecht ein.“
- **Korrektur EN:** „If you buy as a consumer in the EU, the EEA or the United Kingdom, you also have a statutory right of withdrawal of 14 days; Paddle grants consumers in Switzerland an equivalent right under its terms.“

### J-09 (mittel): Terms und Erstattungsrichtlinie regeln die Sperre bei Rückbuchungen unterschiedlich
- **Fundstellen:** Terms 12.3: Sperre, „weil eine Rückbuchung (Chargeback) nach Einschätzung von Paddle missbräuchlich ist“. Refund §8: „Solange Paddle eine Rückbuchung prüft, kann der Zugang zu kostenpflichtigen Funktionen vorübergehend gesperrt sein.“ EN gleichlautend.
- **Quelle:** § 305c Abs. 2 BGB (Unklarheiten gehen zulasten des Verwenders) und § 307 Abs. 1 S. 2 BGB (Transparenz). Beide Normen habe ich nicht gesondert abgerufen; es sind Standardnormen.
- **Problem:** Die Erstattungsrichtlinie sperrt schon während der Prüfung, also auch bei berechtigten Rückbuchungen, etwa wenn die Karte missbraucht wurde. Die Terms sperren nur bei Missbrauch. Außerdem hängt die Sperre am Urteil eines Dritten (Paddle).
- **Korrektur:** Refund §8 an Terms 12.3 angleichen. DE: „Stuft Paddle eine Rückbuchung als missbräuchlich ein, können wir den Zugang zu kostenpflichtigen Funktionen nach Ziffer 12.3 unserer Nutzungsbedingungen vorübergehend sperren.“ EN: „If Paddle classifies a chargeback as abusive, we may temporarily suspend access to paid features under section 12.3 of our Terms of Service.“
- **Terms 12.3, Ergänzung DE:** „… informieren Sie und heben die Sperre auf, sobald der Grund entfallen ist.“ EN: „… inform you and lift the suspension as soon as the reason no longer applies.“

### J-10 (mittel): Die Klausel „KI-Fehler sind kein Mangel“ gilt auch für Verbraucher
- **Fundstelle:** Terms 13.3 (DE und EN): „… ist für sich genommen kein Mangel, soweit der Dienst im Übrigen die Qualität hat, die bei vergleichbaren KI-Prüfwerkzeugen üblich ist.“
- **Quelle:** § 327e Abs. 3 BGB (objektive Anforderungen: gewöhnliche Verwendung **und** Beschaffenheit, die der Verbraucher erwarten kann, einschließlich öffentlicher Äußerungen und Werbung) und § 327h BGB (Abweichung nur nach eigener Inkenntnissetzung und „ausdrücklich und gesondert“ vereinbart), beide abgerufen. Dazu § 327s Abs. 1 BGB (nicht gesondert abgerufen).
- **Problem:** Die Klausel greift nur einen Teil des objektiven Maßstabs heraus („üblich“) und lässt die berechtigte Erwartung und Werbeaussagen weg. Für Verbraucher weicht sie damit per AGB von § 327e ab, ohne das Verfahren des § 327h einzuhalten. Insoweit ist sie unwirksam.
- **Korrektur DE:** „13.3 Gegenüber Unternehmern gilt: Dass KI-Ausgaben im Einzelfall unvollständig oder falsch sind (Ziffer 4.2), ist für sich genommen kein Mangel, soweit der Dienst im Übrigen die vereinbarte und die bei vergleichbaren KI-Prüfwerkzeugen übliche Qualität hat. Für Verbraucher bleibt es bei den gesetzlichen Anforderungen (§§ 327e ff. BGB).“
- **Korrektur EN:** „13.3 Towards businesses: that AI Outputs are incomplete or wrong in an individual case (section 4.2) is not in itself a defect, provided the Service otherwise has the agreed quality and the quality customary for comparable AI review tools. For consumers, the statutory requirements (§§ 327e et seq. BGB) apply.“

### J-11 (mittel): Der Haftungsausschluss erfasst Ansprüche aus Art. 82 DSGVO, bei denen unslop Verantwortlicher ist
- **Fundstelle:** Terms 14.4 „Im Übrigen ist unsere Haftung ausgeschlossen.“ und 14.5 „Unsere Haftung **als Auftragsverarbeiter** gegenüber betroffenen Personen nach Art. 82 DSGVO bleibt unberührt.“
- **Quelle:** Art. 82 DSGVO; Haftungsbefreiung nur nach Art. 82 Abs. 3. Der Anspruch ist zwingend; der Wortlaut ist nicht gesondert abgerufen.
- **Problem:** Der Kunde ist selbst betroffene Person, etwa für Konto- und Anmeldedaten, und unslop ist dafür Verantwortlicher. Nach 14.4 wäre ein leicht fahrlässiger Datenschutzverstoß ohne Kardinalpflichtbezug ausgeschlossen. Gegenüber Art. 82 ist das unwirksam und für den Leser irreführend.
- **Korrektur DE:** „14.5 Ansprüche betroffener Personen nach Art. 82 DSGVO bleiben unberührt.“ EN: „14.5 Claims of data subjects under Art. 82 GDPR remain unaffected.“

### J-12 (mittel): Die Höchstbetragsgrenze für Kardinalpflichten gegenüber Unternehmern ist riskant
- **Fundstelle:** Terms 14.3: „… zusätzlich je Kalenderjahr auf den höheren der folgenden Beträge begrenzt …“
- **Quelle:** § 307 Abs. 2 Nr. 2 BGB. Nach ständiger BGH-Rechtsprechung (nicht selbst abgerufen) darf auch im B2B-Verkehr eine Summenbegrenzung bei Kardinalpflichten den vertragstypischen, vorhersehbaren Schaden nicht unterschreiten.
- **Problem:** Eine Jahresgesamtgrenze („je Kalenderjahr“) kann bei einem Vertraulichkeitsbruch von Kundencode unter dem typischen Schaden liegen. Die Spec (E5) sieht die anwaltliche Prüfung vor; das Risiko bleibt, solange sie fehlt.
- **Korrektur DE:** „14.3 Gegenüber Unternehmern ist unsere Haftung nach Ziffer 14.2 je Schadensfall auf [HAFTUNGSHÖCHSTBETRAG] Euro begrenzt; die Parteien gehen davon aus, dass dieser Betrag den vertragstypischen, vorhersehbaren Schaden deckt.“
- **Korrektur EN:** „14.3 Towards businesses, our liability under section 14.2 is limited to EUR [HAFTUNGSHÖCHSTBETRAG] per damaging event; the parties assume that this amount covers the typical, foreseeable damage.“
- **Hinweis:** Den Betrag anwaltlich festlegen lassen.

### J-13 (mittel): Handeln mit dem API-Schlüssel wird dem Konto ohne Verschulden zugerechnet
- **Fundstelle:** Terms 3.3: „Wer mit Ihrem API-Schlüssel handelt, handelt aus unserer Sicht für Ihr Konto, bis Sie den Schlüssel im Dashboard widerrufen.“ EN gleich.
- **Quelle:** § 307 Abs. 2 Nr. 1 BGB und § 309 Nr. 12 BGB (Beweislast); nicht gesondert abgerufen.
- **Problem:** Die Klausel rechnet auch Missbrauch durch Dritte zu, den der Kunde nicht zu vertreten hat. Gegenüber Verbrauchern ist das voraussichtlich unwirksam.
- **Korrektur DE:** „Nutzungen mit Ihrem API-Schlüssel rechnen wir Ihrem Konto zu, etwa beim Verbrauch von Kontingenten. Für Handlungen Dritter mit Ihrem Schlüssel haften Sie nur, soweit Sie deren Nutzung zu vertreten haben.“
- **Korrektur EN:** „We attribute use of your API key to your account, for example for quota consumption. You are liable for third-party actions with your key only to the extent you are responsible for their use.“

### J-14 (mittel): Der Änderungsvorbehalt nennt einen zu weiten Grund, und Unternehmer haben kein Lösungsrecht
- **Fundstellen:**
  - Terms 9.1: triftiger Grund ist auch „die Weiterentwicklung des Dienstes, etwa durch neue Prüfregeln oder bessere Modelle“.
  - Terms 9.3: „Für Unternehmer kündigen wir Änderungen, die den Dienst wesentlich einschränken, mit angemessener Frist in Textform an.“
- **Quelle:** § 327r Abs. 1 Nr. 1 BGB (abgerufen: der Vertrag muss „einen triftigen Grund dafür enthalten“), § 308 Nr. 4 BGB und § 307 BGB (nicht gesondert abgerufen).
- **Problem:**
  - Mit „Weiterentwicklung“ ist praktisch jede Änderung gerechtfertigt; ein Auffangtatbestand genügt dem Transparenzgebot kaum.
  - Unternehmer müssen eine wesentliche Einschränkung hinnehmen, ohne sich vom Vertrag lösen zu können (§ 307).
- **Korrektur DE (9.1, letzter Grund):** „… die Weiterentwicklung des Dienstes, soweit sie den Funktionsumfang nicht verringert.“ Neuer 9.3: „Für Unternehmer kündigen wir Änderungen, die den Dienst wesentlich einschränken, mindestens 30 Tage vorher in Textform an; Sie können den Vertrag dann zum Zeitpunkt der Änderung kündigen.“
- **Korrektur EN:** „… further development of the Service, provided it does not reduce its functionality.“ 9.3: „For businesses, we announce changes that significantly restrict the Service in text form at least 30 days in advance; you may then terminate the contract as of the date of the change.“

### J-15 (mittel): Terms 3.1 behauptet einen Zustimmungsschritt, den es noch nicht gibt, ohne Vorbedingungs-Marker
- **Fundstelle:** Terms 3.1: „Sie legen ein Konto an, indem Sie sich mit Ihrem GitHub-Konto anmelden und diesen Bedingungen zustimmen.“ Einen `[VORBEDINGUNG]`-Marker hat die Stelle nicht, obwohl V12/E13 den Schritt erst bauen (Research C12: „Kein Terms-Zustimmungsschritt bei der GitHub-Anmeldung“).
- **Quelle:** § 305 Abs. 2 BGB (Einbeziehung); Spec §4 V12.
- **Problem:** Der Guard (§5.4) lässt die Terms live gehen, obwohl die Einbeziehung fehlt. Der Satz wäre dann unwahr, und die AGB wären nicht einbezogen.
- **Korrektur:** Marker ergänzen, in DE und EN gleich: „[VORBEDINGUNG V12: Zustimmung zu Nutzungsbedingungen bei der Anmeldung umgesetzt und protokolliert]“.

### J-16 (mittel): Die Aussagen zu Vercel gelten erst auf dem Pro-Plan, tragen aber keinen Marker
- **Fundstellen:**
  - `datenschutz.de.md` §3: „als unser Auftragsverarbeiter“ und „Vercel speichert die Laufzeitprotokolle in unserem Tarif einen Tag lang.“
  - §11: „zusätzlich EU-Standardvertragsklauseln“
  - §12: „Laufzeitprotokolle bei Vercel | 1 Tag“
  - EN gleich
- **Quelle:** Vercel-Doku „Runtime Logs → Limits“ (Stand 2026-08-28): „Hobby: 1 hour of logs; Pro: 1 day of logs“. Spec §2 Nr. 1 und V1: DPA nur auf Pro und Enterprise. Die AVV-Anlage 4 trägt den Marker, die Datenschutzerklärung nicht.
- **Problem:** Solange der Account auf Hobby läuft, gibt es kein DPA (also keine Auftragsverarbeitung und keine SCC), und die Protokolle werden nur eine Stunde gehalten. Weil der Marker fehlt, hält der Guard die Seite nicht zurück.
- **Korrektur:** In §3 der Datenschutzerklärung, DE und EN, ergänzen: „[VORBEDINGUNG V1: Vercel Pro mit DPA aktiv]“.

### J-17 (mittel): Die Rolle von unslop bei fremden Daten im Code ist nicht durchgehend geklärt, und die Rechtsgrundlage fehlt
- **Fundstelle:** Datenschutz §2: „**Wir sind Auftragsverarbeiter unserer Kunden** für den Quellcode …“. Im Gegensatz dazu §6.4: „Sind Sie selbst unser Vertragspartner und nutzen unslop für eigenen Code, ist die Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO.“ EN gleich.
- **Quelle:** Art. 6 Abs. 1, Art. 13 Abs. 1 lit. c DSGVO; EDPB 07/2020 Rn. 80 f. (Research r5).
- **Problem:**
  - Bei Verbrauchern und bei Unternehmern ohne AVV ist unslop Verantwortlicher; §2 behauptet absolut das Gegenteil.
  - Für Daten **Dritter** im Code (Mitautoren, Testdaten) trägt Art. 6 Abs. 1 lit. b nicht, weil mit diesen Personen kein Vertrag besteht. Einschlägig wäre lit. f mit einem benannten Interesse.
- **Korrektur DE, §2 erster Satz des zweiten Punkts:** „Haben wir mit einem Kunden einen AVV geschlossen, sind wir für den Quellcode, den er uns zur Prüfung übermittelt, sein Auftragsverarbeiter (Abschnitt 6).“
- **Korrektur DE, §6.4 Rechtsgrundlage, ergänzen:** „Enthält Code, den Sie als unser Vertragspartner ohne AVV prüfen lassen, personenbezogene Daten Dritter, ist die Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse und das Ihre ist, den Code wie beauftragt zu prüfen.“
- **Korrektur EN:** „Where we have concluded a DPA with a customer, we are that customer's processor for the source code it sends us for review (section 6).“ und „If code you have reviewed as our contracting party without a DPA contains personal data of third parties, the legal basis is Art. 6(1)(f) GDPR; our legitimate interest, and yours, is to review the code as requested.“

### J-18 (mittel): Die Angaben zu Drittlandübermittlungen sind unvollständig und widersprechen dem AVV
- **Fundstelle:** Datenschutz §11. Bei Google steht „Verarbeitung in der EU“, bei Supabase nur „Singapur“. Die AVV-Anlage 4 nennt dagegen für Google „Unterauftragsverarbeiter von Google nach dessen Liste mit EU-Standardvertragsklauseln“ und für Supabase „USA (Supabase-Unterauftragsverarbeiter)“. Innerhalb der Anlage 4 steht bei Google zudem „keine [Übermittlung] für die Standardverarbeitung“ direkt neben den SCC.
- **Quelle:** Art. 13 Abs. 1 lit. f DSGVO (Absicht der Übermittlung in ein Drittland und Grundlage) und EDPB Opinion 22/2024 Rn. 75 (auch Fernzugriff aus einem Drittland ist eine Übermittlung).
- **Problem:** Die Datenschutzerklärung verschweigt mögliche Übermittlungen, die der eigene AVV einräumt.
- **Korrektur DE, §11:**
  - Google-Zeile: „Verarbeitung in der EU; soweit Unterauftragsverarbeiter von Google aus Drittländern zugreifen (etwa für Support), EU-Standardvertragsklauseln“
  - Supabase-Zeile: „Singapur (Vertragspartner) und USA (Unterauftragsverarbeiter von Supabase): EU-Standardvertragsklauseln“
- **Korrektur EN:**
  - „Processing in the EU; where Google's sub-processors access data from third countries (for example for support), EU Standard Contractual Clauses“
  - „Singapore (contracting party) and USA (Supabase's sub-processors): EU Standard Contractual Clauses“
- **Korrektur AVV Anlage 4, Google-Zeile:** DE „keine für die Modellverarbeitung; …“, EN „none for model processing; …“.

### J-19 (mittel): Für den IP-Hash der Warteliste fehlen Rechtsgrundlage und Interesse
- **Fundstelle:** Datenschutz §9: „Um Missbrauch zu begrenzen, speichern wir außerdem einen Hashwert …“. Als Rechtsgrundlage nennt §9 nur die Einwilligung (lit. a); die Einwilligung ist aber erst nach dem DOI-Klick erteilt, der Hash entsteht schon vorher.
- **Quelle:** Art. 13 Abs. 1 lit. c und d DSGVO.
- **Korrektur DE, ergänzen:** „Den Hashwert zur Missbrauchsbegrenzung verarbeiten wir auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist, massenhafte oder automatisierte Eintragungen abzuwehren.“
- **Korrektur EN:** „We process the hash for abuse prevention on the basis of Art. 6(1)(f) GDPR; our legitimate interest is to fend off mass or automated sign-ups.“

### J-20 (mittel): Änderungen am AVV gelten durch Schweigen als angenommen
- **Fundstelle:** `avv.de.md` § 16 Abs. 1: „Widerspricht der Verantwortliche nicht bis zum Inkrafttreten, gilt die Änderung als angenommen …“ EN gleich.
- **Quelle:** EDPB 07/2020 Rn. 110: „Any proposed modification, by a processor, of data processing agreements included in standard terms and conditions should be directly notified to **and approved by** the controller …“. Rn. 157 lässt Schweigen nur beim Unterauftragsverarbeiter-Wechsel unter allgemeiner Genehmigung als Genehmigung gelten.
- **Problem:** Die direkte Mitteilung ist erfüllt, die Genehmigung nicht. Außerhalb von § 7 ist die Fiktion aufsichtsrechtlich angreifbar.
- **Korrektur DE:** „(1) Der Auftragsverarbeiter teilt dem Verantwortlichen Änderungen dieses AVV mindestens sechs Wochen vor ihrem geplanten Inkrafttreten per E-Mail mit und bittet um Zustimmung im Dashboard oder in Textform. Ohne Zustimmung gilt die bisherige Fassung weiter; beide Parteien können den Hauptvertrag dann zum geplanten Zeitpunkt kündigen. Änderungen, die ausschließlich die Rechte des Verantwortlichen erweitern, werden mit der Mitteilung wirksam.“
- **Korrektur EN:** „(1) The Processor notifies the Controller of changes to this DPA by email at least six weeks before they are to take effect and asks for approval in the dashboard or in text form. Without approval, the previous version continues to apply; both parties may then terminate the Main Agreement as of the planned date. Changes that exclusively extend the Controller's rights take effect upon notification.“

### J-21 (mittel): Das Einspruchsrecht gegen neue Unterauftragsverarbeiter ist eingeengt, und DE und EN weichen voneinander ab
- **Fundstelle:** AVV § 7 Abs. 3 DE: „aus datenschutzrechtlich begründetem Anlass Einspruch erheben“. EN: „on **reasonable** data protection grounds“.
- **Quelle:** Art. 28 Abs. 2 S. 2 DSGVO („Möglichkeit …, gegen derartige Änderungen Einspruch zu erheben“, ohne Begründungserfordernis) und EDPB Opinion 22/2024 Rn. 58: „it is always up to the controller to decide whether to approve … or whether to object“.
- **Problem:** Die Begründungsschwelle hat keine Grundlage in Art. 28 Abs. 2. Die EN-Fassung ist mit „reasonable“ noch enger als die DE-Fassung; das ist eine inhaltliche Abweichung.
- **Korrektur DE:** „(3) Der Verantwortliche kann binnen 14 Tagen nach Zugang der Mitteilung in Textform Einspruch erheben; eine Begründung erleichtert die Suche nach einer Lösung.“
- **Korrektur EN:** „(3) The Controller may object in text form within 14 days of receiving the notice; stating reasons helps to find a solution.“

### J-22 (mittel): Bei Wechseln in der Unterauftragskette hat der Kunde keinen Einspruch
- **Fundstelle:** AVV § 7 Abs. 5: „Ändert ein Unterauftragsverarbeiter seine eigenen Unterauftragsverarbeiter, gibt der Auftragsverarbeiter die Änderung … weiter … Auf diese Fristen hat er keinen Einfluss.“
- **Quelle:** Art. 28 Abs. 2 und 4 DSGVO; EDPB Opinion 22/2024 Rn. 58 (die Entscheidung über „sub-(sub-)processor[s]“ liegt beim Verantwortlichen) und Executive Summary (Informationen über die gesamte Kette, Änderungen aktiv anzeigen).
- **Korrektur DE, anfügen:** „Der Verantwortliche kann auch gegen solche Änderungen nach Absatz 3 Einspruch erheben; lässt sich keine Lösung finden, kann er den Hauptvertrag für die betroffene Leistung außerordentlich kündigen.“
- **Korrektur EN:** „The Controller may also object to such changes under paragraph 3; if no solution is found, it may terminate the Main Agreement for the affected service for cause.“

### J-23 (mittel): Das Prüfrecht ist nachrangig, und die Wahl der Prüfungsart liegt nicht erkennbar beim Kunden
- **Fundstelle:** AVV § 12 Abs. 2: „Genügen diese Nachweise im Einzelfall nicht, ermöglicht der Auftragsverarbeiter Überprüfungen …“ und Abs. 3: „Eine Prüfung des Arbeitsplatzes kann deshalb auch als Fernprüfung … erfolgen.“
- **Quelle:** Art. 28 Abs. 3 lit. h DSGVO; EDPB 07/2020 Rn. 144: Über die Art der Prüfung (remote oder vor Ort) entscheidet „the final choice on this is to be taken by the controller“. Den Prüfer wählt letztlich der Verantwortliche.
- **Problem:** Es bleibt offen, wer beurteilt, ob die Nachweise „genügen“. Die Fernprüfung kann als Wahlrecht von unslop gelesen werden.
- **Korrektur DE:** „(2) Hält der Verantwortliche diese Nachweise im Einzelfall nicht für ausreichend, ermöglicht der Auftragsverarbeiter … (3) … Auf Wunsch des Verantwortlichen kann die Prüfung des Arbeitsplatzes als Fernprüfung per Bildschirmfreigabe erfolgen; die Wahl trifft der Verantwortliche.“
- **Korrektur EN:** „(2) If the Controller considers this evidence insufficient in an individual case, the Processor allows … (3) … At the Controller's choice, the audit of the workplace can take place remotely via screen sharing.“

### J-24 (mittel): Zurückgegeben werden nur Review-Ergebnisse, nicht alle Auftragsdaten
- **Fundstelle:** AVV § 14 Abs. 1: „… die Review-Ergebnisse in einem gängigen maschinenlesbaren Format bereit.“ Terms 12.4 ebenso.
- **Quelle:** Art. 28 Abs. 3 lit. g DSGVO: „nach Wahl des Verantwortlichen **alle** personenbezogenen Daten … löscht oder zurückgibt“.
- **Problem:** Diffs, als erledigt markierte Hinweise (Dismissals) samt Begründungen und Protokolldaten fallen aus der Rückgabe heraus.
- **Korrektur DE:** „(1) … auf dessen Verlangen … alle Auftragsdaten, insbesondere Review-Aufträge, Diffs, Ergebnisse und als erledigt markierte Hinweise, in einem gängigen maschinenlesbaren Format bereit.“
- **Korrektur EN:** „(1) … on request … all processed data, in particular review requests, diffs, results and findings marked as resolved, in a common machine-readable format.“

---

## Niedrige Befunde

### J-25 (niedrig): Die Herausgabe an Drittlandbehörden richtet sich nach „rechtlich verpflichtet“
- **Fundstelle:** AVV § 8 Abs. 3: „… gibt Daten nur heraus, soweit er rechtlich dazu verpflichtet ist.“
- **Quelle:** EDPB Opinion 22/2024 Executive Summary und Rn. 109 ff.: Eine solche Formel verletzt Art. 28 Abs. 3 lit. a nicht per se, reicht aber bei Drittlandbezug allein nicht und ist keine dokumentierte Weisung.
- **Korrektur DE:** „… prüft das Verlangen auf seine Rechtmäßigkeit, legt Rechtsbehelfe ein, soweit das aussichtsreich ist, und gibt nur das Mindestmaß an Daten heraus, zu dessen Herausgabe er nach dem Recht der Union oder eines Mitgliedstaats oder nach einer vollstreckbaren Entscheidung verpflichtet ist.“
- **Korrektur EN:** „… assesses the legality of the request, challenges it where there are reasonable grounds, and discloses only the minimum data it is obliged to disclose under Union or Member State law or an enforceable decision.“

### J-26 (niedrig): „Wir erstatten“ widerspricht dem Paddle-Modell, und Ausnahmen fehlen
- **Fundstelle:** Refund §4: „Für den Rest einer angebrochenen Periode **erstatten wir** nichts anteilig, es sei denn, Abschnitt 2, 3 oder 6 greift …“
- **Quelle:** MSA 10.1: „you will not make this payment directly to the Buyer but will inform Paddle … and Paddle will make the relevant refund“. Terms 11.1.
- **Problem:** Der Wortlaut „wir erstatten“ passt nicht dazu, dass Paddle zahlt. Außerdem fehlen zwei Ausnahmen: die anteilige Erstattung nach AVV § 7 Abs. 3 und die Beendigung nach § 327r BGB (Terms 9.2).
- **Korrektur DE:** „Für den Rest einer angebrochenen Periode gibt es keine anteilige Erstattung, es sei denn, Abschnitt 2, 3 oder 6 greift, Sie beenden den Vertrag nach Ziffer 9.2 unserer Nutzungsbedingungen oder nach § 7 Abs. 3 unseres AVV, oder Paddle erstattet nach seinem Ermessen.“
- **Korrektur EN:** „There is no pro-rata refund for the rest of a started period unless section 2, 3 or 6 applies, you end the contract under section 9.2 of our Terms of Service or § 7(3) of our DPA, or Paddle grants a refund at its discretion.“

### J-27 (niedrig): Der Paddle-Pflichtsatz „alle Kundenanfragen“ steht neben dem eigenen Support
- **Fundstelle:** Terms 1.3: „Paddle bearbeitet alle Kundenanfragen und Rückgaben.“ (Pflichtsatz aus dem Seller Handbook) und im selben Absatz: „Fragen zur Nutzung und technische Fragen zum Dienst beantworten wir.“ Dazu 10.2.
- **Quelle:** Seller Handbook (Pflichtsatz, über Suchergebnis belegt); Buyer Terms regeln den Produkt-Support nicht.
- **Korrektur:** Den Pflichtsatz wörtlich stehen lassen und den Folgesatz eindeutig abgrenzen. DE: „Anfragen zu Bestellung und Zahlung beantwortet Paddle; Fragen zur Nutzung und technische Fragen zum Dienst beantworten wir.“ EN: „Paddle answers questions about orders and payment; we answer questions about using the Service and technical questions.“

### J-28 (niedrig): GitHub steht in der Fristentabelle des Auftragsverarbeiters, obwohl es kein Unterauftragsverarbeiter ist
- **Fundstelle:** AVV Anlage 2: „Webhook-Zustellprotokolle bei GitHub | 3 Tage (GitHub, siehe Anlage 4)“. In Anlage 4 steht GitHub unter „Kein Unterauftragsverarbeiter“.
- **Korrektur:** Die Zeile aus der Tabelle nehmen und als Satz unter die Tabelle stellen. DE: „Außerhalb unserer Verarbeitung: GitHub hält Webhook-Zustellprotokolle 3 Tage vor (siehe Anlage 4).“ EN: „Outside our processing: GitHub keeps webhook delivery logs for 3 days (see Annex 4).“

### J-29 (niedrig): Bei der Mängelbeseitigung für Unternehmer fehlt „zumutbare“
- **Fundstelle:** Terms 13.2: „… nach unserer Wahl durch Korrektur oder durch eine Umgehungslösung.“
- **Quelle:** § 307 BGB (nicht gesondert abgerufen).
- **Korrektur DE:** „… oder durch eine zumutbare Umgehungslösung“. EN: „… or by a reasonable workaround“.

### J-30 (niedrig, nicht verifiziert): Die Brevo-Vertragspartei ist ungeklärt
- **Fundstelle:** Datenschutz §9: „Brevo GmbH … ein Unternehmen der Sendinblue SAS, Paris“.
- **Quelle:** Research-Synthese Z. 44: Welche Brevo-Entität DPA-Partei ist, ist offen. Selbst geprüft habe ich es nicht.
- **Korrektur:** Den Zusatz „ein Unternehmen der Sendinblue SAS“ streichen oder erst nach Prüfung des Brevo-DPA übernehmen. Die DPA-Partei in einen `[BESTÄTIGEN: …]`-Marker aufnehmen.

---

## Geprüft und unauffällig (knapp)

- **Impressum (§ 5 DDG):** Name, Rechtsform, Vertretungsberechtigter, Anschrift, E-Mail und Telefon (Platzhalter), Register, USt-IdNr./W-IdNr. (Platzhalter mit Weglass-Regel) sind vollständig; DE/EN sind inhaltsgleich. § 18 Abs. 2 MStV greift nicht, solange es keine journalistisch-redaktionellen Inhalte (Blog) gibt; kommt einer hinzu, braucht es einen Verantwortlichen nach § 18 Abs. 2 MStV. Die DSA-Kontaktstelle ist in Ordnung.
- **VSBG:** Die Negativerklärung ist korrekt, eine Pflicht nach § 36 VSBG besteht für Kleinstbetriebe nicht. Betrieblicher Hinweis: § 37 VSBG (abgerufen, in Kraft) verlangt nach einer nicht beigelegten Streitigkeit einen Hinweis in Textform auf eine zuständige Schlichtungsstelle. Das ist Prozess, kein Textbefund.
- **Paddle-Pflichten:**
  - Pflichtsatz wörtlich enthalten (Terms 1.3, Refund §1).
  - Firmenname in den Terms.
  - Reseller-Hinweis (MSA 9.2) im Impressum.
  - Refund Policy verlinkt.
  - Kein eigenes Abrechnen (MSA 10.1): Terms 11.1 und AVV § 7(3) „über Paddle“ passen. Die Geld-zurück-Zusage (Refund §2) ist über MSA 10.1 („If you agree with the Buyer to issue a refund … Paddle will make the relevant refund“) gedeckt und wird über Paddles „highest level of rights“ Teil des Rahmens.
  - Refund §6 zum wesentlichen Mangel deckt sich mit Paddle Refund Policy §4.
- **Widerrufsbelehrung, übrige Teile:**
  - Fristbeginn „Tag des Vertragsschlusses“ (Dienstleistung) korrekt.
  - Adressat mit Telefon und E-Mail vorhanden.
  - Absendeprinzip enthalten.
  - Muster-Formular korrekt.
  - Gestaltungshinweis 6 (Wertersatz) entfällt mangels Entgelt zu Recht.
- **§ 312k:** Die Kündigungswege stehen richtig im Text, der Button ist als V9-Marker gesichert. § 356a ist über V10 und Platzhalter gesichert.
- **§ 327r:** Das Verbraucherverfahren in 9.2 entspricht Abs. 1–4 (abgerufen), mit Ausnahme von J-14.
- **§ 327j:** Keine Verkürzung der Verjährung gegenüber Verbrauchern. Die B2B-Verjährung von einem Jahr hat saubere Ausnahmen.
- **Haftung 14.1/14.2:** Die Kardinalpflicht-Definition ist BGH-konform; § 309 Nr. 7 ist gewahrt.
- **Übrige AGB-Klauseln:**
  - Freistellung (15) nur für Unternehmer und mit Verschulden.
  - Ordentliche Kündigung durch unslop (12.2) nur ohne laufendes Abo.
  - Mindestalter 18.
  - Textform (22.1) ist mit § 309 Nr. 13 vereinbar.
  - Rechtswahl mit Verbrauchervorbehalt (Rom I Art. 6 Abs. 2, Hinweis im Sinne von EuGH C-191/15).
  - Abwehrklausel und AI-Act-Hinweis 5.2 (Art. 50 Abs. 4) sind in Ordnung.
- **Änderungen gegenüber Verbrauchern (17.1):** nur mit ausdrücklicher Zustimmung. Das ist BGH-konform.
- **Datenschutz, übrige Punkte:**
  - Art. 13 Abs. 1 lit. a–e und Abs. 2 lit. a–e sind vollständig.
  - Eine Kopie der SCC ist auf Anfrage erhältlich.
  - Art. 21 ist in eigenem, hervorgehobenem Block (Abs. 4).
  - Art. 22 ist zutreffend verneint.
  - Kein Datenschutzbeauftragter (§ 38 BDSG) ist plausibel begründet.
  - Die HBDI-Anschrift ist aktuell (Wilhelmstraße 7, abgerufen).
  - Die Fristen nach § 257 HGB und § 147 AO (6/8/10 Jahre) sind richtig.
  - § 25 Abs. 2 Nr. 2 TDDDG für Session-, PKCE- und Sprach-Cookie ist vertretbar. Den Local-Storage-Eintrag `unslop.onboarding.path` als „unbedingt erforderlich“ einzustufen, ist grenzwertig, aber vertretbar, weil er eine aktive Nutzerwahl speichert.
  - Paddle als eigener Verantwortlicher ist richtig eingeordnet.
- **AVV, übrige Punkte:**
  - Art. 28 Abs. 3 lit. a (inkl. Drittland und Mitteilungspflicht), b, c, e und f sind abgebildet.
  - Der Hinweis bei rechtswidriger Weisung (Unterabs. 2) steht in § 3 Abs. 3.
  - Art. 28 Abs. 4 S. 2 (Haftung für Subs) steht in § 7 Abs. 6.
  - Die Meldefrist von 48 h ist zulässig.
  - Die Kostenregel für Audits („jede Partei trägt ihre Kosten“) ist nicht abschreckend (EDPB Rn. 145).
  - Die Einspruchsfrist von 14 Tagen bei 30 Tagen Vorlauf ist angemessen (Rn. 158).
  - Die Direktmitteilung bei AVV-Änderungen ist vorgesehen (Rn. 110, erster Teil).
- **DE/EN:** Alle Paare habe ich abschnittsweise verglichen. Inhaltlich abweichend ist nur J-21 („reasonable“); sonst sind die Fassungen gleich, einschließlich der Sprachvorrangklauseln.
