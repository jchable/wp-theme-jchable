<?php
/**
 * Feuilles de style communes, côté site et côté éditeur.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'wp_enqueue_scripts',
	static function (): void {
		// La version suit la date du fichier : une mise à jour du CSS n'est jamais masquée par un cache.
		$jchable_css = get_template_directory() . '/assets/css/base.css';
		wp_enqueue_style(
			'jchable-base',
			get_template_directory_uri() . '/assets/css/base.css',
			[],
			file_exists( $jchable_css ) ? (string) filemtime( $jchable_css ) : wp_get_theme( 'jchable' )->get( 'Version' )
		);
	}
);

add_action(
	'after_setup_theme',
	static function (): void {
		add_editor_style( 'assets/css/base.css' );
	}
);
