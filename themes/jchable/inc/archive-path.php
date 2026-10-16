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
