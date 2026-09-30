# Product Hunt: Kanal-Research für unslop

Stand: 2026-09-29. Alle Quellen wurden am 2026-09-29 abgerufen. Das Quellenverzeichnis steht am Ende (Q-Nummern), jeweils mit URL und „abgerufen 2026-09-29“. Zitate, Taglines und Titel stehen im englischen Original.

**Methodik und Zugriffsgrenzen**
- `curl` auf `www.producthunt.com/*` (`/launch`, `/about`, `/search`, `/products/…`, `/robots.txt`) und auf `help.producthunt.com/en/` lieferte **HTTP 403**. `api.producthunt.com/v2/docs` lieferte 200.
- **WebFetch kam durch**, auf producthunt.com und auf help.producthunt.com. Die Regeln in §1 und §2 stammen deshalb aus Primärquellen.
- WebFetch gibt die Seiten als Extrakt eines Hilfsmodells zurück. Als Zitat markierte Sätze habe ich gezielt als „verbatim“ angefordert. Kleine Abweichungen vom Original sind trotzdem möglich. **Vor jeder Wiederverwendung eines Zitats in eigenen Texten am Original prüfen.**
- Kommentare zeigen die PH-Seiten im Abruf nur bei Produkten mit **einem einzigen Launch** (Produktseite). Bei Produkten mit mehreren Launches (Cursor, Warp, Kilo Code) fehlen Maker-Kommentare im Abruf. Dort ist das Feld mit **„blocked: tooling“** markiert und nicht als „kein Kommentar“.
- Zahlen: Auf Produktseiten stehen zwei unbeschriftete Zähler. Gegen das beschriftete Daily-Leaderboard geprüft (Cursor 2.0: „Score 965 | Comments 39“) steht zuerst die Kommentarzahl, dann die Punkte. Es sind **heutige Gesamtstände, nicht die Stände am Ende des Launch-Tags**. Beispiel Kilo Code Reviewer: 636 Punkte laut Post-mortem am Launch-Tag, heute 792.
- Die eigene Timing-Auswertung (§6) beruht auf hunted.space. Das ist ein Drittanbieter, und die Daten reichen nur für September 2026 (670 gefeaturte Launches, 1.–28.9.). Sie ist korrelativ und dünn.

---

## 1. Offizielle Regeln (Primärquellen)

### 1.1 Wer posten darf: Accounts, Hunter, Maker
- **Nur persönliche Accounts:** „Company or branded accounts cannot post, vote, or comment on Product Hunt.“ [Q14, Stand 30.07.2025] Der Launch Guide sagt „Company accounts are prohibited“ [Q1]. Ein Launch muss „associated with a personal account, not a company account“ sein [Q20b].
- **Wartezeit:** Nach der Kontoerstellung gilt eine Woche Sperre, bevor man posten kann. Mit einem Newsletter-Abo geht es sofort [Q14]. Der Guide empfiehlt, der Community „well ahead of your launch (three months or more)“ beizutreten [Q3].
- **Profilpflicht:** Vor- und Nachname, ein klares Personenfoto, Headline oder Bio und ein eigener Username. Profile sollen „represent an individual, not a company, service, brand, or organization“ [Q7, Stand 11.04.2025]. Unvollständige Profile sind laut Q8 ein Grund, warum Kommentare verborgen werden.
- **Hunter oder Selbst-Hunt:** „We encourage makers to hunt their own products, and there's no discernible advantage to using a third-party hunter.“ [Q1] Q3 nennt dazu Zahlen: „79% of featured posts were by makers who self-hunted“ und „60% of #1 Product of the Day winners were self-hunted“. Einen Hunter zu bezahlen ist verboten: „Paying people to hunt your product goes against our guidelines.“ Die Folge ist „unfeatured or removed“, und für die Maker ist ein permanenter Bann möglich [Q3].
- **Tageslimit:** höchstens „2 hunts per day“ pro Person [Q19, Stand 03.04.2026].
- Maker bekommen ein Badge. Weitere Maker trägt man im Launch-Dashboard unter „Hunter & makers“ ein [Q21].

### 1.2 Was gelauncht werden darf, und gibt es noch „Coming soon“?
- **Featuring-Richtlinien** [Q5, Stand 10.03.2026]: Gefeatured werden „digital products and services“, die „currently available“ sind. Bewertet wird nach **Useful, Novel, High Craft, Creative**, wobei nicht jedes Kriterium erfüllt sein muss.
  - Ausdrücklich **nicht gefeatured** werden „Waitlisted products (without immediate access)“, außerdem „Vaporware or incomplete products“, Produkte, die „primarily focused on immediate monetization rather than providing long-term value“ sind, und Produkte ohne Differenzierung.
- **Unveröffentlichte Produkte** [Q10, Stand 10.02.2025]:
  - Ausnahmen sind möglich, wenn „clear, detailed information – such as a thorough product walkthrough video or demo“ vorliegt.
  - Aber: „Products that only offer an email sign-up are not eligible for the homepage.“ Die Empfehlung lautet: „waiting until users can try it firsthand“.
  - Im Formular gibt es einen Status für „not available yet“ [Q4].
- **Coming-soon-Seiten gibt es nicht mehr.** Der Changelog [Q25] meldet unter „August 28“: „No more ‚Coming soon‘ (and a couple other shiny updates)“. An ihre Stelle tritt ein Forum-Thread für jedes neue Produkt unter `/p/<produkt>`, dazu kam ein Button, mit dem man einen Launch selbst löscht.
  - Der Changelog zeigt kein Jahr. Ein Forum-Rückblick „2025 Recap“ [Q26] zählt die Entfernung schon zu den Änderungen von 2025. Das Datum ist also sehr wahrscheinlich der **28.08.2025**. Das ist eine Ableitung, keine Angabe von PH.
- **Geplante Launches** lassen sich bis zu 30 Tage im Voraus einplanen [Q17, Stand 02.02.2026]. Sie sind nicht indexiert und bis zum Start nicht votebar. Standardmäßig sind sie privat und lassen sich per Link öffentlich schalten [Q18, Stand 30.06.2026]. Statt „Launch Now“ gibt es seit Februar 2025 „Create Draft“ [Q23].

### 1.3 Relaunch
Quelle: Q6, Stand 07.07.2026.
- Zwischen zwei Posts desselben Produkts oder derselben Firma müssen mindestens sechs Monate liegen: „at least six months between posts for the same product or from the same company“. Dazu braucht es „a significant update to the product“.
- Die Frist gilt auch für dieselbe Root-Domain.
- Früher geht es nur per Relaunch-Request, den das Team prüft.
- Als signifikant zählen etwa eine neue Mobile-App oder ein kompletter Redesign mit neuer Funktion. Ausdrücklich nicht zählen: „New UIs, pricing plan changes, etc. are not considered significant updates.“
- Die Praxis ist lockerer, wenn wirklich neue Produktflächen dazukommen. Kilo Code launchte „for JetBrains“ am 01.09.2026 und „for iOS and Android“ am 15.09.2026 [Q41]. TryCase launchte am 05.07.2026 und erneut am 14.09.2026 [Q49]. Beides lief vermutlich über genehmigte Requests. Belegt ist das nicht.

### 1.4 Vote-Manipulation und Outreach-Wortlaut
- **Community Guidelines** [Q7]: „Mass messaging users, asking for upvotes, using bots, incentivizing upvotes, and any other form of artificially increasing activity“. Die Folge ist die Entfernung der Beiträge und der Verlust der Beitragsrechte. Außerdem: „Self-promoting in comments will also be removed.“
- **Um Upvotes bitten?** [Q9]: „Please don't. People should upvote things they genuinely like or find interesting, not because they were peer pressured to do so.“ Sonst drohen algorithmische Abwertung und der Verlust des Homepage-Platzes.
- **Erlaubter Wortlaut** [Q1]: „you cannot ask people directly to upvote your product. Instead, ask them to visit and comment“.
- **Stimmen werden gefiltert** [Q15, Stand 30.05.2025]: „Product Hunt actively filters out inauthentic activity. This includes bot accounts, fake profiles, AI-generated actions, and any voting behavior that doesn't match healthy, human community engagement.“
- **Historisch** [Q24, 23.03.2023]: PH nahm Produkte von der Homepage, die Vote-„Services“ nutzten, und verdoppelte die Moderation.

### 1.5 Featuring und Ranking (Änderungen 2024–2026)
- **Die Homepage ist kuratiert:** „It's not just about the most upvoted products“ [Q12]. Nicht gefeaturte Posts landen im „All“-Feed, erreichbar über „See all of today's products“ [Q13].
- **Punkte sind nicht gleich Upvotes:** „One upvote does not always equal one point.“ Die Faktoren legt PH nicht offen, „to avoid gaming“ [Q11].
  - **Tages-, Wochen- und Monatssieger** entscheiden sich nach „the highest number of points“. In die Punkte fließen Upvotes, Kommentare und Shares ein [Q20].
  - Ein eigener Beleg für die Gewichtung: Am 21.09.2026 lag Superset Mobile mit 499 Votes und 128 Kommentaren auf Rang 1, **vor** Jev mit 521 Votes und 14 Kommentaren [Q30, Q37].
- **Änderungen laut Changelog** [Q25], Jahreszahlen abgeleitet:
  - Dezember 2024: Leaderboard auf Punkte umgestellt, „Topics“ heißen jetzt „Launch Tags“, Launch-Day-Dashboard eingeführt.
  - Januar 2025: neue Launch-Seite.
  - April 2025: Forum-Suche.
  - August 2025: Coming soon entfernt.
- **Beschreibungslänge:** laut Forum [Q26] von 260 auf 500 Zeichen erhöht, siehe §2.
- **Randomisierung:** Laut Q24 (2023) war die Homepage-Sortierung in den ersten 4 Stunden eines Launch-Tags zufällig, und die Votes waren verborgen. Ob das 2026 noch gilt, bestätigt keine aktuelle Primärquelle. Sekundärquellen behaupten es weiter [Q31]. Am 27.03.2026 gab es einmalig einen „Randomized Leaderboard Day“ (25 Minuten zufällig, 5 Minuten sortiert, Punkte verborgen, „Every vote cast during a randomized period counts for double“) [Q27].
- **PH darf Posts redaktionell ändern:** Titel, Tagline, Thumbnail, Beschreibung und Galerie [Q16].

### 1.6 Kommentare, KI-Text und Offenlegung
- **Commenting Guidelines** [Q8, Stand 28.07.2025]: „Product Hunt is about person-to-person interactions … No LLMs or Chrome extensions please!“ Generische Kommentare wie „congrats!“ sind unerwünscht, Massenkommentare ebenso.
- Seit 2023 hat der Report-Link ein eigenes Flag für KI-generierte Kommentare [Q24].
- **Offenlegung:** Eine eigene Disclosure-Regel für Maker, etwa „I'm the founder“, habe ich in den Hilfeartikeln nicht gefunden. Offengelegt wird strukturell über das Maker-Badge. Sprache der Beiträge: nur Englisch [Q22].

---

## 2. Technische Specs

| Feld | Vorgabe | Quelle und Qualität |
|---|---|---|
| Name | „Only the product's name, no description or emojis (unless it is a legit part of the name)“. Laut Sekundärquelle höchstens 40 Zeichen | Q2 (primär), Zeichenlimit nur Q31 (sekundär) |
| Tagline | **„max 60 characters“** | Q2 (primär). Der Hilfeartikel Q4 nennt kein Limit |
| Beschreibung | **Widerspruch in den Primärquellen:** Q4 sagt „within 260 characters“ (Stand 05/2025), Q2 sagt „max 500 characters“. Laut Forum [Q26] wurde das Limit erhöht | **Auf ≤ 260 Zeichen schreiben**, das ist unter beiden Angaben gültig |
| Thumbnail | quadratisch, „We recommend 240x240“, GIF erlaubt unter 3 MB, ohne Strobing. Ein GIF spielt nicht automatisch ab, gezeigt wird der erste Frame | Q4, Q2 |
| Galerie | „recommended size … 1270x760“. **Mindestens 2 Bilder** („2+ images before it is viewable“), keine Obergrenze genannt. GIFs erlaubt, Reihenfolge per Drag & Drop. Ein Dateigrößenlimit für die Galerie nennt PH nicht | Q4, Q2. In der Praxis beobachtet: 3 bis 12 Bilder (§3) |
| Video | optional, **nur YouTube**, volle URL, nicht privat. „About 53% of products that reached Product of the Day since 2021 include a video“ | Q4, Q2 |
| Interaktive Demo | Arcade, Storylane, ScreenSpace, Hexus, Supademo, Layerpath | Q4 |
| Launch Tags (früher Topics) | „Choose up to 3 launch tags“ | Q2 |
| Preisfeld | „free, paid, and paid (with a free trial or plan)“. Dazu optional ein **Promo-Code** | Q4, Q2 |
| Status | Kennzeichnung für „not available yet“ bzw. Beta | Q4 |
| Erster Kommentar | vorgesehen, ohne Längenlimit. „70% of products who achieved Product of the Day, Week, or Month had a first comment by the maker“. Inhalt: Features, Zielgruppe, Story, Ziele, Preise, Bitte um Feedback, „not upvotes“ | Q2, Q4 |
| Start | **12:01 AM PST (Pacific Time)**, Launch-Tag 24 Stunden. In Deutschland ist das **09:01 Uhr** Ortszeit, in den Wochen zwischen der US- und der EU-Zeitumstellung (März, Okt./Nov.) 08:01 Uhr | Q1, Q4 |
| Leaderboard | Punkte, kuratierter Featured-Bereich und daneben „All“. Product of the Day, Week (Mo–So) und Month nach Punkten | Q11, Q12, Q20 |
| API | GraphQL v2, standardmäßig nur lesend, „must not be used for commercial purposes“. **Feldlimits nennt die API-Doku nicht** | Q28 |

---

## 3. Beispiele: Developer-Tool-Launches (Okt. 2025 bis Sep. 2026, ältere markiert)

Zahlen: Score bzw. Punkte und Kommentare nach heutigem Stand. Der Wochentag ist aus dem Datum berechnet. Die Maker-Zitate sind Auszüge (siehe Methodik).

**1. Kodus**, So 26.10.2025, https://www.producthunt.com/products/kodus [Q38]
- Tagline: „Open-source AI Code Review that won't let you break prod“. Rang #6, 145 Punkte, 10 Kommentare. Preis: „Free Options“ und ein PH-Coupon „PHOFF – 30% off“. Galerie: 7 Screenshots.
- Maker-Kommentar: „Hey Product Hunt! 👋 Kodus team here! We launched Kodus about 10 months ago. It took us a while to come here (part nerves, part wanting to make sure we were truly solving something meaningful for engineering teams).“
- Kritik: „How are you handling false positives? That's usually where automated code review gets annoying“. Die Antwort war konkret: Die Regeln lernen aus Team-Mustern, und Severity lässt sich pro Repo und Ordner einstellen.
- **Takeaway:** Die False-Positive-Frage kommt bei jedem Review-Tool. Die Antwort muss konkrete Stellschrauben nennen.

**2. Gammacode**, Do 30.10.2025, https://www.producthunt.com/products/gammacode [Q39]
- Tagline: „Web and Terminal agents that scan, fix, and ship secure code“. Rang #6, 269 Punkte, 55 Kommentare. Preis: „Free Options“. Galerie: 6 Bilder aus Screenshots und GIFs.
- Opener: „I'm Yuvakiran Arthala, founder of Gammacode. … AI coding tools are great at generating code, but not so great at keeping it secure.“
- Ein Nutzer hakte beim Claim nach: „40% faster and secure? … How did you measure the efficiency?“ Der Maker verwies auf ein internes Framework und versprach, es zu open-sourcen.
- **Takeaway:** Zahlen ohne Beleg ziehen die Diskussion auf sich.

**3. Cursor 2.0**, Do 30.10.2025, https://www.producthunt.com/products/cursor/launches/cursor-2-0 [Q40]
- Tagline: „Our first coding model and new interface for agents“. #1 des Tages und der Woche, Score 965, 39 Kommentare. Maker-Kommentar: blocked: tooling.
- Laut einer Analyse von fmerian [Q32] zeigen Cursors Launches „2 to 4 images. No stock images, no marketing fluff, just product screenshots“. Der erste Kommentar ist kurz und fragt nach Feedback. Launch auf PH jeweils am Tag nach der Ankündigung auf X.
- **Takeaway:** Große Marken gewinnen mit wenig Text. Das ist für uns kein Vorbild in Sachen Reichweite, wohl aber in Sachen Minimalismus.

**4. Zed for Windows**, Fr 17.10.2025, und **Zed 1.0**, Fr 01.05.2026, https://www.producthunt.com/products/zed [Q42]
- Windows: „Ultra‑native Windows editor with WSL, extensions, and AI“, **ohne Tagesrang**, 160 Punkte, 4 Kommentare.
- 1.0: „High-performance, open source, multiplayer code editor“, #2, 365 Punkte, 14 Kommentare. Galerie: Editor-Screenshots.
- **Takeaway:** Auch bekannte Dev-Tools floppen, wenn der Anlass als Port wirkt und nicht als neues Produkt.

**5. cubic 2.0**, Mo 12.01.2026, https://www.producthunt.com/products/cubic [Q43]
- „Code reviews for the AI era“, **ohne Rang**, 138 Punkte, 8 Kommentare.
- Zum Vergleich der erste Launch (älter, 28.04.2025): „Cursor for code review“, #1 des Tages und der Woche, 733 Punkte.
- **Takeaway:** Ein Relaunch mit generischem „for the AI era“ trägt nicht. Die Vergleichs-Tagline („X for Y“) hat funktioniert.

**6. Mastra 1.0**, Mi 21.01.2026, https://www.producthunt.com/products/mastra/launches/mastra [Q44, Q32]
- „Build AI agents with a modern TypeScript stack“, #3 des Tages und #4 der Woche, 451 Punkte, 53 Kommentare.
- Die Tagline ist die H1 der Website, die Beschreibung bewusst nur 237 Zeichen lang. Die Galerie besteht aus Blöcken der Website. Verlinkt war GitHub statt der Website. PH-Launch am Tag nach dem 1.0-Release.

**7. Kilo Code Reviewer**, Di 27.01.2026, https://www.producthunt.com/products/kilocode/launches/kilo-code-reviewer [Q41, Q33]
- „Automatic AI-powered code reviews the moment you open a PR“. #1 des Tages und der Woche, #2 des Monats. Am Launch-Tag 636 Punkte und 115 Kommentare.
- Positionierung: „currently free. No credit card. Unlimited reviews“ [Q45]. Die kritische Frage dazu blieb im Thread ohne Antwort: „free with unlimited reviews and no credit card is a bold move … whats the long term plan here“.
- Maker-Kommentar: blocked: tooling. Laut Analyse [Q33] war er „minimal“, und das Team hat „upvoted and replied to every comment“.
- **Takeaway:** Die dritte Launch-Serie mit Followern im Rücken. Ein Gratisangebot löst Fragen zur Tragfähigkeit aus.

**8. Oz by Warp**, Mi 11.02.2026, und **Warp Open-Source**, Mo 11.05.2026, https://www.producthunt.com/products/warp [Q46]: „Run hundreds of cloud agents in parallel“ (ohne Rang, 199 Punkte, 21 Kommentare) und „Agentic development environment built with the community“ (ohne Rang, 224 Punkte, 30 Kommentare). **Takeaway:** Selbst Warp landet ohne Tagesrang; eine Launch-Serie garantiert nichts.

**9. Gitar**, etwa Juli 2026 (Seite: „2 months ago“), https://www.producthunt.com/products/gitar [Q47]
- „AI code review that fixes what it finds“, #12, 104 Punkte, „Free options“, 9 Galeriebilder.
- Gehuntet von Zac Zuo: „Now part of @Sonarsource, Gitar reviews PRs, diagnoses CI failures, applies fixes …“.
- Ein Kommentator zählte Cubic, CodeRabbit, Greptile, Sourcery und Octopus auf, die „leaves a lot to be desired“.
- **Takeaway:** Die Kategorie ist gesättigt, und PH-Nutzer vergleichen sofort mit der Konkurrenz.

**10. PR Lens by Coldtea.ai**, Mo 07.09.2026 (US-Feiertag Labor Day), https://www.producthunt.com/products/coldtea [Q48]
- „See code through a new lens“, **#1 des Tages** mit 336 Votes und 27 Kommentaren. An diesem Tag waren nur 10 Launches gefeatured [Q30]. 3 Galeriebilder. Maker-Kommentar: blocked: tooling.
- **Takeaway:** Die vage Tagline gewann an einem schwachen Tag. Die Konkurrenzlage schlägt die Formulierung.

**11. GitWarren**, Sa 05.09.2026, https://www.producthunt.com/products/gitwarren [Q50]
- „Review code with your coding agents before committing“, #11, 90 Votes, 10 Kommentare, gratis und Open Source, 6 Bilder.
- Opener: „I code professionally for the last 15 years – more and more with AI next to me …“.
- Auf eine Frage nach Kollisionen paralleler Agenten antwortete der Maker offen: „spotting potential conflicts between these is something I haven't thought about yet.“
- **Takeaway:** Ein ehrliches „noch nicht“ wurde nicht bestraft.

**12. TryCase**, Mo 14.09.2026, zweiter Launch nach So 05.07.2026 (#4), https://www.producthunt.com/products/trycase [Q49]
- „AI tests your PRs. Get a video walkthrough before you merge.“ Der zweite Launch kam auf #13 mit 103 Votes und 10 Kommentaren.
- Preis laut Seiten-Extrakt: „Not publicly listed (waitlist-based access)“. Das ist nicht verifiziert und stünde im Widerspruch zu Q5.
- **Takeaway:** Ein zweiter Launch nach 10 Wochen bringt deutlich weniger.

**13. Sutura**, Fr 18.09.2026, https://www.producthunt.com/products/sutura [Q51]
- „Verified self-healing CI that proves the fix“: **#46 von 91** gefeaturten Launches dieses Tages, 61 Votes, **1 Kommentar**. 12 Bilder aus Screenshots und Diagrammen, kein Video.
- Opener: „Hi Product Hunt, Juan here. A few honest notes before you click around.“ Inhaltlich: ein zweites Modell als reines Veto („can only reject a repair, never approve one“).
- **Takeaway:** Das ist inhaltlich nah an unserer Roadmap (Verifier eines zweiten Anbieters). An einem überfüllten Freitag bekam das Produkt trotzdem null Sichtbarkeit.

**14. Clueso MCP**, Di 22.09.2026, https://www.producthunt.com/products/clueso [Q37]: „Create and edit videos by chatting“, #1 mit Score 576 und 163 Kommentaren, am vollsten Tag der Woche (41 gefeaturte Launches). **Takeaway:** MCP-Launches funktionieren, wenn das Produkt schon Nutzer hat.

**15. Opaline** (vormals Rudel), Do 24.09.2026, https://www.producthunt.com/products/rudel [Q52]
- „Team-wide, message-level analytics for Claude Code and Codex“, #8, 149 Votes, 35 Kommentare.
- Maker-Kommentar in Kleinschrift mit „**why?**“-Abschnitt: „the tools people reach for today … are single-user, single-model, and pretty shallow.“
- Die Frage nach Secrets in Sessions beantwortete der Maker mit „we're filtering known secrets for everyone … on-prem / self-hosted deployments“.
- **Takeaway:** Zu Datenschutz und Secrets kommen Fragen, und eine konkrete Antwort genügt.

**16. Chit**, Sa 26.09.2026, https://www.producthunt.com/products/chit-2 [Q53]
- „A printed receipt of your day in Claude Code“, #3, Score 228, 32 Kommentare.
- Preis klar: kostenlos für den heutigen Tag, „$12 one-time“ für Pro. 5 Screenshots. Opener: „Two launches ago I put Crew here, then Notchling. Chit is the third …“.
- Ehrliche Grenze: „Not for billing hours, and I'd rather say that than have you find out on an invoice.“ Als nächsten Schritt nennt der Maker JSON-Export, „the obvious next thing“.
- **Takeaway:** Ein klarer Preis, eine ehrliche Grenze und ein Satz Roadmap reichten am Wochenende für die Top 3.

**Ältere Referenzen** (vor Okt. 2025, markiert):
- **CodeRabbit VS Code Extension** (Mi 28.05.2025): „Free AI code reviews directly in the IDE“, #5, 344 Punkte, 39 Kommentare [Q54].
- **Graphite Chat** (Di 26.08.2025): „The agentic code review experience“, ohne Rang, 166 Punkte, 9 Kommentare [Q55].
- **Aikido Security** (Do 11.09.2025): „Secure everything you build, host, and run.“, #1 [Q32].
- **AI Code Reviewer** (Dez. 2022), ein Negativbeispiel für den Umgang mit Kritik. Auf „I just tried a basic async/await without the keyword ‚await‘ and it failed to spot that“ antwortete der Maker: „Sometimes it works well but others no.“ [Q56]
- **Greptile** und **Qodo 2.0**: kein PH-Launch gefunden (`/products/greptile/launches` und `/products/qodo/launches` ⇒ 404). Qodos letzter PH-Launch war „Qodo Gen“ am 11.03.2025 [Q57].
- **Cursor Bugbot, DeepSource Autofix Bot, CodeRabbit CLI:** keine eigene PH-Launch-Seite gefunden. DeepSources letzter Launch war 2020 [Q58].

**Namenskollision (Pflichtcheck):**
- `https://www.producthunt.com/products/unslop` ist **belegt**: „Unslop – LinkedIn Posts That Don't Sound Like AI Garbage“ (theunslop.app, GitHub dainemawer/unslop, X-Link @unslop, 1 Follower, „This product has no launches“) [Q59].
- `…/products/unslop-news` ist unslop.news („HN front page without posts about AI“, 1 Punkt, etwa August 2026) [Q60].
- Weitere „slop“-Produkte: SlopCollector, Slop Goggles, slop-grader (21.09.2026, #15), Polishory („prevent AI slop“) [Q30, Q61].
- Die PH-Suche selbst lieferte im Abruf keine echten Treffer (clientseitig gerendert). Der Befund beruht auf direkten Slug-Abrufen und einer Websuche.

---

## 4. Wie Maker die Roadmap auf PH zeigen

- **PH selbst** erwähnt keine Roadmap-Sektion. Der Guide nennt für den ersten Kommentar Features, Zielgruppe, Story, Ziele, Preise und Feedback [Q2]. Im Forum-Thread „Things that make a good difference at a launch“ [Q34] steht als Tipp „Tiny roadmap or what's next“, bei Relaunches „Call out what changed“. Im selben Thread: „If I find it to be clearly AI-generated or full of emoji spam, it is off putting.“
- **Muster aus den Beispielen:**
  - Die Roadmap steht meist **als ein Satz oder als Antwort auf eine Frage**, nicht als großer Block: Chit („the obvious next thing“), Gammacode (Benchmark wird open-sourced), GitWarren („haven't thought about yet“).
  - Pull Sense (2025, älter, #15) listete auf Nachfrage vier Pläne: mehr Sprachen, einen Feedback-Loop gegen False Positives, Team-Regeln und GitLab/Bitbucket. Die Kommentare waren positiv und fragten weiter nach [Q62].
  - Kilo Code kündigte „Bitbucket support coming soon“ in einem Satz an [Q45].
- **Wie es ankommt:** Einen negativen Fall, der wegen einer Roadmap-Sektion kritisiert wurde, habe ich nicht gefunden. Das ist ein dünner Befund. Beobachtbar ist aber: Kritisiert werden **Claims ohne Beleg** (Gammacode „40% faster“) und Nachhaltigkeitsfragen zu Gratisangeboten (Kilo). Kurze, als geplant markierte Punkte wurden als Transparenz gelesen.
- **Regel-Hintergrund:** Q5 schließt „Vaporware or incomplete products“ vom Featuring aus, und PH kann Galerie und Texte redaktionell ändern [Q16]. Eine Roadmap, die den Launch dominiert, riskiert also den Eindruck von Vaporware. Q6 zählt nur signifikante Updates als Relaunch-Grund. Roadmap-Punkte sind damit zugleich **Material für künftige Launches**.

---

## 5. Zielgruppe auf PH im Jahr 2026

- **Reichweite:**
  - Similarweb (August 2026): etwa 3,3 Mio. Besuche. Die Zeitraumangabe im Extrakt ist unklar. USA 39,6 %, Indien 14,2 %, **Deutschland 2,4 %**. 66,6 % männlich, größte Gruppe 25–34 Jahre. Unter den Interessen steht „programming/developer software“ [Q35].
  - fmerian nennt „4.2 million monthly unique visitors“ für April 2026 (Similarweb) und einen Newsletter mit 1 Mio. Abonnenten [Q31]. Das ist eine Sekundärquelle.
- **Wer votet:** Eine offizielle Aufschlüsselung nach Rollen (Entwickler, CTO, Marketer, Indie-Hacker) gibt es nicht. **Keine belastbare Zahl gefunden.**
  - Qualitativ: „Many users on Product Hunt are technical founders. They code.“ (Darko Gjorgjievski, Kilo Code, in Q31).
  - Die Top-10-Listen im September 2026 enthalten zu großen Teilen Coding-Agent-, MCP- und Dev-Tools. Ein Dev-Tool konkurriert dort also mit anderen Dev-Tools und mit Launches großer Labore (GPT-6, Claude Opus 5.5) [Q37].
- **Was abgelehnt wird:**
  - Vote-Betteln und Massen-DMs [Q7, Q9].
  - Generische Kommentare („congrats!“) [Q8].
  - **KI-Kommentare** („No LLMs or Chrome extensions please!“ [Q8]). PH filtert „AI-generated actions“ aus den Punkten [Q15].
  - Emoji-Spam und KI-Ton im Maker-Kommentar [Q34].
  - Stockbilder und „marketing fluff“ in der Galerie [Q31, Q32].
  - Unbelegte Zahlen (Gammacode).
- **Was funktioniert:**
  - echte Produkt-Screenshots,
  - eine einfache Tagline, die Features nennt statt Nutzen („They highlight the features, not the benefits“ [Q32]),
  - auf jeden Kommentar antworten („We left no questions or comments unanswered“ [Q31]),
  - ein klarer Preis (Chit), ein PH-spezifisches Angebot (Kodus-Coupon),
  - offene Grenzen (Chit, Sutura),
  - eine Follower-Basis aus früheren Launches („Every follower we collected from past launches receives a notification“ [Q31]).

---

## 6. Timing

| Aussage | Beleg | Evidenzqualität |
|---|---|---|
| Start 12:01 AM PT, 24 Stunden | Q1, Q4 | **primär, hart** |
| „The best day to launch is the day on which you're most prepared“ | Q1 | primär, Meinung |
| „Products launched on the weekend get 15% more ‚Visit‘ button clicks than those on weekdays“; große Firmen launchen werktags | Q2 | **primär, Zahl ohne Methodik** |
| Eigene Auswertung September 2026 (hunted.space, 28 Tage, je 4 Tage pro Wochentag). Gefeaturte Launches im Schnitt: Mo 19,5 · Di 29 · Mi 17,5 · Do 21,2 · **Fr 48,2** · Sa 13,5 · So 10,2. Median der Votes für Rang 1: Mo 474 · **Di 521** · Mi 457 · Do 374 · Fr 440 · Sa 346 · So 337. Median für Rang 5: Mo 241 · Di 203 · Mi 194 · Do 212 · Fr 207 · **Sa 129** · So 150 | Q30 | **eigene Messung, dünn** (1 Monat, n=4 je Wochentag). Die Freitage 18.9. (91) und 25.9. (67) sind Ausreißer |
| Dev-Tools haben sonntags gewonnen: Kilo Code am 28.09.2025 auf #1 („Kilo Code is targeting developers … in and out of work“), Kodus am So auf #6, TryCase am So auf #4, Chit am Sa auf #3 | Q32, Q38, Q49, Q53 | Einzelfälle |
| „Tuesday, Monday, and Thursday are the most competitive days“ | Q36 zitiert MySignature.io (11/2025) | **Sekundär aus zweiter Hand** |
| Randomisierung und verborgene Votes in den ersten 4 Stunden, Ziel „Top 4 within the first 4 hours“ | Q24 (2023), Q31 | primär nur für 2023 belegt, **2026 unbestätigt** |
| Featured-Launches bringen 1.000–5.000 Besucher, nicht gefeaturte 100–500 | Q36 (zitiert „Awesome Directories“, 11/2025) | sekundär, unbelegt |
| „Launch week“ bzw. Serien: Supabase 16+, Stripe 70+ Launches. Cursor und Mastra launchten am Tag nach Release bzw. Ankündigung auf X. Appwrite postete 10 Tage vorher auf X | Q31, Q32 | Fallbeispiele |

**Lesart:** Werktags gibt es mehr Konkurrenz und höhere Schwellen, am Wochenende weniger Konkurrenz und laut PH mehr Klicks pro Launch. Für ein Team, das Feedback und erste Nutzer sucht und kein Badge, spricht das eher für Sa, So oder einen ruhigen Montag. Ein US-Feiertag ist ein Glücksfall (PR Lens). Freitage mit vielen Featured-Launches meiden. Große Labor- oder Cursor-Launches sind nicht planbar.

---

## 7. Ableitungen für unslop

1. **Heute kein Launch, auch kein Teaser.**
   - Signups sind geschlossen, npm und der Marketplace liefern 404, und die Rechtsseiten sind nicht live (CONTEXT.md).
   - PH featured keine „Waitlisted products (without immediate access)“ und kein „Vaporware“ [Q5]. „Email sign-up“-Produkte kommen nicht auf die Homepage [Q10].
   - Coming-soon-Seiten gibt es nicht mehr. Der Ersatz, ein Forum-Thread, wäre eine öffentliche Ankündigung und deshalb erst nach dem HR-Eintrag und mit Impressum zulässig.
2. **PH nach HN, etwa L + 1–3 Wochen** (wie PLAN.md). Dann stecken HN-Einwände (Closed Source, Verifier aus derselben Modellfamilie, JS/TS-only) schon in FAQ und Maker-Kommentar. Voraussetzungen vor dem Einplanen:
   - GitHub App ohne Operator installierbar,
   - `@unslopcodes/cli` auf npm,
   - VS-Code-Extension im Marketplace,
   - Paddle live und Preis öffentlich,
   - Impressum und Datenschutzerklärung live.
3. **Accounts jetzt anlegen, nicht erst am Launch-Tag.** Persönliche Profile beider Gründer mit Klarnamen, Foto und Headline. Einen Firmen-Account nicht benutzen [Q14]. Mindestens eine Woche Wartezeit, PH rät zu drei Monaten Vorlauf [Q3]. Bis dahin echte, eigene Kommentare bei anderen Dev-Tools. Selbst-Hunt genügt (79 % bzw. 60 % [Q3]), und einen bezahlten Hunter verbieten die Regeln [Q3].
4. **Name und Slug:**
   - `unslop` ist auf PH belegt (theunslop.app), dazu kommt unslop.news. Das X-Handle @unslop ist dort verlinkt.
   - Namensfeld „unslop.codes“ oder „unslop“, Slug etwa `unslop-codes`, vorher prüfen. Die Tagline muss das Produkt allein erklären.
5. **Tagline (≤ 60 Zeichen), Features statt Nutzen, kein Superlativ.** Kandidaten, Länge geprüft:
   - „PR checks for AI-written code: rule IDs and 1-click fixes“ (57)
   - „A review gate for AI-written code, with rule IDs and fixes“ (58)
   - „119 research-backed rules for AI-written pull requests“ (54)
   - Nicht verwenden: „The only AI code gate that doesn't ask an AI …“ (CONTEXT §4c) und „deterministic“ ohne den Ehrlichkeits-Satz.
6. **Beschreibung ≤ 260 Zeichen** (unter beiden PH-Limits gültig) und **Preisfeld „Paid (with a free trial or plan)“**, aber nur, wenn der Trial wirklich live ist.
   - Den Preis nennen (€29/Monat) und ebenso, ob der Trial eine Karte verlangt. Das gehört in Beschreibung und Maker-Kommentar und darf nicht erst in einer Antwort auftauchen.
   - Ein PH-Promo-Code, etwa ein verlängerter Trial, ist erlaubt [Q4] und bei Kodus belegt.
7. **Galerie: 5–6 echte Screenshots in 1270×760, keine Illustrationen und keine Stockbilder:**
   - (1) Check Run „1 critical slop finding“ auf einem PR,
   - (2) Review-Kommentar mit Regel-ID und 1-Klick-`suggestion`,
   - (3) Terminal mit `unslop scan`,
   - (4) VS-Code-Diagnostics,
   - (5) Schaubild „55 deterministic detectors + LLM reviewer (JS/TS) + blind verifier“ mit den Grenzen,
   - (6) optional als letzte Folie eine **klar beschriftete Konzeptfolie „Planned – not built yet“**, ohne Daten und ohne Mockups, die wie echte UI aussehen.

   Das Thumbnail ist das Logo in 240×240, als statisches Bild. Ein Video ist optional (nur YouTube, 53 % der Tagessieger haben eins [Q2]). Wenn, dann ein echter Screen-Capture.
8. **Maker-Kommentar vom Gründer selbst geschrieben, nicht per LLM** (PH: „No LLMs“ [Q8]; CONTEXT-Hinweis). Aufbau, kurz und ohne Emoji-Kaskade:
   1. wer wir sind, zwei Namen, kleines deutsches Team;
   2. das Problem in einem Satz;
   3. was unslop tut (Check, Kommentare, CLI, VS Code, MCP);
   4. wie es entscheidet: nur CRITICAL lässt den Check fehlschlagen, 55 deterministische Detektoren, der Rest LLM plus Blind-Verifier;
   5. **Grenzen**: LLM nur für JS/TS, Draft und Verifier derzeit dieselbe Modellfamilie, Vertex EU;
   6. Preis und Trial;
   7. **„What's next (planned, not built)“** mit höchstens 3 Punkten im Wortlaut aus CONTEXT §5, etwa einem Integritätstrend pro Repo, einem Verifier eines zweiten Anbieters und einem signierten Prüfnachweis pro Commit-SHA;
   8. eine konkrete Feedback-Frage, etwa „Which rule would you want that we're missing?“.

   **Kein Wort von Upvotes.**
9. **Kommentar-Dienst:** Der Start liegt in Deutschland bei 09:01 Uhr (außerhalb der Umstellungswochen). Beide Gründer antworten von 09:00 bis etwa 01:00 Uhr MESZ auf jeden Kommentar, damit der US-Tag abgedeckt ist. Vorbereitete, ehrliche Antworten auf die absehbaren Fragen:
   - False Positives (Kodus),
   - Code und Secrets: was hochgeladen wird und wie gefiltert wird (Opaline). Keinen Garantie-Claim machen, und im PR-Pfad gibt es keinen serverseitigen Filter,
   - Closed Source,
   - warum nicht CodeRabbit, Greptile oder cubic (Gitar-Thread),
   - Tragfähigkeit und Preis.

   „Not yet“ ist eine zulässige Antwort (GitWarren, Chit). Zahlen nur mit Beleg, denn die Gammacode-Lehre gilt. Das 44×-Zitat und eigene Benchmark-Zahlen bleiben weg (CONTEXT).
10. **Outreach-Wortlaut:** „We're live on Product Hunt – questions and criticism welcome“ mit Link [Q1: „ask them to visit and comment“]. Nie „upvote“ oder „support us“ schreiben, keine Massen-DMs, keine Vote-Services, keine frisch angelegten Accounts von Freunden oder Team, keine KI-Kommentare. Die Punktefilter entfernen solche Stimmen ohnehin [Q15].
11. **Tag:** Sa, So oder ein ruhiger Montag bzw. US-Feiertag, keine vollen Freitage (§6, Evidenz dünn). Einplanen per „Schedule“ bis zu 30 Tage vorher, den Entwurf vorher per Draft im Team prüfen [Q17, Q23]. Die Ankündigung auf X und LinkedIn geht am Vortag oder am selben Morgen raus (Cursor- und Mastra-Muster).
12. **Relaunch-Ökonomie:** Der erste Launch sollte das **vollständige Produkt** zeigen. Danach gilt die 6-Monats-Sperre, und UI- oder Preisänderungen zählen nicht [Q6]. Die Roadmap-Punkte (Revision-gegen-Revision-Gate, Trend, zweiter Anbieter, signierter Nachweis, Team-Pläne) sind die natürlichen Anlässe für spätere Launches. Deshalb heute nur als geplant nennen und nicht als Galerie-Versprechen ausbauen. Die Landing-Behauptung „If quality drops, the build fails“ muss vor dem PH-Launch weg oder gebaut sein (CONTEXT §6).

---

## Quellenverzeichnis (alle abgerufen 2026-09-29)

**Primärquellen Product Hunt**
- Q1 Launch Guide, https://www.producthunt.com/launch (curl 403, WebFetch ok), abgerufen 2026-09-29
- Q2 Preparing for launch, https://www.producthunt.com/launch/preparing-for-launch, abgerufen 2026-09-29
- Q3 Before launch, https://www.producthunt.com/launch/before-launch, abgerufen 2026-09-29
- Q4 How to post a product (Jake Crump, 28.05.2025), https://help.producthunt.com/en/articles/479557-how-to-post-a-product, abgerufen 2026-09-29
- Q5 Featuring Guidelines (10.03.2026), https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines, abgerufen 2026-09-29
- Q6 Can I relaunch my product? (07.07.2026), https://help.producthunt.com/en/articles/484934-can-i-relaunch-my-product, abgerufen 2026-09-29
- Q7 Community Guidelines (11.04.2025), https://help.producthunt.com/en/articles/3615694-community-guidelines, abgerufen 2026-09-29
- Q8 Commenting Guidelines (28.07.2025), https://help.producthunt.com/en/articles/10030102-commenting-guidelines, abgerufen 2026-09-29
- Q9 Can I ask … to upvote (10.02.2025), https://help.producthunt.com/en/articles/484935-can-i-ask-my-community-friends-family-to-upvote-a-product, abgerufen 2026-09-29
- Q10 Can I submit an unreleased product? (10.02.2025), https://help.producthunt.com/en/articles/484932-can-i-submit-an-unreleased-product, abgerufen 2026-09-29
- Q11 How is the homepage ranked? (21.02.2025), https://help.producthunt.com/en/articles/484938-how-is-the-homepage-ranked, abgerufen 2026-09-29
- Q12 How do things end up on the homepage? (21.02.2025), https://help.producthunt.com/en/articles/484923-how-do-things-end-up-on-the-homepage, abgerufen 2026-09-29
- Q13 Why is my post not on the homepage? (28.07.2025), https://help.producthunt.com/en/articles/484926-why-is-my-post-not-on-the-homepage, abgerufen 2026-09-29
- Q14 How can I get access to post? (30.07.2025), https://help.producthunt.com/en/articles/481909-how-can-i-get-access-to-post, abgerufen 2026-09-29
- Q15 Why did my launch points go down? (30.05.2025), https://help.producthunt.com/en/articles/4853541-why-did-my-launch-points-go-down, abgerufen 2026-09-29
- Q16 Why did my post content change? (06.03.2025), https://help.producthunt.com/en/articles/8858588-why-did-my-post-content-change, abgerufen 2026-09-29
- Q17 How to schedule a post (02.02.2026), https://help.producthunt.com/en/articles/2724119-how-to-schedule-a-post, abgerufen 2026-09-29
- Q18 How to share a scheduled launch (30.06.2026), https://help.producthunt.com/en/articles/15706445-how-to-share-a-scheduled-launch, abgerufen 2026-09-29
- Q19 Daily Hunt Limits (03.04.2026), https://help.producthunt.com/en/articles/14440291-daily-hunt-limits, abgerufen 2026-09-29
- Q20 Product of the Day, Week & Month (10.07.2025), https://help.producthunt.com/en/articles/11751186-product-of-the-day-week-month, abgerufen 2026-09-29. Q20b: How can I ensure my product is visible (28.07.2025), https://help.producthunt.com/en/articles/11869311-how-can-i-ensure-my-product-is-visible-on-product-hunt, abgerufen 2026-09-29
- Q21 Hunter vs Makers (10.02.2025), https://help.producthunt.com/en/articles/10082986-hunter-vs-makers-and-how-to-change-them, abgerufen 2026-09-29
- Q22 Why was my comment or post removed? (05.09.2025), https://help.producthunt.com/en/articles/3539992-why-was-my-comment-or-post-removed, abgerufen 2026-09-29
- Q23 Where did Launch Now go? (24.02.2025), https://help.producthunt.com/en/articles/9823193-where-did-launch-now-go, abgerufen 2026-09-29
- Q24 „Let's talk about spam“ (Ashley Higgins, 23.03.2023), https://www.producthunt.com/stories/let-s-talk-about-spam, abgerufen 2026-09-29
- Q25 Changelog, https://www.producthunt.com/changes, abgerufen 2026-09-29
- Q26 Forum „How has Product Hunt changed in the last year? 2025 Recap“, https://www.producthunt.com/p/general/how-has-product-hunt-changed-in-the-last-year-2025-recap, abgerufen 2026-09-29
- Q27 „Introducing Randomized Leaderboard Day“ (Gabe Perez), https://www.producthunt.com/p/producthunt/introducing-randomized-leaderboard-day-on-product-hunt, abgerufen 2026-09-29
- Q28 API v2 Docs, https://api.producthunt.com/v2/docs (curl 200), abgerufen 2026-09-29
- Q29 Artikelliste „Posting“, https://help.producthunt.com/en/collections/31079-posting, abgerufen 2026-09-29. `/about` nur per curl versucht (403)
- Q37 Daily Leaderboards, https://www.producthunt.com/leaderboard/daily/2025/10/30 sowie …/2026/9/21, /22, /23, /24, /25, /26, /27, abgerufen 2026-09-29

**Sekundärquellen (als solche markiert)**
- Q30 hunted.space, Featured-Launch-Historie September 2026 (`__NEXT_DATA__` ausgewertet), https://hunted.space/history, abgerufen 2026-09-29
- Q31 fmerian, „product-hunt-launch-guide.md“ (Autor bietet bezahlte Launch-Hilfe an, also befangen), https://github.com/fmerian/awesome-product-hunt/blob/main/product-hunt-launch-guide.md, abgerufen 2026-09-29
- Q32 fmerian, Teardowns Cursor (13.01.2026), Aikido (11.09.2025), Appwrite (19.05.2025), Mastra (21.01.2026), Kilo (28.09.2025), https://github.com/fmerian/awesome-product-hunt/tree/main/teardowns, abgerufen 2026-09-29
- Q33 „Kilo Code Reviewer – 24 hours on Product Hunt“, https://www.producthunt.com/p/kilocode/kilo-code-reviewer-24-hours-on-product-hunt, abgerufen 2026-09-29
- Q34 Forum „Things that make a good difference at a launch“, https://www.producthunt.com/p/general/things-that-make-a-good-difference-at-a-launch-on-product-hunt, abgerufen 2026-09-29
- Q35 Similarweb producthunt.com, https://www.similarweb.com/website/producthunt.com/, abgerufen 2026-09-29
- Q36 shno.co, Product-Hunt-Statistiken 2026 (Aggregator), https://www.shno.co/marketing-statistics/product-hunt-launch-statistics, abgerufen 2026-09-29

**Produkt- und Launch-Seiten**
- Q38 https://www.producthunt.com/products/kodus (dazu /launches und https://www.producthunt.com/posts/kodus), abgerufen 2026-09-29
- Q39 https://www.producthunt.com/products/gammacode, abgerufen 2026-09-29
- Q40 https://www.producthunt.com/products/cursor/launches (und …/cursor-2-0), abgerufen 2026-09-29
- Q41 https://www.producthunt.com/products/kilocode/launches, abgerufen 2026-09-29
- Q42 https://www.producthunt.com/products/zed, abgerufen 2026-09-29
- Q43 https://www.producthunt.com/products/cubic, abgerufen 2026-09-29
- Q44 https://www.producthunt.com/products/mastra/launches, abgerufen 2026-09-29
- Q45 https://www.producthunt.com/p/kilocode/kilo-code-reviewer-automatic-ai-powered-code-reviews-for-free, abgerufen 2026-09-29
- Q46 https://www.producthunt.com/products/warp/launches, abgerufen 2026-09-29
- Q47 https://www.producthunt.com/products/gitar, abgerufen 2026-09-29
- Q48 https://www.producthunt.com/products/coldtea, abgerufen 2026-09-29
- Q49 https://www.producthunt.com/products/trycase, abgerufen 2026-09-29
- Q50 https://www.producthunt.com/products/gitwarren, abgerufen 2026-09-29
- Q51 https://www.producthunt.com/products/sutura, abgerufen 2026-09-29
- Q52 https://www.producthunt.com/products/rudel, abgerufen 2026-09-29
- Q53 https://www.producthunt.com/products/chit-2 (und https://www.producthunt.com/posts/chit-2), abgerufen 2026-09-29
- Q54 https://www.producthunt.com/products/coderabbit/launches, abgerufen 2026-09-29
- Q55 https://www.producthunt.com/products/graphite/launches, abgerufen 2026-09-29
- Q56 https://www.producthunt.com/products/ai-code-reviewer-2, abgerufen 2026-09-29
- Q57 https://www.producthunt.com/products/codiumai/launches. Dazu 404 auf https://www.producthunt.com/products/qodo/launches und https://www.producthunt.com/products/greptile/launches, abgerufen 2026-09-29
- Q58 https://www.producthunt.com/products/deepsource, abgerufen 2026-09-29
- Q59 https://www.producthunt.com/products/unslop (und /launches), abgerufen 2026-09-29
- Q60 https://www.producthunt.com/products/unslop-news, abgerufen 2026-09-29
- Q61 https://www.producthunt.com/products/slopcollector, https://www.producthunt.com/products/slop-goggles, abgerufen 2026-09-29
- Q62 https://www.producthunt.com/products/pull-sense, abgerufen 2026-09-29
