# DOOM.EXE — moteur et données

Fichiers servis par `doomBaseUrl` (par défaut `…/themes/jchable-bureau/assets/doom/`, modifiable
par le filtre PHP `jchable_bureau_doom_data_url`) et chargés **seulement** quand le visiteur lance
DOOM.EXE (code : `packages/bureau-desktop/src/apps/doom/`).

| Fichier | Rôle | Taille | SHA-256 |
|---|---|---|---|
| `websockets-doom.js` | glue JavaScript Emscripten du moteur | 196 367 o | `4a95abfaa5d63d0f7adf95f73f276db44327973ec100a9e6e7af6b96afdd9fb6` |
| `websockets-doom.wasm` | moteur Chocolate Doom compilé en WebAssembly | 2 250 555 o | `70f56410fb147727e4dd03385cddb20ecedc5bd5773b7820fcffe39435a5f81e` |
| `doom1.wad` | données du jeu : DOOM shareware v1.9, épisode 1 | 4 196 020 o | `1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771` (SHA-1 `5b2e249b9c5133ec987b3ea77596381dc0d6bc1d`) |
| `LICENSE-GPL-2.0.txt` | licence du moteur (Chocolate Doom / doom-wasm) | | |
| `LICENSE-zlib-SDL2.txt` | licence de SDL2, SDL2_mixer, SDL2_net compilés dans le moteur | | |
| `LICENSE-Emscripten-MIT-NCSA.txt` | licence du code d'exécution Emscripten inclus dans le .js/.wasm | | |
| `LICENSE-DOOM1-SHAREWARE.txt` | provenance et conditions de `doom1.wad` | | |

Total ≈ 6,3 Mo (moins de 2 Mo de moteur ; le serveur compresse en plus le .js et le .wasm).

## Choix du moteur

**Retenu : [cloudflare/doom-wasm](https://github.com/cloudflare/doom-wasm)** (portage Emscripten de
Chocolate Doom 3, GPL-2.0), **compilé depuis les sources** dans le conteneur Docker officiel
`emscripten/emsdk`.

Pourquoi :

- moteur fidèle (Chocolate Doom), clavier et bruitages déjà branchés via SDL2 ;
- **sans thread ni SharedArrayBuffer** (`USE_PTHREADS=0`, boucle par `ASYNCIFY`) : fonctionne sur une
  page statique classique, sans en-têtes COOP/COEP ;
- aucune requête réseau à l'exécution en solo : le multijoueur WebSocket n'est activé qu'avec
  `-connect`, que l'appli ne passe jamais ;
- reconstructible à l'octet près (vérifié : deux compilations successives donnent les mêmes SHA-256).

Écartés : PureDOOM (en-tête unique, mais il faudrait écrire et maintenir toute la couche
plateforme : image, clavier, son) ; binaires précompilés tiers (provenance moins nette).

Limites connues :

- **pas de musique** (`-nomusic`) : l'initialisation de la musique (émulation OPL via SDL_mixer)
  bloque le fil principal dans ce portage. Les bruitages fonctionnent ;
- souris désactivée (`-nomouse`), clavier seulement ;
- le moteur ne sait pas redémarrer : l'appli l'exécute dans une `<iframe sandbox>` jetable,
  retirée à la fermeture de la fenêtre.

## Versions exactes

- Source : `https://github.com/cloudflare/doom-wasm`, commit
  `65e0d3ae2ffa604155eebd96ed40da6567bd08f4` (19/09/2024).
- Chaîne : image Docker `emscripten/emsdk:3.1.74`
  (`sha256:af45409f3199d88db4b1b03af0098532c8fb33a375ac257463eeb0a622870d06`),
  emcc 3.1.74 (`1092ec30a3fb1d46b1782ff1b4db5094d3d06ae5`).
- Bibliothèques (ports Emscripten) : SDL2 `release-2.30.9`, SDL2_mixer `release-2.8.0`,
  SDL2_net `version_2`.

Deux changements par rapport au dépôt d'origine, appliqués par `sed` dans la commande de build :

1. **Options de compilation** (`EMFLAGS` de `configure.ac`) : retrait des options de débogage
   (`SAFE_HEAP`, `STACK_OVERFLOW_CHECK`, cartes source), remplacement des options supprimées des
   Emscripten récents (`EXTRA_EXPORTED_RUNTIME_METHODS` → `EXPORTED_RUNTIME_METHODS`,
   `TOTAL_MEMORY` → `INITIAL_MEMORY`), `ENVIRONMENT=web`, `-g0`.
2. **`src/doomtype.h`** : `typedef bool boolean;` → `typedef int boolean;`. Avec Emscripten 3.1.x,
   certains fichiers incluent `<stdbool.h>` (via `emscripten.h`) et d'autres non : `boolean` faisait
   alors 1 octet ici et 4 octets là, ce qui cassait le jeu (joueurs fantômes « Player 4 left the
   game », écran figé). `int` a la taille de l'énumération utilisée ailleurs ; le code de Doom
   s'appuie sur ce comportement (valeurs -1 dans des champs `boolean`).

Les sources modifiées correspondantes = le commit ci-dessus + ces deux `sed` : c'est la « source
correspondante » exigée par la GPL pour les binaires distribués ici.

## Reconstruire le moteur

Depuis la racine du dépôt (bash ; sous Git Bash Windows, préfixer par `MSYS_NO_PATHCONV=1`) :

```bash
docker run --rm -v "$PWD/themes/jchable-bureau/assets/doom:/out" emscripten/emsdk:3.1.74 bash -euo pipefail -c '
apt-get update -qq && apt-get install -y -qq autoconf automake pkg-config >/dev/null
git clone -q https://github.com/cloudflare/doom-wasm.git /tmp/doom-wasm && cd /tmp/doom-wasm
git checkout -q 65e0d3ae2ffa604155eebd96ed40da6567bd08f4
sed -i "s|^EMFLAGS=.*|EMFLAGS=\"-s USE_SDL=2 -s USE_SDL_MIXER=2 -s USE_SDL_NET=2 -s FORCE_FILESYSTEM=1 -s EXPORTED_RUNTIME_METHODS=[FS,callMain] -s EXIT_RUNTIME=1 -s INITIAL_MEMORY=64MB -s ALLOW_MEMORY_GROWTH=0 -s ERROR_ON_UNDEFINED_SYMBOLS=0 -s ASYNCIFY -s ENVIRONMENT=web -O3 -g0\"|" configure.ac
sed -i "s/^typedef bool boolean;/typedef int boolean;/" src/doomtype.h
emconfigure autoreconf -fi
ac_cv_exeext=".html" emconfigure ./configure --host=none-none-none
emmake make -j"$(nproc)"
cp src/websockets-doom.js src/websockets-doom.wasm /out/'
sha256sum themes/jchable-bureau/assets/doom/websockets-doom.*
```

Les SHA-256 doivent être ceux du tableau. Si la taille du `.wasm` ou du `.js` change, mettre à jour
`EXPECTED_SIZES` dans `packages/bureau-desktop/src/apps/doom/loader.ts` (sert à la barre
d'avancement quand le serveur n'envoie pas de `Content-Length`).

## Comment l'appli s'en sert

1. Télécharge en parallèle `websockets-doom.js`, `websockets-doom.wasm` (compilé en flux avec
   `WebAssembly.compileStreaming` si le serveur annonce `application/wasm`, sinon à partir des
   octets) et `doom1.wad`, avec une barre d'avancement.
2. Crée une `<iframe sandbox="allow-scripts allow-same-origin" srcdoc>` contenant un `<canvas>`,
   y définit `Module` (WAD et `default.cfg` écrits dans le système de fichiers virtuel, module
   WebAssembly déjà compilé fourni par `instantiateWasm`) puis injecte le script du moteur.
3. Lance `-iwad doom1.wad -window -nogui -nomouse -nomusic -config default.cfg`.
4. « Quit Game » dans le jeu ferme la fenêtre ; une erreur affiche « DOOM.EXE a cessé de
   fonctionner ».

Le serveur doit servir `.wasm` avec le type `application/wasm` pour la compilation en flux (sinon
l'appli se replie, un peu plus lentement) ; il n'a besoin d'aucun en-tête COOP/COEP.

## Licences

- **Moteur** (`websockets-doom.js`, `websockets-doom.wasm`) : œuvre dérivée de Chocolate Doom et de
  doom-wasm, **GNU GPL version 2** (`LICENSE-GPL-2.0.txt`). Source :
  <https://github.com/cloudflare/doom-wasm/tree/65e0d3ae2ffa604155eebd96ed40da6567bd08f4> (+ les
  modifications ci-dessus) ; projet amont <https://github.com/chocolate-doom/chocolate-doom>.
  Le binaire inclut aussi SDL2, SDL2_mixer, SDL2_net (**zlib**, `LICENSE-zlib-SDL2.txt`) et le
  code d'exécution d'Emscripten (**MIT / NCSA**, `LICENSE-Emscripten-MIT-NCSA.txt`).
- **Données** (`doom1.wad`) : © 1993 id Software, **shareware**, redistribuable gratuitement et
  sans modification ; ce n'est pas un logiciel libre. Provenance, sommes de contrôle et texte exact
  des mentions d'id Software : `LICENSE-DOOM1-SHAREWARE.txt`.
- Le thème lui-même est sous GPL-2.0-or-later, compatible avec le moteur GPL-2.0.

## Remplacer le WAD

Alternative entièrement libre : **Freedoom** (BSD à 3 clauses, <https://freedoom.github.io/>).
Renommer `freedoom1.wad` en `doom1.wad` (le moteur reconnaît l'IWAD par son contenu). Attention :
il pèse environ 28 Mo (au lieu de 4 Mo) ; il faudrait alors ajouter `LICENSE-Freedoom-BSD-3.txt`
et adapter `EXPECTED_SIZES.wad`. Le WAD peut aussi être servi ailleurs grâce au filtre
`jchable_bureau_doom_data_url`.

## Offre écrite de code source (GPL v2 §3)

Le code source complet correspondant au moteur distribué ici est le dépôt amont `cloudflare/doom-wasm` au commit indiqué plus haut, auquel s'ajoutent les deux modifications décrites (les deux commandes `sed`). Toute personne qui a reçu ces fichiers peut en obtenir une copie sur demande auprès de l'éditeur du site (julien.chable.net, page de contact), pendant au moins trois ans à compter de leur mise à disposition, au simple coût du support.
