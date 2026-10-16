<?php
/**
 * Rendu de jchable/post-filename.
 *
 * @var array    $attributes
 * @var WP_Block $block
 */

defined( 'ABSPATH' ) || exit;

$jchable_post_id = (int) ( $block->context['postId'] ?? get_the_ID() );
if ( ! $jchable_post_id ) {
	return;
}

$jchable_slug = get_post_field( 'post_name', $jchable_post_id );
if ( '' === $jchable_slug ) {
	$jchable_slug = sanitize_title( get_the_title( $jchable_post_id ) );
}

$jchable_text = $jchable_slug . '.md';
if ( ! empty( $attributes['showDate'] ) && 'page' !== get_post_type( $jchable_post_id ) ) {
	$jchable_text .= ' — ' . get_the_date( 'd.m.Y', $jchable_post_id );
}

printf( '<span %s>%s</span>', get_block_wrapper_attributes(), esc_html( $jchable_text ) );
