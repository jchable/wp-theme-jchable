<?php
/**
 * Langue du contenu d'un article : champ personnalisé jchable_lang (« en », « fr »…).
 */

defined( 'ABSPATH' ) || exit;

/**
 * Renvoie un code de langue valide, ou une chaîne vide.
 *
 * @param mixed $value Valeur brute.
 */
function jchable_sanitize_lang( $value ): string {
	$value = is_string( $value ) ? trim( $value ) : '';
	return 1 === preg_match( '/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/', $value ) ? $value : '';
}

add_action(
	'init',
	static function (): void {
		register_post_meta(
			'',
			'jchable_lang',
			[
				'type'              => 'string',
				'single'            => true,
				'show_in_rest'      => true,
				'sanitize_callback' => 'jchable_sanitize_lang',
				'auth_callback'     => static fn(): bool => current_user_can( 'edit_posts' ),
			]
		);
	}
);

add_filter(
	'render_block_core/post-content',
	static function ( string $content, array $parsed_block, WP_Block $block ): string {
		$post_id = (int) ( $block->context['postId'] ?? 0 );
		$lang    = $post_id ? jchable_sanitize_lang( get_post_meta( $post_id, 'jchable_lang', true ) ) : '';
		if ( '' === $lang ) {
			return $content;
		}
		$tags = new WP_HTML_Tag_Processor( $content );
		if ( $tags->next_tag() ) {
			$tags->set_attribute( 'lang', $lang );
		}
		return $tags->get_updated_html();
	},
	10,
	3
);
