# Thèmes jchable et thème Bureau : conception

- **Date :** 2026-10-16
- **Statut :** en relecture
- **Site cible :** https://julien.chable.net (WordPress 7.1 auto-hébergé, Jetpack, derrière Cloudflare)
- **Maquettes :** https://claude.ai/artifact/Cu5gu4tpmJ7JxN2EZewZhk (le n°12 « Bureau rétro » sert de référence)

## 1. Objectif

Remplacer Twenty Eleven (1000px de large, colonne de texte de 584px) par une famille de thèmes maison. Ils doivent être plus larges, responsive et modernes, avec un côté décalé. Le dépôt héberge plusieurs thèmes, et le premier implémenté est **Bureau** : un blog classique habillé en bureau d'ordinateur rétro, avec des easter eggs interactifs.

### Décisions déjà prises

| Sujet | Décision |
|---|---|
| Thèmes à héberger | Bureau (n°12) d'abord, puis Swiss (n°5), Pixel Pro (n°6), Arcade (n°7), Console (n°8) |
| Expérience Bureau | Navigation de blog classique (vraies pages WordPress), avec une couche bureau et des applis en bonus |
| Architecture | Thèmes « blocs » (Full Site Editing) : un parent `jchable` et un enfant `jchable-<nom>` par design |
| Nommage | `jchable` / `jchable-bureau` ; le dépôt sera renommé plus tard par Julien |
| Déploiement | Zips installés à la main via Apparence › Thèmes › Téléverser |
| Wipeout | Reporté après la v1 : les données du jeu appartiennent à Sony et ne peuvent pas être redistribuées |

### Critères de réussite

1. Le site est lisible et navigable **sans JavaScript**, au clavier et sur mobile (390px).
2. Le conteneur principal fait jusqu'à **1320px** ; les textes longs restent autour de 720px.
3. Lire un article ne télécharge le code d'**aucune appli** : chacune n'est chargée qu'au lancement.
4. Les commentaires Jetpack fonctionnent sur les articles.
5. Theme Check ne remonte aucune erreur bloquante ; axe ne trouve aucune violation sérieuse ou critique sur les gabarits.
6. `npm run zip` produit des zips installables tels quels.

### Hors périmètre de la v1

Wipeout ; publication sur wordpress.org ; traductions au-delà du français ; Customizer ; thèmes 5, 6, 7 et 8 (leur conception viendra dans une spec suivante, sur le même socle).

## 2. Organisation du dépôt

Un seul dépôt géré avec les espaces de travail npm.

```
/
├─ themes/
│  ├─ jchable/                 parent : theme.json, templates/, parts/, patterns/, inc/, assets/
│  └─ jchable-bureau/          enfant : theme.json, style.css, templates/ et parts/ qu'il remplace, assets/
├─ packages/
│  └─ bureau-desktop/          TypeScript : gestionnaire de fenêtres, bureau, barre des tâches, applis
│     └─ src/apps/             doom/ messenger/ wordpad/ minesweeper/ terminal/ trash/ screensaver/
├─ tools/
│  ├─ build/                   configuration Vite
│  └─ zip/                     script de génération des zips (exclut les sources et node_modules)
├─ tests/
│  ├─ e2e/                     tests Playwright (sur le WordPress local)
│  └─ fixtures/                contenu de test (export WXR)
├─ .wp-env.json
├─ package.json
└─ docs/
```

- **Build :** Vite compile le TypeScript et le CSS de `packages/bureau-desktop` vers `themes/jchable-bureau/assets/dist/` avec un manifeste. Le PHP lit ce manifeste pour enregistrer les scripts avec leur numéro de version. Chaque appli est un fichier séparé, chargé par `import()` au lancement.
- **Développement local :** `wp-env` (Docker) avec WordPress 7.1, Jetpack, les deux thèmes montés et le jeu d'articles de test importé. PHP n'est pas installé sur la machine de Julien : tout ce qui demande PHP (Theme Check, WP-CLI) tourne dans le conteneur.
- **Commandes npm :** `dev` (Vite en mode surveillance + wp-env), `build`, `test` (Vitest), `test:e2e` (Playwright), `check` (Theme Check dans wp-env), `zip`.

## 3. Thème parent `jchable`

Un thème blocs complet et neutre, qui fonctionne aussi seul.

- **`theme.json` :**
  - `contentSize` 720px, `wideSize` 1320px ;
  - tailles de texte fluides ; espacements basés sur `clamp()` ;
  - une palette neutre que les thèmes enfants remplacent ;
  - les polices déclarées dans `fontFamilies` avec des fichiers woff2 **hébergés dans le thème** (aucun appel à Google Fonts).
- **Gabarits :** `index`, `home`, `single`, `page`, `archive`, `category`, `search`, `404`.
- **Morceaux de gabarit :** `header`, `footer`, `sidebar`.
- **Modèles :** article à la une, carte d'article, barre latérale (recherche, archives par mois, à propos), pagination.
- **`inc/` :**
  - chargement des thèmes enfants et des fichiers compilés via le manifeste Vite ;
  - compatibilité avec les commentaires Jetpack (vérifier que son formulaire remplace bien celui des blocs de commentaires ; prévoir une solution de repli sinon) ;
  - lien d'évitement « Aller au contenu » ;
  - `lang="fr-FR"`.
- **Règle :** aucun JavaScript n'est nécessaire pour lire le site.

## 4. Thème enfant `jchable-bureau`, sans JavaScript

Il reprend la maquette n°12.

### Identité visuelle

- **Couleurs :**
  - fond sarcelle `#2E6F6C` avec une trame de points ;
  - fenêtres `#F2F0EA` avec une bordure noire `#101010` de 2px et une ombre dure de 6px ;
  - couleur d'accent `#2D3FC8` (barre de titre de l'article à la une) ;
  - jaune `#FFE14D` et bleu ciel `#9AD0FF` pour les autres barres de titre.
- **Polices :** Chivo (titres et texte) et Chivo Mono (barres de titre, informations, barre des tâches), hébergées localement.
- **La fenêtre est un style de bloc.** Une variante « Fenêtre » du bloc Groupe porte la classe `is-style-window`. Une barre de titre (`.window-titlebar`) au début du groupe donne l'apparence d'une fenêtre : rayures, bleue, noire, jaune ou bleu ciel.

### Mise en page

- **Ordinateur (900px et plus)**, trois colonnes en flexbox avec retour à la ligne :
  - à gauche, la colonne d'icônes, environ 110px ;
  - au centre, le contenu ;
  - à droite, la barre latérale, environ 280px.
- **En dessous de 900px :** une seule colonne. Les icônes forment une rangée horizontale qui défile en haut de page.

### Les icônes du bureau

- Elles **sont le menu principal de WordPress** (bloc Navigation, géré dans l'admin).
- Chaque entrée de menu peut porter une classe CSS (`icon-folder`, `icon-text`, `icon-rss`, `icon-search`…) qui choisit son pictogramme SVG.
- La couche JavaScript y ajoute les icônes d'applis.

### Les gabarits

- **Accueil :**
  - fenêtre `bienvenue.txt` avec le titre et le slogan du site ;
  - l'article le plus récent dans une grande fenêtre à barre bleue, intitulée `<slug>.md — <date>` ;
  - les articles suivants dans des fenêtres à barre noire, sur 2 colonnes (grille auto-fit, 300px minimum) ;
  - la pagination sous forme de boutons rétro.
- **Article :**
  - une grande fenêtre intitulée `<slug>.md — <date>` ;
  - le texte en largeur de lecture (720px), les images, blocs de code et légendes en largeur « wide » ;
  - en dessous, une fenêtre « Commentaires » (Jetpack), puis les boutons « ◂ Précédent / Suivant ▸ ».
- **Page :** même principe, sans la date.
- **Archives, catégorie et recherche :** une fenêtre « Explorateur ».
  - Un tableau HTML liste les articles, colonnes Nom (`<slug>.md`), Date et Catégorie.
  - La barre d'adresse affiche `C:\Blog\Archives\2026\10`, ou la recherche en cours.
  - Sur mobile, le tableau défile horizontalement dans sa fenêtre.
- **404 :** un écran bleu plein écran, « Une erreur fatale est survenue à l'adresse /<chemin> », avec un lien « Appuyez sur une touche… » qui ramène à l'accueil. C'est du HTML et du CSS uniquement.

### Barre des tâches (pied de page)

- Bouton « ✦ Démarrer » : sans JavaScript, c'est un lien vers le plan du site (page Archives).
- Onglet de la page en cours (titre de la page).
- « © Julien Chable · WordPress ».
- Horloge : sans JavaScript, elle affiche l'année.

### Accessibilité

- Les fenêtres sont des `<section>` ou `<article>` dont le titre est un vrai titre HTML.
- Les pictogrammes décoratifs sont masqués aux lecteurs d'écran (`aria-hidden`).
- Contraste d'au moins 4,5:1.
- Focus visible : contour en pointillés, façon rétro.

## 5. La couche bureau : `packages/bureau-desktop`

- **Technique :** TypeScript sans framework. Le fichier principal pèse **moins de 15 Ko compressé** (cible) et se charge sur toutes les pages, en `defer`.
- **Mesures :** la taille de chaque fichier est contrôlée au build.
- **Configuration :** le PHP l'injecte via `wp_add_inline_script`, sous la forme `window.jchableBureau = { homeUrl, restUrl, locale, assetsUrl, doomDataUrl }`.

### 5.1 Gestionnaire de fenêtres

- **Ce qui devient déplaçable :** les fenêtres marquées `data-window="movable"` (barre latérale et applis). La fenêtre de l'article et celles de l'accueil **ne bougent pas**, pour ne pas gêner la lecture.
- **Interactions :**
  - déplacement par la barre de titre, à la souris ou au doigt, limité à la zone visible ;
  - un clic met la fenêtre au premier plan ;
  - boutons réduire (vers la barre des tâches), agrandir et fermer.
- **Clavier :**
  - à l'ouverture, le focus va dans la fenêtre ;
  - Échap ferme la fenêtre active et le focus revient sur l'élément qui l'a ouverte ;
  - les boutons de fenêtre sont de vrais `<button>` avec un `aria-label`.
- **Moins d'animations :** si le visiteur l'a demandé dans son système (`prefers-reduced-motion`), il n'y a ni animation d'ouverture ni écran de veille animé.
- **Mobile (moins de 900px) :** les applis s'ouvrent en plein écran et ne se déplacent pas.

### 5.2 Icônes du bureau déplaçables

- **Ordinateur :** le JavaScript transforme la colonne d'icônes en un calque qui couvre toute la zone visible, derrière les fenêtres. Les icônes y sont placées en position absolue sur une grille invisible (96 × 96px). Au départ, elles sont dans la colonne de gauche ; ensuite on peut les poser n'importe où.
  - Glisser-déposer à la souris ou au doigt, avec alignement sur la grille.
  - Si la case est occupée, l'icône va dans la case libre la plus proche.
- **Clavier :** les icônes sont focusables (ce sont les liens du menu ou des boutons). Maj + flèches déplace l'icône d'une case.
- **Ouverture :** un double-clic ouvre l'icône. Entrée ou un appui au doigt l'ouvrent aussi. Un simple clic sélectionne l'icône (surbrillance), comme sur un vrai bureau.
- **Réinitialisation :** un clic droit sur le bureau ouvre un menu contextuel « Réorganiser les icônes » et « Propriétés » (gag). La même action est disponible dans le menu Démarrer.
- **Mobile :** la rangée reste fixe, sans déplacement.

### 5.3 Préférences du visiteur

- **Où :** dans le `localStorage`, sous la clé `jchable-bureau:v1`. Les données restent sur la machine du visiteur et ne sont jamais envoyées au serveur.
- **Format :**
  ```
  {
    "icons":   { "<id>": { "col": 0, "row": 2 } },
    "windows": { "<id>": { "x": 0, "y": 0, "minimized": false } },
    "sound": true,
    "screensaver": true,
    "seen": { "messenger": "<date>" }
  }
  ```
- **Robustesse :**
  - Chaque lecture et chaque écriture passe par un `try/catch` : en navigation privée ou si le stockage est bloqué, on garde les valeurs par défaut en mémoire, sans erreur.
  - Une clé versionnée : une nouvelle version du format repart des valeurs par défaut.
  - Une position qui ne tient plus dans la fenêtre (écran plus petit) est replacée dans la zone visible.
- **Pourquoi pas un cookie :** un cookie serait envoyé au serveur à chaque requête et gênerait la mise en cache par Cloudflare. Il n'y a pas de bandeau de consentement à prévoir, car c'est une préférence que le visiteur règle lui-même.

### 5.4 Barre des tâches et menu Démarrer

- **Barre des tâches :** un onglet par fenêtre ouverte ou réduite, et une horloge qui affiche l'heure en direct (`HH:MM`).
- **Menu Démarrer :**
  - Programmes (les applis) ;
  - Documents (les 5 derniers articles, récupérés via `/wp/v2/posts?per_page=5&_fields=…`) ;
  - Accueil, À propos, RSS ;
  - Paramètres (son, écran de veille, réorganiser les icônes) ;
  - « Arrêter… » affiche l'écran « Vous pouvez maintenant éteindre votre ordinateur », et un clic recharge la page.

### 5.5 Comment une appli est déclarée

```ts
interface BureauApp {
  id: string;                 // "doom"
  title: string;              // "DOOM.EXE"
  icon: string;               // nom du pictogramme SVG
  defaultSize: { w: number; h: number };
  mobile: "fullscreen" | "unsupported";
  load(): Promise<{ mount(el: HTMLElement, ctx: AppContext): void | Promise<void>; unmount(): void }>;
}
```

- `load()` fait un `import()` dynamique : le code de l'appli n'est téléchargé qu'au premier lancement.
- `AppContext` donne accès à la configuration, aux préférences, à l'ouverture d'autres applis ou d'un écran bleu, et au son.
- **En cas d'échec** (chargement ou affichage), une boîte d'erreur rétro s'affiche, par exemple « DOOM.EXE a cessé de fonctionner », avec un bouton Fermer. Le reste de la page n'est pas affecté.

### 5.6 Les applis de la v1

| Appli | Contenu | Notes |
|---|---|---|
| **DOOM.EXE** | Chocolate Doom compilé en WebAssembly (port GPL) + l'épisode shareware `doom1.wad` (environ 4 Mo). Freedoom Phase 1 (licence BSD) en secours. | Le moteur et les données du jeu **ne sont pas dans le zip du thème** : ils sont dans `wp-content/uploads/jchable-bureau/doom/` (adresse réglable par le filtre `jchable_bureau_doom_data_url`). Une barre de progression s'affiche pendant le chargement. Le jeu capture le clavier tant que sa fenêtre est active ; Échap le met en pause. Sur mobile : `unsupported`, avec le message « Clavier requis ». À vérifier au moment du plan : la licence exacte du port WASM choisi et les conditions de redistribution du shareware. |
| **Messagerie** (inspirée d'ICQ) | Fenêtre de chat. Les **derniers commentaires approuvés** (`/wp/v2/comments?per_page=10`) arrivent comme des messages entrants : auteur, extrait, lien vers l'article. Bouton « Répondre » vers le formulaire de commentaire de l'article. | Nom maison (« Oh-Oh! Messenger »), sans le nom ni le logo ICQ. Son « oh-oh » créé pour le projet (WebAudio ou fichier libre), joué seulement après une interaction du visiteur et si le son est activé. Une notification au chargement s'il y a de nouveaux commentaires depuis la dernière visite (`seen.messenger`). |
| **WORDPAD.EXE** | Éditeur `contenteditable` avec barre d'outils : gras, italique, souligné, police, taille, couleur, alignement. S'ouvre sur `lisez-moi.rtf` (présentation du blog ; sur un article : son titre et son lien). « Enregistrer sous… » télécharge un fichier `.html` ou `.txt` via un `Blob`. « Nouveau » vide le document. | Le contenu collé est nettoyé (texte seul ou balises autorisées). Le brouillon est gardé dans le `localStorage`. Pas d'envoi au serveur en v1 ; « Envoyer à Julien » est une option pour plus tard. |
| **Démineur** | 3 niveaux (9×9 avec 10 mines, 16×16 avec 40, 30×16 avec 99). Le premier clic n'est jamais une mine. Clic droit ou appui long pour poser un drapeau, chronomètre, visage qui réagit. | Logique pure (génération, propagation des cases vides) testée avec Vitest. |
| **Terminal** | Invite `C:\Blog>`. Commandes : `help`, `ls` (derniers articles), `cat <slug>` (ouvre l'article), `cd archives`, `whoami`, `date`, `clear`, `doom`, `wordpad`, `exit`. `sudo rm -rf /` ou `format c:` affichent l'écran bleu. | Lecture des commandes en fonctions pures, testées. Historique avec les flèches haut et bas. |
| **Corbeille** | Liste de faux « brouillons supprimés » humoristiques, écrits en dur (à valider par Julien). « Vider la corbeille » joue une animation et un son. | Le texte des gags est à fournir ou relire par Julien avant la sortie. |
| **Écran de veille** | Après 2 minutes sans activité (ordinateur uniquement) : un logo « JC » rebondit sur un champ d'étoiles (canvas). Toute action le ferme. | Désactivé si le visiteur a demandé moins d'animations, ou via les Paramètres. Création originale, pas une reprise d'écrans de veille existants. |

## 6. Gestion des erreurs

- Une erreur dans une appli reste dans sa fenêtre (boîte d'erreur rétro) ; le blog continue de fonctionner.
- Erreur de l'API REST (Messagerie, Documents, `ls`) : un message en ligne (« Impossible de joindre le serveur »), sans nouvelle tentative en boucle.
- Si le fichier principal ne se charge pas, le site reste le thème de base sans JavaScript, entièrement fonctionnel.
- Stockage local indisponible : préférences en mémoire seulement (§5.3).

## 7. Tests

- **Vitest :** préférences (lecture, écriture, versions, replacement dans la zone visible), grille des icônes (alignement, collisions), pile des fenêtres, lecture des commandes du terminal, logique du démineur, nettoyage du WordPad.
- **Playwright** (sur wp-env, à 1440px, 768px et 390px) :
  - accueil, article, archives, recherche et 404 s'affichent ; pas de défilement horizontal de la page ;
  - le site reste lisible avec JavaScript désactivé ;
  - ouvrir, déplacer, réduire, restaurer et fermer une fenêtre ;
  - déplacer une icône, recharger la page et retrouver sa position ; « Réorganiser les icônes » remet la disposition d'origine ;
  - aucune requête vers les fichiers de DOOM avant le clic sur DOOM.EXE ;
  - WordPad : « Enregistrer sous » déclenche bien un téléchargement ;
  - Terminal : `ls` affiche les articles de test.
- **axe** (`@axe-core/playwright`) sur chaque gabarit : aucune violation sérieuse ou critique.
- **Theme Check** dans wp-env sur `jchable` et `jchable-bureau`.

## 8. Livraison par étapes

1. Socle : dépôt npm, wp-env, contenu de test, build, zips, thème parent `jchable`.
2. `jchable-bureau` sans JavaScript (§4).
3. Couche bureau : fenêtres, icônes déplaçables, préférences, barre des tâches et menu Démarrer (§5.1 à 5.4).
4. Applis, une par une : Terminal, Démineur, WordPad, Messagerie, Corbeille, Écran de veille, DOOM.
5. Mise en production : zips, données DOOM copiées dans `uploads/`, vérification sur le vrai site.

Chaque étape se termine sur quelque chose qu'on peut installer et tester.

## 9. Risques et points ouverts

- **Commentaires Jetpack dans un thème blocs :** compatibilité à vérifier dès l'étape 1.
- **Port WASM de DOOM :** choisir lequel (licence, taille, gestion du clavier) au moment du plan.
- **Shareware DOOM :** confirmer les conditions de redistribution, sinon utiliser Freedoom.
- **Textes des gags** (Corbeille, écran bleu, Propriétés) : à valider par Julien.
- **Nom de la messagerie :** « Oh-Oh! Messenger » est provisoire.
- **Renommage du dépôt** (`wp-theme-vanhalen`) : décidé par Julien plus tard ; sans impact sur le code.
