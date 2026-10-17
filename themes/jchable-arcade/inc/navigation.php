<?php
/**
 * Menu : repère l'entrée courante.
 *
 * Le bloc Navigation ne signale « page courante » que pour les liens vers un contenu (article, page).
 * Les liens personnalisés (accueil, plan du site…) n'ont rien : on ajoute ici la classe current-menu-item
 * et aria-current="page" quand l'adresse du lien est celle de la page affichée.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Adresse sans paramètre, sans ancre ni barre finale, pour comparer deux liens.
 */
function jchable_arcade_normalize_url( string $url ): string {
	$parts = wp_parse_url( $url );
	if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
		return '';
	}

	return strtolower( $parts['host'] . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' ) ) . untrailingslashit( $parts['path'] ?? '' );
}

add_filter(
	'render_block_core/navigation-link',
	static function ( string $content, array $block ): string {
		$url = isset( $block['attrs']['url'] ) && is_string( $block['attrs']['url'] ) ? $block['attrs']['url'] : '';
		if ( '' === $url || str_contains( $content, 'aria-current=' ) ) {
			return $content;
		}

		global $wp;
		$link = jchable_arcade_normalize_url( $url );
		if ( '' === $link ) {
			return $content;
		}

		// Les pages 2, 3… de la liste des articles restent « Accueil ».
		$current = jchable_arcade_normalize_url( home_url( is_front_page() || is_home() ? '/' : (string) ( $wp->request ?? '' ) ) );
		if ( $link !== $current ) {
			return $content;
		}

		$tags = new WP_HTML_Tag_Processor( $content );
		if ( $tags->next_tag( 'li' ) ) {
			$tags->add_class( 'current-menu-item' );
		}
		if ( $tags->next_tag( 'a' ) ) {
			$tags->set_attribute( 'aria-current', 'page' );
		}

		return $tags->get_updated_html();
	},
	10,
	2
);
