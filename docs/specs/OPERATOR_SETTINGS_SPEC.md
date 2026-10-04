# SPEC: Operator-Gate für Pipeline-Settings (De-Leak, Härtung, Webhook-Umzug)

Status: **Freigegeben & implementiert 2026-08-08** (Freigabe mündlich „look over then start implementing"; Umsetzungs-Receipts in ROADMAP „Implemented §3"). Offen: nur die Rollout-Handgriffe V5/V6/V8 (Operator-Env in Vercel, Live-Pass, SQL-Diff).
Bezug: ROADMAP §1b (Rule-Matrix), §6 (CLI Friction Tooling), i18n_Spec §6, Copy v2 (IP-De-Leak), MCP_SPEC Phase 3 (Dismissals).

---

## 1. Kontext (Ist-Zustand, Code-verifiziert 2026-08-08)

Die Seite `/dashboard/repos/[id]/settings` ist heute für **jeden Repo-Owner** erreichbar und rendert vier Sektionen (`SettingsClient.tsx`): Webhook-Integration, Pipeline-Steps, Smart Detection, Conditions. Befunde der Codebase-Untersuchung:

1. **IP-Leak.** Die Step-Labels und -Beschreibungen in `messages/{en,de}.json` (en.json:81–158) nennen „Deterministic Pre-Scanner (AST/linter — without LLM tokens)", „Complexity Router", „Claim Verifier", „Escalation Reviewer", „Integrity Scorer" — exakt das Blueprint-Vokabular, das Copy v2 aus Marketing UND Dashboard-Scan-Steps entfernt hat. Zusätzlich: next-intl liefert die Kataloge ins Client-Bundle — die Strings sind für **jeden** Kunden im JS-Payload lesbar, unabhängig davon, ob die Seite verlinkt ist.
2. **Freeze-Semantik.** `repositories.pipeline_config` ist eine Allowlist: `worker.ts` `assembleSteps` (:88–95) führt nur gelistete Steps aus; NULL ⇒ `DEFAULT_PIPELINE_CONFIG`. Ein Kunde, der einmal speichert, pinnt sein Repo dauerhaft auf den Pipeline-Stand des Speicherzeitpunkts — künftig gelieferte Steps laufen dort nie. **Live-Stand: 3 von 4 Repos (3 User) haben bereits persistierte Configs**; eine davon (`unslopai/test`) ist gewollt (Pre-Scanner aus, geparkter OOM, ROADMAP §1b).
3. **Latente API-Bugs** (`api/repos/[id]/settings/route.ts`):
   - PUT parst den Body ohne try/catch — ungültiges JSON wird ein Framework-500 statt 400.
   - Das UPDATE (:76–84) hat kein `.select()`: ein PUT auf ein fremdes/nicht existentes Repo matcht 0 Zeilen, `updateError` bleibt null → **200 `{success:true}` ohne Schreibvorgang** (GET 404t im selben Fall korrekt).
   - Server erzwingt keine Pflicht-Steps (`enabledStepIds: []` wird akzeptiert); die „Required"-Badges sind reine UI.
4. **Reset-Footgun.** Der Reset-Button setzt Client-State auf `DEFAULT_PIPELINE_CONFIG` (alle Steps AN) und verwirft dabei `cascade`/`prescan`-Blöcke aus dem State. Reset + Save auf `unslopai/test` würde den Pre-Scanner reaktivieren → **der geparkte Produktions-OOM wäre mit zwei Klicks zurück**.
5. **Kein Rollen-Primitive.** Es existiert nirgends ein Operator/Admin-Konzept; jede Authz reduziert sich auf `repositories.user_id = auth.uid`. `billing_account_members.role` wird geschrieben ('owner'), nie gelesen. Dieses Feature führt das erste Authz-Primitive ein.
6. **Kundennutzen-Kollateral.** Die Webhook-Sektion (Health-Check + Repair via `/api/repos/[id]/webhook-health`) ist echte Kunden-Selbsthilfe für Legacy-OAuth-Repos — bricht deren Hook, bleiben Scans still aus. Sie darf mit der Seite nicht verschwinden.
7. **Unverändert relevant:** CLI-Jobs ignorieren `enabledStepIds` komplett (`CLI_PIPELINE_STEPS` hartkodiert, worker.ts:68–80, :161) und honorieren nur Conditions/Override; `result-persister` wird immer angehängt; `resolveCascadeConfig`/`resolvePrescanConfig` degradieren feldweise.

## 2. Entscheidungen (Interview 2026-08-08)

| # | Entscheidung | Begründung |
|---|---|---|
| D1 | **Kunden verlieren die Settings-Seite vollständig** (kein Link, keine Seite, keine API). | Kein Architektur-Leak, kein Freeze-Footgun; kein Kunde hat danach gefragt. |
| D2 | **Operator-Gate via Env-Allowlist `OPERATOR_USER_IDS`** (kommagetrennte Supabase-User-UUIDs, serverseitig geprüft). | Kein Schema-Change, passt zur Ein-Operator-Realität, Muster analog `CRON_SECRET`. DB-Rollen erst mit Teams & Orgs. |
| D3 | **Allowlist-/Freeze-Semantik bleibt unverändert**; die 3 persistierten Zeilen bleiben unangetastet. | Operator-only entschärft den Footgun zum dokumentierten Werkzeug; `unslopai/test` behält Pre-Scanner-off. Deny-List-Umbau = Migrationrisiko ohne Not. |
| D4 | **404 überall** für Nicht-Operatoren (GET/PUT/Seite). | Die Oberfläche bleibt unsichtbar — konsistent mit der De-Leak-Linie. Debug-Kosten (Env-Tippfehler sieht aus wie fehlende Route) bewusst akzeptiert. |
| D5 | **i18n-Strip**: Settings-Namespace fliegt aus beiden Katalogen; die Operator-Seite wird hartkodiert englisch. | Schließt den Bundle-Leak vollständig. Dokumentierte Ausnahme von der Katalog-Pflicht: interne Fläche, keine User-facing UI-Copy (i18n_Spec §6). |
| D6 | **ROADMAP §6 „CLI Friction Tooling" wird gestrichen** — `pipeline_config` ist operator-only über ALLE Oberflächen (Dashboard, CLI, künftige MCP). | Eine Authz-Story statt zwei widersprüchlicher Zugriffsmodelle auf dieselbe Spalte; konsistent mit dem Friction-Slider-Beschluss. |
| D7 | **ROADMAP §1b „Dashboard-Rule-Matrix" wird als User-Feature gestrichen**; `ruleOverrides` bleibt handeditiertes Operator-JSON. | Kundenseitiger Widerspruch gegen Findings läuft über MCP Phase 3 (per-Finding-Dismissals + Suppression-Ledger) — auditierbar statt Regel-Abschalten. |
| D8 | **Webhook-Health/Repair zieht in die Repo-Zeile des Dashboards um** (nur Legacy-OAuth-Repos). | Kunden-Selbsthilfe bleibt erhalten, ohne Settings-Seite. App-Repos haben keinen Repo-Hook — dort wäre die Sektion eine falsche Affordance. |
| D9 | **API-Härtung: beide Bugs fixen, permissiv bleiben.** Ungültiges JSON → 400; No-Op-UPDATE → 404. Keine serverseitige Pflicht-Step-Erzwingung. | MAINT-001 (kein stiller Erfolg ohne Schreibvorgang). Ein Operator-Werkzeug SOLL degradierte Pipelines erlauben (genau der `unslopai/test`-Anwendungsfall). |
| D10 | **Reset = „Zurück zum letzten gespeicherten Stand"** (GET-Snapshot restaurieren, inkl. `cascade`/`prescan`-Blöcke), nicht Factory-Default. | Beseitigt den Zwei-Klick-Weg zurück in den OOM. Factory-Reset wäre ein separater, bewusster Knopf — nicht in diesem Scope. |
| D11 | **Receipts: Route-Tests + Operator-Live-Pass + Bundle-Grep** (kein Zweit-Account-E2E). | Die Nicht-Operator-Pfade beweisen Route-Tests mit gemockter Session; die Env-Verdrahtung beweist der Live-Pass des Operators. |
| D12 | **Spec als eigene Datei** (diese), SPEC.md bleibt unangetastet. | SPEC.md ist die freigegebene Cascade-Spec — Überschreiben wäre Zerstörung eines approbierten Dokuments. |

## 3. Architektur

### 3.1 Operator-Primitive — `src/lib/operator.ts` (neu)

```ts
export function isOperatorUser(userId: string): boolean
```

- Parst `process.env.OPERATOR_USER_IDS` (kommagetrennt, Whitespace-tolerant, leere Einträge ignoriert) **pro Aufruf** (wie `resolvePlanEntitlements` — kein Modul-Cache, Env bleibt zur Laufzeit wechselbar in Tests).
- **Fail-closed:** Env fehlt/leer ⇒ `false` für jeden — auch für den Operator. Ein vergessener Env-Eintrag sperrt den Operator sichtbar aus (er merkt es sofort), statt die Fläche offen zu lassen.
- Reine Funktion, kein DB-Zugriff, unit-getestet. KEINE Wiederverwendung von `billing_accounts.kind` oder `status='complimentary'` (Billing ≠ Authz).

### 3.2 Gates (alle serverseitig)

| Fläche | Gate |
|---|---|
| `dashboard/repos/[id]/settings/page.tsx` | Nach Session-Check: `!isOperatorUser(user.id)` ⇒ `notFound()` (vor dem Repo-Lookup — spart die Query, und Nicht-Operator vs. Nicht-Owner sind ununterscheidbar 404). |
| `GET /api/repos/[id]/settings` | Nach 401-Check: Nicht-Operator ⇒ `404 { error: 'Repository nicht gefunden.' }` — **byte-gleich** zur Nicht-Owner-Antwort, keine Unterscheidbarkeit. |
| `PUT /api/repos/[id]/settings` | identisch; Reihenfolge: 401 → Operator-404 → Body-Parse-400 → Validierung-400 → UPDATE. |
| Dashboard-Zahnrad (`DashboardClient.tsx:266–277`) | `dashboard/page.tsx` (Server Component) ermittelt `isOperator` und übergibt es als Prop; das Zahnrad rendert nur bei `true`. Der Boolean verrät clientseitig nichts Verwertbares (die Strings sind gestrippt, die Routen 404en). |

### 3.3 API-Härtung (D9)

- `request.json()` in try/catch → `400 { error: 'Ungültiges JSON.' }` (Stil der Route beibehalten: deutsche Meldungen, interne Fläche).
- UPDATE bekommt `.select('id').single()`; kein Row-Match ⇒ `404 Repository nicht gefunden.` (identisch zu GET). DB-Fehler bleibt 500 [MAINT-001].
- Validator-Allowlist, stilles Filtern unbekannter Ids, `prescan`-Passthrough (Feld-Validierung liegt in `resolvePrescanConfig` beim Lesen) und `cascade`-Feldprüfung bleiben **unverändert**.
- Nachtrag 2026-09-30 (LANGUAGE_COVERAGE_SPEC §6.3): Der Validator übernimmt zusätzlich `reviewScope.llmExtensions` und speichert nur Endungen aus `GATED_LLM_EXTENSIONS` (`.py`, `.java`). Die Operator-Seite rendert kein Feld dafür und reicht den Block bei Save und Reset durch.

### 3.4 Operator-Seite (SettingsClient)

- **Reset** hält den letzten GET-/Save-Stand als Snapshot im State (`lastSavedConfig`) und restauriert **diesen** — inklusive der `cascade`/`prescan`-Blöcke, die die 3-Feld-UI nicht rendert. Save aktualisiert den Snapshot aus der Server-Antwort.
- Alle sichtbaren Strings werden **hartkodiert englisch** (D5); `useTranslations`-Bezüge der Seite entfallen. Webhook-Sektion wird entfernt (zieht um, §3.5).
- Sonst keine Verhaltensänderung: Step-Toggles (2 echte + Required-Badges), Conditions, Smart-Override, kanonische Re-Sortierung bleiben.

### 3.5 Webhook-Umzug (D8)

- Die Webhook-Sektion wird als eigenständige Komponente extrahiert und in der **Repo-Zeile des Dashboards** gemountet (auf-/zuklappbare Aktion neben den bestehenden `RepoActions`).
- **Nur für Legacy-Repos** rendern (Kriterium: Repo läuft ohne App-Installation — das Dashboard-Datenmodell muss den Modus liefern; falls es das Feld noch nicht führt, wird es der bestehenden Repo-Query hinzugefügt [DATA-001: explizite Spalten]).
- Strings bleiben/werden **i18n EN/DE** (kundenseitige Fläche — Katalog-Pflicht gilt; die Webhook-Keys werden aus dem Settings-Namespace in einen Dashboard-Namespace verschoben, nicht gelöscht).
- Fetches behalten AbortController-Disziplin (Network-Race-Condition-Regel); `/api/repos/[id]/webhook-health` bleibt unverändert kunden-erreichbar (leakt nichts Architektonisches).

### 3.6 i18n-Strip (D5)

- Settings-Namespace (en.json:81–158 + de-Spiegel) und `dashboard.pipelineSettingsTooltip` werden aus **beiden** Katalogen entfernt (Parity-Test bleibt grün, `messages.d.ts`-Augmentation schrumpft automatisch mit).
- Receipt für den De-Leak: Grep über die gebauten Client-Chunks (`.next/`) auf Markerstrings („Claim Verifier", „Escalation Reviewer", „Complexity Router") — vorher Treffer, nachher keine.

### 3.7 Environment

- `OPERATOR_USER_IDS` → `.env.example` (dokumentiert: kommagetrennte Supabase-Auth-UUIDs; leer = Fläche für alle gesperrt) + Vercel-Prod-Env (Operator-Handgriff beim Rollout).

## 4. Bewusst unverändert (Abgrenzung)

- **Freeze-/Allowlist-Semantik** des Workers (D3) — dokumentierte scharfe Kante des Operator-Werkzeugs.
- **CLI-Pipeline** bleibt hartkodiert (`CLI_PIPELINE_STEPS`), CLI honoriert weiterhin nur Conditions/Override.
- `ruleOverrides` bleibt handeditiertes JSON ohne UI (D7); `REFERENCE_PRACTICE_GATES` bleibt Code-Konstante.
- Keine serverseitige Pflicht-Step-Erzwingung (D9), kein Factory-Reset-Knopf (D10), kein RBAC/Teams-Rollenmodell (kommt mit Teams & Orgs, ROADMAP §4).

## 5. ROADMAP-Folgen (DOC-001, im Implementierungs-Commit)

1. Neuer Implemented-Eintrag mit Receipts (§6-Verifikation).
2. §6 „CLI Friction Tooling" streichen mit Verweis auf D6.
3. §1b „Dashboard per-rule matrix" streichen mit Verweis auf D7 (MCP Phase 3 als Ersatzpfad).
4. §1b-Resume-Anleitung (Pre-Scanner via Dashboard-Toggle) bleibt gültig — Zusatz: Seite ist jetzt operator-gated, `OPERATOR_USER_IDS` muss gesetzt sein.
5. Neu entdeckte, hier gefixte Defekte (PUT-500, Silent-No-Op-200, Reset-Footgun) als erledigt dokumentieren.

## 6. Verifikationsplan (kein Receipt, kein „Done")

| # | Schritt | Receipt |
|---|---|---|
| V1 | `operator.test.ts`: Parsing (ein/mehrere/whitespace/leere Einträge), fail-closed bei fehlender/leerer Env | Vitest grün |
| V2 | Settings-Route-Tests (bestehende Suite + neu, Muster der Billing-Gate-Suites): Nicht-Operator GET/PUT → 404 byte-gleich zur Nicht-Owner-Antwort; Operator (Env enthält Mock-User) → bestehendes Verhalten; ungültiges JSON → 400; PUT auf fremdes Repo → 404 (kein stilles 200); bestehende Validator-Tests laufen mit gesetzter Operator-Env weiter | Vitest grün |
| V3 | Bundle-Leak-Grep: `npm run build`, Grep über Client-Chunks auf „Claim Verifier"/„Escalation Reviewer"/„Complexity Router" | Vorher-Treffer dokumentiert, nachher 0 Treffer |
| V4 | Voll-Regression `npm test && npm run lint && npx tsc --noEmit` | Alles grün |
| V5 | **Operator-Live-Pass (Prod, nach Setzen von `OPERATOR_USER_IDS` in Vercel):** Zahnrad sichtbar, Settings-Seite lädt, Save + Reset-auf-letzten-Stand funktionieren | Screenshot/Bestätigung + Job unbeeinträchtigt |
| V6 | Webhook-Sektion am Dashboard: Health-Check + Repair an einem Legacy-OAuth-Repo (Operator verbindet dafür ein Scratch-Repo über den OAuth-Connect-Pfad, da alle Operator-Repos App-Modus sind); App-Repo-Zeilen zeigen die Sektion nicht | Health-Response sichtbar, Repair-Roundtrip ok |
| V7 | Nicht-Operator-Live-Check (optional, D11): frischer Wegwerf-GitHub-Account ODER Verzicht — die 404-Pfade sind durch V2 belegt | optional |
| V8 | `unslopai/test`-Schutz: nach Rollout per MCP verifizieren, dass `pipeline_config` der 3 Bestandszeilen byte-identisch unverändert ist | SQL-Diff leer |

## 7. Out of Scope

Teams-/RBAC-Rollen, Factory-Reset, per-Rule-Matrix-UI, CLI-Threshold-Tuning (gestrichen, D6), Deny-List-Umbau der Config-Semantik, Änderungen an Worker-Step-Assembly oder Prescan-/Cascade-Resolvern.
