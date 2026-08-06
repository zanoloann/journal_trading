# Trading Journal — consignes projet

## Persistance des données (CRITIQUE)
- Les données utilisateur (comptes + trades) sont stockées dans le localStorage du navigateur sous les clés `tj_accounts_v5` et `tj_trades_v5` (voir `app/app.jsx`, constante `LS`).
- **NE JAMAIS changer (bumper) la version de ces clés** (`tj_*_v5` → v6...). Bumper la clé efface toutes les données saisies par l'utilisateur. L'utilisateur a explicitement demandé que ses données restent stockées et ne soient jamais réinitialisées.
- **NE JAMAIS écraser le localStorage de l'utilisateur** avec des données de démo/seed. Le seed (`window.ACCOUNTS` / `window.TRADES` dans `app/data.jsx`) ne sert QUE de valeur initiale quand le localStorage est vide.
- Pour modifier des données, passer par l'UI (formulaires d'ajout/édition, import CSV) ou demander à l'utilisateur — ne pas reseeder.
- Si une correction du modèle de données est nécessaire, écrire une migration qui PRÉSERVE les données existantes plutôt que de bumper la clé.

## Contexte produit
- Journal de trading SP500 futures : instruments **MES** (quotidien) et **ES** (challenges).
- Frais : **1,04 $ par contrat**, déduits du brut → net.
- Tous les montants en **$**, **sans arrondi** (centimes affichés dès qu'ils existent).
- Modèle multi-comptes maître/esclaves avec coefficients entiers (copie de position).
- Pas de sens long/short, pas de prix d'entrée/sortie : l'utilisateur saisit la performance brute directement.
- Note mentale de 1 à 3.
