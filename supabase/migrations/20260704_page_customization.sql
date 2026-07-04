-- Personnalisation de page (réservée aux membres de la team « Fédération de la carte »)
-- page_bg         : couleur ou dégradé CSS du fond de la galerie
-- page_name_color : couleur du pseudo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS page_bg text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS page_name_color text;
