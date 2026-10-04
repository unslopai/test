# WAITLIST_SPEC.md — Waitlist auf der Landing Page & E-Mail-Fundament

Status: **Freigegeben & implementiert 2026-09-22** (Interview 2026-09-22, 4 Entscheidungen; Provider-Research 2026-09-22, Quellen in §10). Code, Tests (1179 grün), Build und Brevo-Setup stehen; offen ist nur die Go-Live-Checkliste §7 (Migration 045, Vercel-Env, Flag am HR-Eintragungstag).
Kontext: ROADMAP §0 „blocked: incorporation" — Entscheidung Luca 2026-09-22: **nichts Öffentliches vor dem HR-Eintrag.** Die Waitlist wird deshalb jetzt gebaut und getestet, geht aber erst am Eintragungstag zusammen mit Impressum und Datenschutzerklärung live (§7).

## §1 Problem & Ziel

Die Landing Page führt heute mit „Install the GitHub App" auf `/login` — in ein Produkt, dessen CLI/Extension unpubliziert sind und dessen Billing nicht live ist. Bis zum Launch verpufft jeder Besucher. Gleichzeitig existiert im Repo **kein einziger E-Mail-Baustein** (kein Provider, kein Env-Eintrag, kein Template).

**Ziel:** Ein E-Mail-Feld als einziger CTA, das Interessenten rechtssicher (Double-Opt-In, § 7 UWG) in eine Liste bringt, und dabei den Provider anlegt, auf dem später Trial-Lifecycle, Monatsreport und Win-back laufen (§8).

## §2 Interview-Entscheidungen (bindend)

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Felder | **Nur E-Mail.** Rolle/Teamgröße/GitHub-Handle kommen später aus Login und Nutzung, nicht aus dem Formular. |
| 2 | Provider | Luca: „keine Ahnung, Research nötig; wenn du sagst Resend, okay." → Research §3 ergab **Brevo**, nicht Resend (Datenspeicherort). |
| 3 | Go-Live | **Feature-Flag.** Bauen, testen, verstecken; am HR-Eintragungstag Flag + Rechtsseiten gemeinsam scharf. Privat-Impressum bewusst verworfen (kein Einzelunternehmen, GRZ § 6, § 11 Abs. 2 GmbHG). |
| 4 | CTA | **Ersetzt „Get started" bis Launch.** Waitlist ist der einzige CTA in Hero und Closing-CTA; `/login` bleibt über die Nav erreichbar (Beta-Nutzer mit `complimentary`-Grant). |

## §3 Provider-Entscheidung: Brevo

Kriterien in dieser Reihenfolge: (1) Speicherort der Kontaktdaten, weil unslop seit 2026-09-17 mit garantierter EU-Verarbeitung wirbt und in Deutschland verkauft — **das ist das entscheidende Kriterium**; (2) Double-Opt-In ohne Eigenbau; (3) Sequenzen/Verzögerungen beim Provider — nur ein Vorteil bis zum Vercel-Pro-Upgrade nach der Gründung (danach gibt es Cron; Korrektur 2026-09-22 nach Rückfrage Luca); (4) kostenlos bis weit nach Launch; (5) transaktionale API für spätere Lifecycle-Mails.

Nicht nötig: Brevos „Lokalisierung"-Feature (Professional, 499 €/Monat) — Sprache wird in unserem Code entschieden (Template-ID pro Locale, §4.5). Einziger realistischer Upgrade-Pfad ist Starter (~9 €/Monat) gegen das Brevo-Logo im Footer.

| Provider | Speicherort | DOI eingebaut | Sequenzen ohne eigenen Cron | Free-Tier | Urteil |
|---|---|---|---|---|---|
| **Brevo** (Paris) | EU (FR/BE) | ja, `POST /v3/contacts/doubleOptinConfirmation` | ja (Automations, 2.000 Kontakte im Free) | 300 Mails/Tag, 100k Kontakte | **gewählt** |
| Resend | **USA, ohne EU-Option** — eigene Doku: „no setting today that moves stored data to the EU"; nur Versandregion wählbar | nein | nein (Broadcasts, keine Drips) | 3.000/Monat, 1.000 Kontakte | verworfen: US-Speicherung passt nicht zur EU-Story, DPF-Abhängigkeit |
| Loops | undokumentiert (DPA nennt nur „SCC oder Adequacy") | nein | ja | 4.000/30 Tage | verworfen: Speicherort unbekannt |
| Postmark | USA, EU nur als Zusatzprodukt | nein | nein | 100/Monat | verworfen |
| AhaSend / Lettermint / Scaleway (EU-nativ) | EU | nein | nein | 300–1.000/Monat | verworfen: nur transaktional, keine Listen |

Bekannte Nachteile von Brevo, bewusst akzeptiert: Marketing-Tool-Oberfläche statt Code-first, DOI- und Mail-Templates leben im Brevo-Editor statt im Repo, Brevo-Branding im Footer auf dem Free-Plan (Wechsel auf Starter ≈ 9 €/Monat, sobald es stört). Was im Repo bleibt: Route, Validierung, Tabelle, Copy des Formulars, Tests.

**Rechtlich:** Brevo ist Auftragsverarbeiter in der EU → Datenschutzerklärung nennt Brevo (Sendinblue GmbH / Brevo SAS) ohne Drittlandtransfer; DPA im Brevo-Account akzeptieren. DOI-Nachweis (Zeitstempel, IP der Bestätigung) hält Brevo, das ist der Beweis nach § 7 Abs. 2 Nr. 2 UWG.

## §4 Architektur

### 4.1 Flag & Zustände
`NEXT_PUBLIC_WAITLIST_LIVE === 'true'` (Muster von `NEXT_PUBLIC_CLI_DISTRIBUTION_LIVE`, ONBOARDING_SPEC Entscheidung 5). Genau ein Leseort: `src/lib/waitlist/waitlist-flag.ts` exportiert `isWaitlistLive()`; Server-Komponenten und Route importieren von dort.

| Phase | Flag | Landing-CTA | `POST /api/waitlist` |
|---|---|---|---|
| jetzt bis HR-Eintrag | unset | neutrale CTAs auf Seitenanker (`#exhibit`, `#findings`), kein Install-Versprechen; `/login` nur als „Log in“ für Bestandskonten (geändert 2026-09-30, CONTEXT.md §6 W8: Registrierung ist gesperrt) | 404 (fail-closed) |
| HR-Eintrag bis Launch | `true` | Waitlist-Formular in Hero + Closing-CTA | aktiv |
| Launch | unset | Install-CTA auf `/login` — **braucht einen eigenen Schalter**, weil das Waitlist-Flag „vor HR-Eintrag“ und „Launch“ nicht unterscheidet (ROADMAP §10, Landing-Folgepunkte a) | 404 |

### 4.2 Datenfluss
1. Client `WaitlistForm` → `POST /api/waitlist` mit `{ email, locale, website }` (`website` = Honeypot, muss leer sein).
2. Route: Flag prüfen → struktureller Parse ohne Zod (ARCH-002; Repo-Muster `github-webhook-payload.ts`, keine neue Abhängigkeit) → Honeypot gefüllt ⇒ 202 ohne Aktion → Rate-Limit (4.4) → Zeile in `waitlist_signups` (`status = 'pending'`) → Brevo-DOI-Call → **immer 202** `{ outcome: 'confirmation_sent' }`, auch bei bereits vorhandenem Kontakt (keine Mitgliedschafts-Enumeration). **Bekannte Adresse (Unique-Verstoß) bekommt die DOI-Mail trotzdem erneut** — verlorene Bestätigungsmails sind so ohne Support nachholbar; das Rate-Limit begrenzt den Missbrauch (Änderung gegenüber dem Entwurf: „kein zweiter Brevo-Call" gestrichen).
3. Brevo schickt die DOI-Mail (Template pro Locale). Klick → Kontakt landet in Liste „Waitlist" → Redirect auf `/{locale}/waitlist/confirmed`.
4. Bestätigungsstatus in unserer Tabelle: **Phase 2** über Brevo-Webhook `listAddition` (§8). In Phase 1 ist die Brevo-Liste die Wahrheit für „bestätigt", unsere Tabelle die Wahrheit für „hat sich eingetragen".

### 4.3 Schema — Migration `045_waitlist_signups.sql`
```sql
create table public.waitlist_signups (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  locale       text not null check (locale in ('en', 'de')),
  status       text not null default 'pending' check (status in ('pending', 'confirmed')),
  source       text not null default 'landing_hero' check (source in ('landing_hero', 'landing_closing')),
  ip_hash      text not null,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz
);
create unique index waitlist_signups_email_key on public.waitlist_signups (lower(email));
create index waitlist_signups_ip_hash_created_idx on public.waitlist_signups (ip_hash, created_at desc);
alter table public.waitlist_signups enable row level security;
revoke all on public.waitlist_signups from anon, authenticated;  -- Muster Migration 038: Service-Role only
```
Kein Client-Grant, kein Tenant-Bezug (keine `user_id`) — die Tabelle ist pre-Auth. Doppelte E-Mail ⇒ Unique-Verstoß wird gefangen und als Erfolg beantwortet (4.2), kein zweiter Brevo-Call.

Angewendet über den SQL-Editor, weil der Supabase-MCP damals nicht ging (SU-457471, behoben 2026-09-29). Live belegt 2026-09-29: `npx tsx scripts/db-query.ts waitlist_signups --count` ⇒ 0, die Tabelle existiert.

### 4.4 Rate-Limit ohne KV
`ip_hash = sha256(WAITLIST_IP_SALT + ':' + yyyy-mm-dd + ':' + ip)` — tagesrotierender Salt, damit der Hash nach 24 h nicht mehr verknüpfbar ist (Datensparsamkeit; die IP selbst wird nie gespeichert). Mehr als **5 Eintragungen pro Hash in 60 Minuten** ⇒ 429 mit `Retry-After`. Ein Count-Query mit expliziten Spalten (DATA-001), keine RPC nötig. IP aus `x-forwarded-for` (erstes Element) hinter Vercel; fehlt sie, Hash über `'unknown'` — dann gilt das Limit global, fail-closed statt offen.

### 4.5 Brevo-Client — `src/lib/waitlist/brevo.ts`
- Ein Aufruf: `requestDoubleOptIn({ email, locale })` → `POST https://api.brevo.com/v3/contacts/doubleOptinConfirmation` mit `email`, `templateId` (per Locale aus Env), `redirectionUrl` (`${APP_BASE_URL}/${locale}/waitlist/confirmed`), `includeListIds: [BREVO_WAITLIST_LIST_ID]`. Header `api-key`. `AbortSignal.timeout(8_000)`.
- Antwort strukturell geprüft; HTTP ≠ 2xx ⇒ `WaitlistProviderError` mit Status und Brevo-`code`, **kein** Swallowing (MAINT-001). „Contact already exists"-Antworten (Brevo-Code `duplicate_parameter`) werden als Erfolg gewertet — alles andere wirft.
- Kein SDK-Paket (`@getbrevo/brevo` zieht Axios und ist für einen Endpoint zu schwer); nativer `fetch`.

### 4.6 Env (`.env.example`)
```
# --- Waitlist (WAITLIST_SPEC.md) ---
# 'true' schaltet Formular + Route scharf. Erst am HR-Eintragungstag setzen (§7).
NEXT_PUBLIC_WAITLIST_LIVE=
BREVO_API_KEY=
BREVO_WAITLIST_LIST_ID=
BREVO_DOI_TEMPLATE_ID_EN=
BREVO_DOI_TEMPLATE_ID_DE=
# Geheimer Salt für den tagesrotierenden IP-Hash des Rate-Limits (4.4).
WAITLIST_IP_SALT=
```
Fehlt bei Flag `true` eine der Brevo-Variablen ⇒ Route 503 `waitlist_misconfigured` und strukturiertes Log; das Formular zeigt den generischen Fehlerzustand.

## §5 UI

- **`WaitlistForm`** (`'use client'`, `src/app/(marketing)/components/WaitlistForm.tsx`): ein `<input type="email" required>`, ein Button, versteckter Honeypot (`autocomplete="off"`, `tabIndex=-1`, visuell verborgen), Consent-Zeile unter dem Feld. Zustand als Union `'idle' | 'submitting' | 'sent' | 'error'`, ein `AbortController` pro Submit, Abbruch beim Unmount. Keine `useEffect`-Kaskade.
- Einbau: `HeroCtaRow` und `ClosingCta` rendern bei `isWaitlistLive()` das Formular statt der Link-Buttons; `source` unterscheidet Hero und Closing. Der Sekundär-Link „Read the evidence" bleibt im Hero.
- **Copy** in `messages/{en,de}.json` unter `marketing.waitlist` (Catalog-Parity-Test greift automatisch): `eyebrow`, `placeholder`, `button`, `consent` (mit Link auf `/{locale}/privacy`, locale-unabhängiger Slug, s. LEGAL_PAGES_SPEC E18), `sent` („Check your inbox — confirm the link and you're on the list."), `error`, `rateLimited`. Fact Discipline (MARKETING_CLAIMS §0): keine Launch-Datumszusage, keine Rabattzusage im Formular.
- **`/{locale}/waitlist/confirmed`**: statische Server-Seite im Marketing-Layout, ein Satz Dank, Link zur Evidenz-Sektion. Kein State, kein Fetch (die Bestätigung ist bei Brevo bereits passiert).
- Marketing-Nav behält „Sign in" → `/login`.

## §6 Tests (Vitest, THE LAW gilt auch hier)

| Test | Beweist |
|---|---|
| `waitlist/route.test.ts` | Flag unset ⇒ 404; ungültige E-Mail ⇒ 400; Honeypot gefüllt ⇒ 202 ohne DB/Brevo-Call; 6. Eintrag derselben IP in 60 min ⇒ 429; Brevo 5xx ⇒ 502 `waitlist_provider_error` + Log; Unique-Verstoß ⇒ 202 ohne zweiten Brevo-Call; fehlende Env bei Flag `true` ⇒ 503 |
| `brevo.test.ts` | Request-Shape (Pfad, Header, Body-Felder), Timeout-Signal, Duplicate-Code ⇒ ok, anderer Fehler ⇒ wirft |
| `landing-render.test.ts` (erweitert) | Flag `true` ⇒ Formular in Hero und Closing, keine Anker-CTA-Buttons; Flag unset ⇒ Anker-CTAs, kein Formular (seit 2026-09-30, W8) |
| `catalog-parity.test.ts` | EN/DE-Schlüssel identisch (bestehend) |

Live-Receipt vor dem Flag-Tag (ohne Öffentlichkeit): Formular in Preview-Deployment mit Vercel-Passwortschutz oder lokal gegen den echten Brevo-Account ausfüllen, DOI-Mail empfangen, Klick, Kontakt in der Brevo-Liste, Zeile in `waitlist_signups` via `npx tsx scripts/db-query.ts waitlist_signups --columns email,status,created_at --limit 5`.

## §7 Go-Live-Checkliste (HR-Eintragungstag, gemeinsam mit den Rechtsseiten)

Vorbereitung jetzt (keine Veröffentlichung):
- [x] Brevo-Account angelegt (unslopai@protonmail.com), DPA per Registrierung akzeptiert (Tab „Rechtsdokumente"), IP-Allowlist für API-Keys deaktiviert (Vercel hat keine feste IP) — 2026-09-22
- [x] Sender-Domain `unslop.codes` verifiziert + authentifiziert (API: `authenticated: true, verified: true`): Brevo-Code-TXT, DKIM-CNAMEs `brevo1/brevo2._domainkey`, DMARC `p=none`, Branding-Subdomain `mail` + `r.mail` + `img.mail` bei Porkbun — DNS-Auflösung 2026-09-22 geprüft
- [x] Absender `noreply@unslop.codes` (Sender-ID 2, Reply-To unslopai@protonmail.com), Ordner „Unslop" (3), Liste „Waitlist" (**ID 4**), DOI-Templates „Waitlist DOI (EN)" (**ID 1**) und „(DE)" (**ID 2**) per API angelegt, Tag `optin`, Link `{{ doubleoptin }}` — 2026-09-22
- [x] Env-Werte lokal in `.env.local` (List/Template-IDs, generierter Salt) — 2026-09-22
- [x] **Live-Receipt Brevo-Seite 2026-09-22:** `requestDoubleOptIn` aus `src/lib/waitlist/brevo.ts` mit der echten Konfiguration (Liste 4, Template DE = 2) → `outcome: confirmation_sent`, DOI-Mail an unslopai@protonmail.com unterwegs. Offen aus diesem Receipt: Klick auf den Link (Redirect zeigt auf `/de/waitlist/confirmed`, bis zum Deploy 404 — kosmetisch, der Kontakt landet trotzdem in Liste 4) und Sichtung des Kontakts in der Liste.
- [ ] Dieselben Werte + `BREVO_API_KEY` in Vercel (ohne das `NEXT_PUBLIC_WAITLIST_LIVE`-Flag)
- [x] Migration 045 angewendet (live belegt 2026-09-29, s. 4.3)
- [ ] Live-Receipt §6

Am Eintragungstag:
- [ ] Impressum + Datenschutzerklärung (mit Brevo als Auftragsverarbeiter) deployen — ROADMAP §2 Rechtsseiten
- [ ] `NEXT_PUBLIC_WAITLIST_LIVE=true` in Vercel, Redeploy
- [ ] Ein echter Eintrag, Screenshot, ROADMAP-Chronik-Zeile

## §8 E-Mail-Fundament: Prinzipien & spätere Phasen (Entscheidungsgrundlage, nicht Bauumfang)

**Prämisse, korrigiert:** nicht „wir schicken kaum Mails", sondern **ausgelöste Mails ohne Frequenzlimit, Broadcasts selten.** Rechtsrahmen § 7 UWG: Werbung nur mit DOI-Einwilligung; Bestandskunden-Ausnahme § 7 Abs. 3 für ähnliche Produkte mit Opt-out-Hinweis in jeder Mail. Zielgruppe (Entwickler, CTOs) ist spam-feindlich; das Higgsfield-Muster (B2C, Impulskauf, Massenreichweite) ist nicht übertragbar.

| Phase | Auslöser | Inhalt | Kadenz | Quelle |
|---|---|---|---|---|
| 1 (diese Spec) | Waitlist-DOI | Bestätigung | 1× | Brevo DOI |
| 1b | Ereignis | „Beta offen", „Launch", ggf. 1 Zwischenstand | **≤ 5 Mails bis Launch** | Brevo Broadcast an Liste |
| 2 | Paddle-Webhook `subscription.created` (trialing) | Tag 0 Setup-Schritte; Tag 2 „kein Repo verbunden"; nach erstem Scan Zusammenfassung; Tag 12 „Trial endet" | ausgelöst | Brevo Automation (Delays bei Brevo, kein Cron) + Brevo-Webhook `listAddition` → `status='confirmed'` |
| 3 | Monatswechsel | Score-Verlauf, angewendete Fixes, Top-Regeln | 1×/Monat an Zahler | Brevo Transactional aus eigener Telemetrie |
| 4 | `subscription.canceled` | im Kündigungsmoment Pause/Downgrade (Paddle kann beides); **Win-back frühestens 30 Tage nach Ablauf**, befristet (z. B. 3 Monate −50 %) | 1× | Brevo Automation |
| 5 | 14 Tage ohne Scan bei aktivem Abo | „Installation prüfen" — Support, keine Werbung | ausgelöst | Brevo Automation |

Rabatt direkt nach Kündigung ist verworfen: vorhersehbar ⇒ Kündigen-um-Rabatt. Jede Phase ab 2 bekommt eine eigene Mini-Spec mit Copy und Trigger-Test; nichts davon ist Teil des Waitlist-Builds.

## §9 Offene Punkte

- Brevo-Free-Plan-Branding und DOI-Verfügbarkeit im Free-Plan sind aus Sekundärquellen belegt, nicht aus der Brevo-Hilfe (403 beim Abruf am 2026-09-22) — beim Account-Anlegen verifizieren.
- Brevo-Antwortcode für „Kontakt existiert bereits" am DOI-Endpoint im Live-Receipt festhalten und im Client hart verdrahten (4.5).
- `/{locale}/privacy`-Route existiert noch nicht; die Consent-Zeile zeigt bis dahin auf einen Anker, der am Eintragungstag mit den Rechtsseiten kommt.

## §10 Quellen (abgerufen 2026-09-22)

- Resend Datenspeicherung USA, keine EU-Option: https://resend.com/security/gdpr · https://resend.com/docs/dashboard/domains/regions
- Resend Preise (Free 3.000/Monat, 100/Tag; Audiences 1.000 Kontakte): https://resend.com/pricing
- Brevo DOI-Endpoint: https://developers.brevo.com/reference/createdoicontact
- Brevo Free-Plan (300/Tag, 100k Kontakte, 2.000 Automations-Kontakte, EU-Rechenzentren FR/BE): https://www.fastlancer.org/en/fastlancer-blog/brevo-review/ · https://www.emailtooltester.com/en/reviews/brevo/pricing/ (Sekundärquellen, §9)
- Loops DPA (kein Speicherort genannt): https://loops.so/dpa · Preise: https://loops.so/pricing
- Postmark (Free 100/Monat, EU als Zusatzprodukt): https://nuntly.com/alternatives/postmark-eu
- EU-native Transactional-Anbieter: https://eualternative.eu/categories/transactional-email/
