# Étape 1 : socle multi-thèmes et thème parent `jchable` — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un dépôt npm qui lance un WordPress 7.1 local rempli de contenu de test, et un thème parent blocs `jchable` complet (accueil, article, page, archives, recherche, 404, plan du site), testé par Playwright et livré en zip.

**Architecture:** Thème blocs (FSE) sans étape de build. Le style passe par `theme.json` et un petit `assets/css/base.css`. Trois blocs dynamiques rendus en PHP (`block.json` + `render.php`, éditeur en JS brut sans build). WordPress tourne dans Docker via `@wordpress/env`. Le contenu de test est créé par un script PHP lancé avec `wp eval-file`. Les tests de bout en bout utilisent Playwright et axe ; les scripts Node sont testés avec `node:test`.

**Tech Stack:** WordPress 7.1.3, PHP 8.2 (dans le conteneur), `@wordpress/env`, `@playwright/test`, `@axe-core/playwright`, `archiver`, Node 22 (`node:test`).

**Spec:** `docs/superpowers/specs/2026-10-16-jchable-themes-bureau-design.md` (§2, §3, §7, §8 étape 1, §8 bis)

## Global Constraints

- Nom du thème parent : `jchable` (dossier `themes/jchable/`, text domain `jchable`). Les enfants s'appelleront `jchable-<nom>`.
- En-tête du thème : `Requires at least: 6.6`, `Tested up to: 7.1`, `Requires PHP: 8.1`, `License: GPLv2 or later`.
- `theme.json` : `contentSize` 720px, `wideSize` 1320px ; aucune police chargée depuis Google Fonts.
- Aucun JavaScript n'est nécessaire pour lire le site (l'éditeur peut en utiliser).
- La langue de la page vient de `language_attributes()` (site en `fr_FR`) ; jamais écrite en dur.
- Textes de l'interface en français.
- PHP n'est pas installé sur la machine de Julien : toute commande PHP ou WP-CLI passe par `npx wp-env run cli …`.
- Pas de Vite ni de Vitest dans cette étape : le parent n'a rien à compiler. Ils arrivent avec la couche bureau (étape 3). Le reste du socle prévu au §2 est livré ici.
- Commits fréquents ; messages en français ; terminer chaque message par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Écarts assumés par rapport à la spec (§3)

- **Pas de modèles de blocs (patterns) pour les cartes d'articles.** Un modèle inséré dans le bloc « Modèle d'article » d'une boucle de requête ne reçoit pas le contexte `postId` : le titre et la date seraient vides. Le balisage de la carte est donc écrit directement dans `home.html`, `archive.html` et `search.html`. La barre latérale est un morceau de gabarit, ce qui revient au même.
- **Pas de gabarit `category.html` :** `archive.html` couvre les catégories par la hiérarchie des gabarits WordPress.
- **Polices système dans le parent :** aucun fichier woff2 à héberger ici, et toujours aucun appel à Google Fonts. Les polices hébergées arrivent avec le premier thème enfant (Chivo pour Bureau).
- **Chargement du manifeste Vite et filtre `jchable_sitemap_url` :** reportés aux étapes 2 et 3, qui en ont besoin.
- **Blocs dans un thème :** pour wordpress.org, enregistrer des blocs relève du « territoire des plugins », et Theme Check signale `register_block_type` comme une exigence. Le thème n'est pas destiné à wordpress.org (hors périmètre, spec §1). On utilise `register_block_type_from_metadata()`, la fonction standard d'enregistrement depuis un `block.json`, que Theme Check ne signale pas.
- **Contenu de test :** un script PHP (`tools/env/seed.php`) au lieu d'un export WXR dans `tests/fixtures/` (§2). Il est déterministe, n'a besoin d'aucun plugin d'import, et ses adresses sont reprises dans `tests/e2e/fixtures.ts`.
- **Pas d'espaces de travail npm** tant qu'il n'y a aucun paquet JS (`packages/bureau-desktop` arrive à l'étape 3).
- **`npm run check` ne vérifie que `jchable`** : les thèmes enfants seront ajoutés au script quand ils existeront.
- **Repli des commentaires Jetpack :** il ne se décide qu'après la vérification sur le vrai site (Task 11, Step 4) ; s'il en faut un, il sera traité à l'étape 2.
- **Lien d'évitement :** celui du cœur de WordPress (créé en JavaScript) est remplacé par un lien HTML, pour rester utilisable sans JavaScript.
- **Archives de la barre latérale par année** et non en liste déroulante : la liste déroulante ne fonctionne qu'avec JavaScript, et une liste par mois serait trop longue (2009 → 2026).

## Review Focus

1. **Recherche ou URL contenant du HTML** (`?s=<b>x</b>`, `/<script>…`) : le texte doit s'afficher tel quel, échappé, sans jamais injecter de balise. Tests : Task 6, `blocks.spec.ts` (« échappe la recherche » et « échappe le chemin de la 404 »).
2. **Titre ou contenu avec un mot interminable ou une longue URL, sur mobile (390px)** : aucun défilement horizontal de la page. Test : Task 8, `layout.spec.ts`, avec l'article `titre-tres-long` du contenu de test.
3. **Recherche sans résultat** : un message clair (« Aucun résultat »), pas une page vide. Test : Task 5, `archives.spec.ts`.
4. **Page 2 de l'accueil** : l'article « à la une » (premier élément agrandi) ne s'applique qu'à la page 1, et la pagination fonctionne. Test : Task 3, `home.spec.ts`.
5. **Article aux commentaires fermés** : pas de formulaire, pas d'erreur, les autres blocs s'affichent. Test : Task 4, `single.spec.ts`.

---

## Structure des fichiers

```
package.json                     scripts npm et dépendances de dev
.gitignore / .editorconfig
.wp-env.json                     WordPress 7.1.3, Jetpack, Theme Check, montage du thème et des outils
playwright.config.ts             3 tailles d'écran : desktop, tablet, mobile
README.md                        commandes et organisation
tools/env/seed.php               contenu de test (idempotent)
tools/check/theme-check.php      lance Theme Check sur un thème
tools/zip/files.mjs              liste des fichiers à mettre dans un zip (fonction pure)
tools/zip/files.test.mjs         tests node:test de files.mjs
tools/zip/zip.mjs                écrit dist/<thème>.zip
themes/jchable/
  style.css                      en-tête du thème (pas de CSS ici)
  readme.txt                     licence et crédits
  theme.json                     réglages et styles globaux
  functions.php                  charge inc/*
  inc/assets.php                 charge base.css (site et éditeur)
  inc/blocks.php                 enregistre les 3 blocs dynamiques
  inc/archive-path.php           jchable_archive_path_segments()
  inc/lang.php                   méta jchable_lang + attribut lang sur le contenu
  assets/css/base.css            mise en page commune (colonnes, cartes, débordements)
  blocks/editor.js               enregistrement des blocs côté éditeur (sans build)
  blocks/post-filename/{block.json,render.php}
  blocks/request-path/{block.json,render.php}
  blocks/archive-path/{block.json,render.php}
  parts/{header,footer,sidebar}.html
  templates/{index,home,single,page,archive,search,404,plan-du-site}.html
tests/e2e/
  fixtures.ts                    adresses et titres du contenu de test
  helpers.ts                     expectNoHorizontalScroll()
  home.spec.ts / single.spec.ts / archives.spec.ts / blocks.spec.ts
  lang.spec.ts / layout.spec.ts / a11y.spec.ts / nojs.spec.ts
```

---

### Task 1 : dépôt npm et WordPress local

**Files:**
- Create: `package.json`, `.gitignore`, `.editorconfig`, `.wp-env.json`
- Create: `themes/jchable/style.css` (en-tête seul, pour que wp-env puisse monter le dossier)

**Interfaces:**
- Produces : scripts npm `env:start`, `env:stop`, `env:seed`, `env:reset`, `test:e2e`, `test:tools`, `check`, `zip` ; WordPress sur `http://localhost:8888` (admin `admin` / `password`) ; le dossier `tools/` monté dans le conteneur sous `wp-content/jchable-tools/`.

- [ ] **Step 1 : créer une branche de travail**

```bash
git checkout -b etape-1-socle
```

- [ ] **Step 2 : écrire `package.json`**

```json
{
  "name": "jchable-themes",
  "private": true,
  "description": "Thèmes WordPress de julien.chable.net",
  "license": "GPL-2.0-or-later",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "env:start": "wp-env start",
    "env:stop": "wp-env stop",
    "env:seed": "wp-env run cli wp eval-file wp-content/jchable-tools/env/seed.php",
    "env:reset": "wp-env reset all && npm run env:seed",
    "test:e2e": "playwright test",
    "test:tools": "node --test \"tools/**/*.test.mjs\"",
    "check": "wp-env run cli wp eval-file wp-content/jchable-tools/check/theme-check.php jchable",
    "zip": "node tools/zip/zip.mjs"
  }
}
```

- [ ] **Step 3 : installer les dépendances de dev**

Run : `npm install -D @wordpress/env @playwright/test @axe-core/playwright archiver@^7`
Puis : `npx playwright install chromium`
Expected : `package.json` contient les 4 paquets dans `devDependencies` ; `package-lock.json` est créé.

- [ ] **Step 4 : écrire `.gitattributes`, `.gitignore` et `.editorconfig`**

`.gitattributes` (sous Windows, Git convertit sinon les fins de ligne en CRLF dans les fichiers du thème, ce qui donne des zips incohérents) :

```
* text=auto eol=lf
*.png binary
*.jpg binary
*.woff2 binary
*.zip binary
```

`.gitignore` :

```
node_modules/
dist/
test-results/
playwright-report/
.DS_Store
Thumbs.db
```

`.editorconfig` :

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = tab
indent_size = 4

[*.{json,md,yml,ts,mjs}]
indent_style = space
indent_size = 2
```

- [ ] **Step 5 : écrire `.wp-env.json`**

```json
{
  "core": "https://wordpress.org/wordpress-7.1.3.zip",
  "phpVersion": "8.2",
  "port": 8888,
  "plugins": [
    "https://downloads.wordpress.org/plugin/jetpack.latest-stable.zip",
    "https://downloads.wordpress.org/plugin/theme-check.latest-stable.zip"
  ],
  "themes": ["./themes/jchable"],
  "mappings": {
    "wp-content/jchable-tools": "./tools"
  },
  "config": {
    "JETPACK_DEV_DEBUG": true,
    "WP_DEBUG": true,
    "WP_DEBUG_LOG": true,
    "WP_DEBUG_DISPLAY": false,
    "SCRIPT_DEBUG": true
  }
}
```

Jetpack tourne ici en mode hors ligne (`JETPACK_DEV_DEBUG`) : son module de commentaires a besoin d'une connexion à WordPress.com et ne peut donc pas être testé en local. Il sera vérifié sur le vrai site à la Task 11.

- [ ] **Step 6 : écrire l'en-tête du thème `themes/jchable/style.css`**

```css
/*
Theme Name: jchable
Theme URI: https://julien.chable.net
Author: Julien Chable
Author URI: https://julien.chable.net
Description: Thème parent blocs de julien.chable.net : gabarits, blocs et réglages communs aux thèmes jchable-*.
Version: 0.1.0
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 8.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: jchable
*/
```

- [ ] **Step 7 : démarrer WordPress et vérifier**

Run : `npm run env:start` (Docker Desktop doit tourner ; le premier lancement télécharge les images)
Puis, dans Git Bash : `curl -s -o /dev/null -w "%{http_code}" http://localhost:8888/` (dans PowerShell : remplacer `/dev/null` par `NUL`)
Expected : `200`.
Puis : `npx wp-env run cli wp core version`
Expected : `7.1.3`.

- [ ] **Step 8 : commit**

```bash
git add package.json package-lock.json .gitattributes .gitignore .editorconfig .wp-env.json themes/jchable/style.css
git commit -m "chore: dépôt npm et WordPress local (wp-env)"
```

---

### Task 2 : contenu de test

**Files:**
- Create: `tools/env/seed.php`

**Interfaces:**
- Consumes : script `env:seed` (Task 1), montage `wp-content/jchable-tools`.
- Produces : site « Julien Chable » en `fr_FR`, permaliens `/%postname%/`, catégorie `divers`, 13 articles, 2 pages, 3 commentaires. Les tests de la suite s'appuient sur ces adresses exactes :

| Contenu | Adresse | Particularité |
|---|---|---|
| Article le plus récent (16/10/2026) | `/a-folder-of-markdown-you-can-actually-browse/` | `jchable_lang = en`, image à la une + image avec légende dans le texte, 3 commentaires |
| Article (02/10/2026) | `/okf4net-0-6-0/` | `jchable_lang = en` |
| Article (04/09/2026) | `/okf4net-agent-memory-you-can-git-blame/` | `jchable_lang = en`, commentaires fermés |
| Article (20/08/2026) | `/titre-tres-long/` | mot interminable dans le titre, longue URL dans le texte |
| Article (01/07/2026) | `/bloc-de-code/` | bloc de code à lignes longues |
| 8 articles de remplissage (2009 → 2024) | `/billet-de-test-1/` … `/billet-de-test-8/` | sans `jchable_lang` |
| Page | `/a-propos/` | |
| Page | `/plan-du-site/` | gabarit `plan-du-site` |

- [ ] **Step 1 : écrire `tools/env/seed.php`**

```php
<?php
/**
 * Contenu de test du WordPress local, lancé par `npm run env:seed`.
 * Idempotent : ne fait rien si l'option jchable_seeded existe.
 */

if ( get_option( 'jchable_seeded' ) ) {
	WP_CLI::success( 'Contenu de test déjà présent.' );
	return;
}

WP_CLI::runcommand( 'language core install fr_FR --activate' );
// wp-env a déjà écrit le .htaccess (avec ses propres permaliens) : changer la structure suffit.
WP_CLI::runcommand( 'rewrite structure "/%postname%/"' );

// Le thème n'est activable qu'une fois templates/index.html écrit (Task 3).
$jchable_theme = wp_get_theme( 'jchable' );
if ( $jchable_theme->exists() && ! $jchable_theme->errors() ) {
	switch_theme( 'jchable' );
} else {
	WP_CLI::warning( 'Thème jchable encore incomplet : il sera activé à la Task 3 (wp theme activate jchable).' );
}

update_option( 'blogname', 'Julien Chable' );
update_option( 'blogdescription', 'SharePoint, Office 365 and .NET … what else ?' );
update_option( 'timezone_string', 'Europe/Paris' );
update_option( 'posts_per_page', 10 );

// Contenu par défaut de WordPress.
wp_delete_post( 1, true );
wp_delete_post( 2, true );

$term   = term_exists( 'divers', 'category' ) ?: wp_insert_term( 'Divers', 'category', [ 'slug' => 'divers' ] );
$cat_id = (int) $term['term_id'];
wp_update_term( $cat_id, 'category', [ 'name' => 'Divers' ] );
update_option( 'default_category', $cat_id );

function jchable_seed_paragraphs( string ...$texts ): string {
	$out = '';
	foreach ( $texts as $text ) {
		$out .= "<!-- wp:paragraph -->\n<p>" . $text . "</p>\n<!-- /wp:paragraph -->\n\n";
	}
	return $out;
}

function jchable_seed_post( array $p, int $cat_id ): int {
	$id = wp_insert_post(
		[
			'post_type'      => $p['type'] ?? 'post',
			'post_title'     => $p['title'],
			'post_name'      => $p['slug'],
			'post_content'   => $p['content'] ?? jchable_seed_paragraphs( 'Contenu de test.' ),
			'post_status'    => 'publish',
			'post_date'      => $p['date'] ?? current_time( 'mysql' ),
			'post_category'  => 'post' === ( $p['type'] ?? 'post' ) ? [ $cat_id ] : [],
			'comment_status' => $p['comments'] ?? 'open',
		],
		true
	);
	if ( is_wp_error( $id ) ) {
		WP_CLI::error( $id );
	}
	// Une date encore à venir (exécution le 16/10/2026 avant 10 h) donnerait un article « planifié » : on le publie quand même.
	if ( 'future' === get_post_status( $id ) ) {
		wp_publish_post( $id );
	}
	if ( ! empty( $p['lang'] ) ) {
		update_post_meta( $id, 'jchable_lang', $p['lang'] );
	}
	return $id;
}

function jchable_seed_image( int $parent_id, string $name, string $label ): int {
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$upload = wp_upload_dir();
	$file   = trailingslashit( $upload['path'] ) . $name . '.png';
	$img    = imagecreatetruecolor( 1200, 675 );
	imagefill( $img, 0, 0, imagecolorallocate( $img, 46, 111, 108 ) );
	imagestring( $img, 5, 40, 40, $label, imagecolorallocate( $img, 255, 255, 255 ) );
	imagepng( $img, $file );
	imagedestroy( $img );
	$id = wp_insert_attachment(
		[
			'post_mime_type' => 'image/png',
			'post_title'     => $label,
			'post_status'    => 'inherit',
		],
		$file,
		$parent_id
	);
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $file ) );
	return $id;
}

// Article le plus récent : image à la une, image avec légende, commentaires.
$latest = jchable_seed_post(
	[
		'title' => 'A folder of markdown you can actually browse: OKF4net 0.7 and the interactive okf-render',
		'slug'  => 'a-folder-of-markdown-you-can-actually-browse',
		'date'  => '2026-10-16 10:00:00',
		'lang'  => 'en',
	],
	$cat_id
);
$hero    = jchable_seed_image( $latest, 'okf-render-hero', 'okf-render: global graph' );
$capture = jchable_seed_image( $latest, 'okf-render-explorer', 'okf-render: explorer' );
set_post_thumbnail( $latest, $hero );
$capture_url = wp_get_attachment_image_url( $capture, 'large' );
wp_update_post(
	[
		'ID'           => $latest,
		'post_content' => jchable_seed_paragraphs(
			'An Open Knowledge Format bundle is a directory of markdown files with YAML frontmatter. That is what makes it good for agents and for code review: an agent reads it with <code>cat</code>, a reviewer reads a change as a plain diff, and git does the rest.',
			'It is also what makes it tedious for a person to browse.'
		) . '<!-- wp:image {"id":' . $capture . ',"sizeSlug":"large"} -->' . "\n"
			. '<figure class="wp-block-image size-large"><img src="' . esc_url( $capture_url ) . '" alt="The explorer of the synthetic bundle" class="wp-image-' . $capture . '"/><figcaption class="wp-element-caption">The explorer of the synthetic bundle, with the Metric and Runbook type chips pressed.</figcaption></figure>' . "\n"
			. "<!-- /wp:image -->\n\n"
			. jchable_seed_paragraphs( 'The archives are on the 0.7.0 release; the install script covers Linux and macOS.' ),
	]
);
foreach ( [ [ 'Alice', 'Super article, merci !' ], [ 'Bob', 'Le graphe global est superbe.' ], [ 'Chloé', 'Hâte de tester okf-render.' ] ] as $i => $c ) {
	wp_insert_comment(
		[
			'comment_post_ID'      => $latest,
			'comment_author'       => $c[0],
			'comment_author_email' => strtolower( $c[0] ) . '@example.org',
			'comment_content'      => $c[1],
			'comment_approved'     => 1,
			'comment_date'         => '2026-10-16 1' . ( $i + 1 ) . ':00:00',
		]
	);
}

jchable_seed_post(
	[
		'title'   => 'OKF4net 0.6.0: two months, 642 commits, and a test suite bigger than the code',
		'slug'    => 'okf4net-0-6-0',
		'date'    => '2026-10-02 10:00:00',
		'lang'    => 'en',
		'content' => jchable_seed_paragraphs( 'OKF4net 0.6.0 is out. It is the largest release of the project so far: more commits than every previous release combined, two new command-line verbs, a static-site generator, and a way to run a knowledge bundle’s computations in real containers.' ),
	],
	$cat_id
);

jchable_seed_post(
	[
		'title'    => 'OKF4net agent memory you can git blame',
		'slug'     => 'okf4net-agent-memory-you-can-git-blame',
		'date'     => '2026-09-04 10:00:00',
		'lang'     => 'en',
		'comments' => 'closed',
		'content'  => jchable_seed_paragraphs( 'Most answers to « give my AI agent long-term memory » hand you an opaque vector store. I wanted the opposite — memory I can open in an editor, review in a pull request, and git blame line by line.' ),
	],
	$cat_id
);

jchable_seed_post(
	[
		'title'   => 'Un titre très long avec un mot interminable Anticonstitutionnellementsupercalifragilisticexpialidociousmarkdownknowledgebundle',
		'slug'    => 'titre-tres-long',
		'date'    => '2026-08-20 10:00:00',
		'content' => jchable_seed_paragraphs( 'Une longue URL : https://julien.chable.net/wp-content/uploads/2026/10/un-nom-de-fichier-extremement-long-sans-aucun-espace-pour-tester-le-retour-a-la-ligne-sur-mobile.png' ),
	],
	$cat_id
);

jchable_seed_post(
	[
		'title'   => 'Bloc de code',
		'slug'    => 'bloc-de-code',
		'date'    => '2026-07-01 10:00:00',
		'content' => "<!-- wp:code -->\n<pre class=\"wp-block-code\"><code>dotnet tool install --global okf --version 0.7.0 &amp;&amp; okf render ./acme_retail --output ./site --theme dark --open-browser-after-build-with-a-very-long-flag</code></pre>\n<!-- /wp:code -->",
	],
	$cat_id
);

$filler_dates = [ '2009-06-15', '2011-03-10', '2013-05-05', '2015-09-09', '2018-01-20', '2020-11-11', '2022-04-04', '2024-02-29' ];
foreach ( $filler_dates as $i => $date ) {
	jchable_seed_post(
		[
			'title' => 'Billet de test ' . ( $i + 1 ),
			'slug'  => 'billet-de-test-' . ( $i + 1 ),
			'date'  => $date . ' 10:00:00',
		],
		$cat_id
	);
}

jchable_seed_post(
	[
		'type'    => 'page',
		'title'   => 'À propos',
		'slug'    => 'a-propos',
		'content' => jchable_seed_paragraphs( 'SharePoint, Office 365, .NET — et une implémentation .NET de l’Open Knowledge Format.' ),
	],
	$cat_id
);
$sitemap = jchable_seed_post(
	[
		'type'    => 'page',
		'title'   => 'Plan du site',
		'slug'    => 'plan-du-site',
		'content' => '',
	],
	$cat_id
);
update_post_meta( $sitemap, '_wp_page_template', 'plan-du-site' );

// Le bloc Navigation sans menu crée un menu de repli au premier affichage. On le crée ici,
// une seule fois, pour que les tests lancés en parallèle n'en créent pas plusieurs.
if ( class_exists( 'WP_Navigation_Fallback' ) ) {
	WP_Navigation_Fallback::get_fallback();
}

update_option( 'jchable_seeded', 1 );
WP_CLI::success( 'Contenu de test créé.' );
```

- [ ] **Step 2 : lancer le script**

Run : `npm run env:seed`
Expected : `Success: Contenu de test créé.`

Un avertissement « Thème jchable encore incomplet » est attendu : le thème n'a pas encore de gabarit et sera activé à la Task 3.

- [ ] **Step 3 : vérifier le contenu**

Run : `npx wp-env run cli wp post list --post_type=post --format=count`
Expected : `13`.
Run : `npx wp-env run cli wp option get WPLANG`
Expected : `fr_FR`.
Run : `npm run env:seed` une seconde fois.
Expected : `Success: Contenu de test déjà présent.` (le script est bien idempotent).

- [ ] **Step 4 : commit**

```bash
git add tools/env/seed.php
git commit -m "chore: contenu de test du WordPress local"
```

---

### Task 3 : squelette du thème parent et accueil

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/helpers.ts`, `tests/e2e/home.spec.ts`
- Create: `themes/jchable/theme.json`, `themes/jchable/functions.php`, `themes/jchable/inc/assets.php`, `themes/jchable/assets/css/base.css`
- Create: `themes/jchable/parts/header.html`, `themes/jchable/parts/footer.html`, `themes/jchable/parts/sidebar.html`
- Create: `themes/jchable/templates/index.html`, `themes/jchable/templates/home.html`

**Interfaces:**
- Consumes : contenu de test (Task 2).
- Produces :
  - classes CSS de mise en page utilisées par tous les gabarits : `.site-body`, `.site-columns`, `.site-main`, `.site-sidebar`, `.site-header`, `.site-footer`, `.post-feed`, `.post-card` ;
  - morceaux de gabarit `header`, `footer`, `sidebar` ;
  - `tests/e2e/fixtures.ts` : constantes `POSTS`, `PAGES`, `ARCHIVES` ;
  - `tests/e2e/helpers.ts` : `expectNoHorizontalScroll(page: Page): Promise<void>`.

- [ ] **Step 1 : écrire la config Playwright et les utilitaires de test**

`playwright.config.ts` :

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.WP_BASE_URL ?? 'http://localhost:8888',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
```

`tests/e2e/fixtures.ts` :

```ts
// Adresses et titres créés par tools/env/seed.php.
export const POSTS = {
  latest: {
    path: '/a-folder-of-markdown-you-can-actually-browse/',
    title: 'A folder of markdown you can actually browse: OKF4net 0.7 and the interactive okf-render',
  },
  release: {
    path: '/okf4net-0-6-0/',
    title: 'OKF4net 0.6.0: two months, 642 commits, and a test suite bigger than the code',
  },
  closed: {
    path: '/okf4net-agent-memory-you-can-git-blame/',
    title: 'OKF4net agent memory you can git blame',
  },
  long: { path: '/titre-tres-long/' },
  code: { path: '/bloc-de-code/' },
  filler: { path: '/billet-de-test-1/' },
} as const;

export const PAGES = {
  about: '/a-propos/',
  sitemap: '/plan-du-site/',
} as const;

export const ARCHIVES = {
  category: '/category/divers/',
  month: '/2026/10/',
  search: '/?s=okf4net',
  searchEmpty: '/?s=zzzaucunresultat',
  notFound: '/cette-page-nexiste-pas/',
} as const;

export const TOTAL_POSTS = 13;
```

`tests/e2e/helpers.ts` :

```ts
import { expect, type Page } from '@playwright/test';

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'la page ne doit pas défiler horizontalement').toBeLessThanOrEqual(0);
}
```

- [ ] **Step 2 : écrire les tests de l'accueil, qui doivent échouer**

`tests/e2e/home.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import { POSTS, TOTAL_POSTS } from './fixtures';

test.describe('accueil', () => {
  test('affiche le titre du site, le slogan et 10 articles', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-header .wp-block-site-title')).toHaveText('Julien Chable');
    await expect(page.locator('.site-header .wp-block-site-tagline')).toContainText('what else ?');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(10);
    await expect(page.getByRole('heading', { level: 2, name: POSTS.latest.title })).toBeVisible();
  });

  test('a un titre de niveau 1 et une barre latérale', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Derniers articles');
    await expect(page.locator('.site-columns > aside')).toContainText('Archives');
  });

  test('la page 2 liste les articles restants sans « à la une »', async ({ page }) => {
    await page.goto('/page/2/');
    await expect(page.locator('body')).toHaveClass(/\bpaged\b/);
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(TOTAL_POSTS - 10);
    const first = page.locator('.post-feed .wp-block-post').first();
    const firstBox = await first.boundingBox();
    const feedBox = await page.locator('.post-feed .wp-block-post-template').boundingBox();
    // Sur la page 2, le premier article n'occupe pas toute la largeur (sauf sur mobile, où tout est sur une colonne).
    if (feedBox && firstBox && feedBox.width > 700) {
      expect(firstBox.width).toBeLessThan(feedBox.width * 0.75);
    }
  });

  test('sur la page 1, le premier article occupe toute la largeur', async ({ page }) => {
    await page.goto('/');
    const first = await page.locator('.post-feed .wp-block-post').first().boundingBox();
    const feed = await page.locator('.post-feed .wp-block-post-template').boundingBox();
    expect(first && feed && Math.abs(first.width - feed.width) < 2).toBeTruthy();
  });

  test('la pagination mène aux articles plus anciens', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Articles plus anciens' }).click();
    await expect(page).toHaveURL(/\/page\/2\/$/);
  });
});
```

- [ ] **Step 3 : lancer les tests pour vérifier qu'ils échouent**

Run : `npx playwright test tests/e2e/home.spec.ts --project=desktop`
Expected : FAIL (le thème n'a pas de gabarit ; `.site-header` est introuvable).

- [ ] **Step 4 : écrire `theme.json`**

```json
{
  "$schema": "https://schemas.wp.org/wp/6.6/theme.json",
  "version": 3,
  "settings": {
    "appearanceTools": true,
    "useRootPaddingAwareAlignments": true,
    "layout": { "contentSize": "720px", "wideSize": "1320px" },
    "color": {
      "defaultPalette": false,
      "defaultGradients": false,
      "palette": [
        { "slug": "base", "name": "Fond", "color": "#FFFFFF" },
        { "slug": "contrast", "name": "Texte", "color": "#16161A" },
        { "slug": "muted", "name": "Texte secondaire", "color": "#55555E" },
        { "slug": "surface", "name": "Surface", "color": "#F4F4F2" },
        { "slug": "accent", "name": "Accent", "color": "#2D3FC8" }
      ]
    },
    "typography": {
      "fluid": true,
      "defaultFontSizes": false,
      "fontSizes": [
        { "slug": "small", "name": "Petit", "size": "0.875rem", "fluid": false },
        { "slug": "medium", "name": "Moyen", "size": "1.0625rem", "fluid": { "min": "1rem", "max": "1.125rem" } },
        { "slug": "large", "name": "Grand", "size": "1.5rem", "fluid": { "min": "1.25rem", "max": "1.75rem" } },
        { "slug": "x-large", "name": "Très grand", "size": "2.5rem", "fluid": { "min": "1.75rem", "max": "3rem" } },
        { "slug": "xx-large", "name": "Énorme", "size": "4.5rem", "fluid": { "min": "2.5rem", "max": "6rem" } }
      ],
      "fontFamilies": [
        { "slug": "body", "name": "Texte", "fontFamily": "system-ui, -apple-system, 'Segoe UI', sans-serif" },
        { "slug": "mono", "name": "Mono", "fontFamily": "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace" }
      ]
    },
    "spacing": {
      "defaultSpacingSizes": false,
      "spacingSizes": [
        { "slug": "20", "name": "XS", "size": "0.5rem" },
        { "slug": "30", "name": "S", "size": "clamp(0.75rem, 1.5vw, 1rem)" },
        { "slug": "40", "name": "M", "size": "clamp(1rem, 2.5vw, 1.5rem)" },
        { "slug": "50", "name": "L", "size": "clamp(1.5rem, 4vw, 2.5rem)" },
        { "slug": "60", "name": "XL", "size": "clamp(2rem, 6vw, 4rem)" }
      ]
    }
  },
  "styles": {
    "color": { "background": "var:preset|color|base", "text": "var:preset|color|contrast" },
    "typography": {
      "fontFamily": "var:preset|font-family|body",
      "fontSize": "var:preset|font-size|medium",
      "lineHeight": "1.6"
    },
    "spacing": {
      "padding": { "left": "clamp(16px, 4vw, 48px)", "right": "clamp(16px, 4vw, 48px)" },
      "blockGap": "var:preset|spacing|40"
    },
    "elements": {
      "link": {
        "color": { "text": "var:preset|color|accent" },
        ":hover": { "color": { "text": "var:preset|color|contrast" } }
      },
      "heading": { "typography": { "lineHeight": "1.15", "fontWeight": "700" } },
      "h1": { "typography": { "fontSize": "var:preset|font-size|xx-large" } },
      "h2": { "typography": { "fontSize": "var:preset|font-size|x-large" } },
      "h3": { "typography": { "fontSize": "var:preset|font-size|large" } }
    },
    "blocks": {
      "core/code": {
        "typography": { "fontFamily": "var:preset|font-family|mono", "fontSize": "var:preset|font-size|small" }
      },
      "core/post-date": {
        "typography": { "fontFamily": "var:preset|font-family|mono", "fontSize": "var:preset|font-size|small" },
        "color": { "text": "var:preset|color|muted" }
      }
    }
  },
  "customTemplates": [
    { "name": "plan-du-site", "title": "Plan du site", "postTypes": ["page"] }
  ],
  "templateParts": [
    { "name": "header", "title": "En-tête", "area": "header" },
    { "name": "footer", "title": "Pied de page", "area": "footer" },
    { "name": "sidebar", "title": "Barre latérale", "area": "uncategorized" }
  ]
}
```

- [ ] **Step 5 : écrire `functions.php`, `inc/assets.php` et `assets/css/base.css`**

`themes/jchable/functions.php` :

```php
<?php
/**
 * Thème parent jchable.
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/inc/assets.php';
```

`themes/jchable/inc/assets.php` :

```php
<?php
/**
 * Feuilles de style communes, côté site et côté éditeur.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'wp_enqueue_scripts',
	static function (): void {
		wp_enqueue_style(
			'jchable-base',
			get_template_directory_uri() . '/assets/css/base.css',
			[],
			wp_get_theme( 'jchable' )->get( 'Version' )
		);
	}
);

add_action(
	'after_setup_theme',
	static function (): void {
		add_editor_style( 'assets/css/base.css' );
	}
);

// Lien d'évitement écrit en HTML : celui du cœur (thèmes blocs) est créé en JavaScript
// et disparaîtrait sans JS. Chaque gabarit donne l'ancre « contenu » à son <main>.
remove_action( 'wp_enqueue_scripts', 'wp_enqueue_block_template_skip_link' );
add_action(
	'wp_body_open',
	static function (): void {
		echo '<a class="jchable-skip-link" href="#contenu">Aller au contenu</a>';
	}
);
```

`themes/jchable/assets/css/base.css` :

```css
/* Mise en page commune aux thèmes jchable. */

.site-columns {
	gap: var(--wp--preset--spacing--50);
	align-items: flex-start;
}

.site-main {
	flex: 999 1 640px;
	min-width: 0;
}

/* La classe vient de l'attribut className du morceau de gabarit ; le second sélecteur sert de filet de sécurité. */
.site-sidebar,
.site-columns > aside {
	flex: 1 1 280px;
	min-width: 0;
}

.site-footer .wp-block-site-title::before {
	content: "© ";
}

/* Lien d'évitement : invisible jusqu'à ce qu'il reçoive le focus clavier. */
.jchable-skip-link {
	position: absolute;
	left: -9999px;
	top: 0;
	z-index: 100000;
	padding: 0.75rem 1rem;
	background: var(--wp--preset--color--contrast);
	color: var(--wp--preset--color--base);
}

.jchable-skip-link:focus {
	left: 1rem;
	top: 1rem;
}

/* Cartes d'articles : le premier article de la page 1 est « à la une ». */
.post-card .wp-block-post-title {
	font-size: var(--wp--preset--font-size--large);
}

body:not(.paged) .post-feed .wp-block-post-template > li:first-child {
	grid-column: 1 / -1;
}

body:not(.paged) .post-feed .wp-block-post-template > li:first-child .wp-block-post-title {
	font-size: var(--wp--preset--font-size--x-large);
}
```

- [ ] **Step 6 : écrire les morceaux de gabarit**

`themes/jchable/parts/header.html` :

```html
<!-- wp:group {"className":"site-header","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-header"><!-- wp:group {"layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between"}} -->
<div class="wp-block-group"><!-- wp:group {"layout":{"type":"flex","orientation":"vertical"}} -->
<div class="wp-block-group"><!-- wp:site-title {"level":0} /-->

<!-- wp:site-tagline /--></div>
<!-- /wp:group -->

<!-- wp:navigation {"overlayMenu":"never","layout":{"type":"flex","flexWrap":"wrap"}} /--></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
```

`themes/jchable/parts/footer.html` :

```html
<!-- wp:group {"className":"site-footer","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-footer"><!-- wp:group {"layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between"}} -->
<div class="wp-block-group"><!-- wp:site-title {"level":0,"isLink":false} /-->

<!-- wp:paragraph -->
<p>Propulsé par <a href="https://wordpress.org/">WordPress</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
```

`themes/jchable/parts/sidebar.html` :

```html
<!-- wp:group {"layout":{"type":"default"}} -->
<div class="wp-block-group"><!-- wp:search {"label":"Recherche","buttonText":"Rechercher"} /-->

<!-- wp:heading -->
<h2 class="wp-block-heading">Archives</h2>
<!-- /wp:heading -->

<!-- wp:archives {"type":"yearly"} /-->

<!-- wp:heading -->
<h2 class="wp-block-heading">À propos</h2>
<!-- /wp:heading -->

<!-- wp:site-tagline /--></div>
<!-- /wp:group -->
```

- [ ] **Step 7 : écrire `templates/home.html` puis `templates/index.html`**

`themes/jchable/templates/home.html` :

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"className":"site-body","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-body"><!-- wp:group {"className":"site-columns","layout":{"type":"flex","flexWrap":"wrap","verticalAlignment":"top"}} -->
<div class="wp-block-group site-columns"><!-- wp:group {"tagName":"main","anchor":"contenu","className":"site-main","layout":{"type":"default"}} -->
<main id="contenu" class="wp-block-group site-main"><!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Derniers articles</h1>
<!-- /wp:heading -->

<!-- wp:query {"queryId":1,"query":{"perPage":10,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","inherit":true},"className":"post-feed"} -->
<div class="wp-block-query post-feed"><!-- wp:post-template {"layout":{"type":"grid","minimumColumnWidth":"18rem"}} -->
<!-- wp:group {"tagName":"article","className":"post-card","layout":{"type":"default"}} -->
<article class="wp-block-group post-card"><!-- wp:post-featured-image {"aspectRatio":"16/9"} /-->

<!-- wp:post-date {"format":"j F Y"} /-->

<!-- wp:post-title {"level":2,"isLink":true} /-->

<!-- wp:post-excerpt {"excerptLength":30} /-->

<!-- wp:post-terms {"term":"category"} /--></article>
<!-- /wp:group -->
<!-- /wp:post-template -->

<!-- wp:query-pagination {"layout":{"type":"flex","justifyContent":"space-between"}} -->
<!-- wp:query-pagination-previous {"label":"Articles plus récents"} /-->

<!-- wp:query-pagination-numbers /-->

<!-- wp:query-pagination-next {"label":"Articles plus anciens"} /-->
<!-- /wp:query-pagination -->

<!-- wp:query-no-results -->
<!-- wp:paragraph -->
<p>Aucun article pour le moment.</p>
<!-- /wp:paragraph -->
<!-- /wp:query-no-results --></div>
<!-- /wp:query --></main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"sidebar","tagName":"aside","className":"site-sidebar"} /--></div>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

`themes/jchable/templates/index.html` : copie **exacte** de `home.html` (c'est le gabarit de repli obligatoire d'un thème blocs).

L'image à la une des cartes n'est volontairement **pas** un lien : son `alt` est vide par défaut, ce qui donnerait un lien sans nom (violation axe sérieuse). Le titre suffit comme lien.

- [ ] **Step 7b : activer le thème**

Run : `npx wp-env run cli wp theme activate jchable`
Expected : `Success: Switched to 'jchable' theme.`

- [ ] **Step 8 : lancer les tests de l'accueil**

Run : `npx playwright test tests/e2e/home.spec.ts`
Expected : PASS sur les 3 projets (desktop, tablet, mobile).

Si « la page 2 » échoue parce que `body` n'a pas la classe `paged`, vérifier dans le navigateur (`http://localhost:8888/page/2/`) que WordPress l'ajoute bien ; c'est le comportement standard de `body_class()`.

- [ ] **Step 9 : commit**

```bash
git add playwright.config.ts tests/e2e themes/jchable
git commit -m "feat(jchable): squelette du thème parent et page d'accueil"
```

---

### Task 4 : article et page

**Files:**
- Create: `themes/jchable/templates/single.html`, `themes/jchable/templates/page.html`
- Create: `tests/e2e/single.spec.ts`
- Modify: `themes/jchable/assets/css/base.css` (classes `.single-post`, `.post-meta`, `.post-nav`)

**Interfaces:**
- Consumes : morceaux `header`, `footer`, `sidebar` et classes de mise en page (Task 3) ; `POSTS`, `PAGES` (Task 3).
- Produces : classes `.single-post`, `.post-meta`, `.post-comments`, `.post-nav`. Le groupe `.post-meta` accueillera le bloc `jchable/post-filename` à la Task 6.

- [ ] **Step 1 : écrire les tests, qui doivent échouer**

`tests/e2e/single.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import { POSTS, PAGES } from './fixtures';

test.describe('article', () => {
  test('affiche le titre, la catégorie, l’image légendée et le contenu', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
    await expect(page.locator('.post-meta')).toContainText('Divers');
    await expect(page.locator('.wp-block-post-content figcaption')).toContainText('The explorer of the synthetic bundle');
  });

  test('affiche les 3 commentaires et le formulaire', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('.post-comments .wp-block-comment-template > li')).toHaveCount(3);
    await expect(page.locator('.post-comments textarea#comment')).toBeVisible();
  });

  test('commentaires fermés : pas de formulaire, le reste s’affiche', async ({ page }) => {
    await page.goto(POSTS.closed.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.closed.title);
    await expect(page.locator('textarea#comment')).toHaveCount(0);
    await expect(page.locator('.wp-block-post-content')).toContainText('git blame line by line');
  });

  test('propose les liens Précédent et Suivant', async ({ page }) => {
    await page.goto(POSTS.release.path);
    await expect(page.locator('.post-nav a')).toHaveCount(2);
  });
});

test.describe('page', () => {
  test('affiche le titre et le contenu, sans commentaires', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('À propos');
    await expect(page.locator('.wp-block-post-content')).toContainText('Open Knowledge Format');
    await expect(page.locator('textarea#comment')).toHaveCount(0);
  });
});
```

- [ ] **Step 2 : lancer les tests pour vérifier qu'ils échouent**

Run : `npx playwright test tests/e2e/single.spec.ts --project=desktop`
Expected : FAIL (sans `single.html`, WordPress utilise `index.html` : pas de titre de niveau 1 égal au titre de l'article, pas de `.post-meta`).

- [ ] **Step 3 : écrire `templates/single.html`**

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"className":"site-body","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-body"><!-- wp:group {"className":"site-columns","layout":{"type":"flex","flexWrap":"wrap","verticalAlignment":"top"}} -->
<div class="wp-block-group site-columns"><!-- wp:group {"tagName":"main","anchor":"contenu","className":"site-main","layout":{"type":"default"}} -->
<main id="contenu" class="wp-block-group site-main"><!-- wp:group {"tagName":"article","className":"single-post","layout":{"type":"constrained"}} -->
<article class="wp-block-group single-post"><!-- wp:post-title {"level":1} /-->

<!-- wp:group {"className":"post-meta","layout":{"type":"flex","flexWrap":"wrap"}} -->
<div class="wp-block-group post-meta"><!-- wp:post-date {"format":"j F Y"} /-->

<!-- wp:post-terms {"term":"category"} /--></div>
<!-- /wp:group -->

<!-- wp:post-featured-image {"align":"wide"} /-->

<!-- wp:post-content {"layout":{"type":"constrained"}} /-->

<!-- wp:comments {"className":"post-comments"} -->
<div class="wp-block-comments post-comments"><!-- wp:comments-title /-->

<!-- wp:comment-template -->
<!-- wp:comment-author-name /-->

<!-- wp:comment-date /-->

<!-- wp:comment-content /-->

<!-- wp:comment-reply-link /-->
<!-- /wp:comment-template -->

<!-- wp:comments-pagination -->
<!-- wp:comments-pagination-previous /-->

<!-- wp:comments-pagination-numbers /-->

<!-- wp:comments-pagination-next /-->
<!-- /wp:comments-pagination -->

<!-- wp:post-comments-form /--></div>
<!-- /wp:comments --></article>
<!-- /wp:group -->

<!-- wp:group {"tagName":"nav","className":"post-nav","layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between"}} -->
<nav class="wp-block-group post-nav"><!-- wp:post-navigation-link {"type":"previous","label":"Précédent","showTitle":false} /-->

<!-- wp:post-navigation-link {"label":"Suivant","showTitle":false} /--></nav>
<!-- /wp:group --></main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"sidebar","tagName":"aside","className":"site-sidebar"} /--></div>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

Le groupe `.post-nav` est un `<nav>` sans nom accessible, car le bloc Groupe ne permet pas d'en ajouter un. Ça reste valide tant que la navigation principale (bloc Navigation, qui a son propre nom) est le seul autre `<nav>` de la page. Si axe signale `landmark-unique`, la Task 8 donne la correction.

- [ ] **Step 4 : écrire `templates/page.html`**

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"className":"site-body","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-body"><!-- wp:group {"className":"site-columns","layout":{"type":"flex","flexWrap":"wrap","verticalAlignment":"top"}} -->
<div class="wp-block-group site-columns"><!-- wp:group {"tagName":"main","anchor":"contenu","className":"site-main","layout":{"type":"default"}} -->
<main id="contenu" class="wp-block-group site-main"><!-- wp:group {"tagName":"article","className":"single-post","layout":{"type":"constrained"}} -->
<article class="wp-block-group single-post"><!-- wp:post-title {"level":1} /-->

<!-- wp:group {"className":"post-meta","layout":{"type":"flex","flexWrap":"wrap"}} -->
<div class="wp-block-group post-meta"></div>
<!-- /wp:group -->

<!-- wp:post-featured-image {"align":"wide"} /-->

<!-- wp:post-content {"layout":{"type":"constrained"}} /--></article>
<!-- /wp:group --></main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"sidebar","tagName":"aside","className":"site-sidebar"} /--></div>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

- [ ] **Step 5 : ajouter les styles à la fin de `base.css`**

```css
/* Article et page. */
.post-meta {
	gap: var(--wp--preset--spacing--30);
	color: var(--wp--preset--color--muted);
	font-size: var(--wp--preset--font-size--small);
}

.post-comments {
	margin-top: var(--wp--preset--spacing--60);
}

.post-nav {
	margin-top: var(--wp--preset--spacing--50);
}
```

- [ ] **Step 6 : lancer les tests**

Run : `npx playwright test tests/e2e/single.spec.ts`
Expected : PASS sur les 3 projets.

- [ ] **Step 7 : commit**

```bash
git add themes/jchable tests/e2e/single.spec.ts
git commit -m "feat(jchable): gabarits article et page avec commentaires"
```

---

### Task 5 : archives, recherche, 404 et plan du site

**Files:**
- Create: `themes/jchable/templates/archive.html`, `themes/jchable/templates/search.html`, `themes/jchable/templates/404.html`, `themes/jchable/templates/plan-du-site.html`
- Create: `tests/e2e/archives.spec.ts`

**Interfaces:**
- Consumes : classes de mise en page et carte `.post-card` (Task 3), `ARCHIVES`, `PAGES` (Task 3).
- Produces : emplacements où la Task 6 insère `jchable/archive-path` (archives et recherche, juste après le titre) et `jchable/request-path` (404, à la place du paragraphe marqué « emplacement du chemin »).

- [ ] **Step 1 : écrire les tests, qui doivent échouer**

`tests/e2e/archives.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import { ARCHIVES, PAGES } from './fixtures';

test.describe('archives', () => {
  test('catégorie : titre et 10 articles', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Divers');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(10);
  });

  test('mois : octobre 2026 contient 2 articles', async ({ page }) => {
    await page.goto(ARCHIVES.month);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('2026');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(2);
  });
});

test.describe('recherche', () => {
  test('trouve les 3 articles OKF4net', async ({ page }) => {
    await page.goto(ARCHIVES.search);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('okf4net');
    await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(3);
  });

  test('sans résultat : message clair et nouveau champ de recherche', async ({ page }) => {
    await page.goto(ARCHIVES.searchEmpty);
    await expect(page.locator('.site-main')).toContainText('Aucun résultat');
    await expect(page.locator('.site-main input[type="search"]')).toBeVisible();
  });
});

test.describe('404', () => {
  test('renvoie un code 404 et une page explicite', async ({ page }) => {
    const response = await page.goto(ARCHIVES.notFound);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
    await expect(page.locator('.site-main input[type="search"]')).toBeVisible();
  });
});

test.describe('plan du site', () => {
  test('liste les archives par mois, les catégories et les pages', async ({ page }) => {
    await page.goto(PAGES.sitemap);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plan du site');
    await expect(page.locator('.site-main a[href$="/2026/10/"]')).toHaveCount(1);
    await expect(page.locator('.site-main a[href$="/category/divers/"]')).toHaveCount(1);
    await expect(page.locator('.site-main a[href$="/a-propos/"]')).toHaveCount(1);
  });
});
```

- [ ] **Step 2 : lancer les tests pour vérifier qu'ils échouent**

Run : `npx playwright test tests/e2e/archives.spec.ts --project=desktop`
Expected : FAIL (ces pages tombent sur `index.html`, dont le titre est « Derniers articles »).

- [ ] **Step 3 : écrire `templates/archive.html`**

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"className":"site-body","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-body"><!-- wp:group {"className":"site-columns","layout":{"type":"flex","flexWrap":"wrap","verticalAlignment":"top"}} -->
<div class="wp-block-group site-columns"><!-- wp:group {"tagName":"main","anchor":"contenu","className":"site-main","layout":{"type":"default"}} -->
<main id="contenu" class="wp-block-group site-main"><!-- wp:query-title {"type":"archive"} /-->

<!-- wp:query {"queryId":2,"query":{"perPage":10,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","inherit":true},"className":"post-feed is-archive-feed"} -->
<div class="wp-block-query post-feed is-archive-feed"><!-- wp:post-template {"layout":{"type":"grid","minimumColumnWidth":"18rem"}} -->
<!-- wp:group {"tagName":"article","className":"post-card","layout":{"type":"default"}} -->
<article class="wp-block-group post-card"><!-- wp:post-date {"format":"j F Y"} /-->

<!-- wp:post-title {"level":2,"isLink":true} /-->

<!-- wp:post-excerpt {"excerptLength":30} /--></article>
<!-- /wp:group -->
<!-- /wp:post-template -->

<!-- wp:query-pagination {"layout":{"type":"flex","justifyContent":"space-between"}} -->
<!-- wp:query-pagination-previous {"label":"Articles plus récents"} /-->

<!-- wp:query-pagination-numbers /-->

<!-- wp:query-pagination-next {"label":"Articles plus anciens"} /-->
<!-- /wp:query-pagination -->

<!-- wp:query-no-results -->
<!-- wp:paragraph -->
<p>Aucun article dans cette archive.</p>
<!-- /wp:paragraph -->
<!-- /wp:query-no-results --></div>
<!-- /wp:query --></main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"sidebar","tagName":"aside","className":"site-sidebar"} /--></div>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

Le style « à la une » de la Task 3 ne doit pas s'appliquer aux archives. Ajouter à la fin de `base.css` :

```css
/* Archives et recherche : pas d'article « à la une ». */
body:not(.paged) .post-feed.is-archive-feed .wp-block-post-template > li:first-child {
	grid-column: auto;
}

body:not(.paged) .post-feed.is-archive-feed .wp-block-post-template > li:first-child .wp-block-post-title {
	font-size: var(--wp--preset--font-size--large);
}
```

- [ ] **Step 4 : écrire `templates/search.html`**

Identique à `archive.html`, avec trois différences :
- le titre devient `<!-- wp:query-title {"type":"search"} /-->` ;
- `queryId` passe à `3` ;
- le bloc « pas de résultat » est remplacé par celui-ci :

```html
<!-- wp:query-no-results -->
<!-- wp:paragraph -->
<p>Aucun résultat pour cette recherche. Essayez d'autres mots :</p>
<!-- /wp:paragraph -->

<!-- wp:search {"label":"Recherche","buttonText":"Rechercher"} /-->
<!-- /wp:query-no-results -->
```

Fichier complet `themes/jchable/templates/search.html` :

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"className":"site-body","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-body"><!-- wp:group {"className":"site-columns","layout":{"type":"flex","flexWrap":"wrap","verticalAlignment":"top"}} -->
<div class="wp-block-group site-columns"><!-- wp:group {"tagName":"main","anchor":"contenu","className":"site-main","layout":{"type":"default"}} -->
<main id="contenu" class="wp-block-group site-main"><!-- wp:query-title {"type":"search"} /-->

<!-- wp:query {"queryId":3,"query":{"perPage":10,"pages":0,"offset":0,"postType":"post","order":"desc","orderBy":"date","inherit":true},"className":"post-feed is-archive-feed"} -->
<div class="wp-block-query post-feed is-archive-feed"><!-- wp:post-template {"layout":{"type":"grid","minimumColumnWidth":"18rem"}} -->
<!-- wp:group {"tagName":"article","className":"post-card","layout":{"type":"default"}} -->
<article class="wp-block-group post-card"><!-- wp:post-date {"format":"j F Y"} /-->

<!-- wp:post-title {"level":2,"isLink":true} /-->

<!-- wp:post-excerpt {"excerptLength":30} /--></article>
<!-- /wp:group -->
<!-- /wp:post-template -->

<!-- wp:query-pagination {"layout":{"type":"flex","justifyContent":"space-between"}} -->
<!-- wp:query-pagination-previous {"label":"Articles plus récents"} /-->

<!-- wp:query-pagination-numbers /-->

<!-- wp:query-pagination-next {"label":"Articles plus anciens"} /-->
<!-- /wp:query-pagination -->

<!-- wp:query-no-results -->
<!-- wp:paragraph -->
<p>Aucun résultat pour cette recherche. Essayez d'autres mots :</p>
<!-- /wp:paragraph -->

<!-- wp:search {"label":"Recherche","buttonText":"Rechercher"} /-->
<!-- /wp:query-no-results --></div>
<!-- /wp:query --></main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"sidebar","tagName":"aside","className":"site-sidebar"} /--></div>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

- [ ] **Step 5 : écrire `templates/404.html`**

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"className":"site-body","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-body"><!-- wp:group {"tagName":"main","anchor":"contenu","className":"site-main","layout":{"type":"constrained"}} -->
<main id="contenu" class="wp-block-group site-main"><!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Page introuvable</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"className":"not-found-path"} -->
<p class="not-found-path">Aucune page n'existe à cette adresse.</p>
<!-- /wp:paragraph -->

<!-- wp:search {"label":"Recherche","buttonText":"Rechercher"} /--></main>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

Le paragraphe `.not-found-path` est l'emplacement du chemin : la Task 6 le remplace.

- [ ] **Step 6 : écrire `templates/plan-du-site.html`**

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"className":"site-body","layout":{"type":"constrained","contentSize":"1320px"}} -->
<div class="wp-block-group site-body"><!-- wp:group {"tagName":"main","anchor":"contenu","className":"site-main","layout":{"type":"constrained"}} -->
<main id="contenu" class="wp-block-group site-main"><!-- wp:post-title {"level":1} /-->

<!-- wp:heading -->
<h2 class="wp-block-heading">Archives par mois</h2>
<!-- /wp:heading -->

<!-- wp:archives {"showPostCounts":true} /-->

<!-- wp:heading -->
<h2 class="wp-block-heading">Catégories</h2>
<!-- /wp:heading -->

<!-- wp:categories {"showPostCounts":true} /-->

<!-- wp:heading -->
<h2 class="wp-block-heading">Pages</h2>
<!-- /wp:heading -->

<!-- wp:page-list /--></main>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

- [ ] **Step 7 : lancer les tests**

Run : `npx playwright test tests/e2e/archives.spec.ts`
Expected : PASS sur les 3 projets.

Si le test du plan du site échoue sur le lien `/category/divers/`, vérifier la base des catégories : `npx wp-env run cli wp option get category_base` doit être vide. Sinon, adapter `ARCHIVES.category` dans `fixtures.ts`.

- [ ] **Step 8 : commit**

```bash
git add themes/jchable tests/e2e/archives.spec.ts
git commit -m "feat(jchable): gabarits archives, recherche, 404 et plan du site"
```

---

### Task 6 : blocs dynamiques `post-filename`, `archive-path` et `request-path`

**Files:**
- Create: `themes/jchable/inc/blocks.php`, `themes/jchable/inc/archive-path.php`, `themes/jchable/blocks/editor.js`
- Create: `themes/jchable/blocks/post-filename/block.json`, `themes/jchable/blocks/post-filename/render.php`
- Create: `themes/jchable/blocks/archive-path/block.json`, `themes/jchable/blocks/archive-path/render.php`
- Create: `themes/jchable/blocks/request-path/block.json`, `themes/jchable/blocks/request-path/render.php`
- Modify: `themes/jchable/functions.php`, `themes/jchable/templates/{single,page,archive,search,404}.html`, `themes/jchable/assets/css/base.css`
- Create: `tests/e2e/blocks.spec.ts`

**Interfaces:**
- Consumes : emplacements prévus par les Tasks 4 et 5.
- Produces :
  - blocs `jchable/post-filename` (attribut `showDate: boolean`, défaut `false`), `jchable/archive-path`, `jchable/request-path` ; classes CSS générées `wp-block-jchable-post-filename`, `wp-block-jchable-archive-path`, `wp-block-jchable-request-path` ;
  - fonction PHP `jchable_archive_path_segments(): array` (liste de chaînes non échappées, toujours commençant par `'Blog'`) ;
  - script d'éditeur `jchable-blocks-editor`.

- [ ] **Step 1 : écrire les tests, qui doivent échouer**

`tests/e2e/blocks.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import { POSTS, PAGES, ARCHIVES } from './fixtures';

test.describe('bloc post-filename', () => {
  test('article : slug.md et date', async ({ page }) => {
    await page.goto(POSTS.latest.path);
    await expect(page.locator('.wp-block-jchable-post-filename')).toHaveText(
      'a-folder-of-markdown-you-can-actually-browse.md — 16.10.2026',
    );
  });

  test('page : slug.md sans date', async ({ page }) => {
    await page.goto(PAGES.about);
    await expect(page.locator('.wp-block-jchable-post-filename')).toHaveText('a-propos.md');
  });
});

test.describe('bloc archive-path', () => {
  test('catégorie', async ({ page }) => {
    await page.goto(ARCHIVES.category);
    await expect(page.locator('.wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Catégories\\Divers');
  });

  test('mois', async ({ page }) => {
    await page.goto(ARCHIVES.month);
    await expect(page.locator('.wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Archives\\2026\\10');
  });

  test('recherche', async ({ page }) => {
    await page.goto(ARCHIVES.search);
    await expect(page.locator('.wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Recherche\\« okf4net »');
  });

  test('page 2 d’une archive', async ({ page }) => {
    await page.goto(ARCHIVES.category + 'page/2/');
    await expect(page.locator('.wp-block-jchable-archive-path')).toHaveText('C:\\Blog\\Catégories\\Divers\\page-2');
  });

  test('échappe la recherche', async ({ page }) => {
    await page.goto('/?s=' + encodeURIComponent('<b>x</b>'));
    const path = page.locator('.wp-block-jchable-archive-path');
    await expect(path).toHaveText('C:\\Blog\\Recherche\\« <b>x</b> »');
    await expect(path.locator('b')).toHaveCount(0);
  });
});

test.describe('bloc request-path', () => {
  test('affiche le chemin demandé', async ({ page }) => {
    await page.goto(ARCHIVES.notFound);
    await expect(page.locator('.wp-block-jchable-request-path')).toHaveText(ARCHIVES.notFound);
  });

  test('échappe le chemin de la 404', async ({ page }) => {
    await page.goto('/%3Cscript%3Ealert(1)%3C/script%3E/');
    const path = page.locator('.wp-block-jchable-request-path');
    await expect(path).toContainText('%3Cscript%3E');
    await expect(page.locator('.site-main script')).toHaveCount(0);
  });
});
```

- [ ] **Step 2 : lancer les tests pour vérifier qu'ils échouent**

Run : `npx playwright test tests/e2e/blocks.spec.ts --project=desktop`
Expected : FAIL (aucun élément `.wp-block-jchable-*`).

- [ ] **Step 3 : écrire la fonction des segments `inc/archive-path.php`**

```php
<?php
/**
 * Chemin façon Windows de la page d'archives courante.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Segments du chemin, non échappés : à échapper à l'affichage.
 *
 * @return string[] Toujours au moins [ 'Blog' ].
 */
function jchable_archive_path_segments(): array {
	$segments = [ 'Blog' ];

	if ( is_search() ) {
		$segments[] = 'Recherche';
		$segments[] = '« ' . get_search_query( false ) . ' »';
	} elseif ( is_category() || is_tag() || is_tax() ) {
		$segments[] = is_category() ? 'Catégories' : 'Étiquettes';
		$segments[] = single_term_title( '', false );
	} elseif ( is_author() ) {
		$segments[] = 'Auteurs';
		$segments[] = get_the_author_meta( 'display_name', (int) get_query_var( 'author' ) );
	} elseif ( is_date() ) {
		$segments[] = 'Archives';
		$segments[] = (string) get_query_var( 'year' );
		if ( get_query_var( 'monthnum' ) ) {
			$segments[] = sprintf( '%02d', (int) get_query_var( 'monthnum' ) );
		}
		if ( get_query_var( 'day' ) ) {
			$segments[] = sprintf( '%02d', (int) get_query_var( 'day' ) );
		}
	}

	if ( is_paged() ) {
		$segments[] = 'page-' . (int) get_query_var( 'paged' );
	}

	return $segments;
}
```

- [ ] **Step 4 : écrire les 3 blocs**

`themes/jchable/blocks/post-filename/block.json` :

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "jchable/post-filename",
  "title": "Nom de fichier de l'article",
  "category": "theme",
  "description": "Affiche le slug de l'article sous la forme slug.md, avec la date en option.",
  "textdomain": "jchable",
  "usesContext": ["postId", "postType"],
  "attributes": {
    "showDate": { "type": "boolean", "default": false }
  },
  "supports": { "html": false, "color": { "text": true, "background": true }, "typography": { "fontSize": true } },
  "editorScript": "jchable-blocks-editor",
  "render": "file:./render.php"
}
```

`themes/jchable/blocks/post-filename/render.php` :

```php
<?php
/**
 * Rendu de jchable/post-filename.
 *
 * @var array    $attributes
 * @var WP_Block $block
 */

defined( 'ABSPATH' ) || exit;

$jchable_post_id = (int) ( $block->context['postId'] ?? get_the_ID() );
if ( ! $jchable_post_id ) {
	return;
}

$jchable_slug = get_post_field( 'post_name', $jchable_post_id );
if ( '' === $jchable_slug ) {
	$jchable_slug = sanitize_title( get_the_title( $jchable_post_id ) );
}

$jchable_text = $jchable_slug . '.md';
if ( ! empty( $attributes['showDate'] ) && 'page' !== get_post_type( $jchable_post_id ) ) {
	$jchable_text .= ' — ' . get_the_date( 'd.m.Y', $jchable_post_id );
}

printf( '<span %s>%s</span>', get_block_wrapper_attributes(), esc_html( $jchable_text ) );
```

`themes/jchable/blocks/archive-path/block.json` :

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "jchable/archive-path",
  "title": "Chemin de l'archive",
  "category": "theme",
  "description": "Affiche la page d'archives courante comme un chemin Windows : C:\\Blog\\Archives\\2026\\10.",
  "textdomain": "jchable",
  "supports": { "html": false, "color": { "text": true, "background": true }, "typography": { "fontSize": true } },
  "editorScript": "jchable-blocks-editor",
  "render": "file:./render.php"
}
```

`themes/jchable/blocks/archive-path/render.php` :

```php
<?php
/**
 * Rendu de jchable/archive-path.
 */

defined( 'ABSPATH' ) || exit;

printf(
	'<p %s>%s</p>',
	get_block_wrapper_attributes(),
	esc_html( 'C:\\' . implode( '\\', jchable_archive_path_segments() ) )
);
```

`themes/jchable/blocks/request-path/block.json` :

```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "jchable/request-path",
  "title": "Chemin demandé",
  "category": "theme",
  "description": "Affiche le chemin de l'adresse demandée (utile sur la page 404).",
  "textdomain": "jchable",
  "supports": { "html": false, "color": { "text": true, "background": true }, "typography": { "fontSize": true } },
  "editorScript": "jchable-blocks-editor",
  "render": "file:./render.php"
}
```

`themes/jchable/blocks/request-path/render.php` :

```php
<?php
/**
 * Rendu de jchable/request-path.
 */

defined( 'ABSPATH' ) || exit;

// Le chemin n'est qu'affiché, échappé par esc_html() ci-dessous.
$jchable_uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
$jchable_path = wp_parse_url( $jchable_uri, PHP_URL_PATH );
if ( ! is_string( $jchable_path ) || '' === $jchable_path ) {
	$jchable_path = '/';
}

printf( '<code %s>%s</code>', get_block_wrapper_attributes(), esc_html( $jchable_path ) );
```

- [ ] **Step 5 : écrire l'enregistrement PHP et le script d'éditeur**

`themes/jchable/inc/blocks.php` :

```php
<?php
/**
 * Blocs dynamiques du thème.
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/archive-path.php';

add_action(
	'init',
	static function (): void {
		wp_register_script(
			'jchable-blocks-editor',
			get_template_directory_uri() . '/blocks/editor.js',
			[ 'wp-blocks', 'wp-element', 'wp-server-side-render', 'wp-block-editor' ],
			wp_get_theme( 'jchable' )->get( 'Version' ),
			true
		);

		foreach ( [ 'post-filename', 'archive-path', 'request-path' ] as $jchable_block ) {
			register_block_type_from_metadata( get_template_directory() . '/blocks/' . $jchable_block );
		}
	}
);
```

`themes/jchable/blocks/editor.js` :

```js
/**
 * Enregistre les blocs dynamiques côté éditeur. Le rendu vient du serveur
 * (ServerSideRender). Fichier écrit à la main, sans build.
 */
( function ( blocks, element, ServerSideRender, blockEditor ) {
	const el = element.createElement;

	[ 'jchable/post-filename', 'jchable/archive-path', 'jchable/request-path' ].forEach( function ( name ) {
		blocks.registerBlockType( name, {
			edit: function ( props ) {
				const postId = props.context && props.context.postId;
				return el(
					'div',
					blockEditor.useBlockProps(),
					el( ServerSideRender, {
						block: name,
						attributes: props.attributes,
						urlQueryArgs: postId ? { post_id: postId } : {},
					} )
				);
			},
			save: function () {
				return null;
			},
		} );
	} );
} )( window.wp.blocks, window.wp.element, window.wp.serverSideRender, window.wp.blockEditor );
```

Ajouter dans `themes/jchable/functions.php`, après la ligne `require_once __DIR__ . '/inc/assets.php';` :

```php
require_once __DIR__ . '/inc/blocks.php';
```

- [ ] **Step 6 : placer les blocs dans les gabarits**

`templates/single.html` : dans le groupe `.post-meta`, remplacer `<!-- wp:post-date {"format":"j F Y"} /-->` par :

```html
<!-- wp:jchable/post-filename {"showDate":true} /-->
```

`templates/page.html` : remplacer le groupe `.post-meta` vide par :

```html
<!-- wp:group {"className":"post-meta","layout":{"type":"flex","flexWrap":"wrap"}} -->
<div class="wp-block-group post-meta"><!-- wp:jchable/post-filename /--></div>
<!-- /wp:group -->
```

`templates/archive.html` et `templates/search.html` : juste après la ligne `query-title`, ajouter :

```html

<!-- wp:jchable/archive-path /-->
```

`templates/404.html` : remplacer le paragraphe `.not-found-path` (3 lignes, de `<!-- wp:paragraph {"className":"not-found-path"} -->` à `<!-- /wp:paragraph -->`) par :

```html
<!-- wp:paragraph -->
<p>Aucune page n'existe à l'adresse :</p>
<!-- /wp:paragraph -->

<!-- wp:jchable/request-path /-->
```

Ajouter à la fin de `base.css` :

```css
/* Blocs maison : police à chasse fixe. */
.wp-block-jchable-post-filename,
.wp-block-jchable-archive-path,
.wp-block-jchable-request-path {
	font-family: var(--wp--preset--font-family--mono);
	font-size: var(--wp--preset--font-size--small);
	overflow-wrap: anywhere;
}
```

- [ ] **Step 7 : lancer les tests**

Run : `npx playwright test tests/e2e/blocks.spec.ts tests/e2e/single.spec.ts tests/e2e/archives.spec.ts`
Expected : PASS sur les 3 projets.

- [ ] **Step 8 : vérifier les blocs dans l'éditeur**

Ouvrir `http://localhost:8888/wp-admin/site-editor.php` (identifiants `admin` / `password`), puis le gabarit « Articles seuls ». Expected : le bloc « Nom de fichier de l'article » s'affiche avec un aperçu, sans message « Ce bloc contient du contenu inattendu ou non valide ». Faire de même pour « Archives » (chemin) et « Page : 404 ».

- [ ] **Step 9 : commit**

```bash
git add themes/jchable tests/e2e/blocks.spec.ts
git commit -m "feat(jchable): blocs dynamiques post-filename, archive-path et request-path"
```

---

### Task 7 : langue du contenu

**Files:**
- Create: `themes/jchable/inc/lang.php`
- Modify: `themes/jchable/functions.php`
- Create: `tests/e2e/lang.spec.ts`

**Interfaces:**
- Consumes : méta `jchable_lang` posée par le contenu de test (Task 2).
- Produces : méta `jchable_lang` enregistrée pour tous les types de contenu ; fonction `jchable_sanitize_lang( mixed $value ): string` (code de langue BCP 47 valide, ou chaîne vide).

- [ ] **Step 1 : écrire les tests, qui doivent échouer**

`tests/e2e/lang.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import { POSTS } from './fixtures';

test('la page est en français', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
});

test('le contenu d’un article anglais porte lang="en"', async ({ page }) => {
  await page.goto(POSTS.latest.path);
  await expect(page.locator('.wp-block-post-content')).toHaveAttribute('lang', 'en');
});

test('sans champ jchable_lang, pas d’attribut lang sur le contenu', async ({ page }) => {
  await page.goto(POSTS.filler.path);
  await expect(page.locator('.wp-block-post-content')).not.toHaveAttribute('lang', /.+/);
});
```

- [ ] **Step 2 : lancer les tests pour vérifier qu'ils échouent**

Run : `npx playwright test tests/e2e/lang.spec.ts --project=desktop`
Expected : le 1er test PASSE déjà (WordPress gère la langue de la page) ; le 2e ÉCHOUE (pas d'attribut `lang` sur le contenu).

- [ ] **Step 3 : écrire `inc/lang.php`**

```php
<?php
/**
 * Langue du contenu d'un article : champ personnalisé jchable_lang (« en », « fr »…).
 */

defined( 'ABSPATH' ) || exit;

/**
 * Renvoie un code de langue valide, ou une chaîne vide.
 *
 * @param mixed $value Valeur brute.
 */
function jchable_sanitize_lang( $value ): string {
	$value = is_string( $value ) ? trim( $value ) : '';
	return 1 === preg_match( '/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/', $value ) ? $value : '';
}

add_action(
	'init',
	static function (): void {
		register_post_meta(
			'',
			'jchable_lang',
			[
				'type'              => 'string',
				'single'            => true,
				'show_in_rest'      => true,
				'sanitize_callback' => 'jchable_sanitize_lang',
				'auth_callback'     => static fn(): bool => current_user_can( 'edit_posts' ),
			]
		);
	}
);

add_filter(
	'render_block_core/post-content',
	static function ( string $content, array $parsed_block, WP_Block $block ): string {
		$post_id = (int) ( $block->context['postId'] ?? 0 );
		$lang    = $post_id ? jchable_sanitize_lang( get_post_meta( $post_id, 'jchable_lang', true ) ) : '';
		if ( '' === $lang ) {
			return $content;
		}
		$tags = new WP_HTML_Tag_Processor( $content );
		if ( $tags->next_tag() ) {
			$tags->set_attribute( 'lang', $lang );
		}
		return $tags->get_updated_html();
	},
	10,
	3
);
```

Ajouter dans `functions.php`, après `require_once __DIR__ . '/inc/blocks.php';` :

```php
require_once __DIR__ . '/inc/lang.php';
```

- [ ] **Step 4 : lancer les tests**

Run : `npx playwright test tests/e2e/lang.spec.ts`
Expected : PASS sur les 3 projets.

- [ ] **Step 5 : commit**

```bash
git add themes/jchable tests/e2e/lang.spec.ts
git commit -m "feat(jchable): attribut lang du contenu via le champ jchable_lang"
```

---

### Task 8 : responsive, accessibilité et lecture sans JavaScript

**Files:**
- Create: `tests/e2e/layout.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/nojs.spec.ts`
- Modify: `themes/jchable/assets/css/base.css`

**Interfaces:**
- Consumes : tous les gabarits (Tasks 3 à 7), `expectNoHorizontalScroll` (Task 3).
- Produces : aucune nouvelle interface.

- [ ] **Step 1 : écrire les tests**

`tests/e2e/layout.spec.ts` :

```ts
import { test } from '@playwright/test';
import { POSTS, PAGES, ARCHIVES } from './fixtures';
import { expectNoHorizontalScroll } from './helpers';

const PATHS = [
  '/',
  '/page/2/',
  POSTS.latest.path,
  POSTS.long.path,
  POSTS.code.path,
  PAGES.about,
  PAGES.sitemap,
  ARCHIVES.category,
  ARCHIVES.month,
  ARCHIVES.search,
  ARCHIVES.searchEmpty,
  ARCHIVES.notFound,
];

for (const path of PATHS) {
  test(`pas de défilement horizontal : ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  });
}
```

`tests/e2e/a11y.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { POSTS, PAGES, ARCHIVES } from './fixtures';

const PATHS = ['/', POSTS.latest.path, POSTS.code.path, PAGES.about, PAGES.sitemap, ARCHIVES.category, ARCHIVES.search, ARCHIVES.notFound];

for (const path of PATHS) {
  test(`axe : aucune violation sérieuse ou critique sur ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking).toEqual([]);
  });
}

test('avec JavaScript : le lien d’évitement du cœur ne double pas le nôtre', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a.jchable-skip-link')).toHaveCount(1);
  await expect(page.locator('a.skip-link')).toHaveCount(0);
});

test('code : la zone défilante est accessible au clavier', async ({ page }) => {
  await page.goto(POSTS.code.path);
  await expect(page.locator('.wp-block-code')).toHaveAttribute('tabindex', '0');
});
```

`tests/e2e/nojs.spec.ts` :

```ts
import { test, expect } from '@playwright/test';
import { POSTS } from './fixtures';

test.use({ javaScriptEnabled: false });

test('sans JavaScript : lien d’évitement unique vers le contenu', async ({ page }) => {
  await page.goto('/');
  const skip = page.locator('a.jchable-skip-link');
  await expect(skip).toHaveCount(1);
  await expect(skip).toHaveAttribute('href', '#contenu');
  await expect(page.locator('main#contenu')).toHaveCount(1);
});

test('sans JavaScript : accueil lisible et navigable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.post-feed .wp-block-post')).toHaveCount(10);
  await page.getByRole('link', { name: POSTS.latest.title }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(POSTS.latest.title);
  await expect(page.locator('.post-comments textarea#comment')).toBeVisible();
});
```

- [ ] **Step 2 : lancer les tests**

Run : `npx playwright test tests/e2e/layout.spec.ts tests/e2e/a11y.spec.ts tests/e2e/nojs.spec.ts`
Expected : la plupart passent. Les échecs les plus probables sont un défilement horizontal sur mobile (`titre-tres-long`, `bloc-de-code`) ou un contraste insuffisant.

- [ ] **Step 3 : corriger les débordements en ajoutant ces règles à la fin de `base.css`**

```css
/* Débordements : mots interminables, URL, code, médias. */
.wp-block-post-title,
.wp-block-post-content,
.wp-block-post-excerpt,
.wp-block-query-title {
	overflow-wrap: anywhere;
}

.wp-block-post-content pre,
.wp-block-code {
	max-width: 100%;
	overflow-x: auto;
}

.wp-block-post-content img,
.wp-block-post-featured-image img {
	max-width: 100%;
	height: auto;
}

.site-header .wp-block-navigation__container {
	flex-wrap: wrap;
}

.wp-block-search__inside-wrapper {
	min-width: 0;
}
```

Une zone qui défile (`overflow-x: auto`) doit pouvoir recevoir le focus clavier, sinon axe signale `scrollable-region-focusable` (sérieux). Ajouter à la fin de `themes/jchable/inc/blocks.php` :

```php
// Les blocs de code défilent horizontalement : ils doivent être atteignables au clavier.
add_filter(
	'render_block_core/code',
	static function ( string $content ): string {
		$tags = new WP_HTML_Tag_Processor( $content );
		if ( $tags->next_tag( 'pre' ) ) {
			$tags->set_attribute( 'tabindex', '0' );
		}
		return $tags->get_updated_html();
	}
);
```

- [ ] **Step 4 : relancer et corriger jusqu'au vert**

Run : `npx playwright test tests/e2e/layout.spec.ts tests/e2e/a11y.spec.ts tests/e2e/nojs.spec.ts`
Expected : PASS sur les 3 projets.

Si axe signale encore un problème :
- `color-contrast` : foncer la couleur concernée dans la palette de `theme.json` (par exemple `muted`) jusqu'à 4,5:1 sur fond blanc.
- `landmark-unique` sur deux `<nav>` sans nom : remplacer le `tagName` `nav` du groupe `.post-nav` (Task 4) par `div`.

Ne jamais ignorer une règle axe pour faire passer le test.

- [ ] **Step 5 : relancer toute la suite**

Run : `npm run test:e2e`
Expected : PASS sur les 3 projets.

- [ ] **Step 6 : commit**

```bash
git add themes/jchable tests/e2e
git commit -m "test(jchable): responsive, accessibilité et lecture sans JavaScript"
```

---

### Task 9 : Theme Check

**Files:**
- Create: `tools/check/theme-check.php`, `themes/jchable/readme.txt`

**Interfaces:**
- Consumes : script `check` (Task 1), plugin Theme Check installé par wp-env.
- Produces : `npm run check` qui sort en erreur si Theme Check trouve une exigence (REQUIRED) non respectée.

- [ ] **Step 1 : regarder si Theme Check fournit une commande WP-CLI**

Run : `npx wp-env run cli wp theme-check run jchable`
Theme Check fournit normalement cette commande. Elle peut toutefois échouer dès qu'il y a un simple avertissement : lire sa sortie pour situer les problèmes, mais garder le script maison du Step 2 pour `npm run check`, car lui n'échoue que sur les exigences (REQUIRED).

- [ ] **Step 2 : écrire `tools/check/theme-check.php`**

```php
<?php
/**
 * Lance Theme Check sur un thème : wp eval-file theme-check.php <slug>
 * Sort en erreur s'il reste des exigences (REQUIRED) non respectées.
 */

$jchable_slug = $args[0] ?? 'jchable';

if ( ! function_exists( 'run_themechecks_against_theme' ) ) {
	$jchable_base = WP_PLUGIN_DIR . '/theme-check/checkbase.php';
	if ( ! file_exists( $jchable_base ) ) {
		WP_CLI::error( 'Plugin Theme Check introuvable.' );
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once $jchable_base;
}

if ( ! function_exists( 'run_themechecks_against_theme' ) ) {
	WP_CLI::error( 'Cette version de Theme Check ne fournit pas run_themechecks_against_theme() : lancer la vérification depuis Apparence › Theme Check.' );
}

$jchable_theme = wp_get_theme( $jchable_slug );
if ( ! $jchable_theme->exists() ) {
	WP_CLI::error( "Thème introuvable : {$jchable_slug}" );
}

run_themechecks_against_theme( $jchable_theme, $jchable_slug );

global $themechecks;
$jchable_required = 0;
foreach ( (array) $themechecks as $jchable_check ) {
	if ( ! method_exists( $jchable_check, 'getError' ) ) {
		continue;
	}
	foreach ( (array) $jchable_check->getError() as $jchable_error ) {
		$jchable_line = trim( wp_strip_all_tags( $jchable_error ) );
		WP_CLI::line( $jchable_line );
		if ( str_starts_with( $jchable_line, 'REQUIRED' ) ) {
			++$jchable_required;
		}
	}
}

if ( $jchable_required > 0 ) {
	WP_CLI::error( "{$jchable_required} exigence(s) non respectée(s)." );
}
WP_CLI::success( 'Theme Check : aucune exigence bloquante.' );
```

- [ ] **Step 3 : écrire `themes/jchable/readme.txt`**

```
=== jchable ===
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Thème parent blocs de julien.chable.net.

== Description ==

Gabarits, blocs dynamiques (nom de fichier de l'article, chemin d'archive, chemin demandé) et réglages communs aux thèmes jchable-*.

== Changelog ==

= 0.1.0 =
* Première version.

== Copyright ==

jchable, (C) 2026 Julien Chable.
jchable is distributed under the terms of the GNU GPL v2 or later.
```

- [ ] **Step 4 : lancer la vérification**

Run : `npm run check`
Expected : `Success: Theme Check : aucune exigence bloquante.`

Corriger chaque ligne REQUIRED signalée, puis relancer. Les avertissements (WARNING, RECOMMENDED) sont à lire, sans obligation de les corriger.

Theme Check exige une capture d'écran. Si `screenshot.png` est signalé, la générer depuis le WordPress local (1200 × 900, format attendu par WordPress) :

Run : `npx playwright screenshot --viewport-size=1200,900 http://localhost:8888/ themes/jchable/screenshot.png`
Puis relancer `npm run check`, et ajouter `themes/jchable/screenshot.png` au commit.

Si le script s'arrête sur « ne fournit pas run_themechecks_against_theme() » : activer le plugin (`npx wp-env run cli wp plugin activate theme-check`), lancer la vérification depuis Apparence › Theme Check, corriger les REQUIRED, et noter dans le README que la vérification se fait depuis l'admin.

- [ ] **Step 5 : commit**

```bash
git add tools/check themes/jchable/readme.txt package.json
git commit -m "chore: vérification Theme Check du thème parent"
```

---

### Task 10 : génération des zips

**Files:**
- Create: `tools/zip/files.mjs`, `tools/zip/files.test.mjs`, `tools/zip/zip.mjs`

**Interfaces:**
- Produces :
  - `listThemeFiles(themeDir: string): string[]` : chemins relatifs, séparés par `/`, triés, sans `node_modules/`, `src/`, `.git/`, `*.map`, `.DS_Store`, `Thumbs.db` ;
  - `npm run zip [thème…]` écrit `dist/<thème>.zip`, dont la racine est le dossier `<thème>/`. Sans argument : tous les dossiers de `themes/` qui contiennent un `style.css`.

- [ ] **Step 1 : écrire le test, qui doit échouer**

`tools/zip/files.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listThemeFiles } from './files.mjs';

function makeTheme(files) {
  const dir = mkdtempSync(join(tmpdir(), 'jchable-zip-'));
  for (const file of files) {
    const full = join(dir, ...file.split('/'));
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, 'x');
  }
  return dir;
}

test('liste les fichiers du thème, triés, avec des séparateurs /', () => {
  const dir = makeTheme(['style.css', 'templates/home.html', 'blocks/post-filename/block.json']);
  try {
    assert.deepEqual(listThemeFiles(dir), [
      'blocks/post-filename/block.json',
      'style.css',
      'templates/home.html',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('exclut les sources, les dépendances et les fichiers parasites', () => {
  const dir = makeTheme([
    'style.css',
    'node_modules/pkg/index.js',
    'src/main.ts',
    '.git/HEAD',
    'assets/dist/app.js',
    'assets/dist/app.js.map',
    '.DS_Store',
    'assets/Thumbs.db',
  ]);
  try {
    assert.deepEqual(listThemeFiles(dir), ['assets/dist/app.js', 'style.css']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Run : `npm run test:tools`
Expected : FAIL avec `Cannot find module` sur `./files.mjs`.

- [ ] **Step 3 : écrire `tools/zip/files.mjs`**

```js
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const EXCLUDED_DIRS = new Set(['node_modules', 'src', '.git']);
const EXCLUDED_FILES = [/\.map$/, /^\.DS_Store$/, /^Thumbs\.db$/];

/**
 * Fichiers à mettre dans le zip d'un thème.
 * @param {string} themeDir
 * @returns {string[]} chemins relatifs, séparés par « / », triés
 */
export function listThemeFiles(themeDir) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (!EXCLUDED_DIRS.has(name)) walk(full);
        continue;
      }
      if (EXCLUDED_FILES.some((re) => re.test(name))) continue;
      files.push(relative(themeDir, full).split(sep).join('/'));
    }
  };
  walk(themeDir);
  return files.sort();
}
```

- [ ] **Step 4 : lancer le test**

Run : `npm run test:tools`
Expected : PASS (2 tests).

- [ ] **Step 5 : écrire `tools/zip/zip.mjs`**

```js
import archiver from 'archiver';
import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listThemeFiles } from './files.mjs';

const THEMES_DIR = 'themes';
const OUT_DIR = 'dist';

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const available = readdirSync(THEMES_DIR).filter((name) => existsSync(join(THEMES_DIR, name, 'style.css')));
const themes = requested.length > 0 ? requested : available;

for (const theme of themes) {
  if (!available.includes(theme)) {
    console.error(`Thème introuvable : ${theme} (disponibles : ${available.join(', ')})`);
    process.exit(1);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

for (const theme of themes) {
  const themeDir = join(THEMES_DIR, theme);
  const target = join(OUT_DIR, `${theme}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const done = new Promise((resolve, reject) => {
    const output = createWriteStream(target);
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
  });
  for (const file of listThemeFiles(themeDir)) {
    archive.file(join(themeDir, file), { name: `${theme}/${file}` });
  }
  await archive.finalize();
  await done;
  console.log(`${target} : ${archive.pointer()} octets`);
}
```

- [ ] **Step 6 : générer le zip et vérifier son contenu**

Run : `npm run zip`
Expected : `dist/jchable.zip : <n> octets`.
Run, dans PowerShell : `C:\Windows\System32\tar.exe -tf dist\jchable.zip | Select-Object -First 20`
(dans Git Bash : `/c/Windows/System32/tar.exe -tf dist/jchable.zip | head -20`. Le `tar` de Git Bash est GNU tar et ne lit pas les zips : il faut celui de Windows.)
Expected : tous les chemins commencent par `jchable/` ; on trouve `jchable/style.css`, `jchable/theme.json` et `jchable/templates/home.html`.

- [ ] **Step 7 : commit**

```bash
git add tools/zip
git commit -m "chore: génération des zips de thèmes"
```

---

### Task 11 : README et vérification sur le vrai site

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes : toutes les commandes npm.
- Produces : documentation du dépôt ; vérification manuelle des commentaires Jetpack sur julien.chable.net.

- [ ] **Step 1 : écrire `README.md`**

````markdown
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
````

- [ ] **Step 2 : lancer toute la suite une dernière fois**

Run : `npm run test:tools && npm run test:e2e && npm run check && npm run zip`
Expected : tout passe ; `dist/jchable.zip` est généré.

- [ ] **Step 3 : commit**

```bash
git add README.md
git commit -m "docs: README du dépôt"
```

- [ ] **Step 4 : vérifier sur le vrai site, sans activer le thème (à faire par Julien)**

1. Sur julien.chable.net : Apparence › Thèmes › Ajouter › Téléverser un thème › `dist/jchable.zip`. **Ne pas activer.**
2. Sur la carte du thème `jchable`, cliquer « Aperçu en direct ». Cet aperçu ne change rien pour les visiteurs.
3. Dans l'aperçu, ouvrir un article qui a des commentaires.
4. Vérifier :
   - [ ] les commentaires existants s'affichent ;
   - [ ] le formulaire de commentaire est celui de Jetpack (cadre avec « Connexion avec WordPress.com / Google… ») ou, à défaut, le formulaire WordPress standard qui fonctionne ;
   - [ ] l'accueil, une archive et une recherche s'affichent sans erreur ;
   - [ ] la page `/nexiste-pas/` affiche « Page introuvable ».
5. Quitter l'aperçu sans activer.

Si le formulaire Jetpack n'apparaît pas, noter ce qui s'affiche à la place : la solution de repli sera traitée dans le plan de l'étape 2.

- [ ] **Step 5 : fin de l'étape**

Utiliser `superpowers:finishing-a-development-branch` pour fusionner la branche `etape-1-socle`.
