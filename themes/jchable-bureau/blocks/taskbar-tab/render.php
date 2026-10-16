<?php
/**
 * Rendu de jchable-bureau/taskbar-tab : le titre de la page en cours.
 */

defined( 'ABSPATH' ) || exit;

printf(
	'<span %s>%s</span>',
	get_block_wrapper_attributes( [ 'class' => 'taskbar-tab' ] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	esc_html( jchable_bureau_page_label() )
);
