# Review 4: adversariale juristische Prüfung, Runde 2 (docs/legal/)

Prüfer: Claude (kein Anwalt), Stand 2026-09-28. Geprüft: alle zehn überarbeiteten Entwürfe unter `C:\dev\unslop-legal\docs\legal\`, dazu Spec §3 (E22) und §8 sowie `review-2-recht.md` (J-01 bis J-30). Platzhalter und Marker (`[VORBEDINGUNG …]` usw.) zählen nicht als Befund. Ein Befund ist es aber, wenn ein Marker fehlt, obwohl eine Aussage von einer offenen Tatsache abhängt.

**Selbst abgerufene Primärquellen (alle am 2026-09-28):**
- § 312 Abs. 1, 1a BGB: https://www.gesetze-im-internet.de/bgb/__312.html
- § 312i Abs. 1, 2 BGB: https://www.gesetze-im-internet.de/bgb/__312i.html
- Art. 246c EGBGB: https://dejure.org/gesetze/EGBGB/246c.html. gesetze-im-internet.de lieferte 404, deshalb Sekundärspiegel.
- § 356 Abs. 3, 4 BGB: https://www.gesetze-im-internet.de/bgb/__356.html
- § 360 Abs. 1, 2 BGB: https://www.gesetze-im-internet.de/bgb/__360.html
- Paddle Buyer Terms, Stand 31.03.2026: https://www.paddle.com/legal/checkout-buyer-terms
- Paddle Refund Policy, Stand 31.03.2026: https://www.paddle.com/legal/refund-policy
- Repo-Code: `src/lib/telemetry/llm-call-log.ts:43-44` und `docs/specs/SPEC.md:481` (§12.4 G2)

**Nicht selbst abgerufen, als solche gekennzeichnet:** §§ 307, 547, 628 BGB, § 38 ZPO, Art. 25 Brüssel-Ia-VO.

---

## Stand der Umsetzung J-01 bis J-30

Alle 30 Befunde sind umgesetzt oder durch E22 gegenstandslos. Stichproben:

- **Wortgleich mit den Korrekturvorschlägen umgesetzt:** J-02 (Paddle Kanada in Impressum, Terms 1.3, Refund §1, Datenschutz §8 und §11), J-03 (Terms 19.2), J-05 (AVV § 7 Abs. 4), J-06, J-09, J-10, J-11, J-12, J-13, J-14 (9.1 und 9.3), J-17 (Datenschutz §2 und 6.5), J-18, J-19, J-20 (AVV § 16), J-21 (DE und EN jetzt gleich), J-22, J-23, J-24 (AVV § 14, Terms 12.4), J-25, J-26 (Refund §4), J-27, J-28, J-29.
- **Mit Marker umgesetzt:** J-15 (Terms 3.1: V12) und J-16 (Datenschutz §3 und §11: V1). J-30: Der Sendinblue-Zusatz ist gestrichen, dazu ein `[BESTÄTIGEN]`-Marker.
- **Durch E22 gegenstandslos:** J-01 und J-04, weil es keine eigene Widerrufsbelehrung mehr gibt. J-07 und J-08 sind in Terms 18.1 und Refund §3 umgesetzt.
- **DE/EN:** Alle Paare habe ich abschnittsweise verglichen. Inhaltliche Abweichungen habe ich keine gefunden.

Die Einarbeitung hat aber vier neue Probleme erzeugt oder sichtbar gemacht: J2-01 bis J2-04.

---

## Hohe Befunde

### J2-01 (hoch): Die E22-Lösung hängt an einer Tatsache, die der eigene Plan (SPEC §12.4 G2) und der Code gefährden, und an keiner Stelle steht ein Marker

**Fundstellen:**
- Terms 18.2 („Für den Nutzungsvertrag zahlen Sie an uns kein Entgelt …“) und 7.3 („nicht für andere eigene Zwecke“)
- Datenschutz §2 letzter Absatz („verwenden wir nicht für eigene Zwecke“)
- Refund §3 letzter Satz
- EN jeweils gleichlautend

**Quelle:** § 312 Abs. 1a BGB (abgerufen). Kapitel 1 und 2 (Informationspflichten nach Art. 246a EGBGB, Widerrufsrecht nach § 312g) gelten auch für Verträge, bei denen der Verbraucher personenbezogene Daten bereitstellt. Die Ausnahme greift nach Satz 2 nur, wenn der Unternehmer die Daten „ausschließlich verarbeitet, um seine Leistungspflicht oder an ihn gestellte rechtliche Anforderungen zu erfüllen, **und sie zu keinem anderen Zweck verarbeitet**“.

**Tatsachen:**
- `docs/specs/SPEC.md:481` (§12.4 Gate G2) plant weiterhin menschliche Labels an Refutationen „from live diffs“ (mindestens 10). Das ist eine Auswertung von Kundencode zur Produktverbesserung, also ein anderer Zweck.
- `src/lib/telemetry/llm-call-log.ts:44` speichert „Vollständige Verdicts … Audit-Grundlage für False Refutations“.
- E10 empfiehlt, das zu unterbinden. Das ist aber nur eine offene Empfehlung: Es gibt keine Vorbedingung in §4 und keinen Marker im Text, und SPEC §12.4 ist noch nicht geändert.

**Folgen, wenn die Ausnahme nicht greift:**
- Für den Nutzungsvertrag besteht ein gesetzliches Widerrufsrecht ohne Belehrung. Die Frist beginnt dann nicht, und das Widerrufsrecht erlischt erst zwölf Monate und 14 Tage nach Vertragsschluss (§ 356 Abs. 3 und 4 BGB, abgerufen).
- Über § 360 Abs. 1 und 2 BGB (abgerufen) ist der Verbraucher dann auch an den Paddle-Kauf nicht mehr gebunden. Der Paddle-Kauf ist ein „zusammenhängender Vertrag“: Die Leistung erbringt unslop auf Grundlage der Vereinbarung mit Paddle, und Paddles Buyer Terms sagen ausdrücklich: „the Product is made available to you by the Supplier under the terms of their Supplier Agreement“.
- Ergebnis: Ein Verbraucher könnte über ein Jahr lang die Rückabwicklung auch des Abos verlangen. Zusätzlich wären Terms 7.3 und Datenschutz §2 unwahr (§ 5 UWG, Art. 13 Abs. 1 lit. c DSGVO).

**Korrektur:**

1. **Marker** in Terms 7.3 und 18.2 sowie in Datenschutz §2, DE und EN gleich:
   „[VORBEDINGUNG E10: keine Auswertung von Kundendaten außerhalb des einzelnen Auftrags; SPEC §12.4 G2 auf eigene Repos/OSS/Opt-in umgestellt; Verdict-Audit auf Fehleranalyse des einzelnen Auftrags beschränkt]“
   Dazu in Spec §4 eine Zeile **V20** mit Stufe A.

2. **Terms 18.2, Satz einfügen:**
   - DE: „Personenbezogene Daten, die Sie uns bereitstellen, verarbeiten wir ausschließlich, um unsere Leistung zu erbringen und gesetzliche Anforderungen zu erfüllen, und zu keinem anderen Zweck.“
   - EN: „We process personal data you provide to us exclusively to perform our services and to meet legal requirements, and for no other purpose.“

3. **Wenn G2 an Live-Traffic bleiben soll:** E22 fällt weg. Nötig ist dann Variante (b): Belehrung nach Anlage 1 EGBGB mit eigener Online-Widerrufsfunktion (§ 356a BGB) und einer Regelung zu § 360 BGB gegenüber Paddle, **vor** Stufe B. Den Punkt anwaltlich bestätigen lassen (Spec-Kopfhinweis ergänzen: „Ziffer 18 samt E10-Abhängigkeit“).

---

## Mittlere Befunde

### J2-02 (mittel): Für den Nutzungsvertrag fehlen die Pflichtinformationen des elektronischen Geschäftsverkehrs (§ 312i BGB, Art. 246c EGBGB)

**Fundstelle:** Terms 3.1 und 20; DE und EN. Den Satz „Frühere Fassungen stellen wir auf Anfrage zur Verfügung“ gibt es, die Informationen selbst fehlen.

**Quelle:**
- § 312 Abs. 1 und 1a BGB (abgerufen) beschränken nur „Kapitel 1 und 2“. § 312i steht in Kapitel 3 und gilt deshalb auch für den unentgeltlichen Nutzungsvertrag, soweit er ein Vertrag über digitale Dienste ist, der über die Website zustande kommt.
- § 312i Abs. 1 S. 1 Nr. 2 und 4 BGB (abgerufen): Der Unternehmer muss die Informationen nach Art. 246c EGBGB „rechtzeitig vor Abgabe“ der Bestellung mitteilen und die AGB „bei Vertragsschluss abzurufen und in wiedergabefähiger Form zu speichern“ ermöglichen.
- Art. 246c EGBGB (dejure.org, abgerufen) verlangt fünf Angaben: die technischen Schritte zum Vertragsschluss, ob der Vertragstext gespeichert wird und zugänglich ist, wie Eingabefehler erkannt und berichtigt werden, die verfügbaren Sprachen und die Verhaltenskodizes.
- Gegenüber Verbrauchern ist das nicht abdingbar (§ 312i Abs. 2 S. 2).

**Problem:** E22 nimmt den Nutzungsvertrag aus dem Fernabsatzrecht heraus. Die Pflichten nach § 312i bleiben aber, und die Terms nennen sie nicht. Sie gehören auf den Anmeldeschritt (V12) oder in die Terms, auf die dieser Schritt verlinkt.

**Korrektur, neue Ziffer 3.4:**
- DE: „3.4 **Vertragsschluss technisch.** Sie klicken auf „Mit GitHub anmelden“, melden sich bei GitHub an und erteilen die angezeigten Berechtigungen; vorher zeigen wir Ihnen diese Bedingungen und bitten um Ihre Zustimmung. Bis zur Bestätigung bei GitHub können Sie den Vorgang jederzeit abbrechen; Eingaben machen Sie nur bei GitHub und können sie dort korrigieren. Wir speichern die Fassung dieser Bedingungen, der Sie zugestimmt haben, mit dem Zeitpunkt Ihrer Zustimmung; die aktuelle Fassung können Sie jederzeit unter unslop.codes/de/terms abrufen, drucken und speichern, frühere Fassungen senden wir Ihnen auf Anfrage. Vertragssprachen sind Deutsch und Englisch (Ziffer 20). Verhaltenskodizes haben wir uns nicht unterworfen.“
- EN: „3.4 **How the contract is concluded.** You click "Sign in with GitHub", sign in at GitHub and grant the permissions shown; before that we show you these terms and ask for your consent. You can cancel the process at any time until you confirm at GitHub; you only make entries at GitHub and can correct them there. We store the version of these terms you agreed to, together with the time of your consent; you can view, print and save the current version at any time at unslop.codes/en/terms, and we send you earlier versions on request. The contract languages are German and English (section 20). We have not subscribed to any codes of conduct.“

**Folgearbeit:** Die Zugangsbestätigung nach § 312i Abs. 1 S. 1 Nr. 3 in V12 aufnehmen, etwa als Willkommens-E-Mail oder Bestätigung im Dashboard.

### J2-03 (mittel): Die Beendigungsrechte wegen eigener Änderungen lassen das Paddle-Abo weiterlaufen, und die Erstattungsregel ist lückenhaft

**Fundstellen:**
- Terms 9.3 (neu, „Sie können den Vertrag dann … kündigen“), 17.1, 17.2 und 12.2 S. 2
- AVV § 7 Abs. 3 und 5 sowie § 16 Abs. 1 (neu: „beide Parteien können den Hauptvertrag dann … kündigen“)
- Refund §4: „keine anteilige Erstattung, es sei denn, Abschnitt 2, 3 oder 6 greift, Sie beenden den Vertrag nach Ziffer 9.2 … oder nach § 7 Abs. 3 unseres AVV …“
- EN jeweils gleichlautend

**Quelle:**
- Terms 12.1 S. 3 sagt selbst, dass die Beendigung des Nutzungsvertrags das Abo nicht kündigt.
- Paddle Buyer Terms (abgerufen): Das Abo ist nur „with effect from the end of your current billing period“ kündbar.
- § 307 Abs. 1 S. 2 und Abs. 2 Nr. 1 BGB (Transparenz, Leitbild der Rückgewähr vorausbezahlter Entgelte nach Vertragsende, §§ 547, 628 Abs. 1 S. 3 BGB; nicht abgerufen).

**Problem:**
- „Der Vertrag“ bzw. „der Hauptvertrag“ meint den Nutzungsvertrag. Kündigt ein Kunde nach 9.3, 17 oder AVV §§ 7, 16, endet nur der Zugang; das Abo bei Paddle läuft weiter und wird verlängert.
- Refund §4 zählt die Ausnahmen abschließend auf. Es fehlen 9.3, 17.1/17.2, AVV § 7 Abs. 5 und § 16 Abs. 1 sowie die Kündigung aus wichtigem Grund, den unslop zu vertreten hat.
- Für einen Unternehmer mit Jahresabo heißt das: Er muss eine Änderung durch unslop hinnehmen oder kündigen und zahlt dann weiter für einen Dienst, den er nicht nutzen kann.
- Der Vorbehalt in Refund §1 („schränkt keine Rechte ein“) rettet die Aussage rechtlich, macht die abschließende Liste aber intransparent.

**Korrektur, neue Terms-Ziffer 11.4:**
- DE: „11.4 Beenden Sie den Nutzungsvertrag nach Ziffer 9.2, 9.3 oder 17, nach § 7 Abs. 3 oder 5 oder § 16 Abs. 1 unseres Auftragsverarbeitungsvertrags oder aus einem wichtigen Grund, den wir zu vertreten haben, kündigen wir Ihr Abonnement bei Paddle zum selben Zeitpunkt und veranlassen über Paddle die anteilige Erstattung bereits bezahlter Zeiträume nach diesem Zeitpunkt.“
- EN: „11.4 If you end the usage contract under section 9.2, 9.3 or 17, under § 7(3) or (5) or § 16(1) of our data processing agreement, or for good cause for which we are responsible, we cancel your subscription with Paddle as of the same date and arrange, through Paddle, a pro-rata refund of periods already paid after that date.“

**Korrektur Refund §4, letzter Satz:**
- DE: „… es sei denn, Abschnitt 2, 3 oder 6 greift, Sie beenden den Vertrag nach Ziffer 11.4 unserer Nutzungsbedingungen, oder Paddle erstattet nach seinem Ermessen.“
- EN: „… unless section 2, 3 or 6 applies, you end the contract under section 11.4 of our Terms of Service, or Paddle grants a refund at its discretion.“

**Nachziehen:** Den zweiten Halbsatz in AVV § 7 Abs. 3 („anteilige Erstattung über Paddle“) durch „; es gilt Ziffer 11.4 der Nutzungsbedingungen“ ersetzen. EN: „; section 11.4 of the Terms of Service applies“.

### J2-04 (mittel): Wer den Nutzungsvertrag beendet oder sein Konto löschen lässt, zahlt das Abo weiter, ohne den Dienst nutzen zu können

**Fundstellen:**
- Terms 12.1 S. 3 („die Löschung des Kontos kündigt es nicht automatisch“)
- Terms 18.2 (neu: „jederzeit ohne Frist“)
- Terms 18.1 letzter Satz, Refund §3 letzter Satz
- EN gleich

**Quelle:**
- Paddle Buyer Terms (abgerufen): Das Produkt stellt der Supplier „under the terms of their Supplier Agreement“ bereit, und Paddle kann den Dienst beenden, wenn der Supplier den Zugang einstellt.
- § 307 Abs. 1 BGB und §§ 133, 157 BGB (nicht abgerufen). Wer die Löschung seines Kontos verlangt, will erkennbar nichts mehr zahlen.

**Problem:**
- Mit E22 ist „jederzeit beenden“ der zentrale Ausweg für Verbraucher. Er führt in eine Falle: Der Zugang endet sofort, und die Abbuchungen bei Paddle laufen bis zu einer gesonderten Kündigung weiter.
- Der Verbraucher zahlt dann für eine Leistung, die unslop auf seinen Wunsch nicht mehr erbringt.
- Der Hinweis in 12.1 ist zwar transparent, die Gestaltung aber voraussichtlich unangemessen. Sie widerspricht außerdem der Zusage in 11.2, bis zum Periodenende weiter nutzen zu können.

**Korrektur Terms 12.1, Satz 3 ersetzen:**
- DE: „Haben Sie ein laufendes Abonnement, kündigen wir es mit Ihrer Beendigungserklärung bei Paddle zum Ende der laufenden Abrechnungsperiode; der Nutzungsvertrag endet dann zu diesem Zeitpunkt, es sei denn, Sie verlangen die sofortige Löschung Ihres Kontos.“
- EN: „If you have a running subscription, we cancel it with Paddle as of the end of the current billing period upon your declaration; the usage contract then ends at that time unless you ask for your account to be deleted immediately.“

**Nachziehen:**
- Terms 18.2 ergänzen, DE: „(Ziffer 12.1; ein laufendes Abonnement kündigen wir dabei mit)“. EN: „(section 12.1; we cancel a running subscription at the same time)“.
- Voraussetzung ist die Paddle-Kündigung per API. V9 baut sie ohnehin.

---

## Niedrige Befunde (eindeutig falsch)

### J2-05 (niedrig): Terms 18.1 leitet das Widerrufsrecht aus Paddles Bedingungen statt aus dem Gesetz ab

**Fundstelle:** Terms 18.1: „Ihr Widerrufsrecht für den Kauf richtet sich nach den Käuferbedingungen von Paddle“. EN: „follows Paddle's buyer terms“.

**Quelle:** Paddle Refund Policy (abgerufen) spricht selbst von einem „14-day statutory right“. Refund §3 sagt richtig „gesetzliches Widerrufsrecht“. Terms 18.1 widerspricht damit der Refund Policy.

**Korrektur:**
- DE: „Ihr gesetzliches Widerrufsrecht für den Kauf besteht gegenüber Paddle; Einzelheiten zur Ausübung regeln die Käuferbedingungen von Paddle, und Sie üben es gegenüber Paddle aus, …“
- EN: „Your statutory right of withdrawal for the purchase exists towards Paddle; Paddle's buyer terms set out how to exercise it, and you exercise it towards Paddle, …“

### J2-06 (niedrig): AVV § 14 Abs. 3 verweist auf Löschfristen in Anlage 4, die dort nicht stehen

**Fundstelle:** AVV § 14 Abs. 3: „die Fristen stehen in Anlage 4“. EN: „the timelines are in Annex 4“. Die Anlage 4 hat keine Spalte und keine Angabe zu Löschfristen.

**Quelle:** Art. 28 Abs. 3 lit. g DSGVO; § 307 Abs. 1 S. 2 BGB (Transparenz).

**Korrektur:**
- DE: „(3) Unterauftragsverarbeiter löschen nach ihren Verträgen, die in Anlage 4 verlinkt sind; der Auftragsverarbeiter weist sie bei Vertragsende zur Löschung an, soweit ihre Verträge das vorsehen.“
- EN: „(3) Sub-processors delete under their contracts linked in Annex 4; at the end of the contract the Processor instructs them to delete where their contracts provide for this.“
- Alternativ in Anlage 4 eine Spalte „Löschung“ ergänzen.

---

## Geprüft ohne belastbaren Befund (knapp)

- **Terms 18 und E22 im Übrigen:**
  - Paddle ist nach den Buyer Terms Wiederverkäufer. Das Produkt stellt der Supplier „under the terms of their Supplier Agreement“ bereit. Das passt zu einem unentgeltlichen Nutzungsvertrag mit unslop.
  - Greift § 312 Abs. 1a S. 2 BGB, gibt es für den Nutzungsvertrag keine Pflicht nach Art. 246a EGBGB und kein Widerrufsrecht. Die Wirkung hängt allein an J2-01.
  - Ein Widerspruch zu Paddle besteht nicht: Refund §3 verweist für das Erlöschen auf Paddle, und die Aussage zur neuen Frist nach der Probezeit ist durch die Paddle Refund Policy gedeckt.
- **AVV:**
  - § 7 Abs. 4 (neu) entspricht Art. 28 Abs. 2 DSGVO. Weil Anlage 4 keine Ersatz-Unterauftragsverarbeiter nennt, bleibt praktisch nur die Aussetzung. Das ist ein Betriebsrisiko, kein Rechtsmangel.
  - § 12 (neu) entspricht EDPB 07/2020 Rn. 144.
  - § 16 (neu) entspricht Rn. 110. Einzige Lücke ist die Erstattung, siehe J2-03.
- **Haftung 14.3 (neu):** je Schadensfall, mit anwaltlich festzulegendem Betrag. Der Satz „die Parteien gehen davon aus“ heilt einen zu niedrigen Betrag nicht, schadet aber auch nicht.
- **Terms 9.1 und 9.3 (neu):** Der Auffanggrund ist jetzt begrenzt, und Unternehmer haben ein Lösungsrecht. Offen bleibt nur die Abo-Folge, siehe J2-03.
- **Refund §3, §4 und §8 (neu):** §3 und §8 sind stimmig. §4 siehe J2-03.
- **Gerichtsstand 19.2 (neu):**
  - Verbraucher sind ausgenommen.
  - Für ausländische Unternehmer, die nicht Kaufleute sind, verlangt § 38 Abs. 2 ZPO Schriftform (nicht abgerufen); für EU-Beklagte gilt vorrangig Art. 25 Brüssel Ia (nicht verifiziert).
  - Soweit das nicht erfüllt ist, gelten nach § 306 BGB die gesetzlichen Gerichtsstände. Den Satz halte ich nicht für belastbar angreifbar.
- **Impressum (§ 5 DDG):** vollständig, mit Platzhaltern.
- **Datenschutz (Art. 13):** vollständig bis auf die markierten Punkte. Dazu kommt der fehlende E10-Marker, siehe J2-01.
- **AVV (Art. 28 Abs. 3 lit. a bis h):** abgebildet.
- **Paddle-Pflichtsatz, Reseller-Hinweis, Refund-Link:** vorhanden.

Weitere belastbare Befunde der Stufen hoch oder mittel habe ich nicht gefunden.
