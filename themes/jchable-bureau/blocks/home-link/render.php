<?php
/**
 * Rendu de jchable-bureau/home-link.
 *
 * @var array $attributes
 */

defined( 'ABSPATH' ) || exit;

printf(
	'<p %s><a href="%s">%s</a></p>',
	get_block_wrapper_attributes( [ 'class' => 'home-link' ] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_url( home_url( '/' ) ),
	esc_html( $attributes['label'] ?? 'Retour à l\'accueil' )
);
