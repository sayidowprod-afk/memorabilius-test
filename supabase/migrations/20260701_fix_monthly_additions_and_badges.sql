-- Corrige deux bugs de schéma qui empêchaient TOUT badge "collectionneur du
-- mois" d'être attribué depuis toujours (pas seulement ce mois-ci) :
--   1. La table monthly_additions n'existe pas du tout (référencée dans
--      update-stats, card-added, recalcul-stats, cron/monthly-badge, page.tsx)
--   2. La table badges n'a pas les colonnes "mois" et "description" que le
--      cron essaie d'insérer

CREATE TABLE IF NOT EXISTS monthly_additions (
  id bigint generated always as identity primary key,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month text NOT NULL, -- format 'YYYY-MM'
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE monthly_additions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_additions_select" ON monthly_additions;
CREATE POLICY "monthly_additions_select" ON monthly_additions
  FOR SELECT TO authenticated, anon USING (true);
-- Les écritures passent toutes par la clé service-role (routes API), pas besoin
-- de policy INSERT/UPDATE pour les clients.

ALTER TABLE badges ADD COLUMN IF NOT EXISTS mois text;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS description text;
