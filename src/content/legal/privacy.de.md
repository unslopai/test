# Datenschutzerklärung

Stand: [DATUM DES INKRAFTTRETENS]

Diese Erklärung beschreibt, welche personenbezogenen Daten wir verarbeiten, wenn Sie unslop.codes besuchen, ein Konto anlegen oder unseren Dienst nutzen: die GitHub App, die Kommandozeile (CLI), die VS-Code-Erweiterung und den MCP-Server. Sie beschreibt nur, was tatsächlich geschieht.

## 1. Verantwortlicher

unslop UG (haftungsbeschränkt)
Hegenstraße 8, 36179 Bebra, Deutschland
Vertreten durch den Geschäftsführer Luca Maximilian Zell
E-Mail: unslopai@protonmail.com
Telefon: [TELEFONNUMMER]

Einen Datenschutzbeauftragten haben wir nicht benannt, weil keine gesetzliche Pflicht dazu besteht (Art. 37 DSGVO, § 38 BDSG). Für alle Datenschutzfragen erreichen Sie uns unter der E-Mail-Adresse oben.

## 2. Überblick: wofür wir verantwortlich sind und wofür unsere Kunden

- **Wir sind Verantwortlicher** für die Daten, die wir für eigene Zwecke verarbeiten: den Besuch der Website, Ihr Konto und die Anmeldung, die Abrechnung, die Warteliste und Anfragen an uns.
- **Für den Quellcode, den uns Unternehmen zur Prüfung übermitteln, sind wir deren Auftragsverarbeiter**, sobald wir mit ihnen einen Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO geschlossen haben. Den Code wählt der Kunde aus, und wir verarbeiten ihn nur, um den Review für ihn zu erstellen. Code kann personenbezogene Daten enthalten, etwa Namen und E-Mail-Adressen in Kommentaren, Konfigurationen oder Testdaten. Verantwortlich für diese Daten ist dann der Kunde. Wenn Sie in einem Repository eines solchen Kunden mitarbeiten, wenden Sie sich mit Fragen zu diesen Daten bitte an ihn.
- **Nutzen Sie unslop als Verbraucher oder ohne AVV**, sind wir auch für die Verarbeitung Ihres Codes selbst verantwortlich (Abschnitt 6.5).

Code, den Sie uns zur Prüfung übermitteln, verwenden wir nicht für eigene Zwecke. Wir trainieren damit keine KI-Modelle, und auch unsere Dienstleister tun das nicht (Abschnitt 6.3). [VORBEDINGUNG V1: Vercel Pro aktiv, Model Training in Vercel abgeschaltet] [VORBEDINGUNG V20: keine Auswertung von Kundendaten außerhalb des einzelnen Auftrags; SPEC §12.4 G2 auf eigene Repos, OSS oder Opt-in umgestellt; Verdict-Audit auf Fehleranalyse des einzelnen Auftrags beschränkt]

## 3. Besuch der Website und Hosting

Die Website und die Anwendung betreibt Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA, als unser Auftragsverarbeiter. [VORBEDINGUNG V1: Vercel Pro mit DPA aktiv] Die Server-Funktionen laufen in der Vercel-Region Frankfurt (`fra1`). Anfragen nimmt der Ihnen nächstgelegene Vercel-Netzknoten entgegen und leitet sie weiter. Dort kann auch die vorgeschaltete Prüfung laufen, ob Sie angemeldet sind.

Bei jedem Aufruf verarbeitet Vercel technisch notwendige Daten: Ihre IP-Adresse, Datum und Uhrzeit, die aufgerufene Adresse samt Parametern, den HTTP-Status, den Browser-Typ (User-Agent) und die Netzregion. Diese Daten landen in den Laufzeitprotokollen von Vercel. Außerdem schreibt unsere Anwendung eigene Protokollzeilen dorthin, etwa Repository- und Dateinamen, GitHub-Kontonamen, Paddle-Kennungen, einen kurzen Auszug der Suchanfrage aus einem geprüften Diff und im Fehlerfall kurze Ausschnitte der Modellantwort und damit des geprüften Codes. Vercel stellt uns die Laufzeitprotokolle in unserem Tarif einen Tag lang zur Einsicht bereit; wie lange Vercel sie intern aufbewahrt, legt Vercel fest. [VORBEDINGUNG V1]

Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist, die Website auszuliefern, Fehler zu finden und Angriffe abzuwehren.

## 4. Cookies und lokale Speicherung

Wir setzen nur Cookies und lokale Speicherungen, die für den von Ihnen gewünschten Dienst unbedingt erforderlich sind (§ 25 Abs. 2 Nr. 2 TDDDG). Wir verwenden keine Analyse-, Werbe- oder Tracking-Werkzeuge. Deshalb gibt es auch kein Einwilligungsbanner.

| Name | Zweck | Speicherdauer | Wo |
|---|---|---|---|
| `sb-…-auth-token` (bei großer Sitzung in Teilen `.0`, `.1`, …) | hält Sie nach der Anmeldung angemeldet; enthält Ihre Sitzung mit Ihren GitHub-Kontoangaben, nach der Anmeldung auch Ihr GitHub-Zugriffstoken, bis Ihre Sitzung zum ersten Mal erneuert wird (beim ersten Aufruf nach Ablauf der Anmeldung, standardmäßig nach einer Stunde; rufen Sie unslop danach nicht mehr auf, bis zur Abmeldung, höchstens 400 Tage) [ENTFÄLLT NACH V19] | bis zur Abmeldung, höchstens 400 Tage | Login und Dashboard |
| `sb-…-auth-token-code-verifier` | sichert den Anmeldevorgang mit GitHub ab (PKCE) | bis die Anmeldung abgeschlossen ist, bei abgebrochener Anmeldung höchstens 400 Tage | Login |
| `unslop_locale` | merkt sich die Sprache, die Sie im Dashboard gewählt haben; enthält nur `de` oder `en` | 1 Jahr | Login und Dashboard, nur wenn Sie die Sprache umstellen |
| `unslop.onboarding.path` (Local Storage im Browser) | merkt sich, welchen Einrichtungsweg Sie im Dashboard gewählt haben | bis Sie den Browserspeicher löschen | Dashboard |

Die Marketing-Seiten unter unslop.codes setzen keine eigenen Cookies. Sind Sie im Dashboard angemeldet, wird Ihre Anmeldung auch beim Aufruf dieser Seiten erneuert. Die Sprache ergibt sich aus der Adresse (`/de` oder `/en`).

Auf der Abrechnungsseite im Dashboard lädt Ihr Browser das Zahlungsskript von Paddle (Abschnitt 8). Paddle ist für die dabei eingesetzten Technologien selbst verantwortlich. [PADDLE-COOKIES: nach Browser-Prüfung konkret benennen oder Satz belassen]

## 5. Anmeldung mit GitHub und Ihr Konto

Ein Konto legen Sie an, indem Sie sich mit Ihrem GitHub-Konto anmelden. Andere Anmeldewege gibt es nicht. Die Anmeldung und die Datenbank betreibt Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapur 049513, als unser Auftragsverarbeiter. Ihre Daten liegen in der Supabase-Region Frankfurt (eu-central-1).

Von GitHub erhalten wir bei der Anmeldung Ihre GitHub-Nutzerkennung, Ihren Benutzernamen, Ihre E-Mail-Adresse und die Profilangaben, die GitHub dabei übermittelt. Sie erteilen uns dabei die GitHub-Berechtigungen `user:email` (Lesen der E-Mail-Adressen Ihres GitHub-Kontos, auch nicht öffentlicher), `repo` (Zugriff auf Ihre Repositories, auch private), `admin:repo_hook` (Webhooks in Repositories) und `read:org` (Ihre Mitgliedschaften in Organisationen). Das dabei ausgestellte Zugriffstoken speichern wir in unserer Datenbank verschlüsselt (AES-256-GCM). Wir nutzen es, um Ihnen Ihre Repositories zur Auswahl anzuzeigen, Ihre Berechtigung für eine Installation der GitHub App zu prüfen, ausgewählte Repositories anzubinden und zu prüfen und die Ergebnisse dort zu veröffentlichen (Abschnitt 6).

Zu Ihrem Konto speichern wir außerdem: die verbundenen Repositories und GitHub-App-Installationen, Ihr Abonnement und Ihre Nutzungszähler (Abschnitt 8), Ihre API-Schlüssel (Abschnitt 7) und die Ergebnisse Ihrer Reviews (Abschnitt 6).

Bei der Anmeldung und im Dashboard verbindet sich Ihr Browser direkt mit Supabase, im Dashboard auch für die laufende Aktualisierung des Status Ihrer Repositories (Realtime). Dabei verarbeitet und protokolliert Supabase Ihre IP-Adresse und den Browser-Typ; die Protokolle hält Supabase in unserem Tarif [SUPABASE-LOGFRIST] vor.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertrag über die Nutzung von unslop), für die Protokolle Art. 6 Abs. 1 lit. f DSGVO (Sicherheit und Fehlersuche).

## 6. Die Prüfung von Code

### 6.1 Welche Daten wir verarbeiten

- **GitHub App:** Nachdem Sie oder Ihre Organisation die App installiert haben, schickt uns GitHub Ereignisse zu Installationen, Pull Requests und Check Runs. Wir lesen daraus die Kennung des Repositorys, dessen Namen, die Nummer, Adresse und Commit-Kennung des Pull Requests und die Installationskennung. Den Code holen wir über die GitHub-Schnittstelle: die Änderungen (Diff) des Pull Requests und bei Bedarf den vollständigen Inhalt geänderter Dateien sowie einzelner zugehöriger Konfigurationsdateien (etwa `next.config.*`). Titel, Beschreibung und Autorenangaben des Pull Requests werten wir nicht aus. Zu jeder Installation speichern wir Kennung, Konto-Namen und Kontotyp (Person oder Organisation).
- **Repository-Anbindung ohne GitHub App:** Verbinden Sie ein Repository im Dashboard, über die CLI, die VS-Code-Erweiterung oder den MCP-Server, legen wir mit Ihrem GitHub-Zugriffstoken einen Webhook in diesem Repository an. GitHub schickt uns dann Pull-Request-Ereignisse, die wir wie bei der GitHub App verarbeiten. Die Ergebnisse veröffentlichen wir mit Ihrem Token im Pull Request. Sie erscheinen dort unter Ihrem GitHub-Benutzernamen statt als Check Run: bei Hinweisen als Review mit angeforderten Änderungen („Changes requested“), bei Ihren eigenen Pull Requests als einfacher Review-Kommentar, weil GitHub dort keine Änderungsanforderung zulässt; auch Hinweis-Kommentare und das Schließen von Diskussionen laufen dann unter Ihrem Namen.
- **Projektkontext:** Für verbundene Repositories lesen wir die Dateiliste, einzelne Manifest-Dateien wie `package.json` (daraus speichern wir nur die erkannten Programmierumgebungen) und die JavaScript- und TypeScript-Dateien und speichern aus Letzteren im Wesentlichen ihre Struktur: Signaturen, Schnittstellen, Typdefinitionen und Klassenaufbau. Die Auswahl erfolgt automatisch und kann einzelne weitere Code-Zeilen enthalten, etwa Anfangswerte von Klassenfeldern.
- **CLI, VS-Code-Erweiterung und MCP-Server:** Diese Werkzeuge schicken uns den Diff Ihrer lokalen Änderungen, den Namen des Repositorys aus Ihrer Git-Konfiguration und die Commit-Kennungen. Commit-Nachrichten und Autorenangaben aus Git senden sie nicht. Vor dem Senden prüfen sie den Diff auf Geheimnisse wie Zugangsschlüssel oder private Schlüssel (die VS-Code-Erweiterung über die CLI). Finden sie eines, brechen sie ab, statt es zu senden. Auf Ihren Befehl lösen die Werkzeuge außerdem die Anbindung eines Repositorys oder die Prüfung eines Pull Requests aus, den wir dann bei GitHub abrufen, und übermitteln Ihre Begründung, wenn Sie einen Hinweis als erledigt markieren.

### 6.2 Was wir damit tun

Wir prüfen den Code in mehreren Schritten, mit festen Regeln und mit KI-Modellen (Abschnitt 6.3). Das Ergebnis besteht aus Hinweisen („Findings“) mit Fundstelle, zitiertem Code, Begründung und gegebenenfalls einem Korrekturvorschlag. Bei Pull Requests veröffentlichen wir es als Check Run (bei der Repository-Anbindung ohne GitHub App als Review unter Ihrem Namen, Abschnitt 6.1), als Review-Kommentare und bei Bedarf als Hinweis-Kommentar im Pull Request; dort sieht es jeder, der den Pull Request sehen kann. Vorhandene Kommentare im Pull Request lesen wir nur, um keine Hinweise doppelt zu posten, und unsere eigenen Review-Kommentare, um Hinweise später als erledigt schließen zu können; deren Kennungen speichern wir dafür. Markieren Sie einen Hinweis als erledigt, schließen wir die zugehörige Diskussion. Bei den anderen Werkzeugen erhalten Sie das Ergebnis direkt. **Die Hinweise erzeugen feste Regeln und eine KI. Sie können unvollständig oder falsch sein.**

Wir treffen keine automatisierte Entscheidung über Personen im Sinne von Art. 22 DSGVO. Bewertet wird Code, nicht die Person, die ihn geschrieben hat. Ob ein fehlgeschlagener Check oder eine angeforderte Änderung das Zusammenführen eines Pull Requests verhindert, legt allein der Kunde in seinen GitHub-Einstellungen fest.

Um prüfen zu können, ob ein Paket oder Modell, das Ihr Code verwendet, tatsächlich existiert, fragen wir die öffentlichen Verzeichnisse npm, PyPI, crates.io und Hugging Face danach. Dabei übermitteln wir nur den Paket- oder Modellnamen, wie er im Code steht (er kann den Kontonamen des Paketautors enthalten), und keine Daten über Sie.

### 6.3 KI-Verarbeitung mit Google Vertex AI

Die KI-Prüfung führen wir mit Gemini-Modellen auf Google Cloud Vertex AI durch. Vertragspartner und unser Auftragsverarbeiter ist Google Cloud EMEA Limited, 70 Sir John Rogerson's Quay, Dublin 2, Irland.

- **Ort der Verarbeitung:** Die Prüfmodelle rufen wir über den EU-Endpunkt von Vertex AI auf. Google sagt für diese Modelle zu, dass die Verarbeitung in Mitgliedstaaten der EU stattfindet.
- **Suchvektoren:** Die Strukturdaten Ihres Repositorys (Abschnitt 6.1) und für jede Prüfung einen Auszug aus dem Diff (Dateinamen und bis zu 30 hinzugefügte Zeilen) wandeln wir mit einem Google-Modell in Suchvektoren um, ebenfalls mit Verarbeitung in der EU. Die Vektoren aus dem Diff speichern wir nicht. [VORBEDINGUNG V18: Suchvektoren über einen Endpunkt mit EU-Residenzzusage erzeugt]
- [OPTIONAL, NUR SOLANGE DER ROLLBACK-PFAD EXISTIERT: Fällt ein Standardmodell aus, können wir ausnahmsweise für einzelne Prüfschritte auf ein Modell ausweichen, das Google nur über einen weltweiten Endpunkt anbietet. Dann kann die Verarbeitung in jedem Google-Rechenzentrum stattfinden, auch in den USA (Abschnitt 11).]
- **Kein Training:** Google verwendet Ihre Daten nicht, um KI-Modelle zu trainieren oder anzupassen (Google Cloud Service Specific Terms, „Training Restriction“).
- **Zwischenspeicher bei Google:** Google hält Eingaben und Ausgaben bis zu 24 Stunden im Arbeitsspeicher vor, um schneller zu antworten. Die Daten bleiben dabei in der gewählten Region. Außerdem kann Google Eingaben bis zu 90 Tage speichern, wenn seine automatischen Systeme einen Verstoß gegen die Nutzungsrichtlinien vermuten. Die Speicherung dient dann nur der Prüfung dieses Verdachts und erfolgt in derselben Region. [ANPASSEN, FALLS GOOGLE DIE AUSNAHME VOM PROMPT-LOGGING BEWILLIGT ODER WIR DEN ZWISCHENSPEICHER ABSCHALTEN]
- **Unser eigener Zwischenspeicher bei Google** enthält nur unsere Prüfregeln, keine Daten aus Ihrem Code.

### 6.4 Was wir speichern

In unserer Datenbank bei Supabase speichern wir zu jedem Review:

- den Auftrag: Repository, Pull-Request- und Commit-Kennungen und bei CLI, VS-Code-Erweiterung und MCP-Server den übermittelten Diff;
- das Ergebnis mit den Findings einschließlich der zitierten Code-Stellen und Korrekturvorschläge;
- technische Protokolldaten der Modellaufrufe: Modell, Dauer und Verbrauch sowie die Zwischenergebnisse der Prüfschritte, die sich auf den geprüften Code beziehen können. Scheitert ein Review, kann die Fehlermeldung einen kurzen Ausschnitt der Modellantwort und damit des geprüften Codes enthalten.

Die Strukturdaten Ihrer Repositories (Abschnitt 6.1) speichern wir zusammen mit den Suchvektoren, solange das Repository verbunden ist. Trennen Sie ein Repository oder entfernen Sie es aus der GitHub App, verwenden wir sie nicht mehr und löschen sie spätestens 30 Tage danach zusammen mit der Repository-Verbindung. [VORBEDINGUNG V4: Migration 052 angewendet]

Wenn Sie einen Hinweis bewusst als erledigt oder unzutreffend markieren, speichern wir diese Entscheidung mit Ihrer Begründung, dem Zeitpunkt, der Commit-Kennung und dem Benutzerkonto als Nachweis.

Speicherdauer: siehe Abschnitt 12.

### 6.5 Rechtsgrundlagen für die Prüfung

- Haben wir mit Ihnen als Unternehmen einen AVV geschlossen, verarbeiten wir den Code in Ihrem Auftrag (Art. 28 DSGVO); die Rechtsgrundlage ergibt sich dann aus Ihrer Verarbeitung.
- Sonst verarbeiten wir den Code als Verantwortlicher, um den mit Ihnen geschlossenen Vertrag zu erfüllen (Art. 6 Abs. 1 lit. b DSGVO). Enthält der Code personenbezogene Daten Dritter, etwa von Mitentwicklern oder aus Testdaten, ist die Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse und Ihres ist, den Code wie beauftragt zu prüfen.

## 7. API-Schlüssel und lokale Konfiguration

Für CLI, VS-Code-Erweiterung und MCP-Server legen Sie im Dashboard einen API-Schlüssel an oder lassen ihn mit `unslop login` anlegen. Wir speichern vom Schlüssel nur einen kryptografischen Hash und das Präfix, dazu die Bezeichnung, das Erstellungsdatum, den Zeitpunkt der letzten Nutzung und gegebenenfalls den Widerruf. Legt `unslop login` den Schlüssel an, besteht die Bezeichnung aus `cli-` und dem Namen Ihres Rechners. Diese Bezeichnung wird auch in der Anmeldeadresse übertragen und erscheint deshalb in den Laufzeitprotokollen von Vercel (Abschnitt 3).

Auf Ihrem Rechner speichert das Werkzeug den Schlüssel in der Datei `~/.config/unslop/config.json`, lesbar nur für Ihr Benutzerkonto. In der VS-Code-Erweiterung können Sie ihn alternativ in den Einstellungen hinterlegen. CLI, Erweiterung und MCP-Server senden keine Nutzungsstatistiken und prüfen nicht selbständig auf Updates. Sie verbinden sich nur mit unslop.codes und, für den Abgleich mit dem Repository, mit Ihrem eigenen Git-Server. [VORBEDINGUNG V5: Google-Fonts-Einbindung der Login-Bestätigungsseite in packages/cli/src/login.ts entfernt]

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.

## 8. Abonnements und Zahlung über Paddle

Kostenpflichtige Abonnements verkauft Paddle als unser Wiederverkäufer und Merchant of Record: Paddle.com Market Limited, 30 Old Bailey, London EC4M 7AU, Vereinigtes Königreich; für Käufer in den USA Paddle.com Inc., 3811 Ditmars Blvd. #1071, Astoria, NY 11105-1803, USA; für Käufer in Kanada Paddle.com (Canada) Ltd., 22 Adelaide Street West, Suite 3400, Toronto, Ontario M5H 4E3, Kanada. Den Kaufvertrag schließen Sie mit Paddle. Paddle erhebt Ihre Zahlungs- und Rechnungsdaten als **eigener Verantwortlicher**. Einzelheiten stehen in der Datenschutzerklärung von Paddle: https://www.paddle.com/legal/privacy.

- **An Paddle übermitteln wir** beim Start des Bezahlvorgangs Ihre E-Mail-Adresse (sofern Paddle Sie noch nicht als Kunden kennt), die internen Kennungen Ihres Nutzer- und Abrechnungskontos und die Sprache der Oberfläche. Beim Aufruf der Abrechnungsseite im Dashboard lädt Ihr Browser ein Skript von Paddle (`cdn.paddle.com`); dabei erhält Paddle Ihre IP-Adresse.
- **Von Paddle erhalten wir** nach der Vereinbarung zwischen Paddle und uns Name, Anschrift, E-Mail-Adresse und Kaufhistorie der Käufer. Wir speichern davon nur die Paddle-Kennungen von Kunde, Abonnement und Tarif sowie den Status des Abonnements mit Probe- und Laufzeitende. Rechnungen rufen wir bei Paddle ab, wenn Sie sie im Dashboard ansehen, und speichern sie nicht selbst.

Rechtsgrundlagen: Art. 6 Abs. 1 lit. b DSGVO für die Bereitstellung des gekauften Dienstes. Für die Aufbewahrung von Abrechnungsunterlagen gilt Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit § 257 HGB und § 147 AO.

## 9. Warteliste

Wenn Sie sich auf unserer Website in die Warteliste eintragen, speichern wir Ihre E-Mail-Adresse, die Sprache, die Stelle auf der Seite, an der Sie sich eingetragen haben, und den Zeitpunkt. Um Missbrauch zu begrenzen, speichern wir außerdem einen Hashwert, den wir aus Ihrer IP-Adresse, dem Tagesdatum und einem geheimen Schlüssel berechnen. Die IP-Adresse selbst speichern wir nicht. Weil das Datum eingeht, ergibt dieselbe IP-Adresse an jedem Tag einen anderen Hashwert; Einträge verschiedener Tage lassen sich so nicht miteinander verknüpfen.

Den Versand übernimmt Brevo (Brevo GmbH, Köpenicker Str. 126, 10179 Berlin, Deutschland) als unser Auftragsverarbeiter mit Servern in der EU. [BESTÄTIGEN: Brevo-Gesellschaft, die Partei des Auftragsverarbeitungsvertrags ist] Brevo schickt Ihnen eine E-Mail mit einem Bestätigungslink (Double-Opt-In). Erst wenn Sie ihn anklicken, nimmt Brevo Sie in die Versandliste auf. Brevo protokolliert dabei den Zeitpunkt der Anmeldung, den Versand der Bestätigungs-E-Mail mit dem Einwilligungstext und den Zeitpunkt Ihrer Bestätigung. Diese Protokolle dienen uns als Nachweis Ihrer Einwilligung. Wir messen nicht, ob Sie unsere E-Mails öffnen oder Links darin anklicken. [VORBEDINGUNG V6: Öffnungs- und Klickmessung im Brevo-Konto abgeschaltet]

Wir schreiben Ihnen, wenn die private Beta öffnet, und zu nichts anderem.

Rechtsgrundlage für die Warteliste ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Sie können sie jederzeit widerrufen: über den Abmeldelink in jeder E-Mail oder per E-Mail an uns. Der Widerruf gilt für die Zukunft. Den Hashwert zur Missbrauchsbegrenzung verarbeiten wir auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist, massenhafte oder automatisierte Eintragungen abzuwehren. Den Nachweis Ihrer Einwilligung bewahren wir auf Grundlage von Art. 6 Abs. 1 lit. c und f DSGVO auf, damit wir ihn im Streitfall führen können.

## 10. Kontakt per E-Mail

Wenn Sie uns schreiben, verarbeiten wir Ihre E-Mail-Adresse, Ihre Nachricht und die Angaben, die Sie uns schicken, um Ihre Anfrage zu beantworten. Unser E-Mail-Postfach betreibt Proton AG, Route de la Galaise 32, 1228 Plan-les-Ouates, Schweiz, als unser Auftragsverarbeiter. Proton speichert die Daten auf Servern in der Schweiz, in Deutschland oder in Norwegen.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, wenn Ihre Anfrage einen Vertrag mit uns betrifft, sonst Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist, Anfragen zu beantworten.

## 11. Empfänger und Übermittlung in Drittländer

| Empfänger | Rolle | Sitz | Grundlage für Übermittlungen außerhalb der EU |
|---|---|---|---|
| Vercel Inc. (Hosting) | Auftragsverarbeiter | USA | Angemessenheitsbeschluss EU-US Data Privacy Framework (Vercel ist zertifiziert), zusätzlich EU-Standardvertragsklauseln [VORBEDINGUNG V1: Vercel Pro mit DPA aktiv] |
| Supabase Pte. Ltd. (Datenbank, Anmeldung) | Auftragsverarbeiter | Singapur; Daten in Frankfurt (eu-central-1) | Singapur (Vertragspartner) und USA (Unterauftragsverarbeiter von Supabase): EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO) |
| Google Cloud EMEA Limited (KI-Verarbeitung) | Auftragsverarbeiter | Irland | Verarbeitung in der EU; soweit Unterauftragsverarbeiter von Google aus Drittländern zugreifen (etwa für Support), EU-Standardvertragsklauseln. [OPTIONAL, NUR SOLANGE DER ROLLBACK-PFAD EXISTIERT: Bei Nutzung des weltweiten Endpunkts: Angemessenheitsbeschluss EU-US Data Privacy Framework (Google LLC ist zertifiziert) und EU-Standardvertragsklauseln] |
| Brevo GmbH (Warteliste) | Auftragsverarbeiter | Deutschland; Server in der EU | Hosting in der EU; für Unterauftragsverarbeiter außerhalb der EU EU-Standardvertragsklauseln bzw. EU-US Data Privacy Framework (laut Brevo-AVV) |
| Proton AG (E-Mail) | Auftragsverarbeiter | Schweiz | Angemessenheitsbeschluss für die Schweiz |
| GitHub, Inc. | eigener Verantwortlicher; Ihre Plattform, von der wir Daten abrufen und an die wir Ergebnisse zurückschreiben | USA | Angemessenheitsbeschluss EU-US Data Privacy Framework (GitHub ist zertifiziert) |
| Paddle.com Market Limited / Paddle.com Inc. / Paddle.com (Canada) Ltd. | eigener Verantwortlicher | Vereinigtes Königreich / USA / Kanada | Angemessenheitsbeschluss für das Vereinigte Königreich; für Paddle.com Inc. EU-Standardvertragsklauseln; für Paddle.com (Canada) Ltd. [BESTÄTIGEN: Angemessenheitsbeschluss für Kanada oder EU-Standardvertragsklauseln] |

Eine Kopie der Standardvertragsklauseln erhalten Sie auf Anfrage per E-Mail an uns.

## 12. Speicherdauer

Wir speichern personenbezogene Daten, solange wir sie für den jeweiligen Zweck brauchen, und löschen sie danach, soweit keine gesetzliche Aufbewahrungspflicht besteht.

| Daten | Speicherdauer |
|---|---|
| Laufzeitprotokolle bei Vercel | für uns 1 Tag einsehbar; interne Aufbewahrung durch Vercel [VORBEDINGUNG V1] |
| Protokolle bei Supabase | [SUPABASE-LOGFRIST] |
| Konto, Anmeldedaten, GitHub-Zugriffstoken, API-Schlüssel | bis zur Löschung Ihres Kontos; danach Löschung binnen 30 Tagen [VORBEDINGUNG V4: Migration 052 angewendet] |
| Review-Aufträge, Diffs, Ergebnisse und Protokolldaten der Modellaufrufe | 90 Tage ab Eingang des Auftrags; den Diff-Text, den CLI, VS-Code-Erweiterung oder MCP-Server hochladen, löschen wir schon nach 30 Tagen; mit der Löschung des Repositorys oder Ihres Kontos früher [VORBEDINGUNG V3: Migration 052 angewendet] |
| Strukturdaten und Suchvektoren eines Repositorys | solange das Repository verbunden ist; danach Löschung spätestens 30 Tage nach der Trennung [VORBEDINGUNG V4] |
| Als erledigt oder unzutreffend markierte Hinweise | bis zur Löschung des Repositorys oder Ihres Kontos [VORBEDINGUNG V4: Migration 052 angewendet] |
| Warteliste | [SPEICHERFRIST-WAITLIST]; unbestätigte Einträge [SPEICHERFRIST-WAITLIST-UNBESTÄTIGT]; der Einwilligungsnachweis darüber hinaus bis [NACHWEISFRIST-WAITLIST] |
| E-Mail-Korrespondenz | bis die Anfrage erledigt ist; geschäftliche Korrespondenz 6 Jahre (§ 257 HGB) |
| Abrechnungsunterlagen | 8 Jahre (Buchungsbelege) bzw. 10 Jahre (Bücher und Abschlüsse) nach § 257 HGB und § 147 AO |

## 13. Müssen Sie uns Daten geben?

Für die Nutzung des Dienstes brauchen wir die Daten aus Abschnitt 5 bis 7. Ohne sie können wir keinen Vertrag mit Ihnen schließen oder erfüllen. Die Warteliste ist freiwillig. Eine gesetzliche Pflicht, uns Daten zu geben, besteht nicht.

## 14. Ihre Rechte

Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Eine Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3). Schreiben Sie uns dazu eine E-Mail. Betrifft Ihre Anfrage Code, den ein Kunde uns im Rahmen eines AVV zur Prüfung übermittelt hat, leiten wir sie an den Kunden weiter.

> **Widerspruchsrecht (Art. 21 DSGVO)**
>
> Soweit wir Daten auf Grundlage berechtigter Interessen verarbeiten (Art. 6 Abs. 1 lit. f DSGVO), können Sie aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit widersprechen. Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir weisen zwingende schutzwürdige Gründe nach, die Ihre Interessen überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen. Der Widerspruch ist formlos möglich, am einfachsten per E-Mail an unslopai@protonmail.com.

## 15. Beschwerderecht

Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO). Für uns zuständig ist:

Der Hessische Beauftragte für Datenschutz und Informationsfreiheit
Wilhelmstraße 7, 65185 Wiesbaden
Telefon: 0611 1408-0
E-Mail: poststelle@datenschutz.hessen.de
Website: https://datenschutz.hessen.de

## 16. Änderungen

Wir passen diese Erklärung an, wenn sich unser Dienst oder die Rechtslage ändert. Es gilt die Fassung mit dem Stand oben. Die englische Fassung dient der Information; bei Abweichungen gilt die deutsche.
