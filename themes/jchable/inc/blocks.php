<?php
/**
 * Blocs dynamiques du thème.
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/archive-path.php';

add_action(
	'init',
	static function (): void {
		wp_register_script(
			'jchable-blocks-editor',
			get_template_directory_uri() . '/blocks/editor.js',
			[ 'wp-blocks', 'wp-element', 'wp-server-side-render', 'wp-block-editor' ],
			wp_get_theme( 'jchable' )->get( 'Version' ),
			true
		);

		foreach ( [ 'post-filename', 'archive-path', 'request-path' ] as $jchable_block ) {
			register_block_type_from_metadata( get_template_directory() . '/blocks/' . $jchable_block );
		}
	}
);
