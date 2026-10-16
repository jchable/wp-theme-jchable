# Étape 2 : thème enfant `jchable-bureau` sans JavaScript — plan d'implémentation

> **Pour l'exécutant :** exécution en ligne (superpowers:executing-plans), TDD (tests Playwright d'abord, vus en échec), un commit par tâche, registre de suivi dans `.superpowers/sdd/`.

**Objectif :** le mockup n°12 « Bureau rétro » devient un thème enfant WordPress complet de `jchable`, lisible et navigable sans JavaScript, responsive, accessible, déployable par zip.

**Spec :** `docs/superpowers/specs/2026-10-16-jchable-themes-bureau-design.md` (§4, §8 bis). Parent : `themes/jchable/` (étape 1).

## Contraintes globales

- Dossier `themes/jchable-bureau/`, `Template: jchable`, text domain `jchable-bureau`, `Requires at least: 6.7` (blocs avec `autoRegister`), `Requires PHP: 8.1`, GPLv2+.
- Couleurs : bureau `#2E6F6C` (trame de points), fenêtre `#F2F0EA`, encre `#101010`, accent `#2D3FC8`, jaune `#FFE14D`, bleu ciel `#9AD0FF`. Polices Chivo et Chivo Mono **hébergées dans le thème** (woff2 + licence OFL), aucun appel externe.
- Fenêtre = `section.window` > `header.window-titlebar` + `div.window-body` : bordure 2px encre, ombre dure 6px. Variantes de barre : `window--accent` (bleue, texte blanc), `window--dark` (noire), `window--yellow`, `window--sky`.
- Conteneur global 1320px ; 3 colonnes à partir de 900px (icônes ~110px | contenu | barre latérale ~280px), 1 colonne en dessous (icônes en rangée qui défile).
- Contraste ≥ 4,5:1 ; focus visible en pointillés ; aucun JavaScript requis ; aucun défilement horizontal de la page.
- Textes en français. Les 404, Démarrer et horloge fonctionnent sans JS.
- Les tests du parent (`npm run test:e2e`) et ceux de Bureau (`npm run test:e2e:bureau`) activent chacun leur thème avant de tourner.

## Tâches

1. **Socle du thème et outillage** — `style.css` (en-tête), `theme.json` (palette, polices avec `fontFace`), `functions.php` (feuilles de style, style de bloc `is-style-window`), polices copiées depuis `@fontsource/chivo` et `@fontsource/chivo-mono` par `tools/fonts/copy-fonts.mjs` (poids 400/700/900 latin + latin-ext pour Chivo, 400/700 pour Chivo Mono) avec `LICENSE-OFL.txt` ; `.wp-env.json` monte le thème ; Playwright : variable `THEME` + `globalSetup` qui active le thème (`wp theme activate`), configs `test:e2e` (jchable) et `test:e2e:bureau`. Test : le thème est actif, `Chivo` est chargée depuis le thème (aucune requête externe), le fond est teal.
2. **Bureau (icônes) et barre des tâches** — parts `desktop-icons`, `header`, `footer` ; blocs dynamiques `jchable-bureau/start-button` (lien vers le plan du site, filtre `jchable_bureau_sitemap_url`), `jchable-bureau/clock` (`<time>` : l'année sans JS), `jchable-bureau/taskbar-tab` (titre de la page en cours) ; icônes SVG (dossier jaune, document, dossier bleu, loupe, RSS) appliquées par classes de menu ; menu de test avec classes d'icônes. Tests : 5 icônes à gauche à 1440px, rangée horizontale unique à 390px, barre des tâches avec bouton Démarrer, onglet et horloge.
3. **Accueil** — `home.html`/`index.html` : fenêtre `bienvenue.txt` (h1 = titre du site, slogan), article « à la une » à barre bleue, suivants à barre noire sur 2 colonnes, pagination en boutons rétro. Tests (adaptés de ceux du parent) + titre de barre `<slug>.md — <date>`.
4. **Article et page** — `single.html`/`page.html` : fenêtre unique, barre `<slug>.md — <date>`, texte 720px, médias « wide » dans la fenêtre, fenêtre « Commentaires », boutons Précédent/Suivant.
5. **Explorateur** — `archive.html`, `search.html`, `plan-du-site.html` : fenêtre « Explorateur » avec barre d'adresse `C:\Blog\…`, liste en grille 3 colonnes (Nom, Date, Catégorie), message sans résultat ; barre latérale en fenêtres (Rechercher, Archives, À propos).
6. **Écran bleu (404)** — `404.html` plein écran bleu, texte à chasse fixe, chemin demandé échappé, lien « Appuyez sur une touche… ».
7. **Recette complète** — axe sur tous les gabarits (3 tailles), débordement, lecture sans JS, textes interminables injectés, Theme Check du thème enfant (`npm run check -- jchable-bureau`), zip, relecture finale.

## Registre des écarts

Tenus dans `.superpowers/sdd/2026-10-16-etape-2-bureau-sans-js/progress.md` (rulings).
