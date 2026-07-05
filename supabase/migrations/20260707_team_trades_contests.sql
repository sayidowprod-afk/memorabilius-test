-- Trades scopés à une team (visibles uniquement dans la team) + Concours
-- Réservé (côté UI) à la team « Fédération de la Carte ».

-- 1) Trades : rattachement optionnel à une team
ALTER TABLE trades ADD COLUMN IF NOT EXISTS team_id bigint;

-- 2) Concours
CREATE TABLE IF NOT EXISTS team_contests (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL,
  title       text NOT NULL,
  description text,
  start_date  timestamptz NOT NULL,
  end_date    timestamptz NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contest_entries (
  id         bigserial PRIMARY KEY,
  contest_id bigint NOT NULL REFERENCES team_contests(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  card_key   text,
  card_img   text,
  card_nom   text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (contest_id, user_id)
);

ALTER TABLE team_contests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_entries ENABLE ROW LEVEL SECURITY;

-- Lecture publique
DROP POLICY IF EXISTS contests_read   ON team_contests;
DROP POLICY IF EXISTS entries_read     ON contest_entries;
CREATE POLICY contests_read ON team_contests FOR SELECT USING (true);
CREATE POLICY entries_read  ON contest_entries FOR SELECT USING (true);

-- Écriture concours : utilisateur authentifié (le contrôle admin est fait côté UI)
DROP POLICY IF EXISTS contests_write ON team_contests;
CREATE POLICY contests_write ON team_contests FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Participations : chacun gère les siennes
DROP POLICY IF EXISTS entries_insert ON contest_entries;
DROP POLICY IF EXISTS entries_delete ON contest_entries;
CREATE POLICY entries_insert ON contest_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY entries_delete ON contest_entries FOR DELETE USING (auth.uid() = user_id);
