# Thèmes WordPress de julien.chable.net

Thèmes blocs pour https://julien.chable.net : un parent `jchable` et un enfant par design (`jchable-bureau`, puis `jchable-swiss`, `jchable-pixel`, `jchable-arcade`, `jchable-console`).

Conception : `docs/superpowers/specs/2026-10-16-jchable-themes-bureau-design.md`.

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
| `npm run test:e2e` | tests Playwright (desktop, tablette, mobile) |
| `npm run test:tools` | tests des scripts Node |
| `npm run check` | Theme Check sur le thème parent |
| `npm run zip` | génère `dist/<thème>.zip` pour chaque thème |

## Organisation

```
themes/jchable/      thème parent : theme.json, gabarits, blocs dynamiques
tools/env/           contenu de test
tools/check/         Theme Check
tools/zip/           génération des zips
tests/e2e/           tests Playwright
```

## Langue des articles

Le site est en français. Pour un article écrit dans une autre langue, ajouter le champ personnalisé `jchable_lang` (par exemple `en`) : le contenu de l'article reçoit alors l'attribut `lang` correspondant.

## Installer un thème sur le blog

1. `npm run zip`
2. Dans l'admin : Apparence › Thèmes › Ajouter › Téléverser un thème, puis choisir `dist/jchable.zip`.
3. Activer le thème, puis ouvrir Apparence › Éditeur › Navigation et **choisir ou créer le menu principal** (Accueil, À propos…). Sans menu choisi, WordPress en fabrique un automatiquement à partir des pages, et sa structure de listes peut être invalide pour l'accessibilité.
4. Vérifier un article avec commentaires (le formulaire Jetpack remplace-t-il bien celui de WordPress ?), l'accueil, une recherche et une page 404.
