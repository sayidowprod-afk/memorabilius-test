-- Motif de logos en fond (personnalisation membres Fédération)
-- page_pattern : URL du logo d'équipe répété en motif par-dessus page_bg
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS page_pattern text;
