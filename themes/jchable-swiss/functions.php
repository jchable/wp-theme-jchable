<?php
/**
 * Thème enfant jchable-swiss : design typographique suisse, en CSS pur (aucun JavaScript).
 */

defined( 'ABSPATH' ) || exit;

const JCHABLE_SWISS_VERSION = '0.1.0';

require_once __DIR__ . '/inc/blocks.php';
require_once __DIR__ . '/inc/navigation.php';
require_once __DIR__ . '/inc/numbering.php';

/**
 * Feuilles de style du thème, côté site et côté éditeur.
 */
add_action(
	'wp_enqueue_scripts',
	static function (): void {
		$base = get_stylesheet_directory_uri() . '/assets/css/';
		$dir  = get_stylesheet_directory() . '/assets/css/';
		// La version suit la date du fichier : une mise à jour du CSS n'est jamais masquée par un cache.
		$ver = static fn ( string $file ): string => file_exists( $dir . $file ) ? (string) filemtime( $dir . $file ) : JCHABLE_SWISS_VERSION;
		wp_enqueue_style( 'jchable-swiss-fonts', $base . 'fonts.css', [], $ver( 'fonts.css' ) );
		wp_enqueue_style( 'jchable-swiss', $base . 'swiss.css', [ 'jchable-base', 'jchable-swiss-fonts' ], $ver( 'swiss.css' ) );
	}
);

add_action(
	'after_setup_theme',
	static function (): void {
		add_editor_style( [ 'assets/css/fonts.css', 'assets/css/swiss.css' ] );
	}
);
