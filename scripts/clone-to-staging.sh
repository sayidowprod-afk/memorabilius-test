#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Clone le SCHÉMA de la base PROD vers la base STAGING (test).
#
# Par défaut : schéma "public" uniquement (tables, vues, fonctions, RLS, triggers)
# SANS les données — c'est le mode recommandé pour une base de test, car les
# tables référencent auth.users (comptes) qui n'existent pas dans le projet de test.
# Tu crées ensuite des comptes de test frais sur la version staging.
#
# Prérequis : pg_dump / psql installés (PostgreSQL client 15+).
#
# 1) Récupère les "Connection string" (URI, mode Session, port 5432) dans :
#      Supabase → Project Settings → Database → Connection string → URI
# 2) Exporte-les :
#      export PROD_DB_URL="postgresql://postgres:MOTDEPASSE@db.xxxx.supabase.co:5432/postgres"
#      export STAGING_DB_URL="postgresql://postgres:MOTDEPASSE@db.yyyy.supabase.co:5432/postgres"
# 3) Lance :
#      bash scripts/clone-to-staging.sh          # schéma seul (recommandé)
#      bash scripts/clone-to-staging.sh --with-data   # schéma + données (avancé, voir note)
#
# Note --with-data : peut échouer sur les tables liées à auth.users (clés étrangères).
# À réserver aux tables sans dépendance auth, ou après avoir recréé les comptes.
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${PROD_DB_URL:?Définis PROD_DB_URL}"
: "${STAGING_DB_URL:?Définis STAGING_DB_URL}"

MODE="${1:-schema}"
TMP="$(mktemp -d)"
DUMP="$TMP/prod.sql"

echo "→ Export depuis la PROD…"
if [ "$MODE" = "--with-data" ]; then
  echo "  (schéma + données)"
  pg_dump "$PROD_DB_URL" --schema=public --no-owner --no-privileges > "$DUMP"
else
  echo "  (schéma seul)"
  pg_dump "$PROD_DB_URL" --schema=public --no-owner --no-privileges --schema-only > "$DUMP"
fi

echo "→ Import dans la STAGING…"
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f "$DUMP"

rm -rf "$TMP"
echo "✅ Terminé. Vérifie les tables dans le dashboard Supabase de test."
echo "   Pense aussi à recréer les buckets Storage (ex : 'avatars') et leurs policies."
