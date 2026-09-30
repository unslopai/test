# Release: CI und Publish

Drei Workflows unter `.github/workflows/`:

| Workflow | Auslöser | Was er tut |
|---|---|---|
| `ci.yml` | jeder PR, jeder Push nach `main` | `npm ci`, `npm run lint`, `npm test`, `npm run build` auf Node 24 (= Vercel-Runtime `24.x`) |
| `publish-npm.yml` | nur von Hand, Eingaben `package` (`cli`/`mcp`) und `dry-run` (Default `true`) | Tests des Pakets und von `@unslop/shared`, Build, `npm pack` als Artefakt, `npm publish --dry-run`; ohne Dry-Run veröffentlicht ein zweiter Job genau diesen Tarball mit `npm publish --provenance --access public` |
| `publish-extension.yml` | nur von Hand, Eingabe `dry-run` (Default `true`) | Extension-Tests, Build, `vsce package` als Artefakt `vsix`; ohne Dry-Run lädt ein zweiter Job genau diese `.vsix` mit `vsce publish` hoch |

Deploy macht weiter Vercel über die Git-Integration, es gibt keinen Deploy-Workflow.

## Build-Env in CI

`next build` lädt beim Schritt „Collecting page data“ die API-Routen, und `src/lib/supabase.ts` wirft beim Laden, wenn `NEXT_PUBLIC_SUPABASE_URL` oder `SUPABASE_SERVICE_ROLE_KEY` fehlt. `ci.yml` setzt deshalb nur im Build-Schritt zwei Platzhalter (`https://ci-placeholder.supabase.co`, `ci-placeholder-not-a-secret`). Mehr braucht der Build nicht: lokal im frischen Clone ohne `.env.local` lief er mit genau diesen zwei Werten durch (2026-09-30). Alle anderen `NEXT_PUBLIC_*`-Werte (`PADDLE_*`, `WAITLIST_LIVE`, `CLI_DISTRIBUTION_LIVE`, `LEGAL_PAGES_LIVE`) sind im CI-Build leer, die Flags also aus. Echte Secrets gehören nie in einen Workflow.

## Secrets und Environment

Die Publish-Jobs laufen im GitHub-Environment **`release`** und nur auf `main` (`if: … github.ref == 'refs/heads/main'`). Die Secrets gehören als **Environment-Secrets** in dieses Environment, nicht als Repository-Secrets: sonst könnte jeder Branch mit einer geänderten Workflow-Datei sie per `workflow_dispatch` lesen. Solange das Environment fehlt, legt GitHub es beim ersten echten Lauf ohne Schutzregeln und ohne Secrets an, und der Publish scheitert am fehlenden Token.

| Name | Wo anlegen | Rechte |
|---|---|---|
| `NPM_TOKEN` | npmjs.com → Access Tokens → Granular Access Token | Packages: **Read and write** mit direktem Publish (nicht „stage only“), nur Scope `@unslopcodes`; **Bypass 2FA** an, sonst scheitert der Publish, sobald für Konto oder Paket 2FA gilt; kurze Laufzeit (z. B. 7 Tage) |
| `VSCE_PAT` | dev.azure.com → User settings → Personal access tokens | Organization „All accessible organizations“, Scope **Marketplace → Manage**, kurze Laufzeit |

Zwei Fristen (Stand 2026-09-30):

- **npm** entfernt im **Januar 2027** das direkte Publish mit Granular Tokens ([npm-Doku](https://docs.npmjs.com/about-access-tokens)). Danach Trusted Publishing (OIDC): in den Paket-Settings auf npmjs.com `unslopai/unslop` + `publish-npm.yml` + Environment `release` eintragen, `NODE_AUTH_TOKEN` streichen; `id-token: write` steht schon im Job. Das Paket muss dafür schon existieren.
- **Azure DevOps** schaltet globale PATs („All accessible organizations“) am **01.12.2026** ab. Liegt der Launch danach, publiziert vsce über Microsoft Entra ID (`vsce publish --azure-credential` nach einem Azure-Login per OIDC) statt über `VSCE_PAT`.

## Vor dem ersten echten Lauf (Blocker)

Der Dry-Run läuft heute schon. Der echte Publish scheitert, solange diese Punkte offen sind (Stand 2026-09-30, ROADMAP §3 „CI/CD-Publishing“):

1. **Repo ist privat.** npm erzeugt `--provenance` nur für öffentliche Quell-Repos und bricht sonst ab. Entweder das Repo vorher öffentlich machen oder `--provenance` aus `publish-npm.yml` nehmen (dann ohne Herkunftsnachweis auf npm).
2. **`repository` fehlt** in `packages/cli/package.json` und `packages/mcp/package.json`. npm prüft beim Provenance-Publish, dass `repository.url` auf `github.com/unslopai/unslop` zeigt, und lehnt sonst mit E422 ab. Dasselbe Feld braucht später Trusted Publishing.
3. **Marketplace-Publisher `unslop`** (aus `packages/vscode-extension/package.json`) muss unter marketplace.visualstudio.com/manage existieren und zum Token gehören.
4. **Environment `release`** anlegen (Settings → Environments): Deployment branches nur `main`, optional Required reviewers; die beiden Secrets dort eintragen.

## Ablauf am Launch-Tag

1. Blocker oben erledigen, Version in der jeweiligen `package.json` setzen, PR mergen (CI grün).
2. Tokens anlegen (Tabelle oben) und als Secrets `NPM_TOKEN` und `VSCE_PAT` im Environment `release` eintragen.
3. **Dry-Run** (Branch `main`): Actions → *Publish npm package* → `package: cli`, `dry-run` angehakt → Log von `npm publish --dry-run` und das Artefakt `npm-cli` prüfen. Dasselbe für `mcp` und für *Publish VS Code extension*. Artefakte kommen als ZIP aus der Oberfläche: `vsix.zip` entpacken, dann `code --install-extension unslop-vscode.vsix`.
4. **Echter Lauf**: dieselben Workflows ohne Haken bei `dry-run`, erst `cli`, dann `mcp`, dann die Extension. Danach `npm view @unslopcodes/cli` bzw. die Marketplace-Seite prüfen.
5. In Vercel `NEXT_PUBLIC_CLI_DISTRIBUTION_LIVE=true` setzen (Production) und neu deployen, damit das Onboarding den Terminal-Weg anbietet.
6. Tokens widerrufen oder auslaufen lassen, ROADMAP-Chronik mit Run-IDs und Paketversionen nachtragen.
