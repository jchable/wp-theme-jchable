<?php
/**
 * Entrée courante du menu.
 *
 * WordPress ne marque comme « courante » que les entrées liées à un contenu ; les liens personnalisés du menu
 * (Accueil, À propos…) ne le sont jamais. Ce filtre ajoute aria-current="page" et la classe current-menu-item
 * à l'entrée dont l'adresse est celle de la page affichée ; l'accueil reste courant sur ses pages 2, 3…
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'render_block_core/navigation-link',
	static function ( string $content ): string {
		global $wp;

		$tags = new WP_HTML_Tag_Processor( $content );
		if ( ! $tags->next_tag( 'a' ) ) {
			return $content;
		}
		$href = (string) $tags->get_attribute( 'href' );
		if ( '' === $href || null !== $tags->get_attribute( 'aria-current' ) ) {
			return $content;
		}

		$normalize = static fn ( string $url ): string => trailingslashit( strtok( $url, '?#' ) ?: '' );
		$link      = $normalize( $href );
		$home      = $normalize( home_url( '/' ) );
		$current   = $normalize( home_url( $wp->request ?? '' ) );

		$is_current = $link === $current || ( $link === $home && ( is_front_page() || is_home() ) );
		if ( ! $is_current ) {
			return $content;
		}

		$tags->set_attribute( 'aria-current', 'page' );
		return $tags->get_updated_html();
	}
);
