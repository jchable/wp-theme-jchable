<?php
/**
 * Rendu de jchable-bureau/start-button.
 */

defined( 'ABSPATH' ) || exit;

printf(
	'<a %s href="%s">✦ Démarrer</a>',
	get_block_wrapper_attributes( [ 'class' => 'start-button' ] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_url( jchable_bureau_sitemap_url() )
);
