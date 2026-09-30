# LinkedIn: Kanal-Research für unslop

Stand: 2026-09-29. Quellen stehen nummeriert am Ende ([Q1] …), jede mit URL und „abgerufen 2026-09-29“.

**Methodik und Zugriffsgrenzen**
- `linkedin.com/help`, `linkedin.com/legal`, der LinkedIn-Engineering-Blog und LinkedIn-Pulse-Artikel liefern aus dieser Umgebung HTTP 200 (curl mit Browser-UA). Die Regeln in §1 und §2 sind deshalb überwiegend **primär** gelesen. Die Help-Seite zu Hashtags (`a528144`) liefert 404.
- **Öffentliche Post-Seiten** (`linkedin.com/posts/...`) sind abrufbar. Text, Datum, Format und Zählwerte stammen aus dem eingebetteten JSON-LD (`interactionStatistic`), die Kommentare aus den ersten rund 10 öffentlich gerenderten Kommentaren. Die Zahlen sind ein **Schnappschuss vom 2026-09-29**. Ob der Autor auf Kommentare geantwortet hat, zeigt die ausgeloggte Ansicht nur teilweise.
- **Profilseiten** (`/in/...`) liefern HTTP 999, sind also gesperrt. **Company Pages** (`/company/...`) sind erreichbar und listen ihre letzten rund 10 Posts. Posts von Personen habe ich über Websuche gefunden. Das Datum lässt sich aus der Activity-ID ableiten (ID >> 22 = ms seit Epoch) und stimmt mit `datePublished` überein.
- `edelman.com` (403) und `searchengineland.com` (403) waren nicht erreichbar. Daten daraus sind als sekundär markiert.

---

## 1. Offizielle Regeln (Primärquellen)

### 1.1 Professional Community Policies: Spam, Engagement-Bait, Pods
- Wörtlich [Q1]: „Do not spam members or the platform. We don't allow untargeted, irrelevant, obviously unwanted, unauthorized, inappropriate commercial or promotional, or gratuitously repetitive messages … Don't do things to artificially increase engagement with your content. Respond authentically to others' content and **don't agree with others ahead of time to like or re-share each other's content**.“ Das ist das explizite Verbot von Engagement-Pods.
- Die Spam-Seite [Q2] nennt als Beispiele: „Emoji / reaction polls that artificially boost engagement“, „Posts that misrepresent the functionality of the LinkedIn platform“, „'chain letter'-type content, requesting likes, reactions, and shares“ und „Excessive, irrelevant, or repetitive comments“. Sanktion: „We may remove or limit the distribution“.
- Durchsetzung [Q1]: „we may limit the visibility of certain content, label it, or remove it entirely. Repeated or egregious offenses can result in account restriction.“
- Gewinnspiele sind verboten: „You may not use LinkedIn to hold lotteries, contests, sweepstakes, or giveaways.“ [Q1] Eine Beta-Verlosung ist damit ausgeschlossen.
- Irreführung [Q1]: „Do not share content that is false, misleading, or intended to deceive.“ Für Roadmap-Posts heißt das: Geplantes muss als geplant erkennbar sein (siehe §5).

### 1.2 User Agreement: Automatisierung, Scraping (gültig seit 3. November 2025) [Q3]
§8.2 „Don'ts“ verbietet unter anderem:
- „Use bots or other unauthorized automated methods to access the Services, add or download contacts, send or redirect messages, **create, comment on, like, share, or re-share posts**, or otherwise drive inauthentic engagement“
- Scraping „(such as crawlers, browser plugins and add-ons …)“
- „manipulating algorithms“

Zu KI-Texten sagt §3.6: „Please review and edit such content before sharing … you are responsible for ensuring it complies with our Professional Community Policies.“

Die Help-Seite „Post and share updates“ [Q4] ist die schärfste Primärstelle: „If we detect excessive post creation that indicates inauthentic activity, **or the use of an automation tool, we may limit the visibility of those posts**.“ Außerdem gibt es Posting-Limits pro Zeitraum, die von „verification status“ abhängen. Geplante Posts über den nativen Scheduler (Uhr-Symbol) sind vorgesehen.

### 1.3 Company Page vs. persönliches Profil
- Ein Profil muss eine echte Person sein: „create a Member profile for anyone other than yourself (a real person)“ ist verboten [Q3]. Ein „unslop“-Personenprofil ist also nicht erlaubt, dafür gibt es die Page.
- Pages Terms [Q5]: Die „Organization“ darf „only be a legal entity … or you, if you are operating the business in your individual capacity“ sein. Für eine **UG i. G.** ist das rechtlich zu klären, bevor die Page als „unslop UG“ auftritt. Zur Alternative (Page unter dem Gründer als Einzelunternehmer, dann Umfirmierung) habe ich keine Quelle gefunden. Offen.
- Page-Anlage setzt ein Profil mit echtem Namen und „enough connections“ voraus [Q6]. Page-Newsletter gibt es erst ab mehr als 150 Followern plus Prüfung, Mitglieder-Newsletter sind für alle freigeschaltet [Q7].
- **Impressum (DE-Recht, sekundär):** Geschäftsmäßige LinkedIn-Präsenzen unterliegen §5 DDG. Der Link kann unter „Info > Übersicht > URL der Website“ liegen [Q8]. Das ist keine Rechtsberatung, vor dem Anlegen der Page prüfen lassen.

### 1.4 Kennzeichnung: Brand Partnership, Anzeigen, DSA
- Brand-Partnership-Schalter [Q9]: Pflicht, wenn man Inhalte „in an exchange for value (including monetary payment, endorsements, free products or services, or other benefit)“ teilt. Er gilt nur für öffentliche Posts. Für den Gründer, der über das eigene Produkt schreibt, ist er nicht einschlägig. **Einschlägig wird er, wenn Beta-Tester für kostenlosen Zugang posten sollen.** Auch in den Community Policies gilt: Endorsements gegen Vorteil nur mit „clear and conspicuous notice“ [Q1].
- DSA: Bezahlte Anzeigen landen in der Ad Library. Für EU-Ausrichtung werden dort zusätzlich Impressionen, Targeting und Laufzeit gezeigt [Q10]. Für organische Posts gibt es keine eigene „Sponsored“-Pflicht.

### 1.5 Articles und Newsletter
- Articles haben bis zu 125.000 Zeichen [Q11]. Die Publishing Guidelines sagen [Q12]: „**Advertisements and promotions for events, products, or services aren't appropriate content for article publishing.**“ Ein Launch-Artikel wäre also regelwidrig. Ein Fach-Artikel (zum Beispiel „Was die Forschung zu KI-Code-Qualität sagt“) ist erlaubt.
- Newsletter-Best-Practices [Q13]: Logo 300×300, Cover 1920×1080, feste Kadenz.

---

## 2. Technische Specs

| Thema | Wert | Quelle |
|---|---|---|
| Post-Text | 3.000 Zeichen | primär [Q4], [Q11] |
| „…mehr“-Abschneiden | etwa **210 Zeichen Desktop, etwa 140 Mobile**. Zeilenumbrüche kürzen früher | **nur sekundär** (AuthoredUp, Stand 11.08.2026 [Q14]). Keine Primärquelle gefunden, per Test prüfen |
| Kommentar | 1.250 Zeichen | sekundär [Q14] |
| Hashtags | Help-Seite 404. Lorenzetti (LinkedIn) nennt sie „a nice to have, not a need to have … it's ok if you don't use them“ | sekundär (Buffer, zitiert Entrepreneur-Interview [Q15]) |
| Link **oder** Bild | „You can share either a URL link or an image in a post, but not both at the same time.“ | primär [Q16] |
| Bilder | ≤ 5 MB, mind. 552×276, empfohlen 1080 px Breite, Seitenverhältnis **3:1 bis 4:5**, darüber zentriert beschnitten. Bis zu 20 Bilder, Multi-Bild max. 4:5 | primär [Q16] |
| Folgerung Bildformate | 1200×627 (1,91:1), 1080×1080 und 1080×1350 (4:5) liegen im zulässigen Bereich. **9:16-Standbilder werden auf 4:5 beschnitten** | abgeleitet aus [Q16] |
| Link-Vorschau | og:image mind. 1200×627, 1,91:1, ≤ 5 MB, unter 401 px Breite nur Thumbnail [Q17]. **Neuer** [Q18]: Organische Posts nutzen ein „smaller layout for third-party links“, empfohlen 3:2 oder 16:9. Die beiden Seiten widersprechen sich im Detail. Vorschau per Post Inspector testen | primär |
| Dokument-Posts | PDF/PPT(X)/DOC(X), **≤ 100 MB, ≤ 300 Seiten**, ein Dokument pro Post, nach dem Posten nicht austauschbar. „PDFs with multiple sized pages must be fit to the same page size“. Animationen erscheinen statisch. **Zuschauer können das PDF herunterladen** | primär [Q19], [Q20] |
| Video-Datei | 75 KB–5 GB, **3 s (Desktop) bzw. 2 s (Mobile) bis 15 min**, 256×144–4096×2304, **Seitenverhältnis 1:2,4 bis 2,4:1** (9:16 ist zulässig), 10–60 fps, MP4/MOV u. a. | primär [Q21], [Q22] |
| Autoplay | „Some videos … may play automatically **without sound**“. **„There is no on/off toggle for auto‑looping on videos under 30 seconds.“** | primär [Q23] |
| Untertitel | SRT über Desktop („Select Caption“), für Profile und Pages [Q24]. Neuer [Q22]: Auto-Captions in 10 Sprachen oder „Video Caption File“ | primär |
| 9:16 im Vollbild | Die Video-Tab- und Vollbild-Erfahrung gibt es nur mobil. Man kann dort nicht direkt posten, jedes Video „may be eligible“. Videos „may be cropped on the sides as well as at the top and bottom“ | primär [Q25] |
| 9:16 im normalen Feed | Für organische Posts nicht dokumentiert. Die Anzeigen-Specs führen 4:5 als „Recommended ratio“ und 9:16 als zulässig, dazu 15–30 s als Empfehlung [Q26]. Die Behauptung, Vertikal-Video bekomme einen Reichweiten-Bonus, ist nur sekundär belegt | Test nötig |

**Konsequenz für unsere Filme:** 28–32 s liegt direkt an der 30-s-Loop-Grenze. Ein Film unter 30 s läuft stumm in Schleife, was für eingebrannten Kinetic-Text passt. Wichtiges gehört in die Safe Zone (vgl. [Q21]).

---

## 3. Algorithmus und Reichweite

### 3.1 Offiziell (LinkedIn-Mitarbeitende, Engineering-Blog)
- **Neues Ranking, 12.03.2026** [Q27]: LLM-basiertes Retrieval plus „Generative Recommender“. Der verarbeitet „more than a thousand of your historical interactions“. Gelernte Aktionen: „long dwells, likes, comments, shares“, unterteilt in „passive tasks (click, skip, long-dwell) and active tasks (like, comment, share)“. Ins Post-Prompt fließen „format, **author information (name, headline, company, industry)**, engagement counts, … and post text“. Neue Posts sind „within minutes“ im Index. Ziel ist Content „from authors you don't follow, on topics you care about“.
- **Tim Jurka (VP Engineering), 12.03.2026** [Q28]: „working to make **engagement pods ineffective and curb comment automation, including the use of third party software or browser extensions**, which are not allowed“. Weniger „Comment 'Yes' if you agree“, weniger Posts mit einem Video, „that has nothing to do with the associated text“ (die „should no longer gain additional reach“), weniger „'recycled' thought leadership posts“. Die Kommentare darunter sind teils scharf kritisch: „cluttered with AI slop, cringe promotional posts“.
- **Laura Lorenzetti, 20.05.2026** („Keeping conversations real“) [Q29]: „It's ok to use AI to help you write, but your posts and comments need to represent your voice“. Generisch wirkender KI-Content ist „less likely to be widely distributed beyond a person's immediate network“. Laut LinkedIn liegt die Erkennungsquote bei „correctly identifying generic content 94% of the time“. Auch Kommentare „that simply restate the original post“ sind im Visier. Kommentare lassen sich jetzt auf verifizierte Mitglieder filtern.
- **Jurka, 11.08.2025** [Q30]: „Exceptional content may even be distributed broadly … even if they don't follow you“. Sein Rat: „look at their posting patterns by topic, format, and timing“.
- **Jurka, 28.02.2024** (älter) [Q31]: „we want our content to focus on relevancy – reaching the right people with the most relevant knowledge and advice – rather than virality.“
- **Dwell Time** (Engineering-Blog 2020, älter) [Q32]: Ein „P(skip)“-Modell mit einheitlicher Skip-Schwelle über alle Formate.
- **Links (sekundär)**: Lorenzetti sagt, der Algorithmus fokussiere „on the value and content that's being shared in the post“ [Q15]. Eine offizielle Aussage zu einer Link-Strafe oder zur „Golden Hour“ habe ich **nicht gefunden**. Beides ist Marketer-Folklore.

### 3.2 Marketer-Aussagen (nicht offiziell, teils widersprüchlich)
- **Richard van der Blom, Algorithm Insights 2026** (1,3 Mio. Posts, 50.000 Creator; laut Podcast vom 02.06.2026 [Q33]): Reichweite „down 60% for active creators over the last two years“. „80%“ der Kommentare in den ersten Minuten seien KI-geschrieben. Empfehlung: 2–4 Posts pro Woche. Reine Textposts nur für die Top 5 % der Schreiber. Mix aus Text+Bild und Karussell. Polls meiden. Newsletter konvertieren am besten.
- **Algorithm Insights 2025** (über Sekundärquelle [Q34]): Company-Page-Text-Multiplikator 0,28, „First 90 minutes critical“, 300–400 Wörter als Bestwert. Laut derselben Quelle bringen Links angeblich +5 % Reichweite. Andere Zusammenfassungen desselben Autors nennen −18,8 % (April 2025) bzw. etwa −11 % (2026) [Q35]. **Die Link-Frage ist ungeklärt.** Ordinal sieht Link-Abschläge vor allem bei Company Pages und „almost none“ bei Personenprofilen [Q35].
- Eigene Beobachtung aus §4 (Schnappschuss, keine Studie): Company-Page-Posts von GitClear, Qodo, Snyk und Sonar liegen bei 2–27 Reaktionen. Posts der Gründer derselben Firmen liegen bei 166–2.039.

---

## 4. Beispiele (Okt. 2025 bis Sep. 2026, Zahlen vom 29.09.2026)

| # | Autor, Rolle, Datum | Hook (wörtlich) | Format | Reakt./Komm. | Kommentare und Umgang | Takeaway |
|---|---|---|---|---|---|---|
| 1 | Thomas Dohmke, Gründer Entire (Ex-GitHub-CEO, Deutscher), 10.02.2026 [E1] | „tl;dr Today, we're announcing our new company @EntireHQ … Plus, we are shipping Checkpoints to automatically capture agent context.“ | Text + Bild | 1.709 / 145 | Viel Zustimmung zu „context per commit“. Die These „The concept of understanding and reviewing code is a dying paradigm“ wird zitiert und bestritten. Sarkasmus: „your AI is generating what, exactly?“ | Vision plus **am selben Tag Ausgeliefertes**. Liegt thematisch nah an unserem geplanten Zertifikat pro Commit-SHA. Deutscher Gründer postet auf Englisch |
| 2 | Stanislav Beliaev (Rolle nicht verifiziert), 11.02.2026 [E2] | „BREAKING: Former GitHub CEO JUST raised $60M at a $300M valuation … 🔥“ | Text + Bild | 580 / 59 | Beste Kommentare sind Sachkritik: „Not 'why was this written' but 'how do I make sure the next thing is written correctly.'“ | Aggregator-Hype trägt weit. Die inhaltlichen Einwände stehen in den Kommentaren |
| 3 | Daksh Gupta, CEO Greptile, 05.03.2026 [E3] | „Today we're releasing Greptile Agent v4, our best code review agent yet.“ | Video | 419 / 39 | Zahlen aus A/B-Test (adressierte Kommentare 30 % → 43 %, „determined by an LLM-as-judge“). Rückfragen zum Pricing („What constitutes a review?“) und „Is it better than asking Opus 4.6…?“. Antworten öffentlich nicht sichtbar | Eine Metrik, die Käufer interessiert (Akzeptanzrate), plus offengelegte Messmethode. Preisänderung im selben Post zieht Skepsis auf sich |
| 4 | Daksh Gupta, 23.09.2025 (**6 Tage vor dem Fenster**) [E4] | „Greptile has raised $25M to Kill The Bug.“ | Video | 2.039 / 182 | Glückwünsche dominieren | Funding und Kunden-Logos skalieren über das Netzwerk |
| 5 | Merrill Lutsky, CEO Graphite, 19.12.2025 [E5] | „Graphite is joining Cursor!“ | Video | 547 / 72 | **Links setzt der Autor selbst als erste Kommentare** (Fortune, Blog) | Link-Platzierung im Kommentar als gelebte Praxis |
| 6 | Harjot Gill, CEO CodeRabbit, 06.01.2026 [E6] | „“We are using CodeRabbit all over NVIDIA!” - Jensen at CES 2026“ | Video | 192 / 23 | Autor ergänzt „Keynote slide“ als Kommentar | Ein Satz Drittbeweis schlägt Eigenlob |
| 7 | Itamar Friedman, CEO Qodo, 01.01.2026 [E7] | „A take on AI code review tools, like Qodo. Code review is a harder product and technical challenge than code generation.“ | Text + Bild | 166 / 6 | Wenige, sachliche Kommentare | These-Post ohne Zahlen: wenig Diskussion |
| 8 | Itamar Friedman, 07.01.2026 [E8] | „2025 has been a defining year for the software development world, and for Qodo.“ | Text + Bild | 251 / 17 | Praktiker: „internal tooling … 10x … In production, however, this is far from the case“ (Nevo Alva) | „Code integrity“ als Kategorie und die Selbstironie „the 10–100× we've all promised our CTOs“ lösen echte Erfahrungsberichte aus |
| 9 | Itamar Friedman, 31.03.2026 [E9] | „We are excited to share that Qodo has raised $70M … 🎊 But this is not the story.“ | Video | 525 / 61 | Überwiegend Glückwünsche von Investoren und Team | Typische Kurzzeilen-Rhetorik („broetry“). Kern sind die CTO-Fragen: „Can I trust what is being shipped?“ |
| 10 | Tariq Shaukat, CEO Sonar (Genf), 22.05.2026 [E10] | „We've all experienced it: LLMs are extraordinarily intelligent, but they can also be surprisingly dumb.“ | Text + Bild | 50 / 1 | Kaum Resonanz | Übernahme-Meldung im Konzernton trägt trotz großer Marke kaum |
| 11 | GitClear (Company Page), 14.09.2026 [E11] | „Since November 2025, observed throughput of "durable code changed per day" is up 20-50% …“ (zu große PRs: 3 % → 11 %) | Text + Bild | 10 / 1 | Schlussfrage an die „enlightened citizens of LinkedIn“ bleibt unbeantwortet | Starke Daten, schwache Page-Reichweite. Die Research-Veröffentlichung vom 08.01.2026 kam auf 20 Reaktionen [E12] |
| 12 | Qodo (Company Page), 23.09.2026 [E13] | „91% of engineering leaders see a risk of losing control of their codebase as development becomes more agentic.“ | Text | 16 / – | – | Report-Post über die Page: geringe Reichweite |
| 13 | Troy Gray (arbeitet nach eigener Aussage mit DX-Daten, Rolle nicht verifiziert), 19.02.2026 [E14] | „Wall Street is wrong about software.“ | Text + Bild | 156 / 27 | Autor setzt die Quelle (a16z) als ersten Kommentar. Praktiker bestätigen „review cycles“ als Engpass | Konträrer Einstieg plus DORA-Zahlen (+98 % PR-Volumen, +91 % Review-Zeit, zitiert vom Autor) |
| 14 | Gianluca Mauro (Rolle nicht verifiziert), 05.02.2026 [E15] | „Leaders MUST pay attention to vibe coding.“ | Text + Bild | 83 / **67** | **Kritik:** „I swear you guys are just reposting content. I've seen the same message 10 times.“ und „Stop pandering.“ | Generisches Vibe-Coding-Thema kippt in Abnutzung. Die hohe Kommentarquote kommt aus Widerspruch |
| 15 | codecentric AG (DACH, Company Page), 11.09.2026 [E16] | „Produktivitäts-Turbo: Hermes Germany GmbH adaptiert AI-Coding in nur drei Wochen 🚀“ | Text | 18 / 1 | – | Deutscher Case-Post im Agenturton, geringe Resonanz |

**Muster:** Viele sichtbare Kommentare unter Gründer-Posts lesen sich generisch („The real signal here…“, „isn't just X—it's Y“). Das passt zu van der Bloms 80-%-Aussage und zu LinkedIns Maßnahme gegen Kommentare, „that simply restate the original post“ [Q29]. Das ist meine Einschätzung, nicht gemessen. **Kein** öffentlich gefundener Dokument-/Karussell-Post im Thema KI-Codequalität (Suche erfolglos, das heißt nicht, dass es keine gibt).

---

## 5. Wie Macher über Geplantes sprechen

- **Das Muster, das trägt:** eine These, dann ein heute Ausgeliefertes, dann das Geplante. Dohmke verbindet „the next developer platform“ mit „Plus, we are shipping Checkpoints“ [E1]. Greptile begründet v4 mit „A/B testing … hundreds of thousands of PRs“ [E3]. Qodo formuliert die Roadmap als Kategorie („From writing code, to agentic code generation, to governing it systematically“) statt als Feature-Liste [E9].
- **Wie das bei CTOs landet:** Laut Edelman/LinkedIn (2024, älter) nennen 55 % der Entscheider „strong research and data“ als Merkmal guter Thought Leadership. Nur 15 % halten sie für „very good“, und 55 % steigen aus, wenn die erste Minute nicht trägt [Q36]. Die Kommentare unter [E8] und [E14] zeigen: CTOs antworten mit eigenen Engpass-Zahlen, wenn der Post ihre Erfahrung benennt (Review-Stau, Prod vs. Non-Prod).
- **Fallstricke:**
  - **Vaporware:** Cognitions Devin-Demo (2024, älter) wurde öffentlich zerlegt („Debunking Devin“, Internet of Bugs, HN-Thread [Q37]).
  - **Konzernsprache:** [E10] und [E15] tragen trotz Marke kaum.
  - **Kurzzeilen-Pathos:** [E9]
  - **Abnutzung:** „the same message 10 times“ [E15]
  - Jurka stuft „recycled thought leadership“ ausdrücklich herab [Q28].
- **Regelrahmen:** Geplantes als Tatsache darzustellen verstößt gegen „false or misleading“ [Q1]. Die freigegebenen Formulierungen in `distribution/channels/CONTEXT.md` §5 („On our roadmap…“, „Planned: …“) passen dazu.

---

## 6. Zielgruppe

- **Größe:** LinkedIn nennt „1 billion+“ Mitglieder, davon 257 Mio. in Europa [Q38]. Für DACH gibt es rund 31 Mio. (Juni 2026, sekundär, „laut LinkedIn selbst“ [Q39]). Die oft zitierte Zahl „4 out of 5 members drive business decisions“ fand ich auf der LinkedIn-Audience-Seite **nicht**, sie ist nur sekundär belegt [Q40].
- **CTOs und VPs Engineering speziell:** **Keine belastbare Primärzahl gefunden.** Belegt ist nur, dass C-Level Thought Leadership liest: 54 % der C-Suite verbringen mindestens 1 h pro Woche damit (Edelman/LinkedIn 2024 [Q36]). Die Stack-Overflow-Umfrage 2025 nennt als Top-Community-Plattformen Stack Overflow (84 %), GitHub (67 %) und YouTube (61 %), LinkedIn nicht (sekundär, Such-Snippet [Q41]). Für Entwickler ist LinkedIn also nicht erste Wahl, für Entscheider plausibel, aber nicht als CTO-Zahl belegt.
- **Was abgelehnt wird (belegt):**
  - generischer KI-Content [Q29]
  - Engagement-Bait, Emoji-Polls, Kettenbriefe [Q2], [Q28]
  - „recycled thought leadership“ [Q28]
  - Wiederholung [E15]
  - Originality.ai fand 54 % der langen englischen Posts „likely AI-generated“ (Nov. 2024, älter, über eWeek [Q42])
  - Zu „I'm humbled“-Floskeln gibt es nur Meinungsbeiträge, keine Daten.
- **DACH, Du/Sie:** Appinio (April 2019, n = 4.533, **älter**): Auf LinkedIn und Xing möchte die Mehrheit der 25- bis 54-Jährigen von Unternehmen gesiezt werden. 41 % der 16- bis 24-Jährigen bevorzugen das Du [Q43]. Aktuellere Daten fand ich nicht.

---

## 7. Deutsch vs. Englisch

**Befund: Es gibt keinen harten Beleg, der eine deutsche Fassung für DACH-CTOs erzwingt. Es gibt aber Gründe für getrennte deutsche Posts zu DACH-spezifischen Themen.**

- **Gegen Deutsch als Standard:**
  - EF EPI 2025 (19.11.2025): Österreich auf Platz 3, Deutschland auf Platz 4 weltweit [Q44].
  - Die Tool-Debatte läuft auf Englisch: Dohmke [E1] und Sonar aus Genf [E10] posten Englisch. Die Kölner Konferenz „Digitale Leute“ bewirbt ihr INNOQ-Programm auf Englisch [E17].
  - Unsere Produktstrings, Regel-IDs und Filme sind Englisch.
- **Für eine deutsche Fassung:**
  - Die Sie-Präferenz (siehe §6)
  - Das DACH-Netzwerk des Gründers
  - Themen, die nur hier ziehen: EU-Verarbeitung auf Vertex AI (EU), AVV und DSGVO
  - DACH-Dienstleister posten Deutsch (codecentric [E16]) oder zweigleisig (the native web, Newsletter „in German and English“ [E18]).
- **Technisch relevant (primär):** Für „some members who have set their language settings to German … all posts in your feed will be auto translated“ [Q45]. Ein englischer Post kann deutschen Lesern also maschinell übersetzt erscheinen. Das spricht gegen Wortspiele im Hook.
- Die Aussage, der Algorithmus spiele Posts bevorzugt im gleichen Sprachraum aus, ist **nur sekundär und unbelegt** (Ratgeber-Snippets).

---

## 8. Ableitungen für unslop

1. **Vom Gründerprofil posten, nicht von der Page.** Die Page dient als Impressums- und Link-Anker. Ihre Posts erreichen nach allen Beobachtungen einen Bruchteil ([E11] bis [E13] vs. [E1], [E3]). Vorher Rechtsform-Frage (UG i. G.) und Impressum klären [Q5], [Q8].
2. **Headline des Gründers als Themen-Signal.** Name, Headline, Firma und Branche des Autors fließen ins Ranking-Prompt [Q27]. Die Headline sollte „AI code review / quality gates“ enthalten, keine Slogans.
3. **Format-Mix:** Hauptformat Text + ein echtes Bild (Check-Run-Screenshot mit Regel-ID, 4:5 oder 1:1). Dazu ein Dokument-Post pro Monat (Forschungszahlen aus CONTEXT §4a, gleiche Seitengröße, unter 10 Seiten, **herunterladbar**, also nichts Internes). Native Filme nur mit passendem Text, weil Jurka Video ohne Textbezug herabstuft [Q28].
4. **Filme als 4:5-Schnitt zusätzlich zu 9:16.** 9:16 ist zulässig [Q21], aber die Feed-Darstellung ist undokumentiert und das Vollbild beschneidet [Q25]. Test-Upload auf Desktop und Mobil vor dem Launch. SRT beilegen, obwohl Text eingebrannt ist. Unter 30 s loopen sie stumm [Q23].
5. **Hook in die ersten rund 140 Zeichen** [Q14]. Konkrete Zahl oder konkrete Beobachtung, zum Beispiel ein echter CLI-String („Nothing was reviewed — this is NOT a clean verdict.“). Keine Frage-Köder, kein „Agree?“.
6. **Länge:** etwa 150–300 Wörter, eine These, ein Beleg, eine offene Grenze. Der Wert 300–400 Wörter ist Marketer-Aussage [Q34], nicht offiziell.
7. **Roadmap immer als Roadmap.** Formulierungen aus CONTEXT §5 („On our roadmap…“) und in jedem Post etwas heute Nachprüfbares danebenstellen (Muster [E1]). Zertifikat pro SHA und Integritäts-Trend sind die CTO-Geschichte. Nie im Präsens.
8. **Links:** Link-Strafe unbelegt, Link und Bild schließen sich aus [Q16]. Also: Bild-Post, Warteliste-Link als eigener erster Kommentar (Praxis wie [E5], [E14]). Die Vorschau vorher im Post Inspector prüfen.
9. **Kommentare selbst und von Hand beantworten.** Innerhalb der ersten Stunden reagieren, weil Kommentare als „active task“ zählen [Q27]. Kritische Fragen (Pricing, „LLM wrapper?“) inhaltlich beantworten. Keine Kommentar-Tools, keine Pods, keine abgesprochenen Likes [Q1], [Q3], [Q28].
10. **Kein KI-Ton.** Kein „it's not X, it's Y“, keine Kurzzeilen-Treppen [E9]. LinkedIn drosselt generischen Content außerhalb des eigenen Netzwerks [Q29]. Für ein Anti-Slop-Produkt ist das doppelt riskant.
11. **Sprache:** Englisch als Standard. Etwa jeder dritte Post als **eigenständiger** deutscher Post (nicht zweisprachig im selben Post) zu DACH-Themen (EU-Verarbeitung, Teamprozesse). Im Deutschen „Sie“ in direkter Ansprache oder neutral formulieren [Q43].
12. **Kadenz:** 2–3 Posts pro Woche (Marketer-Wert 2–4 [Q33]), nativer Scheduler statt Drittanbieter-Automatik [Q4]. Keine Verlosungen [Q1]. Kein Artikel als Werbung [Q12]. Beta-Tester, die für Gratiszugang posten, müssen „Brand partnership“ setzen [Q9].

---

## Quellen (alle abgerufen 2026-09-29)

**Regeln und Specs (primär, LinkedIn)**
- [Q1] https://www.linkedin.com/legal/professional-community-policies, abgerufen 2026-09-29
- [Q2] https://www.linkedin.com/help/linkedin/answer/137372 (Spam), abgerufen 2026-09-29
- [Q3] https://www.linkedin.com/legal/user-agreement („Effective on November 3, 2025“), abgerufen 2026-09-29
- [Q4] https://www.linkedin.com/help/linkedin/answer/a528176, abgerufen 2026-09-29
- [Q5] https://www.linkedin.com/legal/l/linkedin-pages-terms, abgerufen 2026-09-29
- [Q6] https://www.linkedin.com/help/linkedin/answer/a553289, abgerufen 2026-09-29
- [Q7] https://www.linkedin.com/help/linkedin/answer/a591266, abgerufen 2026-09-29
- [Q9] https://www.linkedin.com/help/linkedin/answer/a1627083, abgerufen 2026-09-29
- [Q10] https://www.linkedin.com/help/linkedin/answer/a1517918, abgerufen 2026-09-29
- [Q11] https://www.linkedin.com/help/linkedin/answer/a522483, abgerufen 2026-09-29
- [Q12] https://www.linkedin.com/help/linkedin/answer/47545, abgerufen 2026-09-29
- [Q13] https://www.linkedin.com/help/linkedin/answer/a517940, abgerufen 2026-09-29
- [Q16] https://www.linkedin.com/help/linkedin/answer/a527229, abgerufen 2026-09-29
- [Q17] https://www.linkedin.com/help/linkedin/answer/a521928, abgerufen 2026-09-29
- [Q18] https://www.linkedin.com/help/linkedin/answer/a1689427, abgerufen 2026-09-29
- [Q19] https://www.linkedin.com/help/linkedin/answer/a518909, abgerufen 2026-09-29
- [Q20] https://www.linkedin.com/help/linkedin/answer/a523054, abgerufen 2026-09-29
- [Q21] https://www.linkedin.com/help/linkedin/answer/a548372, abgerufen 2026-09-29
- [Q22] https://www.linkedin.com/help/linkedin/answer/a7174587, abgerufen 2026-09-29
- [Q23] https://www.linkedin.com/help/linkedin/answer/a565326, abgerufen 2026-09-29
- [Q24] https://www.linkedin.com/help/linkedin/answer/a552177, abgerufen 2026-09-29
- [Q25] https://www.linkedin.com/help/linkedin/answer/a6290168, abgerufen 2026-09-29
- [Q26] https://www.linkedin.com/help/lms/answer/a424737, abgerufen 2026-09-29
- [Q38] https://business.linkedin.com/marketing-solutions/audience, abgerufen 2026-09-29
- [Q45] https://www.linkedin.com/help/linkedin/answer/a525292, abgerufen 2026-09-29

**Algorithmus (primär, LinkedIn-Mitarbeitende und Engineering-Blog)**
- [Q27] https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed (Danchev, 12.03.2026), abgerufen 2026-09-29
- [Q28] https://www.linkedin.com/pulse/updates-linkedin-feed-focusing-authentic-relevant-tim-jurka-umwnc (12.03.2026), abgerufen 2026-09-29
- [Q29] https://www.linkedin.com/pulse/keeping-conversations-real-linkedin-laura-lorenzetti-9821e/ (20.05.2026), abgerufen 2026-09-29
- [Q30] https://www.linkedin.com/pulse/how-does-linkedin-feed-work-tim-jurka-oxraf (11.08.2025), abgerufen 2026-09-29
- [Q31] https://www.linkedin.com/pulse/how-linkedin-focused-surfacing-right-content-worlds-tim-jurka-bvzhc (28.02.2024), abgerufen 2026-09-29
- [Q32] https://www.linkedin.com/blog/engineering/feed/understanding-feed-dwell-time (12.05.2020), abgerufen 2026-09-29
- [Q36] https://www.linkedin.com/business/marketing/blog/research-and-insights/b2b-thought-leadership-research-impact-linkedin-edelman (29.02.2024), abgerufen 2026-09-29

**Sekundär**
- [Q8] https://www.e-recht24.de/impressum/13397-impressum-linkedin.html, abgerufen 2026-09-29
- [Q14] https://authoredup.com/blog/linkedin-character-limit, abgerufen 2026-09-29
- [Q15] https://buffer.com/resources/linkedin-algorithm/, abgerufen 2026-09-29
- [Q33] https://podcast.creatorscience.com/richard-van-der-blom-2/ (02.06.2026), abgerufen 2026-09-29
- [Q34] https://mercermackay.com/thinking/blog/a-leaders-guide-to-the-linkedin-algorithm-what-the-data-says/, abgerufen 2026-09-29
- [Q35] https://www.tryordinal.com/blog/linkedin-link-penalty-study, abgerufen 2026-09-29
- [Q37] https://news.ycombinator.com/item?id=40008109, abgerufen 2026-09-29
- [Q39] https://www.socialmediainternational.de/2026/06/19/linkedin-erobert-den-deutschsprachigen-raum/, abgerufen 2026-09-29
- [Q40] https://nealschaffer.com/linkedin-statistics/ (nur Such-Snippet), abgerufen 2026-09-29
- [Q41] https://survey.stackoverflow.co/2025/ (nur Such-Snippet), abgerufen 2026-09-29
- [Q42] https://www.eweek.com/news/ai-generated-posts-flood-linkedin/ (nur Such-Snippet), abgerufen 2026-09-29
- [Q43] https://www.appinio.com/de/blog/insights/studie-markenkommunikation-siezen-duzen, abgerufen 2026-09-29
- [Q44] https://www.ef.com/wwen/about-us/press/articles/2025/ef-english-proficiency-index-2025-launched/, abgerufen 2026-09-29

**Beispiel-Posts (öffentliche Post-Seiten)**
- [E1] https://www.linkedin.com/posts/ashtom_hello-entire-world-entire-blog-activity-7427023140960124933-VZj2, abgerufen 2026-09-29
- [E2] https://www.linkedin.com/posts/stasbel_breaking-former-github-ceo-just-raised-60m-activity-7427323619405484032-Bt_y, abgerufen 2026-09-29
- [E3] https://www.linkedin.com/posts/dakshg_today-were-releasing-greptile-agent-v4-activity-7435353275857743872-7idK, abgerufen 2026-09-29
- [E4] https://www.linkedin.com/posts/dakshg_greptile-has-raised-25m-to-kill-the-bug-activity-7376269833644015616-4rQV, abgerufen 2026-09-29
- [E5] https://www.linkedin.com/posts/merrill-lutsky_graphite-is-joining-cursor-weve-long-dreamed-activity-7407856882071076864-Cq4u, abgerufen 2026-09-29
- [E6] https://www.linkedin.com/posts/harjotsgill_we-are-using-coderabbit-all-over-nvidia-activity-7414377566943494144-tOVs, abgerufen 2026-09-29
- [E7] https://www.linkedin.com/posts/itamarf_a-take-on-ai-code-review-tools-like-qodo-activity-7412578452899270657-FjQF, abgerufen 2026-09-29
- [E8] https://www.linkedin.com/posts/itamarf_2025-has-been-a-defining-year-for-the-software-activity-7414642534775427072-bKAq, abgerufen 2026-09-29
- [E9] https://www.linkedin.com/posts/itamarf_we-are-excited-to-share-that-qodo-has-raised-activity-7444712460835713024-WW_8, abgerufen 2026-09-29
- [E10] https://www.linkedin.com/posts/tariq-shaukat_welcoming-gitar-to-sonar-accelerating-ai-activity-7463519852373102592-rMIo, abgerufen 2026-09-29
- [E11] https://www.linkedin.com/posts/gitclear_since-november-2025-observed-throughput-activity-7505406584768843776-3C0C, abgerufen 2026-09-29
- [E12] https://www.linkedin.com/posts/gitclear_today-we-release-new-research-on-the-correlation-activity-7415031627053096961-sY-D, abgerufen 2026-09-29
- [E13] https://www.linkedin.com/posts/qodoai_91-of-engineering-leaders-see-a-risk-of-activity-7508513445877690368-Oe0Z, abgerufen 2026-09-29
- [E14] https://www.linkedin.com/posts/troygray94_wall-street-is-wrong-about-software-the-activity-7430276209772593152-GqJQ, abgerufen 2026-09-29
- [E15] https://www.linkedin.com/posts/gianlucamauro_leaders-must-pay-attention-to-vibe-coding-activity-7425222297986260992-dOF3, abgerufen 2026-09-29
- [E16] https://de.linkedin.com/posts/codecentric-ag_codecentric-x-hermes-germany-gmbh-ai-coding-activity-7504146407038119936-RVJK, abgerufen 2026-09-29
- [E17] https://www.linkedin.com/posts/activity-7508056801523826690-0CoQ, abgerufen 2026-09-29
- [E18] https://www.linkedin.com/posts/thenativeweb_we-have-a-newsletter-in-german-and-english-activity-7433043221879971840-Cdti, abgerufen 2026-09-29
