<?php
/**
 * Rendu de jchable-bureau/taskbar-links : le plan du site et le flux RSS, en icônes près de l'horloge.
 * Les libellés (masqués à l'écran, lus par les lecteurs d'écran) sont traduits par le JavaScript du bureau.
 */

defined( 'ABSPATH' ) || exit;

$jchable_icons   = get_stylesheet_directory_uri() . '/assets/icons/';
$jchable_sitemap = jchable_bureau_sitemap_url();
$jchable_links   = [];

// Sans page « Plan du site », pas de lien vers l'accueil déguisé.
if ( home_url( '/' ) !== $jchable_sitemap ) {
	$jchable_links[] = [ $jchable_sitemap, 'folder-blue', 'Plan du site', 'taskbar-link--sitemap' ];
}
$jchable_links[] = [ get_feed_link(), 'rss', 'Flux RSS', 'taskbar-link--rss' ];

$jchable_items = '';
foreach ( $jchable_links as [ $jchable_href, $jchable_icon, $jchable_label, $jchable_class ] ) {
	$jchable_items .= sprintf(
		'<a class="taskbar-link %s" href="%s" title="%s"><img src="%s" alt="" width="20" height="20" /><span class="taskbar-link-label">%s</span></a>',
		esc_attr( $jchable_class ),
		esc_url( $jchable_href ),
		esc_attr( $jchable_label ),
		esc_url( $jchable_icons . $jchable_icon . '.svg' ),
		esc_html( $jchable_label )
	);
}

printf(
	'<nav %s aria-label="Raccourcis">%s</nav>',
	get_block_wrapper_attributes( [ 'class' => 'taskbar-links' ] ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	$jchable_items // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
);
