<?php
/**
 * Rendu de jchable-arcade/home-link.
 *
 * @var array $attributes
 */

defined( 'ABSPATH' ) || exit;

$jchable_arcade_label = isset( $attributes['label'] ) && is_string( $attributes['label'] ) ? trim( $attributes['label'] ) : '';

printf(
	'<p %s><a href="%s">%s</a></p>',
	get_block_wrapper_attributes( [ 'class' => 'arcade-button' ] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_url( home_url( '/' ) ),
	esc_html( '' !== $jchable_arcade_label ? $jchable_arcade_label : 'Rejouer' )
);
