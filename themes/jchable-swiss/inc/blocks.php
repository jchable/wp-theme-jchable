<?php
/**
 * Blocs dynamiques du thème Swiss : domaine du site (barre du haut) et lien d'accueil (404).
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	static function (): void {
		foreach ( [ 'site-host', 'home-link' ] as $jchable_swiss_block ) {
			register_block_type_from_metadata( get_stylesheet_directory() . '/blocks/' . $jchable_swiss_block );
		}
	}
);
