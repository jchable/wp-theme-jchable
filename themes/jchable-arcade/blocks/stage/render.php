<?php
/**
 * Rendu de jchable-arcade/stage.
 *
 * @var array    $attributes
 * @var WP_Block $block
 */

defined( 'ABSPATH' ) || exit;

$jchable_arcade_post_id = (int) ( $block->context['postId'] ?? get_the_ID() );
if ( ! $jchable_arcade_post_id || 'post' !== get_post_type( $jchable_arcade_post_id ) ) {
	return;
}

$jchable_arcade_stage = jchable_arcade_stage_number( $jchable_arcade_post_id );
if ( $jchable_arcade_stage < 1 ) {
	return;
}

$jchable_arcade_label = isset( $attributes['label'] ) && is_string( $attributes['label'] ) ? trim( $attributes['label'] ) : 'STAGE';

printf(
	'<span %s>%s</span>',
	get_block_wrapper_attributes(), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_html( trim( $jchable_arcade_label . ' ' . sprintf( '%02d', $jchable_arcade_stage ) ) )
);
