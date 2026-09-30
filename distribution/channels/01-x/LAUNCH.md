# LAUNCH: X

## Was vorher live sein muss

| Voraussetzung | Für | Prüfbefehl / Beleg |
|---|---|---|
| HR-Eintrag, Impressum und Datenschutz live | alle Posts | `curl -s -o /dev/null -w "%{http_code}" https://unslop.codes/en/impressum` ⇒ 200 |
| Warteliste live (`NEXT_PUBLIC_WAITLIST_LIVE=true`, Brevo-Env, `news.unslop.codes`) | X-1 bis X-6 (Link im Reply) | eine Test-Eintragung mit DOI-Mail (WAITLIST_SPEC §7) |
| Landing korrigiert: mindestens W1 (44×-H1), W2 („If quality drops …“), W3 („verdicts no LLM votes on“) | X-3 zwingend, alle anderen dringend | `CONTEXT.md` §6, ROADMAP §10 |
| Test-Upload beider Videoformate auf einem privaten Account, geprüft auf iOS, Android und Desktop | X-1, X-4 | RESEARCH.md §2: API-Doku nennt „max 1280x1024“, der Player ist uneinheitlich |
| `npm view @unslopcodes/cli version` liefert eine Version, Signup offen | X-L1 bis X-L3 | CONTEXT §2 |
| Paddle live, falls der Preis im Reply steht | X-L1 (Reply) | ROADMAP §4 |
| Gründer-Account mit Profil: wer, was, Link auf unslop.codes, Hinweis „building unslop“ | alle | RESEARCH.md §7.1 |

## Empfohlener Zeitplan

**Phase A (ab HR-Eintrag, Warteliste live).** Ein substanzieller Post pro Werktag, nicht mehrere direkt hintereinander (Diversity-Decay, RESEARCH.md §3.1).

| Tag | Post | Warum dann |
|---|---|---|
| A+0 | **X-1** (Intro, angepinnt) | Beleg-Hook mit Film 01. Der erste Post setzt den Rahmen „private beta, build in public“ |
| A+1 | **X-6** (Frage, ohne Link) | Replies statt Reichweite. Echte Fälle liefern Material für Demo-Beispiele |
| A+2 | **X-2** (Build-Log #1, Roadmap) | Nach zwei Posts kennen Leser das Produkt, jetzt folgt „was läuft, was nicht“ |
| A+4 | **X-4** (Regenerate, Film 02 in 9:16) | A/B-Format gegen X-1 (16:9); zu vergleichen sind Views, Verweildauer und Bookmarks |
| A+6 | **X-5** (CLI-Output) | Produkt-Detail für die, die in X-2 gefragt haben |
| sobald W1 korrigiert ist | **X-3** (Selbstkorrektur 44×) | Nur mit bereits geänderter Landing |
| danach | alle 1–2 Wochen ein Build-Log (#2, #3 …) nach dem Muster von X-2 | Build-in-Public-Rhythmus |

**Uhrzeit (Heuristik, keine Quelle im Research):** Di bis Do, 15:00–17:00 MEZ (09:00–11:00 ET). Das ist die Überschneidung von EU-Nachmittag und US-Ostküsten-Vormittag, in der beide Dev-Zielgruppen wach sind. Nach zwei Wochen per X-Analytics prüfen und anpassen.

**Phase B (Launch-Tag L):** HN ist der Leit-Kanal des Tages (`../04-hackernews/LAUNCH.md`). X verstärkt, konkurriert aber nicht.

| Zeit | Aktion |
|---|---|
| L, 30 min nach dem Show-HN-Post | **X-L1** mit Film 03 (16:9) und Reply. Den Show-HN-Link nicht mit der Bitte um Upvotes teilen (HN-Guidelines); wenn überhaupt: „Discussion on HN“ ohne Aufforderung |
| L + 3 h | **X-L2** (How it works + Limits), als Reply auf die häufigsten Fragen aus HN und X |
| L + 7 Tage | **X-L3** (Roadmap nach dem Launch). Vorher im Status-Board den Stempel links von „Private beta“ auf „Live“ ändern (`visuals/stills.html`, Klasse `stamp soon` → `stamp live`, Text „Live“) und neu rendern |

## Ablauf am Posttag (jeder Hauptpost)

1. Post absetzen, sofort den ersten Reply aus `POSTS.md` darunter.
2. **Die ersten 60–90 Minuten am Rechner bleiben.** Replies zählen im Ranking 10× so viel wie Likes, Replies bei gegenseitigem Folgen noch mehr (RESEARCH.md §3.1).
3. Jede sachliche Frage von Hand beantworten, mit Vorlage aus `FAQ.md`. Keine KI-Replies, keine Auto-Replies (RESEARCH.md §1.2).
4. Nicht um Likes, Reposts oder Follows bitten. Keine Engagement-Gruppen, keine Zweit-Accounts (Authenticity-Policy, RESEARCH.md §1.1).
5. Nach 24 h notieren: Views, Replies, Bookmarks, Profilklicks, Waitlist-Eintragungen des Tages (aus `waitlist_signups`, nicht aus einem Tracking-Pixel).

## Wie wir in den ersten Stunden auf Kritik reagieren

- **Faktische Kritik an einer Zahl:** Paper, Seite und Einordnung nennen (FAQ 5). Liegt der Kritiker richtig: „You're right, fixing it“, dann korrigieren und den Fix im Thread verlinken. Cursors Preis-Entschuldigung (RESEARCH.md §4) ist das Muster, Masad vs. ThePrimeagen das Gegenbeispiel.
- **„LLM wrapper“, „AI grading AI“:** zugeben, was LLM ist, und den Unterschied konkret machen (FAQ 1–2). Nicht verteidigen, was nicht stimmt.
- **„When can I try it?“:** keinen Termin nennen, der nicht im Repo steht (FAQ 6).
- **Vergleiche mit CodeRabbit, Greptile oder Bugbot:** keine Wettbewerber-Zahlen, keine Abwertung. Beschreiben, was unslop tut (Reply-Baustein in `POSTS.md`).
- **Trolle und Pile-ons:** einmal sachlich antworten, dann nicht weiter. Kein Blockieren von Kritikern, die sachlich bleiben.

## Optional: Gründer-Video mit eigener Stimme

X-Produktchef Nikita Bier empfiehlt Originalvideos mit eigener Stimme (Aussage vom 12.04.2026, kein Code-Beleg; RESEARCH.md §3.3). Ein 60–90-Sekunden-Bildschirmvideo des Gründers ergänzt die Filme gut.

Skript:
1. „This is a handler an AI wrote. An LLM reviewer approved it.“ Code zeigen: den `catch`.
2. `unslop scan` im echten Terminal laufen lassen, gegen ein privates Testrepo (Beispieldaten, kein Kundencode).
3. Den Output kommentieren: Regel-ID, Erklärung, Suggested fix, Integrity-Score und was er bedeutet (Konfidenz des Reviews, nicht Code-Qualität).
4. „Private beta. What's next is in the pinned thread.“

Kein Schnitt, der Geschwindigkeit vortäuscht. Wenn geschnitten wird, steht im Post, dass geschnitten wurde (motion-design SKILL §0: „Captions must stay true“).
