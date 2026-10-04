# Gründung unslop UG (haftungsbeschränkt)

Stand: 2026-09-16. Solo-Gründung, Musterprotokoll, Notar vor Ort in Bebra. Alle Entscheidungen sind getroffen, ab hier ist es Abarbeiten.

Nachtrag 2026-09-26: Beurkundung noch **2026** (Rumpfgeschäftsjahr Beurkundung–31.12.2026), kein Steuerberater, Buchhaltung, Jahresabschluss, E-Bilanz, Steuererklärungen und Hinterlegung selbst. Tool-Stack und Buchungs-Stolperfallen: `buchhaltung-software.md`. Alle Fristen Okt 2026–Dez 2028: `fristenkalender.md` plus `fristen-unslop-ug.ics` für den Google-Kalender „unslop“. Begründung in Abschnitt 6.

## 1. Die Daten für den Notar

| Feld | Wert |
|---|---|
| Firma | unslop UG (haftungsbeschränkt) |
| Sitz | Bebra |
| Inländische Geschäftsanschrift | Hegenstraße 8, 36179 Bebra (Elternhaus, siehe `nutzungsueberlassung.md`) |
| Unternehmensgegenstand | Entwicklung, Betrieb und Vertrieb von Software und KI-gestützten digitalen Produkten sowie damit zusammenhängende Dienstleistungen. **Bewusst ohne Webentwicklung/Design**, siehe Abschnitt 7 (GbR-Klausel). |
| Stammkapital | 2.500 € (ein Geschäftsanteil, Geldeinlage; „bar" im Musterprotokoll heißt nur „in Geld, keine Sacheinlage" – Überweisung vom Privatkonto aufs neue Geschäftskonto, Verwendungszweck „Stammeinlage unslop UG") |
| Gesellschafter | Luca Maximilian Zell, geb. 30.10.2003, wohnhaft Stahnsdorfer Straße 156a 112, 14482 Potsdam |
| Geschäftsführer | derselbe, einzelvertretungsberechtigt, von § 181 BGB befreit (ergibt sich aus dem Musterprotokoll) |
| Gründungskosten | die Gesellschaft trägt bis 300 € (Musterprotokoll-Standard) |

Zum Termin mitnehmen: Personalausweis. Sonst nichts.

Notare in Bebra: Wittich & Kaiser, Pfarrstraße 13, Tel. 06622 44170 (wittich-kaiser.de). Alternativ Poppe & Hofmann, Bismarckstraße 1, oder Armin Ballier, Nürnberger Straße 63.

Satz fürs Telefon: „Ich möchte eine Ein-Personen-UG mit Musterprotokoll gründen, Sitz Bebra, Stammkapital 2.500 Euro, ich bin alleiniger Gesellschafter und Geschäftsführer.“

## 2. Ablauf

- [x] Eltern: `nutzungsueberlassung.md` ausfüllen, zweifach unterschreiben (änderung nur mutter im grundbuch deswegen nur unterschrift von ihr)
- [ ] Sören und Laurenz informieren, `zustimmung-grz.md` von allen dreien unterschreiben lassen (siehe Abschnitt 7)
- [ ] Notar anrufen, Termin nehmen, Daten aus Abschnitt 1 durchgeben
- [ ] Beurkundungstermin (15 bis 30 Min., Notar liest vor, Unterschrift)
- [ ] Geschäftskonto auf „unslop UG (haftungsbeschränkt) i. G.“ eröffnen (Qonto oder Finom: online, Video-Ident mit Ausweis, keine eID nötig; Sparkasse geht auch, dauert länger)
- [ ] 2.500 € Stammkapital einzahlen, Einzahlungsbeleg an den Notar
- [ ] Notar reicht beim Amtsgericht Bad Hersfeld ein; Eintragung dauert 1 bis 3 Wochen
- [ ] Eintragungsnachricht abwarten. **Ab jetzt existiert die UG, vorher keine Verträge im Namen der UG schließen und keinen Umsatz über Paddle einnehmen.**

## 3. Innerhalb von vier Wochen nach Eintragung

- [ ] Fragebogen zur steuerlichen Erfassung über ELSTER (Finanzamt Bad Hersfeld). **Alle Antworten stehen feldweise in `fragebogen-steuerliche-erfassung.md`**, nur Platzhalter (IBAN, Daten, Steuer-ID, Schätzungen) ausfüllen. Kern: Verzicht auf Kleinunternehmer (sonst 19 % § 13b-Steuer ohne Vorsteuerabzug auf die gesamte Infrastruktur), USt-IdNr. beantragen, Sollversteuerung, SEPA-Mandat, Dauerfristverlängerung.
- [ ] Reihenfolge (entschieden 2026-09-26): Notar → Geschäftskonto i.G. → **erst dann** Kontolino-Konto (braucht die IBAN, Testphase nicht verschwenden) → Fragebogen → Bescheid abwarten → Organisationszertifikat, USt-IdNr. verteilen, Kalender auf den festgelegten Voranmeldungszeitraum stellen, Monatsroutine einrichten (Fragebogen-Doku Abschnitt C)
- [ ] **Vor der Beurkundung entscheiden: Quellcode-IP.** Lizenz-/Nutzungsvertrag Luca → UG (Code bleibt bei Luca, Fragebogen Tz. 3.1 leer) oder Übertragung auf die UG (verdeckte Einlage, Tz. 3.1 Zeile 105/106). Details in `fragebogen-steuerliche-erfassung.md` Tz. 3.
- [ ] Gewerbeanmeldung bei der Stadt Bebra (ca. 20 bis 40 €)
- [ ] Transparenzregister: wirtschaftlich Berechtigten eintragen (Pflicht, sonst Bußgeld). transparenzregister.de
- [ ] Berufsgenossenschaft VBG anmelden (Pflicht auch ohne Mitarbeiter, dann beitragsfrei)
- [ ] IHK Kassel-Marburg meldet sich von selbst, Grundbeitrag prüfen
- [ ] Personalausweis-PIN im Bürgerbüro Bebra neu setzen (für ELSTER, Bank, Transparenzregister; geht in jedem Bürgerbüro, kostenlos, sofort)
- [ ] Am Tag der Beurkundung: Kontolino-Testphase starten (2 Monate), Eröffnungsbilanz buchen, GoBD-Verfahrensdokumentation anlegen (Vorlage: Beschreibung Belegfluss Paddle/Lieferanten → Kontolino → Archiv)
- [ ] Sobald Steuernummer da: **ELSTER-Organisationszertifikat für die UG** beantragen (Brief ~2 Wochen; Kontolino und eBilanz+ brauchen es)
- [ ] Sobald USt-IdNr. da: bei Paddle, Anthropic, Google Cloud, Vercel, Supabase, GitHub, Proton hinterlegen (sonst berechnen sie deutsche USt, die nicht abziehbar ist)
- [ ] SEPA-Lastschriftmandat beim Finanzamt Bad Hersfeld und bei der Stadt Bebra (Zahlung gilt als pünktlich, § 224 Abs. 2 Nr. 3 AO)
- [ ] `fristen-unslop-ug.ics` in den Google-Kalender „unslop“ importieren; nach dem echten Beurkundungs- und Eintragungsdatum die T+x/E+x-Termine in `fristen-unslop-ug.json` korrigieren und neu erzeugen (Abschnitt D im Fristenkalender)
- [ ] Anfang Dezember 2026: Gesetzesstand § 18 Abs. 2 UStG prüfen (USt-VA 2027 monatlich oder quartalsweise), Kalender ggf. umstellen

## 4. Produkt und Infrastruktur auf die UG umstellen

- [ ] Paddle: Geschäftsadresse von Sontra auf Bebra ändern, Account-Inhaber auf die UG, USt-IdNr. hinterlegen
- [ ] Landing Page: Impressum (§ 5 DDG) mit Firma, Anschrift, Geschäftsführer, Registergericht + HRB-Nummer, USt-IdNr.; AVV-Vorlage für Kunden (ROADMAP: offen)
- [ ] Domain unslop.codes: Inhaber auf die UG
- [x] Proton, GitHub-Org, Google Cloud, Supabase, Vercel: Zugänge nur noch bei Luca (Passwörter, 2FA, Recovery, Accounts entzogen; Phase 1 & 2 erledigt am 2026-09-26); Excel mit geteilten Zugängen gelöscht; **offen:** nur noch Secrets-Rotation (Phase 3 & 4)
- [ ] Wortmarke „unslop“ beim DPMA anmelden, Klassen 9 und 42, ca. 290 €. Hinweis: „Unsloth“ (KI-Firma, eingetragene Marken) ist klanglich nah; Widerspruch möglich, aber Bedeutung und Zielgruppe sind unterscheidbar.
- [ ] Vorlage „Zuzahlung in die Kapitalrücklage“ (§ 272 Abs. 2 Nr. 4 HGB) anlegen: ein Satz pro Einzahlung, datiert, unterschrieben. Ersetzt seit 2026-09-26 das Gesellschafterdarlehen (Begründung Abschnitt 6). Jede Zuzahlung landet im steuerlichen Einlagekonto (KSt 1 F).

## 5. Kosten, realistisch

| Posten | Betrag |
|---|---|
| Notar (Beurkundung, Registeranmeldung, Auslagen, USt) | ca. 250 bis 350 € |
| Handelsregister-Eintragung | 150 € |
| Gewerbeanmeldung | ca. 20 bis 40 € |
| Gesamt Gründung | ca. 450 bis 550 € |
| Wortmarke DPMA (optional, empfohlen) | ca. 290 € |
| Laufend: Buchhaltung + Abschluss selbst (Kontolino Classic 228 €, eBilanz+ 35 €, Hinterlegung ca. 21,50 €, ELSTER 0 €) | ca. 285 €/Jahr netto; Rumpfjahr 2026 zusätzlich ca. 90 € |
| Rückfalloption Steuerberater oder Abschluss-Dienst (OnlineBilanz ab ca. 500 €) | 500 bis 1.500 €/Jahr, nur wenn nötig |
| Laufend: IHK-Grundbeitrag | ca. 50 bis 150 €/Jahr |

## 6. Entschieden und warum (damit es nicht wieder aufgemacht wird)

- **UG, nicht GmbH:** gleiche Haftungsbeschränkung, ein Zehntel des Kapitals. Umwandlung in GmbH (Kapitalerhöhung auf 25.000 €, ein Notartermin, ca. 800 bis 1.500 €), wenn ein Enterprise-Kunde oder Investor es verlangt oder die 25-%-Rücklage voll ist. Vorher nicht.
- **Keine Holding:** doppelte Kosten ab Tag eins, kein Nutzen ohne Gewinn oder Exit. Kann später per Anteilstausch (§ 21 UmwStG) steuerneutral drübergesetzt werden, dann läuft eine 7-Jahres-Sperrfrist.
- **Sitz Bebra, nicht Potsdam:** Gewerbesteuer-Hebesatz 360 % statt 470 % (Gesamtsteuer ca. 28,4 % statt 32,3 % vom Gewinn), echtes Büro im Elternhaus (Hegenstraße 8; die GbR sitzt laut Vertrag Im Baumgarten 28, ebenfalls Bebra), Wohnheim verbietet Gewerbe.
- **Name unslop, kein Dachname:** Kunden sehen die Marke, nicht die Rechtsform. Umfirmierung später kostet einen Notartermin. Ein Dachname kommt, wenn es ein zweites reales Produkt gibt.
- **2.500 € Stammkapital:** Notarkosten steigen bis 30.000 € nicht, das Geld bleibt für Ausgaben nutzbar, Rest als Gesellschafterdarlehen.
- **Freelancing (UI/UX, Websites) nicht über die UG, und vorerst auch nicht im Gegenstand:** Solange die GbR läuft, greift deren § 6 (siehe Abschnitt 7). Danach: als Einzelunternehmer, weil privat versteuert bei niedrigem Studenten-Steuersatz billiger ist als ~28 % in der UG plus 25 % bei Ausschüttung. In die UG erst, wenn das Geld im Unternehmen bleiben soll; dann Gegenstand per Notar erweitern (ca. 300 bis 500 €).
- **Mitgründer:** keiner. Einvernehmliche Klärung mit Aram am 2026-09-16, keine Anteile, nichts Schriftliches gewünscht.
- **Beurkundung 2026 statt Januar 2027 (entschieden 2026-09-26):** Das Rumpfjahr Okt–Dez 2026 kostet nur dann ~1.000 €, wenn ein Steuerberater den Abschluss macht. Selbst gemacht sind es 10 bis 20 Buchungen, die einfachste Übung für 2027, und unter 100 € Zusatzkosten. Dafür Impressum, Paddle-Cutover und Launch drei Monate früher. Wichtig: steuerlich beginnt die UG mit der Beurkundung, ein Dezember-Termin mit Januar-Eintragung hätte trotzdem ein Rumpfjahr 2026 erzeugt.
- **Kein Steuerberater:** Keine Pflicht. Kleinstkapitalgesellschaft (§ 267a HGB): verkürzte Bilanz, kein Anhang, Hinterlegung statt Veröffentlichung. Wenige Dutzend Buchungen im Jahr, eine Einnahmequelle (Paddle), Reverse Charge auf ausländische Lieferanten. Stack und Stolperfallen in `buchhaltung-software.md`. Rückfalloption: DATEV-Export aus Kontolino an einen Berater oder Abschluss-Dienst.
- **Kapitalrücklage statt Gesellschafterdarlehen:** Mit 2.500 € Stammkapital wäre die UG mit Darlehen schnell bilanziell überschuldet (Fortführungsprognose oder Rangrücktritt nötig). Zuzahlungen nach § 272 Abs. 2 Nr. 4 HGB sind Eigenkapital, steuerlich Einlage (§ 27 KStG), und über das Einlagekonto später steuerfrei rückzahlbar. Darlehen mit qualifiziertem Rangrücktritt bleibt Alternative, falls ein Rückzahlungsanspruch gewünscht ist.

## 7. GbR „GRZ Digital" (Websites, drei Gesellschafter zu je einem Drittel, seit 11.02.2025)

**Die Klausel:** § 6 Abs. 2 des GbR-Vertrags: Jeder Gesellschafter kann verlangen, dass „alle auf eigene Rechnung abgeschlossenen Geschäfte" als Geschäfte der GbR gelten und die Vergütung herausgegeben wird. Keine Einschränkung auf Websites; § 1 nennt als Zweck ein „digitales Dienstleistungsunternehmen". Vor Gericht würde das für ein SaaS-Produkt kaum halten (enge Auslegung, Berufsfreiheit), aber die Diskussion soll nie entstehen.

**Deshalb:**
- Gegenstand der UG ohne Webentwicklung und Design (Produkt, nicht Agentur).
- Keine Web- oder Design-Aufträge über die UG, solange die GbR besteht.
- `zustimmung-grz.md` von Sören und Laurenz unterschreiben lassen. § 13 verlangt Schriftform, also Papier, drei Unterschriften, je eine Kopie. Damit ist § 6 für die UG ausdrücklich abbedungen.

**Gespräch mit den beiden, kurz und ohne Verhandlung:**
> „Ich gründe eine UG für ein Software-Produkt, das ich seit Mai nebenbei baue, einen KI-Code-Reviewer für Entwickler. Hat mit Websites nichts zu tun, konkurriert nicht mit GRZ. Weil unser Vertrag in § 6 eine Klausel für Nebengeschäfte hat, will ich das sauber haben und brauche von euch eine Unterschrift, dass die UG davon ausgenommen ist. Für GRZ ändert sich dadurch nichts."

Nicht versprechen, dass das eigene Arbeitsvolumen für GRZ gleich bleibt, wenn der Ausstieg für 2027 schon feststeht. „Für GRZ ändert sich nichts" ist wahr, „ich mache genauso weiter" wäre in einem Jahr ein gebrochenes Wort. Das Ausstiegsgespräch ist ein eigenes Gespräch, später.

**Ausstieg, Fristen (§ 2, § 8):**
- Kündigung mit sechs Monaten Frist zum Kalenderjahresende, Textform.
- Für den 31.12.2026 war die Frist der 30.06.2026, also vorbei.
- Regulär: **Kündigung bis 30.06.2027, Ausscheiden zum 31.12.2027.**
- Früher nur einvernehmlich (Aufhebungsvereinbarung, alle drei unterschreiben).
- Auseinandersetzungsguthaben zum „wahren Wert" ohne Geschäftswert, in vier Quartalsraten ab drei Monate nach Ausscheiden. Wartungskunden bleiben bei der GbR.
- Bis zum Ausscheiden gilt § 6 weiter, deshalb die Zustimmung jetzt, nicht erst 2027.
