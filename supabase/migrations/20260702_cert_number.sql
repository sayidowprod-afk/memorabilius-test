-- Numéro de certification (grading) pour les cartes gradées → lien Cert Lookup direct.
ALTER TABLE cartes_manuelles ADD COLUMN IF NOT EXISTS cert_number text;
