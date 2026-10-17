<?php
/**
 * Rendu de jchable-swiss/site-host : le domaine du site, en lien vers l'accueil.
 */

defined( 'ABSPATH' ) || exit;

$jchable_swiss_host = wp_parse_url( home_url(), PHP_URL_HOST );
if ( ! is_string( $jchable_swiss_host ) || '' === $jchable_swiss_host ) {
	$jchable_swiss_host = get_bloginfo( 'name' );
}

printf(
	'<p %s><a href="%s" rel="home">%s</a></p>',
	get_block_wrapper_attributes(), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_url( home_url( '/' ) ),
	esc_html( $jchable_swiss_host )
);
