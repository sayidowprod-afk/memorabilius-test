-- Corrige les policies RLS manquantes/cassées sur les réactions et commentaires équipe.
-- Symptôme observé : "new row violates row-level security policy for table
-- team_post_reactions" en tentant d'ajouter un emoji sur un post.
-- À exécuter dans Supabase Dashboard → SQL Editor.

ALTER TABLE team_post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_post_reactions_select" ON team_post_reactions;
DROP POLICY IF EXISTS "team_post_reactions_insert" ON team_post_reactions;
DROP POLICY IF EXISTS "team_post_reactions_delete" ON team_post_reactions;

CREATE POLICY "team_post_reactions_select" ON team_post_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_post_reactions_insert" ON team_post_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "team_post_reactions_delete" ON team_post_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE team_message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_message_reactions_select" ON team_message_reactions;
DROP POLICY IF EXISTS "team_message_reactions_insert" ON team_message_reactions;
DROP POLICY IF EXISTS "team_message_reactions_delete" ON team_message_reactions;

CREATE POLICY "team_message_reactions_select" ON team_message_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_message_reactions_insert" ON team_message_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "team_message_reactions_delete" ON team_message_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE team_post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_post_comments_select" ON team_post_comments;
DROP POLICY IF EXISTS "team_post_comments_insert" ON team_post_comments;
DROP POLICY IF EXISTS "team_post_comments_delete" ON team_post_comments;

CREATE POLICY "team_post_comments_select" ON team_post_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_post_comments_insert" ON team_post_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "team_post_comments_delete" ON team_post_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
