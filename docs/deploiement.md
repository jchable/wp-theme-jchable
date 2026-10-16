# Mise en production du thème Bureau

Ce guide s'adresse à Julien : il décrit comment installer et vérifier les thèmes sur https://julien.chable.net **sans risque** pour les visiteurs, puis comment les activer et, au besoin, revenir en arrière.

## 0. Ce qui a déjà été vérifié en local

Sur un WordPress 7.1.3 local (Docker) avec le contenu de test : tests unitaires, tests Playwright à 1440, 768 et 390 px (affichage, accessibilité axe, lecture sans JavaScript, bureau interactif, applis), Theme Check, contrôle de l'éditeur de site. Ce qui **ne peut pas** être vérifié en local et se contrôle sur le vrai site : voir §3.

## 1. Fabriquer les zips

```
npm install
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
- [ ] **Bureau interactif** (ordinateur) : les icônes s'affichent, un double-clic ouvre une appli, les fenêtres se déplacent, le menu Démarrer s'ouvre, l'horloge tourne.
- [ ] **DOOM** : double-clic sur DOOM.EXE : le jeu se charge et affiche son écran titre. Si la fenêtre affiche « DOOM.EXE a cessé de fonctionner » : ouvrir « Détails techniques ». Cause la plus fréquente : le serveur n'envoie pas le type `application/wasm` pour les fichiers `.wasm` (le thème sait contourner), ou un blocage par une règle de sécurité (CSP) qui doit autoriser `'wasm-unsafe-eval'`.
- [ ] **Messagerie** : affiche les derniers commentaires du blog. Si elle affiche « Impossible de joindre le serveur », vérifier que l'API REST (`/wp-json/wp/v2/comments`) n'est pas bloquée (plugin de sécurité, Cloudflare).
- [ ] **Cloudflare** : si le CSS ou le JS paraît ancien, vider le cache Cloudflare. Les fichiers sont versionnés (`?ver=`), ce qui évite normalement le problème. Si le bureau ne démarre pas du tout (aucune icône), désactiver **Rocket Loader** et l'optimisation/minification JavaScript de Cloudflare pour ce site : le bureau est un module JavaScript (`<script type="module">`), que ces options peuvent perturber.
- [ ] **Mobile** : sur téléphone, pas de bureau d'icônes ; le menu d'origine défile en haut, le menu Démarrer donne accès aux applis en plein écran, DOOM annonce qu'il demande un clavier.
- [ ] **Page inexistante** (`/nimporte-quoi/`) : écran bleu.

## 4. Activer

1. Apparence › Thèmes › **Activer** « jchable Bureau ».
2. Vérifier l'accueil, un article, une recherche.
3. Vider le cache de la page chez Cloudflare si besoin.

## 5. Revenir en arrière

Apparence › Thèmes › activer **Twenty Eleven** (ou le thème précédent). Rien d'autre n'est modifié sur le site. Une précision : à l'affichage, WordPress peut créer lui-même un « menu de navigation » (par exemple en convertissant votre menu classique) si aucun n'est encore choisi pour le thème ; c'est sans danger et ça se corrige dans Apparence › Éditeur › Navigation. Les préférences du visiteur (positions des icônes…) restent dans son navigateur.

## 6. Respect de la vie privée

Le bureau écrit dans le **localStorage du navigateur du visiteur** : position des icônes et des fenêtres, son, écran de veille, brouillon du WordPad. Ces données servent uniquement à une fonction demandée par le visiteur, restent sur son appareil et ne sont jamais envoyées au serveur, sans suivi ni partage : à notre avis, cela entre dans l'exemption de consentement de la directive ePrivacy (ce n'est pas un avis juridique). Une phrase dans votre page de confidentialité suffit.

## 7. Licences à connaître

- Thèmes jchable : GPLv2 ou ultérieure.
- Polices Chivo et Chivo Mono : SIL OFL 1.1 (fichier fourni dans `assets/fonts/`).
- Moteur et données de DOOM : voir `themes/jchable-bureau/assets/doom/README.md` (licences, lien vers le code source du moteur).
- Wipeout : non inclus.

## 8. Mises à jour

Pour changer le code : modifier le dépôt, `npm run test:unit && npm run test:e2e && npm run test:e2e:bureau`, puis `npm run zip` et téléverser le nouveau zip (Apparence › Thèmes › Téléverser : WordPress propose de remplacer la version installée).

**Attention avec la version légère** (`jchable-bureau-sans-doom.zip`) : WordPress remplace tout le dossier du thème lors d'une mise à jour, ce qui **supprime** `assets/doom/` copié par SFTP. Il faut donc recopier ce dossier après chaque mise à jour faite avec la version légère. Avec le zip complet, rien à refaire.
