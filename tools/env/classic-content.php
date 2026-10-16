<?php
/**
 * Page de test en HTML brut, comme un ancien article de l'éditeur classique :
 * tableau large, légende [caption], bloc <pre>, iframe et image larges.
 * Idempotent. Lancé par seed.php, ou seul : wp eval-file wp-content/jchable-tools/env/classic-content.php
 */

if ( get_page_by_path( 'contenu-classique' ) ) {
	return;
}

kses_remove_filters(); // Pas d'utilisateur en ligne de commande : on garde le HTML tel quel (iframe, style…).

$jchable_pixel = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

wp_insert_post(
	[
		'post_type'    => 'page',
		'post_title'   => 'Contenu classique',
		'post_name'    => 'contenu-classique',
		'post_status'  => 'publish',
		'post_content' => '<p>Un ancien article en HTML brut.</p>' . "\n\n"
			. '<table style="width:900px"><tbody><tr><td>Cellule</td><td>Autre cellule</td></tr></tbody></table>' . "\n\n"
			. '[caption id="attachment_1" align="alignnone" width="1000"]<img src="' . $jchable_pixel . '" width="1000" height="100" alt="" /> Une légende très large[/caption]' . "\n\n"
			. '<pre>' . str_repeat( 'une ligne très longue sans retour à la ligne ', 12 ) . '</pre>' . "\n\n"
			. '<iframe width="800" height="100" src="about:blank" title="Cadre large"></iframe>' . "\n\n"
			. '<img src="' . $jchable_pixel . '" width="1200" height="100" style="width:1200px" alt="" />' . "\n\n"
			. '<blockquote>Une citation.</blockquote>',
	]
);
