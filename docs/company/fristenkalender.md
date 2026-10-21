# Fristen- und Pflichtenkalender der unslop UG (haftungsbeschränkt)

Stand der Recherche: 2026-09-26. Zeitraum Oktober 2026 bis Dezember 2028 (die Fristen für das Geschäftsjahr 2027 liegen in 2028). Das ist eine Recherche, keine Steuer- oder Rechtsberatung. Der Tool-Stack dazu steht in `buchhaltung-software.md`.

**Kalenderdatei:** `fristen-unslop-ug.ics` (gleiche Termine, ganztägig, Erinnerung 7 und 1 Tag vorher) für den Google-Kalender „unslop“. Erzeugt aus `fristen-unslop-ug.json` mit dem Generator-Skript, siehe Abschnitt D.

## 0. Annahmen und Legende

- **T = Tag der Beurkundung.** Im Kalender ist als Platzhalter **T = 15.10.2026 (Do)** eingesetzt.
- **E = Tag der Eintragung ins Handelsregister.** Platzhalter **E = 05.11.2026 (Do)**. Amtsgericht Bad Hersfeld, tatsächliche Dauer unbekannt.
- **Alle Zeilen mit T- oder E-Bezug nach den echten Daten neu berechnen.** Die Formel steht in der Spalte „Hinweis“. Im Kalender sind sie als „T+…“/„E+…“ markiert.
- **Wochenende und Feiertage (§ 108 Abs. 3 AO):** Endet eine Steuerfrist an einem Samstag, Sonntag oder gesetzlichen Feiertag, gilt der nächste Werktag. In der Tabelle eingerechnet.
- **Hessische Feiertage** berücksichtigt: 2027: 01.01., 26.03., 29.03., 01.05., 06.05., 17.05., 27.05., 03.10., 25./26.12. — 2028: 01.01., 14.04., 17.04., 01.05., 25.05., 05.06., 15.06., 03.10., 25./26.12.
- **Varianten der USt-Voranmeldung (USt-VA):**
  - **[M26] monatlich 2026:** nur wenn das Finanzamt wegen einer voraussichtlichen Steuer 2026 über 9.000 € den Monat festlegt. Unwahrscheinlich.
  - **[Q26] quartalsweise 2026:** der wahrscheinliche Fall im Gründungsjahr.
  - **[M27] monatlich 2027:** Pflicht nach dem Gesetz, wie es heute gilt (siehe B.1). **Kalender ist auf [M27] gestellt.**
  - **[Q27] quartalsweise 2027:** nur falls der Gesetzgeber die Aussetzung der Neugründer-Monatspflicht noch verlängert.
  - **[Q28] quartalsweise 2028:** wenn die Steuer 2027 höchstens 9.000 € beträgt. Bei höchstens 2.000 € kann das Finanzamt ganz befreien.
  - **[M28] monatlich 2028:** wenn die Steuer 2027 über 9.000 € liegt.
  - **„+DFV“:** dieselbe Voranmeldung mit Dauerfristverlängerung, einen Monat später fällig.
- **Konsequenzen bei Versäumnis, abgekürzt:**
  - **VZ-Erm:** Verspätungszuschlag nach Ermessen (§ 152 Abs. 1 und 8 AO), höchstens 25.000 €.
  - **SZ:** Säumniszuschlag 1 % je angefangenem Monat auf den auf volle 50 € abgerundeten Rückstand (§ 240 Abs. 1 AO). Schonfrist 3 Tage nur bei Überweisung (§ 240 Abs. 3 AO).
  - **Zw/Sch:** Zwangsgeld (§§ 328 f. AO) und/oder Schätzung (§ 162 AO).
- **Tipp gegen Säumniszuschläge:** SEPA-Lastschriftmandat beim Finanzamt und bei der Stadt Bebra erteilen. Dann gilt die Zahlung als am Fälligkeitstag geleistet (§ 224 Abs. 2 Nr. 3 AO).

## A. Kalenderliste

| Datum | Pflicht | Wofür/Zeitraum | Rechtsgrundlage | Konsequenz bei Versäumnis | Hinweis |
|---|---|---|---|---|---|
| 2026-10-15 | Beurkundung mit Musterprotokoll, dadurch entsteht die Vor-UG („UG i.G.“) | Gründung | § 2 Abs. 1a GmbHG | – | **= T.** Das Musterprotokoll gilt zugleich als Gesellschafterliste. Der Notar reicht sie ein und meldet die Gründung dem Finanzamt. Ab T bis zur Eintragung haftet, wer im Namen der UG i.G. handelt, persönlich (§ 11 Abs. 2 GmbHG); dazu Vorbelastungs-/Unterbilanzhaftung. |
| 2026-10-15 | Geschäftskonto für „unslop UG (haftungsbeschränkt) i.G.“ eröffnen und 2.500 € **voll** einzahlen, Nachweis an den Notar | Kapitalaufbringung | § 5a Abs. 2, § 7 Abs. 2, § 8 Abs. 2 GmbHG | Ohne volle Einzahlung keine Registeranmeldung. Falsche Versicherung ist strafbar (§ 82 GmbHG). | T bis wenige Tage danach. Erst nach dem Nachweis meldet der Notar die UG zum Handelsregister an. |
| 2026-10-15 | Buchführung beginnen, GoBD-Verfahrensdokumentation anlegen | ab Aufnahme der Tätigkeit | §§ 238, 242 HGB; §§ 140, 145 ff. AO; GoBD | Schätzung bei formellen Mängeln (§ 162 AO) | Keine Tagesfrist. Verfahrensdokumentation vor der ersten Buchung. Ab jetzt E-Rechnungen empfangen können (E-Mail-Postfach reicht, B.4). |
| 2026-10-15 | Gewerbeanzeige bei der Stadt Bebra | Beginn der Tätigkeit | § 14 Abs. 1 GewO | Bußgeld bis 1.000 € (§ 146 Abs. 2 Nr. 2b, Abs. 3 GewO) | Fällig **gleichzeitig mit Beginn** der Tätigkeit. Informiert automatisch IHK, Finanzamt und Unfallversicherung. Vorher erfragen, ob die Stadt die Anzeige schon für die UG i.G. annimmt. |
| 2026-10-22 | Unternehmen bei der VBG anmelden | Unfallversicherung | § 192 Abs. 1 SGB VII | Ordnungswidrigkeit (§ 209 SGB VII) | **T+7 Tage.** Gilt als erfüllt, wenn die Gewerbeanzeige binnen einer Woche erstattet wurde. Als 100-%-Gesellschafter-Geschäftsführer **nicht pflichtversichert**, freiwillig möglich. Ohne Beschäftigte kein Lohnnachweis. |
| 2026-10-31 | Eröffnungsbilanz auf den Tag T aufstellen | Beginn des Handelsgewerbes | § 242 Abs. 1, § 243 Abs. 3 HGB | Buchführungsmangel | **Keine gesetzliche Tagesfrist**, Empfehlung. Buchung: Bank an Gezeichnetes Kapital. Als E-Bilanz übermitteln (bei eBilanz+ kostenlos). 10 Jahre aufbewahren. |
| 2026-11-10 | USt-VA **[M26]** Oktober 2026 | USt | § 18 Abs. 1 und 2 UStG | VZ-Erm, SZ, Zw/Sch | Nur bei Monatszahlern 2026. Ohne Steuernummer keine Übermittlung möglich; nachholen, sobald sie vorliegt. |
| 2026-11-16 | **Fragebogen zur steuerlichen Erfassung** über ELSTER (vorsichtige Lesart) | Steuerliche Erfassung, Antrag USt-IdNr., ggf. Antrag DFV | § 138 Abs. 1, 1b, 4 AO | Erinnerung, Zwangsgeld; Finanzamt schätzt Vorauszahlungen | **T+1 Monat** (15.11. ist Sonntag). Nur elektronisch, Formular „Gründung einer Kapitalgesellschaft“. Ob die Frist ab Beurkundung oder Eintragung läuft, ist strittig (B.5), deshalb ab T rechnen. **Regelbesteuerung wählen, USt-IdNr. mit beantragen.** |
| 2026-11-16 | GewSt-Vorauszahlung Q4/2026 | GewSt 2026 | § 19 Abs. 1 und 4 GewStG | SZ | **Nur wenn die Stadt Bebra sie festsetzt.** Unwahrscheinlich (unter 50 € keine Festsetzung). |
| 2026-11-19 | Eintrag im Transparenzregister (wirtschaftlich Berechtigter) | GwG | § 20 Abs. 1 GwG | Bußgeld nach § 56 GwG, laut BVA-FAQ bis 150.000 €. Nichtmeldung wird strenger geahndet als verspätete Meldung. | **„Unverzüglich“ nach E**, hier E+2 Wochen. Die UG i.G. muss nichts melden, wenn die Registeranmeldung binnen 3 Monaten nach T erfolgt. Die Gesellschafterliste reicht **nicht** mehr aus. |
| 2026-11-19 | Rundfunkbeitrag: Betriebsstätte anzeigen und Beitragsfreiheit geltend machen | Rundfunkbeitrag | § 5 Abs. 5 Nr. 3, § 8 RBStV | Nachforderung | Beitragsfrei, wenn die Betriebsstätte in einer beitragspflichtigen Wohnung liegt, für die schon gezahlt wird (Eltern). Ein Firmen-Kfz wäre beitragspflichtig. |
| 2026-12-07 | Fragebogen steuerliche Erfassung, **spätestens** nach der anderen Lesart | wie oben | § 138 Abs. 4 AO | wie oben | **E+1 Monat** (05.12. ist Samstag). Auffangdatum. |
| 2026-12-10 | USt-VA **[M26]** November 2026; **[M26+DFV]** Oktober 2026 | USt | § 18 UStG; § 46 UStDV | VZ-Erm, SZ | Nur bei Monatszahlern 2026. |
| 2026-12-10 | KSt-Vorauszahlung Q4/2026 + Soli | KSt 2026 | § 31 KStG i.V.m. § 37 EStG | SZ | **Nur wenn festgesetzt** (mind. 400 €/Jahr bzw. 100 € je Termin). Unwahrscheinlich. |
| 2026-12-31 | Stichtag Inventur und Schlussbilanz des Rumpfgeschäftsjahrs T–31.12.2026 | JA 2026 | §§ 240, 242 HGB | – | Überschuldungs-Check: Fortführungsprognose 12 Monate schriftlich festhalten (B.7). |
| 2027-01-01 | Aussetzung der Neugründer-Monatspflicht **läuft aus**: 2027 monatlich melden | USt 2027 | § 18 Abs. 2 S. 4 und 6 UStG | – | **Stand 26.09.2026: keine Verlängerung beschlossen**, auch nicht im JStG 2026 (Kabinett 12.08.2026). **Anfang Dezember 2026 Gesetzesstand prüfen** (B.1). |
| 2027-01-01 | E-Rechnungs-Ausstellungspflicht für Aussteller mit Vorjahresumsatz über 800.000 € | E-Rechnung | § 27 Abs. 38 UStG | – | Für die UG Übergang bis 31.12.2027. Paddle-Auszahlungen nicht betroffen (B.4). |
| 2027-01-11 | USt-VA **[Q26] Q4/2026**; **[M26]** Dez. 2026; **[M26+DFV]** Nov. 2026 | USt | § 18 UStG | VZ-Erm, SZ | 10.01. ist Sonntag. **[Q26] ist der wahrscheinlichste Fall.** Letzter Tag für den **DFV-Antrag als Quartalszahler** (ohne Sondervorauszahlung, § 48 Abs. 1 UStDV). |
| 2027-01-15 | Spätestens heute Handelsregister-Anmeldung, sonst muss auch die UG i.G. ins Transparenzregister | GwG | BVA-FAQ A.7 | wie Transparenzregister | **T+3 Monate.** In der Regel längst erledigt. |
| 2027-02-10 | USt-VA **[M27] Januar 2027**; **[Q26+DFV] Q4/2026**; **[M26+DFV]** Dez. 2026 | USt | § 18 UStG; §§ 46–48 UStDV | VZ-Erm, SZ | **Letzter Tag für DFV-Antrag und Sondervorauszahlung 2027** als Monatszahler: 1/11 der Vorauszahlungen 2026, auf ein Jahr hochgerechnet (§ 47 Abs. 2 UStDV). |
| 2027-02-15 | GewSt-Vorauszahlung Q1/2027 | GewSt 2027 | § 19 GewStG | SZ | Nur wenn festgesetzt. Bescheid und Zahlung: **Stadt Bebra**. |
| 2027-02-16 | VBG-Lohnnachweis 2026 | UV | § 99 SGB IV / § 165 SGB VII | – | **Entfällt ohne Beschäftigte.** |
| 2027-03-10 | USt-VA **[M27]** Feb.; **[M27+DFV]** Jan. | USt | § 18 UStG | VZ-Erm, SZ | |
| 2027-03-10 | KSt-Vorauszahlung Q1/2027 + Soli | KSt 2027 | § 37 EStG i.V.m. § 31 KStG | SZ | Nur wenn festgesetzt. |
| 2027-03-31 | Aufstellung JA 2026, Regelfrist 3 Monate | JA 2026 | § 264 Abs. 1 S. 3 HGB | – | Kleinst/klein: bis 30.06. zulässig. |
| 2027-04-12 | USt-VA **[M27]** März; **[M27+DFV]** Feb.; **[Q27]** Q1/2027 | USt | § 18 UStG | VZ-Erm, SZ | 10.04. ist Samstag. |
| 2027-05-10 | USt-VA **[M27]** April; **[M27+DFV]** März; **[Q27+DFV]** Q1/2027 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2027-05-18 | GewSt-Vorauszahlung Q2/2027 | GewSt | § 19 GewStG | SZ | 15.05. Samstag, 17.05. Pfingstmontag. |
| 2027-06-10 | USt-VA **[M27]** Mai; **[M27+DFV]** April | USt | § 18 UStG | VZ-Erm, SZ | |
| 2027-06-10 | KSt-Vorauszahlung Q2/2027 + Soli | KSt | § 37 EStG | SZ | Nur wenn festgesetzt. |
| 2027-06-30 | **JA 2026 spätestens aufstellen** (Bilanz, GuV; Kleinst: ohne Anhang, Angaben unter der Bilanz), unterschreiben und datieren | JA 2026 | § 264 Abs. 1 S. 4 und 5, § 245 HGB | Grundlage für E-Bilanz und Offenlegung fehlt | **25 % des Jahresüberschusses** (gemindert um Verlustvortrag) in die gesetzliche Rücklage (§ 5a Abs. 3 GmbHG). Bei Verlust 0. |
| 2027-07-12 | USt-VA **[M27]** Juni; **[M27+DFV]** Mai; **[Q27]** Q2/2027 | USt | § 18 UStG | VZ-Erm, SZ | 10.07. ist Samstag. |
| 2027-08-02 | **Jahreserklärungen 2026 ohne Steuerberater:** KSt-Erklärung (mit Feststellung des steuerlichen Einlagekontos KSt 1 F und des Verlustvortrags), **E-Bilanz 2026**, **GewSt-Erklärung 2026**, **USt-Jahreserklärung 2026** | VZ 2026 | § 149 Abs. 2 AO; § 31 Abs. 1a KStG; § 14a GewStG; § 18 Abs. 3 UStG; § 5b EStG | VZ-Erm; ab 01.03.2028 **automatisch**; Zw/Sch | 31.07.2027 ist Samstag. Keine Corona-Verlängerung mehr (galt nur VZ 2020–2024). Verlängerung auf Antrag nach § 109 AO möglich. E-Bilanz über eBilanz+, Erklärungen in Mein ELSTER. |
| 2027-08-10 | USt-VA **[M27]** Juli; **[M27+DFV]** Juni; **[Q27+DFV]** Q2/2027 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2027-08-16 | GewSt-Vorauszahlung Q3/2027 | GewSt | § 19 GewStG | SZ | 15.08. ist Sonntag. |
| 2027-09-10 | USt-VA **[M27]** Aug.; **[M27+DFV]** Juli | USt | § 18 UStG | VZ-Erm, SZ | |
| 2027-09-10 | KSt-Vorauszahlung Q3/2027 + Soli | KSt | § 37 EStG | SZ | Nur wenn festgesetzt. |
| 2027-10-11 | USt-VA **[M27]** Sep.; **[M27+DFV]** Aug.; **[Q27]** Q3/2027 | USt | § 18 UStG | VZ-Erm, SZ | 10.10. ist Sonntag. |
| 2027-11-10 | USt-VA **[M27]** Okt.; **[M27+DFV]** Sep.; **[Q27+DFV]** Q3/2027 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2027-11-15 | GewSt-Vorauszahlung Q4/2027 | GewSt | § 19 GewStG | SZ | |
| 2027-11-30 | **Gesellschafterbeschluss** Feststellung JA 2026 und Ergebnisverwendung, **Niederschrift unterschreiben** | JA 2026 | § 42a Abs. 2, § 48 Abs. 3 GmbHG | Kein festgestellter Abschluss für die Offenlegung | 11 Monate. Als Alleingesellschafter Niederschrift anfertigen; das ist zugleich die jährliche Gesellschafterversammlung. |
| 2027-12-10 | USt-VA **[M27]** Nov.; **[M27+DFV]** Okt. | USt | § 18 UStG | VZ-Erm, SZ | |
| 2027-12-10 | KSt-Vorauszahlung Q4/2027 + Soli | KSt | § 37 EStG | SZ | Nur wenn festgesetzt. |
| 2027-12-31 | **Hinterlegung JA 2026** beim Unternehmensregister (Kleinst: nur Bilanz, Kleinst-Status mitteilen) | JA 2026 | § 325 Abs. 1 und 1a, § 326 Abs. 2 HGB | **Ordnungsgeldverfahren des BfJ** (§ 335 HGB): Androhung mit 6-Wochen-Frist, Ordnungsgeld 2.500–25.000 €, bei Nachholung nach der Frist Herabsetzung auf 500 € (Kleinst). Verfahrenskosten ab Androhung. | 12 Monate nach Stichtag. XML aus eBilanz+ über publikations-plattform.de, Gebühr ca. 21,50 €. |
| 2027-12-31 | Ende der Übergangszeit für Papier-/PDF-Rechnungen bei inländischen B2B-Umsätzen | E-Rechnung | § 27 Abs. 38 Nr. 2 UStG | Formell fehlerhafte Rechnung | Nur relevant bei steuerbaren Leistungen an **inländische** Unternehmer. |
| 2027-12-31 | Stichtag Inventur und JA 2027 | JA 2027 | §§ 240, 242 HGB | – | Überschuldungs-Check erneuern. |
| 2028-01-01 | E-Rechnung für **alle** inländischen B2B-Umsätze Pflicht; **KSt-Satz sinkt auf 14 %** (VZ 2028) | – | § 27 Abs. 38 UStG; § 23 Abs. 1 KStG | – | KSt: 14 % (2028), 13 % (2029) … 10 % (ab 2032). |
| 2028-01-10 | USt-VA **[M27]** Dez. 2027; **[M27+DFV]** Nov.; **[Q27]** Q4/2027 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2028-02-10 | USt-VA **[M27+DFV]** Dez. 2027; **[Q27+DFV]** Q4/2027; **[M28]** Jan. 2028 | USt | § 18 UStG; § 48 Abs. 2 UStDV | VZ-Erm, SZ | **Sondervorauszahlung 2028** anmelden und bezahlen, wenn [M28] mit DFV gilt. Letzter Tag für DFV-Antrag 2028. Wahlrecht monatlich bei Vorsteuerüberschuss 2027 über 9.000 € (§ 18 Abs. 2a UStG): erste VA bis heute. |
| 2028-02-15 | GewSt-Vorauszahlung Q1/2028 | GewSt | § 19 GewStG | SZ | |
| 2028-02-16 | VBG-Lohnnachweis 2027 | UV | § 99 SGB IV | – | Entfällt ohne Beschäftigte. |
| 2028-03-01 | **Automatischer Verspätungszuschlag** für noch nicht abgegebene Jahreserklärungen 2026 | VZ 2026 | § 152 Abs. 2 Nr. 1, Abs. 5 und 6 AO | KSt/USt: 0,25 % der Nachzahlung je Monat, **mind. 25 €/Monat**; entfällt bei Steuer 0 oder Erstattung. **GewSt-Messbetragserklärung: pauschal 25 €/Monat, auch bei 0 €.** | 14 Monate nach dem 31.12.2026. Berechnet ab dem regulären Fristende 02.08.2027. |
| 2028-03-10 | USt-VA **[M28]** Feb.; **[M28+DFV]** Jan. | USt | § 18 UStG | VZ-Erm, SZ | |
| 2028-03-10 | KSt-Vorauszahlung Q1/2028 + Soli | KSt | § 37 EStG | SZ | Nur wenn festgesetzt. |
| 2028-03-31 | Aufstellung JA 2027, Regelfrist | JA 2027 | § 264 Abs. 1 S. 3 HGB | – | Spätestens 30.06.2028. |
| 2028-04-10 | USt-VA **[M28]** März; **[M28+DFV]** Feb.; **[Q28]** Q1/2028 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2028-05-10 | USt-VA **[M28]** April; **[M28+DFV]** März; **[Q28+DFV]** Q1/2028 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2028-05-15 | GewSt-Vorauszahlung Q2/2028 | GewSt | § 19 GewStG | SZ | |
| 2028-06-12 | USt-VA **[M28]** Mai; **[M28+DFV]** April | USt | § 18 UStG | VZ-Erm, SZ | 10.06. ist Samstag. |
| 2028-06-12 | KSt-Vorauszahlung Q2/2028 + Soli | KSt | § 37 EStG | SZ | 10.06. ist Samstag. Nur wenn festgesetzt. |
| 2028-06-30 | **JA 2027 spätestens aufstellen**, Rücklage 25 % bilden | JA 2027 | § 264 Abs. 1 HGB; § 5a Abs. 3 GmbHG | wie 2027 | |
| 2028-07-10 | USt-VA **[M28]** Juni; **[M28+DFV]** Mai; **[Q28]** Q2/2028 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2028-07-31 | **Jahreserklärungen 2027:** KSt (mit Feststellungen), E-Bilanz 2027, GewSt, USt-Jahreserklärung 2027 | VZ 2027 | § 149 Abs. 2 AO; § 5b EStG | VZ-Erm; automatisch ab 01.03.2029 | Montag, keine Verschiebung. |
| 2028-08-10 | USt-VA **[M28]** Juli; **[M28+DFV]** Juni; **[Q28+DFV]** Q2/2028 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2028-08-15 | GewSt-Vorauszahlung Q3/2028 | GewSt | § 19 GewStG | SZ | |
| 2028-09-11 | USt-VA **[M28]** Aug.; **[M28+DFV]** Juli | USt | § 18 UStG | VZ-Erm, SZ | 10.09. ist Sonntag. |
| 2028-09-11 | KSt-Vorauszahlung Q3/2028 + Soli | KSt | § 37 EStG | SZ | Nur wenn festgesetzt. |
| 2028-10-10 | USt-VA **[M28]** Sep.; **[M28+DFV]** Aug.; **[Q28]** Q3/2028 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2028-11-10 | USt-VA **[M28]** Okt.; **[M28+DFV]** Sep.; **[Q28+DFV]** Q3/2028 | USt | § 18 UStG | VZ-Erm, SZ | |
| 2028-11-15 | GewSt-Vorauszahlung Q4/2028 | GewSt | § 19 GewStG | SZ | |
| 2028-11-30 | Gesellschafterbeschluss Feststellung JA 2027 und Ergebnisverwendung, Niederschrift | JA 2027 | § 42a Abs. 2, § 48 Abs. 3 GmbHG | wie 2027 | |
| 2028-12-11 | USt-VA **[M28]** Nov.; **[M28+DFV]** Okt. | USt | § 18 UStG | VZ-Erm, SZ | 10.12. ist Sonntag. |
| 2028-12-11 | KSt-Vorauszahlung Q4/2028 + Soli | KSt | § 37 EStG | SZ | Nur wenn festgesetzt. |
| 2028-12-29 | **Hinterlegung JA 2027** (empfohlener letzter Termin) | JA 2027 | § 325 Abs. 1a, § 326 Abs. 2 HGB | § 335 HGB wie oben | Gesetzliches Fristende 31.12.2028 ist Sonntag; ob sich eine HGB-Frist verschiebt, ist nicht gesichert. Deshalb am Freitag davor. |
| 2029-01-10 | Ausblick: USt-VA **[M28]** Dez. 2028; **[Q28]** Q4/2028 | USt | § 18 UStG | VZ-Erm, SZ | Mit DFV: 12.02.2029. |

**Termine ohne festes Datum.** Als Erinnerung eintragen, sobald das Schreiben eingeht:

| Auslöser | Pflicht | Rechtsgrundlage | Konsequenz | Hinweis |
|---|---|---|---|---|
| Eingang eines Steuer-, Messbetrags- oder Vorauszahlungsbescheids | Prüfen; **Einspruchsfrist 1 Monat** ab Bekanntgabe. Abschlusszahlung KSt und GewSt 1 Monat nach Bekanntgabe. | § 355 AO; § 36 Abs. 4 EStG; § 20 Abs. 2 GewStG | Bestandskraft, SZ | Laut JStG-2026-Entwurf wird die elektronische Bekanntgabe ab 2027 Regelfall: **ELSTER-Postfach regelmäßig prüfen.** |
| Mitteilung der Steuernummer bzw. USt-IdNr. (BZSt) | Steuernummer in Voranmeldungen verwenden; **USt-IdNr. sofort an Paddle und alle Lieferanten** (Reverse-Charge-Nachweis) | § 14 Abs. 4 Nr. 2, § 27a UStG | Ohne USt-IdNr. berechnen US-/IE-Anbieter deutsche USt, die nicht abziehbar ist | Keine gesetzliche Bearbeitungsfrist. Die USt-IdNr. kommt erst **nach** der Steuernummer. Danach sofort ELSTER-Organisationszertifikat beantragen (Brief ~2 Wochen). |
| Androhung von Ordnungsgeld durch das BfJ | Innerhalb von **6 Wochen** offenlegen oder Einspruch | § 335 Abs. 3 HGB | Ordnungsgeld ab 2.500 € | Kosten der Androhung fallen auch bei Nachholung an. |
| IHK-Beitragsbescheid (IHK Kassel-Marburg) | Zahlen gemäß Bescheid | IHKG; Beitragsordnung | Vollstreckung | **Keine Beitragsbefreiung** für Kapitalgesellschaften, auch nicht als Gründer. Erstveranlagung niedrigster Grundbeitrag, vorläufig. |
| Gebührenbescheid Transparenzregister | Jahresgebühr zahlen | § 24 GwG; TrGebV | Vollstreckung | ca. 20 €/Jahr (19,80 oder 20,80 €, nicht geklärt). |
| Änderung bei wirtschaftlich Berechtigtem, Sitz, Firma, Rechtsform | Transparenzregister aktualisieren | § 20 Abs. 1 und 2 GwG | Bußgeld § 56 GwG | ZFG-Entwurf (geplant ab 01.01.2027): Geburtsort wird Pflichtangabe. Stand prüfen. |
| Neuer Arbeitnehmer bzw. Aushilfe | VBG-Änderung binnen 4 Wochen, Lohnnachweis ab dann jährlich zum 16.02. | § 192 Abs. 2 SGB VII | Beitragsschätzung | |
| Schreiben des Hessischen Statistischen Landesamts | Auskunft in der gesetzten Frist | § 15 BStatG | Bußgeld | Nur wenn gezogen. |
| Zahlungsunfähigkeit bzw. Überschuldung | Insolvenzantrag spätestens nach **3 Wochen** (Zahlungsunfähigkeit) bzw. **6 Wochen** (Überschuldung); bei drohender Zahlungsunfähigkeit sofort Gesellschafterversammlung | § 15a Abs. 1, § 19 InsO; § 5a Abs. 4 GmbHG | Strafbarkeit (§ 15a Abs. 4 InsO), persönliche Haftung | B.7 |

**Aufbewahrung (§ 147 AO), Fristbeginn jeweils zum Ende des Kalenderjahres:**

| Unterlagen | Frist | 2026er Unterlagen bis |
|---|---|---|
| Buchungsbelege (inkl. Paddle Reverse Invoices) | 8 Jahre | 31.12.2034 |
| Bücher, Eröffnungsbilanz 2026 | 10 Jahre | 31.12.2036 |
| JA 2026 (aufgestellt 2027) | 10 Jahre | 31.12.2037 |
| Geschäftsbriefe | 6 Jahre | – |

## B. Erläuterungen zu offenen und unsicheren Punkten

### B.1 Voranmeldungszeitraum 2026 und 2027 (der wichtigste unsichere Punkt)

- § 18 Abs. 2 S. 4 UStG: Wer seine Tätigkeit aufnimmt, meldet „im laufenden und folgenden Kalenderjahr“ monatlich. Satz 6 setzt das **nur für 2021 bis 2026** aus; in diesen Jahren zählt die voraussichtliche bzw. hochgerechnete Steuer. Schwellen seit 2025: über 9.000 € monatlich, höchstens 2.000 € Befreiung möglich.
- **2026:** Aussetzung gilt. Bei nicht steuerbaren Paddle-Auszahlungen und Reverse-Charge-Eingängen mit gleich hohem Vorsteuerabzug liegt die Zahllast nahe 0, also **quartalsweise [Q26]** oder Befreiung.
- **2027:** Nach geltendem Recht ist 2027 das „folgende Kalenderjahr“ und die Aussetzung beendet: **12 Monats-Voranmeldungen [M27]**, unabhängig von der Höhe. Stand 26.09.2026 keine beschlossene Verlängerung; weder Referentenentwurf (19./26.05.2026) noch Kabinettsbeschluss JStG 2026 (12.08.2026) enthalten eine Änderung von § 18 Abs. 2. Die Aussetzung wurde schon zweimal spät im Jahr in Sammelgesetzen verlängert. **Anfang Dezember 2026 erneut prüfen.** Bis dahin Kalender auf [M27].
- **2028:** Maßgeblich ist die Steuer 2027: über 9.000 € monatlich, sonst quartalsweise, höchstens 2.000 € Befreiung möglich. Bei Vorsteuerüberschuss 2027 über 9.000 € freiwillig monatlich (§ 18 Abs. 2a UStG, Frist 10.02.).
- **Dauerfristverlängerung (§§ 46–48 UStDV):** Antrag bis zum Fälligkeitstag der ersten betroffenen Voranmeldung über ELSTER. Quartalszahler ohne Sondervorauszahlung. Monatszahler zahlen 1/11 der Vorjahres-Vorauszahlungen (hochgerechnet), angerechnet auf die Dezember-Voranmeldung. Bei Zahllast nahe 0 fast kostenlos, bringt einen Monat Luft.
- **Zusammenfassende Meldung (§ 18a UStG):** Nur für innergemeinschaftliche Lieferungen und B2B-Leistungen an Empfänger in einem anderen EU-Staat. **Paddle (UK) ist Drittland: keine ZM.** Eingangsleistungen nach § 13b lösen nie eine ZM aus. Prüfpunkt: Vertragspartner laut Paddle-Vertrag wirklich die UK-Gesellschaft? Bei einer EU-Gesellschaft wäre eine ZM bis zum 25. nach Quartals-/Monatsende fällig.
- **In der Voranmeldung:** Paddle-Auszahlungen als nicht steuerbar (Leistungsort Ausland, § 3a Abs. 2 UStG, Kennzahl 45). US-/IE-Eingangsleistungen als § 13b-Steuerschuld (Kennzahlen 84/85 bzw. 46/47) mit Vorsteuer (67) im selben Zeitraum.

### B.2 Abgabefristen der Jahreserklärungen VZ 2026 und 2027

- § 149 Abs. 2 AO ohne Berater: 7 Monate nach Jahresende. VZ 2026: **02.08.2027** (31.07. ist Samstag). VZ 2027: **31.07.2028**.
- Art. 97 § 36 EGAO (Corona) galt nur für VZ 2020–2024. **Keine Sonderverlängerung für 2026/2027.** Mit Berater gälte der letzte Februartag des übernächsten Jahres; entfällt hier.
- Das Finanzamt kann vorzeitig anfordern (§ 149 Abs. 4 AO, mind. 4 Monate Frist).
- Verspätungszuschlag automatisch erst nach 14 Monaten (VZ 2026: ab 01.03.2028), berechnet ab Fristende. **Falle GewSt:** pauschal 25 €/Monat, auch bei Gewinn 0.
- E-Bilanz zusammen mit der KSt-Erklärung (§ 5b EStG). Seit Wirtschaftsjahren ab 2025 unverdichtete Kontennachweise; Anlagenspiegel Pflicht ab 2028; für Taxonomie 6.9 Nichtbeanstandung.
- **Steuersätze:** KSt 15 % + Soli 5,5 % der KSt (15,825 %), ab VZ 2028 KSt 14 %. GewSt: Messzahl 3,5 % × Hebesatz Bebra **360 %** = 12,6 % (Hebesatzsatzung vom 19.12.2024, ab 01.01.2025; Änderung nicht gefunden, bei der Stadt bestätigen). **Kein GewSt-Freibetrag** für Kapitalgesellschaften. Messbetrag: Finanzamt Bad Hersfeld, Bescheid: Stadt Bebra.
- Vorauszahlungen nur bei Festsetzung: KSt ab 400 €/Jahr bzw. 100 € je Termin, GewSt ab 50 € je Termin.

### B.3 Jahresabschluss, Feststellung und Offenlegung

- Aufstellung: Kleinst/klein höchstens 6 Monate (§ 264 Abs. 1 S. 4 HGB). Feststellung: 11 Monate (§ 42a Abs. 2 GmbHG). Offenlegung: 12 Monate (§ 325 Abs. 1a HGB); Kleinst hinterlegt nur die Bilanz und teilt den Kleinst-Status mit (§ 326 Abs. 2 HGB).
- Schwellen Kleinst seit 2024: 450.000 € Bilanzsumme, 900.000 € Umsatz, 10 Arbeitnehmer; 2 von 3 (§ 267a HGB).
- **Das Rumpfgeschäftsjahr 2026 ist ein eigenes Geschäftsjahr** mit allen drei Pflichten.
- Rücklage (§ 5a Abs. 3 GmbHG): 25 % des um einen Verlustvortrag geminderten Jahresüberschusses, bis das Stammkapital auf mindestens 25.000 € erhöht ist.

### B.4 E-Rechnung

- Empfangen: seit 01.01.2025 Pflicht, E-Mail-Postfach genügt.
- Ausstellen: 2025–2026 Papier/PDF erlaubt; 2027 weiter für Vorjahresumsatz bis 800.000 € (also für die UG); **ab 01.01.2028 Pflicht.**
- **Nur für inländische B2B-Umsätze** (BMF-FAQ). Paddle-Gutschriften (UK, nicht steuerbar) und Rechnungen von US-/IE-Lieferanten fallen nicht darunter. Relevant erst bei deutschen Firmenkunden oder deutschen Lieferanten; deren E-Rechnungen (XML) GoBD-konform im Originalformat archivieren.
- Einschränkung: Keine BMF-Aussage speziell zu Self-Billing-Gutschriften ausländischer Merchants of Record gefunden; Einordnung folgt aus „inländischer Leistungsempfänger“.

### B.5 Vor-UG und eingetragene UG

- **Ab Beurkundung (Vor-UG):** steuer- und buchführungspflichtig, sobald tätig; USt-Unternehmer; Handelndenhaftung (§ 11 Abs. 2 GmbHG) und Vorbelastungshaftung; Gewerbeanzeige und VBG bei Tätigkeitsbeginn; Transparenzregister nur, wenn Registeranmeldung nicht binnen 3 Monaten.
- **Ab Eintragung:** Haftungsbeschränkung; Transparenzregister „unverzüglich“; IHK-Mitgliedschaft; Offenlegungspflichten im engeren Sinn.
- **Fristbeginn Fragebogen (§ 138 Abs. 4 AO):** Gesetz knüpft an das meldepflichtige Ereignis an; Praxisquellen nennen teils die Eintragung. Deshalb T+1 Monat als sicherer Termin, E+1 Monat als Auffangdatum.
- **Eröffnungsbilanz:** „zu Beginn des Handelsgewerbes“, ohne Tagesfrist; Stichtag in der Praxis T.

### B.6 Sonstige Pflichten

- **VBG:** Beherrschender Gesellschafter-Geschäftsführer (ab 50 %) nicht pflichtversichert. Ohne Beschäftigte kein Lohnnachweis. Anmeldung nach § 192 SGB VII bleibt Pflicht.
- **Rundfunkbeitrag:** Beitragsfreiheit der Betriebsstätte in beitragspflichtiger Wohnung (§ 5 Abs. 5 Nr. 3 RBStV) nur, wenn für die Wohnung (Eltern) gezahlt wird.
- **IHK:** Mitgliedschaft kraft Gesetzes. Existenzgründer-Befreiung gilt nicht für Handelsregister-Firmen.
- **Transparenzregister-Gebühr:** 19,80 bis 20,80 €/Jahr, nicht abschließend verifiziert.

### B.7 Überschuldung und Insolvenzantragspflicht

- Mit 2.500 € Stammkapital ist eine **bilanzielle** Überschuldung schnell erreicht (Gründungskosten, Anlaufverluste).
- **Insolvenzrechtliche** Überschuldung nur, wenn zusätzlich die **Fortführungsprognose für 12 Monate** negativ ist (§ 19 Abs. 2 InsO). Empfehlung: Liquiditätsplanung 12 Monate **quartalsweise schriftlich** festhalten.
- Gegenmittel: (a) **Zuzahlung in die Kapitalrücklage** (§ 272 Abs. 2 Nr. 4 HGB), Eigenkapital, steuerlich Einlage; Erklärung zum steuerlichen Einlagekonto (§ 27 KStG, KSt 1 F) nicht vergessen. **Das ist der gewählte Weg**, siehe `buchhaltung-software.md` § 3.4. (b) Gesellschafterdarlehen mit qualifiziertem Rangrücktritt (§ 39 Abs. 2 InsO).
- Fristen: 3 Wochen bei Zahlungsunfähigkeit, 6 Wochen bei Überschuldung (§ 15a Abs. 1 InsO). Bei drohender Zahlungsunfähigkeit sofort Gesellschafterversammlung (§ 5a Abs. 4 GmbHG).

### B.8 Anstehende Gesetzesänderungen (noch nicht verabschiedet)

JStG 2026 (Kabinettsbeschluss 12.08.2026), Wirkung ab 01.01.2027: Zinsen auf 0,3 %/Monat (3,6 %/Jahr); elektronische Bekanntgabe von Bescheiden als Regelfall; USt-Organschaft nur auf Erklärung (nicht relevant). Keine Änderung von § 240 AO oder § 18 Abs. 2 UStG enthalten. **Nach Verkündung erneut prüfen.**

## C. Grenzen dieser Recherche

- Rechtslage nach dem 26.09.2026 nicht erfasst. Wichtig: Verlängerung der Neugründer-Aussetzung und verkündete Fassung des JStG 2026.
- Ungeklärt: Eintragungsdatum und Dauer bis zur Steuernummer; IHK-Beitragshöhe 2026; Höhe der Transparenzregister-Gebühr; Hebesatz über 2025 hinaus; Verschiebung der HGB-Frist am Sonntag 31.12.2028.

## D. Kalenderdatei pflegen

`fristen-unslop-ug.json` ist die Quelle, `fristen-unslop-ug.ics` das Erzeugnis. Nach Änderungen (echtes T/E, Entscheidung [M27]/[Q27], neue Bescheide):

```
node docs/company/build-fristen-ics.mjs docs/company/fristen-unslop-ug.json docs/company/fristen-unslop-ug.ics
```

Google Calendar: Einstellungen → Importieren und exportieren → Datei wählen → Zielkalender „unslop“. Ein erneuter Import derselben Datei aktualisiert bestehende Termine anhand der UID.

## E. Quellen

**Gesetzestexte (gesetze-im-internet.de):**
- § 18 UStG: https://www.gesetze-im-internet.de/ustg_1980/__18.html
- § 18a UStG: https://www.gesetze-im-internet.de/ustg_1980/__18a.html
- §§ 46, 47, 48 UStDV: https://www.gesetze-im-internet.de/ustdv_1980/__46.html · /__47.html · /__48.html
- § 108 AO: https://www.gesetze-im-internet.de/ao_1977/__108.html
- § 138 AO: https://www.gesetze-im-internet.de/ao_1977/__138.html
- § 147 AO: https://www.gesetze-im-internet.de/ao_1977/__147.html
- § 149 AO: https://www.gesetze-im-internet.de/ao_1977/__149.html
- § 152 AO: https://www.gesetze-im-internet.de/ao_1977/__152.html
- § 240 AO: https://www.gesetze-im-internet.de/ao_1977/__240.html
- § 37 EStG: https://www.gesetze-im-internet.de/estg/__37.html
- § 5b EStG: https://www.gesetze-im-internet.de/estg/__5b.html
- § 31 KStG: https://www.gesetze-im-internet.de/kstg_1977/__31.html
- § 23 KStG: https://www.gesetze-im-internet.de/kstg_1977/__23.html
- § 19 GewStG: https://www.gesetze-im-internet.de/gewstg/__19.html
- § 14 GewO: https://www.gesetze-im-internet.de/gewo/__14.html
- § 146 GewO: https://www.gesetze-im-internet.de/gewo/__146.html
- § 192 SGB VII: https://www.gesetze-im-internet.de/sgb_7/__192.html
- § 20 GwG: https://www.gesetze-im-internet.de/gwg_2017/__20.html
- § 242 HGB: https://www.gesetze-im-internet.de/hgb/__242.html
- § 264 HGB: https://www.gesetze-im-internet.de/hgb/__264.html
- § 267a HGB: https://www.gesetze-im-internet.de/hgb/__267a.html
- § 325 HGB: https://www.gesetze-im-internet.de/hgb/__325.html
- § 326 HGB: https://www.gesetze-im-internet.de/hgb/__326.html
- § 335 HGB: https://www.gesetze-im-internet.de/hgb/__335.html
- § 2 GmbHG: https://www.gesetze-im-internet.de/gmbhg/__2.html
- § 5a GmbHG: https://www.gesetze-im-internet.de/gmbhg/__5a.html
- § 42a GmbHG: https://www.gesetze-im-internet.de/gmbhg/__42a.html
- § 48 GmbHG: https://www.gesetze-im-internet.de/gmbhg/__48.html
- § 15a InsO: https://www.gesetze-im-internet.de/inso/__15a.html
- § 19 InsO: https://www.gesetze-im-internet.de/inso/__19.html

**Verwaltung, Kammern, Behörden:**
- BMF-FAQ E-Rechnung: https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html
- BMF, Referentenentwurf JStG 2026 (19.05.2026): https://www.bundesfinanzministerium.de/Content/DE/Gesetzestexte/Gesetze_Gesetzesvorhaben/Abteilungen/Abteilung_IV/21_Legislaturperiode/2026-05-19-JStG2026/1-Referentenentwurf.pdf
- BVA, Transparenzregister-FAQ (Stand 05.05.2023): https://www.bva.bund.de/SharedDocs/Downloads/DE/Aufgaben/VMII/Transparenzregister/Transparenzregister_FAQ.pdf
- ELSTER, Fragebogen „Gründung einer Kapitalgesellschaft“: https://www.elster.de/eportal/formulare-leistungen/alleformulare/fsekapg
- Finanzministerium Rheinland-Pfalz, Steuererklärungsfristen 2020–2025: https://fm.rlp.de/fileadmin/04/Themen/Steuerrecht/Fragen_und_Antworten/Anlage__Tabellarische_UEbersicht_Ablauf_der_Steuererklaerungsfristen.pdf
- Bayerisches Landesamt für Steuern, Fristen 2020–2025: https://www.finanzamt.bayern.de/Informationen/Aktuelles/Termine_und_Fristen/Verlaengerung-der-steuererklaerungsfristen-2020-bis-2024-Anlage.pdf
- Stadt Bebra, Hebesatzsatzung: https://www.bebra.de/rathaus-politik/veroeffentlichungen/amtliche-bekanntmachungen/hebesatzung-der-stadt-bebra/
- IHK Kassel-Marburg, FAQ IHK-Beitrag: https://www.ihk.de/kassel-marburg/ueber-uns/beitrag-und-mitgliedschaft/haeufig-gestellte-fragen-zum-ihk-beitrag-4103482
- IHK Düsseldorf, Aussetzung der Monatspflicht für Neugründer: https://www.ihk.de/duesseldorf/existenzgruendung/aktuelles/aussetzung-der-pflicht-zur-monatlichen-uebermittlung-voranmeldungen-in-neugruendungsfaellen-4996474
- VBG, Entgeltmeldung: https://www.vbg.de/cms/mitgliedschaft-und-versicherung/mitgliedschaft-und-beitrag/beitrag/entgeltmeldung
- VBG, Merkblatt GmbH-Gesellschafter-Geschäftsführer: https://cdn.vbg.de/media/83451349f2b64642bd48fe7c27afad8b/dld:attachment/Informationen_GmbH_Gesellschafter_Geschaeftsfuehrer.pdf

**Sekundärquellen (Gesetzgebungsstand, Einordnung):**
- Haufe, Kabinett beschließt JStG 2026: https://www.haufe.de/steuern/gesetzgebung-politik/bmf-referentenentwurf-fuer-ein-jahressteuergesetzes-2026_168_687492.html
- Der Betrieb, JStG 2026 Kabinettsbeschluss (12.08.2026): https://der-betrieb.de/meldungen/bundeskabinett-beschliesst-jahressteuergesetz-2026-ueberblick-ueber-die-wesentlichen-aenderungen/
- PwC, USt-Änderungen im JStG 2026 (30.06.2026): https://blogs.pwc.de/en/steuern-und-recht/article/255544/umsatzsteuerliche-aenderungen-im-entwurf-eines-jahressteuergesetzes-2026
- Haufe, USt-Voranmeldung 2026 bei Beginn der Tätigkeit: https://www.haufe.de/id/beitrag/umsatzsteuer-voranmeldung-2026-15-voranmeldung-bei-beginn-der-unternehmerischen-taetigkeit-HI16943563.html
- fastlancer, USt-VA 2026/2027: https://www.fastlancer.org/fastlancer-blog/umsatzsteuervoranmeldung-grenzen/
- KPMG, Investitionssofortprogramm verkündet (KSt-Senkung): https://kpmg.com/de/de/themen/2025/07/stinvsofortpg-bgbl.html
- Baker Tilly, BMF-Schreiben E-Rechnung vom 15.10.2025: https://www.bakertilly.de/beitrag/e-rechnung-zweites-bmf-schreiben-sorgt-fuer-mehr-klarheit
- BDO, erweiterte E-Bilanz-Pflichten: https://www.bdo.de/de-de/insights/public/erweiterungen-der-uebermittlungspflichten-der-e-bilanz
- Kerberos, ZFG-Referentenentwurf zum Transparenzregister: https://www.kerberos-compliance.com/wissen/blog/transparenzregister-koordinierte-aufsicht-erweiterter-datenaustausch-die-systemischen-gwg-aenderungen-des-zollfinanzgerechtigkeitsgesetz-referentenentwurf
- BVerwG 6 C 51.16 (Rundfunkbeitrag Betriebsstätte): https://www.bverwg.de/220118U6C51.16.0
