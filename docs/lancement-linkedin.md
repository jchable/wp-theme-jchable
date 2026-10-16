# Post LinkedIn : sortie du thème Bureau

Vidéo à joindre : `npm run demo:video` (WordPress local démarré, thème Bureau actif) produit `dist/demo/bureau-demo.mp4` (1080p, 56 s, sans son, légendes incrustées).

---

**J'ai transformé mon blog en bureau d'ordinateur. Et oui, on peut jouer à DOOM dessus. 🕹️**

Un blog, c'est censé être une page blanche avec du texte.
Le mien, depuis aujourd'hui, c'est un **bureau rétro** : des fenêtres, des icônes qu'on déplace, une barre des tâches, un menu Démarrer… et un écran bleu pour la page 404. Évidemment.

Les articles s'ouvrent dans des fenêtres. Et il y a des applis dedans :

💻 Un Terminal
💣 Un Démineur
📝 Un WordPad (votre brouillon est gardé)
💬 Une messagerie, « Oh-Oh! »
🗑️ Une Corbeille
👹 **DOOM.EXE**, le vrai Chocolate Doom compilé en WebAssembly, chargé uniquement quand on le lance

Quand on ne touche à rien, un écran de veille 3D prend le relais : tunnel néon, fenêtres flottantes avec mes derniers articles, graphe de connaissances, bureau en voxels. Pas de WebGL, pas de librairie : de la 3D codée à la main sur un canevas 2D.

Derrière le décor, je me suis imposé des règles de sérieux :

✅ **Lisible et navigable sans JavaScript.** Le bureau est une amélioration, pas un prérequis.
✅ Accessible au clavier, avec un respect de « moins d'animations ».
✅ Bilingue FR/EN, sans plugin.
✅ **Zéro service externe, zéro envoi de données.** Vos préférences restent dans votre navigateur.
✅ Un vrai thème bloc WordPress (parent + enfant), testé avec Playwright et Theme Check.
✅ GPL, donc ouvert.

Je voulais prouver qu'on peut faire un site qui a de la personnalité sans sacrifier le contenu, la performance ou l'accessibilité.

Alors, cliquez partout. Faites un Démineur. Cherchez la Corbeille. Laissez l'écran de veille se lancer.
Et si vous battez le premier niveau de DOOM, dites-le-moi en commentaire 👇

👉 https://julien.chable.net

#WordPress #WebDev #TypeScript #WebAssembly #Accessibilité #OpenSource #Rétro #DOOM
