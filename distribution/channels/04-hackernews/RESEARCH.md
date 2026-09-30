# Hacker News: Kanal-Research für unslop

Stand: 2026-09-29. Alle Quellen wurden am 2026-09-29 abgerufen, sofern nicht anders vermerkt. Zitate und Titel stehen im englischen Original.

**Methodik und Zugriffsgrenzen**
- Die HN-Primärseiten (`newsguidelines.html`, `showhn.html`, `newsfaq.html`, `formatdoc`, `yli.html`, `showlim`, `genai-pushback`) liefern per curl HTTP 200. `formatdoc.html` (mit Endung) liefert 404, ohne Endung 200.
- Einzelne Threads habe ich direkt von `news.ycombinator.com/item?id=…` gelesen. Nur dort stimmt die Kommentarreihenfolge mit dem HN-Ranking überein. Die Algolia-API (`hn.algolia.com/api/v1/…`) habe ich für Suche, Metadaten und Kommentarbäume genutzt. Einzelne Abrufe von news.ycombinator.com brachen mit „connection reset“ ab und liefen beim zweiten Versuch durch.
- Punkte und Kommentarzahlen sind Stände vom 2026-09-29. Die Datumsangaben sind UTC. Mit „Maker“ ist der Einreicher gemeint.
- Die eigene Timing-Auswertung (Abschnitt 7) umfasst **alle 45.844 Show-HN-Posts vom 2025-10-01 bis 2026-09-29**. Ich habe sie tageweise über `search_by_date` abgerufen, und kein Tag war abgeschnitten. Die Auswertung ist korrelativ und kein Experiment.

---

## 1. Offizielle Regeln (Primärquellen)

### 1.1 Site-Guidelines
Quelle: https://news.ycombinator.com/newsguidelines.html (abgerufen 2026-09-29)

- Titel: „Please don't do things to make titles stand out, like using uppercase or exclamation points, or saying how great an article is.“ Außerdem: „If the title contains a gratuitous number or number + adjective, we'd appreciate it if you'd crop it.“ Und: „Otherwise please use the original title, unless it is misleading or linkbait; don't editorialize.“
- Selbstpromotion: „Please don't use HN primarily for promotion. It's ok to post your own stuff part of the time, but the primary use of the site should be for curiosity.“
- **Generierter Text** (seit 2026 ausdrücklich in den Guidelines): „Please don't put generated text in HN posts. Write your text yourself, because HN is for sharing between humans. For the same reason, don't automate posting.“ Für Kommentare gilt: „Don't post generated text or AI-edited text. HN is for conversation between humans.“
- Löschen und Neuposten: „Please don't delete and repost. Deletion is for things that shouldn't have been submitted in the first place.“
- Keine Stimmenwerbung: „Don't solicit upvotes, comments, or submissions. Users should vote and comment when they run across something they personally find interesting—not for promotion.“
- Accounts: „Throwaway accounts are ok for sensitive information, but please don't create accounts routinely. HN is a community—users should have an identity that others can relate to.“
- Kritik an Arbeiten anderer: „Please don't post shallow dismissals, especially of other people's work. A good critical comment teaches us something.“

### 1.2 Show-HN-Guidelines
Quelle: https://news.ycombinator.com/showhn.html (abgerufen 2026-09-29)

- „Show HN is for something you've made that other people can play with. HN users can try it out, give you feedback, and ask questions in the thread.“
- „Off topic: blog posts, sign-up pages, newsletters, lists, and other reading material. Those can't be tried out, so can't be Show HNs.“
- **Neu und für uns relevant:** „The project should be non-trivial. Don't post quickly-generated one-offs; anybody can do that now. Share something that is deeply personal and interesting to you. Explain how and why.“
- „Please make it easy for users to try your thing out, ideally without barriers such as signups or emails. You'll get more feedback that way.“
- „If your work isn't ready for users to try out, please don't do a Show HN. Once it's ready, come back and do it then. Don't post landing pages or fundraisers.“
- „Every Show HN appears on shownew. Once it clears a small points threshold, it will appear on the show page in the top bar.“
- „New features and upgrades ("Foo 1.3.1 is out") generally aren't substantive enough to be Show HNs. A major overhaul is probably ok.“
- „Please don't ask friends to upvote or comment. That's not ok on HN.“
- An Kommentierende gerichtet: „When something isn't good, you needn't pretend that it is, but don't be gratuitously negative.“

### 1.3 FAQ
Quelle: https://news.ycombinator.com/newsfaq.html (abgerufen 2026-09-29)

- Ranking: „The basic algorithm divides points by a power of the time since a story was submitted. […] Other factors affecting rank include user flags, anti-abuse software, software which demotes overheated discussions, account or site weighting, and moderator action.“
- Karma: „Do posts by users with more karma rank higher? No.“
- Reposts, Wortlaut geprüft: „If a story has not had significant attention in the last year or so, a small number of reposts is ok. Otherwise we bury reposts as duplicates.“
- Stimmenwerbung: „We penalize or ban submissions, accounts, and sites that break this rule“. Zur Bitte um Kommentare: „HN readers are sensitive to this and will detect it, flag it, and use unkind words like 'spam'.“
- Grüne Namen: „Green indicates a new account.“ Weitere Regeln zu grünen Accounts nennt die FAQ nicht.
- Flags: „[flagged]“ bedeutet „Users flagged the post as breaking the guidelines“. „[dead]“ steht für „killed by software, user flags, or moderators“. Toten Posts kann man per „vouch“ wieder Sichtbarkeit verschaffen.
- Threads schließen „after two weeks“.
- Den **Second-Chance-Pool** erwähnt die FAQ nicht. Primärquelle ist ein Kommentar von dang (siehe 1.5).

### 1.4 Tipps von dang für Show HN (die in showhn.html verlinkten „tips“)
Quelle: https://news.ycombinator.com/item?id=22336638 (dang, 2020, ergänzt 2026-03-28; abgerufen 2026-09-29)

- Ergänzung vom 2026-03-28: „**Write your text by hand. Don't use an LLM to generate any of it (not even a tiny bit, including to edit or spruce it up).** Reason: the community is super fussy about this right now, and LLM language leaves imprints on your text which are generating quite some backlash […]. This is a big dividing line at present!“
- „Include text giving the backstory of how you came to work on this, and explaining what's different about it.“
- „Include a clear statement of what your project is or does. If you don't, the discussion will consist of "I can't tell what this is".“
- „Drop any language that sounds like marketing or sales. On HN, that is an instant turnoff.“
- „Please make it easy for users to try your thing out, preferably without having to sign up, get a confirmation email, and other such barriers. […] HN users get ornery if you make them jump through hoops.“
- „**Don't have your username be that of your company or project.**“
- „Make sure your friends and users do not add booster comments in the thread. HN users are adept at picking up on those, they consider it spamming, and they will flame you for it.“
- Neue Release als Show HN nur, „if the new version is significantly different“, und höchstens „once or twice a year“.
- „put your email address in your profile so we can […] send you a repost invite“.

### 1.5 Moderationspraxis (dang, Primärquelle Kommentare)
- **Voting Rings:** „I go back and look at the data when people post about how they've gotten results by gaming HN, and what I see is a trail of penalized accounts.“ Quelle: https://news.ycombinator.com/item?id=9865544 (2015). An anderer Stelle schreibt er, gekaufte oder organisierte Stimmen „typically get hit by HN's voting ring detector“ (https://news.ycombinator.com/item?id=9336615, 2015). Aktueller zu Booster-Kommentaren, die „pretty common on launch threads“ seien und von Moderatoren geflaggt würden: https://news.ycombinator.com/item?id=47327129 (2026-03-10).
- **Neue Accounts und Show HN (2026):** Seit März 2026 bekommen viele Accounts ohne HN-Historie beim Posten einer Show HN die Seite https://news.ycombinator.com/showlim zu sehen: „We're temporarily restricting Show HNs because of a massive influx, mostly by users who aren't yet familiar with the site or its culture. […] Take some time to get to know the community, become a good contributor, and then it will be fine to post an occasional Show HN.“ dang dazu: „Just new ones for now. […] I do think a bit of community participation is reasonable before posting a Show HN, so it isn't just a box on some "how to promote your project" checklist.“ (https://news.ycombinator.com/item?id=47300821). Kriterien nennt er bewusst nicht: „If we specified technical criteria X, Y, Z, all that would happen is they'd end up on an LLM checklist somewhere.“ (https://news.ycombinator.com/item?id=47390012). Beide abgerufen 2026-09-29.
- **Warteliste und reine Signup-Seiten** verlieren das „Show HN“ im Titel: „Waitlists are against the Show HN rules“ (https://news.ycombinator.com/item?id=49063784, 2026-07-27) und „You can't do a Show HN with just a signup page“ (https://news.ycombinator.com/item?id=32415070, 2022).
- **Second-Chance-Pool:** „Moderators and a small number of reviewers go through old submissions […]. These get put into a hopper from which software randomly picks one every so often and lobs it randomly onto the lower part of the front page.“ Man kann es auch selbst vorschlagen: „It's fine if it's your own article, but we like it better when it's just something you ran across“ (https://news.ycombinator.com/item?id=26998308). Eine Show HN mit Re-up von 2026 zeigt, dass das in der Praxis vorkommt: https://news.ycombinator.com/item?id=49513694.
- **Generierter Text:** Die Meta-Story „Don't post generated/AI-edited comments. HN is for conversation between humans“ hat **4.229 Punkte und 1.668 Kommentare** (2026-03-11, https://news.ycombinator.com/item?id=47340079). dang pflegt außerdem eine Liste mit Reaktionen von Nutzern auf Texte, die nach KI klingen: https://news.ycombinator.com/genai-pushback („Readers are developing allergic sensitivities to language that sounds like an LLM produced it“, https://news.ycombinator.com/item?id=48887149).

### 1.6 Launch HN (nur für YC-Firmen, für uns nicht verfügbar)
Quelle: https://news.ycombinator.com/yli.html (abgerufen 2026-09-29)

„Launch HN is a way for YC startups to launch on Hacker News.“ Jede YC-Firma bekommt genau eine Launch HN, der Text wird mit dem HN-Team abgestimmt, und die Software setzt den Post auf die Frontpage. **unslop ist nicht in YC und kann diesen Weg nicht nutzen.** Die Seite sagt aber ausdrücklich: „If you're not a YC startup, the above doesn't apply, but you should still follow the advice below.“ Die Ratschläge gehören zu den präzisesten, die es gibt:
- „Don't write in a marketing, sales, or PR style.“ Und: „If it sounds like your home page or your pitch deck, it won't work on HN.“
- „Don't use superlatives (fastest, biggest, first, best). Modest language is stronger.“
- „Remove signup barriers, at least for launch day“. „Make your pricing transparent. If it isn't, HN readers will complain.“
- „Don't use bait-and-switch tactics. Example: if you need users to set up an onboarding call, make it clear up front.“ Das gilt sinngemäß auch für eine Kreditkarte im Trial.
- „Say how you make money or plan to.“ „Don't make lists of features.“ „Don't use single-sentence paragraphs. They read like sales letters.“
- „When criticized, act like the critics are doing you a favor. […] You never have to convince a critic—your goal is to win over the large silent audience.“
- „Reply when comments start appearing. […] The hivemind gets cranky without attention, and your post will fall down the page faster.“
- Die Warnung vor Booster-Kommentaren steht dort mit dem Zusatz „Please re-read the previous paragraph. It is the worst mistake you can make on HN!“

---

## 2. Technische Specs

- **Titellänge: 80 Zeichen.** Das steht in yli.html („Your title must be 80 chars or less“), und dang spricht vom „80-char limit“ (https://news.ycombinator.com/item?id=28050314). Der Präfix „Show HN: “ zählt mit.
- **URL plus Text:** Eine Show HN kann eine URL und einen Text haben. Der Text erscheint oben im Thread. Aus dang-Tipps: „Your text should show up at the top of the Show HN submission, but if for some reason it doesn't, add it as a first comment“.
- **Links im Text:** Die FAQ sagt „How do I make a link in a text submission? You can't.“, und formatdoc sagt „Urls become links, except in the text field of a submission.“ Aktuelle Show-HN-Texte enthalten aber klickbare Links: Im Stage-Post (47796818) ist `https://stagereview.app/explore` im Toptext als `<a href>` gerendert. Die Primärquellen sind hier also veraltet. Links im Text sollten wir trotzdem sparsam einsetzen und als nackte URLs schreiben.
- **Formatierung** (https://news.ycombinator.com/formatdoc, abgerufen 2026-09-29): „Blank lines separate paragraphs.“ „Text surrounded by asterisks is italicized.“ „Text after a blank line that is indented by two or more spaces is formatted as code.“ „If your url gets linked incorrectly, put it in <angle brackets>“. Überschriften, Fett, Bilder, Videos, Tabellen und Markdown-Listen gibt es nicht. Listen schreibt man als Zeilen mit „-“ oder „*“, die als Klartext erscheinen.
- Bei Video- oder PDF-Links hängt man „[video]“ oder „[pdf]“ an den Titel an (Guidelines).
- **Sichtbarkeit:** Jede Show HN landet auf `/newest` und `/shownew`. Auf `/show` erscheint sie erst über einer „small points threshold“ (FAQ). Die genaue Schwelle ist nicht veröffentlicht.
- **Editieren:** Kommentare lassen sich eine Weile nach dem Posten bearbeiten. Mit der Profileinstellung `delay` (maximal 10 Minuten) kann man den eigenen Kommentar vor der Veröffentlichung zurückhalten (FAQ).

---

## 3. Show-HN-Beispiele aus der Kategorie (Okt. 2025 – Sep. 2026)

Zum Kontext: Im Zeitfenster gab es **156 Show HNs mit „code review“ im Titel**. Davon kamen 16 auf mindestens 10 Punkte, 4 auf mindestens 50 und 3 auf mindestens 100. Bei „linter“ im Titel waren es 95, 10, 3 und 2. Quelle: Algolia-Suche mit `restrictSearchableAttributes=title`, abgerufen 2026-09-29. Die Kategorie ist überfüllt, und die meisten Posts gehen ohne Resonanz unter.

**1. „Show HN: I made a heatmap diff viewer for code reviews“**. 2025-10-30, https://news.ycombinator.com/item?id=45760321, 265 Punkte, 68 Kommentare. Open Source (MIT), kostenlos, bei öffentlichen Repos ohne Login nutzbar: Man ersetzt in der PR-URL `github.com` durch `0github.com`. Maker-Text: „0github.com is a pull request viewer that color-codes every diff line/token by how much human attention it probably needs.“ Dazu kamen vier Beispiel-PRs bekannter Repos. Kritik: „Why does it require signing and granting you full access to act as me on Github to use?“ Außerdem „feels pretty expensive for what might still be a guess at what matters“ und der Einwand, man verbrauche „the energy a small town needs“. Der Maker antwortete sofort und konkret, verlinkte die Quelldatei mit der Review-Logik und reparierte Caching live („pushed a fix, should work now“). **Takeaway:** Das Produkt ließ sich ohne Konto ausprobieren, es gab Beispiel-PRs bekannter Projekte, und der Maker verlinkte den Code. Das war der erfolgreichste Post der Kategorie. Der einzige große Kritikpunkt waren die OAuth-Berechtigungen.

**2. „Show HN: Stage – Putting humans back in control of code review“**. 2026-04-16, https://news.ycombinator.com/item?id=47796818, 130 Punkte, 111 Kommentare. Closed Source, kostenpflichtig, Login mit GitHub. Zum Ausprobieren ohne Login gibt es `stagereview.app/explore` mit Beispiel-PRs und ein Demo-Video. Einstieg: „Hey HN! We're Charles and Dean, and we're building Stage“. Der Text grenzt sich ausdrücklich ab: „What we're not building: a code review bot like CodeRabbit or Greptile.“ Kritik: „You cannot solve this problem by adding more AI on top.“ Dann „Why is this a service and not an open source project?“, „No pricing page, you've lost my interest.“ und „Y'all are a bit nuts if you want 50% more per month than Claude Pro for this.“ Auf den Preisvorwurf antwortete der Maker mit „Totally fair, we're working on it!“, auf die Open-Source-Frage mit „Open source is something we're thinking about!“. Die Preiskritik blieb unbeantwortet. **Takeaway:** Eine Explore-Seite ohne Login plus zwei Gründer, die fast jeden Kommentar beantworten, tragen auch ein Closed-Source-Bezahlprodukt. Ein fehlender Preis und vage Open-Source-Antworten sind aber die offene Flanke.

**3. „Show HN: Autofix Bot – Hybrid static analysis and AI code review agent“**. 2025-12-11, https://news.ycombinator.com/item?id=46237358, 37 Punkte, 13 Kommentare. DeepSource (YC W20), closed, kostenpflichtig. Das ist unserer Architektur am nächsten. Text: „Static-only analysis with a fixed set of checkers isn't enough. LLM-only review has several limitations: non-deterministic across runs, low recall on security issues, expensive at scale“. Dazu kamen ein Benchmark (OpenSSF CVE Benchmark) und der Vergleich mit Semgrep. Kritik: „$8/100k tokens strikes me as potentially a TON“, was ein Missverständnis war, gemeint waren Zeilen. Und: „What is the difference between this and let's say Claude Code using something like semgrep as a tool?“ Die Antworten waren sachlich und mit Zahlen: „Semgrep CE hits 56.97% accuracy vs our 81.21%“. **Takeaway:** Die These „deterministisch plus LLM“ ist auf HN schon besetzt und erzeugt allein wenig Aufmerksamkeit. Wer Benchmarks nennt, bekommt sachliche Nachfragen und keinen Shitstorm. Der Vergleich „warum nicht einfach Claude Code plus Linter“ kommt mit Sicherheit.

**4. „Show HN: Wispbit - Linter for AI coding agents“**. 2025-10-14, https://news.ycombinator.com/item?id=45584017, 31 Punkte, 14 Kommentare. Closed, kostenpflichtig, Signup („We've opened up signups for free to HN folks“). Aussage: „Our early users are seeing 80%+ resolution rates“. Die Kritik war dünn: tptacek schrieb „SOC2 is definitely not the highest industry standard for security“, jemand anderes nur „Pricing?“. Antwort: „two week trial and then it's $0.2 per file reviewed“. **Takeaway:** Ein Signup-Produkt mit Trial bekommt kaum Diskussion. Die einzige technische Reaktion galt einer übertriebenen Sicherheitsbehauptung.

**5. „Show HN: adamsreview – better multi-agent PR reviews for Claude Code“**. 2026-05-11, https://news.ycombinator.com/item?id=48090276, 85 Punkte, 53 Kommentare. Open Source, kostenlos, Installation als Claude-Code-Plugin. Behauptung: „it has been catching dramatically more real bugs than Claude's built-in /review, /ultrareview, CodeRabbit, Greptile“. Kritik: „Why not just use an eval harness to prove this catches more real bugs? Benchmarks on actual bug classes would be far more convincing“, außerdem „That's looks like a fair bit of ceremony“ und „We seem to be fighting complexity with complexity.“ Der Maker bot an: „Does anyone have an open PR on a public repo? I'll run this against your PR for you“. Dann postete er ein echtes Review-Ergebnis als Link. **Takeaway:** Eine Vergleichsbehauptung ohne Messung wird sofort angefochten. Live-Reviews auf fremden PRs sind ein gutes Mittel im Thread.

**6. „Show HN: AISlop, a CLI for catching AI generated code smells“**. 2026-05-29, https://news.ycombinator.com/item?id=48322956, 73 Punkte, 65 Kommentare. Open Source, lokal, `npx aislop scan`. Text: „They aren't syntax and passes most tests, they are patterns like empty catch blocks, useless comments, duplicated helpers, dead code“. Dazu: „It's all local and no code is transferred.“ Die Reaktion war überwiegend positiv, viele lieferten eigene Muster („sweeping exceptions under the rug“, „redundant safeguards“). Kritik: „Apparently I need to check in with a Doctor because code written by myself is seen as AI“. **Takeaway:** Das Thema KI-Code-Smells zieht auf HN. Die Leser liefern bereitwillig Regelideen. False Positives auf menschlichem Code werden sofort vorgeführt.

**7. „Show HN: Pyscn – Python code quality analyzer for vibe coders“**. 2025-10-05, https://news.ycombinator.com/item?id=45481298, 136 Punkte, 84 Kommentare. Open Source, `uvx pyscn analyze .` ohne Installation. Der Text nennt Algorithmen (APTED, LSH, CFG). Kritik: „you might be better off marketing it as a tool for software engineers […] Vibe coders don't care about quality“. Daraus entstand ein langer Nebenstreit über „vibe coders“. Der Maker nahm es mit Humor („"You're absolutely right!" - the messaging could be clearer“) und nannte auf Nachfrage das zugrunde liegende Paper. **Takeaway:** Technische Tiefe und Zero-Install tragen. Die Rahmung „für Vibe Coder“ polarisiert und lenkt vom Produkt ab.

**8. „Show HN: Sloppylint – A linter for AI-generated Python code“**. 2025-12-05, https://news.ycombinator.com/item?id=46167703, 19 Punkte, 3 Kommentare. Open Source. Behauptung ohne Beleg im Text: „Hallucinated imports (20% of AI imports reference non-existent packages)“. Reaktion: „some of it (mutable defaults for example) are already covered by existing linters“, „How did you decide on the patterns to check?“ und schlicht „why“. **Takeaway:** Die Herkunft der Regeln ist die erste Frage. unslop hat mit den Regeln aus publizierter Forschung genau darauf eine Antwort und sollte sie deshalb in den Text nehmen.

**9. „Show HN: I canceled my AI code reviewer and wrote a free local one“** (avouch). 2026-08-18, https://news.ycombinator.com/item?id=49345154, 23 Punkte, 32 Kommentare, **[flagged]**. Open Source. Kritik: „it doesnt help that these projects have AI generated README's. Not AI-assisted, or AI-curated, but fully gene[rated]“. Dazu „I can't quite figure out what distinguishes it from other similar projects“ und der Nachweis eines Reposts: „A repost likely by the same person“. Der Maker räumte ein: „my previous post from different account got flagged“. **Takeaway:** Das ist der Negativfall. Ein KI-generiertes README, eine unklare Abgrenzung und ein Repost über einen zweiten Account führen zum Flag.

**10. „Show HN: Commit-based code review instead of PR-based“** (commitguard.ai). 2026-01-09, https://news.ycombinator.com/item?id=46550571, 15 Punkte, 4 Kommentare. Closed, Webseite. Der Text blieb vage („intentionally low-noise, high signal“) und enthielt weder eine Möglichkeit zum Ausprobieren noch einen Preis. Die Reaktion bestand aus einer Randfrage und „Hello world“. **Takeaway:** Ohne Beleg und ohne Einstieg zum Ausprobieren passiert nichts.

**11. „Show HN: Command Center, the AI coding env for people who care about quality“**. 2026-06-08, https://news.ycombinator.com/item?id=48453002, 69 Punkte, 32 Kommentare. Closed, Abo. Der Text beginnt mit Credentials („Jimmy is a Thiel Fellow with a Ph. D. from MIT […]; Ray became VP of Sales at a $2B company when he was 19“) und wurde gespottet: „I was skateboarding at 19. Can you even kick flip?“ Kritik zur Sicherheit: „How can I have any confidence in the security of your product? […] when it's not open source.“ Der Maker antwortete gut und überprüfbar: „it runs locally. If you turn telemetry off […] it's trivial to verify that no traffic goes to our servers“. Ein wohlwollender Kommentar eines Kursteilnehmers brachte die Antwort „this sounds exactly like one of those scam courses“. **Takeaway:** Selbstlob und Kommentare aus dem eigenen Umfeld schaden. Auf die Closed-Source-Frage hilft eine überprüfbare Aussage mehr als ein Vertrauensappell.

**12. „Show HN: KeelTest – AI-driven VS Code unit test generator with bug discovery“**. 2026-01-07, https://news.ycombinator.com/item?id=46526088, 30 Punkte, 15 Kommentare. VS-Code-Extension, Freemium, Konto nötig. Der Maker umging die Hürde kreativ: „To make it easier to try without signing up, giving away a few API keys“. Außerdem nannte er die Grenzen offen: „Alpha stage - not all codebases work reliably“. Kritik: „How exactly do credits work? Your pricing mentions files and functions but doesn't appear to give a true unit of measure.“ **Takeaway:** Geteilte Demo-Keys sind ein akzeptierter Weg, eine Signup-Pflicht zu umgehen. Eine unklare Preiseinheit wird sofort bemängelt.

**13. „Show HN: Zingle – an AI code reviewer for data teams (SQL/dbt/Airflow/Spark)“**. 2025-11-14, https://news.ycombinator.com/item?id=45931748, 9 Punkte, 7 Kommentare. Closed, Signup („try it on top 100 PRs for free“). Zwei Fragen blieben laut Algolia-Kommentarbaum **unbeantwortet**: „I don't love tools that block PRs automatically. Can this run in advisory mode only?“ und „Is this open source or closed source? Any plans for an on-prem version?“ **Takeaway:** Das sind genau die Fragen, die unslop bekommen wird: ob der Check blockiert und ob der Code offen ist. Unbeantwortet wirken sie wie ein Eingeständnis.

**14. „Show HN: Ito – Code reviews that run code“**. 2026-06-16, https://news.ycombinator.com/item?id=48558949, 10 Punkte, 8 Kommentare. Closed, kostenpflichtig. Positiv: öffentliche Share-Links zu Reviews von n8n, lobehub und excalidraw, also zum Ansehen ohne Login. Kritik: „we're trying to build this ourselves with some qa skills. what's the benefit of buying?“ **Takeaway:** „Build vs. buy“ ist bei Review-Tools auf HN die Standardfrage.

**15. „Show HN: Canary (YC) – Independent verification for AI code“** (2026-09-24, https://news.ycombinator.com/item?id=49836632, 8 Punkte, 0 Kommentare) und **„Show HN: Critic – Review code with the agent that wrote it“** (2026-09-24, https://news.ycombinator.com/item?id=49834098, 8 Punkte, 4 Kommentare). Canary verlangt eine globale npm-Installation über den Agenten und hat einen langen Visionstext. Bei Critic kam: „I looked at this landing page for 5min and still have no idea what this is. The description above is doing a better job.“ **Takeaway:** Auch ein YC-Label hilft nicht, wenn der erste Absatz nicht klar sagt, was das Produkt tut.

**Älter, als Referenz:** „Launch HN: mrge.io (YC X25) – Cursor for code review“, 2025-04-15, https://news.ycombinator.com/item?id=43692476, 221 Punkte, 108 Kommentare. Das ist ein YC-Launch mit garantierter Frontpage-Platzierung und liegt außerhalb des Zeitfensters. Der härteste Kommentar: „Threw a random PR at it… of the 11 issues it flagged, only 1 was appropriate, and that one was also caught by pylint :(“. Die Antwort war defensiv-generisch: „sorry to hear that it didn't catch all the issues! if you downvote/upvote […] we can improve it“.

---

## 4. Was HN-Leser schon glauben: Diskussionen außerhalb von Show HN

| Story | Datum | Punkte / Kommentare | Vorherrschende Stimmung |
|---|---|---|---|
| „How we exploited CodeRabbit: From simple PR to RCE and write access on 1M repos“, https://news.ycombinator.com/item?id=44953032 | 2025-08-19 (älter) | 687 / 227 | Misstrauen gegen serverseitige Review-Apps. „Rule #1 of building any cloud platform analyzing user code is that you must run analyzers in isolated environments.“ Außerdem „their "become the github app as you desire" keys to the kingdom private key was just sitting in the environment variables“. Auf die Stellungnahme eines CodeRabbit-Mitarbeiters kam „How can you guarantee that nobody ripped the private key […]?“ Ein Nutzer: „I cancelled my coderabbit paid subscription“. |
| „cURL removes bug bounties“, https://news.ycombinator.com/item?id=46701733 | 2026-01-21 | 435 / 264 | Sympathie mit den Maintainern. „It seems open source loses the most from AI.“ |
| „There is an AI code review bubble“ (Greptile-Blog), https://news.ycombinator.com/item?id=46766961 | 2026-01-26 | 351 / 249 | Skepsis gegenüber KI-Reviewern. „the signal to noise ratio is poor“, „I've tried Greptile and it's pretty much pure noise“, „None of these tools perform particularly well […] beyond what a linter would find“, „any business that is based on someone else's model is worthless“, „I don't need second subscription“. |
| „Open Code Review – An AI-powered code review CLI tool“ (Alibaba), https://news.ycombinator.com/item?id=48406358 | 2026-06-05 | 284 / 73 | Leser messen selbst nach: „very good recall (~74%) […] not so good precision (~12%)“. Und: „AI code review in Git** itself isn't hard to do“. |
| „PS3 Emulator Devs Politely Ask That People Stop Flooding It with AI PRs“, https://news.ycombinator.com/item?id=48089263 | 2026-05-10 | 189 / 148 | „The problem is really behavioural, not the tooling.“ Vorschlag: „we may need to go back to the model where you need to be invited“. |
| „SQLite Critical CVEs or LLM Slop?“, https://news.ycombinator.com/item?id=49154332 | 2026-08-03 | 727 / 372 | LLM-Output ohne Verifikation gilt als Rauschen, das Signal verdrängt. |
| „Orchestrating AI code review at scale“ (Cloudflare), https://news.ycombinator.com/item?id=48276152 | 2026-05-26 | 145 / 56 | Zweifel an KI-Reviews in CI: „The system is nondeterministic, so it's at odds with the purpose of CI.“ Außerdem „I'd prefer to have that happen as some sort of pre commit hook“. |
| „CrabTrap: An LLM-as-a-judge HTTP proxy“, https://news.ycombinator.com/item?id=47850212 | 2026-04-21 | 132 / 55 | Skepsis bei LLM-as-Judge: „It's all fine until OpenClaw decides to start prompt injecting the judge“. Und: „is the judge from the same model family as the agent it's judging? If both are Claude, you have shared-vulnerability risk.“ |
| „AI slop is killing online communities“, https://news.ycombinator.com/item?id=48053203 | 2026-05-07 | 834 / 734 | „Slop“ ist ein Kernthema der Community. |
| „Is Show HN dead? No, but it's drowning“, https://news.ycombinator.com/item?id=47045804 | 2026-02-17 | 522 / 425 | Show HN wird mit generierten Projekten geflutet. Daraus folgte die showlim-Beschränkung. |
| „Scoring Show HN submissions for AI design patterns“, https://news.ycombinator.com/item?id=47864393 | 2026-04-22 | 333 | Ein Leser bewertet Landingpages von Show HNs auf „design slop“: „Heavy slop (5+ patterns) · 21%“. dang bot an, das womöglich auf HN selbst einzusetzen. |

**Namenskollision (wichtig):** „unslop“ ist auf HN schon besetzt. „Show HN: Hacker News, Without AI“ lief am 2026-09-11 unter unslop.news (https://news.ycombinator.com/item?id=49660783, 198 Punkte, 82 Kommentare) und wird im September 2026 laufend in Kommentaren empfohlen („Thankfully https://www.unslop.news/ exists!“). Dazu kommt „How we measured AI writing across arXiv“ von unslop.run (https://news.ycombinator.com/item?id=48981206, 244 Punkte). HN-Leser verbinden „unslop“ also mit Anti-KI-Filtern. Ein kostenpflichtiges KI-Produkt mit diesem Namen muss sich im ersten Satz abgrenzen.

**Zusammengefasst glauben die Leser Folgendes:** KI-Reviewer sind zu laut und zu ungenau. Die Frontier-Modelle können Reviews auch selbst, deshalb gilt ein Abo als fragwürdig. Serverseitige GitHub-Apps sind seit CodeRabbit ein Sicherheitsrisiko. Nichtdeterministische Checks gehören nicht in blockierende CI. Deterministische Analyse finden die Leser grundsätzlich sympathisch. Den Begriff „Slop“ unterstützen sie, bei Anbietern, die davon profitieren wollen, sind sie aber skeptisch.

---

## 5. Wie Macher über Geplantes sprechen

- **Roadmap im Text:** Gut aufgenommen wird sie, wenn sie kurz ist und ehrliche Grenzen nennt. Bei KeelTest hieß das „Python + pytest only for now. Alpha stage“. mrge schrieb „Gitlab support is on the roadmap!“ als Nebensatz. Visionsprosa wird schlecht aufgenommen. Canary füllte drei Absätze mit „We believe the future is…“ und bekam 0 Kommentare.
- **Roadmap in Kommentaren:** Die meisten Macher schieben Geplantes erst als Antwort auf Kritik nach. Autofix Bot antwortete „We're working on respecting AGENTS.md, detecting code complexity“, Stage „Open source is something we're thinking about“, avouch „Later its gonna have ai integartion“. Das wird ohne Begeisterung hingenommen. Bei avouch fiel zusätzlich auf, dass per Commit „removing the roadmap“ passiert war, und das wurde als Indiz gegen den Maker verwendet.
- **„Coming soon“ als Ersatz für Nutzbarkeit** ist laut Regeln kein Show HN. dang: „A Show HN needs to have more than a waitlist“ (https://news.ycombinator.com/item?id=47665767, 2026-04-06). In einem anderen Fall riet er, zu warten und später neu zu posten: „we'll be happy to help you with reposting it once it's ready“ (https://news.ycombinator.com/item?id=49063784).
- **Preise:** Fehlende Preise erzeugen direkte Kritik, etwa „No pricing page, you've lost my interest. […] Be up front about the costs.“ (Stage) und „Pricing?“ (Wispbit). Auch der Vergleich mit dem Claude-Abo kommt, bei Stage als „50% more per month than Claude Pro“. Konkrete Preise wie „$0.2 per file“ (Wispbit) oder „$8/100K lines“ (Autofix) führen zu Rechen-Rückfragen, aber zu keiner Ablehnung. Bei Haystack antwortete der Maker offen auf Preiskritik: „We can definitely shift down costs as existing intelligence becomes cheaper though.“ (https://news.ycombinator.com/item?id=48182856).

---

## 6. Zielgruppe und was sie ablehnt

HN lesen vor allem Entwickler, dazu Gründer, Security-Leute und einige CTOs. Viele Threads zeigen erfahrene Praktiker, die Tools nach Präzision, Datenschutz und „könnte ich das selbst in einer Woche bauen?“ beurteilen. Ein Beispiel dafür: „i would rather spend a week vibe copying this than onboarding a tool i have to pay for“ (Stage-Thread).

Was abgelehnt wird, mit Belegen:
- **Marketing- und Pitch-Sprache sowie Credentials:** Die Command-Center-Vorstellung wurde verspottet (siehe 3.11). yli.html: „Don't sell to this audience. If you try, they will close the tab.“
- **KI-generierter Text:** „The AI prose is getting so tiring to read "We measured this. Not estimates — actual token counts […]"“ und „the prose in the readme and the above post seem to be fully generate[d]“, beides im Mcp2cli-Thread (https://news.ycombinator.com/item?id=47305149, 146 Punkte). Bei avouch führte ein generiertes README mit zum Flag. Dazu kommen die 4.229 Punkte für die Guideline-Story.
- **Übertriebene oder unpassende Zahlen:** „Tokens saved should not be your north star metric. You should be able to show that tool call performance is maintained“ (Mcp2cli). Bei adamsreview wurde ein Benchmark gefordert. Das Gegenbeispiel ist „Show HN: Forge – Guardrails take an 8B model from 53% to 99% on agentic tasks“ (https://news.ycombinator.com/item?id=48192383, 687 Punkte, 252 Kommentare). Dort steht eine große Zahl im Titel, aber mit „an eval harness and interactive dashboard so you can reproduce every number“ und einem Peer-Review-Paper. Große Zahlen funktionieren also nur, wenn man sie reproduzieren kann.
- **Closed Source ohne Erklärung:** „Why is this a service and not an open source project?“ (Stage). „It's extremely hard to convince myself to use a product […] when it's not open source.“ (Command Center). „Is this open source or closed source?“ (Zingle, unbeantwortet).
- **Signup- und OAuth-Hürden:** „Why does it require signing and granting you full access to act as me on Github“ (0github).
- **Booster-Kommentare und frische Accounts:** Wir haben das bei Command Center gesehen. Aus der Moderationssicht: „Our readers have a nose for this“ (yli.html). Hinweis: Die Guidelines verbieten es, auf HN selbst Astroturfing zu *unterstellen*. Kritik daran äußern Leser meist indirekt.
- **„Slop“-Tools, die selbst nach Slop aussehen:** Zu unslop.news kam „Without AI, using AI to accomplish it's goal. And built using AI.“ Genau diese Ironie wird man auch unslop vorhalten, wenn Landingpage, Text oder Repo generiert wirken.

---

## 7. Timing

**Eigene Auswertung** (Primärdaten Algolia, 45.844 Show HNs vom 2025-10-01 bis 2026-09-29, abgerufen 2026-09-29; korrelativ, Punkte inklusive späterer Re-ups):
- Der Median einer Show HN liegt bei **2 Punkten**. 61 % bleiben bei 2 Punkten oder darunter. Nur 1,66 % (760 Posts) erreichen 100 Punkte oder mehr.
- Das Volumen lag im Schnitt bei rund 125 pro Tag, mit einem Höchststand im Februar 2026 (6.217 im Monat). Nach der showlim-Beschränkung im März fiel es auf 2.644 im Mai und stieg bis Juli wieder auf 4.196.
- **Anteil der Posts mit mindestens 100 Punkten nach Wochentag:** So 1,96 %, Mo 1,94 %, Sa 1,82 %, Do 1,63 %, Di 1,52 %, Fr 1,51 %, Mi 1,40 %. Am Wochenende und montags wird weniger gepostet, der Anteil erfolgreicher Posts ist dort leicht höher. Die Unterschiede sind klein.
- **Nach Stunde (UTC):** Das Maximum liegt um 16 UTC mit 2,39 % (n=3.353), danach 17 UTC mit 2,18 % und 18 UTC mit 2,10 %. 0 UTC kommt auf 2,53 %, aber bei kleinerem n=1.109. Am schwächsten sind 2–8 UTC mit 0,5–1,1 %. 16 UTC entspricht **18:00 MESZ bzw. 9:00 Pacific**.

**Sekundärquellen** (als solche markiert):
- „Best Time to Post on Hacker News: It's Irrelevant“ (2015), https://news.ycombinator.com/item?id=9426040, 51 Punkte, abgerufen 2026-09-29. Die These dort: Der Zeitpunkt hat kaum Einfluss.
- Zur Ranking-Formel: „How Hacker News ranking algorithm works“ (2010), https://news.ycombinator.com/item?id=1781013, und „Reverse Engineering the Hacker News Ranking Algorithm“ (2017), https://news.ycombinator.com/item?id=13867739, beide abgerufen 2026-09-29. Beschrieben wird dort, dass die Punkte durch eine Potenz des Alters geteilt werden. Das bestätigt die FAQ, ohne den Exponenten zu nennen. Konkrete Exponenten aus diesen Quellen sind veraltet und nicht offiziell.
- **Verweildauer auf der Frontpage** ist nicht offiziell dokumentiert und aus Algolia-Daten nicht messbar. Starke Stories halten sich deutlich länger als einen Tag. dang nennt als Beispiel eine Story, die „spent 14 hours on HN's front page“ (https://news.ycombinator.com/item?id=33727018). yli.html sagt, dass fehlende Antworten des Makers das Absinken beschleunigen.

**Second-Chance-Pool:** Ein Post, der ohne eigenes Zutun untergeht, kann durch Moderatoren noch einmal nach vorn kommen, als Re-up oder mit einer Repost-Einladung per E-Mail. Voraussetzung ist eine E-Mail-Adresse im Profil. Eine eigene Anfrage an hn@ycombinator.com ist möglich. dang sieht es aber lieber, wenn der Vorschlag von Dritten kommt.

**Ableitung:** Werktags (Mo, Di oder Do) oder sonntags gegen 15–17 UTC posten. Dann ist das deutsche Team bis in den Abend verfügbar, während die US-Westküste ihren Arbeitstag beginnt. Wichtiger als die Uhrzeit ist, dass beide Gründer in den ersten 4–6 Stunden durchgehend antworten können.

---

## 8. Ableitungen für unslop

1. **Heute keine Show HN.** Es gibt nichts Installierbares, die Signups sind geschlossen, und die CLI ist nicht veröffentlicht. Das ist nach showhn.html („If your work isn't ready for users to try out, please don't do a Show HN“) regelwidrig, und dang würde das „Show HN“ entfernen. Ein Warteliste-Post ist ausgeschlossen.
2. **Mindestbedingung vor dem Post: Ausprobieren ohne unslop-Konto.** Drei Wege, die sich kombinieren lassen:
   - (a) Ein **öffentliches Demo-Repo mit echten PRs**, auf denen Check-Run und Review-Kommentare mit Regel-IDs und Suggested Fixes für jeden sichtbar sind. Das ist das 0github- bzw. Ito-Muster.
   - (b) Die Möglichkeit, dass Leser dort **selbst einen PR öffnen** und ein Review bekommen.
   - (c) Die **CLI mit einem Modus ohne Login**, zum Beispiel nur mit den 55 deterministischen Detektoren lokal. Das beantwortet zugleich die Fragen „closed source?“ und „schickt ihr meinen Code weg?“, wie bei AISlop mit „It's all local and no code is transferred“.

   Der 14-Tage-Trial mit Kreditkarte darf nicht der einzige Weg sein. Wenn es ihn gibt, muss er im Text offen stehen (yli.html: „Don't use bait-and-switch tactics“).
3. **Account-Voraussetzung:** Ein Gründer braucht einen HN-Account mit echter Historie, also Kommentare über Wochen hinweg und keinen neuen grünen Account. Sonst greift die showlim-Sperre. Der Username darf nicht „unslop“ lauten (dang-Tipps). Eine E-Mail-Adresse gehört ins Profil, damit eine Repost-Einladung möglich ist.
4. **Den 44×-Satz nicht verwenden, weder im Post noch auf der Landingpage am Launch-Tag.** Er geht auf einen explorativen Vergleich mit einem einzigen Modell zurück (arXiv 2604.17587). HN würde ihn wie bei adamsreview und Mcp2cli zerlegen, und dann dreht sich die ganze Diskussion um diese Zahl. Wenn wir Zahlen nennen, dann eigene, mit Harness, Datensatz und Hinweis auf die Grenzen. Forge zeigt, dass das funktioniert.
5. **Titel sachlich, höchstens 80 Zeichen, ohne Superlativ und ohne „slop“-Pathos.** Beispiele, Längen mit Präfix geprüft:
   - „Show HN: Unslop – A GitHub check for AI-written code with rule IDs and fixes“ (76)
   - „Show HN: A PR check that combines 55 deterministic rules with an LLM reviewer“ (77)
   - „Show HN: Unslop – Rule-based review gate for AI-generated JS/TS pull requests“ (77)

   Wegen der Kollision mit unslop.news sollte der Titel beschreiben, was das Produkt tut, und nicht vom Namen leben.
6. **Textaufbau** in eigener Hand geschrieben, auch nicht per LLM geglättet (dang, 2026-03-28). Keine Feature-Liste und keine Ein-Satz-Absätze:
   1. Wer wir sind: zwei Namen, kleines deutsches Team.
   2. Ein Satz dazu, was unslop tut, formuliert anders als der Titel.
   3. Die persönliche Vorgeschichte, also welche KI-PRs uns selbst Schmerzen gemacht haben.
   4. Wie es funktioniert: 119 Regeln aus publizierter Forschung, 55 davon deterministisch (Regex, tree-sitter, ESLint, Config, Registry), der Rest per LLM-Reviewer mit einem Blind-Verifier. Nur kritische Findings lassen den Check fehlschlagen.
   5. Die Grenzen: das LLM nur für JS/TS, Review serverseitig, Vertex AI EU.
   6. Warum closed und kostenpflichtig, mit konkretem Preis (€29 pro Monat) und den Bedingungen des Trials.
   7. Der Link zum Demo-Repo.
   8. Eine offene Bitte um Feedback, zum Beispiel zu Regeln, die fehlen.
7. **Die Frage „warum closed source“ vorab beantworten**, nicht erst ausweichen, wenn sie kommt. Stage hat das mit „we're thinking about it“ getan, bei Zingle blieb die Frage offen. Denkbare Antwort: Die Regelliste mit Quellen ist öffentlich, die Detektoren teilweise lokal, und die Review-Pipeline läuft als Service, weil sie LLM-Kosten trägt. Die Liste der 119 Regeln mit Paper-Referenzen öffentlich zu machen, beantwortet zugleich die Sloppylint-Frage „How did you decide on the patterns?“.
8. **Sicherheit proaktiv behandeln** (Lehre aus dem CodeRabbit-Thread mit 687 Punkten): welche GitHub-App-Permissions wir brauchen, wo ESLint und tree-sitter auf fremdem Code laufen und wie sie isoliert sind, wo der App-Private-Key liegt, Datenaufbewahrung und EU-Region. Behaupten dürfen wir nur, was verifiziert ist.
9. **Den ersten Kommentar des Makers vorbereiten.** Er soll kein Werbe-Echo sein, sondern technische Tiefe liefern: ein Beispiel-Finding mit Regel-ID und Quelle, wie der Blind-Verifier False Positives filtert, und welche Detektoren deterministisch sind. Eine Frage kommt wie bei CrabTrap bestimmt: Ist der Verifier aus derselben Modellfamilie? Die Antwort muss ehrlich sein, denn Draft und Verifier sind beide Gemini.
10. **Antworten auf die absehbaren Top-Kritiken bereitlegen:**
    - „Warum nicht einfach Claude/Codex /review plus ESLint?“ Antwort: Regelwerk mit IDs und Quellen, deterministische Detektoren, reproduzierbare Gate-Entscheidung.
    - „KI-Reviewer sind nur Rauschen.“ Antwort: Nur kritische Findings schlagen fehl, ein Advisory-Modus ist möglich. Präzisionszahlen nennen wir, wenn wir sie haben.
    - „Nichtdeterministisch in CI?“ Antwort: Aufschlüsseln, welcher Teil deterministisch ist.
    - „Build vs. buy.“
    - „False Positives auf menschlichem Code“ (vgl. AISlop). Antwort: im Demo-Repo zeigen.

    Ton wie in yli.html: zuerst Zustimmung finden, Kritik als Gefallen behandeln, keine Floskeln wie „sorry to hear that“ (mrge).
11. **Keine Booster.** Kein Teammitglied, kein Freund, kein Beta-Nutzer kommentiert oder votet koordiniert. Den Link teilen wir nicht mit der Bitte um Upvotes, weder in Slack noch auf X oder LinkedIn. Der Voting-Ring-Detektor und die Community bestrafen das (FAQ, dang).
12. **Timing und Ablauf:** Mo, Di, Do oder So um 15–17 UTC, beide Gründer 6 Stunden verfügbar. Geht der Post unter, **nicht löschen und neu posten** und keinen Zweitaccount benutzen (avouch-Lehre). Stattdessen die E-Mail im Profil pflegen, auf den Second-Chance-Pool hoffen und frühestens bei einem wesentlich neuen Stand erneut posten, zum Beispiel wenn die CLI öffentlich ist. Launch HN steht uns ohne YC nicht zur Verfügung.
