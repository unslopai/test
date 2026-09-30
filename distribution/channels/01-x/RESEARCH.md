# X (Twitter): Kanal-Research für unslop

Stand: 2026-09-29. Alle Quellen wurden am 2026-09-29 abgerufen, sofern nicht anders vermerkt.

**Methodik und Zugriffsgrenzen**
- `help.x.com` liefert aus dieser Umgebung HTTP 403 (geprüft für `/rules-and-policies/platform-manipulation` und `/x-automation`), `web.archive.org` ist gesperrt. Regeln aus dem Help Center werden deshalb nur über Sekundärquellen oder Suchmaschinen-Snippets zitiert und jeweils so gekennzeichnet.
- Primärquellen, die erreichbar waren: `docs.x.com` (Developer-Doku, inklusive `llms-full.txt`), `x.com/en/tos`, das Algorithmus-Repo `xai-org/x-algorithm` (über raw.githubusercontent.com) und `twitter/the-algorithm-ml` (die Gewichte von 2023).
- Text, Datum, Medien und Engagement einzelner X-Posts stammen aus `api.fxtwitter.com`, einem Drittanbieter-Spiegel der öffentlichen Post-Daten. Die Zahlen sind ein Schnappschuss vom 2026-09-29 und keine offiziellen X-Analytics.

---

## 1. Offizielle Regeln und Richtlinien

### 1.1 Plattform-Manipulation, Spam, Fake-Engagement
- **Help-Center-Policy (nicht direkt erreichbar, 403).** Laut Suchmaschinen-Snippet der Seite https://help.x.com/en/rules-and-policies/authenticity (die frühere „Platform manipulation and spam“-Policy läuft inzwischen unter „Authenticity“) ist Folgendes verboten: „Coordinating to exchange engagement in any X features, such as Likes, Polls, Replies, Reposts, Lists, Views, or Follows“. Ebenfalls verboten ist, Inhalte „in a bulk, duplicative, irrelevant or unsolicited manner“ zu posten, einschließlich „bulk, aggressive, high-volume unsolicited replies, mentions, or direct messages“ und des Missbrauchs von Trend-Hashtags. Diesen Wortlaut habe ich nicht selbst gelesen, er stammt nur aus dem Snippet.
- **Primär: Developer Guidelines** (https://docs.x.com/developer-guidelines.md, abgerufen 2026-09-29). Die Tabelle „Spam & Manipulation“ nennt „Identical content across accounts, fake engagement, trend manipulation, bulk posting“. Wörtlich: „Likes must be directly initiated by the authenticated user. Automated, bulk, or indiscriminate liking … is prohibited.“ Gewinnspiele, die Follows oder Retweets verlangen, gelten als „Risky—can be seen as engagement manipulation“. Das Auto-DM an neue Follower ist „Not allowed … even though they followed you“. „App bulk-DMs users about a product launch“ wird als Spam eingestuft.
- **Engagement-Bait-Enforcement (sekundär).** Nikita Bier, damals Head of Product bei X, schrieb im Juli 2026: „Soliciting engagements ('I'll follow everyone who replies') 3 or more times will results in removal from the program and your account will be forwarded to the policy team for suspension.“ Die Erkennung läuft über Grok. Quelle: https://www.socialmediatoday.com/news/x-updates-its-engagement-bait-detection/825495/ (Artikel vom 16.07.2026). Bier ist im August 2026 zurückgetreten (https://techweez.com/2026/08/06/nikita-bier-steps-down-as-x-head-of-product/), seine Aussagen sind also keine dauerhafte Policy.

### 1.2 Automatisierung und KI-Replies
- **Primär** (https://docs.x.com/developer-guidelines.md): Automatisierte Accounts brauchen das Label „Automated“, einen Hinweis in der Bio („Bot by @yourcompany“) und die Verknüpfung mit einem von Menschen geführten Account. Replies sind erlaubt „Only if user engaged first. Max 1 reply per interaction“. Zu KI-Replies heißt es: „AI-Generated Content & Replies: Requires prior approval from X before deployment … Deploying AI-generated replies without approval is a violation, even if the content itself is helpful.“ Zu Nicht-API-Automatisierung: „Non-API automation (scraping, browser automation) results in permanent suspension.“
- **Primär, API-Changelog vom 23.02.2026** („Addressing LLM-generated spam“, in https://docs.x.com/llms-full.txt): „Programmatic replies via `POST /2/tweets` are now only permitted when the original Post's author has "summoned" the replier“. Dazu der Post von @XDevelopers: https://x.com/XDevelopers/status/2026084506822730185 (1,6 Mio. Views).
- **Planen per Tool ist erlaubt.** Die Developer Guidelines führen „Automated account posts scheduled content“ als erlaubt; Einschränkungen gelten nur für unaufgeforderte Mentions und identisches Cross-Posting.

### 1.3 Bezahlte Partnerschaften und Kennzeichnung
- Das Help-Center-Dokument https://help.x.com/en/rules-and-policies/paid-partnerships-policy ist nicht erreichbar (403). Sekundärquelle: TechCrunch vom 02.03.2026 (https://techcrunch.com/2026/03/02/x-ads-paid-partnership-labels-for-creators-so-they-can-ditch-the-hashtags/). Danach gibt es einen nativen Schalter „Paid Partnership“ unter „Content disclosure“, den man auch nachträglich setzen kann. Bier: „undisclosed promotions hurt the integrity of the product“. Laut Suchmaschinen-Zusammenfassung behandelt X einen Post als Paid Partnership, sobald eine Marke dem Creator etwas von Wert gibt; das habe ich nicht in der Primärquelle geprüft.
- **Neue X-ToS gelten ab 09.10.2026** (primär: https://x.com/en/tos, „Effective: October 9, 2026“). Die ToS erlauben weiterhin die Nutzung geposteter Inhalte „for use with and training of our machine learning and artificial intelligence models“. Das ist relevant für eigene Screenshots oder Code in Posts.

### 1.4 Zeichen, Long Posts, Threads
- **Primär** (https://docs.x.com/fundamentals/counting-characters): „Posts on X can contain up to **280 characters**.“ Das Limit ist gewichtet: Lateinische Zeichen zählen 1, „All emojis count as 2 characters“, CJK-Zeichen 2. „All URLs are wrapped with `t.co` shortener and count as **23 characters**“. Medien zählen 0, automatisch gesetzte @-Mentions in Replies ebenfalls 0. Zu Premium-Long-Posts sagt die Seite nichts.
- **Long Posts (nur sekundär):** Premium erlaubt bis zu 25.000 Zeichen pro Post, Threads umfassen bis zu 50 Posts. Quelle: Typefully-Hilfe, Stand 21.07.2026 (https://support.typefully.com/en/articles/8717699-twitter-x-posting-limitations). Die Help-Center-Seite https://help.x.com/en/using-x/x-premium war nicht erreichbar.

---

## 2. Technische Specs

| Thema | Wert | Quelle |
|---|---|---|
| Video: Seitenverhältnis | „must be between 1:3 and 3:1“ (9:16 ist also zulässig) | primär, https://docs.x.com/x-api/media/quickstart/best-practices |
| Video: empfohlene Encodierung | H264 High Profile, 30/60 FPS, AAC LC, ≥ 5.000 kbps Video, ≥ 128 kbps Audio, nur YUV 4:2:0, progressive, kein Open GOP, Pixel-Seitenverhältnis 1:1, Mono/Stereo | primär, ebd. |
| Video: Auflösung | Empfohlen: 720×1280 (Hochformat). „Subscribed users can upload a 1080p video and get 1080p playback. Unsubscribed users can upload a 720p video and get a 720p playback.“ Unter „Advanced“ steht zusätzlich „must be between 32x32 and 1280x1024“, was 1080×1920 formal widerspricht. Das ist offenbar eine veraltete API-Grenze und muss per Test-Upload geprüft werden. | primär, ebd. |
| Video: Dauer und Größe laut API-Doku | Standard: 0,5 s bis 20 min, 8 GB. Premium: bis 125 min, 16 GB. „Post-video caps match the X app.“ | primär, ebd. |
| Video: Dauer und Größe laut Sekundärquellen | Nicht-Premium: 140 s / 512 MB (https://www.nemovideo.com/blog/twitter-video-length-limits). RouteNote berichtete schon am 15.04.2025 von rund 10 min auf Desktop-Web für Free-Accounts (https://routenote.com/blog/x-increases-video-length/). **Das widerspricht der API-Doku.** Unsere Filme mit ~30 s liegen unter jeder Grenze, der Widerspruch ist für uns deshalb irrelevant. | sekundär |
| Bilder | ≤ 5 MB, JPG/PNG/GIF/WEBP | primär, ebd. |
| Bildformate | 1200×675 (16:9) „fills the in-timeline preview without cropping“, bis zu 4 Bilder pro Post (https://postfa.st/sizes/x). **1080×1080 und 1080×1350 konnte ich nicht verifizieren.** | sekundär |
| GIF | ≤ 15 MB, ≤ 1280×1080, ≤ 350 Frames, ≤ 300 Mio. Pixel (B×H×Frames) | primär, ebd. |
| Untertitel | SRT, Media-Kategorie `subtitles`, max. 1 MB (Media-Upload-Doku in llms-full.txt). Laut Changelog vom 07.11.2018 sind Untertitel „viewable on auto-playing video (when no sound is available)“. Ob das heute in allen Apps so ist: nicht verifiziert. | primär |
| Autoplay | Videos starten in der Timeline stumm und lassen sich per Einstellung auf „Nie“ oder „Nur WLAN“ setzen (https://www.lireo.com/how-to-disable-video-autoplay-in-twitter-for-desktop-browser-android-and-ios/). Ein offizielles Dokument dazu war nicht erreichbar. | sekundär |
| Link-Cards | Die offizielle Card-Doku (developer.x.com/…/summary-card-with-large-image) leitet inzwischen auf die Startseite von docs.x.com um, die Primärquelle ist also **nicht mehr erreichbar**. Sekundär (https://opengraphplus.com/consumers/twitter/images): `summary_large_image` hat das Format 2:1, empfohlen 1200×600, max. 4096×4096, < 5 MB, „Twitter center-crops“. Ein og:image in 1200×628 (1,91:1) wird dabei an den Rändern leicht beschnitten; wichtige Inhalte gehören in die Mitte. | sekundär |
| 9:16 in der Timeline | Seit Februar 2026 gibt es auf iOS einen neuen immersiven Vollbild-Player mit Wischen zum nächsten Video. Bier dazu: „cropping the video incentivized people to post square videos. We are a mobile company.“ (https://techcrunch.com/2026/02/18/x-continues-to-bet-on-vertical-video-with-its-latest-update/). Nach Kritik an der Beschneidung ruderte X zurück (https://dataconomy.com/2026/02/19/x-to-stop-cropping-vertical-videos-after-immediate-user-backlash/). Auf dem Desktop läuft 9:16 laut Sekundärquelle mit schwarzen Balken links und rechts (Pillarbox) (https://socialk.it/en/sizes/x-video-size). Die beiden Berichte widersprechen sich im Detail, der Stand muss vor dem Posten auf echten Geräten geprüft werden. | sekundär |

---

## 3. Algorithmus-Signale

### 3.1 Primärquelle: aktueller Code von 2026
Das Repo https://github.com/xai-org/x-algorithm wurde im Januar 2026 veröffentlicht; die README erwähnt Änderungen bis zum 27.08.2026. Das Scoring funktioniert so: `Final Score = Σ (weight_i × P(action_i))`. Das Phoenix-Transformer-Modell sagt dabei die Wahrscheinlichkeit jeder Aktion pro Viewer vorher. Die Standardgewichte in `home-mixer/params/param.rs` (https://raw.githubusercontent.com/xai-org/x-algorithm/main/home-mixer/params/param.rs):

| Signal | Gewicht | Signal | Gewicht |
|---|---|---|---|
| Favorite (Like) | 0.5 | Share via copy link | **20.0** |
| Reply | **5.0** | Share via DM | 5.0 |
| Reply-Boost bei gegenseitigem Folgen | 15.0 | Share | 2.0 |
| Quote | 5.0 | Follow author | 4.0 |
| Repost | 1.0 | Click | 0.3 |
| Open link | **0.2 (positiv)** | Cont. click dwell time | 0.4 |
| Video open | 0.07 | Dwell | 0.05 |
| VQV (Video Quality View) | **0.0** | Not interested | −47.52 |
| Mute author | −58.8 | Block author | −31.2 |
| Report | −234.0 | Not dwelled | −0.02 |

Was daraus folgt, alles belegt im Code:
- **Kein Link-Malus im Scoring.** Einen Link zu öffnen ist ein positives Signal (0.2). Ein Link-Penalty-Parameter existiert nicht.
- **Video-Completion wird im Default nicht direkt belohnt.** `VqvWeight = 0.0`, und VQV-fähig sind laut `MinVideoDurationMs = 10_000` ohnehin nur Videos ab 10 s. Belohnt werden Dwell und Dwell-Zeit. Die Parameter lassen sich per Experiment überschreiben, laut README bei ≥ 10 % Traffic sichtbar im Repo.
- **Replies zählen 10× so viel wie Likes**, zwischen Accounts, die sich gegenseitig folgen, noch mehr. Negative Signale wie Mute oder „Not interested“ wiegen sehr schwer. Das Repo warnt ausdrücklich: Die Gewichte skalieren **Wahrscheinlichkeiten, nicht Zählungen**. Ein Report hebt also nicht 468 Likes auf.
- **Neue Accounts:** `NewUserMinEngagementFilter` filtert „For new accounts, out-of-network posts below an engagement threshold“. Gleichzeitig gibt es einen „New-Author Boost“ mit Kaltstart-Parametern: `ColdStartFollowerCap = 1000`, `ColdStartImpressionThreshold = 1000`, `ColdStartMaxPostAgeSecs = 172800` (48 h). Out-of-Network-Posts werden generell mit einem Faktor unter 1 abgewertet. Weitere Posts desselben Autors im Feed werden per Diversity-Decay gedämpft (README, Abschnitt „Scoring and Ranking“).

### 3.2 Historisch, Code von 2023 (nicht mehr maßgeblich)
In `twitter/the-algorithm-ml` (https://raw.githubusercontent.com/twitter/the-algorithm-ml/main/projects/home/recap/README.md) standen folgende Gewichte: reply 13.5, `reply_engaged_by_author` **75.0**, good_profile_click 12.0, `video_playback50` 0.005, negative_feedback −74, report −369. Die in Marketing-Blogs verbreitete Regel „Antwort des Autors auf Replies = 75×“ stammt aus diesem Code von 2023. Im Code von 2026 gibt es dieses Signal nicht mehr. Dort wirkt stattdessen der Boost bei gegenseitigem Folgen (15.0).

### 3.3 Aussagen von X-Mitarbeitern (keine Code-Belege)
- **Links:** Am 19.10.2025 schrieb Bier: „posts with links tend to get lower reach. This is because the web browser covers the post and people forget to Like or Reply“, und kündigte einen neuen In-App-Browser an (https://x.com/nikitabier/status/1979994223224209709, 7,3 Mio. Views). Im Juli 2026 schrieb er: „you do not need to put the links in replies anymore“, Musk antwortete: „We haven't for over a year.“ (https://www.freepressjournal.in/tech/x-product-head-nikita-bier-confirms-link-penalty-removed-over-a-year-ago-tells-mark-zuckerberg-he-can-post-them-directly). **Fazit:** Die geringere Reichweite von Link-Posts wird mit fehlendem Engagement erklärt, nicht mit einer Strafe. Die Regel „Link in die erste Reply“ ist ein Mythos aus Marketer-Kreisen und nicht mehr nötig.
- **Originalität:** Am 12.04.2026 riet Bier zu „talking videos“ und „record original videos with your own voice-over“. Reposts und Aggregatoren-Content sollen bis zu 90 % Impressions-Abzug bekommen (https://piunikaweb.com/2026/04/13/x-twitter-original-talking-videos-nikita-bier/, https://www.socialmediatoday.com/news/x-boosts-incentives-for-original-content-creators/817271/). Das ist eine Aussage, kein Code-Beleg.
- **Marketer-Behauptungen ohne Beleg**, etwa „Threads performen besser“, „die ersten 30 Minuten entscheiden“ oder „Premium = 4× Reichweite“: Im Code von 2026 fand ich keinen Premium- oder Verified-Boost-Parameter. Die Suche nach „premium|verified|blue“ in README und param.rs ergab keinen Treffer. Ein solcher Boost kann aber außerhalb der veröffentlichten Parameter existieren.

---

## 4. Beispiele: Developer-Tool-Posts und Launches auf X

Engagement-Zahlen sind ein Schnappschuss von api.fxtwitter.com am 2026-09-29. „Älter“ markiert Posts vor Oktober 2025.

1. **@bcherny (Boris Cherny, Claude Code), 02.01.2026**, https://x.com/bcherny/status/2007179832300581177
   - Hook: „I'm Boris and I created Claude Code. Lots of people have asked how I use Claude Code, so I wanted to show off my setup a bit.“
   - Format: Text-Thread ohne Medien.
   - Engagement: 54,2k Likes, 1,3k Replies, 8,2 Mio. Views, **103k Bookmarks**.
   - Es folgten Tipp-Threads am 31.01.2026 (https://x.com/bcherny/status/2017742741636321619, 9,2 Mio. Views, 102k Bookmarks) und am 30.03.2026 (https://x.com/bcherny/status/2038454336355999749, 4,0 Mio. Views).
   - **Takeaway:** Konkrete Praxis-Threads vom Macher selbst sammeln mehr Bookmarks als Likes. Nutzwert schlägt Hype.

2. **@bcherny, Changelog „Claude Code 2.1.0“, 08.01.2026**, https://x.com/bcherny/status/2009072293826453669
   - Hook: „Claude Code 2.1.0 is officially out! claude update to get it“
   - Format: Bullet-Liste mit Features, „Overall: 1096 commits“, Changelog-Link und Setup-Link im Hauptpost, dazu ein Bild. Schluss: „Lmk what you think!“
   - Engagement: 10,5k Likes, 682 Replies, 900k Views.
   - **Takeaway:** Ein Changelog als Post funktioniert, wenn er konkret ist, und Links im Hauptpost schaden nicht sichtbar.

3. **@coderabbitai, CodeRabbit CLI, 16.09.2025 (älter, knapp vor dem Zeitraum)**, https://x.com/coderabbitai/status/1967956147601895803
   - Hook: „Introducing CodeRabbit CLI! 🎉 CodeRabbit's smart CLI reviews act as quality gates for Codex, Claude, Gemini, and you. Stop shipping slop. Start shipping quality.“
   - Medien: Video, **1920×1080, 53 s**.
   - Engagement: 1,27k Likes, 138 Replies, 411k Views.
   - Vier Tage später folgte ein Frage-Post, „What's the CLI tool that you use the most?“ (https://x.com/coderabbitai/status/1969419676997284016): 176 Likes, aber **108 Replies**.
   - **Takeaway:** Ein Wettbewerber besetzt „slop“ und „quality gates“ bereits wörtlich, unslop braucht einen schärferen Unterschied. Ehrliche Fragen erzeugen Replies ohne Bait.

4. **@dakshgup (Greptile), $25M + v3, 23.09.2025 (älter)**, https://x.com/dakshgup/status/1970503694346264631
   - Hook: „Greptile has raised $25M to Kill The Bug.“
   - Format: Thread (🧵) voller Zahlen („500M lines of code“, „180,000+ bugs“, „>3x more critical bugs“), dazu ein **1920×1080-Video mit 64 s**.
   - Engagement: 1,34k Likes, 151 Replies, 694k Views.
   - **Takeaway:** Große Zahlen tragen hier, weil hinter ihnen echte Nutzung steht. Pre-launch haben wir diese Zahlen nicht.

5. **Gescheitert: Greptile-Preisänderung, 05.03.2026**, https://x.com/dakshgup/status/2029587584775836051
   - Die Preisänderung stand im **letzten Post eines Threads**: „Lastly, we're modifying our pricing to a base + usage model … $30/developer/month, which includes 50 reviews, after which reviews cost $1 each.“
   - Engagement: 17 Likes, 17k Views.
   - Kritik kam als Quote-Post von @mg: „this pricing change is a doozy … going from $30/mo to more than $500/mo“ (https://x.com/mg/status/2029751037716836478). Ein Kritiker baute sogar eine eigene Seite (https://greptile-fail.vercel.app/).
   - **Takeaway:** Preisänderungen nicht verstecken, Beispielrechnungen für Power-User mitliefern.

6. **@cursor_ai, Bugbot-Effort-Levels, 11.05.2026**, https://x.com/cursor_ai/status/2053892050299597107
   - Hook: „You can now customize how deeply Bugbot thinks during a PR review.“ Danach Dogfooding: „At Cursor, we use high effort for changes to our infrastructure…“
   - Medien: **1920×1080, 25 s**.
   - Engagement: 726 Likes, 47 Replies, 72k Views.
   - **Takeaway:** Ein Satz Feature, ein Satz „so nutzen wir es selbst“. Nüchtern und glaubwürdig, aber keine große Reichweite.

7. **@cursor_ai, Preis-Entschuldigung, 05.07.2025 (älter)**, https://x.com/cursor_ai/status/1941352398750171239
   - Hook: „We recently updated our pricing, but missed the mark. We're refunding affected customers and clarifying how our pricing works.“ Danach ein Blog-Link.
   - Engagement: 4,97k Likes, 660 Replies, 1,26 Mio. Views.
   - **Takeaway:** Ein kurzes Schuldeingeständnis mit konkreter Abhilfe (Erstattung) entschärft Kritik.

8. **@cursor_ai / @graphite, Übernahme, 19.12.2025**
   - Cursor: „Graphite is joining Cursor.“ mit Link (https://x.com/cursor_ai/status/2002046697535676624): 3,8k Likes, 1,38 Mio. Views.
   - Graphite: dieselbe Zeile plus ein **4-Sekunden-Video in 16:9** (https://x.com/graphite/status/2002047057939644480): 677k Views.
   - **Takeaway:** Große News brauchen keine Rhetorik.

9. **@charliermarsh (Astral → OpenAI), 19.03.2026**, https://x.com/charliermarsh/status/2034623222570783141
   - Hook: „We've entered into an agreement to join OpenAI as part of the Codex team.“
   - Format: reiner Text.
   - Engagement: 3,1k Likes, **278 Replies**, 498k Views.
   - Die Community reagierte gespalten (https://thenewstack.io/openai-astral-acquisition/).
   - **Takeaway:** Ein hoher Anteil an Replies zeigt Ambivalenz an. Wer Entwickler-Infrastruktur baut, wird an der Unabhängigkeit gemessen.

10. **@_catwu / @theo, Bun → Anthropic, 02.12.2025**
    - Der offizielle Post von Cat Wu (https://x.com/_catwu/status/1995918674306502921): 1,9k Likes, 253k Views.
    - Theos „BREAKING: Bun has been acquired by Anthropic.“ (https://x.com/theo/status/1995922209865695554): 3,1k Likes, 361k Views.
    - **Takeaway:** Kommentatoren mit großer Reichweite verstärken News stärker als die Quelle selbst. Seeding bei Dev-Influencern schlägt den eigenen Brand-Account, muss aber als Paid Partnership gekennzeichnet werden, sobald Geld oder Gegenwert fließt.

11. **@openclaw (Peter Steinberger), Umbenennung, 27.01.2026**, https://x.com/openclaw/status/2016058924403753024
    - Hook: „🦞 BIG NEWS: We've molted! Clawdbot → Moltbot“. Offen erklärt: „Anthropic asked us to change our name (trademark stuff)“.
    - Format: reiner Text.
    - Engagement: 13,7k Likes, 1,1k Replies, 3,95 Mio. Views.
    - Im Rückblick gab es auch Kritik (Sicherheitslücken, Krypto-Scams; https://www.cnbc.com/2026/02/02/openclaw-open-source-ai-agent-rise-controversy-clawdbot-moltbot-moltbook.html).
    - **Takeaway:** Persönlichkeit und Offenheit tragen weit. Virale Reichweite bringt aber auch Angriffsfläche.

12. **@mitchellh (Ghostty), KI-Policy, 22.01.2026**, https://x.com/mitchellh/status/2014433315261124760
    - Hook: „Ghostty is getting an updated AI policy. AI assisted PRs are now only allowed for accepted issues. Drive-by AI PRs will be closed without question.“
    - Engagement: 2,07k Likes, 176k Views.
    - Vorläufer vom 19.08.2025: https://x.com/mitchellh/status/1957926641004605822.
    - Laut RedMonk schrieb Hashimoto am 16.01.2026: „It's a fucking war zone out here man. Maintainer morale at an all time low.“ (https://redmonk.com/kholterhoff/2026/02/03/ai-slopageddon-and-the-oss-maintainers/). Die Post-URL habe ich nicht gefunden.
    - **Takeaway:** Den Schmerz, den unslop adressiert, formulieren prominente Maintainer selbst. Diese Sprache ist unser Resonanzraum.

13. **@tldraw (Steve Ruiz), 15.01.2026**, https://x.com/tldraw/status/2011911073834672138
    - Hook: „This week we're going to begin automatically closing pull requests from external contributors. I hate this, sorry.“
    - Medien: Screenshot.
    - Engagement: 1,9k Likes, **747k Views**.
    - **Takeaway:** Ein ehrlicher Satz mit Gefühl („I hate this“) erreicht deutlich mehr Views als Likes, wird also stark gelesen.

14. **curl / Daniel Stenberg, Ende des Bug-Bounty-Programms (Januar 2026)**
    - Stenbergs eigene Ankündigung lief über Blog, Mastodon und einen GitHub-PR (https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/, https://github.com/curl/curl/pull/20312). **Einen X-Post von @bagder dazu habe ich nicht gefunden.**
    - Auf X lief die Debatte über Dritte, etwa @InsiderPhD: „This was so inevitable, curl received so much AI slop…“ (https://x.com/InsiderPhD/status/2013539187257983414, 242 Likes).
    - **Takeaway:** Nicht jeder Meinungsführer ist auf X aktiv. Der Diskurs findet dort trotzdem statt.

15. **@jasonlk / @amasad, Replit löscht Produktions-DB, Juli 2025 (älter)**
    - Lemkin: „.@Replit goes rogue during a code freeze and shutdown and deletes our entire database“ mit 4 Screenshots (https://x.com/jasonlk/status/1946069562723897802, 2,7 Mio. Views).
    - Masad antwortete zwei Tage später mit „Unacceptable and should never be possible“ und einer Liste konkreter Fixes, dazu „More tomorrow.“ (https://x.com/amasad/status/1946986468586721478, 583k Views).
    - Gegenbeispiel: Masad reagierte auf ThePrimeagen mit „You packed 3 separate lies in a single tweet.“ (https://x.com/amasad/status/1949124016318689546).
    - **Takeaway:** Kritik mit konkreten Fixes beantworten, nicht persönlich werden.

16. **@cognition, Devin-Launch, 12.03.2024 (deutlich älter, Referenz für Over-Promising)**, https://x.com/cognition/status/1767548763134964000
    - Hook: „Today we're excited to introduce Devin, the first AI software engineer.“
    - Medien: 4K-Video, 109 s.
    - Engagement: 42k Likes, 31,5 Mio. Views.
    - Später zerlegte „Internet of Bugs“ die Upwork-Demo, Answer.AI kam auf 3 von 20 gelösten Aufgaben (https://www.tweaktown.com/news/102761/worlds-first-ai-software-engineer-fails-85-of-its-assigned-tasks/index.html).
    - **Takeaway:** Superlative wie „first“ oder „kills bugs“ lösen bei Entwicklern Beweis-Jagd aus.

17. **Build in Public: @levelsio, @marclou, @tdinh_me**
    - @levelsio baute sein Flugsimulator-Spiel live auf X; Post vom 22.02.2025 (älter): „Ok it's done … 100% with Cursor in I'd say 3 hours“ mit 168-s-Video (https://x.com/levelsio/status/1893385114496766155, 1,1 Mio. Views). Dazu die Vibe-Jam-Ankündigung vom 02.04.2026 (https://x.com/levelsio/status/2039777677435908421, 1,6 Mio. Views, 2,4k Bookmarks).
    - @marclou veröffentlicht auch sinkende Umsätze. Laut https://streakr.co/playbook/marc-lou machte ShipFast in den 30 Tagen vor dem 11.08.2026 noch 3.537 $. Sein Quote-Post vom 09.03.2026 „I thought it was a bad idea to build ShipFast. It made $1.2M“ kam trotz großer Followerschaft nur auf 14,5k Views (https://x.com/marclou/status/2030961850980962768).
    - @tdinh_me: „$148k revenue last month. All-time high for TypingMind.“ (05.04.2025, älter; https://x.com/tdinh_me/status/1908345028327727335, 940 Likes, 98 Replies).
    - **Takeaway:** Zahlen und Belege, auch unbequeme, tragen Build in Public. Nicht jeder Post zündet, auch nicht bei großen Accounts.

18. **Referenzpunkt: @karpathy „vibe coding“, 02.02.2025 (älter)**, https://x.com/karpathy/status/1886192184808149383
    - Hook: „There's a new kind of coding I call "vibe coding", where you fully give in to the vibes, embrace exponentials, and forget that the code even exists.“
    - Format: ein langer Einzelpost (Premium), ohne Medien.
    - Engagement: 34k Likes, 7,4 Mio. Views.
    - Rückblick vom 04.02.2026: „I still can't predict my tweet engagement basically at all. This was a shower of thoughts throwaway tweet“ (https://x.com/karpathy/status/2019137879310836075, 1,3 Mio. Views).

**Auffällig:** Alle Launch-Videos im Sample von Dev-Tools (CodeRabbit, Greptile, Cursor, Graphite) sind **16:9 in 1920×1080**. Kein einziges ist 9:16.

---

## 5. Wie erfolgreiche Macher auf X über Geplantes sprechen

- **Shipping-Log statt Roadmap-Versprechen.** Boris Chernys Posts nennen, was *heute* ausgeliefert ist: Version, Befehl, Liste, Commit-Zahl, „Lmk what you think!“ (Beispiel 2). Wenn er nach vorne blickt, dann ohne konkrete Zusagen: „So much more to do. We are 1% done.“ (https://x.com/bcherny/status/2074247226038063316, 456k Views).
- **Ankündigungen nur mit sofortigem Teil-Liefern.** Replit hat das Wochenende durchgearbeitet und die ersten Fixes schon ausgerollt; erst danach kam „More tomorrow“ (Beispiel 15). So wirkt ein Ausblick glaubwürdig.
- **Die Community am Kommenden beteiligen:** Jarred Sumner fragte „what should we do for the bun 1.4 video“ (https://x.com/jarredsumner/status/2061627763967291810: 336 Likes, 76 Replies). Das ist echte Einbindung, kein Bait.
- **Über-Versprechen rächt sich:** Devins „first AI software engineer“ wurde öffentlich zerlegt (Beispiel 16). Greptiles in einem Thread versteckte Preisänderung löste die heftigste Kritik aus (Beispiel 5).
- **Offenheit über Rückschläge** (Marc Lou mit sinkendem ShipFast-Umsatz, Cursors „missed the mark“) wird eher belohnt als bestraft. Dafür, dass sie Reichweite *steigert*, habe ich keine harten Zahlen.

---

## 6. Zielgruppen auf X

- **Entwickler insgesamt: X ist für sie ein Nebenkanal.** Stack Overflow Developer Survey 2025, Frage nach Community-Plattformen, professionelle Entwickler: Reddit 53,6 %, LinkedIn 38,1 %, Discord 37,3 %, Hacker News 20,4 %, **X 17 %**, Bluesky 10,8 % (https://survey.stackoverflow.co/2025/technology). Die Stichprobe ist zugunsten von Stack Overflow verzerrt.
- **Senior Engineers, Maintainer, AI-Tool-Macher: stark vertreten und meinungsbildend.** Hashimoto, tldraw, Cherny, Karpathy und Marsh (Beispiele oben) prägen den Diskurs zu KI-Code auf X. Die Teams der Wettbewerber (CodeRabbit, Greptile, Cursor) posten dort aktiv.
- **Indie-Gründer und Solo-Devs: Kernpublikum von X** (levelsio, Marc Lou, Tony Dinh).
- **CTOs und VPs Engineering:** Für ihre X-Nutzung habe ich **keine belastbare Quelle** gefunden. Die Annahme „eher LinkedIn“ ist plausibel, aber unbelegt. Laut SO-Survey ist LinkedIn unter Profis mehr als doppelt so verbreitet wie X.
- **Abwanderung:** Laut Sekundärquellen sind Teile der Tech-Community zu Bluesky gewechselt (https://sherwood.news/culture/people-are-leaving-x-for-bluesky/). Quantitativ ist das nur durch die 10,8 % aus dem SO-Survey belegt.
- **Was abgelehnt wird (belegt):**
  - Engagement-Bait: Die Plattform sanktioniert ihn selbst (Abschnitt 1.1).
  - Automatisierte oder KI-generierte Replies: API-Sperre seit 23.02.2026, X nennt als Grund ausdrücklich „LLM-generated spam“.
  - Hype-Superlative und unbelegte Zahlen: siehe Devin.
  - Undurchsichtige Preise: Greptile, Cursor 2025.
  - KI-Slop generell: Ghostty, tldraw, curl.
  - Rauschen durch KI-Reviewer: Beschwerden über „bots reviewing, bots replying“ und Falsch-Positive (https://dev.to/cseeman/return-on-attention-why-ai-code-reviews-are-wearing-us-out-2hh0, https://www.builder.io/blog/developers-drowning-in-ai-prs). Laut der Suchmaschinen-Zusammenfassung von Sonars „State of Code 2026“ vertrauen 96 % KI-Code nicht vollständig. Diese Zahl habe ich nicht in der Primärquelle geprüft.
- **Nicht belegt, nur verbreitete Einschätzung:** dass „🧵👇“-Hype-Threads von Entwicklern pauschal abgelehnt werden. Gegenbeleg: Greptile nutzte 🧵 erfolgreich, Chernys Threads zünden. Entscheidend ist offenbar der Nutzwert, nicht das Format.

---

## 7. Ableitungen für unslop

1. **Vom Gründer-Account posten, nicht von einem neuen Brand-Account.** Laut Code filtert X Out-of-Network-Posts neuer Accounts unter einer Engagement-Schwelle heraus. Der Brand-Account repostet und quotet nur. Autoren unter 1.000 Followern können vom Kaltstart-Boost profitieren, allerdings nur innerhalb von 48 h nach dem Post.
2. **Hook = echter Beleg, kein Slogan.** Ein Screenshot oder Clip eines echten Check-Runs, der in einem KI-generierten PR einen konkreten Fehler findet, den der LLM-Reviewer durchgewunken hat. „Stop shipping slop“ ist wörtlich von CodeRabbit besetzt. Unser Unterschied („AI grading AI's homework“) muss am Beispiel sichtbar werden, nicht als Behauptung.
3. **Die 9:16-Filme nicht blind posten.** Auf iOS spielen sie im immersiven Vollbild-Player, auf dem Desktop mit Pillarbox. Jedes Dev-Tool-Launchvideo im Sample war 16:9. Ich empfehle, zusätzlich einen 16:9- oder 1:1-Schnitt zu rendern und A/B zu testen, und in der 9:16-Fassung den Text in der sicheren Mitte zu halten. Die Filme sind mit ~30 s > 10 s und damit VQV-fähig, das Signal ist aktuell aber mit 0 gewichtet. Dwell zählt. Eingebrannter Text passt zum stummen Autoplay; ein SRT (≤ 1 MB) ist optional.
4. **Export-Specs:** H.264 High, yuv420p, 30 fps, progressive, geschlossene GOP, AAC-LC-Stereospur (auch wenn stumm), ≥ 5.000 kbps. 1080×1920 wird nur mit Premium in 1080p abgespielt, ohne Premium in 720p. Ein Test-Upload ist Pflicht, weil die Doku „max 1280x1024“ nennt.
5. **Länge:** Den Hauptpost unter 280 gewichteten Zeichen halten (Emoji zählt 2, URL 23). Technische Tiefe als Thread mit echtem Nutzwert nach Chernys Muster. Das Ziel sind Bookmarks und Replies, nicht Likes.
6. **Link in den Hauptpost, aber erst, wenn es ein Ziel gibt.** Laut Code gibt es keinen Link-Malus, und X-Verantwortliche haben die Reply-Link-Regel für überflüssig erklärt. Pre-launch gibt es weder npm-Paket noch Marketplace noch Waitlist. Der Post muss also ohne Link funktionieren; ein Link kommt erst, wenn die Waitlist live ist. Eine tote Seite als Ziel beschädigt das Vertrauen.
7. **Pre-launch ehrlich benennen.** „Not public yet“ statt „coming soon 🚀“. Nach außen nur zeigen, was schon läuft (Shipping-Log), keine Termine oder Erkennungsraten versprechen, die nicht gemessen sind. Nach dem Devin-Fall rechnen Entwickler jede Zahl nach.
8. **Replies selbst und von Hand beantworten.** Replies wiegen 10× so viel wie Likes, bei gegenseitigem Folgen mit zusätzlichem Boost. Keine KI-Replies und kein Tool-Autoreply: Das verstößt gegen die Developer Guidelines (vorherige Freigabe nötig) und schadet genau bei unserer Anti-Slop-Positionierung. Kritik nach dem Muster Cursor/Replit beantworten (Fehler zugeben, konkreter Fix), nicht nach Masad vs. Primeagen.
9. **Kadenz:** Etwa ein substanzieller Post pro Tag plus aktive Replies bei den Maintainer-Diskussionen (Ghostty, tldraw, curl), und zwar ohne Produktlink in fremden Threads. Mehrere Posts kurz hintereinander werden per Author-Diversity-Decay gedämpft. Die Größenordnung „1 pro Tag“ ist aus dem Code abgeleitet, nicht gemessen.
10. **Echte Fragen statt Bait.** Fragen wie bei CodeRabbit oder Jarred (etwa „Welcher KI-Reviewer hat euch zuletzt einen Bug durchgewunken?“) sind erlaubt und erzeugen Replies. „Reply 'X' and I'll DM you“ oder „follow + RT to win“ sind nach Plattformregeln riskant oder verboten.
11. **Preise prominent und mit Rechenbeispiel veröffentlichen** und Bestandskunden schützen. Das ist die Lehre aus Greptile 03/2026 und Cursor 07/2025.
12. **Seeding bei Dev-Influencern nur mit Kennzeichnung.** Kostenloser Zugang gegen einen Post ist bereits ein Gegenwert, dafür ist das Label „Paid Partnership“ nötig. Außerdem muss das Team die ab 09.10.2026 geltenden neuen X-ToS prüfen. X allein reicht nicht: Nur 17 % der professionellen Entwickler nutzen X, deshalb gehören Hacker News, Reddit und LinkedIn (für CTOs) als Parallelkanäle dazu.
