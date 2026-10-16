<?php
/**
 * Couche interactive du bureau : module JavaScript, feuille de style et réglages transmis au script.
 * Le blog reste lisible sans JavaScript : cette couche ne fait qu'ajouter des fenêtres et des applis.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'wp_enqueue_scripts',
	static function (): void {
		$dir = get_stylesheet_directory();
		$uri = get_stylesheet_directory_uri();
		$js  = $dir . '/assets/dist/bureau.js';
		if ( ! file_exists( $js ) ) {
			return; // Pas encore compilé (npm run build:js) : le thème fonctionne sans la couche JavaScript.
		}

		$css = $dir . '/assets/dist/bureau.css';
		if ( file_exists( $css ) ) {
			wp_enqueue_style( 'jchable-bureau-desktop', $uri . '/assets/dist/bureau.css', [ 'jchable-bureau' ], (string) filemtime( $css ) );
		}

		$config = [
			'homeUrl'     => home_url( '/' ),
			'restUrl'     => rest_url(),
			'locale'      => str_replace( '_', '-', get_locale() ),
			'assetsUrl'   => $uri . '/assets/',
			'siteName'    => get_bloginfo( 'name' ),
			'sitemapUrl'  => jchable_bureau_sitemap_url(),
			'feedUrl'     => get_feed_link(),
			'doomBaseUrl' => (string) apply_filters( 'jchable_bureau_doom_data_url', $uri . '/assets/doom/' ),
		];

		wp_register_script( 'jchable-bureau-config', false, [], JCHABLE_BUREAU_VERSION, false );
		wp_add_inline_script(
			'jchable-bureau-config',
			'window.jchableBureau=' . wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES ) . ';'
		);
		wp_enqueue_script( 'jchable-bureau-config' );
		wp_enqueue_script_module( 'jchable-bureau-desktop', $uri . '/assets/dist/bureau.js', [], (string) filemtime( $js ) );
	}
);
