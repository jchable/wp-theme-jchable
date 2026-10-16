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

// Les blocs de code défilent horizontalement : ils doivent être atteignables au clavier.
add_filter(
	'render_block_core/code',
	static function ( string $content ): string {
		$tags = new WP_HTML_Tag_Processor( $content );
		if ( $tags->next_tag( 'pre' ) ) {
			$tags->set_attribute( 'tabindex', '0' );
		}
		return $tags->get_updated_html();
	}
);
