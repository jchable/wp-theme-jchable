<?php
/**
 * Rendu de jchable-bureau/clock : l'année, sans JavaScript. Le JS de l'étape 3 l'anime.
 */

defined( 'ABSPATH' ) || exit;

$jchable_year = wp_date( 'Y' );
printf(
	'<time %s datetime="%s">%s</time>',
	get_block_wrapper_attributes( [ 'class' => 'taskbar-clock' ] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_attr( $jchable_year ),
	esc_html( $jchable_year )
);
