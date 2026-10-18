# Migration-History — Hinweise

Lokale Dateien und die Remote-History (`supabase_migrations.schema_migrations`)
wurden am **2026-07-11** abgeglichen. Besonderheiten:

- **Frühe Migrationen (001–008, 013, 014)** wurden ursprünglich per SQL Editor
  angewendet und nachträglich in die Remote-History eingetragen
  (Remote-Migration `reconcile_migration_history_backfill`, ohne lokale Datei —
  sie fügt nur History-Zeilen ein).
- **`009b_` / `010b_`** sind Mirrors von Migrationen, die remote-only angewendet
  wurden (Remote-Versionen im Datei-Kommentar). Die Suffix-Namen sortieren sie
  an die chronologisch korrekte Stelle.
- **Zwei Dateien mit Präfix 009** (`009_enable_rls_review_jobs`,
  `009_add_code_chunks_soft_delete`): historisches Nummerierungs-Versehen,
  bewusst nicht umbenannt (beide sind remote getrackt).
- **015 ist reserviert** für `api_keys` (SPEC.md, Phase 2).
- **RLS auf `review_jobs`**: wurde aktiviert (009), remote deaktiviert (009b)
  und out-of-band wieder aktiviert — Ist-Zustand (AKTIV, keine Policies,
  Service-Role-Bypass) ist seit `017_reconcile_reenable_rls_review_jobs`
  explizit dokumentiert.

Neue Migrationen: fortlaufende Nummer + `apply_migration` (MCP) oder
`supabase db push`, damit lokale Datei und Remote-History synchron bleiben.
