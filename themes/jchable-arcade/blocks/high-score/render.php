<?php
/**
 * Rendu de jchable-arcade/high-score.
 *
 * @var array $attributes
 */

defined( 'ABSPATH' ) || exit;

$jchable_arcade_ids = jchable_arcade_published_ids();
if ( ! $jchable_arcade_ids ) {
	return;
}

// Valeur déjà échappée : esc_attr() et esc_html() ci-dessous.
$jchable_arcade_month = static function ( int $post_id ): string {
	return sprintf(
		'<time datetime="%s">%s</time>',
		esc_attr( (string) get_the_date( 'Y-m-d', $post_id ) ),
		esc_html( (string) get_the_date( 'F Y', $post_id ) )
	);
};

$jchable_arcade_label = static function ( string $key, string $fallback ) use ( $attributes ): string {
	return isset( $attributes[ $key ] ) && is_string( $attributes[ $key ] ) && '' !== trim( $attributes[ $key ] ) ? $attributes[ $key ] : $fallback;
};

$jchable_arcade_rows = [
	[ $jchable_arcade_label( 'firstLabel', 'Premier billet' ), $jchable_arcade_month( $jchable_arcade_ids[0] ) ],
	[ $jchable_arcade_label( 'lastLabel', 'Dernier billet' ), $jchable_arcade_month( $jchable_arcade_ids[ count( $jchable_arcade_ids ) - 1 ] ) ],
	[ $jchable_arcade_label( 'countLabel', 'Billets publiés' ), esc_html( number_format_i18n( count( $jchable_arcade_ids ) ) ) ],
];

$jchable_arcade_html = '';
foreach ( $jchable_arcade_rows as $jchable_arcade_row ) {
	$jchable_arcade_html .= sprintf( '<div><dt>%s</dt><dd>%s</dd></div>', esc_html( $jchable_arcade_row[0] ), $jchable_arcade_row[1] );
}

printf(
	'<dl %s>%s</dl>',
	get_block_wrapper_attributes(), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	$jchable_arcade_html // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
);
