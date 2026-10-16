<?php
/**
 * Thème enfant jchable-bureau.
 */

defined( 'ABSPATH' ) || exit;

const JCHABLE_BUREAU_VERSION = '0.1.0';

require_once __DIR__ . '/inc/blocks.php';
require_once __DIR__ . '/inc/desktop.php';

/**
 * Feuilles de style du thème, côté site et côté éditeur.
 */
add_action(
	'wp_enqueue_scripts',
	static function (): void {
		$base = get_stylesheet_directory_uri() . '/assets/css/';
		wp_enqueue_style( 'jchable-bureau-fonts', $base . 'fonts.css', [], JCHABLE_BUREAU_VERSION );
		wp_enqueue_style( 'jchable-bureau', $base . 'bureau.css', [ 'jchable-base', 'jchable-bureau-fonts' ], JCHABLE_BUREAU_VERSION );
	}
);

add_action(
	'after_setup_theme',
	static function (): void {
		add_editor_style( [ 'assets/css/fonts.css', 'assets/css/bureau.css' ] );
	}
);

/**
 * Style de bloc « Fenêtre » pour le bloc Groupe.
 */
add_action(
	'init',
	static function (): void {
		register_block_style(
			'core/group',
			[
				'name'  => 'window',
				'label' => __( 'Fenêtre', 'jchable-bureau' ),
			]
		);
	}
);
