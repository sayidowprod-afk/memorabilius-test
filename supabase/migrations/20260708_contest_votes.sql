-- Votes de concours : un vote (👍) par personne et par concours
CREATE TABLE IF NOT EXISTS contest_votes (
  id         bigserial PRIMARY KEY,
  contest_id bigint NOT NULL,
  entry_id   bigint NOT NULL REFERENCES contest_entries(id) ON DELETE CASCADE,
  voter_id   uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (contest_id, voter_id)
);
ALTER TABLE contest_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS votes_read   ON contest_votes;
DROP POLICY IF EXISTS votes_insert ON contest_votes;
DROP POLICY IF EXISTS votes_update ON contest_votes;
DROP POLICY IF EXISTS votes_delete ON contest_votes;
CREATE POLICY votes_read   ON contest_votes FOR SELECT USING (true);
CREATE POLICY votes_insert ON contest_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
CREATE POLICY votes_update ON contest_votes FOR UPDATE USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);
CREATE POLICY votes_delete ON contest_votes FOR DELETE USING (auth.uid() = voter_id);
