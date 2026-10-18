# docs/legal/

Die Rechtstexte liegen seit dem Bau der Seiten (LEGAL_PAGES_SPEC.md §5.3) unter `src/content/legal/{slug}.{locale}.md` und werden von dort gerendert — eine Quelle, die Luca freigibt und die live geht. Status, Entscheidungen, Vorbedingungen und Platzhalter: `docs/specs/LEGAL_PAGES_SPEC.md`; Quellen: `docs/research/legal-pages-research-2026.md`.

| Slug | Deutsch | Englisch | Route |
|---|---|---|---|
| `impressum` | Impressum | Legal Notice | `/{locale}/impressum` |
| `privacy` | Datenschutzerklärung | Privacy Policy | `/{locale}/privacy` |
| `terms` | Nutzungsbedingungen | Terms of Service | `/{locale}/terms` |
| `refund` | Erstattungsrichtlinie | Refund Policy | `/{locale}/refund` |
| `dpa` | Auftragsverarbeitungsvertrag | Data Processing Agreement | `/{locale}/dpa` |

Konventionen: `[IN ECKIGEN KLAMMERN]` sind offene Werte, `[VORBEDINGUNG …]` Dinge, die vor Veröffentlichung gebaut sein müssen. Der Platzhalter-Guard (`src/lib/legal/placeholders.ts`) lässt keine Seite mit einem solchen Marker live gehen.
