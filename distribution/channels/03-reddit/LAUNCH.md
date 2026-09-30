# LAUNCH: Reddit

## Vorlauf: ab sofort möglich, braucht nichts von unslop

Reddit ist der einzige der fünf Kanäle, bei dem sich schon **vor** dem HR-Eintrag etwas tun lässt, ohne das Produkt zu erwähnen.

1. **Einen Account unter dem eigenen Namen anlegen oder weiter nutzen.** Keine Zweit-Accounts, keine „Marken-Accounts“ zum Hochvoten (Reddit Rules, RESEARCH.md §1.3; r/SaaS zählt Zweit-Accounts beim Limit mit).
2. **4–6 Wochen echte Beteiligung** in r/ExperiencedDevs, r/devops, r/ClaudeCode und r/mcp: Fragen beantworten, Erfahrungen teilen, ohne Produkt. Ziel sind deutlich mehr als 100 Karma. Das ist die einzige öffentlich belegte Schwelle (r/ClaudeAI); andere Subs nennen ihre nicht (RESEARCH.md §2).
3. **9:1 als Faustregel:** Das ist keine offizielle Regel mehr, nur noch „rule of thumb“ in der Reddiquette (RESEARCH.md §1.4). Mods verweisen trotzdem darauf, etwa r/webdev.
4. **Profil:** ein Satz „Founder of unslop“, Link auf unslop.codes erst, wenn das Impressum live ist.

## Was vor den Posts live sein muss

| Voraussetzung | Für |
|---|---|
| HR-Eintrag, Impressum und Datenschutz live | alle (der Name unslop fällt in der Offenlegung, Leser googeln) |
| Landing-Korrekturen W1–W4 (CONTEXT §6) | dringend: Reddit-Leser öffnen die Seite und prüfen die Claims |
| Account-Vorlauf erledigt (> 100 Karma, Historie in den Ziel-Subs) | alle |
| npm-Publish (`@unslopcodes/cli`, `@unslopcodes/mcp`), Signup offen, Paddle live | R-B1–R-B4 |
| Bestätigung „mit Claude Code gebaut“ | Flair „Built with Claude“ in R-B1 |
| W1, W12, W16 umgesetzt | R-B5 |
| Regeln der Ziel-Subs **eingeloggt im Browser** gegenlesen (die Recherche lief über RSS, Zendesk-API und Archiv, nicht über die Live-Seiten) | alle |

## Empfohlener Zeitplan

| Wann | Post | Warum |
|---|---|---|
| Phase A, erster **Mittwoch oder Samstag (UTC)** nach dem HR-Eintrag, 13:00–15:00 UTC | **R-A1** r/ExperiencedDevs | KI-Themen sind dort nur Mi/Sa erlaubt. Ein Post am falschen Tag wurde mit „Please re-post then“ entfernt (RESEARCH.md §4 Nr. 11). Die Uhrzeit ist eine Heuristik: Überschneidung von EU-Nachmittag und US-Vormittag |
| 3–5 Tage später | **R-A2** r/devops | Anderes Publikum, eigener Text, nicht am selben Tag |
| Launch-Tag L | kein Reddit-Post | HN ist Leit-Kanal (`../04-hackernews/LAUNCH.md`). Parallel posten verteilt die Aufmerksamkeit, und gleichförmige Launches triggern den Spamfilter (RESEARCH.md §4 Nr. 5) |
| L + 1 | **R-B1** r/ClaudeCode | Showcase, mit dem Terminal-Demo-Video |
| L + 3 | **R-B2** r/mcp | Anderer Winkel (MCP-Design), eigener Text |
| nächster Weekly-Thread nach L | **R-B3** r/ChatGPTCoding, **R-B4** r/devops | Nur im Thread, als Kommentar |
| frühestens L + 7, einmal in 60 Tagen | **R-B5** r/SaaS | Gründerstory über den Faktencheck, nur wenn die Korrekturen umgesetzt sind |

## Ablauf am Posttag

1. Regeln und Flair des Subs am selben Tag gegenlesen. Ist der Post nicht eindeutig erlaubt, vorher per Modmail fragen.
2. Posten, dann **3–4 Stunden erreichbar** bleiben und jede sachliche Frage selbst beantworten (RESEARCH.md §7.10). Vorlagen in `FAQ.md`, aber in eigenen Worten.
3. **Korrekturen sichtbar machen:** Ist eine Angabe falsch oder zu stark, mit „Edit:“ im Post ergänzen, nicht still ändern. Das r/mcp-Muster (Beispiel 8) ist die Vorlage.
4. **Nie** um Upvotes bitten, nicht im Team oder in anderen Kanälen verlinken mit der Bitte um Votes, keine Zweit-Accounts, keine Kommentare von Kollegen ohne Offenlegung (Reddit Rules: Vote-Manipulation, RESEARCH.md §1.3).
5. **Entfernt?** Nicht neu posten, nicht in einem anderen Sub am selben Tag nochmal. Die Modmail-Antwort abwarten und die Begründung in `RESEARCH.md` ergänzen.
6. Nach 48 h notieren: Score, Kommentare, Kernfragen (neue FAQ-Kandidaten), Waitlist-Eintragungen des Tages aus `waitlist_signups`. Kein Tracking-Pixel.

## Reaktion auf Kritik

- **„Ad“ / „shill“:** zugeben, dass ich der Macher bin (FAQ 1). Keine Diskussion über die Absicht, zurück zur Sache.
- **Sicherheitsfragen zur GitHub App:** Rechte offen nennen und den Grund für `contents: write` erklären (FAQ 5).
- **Harte Kritik an KI-Tools allgemein** (Reliability, 31,8 % negativ, RESEARCH.md §6): nicht widersprechen, sondern zustimmen, wo es stimmt, und die Grenzen unseres Tools nennen.
- **„Low demand“-Ausreden vermeiden** (Beispiel 9). Stattdessen: „planned, not built“ oder „not planned, because …“.
