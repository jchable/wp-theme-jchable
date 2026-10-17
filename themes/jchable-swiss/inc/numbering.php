<?php
/**
 * Numérotation 01, 02, 03… des articles.
 *
 * Le numéro lui-même est un compteur CSS (voir assets/css/swiss.css, « .swiss-card::before »). Sur les pages 2 et
 * suivantes, le compteur doit continuer là où la page précédente s'est arrêtée : ce filtre ajoute au <ul> de la liste
 * d'articles un « counter-reset » égal au nombre d'articles des pages précédentes.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'render_block_core/post-template',
	static function ( string $content, array $parsed_block, WP_Block $block ): string {
		$query = is_array( $block->context['query'] ?? null ) ? $block->context['query'] : [];

		if ( ! empty( $query['inherit'] ) ) {
			// Requête principale (accueil, archives, recherche) : page et nombre par page viennent de WordPress.
			$page     = max( 1, (int) get_query_var( 'paged' ) );
			$per_page = (int) get_query_var( 'posts_per_page' );
			if ( $per_page < 1 ) {
				$per_page = (int) get_option( 'posts_per_page', 10 );
			}
		} else {
			// Requête propre au bloc : la page est dans le paramètre query-<id>-page.
			$key      = 'query-' . (int) ( $block->context['queryId'] ?? 0 ) . '-page';
			$page     = isset( $_GET[ $key ] ) ? max( 1, absint( wp_unslash( $_GET[ $key ] ) ) ) : 1; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$per_page = max( 1, (int) ( $query['perPage'] ?? 10 ) );
		}

		$offset = ( $page - 1 ) * $per_page;
		if ( $offset < 1 ) {
			return $content;
		}

		$tags = new WP_HTML_Tag_Processor( $content );
		if ( $tags->next_tag( 'ul' ) ) {
			$style = rtrim( trim( (string) $tags->get_attribute( 'style' ) ), ';' );
			$tags->set_attribute( 'style', ( '' === $style ? '' : $style . ';' ) . 'counter-reset:swiss-post ' . $offset );
		}
		return $tags->get_updated_html();
	},
	10,
	3
);
