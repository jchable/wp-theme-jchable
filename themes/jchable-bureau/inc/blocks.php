<?php
/**
 * Blocs dynamiques du thème Bureau : barre des tâches et lien d'accueil.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Adresse de la page « Plan du site » : la page qui utilise le gabarit plan-du-site,
 * sinon l'accueil. Modifiable avec le filtre jchable_bureau_sitemap_url.
 */
function jchable_bureau_sitemap_url(): string {
	$pages = get_posts(
		[
			'post_type'   => 'page',
			'post_status' => 'publish',
			'numberposts' => 1,
			'fields'      => 'ids',
			'meta_key'    => '_wp_page_template', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
			'meta_value'  => 'plan-du-site', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
		]
	);
	$url = $pages ? (string) get_permalink( (int) $pages[0] ) : home_url( '/' );

	return (string) apply_filters( 'jchable_bureau_sitemap_url', $url );
}

/**
 * Titre court de la page en cours, pour l'onglet de la barre des tâches.
 */
function jchable_bureau_page_label(): string {
	if ( is_search() ) {
		return 'Recherche';
	}
	if ( is_404() ) {
		return 'Page introuvable';
	}
	if ( is_singular() ) {
		return wp_strip_all_tags( get_the_title( (int) get_queried_object_id() ) );
	}
	if ( is_archive() ) {
		return wp_strip_all_tags( get_the_archive_title() );
	}
	return 'Accueil';
}

add_action(
	'init',
	static function (): void {
		foreach ( [ 'start-button', 'clock', 'taskbar-tab', 'home-link', 'taskbar-links' ] as $jchable_bureau_block ) {
			register_block_type_from_metadata( get_stylesheet_directory() . '/blocks/' . $jchable_bureau_block );
		}
	}
);
