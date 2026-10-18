-- Migration 011: RLS Policy für repositories hinzufügen
-- Damit Supabase Realtime funktioniert, muss der User Lese-Rechte (SELECT) auf die Tabelle haben.
-- Andernfalls filtert Realtime die UPDATE-Events heimlich heraus.

CREATE POLICY "Users can view their own repositories" 
ON public.repositories 
FOR SELECT 
USING (auth.uid() = user_id);
