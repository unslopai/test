# BRIEF: Hacker News

## Status: **blockiert**

Heute ist keine Show HN möglich und keine erlaubt. Vier Gründe:

| Grund | Beleg |
|---|---|
| Nichts ist ohne Hürde ausprobierbar: Signup gesperrt, CLI nicht auf npm | CONTEXT §2 |
| „If your work isn't ready for users to try out, please don't do a Show HN.“; „Waitlists are against the Show HN rules“ | RESEARCH.md §1.2, §1.5 |
| Neue Accounts ohne HN-Historie sehen seit März 2026 die Sperre `showlim` | RESEARCH.md §1.5 |
| Die Landing trägt heute die 44×-Zeile, die HN mit dem Paper in der Hand zerlegt | CONTEXT W1; RESEARCH.md §8.4 |

**Was fehlt**, in der Reihenfolge der Wirkung:
1. **Ein Weg, unslop ohne unslop-Konto auszuprobieren.** Mindestens ein öffentliches Demo-Repo mit echten PRs, auf denen Check Run und Review-Kommentare sichtbar sind. Besser zusätzlich eine CLI, die die 55 deterministischen Detektoren lokal ohne Login laufen lässt. Das ist ROADMAP §1 „v2: CLI-lokaler Prescan“, als To-Do eingetragen.
2. Signup offen, `@unslopcodes/cli` auf npm, Preis und Trial-Bedingungen öffentlich.
3. Landing-Korrekturen W1–W5 und W8–W11 (ROADMAP §10).
4. Ein HN-Account des Gründers mit wochenlanger echter Kommentarhistorie. Der Username darf nicht „unslop“ lauten, und im Profil steht eine E-Mail-Adresse (dang-Tipps, RESEARCH.md §1.4).

## Zielgruppe

Erfahrene Entwickler und Gründer, einige CTOs.
- Sie glauben schon, dass KI-Reviewer oft Rauschen sind („pure noise“, ~12 % Präzision bei einem Tool, von einem Leser gemessen).
- Sie halten serverseitige GitHub-Apps nach dem CodeRabbit-Exploit (687 Punkte) für ein Sicherheitsrisiko.
- Sie fragen bei LLM-as-judge nach der Modellfamilie (RESEARCH.md §4).

Sie lehnen Marketing-Sprache, unbelegte Zahlen, Signup-Wände, KI-geschriebenen Text und Booster-Kommentare ab (§6).

## Kernwinkel (einer)

**„Ein PR-Check, der offenlegt, welcher Teil seines Urteils deterministisch ist und welcher von einem LLM kommt, mit Regel-ID und Studienquelle pro Befund.“**

Warum gerade das auf HN trägt:
- **Es nimmt die Skepsis auf, statt gegen sie zu argumentieren.** „AI reviewers are noise“ und „nondeterministic in CI?“ sind die erwartbaren Top-Kommentare (§4, §8.10). Die ehrliche Aufteilung (55 deterministisch, Rest LLM mit Blind-Verifier, nur Critical blockiert) *ist* die Antwort.
- **Belegte Zahlen werden belohnt, überdehnte zerlegt.** Forge bekam 687 Punkte mit reproduzierbaren Zahlen; adamsreview und Mcp2cli wurden wegen ungemessener Behauptungen zerlegt (§3). Deshalb enthält der Post keine eigenen Erfolgsquoten und keine 44×-Zahl. Er enthält höchstens C1 (1.80×) als Motivation, mit Quelle.
- **Der Name trägt nicht.** „unslop“ ist auf HN schon mit unslop.news (198 Punkte) und unslop.run (244 Punkte) verbunden, beide Anti-KI-Filter (§3). Der Titel muss sagen, was das Produkt tut.

## Wie viel Roadmap verträgt HN

**Fast keine.** Im Post steht höchstens ein Satz „Not built yet: …“ bei den Grenzen, und zwar zum Revisionsvergleich, weil er die naheliegende Frage beantwortet. Kein Zertifikat, keine Team-Pläne, keine Termine. Auf Nachfrage in den Kommentaren gilt CONTEXT §5.

## Eine Regel, die für diesen Kanal alles ändert

dang, 28.03.2026: „**Write your text by hand. Don't use an LLM to generate any of it (not even a tiny bit, including to edit or spruce it up).**“ (RESEARCH.md §1.4). Die Meta-Diskussion dazu hat 4.229 Punkte.

**Konsequenz:**
- Die Texte in `POSTS.md` sind **kein** Post zum Kopieren. Sie sind Faktenblatt, Gliederung und ein **Referenztext**, gegen den der Gründer seinen eigenen, von Hand geschriebenen Text prüft: Stimmen die Fakten, fehlt eine Grenze?
- Den Referenztext zu posten, auch umformuliert, verstößt gegen die Regel und schadet der Positionierung eines Anti-Slop-Produkts direkt.

## Gründerentscheidung, die dieser Kanal braucht

**Regelliste öffentlich machen?** Die Recherche empfiehlt, die Liste der Regeln mit Paper-Referenzen offenzulegen (§8.7). Das beantwortet „How did you decide on the patterns?“ und „Why closed source?“ zugleich.

Dagegen spricht die bisherige Linie im Repo: Regeltexte gelten als IP. Copy v2 hat das Blueprint-Vokabular entfernt (ROADMAP_ARCHIVE L375), und der Prompt enthält seit 2026-08-10 keinen Regel-Content mehr.

Möglicher Mittelweg: Regel-ID, Kategorie und Quellen-Paper öffentlich, Detektionslogik und Prompt-Texte nicht. Das entscheidet der Gründer. Die Texte hier behaupten keine öffentliche Liste.

## Assets

| Datei | Was | Status |
|---|---|---|
| `POSTS.md` | Titel-Varianten (≤ 80 Zeichen, geprüft), Faktenblatt, Gliederung, Referenztext (nicht zum Posten), Referenz für den ersten Maker-Kommentar | fertig, **blockiert** |
| `FAQ.md` | 12 erwartbare HN-Kritiken mit belegten Antworten, darunter „same model family?“, App-Rechte, „why closed“, „nondeterministic in CI“ | fertig |
| `LAUNCH.md` | Vorbedingungen, Zeitpunkt (So/Mo/Di/Do 15–17 UTC), Ablauf, keine Booster, kein Löschen und Neuposten | fertig |
| Medien | HN zeigt keine Medien. Die Zielseite bzw. das Demo-Repo-README sollte die Terminal-Demo (`../03-reddit/visuals/terminal-demo-launch.gif`) und einen echten PR-Check zeigen. Die Landing zu ändern ist App-Code und deshalb als To-Do eingetragen, nicht umgesetzt | vorhanden |
