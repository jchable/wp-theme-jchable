# Mise en production du thème Bureau

Ce guide s'adresse à Julien : il décrit comment installer et vérifier les thèmes sur https://julien.chable.net en limitant les risques pour les visiteurs, puis comment les activer et, au besoin, revenir en arrière. Aucun thème ni audit ne peut garantir une absence absolue de vulnérabilités.

## 0. Ce qui a déjà été vérifié en local

Sur un WordPress 7.1.3 local (Docker) avec le contenu de test : tests unitaires, tests Playwright à 1440, 768 et 390 px (affichage, accessibilité axe, lecture sans JavaScript, bureau interactif, applis), Theme Check, contrôle de l'éditeur de site. Ce qui **ne peut pas** être vérifié en local et se contrôle sur le vrai site : voir §3.

## 1. Fabriquer les zips

```
npm ci
npm audit
npm run zip
```

Produit `dist/jchable.zip` (thème parent, environ 80 Ko) et `dist/jchable-bureau.zip` (thème enfant, avec le JavaScript compilé et DOOM, environ 3 Mo). Le thème Bureau a besoin du parent : installer les deux.

Si votre hébergeur limite le téléversement à 2 Mo (voir Médias › Ajouter), fabriquer plutôt la version légère :

```
npm run zip -- --no-doom
```

Elle produit `dist/jchable-bureau-sans-doom.zip` (environ 270 Ko). DOOM n'y est alors pas inclus : après l'installation, copier par SFTP le dossier `themes/jchable-bureau/assets/doom/` du dépôt vers `wp-content/themes/jchable-bureau/assets/doom/` sur le serveur (voir l'avertissement du §8 pour les mises à jour).

## 2. Installer sans activer

1. Admin › Apparence › Thèmes › Ajouter › Téléverser un thème : `dist/jchable.zip`, puis `dist/jchable-bureau.zip`. **Ne pas activer.**
2. Si WordPress refuse le téléversement (fichier trop gros), utiliser la version légère (§1) ou téléverser par SFTP le dossier `jchable-bureau/` **extrait de `dist/jchable-bureau.zip`** (et non le dossier du dépôt, qui ne contient `assets/dist/` qu'après `npm run build:js`) dans `wp-content/themes/`.
3. Sur la carte « jchable Bureau », cliquer **Aperçu en direct**. L'aperçu ne change rien pour les visiteurs (WordPress peut seulement créer un menu de navigation, voir §5).

## 3. Vérifications à faire dans l'aperçu (ce que le local ne peut pas tester)

- [ ] **Commentaires** : ouvrir un article qui a des commentaires. Ils s'affichent, le formulaire fonctionne. Vérifier si le formulaire est celui de Jetpack (connexion WordPress.com / Google) ou celui de WordPress. Si le formulaire Jetpack n'apparaît pas : le noter, le thème fonctionne quand même (formulaire standard).
- [ ] **Menu** : les icônes de gauche viennent du menu de navigation du site. Dans Apparence › Éditeur › Navigation, choisir ou créer le menu principal. Pour choisir une icône, ajouter la classe CSS à l'entrée : `icon-text` (document), `icon-folder-blue` (dossier bleu), `icon-folder` (dossier jaune, par défaut).
- [ ] **Page « Plan du site »** : créer une page avec le modèle « Plan du site » (le bouton Démarrer y mène sans JavaScript ; sinon il mène à l'accueil).
- [ ] **« À propos » en fenêtre** : double-clic sur l'icône À propos (ou entrée « À propos » du menu Démarrer) : le contenu de la page s'ouvre dans une fenêtre `a-propos.md`, sans quitter la page. Toute page du menu qui a du contenu fonctionne ainsi (« Plan du site » et l'accueil restent de vraies pages). Si l'API REST est bloquée, la page s'ouvre normalement.
- [ ] **Bureau interactif** (ordinateur) : les icônes s'affichent, un double-clic ouvre une appli, les fenêtres se déplacent, le menu Démarrer s'ouvre, l'horloge tourne.
- [ ] **DOOM** : double-clic sur DOOM.EXE : le jeu se charge et affiche son écran titre. Si la fenêtre affiche « DOOM.EXE a cessé de fonctionner » : ouvrir « Détails techniques ». Les trois fichiers sont vérifiés par SHA-256 avant exécution : une modification/minification par le CDN, une redirection, une erreur réseau ou un blocage CSP fait échouer le chargement. Servir les fichiers inchangés par HTTPS, sans redirection. Un CDN externe doit autoriser CORS pour l'origine du blog. Le WebAssembly est compilé dans l'iframe isolée, à partir des octets vérifiés ; un MIME `.wasm` incorrect n'empêche plus le démarrage. Ne pas affaiblir globalement la CSP du blog pour faire fonctionner le jeu (voir §9).
- [ ] **Messagerie** : affiche les derniers commentaires du blog. Si elle affiche « Impossible de joindre le serveur », vérifier que l'API REST (`/wp-json/wp/v2/comments`) n'est pas bloquée (plugin de sécurité, Cloudflare).
- [ ] **Cloudflare** : si le CSS ou le JS paraît ancien, vider le cache Cloudflare. Les fichiers sont versionnés (`?ver=`), ce qui évite normalement le problème. Si le bureau ne démarre pas du tout (aucune icône), désactiver **Rocket Loader** et l'optimisation/minification JavaScript de Cloudflare pour ce site : le bureau est un module JavaScript (`<script type="module">`), que ces options peuvent perturber.
- [ ] **Langue** : avec un navigateur en anglais, l'interface (bouton Start, icônes, applis) est en anglais ; menu Démarrer › Langue permet de forcer le français ou l'anglais. Les articles ne changent pas de langue.
- [ ] **Mobile** : sur téléphone, pas de bureau d'icônes ; le menu d'origine défile en haut, le menu Démarrer donne accès aux applis en plein écran, DOOM annonce qu'il demande un clavier.
- [ ] **Page inexistante** (`/nimporte-quoi/`) : écran bleu.

## 4. Activer

1. Apparence › Thèmes › **Activer** « jchable Bureau ».
2. Vérifier l'accueil, un article, une recherche.
3. Vider le cache de la page chez Cloudflare si besoin.

## 5. Revenir en arrière

Apparence › Thèmes › activer **Twenty Eleven** (ou le thème précédent). Rien d'autre n'est modifié sur le site. Une précision : à l'affichage, WordPress peut créer lui-même un « menu de navigation » (par exemple en convertissant votre menu classique) si aucun n'est encore choisi pour le thème ; c'est sans danger et ça se corrige dans Apparence › Éditeur › Navigation. Les préférences du visiteur (positions des icônes…) restent dans son navigateur.

## 6. Respect de la vie privée

Le bureau écrit dans le **localStorage du navigateur du visiteur** : position des icônes et des fenêtres, langue, son, écran de veille (scène et délai), brouillon du WordPad. Ces données servent uniquement à une fonction demandée par le visiteur, restent sur son appareil et ne sont jamais envoyées au serveur, sans suivi ni partage : à notre avis, cela entre dans l'exemption de consentement de la directive ePrivacy (ce n'est pas un avis juridique). Une phrase dans votre page de confidentialité suffit.

## 7. Licences à connaître

- Thèmes jchable : GPLv2 ou ultérieure.
- Polices Chivo et Chivo Mono : SIL OFL 1.1 (fichier fourni dans `assets/fonts/`).
- Moteur et données de DOOM : voir `themes/jchable-bureau/assets/doom/README.md` (licences, lien vers le code source du moteur).
- Wipeout : non inclus.

## 8. Mises à jour

Pour changer le code : modifier le dépôt, `npm run test:unit && npm run test:e2e && npm run test:e2e:bureau`, puis `npm run zip` et téléverser le nouveau zip (Apparence › Thèmes › Téléverser : WordPress propose de remplacer la version installée).

**Attention avec la version légère** (`jchable-bureau-sans-doom.zip`) : WordPress remplace tout le dossier du thème lors d'une mise à jour, ce qui **supprime** `assets/doom/` copié par SFTP. Il faut donc recopier ce dossier après chaque mise à jour faite avec la version légère. Avec le zip complet, rien à refaire.

## 9. Sécurité et limites de l'audit

L'audit du 16 octobre 2026 porte sur le code des deux thèmes, leurs blocs PHP, les entrées REST
consommées par le bureau, les nettoyeurs HTML du WordPad et du lecteur de pages, les préférences
locales, le Terminal, les ressources DOOM et les outils de fabrication. Il ne constitue ni un
pentest du site en production, ni une preuve d'absence de vulnérabilité dans WordPress, Jetpack,
les binaires tiers ou le navigateur du visiteur.

### Corrections

- **Outillage uniquement** : les avis npm sur `simple-git` / `@simple-git/argv-parser`
  (exécution de commandes avec des entrées Git non fiables), `qs` et `sprintf-js`
  (déni de service) sont traités par des versions corrigées et le remplacement
  d'argparse 1 par argparse 2, qui ne dépend plus de sprintf-js. Ces bibliothèques
  ne sont pas embarquées dans les zips. `@wordpress/env` est fixé à 11.17.0 avec
  un patch de deux imports pour utiliser l'API de simple-git 4. Garder le patch et
  `postinstall` jusqu'à une correction amont compatible, puis revalider avant de les retirer.
- **DOOM** : son ancien sandbox autorisait scripts et même origine simultanément,
  ce qui laissait le moteur accéder au blog en cas de ressource altérée. Il utilise
  maintenant une origine opaque (`sandbox="allow-scripts"`), une CSP interne sans
  réseau, formulaires ni ressources externes, et un canal de messages privé.
  Les fichiers JS, WASM et WAD sont épinglés par SHA-256 dans le code du chargeur.
  Les téléchargements n'envoient pas de cookies et refusent les redirections.
  Le jeu ne démarre pas si l'intégrité ne correspond pas ; aucun repli non vérifié.
  Les autorisations de scripts inline et de WebAssembly restent limitées à son document
  isolé et ne modifient pas les en-têtes du blog. Une CSP serveur plus stricte peut
  empêcher le jeu : conserver cette protection plutôt que d'ajouter globalement
  `unsafe-inline` ou `unsafe-eval`.
- **Zips** : les liens symboliques/jonctions, fichiers non réguliers et noms usuels de
  secrets/sauvegardes provoquent un échec explicite. Les fichiers cachés ne sont pas
  livrés. Cette liste ne remplace pas une vérification du contenu : un secret sous un
  nom ordinaire resterait un secret.

### Vérifications reproductibles

```sh
npm ci
npm audit
npm run typecheck
npm run test:unit
npm run test:tools
npm run build:js
npm run env:start
npm run env:seed
npm run test:security:php
npm run test:e2e
npm run test:e2e:bureau
```

Les tests PHP n'acceptent que l'instance locale contenant les données de test.
Ils contrôlent les droits des visiteurs/auteurs sur la métadonnée `jchable_lang`,
les réponses REST 401/403 et l'échappement du chemin de requête. Les tests navigateur
de sécurité altèrent successivement les trois fichiers DOOM, tentent une redirection,
vérifient les refus d'accès au DOM parent, aux cookies, au stockage et au réseau,
et vérifient qu'un collage HTML malveillant reste inerte après restauration du brouillon.
Les tests ordinaires conservent les contrôles d'affichage, de navigation et d'accessibilité.

Résultats dans le worktree isolé : installation propre et patch réappliqué, **0 alerte npm**
(y compris les dépendances de développement), **451 tests unitaires**, **8 tests d'outillage**
et **9 assertions PHP** réussis. Les suites Chromium passent : **162 tests parent et 270 tests
Bureau** ; 156 scénarios non applicables à la taille d'écran sont ignorés explicitement.
Compilation, vérification TypeScript, syntaxe PHP et Theme Check des deux thèmes passent.
Ces résultats ne couvrent pas Firefox/Safari ni la configuration du serveur de production.

Après intégration des évolutions parallèles de `dev`, les vérifications passent également :
526 tests unitaires, 8 tests d'outillage, 9 assertions PHP, 162 tests Chromium parent et
295 tests Chromium Bureau (191 scénarios non applicables ignorés), types et compilation.
L'audit npm ne signale toujours aucune vulnérabilité.

### Avant la production

- Faire une sauvegarde des fichiers et de la base, et vérifier la restauration.
- Maintenir WordPress, PHP, les extensions et les navigateurs à jour. Supprimer les
  extensions/thèmes inutilisés ; réserver les droits d'administration et `unfiltered_html`
  aux personnes de confiance.
- Imposer HTTPS. Configurer au niveau hébergeur les en-têtes adaptés (`nosniff`,
  protection contre l'encadrement, politique de référent et CSP testée en mode rapport),
  sans casser l'éditeur WordPress, Jetpack ou les médias autorisés.
- Ne jamais publier les outils Node, les données de test, les fichiers `.env`, les
  sauvegardes ou les journaux PHP. Désactiver l'affichage des erreurs en production.
  Ne pas exposer les ports wp-env/MySQL sur Internet ou un réseau non fiable :
  l'instance locale utilise des identifiants de test.
- Vérifier les permissions REST natives ; ne pas désactiver l'authentification ou les
  contrôles d'une extension pour rétablir une application du bureau.
- Les brouillons WordPad ne quittent pas le navigateur, mais ne sont pas chiffrés :
  tout script autorisé sur la même origine pourrait les lire. Ne pas y conserver de secrets.
- Relancer l'audit des dépendances régulièrement : « aucune vulnérabilité signalée »
  signifie uniquement aucune alerte connue dans la base npm au moment du contrôle.
