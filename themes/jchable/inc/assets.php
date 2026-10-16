<?php
/**
 * Feuilles de style communes, côté site et côté éditeur.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'wp_enqueue_scripts',
	static function (): void {
		wp_enqueue_style(
			'jchable-base',
			get_template_directory_uri() . '/assets/css/base.css',
			[],
			wp_get_theme( 'jchable' )->get( 'Version' )
		);
	}
);

add_action(
	'after_setup_theme',
	static function (): void {
		add_editor_style( 'assets/css/base.css' );
	}
);

// Lien d'évitement écrit en HTML : celui du cœur (thèmes blocs) est créé en JavaScript
// et disparaîtrait sans JS. Chaque gabarit donne l'ancre « contenu » à son <main>.
remove_action( 'wp_enqueue_scripts', 'wp_enqueue_block_template_skip_link' );
add_action(
	'wp_body_open',
	static function (): void {
		echo '<a class="jchable-skip-link" href="#contenu">Aller au contenu</a>';
	}
);
