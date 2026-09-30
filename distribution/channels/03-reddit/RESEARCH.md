# Reddit: Kanal-Research für unslop

Stand: 2026-09-29. Alle Quellen wurden am 2026-09-29 abgerufen, sofern nicht anders vermerkt.

**Methodik und Zugriffsgrenzen**
- **reddit.com ist aus dieser Umgebung nicht direkt lesbar.** `old.reddit.com/r/<sub>/about/rules/` und `…/about.json` antworten mit HTTP 302 auf eine Login-Seite (`/login/?reason=lor2`). `www.reddit.com/r/<sub>/about/rules.json` und `api.reddit.com` liefern 403, `www.reddit.com/r/<sub>/about/rules/` leitet per 301 auf `/mod/<sub>/rules/` weiter. Subreddit- und Wiki-Seiten liefern zwar HTTP 200, enthalten aber nur eine JavaScript-Bot-Challenge ohne Inhalt. WebFetch meldet „unable to fetch from www.reddit.com“, und die Websuche lehnt `reddit.com` als Domain ab.
- **Was funktioniert hat:**
  1. Reddits offizielle RSS-Feeds (`/r/<sub>/.rss`, `/comments/<id>/.rss`) mit HTTP 200, nach einigen Abrufen allerdings 429.
  2. Die öffentliche Zendesk-API des Reddit Help Centers (`support.reddithelp.com/api/v2/help_center/…`). Die normalen Help-Seiten liefern 403.
  3. `redditinc.com/policies/reddit-rules` per curl.
  4. **Arctic Shift** (`arctic-shift.photon-reddit.com`), ein Drittanbieter-Archiv mit Posts, Kommentaren und Regeln. Die Regel-Snapshots dort sind **von Januar 2025**, die Subreddit-Metadaten von Februar 2025. Posts sind bis 2026-09-29 archiviert. Scores stammen aus dem Archivierungszeitpunkt (meist wenige Stunden nach dem Posting) und sind **keine Endstände**. `removed_by_category` zeigt, wer entfernt hat: `moderator`, `automod_filtered` oder `reddit` (Spamfilter).
  5. **Prowlo** (`prowlo.com/tools/subreddit-stats/<sub>`), ein Drittanbieter-Tool, das Mitgliederzahlen (Crawls August/September 2026) und promotionsrelevante Regeln wörtlich mit Lesedatum zitiert.
- Alle Regeln aus Archiv, Prowlo oder Sekundärartikeln sind entsprechend gekennzeichnet. **Vor jedem Post muss die Regelseite im eingeloggten Browser gegengeprüft werden.**

---

## 1. Plattformweite Regeln (Primärquellen)

### 1.1 Reddit Rules
Quelle: https://redditinc.com/policies/reddit-rules
- **Rule 2:** „Abide by community rules. Participate authentically in communities where you have a personal interest, and do not spam or engage in disruptive behaviors (including content manipulation) that interfere with Reddit communities.“
- **Rule 5:** „Be authentic. You don't have to use your real name, but do not intentionally mislead others or impersonate an individual or entity in a deceptive manner.“
- Sanktionen reichen von „Asking you nicely to knock it off“ bis „Temporary or permanent suspension of accounts“.

### 1.2 Spam
Quelle: https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam (editiert 2026-05-19)
- Definition: „repeated or unsolicited actions (whether automated or manual) that negatively affect redditors, communities, and/or Reddit itself“.
- Genannte Beispiele: „Mass-posting repetitive content for the purpose of exposure or financial gain“ und „Using tools (e.g., bots, generative AI tools) that may break Reddit or facilitate the proliferation of spam“.
- **Die aktuelle offizielle Selbstpromo-Leitlinie:** „If your contributions to Reddit consist primarily of links to a business that you run, own, or otherwise benefit from, please be thoughtful about the frequency of posting, or consider advertising opportunities using our self-serve platform.“ Außerdem: „community moderators adjudicate what constitutes unwanted/spammy content in their communities“.

### 1.3 Vote-Manipulation, Ban Evasion, Zweitaccounts
- **Disrupting Communities** (https://support.reddithelp.com/hc/en-us/articles/360043066412-Disrupting-Communities, editiert 2026-05-19): Verboten sind „Creating and employing multiple accounts, voting services, or any automation to manipulate vote counts“, „coordinated voting with an organized group of people“ und Ban Evasion, also „Creating or using multiple accounts to circumvent a community ban“. Als Signal für Community Disruption gilt auch „Being banned across several communities dealing with the same topics“.
- **Mehrere Accounts** (https://support.reddithelp.com/hc/en-us/articles/204535759) sind grundsätzlich erlaubt, aber: „Don't use any of your accounts to vote on the same posts or comments. This is considered vote manipulation“.
- **Misleading Behavior** (https://support.reddithelp.com/hc/en-us/articles/41180423371156): Als Verstoß wird genannt „An organization using multiple, seemingly unconnected accounts across several local communities“. **KI-Inhalte** sind zwar „generally allowed“, verboten ist aber Inhalt, der „presents itself as human-generated“. Weiter: „be transparent and include a tag … disclosing that the content was generated or modified by AI“.

### 1.4 Reddiquette und die 9:1-Regel
Quelle: https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette (editiert 2025-08-18)

Die Reddiquette ist laut eigener Aussage „an informal expression of the values of many redditors, as written by redditors themselves“, also keine Policy. Wortlaut:

> „Feel free to post links to your own content (within reason). But if that's all you ever post, or it always seems to get voted down, take a good hard look in the mirror — you just might be a spammer. A widely used rule of thumb is the 9:1 ratio, i.e. only 1 out of every 10 of your submissions should be your own content.“

Außerdem untersagt sie, um Votes zu bitten („Send out IMs, X posts, or any other message asking people to vote for your submission … This will result in a ban from the admins“). Wer „a lot of stories in a short span of time“ postet, riskiert laut Reddiquette „Shadow banning“.

**Fazit:** 9:1 ist heute nur noch eine Faustregel in der Reddiquette. Die Spam-Policy nennt keine Quote. Einige Subreddits verweisen trotzdem ausdrücklich darauf, etwa r/webdev („Please refer to the Reddit 9:1 rule“). Die alte Seite `reddit.com/wiki/selfpromotion` leitet (per 301) nur noch auf das Legacy-Wiki `/r/reddit.com/wiki/selfpromotion/` weiter.

### 1.5 Offenlegung der Zugehörigkeit
- Reddit bietet einen **Brand-Affiliate-Tag** an (https://support.reddithelp.com/hc/en-us/articles/23972085214484): „for redditors who need to identify their posts or comments as incentivized or having commercial intent“. Die Verantwortung für gesetzlich nötige Kennzeichnung liegt beim Nutzer.
- Sitewide gibt es keine Pflicht, die eigene Zugehörigkeit offenzulegen. Mehrere Subreddits verlangen es aber: r/SaaS („Must clearly disclose affiliation“), der Weekly Thread in r/ChatGPTCoding („Disclose your affilitation“) und r/ClaudeAI (siehe Abschnitt 2).

### 1.6 Account-Schwellen und Moderation per LLM
- **Poster Eligibility Guide** (https://support.reddithelp.com/hc/en-us/articles/33702751586836): Communities sperren Posts nach Account-Alter, Karma (Post-, Comment-, Community-Karma) und verifizierter E-Mail. „Specific karma and account age thresholds used by communities aren't disclosed“.
- **Post Check** nutzt „a large language model (LLM) to surface potential community rule violations prior to posting“.
- Die Hilfeseite „You're doing that too much“ (https://support.reddithelp.com/hc/en-us/articles/204579879) sagt: Neue Accounts mit wenig Karma laufen in einen Rate-Limit-Spamfilter.
- **Rules Hub** ist LLM-basierte Moderation nach Regel-„Intent“, am 05.08.2026 angekündigt. Sekundärquelle: https://www.androidauthority.com/reddit-ai-rules-hub-moderation-3695008/

### 1.7 Bezahlte Alternative
- **Promote your post** (https://support.reddithelp.com/hc/en-us/articles/16750646696212): Ein eigener Post wird zur Anzeige, bezahlt wird per Klick (CPC). Das Targeting beschränkt sich auf Communities, die Ausspielung erfolgt nur im Feed. Der beworbene Post wird dabei „locked“. Entfernen Mods den Originalpost, stoppt auch die Anzeige.
- **Reddit Pro** (https://support.reddithelp.com/hc/en-us/articles/24368510335892) ist eine kostenlose Beta mit organischen Business-Tools, „not a paid advertising tool“.
- r/devops und r/programming verweisen ausdrücklich auf Werbung als legitimen Weg („Consider buying advertisements“ bzw. „please do so legitimately“).

---

## 2. Konkrete Subreddits

**Legende:**
- **M** = Mitglieder laut Prowlo, Crawl August/September 2026. Mit „(2/2025)“ markierte Zahlen stammen aus dem Arctic-Shift-Snapshot vom Februar 2025, weil Prowlo für diese Subreddits keine Daten hat.
- **R** = Regelquelle: *P* = Prowlo, wörtliches Zitat mit Lesedatum 2026; *A* = Arctic-Shift-Snapshot Januar 2025; *S* = Sticky oder Mod-Post über RSS bzw. Archiv.
- **Entf.** = Entfernungsquote in einer Archiv-Stichprobe der jeweils 100 neuesten Posts vor dem 29.09.2026. Die Quote umfasst Mod-, Automod- und Spamfilter-Entfernungen, aber keine vom Autor selbst gelöschten Posts. Es ist eine Momentaufnahme: Spätere Freigaben durch Mods sind nicht erfasst.
- Konkrete Karma-Schwellen sind außer bei r/ClaudeAI nirgends öffentlich.

**Die wichtigsten Regeln im Wortlaut:**
- **r/programming:**
  - (S) Seit 23.05.2026 gilt eine AI-Policy: „Content about AI and LLMs are considered off-topic with the sole exclusion of **deeply technical** content about implementation.“ Quelle: Mod-Post „Announcement: We've Updated The Rules, and April Is Finally Over“, https://www.reddit.com/r/programming/comments/1tlh5aj/, über das Archiv. Vorausgegangen war der Trial-Bann vom 01.04.2026 (https://www.reddit.com/r/programming/comments/1s9jkzi/).
  - (P, gelesen 12.03.) Rule „No "I Made This" Project Demo Posts“: „We don't care what you built, we care how you build it.“ Außerdem gibt es die Regel „No LLM-Written Content“.
  - (A) „If you immediately start submitting promotional material with a fresh account, you will be banned … we do not waste time handing out warnings“.
  - In der Stichprobe vom 25.–29.09.2026 wurde jeder Post mit KI-Thema entfernt, darunter „Code review is becoming the bottleneck AI was supposed to remove“ (Entfernung durch Moderator).
- **r/ExperiencedDevs:**
  - (A) „Do not participate unless experienced (3+ years)“ und „No Surveys/Advertisements“.
  - (S) Mod-Post „Moderation changes“ vom 26.02.2026 (https://www.reddit.com/r/ExperiencedDevs/comments/1rfhdrg/): „AI/LLM posts will only be allowed on Wednesday and Saturday (UTC)“. Dazu Rule #10: Flair ist Pflicht, falsches Flairen führt zur Suspendierung.
- **r/webdev** (P, 28.05.): „No self-promotion … Please refer to the Reddit 9:1 rule“, „We do not allow any commercial promotion or solicitation. Violations can result in a ban“ sowie Projekte und Feedback-Anfragen nur am „Showoff Saturday“.
- **r/javascript** (A): „Advertising paid products and services is prohibited.“ Die Showoff-Saturday-Threads laufen weiter und werden von AutoModerator gestartet (S).
- **r/typescript** (A): „if you're posting a project it needs to be open source, you need to link to the repo“. Außerdem gibt es die Regel „ChatGPT comment/post“.
- **r/devops** (P, 12.03.): „No vendor spam … Consider buying advertisements“. Verboten ist außerdem „Low-Effort“-Content, „for example … AI content, prompt dumps, and stealth marketing“. Umfragen brauchen Mod-Freigabe. Es gibt einen „Weekly Self Promotion Thread“ (S).
- **r/ChatGPTCoding** (S, Weekly Self Promotion Thread): „Promotional posts outside this thread may be removed … Disclose your affilitation.“
- **r/ClaudeAI** (P, 03.09.): „Promoting your project or paid service is encouraged if … project was built with Claude/Claude Code … BY YOU … project must be free to try and say so (paid tiers OK) … promotional language minimal … **Posts on the feed now require OP karma>100**“. Außerdem: „Competitor posts must contain sufficient homework and evidence.“
- **r/ClaudeCode** (P, 13.09.): „No referral links, affiliate codes, … disguised ads, or repeated promotion.“ Es gibt eine eigene Regel „Projects & Showcases“ und die Flair „Built with Claude“.
- **r/vibecoding** (P, 12.03.): „All vibe coding startups must first submit their tool for mod approval via the Vibe Coding Community on X.com … Once approved, you can do one "shill" post“. Außerdem gilt die Regel „No vibe coding pessimism“.
- **r/SaaS** (P, 10.09.): „Max 1 mention or 3 links can be shared every 60 days … Must clearly disclose affiliation … Secondary accounts promoting the same product count toward the limit“. Verboten sind auch „Posts designed purely to gather emails or "testers"“ sowie Werbe- und Promotion-Tools.
- **r/startups** (P): „No direct sales, advertisements, or promotional posts of any kind“. Eigenes Projekt nur im „Monthly Share Your Startup thread“. (A) Mindestens 250 Zeichen, „No blogs about your "startup" journey“.
- **r/reactjs** (P, 12.03.): „If you join this community to take value rather than contribute, the community will quickly react as though you are an intruder.“ Es gibt Guidelines zu „Commercial activity“ und „AI“ sowie die Flair „Show /r/reactjs“.
- **r/nextjs** (A): „No product/project shilling“. Stattdessen gibt es einen „Weekly Showoff Thread! … in this thread only!“ (S).
- **r/SoftwareEngineering** (A): Eigene Inhalte sind freigabepflichtig, erlaubt sind nur „posts from engineering blogs“. Dieser Subreddit ist identisch mit r/softwareengineering, die Schreibweise macht keinen Unterschied.
- **r/opensource** (A): Die Flair „Promotional“ ist für Projekte gedacht. Das Thema ist Open Source, für ein Closed-Source-Tool passt das nicht.
- **r/AskProgramming** (A): „Please do not promote your own product“ und „No AI generated answers“.
- **r/cscareerquestions** (A): Werbung nur im monatlichen Sticky.
- **r/indiehackers** (P, 28.05.): „self promote their product 1 time using the SHOW IH flare“.

| Subreddit | Größe | Selbstpromo erlaubt? | Bedingungen | Eignung A (ohne Produkt) / B (mit Produkt) |
|---|---|---|---|---|
| r/programming | 6,92 Mio. | Nein | KI/LLM off-topic außer „deeply technical“; kein „I made this“; nur Link-Posts (Snapshot 2/2025); Entf. 45 % | A: nein. B: höchstens ein technischer Writeup über die Detector-Implementierung ohne Pitch (Risiko hoch) |
| r/ExperiencedDevs | 416.316 | Nein (Ads verboten) | 3+ Jahre Erfahrung; KI-Themen nur Mi/Sa (UTC); Flair Pflicht; Entf. 92 % (Ursache unklar) | A: **ja**, Diskussion ohne Link, Mi/Sa. B: nein |
| r/webdev | 3,30 Mio. | Nur Showoff Saturday, nichts Kommerzielles | 9:1; ModTeam entfernt LLM-generierte Posts und Kommentare; Entf. 69 % | A: Diskussion möglich. B: riskant, weil kommerziell |
| r/javascript | 2,45 Mio. | Minimal | Bezahlprodukte verboten; Showoff-Saturday-Thread; Entf. 75 % | A: kaum. B: nein |
| r/typescript | 185.854 | Nur Open Source | Repo-Link Pflicht; Entf. 61 % | Nein |
| r/node | 350.495 | Unklar (Regeln nicht abrufbar) | Entf. 76 % (68 % durch Mods) | Niedrig |
| r/reactjs | 513.003 | Eingeschränkt | Flair „Show /r/reactjs“, Guideline „Commercial activity“; Entf. 37 % | B: schwach (nicht React-spezifisch) |
| r/nextjs | 175.183 | Nur im Weekly Showoff Thread | „No product/project shilling“ | B: Kommentar im Thread |
| r/devops | 512.157 | Nur im Weekly-Thread | Kein Vendor-Spam oder Stealth-Marketing; Textposts; Flairs „AI content“, „Vendor / market research“; Entf. 59 % | A: ja (Diskussion). B: Weekly-Thread |
| r/ChatGPTCoding | 399.082 | Nur im Weekly-Thread | Offenlegung Pflicht; Entf. 75 % | A: Diskussion. B: **ja** (Thread) |
| r/vibecoding | 349.636 | Nach Freigabe über X, 1 Post | „No vibe coding pessimism“; Entf. 79 % | Niedrig (Tonalitätskonflikt) |
| r/ClaudeAI | 1,09 Mio. | Ja, mit Bedingungen | Mit Claude gebaut, „free to try“, Karma > 100; Entf. 93 % (76 % Automod) | A: nein. B: **ja**, wenn kostenlos testbar |
| r/ClaudeCode | 406.269 | Showcases erlaubt | Keine „disguised ads“; Flair „Built with Claude“; Entf. 17 % | B: **ja** |
| r/cursor | 155.876 | Flair „Showcase“ vorhanden | Regeln nicht abrufbar; Entf. 27 % | A: Diskussion. B: mittel |
| r/mcp | 119.891 | Ja (Flairs „showcase“, „server“) | Stark überlaufen (100 Posts in 2 Tagen); Entf. 24 % | B: **ja**, mit Zahlen |
| r/codereview | 9.184 (2/2025) | Nicht geregelt | Viele KI-Review-Tool-Promos; Entf. 17 % | Geringe Reichweite |
| r/github | 131.006 (2/2025) | Flair „Showcase“ | Entf. 40 % | B: mittel (GitHub App) |
| r/vscode | 157.762 (2/2025) | In der Praxis toleriert | R1–R4 (Qualität); Entf. 50 % | B: erst mit Marketplace-Listing |
| r/SideProject | 823.956 | Ja | Am 29.09. entfernte der Spamfilter 68 % | B: ja, aber wenig Wert |
| r/SaaS | 793.822 | 1 Erwähnung pro 60 Tage | Offenlegung Pflicht; keine Lead-Gen; Entf. 43 % | A: Pricing-Diskussion. B: Gründerstory |
| r/startups | 2,12 Mio. | Nein (nur Monats-Thread) | Min. 250 Zeichen; keine Journey-Blogs | A: Fragen ohne Produktnamen |
| r/opensource | 381.976 | Nur Open Source | Entf. 90 % | Nein |
| r/SoftwareEngineering | 173.647 | Nur mit Mod-Freigabe | Nur Engineering-Blogs | A: Blog mit Freigabe |
| r/AskProgramming | 233.020 | Nein | Keine KI-Antworten | Nein |
| r/devtools | unbekannt | Nicht geregelt | ca. 10 Posts/Tag, kaum Engagement | B: Test mit geringem Risiko |
| r/cscareerquestions | 2,39 Mio. | Nur im Monats-Thread | – | Nein |

**Karma und Account-Alter:** Belegt ist nur die Schwelle von r/ClaudeAI (> 100 Karma). Sekundärquellen nennen für r/programming „300+ karma“ und für r/webdev „100+ karma, 30+ days“ (https://www.soar.sh/blog/self-promotion-rules-by-subreddit-database, Mai 2026). Diese Angaben sind **nicht verifiziert**. Reddit selbst gibt die Schwellen bewusst nicht bekannt (Abschnitt 1.6).

---

## 3. Technische Specs

| Thema | Wert | Quelle |
|---|---|---|
| Titel | 300 Zeichen | sekundär: https://coegipartners.com/wp-content/uploads/2023/12/Reddit-Creative-Specifications.pdf, https://typecount.com/blog/reddit-post-character-limit |
| Textpost | 40.000 Zeichen | sekundär, ebd. |
| Bild | JPG/PNG/WebP/HEIC, bis 20 MB | sekundär: https://help.postpone.app/platforms/reddit/media-limits |
| Galerie | bis 20 Bilder | sekundär: https://allplatforms.io/reddit/ (nicht selbst geprüft) |
| GIF | bis 100 MB | sekundär: Postpone, ebd. |
| Video | MP4/MOV, 1 GB, bis 15 Minuten | sekundär: Postpone (1 GB); die 15 Minuten nennen nur Suchmaschinen-Snippets von Ad-Spec-Seiten (https://strikesocial.com/blog/reddit-ad-specs-complete-sizes-dimensions-and-safe-zones-guide/) |
| Autoplay | Videos und GIFs spielen im Feed automatisch ab, Nutzer können das abschalten („Autoplay Media“; mobil „Always, Only on Wi-Fi, or Never“) | primär: https://support.reddithelp.com/hc/en-us/articles/38312409545492. Ob der Ton standardmäßig stumm ist, steht in keiner Primärquelle. Per Testpost prüfen |
| Markdown | Rich-Text- oder Markdown-Editor. Mobil wird der Markdown-Editor abgeschafft, „Markdown will remain as is on desktop“ | primär: https://support.reddithelp.com/hc/en-us/articles/205191185 |
| Codeblöcke | „Use indented code blocks instead of code fences. Old Reddit only supports indented code blocks.“ | primär: https://support.reddithelp.com/hc/en-us/articles/360043033952 |
| Link- vs. Textpost | Pro Subreddit festgelegt. Laut Snapshot 2/2025 nur Link-Posts in r/programming, nur Textposts in r/devops, r/SaaS und r/startups; keine Bilder oder Videos in r/programming, r/javascript, r/reactjs, r/opensource | Arctic Shift, `submission_type` |
| Crossposting („Repost“) | Nur in Subreddits, die das erlauben. „Reposting content randomly in various, unrelated communities can be seen as spammy behavior“ | primär: https://support.reddithelp.com/hc/en-us/articles/4835584113684 |

---

## 4. Echte Beispiele (letzte 12 Monate, ältere markiert)

Scores und Kommentarzahlen sind Archiv-Snapshots (Arctic Shift), Kommentarinhalte stammen aus dem Archiv bzw. aus RSS.

1. **Verdeckte Werbung, explizit als Werbung entlarvt:** r/programming, „After 2 months with CodeRabbit, I switched to something else. The difference was signal to noise.“, 19.02.2026. Link-Post auf entelligence.ai, 0 Punkte. Der einzige Kommentar kam von **programming-ModTeam: „This is very obviously an ad.“** Lehre: Ein Erfahrungsbericht, der auf ein Konkurrenzprodukt verlinkt, wird als Werbung erkannt. https://www.reddit.com/r/programming/comments/1r8w786/
2. **Als Frage getarnte Eigenwerbung:** r/programming, „Is there actually a free alternative to CodeRabbit that doesn't lock everything behind SaaS?“, 06.06.2026, Link auf das eigene Repo „openrabbit“. Automod-Filter mit der Begründung: „r/programming is not the place to post a project to get feedback, ask for help, or otherwise promote it.“ https://www.reddit.com/r/programming/comments/1tyad0t/
3. **Namensverwandter Wettbewerber mit Doppelpost:** r/programming, „AI is making it too easy to ship "Slop": slopcodemonitor.ai is a tool to quantify architectural erosion.“, 20.04.2026. Zweimal gepostet, **beide Posts vom Reddit-Spamfilter entfernt** (während des LLM-Banns). https://www.reddit.com/r/programming/comments/1sqlfjx/ und https://www.reddit.com/r/programming/comments/1sqi8gj/
4. **Produktlink ohne Resonanz:** r/programming, „sloprank -- community AI slop scoring for GitHub repos“, 11.03.2026, 0 Punkte, 1 Kommentar. https://www.reddit.com/r/programming/comments/1rqjco5/
5. **Welle identischer Launches:** r/SideProject am 29.09.2026. Mindestens 12 Posts zu „code review agent“ mit dem Memory-Produkt „Hindsight“, zum Teil mit gleichem Titel von verschiedenen Accounts: „We built an AI Code Review Agent that remembers recurring coding mistakes“ von u/CodeReviewTeam (Text) und von u/Muddam_Anu (Video). Fast alle wurden vom Reddit-Spamfilter entfernt. Lehre: Die Nische „AI code review“ ist auf Reddit massiv übersättigt, und gleichförmige Posts über mehrere Accounts löst den Spamfilter aus. https://www.reddit.com/r/SideProject/comments/1wtgd4f/
6. **Automod-Wand in r/ClaudeAI:** „I wanted coding agents to follow the same standards I use in code review, so I built this“, 24.09.2026, 11 Kommentare, trotzdem `automod_filtered`. Dasselbe gilt für „Retyping AI code as a review method - vscode extension“ vom 08.09.2026. In der Stichprobe waren 76 von 100 Posts Automod-gefiltert, vermutlich wegen der Karma-Schwelle > 100. https://www.reddit.com/r/ClaudeAI/comments/1wour6c/
7. **Daten als Aufhänger, doppelt gepostet:** r/ClaudeAI, „I asked Claude Code to pick the "best" code review tool and it chose itself 76% of the time“, 18.09.2026, Link auf armature.tech, 2 Punkte. Vier Tage vorher hatte derselbe Account die Bildvariante „Ask Claude Code to set-up the best Code Review tool … 76% of the cases (❗)“ gepostet. Lehre: Ein guter Daten-Hook trägt nicht, wenn der Post nach Wiederholung aussieht. https://www.reddit.com/r/ClaudeAI/comments/1wjsxm4/
8. **Positiv, ehrlicher Umgang mit Kritik:** r/mcp, „An MCP server for exact recall: 2,900 tokens a question against 24,500 for grep + read, 40 of 40 correct…“, 27.09.2026, Textpost, 6 Punkte und 9 archivierte Kommentare. Als ein Nutzer die Begriffe kritisierte, antwortete der Macher mit Zahlen („8x is the mean … the median is 4x“) und ergänzte den Post: „I can't change the title here, so I put it in the text.“ Lehre: Wer technische Kritik annimmt und seine Zahlen relativiert, baut Vertrauen auf. https://www.reddit.com/r/mcp/comments/1wrsba5/
9. **Gemischte Reaktion auf eine VS-Code-Extension:** r/vscode, „This is what it looks like when you spend 2,000+ hours on a VS Code extension“, 22.09.2026, Video, 33 Punkte und 14 Kommentare. Der Top-Kommentar kritisiert die UX („Like Subway Surfers running inside MS Word“), ein anderer schreibt „Nice slop“. Der Macher antwortete auf fast alles. Seine Antwort „Due to low demand, I hadn't implemented that yet“ landete bei −2. https://www.reddit.com/r/vscode/comments/1wn535n/
10. **Verdächtiges Seeding-Muster (nicht bewiesen):** r/ExperiencedDevs, „Can ai code review tools actually catch meaningful logic errors or just pattern match“. Derselbe Titel kam am 03.03.2026 (u/The_possessed_YT, 19 Kommentare) und am 04.03.2026 (u/TH_UNDER_BOI, 37 Punkte, 74 Kommentare). In den Antworten fallen Codex, Copilot und CodeRabbit. https://www.reddit.com/r/ExperiencedDevs/comments/1rkjg9z/ und https://www.reddit.com/r/ExperiencedDevs/comments/1rjpjox/
11. **Richtiges Thema, falscher Tag:** r/ExperiencedDevs, „We should refuse to review vibe code PRs“, 30.04.2026, Textpost, 47 Punkte und 87 Kommentare. Entfernt vom ModTeam mit der Begründung: „We limit AI posts to Saturday and Wednesday UTC time. Please re-post then.“ https://www.reddit.com/r/ExperiencedDevs/comments/1t09ayx/
12. **Stimmung gegen KI-Werbung:** r/webdev, „We now have AI bots advertising AI slop projects on open source projects via pull requests“, 17.09.2026, Bild, 336 Punkte und 40 Kommentare. Im Thread entfernte das ModTeam einen Kommentar als „LLM generated posts or comments“. https://www.reddit.com/r/webdev/comments/1wivo1w/
13. **(Älter als 12 Monate) Sicherheitsgeschichte über einen Wettbewerber:** r/programming, „How We Exploited CodeRabbit: From a Simple PR to RCE and Write Access on 1M Repositories“, 19.08.2025, 161 Punkte. Ein Duplikat mit reißerischem Titel („CodeRabbit leaks 1M repos …“) wurde von einem Moderator entfernt. Lehre: Eine GitHub App mit Schreibrechten wird auf Sicherheit abgeklopft. https://www.reddit.com/r/programming/comments/1muvk0j/
14. **Preisreaktion auf ein Review-Tool:** r/cursor, „Bugbot moving to usage based“, 11.05.2026, Bild, 34 Punkte. Die Kommentare rechnen mit „~$1.00-$1.50 per review“ und klagen, dass Findings häppchenweise kommen („gives 3 issues, then once fixed 2 new ones“). Ähnlich: „Bugbot used almost $300 in 14 days“ vom 27.07.2026. https://www.reddit.com/r/cursor/comments/1tacu2m/
15. **Maintainer gegen Slop:**
    - r/programming, „[Log4J] Addressing AI-slop in security reports“, 27.02.2026, 142 Punkte. https://www.reddit.com/r/programming/comments/1rg9p7u/
    - curl hat sein Bug-Bounty-Programm Ende Januar 2026 wegen KI-Slop eingestellt (https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/).
    - tldraw schließt externe PRs automatisch (https://github.com/tldraw/tldraw/issues/7695).
    - Ghostty verlangt seit Januar 2026, dass KI-PRs nur noch zu akzeptierten Issues eingereicht werden (sekundär: https://redmonk.com/kholterhoff/2026/02/03/ai-slopageddon-and-the-oss-maintainers/).
    - Die zugehörigen Reddit-Threads zu curl und tldraw konnte ich nicht finden, weil die Archiv-Volltextsuche wiederholt mit Timeout abbrach. Das ist **blocked: tooling**, kein negativer Befund.

---

## 5. Wie Macher über Geplantes sprechen

- **Moderatoren machen es vor:** r/programming kündigte den LLM-Bann ausdrücklich als Test an („trial … 2-4 weeks“), fragte danach öffentlich nach Feedback („Looking for feedback on AI content in…“) und verkündete am 23.05. die Entscheidung. r/ExperiencedDevs schrieb: „We're open to feedback on both counts … As usual, we'll see how it goes.“ Beide Mod-Posts wurden positiv aufgenommen (2.146 bzw. 848 Punkte im Archiv).
- **Roadmap-Posts ohne Substanz verpuffen:**
  - r/opensource, „OpenVue 1.0 is officially out and here's what's next: Volt, Vapor & 2.0“ (28.09.2026): 1 Punkt.
  - r/opensource, „Looking for beta testers before 1.0“: vom Moderator entfernt.
  - r/devops, „Looking for DevOps beta testers - …“: vom Reddit-Filter entfernt.
  - r/devtools, „[Beta …] CodeBurn Teams … Looking…“: zweimal gepostet, 1 Punkt.
- **Die Regeln verbieten verdecktes Einsammeln von Adressen:** r/SaaS verbietet „Posts designed purely to gather emails or "testers"“. r/programming (A) entfernt Posts, die „simply farming for e-mail addresses“ sind. **Ein Waitlist-Link als Hauptinhalt verstößt damit in mehreren Zielsubs direkt gegen die Regeln.**
- **Planung funktioniert als Antwort, nicht als Ausrede:** Im r/mcp-Beispiel (Nr. 8) beantwortete der Macher Rückfragen mit konkreten Zahlen und ergänzte den Post, und das wurde honoriert. Bei der VS-Code-Extension (Nr. 9) kam „due to low demand, I hadn't implemented that yet“ dagegen schlecht an.
- Der Weekly Thread in r/ChatGPTCoding fragt ausdrücklich nach „What kind of feedback you're looking for?“. Feedback-Anfragen sind dort also gewünscht, aber nur im Thread.

---

## 6. Zielgruppe: was sie ablehnt, was sie belohnt

**Ablehnung, jeweils belegt:**
- **KI-generierte Texte:** r/programming hat die Regel „No LLM-Written Content“, das r/webdev-ModTeam entfernt „LLM generated posts or comments“, r/typescript hat eine eigene „ChatGPT comment/post“-Regel, r/AskProgramming verbietet „No AI generated answers“. Sitewide ist verboten, KI-Inhalt als menschlich auszugeben (1.3).
- **KI als Thema überhaupt:** r/programming behandelt es als off-topic, r/ExperiencedDevs lässt es nur mittwochs und samstags zu, r/devops verbietet „AI content … stealth marketing“. Eine Kilo-Analyse (Anbieter!) von 6.876 Reddit-Posts aus Januar bis Juni 2026 fand, dass Zuverlässigkeit das negativste Thema war (31,8 % negativ) und menschliches Review als Standard gilt. Quelle: https://blog.kilo.ai/p/six-months-of-reddit-developer-sentiment (03.09.2026).
- **Verdeckte Werbung und Astroturfing:** „This is very obviously an ad.“ (Beispiel 1), die Regel „disguised ads“ in r/ClaudeCode, Alt-Accounts, die in r/SaaS mitgezählt werden, sowie der Ärger über Bots, die per PR Werbung platzieren (Beispiel 12).
- **„I built X“ als Masse:** Spamfilter-Quoten von 49 % (r/devops), 61 % (r/ChatGPTCoding) und 68 % (r/SideProject) in den Stichproben.
- **Closed Source und Bezahlprodukte:** r/typescript und r/opensource verlangen Open Source, r/javascript verbietet Werbung für Bezahlprodukte, r/webdev jede kommerzielle Promotion. r/ClaudeAI verlangt „free to try“.
- **Preisunsicherheit:** Siehe die Bugbot-Threads (Beispiel 14).

**Belohnt wird:**
- Technische Tiefe: Die Ausnahme in r/programming gilt nur für „deeply technical content about implementation“.
- Ehrliche Zahlen und Grenzen, siehe r/mcp (Beispiel 8).
- Antworten des Machers auf Kritik.
- Kostenlos testbare Produkte (Bedingung in r/ClaudeAI).
- Erfahrungsberichte aus der Praxis. „We should refuse to review vibe code PRs“ bekam 87 Kommentare, obwohl es kein Produkt enthielt.

---

## 7. Ableitungen für unslop

1. **Erst den Account aufbauen, dann posten:** Der Gründer braucht einen eigenen Account unter seinem Namen und liefert 4–6 Wochen lang echte Beiträge (Kommentare in r/ExperiencedDevs, r/devops, r/ClaudeCode), bevor er einen eigenen Link setzt. Ziel sind klar mehr als 100 Karma (Schwelle r/ClaudeAI), und die 9:1-Faustregel wird eingehalten. **Keine Alt-Accounts, keine Kollegen-Upvotes, keine Bitte um Votes** (1.3, 1.4).
2. **Phase A (vor dem Launch): diskutieren, nicht verlinken.** Geeignet sind r/ExperiencedDevs (nur mittwochs oder samstags UTC, Flair „AI/LLM“), r/devops (Textpost mit Diskussionsfrage) und r/ChatGPTCoding bzw. r/cursor (Discussion). Mögliche Themen sind KI-Reviewer, die KI-Code durchwinken, und deterministische gegenüber LLM-basierten Checks. **Ohne Produktlink und ohne Waitlist.**
3. **Keine Waitlist-Posts.** r/SaaS und r/programming werten das Einsammeln von Adressen als Spam. Die Waitlist erscheint höchstens im Profil oder auf Nachfrage in einem Kommentar.
4. **Phase B nur in erlaubten Formaten:**
   - Showcase in r/ClaudeCode (Flair „Built with Claude“)
   - r/ClaudeAI, aber nur mit kostenlosem Testzugang und dem Hinweis „free to try“
   - Showcase oder Server-Flair in r/mcp
   - Weekly-Threads in r/ChatGPTCoding und r/devops
   - Weekly Showoff Thread in r/nextjs
   - r/SaaS für die Gründerstory (einmal in 60 Tagen)
   - r/vscode und r/github erst, wenn Marketplace-Listing bzw. GitHub App öffentlich installierbar sind.
5. **Tabu:** r/programming (KI ist off-topic, eine Ausnahme wäre höchstens ein tief technischer Writeup über die AST-Detektoren ohne Pitch), r/webdev (nichts Kommerzielles), r/javascript (keine Bezahlprodukte), r/typescript und r/opensource (Closed Source), r/AskProgramming, r/cscareerquestions. r/vibecoding hat die Regel „No vibe coding pessimism“ und passt deshalb nicht zu unserer Botschaft.
6. **Offenlegung im ersten Satz**, zum Beispiel: „I'm one of the founders of unslop (closed-source, paid plan planned; free tier: …).“ Bei Bedarf zusätzlich den Brand-Affiliate-Tag setzen. So ist es in r/SaaS und r/ChatGPTCoding Pflicht, und in r/ClaudeAI reduziert es das Ban-Risiko.
7. **Titel sachlich, mit Zahl, ohne Werbesprech.** Etwa: „We benchmarked LLM reviewers on AI-written PRs: 55 of 119 rules are cheaper and more reliable as deterministic checks“. Nicht „Introducing…“, nicht „game-changer“, keine Emojis.
8. **Aufbau des Posts:** Problem aus eigener Erfahrung → Methode → **Grenzen** (nur JS/TS für den LLM-Reviewer, False Positives, Closed Source) → Frage an die Community → der Link erst am Ende. Codeblöcke eingerückt statt gefenced, damit sie auch auf old.reddit funktionieren.
9. **Selbst schreiben.** Die Posts dürfen nicht LLM-geschrieben wirken. Mehrere Subs entfernen solche Texte, und für ein Anti-Slop-Produkt wäre das doppelt fatal.
10. **Umgang mit Kommentaren:** In den ersten 3–4 Stunden jede sachliche Frage beantworten, Zahlen nachliefern und korrigierte Angaben im Post ergänzen (siehe r/mcp). Keine „low demand“-Ausreden. Zur Sicherheit einer GitHub App mit Schreibrechten (siehe CodeRabbit, Beispiel 13) sollte eine fertige, ehrliche Antwort bereitliegen.
11. **Nicht breit streuen.** Höchstens ein Subreddit pro Tag, pro Sub ein eigener Text statt Copy-and-paste, kein Mehrfachposten nach Entfernung. Beispiele 3, 5 und 7 zeigen, wie der Spamfilter auf Gleichförmigkeit reagiert.
12. **Bezahlte Option parallel:** „Promote your post“ auf einen gut gelaufenen organischen Post (CPC, Community-Targeting auf z. B. r/ExperiencedDevs oder r/devops) ist das legitime Werbeformat. Mods verweisen selbst darauf.
