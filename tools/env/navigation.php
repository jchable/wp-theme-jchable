<?php
/**
 * Menu principal du WordPress local : Accueil, À propos, Plan du site.
 * Remplace tout menu de navigation existant (y compris le menu de repli créé automatiquement).
 * Lancé par seed.php, ou seul : wp eval-file wp-content/jchable-tools/env/navigation.php
 */

foreach ( get_posts(
	[
		'post_type'   => 'wp_navigation',
		'post_status' => 'any',
		'numberposts' => -1,
	]
) as $jchable_old_menu ) {
	wp_delete_post( $jchable_old_menu->ID, true );
}

$jchable_links = [
	[ 'Accueil', home_url( '/' ), 'icon-folder' ],
	[ 'À propos', home_url( '/a-propos/' ), 'icon-text' ],
	[ 'Plan du site', home_url( '/plan-du-site/' ), 'icon-folder-blue' ],
];

$jchable_menu = '';
foreach ( $jchable_links as $jchable_link ) {
	$jchable_menu .= '<!-- wp:navigation-link ' . wp_json_encode(
		[
			'label' => $jchable_link[0],
			'type'  => 'custom',
			'url'   => $jchable_link[1],
			'kind'      => 'custom',
			'className' => $jchable_link[2],
		],
		JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
	) . " /-->\n";
}

wp_insert_post(
	[
		'post_type'    => 'wp_navigation',
		'post_title'   => 'Menu principal',
		'post_status'  => 'publish',
		'post_content' => $jchable_menu,
	]
);
