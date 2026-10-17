<?php
/**
 * Blocs dynamiques du thème Arcade : numéro de stage, high score, logo et lien d'accueil.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Identifiants des articles publiés, du plus ancien au plus récent (à date égale, par identifiant).
 *
 * Le résultat est gardé dans le cache d'objets, invalidé dès qu'un article change (last_changed).
 *
 * @return int[]
 */
function jchable_arcade_published_ids(): array {
	$key    = 'published_ids:' . wp_cache_get_last_changed( 'posts' );
	$cached = wp_cache_get( $key, 'jchable_arcade' );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	$ids = get_posts(
		[
			'post_type'           => 'post',
			'post_status'         => 'publish',
			'posts_per_page'      => -1,
			'fields'              => 'ids',
			'orderby'             => [
				'date' => 'ASC',
				'ID'   => 'ASC',
			],
			'no_found_rows'       => true,
			'ignore_sticky_posts' => true,
		]
	);
	$ids = array_map( 'intval', $ids );
	wp_cache_set( $key, $ids, 'jchable_arcade' );

	return $ids;
}

/**
 * Numéro d'ordre d'un article parmi les articles publiés : 1 pour le plus ancien. 0 si l'article n'en fait pas partie.
 */
function jchable_arcade_stage_number( int $post_id ): int {
	$position = array_search( $post_id, jchable_arcade_published_ids(), true );

	return false === $position ? 0 : (int) $position + 1;
}

add_action(
	'init',
	static function (): void {
		foreach ( [ 'stage', 'high-score', 'logo', 'home-link' ] as $jchable_arcade_block ) {
			register_block_type_from_metadata( get_stylesheet_directory() . '/blocks/' . $jchable_arcade_block );
		}
	}
);
