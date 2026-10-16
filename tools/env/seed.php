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

// Menu principal réel (le menu de repli de WordPress produit des listes imbriquées invalides).
require __DIR__ . "/navigation.php";
require __DIR__ . "/classic-content.php";

update_option( 'jchable_seeded', 1 );
WP_CLI::success( 'Contenu de test créé.' );
