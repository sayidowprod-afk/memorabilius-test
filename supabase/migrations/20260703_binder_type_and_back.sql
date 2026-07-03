-- Type de classeur + image dos de carte (pour le mode "classeur à anneaux")
-- portfolio  : pochettes dos-à-dos, on ne voit que les recto (comme un portfolio cousu)
-- rings      : feuilles simples, on voit le dos des cartes sur la page de gauche

ALTER TABLE binders ADD COLUMN IF NOT EXISTS binder_type text NOT NULL DEFAULT 'portfolio';
ALTER TABLE binder_slots ADD COLUMN IF NOT EXISTS img_back text;
