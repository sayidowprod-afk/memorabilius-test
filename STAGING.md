# Version de test isolée (staging)

Une version de test **complètement séparée de la prod** : même code, mais base de
données Supabase et déploiement Vercel distincts. Tu peux tout casser sans risque
pour les vraies données.

```
┌────────────────────┐        ┌────────────────────┐
│   PROD             │        │   STAGING (test)   │
│ branche  main      │        │ branche  staging   │
│ Vercel   memorabilius       │ Vercel  memorabilius-staging
│ Supabase projet A  │        │ Supabase projet B  │
│ memorabilius.fr    │        │ …-staging.vercel.app
└────────────────────┘        └────────────────────┘
```

Le code est identique : **toute la séparation se fait par les variables
d'environnement** (voir `.env.example`). Aucune modification de code n'est requise.

---

## 1. Créer le projet Supabase de test

1. https://supabase.com/dashboard → **New project** (nom : `memorabilius-staging`).
2. Note l'`URL`, l'`anon key` et la `service_role key` (Project Settings → API).
3. Copie le schéma depuis la prod (le dossier `supabase/migrations/` ne contient
   que les changements récents, pas le schéma complet) :

   ```bash
   export PROD_DB_URL="postgresql://postgres:MDP@db.AAAA.supabase.co:5432/postgres"
   export STAGING_DB_URL="postgresql://postgres:MDP@db.BBBB.supabase.co:5432/postgres"
   bash scripts/clone-to-staging.sh          # schéma seul (recommandé)
   ```

   Les connection strings sont dans Supabase → Project Settings → Database →
   *Connection string* → **URI** (mode Session, port 5432).

4. **Storage** : recrée le(s) bucket(s) utilisés (au minimum `avatars`) dans le
   projet de test, avec les mêmes policies (public read).

## 2. Créer le déploiement Vercel de test

Option simple — **même repo, branche dédiée** :

1. Crée la branche `staging` (déjà faite si tu as poussé ce guide) :
   ```bash
   git checkout -b staging && git push -u origin staging
   ```
2. Vercel → **Add New Project** → importe le même repo GitHub.
   - Nom : `memorabilius-staging`.
   - **Production Branch** : `staging` (Settings → Git).
3. **Environment Variables** : recopie toutes les variables de `.env.example`,
   mais avec les valeurs du **projet Supabase de test** et :
   - `NEXT_PUBLIC_SITE_URL` = l'URL du déploiement de test.
   - Une **paire VAPID dédiée** (`npx web-push generate-vapid-keys`) — ne réutilise
     pas celle de prod.
   - Un `CRON_SECRET` différent.
4. Deploy.

> Astuce : tu peux réutiliser les mêmes clés Gemini / Resend / eBay qu'en prod
> (services externes, sans risque de corrompre des données), ou en créer d'autres.

## 3. Workflow

- Développe/teste sur la branche `staging` → déploiement de test automatique.
- Quand c'est validé : `git checkout main && git merge staging && git push` → prod.
- Les **migrations SQL** : applique-les d'abord dans le SQL Editor du projet
  Supabase **de test**, puis (une fois validées) dans celui de **prod**.

## 4. Rafraîchir la base de test

Rejoue le script quand tu veux repartir d'un schéma propre :
```bash
bash scripts/clone-to-staging.sh
```
(Pense à vider/recréer le projet de test au préalable si tu veux un reset total.)

## Checklist des variables d'environnement

Voir `.env.example` — toutes doivent être renseignées côté Vercel staging avec les
valeurs **du projet de test** pour Supabase, et des secrets **dédiés** pour VAPID et
`CRON_SECRET`.
