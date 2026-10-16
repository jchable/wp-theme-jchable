<?php
/**
 * Rendu de jchable/archive-path.
 */

defined( 'ABSPATH' ) || exit;

printf(
	'<p %s>%s</p>',
	get_block_wrapper_attributes(),
	esc_html( 'C:\\' . implode( '\\', jchable_archive_path_segments() ) )
);
