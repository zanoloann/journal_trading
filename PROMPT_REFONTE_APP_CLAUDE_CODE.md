# Mission : refonte complète de l'app de tracking trading

## Qui je suis

Tu vas te mettre à la place d'un trader professionnel de futures S&P 500 (ES/MES), actif depuis environ 1,5 an, formé à l'école Objectif Trading (Sophia Antipolis). Mon approche est top-down, basée sur la théorie de Dow : analyse descendante 4H → 1H → 30min → 5min, entrées sur retournements en haut/bas de bande de Bollinger. Mes séances actives sont de 8h00 à 10h00, précédées d'une préparation de 7h30 à 8h00. Mon risque max moyen est de 150 $/séance (occasionnellement 300–500 $).

Je gère plusieurs comptes prop firm simulés (sim funded), sur des barèmes de règles différents :
- 3 comptes APEX 50K EOD (funded/PA)
- 1 (ou plusieurs) compte(s) Lucid Flex (25K et/ou 50K)

Le but de l'app que tu vas refondre : m'aider à suivre mes performances, gérer mes comptes prop firm **sans jamais dépasser une limite qui entraînerait leur clôture**, et anticiper mes payouts.

## Écosystème existant — à explorer en profondeur avant de toucher au code

Explore en détail avant toute décision :
- `app/` — repo actuel de l'application (structure : `components/`, `pages/`, `lib/`, `sync/`, `config/`, `data/`)
- `app/data/accounts.json` et `app/data/trades/*.ndjson` — mes données réelles, à ne jamais perdre ni corrompre
- `app/config/propfirms.json` — config actuelle (ne contient aujourd'hui que des frais par contrat, à étendre très largement, voir plus bas)
- `app/CLAUDE.md` s'il existe
- `app/lib/data.jsx` — contient déjà des fonctions comme `payoutInfo()`, `drawdownInfo()`, `inactivityInfo()` partiellement utilisées ou avec des données manquantes côté `accounts.json` : comprends précisément ce qui est déjà implémenté vs ce qui manque de données pour fonctionner
- Les pages existantes (`dashboard`, `accounts`, `journal`, `calendar`, `analytics`, `payout`) : comprends ce qu'elles font réellement aujourd'hui

Outils qui gravitent autour de cette app, à prendre en compte dans ta réflexion (pas forcément à intégrer techniquement, mais pense à la cohérence globale et aux ponts éventuels) :
- **GitHub** : sync du repo déjà en place via `sync/githubsync-api.jsx`, source de vérité partagée
- **Anytype** (espace "Trading") : objets Séance / Donnée Economique / Publication Résultats — mon journal qualitatif de séance, en dehors de l'app
- **Google Drive**, dossier "Factures" : justificatifs PDF des achats de comptes eval (APEX, Lucid)
- **Excel `Budget_Trading_2026.xlsx`** : suivi budgétaire/dépenses (frais d'évaluation, abonnements, etc.), hors app

Réfléchis à la place de l'app par rapport à ces outils : rester focalisée sur le tracking PNL + comptes + règles prop firm est probablement le bon périmètre, mais évalue si des ponts (export, liens, rappels) auraient du sens sans complexifier inutilement.

## Règles métier réelles à modéliser (ne pas coder en dur)

Voici les règles actuelles de mes prop firms. Utilise-les pour concevoir un système de **configuration par firme / type de compte**, plutôt que des valeurs hardcodées dans le code — ces barèmes changent dans le temps et je dois pouvoir les mettre à jour sans toucher au code.

**APEX 50K EOD (funded/PA)**
- Drawdown trailing max : 2 000 $, recalculé une fois par jour à la clôture (16h59 ET)
- Daily Loss Limit : 1 000 $ (coupe la session en cours, ne ferme pas le compte, reset le lendemain)
- Safety net à maintenir en permanence : 52 100 $
- Inactivité : minimum 2 jours à ≥ 50 $ de profit net sur une fenêtre glissante de 30 jours ; statut "dormant" dès 15 jours sans activité qualifiante ; clôture définitive après 30 jours consécutifs sans satisfaire la condition
- Payout : 5 jours qualifiants à ≥ 250 $/jour (non consécutifs), règle de consistance 50 % (aucun jour ≥ 50 % du profit total depuis le dernier payout), solde minimum 52 600 $, montant minimum 500 $, échelle des 6 payouts max : 1 500 / 1 500 / 2 000 / 2 500 / 2 500 / 3 000 $
- Frais d'activation PA : 99 $, payés une seule fois à la réussite de l'évaluation

**APEX 50K Legacy (comptes ouverts avant le 01/03/2026)**
- Drawdown trailing max : 2 500 $
- Pas de Daily Loss Limit
- Inactivité : 30 jours glissants sans au moins un jour ≥ 150 $ de profit net
- Payout : 8 jours de trading dont au moins 5 à ≥ 50 $, règle de consistance 30 % (meilleur jour ÷ 0,3 = profit total minimum requis), safety net (2 600 $) applicable seulement sur les 3 premiers payouts, solde minimum 52 600 $, montant max 2 000 $ sur les 5 premiers payouts (pas de plafond ensuite), split 100 % sur les premiers 25 000 $ cumulés par compte puis 90 %, 100 % de split dès le 6ᵉ payout approuvé

**Lucid Flex 25K / 50K — phase Funded**
- Drawdown EOD trailing : 1 000 $ (25K) / 2 000 $ (50K) — pas de DLL, pas de règle de consistance, pas de safety net à maintenir
- Payout : 5 jours à ≥ 100 $ (25K) / ≥ 150 $ (50K), profit net positif sur l'ensemble du cycle, montant max = 50 % du profit plafonné à 1 000 $ (25K) / 2 000 $ (50K) — plafond fixe qui ne progresse pas avec le nombre de payouts, max 5 payouts puis passage en compte live, split fixe 90/10 dès le premier dollar

**Lucid Flex 25K / 50K — phase Évaluation**
- 25K : profit target 1 250 $, DLL désactivé, max loss limit 1 000 $, drawdown EOD, consistance 50 %, taille max 2 mini / 20 micros
- 50K : profit target 3 000 $, DLL désactivé, max loss limit 2 000 $, drawdown EOD, consistance 50 %, taille max 4 mini / 40 micros

## Mission

1. **Sauvegarde de l'existant.** Avant toute modification, crée une sauvegarde complète et identifiable de l'état actuel du repo (branche ou tag git dédié, horodaté). Je dois pouvoir revenir en arrière à tout moment sans perdre une donnée.

2. **Audit complet.** Analyse le code, les données réelles (comptes + trades), les pages existantes : ce qui fonctionne, ce qui est à moitié implémenté (ex. `payoutInfo()` sans données de payout exploitables), ce qui manque, ce qui est inutilement complexe ou mort.

3. **Refonte complète — carte blanche.** Tu as toute latitude pour redessiner l'app (architecture, UI, modèle de données), à condition qu'elle reste simple d'usage au quotidien et qu'aucune donnée existante ne soit perdue.

   **Fonctionnalités obligatoires (non négociables) :**
   - **Visualisation de la santé de chaque compte** : pour chaque compte, un état clair et immédiat (ex. code couleur / statut) combinant marge restante avant drawdown/trailing stop, marge restante avant DLL, position par rapport au safety net, statut d'inactivité (jours restants avant "dormant" puis clôture) et statut payout (jours qualifiants déjà validés, éligibilité). Doit permettre de voir en un coup d'œil si un compte est en danger.
   - **Ajout de nouveaux comptes** : formulaire complet permettant de créer un compte à tout moment (firme, taille, type EOD/Legacy/Flex/eval, rôle maître ou esclave, coefficient), sans toucher au code ni au JSON à la main.
   - **Vue calendrier** : visualisation jour par jour du PnL (et idéalement des jours qualifiants atteints pour payout/inactivité), à conserver et fiabiliser — la page `calendar` existe déjà, vérifie qu'elle reste cohérente avec le nouveau modèle de données.
   - **Principe compte maître / comptes esclaves avec coefficient** : ce principe existe déjà dans les données actuelles (`role: master/slave`, `coef` par compte dans `accounts.json`, et chaque trade des NDJSON réplique le PnL sur tous les comptes liés via leur coefficient). Il doit être conservé et fiabilisé dans la refonte : je saisis un trade une seule fois sur le compte maître (taille réelle), et l'app calcule et applique automatiquement le PnL correspondant sur chaque compte esclave selon son coefficient propre (ex. coef 2 = double la taille/le PnL par rapport au maître) — sans ressaisie manuelle. Assure-toi que la gestion des coefficients reste simple à modifier par compte.
   - Suivi de l'éligibilité aux payouts (jours qualifiants, règle de consistance, solde minimum, montant demandable), avec le bon jeu de règles selon la firme et le type de compte
   - Journal de trading (saisie de trades, comme aujourd'hui)
   - Configuration centralisée et évolutive des règles prop firm (voir section précédente)
   - Reste lisible et rapide à utiliser après chaque séance — pas de fonctionnalités gadget, pas de sur-ingénierie

4. **Tests réels et approfondis.** Une fois la refonte en place, utilise l'app comme si tu étais moi, en conditions réelles :
   - Ajoute un ou plusieurs comptes Lucid Flex (25K et/ou 50K) avec leur vraie config de règles
   - Saisis une série de trades réalistes sur plusieurs jours et plusieurs comptes (gains, pertes, journées proches des seuils critiques)
   - Simule volontairement des scénarios limites : approche du drawdown, dépassement du DLL, approche du seuil d'inactivité, atteinte des jours qualifiants pour un payout, non-respect de la règle de consistance — vérifie que l'app détecte et affiche correctement chaque situation
   - Note chaque bug, incohérence de calcul, friction d'usage ou point de confusion rencontré pendant ces tests, et corrige ce qui peut raisonnablement l'être

5. **Propositions d'amélioration.** À partir de ces tests, propose des améliorations ou nouvelles fonctionnalités pertinentes pour un trader gérant plusieurs comptes prop firm en parallèle. Implémente celles qui sont raisonnables et cohérentes avec l'objectif de simplicité ; liste clairement les autres si elles nécessitent un vrai arbitrage de ma part.

## Autonomie

Tu as carte blanche sur les décisions techniques et produit. Tu n'as pas besoin de mon accord à chaque étape — prends des décisions, documente-les brièvement au fil de l'eau, et continue. Ne t'arrête que si tu rencontres un vrai blocage (risque de perte de données, décision irréversible réellement ambiguë) ou une fois la mission terminée.

## Livrables attendus

- Une sauvegarde vérifiable de l'état initial, accessible à tout moment
- L'app refondue, fonctionnelle, testée en conditions réelles (pas seulement en théorie)
- Un compte-rendu synthétique final : ce qui a changé et pourquoi, résultats des tests (bugs trouvés/corrigés), liste des améliorations proposées (implémentées ou en attente de mon arbitrage)
