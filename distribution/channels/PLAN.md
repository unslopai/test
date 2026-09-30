# PLAN: Reihenfolge der fünf Kanäle

Stand 2026-09-29. Grundlage ist `CONTEXT.md`: Heute ist nur die Landing Page öffentlich nutzbar.

## Bottom Line

**Reihenfolge der Bearbeitung und der Veröffentlichung: X → LinkedIn → Reddit → Hacker News → Product Hunt.**

- **X und LinkedIn tragen mit dem heutigen Produktstand am meisten.** Sie brauchen kein ausprobierbares Produkt. Sie funktionieren mit Forschung, echten Produktstrings und Roadmap, und die Warteliste reicht als CTA.
- **Reddit ist nur teilweise nutzbar.** Wertorientierte Posts ohne Link gehen früh. Produkt-Posts sind in den relevanten Subreddits erst sinnvoll, wenn man es installieren kann.
- **Hacker News (Show HN) und Product Hunt sind blockiert, bis das Produkt ohne Hürde ausprobierbar ist.** Sie kommen zuletzt, damit die Einwände aus X, LinkedIn und Reddit schon in FAQ und Texten stecken.

## Eine harte Voraussetzung für alle fünf Kanäle

**Kein Post vor dem HR-Eintrag.** Dafür gibt es drei Gründe:

| # | Grund | Quelle |
|---|---|---|
| 1 | Gründerentscheidung: „nichts Öffentliches vor dem HR-Eintrag“ | `WAITLIST_SPEC.md:4` |
| 2 | Jeder Post schickt Traffic auf eine geschäftsmäßige Seite ohne Impressum und Datenschutzerklärung. `/en/impressum` und `/en/privacy` liefern heute 404 | `CONTEXT.md` §2 |
| 3 | Der einzige sinnvolle CTA vor dem Launch ist die Warteliste, und die geht erst mit dem HR-Eintrag live | `WAITLIST_SPEC.md` §7 |

Laut Fristenkalender ist der Eintrag vorläufig für den 05.11.2026 angesetzt; das ist ein Platzhalter (`docs/company/fristenkalender.md`).

## Die drei Phasen, entlang derer die Kanäle geplant sind

| Phase | Was live ist | Kanäle |
|---|---|---|
| **A: HR-Eintrag → Launch** („private beta“) | Landing, Impressum, Datenschutz, Warteliste | X (Build in Public, Forschung, Filme 01/02), LinkedIn (CTO-Posts EN + DE), Reddit (1–2 Diskussionsposts ohne Produktlink, nur in Subreddits, die das erlauben) |
| **B: Launch-Tag L** | Signup offen, `@unslopcodes/cli` und `@unslopcodes/mcp` auf npm, Extension im Marketplace, Paddle live | Hacker News (Show HN am Tag L), X-Launch-Thread und Film 03, LinkedIn-Launch-Post, Reddit an den Showoff-Tagen der Subreddits |
| **C: L + 1–3 Wochen** | wie B, plus erste echte Nutzung | Product Hunt (mit Roadmap-Sektion), Rückblick auf X und LinkedIn |

## Bewertung je Kanal

Kriterien laut Auftrag:
1. Nutzen mit dem heutigen Produktstand
2. Was muss live sein, das es heute nicht ist?
3. Eignung, die Roadmap zu erzählen

| Kanal | Nutzen heute (Phase A) | Braucht, was nicht live ist | Roadmap-Eignung | Entscheidung |
|---|---|---|---|---|
| **X** | Hoch. Die Dev-Zielgruppe ist dort, Build in Public ist eine etablierte Form, und die 9:16-Filme 01/02 laufen dort ohne Umbau. Kein ausprobierbares Produkt nötig | Warteliste (Phase A). Film 03 erst nach npm-Publish | **Hoch.** Build-in-Public-Threads sind der natürliche Ort für „what we're building next“ | **1.** Erster Kanal |
| **LinkedIn** | Hoch für die CTO-Zielgruppe. Quality Gates, messbare Integrität und Audit-Zertifikate sind Themen, die dort als Fach-Post laufen. Der Gründer hat ein DACH-Netzwerk | Warteliste (Phase A) | **Sehr hoch.** Die Roadmap (Zertifikat, Score über die Zeit, Cross-Vendor) ist für CTOs der Kern der Geschichte, als Ausblick gekennzeichnet | **2.** |
| **Reddit** | Mittel. Wertorientierte Diskussionsposts (Studien, „how do you review AI PRs?“) funktionieren ohne Produkt. Werbung wird abgestraft, Accounts brauchen Historie | Produkt-Posts erst an Launch-Tag L | Niedrig. Roadmap-Posts gelten dort schnell als Werbung | **3.** Vorbereitet, **teilweise blockiert** (Produkt-Posts erst ab L) |
| **Hacker News** | Heute null. Show HN ist für Dinge, die man ausprobieren kann; Warteliste und Anmeldeseite sind ausdrücklich nicht erlaubt | Signup offen, CLI auf npm, möglichst ein Weg ohne Login | Niedrig bis mittel: im Maker-Kommentar ein Absatz „what's next“, mehr nicht | **4.** Vorbereitet, **blockiert** bis L |
| **Product Hunt** | Heute null. Ein Launch braucht ein nutzbares Produkt, Preise und Galerie | Alles aus HN, plus Paddle live, Preise öffentlich, Onboarding ohne Operator | **Hoch.** Maker-Kommentar und Galerie haben Platz für eine Roadmap-Sektion | **5.** Vorbereitet, **blockiert** bis L, empfohlen L + 1–3 Wochen |

## Warum nicht Hacker News zuerst?

HN ist für ein Dev-Tool der wertvollste Einzelkanal, und genau deshalb kommt es nicht zuerst:

1. **Die Regeln schließen es heute aus.** Die Show-HN-Guidelines sagen „If your work isn't ready for users to try out, please don't do a Show HN. Once it's ready, come back and do it then.“ und „Don't post landing pages“. Sie verlangen außerdem, es „ideally without barriers such as signups or emails“ testbar zu machen (https://news.ycombinator.com/showhn.html, abgerufen 2026-09-29). Ein verfrühter Post lässt sich nicht löschen und neu einstellen („Please don't delete and repost“, newsguidelines.html). Die Details zu Wiedervorlagen stehen in `04-hackernews/RESEARCH.md`.
2. **Die schärfsten Einwände kennen wir erst aus X, LinkedIn und Reddit** („Isn't this just an LLM wrapper?“, „44× is from one exploratory run“). `CONTEXT.md` §6 zeigt, dass die Landing heute mehrere Aussagen trägt, die ein HN-Leser mit dem Paper in der Hand widerlegt (W1, W3, W4). Bevor HN kommt, muss die Landing ehrlich sein. Das steht als To-Do in `ROADMAP.md` §10.

## Was vor dem ersten Post live sein muss

| Voraussetzung | Für |
|---|---|
| HR-Eintrag | alle |
| Impressum und Datenschutz live (`NEXT_PUBLIC_LEGAL_PAGES_LIVE=impressum,privacy`) | alle |
| Warteliste live (`NEXT_PUBLIC_WAITLIST_LIVE=true`, Brevo-Env in Vercel, `news.unslop.codes` authentifiziert) | X, LinkedIn, Reddit in Phase A |
| Landing-Korrekturen W1–W5 und W8–W11 (`CONTEXT.md` §6), mindestens: Hero-Zeile, „re-checks every revision“, „verdicts no LLM votes on“, Verdict-Tabelle | Voraussetzung für HN, dringend empfohlen für alle. Im Repo als To-Do eingetragen, nicht selbst gefixt |
| Signup offen, npm-Publish, Marketplace, Paddle live | HN, Product Hunt, Film 03, jeder „try it“-CTA |
| Eigene Accounts der Macher (X, LinkedIn, Reddit mit Historie, HN, Product Hunt) | pro Kanal, siehe jeweiliges `LAUNCH.md` |

Den Status je Kanal, die Assets und den nächsten Schritt für den Gründer zeigt `README.md`.
