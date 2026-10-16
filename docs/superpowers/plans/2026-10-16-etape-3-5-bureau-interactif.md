# Étapes 3 à 5 : bureau interactif, applis et mise en production — plan d'exécution

> Plan concis (l'exécutant est l'auteur ; la spec détaille chaque comportement). Exécution en ligne avec des sous-agents pour les modules indépendants. Spec : `docs/superpowers/specs/2026-10-16-jchable-themes-bureau-design.md` (§5, §8, §8 bis).

## Étape 3 — couche bureau (`packages/bureau-desktop`)

| Module | Rôle | Tests |
|---|---|---|
| `core/prefs.ts` | préférences dans le localStorage (clé versionnée, valeurs nettoyées, repli mémoire) | Vitest |
| `core/grid.ts` | grille 96 px des icônes : alignement, case libre la plus proche, rangement | Vitest |
| `core/windowStack.ts` | pile des fenêtres, bornage de la position | Vitest |
| `core/windows.ts` | fenêtres : ouverture, déplacement, réduction, fermeture, Échap, plein écran mobile, erreurs d'appli | Playwright |
| `core/sound.ts` | sons synthétisés (WebAudio), après un premier geste et si le son est activé | Vitest |
| `core/registry.ts`, `core/types.ts` | contrat des applis (`mount`/`unmount`), imports dynamiques | tsc |
| `ui/desktopIcons.ts` | icônes déplaçables (souris, doigt, Maj + flèches), double-clic, bulle d'aide, menu contextuel | Playwright |
| `ui/taskbar.ts`, `ui/startMenu.ts` | onglets, horloge, menu Démarrer (programmes, documents, blog, paramètres, arrêt) | Playwright |
| `ui/sidebarWindows.ts` | fenêtres de la barre latérale déplaçables et mémorisées | Playwright |
| `ui/overlays.ts` | écran bleu et écran d'arrêt | Playwright |
| `ui/screensaver/` | écran de veille (accueil, archives, 404 seulement) | Vitest + Playwright |

PHP : `inc/desktop.php` (module `wp_enqueue_script_module`, réglages `window.jchableBureau`, feuille de style) ; build Vite (`bureau.js`, un fichier par appli, `bureau.css` au nom stable).

## Étape 4 — applis (`src/apps/<id>/`)

Terminal, Démineur, WordPad, messagerie « Oh-Oh! Messenger », Corbeille, Propriétés (gag) : écrites en parallèle par des sous-agents, chacune avec ses tests unitaires, puis intégrées et recettées dans le navigateur. DOOM : moteur WebAssembly + `doom1.wad` (shareware) dans `assets/doom/`, chargés seulement au lancement.

## Étape 5 — mise en production

1. Recette Playwright complète (3 tailles d'écran, axe, sans JavaScript, bureau interactif, applis).
2. Relectures indépendantes : code JavaScript (sécurité, robustesse, accessibilité), éditeur de site (validité des blocs), revue finale de la branche.
3. Theme Check des deux thèmes ; zips ; vérification du contenu des zips.
4. Documentation : `README.md`, `docs/deploiement.md` (installation sans activation, vérifications sur le vrai site, retour en arrière, vie privée, licences).
5. Ce qui reste à faire par Julien : voir `docs/deploiement.md` §3 (commentaires Jetpack, menu, Cloudflare, DOOM sur le serveur réel).
