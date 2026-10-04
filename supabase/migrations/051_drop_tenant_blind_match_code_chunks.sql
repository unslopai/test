-- 051_drop_tenant_blind_match_code_chunks (SERVER_AUDIT_2026-09.md §5, Nebenbefund)
-- Live existierten zwei Ueberladungen von match_code_chunks:
--   (query_embedding, target_repository_id, match_threshold, match_count)  — 008, repo-gefiltert
--   (query_embedding, match_threshold, match_count)                        — ohne Mandantenfilter
-- Die zweite hat keine lokale Migrationsdatei (out-of-band angelegt, vor 008)
-- und sucht ueber ALLE Mandanten. Sie war seit 038 nur fuer service_role
-- ausfuehrbar und seit 049 mit festem search_path — aber toter, mandanten-
-- blinder Code: der einzige Aufrufer (src/lib/rag.ts: matchCodeChunks)
-- uebergibt immer target_repository_id, `git grep -n match_code_chunks`
-- ueber src/, scripts/, packages/ findet keinen weiteren (2026-09-29).
-- Der Grant-Guard (private-grants.integration.test.ts) verliert den Eintrag
-- fuer diese Signatur: PostgREST antwortet auf eine fehlende Funktion mit
-- PGRST202 statt 42501, der Test wuerde sonst aus dem falschen Grund rot.
-- Angewendet via Supabase MCP apply_migration am 2026-09-29; lokaler Spiegel.

DROP FUNCTION public.match_code_chunks(extensions.vector, double precision, integer);
