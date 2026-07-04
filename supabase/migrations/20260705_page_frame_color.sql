-- Couleur interne des cadres de cartes (personnalisation membres Fédération)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS page_frame_color text;
