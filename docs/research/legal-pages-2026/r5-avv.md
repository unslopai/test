# Recherche 5: Auftragsverarbeitungsvertrag (AVV/DPA) nach Art. 28 DSGVO für unslop (B2B-SaaS), Stand 2026

**Erstellt:** 2026-09-28. Alle Quellen wurden am **2026-09-28** abgerufen, sofern nicht anders vermerkt.
**Rolle:** Datenschutz-Recherche anhand von Primärquellen, **keine Rechtsberatung**. Einschätzungen sind als solche gekennzeichnet. Was sich nicht belegen ließ, steht als **„nicht verifiziert“** im Text.

**Legende zur Quellenqualität**
- **[P]**: Primärquelle (Gesetz, Durchführungsbeschluss, EDPB, DSK, Landesbehörde, Gericht)
- **[V]**: Verbandsmuster, halb-primär (Bitkom)
- **[A]**: Anbieterdokument (Trust-Center, DPA, Doku). Primär für Aussagen des Anbieters über sich selbst
- **[S]**: Sekundärquelle (Kanzlei-Blog, Presse, Suchmaschinen-Zusammenfassung)
- **[Code]**: Abgleich mit dem unslop-Repository (`C:\dev\unslop`), Stand heute

**Abrufweg der EU-Texte:** EUR-Lex hat die direkten HTML-Aufrufe mit HTTP 202 (Bot-Schutz) abgewiesen. Den amtlichen Text habe ich stattdessen über das Publications Office (Cellar, Content-Negotiation) bezogen:
- DSGVO DE: `https://publications.europa.eu/resource/celex/32016R0679` → ABl. L 119 vom 4.5.2016
- DB 2021/915 DE: `https://publications.europa.eu/resource/celex/32021D0915` → ABl. L 199/18 vom 7.6.2021

Beide Texte sind textgleich mit dem Amtsblatt. Die EUR-Lex-Referenz lautet https://eur-lex.europa.eu/eli/reg/2016/679/oj bzw. https://eur-lex.europa.eu/eli/dec_impl/2021/915/oj.

---

## 0. Kurzfazit (TL;DR)

1. **Art. 28 Abs. 3 DSGVO verlangt einen festen Katalog von Pflichtinhalten** (lit. a–h sowie die Hinweispflicht bei rechtswidrigen Weisungen). Der Vertrag darf auch elektronisch geschlossen werden (Abs. 9). Ein Click-through-AVV in den AGB ist daher grundsätzlich möglich. Bedingung ist, dass der Abschluss beweiskräftig dokumentiert wird (BayLDA) und dass Änderungen dem Kunden direkt mitgeteilt werden. Eine bloße Veröffentlichung auf der Website reicht laut EDPB nicht (Rn. 110).
2. **EDPB Opinion 22/2024:** Der Kunde (Verantwortlicher) muss die Identität **aller** Unterauftragsverarbeiter der gesamten Kette jederzeit parat haben, also Name, Anschrift und Kontaktperson. Das gilt unabhängig vom Risiko. Der Auftragsverarbeiter (unslop) soll diese Angaben **proaktiv** liefern und aktuell halten. Kopien der Sub-Verträge muss unslop **auf Anfrage** herausgeben.
3. **Die EU-Standardvertragsklauseln (DB 2021/915) passen für unslop kaum 1:1.** Klausel 2 verbietet Änderungen. Klausel 7.7 e) verlangt eine **Drittbegünstigtenklausel mit jedem Unterauftragsverarbeiter**. Mit Google, Vercel und Supabase lässt sich das nicht aushandeln, alle drei arbeiten mit Standard-DPAs. **Empfehlung:** einen eigenen AVV schreiben, der Struktur und Formulierungen an 2021/915, Bitkom v1.3 und BayLDA/LfDI BW anlehnt. Die Anhangsstruktur I–IV der SCC sollte man übernehmen.
4. **Drei harte Befunde zur Subprozessor-Kette:**
   - Der **Vercel-DPA gilt ausdrücklich nur für Pro- und Enterprise-Kunden** [A]. Läuft unslop auf Vercel Hobby, fehlt der Art.-28-Abs.-4-Vertrag mit Vercel.
   - **Supabase-Vertragspartner ist laut DPA v1 (1.8.2026) die Supabase Pte. Ltd** (Singapur). Grundlage sind die SCC, eine DPF-Zertifizierung ist **nicht verifiziert**.
   - Der **Vertex-„global“-Endpoint (Rollback-Pfad) gibt ausdrücklich keine Datenresidenz-Garantie** [A]. Er ist als mögliche Verarbeitung außerhalb der EU offenzulegen.
5. **Die TOMs einer Solo-UG müssen ehrlich formuliert sein.** Die physische Sicherheit liegt bei den Cloud-Anbietern, deren Zertifikate sind belegt (Google: ISO 27001/27017/27018 und SOC 1–3 für „Generative AI on Vertex AI“; Vercel: SOC 2 Typ 2 und ISO 27001; Supabase: SOC 2 Typ 2 und ISO 27001). Eigene Maßnahmen gehören konkret beschrieben: MFA, Least Privilege, Webhook-Signaturprüfung, gehashte API-Keys, Region `fra1`. Die **fehlenden Supabase-Backups im Free-Plan** und die **fehlende Vertretung im Urlaubs- oder Krankheitsfall** sind offen zu benennen.

---

## 1. Gesetzliche Pflichten (DSGVO-Wortlaut) [P]

Quelle für alle Zitate dieses Kapitels: Verordnung (EU) 2016/679, ABl. L 119 vom 4.5.2016, amtlicher deutscher Text. Abgerufen über https://publications.europa.eu/resource/celex/32016R0679 (EUR-Lex-ELI: https://eur-lex.europa.eu/eli/reg/2016/679/oj).

### 1.1 Art. 28 Abs. 3: Mindestinhalt (Wortlaut)

> „(3) Die Verarbeitung durch einen Auftragsverarbeiter erfolgt auf der Grundlage eines Vertrags oder eines anderen Rechtsinstruments nach dem Unionsrecht oder dem Recht der Mitgliedstaaten, der bzw. das den Auftragsverarbeiter in Bezug auf den Verantwortlichen bindet und in dem Gegenstand und Dauer der Verarbeitung, Art und Zweck der Verarbeitung, die Art der personenbezogenen Daten, die Kategorien betroffener Personen und die Pflichten und Rechte des Verantwortlichen festgelegt sind. Dieser Vertrag bzw. dieses andere Rechtsinstrument sieht insbesondere vor, dass der Auftragsverarbeiter
> a) die personenbezogenen Daten nur auf dokumentierte Weisung des Verantwortlichen — auch in Bezug auf die Übermittlung personenbezogener Daten an ein Drittland oder eine internationale Organisation — verarbeitet, sofern er nicht durch das Recht der Union oder der Mitgliedstaaten, dem der Auftragsverarbeiter unterliegt, hierzu verpflichtet ist; in einem solchen Fall teilt der Auftragsverarbeiter dem Verantwortlichen diese rechtlichen Anforderungen vor der Verarbeitung mit, sofern das betreffende Recht eine solche Mitteilung nicht wegen eines wichtigen öffentlichen Interesses verbietet;
> b) gewährleistet, dass sich die zur Verarbeitung der personenbezogenen Daten befugten Personen zur Vertraulichkeit verpflichtet haben oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen;
> c) alle gemäß Artikel 32 erforderlichen Maßnahmen ergreift;
> d) die in den Absätzen 2 und 4 genannten Bedingungen für die Inanspruchnahme der Dienste eines weiteren Auftragsverarbeiters einhält;
> e) angesichts der Art der Verarbeitung den Verantwortlichen nach Möglichkeit mit geeigneten technischen und organisatorischen Maßnahmen dabei unterstützt, seiner Pflicht zur Beantwortung von Anträgen auf Wahrnehmung der in Kapitel III genannten Rechte der betroffenen Person nachzukommen;
> f) unter Berücksichtigung der Art der Verarbeitung und der ihm zur Verfügung stehenden Informationen den Verantwortlichen bei der Einhaltung der in den Artikeln 32 bis 36 genannten Pflichten unterstützt;
> g) nach Abschluss der Erbringung der Verarbeitungsleistungen alle personenbezogenen Daten nach Wahl des Verantwortlichen entweder löscht oder zurückgibt, sofern nicht nach dem Unionsrecht oder dem Recht der Mitgliedstaaten eine Verpflichtung zur Speicherung der personenbezogenen Daten besteht;
> h) dem Verantwortlichen alle erforderlichen Informationen zum Nachweis der Einhaltung der in diesem Artikel niedergelegten Pflichten zur Verfügung stellt und Überprüfungen — einschließlich Inspektionen –, die vom Verantwortlichen oder einem anderen von diesem beauftragten Prüfer durchgeführt werden, ermöglicht und dazu beiträgt.
> Mit Blick auf Unterabsatz 1 Buchstabe h informiert der Auftragsverarbeiter den Verantwortlichen unverzüglich, falls er der Auffassung ist, dass eine Weisung gegen diese Verordnung oder gegen andere Datenschutzbestimmungen der Union oder der Mitgliedstaaten verstößt.“

### 1.2 Art. 28 Abs. 2 und 4: Unterauftragsverarbeiter (Wortlaut)

> „(2) Der Auftragsverarbeiter nimmt keinen weiteren Auftragsverarbeiter ohne vorherige gesonderte oder allgemeine schriftliche Genehmigung des Verantwortlichen in Anspruch. Im Fall einer allgemeinen schriftlichen Genehmigung informiert der Auftragsverarbeiter den Verantwortlichen immer über jede beabsichtigte Änderung in Bezug auf die Hinzuziehung oder die Ersetzung anderer Auftragsverarbeiter, wodurch der Verantwortliche die Möglichkeit erhält, gegen derartige Änderungen Einspruch zu erheben.“

> „(4) Nimmt der Auftragsverarbeiter die Dienste eines weiteren Auftragsverarbeiters in Anspruch, um bestimmte Verarbeitungstätigkeiten im Namen des Verantwortlichen auszuführen, so werden diesem weiteren Auftragsverarbeiter im Wege eines Vertrags oder eines anderen Rechtsinstruments nach dem Unionsrecht oder dem Recht des betreffenden Mitgliedstaats dieselben Datenschutzpflichten auferlegt, die in dem Vertrag oder anderen Rechtsinstrument zwischen dem Verantwortlichen und dem Auftragsverarbeiter gemäß Absatz 3 festgelegt sind, wobei insbesondere hinreichende Garantien dafür geboten werden muss, dass die geeigneten technischen und organisatorischen Maßnahmen so durchgeführt werden, dass die Verarbeitung entsprechend den Anforderungen dieser Verordnung erfolgt. Kommt der weitere Auftragsverarbeiter seinen Datenschutzpflichten nicht nach, so haftet der erste Auftragsverarbeiter gegenüber dem Verantwortlichen für die Einhaltung der Pflichten jenes anderen Auftragsverarbeiters.“

**Relevante Folge für unslop:** unslop haftet gegenüber dem Kunden für Google, Vercel und Supabase (Satz 2).

### 1.3 Art. 28 Abs. 6, 9 und 10 (Wortlaut)

> „(6) Unbeschadet eines individuellen Vertrags zwischen dem Verantwortlichen und dem Auftragsverarbeiter kann der Vertrag oder das andere Rechtsinstrument im Sinne der Absätze 3 und 4 des vorliegenden Artikels ganz oder teilweise auf den in den Absätzen 7 und 8 des vorliegenden Artikels genannten Standardvertragsklauseln beruhen […]“

> „(9) Der Vertrag oder das andere Rechtsinstrument im Sinne der Absätze 3 und 4 ist schriftlich abzufassen, was auch in einem elektronischen Format erfolgen kann.“

> „(10) Unbeschadet der Artikel 82, 83 und 84 gilt ein Auftragsverarbeiter, der unter Verstoß gegen diese Verordnung die Zwecke und Mittel der Verarbeitung bestimmt, in Bezug auf diese Verarbeitung als Verantwortlicher.“

**Relevant für unslop:** Nutzt unslop Kundencode für eigene Zwecke, etwa für Benchmarks, Modell- oder Prompt-Verbesserung oder Telemetrie über den Auftrag hinaus, wird unslop insoweit selbst Verantwortlicher. Das muss der AVV ausschließen oder ausdrücklich regeln (siehe offene Fragen).

### 1.4 Art. 32: Sicherheit der Verarbeitung (Abs. 1 Wortlaut)

> „(1) Unter Berücksichtigung des Stands der Technik, der Implementierungskosten und der Art, des Umfangs, der Umstände und der Zwecke der Verarbeitung sowie der unterschiedlichen Eintrittswahrscheinlichkeit und Schwere des Risikos für die Rechte und Freiheiten natürlicher Personen treffen der Verantwortliche und der Auftragsverarbeiter geeignete technische und organisatorische Maßnahmen, um ein dem Risiko angemessenes Schutzniveau zu gewährleisten; diese Maßnahmen schließen unter anderem Folgendes ein:
> a) die Pseudonymisierung und Verschlüsselung personenbezogener Daten;
> b) die Fähigkeit, die Vertraulichkeit, Integrität, Verfügbarkeit und Belastbarkeit der Systeme und Dienste im Zusammenhang mit der Verarbeitung auf Dauer sicherzustellen;
> c) die Fähigkeit, die Verfügbarkeit der personenbezogenen Daten und den Zugang zu ihnen bei einem physischen oder technischen Zwischenfall rasch wiederherzustellen;
> d) ein Verfahren zur regelmäßigen Überprüfung, Bewertung und Evaluierung der Wirksamkeit der technischen und organisatorischen Maßnahmen zur Gewährleistung der Sicherheit der Verarbeitung.“

Ergänzend Abs. 3 (Zertifizierung als „Faktor“ für den Nachweis) und Abs. 4 (unterstellte Personen verarbeiten nur auf Anweisung).

### 1.5 Art. 33 Abs. 2: Meldung an den Verantwortlichen (Wortlaut)

> „(2) Wenn dem Auftragsverarbeiter eine Verletzung des Schutzes personenbezogener Daten bekannt wird, meldet er diese dem Verantwortlichen unverzüglich.“

Für den Auftragsverarbeiter gibt es **keine gesetzliche Stundenfrist**. Die 72 Stunden in Art. 33 Abs. 1 gelten nur für den Verantwortlichen gegenüber der Behörde.
- Die Bitkom-Hinweise v1.2 (11/2025) [V] halten fest, dass die 72-Stunden-Frist den Auftragnehmer nicht trifft. Sie berichten: „Es hat sich bewährt, dem Auftragnehmer vertraglich eine Frist zu setzen, zumeist binnen 24 Stunden.“ Quelle: https://www.bitkom.org/sites/main/files/2025-12/bitkom-leitfaden-auftragsverarbeitung.pdf (S. 16 f.)
- Die EDPB Guidelines 07/2020, Rn. 136, empfehlen je nach Verarbeitung eine vertragliche Frist, z. B. „number of hours“, samt Kontaktstelle, Modalität und Mindestinhalt (siehe 2.1).

**Ausblick, nicht geltendes Recht:** Der Kommissionsvorschlag „Digital Omnibus“ COM(2025) 837 final vom 19.11.2025 würde Art. 33 Abs. 1 ändern [P, Vorschlag]:
- Meldung an die Behörde nur noch bei voraussichtlich *hohem* Risiko
- Frist „not later than 96 hours“
- Meldung über einen Single-Entry-Point

Quelle: https://publications.europa.eu/resource/cellar/ebf17714-c56e-11f0-8da2-01aa75ed71a1.0001.02/DOC_1 (Art. 3 Nr. 8 des Vorschlags).
- In der Liste der DSGVO-Änderungen des Vorschlags (Art. 4, 5, 9, 12, 13, 22, 33, 35, 57, neue Art. 88a–c) tauchen **Art. 28, 30 und 32 nicht auf**. Art. 33 Abs. 2, also die Meldung des Auftragsverarbeiters an den Verantwortlichen, bleibt nach dem Vorschlag unverändert.
- **Gesetzgebungsstand:** noch nicht verabschiedet, EP-Ausschussphase, keine Trilog-Einigung. Das ist nur **[S]** belegt (z. B. https://www.brightdefense.com/news/eu-digital-omnibus-seeks-96-hour-gdpr-breach-deadline/). Den Stand in der OEIL-Datenbank des EP habe ich **nicht verifiziert**.

### 1.6 Art. 30 Abs. 2 und 5: Verzeichnis des Auftragsverarbeiters (Wortlaut)

> „(2) Jeder Auftragsverarbeiter und gegebenenfalls sein Vertreter führen ein Verzeichnis zu allen Kategorien von im Auftrag eines Verantwortlichen durchgeführten Tätigkeiten der Verarbeitung, die Folgendes enthält:
> a) den Namen und die Kontaktdaten des Auftragsverarbeiters oder der Auftragsverarbeiter und jedes Verantwortlichen, in dessen Auftrag der Auftragsverarbeiter tätig ist, sowie gegebenenfalls des Vertreters des Verantwortlichen oder des Auftragsverarbeiters und eines etwaigen Datenschutzbeauftragten;
> b) die Kategorien von Verarbeitungen, die im Auftrag jedes Verantwortlichen durchgeführt werden;
> c) gegebenenfalls Übermittlungen von personenbezogenen Daten an ein Drittland oder an eine internationale Organisation, einschließlich der Angabe des betreffenden Drittlands oder der betreffenden internationalen Organisation, sowie bei den in Artikel 49 Absatz 1 Unterabsatz 2 genannten Datenübermittlungen die Dokumentierung geeigneter Garantien;
> d) wenn möglich, eine allgemeine Beschreibung der technischen und organisatorischen Maßnahmen gemäß Artikel 32 Absatz 1.“

> „(5) Die in den Absätzen 1 und 2 genannten Pflichten gelten nicht für Unternehmen oder Einrichtungen, die weniger als 250 Mitarbeiter beschäftigen, sofern die von ihnen vorgenommene Verarbeitung nicht ein Risiko für die Rechte und Freiheiten der betroffenen Personen birgt, die Verarbeitung nicht nur gelegentlich erfolgt oder nicht die Verarbeitung besonderer Datenkategorien […] einschließt.“

**Einschätzung:** unslop verarbeitet laufend, nicht nur gelegentlich. Die Ausnahme nach Abs. 5 greift daher nach dem Wortlaut nicht. Das Verzeichnis nach Abs. 2 ist zu führen, elektronisch genügt (Abs. 3). Die Bitkom-Hinweise und das DSK-Kurzpapier Nr. 13 nennen das Verzeichnis ebenfalls als Pflicht des Auftragsverarbeiters. Der Omnibus-Vorschlag (1.5) ändert Art. 30 nicht.

### 1.7 Art. 82: Haftung (Wortlaut Abs. 2 und 4)

> „(2) Jeder an einer Verarbeitung beteiligte Verantwortliche haftet für den Schaden, der durch eine nicht dieser Verordnung entsprechende Verarbeitung verursacht wurde. Ein Auftragsverarbeiter haftet für den durch eine Verarbeitung verursachten Schaden nur dann, wenn er seinen speziell den Auftragsverarbeitern auferlegten Pflichten aus dieser Verordnung nicht nachgekommen ist oder unter Nichtbeachtung der rechtmäßig erteilten Anweisungen des für die Datenverarbeitung Verantwortlichen oder gegen diese Anweisungen gehandelt hat.“
> „(4) Ist mehr als ein Verantwortlicher oder mehr als ein Auftragsverarbeiter […] an derselben Verarbeitung beteiligt und sind sie gemäß den Absätzen 2 und 3 für einen durch die Verarbeitung verursachten Schaden verantwortlich, so haftet jeder Verantwortliche oder jeder Auftragsverarbeiter für den gesamten Schaden, damit ein wirksamer Schadensersatz für die betroffene Person sichergestellt ist.“

Abs. 5 regelt den Innenregress nach dem Anteil an der Verantwortung.

### 1.8 Datenschutzbeauftragter (Randnotiz) [P]

§ 38 Abs. 1 BDSG: Eine Benennungspflicht besteht, „soweit sie in der Regel mindestens 20 Personen ständig mit der automatisierten Verarbeitung personenbezogener Daten beschäftigen“. Unabhängig von der Personenzahl gilt sie u. a. bei DSFA-pflichtigen Verarbeitungen.
- Quelle: https://www.gesetze-im-internet.de/bdsg_2018/__38.html
- **Einschätzung:** Die Solo-UG liegt unter der Schwelle. Der AVV kann formulieren: „Ein DSB ist nicht bestellt, da die gesetzliche Notwendigkeit nicht vorliegt“. Diese Formulierung sieht auch das BayLDA-Muster, Ziff. 5, vor.
- Ob eine Art.-37-Abs.-1-Pflicht besteht, habe ich nicht geprüft.

---

## 2. EDPB-Leitlinien und -Stellungnahme [P]

### 2.1 EDPB Guidelines 07/2020 zu Controller/Processor

**Versionsstand:** Der Auftrag nennt „Version 2.0“. Aktuell ist **Version 2.1** (Minor Corrections, 20.09.2022), angenommen am 07.07.2021 (Version 2.0 = Annahme nach Konsultation).
Quelle: https://www.edpb.europa.eu/system/files/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf (Deckblatt und Versionshistorie). Die Randnummern unten beziehen sich auf Version 2.1.

| Thema | Aussage (sinngemäß, Schlüsselzitate wörtlich) | Rn. |
|---|---|---|
| Standard-AGB des Anbieters | Wenn der Dienstleister den Vertrag entwirft, ist das „not in itself problematic“. Aber: „Any proposed modification, by a processor, of data processing agreements included in standard terms and conditions should be directly notified to and approved by the controller […]. **The mere publication of these modifications on the processor's website is not compliant with Article 28.**“ | 108–110 |
| Kein Gesetzesabschreiben | „the processing agreement should not merely restate the provisions of the GDPR: rather, it should include more specific, concrete information as to how the requirements will be met“ | 112 |
| Risikoangemessenheit | „there is no need to impose particularly stringent protections and procedures on a processor entrusted with a processing activity from which only minor risks arise“. Dennoch müssen „all elements of Article 28(3)“ abgedeckt sein. | 113 |
| Weisungen | Weisungen müssen dokumentiert sein. Empfohlen werden ein Verfahren und eine Vorlage in einer Anlage. Alternativ ist jede schriftliche Form möglich (z. B. E-Mail), sofern Nachweise vorgehalten werden. | 118 |
| Drittland | Das Weisungserfordernis gilt auch für Transfers. Ohne Weisung darf kein Sub-Auftragsverarbeiter im Drittland eingesetzt werden. | 119–120 |
| TOMs | Der Vertrag muss die Maßnahmen enthalten oder auf sie verweisen, dazu „an obligation on the processor to obtain the controller's approval before making changes, and a regular review of the security measures“. Der Detailgrad muss dem Verantwortlichen eine Bewertung nach Art. 32 ermöglichen. | 126–127 |
| Datenpanne | Die Meldung an den Verantwortlichen soll „without undue delay“ erfolgen. Möglich ist „a specific timeframe (e.g. number of hours)“ mit Kontaktstelle, Modalität und Mindestinhalt. | 136 |
| Löschen/Rückgabe | Der Verantwortliche kann die Wahl vorab festlegen und später ändern. Löschung erfolgt „in a secure manner“. Der Auftragsverarbeiter bestätigt „within an agreed timescale and in an agreed manner“. Alle Kopien sind zu löschen, außer bei gesetzlicher Aufbewahrungspflicht. | 139–142 |
| Informationsfluss/Audits | Der Vertrag regelt, wie oft und auf welchem Weg Informationen fließen, z. B. Auszüge aus dem Verzeichnis, Systeme, Sicherheit, Aufbewahrung, Datenort, Transfers, Zugriffe, Subprozessoren. Der Auftragsverarbeiter darf einen Prüfer vorschlagen, „the final decision has to be left to the controller“. Remote-, Vor-Ort- oder andere Prüfarten sind möglich, „the final choice on this is to be taken by the controller“. | 143–144 |
| Audit-Kosten | Die Kostenverteilung ist Verhandlungssache. Klauseln mit „clearly disproportionate or excessive“ Kosten, die abschreckend wirken, sollen die Parteien nicht vereinbaren. | 145 |
| Subprozessoren | Vor der Genehmigung ist eine Liste vorzulegen: „(including per each: their locations, what they will be doing and proof of what safeguards have been implemented)“. Eine allgemeine Genehmigung soll durch Auswahlkriterien ergänzt werden. Der Unterschied zur Einzelgenehmigung liegt in der Bedeutung des Schweigens: Bei allgemeiner Genehmigung gilt Schweigen innerhalb der Frist als Zustimmung. Der Vertrag soll Frist, Kommunikationsweg (z. B. Templates) und die Folgen eines Widerspruchs regeln. Die Frist muss „reasonable“ sein. | 152–158 |
| Sub-Vertrag | „The whole chain of processing activities needs to be regulated by written agreements.“ „Dieselben“ Pflichten sind funktional zu verstehen, nicht wortgleich. | 160 |
| Nicht-wesentliche Mittel | „Non-essential means“ kann der Auftragsverarbeiter selbst wählen, etwa „the choice for a particular type of hard- or software or the detailed security measures“. Wesentliche Mittel wie Datenarten, Dauer oder **Empfängerkategorien** legt der Verantwortliche fest. | 40–41 |

### 2.2 EDPB Opinion 22/2024 (Unterauftragsverarbeiter-Ketten), angenommen am 07.10.2024

Quelle: https://www.edpb.europa.eu/system/files/2024-10/edpb_opinion_202422_relianceonprocessors-sub-processors_en.pdf

| Frage | Aussage der EDPB | Fundstelle |
|---|---|---|
| Muss der Verantwortliche die **gesamte Kette** kennen? | **Ja.** „controllers should have the information on the identity (i.e. name, address, contact person) of all processors, sub-processors etc. readily available at all times […] regardless of the risk associated with the processing activity.“ Mit „Identität“ sind Name, Anschrift, Kontaktperson (Name, Position, Kontaktdaten) sowie eine Beschreibung der Verarbeitung gemeint, bei mehreren Subs mit Abgrenzung der Verantwortlichkeiten. | Executive Summary; Rn. 22, 31 |
| Wer liefert die Informationen? | „the processor should **proactively** provide to the controller all information on the identity of all processors, sub-processors etc. […] and should keep this information […] up to date at all times.“ Das Format kann vertraglich geregelt werden. | Rn. 32 |
| Prüfpflicht des Verantwortlichen | Die Pflicht, „sufficient guarantees“ der (Sub-)Auftragsverarbeiter zu prüfen, gilt **unabhängig vom Risiko**. Der *Umfang* der Prüfung skaliert mit dem Risiko. Der Verantwortliche darf auf Informationen des Auftragsverarbeiters bauen und muss nachhaken, wenn sie unvollständig oder unplausibel sind. | Rn. 47–52 |
| Genehmigungsgrundlage | Eine allgemeine Genehmigung „should be supplemented with criteria to guide the processor's choice“. Pro Sub braucht es eine Liste mit Ort, Tätigkeit und Nachweis der Garantien. | Rn. 54–55 |
| Letzte Entscheidung | „The ultimate decision on whether to engage a specific sub-(sub-)processor and the pertaining responsibility […] remains with the controller.“ | Rn. 58 |
| Kopien der Sub-Verträge | **Keine systematische Pflicht** des Verantwortlichen, sie anzufordern. Er entscheidet im Einzelfall. **Auf Anfrage muss der Auftragsverarbeiter sie aber herausgeben:** „upon request of the controller, the initial processor will have to provide the sub-processing contracts“. | Exec. Summary; Rn. 65–66 |
| Formulierung Art. 28 Abs. 3 lit. a | Der Zusatz „unless required to do so by Union or Member State law to which the processor is subject“ ist „highly recommended but not mandatory“. Varianten wie „…by law or binding order of a governmental body“ sind nicht per se unzulässig, befreien aber nicht von DSGVO-Pflichten. Bei Drittlandtransfers reicht eine solche Variante für sich genommen „unlikely“ aus. Eine solche Klausel ist **keine** dokumentierte Weisung. | Exec. Summary |
| Transfers in der Kette | Bei Transfers zwischen (Sub-)Auftragsverarbeitern bleibt der Verantwortliche an Art. 28 Abs. 1 und Art. 44 gebunden. Der Exporteur erstellt die Dokumentation (Transfer-Mapping, Transfergrundlage, ggf. TIA). Der Verantwortliche muss sie bewerten und der Behörde vorlegen können, darf aber auf der Dokumentation des Exporteurs aufbauen. Praktische Schwierigkeiten „do not exonerate the controller“. | Exec. Summary; Rn. 85–88 |

**Folge für unslop:** Der AVV sollte die vollständige Kette nennen, einschließlich der wesentlichen Sub-Subs, etwa AWS als Infrastruktur von Supabase oder Google/AWS/Microsoft bei Vercel. Verweise auf die Listen der Anbieter sind möglich. Außerdem braucht es eine Zusage, **Kopien der Sub-DPAs auf Anfrage** zu liefern. Bei Google, Vercel und Supabase sind die DPAs ohnehin öffentlich, siehe Kapitel 6.

---

## 3. EU-Standardvertragsklauseln für Art. 28 (DB (EU) 2021/915)

Quelle [P]: Durchführungsbeschluss (EU) 2021/915 vom 4.6.2021, ABl. L 199/18 vom 7.6.2021, deutscher Text über https://publications.europa.eu/resource/celex/32021D0915.

### 3.1 Rechtsnatur und Struktur

- **Art. 1:** Die Klauseln „erfüllen die Anforderungen an Verträge […] gemäß Artikel 28 Absätze 3 und 4“.
- **ErwG 6** und **Klausel 2 b:** Die Klauseln dürfen in einen „umfangreicheren Vertrag“ aufgenommen und ergänzt werden, „sofern diese weder unmittelbar noch mittelbar im Widerspruch zu den Klauseln stehen oder die Grundrechte oder Grundfreiheiten der betroffenen Personen beschneiden“.
- **Klausel 2 a (Unabänderbarkeit):** „Die Parteien verpflichten sich, die Klauseln nicht zu ändern, es sei denn, zur Ergänzung oder Aktualisierung der in den Anhängen angegebenen Informationen.“
- **Klausel 4 (Vorrang):** Die Klauseln gehen bei Widerspruch zu verbundenen Vereinbarungen vor.
- **ErwG 10:** Die Klauseln taugen **nicht** als SCC im Sinne von Kapitel V, also nicht für Drittlandtransfers. Klausel 1 f) sagt dasselbe.

**Aufbau:**

| Abschnitt | Klauseln |
|---|---|
| I | 1 Zweck/Anwendungsbereich · 2 Unabänderbarkeit · 3 Auslegung · 4 Vorrang · 5 Kopplungsklausel (fakultativ) |
| II Pflichten der Parteien | 6 Beschreibung der Verarbeitung (→ Anhang II) · 7 Pflichten: 7.1 Weisungen, 7.2 Zweckbindung, 7.3 Dauer, 7.4 Sicherheit (→ Anhang III), 7.5 Sensible Daten, 7.6 Dokumentation/Einhaltung (Audits), 7.7 Unterauftragsverarbeiter, 7.8 Internationale Übermittlungen · 8 Unterstützung des Verantwortlichen · 9 Meldung von Verletzungen (9.1/9.2) |
| III Schlussbestimmungen | 10 Verstöße und Beendigung (inkl. Löschung/Rückgabe) |
| Anhänge | **I** Liste der Parteien · **II** Beschreibung der Verarbeitung · **III** TOMs („müssen konkret beschrieben werden; eine allgemeine Beschreibung ist nicht ausreichend“) · **IV** Liste der Unterauftragsverarbeiter (Pflicht bei Option 1, Einzelgenehmigung) |

### 3.2 Schlüsselklauseln (Wortlaut-Auszüge)

- **7.6 c/d (Audit):** „Auf Verlangen des Verantwortlichen gestattet der Auftragsverarbeiter ebenfalls die Prüfung der unter diese Klauseln fallenden Verarbeitungstätigkeiten in angemessenen Abständen oder bei Anzeichen für eine Nichteinhaltung […]. Bei der Entscheidung über eine Überprüfung oder Prüfung kann der Verantwortliche einschlägige Zertifizierungen des Auftragsverarbeiters berücksichtigen.“ Weiter: „Die Prüfungen können auch Inspektionen in den Räumlichkeiten oder physischen Einrichtungen des Auftragsverarbeiters umfassen und werden gegebenenfalls mit angemessener Vorankündigung durchgeführt.“
- **7.7 a Option 2 (allgemeine Genehmigung):** „Der Auftragsverarbeiter unterrichtet den Verantwortlichen mindestens [ZEITRAUM ANGEBEN] im Voraus ausdrücklich in schriftlicher Form über alle beabsichtigten Änderungen dieser Liste […] und räumt dem Verantwortlichen damit ausreichend Zeit ein, um vor der Beauftragung […] Einwände gegen diese Änderungen erheben zu können.“
- **7.7 c:** Auf Verlangen erhält der Verantwortliche eine Kopie der Untervergabevereinbarung. Schwärzungen zum Schutz von Geschäftsgeheimnissen sind zulässig.
- **7.7 d:** Der Auftragsverarbeiter haftet „in vollem Umfang“ für den Sub.
- **7.7 e:** „Der Auftragsverarbeiter vereinbart mit dem Unterauftragsverarbeiter eine **Drittbegünstigtenklausel**, wonach der Verantwortliche – im Falle, dass der Auftragsverarbeiter faktisch oder rechtlich nicht mehr besteht oder zahlungsunfähig ist – das Recht hat, den Untervergabevertrag zu kündigen und den Unterauftragsverarbeiter anzuweisen, die personenbezogenen Daten zu löschen oder zurückzugeben.“
- **7.8 b:** Für Transfers zwischen Auftragsverarbeiter und Sub-Auftragsverarbeiter können die Kapitel-V-SCC genutzt werden (in der Praxis Modul 3).
- **9.2:** Der Auftragsverarbeiter meldet „unverzüglich, nachdem ihm die Verletzung bekannt wurde“. Mindestinhalt: Art der Verletzung, Anlaufstelle, voraussichtliche Folgen und Maßnahmen. Schrittweise Nachlieferung ist erlaubt.
- **10 d:** Nach Vertragsende löscht der Auftragsverarbeiter nach Wahl des Verantwortlichen die Daten „und bescheinigt dem Verantwortlichen, dass dies erfolgt ist“, oder er gibt sie zurück und löscht Kopien. Bis dahin gelten die Klauseln fort.
- **10 b:** Kündigungsrecht des Verantwortlichen u. a., wenn die Einhaltung nach einer Aussetzung nicht „innerhalb eines Monats“ wiederhergestellt ist.

### 3.3 SCC 2021/915 verwenden oder eigenen AVV schreiben? Einschätzung

| | SCC 2021/915 unverändert | Eigener AVV (angelehnt an SCC/Bitkom/BayLDA) |
|---|---|---|
| **Vorteile** | Amtlich als Art.-28-konform festgestellt (Art. 1 DB; Art. 28 Abs. 6). Enterprise-Kunden akzeptieren sie ohne Verhandlung. Die EDPB (Rn. 109) sieht darin einen Ausgleich bei Verhandlungsungleichgewicht. | Kann auf die realen Möglichkeiten eines Solo-Anbieters zugeschnitten werden: Audit-Modalitäten, Fristen, Kanal, Haftungsverweis. Die EDPB (Rn. 112) verlangt ohnehin Konkretisierung statt Gesetzesabschrift. |
| **Nachteile** | Nicht änderbar (Kl. 2 a). **Kl. 7.7 e** verlangt eine Drittbegünstigtenklausel mit jedem Sub. Aus den Standard-DPAs von Google, Vercel und Supabase ergibt sich eine solche Klausel nach meiner Durchsicht **nicht**, sie ist **nicht verifiziert**. unslop könnte sie gegenüber den Hyperscalern kaum durchsetzen. Wer die SCC unterschreibt, sagt etwas zu, das er womöglich nicht einhalten kann. Vor-Ort-Inspektion (7.6 d) und Kopien der Sub-Verträge (7.7 c) sind nicht abbedingbar. | Kein „amtliches Siegel“. Kunden mit eigener Rechtsabteilung prüfen mehr. Das Risiko, einen Pflichtpunkt zu vergessen, lässt sich mit einer Checkliste nach Art. 28 Abs. 3 beherrschen. |

**Empfehlung (Einschätzung):**
1. Einen **eigenen AVV** schreiben, der die **Gliederung und die Anhänge I–IV der SCC 2021/915 übernimmt** und Formulierungen aus den SCC möglichst wörtlich verwendet. Die Pflichtpunkte nach Art. 28 Abs. 3 lit. a–h per Checkliste abhaken.
2. **Nicht** behaupten, es handle sich um „die EU-Standardvertragsklauseln“.
3. Optional kann unslop Enterprise-Kunden anbieten, auf Wunsch die SCC 2021/915 abzuschließen. Die Drittbegünstigtenklausel nach 7.7 e ist dann vorher zu prüfen: Welche Rechte gewähren die Sub-DPAs dem Endkunden bei Insolvenz von unslop? Das ist offen.

---

## 4. Muster deutscher Behörden und Verbände (Referenz)

| Muster | Stand | URL | Struktur (Kurz) |
|---|---|---|---|
| **DSK Kurzpapier Nr. 13** „Auftragsverarbeitung, Art. 28 DS-GVO“ [P] | 17.12.2018 | https://www.datenschutzkonferenz-online.de/media/kp/dsk_kpnr_13.pdf | Kein Muster, sondern Auslegung. Kernpunkte: Vertrag „schriftlich oder in einem elektronischen Format“. Bei Subunternehmern Genehmigung „(schriftlichen oder elektronischen)“ und vorherige Mitteilung von Änderungen mit Einspruchsrecht. „Kann nach dem Einspruch keine Einigung […] erreicht werden, hat der Verantwortliche die Unterbeauftragung per Weisung zu unterbinden oder die Auftragsverarbeitung zu beenden.“ Anhang A: „Outsourcing personenbezogener Datenverarbeitung im Rahmen von Cloud-Computing, ohne dass ein inhaltlicher Datenzugriff des Cloud-Betreibers erforderlich ist“ gilt als typische Auftragsverarbeitung. Art. 30 Abs. 2 und Art. 33 Abs. 2 werden als Pflichten des Auftragsverarbeiters genannt. |
| **BayLDA Formulierungshilfe AVV** [P] | ohne Datum im Dokument | https://www.lda.bayern.de/media/muster/formulierungshilfe_av.pdf | Ziff. 1 Gegenstand/Dauer (inkl. EU/EWR-Klausel und Zustimmung bei Drittlandverlagerung) · 2 Art/Zweck/Datenarten/Betroffene · 3 Rechte/Pflichten/Weisungsbefugnisse AG · 4 Weisungsberechtigte/Weisungsempfänger/Kanäle · 5 Pflichten AN (inkl. Kontrollen „grundsätzlich nach Terminvereinbarung“, **Heimarbeit nur mit Zustimmung und Kontrollzugang**, DSB) · 6 Mitteilungspflichten bei Störungen/Pannen · 7 Subunternehmer · 8 TOMs (Risikomethodik, Datenschutzkonzept im Anhang, jährliche Überprüfung) · 9 Löschung/Rückgabe mit datierter Bestätigung · 10 Vergütung · 11 Haftung („Auf Art. 82 DS-GVO wird verwiesen“) · 12 Vertragsstrafe · 13 Sonstiges. Hinweis im Dokument: keine SCC nach Art. 28 Abs. 8, keine Prüfung nach §§ 307 ff. BGB. |
| **BayLDA Auslegungshilfe Formerfordernis** [P] | 15.05.2019 | https://www.lda.bayern.de/media/veroeffentlichungen/FAQ_ADV_Formerfordernis.pdf | Ein elektronischer Abschluss ist zulässig. Die Parteien müssen ihn aber „hinreichend und beweiskräftig […] dokumentieren“. „Eine qualifizierte elektronische Signatur ist also nicht zwingend“ (h. M. in Deutschland). |
| **LfDI BW Muster-AVV** [P] | 2020 (Dateiname 200429 bzw. 200528, Upload 2020/12) | DE: https://www.baden-wuerttemberg.datenschutz.de/wp-content/uploads/2020/12/200429_AVV-Muster_DE_neu.pdf · EN: https://www.baden-wuerttemberg.datenschutz.de/wp-content/uploads/2020/12/200528_AVV-version_EN_new.pdf · Übersicht: https://www.baden-wuerttemberg.datenschutz.de/praxishilfen/ | Präambel · §1 Begriffe · §2 Vertreter in der EU · §3 Gegenstand · §4 Datenarten/Betroffene · §5 Weisungsrecht · §6 Schutzmaßnahmen AN · §7 Informationspflichten AN (unverzüglich, Mindestinhalt, Pfändung/Insolvenz) · §8 Kontrollrechte AG („nach rechtzeitiger Abstimmung zu den üblichen Geschäftszeiten“, Testate und Zertifikate als Nachweis, Prüfer nicht im Wettbewerb, optional Aufwandsvergütung) · §9 Subunternehmer (Variante 1 Verbot, **„Empfehlung: Variante 2“** mit Vorab-Zustimmung) · §10 Betroffenenrechte · §11 Haftung (u. a. **Freistellung auf erstes Anfordern** zugunsten des AG) · §12 außerordentliche Kündigung · §13 Beendigung (Rückgabe/Löschung inkl. Datensicherungen, dokumentierter Nachweis) · §14 Schluss. Anlagen: 1 Betroffene/Datenarten · 2 TOMs · 3 Subunternehmer · 4 Weisungsberechtigte. Die ältere Datei `wp-content/uploads/2018/01/muster_adv.pdf` hat dieselben Überschriften wie das BayLDA-Muster. |
| **Bitkom Mustervertragsanlage AVV v1.3 (2025)** [V] | 2025 | Übersicht: https://www.bitkom.org/Bitkom/Publikationen/Praxisleitfaeden-zur-Auftragsverarbeitung · Muster: https://www.bitkom.org/sites/main/files/2023-01/230123LFMustervertragsanlage.pdf (Dateipfad 2023, Inhalt „Version 1.3 (2025)“) · Anlage 1: https://www.bitkom.org/sites/main/files/2023-01/20230113Anlage-1-zu-Mustervertragsanlage-AVV.pdf · Hinweise v1.2 (11/2025): https://www.bitkom.org/sites/main/files/2025-12/bitkom-leitfaden-auftragsverarbeitung.pdf | Präambel · §1 Gegenstand/Dauer (Details in Anlage 1) · §2 Anwendungsbereich/Verantwortlichkeit (Weisungen per Vertrag bzw. Textform, nicht vorgesehene Weisungen = Antrag auf Leistungsänderung) · §3 Pflichten AN (TOM-Anlage, Breach-Mindestinhalt, Kontakt, Herausgabe/Löschung „auf Anfrage“ bestätigen) · §4 Pflichten AG · §5 Betroffenenanfragen · §6 Nachweise (Testate, **Selbstaudits**, ISO 27001/BSI C5 u. a., Art. 40/42) und Kontrollrechte (Option 1 / **Option 2: max. 1 reguläre Vor-Ort-Prüfung pro Kalenderjahr**, anlassbezogene bleiben unberührt, jede Partei trägt ihre Kosten) · §7 Subunternehmer (Variante 2: allgemeine Genehmigung, Information schriftlich bzw. per E-Mail, **Widerspruch binnen „mindestens 14 Kalendertagen“ aus wichtigem datenschutzrechtlichem Grund**, Schweigen = Zustimmung, **Notfallklausel** mit nachträglicher unverzüglicher Info, Liste als Anlage oder „dauerhaft zugänglicher Internet-Link“ mit Name/Anschrift, Teilleistung, Ort) · §8 Drittstaaten (Mechanismen, TIA auf Anfrage) · §9 Haftung (V1: Art. 82 / V2: Haftungsregelung des Hauptvertrags gilt) · §10 Informationspflichten, Schriftform (Textform), Rechtswahl. Anlage 2: Meldebogen Datenschutzvorfall. |

**Hinweis zum Bitkom-Muster [V]:** Die Hinweise v1.2 (S. 27) warnen: Eine strenge Schriftformklausel kann in AGB unwirksam sein (§ 305b BGB). „Praktisch empfiehlt es sich daher, die Textform zuzulassen.“ § 305b BGB [P]: „Individuelle Vertragsabreden haben Vorrang vor Allgemeinen Geschäftsbedingungen.“ (https://www.gesetze-im-internet.de/bgb/__305b.html)

---

## 5. TOMs für eine Solo-UG ohne eigenes Rechenzentrum

### 5.1 Belege zu den Subprozessoren (Stand 2026-09-28)

| Anbieter | Zertifikate/Testate | Verschlüsselung | Quelle |
|---|---|---|---|
| **Google Cloud (Vertex AI)** | Die Scope-Tabelle führt „**Generative AI on Vertex AI**“ als in Scope für **ISO 27001/27017/27018** und **SOC 1/2/3**. Nicht in Scope sind laut Tabelle PCI DSS und der Penetration-Testing-Report. | „All data that is stored by Google is encrypted at the storage level using […] AES-256.“ „We encrypt all Google customer content at rest, without any action required by you.“ Die Seite wurde laut eigener Angabe zuletzt am 2026-09-24 aktualisiert, inhaltlich im Mai 2024. | [A] https://cloud.google.com/security/compliance/services-in-scope · [A] https://docs.cloud.google.com/docs/security/encryption/default-encryption |
| **Vercel** | Trust Center: **SOC 2 Type 2** (Bericht 2026, Prüfzeitraum 1.7.2025–30.6.2026), SOC 3, **ISO/IEC 27001 („migrated to 2022 framework“)**, PCI DSS, HIPAA, DPF (EU-US, Swiss, UK-Extension) u. a. | „Data is encrypted at rest (AES-256)“, „in transit (HTTPS / TLS)“ | [A] https://security.vercel.com/ · [A] https://vercel.com/security. **Widerspruch:** vercel.com/security nennt noch „ISO 27001:2013 certified“, das Trust Center „migrated to 2022“. Ich übernehme das Trust Center als aktueller, das ist **nicht abschließend verifiziert**. |
| **Supabase** | „SOC 2 Type 2 compliant“, „ISO 27001 certified“, HIPAA. Berichte bzw. Zertifikate gibt es nur für Team- und Enterprise-Kunden. | „All customer data is encrypted at rest with AES-256“, „in transit via TLS“ | [A] https://supabase.com/security |
| **Supabase Backups** | **Free: keine täglichen Backups.** Pro: 7 Tage, Team: 14, Enterprise: bis 30. PITR nur als Add-on ab Pro. | – | [A] https://supabase.com/docs/guides/platform/backups |

### 5.2 Eigene Maßnahmen von unslop: was im Code belegt ist [Code]

Stand heute im Repository, ohne Tiefenprüfung:
- **Webhook-Signaturprüfung (HMAC):** Treffer für `createHmac` / `timingSafeEqual` / `x-hub-signature-256` in `src/lib/github.ts` und `src/app/api/webhook/route.ts`, ebenso für Paddle (`src/lib/billing/paddle-webhook.ts`).
- **API-Keys gehasht:** Treffer für Hash-Muster in `src/lib/api-keys.ts` und `src/app/api/keys/route.ts`. Die Details, etwa ob tatsächlich nur der Hash gespeichert wird, habe ich **nicht verifiziert**.
- **Vercel-Funktionsregion:** `vercel.json` enthält `"regions": ["fra1"]` (Frankfurt).
- **Vertex-Explicit-Cache:** Laut Code-Kommentar in `src/lib/pipeline/context-cache.ts` enthält der Cache den statischen „Layer-1-Prefix“ als systemInstruction. Die dynamischen Teile (Protokoll und Tail, also vermutlich Diff und Kundencode) gehen uncached in `contents`. Die TTL ist per Default 3600 s. **Dass keine Kundendaten im Explicit Cache liegen, ist damit nur plausibel, nicht end-to-end verifiziert.**
- **Löschfristen oder Retention-Jobs:** Die Suche nach `retention` / `purge` in `src/` ergab **keine Treffer**. Ein automatisiertes Löschkonzept für Findings, Jobs und Diffs ist damit **nicht belegt**. Das ist ein offener Punkt vor jeder Löschzusage im AVV.
- **Supabase-Region:** nicht geprüft. Laut CLAUDE.md ist die Management-Ebene derzeit ohnehin gestört. Also **blocked: tooling / nicht verifiziert**.

### 5.3 Google-Vertex-Spezifika, die in die TOMs bzw. Anlage II gehören [A]

Quelle: https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention (Weiterleitung von …/vertex-ai-zero-data-retention)
- **Training:** Google „won't use your data to train or fine-tune any AI/ML models without your prior permission or instruction“ (Verweis auf „Training Restriction“ in den Service Specific Terms).
- **In-Memory-Caching:** Google-Modelle cachen Kundendaten standardmäßig im Arbeitsspeicher, projektisoliert, mit „24-hour TTL“. Das Caching ist auf Projektebene abschaltbar.
- **Prompt-Logging zur Missbrauchserkennung:** Google kann Prompts nach Sec. 4.3 der GCP-Terms loggen. Für „zero data retention“ lässt sich eine Ausnahme beantragen.
- **Request-Response-Logging:** standardmäßig aus.
- **Grounding mit Google Search:** Logs werden bis zu 3 Tage gespeichert, das ist nicht abschaltbar.

Datenresidenz: https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency
- Multi-Region **`eu`**: „ML processing stays within that specific geographical region“. Hinweis: „strictly covers data residency within EU member states“, das Vereinigte Königreich und die Schweiz sind ausgeschlossen.
- **Global-Endpoint:** „Requests submitted to a global endpoint may be processed in any Google Cloud location around the world, and therefore don't provide any data residency guarantees.“
  → **Für unslop relevant:** Der Eskalations-Rollback-Pfad `gemini-3.1-pro-preview` läuft laut CLAUDE.md nur auf `global`. Wird er aktiviert, ist eine Verarbeitung außerhalb der EU möglich. AVV und Transfer-Mapping müssen das abdecken. Alternativ lässt sich der Pfad für Kunden, die „EU-only“ verlangen, vertraglich oder technisch sperren.

### 5.4 Was für ein Ein-Personen-Unternehmen realistisch und ehrlich ist (Einschätzung)

**Maßstab:** Art. 32 Abs. 1 (Stand der Technik, Kosten, Risiko). EDPB Rn. 113 (Risikoangemessenheit) und Anhang III der SCC („konkret beschrieben; eine allgemeine Beschreibung ist nicht ausreichend“).

**Grundsätze:**
- Zugesagt wird nur, was nachweisbar umgesetzt ist.
- Physische Sicherheit, Rechenzentrum und Hardwareverschlüsselung werden **als Maßnahmen der Subprozessoren** ausgewiesen, mit Verweis auf deren Zertifikate. Sie werden nicht als eigene Maßnahmen verkauft.
- **Eigene Zertifizierungen:** keine. Das steht offen im AVV. Nachweis erfolgt durch **Selbstauskunft und Selbstaudit**, was Bitkom § 6 Abs. 2 ausdrücklich als Nachweisform aufführt, plus die Zertifikate der Subs.
- **Organisatorisch ehrlich:**
  - Vertraulichkeitsverpflichtung: Der Geschäftsführer ist die einzige Person mit Zugriff. Künftige Mitarbeitende oder Freelancer werden vor Zugriff verpflichtet (Art. 28 Abs. 3 lit. b, Art. 29).
  - **Vertretung bei Ausfall:** derzeit keine. Folge: Die Reaktionszeit bei Pannen oder Anfragen ist „unverzüglich“, im Urlaub oder bei Krankheit aber möglicherweise eingeschränkt. Das ist im AVV mit einer realistischen Stundenfrist abzubilden (siehe 8.4).
  - **Heimarbeitsplatz:** Das BayLDA-Muster (Ziff. 5) sieht vor, dass Verarbeitung in Privatwohnungen „nur mit Zustimmung des Auftraggebers“ erfolgt und dass für Kontrollzwecke Zugang zur Wohnung gewährleistet ist. Bei einer Solo-UG, die aus dem Homeoffice arbeitet, muss der AVV das offen ansprechen: Der Arbeitsplatz ist Homeoffice, die Verarbeitung selbst findet in der Cloud statt, lokal werden keine Kundendaten dauerhaft gespeichert. Das ist ein **Prüfpunkt, nicht verifiziert**.

---

## 6. Drittlandübermittlungen in der Subprozessorkette

### 6.1 Rechtsrahmen

- **Angemessenheitsbeschluss DPF:** Durchführungsbeschluss (EU) 2023/1795 vom 10.07.2023.
- **EuG, Urteil vom 03.09.2025, T-553/23, Latombe/Kommission:** Klage abgewiesen. Das Gericht bestätigt, dass die USA zum Zeitpunkt des Beschlusses ein angemessenes Schutzniveau boten [P]. Pressemitteilung Nr. 106/25: https://curia.europa.eu/site/upload/docs/application/pdf/2025-09/cp250106en.pdf
- **Rechtsmittel C-703/25 P:** eingelegt am 31.10.2025, anhängig (InfoCuria-Verfahrensseite: https://infocuria.curia.europa.eu/tabs/affair?lang=EN&searchTerm=%22C-703%2F25+P%22). Dass bis heute weder Schlussanträge noch ein Urteil vorliegen, ist nur **[S]** belegt, die Verfahrensseite selbst ist **nicht verifiziert**.
- **Konsequenz (Einschätzung):** Der AVV sollte nicht allein auf das DPF bauen. Er sollte ein **Fallback auf SCC (Modul 3)** vorsehen, wie es Google mit der „Alternative Transfer Solution“ neben den SCC ohnehin tut.

### 6.2 Befunde pro Subprozessor

| Sub | Vertragspartner / Datenort | Transfermechanismus laut Anbieter | Befund |
|---|---|---|---|
| **Google Cloud** | Vertex AI über die `eu`-Multiregion. Der `global`-Endpoint hat keine Residenzgarantie (5.3). | CDPA (zuletzt geändert am 08.06.2026). SCC oder „Alternative Transfer Solution“, definiert als z. B. ein „data protection framework recognized as ensuring […] adequate protection“. Google LLC ist nach eigener Angabe DPF-zertifiziert („Google LLC (and its wholly-owned US subsidiaries unless explicitly excluded)“, Seite gültig ab 23.08.2025). | [A] https://cloud.google.com/terms/data-processing-addendum · [A] https://policies.google.com/privacy/frameworks?hl=en-US. Einen Eintrag in der DPF-Liste konnte ich technisch nicht abrufen (JS-App), das ist **nicht verifiziert** (vgl. [S]-Treffer https://www.dataprivacyframework.gov/participant/5780.EU). |
| **Vercel** | Vercel Inc. (Delaware). „Vercel's primary processing facilities are in the United States.“ Funktionsregion bei unslop: `fra1` [Code]. | DPA (Last Updated 17.03.2026, wirksam ab 31.03.2026): SCC 2021 Module 1/2/3, irisches Recht, UK IDTA. DPF laut Trust Center. | [A] https://vercel.com/legal/dpa. **Kritisch:** „This Addendum applies to Vercel's Processing of Personal Data as a Processor under the Agreement for Customers who are **on Enterprise and Pro plans**.“ Den Plan von unslop habe ich **nicht verifiziert**. Laut Memory stehen ein Pro-Upgrade und die Einstellung `high` erst mit Vercel Pro noch aus. |
| **Supabase** | Laut DPA ist Vertragspartner die **„Supabase Pte. Ltd“** (Singapur). Die Datenregion wählt der Kunde (AWS-Regionen US/EU/APAC). | DPA **Version 1 vom 01.08.2026**, Teil der Terms of Service. SCC Module 2/3, irisches Recht. „acceptance of the Agreement shall have the same effect as signing the SCCs“. | [A] https://supabase.com/legal/dpa. Eine **DPF-Zertifizierung ist nicht verifiziert** ([S] fand keinen Eintrag). Die Subprozessorliste gibt es als PDF (Stand 01.06.2026), den Inhalt habe ich **nicht gelesen**: https://supabase.com/legal/customer-resources/subprocessor-list |
| **GitHub** | siehe Kapitel 9 | GitHub-DPA (Oktober 2025) gilt für die GitHub Customer Agreement: https://assets.ctfassets.net/8aevphvgewt8/9rRh60u9m8AJGCKPHSnkI/f665de2992d6aa66bab425d19a559dd1/TPL-202510-GitHubDataProtectionAgreement.pdf | Die Rolle ist offen, siehe 9. |

### 6.3 Was der AVV zu Drittlandtransfers sagen muss

Belegt durch Art. 28 Abs. 3 lit. a, EDPB Rn. 119–120, Opinion 22/2024 Rn. 85–88, Bitkom § 8 und BayLDA Ziff. 1/7:
1. Transfers erfolgen nur auf dokumentierte Weisung. Die **Weisung liegt im AVV selbst**, durch die Nennung der Subs samt Drittland und Mechanismus.
2. Pro Sub nennt der AVV Drittland (USA, Singapur), Mechanismus (DPF und/oder SCC Modul 3) und Fundstelle des Sub-DPA.
3. Der AVV sagt Transfer-Mapping und TIA-Dokumentation auf Anfrage zu. Bitkom § 8 Abs. 2 sieht vor, dass „Das TIA sowie getroffene Zusatzmaßnahmen werden dem Auftraggeber auf Anfrage zur Verfügung gestellt“ werden.
4. Der `global`-Endpoint wird gesondert offengelegt, oder der AVV sagt „EU-only“ zu und unslop sperrt den Pfad technisch.
5. Der AVV enthält eine Formulierung zu Zugriffsersuchen von Behörden aus Drittstaaten, abgestimmt auf die EDPB Opinion 22/2024 (siehe 2.2, Formulierung lit. a).

---

## 7. Abschlussmechanik für SaaS (Click-through, Form, Versionierung)

### 7.1 Form

- **Art. 28 Abs. 9** [P]: „schriftlich […], was auch in einem elektronischen Format erfolgen kann“.
- **BayLDA Auslegungshilfe** [P]: Eine qualifizierte elektronische Signatur ist nicht zwingend. Der Abschluss muss aber „beweiskräftig“ dokumentiert werden.
- **DSK KP 13** [P]: „schriftlich oder in einem elektronischen Format“.
- **§ 126b BGB** (Textform) [P]: „lesbare Erklärung, in der die Person des Erklärenden genannt ist, auf einem dauerhaften Datenträger“ (https://www.gesetze-im-internet.de/bgb/__126b.html).
- **Einschätzung:** Die Annahme per Checkbox bei Registrierung oder Checkout ist grundsätzlich tragfähig. unslop protokolliert dabei:
  - Account/Organisation und die Person, die akzeptiert
  - Zeitstempel und AVV-Version (Hash des Dokuments)
  - Bereitstellung des Texts als PDF bzw. per E-Mail (dauerhafter Datenträger)

### 7.2 Wie etablierte Anbieter es machen [A]

| Anbieter | Mechanik | Subprozessor-Änderungen |
|---|---|---|
| Google Cloud | CDPA „is incorporated into the Agreement(s)“ | Benachrichtigung „at least 30 days“ vorher mit Name, Ort und Tätigkeit. Einwand = Kündigung for convenience **binnen 90 Tagen** nach Mitteilung (CDPA 11.4). |
| Supabase | DPA „supplements and forms part of the Supabase Terms of Service“. SCC gelten mit Annahme der Terms als unterschrieben. | Notice von **30 Tagen nur, wenn der Kunde den Update-Kanal abonniert**. Widerspruch binnen 5 Tagen. Findet sich binnen 30 Tagen keine Lösung, ist eine Teilkündigung möglich (DPA Ziff. 6). |
| Vercel | DPA „forms part of“ der Enterprise Terms bzw. der sonstigen Vereinbarung, **nur für Pro/Enterprise** | Benachrichtigung durch Aktualisierung der Liste und, falls abonniert, per Notice. Widerspruch binnen **5 Kalendertagen**. „sole and exclusive remedy“ ist die Kündigung ohne Erstattung. |
| GitHub | DPA „forms part of the GitHub Customer Agreement“ | nicht ausgewertet |
| Bitkom-Muster [V] | Anlage zum Hauptvertrag | Information schriftlich oder per E-Mail, Widerspruch binnen mind. 14 Kalendertagen, Liste per dauerhaftem Link. |

**Widerspruch zwischen Marktpraxis und EDPB (Einschätzung):**
- EDPB Rn. 110 hält fest: „mere publication of these modifications on the processor's website is not compliant with Article 28“. Diese Randnummer betrifft Änderungen des AVV selbst.
- Art. 28 Abs. 2 verlangt, dass der Auftragsverarbeiter „**immer**“ über Subprozessor-Änderungen „informiert“.
- Die Opt-in-Modelle von Vercel und Supabase, bei denen nur Abonnenten informiert werden, liegen im Graubereich.
- **Empfehlung für unslop:** **aktive E-Mail an alle Kunden**, kein reines Abo-Modell.

### 7.3 Versionierung

- AVV-Versionen mit Datum und Changelog öffentlich archivieren, so wie Google die „Previous versions“ führt.
- Wesentliche Änderungen gehen dem Kunden direkt zu (EDPB Rn. 110). Bei nachteiligen Änderungen ist eine Zustimmung oder ein Sonderkündigungsrecht vorzusehen.
- Ob einseitige Änderungsvorbehalte in AGB wirksam sind, richtet sich nach § 307 BGB. Bei B2B gelten §§ 308/309 BGB nicht unmittelbar (§ 310 Abs. 1 BGB), wirken aber über § 307. Details sind **nicht geprüft** und gehören in eine anwaltliche Prüfung.

---

## 8. Haftung, Kontrollrechte, Löschung

### 8.1 Haftung

- **Außenverhältnis:** Art. 82 bindet zwingend gegenüber Betroffenen, siehe Wortlaut 1.7. Ein AVV kann die gesetzliche Haftung gegenüber Betroffenen **nicht** abbedingen, denn er ist ein Vertrag nur zwischen den Parteien. Das ist eine Einschätzung aus dem Wortlaut. Eine Behörden- oder EuGH-Aussage genau dazu habe ich **nicht verifiziert**.
- **Innenverhältnis:** Die DSGVO regelt in Art. 82 Abs. 5 den Regress nach Verantwortungsanteil. Die SCC 2021/915 enthalten **keine** Haftungsklausel außer 7.7 d (volle Haftung für Subs gegenüber dem Verantwortlichen). Zusätzliche Klauseln sind zulässig, solange sie nicht widersprechen (Kl. 2 b).
- **Muster:**
  - BayLDA Ziff. 11: „Auf Art. 82 DS-GVO wird verwiesen. Im Übrigen wird folgendes vereinbart: …“
  - Bitkom § 9: Variante 2, „Eine zwischen den Parteien im Vertrag vereinbarte Haftungsregelung gilt auch für diese Vereinbarung.“
  - LfDI BW § 11: Freistellung „auf erstes Anfordern“ zugunsten des Auftraggebers, im Übrigen Haftung wie im Hauptvertrag.
  - Marktpraxis: Vercel-DPA „subject to the limitations of liability in the Agreement“.
- **AGB-Grenzen [P]:**
  - § 309 Nr. 7 BGB (kein Ausschluss oder keine Begrenzung bei Leben, Körper, Gesundheit sowie grobem Verschulden) gilt gegenüber Unternehmern nicht unmittelbar (§ 310 Abs. 1 BGB). § 307 Abs. 1 und 2 BGB bleiben aber anwendbar, „auch insoweit […], als dies zur Unwirksamkeit von in § 308 […] und § 309 genannten Vertragsbestimmungen führt“.
  - § 307 Abs. 2 Nr. 2 BGB: Eine unangemessene Benachteiligung liegt im Zweifel vor, wenn „wesentliche Rechte oder Pflichten, die sich aus der Natur des Vertrags ergeben“, so eingeschränkt werden, dass der Vertragszweck gefährdet ist.
  - Quellen: https://www.gesetze-im-internet.de/bgb/__307.html · https://www.gesetze-im-internet.de/bgb/__309.html · https://www.gesetze-im-internet.de/bgb/__310.html
  - **Einschätzung:** Eine Haftungsbegrenzung inter partes über den Hauptvertrag ist marktüblich. Ob ein konkreter Cap wirksam ist, etwa für Datenschutzpflichten als Kardinalpflichten, Vorsatz oder grobe Fahrlässigkeit, ist **anwaltlich zu prüfen**. Das ist nicht verifiziert.

### 8.2 Kontrollrechte und Audits für einen Solo-Anbieter

- **Unabdingbarer Kern:** Informationen bereitstellen **und** Überprüfungen einschließlich Inspektionen ermöglichen (Art. 28 Abs. 3 lit. h). Die finale Wahl der Prüfart liegt beim Verantwortlichen (EDPB Rn. 144). Keine abschreckenden Kosten (Rn. 145).
- **Zulässige Ausgestaltung:**
  - Vorankündigung (SCC 7.6 d: „angemessener Vorankündigung“; Supabase: 30 Tage)
  - Geschäftszeiten (LfDI BW § 8)
  - Prüfer nicht im Wettbewerb (LfDI BW § 8)
  - Vertraulichkeit (Bitkom § 6 Abs. 3 b)
  - reguläre Vor-Ort-Prüfung max. 1× pro Jahr, anlassbezogene bleiben möglich (Bitkom Option 2)
  - **vorrangiger Nachweis durch Unterlagen:** Zertifikate der Subs, Selbstauskunft, TOM-Dokument, Verzeichnisauszug (EDPB Rn. 143)
- **Kosten:** Jede Partei trägt ihre eigenen Kosten (Bitkom). Alternativ ist eine Aufwandsvergütung für Vor-Ort-Audits möglich, aber nicht abschreckend bemessen (LfDI BW § 8 Abs. 6 optional; EDPB Rn. 145).
- **Subprozessoren:** Vor-Ort-Audits bei Google, Vercel oder Supabase kann unslop nicht vermitteln. Der AVV sollte ehrlich sagen, dass die Auditrechte gegenüber den Subs sich nach deren DPAs richten. Beispiele:
  - Google: Audits „if required under Applicable Privacy Law“, mit Gebühr (CDPA 7.5)
  - Supabase: 1× jährlich, 30 Tage Vorlauf
  - Vercel: Audit-Report statt Vor-Ort
  - Der Nachweis gegenüber dem Kunden erfolgt über deren Berichte und Zertifikate.

### 8.3 Löschung nach Vertragsende

| Quelle | Frist/Mechanik |
|---|---|
| Art. 28 Abs. 3 lit. g [P] | Nach Wahl löschen oder zurückgeben, außer bei Speicherpflicht. Keine Frist. |
| EDPB Rn. 141 [P] | Bestätigung „within an agreed timescale“ |
| SCC 10 d [P] | Löschung plus Bescheinigung |
| BayLDA Ziff. 9 [P] | Bestätigung „mit Datumsangabe“ |
| Google CDPA 6.2 [A] | bis zu 30 Tage Recovery, danach Löschung „within a maximum period of 180 days“ |
| Supabase DPA 11.2 [A] | Export auf Verlangen binnen 30 Tagen (Retention Period), danach Löschung |
| Vercel DPA 12 [A] | „within a commercially reasonable timeframe“ |

**Vorschlag (Einschätzung):**
- Export der Findings auf Verlangen bis 30 Tage nach Vertragsende.
- Danach Löschung in den Produktivsystemen binnen weiterer 30 Tage, mit Bestätigung per E-Mail und Datum.
- Backups sind nur zuzusagen, wenn sie existieren. Im Supabase-**Free**-Plan gibt es keine, bei Pro rollen sie nach 7 Tagen aus. PITR ist zu prüfen.
- Hinweis auf Löschfristen der Subs (Google bis 180 Tage).
- **Voraussetzung:** Das Löschkonzept muss erst gebaut sein. Im Code ist es aktuell nicht belegt, siehe 5.2.

### 8.4 Meldefrist bei Datenpannen

Vorschlag: „unverzüglich, spätestens innerhalb von 48 Stunden nach Kenntnis“.
- 24 Stunden wären laut Bitkom üblich. Für eine Person ohne Vertretung sind sie aber realistisch nur mit Rufbereitschaft zu halten.
- Supabase sagt 48 Stunden „where feasible“ zu.
- Eine kürzere Frist nur zusagen, wenn Monitoring und Alerting belegt sind.

---

## 9. Rolle von GitHub

**Befund:** Eine behördliche Aussage zu genau dieser Konstellation habe ich **nicht gefunden**. Die Einordnung bleibt **nicht verifiziert**.

**Primär- und Anbieterbelege:**
- **GitHub Privacy Statement** [A] (gültig ab 27.04.2026, https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement): „Upon your instruction, we may share Personal Data with third-party applications available on our Marketplace.“ „You are responsible for the data you instruct us to share with these applications.“ „When you use third-party extensions, integrations […] the privacy policies of these third parties apply […]“.
- **GitHub ToS** [A] (https://docs.github.com/en/site-policy/github-terms/github-terms-of-service), Abschnitt „Additional Terms“: „you may download an application that integrates with GitHub; […] other parties' terms govern their relationships with you.“
- **GitHub-DPA** (Oktober 2025) [A]: „forms part of the GitHub Customer Agreement between Customer […] and GitHub, Inc.“ Auftraggeber von GitHub ist also **der Kunde**, soweit er einen solchen Vertrag hat. Laut [S] betrifft das Enterprise Cloud, Team und Copilot, ob das auch für Free-Organisationen gilt, ist **nicht verifiziert**.
- **Webhook-Protokolle** [A]: „You can view details about webhook deliveries from the past 3 days.“ Quelle: https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries. Webhook-Payloads, also potenziell PR-Metadaten, liegen damit bis zu 3 Tage in der App-Verwaltung von unslop bei GitHub.
- **DSK KP 13 Anhang B** [P]: Keine Auftragsverarbeitung liegt vor, wenn Fachleistungen eines eigenständig Verantwortlichen in Anspruch genommen werden. **EDPB Rn. 40**: Die Empfängerkategorien sind ein „essential means“ des Verantwortlichen.

**Einschätzung (nicht verifiziert):**
- **Regelfall:** Der Kunde betreibt seine Repositories bei GitHub, GitHub ist **sein** Dienstleister bzw. Auftragsverarbeiter. Mit der Installation der App weist der Kunde GitHub an, Daten an unslop zu übermitteln. unslop liest per API und schreibt Kommentare **in das GitHub-Konto des Kunden** zurück. GitHub verarbeitet dabei nicht „im Auftrag von unslop“, sondern im Auftrag des Kunden. **GitHub ist dann kein Unterauftragsverarbeiter von unslop.**
- **Grauzone:** Die Speicherung der Webhook-Deliveries (3 Tage) in der App von unslop sowie die GitHub-Konten und Tokens von unslop selbst. Hier könnte man GitHub als Dienstleister von unslop sehen, denn unslop ist ebenfalls GitHub-Nutzer unter den GitHub Terms.
- **Marktpraxis ist uneinheitlich [S]:** CodeAnt AI führt „Github App“ als Subprozessor (https://codeantai.trust.site/subprocessors). Die Liste von CodeRabbit war nicht abrufbar (https://trust.coderabbit.ai/subprocessors), das ist **nicht verifiziert**.
- **Pragmatische Empfehlung:** GitHub im AVV **transparent als „Plattform des Kunden / Empfänger auf Weisung des Kunden“** aufführen, nicht als genehmigungspflichtigen Sub. Zusätzlich erklären, dass Webhook-Payloads bis zu 3 Tage bei GitHub in der App-Konfiguration einsehbar bleiben. Wer auf Nummer sicher gehen will, listet GitHub **zusätzlich** in Anhang IV mit dem Vermerk „nur Webhook-Zustellprotokolle“. Das kostet wenig und nimmt dem Kunden eine Frage ab.
- **CLI/IDE/MCP-Pfad:** Hier ist GitHub nicht beteiligt. Code gelangt per API-Key direkt zu unslop.

**Weitere Rollen (Einschätzung):**
- **Paddle:** Merchant of Record und nach eigener Angabe eigenständiger Verantwortlicher für Zahlungs-, Steuer- und Rechnungsdaten. Der Käufer „is actually contracting with us rather than the seller“ [A] (https://www.paddle.com/legal/gdpr). Paddle ist damit **kein** Sub für Kundencode-Daten.
- **Brevo:** Wird nur für die Waitlist genutzt, also Daten, für die unslop selbst verantwortlich ist. Brevo gehört nicht in den Kunden-AVV, solange keine Kundendaten aus dem Auftrag dorthin fließen.
- **Proton:** Proton ist Sub, **falls** Support-Tickets Auftragsdaten enthalten, etwa weitergeleitete Findings oder Code. Die Einordnung und der Proton-DPA sind **nicht verifiziert**.

---

## (a) Empfohlene Struktur des AVV (inkl. Anlagen)

**Titel:** „Vereinbarung zur Auftragsverarbeitung (AVV) gemäß Art. 28 DSGVO – unslop, Version X.Y vom TT.MM.JJJJ“
**Form:** Anlage zu den B2B-Nutzungsbedingungen, Annahme per Click-through, dazu signierbares PDF auf Anfrage.

1. **Präambel und Geltungsbereich:** Gilt für alle Verarbeitungen im Auftrag über GitHub App, CLI, IDE und MCP. Vorrang vor den AGB bei Widerspruch (vgl. SCC Kl. 4, Bitkom).
2. **Begriffe:** Verweis auf Art. 4 DSGVO.
3. **Gegenstand, Dauer, Art und Zweck:** Verweis auf Anlage 2. Laufzeit folgt dem Hauptvertrag. Der AVV gilt fort, bis alle Daten gelöscht sind (vgl. SCC 10 d, LfDI BW § 13 Abs. 3).
4. **Weisungen:**
   - Die Erstweisung ist der AVV samt Produktkonfiguration.
   - Weitere Weisungen in Textform an eine benannte Adresse.
   - Klausel zu gesetzlichen Verarbeitungspflichten im Wortlaut von Art. 28 Abs. 3 lit. a (Opinion 22/2024).
   - Hinweispflicht bei rechtswidrigen Weisungen und Recht, die Ausführung auszusetzen (Bitkom § 3 Abs. 2).
   - Weisungen außerhalb des Leistungsumfangs gelten als Änderungsantrag (Bitkom § 2 Abs. 2).
5. **Zweckbindung, keine Eigennutzung:** Kein Training, keine Benchmarks, keine Produktverbesserung mit Kundendaten, außer bei gesonderter Vereinbarung (Art. 28 Abs. 10).
6. **Vertraulichkeit:** Art. 28 Abs. 3 lit. b, Art. 29, Art. 32 Abs. 4.
7. **TOMs:**
   - Verweis auf Anlage 3.
   - Änderungen nur ohne Absenkung des Niveaus.
   - Wesentliche Änderungen mit Mitteilung (EDPB Rn. 126).
   - Jährliche Überprüfung (Art. 32 Abs. 1 lit. d; BayLDA Ziff. 8).
8. **Unterauftragsverarbeiter:**
   - Allgemeine Genehmigung für die Liste in Anlage 4 samt Auswahlkriterien (EDPB Rn. 156, Opinion Rn. 54).
   - Änderungsverfahren nach Abschnitt (c).
   - Weitergabe gleichwertiger Pflichten (Art. 28 Abs. 4).
   - Haftung für Subs (Art. 28 Abs. 4 S. 2).
   - Kopien bzw. Links der Sub-DPAs auf Anfrage (Opinion Rn. 65).
   - Proaktive und aktuelle Kettenangaben mit Name, Anschrift, Kontakt und Tätigkeit (Opinion Rn. 31 f.).
9. **Drittlandübermittlungen:** Nur wie in Anlage 4 dokumentiert, mit Mechanismus pro Sub (DPF/SCC Modul 3), Transfer-Mapping und TIA auf Anfrage sowie gesonderter Regel zum `global`-Endpoint (Kapitel 6.3).
10. **Unterstützung bei Betroffenenrechten:** Anfragen unverzüglich weiterleiten, nicht selbst beantworten (SCC 8 a). Technische Unterstützung durch Export und Löschung auf Anfrage.
11. **Unterstützung nach Art. 32–36:** Informationen für DSFA und Konsultation.
12. **Datenpannen:** Meldung unverzüglich, spätestens binnen 48 Stunden. Mindestinhalt nach SCC 9.2, schrittweise Nachlieferung erlaubt. Kanal: E-Mail an die hinterlegte Adresse des Kunden. Keine Meldung an Behörden im Namen des Kunden ohne Weisung (BayLDA Ziff. 6).
13. **Nachweise und Kontrollen:**
    - Nachweis vorrangig durch Dokumente (Anlage 3, Zertifikate der Subs, Selbstauskunft).
    - Vor-Ort-Prüfung mit 30 Tagen Vorankündigung zu Geschäftszeiten, regulär max. 1× pro Jahr, anlassbezogen jederzeit.
    - Prüfer nicht im Wettbewerb, Vertraulichkeit.
    - Jede Partei trägt ihre Kosten (Bitkom Option 2, EDPB Rn. 145).
    - Hinweis auf Homeoffice als Arbeitsort und Verfahren dazu (BayLDA Ziff. 5).
14. **Löschung und Rückgabe nach Vertragsende:** Fristen nach 8.3, schriftliche Bestätigung, Hinweis auf Fristen der Subs und auf Backups.
15. **Mitteilungspflichten bei Gefährdung:** Pfändung, Beschlagnahme, Insolvenz (Bitkom § 10 Abs. 1, LfDI BW § 7 Abs. 5).
16. **Haftung:** Verweis auf Art. 82. Im Übrigen gilt die Haftungsregel des Hauptvertrags (Bitkom § 9 V2). Die konkrete Ausgestaltung ist anwaltlich zu prüfen.
17. **Änderungen des AVV und Versionierung:** Direkte Mitteilung per E-Mail mit Frist, Sonderkündigungsrecht bei nachteiliger Änderung, Archiv der Versionen (EDPB Rn. 110).
18. **Schlussbestimmungen:** Textform, deutsches Recht, Gerichtsstand, salvatorische Klausel.

**Anlagen, angelehnt an die Anhänge I–IV der SCC:**

- **Anlage 1: Parteien und Kontakte.**
  - Verantwortlicher: aus dem Kundenkonto.
  - unslop UG: Anschrift Bebra, GF als Kontakt, Datenschutz-E-Mail, Hinweis „kein DSB (§ 38 BDSG nicht erfüllt)“.
  - Weisungsberechtigte und Kanäle (BayLDA Ziff. 4, LfDI BW Anlage 4).
- **Anlage 2: Beschreibung der Verarbeitung** (SCC Anhang II):
  - **Betroffene:** Entwickler und Committer des Kunden, in Code oder Kommentaren genannte Personen, Personen in Test-Fixtures.
  - **Daten:** PR-Diffs und Code-Ausschnitte, Commit-Metadaten (Name, E-Mail, GitHub-Login), Findings und Kommentare, Account- und Nutzungsdaten, API-Key-Metadaten.
  - **Sensible Daten:** nicht vorgesehen. Der Kunde soll keine Art.-9-Daten in Code oder Fixtures einbringen. Falls es doch geschieht, gelten die Beschränkungen nach SCC 7.5.
  - **Art:** Abruf, Übermittlung an ein LLM (Vertex AI, EU), Analyse, Speicherung der Ergebnisse, Rückschreiben an GitHub.
  - **Zweck:** automatisiertes Code-Review im Auftrag.
  - **Dauer:** Vertragslaufzeit, Speicherfristen je Datenart.
  - **Pro Sub:** Gegenstand, Art und Dauer (SCC Anhang II, letzter Satz).
- **Anlage 3: TOMs**, siehe (b).
- **Anlage 4: Unterauftragsverarbeiter.** Pro Eintrag: Name, Anschrift, Kontakt, Tätigkeit, Datenort, Drittland/Mechanismus, Link zum DPA und zur Sub-Sub-Liste. Die Liste liegt zusätzlich unter einem stabilen Link (Bitkom § 7 Abs. 3).
  - Google Cloud (Vertex AI; EU-Multiregion, Rollback `global`)
  - Supabase Pte. Ltd (DB; Region: offen; Infrastruktur AWS; Singapur/USA → SCC)
  - Vercel Inc. (Hosting und Funktionen; `fra1`; USA → DPF/SCC; **DPA nur bei Pro/Enterprise**)
  - ggf. Proton AG (Support)
  - GitHub mit Rollenvermerk (Kapitel 9)
- **Anlage 5, optional: Meldebogen Datenschutzvorfall** (Bitkom Anlage 2) und Vorlage für Weisungen (EDPB Rn. 118).

---

## (b) TOMs-Gliederung für eine Solo-UG mit ehrlichen Formulierungsvorschlägen

Die Gliederung folgt Art. 32 Abs. 1 lit. a–d und der Maßnahmenliste in Anhang III der SCC 2021/915. **[✓]** heißt im Code oder beim Anbieter belegt, **[?]** heißt vor Aufnahme prüfen bzw. bauen.

**0. Vorbemerkung (Formulierungsvorschlag):**
> „unslop wird von einer Person (Geschäftsführer) betrieben. unslop betreibt keine eigenen Rechenzentren oder Server; sämtliche Verarbeitung erfolgt bei den in Anlage 4 genannten Unterauftragsverarbeitern. Physische Sicherheit, Hardware-Verschlüsselung, Redundanz und Rechenzentrumsbetrieb sind Maßnahmen dieser Anbieter und werden durch deren Zertifizierungen belegt (Abschnitt 7). Die nachfolgenden Maßnahmen beschreiben, was unslop selbst verantwortet. unslop verfügt über keine eigene Zertifizierung.“

**1. Pseudonymisierung und Verschlüsselung (lit. a)**
- **Transport:** „Alle Verbindungen zu GitHub-API, Vertex AI, Supabase und zum unslop-Dienst erfolgen TLS-verschlüsselt.“ Belege: Google-Global/Regional-Endpoints terminieren TLS, Vercel „HTTPS / TLS“, Supabase „TLS“. **[✓ Anbieter]**
- **Ruhende Daten:** „Ruhende Daten werden durch die Anbieter verschlüsselt (Google: AES-256 standardmäßig; Supabase: AES-256; Vercel: AES-256).“ **[✓ Anbieter]**
- **API-Keys:** „API-Schlüssel werden nur als Hash gespeichert.“ **[? Code-Treffer, Detail prüfen]**
- **Pseudonymisierung:** „Eine Pseudonymisierung der Code-Inhalte erfolgt nicht, da der Zweck (Code-Review) den Klartext erfordert.“ Das ehrlich sagen und keine Pseudonymisierung behaupten.

**2. Vertraulichkeit (lit. b)**
- **Zugang und Identität:** „Zugang zu Admin-Konsolen (Google Cloud, Supabase, Vercel, GitHub) ausschließlich für den Geschäftsführer, mit Zwei-Faktor-Authentifizierung.“ **[? für jedes Konto bestätigen]**
- **Least Privilege:** „Dienst-Zugangsdaten (Service-Role-Key, Vertex-Service-Account, GitHub-App-Private-Key) werden ausschließlich als Umgebungsvariablen im Hosting-Anbieter gespeichert, nicht im Quellcode.“ **[? prüfen]**
- **Mandantentrennung:** „Kundendaten sind logisch nach Installation/Organisation getrennt.“ Nennen, wie das umgesetzt ist, etwa RLS oder Filter auf Server-Seite. **[? prüfen]**
- **Eingangsprüfung:** „Eingehende GitHub-Webhooks werden per HMAC-Signatur (X-Hub-Signature-256) geprüft.“ **[✓ Code-Treffer]**
- **Endgerät:** „Arbeitsgerät mit Festplattenverschlüsselung, Bildschirmsperre, aktuellem Betriebssystem; Arbeitsort Homeoffice; keine dauerhafte lokale Speicherung von Kundendaten.“ **[? bestätigen]**
- **Personal:** „Keine weiteren Personen mit Zugriff. Vor Einbindung weiterer Personen erfolgt eine schriftliche Vertraulichkeitsverpflichtung.“

**3. Integrität (lit. b)**
- „Änderungen am Code nur über Pull-Requests mit automatisierten Tests; Deployments über Vercel mit nachvollziehbarer Versionshistorie.“ **[? prüfen]**
- „Protokollierung von Verarbeitungsläufen (Job-Status) in der Datenbank; Logs beim Hosting-Anbieter.“ Aufbewahrungsdauer der Logs angeben. **[? prüfen]**

**4. Verfügbarkeit und Belastbarkeit (lit. b)**
- „Hosting auf Vercel (Funktionsregion Frankfurt `fra1`), Datenbank bei Supabase; Verfügbarkeit gemäß deren Infrastruktur.“ **[✓ `fra1` im Code]**
- **Ehrlich:** „unslop gibt keine eigene Verfügbarkeitszusage (SLA) ab“, sofern keine vereinbart ist.

**5. Wiederherstellbarkeit (lit. c)**
- Nur zutreffendes aufnehmen:
  - **Bei Free-Plan:** „Supabase erstellt im aktuellen Tarif keine automatischen Backups; unslop erstellt [manuelle Exporte per `db dump` in Intervall X / keine].“
  - **Bei Pro:** „Tägliche Backups mit 7 Tagen Aufbewahrung durch Supabase.“ **[? Plan prüfen]**
- „Der Anwendungscode ist in einem Git-Repository versioniert und kann neu deployt werden.“
- „Kundencode selbst wird nicht dauerhaft vorgehalten; Wiederherstellung erfolgt durch erneutes Abrufen aus dem GitHub-Repository des Kunden.“ **[? prüfen, ob Diffs gespeichert werden]**

**6. Verfahren zur regelmäßigen Überprüfung (lit. d)**
- „Mindestens jährliche Überprüfung dieser TOMs sowie anlassbezogen (neuer Unterauftragsverarbeiter, Sicherheitsvorfall, wesentliche Architekturänderung); Ergebnis wird dokumentiert und auf Anfrage vorgelegt.“ So auch im BayLDA-Muster, Ziff. 8.
- „Jährliche Prüfung der Zertifikate und DPAs der Unterauftragsverarbeiter.“

**7. Maßnahmen und Zertifizierungen der Unterauftragsverarbeiter**, mit Links (Kapitel 5.1):
- **Google Cloud:** ISO/IEC 27001/27017/27018, SOC 1/2/3 (Scope: „Generative AI on Vertex AI“)
- **Vercel:** SOC 2 Type 2, ISO/IEC 27001
- **Supabase:** SOC 2 Type 2, ISO 27001

**8. Datenminimierung und Speicherbegrenzung**
- „An das KI-Modell werden nur die für das Review erforderlichen Diff-Ausschnitte übermittelt.“
- Explicit Cache: „Der Kontext-Cache bei Vertex AI enthält nach Implementierung nur statische Prüfregeln, keine Kundendaten (TTL 1 h).“ **[? verifizieren]**
- **Google-seitig:** „Kein Modelltraining mit Kundendaten (Google Training Restriction). Google puffert Ein- und Ausgaben standardmäßig bis 24 h im Arbeitsspeicher; unslop hat dies [deaktiviert/nicht deaktiviert].“ **[? Projekteinstellung prüfen, ggf. deaktivieren]**
- **Prompt-Logging zur Missbrauchserkennung:** [Ausnahme beantragt / nicht beantragt]. **[?]**
- **Speicherfristen je Datenart:** Findings X Tage/Monate, Job-Metadaten Y, Löschung nach Vertragsende nach 8.3. **[? erst nach Bau des Löschkonzepts zusagen]**

**9. Rechenschaft, Incident-Response**
- „Datenpannen werden dokumentiert; Meldung an Kunden binnen 48 h (Kapitel 8.4); Kontakt: [E-Mail].“
- **Ehrlich:** „Es besteht derzeit keine personelle Vertretung; bei Abwesenheit > X Tage [Regelung].“

**10. Datenübertragbarkeit und Löschung**
- „Export der Findings auf Anfrage in maschinenlesbarem Format; Löschung auf Weisung bzw. nach Vertragsende gemäß § 14 AVV.“ **[? Funktion prüfen]**

---

## (c) Vorschlag für das Verfahren bei Subprozessor-Änderungen

Einschätzung, gestützt auf Art. 28 Abs. 2, SCC 7.7 Option 2, EDPB Rn. 156–158, DSK KP 13, Bitkom § 7 und die Marktpraxis in 7.2.

1. **Genehmigungsform:** allgemeine schriftliche Genehmigung für die Liste in Anlage 4, verbunden mit **Auswahlkriterien**:
   - Sitz in der EU/im EWR **oder** DPF-Zertifizierung bzw. SCC mit TIA
   - DPA nach Art. 28 Abs. 4
   - anerkannte Sicherheitszertifizierung (ISO 27001 oder SOC 2 Typ 2) **oder** gleichwertige dokumentierte TOMs
2. **Ankündigungsfrist:** **30 Kalendertage** vor Beginn der Verarbeitung durch den neuen Sub.
   - Begründung: Google und Supabase nutzen 30 Tage, Bitkom nennt mindestens 14. 30 Tage geben dem Kunden Zeit für die nach Opinion 22/2024 geforderte Prüfung.
   - Solange unslop nur wenige Subs hat, ist das operativ tragbar. Kritisch ist die Frist nur für Notfälle (Punkt 6).
3. **Kanal:**
   - **aktive E-Mail an die Datenschutz-Kontaktadresse jedes Kunden**, im Dashboard pflegbar, mit Fallback auf die Account-Adresse
   - **zusätzlich** Changelog auf der öffentlichen Subprozessor-Seite mit RSS/Atom-Feed
   - Kein reines Abo-Modell (EDPB Rn. 110; Art. 28 Abs. 2 „immer“)
4. **Inhalt der Mitteilung** (Opinion Rn. 22 und 55): Name, Anschrift, Kontakt, Tätigkeit, Datenkategorien, Ort und Drittland, Transfermechanismus, Link zum DPA und zu Zertifikaten, geplantes Startdatum.
5. **Einspruch:**
   - binnen **14 Kalendertagen** ab Zugang, in Textform, aus datenschutzrechtlich begründetem Anlass (so Bitkom und Vercel)
   - Schweigen gilt als Zustimmung (EDPB Rn. 157)
   - Bei Einspruch sucht unslop binnen 14 Tagen eine Lösung, etwa den Verzicht auf den Sub für diesen Kunden oder eine Konfigurationsoption.
   - Gelingt das nicht, hat der Kunde ein **Sonderkündigungsrecht** für die betroffene Leistung mit **anteiliger Erstattung** vorausbezahlter Entgelte (DSK KP 13: Unterbindung per Weisung oder Beendigung).
   - Hinweis: Die Klausel von Vercel, Kündigung „with no refunds“, ist kundenunfreundlich. Für eine Solo-UG, die Vertrauen aufbauen muss, ist eine Erstattung die bessere Wahl. Das ist eine Geschäftsentscheidung.
6. **Notfallklausel** (Bitkom § 7 Abs. 2): Bei akutem Sicherheitsrisiko oder Ausfall eines Subs ist ein sofortiger Wechsel zulässig. Unverzügliche nachträgliche Mitteilung, das Einspruchsrecht gilt dann ab Mitteilung.
7. **Kettenänderungen bei Sub-Subs:** Ändert ein Sub die eigene Subprozessorliste, gibt unslop die Änderung weiter, sobald unslop sie erfährt. Dafür abonniert unslop die Listen von Google, Supabase und Vercel (Opinion Rn. 32: proaktiv und aktuell). Für diese Weitergabe gilt **keine** eigene 30-Tage-Frist, da unslop sie nicht steuern kann. Das ist offen zu sagen.
8. **Dokumentation:** Die Versionshistorie der Anlage 4 wird archiviert. Mitteilungen werden mit Zeitstempel protokolliert.

---

## (d) Offene Fragen

1. **Vercel-Plan:** Hobby, Pro oder Enterprise? Der Vercel-DPA gilt laut Wortlaut nur für Pro und Enterprise. Ohne ihn fehlt der Vertrag nach Art. 28 Abs. 4 mit Vercel. Das ist **blockierend für einen B2B-AVV**.
2. **Supabase-Plan und -Region:** Free, also ohne Backups, oder Pro? Welche AWS-Region? Die Region ist wegen der gestörten Management-Ebene **blocked: tooling / nicht verifiziert**. Vertragspartner ist laut DPA v1 die **Supabase Pte. Ltd (Singapur)**. Ist das DPA im Konto akzeptiert bzw. dokumentiert?
3. **Google Cloud:** Ist die CDPA für das Projekt wirksam (Billing-Konto, Vertragspartner Google Cloud EMEA vs. Google LLC)? Ist In-Memory-Caching deaktiviert? Wurde eine Ausnahme vom Prompt-Logging beantragt? Wie wird der `global`-Rollback-Pfad vertraglich behandelt: offenlegen oder per Default für EU-only-Kunden sperren?
4. **Explicit Cache:** Laut Code-Kommentar enthält er nur statische Regeln. Ist per Test oder Log belegt, dass kein Kundencode im Cache landet?
5. **Speicherung von Kundendaten:** Welche Tabellen enthalten Diffs, Code-Snippets (`fixed_code_snippet`, Findings) oder Commit-Autoren, und wie lange? Ein Lösch- bzw. Retention-Konzept ist im Code **nicht belegt**. Es ist vor jeder Fristzusage zu bauen.
6. **Eigennutzung:** Fließen Kundendaten in Benchmarks, Fixtures, Telemetrie oder Prompt-Tuning? Falls ja, braucht es eine gesonderte Vereinbarung oder Anonymisierung, sonst droht Art. 28 Abs. 10.
7. **GitHub-Rolle:** endgültig festlegen (Kapitel 9). Soll GitHub in Anlage 4 mit Rollenvermerk erscheinen?
8. **Proton:** Enthalten Support-Kontakte Auftragsdaten? Gibt es einen Proton-DPA? Die Schweiz hat einen EU-Angemessenheitsbeschluss, das habe ich in dieser Recherche **nicht verifiziert**.
9. **Vertretung und Erreichbarkeit:** Welche Meldefrist ist ehrlich haltbar, 24 oder 48 Stunden? Gibt es eine Urlaubs- oder Krankheitsregelung?
10. **Homeoffice-Kontrollrecht:** Wie wird ein Vor-Ort-Audit praktisch geregelt? Ein Remote-Audit per Screen-Share ist denkbar. Das BayLDA-Muster verlangt bei Verarbeitung in Privatwohnungen Zustimmung und Kontrollzugang.
11. **Haftungsklausel:** Cap-Höhe und Ausnahmen (Vorsatz, grobe Fahrlässigkeit, Datenschutzpflichten) sowie die AGB-Wirksamkeit nach § 307 BGB sind **anwaltlich zu prüfen**.
12. **Drittbegünstigtenklausel (SCC 7.7 e):** Falls ein Enterprise-Kunde die SCC 2021/915 verlangt: Bieten die DPAs von Google, Supabase und Vercel ein Äquivalent? **Nicht verifiziert.**
13. **Supabase- und Vercel-DPF:** Den Status in der DPF-Liste habe ich nicht direkt abgerufen (JS-App). Für Supabase war kein Eintrag auffindbar, das ist nur [S].
14. **CJEU C-703/25 P (DPF):** Verfahrensstand beobachten. Liegen Schlussanträge oder ein Urteil vor? **Nicht verifiziert.**
15. **Digital Omnibus:** Gesetzgebungsstand (EP/Rat) beobachten. Art. 28 und 30 sind laut Vorschlag nicht betroffen, Art. 33 Abs. 1 schon.
16. **Verzeichnis nach Art. 30 Abs. 2:** Es muss angelegt werden, eine eigene Aufgabe außerhalb des AVV.
17. **Hosting der AVV-Annahme:** Wo und wie werden Zeitstempel, Version und Akzeptierender protokolliert? Checkout über Paddle oder Registrierung im Dashboard? Das ist technisch zu klären.

---

### Quellenverzeichnis (alle abgerufen am 2026-09-28)

**Primär [P]**
- DSGVO (DE, ABl. L 119/1): https://publications.europa.eu/resource/celex/32016R0679 · ELI https://eur-lex.europa.eu/eli/reg/2016/679/oj
- DB (EU) 2021/915 (DE, ABl. L 199/18): https://publications.europa.eu/resource/celex/32021D0915 · ELI https://eur-lex.europa.eu/eli/dec_impl/2021/915/oj
- EDPB Guidelines 07/2020 v2.1: https://www.edpb.europa.eu/system/files/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf
- EDPB Opinion 22/2024: https://www.edpb.europa.eu/system/files/2024-10/edpb_opinion_202422_relianceonprocessors-sub-processors_en.pdf
- DSK Kurzpapier Nr. 13 (Stand 17.12.2018): https://www.datenschutzkonferenz-online.de/media/kp/dsk_kpnr_13.pdf
- BayLDA Formulierungshilfe AV: https://www.lda.bayern.de/media/muster/formulierungshilfe_av.pdf
- BayLDA Auslegungshilfe Formerfordernis (15.05.2019): https://www.lda.bayern.de/media/veroeffentlichungen/FAQ_ADV_Formerfordernis.pdf
- LfDI BW Muster-AVV (DE/EN): https://www.baden-wuerttemberg.datenschutz.de/wp-content/uploads/2020/12/200429_AVV-Muster_DE_neu.pdf · https://www.baden-wuerttemberg.datenschutz.de/wp-content/uploads/2020/12/200528_AVV-version_EN_new.pdf · https://www.baden-wuerttemberg.datenschutz.de/praxishilfen/
- EuG PM 106/25 (T-553/23): https://curia.europa.eu/site/upload/docs/application/pdf/2025-09/cp250106en.pdf
- COM(2025) 837 final (Digital Omnibus): https://publications.europa.eu/resource/cellar/ebf17714-c56e-11f0-8da2-01aa75ed71a1.0001.02/DOC_1
- BGB § 126b, § 305b, § 307, § 309, § 310: https://www.gesetze-im-internet.de/bgb/ (jeweilige §-Seiten, siehe Text) · BDSG § 38: https://www.gesetze-im-internet.de/bdsg_2018/__38.html

**Verband [V]**
- Bitkom Mustervertragsanlage v1.3 (2025): https://www.bitkom.org/sites/main/files/2023-01/230123LFMustervertragsanlage.pdf
- Bitkom Begleitende Hinweise v1.2 (11/2025): https://www.bitkom.org/sites/main/files/2025-12/bitkom-leitfaden-auftragsverarbeitung.pdf
- Übersicht: https://www.bitkom.org/Bitkom/Publikationen/Praxisleitfaeden-zur-Auftragsverarbeitung

**Anbieter [A]**
- Google: https://cloud.google.com/security/compliance/services-in-scope · https://docs.cloud.google.com/docs/security/encryption/default-encryption · https://cloud.google.com/terms/data-processing-addendum (zuletzt geändert 08.06.2026) · https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention · https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency · https://policies.google.com/privacy/frameworks?hl=en-US
- Vercel: https://vercel.com/legal/dpa (Last Updated 17.03.2026) · https://vercel.com/security · https://security.vercel.com/
- Supabase: https://supabase.com/legal/dpa (Version 1, 01.08.2026) · https://supabase.com/security · https://supabase.com/docs/guides/platform/backups · https://supabase.com/legal/customer-resources/subprocessor-list
- GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement · https://docs.github.com/en/site-policy/github-terms/github-terms-of-service · https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries · GitHub DPA 10/2025: https://assets.ctfassets.net/8aevphvgewt8/9rRh60u9m8AJGCKPHSnkI/f665de2992d6aa66bab425d19a559dd1/TPL-202510-GitHubDataProtectionAgreement.pdf
- Paddle: https://www.paddle.com/legal/gdpr

**Sekundär [S]**
- DPF-Status 2026 / C-703/25 P: https://europeanmartech.eu/blog/eu-us-data-privacy-framework-2026-status · https://iapp.org/news/a/european-general-court-dismisses-latombe-challenge-upholds-eu-us-data-privacy-framework
- Digital-Omnibus-Stand: https://www.brightdefense.com/news/eu-digital-omnibus-seeks-96-hour-gdpr-breach-deadline/
- Marktpraxis GitHub als Sub: https://codeantai.trust.site/subprocessors
