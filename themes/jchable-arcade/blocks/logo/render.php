<?php
/**
 * Rendu de jchable-arcade/logo.
 */

defined( 'ABSPATH' ) || exit;

$jchable_arcade_words = preg_split( '/\s+/u', trim( (string) get_bloginfo( 'name' ) ), -1, PREG_SPLIT_NO_EMPTY );
if ( ! $jchable_arcade_words ) {
	return;
}

$jchable_arcade_words = array_map(
	static fn ( string $word ): string => esc_html( function_exists( 'mb_strtolower' ) ? mb_strtolower( $word ) : strtolower( $word ) ),
	$jchable_arcade_words
);

printf(
	'<a %s href="%s" aria-label="%s">%s</a>',
	get_block_wrapper_attributes(), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_url( home_url( '/' ) ),
	esc_attr( trim( (string) get_bloginfo( 'name' ) ) ),
	implode( '<span class="arcade-logo__dot" aria-hidden="true">.</span>', $jchable_arcade_words ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
);
