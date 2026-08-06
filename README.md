# journal_trading

# Récap — Architecture app Journal de Trading

Contexte : app actuellement développée via Claude Design, utilisée directement dans Design, données stockées dans le cache navigateur (localStorage). Objectif : sortir de cette dépendance pour un stockage pérenne, accessible depuis plusieurs appareils, et exploitable par Cowork pour l'analyse.

## Problème de départ

- Les données sont dans le cache du navigateur → perdues si vidage de cache, non accessibles depuis un autre appareil, non accessibles par Cowork.
- Aujourd'hui l'app n'est utilisée qu'en passant par Design à chaque fois — pas de fichier autonome.

## Décision : hébergement sur GitHub (repo privé)

Comparé à Supabase, GitHub a été retenu pour ce cas d'usage :

- Usage mono-utilisateur (pas de concurrence d'écriture à gérer comme le permet Supabase).
- L'historique de commits donne un vrai suivi temporel des trades (plus-value pour un journal).
- Pas de nouveau service à créer/gérer si compte GitHub déjà existant.
- `github.com` et `api.github.com` sont dans les domaines réseau déjà autorisés côté outils Claude — bon signal de compatibilité.
- Un connecteur GitHub officiel existe pour Cowork (Réglages → Connecteurs → GitHub), permettant à Cowork de lire le repo directement dans une conversation.
  - ⚠️ Point de vigilance : bugs rapportés où le connecteur s'affiche "Connecté" mais n'expose aucun outil dans la session. À tester avec une tâche simple avant de s'appuyer dessus.
  - Fallback si le connecteur ne fonctionne pas : cloner/puller le repo dans un dossier local et pointer Cowork sur ce dossier.

## Format de stockage retenu

Un seul gros `trades.json` a été écarté (chaque écriture = retélécharger/recommiter tout le fichier, diffs Git illisibles, ça grossit mal).

Structure retenue :

```
TradingJournal/
  data/
    accounts.json              # infos comptes (Lucid, Apex...), rarement modifié
    trades/
      2026-08.ndjson            # un trade = une ligne JSON
      2026-07.ndjson
  notes/                        # exports Anytype pertinents (markdown, screenshots)
```

- **NDJSON** (une ligne = un trade) plutôt qu'un tableau JSON → ajout d'un trade = ajout d'une ligne, diff Git minimal.
- **Un fichier par mois** → chaque commit reste léger, même après des années d'historique.
- **`accounts.json` séparé** du flux de trades car change rarement.
- Permet aussi à Cowork de cibler un seul fichier (ex. le mois en cours) plutôt que d'ingérer tout l'historique à chaque analyse.

## Fluidité lecture/écriture — architecture "local-first"

Point clé : ne jamais faire dépendre l'UI d'un appel réseau à l'API GitHub à chaque saisie (latence perçue).

- Lecture/écriture **instantanées en local** (IndexedDB, ou fichier local via File System Access API) — l'app répond sans latence.
- GitHub = **couche de synchronisation asynchrone**, pas le chemin principal :
  - déclenchement après quelques secondes d'inactivité, ou bouton "Sync" manuel, ou à la fermeture de l'app,
  - jamais bloquant pour l'utilisateur.
- Au chargement, comparer le SHA du commit distant avant de retélécharger, plutôt que tout retélécharger systématiquement.

## Piste explorée puis dépassée

Avant de partir sur GitHub, une piste 100% locale avait été envisagée : app servie en `localhost` (petit serveur local) + File System Access API pour écrire directement dans un fichier sur disque, avec exports périodiques pour Cowork. Cette piste reste valable comme fallback (notamment si le connecteur GitHub dans Cowork pose problème), mais l'hébergement GitHub répond mieux au besoin d'accès multi-appareils.

## Notes Anytype

Pas de connecteur Anytype disponible pour Cowork actuellement. Solution retenue : export manuel (Markdown natif d'Anytype) des notes pertinentes (données macro du jour, captures TL, commentaires) dans le dossier `notes/` du repo, pour que Cowork puisse les croiser avec les trades lors des analyses.

## Répartition Design / Cowork

- **Design** : construction et évolution de l'app elle-même (UI, logique, branchement GitHub/local-first).
- **Cowork** : exploitation des données produites — analyses hebdo/mensuelles, croisement trades × notes macro, détection d'erreurs récurrentes.

## Prochaine étape

Reprendre le code existant de l'app dans Claude Design pour implémenter : structure NDJSON + accounts.json, stockage local-first (IndexedDB ou File System Access API), sync GitHub asynchrone en arrière-plan.
