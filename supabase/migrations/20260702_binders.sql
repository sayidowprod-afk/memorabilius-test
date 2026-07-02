-- "Ma bibliothèque" : classeurs physiques virtuels dans lesquels ranger ses
-- cartes, page par page, comme un vrai classeur à pochettes.

CREATE TABLE IF NOT EXISTS binders (
  id bigint generated always as identity primary key,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  layout integer NOT NULL DEFAULT 9, -- pochettes par page : 4, 6, 9, 12 ou 16
  color text DEFAULT '#003DA6',
  page_count integer NOT NULL DEFAULT 4,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS binder_slots (
  id bigint generated always as identity primary key,
  binder_id bigint NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  slot_index integer NOT NULL,
  card_key text NOT NULL,
  img text NOT NULL,
  nom text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (binder_id, page_number, slot_index)
);

ALTER TABLE binders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "binders_select" ON binders;
DROP POLICY IF EXISTS "binders_insert" ON binders;
DROP POLICY IF EXISTS "binders_update" ON binders;
DROP POLICY IF EXISTS "binders_delete" ON binders;
CREATE POLICY "binders_select" ON binders FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "binders_insert" ON binders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "binders_update" ON binders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "binders_delete" ON binders FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE binder_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "binder_slots_select" ON binder_slots;
DROP POLICY IF EXISTS "binder_slots_insert" ON binder_slots;
DROP POLICY IF EXISTS "binder_slots_delete" ON binder_slots;
CREATE POLICY "binder_slots_select" ON binder_slots FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "binder_slots_insert" ON binder_slots FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = (SELECT user_id FROM binders WHERE id = binder_id));
CREATE POLICY "binder_slots_delete" ON binder_slots FOR DELETE TO authenticated
  USING (auth.uid() = (SELECT user_id FROM binders WHERE id = binder_id));
