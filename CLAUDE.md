# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dépôt de thèmes blocs WordPress pour https://julien.chable.net : un parent `jchable` et trois enfants (`jchable-bureau`, `jchable-swiss`, `jchable-arcade`). Le README.md décrit les fonctionnalités et le déploiement ; `docs/deploiement.md` est le guide de mise en production. Tout (interface, commentaires, commits, docs) est en français.

## Commandes

PHP n'est pas installé : tout ce qui touche WordPress passe par Docker (`@wordpress/env`, WordPress sur http://localhost:8888, admin / password) et `npx wp-env run cli wp …`. Python n'est pas installé non plus.

| But | Commande |
|---|---|
| Démarrer / arrêter / remettre à zéro WordPress | `npm run env:start` / `env:stop` / `env:reset` (reset = base vierge + contenu de test de `tools/env/seed.php`) |
| Compiler le JS du bureau | `npm run build:js` (vers `themes/jchable-bureau/assets/dist/`, ignoré par git) |
| Types | `npm run typecheck` |
| Tests unitaires (Vitest + jsdom) | `npm run test:unit` ; un seul : `npx vitest run -c packages/bureau-desktop/vitest.config.ts <motif>` |
| Tests des scripts Node | `npm run test:tools` |
| Theme Check | `npm run check -- <thème>` ; `npm run check:all` pour les quatre |
| Contrôles de sécurité PHP | `npm run test:security:php` |
| E2E par thème | `npm run test:e2e` (parent), `test:e2e:bureau`, `test:e2e:swiss`, `test:e2e:arcade` |
| Un seul test e2e | `npx playwright test -c playwright.bureau.config.ts <fichier> -g "<titre>" --project=desktop` |
| Zips de déploiement | `npm run zip` (compile le JS puis `dist/<thème>.zip` pour chaque thème) ; `npm run zip -- --no-doom` pour la version légère du Bureau |

Il faut `npm run build:js` avant les e2e du Bureau, qui testent le JS compilé et non les sources.

## Pièges de l'environnement de test

- **Un seul WordPress partagé** : chaque suite Playwright active son thème au démarrage (`tests/e2e/global-setup.ts`, variable `THEME` posée par `playwright.<thème>.config.ts`). Deux suites en parallèle se sabotent. Quand plusieurs agents ou terminaux travaillent, passer par le verrou : `node tools/env/locked.mjs npm run test:e2e:bureau`. Lancer la suite Bureau en dernier : elle laisse `jchable-bureau` actif.
- `wp-env start --update` (ou tout redémarrage qui recrée les conteneurs) perd les images téléversées et le pack de langue fr_FR : relancer `npm run env:reset`. Ajouter un thème enfant impose de le lister dans `.wp-env.json` (`themes`).
- Les tests tournent en `fr-FR` par défaut (`playwright.base.ts`), sur trois projets : `desktop` 1440, `tablet` 768, `mobile` 390. L'anglais est testé explicitement (`tests/e2e-bureau/i18n.spec.ts`).
- Les tests unitaires doivent se lancer depuis la racine (`npm run test:unit`) : la config de Vitest est dans le paquet (`jsdom`) et un test lit `themes/jchable-bureau/style.css` via `process.cwd()`.
- `npm install` applique `patches/@wordpress+env+11.17.0.patch` (via `tools/deps/patch-wp-env.mjs`) ; ne pas désinstaller le verrouillage. Utiliser `npm ci`.
- Dans le shell Bash de l'outil, les antislashs de regex dans les heredocs et `node -e` sont perdus : écrire ces fichiers avec Write/Edit.

## Architecture

**Parent `themes/jchable`** : `theme.json`, gabarits et parties communs, blocs dynamiques (`post-filename`, `archive-path`, `request-path`), attribut `lang` d'un article via le champ `jchable_lang`. Chaque enfant surcharge `templates/` et `parts/` (accueil, article, page, archives, recherche, 404, plan-du-site) et ajoute ses propres blocs dans `blocks/` (block.json + render.php, enregistrés par `inc/blocks.php` avec `register_block_type_from_metadata`).

**Swiss et Arcade** : CSS pur, aucun JavaScript, polices auto-hébergées (`assets/fonts`), français seulement. Le thème s'affiche et se lit sans JS ; leurs tests vérifient l'absence de requête externe et le rendu sans JavaScript.

**Bureau = amélioration progressive** : le HTML rendu par WordPress (menu, fenêtres des articles, barre des tâches avec les blocs `start-button`, `clock`, `taskbar-tab`, `taskbar-links`) fonctionne sans JavaScript ; sur grand écran, le JS de `packages/bureau-desktop/` transforme la page en bureau interactif.

- Point d'entrée : `src/main.ts` → `src/boot.ts` (garde `dataset.bureauStarted` contre un double démarrage) → `src/core/desktop.ts` (`bootstrap`), qui assemble préférences, `WindowManager` (`core/windows.ts`), icônes (`ui/desktopIcons.ts`, rangement dans `core/iconOrder.ts` et `core/grid.ts`), barre des tâches, menu Démarrer, écran de veille. Les icônes sont construites en lisant le menu de navigation du DOM (`ui/menuIcons.ts`), le menu WordPress restant la source.
- **Applis** : un dossier `src/apps/<id>/` avec `index.ts` (exporte `mount`/`unmount`), `i18n.ts` et tests ; déclarée dans `core/registry.ts` (chargement différé par `import()`), contrat `AppContext` dans `core/types.ts`. `LISTED_APPS` = icônes du bureau + menu Démarrer ; Propriétés et Préférences n'y sont pas. Garder la logique pure (moteur de la calculatrice, remplissage de Paint, calendrier) dans des modules testables sans DOM ni canevas.
- **Écrans de veille** : `ui/screensaver/overlay.ts` charge une scène à la demande (`scenes/loader.ts`, `scenes/catalog.ts`) ; chaque scène exporte `create: SceneFactory` (Canvas 2D + `scenes/math3d.ts`, aucun `Math.random`/`Date.now` : tout passe par `context.rng`) et se teste avec `expectSceneConforms`. Une scène qui échoue laisse un ciel bleu.
- **Préférences du visiteur** : `localStorage`, clé `jchable-bureau:v1`, assainies à la lecture (`core/prefs.ts`) ; rien n'est envoyé au serveur. La fenêtre Préférences travaille sur un brouillon appliqué par « Enregistrer ».
- **i18n** (français / anglais, interface seulement) : `core/i18n.ts` (`makeT`, `missingKeys`), un `i18n.ts` par appli, `core/ui-i18n.ts` pour le cœur, `ui/chrome.ts` qui traduit les textes écrits dans les gabarits PHP/HTML. Un test impose que chaque clé existe dans les deux langues ; les articles ne sont jamais traduits.
- **Build** : Vite (`packages/bureau-desktop/vite.config.ts`) ; `bureau.js` et `bureau.css` ont un nom stable, les applis et scènes sortent en `chunks/<nom>-<hash>.js`, `core/i18n.ts` est isolé dans son propre chunk (sinon le code partagé serait évalué deux fois et le bureau démarrerait en double).
- DOOM est un iframe sur le moteur WebAssembly de `assets/doom/` (licences GPL et offre du code source dans son README ; ne pas les retirer).

## Conventions utiles

- Versions des CSS : les feuilles sont enfilées avec `filemtime`, pas avec le numéro de version, pour qu'une mise à jour ne soit jamais masquée par un cache.
- Version du Bureau : `Version` dans `style.css`, `JCHABLE_BUREAU_VERSION` dans `functions.php` et `Stable tag`/changelog de `readme.txt` doivent rester alignés ; l'appli Propriétés l'affiche et un test la compare à `style.css`.
- Ajouter une appli, une scène ou un design : voir la section « Étendre le bureau » du README. Un nouveau design copie `playwright.swiss.config.ts`, s'ajoute à `.wp-env.json` et à `check:all`.
- Les tests ont été écrits en TDD (échec observé avant implémentation) ; garder ce réflexe et ne pas épingler dans un test des valeurs qui dépendent du contenu de test sans le dire.
- Travail courant sur la branche `dev` ; `main` suit `dev` par simple avance. Ne rien pousser sans que l'utilisateur le demande.
