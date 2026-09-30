# POSTS: Product Hunt

> **Maker-Kommentar und alle Antworten schreibt der Gründer selbst.** PH: „Product Hunt is about person-to-person interactions … No LLMs or Chrome extensions please!“ Außerdem filtert PH „AI-generated actions“ aus den Punkten (RESEARCH.md §1.6, §5).
>
> Name, Tagline, Beschreibung und Galerie sind Produktdaten und können so übernommen werden. Für den Maker-Kommentar gibt es hier nur Gliederung und Referenz.

**Status:** blockiert bis L (BRIEF.md). Alle Angaben gelten für den Zustand nach dem Launch.

---

## Name und Slug

- **Name:** `unslop` (PH: „Only the product's name, no description“)
- **Slug:** `unslop-codes`. `/products/unslop` gehört theunslop.app, `/products/unslop-news` gehört unslop.news (RESEARCH.md §3). Vor dem Anlegen prüfen.
- **Website:** https://unslop.codes

## Tagline (max. 60 Zeichen, gezählt)

| # | Tagline | Zeichen | Bewertung |
|---|---|---|---|
| 1 | PR checks for AI-written code: rule IDs and 1-click fixes | 57 | **Empfehlung:** Features statt Nutzen (RESEARCH.md §5), sagt, wo es läuft und was man bekommt |
| 2 | A review gate for AI-written code, with rule IDs and fixes | 58 | gut, etwas abstrakter |
| 3 | Rule IDs and 1-click fixes for AI-written pull requests | 55 | gut |
| 4 | 119 research-backed rules for AI-written pull requests | 54 | stark für Evidenz-Leser, sagt aber nicht, was passiert |
| 5 | Catch what your AI reviewer waves through | 41 | **nicht verwenden:** Nutzenversprechen, impliziert einen unbelegten Vergleich |

## Beschreibung (≤ 260 Zeichen, gültig unter beiden PH-Limits)

```post
A GitHub check, CLI, VS Code extension and MCP server for AI-written code. 119 rules from published research, 55 of them deterministic. Only critical findings fail the check; each finding names its rule and shows how it was verified.
```

## Pflichtfelder

| Feld | Wert | Vorbedingung |
|---|---|---|
| Preis | „Paid (with a free trial or plan)“ | Paddle live, Trial aktiv. Die Kartenpflicht im Maker-Kommentar nennen |
| Promo-Code (optional) | z. B. verlängerter Trial für PH | Nur wenn Paddle ihn abbilden kann. Nicht versprechen, bevor es eingerichtet ist |
| Launch-Tags (max. 3) | Developer Tools, GitHub, Artificial Intelligence | Tag-Namen am Formular prüfen |
| Galerie | `visuals/ph-01` … `ph-06`, optional `ph-07-roadmap.png` als letzte Folie | Bild 1 und 3 möglichst durch echte Screenshots aus dem Demo-Repo ersetzen (BRIEF.md) |
| Thumbnail | `visuals/ph-thumbnail.png` (240×240) | – |
| Video (optional) | YouTube-Upload von Film 03 (16:9) oder der Terminal-Demo | vom Gründer hochzuladen; öffentlich oder „nicht gelistet“, nicht privat |

## Maker-Kommentar: Gliederung (RESEARCH.md §7.8)

1. Wer schreibt: echte Namen, kleines Team in Deutschland.
2. Das Problem in einem Satz, aus eigener Erfahrung.
3. Was unslop tut: GitHub-Check und Review-Kommentare, CLI, VS Code, MCP.
4. Wie es entscheidet: 55 deterministische Detektoren, der Rest über einen LLM-Reviewer mit Blind-Pass auf der Standard-Route, Status pro Befund, nur Critical lässt den Check scheitern.
5. **Grenzen:** LLM nur für JS/TS; Draft und Verifier dieselbe Modellfamilie (Gemini, Vertex AI EU); kein Revisionsvergleich.
6. Preis und Trial im Klartext: €29/Monat, 500 Scans, 14 Tage, Karte nötig oder nicht (je nach Stand).
7. **What's next (planned, not built)**, höchstens drei Punkte im Wortlaut aus CONTEXT §5.
8. Eine konkrete Frage. **Kein Wort über Upvotes.**

## Maker-Kommentar: Referenz (nicht kopieren, selbst schreiben)

    Hi, I'm [Name], one of the people building unslop in Germany.

    [Ein Satz eigene Erfahrung: welcher KI-geschriebene Fehler uns selbst durchgerutscht ist.]

    unslop checks pull requests that contain AI-written code. It runs as a GitHub check,
    and the same engine is available as a CLI (unslop scan), a VS Code extension and an
    MCP server for coding agents.

    How it decides: 55 of our 119 rules have deterministic detectors, no model involved.
    The rest are checked by an LLM reviewer (JS/TS only for now), and on the standard route
    a second, blind call re-checks each claim. Every finding says how it was verified.
    Only critical findings fail the check; warnings stay comments.

    Limits: both the reviewer and the verifier are Google models, so the verification is
    blind but not from a different vendor. It reviews each push on its own and doesn't
    compare revisions yet. Nothing catches everything.

    Pricing: €29/month, 500 scans, 14-day trial [with / without card].

    What's next (planned, not built, no dates):
    - failing a check when a push makes things worse than the previous one
    - an integrity trend per repository
    - a second model vendor as verifier

    Question for you: which failure pattern in AI-written code would you want us to catch
    that we don't yet?

## Outreach am Launch-Tag (nur diese Form)

Erlaubt ist „ask them to visit and comment“ (RESEARCH.md §1.4). **Nie** „upvote“ oder „support us“, keine Massen-DMs, keine Vote-Services.

```post
We're live on Product Hunt today with unslop, PR checks for AI-written code. Questions and criticism welcome in the thread: [Link]
```

Für X und LinkedIn: dieselbe Aussage in eigener Formulierung, ohne Aufforderung zum Voten. Die Warteliste bekommt eine Launch-Mail (WAITLIST_SPEC §8 Phase 1b, „≤ 5 Mails bis Launch“). Die PH-Erwähnung dort ist optional und ohne Vote-Bitte.
