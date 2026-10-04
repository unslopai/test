# Buchhaltungs- und Abschluss-Stack der unslop UG (ohne Steuerberater)

Stand der Recherche: 2026-09-26. Entscheidung Luca vom selben Tag: Gründung noch 2026 (Rumpfjahr Okt–Dez 2026), Buchhaltung, Jahresabschluss, E-Bilanz, Steuererklärungen und Hinterlegung werden selbst gemacht. Der Fristenkalender dazu steht in `fristenkalender.md`.

Alle Preise sind netto und wurden am 26.09.2026 auf den Preisseiten geprüft. „Nicht verifiziert“ heißt: auf den Seiten nicht eindeutig belegbar, kein Negativbefund. Die Seiten von ebilanzplus.de (403), sage.com, monkey-office.de und buhl.de (403/404) ließen sich nicht direkt abrufen; deren Preise stammen aus Sekundärquellen.

## 1. Entscheidung: Stack

**Option A (gewählt): Kontolino Classic + eBilanz+ + Mein ELSTER + Hinterlegung per Webformular**

| Baustein | Kosten 2027 netto |
|---|---|
| Kontolino Classic: laufende Buchhaltung, USt-VA per ELSTER, Bilanz/GuV, Anlagenbuchhaltung, E-Bilanz-Export | 228 € (12 × 19 €) |
| eBilanz+: E-Bilanz 2027 übermitteln und XML für die Hinterlegung erzeugen | 35 € |
| Mein ELSTER: KSt 1 inkl. KSt 1 F, GewSt 1 A, USt 2 A | 0 € |
| Hinterlegung beim Unternehmensregister (JVKostG) | ca. 21,50 € |
| **Summe pro Jahr** | **ca. 285 € netto** |

Rumpfjahr 2026 zusätzlich: ca. 57 € Kontolino (3 Monate), 0 € Eröffnungsbilanz bei eBilanz+, 35 € E-Bilanz 2026.

Warum:
- Kontolino ist der günstigste Cloud-Tarif, der ausdrücklich eine Bilanz erzeugt **und** einen Exportweg in ein E-Bilanz-Tool hat. eBilanz+ importiert die ZIP-Datei direkt, inklusive Anlagenspiegel.
- eBilanz+ erzeugt kostenlos die Datei für die Hinterlegung. Die Bilanz wird nicht zweimal eingegeben.
- Kontolino Standard (14 €) würde für die Buchungen reichen, der E-Bilanz-Export ist aber erst in Classic enthalten. Mit Standard müsste die Summen- und Saldenliste von Hand als CSV übertragen werden: 60 €/Jahr gespart, fehleranfälliger.
- Über den DATEV-Buchungsstapel ist der Wechsel zu einem Steuerberater jederzeit möglich.

**In der Kontolino-Testphase (2 Monate, keine automatische Verlängerung) klären, bevor der Tarif gebucht wird:**
1. Funktioniert der finAPI-Abruf mit Qonto oder Finom? Sonst CSV/MT940-Import.
2. Welche Steuerschlüssel gibt es für § 13b Abs. 1 (EU) und Abs. 2 (Drittland)?
3. Gibt es ein Erlöskonto für „nicht steuerbar, Drittland“ (Paddle UK)?
4. Gibt es Fristen-Erinnerungen? (nicht verifiziert; deshalb eigener Kalender, siehe `fristenkalender.md`)

**Option B (billiger, rauer): Collmex basic + myebilanz oder eBilanz+ + Mein ELSTER**

| Baustein | Kosten 2027 netto |
|---|---|
| Collmex basic (Bankimport nur in basic) | 143 € |
| myebilanz BASIS / PLUS | 0 € / 34,95 € (oder eBilanz+ 35 €) |
| Hinterlegung | ca. 21,50 € |
| **Summe pro Jahr** | **ca. 165–200 € netto** |

Nachteil: Collmex und myebilanz sind für Anfänger deutlich sperriger. myebilanz ohne PLUS läuft über INI-Dateien (für einen Entwickler machbar). Das XML für die Hinterlegung gibt es bei myebilanz nur mit PLUS; ohne PLUS gibt man die ca. 15 Bilanzposten im Webformular ein.

**Sonderfall Rumpfjahr 2026:** Bei 10 bis 20 Buchungen ist jahresabschluss.io als Gegenprobe denkbar (erster Abschluss kostenlos, E-Bilanz 20 €, KSt und GewSt je 50 €). Junger Anbieter, nur zur Kontrolle, nicht als Hauptweg.

**Nicht empfohlen:** Lexware Office (laut Help Center keine Bilanz), Papierkram/FastBill/easybill/Zervant (nur EÜR oder Rechnungen), sevdesk (Bilanz nicht belegt), Steuernaut (selbst erklärte Grenze ~50 Buchungen/Jahr), buhl/WISO und orgaMAX (600 €+ pro Jahr), Lexware Buchhaltung Desktop (ab 293 €/Jahr, nur Windows, E-Bilanz-Direktversand nicht verifiziert).

**ELSTER-Zugang:** Früh ein **ELSTER-Organisationszertifikat für die UG** beantragen, sobald die Steuernummer da ist. Der Aktivierungsbrief kommt per Post und dauert etwa 2 Wochen. Kontolino, eBilanz+ und myebilanz brauchen dieses Zertifikat.

## 2. Vergleichstabellen

### 2a. Buchhaltungssoftware

| Tool / Tarif | Preis netto/Monat (Jahresabo) | Doppelte Buchführung SKR03/04 | Bilanz + GuV | E-Bilanz | USt-VA per ELSTER | § 13b buchbar | Bankanbindung Qonto/Finom | Belegerkennung (OCR) | Fristen-Erinnerung | GoBD | DATEV-Export | Für Anfänger | Lock-in / Export |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Kontolino Basis** | 11 € (400 Buchungen/Jahr) | ja; Kontenrahmen nicht verifiziert | Bilanz ja („Formatierte Bilanz“, alle Tarife) | nein | **nein** (ELSTER erst ab Standard) | nicht verifiziert (Standard-Steuerschlüssel sind üblich) | über finAPI (PSD2). Qonto/Finom nicht explizit bestätigt | Beleg-Foto-App; Auto-Erkennung nicht verifiziert | nicht verifiziert | GoBD-konforme Archivierung | ja (DATEV-Buchungsstapel inkl. Belege) | mittel: Kontierungslexikon, Handbuch, Videos | Archiv-Paket für 10 Jahre; Test 2 Monate ohne automatische Verlängerung |
| **Kontolino Standard** | 14 € (2.000 Buchungen) | ja | ja | nein | **ja** (mit PDF-Protokoll) | nicht verifiziert | finAPI, 2 Bankkonten | wie Basis | nicht verifiziert | wie Basis | ja | mittel | wie Basis |
| **Kontolino Classic** | **19 €** (5.000 Buchungen) | ja | ja; dazu Anlagenbuchhaltung | **Export als ZIP** (Bilanz, GuV, Anlagenspiegel) für eBilanz+ oder eBilanz-Online | ja | nicht verifiziert | finAPI, 5 Bankkonten | wie Basis | nicht verifiziert | wie Basis | ja | mittel | wie Basis |
| **sevdesk Buchhaltung / Buchhaltung Pro** | 9,95 € / 13,95 € | „einfache und doppelte Buchführung“ | GuV ja. **Bilanz auf der Preisseite nicht aufgeführt.** Sekundärquellen: kein vollständiger HGB-Abschluss | nicht auf der Preisseite. eBilanz+ hat eine Hilfeseite für sevdesk (Import der Summen- und Saldenliste) | ja | nicht verifiziert | nicht verifiziert | ja | nicht verifiziert | nicht verifiziert | ja (CSV/XML im DATEV-Format) | hoch | DATEV-Export |
| **Lexware Office L / XL** | 21,90 € / 32,90 € (Listenpreis; Aktion −50 % für 3 Monate) | Buchhaltung ja | **Bilanz nein.** Help Center: „Die Erstellung einer Bilanz ist mit Lexware Office leider nicht möglich“ | nein | ja (auch ZM) | nicht verifiziert | nicht verifiziert | ja | nicht verifiziert | nicht verifiziert | ja | sehr hoch | DATEV-Export |
| **BuchhaltungsButler** Light / Smart / Premium | 3,90 € / 9,95 € / 19,95 € | ja | Bilanz und GuV laut Preisseite; nach eigenem Wiki kein vollständiger Jahresabschluss | **nur über den Partner eBilanz+** (Summen- und Saldenliste), 10 % Rabattcode | ja | ja (eigenes Wiki zu Reverse Charge) | über 5.000 Banken; Qonto/Finom nicht einzeln verifiziert | ja (KI) | nicht verifiziert | nicht verifiziert | ja | hoch | DATEV-Export |
| **Collmex Buchhaltung** free / light / basic | 0 € / 8,95 € / 11,95 € | ja, SKR03/04 | **ab light:** Bilanz, GuV, „E-Bilanz“ | Export als CSV für eBilanz+. Direkte Übermittlung nicht verifiziert | ja (alle Editionen) | nicht verifiziert | **Bankimport erst in basic.** Qonto/Finom nicht verifiziert | nicht verifiziert | nicht verifiziert | nicht verifiziert | nicht verifiziert | niedrig bis mittel (sperrige Oberfläche) | 10 Jahre kostenloser Lesezugriff nach Kündigung |
| **Papierkram** S / M / L | 9,90 € / 19,90 € / 39,90 € | **nein** (EÜR-Tool) | nein | nein | UStVA nur als XML-Download | – | PSD2 | – | – | GoBD-Zertifikat | ja | – | **für eine UG ungeeignet** |
| **FastBill** Solo bis Premium | 9 € bis 53 € | laut Anbieter „keine volle doppelte Buchführung“ | nein | nein | ja | – | ja | ja | – | GoBD-Archiv | ja | – | **ungeeignet** |
| **easybill** | 0 € bis 37 € | nein (vorbereitende Buchhaltung) | nein | nein | nein | – | – | ja | – | – | ja | – | **ungeeignet** |
| **Zervant** | Light 24,95 € | nein (Rechnungen) | nein | nein | – | – | – | – | – | – | – | – | **ungeeignet** |
| **Lexware Buchhaltung** (Desktop, nur Windows) | Basis 24,40 € (292,80 €/Jahr), Plus 30,40 € | ja, „doppelte Buchführung mit Jahresabschluss“ | ja; Anlagenverwaltung erst in Premium (77,90 €) | nicht verifiziert | ja; USt-Jahreserklärung erst ab Plus | nicht verifiziert | nicht verifiziert | nicht verifiziert | nicht verifiziert | nicht verifiziert | ja | mittel | Desktop-Datenbank |
| **buhl Unternehmer Buchhaltung 365 Professional** (Nachfolger von WISO) | 724,80 €/Jahr | ja | ja | E-Bilanz über ELSTER laut Sekundärquellen; Produktseite bestätigt es nicht | ja | nicht verifiziert | nicht verifiziert | nicht verifiziert | nicht verifiziert | Dokumentenmanagement | ja | mittel | – |
| **WISO MeinBüro** | ab ca. 19 € (Sekundärquelle) | laut Sekundärquelle keine Bilanz | nein | nein | ja | – | – | – | – | – | ja | – | ungeeignet für den Abschluss |
| **MonKey Office** (Mac und Windows) | ab 12 €/Monat im Abo oder ab 199 € einmalig (Sekundärquelle) | ja | ja | **E-Bilanz über ELSTER** laut Herstellerseite | ja | nicht verifiziert | ja („Bankanbindung“) | nicht verifiziert | nicht verifiziert | nicht verifiziert | ja | mittel | – |
| **orgaMAX** | ab 49 € (ERP) | nicht verifiziert | nicht verifiziert | nicht verifiziert | – | – | – | – | – | – | – | – | überdimensioniert und teuer |
| **Sage Active** | ab 25 € (Sekundärquelle) | ja | teilweise | **nein**, Sage verweist auf eine Zusatzlösung | nicht verifiziert | – | – | – | – | – | – | – | – |

### 2b. E-Bilanz- und Abschluss-Tools

| Tool | Preis | Was es leistet | Eingabe | Bemerkung |
|---|---|---|---|---|
| **eBilanz+** (ebilanzplus.de) | **35 € je Übermittlung**. **Eröffnungsbilanz dauerhaft kostenlos.** Korrekturen kostenlos. Kein Abo. PRO-Abo vorhanden (Preis nicht verifiziert) | Erstellen, Prüfen und Übermitteln per ELSTER. **XML-Export für die Hinterlegung kostenlos** | Direktimport aus Kontolino, Collmex, sevdesk, BuchhaltungsButler, MonKey Office; Summen- und Saldenliste als CSV | Webanwendung. Automatische Zuordnung für SKR03/04 |
| **myebilanz** | **BASIS kostenlos**, PLUS 34,95 € pro Geschäftsjahr | Übermittlung mit eigenem ELSTER-Zertifikat. Anlagenspiegel, Eröffnungsbilanz und Testsendung in BASIS | CSV/Excel. Konfiguration per INI-Datei (grafische Oberfläche nur in PLUS) | Windows, per WINE auch Linux/Intel-Mac. **XML für die Hinterlegung nur mit PLUS.** Taxonomie 6.9 nicht eindeutig verifiziert |
| **eBilanz-Online** (Bundesanzeiger Verlag) | **39 € je Übermittlung** (1–24 Credits; „ab 10 €“ erst ab 150 Credits). Offenlegung ebenfalls 39 € | Übermittlung der E-Bilanz; Offenlegung/DiFin | u. a. Export aus Kontolino | Erstellen und Validieren kostenlos |
| **Steuernaut** | Credits zu 5 € (kein Abo). „UG-Geschäftsjahr“ 60 Credits = 300 € | E-Bilanz, KSt, GewSt, USt, Offenlegung | Qonto, Revolut, Wise direkt; sonst CAMT.053 oder CSV | **Nach eigener Aussage ungeeignet ab ca. 50 Buchungen/Jahr** → für 2027 raus, höchstens Rumpfjahr |
| **jahresabschluss.io** (MLR Ventures GmbH) | **Erster Jahresabschluss kostenlos**, danach 250 € (Kleinstgesellschaft). E-Bilanz 20 €, KSt- oder GewSt-Erklärung je 50 €, USt-VA 20 €. Abo mit Buchhaltung 95–125 €/Monat | Abschluss, E-Bilanz, Steuern; bereitet die Hinterlegung vor | Summen- und Saldenliste, DATEV | Junger Anbieter; keine Steuerberater-Haftung erkennbar |
| **OnlineBilanz** | ab 499,95 € Komplettpaket (Sekundärquelle) | Dienstleistung: Abschluss, E-Bilanz, Steuererklärungen, Offenlegung | DATEV-Export | **Kein Selbermachen**, Rückfalloption |
| **OpenBilanz** (openbilanz.de) | 0 € (MIT-Lizenz, Browser) | Eröffnungsbilanz und Abschluss; XBRL nach Taxonomie 6.9 im ELSTER-Container inkl. Kontennachweis | CAMT.053; Export DATEV-EXTF | Eigene Übermittlung nicht verifiziert. Experimentell |

### 2c. Behörden-Kanäle

| Kanal | Kosten | Was geht dort |
|---|---|---|
| **Mein ELSTER** | 0 € | **KSt 1** (mit Anlagen, auch KSt 1 F), **GewSt 1 A**, **USt 2 A**, USt-VA, Fragebogen zur steuerlichen Erfassung. **Die E-Bilanz geht dort NICHT**, nur über ERiC in einer Drittsoftware (Haufe, ELSTER-Anwenderforum) |
| **Hinterlegung** beim Unternehmensregister über publikations-plattform.de | JVKostG-Anlage: **Nr. 1420: 18,50 €** für die Rechnungslegung einer Kleinstkapitalgesellschaft, **Nr. 1410: Jahresgebühr 3,00 €** (Zuordnung beim ersten Auftrag gegenprüfen). Die Bundesanzeiger-Preisliste mit 24 € gilt nur für Geschäftsjahre vor 2022 | Webformular oder XML/XBRL, PDF, Word. Frist: 12 Monate nach Bilanzstichtag. Die Hinterlegung ist endgültig, kein späterer Wechsel zur Veröffentlichung |

## 3. Stolperfallen für genau dieses Setup

### 3.1 Paddle-Auszahlungen

- **Keine eigene Rechnung an Paddle stellen.** Paddle erzeugt zu jeder Auszahlung eine **Reverse Invoice** (Gutschriftsverfahren, § 14 Abs. 2 S. 2 UStG): „you do not have to invoice us“. Diese Gutschrift ist der Buchungsbeleg, 8 Jahre aufbewahren.
- **Umsatzsteuer:** B2B-Leistung an Paddle.com Market Ltd (UK). Leistungsort nach § 3a Abs. 2 UStG ist das Vereinigte Königreich, der Umsatz ist **in Deutschland nicht steuerbar**. Keine deutsche USt ausweisen. In der USt-VA in **Kennzahl 45** („nicht steuerbare Umsätze, Leistungsort nicht im Inland“; Kennzahl aus Fachwissen, im Formular prüfen). **Keine Zusammenfassende Meldung**, UK ist Drittland. Erlöskonto etwa SKR04 4338 / SKR03 8338 (im Kontenrahmen des Tools prüfen).
- **Vorsteuerabzug bleibt erhalten** (§ 15 Abs. 2 S. 1 Nr. 2 lit. a UStG). Folge: dauerhafte **Vorsteuerüberhänge**, also Erstattungen. Das Finanzamt prüft Neugründungen mit Erstattungen oft genauer.
- **Erlöshöhe:** Die Reverse Invoice lautet über den Auszahlungsbetrag. Erlös = Gutschriftsbetrag, Paddle-Gebühren sind kein separater Aufwand. Einmal festlegen und durchhalten.
- **Stichtag:** Zum 31.12. verdientes, noch nicht ausgezahltes Paddle-Guthaben als Forderung erfassen (Beleg: Balance-/Payout-Report).
- **Fremdwährung:** USD-Auszahlungen zum Kurs des Leistungszeitpunkts umrechnen; monatliche BMF-Umrechnungskurse sind zulässig (§ 16 Abs. 6 UStG).

### 3.2 Reverse Charge auf US-, IE- und CH-Lieferanten

- EU-Leistender (Google Cloud Irland): § 13b Abs. 1 UStG, **Kennzahlen 46/47**. Drittland (Anthropic, Vercel, GitHub, Supabase USA; Proton CH): § 13b Abs. 2 Nr. 1 UStG, **Kennzahlen 84/85**. Vorsteuer in beiden Fällen **Kennzahl 67**. Zahllast netto: 0.
- Buchung SKR04: Aufwand an Verbindlichkeit; zusätzlich 1407 (Vorsteuer § 13b) an 3837 (USt § 13b 19 %). Im Tool den passenden Steuerschlüssel wählen, **nicht** 19 % Vorsteuer auf die Rechnung buchen.
- **USt-IdNr. sofort bei allen Anbietern hinterlegen.** Ohne sie berechnen US-/IE-Anbieter deutsche USt wie an einen Verbraucher. Diese Steuer ist **nicht als Vorsteuer abziehbar** (§ 13b bleibt geschuldet, fremder Ausweis nach § 14c UStG). Rückholung nur beim Anbieter.
- **Domain:** § 13b nur bei ausländischem Registrar. Deutscher Registrar mit USt-Ausweis wird normal mit Vorsteuer gebucht.

### 3.3 Stammkapital und Eröffnungsbuchung

- Musterprotokoll: **nur Bareinlage, voll einzahlen vor der Anmeldung** (§ 5a Abs. 2 GmbHG).
- Eröffnungsbilanz auf den Tag der Beurkundung (§ 242 HGB). Buchung: Bank an Gezeichnetes Kapital (SKR04 2900 / SKR03 0800); falls noch offen: „Eingeforderte ausstehende Einlagen“ an Gezeichnetes Kapital.
- Die **Eröffnungsbilanz muss ebenfalls als E-Bilanz übermittelt werden** (§ 5b Abs. 1 EStG). Bei eBilanz+ kostenlos.
- **Gründungskosten laut Musterprotokoll:** Die UG trägt sie nur **bis 300 €**. Alles darüber (Notar, Handelsregister, Gewerbeanmeldung) trägt der Gesellschafter, sonst verdeckte Gewinnausschüttung.
- Ausgaben **vor** dem Notartermin fallen in die Vorgründungsgesellschaft, also privat, und lassen sich nicht in die UG übernehmen.

### 3.4 Gesellschafter-Einzahlungen (Entscheidung: Kapitalrücklage statt Darlehen)

- Geld ohne Rückzahlungsanspruch ist **Kapitalrücklage nach § 272 Abs. 2 Nr. 4 HGB** („andere Zuzahlungen“), SKR04 2920 ff. / SKR03 0840 (Kontonummer im Tool prüfen).
- Pro Einzahlung schriftlich festhalten: „Zuzahlung in die Kapitalrücklage ohne Gewährung von Vorzügen“. Sonst ist unklar, ob es ein Gesellschafterdarlehen ist.
- Steuerlich erhöht die Einzahlung das **steuerliche Einlagekonto (§ 27 KStG)**, jährlich mit der **KSt 1 F** gesondert festzustellen. Wer das vergisst, kann die Einlage später nicht steuerfrei zurückzahlen. Häufiger Selbstbucher-Fehler.
- Vorteil gegenüber Darlehen: kein Fremdkapital, keine bilanzielle Überschuldung, kein Rangrücktritt nötig.

### 3.5 Selbst erstellte Software nicht aktivieren

- Handelsrechtlich Wahlrecht (§ 248 Abs. 2 HGB), steuerlich **Aktivierungsverbot** (§ 5 Abs. 2 EStG). Nicht aktivieren hält Handels- und Steuerbilanz gleich, die E-Bilanz braucht keine Überleitungsrechnung. Kleinstgesellschaften bilden keine latenten Steuern (§ 274a HGB).
- Cloud- und API-Kosten sind laufender Aufwand.
- Gekaufte Hardware und Software: Nutzungsdauer 1 Jahr laut BMF, Sofortabschreibung, trotzdem ins Anlagenverzeichnis und den Anlagenspiegel der E-Bilanz.

### 3.6 Erleichterungen für Kleinstkapitalgesellschaften (§ 267a HGB)

- Schwellenwerte seit 17.04.2024: Bilanzsumme 450.000 €, Umsatz 900.000 €, 10 Arbeitnehmer; zwei der drei dürfen nicht überschritten werden. Bei Neugründung zählt der erste Stichtag (§ 267 Abs. 4 S. 2 HGB).
- Erleichterungen: verkürzte Bilanz (§ 266 Abs. 1 S. 4), verkürzte GuV (§ 275 Abs. 5), **kein Anhang** bei Angaben unter der Bilanz (§ 264 Abs. 1 S. 5), **Hinterlegung nur der Bilanz** statt Veröffentlichung (§ 326 Abs. 2), nicht öffentlich einsehbar.
- **Für die E-Bilanz gilt das nicht**, die Mussfelder der Taxonomie bleiben. Für das Rumpfjahr 2026 gilt **Taxonomie 6.9**. Kontennachweis: laut JStG 2024 Pflicht für Geschäftsjahre nach dem 31.12.2024, laut BMF-Schreiben vom 10.06.2025 wird das Fehlen bei 6.9 nicht beanstandet. Trotzdem mitsenden, eBilanz+ importiert die Konten.
- Gesetzliche Rücklage nach § 5a Abs. 3 GmbHG: 25 % des um einen Verlustvortrag geminderten Jahresüberschusses. Bei Anlaufverlusten 0.
- Die Bilanz muss vom Geschäftsführer **unterschrieben und datiert** werden (§ 245 HGB). Bei der Hinterlegung sind Feststellungsdatum und die Bestätigung der Schwellenwerte anzugeben.

## 4. Quellen

**Buchhaltungssoftware**
- Kontolino Preise: https://www.kontolino.de/preise/
- Kontolino Funktionsumfang: https://www.kontolino.de/online-buchhaltungssoftware/funktionsumfang/
- Kontolino E-Bilanz-Export für eBilanz+: https://www.kontolino.de/arbeitshilfen/h/handbuch/import-export/e-bilanz-export/abgabe-ihrer-e-bilanz-daten-mit-ebilanz/
- Kontolino ELSTER-Schnittstelle: https://www.kontolino.de/online-buchhaltungssoftware/elster-schnittstelle/
- Kontolino Bankanbindung (finAPI): https://www.kontolino.de/tipps-zur-online-bankverbindung-in-kontolino/
- Kontolino Jahresabschluss: https://www.kontolino.de/arbeitshilfen/wissenswertes/rund-um-den-jahresabschluss/
- sevdesk Preise: https://sevdesk.de/preise/
- sevdesk-Grenzen für GmbH: https://buchhaltung-test.com/ratgeber/sevdesk-gmbh-geeignet/
- Lexware Office Preise: https://www.lexware.de/preise/
- Lexware Office Help Center, „Bilanz und Lexware Office“: https://help.lexware.de/de-form/articles/548555-bilanz-und-lexware-office
- Lexware Buchhaltung (Desktop): https://shop.lexware.de/lexware-buchhaltung
- BuchhaltungsButler Preise: https://www.buchhaltungsbutler.de/preise/
- BuchhaltungsButler E-Bilanz: https://www.buchhaltungsbutler.de/wiki/ebilanz-uebermitteln/
- Collmex Preise: https://www.collmex.de/preise.html
- Collmex Buchhaltungssoftware: https://www.collmex.de/buchhaltung_software.html
- Papierkram Preise: https://www.papierkram.de/preise/
- FastBill Preise: https://www.fastbill.com/preise
- easybill Preise: https://www.easybill.de/preise
- orgaMAX Preise: https://www.orgamax.de/preise/
- buhl Unternehmer Buchhaltung 365 Professional: https://www.buhl-unternehmer.de/produkt/buhl-unternehmer-buchhaltung-365-professional/
- WISO MeinBüro (Test): https://www.fuer-gruender.de/wissen/unternehmen-fuehren/buchhaltung/buchhaltungsprogramm/buchhaltungssoftware-vergleich/wiso-meinbuero-test/
- MonKey Office: https://www.monkey-office.de/
- MonKey Office 2026 (Preise, Sekundärquelle): https://www.macgadget.de/News/2025/12/22/Kaufmaennische-Software-fuer-den-Mac-MonKey-Office-2026
- Sage (Einordnung, Sekundärquelle): https://www.fuer-gruender.de/wissen/unternehmen-fuehren/buchhaltung/buchhaltungsprogramm/buchhaltungssoftware-vergleich/

**E-Bilanz- und Abschluss-Tools**
- eBilanz+ Preise (Sekundärquelle, Mai 2026): https://www.taxandbytes.de/tools/e-bilanz/ebilanzplus/preise
- eBilanz+ Kostenseite: https://ebilanzplus.de/kosten
- eBilanz+ Export für Bundesanzeiger/Unternehmensregister: https://ebilanzplus.de/hilfe/bundesanzeiger-export
- myebilanz: https://www.myebilanz.de/
- myebilanz PLUS-Funktionen: https://www.myebilanz.de/075-plus-funktionen.php
- myebilanz Funktionsübersicht: https://www.myebilanz.de/050-funktionen.php
- myebilanz Forum zum Kontennachweis: https://www.myebilanz.de/forum/viewtopic.php?t=895
- eBilanz-Online Preismodell: https://www.ebilanzonline.de/preismodell/
- Steuernaut Preise: https://steuernaut.de/preise
- Steuernaut Fristen 2026: https://steuernaut.de/blog/steuerliche-fristen-gmbh-ug-2026
- jahresabschluss.io Preise: https://jahresabschluss.io/preise
- jahresabschluss.io Hinterlegung: https://jahresabschluss.io/jahresabschluss-ki/hinterlegung-mit-ki
- OnlineBilanz Preisvergleich E-Bilanz-Software: https://onlinebilanz.de/e-bilanz-software-guenstig/
- OpenBilanz: https://openbilanz.de/

**ELSTER und E-Bilanz-Recht**
- ELSTER-Forum, E-Bilanz nicht in Mein ELSTER: https://forum.elster.de/anwenderforum/forum/elster-webanwendungen/mein-elster/347512-erstellung-%C3%BCbermittlung-ebilanz-direkt-in-meinelster
- Haufe, Übermittlung der E-Bilanz: https://www.haufe.de/finance/jahresabschluss-bilanzierung/e-bilanz-wie-die-daten-uebermittelt-werden_188_127312.html
- ELSTER Formular KSt 1: https://www.elster.de/eportal/formulare-leistungen/alleformulare/kst
- ELSTER Formular GewSt 1 A: https://www.elster.de/eportal/formulare-leistungen/alleformulare/gewst
- ELSTER Formular USt: https://www.elster.de/eportal/formulare-leistungen/alleformulare/ust
- EY, Taxonomie und Kontennachweis: https://www.ey.com/de_de/technical/steuernachrichten/aktualisierte-taxonomien-und-erweiterte-bermittlungspflichten-bei-e-bilanz
- BMF-Schreiben Taxonomie 6.9: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-06-10-ebilanz-taxonomien-6-9.pdf?__blob=publicationFile&v=7

**Offenlegung und Hinterlegung**
- Publikations-Plattform FAQ Übermittlung: https://www.publikations-plattform.de/order/de/faq/uebermittlung
- Bundesanzeiger AGB Hinterlegung: https://www.bundesanzeiger.de/pub/D089.pdf
- Bundesanzeiger Preisliste Hinterlegung (nur Geschäftsjahre vor 2022): https://www.bundesanzeiger.de/pub/D089Preisliste.pdf
- Unternehmensregister Kosten: https://www.unternehmensregister.de/de/so-gehts/kosten
- JVKostG Kostenverzeichnis: https://www.gesetze-im-internet.de/jvkostg/anlage.html
- Haufe, Hinterlegung für Kleinstkapitalgesellschaften: https://www.haufe.de/finance/jahresabschluss-bilanzierung/microbilg-das-aendert-sich-fuer-kleinstkapitalgesellschaften/vorteil-3-hinterlegung-statt-offenlegung_188_157466.html

**Umsatzsteuer, Paddle, Reverse Charge, Schwellenwerte**
- Paddle, Rechnung für Auszahlungen: https://www.paddle.com/help/manage/get-paid/do-i-need-to-invoice-paddle-for-my-payout
- Paddle, USt auf Auszahlungen: https://www.paddle.com/help/manage/get-paid/should-i-charge-paddle-vattax-for-payouts
- Reverse Charge Buchungssätze SKR03/SKR04: https://onlinebilanz.de/reverse-charge-buchen-skr03-skr04-buchungssaetze/
- Haufe, USt-VA in Neugründungsfällen: https://www.haufe.de/steuern/finanzverwaltung/uebermittlung-von-umsatzsteuervoranmeldungen-in-neugruendungsfaellen_164_532954.html
- fastlancer, USt-VA-Grenzen 2026/2027: https://www.fastlancer.org/fastlancer-blog/umsatzsteuervoranmeldung-grenzen/
- IHK München, Anhebung der HGB-Schwellenwerte: https://www.ihk-muenchen.de/ratgeber/recht/gesellschaftsrecht/anhebung-schwellenwerte-hgb/
- Haufe, Größenklassen: https://www.haufe.de/finance/jahresabschluss-bilanzierung/groessenklassen-fuer-kapitelgesellschaften_188_605376.html
