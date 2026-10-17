<?php
/**
 * Rendu de jchable-swiss/home-link.
 *
 * @var array $attributes
 */

defined( 'ABSPATH' ) || exit;

printf(
	'<p %s><a href="%s">%s <span class="swiss-arrow" aria-hidden="true">→</span></a></p>',
	get_block_wrapper_attributes( [ 'class' => 'swiss-home-link' ] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_url( home_url( '/' ) ),
	esc_html( $attributes['label'] ?? "Retour à l'accueil" )
);
