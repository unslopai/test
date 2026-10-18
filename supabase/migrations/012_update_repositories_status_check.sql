-- Migration 012: Update repositories_status_check constraint
-- Erlaubt den Status 'deactivated', damit der Soft-Delete funktioniert
-- ohne die Check-Constraint der Datenbank zu verletzen.

ALTER TABLE public.repositories DROP CONSTRAINT IF EXISTS repositories_status_check;
ALTER TABLE public.repositories ADD CONSTRAINT repositories_status_check 
    CHECK (status IN ('active', 'syncing', 'error', 'deactivated'));
