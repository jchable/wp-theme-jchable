# jchable : thèmes WordPress pour julien.chable.net

Thèmes blocs WordPress pour le blog https://julien.chable.net : un thème parent, `jchable`, et un thème enfant par design. Le premier design livré s'appelle **Bureau** (`jchable-bureau`) : le blog habillé en bureau d'ordinateur rétro, avec des fenêtres, des icônes déplaçables, une barre des tâches, un menu Démarrer, un écran bleu pour la page 404 et des applis cachées dans le blog.

Le blog reste un vrai blog : les articles, les pages, les commentaires, le flux RSS et la recherche fonctionnent sans JavaScript. Le bureau interactif s'ajoute par-dessus, sur grand écran.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Compiler et déployer sur votre site](#compiler-et-déployer-sur-votre-site)
- [Développer en local](#développer-en-local)
- [Commandes](#commandes)
- [Tests](#tests)
- [Organisation du dépôt](#organisation-du-dépôt)
- [Configurer le site](#configurer-le-site)
- [Langue](#langue)
- [Préférences et écrans de veille](#préférences-et-écrans-de-veille)
- [Étendre le bureau](#étendre-le-bureau)
- [Données du visiteur](#données-du-visiteur)
- [Dépannage](#dépannage)
- [Licences et crédits](#licences-et-crédits)
- [Documentation](#documentation)

## Fonctionnalités

**Le blog**
- Thème bloc (Site Editor) : modèles accueil, article, page, archives, recherche, 404 et « Plan du site ».
- Accueil en fenêtres, articles et pages dans une fenêtre `nom-de-l-article.md`, commentaires dans `commentaires.log`, explorateur de fichiers pour les archives et la recherche.
- Responsive : sur téléphone, pas de bureau d'icônes, le menu Démarrer donne accès à tout.
- Accessible (contrôles axe automatisés, navigation au clavier, lien d'évitement) et lisible sans JavaScript.

**Le bureau interactif** (grand écran, JavaScript)
- Icônes déplaçables dans une bande à gauche, qui s'adapte à la largeur de l'écran et n'est jamais recouverte ; leur place est mémorisée.
- Fenêtres déplaçables, réductibles, agrandissables (le bouton devient « Restaurer » quand la fenêtre est agrandie) et fermables avec Échap.
- Barre des tâches avec bouton Démarrer, onglets des fenêtres ouvertes, raccourcis vers le plan du site et le flux RSS, et horloge.
- Menu Démarrer : programmes, derniers articles, liens du blog, préférences, arrêt.
- Pages « À propos » et autres pages du menu ouvertes dans une fenêtre, sans quitter la page.
- Fenêtre **Préférences** : écran de veille, langue, son, rangement des icônes.
- Quatre **écrans de veille 3D** (tunnel néon, fenêtres flottantes, graphe de connaissances, bureau en voxels).

**Les applis** : Terminal, Démineur, WordPad (qui peut partir de l'article en cours), messagerie « Oh-Oh! » (les derniers commentaires du blog), Corbeille, DOOM jouable (WebAssembly), Propriétés système et Préférences.

**Interface bilingue** français / anglais, sans plugin. Le contenu des articles n'est jamais traduit.

## Prérequis

| Pour… | Il faut |
|---|---|
| **Compiler les zips** | Node 22 ou plus récent et Git (correctif de compatibilité des outils WordPress) |
| **Faire tourner le site** | WordPress 6.7 ou plus (testé avec 7.1), PHP 8.1 ou plus |
| **Développer en local** | Node 22+, Git et Docker Desktop (WordPress local via `@wordpress/env`) |

PHP n'est pas nécessaire sur votre machine : WP-CLI et PHP tournent dans le conteneur Docker.

## Compiler et déployer sur votre site

Le déploiement se fait par zips, sans rien modifier tant que vous n'activez pas le thème. Le guide détaillé est dans [`docs/deploiement.md`](docs/deploiement.md).

### 1. Fabriquer les zips

```bash
npm ci
npm audit
npm run zip
```

Cela compile le JavaScript puis produit, dans `dist/` :

| Fichier | Contenu | Taille |
|---|---|---|
| `jchable.zip` | thème parent | ≈ 80 Ko |
| `jchable-bureau.zip` | thème enfant, JavaScript compilé et DOOM compris | ≈ 3 Mo |

Le thème Bureau a besoin du parent : installez les deux.

Si votre hébergeur limite le téléversement à 2 Mo (voir Médias › Ajouter), fabriquez la version légère :

```bash
npm run zip -- --no-doom
```

Elle produit `dist/jchable-bureau-sans-doom.zip` (≈ 290 Ko) sans DOOM. Copiez alors par SFTP le dossier `themes/jchable-bureau/assets/doom/` du dépôt vers `wp-content/themes/jchable-bureau/assets/doom/` sur le serveur. Attention : WordPress remplace tout le dossier du thème à chaque mise à jour, donc il faut recopier ce dossier après chaque mise à jour faite avec la version légère.

### 2. Installer sans activer

1. Dans l'admin WordPress : **Apparence › Thèmes › Ajouter › Téléverser un thème**. Envoyez `jchable.zip`, puis `jchable-bureau.zip`. **N'activez pas.**
2. Si WordPress refuse le fichier (trop gros), utilisez la version légère ou téléversez par SFTP le dossier `jchable-bureau/` extrait du zip dans `wp-content/themes/`. Ne copiez pas le dossier du dépôt : il ne contient le JavaScript compilé (`assets/dist/`) qu'après `npm run build:js`.
3. Sur la carte « jchable Bureau », cliquez sur **Aperçu en direct**. L'aperçu ne change rien pour les visiteurs.

### 3. Vérifier dans l'aperçu

Ce que le test local ne peut pas vérifier se contrôle sur le vrai site (liste complète au §3 du guide) :

- **Commentaires** : le formulaire s'affiche et fonctionne (celui de Jetpack ou celui de WordPress).
- **Menu** : choisissez ou créez le menu principal dans Apparence › Éditeur › Navigation.
- **Plan du site** : créez une page avec le modèle « Plan du site ».
- **DOOM** : double-clic sur DOOM.EXE ; le jeu affiche son écran titre.
- **Messagerie** : elle lit `/wp-json/wp/v2/comments`, qui ne doit pas être bloquée (plugin de sécurité, Cloudflare).
- **Cloudflare** : si le bureau ne démarre pas, désactivez Rocket Loader et la minification JavaScript pour ce site (le bureau est un module `<script type="module">`).

### 4. Activer, et revenir en arrière si besoin

- **Activer** : Apparence › Thèmes › **Activer** « jchable Bureau », puis vérifiez l'accueil, un article et une recherche. Videz le cache Cloudflare si besoin.
- **Revenir en arrière** : réactivez le thème précédent (par exemple Twenty Eleven). Rien d'autre n'est modifié sur le site.

### 5. Mettre à jour

Modifiez le dépôt, lancez les tests (voir [Tests](#tests)), refaites `npm run zip` et téléversez le nouveau zip : WordPress propose de remplacer la version installée.

## Développer en local

```bash
npm ci
npm run env:start     # WordPress sur http://localhost:8888 (admin / password)
npm run env:seed      # contenu de test, une seule fois
npm run build:js      # compile le bureau interactif
```

Puis activez « jchable Bureau » dans http://localhost:8888/wp-admin. Pour tout remettre à zéro : `npm run env:reset`. Pour arrêter : `npm run env:stop`.

Le code du bureau est en TypeScript (Vite). `npm run build:js` doit être relancé après chaque modification du code de `packages/bureau-desktop/` ; les gabarits, CSS et PHP du thème, eux, se rechargent directement.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run env:start` | démarre WordPress sur http://localhost:8888 (admin / password) |
| `npm run env:seed` | crée le contenu de test (une seule fois) |
| `npm run env:reset` | remet WordPress à zéro et recrée le contenu de test |
| `npm run env:stop` | arrête WordPress |
| `npm run build:js` | compile le bureau interactif vers `themes/jchable-bureau/assets/dist/` |
| `npm run typecheck` | vérifie les types TypeScript |
| `npm run test:unit` | tests unitaires (Vitest) du bureau et des applis |
| `npm run test:tools` | tests des scripts Node |
| `npm run test:security:php` | contrôles des permissions REST, métadonnées et échappement sur le WordPress local de test |
| `npm run test:e2e` | tests Playwright du thème parent (active `jchable`) |
| `npm run test:e2e:bureau` | tests Playwright du thème Bureau (active `jchable-bureau`) |
| `npm run check -- <thème>` | Theme Check (`jchable` ou `jchable-bureau`) ; `npm run check:all` pour les deux |
| `npm run demo:video` | filme le bureau (Terminal, DOOM, Démineur, écrans de veille, 404) et écrit `dist/demo/bureau-demo.mp4` ; demande WordPress local démarré et ffmpeg |
| `npm run zip` | compile le JS puis génère `dist/<thème>.zip` pour chaque thème ; `npm run zip -- --no-doom` fabrique `jchable-bureau-sans-doom.zip` (léger) |

## Tests

Installer avec `npm ci` : le verrouillage et les correctifs de sécurité sont versionnés. Le script
`postinstall` applique le patch de compatibilité de `@wordpress/env` avec `simple-git` 4 ;
il échoue explicitement si le patch ne correspond plus à la version installée.
Après une installation avec `--ignore-scripts`, lancer `npm run postinstall`.
Les overrides de `simple-git`, `argparse` et `qs` corrigent les avis npm de l'outillage ;
les tests des outils vérifient le clonage Git local et la compatibilité de js-yaml.
Le runtime Docker reste celui utilisé ici ; le runtime Playground optionnel de wp-env
annonce des prérequis Node/npm plus récents et n'est pas validé avec Node 22.

Avant de livrer une version :

```bash
npm audit
npm run typecheck
npm run test:unit
npm run test:tools
npm run test:security:php
npm run check:all
npm run test:e2e
npm run test:e2e:bureau
```

Les tests Playwright tournent à trois tailles (ordinateur 1440 px, tablette 768 px, téléphone 390 px), en français par défaut (l'anglais est testé explicitement), avec des contrôles d'accessibilité axe.

Les deux suites Playwright (`test:e2e` pour le parent et `test:e2e:bureau`) partagent le même WordPress local : on ne les lance pas en même temps. Chacune active son thème avant de tourner, et le thème de la dernière suite lancée reste actif ; relancez donc `test:e2e:bureau` en dernier pour laisser `jchable-bureau` actif.

## Organisation du dépôt

```
themes/jchable/             thème parent : theme.json, gabarits, blocs dynamiques
themes/jchable-bureau/      thème enfant Bureau : gabarits, parties, blocs, CSS, polices, icônes
  assets/dist/              JS compilé (généré, non versionné)
  assets/doom/              moteur WebAssembly et données de DOOM (voir son README)
packages/bureau-desktop/    code TypeScript du bureau interactif
  src/core/                 préférences, grille des icônes, fenêtres, sons, registre des applis
  src/ui/                   icônes du bureau, barre des tâches, menu Démarrer, écrans de veille…
  src/apps/<appli>/         une appli par dossier, chargée seulement à son lancement
tools/                      contenu de test, Theme Check, polices, zips
tests/e2e/                  tests Playwright du thème parent
tests/e2e-bureau/           tests Playwright du thème Bureau
docs/                       conception, plans et guide de déploiement
dist/                       zips générés (non versionnés)
```

## Configurer le site

- **Menu et icônes** : les icônes du bureau viennent du menu de navigation du site (géré dans l'admin). Pour choisir l'icône d'une entrée, ajoutez-lui une classe CSS : `icon-text` (document), `icon-folder-blue` (dossier bleu) ou `icon-folder` (dossier jaune, par défaut).
- **Plan du site** : créez une page avec le modèle « Plan du site ». Son raccourci apparaît dans la barre des tâches, à côté de l'heure, avec celui du flux RSS ; ils ne sont pas dans la bande d'icônes.
- **Langue d'un article** : le site est en français. Pour un article écrit dans une autre langue, ajoutez le champ personnalisé `jchable_lang` (par exemple `en`) : le contenu reçoit alors l'attribut `lang` correspondant.

## Langue

Les textes du thème et des applis existent en français et en anglais. La langue suit le navigateur du visiteur (français pour les navigateurs français, anglais pour tous les autres) ; il peut la changer dans **Préférences** ou dans le menu Démarrer › Langue (Automatique, Français, English), et son choix est mémorisé. Le contenu des articles et des pages n'est jamais traduit.

Pour ajouter ou corriger un texte : chaque appli a son fichier `src/apps/<appli>/i18n.ts`, le cœur du bureau est dans `src/core/ui-i18n.ts`, et les textes écrits dans les gabarits PHP/HTML sont traduits par `src/ui/chrome.ts`. Un test vérifie que chaque texte existe dans les deux langues.

## Préférences et écrans de veille

Menu Démarrer › **Préférences…** (ou clic droit sur le bureau) ouvre une fenêtre de réglages : écran de veille (choix de la scène avec aperçu plein écran, activation automatique, délai de 1 à 30 minutes), langue, son et rangement des icônes. Les réglages sont un brouillon : ils ne s'appliquent (et la page ne se recharge pour la langue) qu'au clic sur **Enregistrer** ; **Fermer** les abandonne. Ils sont mémorisés dans le navigateur.

Quatre écrans de veille, dessinés sur un canevas 2D avec une 3D logicielle maison (aucune dépendance, pas de WebGL) :

| Scène | Rendu |
|---|---|
| **Tunnel néon** (par défaut) | un vol dans un tunnel de grilles lumineuses, avec un « JC » en 3D au bout |
| **Fenêtres flottantes** | des fenêtres du bureau, avec les titres de vos derniers articles, qui dérivent dans l'espace |
| **Graphe de connaissances** | un graphe 3D de sujets et d'articles, vu en orbite |
| **Bureau en voxels** | un petit bureau en cubes dont l'écran s'allume |

L'écran de veille automatique ne se lance que sur l'accueil, les archives et la 404, jamais avec « moins d'animations ». Une scène qui ne peut pas se charger laisse un simple ciel bleu.

## Étendre le bureau

**Ajouter une appli** : créez `packages/bureau-desktop/src/apps/<id>/index.ts` (elle exporte `mount` et `unmount`) et son `i18n.ts`, déclarez-la dans `src/core/registry.ts` (taille, icône, comportement sur mobile) et ajoutez son titre dans `src/core/ui-i18n.ts`. Elle n'est téléchargée qu'à son premier lancement. Les tests d'une appli utilisent un faux contexte (`AppContext`, défini dans `src/core/types.ts`).

**Ajouter un écran de veille** : créez `src/ui/screensaver/scenes/<id>.ts` qui exporte `create: SceneFactory` (voir `scenes/types.ts` et `scenes/math3d.ts`), inscrivez-le dans `catalog.ts` (nom et description en français et en anglais) et `loader.ts`, puis testez-le avec `expectSceneConforms` (`scenes/testing.ts`) : il vérifie les tailles extrêmes, les valeurs finies et le déterminisme. Tout le hasard passe par `context.rng`.

**Ajouter un design** : créez un nouveau thème enfant dans `themes/` qui déclare `jchable` comme parent ; les autres designs prévus (Swiss, Pixel Pro, Arcade, Console) suivront la même structure.

## Données du visiteur

Le bureau mémorise, dans le **localStorage du navigateur du visiteur** (clé `jchable-bureau:v1`), la position des icônes et des fenêtres, la langue, le son, l'écran de veille choisi et son délai, et le brouillon du WordPad. Rien n'est envoyé au serveur. Si le stockage est bloqué, tout fonctionne en mémoire.

Ces données servent uniquement à une fonction demandée par le visiteur et restent sur son appareil : à notre avis, elles entrent dans l'exemption de consentement de la directive ePrivacy (ce n'est pas un avis juridique). Une phrase dans votre page de confidentialité suffit.

Les contrôles de sécurité, leurs limites et les précautions de production sont décrits dans
[le guide de déploiement](docs/deploiement.md#9-sécurité-et-limites-de-laudit).

## Dépannage

| Symptôme | Piste |
|---|---|
| Aucune icône, le bureau ne démarre pas | Désactivez Rocket Loader et la minification JavaScript de Cloudflare ; vérifiez que `assets/dist/bureau.js` est bien dans le thème installé |
| CSS ou JS qui paraît ancien | Videz le cache Cloudflare (les fichiers sont versionnés avec `?ver=`) |
| « DOOM.EXE a cessé de fonctionner » | Ouvrez « Détails techniques » : vérifiez HTTPS, CORS et l'intégrité des fichiers, sans redirection ni minification par le CDN. Une CSP stricte peut bloquer le jeu : ne l'affaiblissez pas globalement (voir §9 du guide) |
| La messagerie affiche « Impossible de joindre le serveur » | L'API REST (`/wp-json/wp/v2/comments`) est bloquée |
| Le zip est refusé par WordPress | Utilisez `npm run zip -- --no-doom` ou le téléversement SFTP |
| Les tests Playwright échouent après une autre suite | Le mauvais thème est actif : relancez la suite voulue (elle active son thème) |
| Plus de contenu de test en local | `npm run env:reset` |

## Licences et crédits

- Thèmes jchable : © Julien Chable, sous licence GNU GPL version 2 ou ultérieure. Le texte complet est dans [`LICENSE`](LICENSE), et chaque thème en embarque une copie (`themes/*/license.txt`, incluse dans les zips) ; la licence est aussi déclarée dans l'en-tête de `themes/*/style.css`.
- Polices Chivo et Chivo Mono : SIL OFL 1.1 (fichier fourni dans `themes/jchable-bureau/assets/fonts/`).
- DOOM : moteur WebAssembly (projet cloudflare/doom-wasm, GPL) et données ; licences, lien vers le code source et offre écrite dans `themes/jchable-bureau/assets/doom/README.md`, et panneau « À propos de DOOM » dans la fenêtre du jeu.
- Wipeout : non inclus (reporté).

## Documentation

- Guide de mise en production : [`docs/deploiement.md`](docs/deploiement.md)
- Conception du thème Bureau : [`docs/superpowers/specs/2026-10-16-jchable-themes-bureau-design.md`](docs/superpowers/specs/2026-10-16-jchable-themes-bureau-design.md)
- Plans d'implémentation : `docs/superpowers/plans/`
