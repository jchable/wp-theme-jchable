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
