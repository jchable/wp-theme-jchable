# Thèmes WordPress de julien.chable.net

Thèmes blocs pour https://julien.chable.net : un parent `jchable` et un enfant par design. Le premier design livré est **Bureau** (`jchable-bureau`) : le blog habillé en bureau d'ordinateur rétro, avec des fenêtres, des icônes déplaçables, une barre des tâches et des applis (Terminal, Démineur, WordPad, messagerie « Oh-Oh! », Corbeille, DOOM).

- Conception : `docs/superpowers/specs/2026-10-16-jchable-themes-bureau-design.md`
- Mise en production : `docs/deploiement.md`

## Prérequis

- Node 22 ou plus récent
- Docker Desktop (WordPress local via `@wordpress/env`)

PHP n'est pas nécessaire sur la machine : WP-CLI et PHP tournent dans le conteneur.

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
| `npm run test:e2e` | tests Playwright du thème parent (active `jchable`) |
| `npm run test:e2e:bureau` | tests Playwright du thème Bureau (active `jchable-bureau`) |
| `npm run check -- <thème>` | Theme Check (`jchable` ou `jchable-bureau`) ; `npm run check:all` pour les deux |
| `npm run zip` | compile le JS puis génère `dist/<thème>.zip` pour chaque thème ; `npm run zip -- --no-doom` fabrique `jchable-bureau-sans-doom.zip` (léger) |

Les deux suites Playwright partagent le même WordPress local : on ne les lance pas en même temps. Chacune active son thème avant de tourner ; à la fin, le thème de la dernière suite lancée reste actif.

## Organisation

```
themes/jchable/             thème parent : theme.json, gabarits, blocs dynamiques
themes/jchable-bureau/      thème enfant Bureau : gabarits, parties, blocs, CSS, polices, icônes
  assets/dist/              JS compilé (généré, non versionné)
  assets/doom/              moteur WebAssembly et données de DOOM (voir son README)
packages/bureau-desktop/    code TypeScript du bureau interactif
  src/core/                 préférences, grille des icônes, fenêtres, sons, registre des applis
  src/ui/                   icônes du bureau, barre des tâches, menu Démarrer, écran de veille…
  src/apps/<appli>/         une appli par dossier, chargée seulement à son lancement
tools/                      contenu de test, Theme Check, polices, zips
tests/e2e/                  tests Playwright du thème parent
tests/e2e-bureau/           tests Playwright du thème Bureau
docs/                       spec, plans et guide de déploiement
```

## Langue des articles

Le site est en français. Pour un article écrit dans une autre langue, ajouter le champ personnalisé `jchable_lang` (par exemple `en`) : le contenu de l'article reçoit alors l'attribut `lang` correspondant.

## Langue de l'interface (français / anglais)

Les textes du thème et des applis existent en français et en anglais, sans plugin. La langue suit le navigateur du visiteur (français pour les navigateurs français, anglais pour tous les autres), et il peut la changer dans le menu Démarrer › Langue (Automatique, Français, English) ; son choix est mémorisé. Le contenu des articles et des pages n'est jamais traduit : il reste dans sa langue d'origine.

Pour ajouter ou corriger un texte : chaque appli a son fichier `i18n.ts` (`src/apps/<appli>/i18n.ts`), le cœur du bureau `src/core/ui-i18n.ts`, et les textes écrits dans les gabarits PHP/HTML sont traduits par `src/ui/chrome.ts`. Un test vérifie que chaque texte existe dans les deux langues.

## Données du visiteur

Le bureau mémorise, dans le **localStorage du navigateur du visiteur** (clé `jchable-bureau:v1`), la position des icônes et des fenêtres, la langue, l'activation du son et de l'écran de veille, et le brouillon du WordPad. Rien n'est envoyé au serveur. Si le stockage est bloqué, tout fonctionne en mémoire.

## Installer sur le blog

Voir `docs/deploiement.md` (zips, menu, vérifications, retour en arrière).
