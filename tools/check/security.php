<?php
/**
 * Security regressions, only on the local seeded wp-env instance.
 */
defined( 'WP_CLI' ) && WP_CLI || exit;

if ( ! in_array( wp_parse_url( home_url(), PHP_URL_HOST ), [ 'localhost', '127.0.0.1', '::1' ], true ) || ! get_option( 'jchable_seeded' ) ) {
	WP_CLI::error( 'Ces tests sont réservés au WordPress local de test.' );
}

require_once ABSPATH . 'wp-admin/includes/user.php';

$original_user = get_current_user_id();
$author        = 0;
$posts         = [];
$assert        = static function ( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
	WP_CLI::line( 'OK: ' . $message );
};

try {
	$author = wp_insert_user(
		[
			'user_login' => 'security-test-' . wp_generate_password( 12, false ),
			'user_pass'  => wp_generate_password( 32 ),
			'role'       => 'author',
		]
	);
	if ( is_wp_error( $author ) ) {
		throw new RuntimeException( $author->get_error_message() );
	}
	foreach ( [ $author, 1 ] as $owner ) {
		$post = wp_insert_post( [ 'post_title' => 'Security regression', 'post_status' => 'publish', 'post_author' => $owner ], true );
		if ( is_wp_error( $post ) ) {
			throw new RuntimeException( $post->get_error_message() );
		}
		$posts[] = $post;
	}
	foreach ( [ [ 0, $posts[0], false ], [ $author, $posts[1], false ], [ $author, $posts[0], true ] ] as [ $user, $post, $allowed ] ) {
		wp_set_current_user( $user );
		$assert( current_user_can( 'edit_post_meta', $post, 'jchable_lang' ) === $allowed, "Droits de métadonnée : utilisateur {$user}, article {$post}" );
		$request = new WP_REST_Request( 'POST', '/wp/v2/posts/' . $post );
		$request->set_param( 'meta', [ 'jchable_lang' => 'en' ] );
		$response = rest_get_server()->dispatch( $request );
		$assert( $allowed ? 200 === $response->get_status() : in_array( $response->get_status(), [ 401, 403 ], true ), 'Autorisation REST effective' );
	}
	update_post_meta( $posts[0], 'jchable_lang', 'en" onmouseover="alert(1)' );
	$assert( '' === get_post_meta( $posts[0], 'jchable_lang', true ), 'Attribut lang malveillant rejeté' );
	$assert( 'en-GB' === jchable_sanitize_lang( 'en-GB' ), 'Langue légitime conservée' );

	$uri = $_SERVER['REQUEST_URI'] ?? null;
	try {
		$_SERVER['REQUEST_URI'] = '/<img src=x onerror=alert(1)>';
		$html = render_block( [ 'blockName' => 'jchable/request-path', 'attrs' => [], 'innerBlocks' => [], 'innerHTML' => '', 'innerContent' => [] ] );
		$assert( str_contains( $html, '&lt;img' ) && ! str_contains( $html, '<img' ), 'Chemin de requête échappé au rendu' );
	} finally {
		if ( null === $uri ) {
			unset( $_SERVER['REQUEST_URI'] );
		} else {
			$_SERVER['REQUEST_URI'] = $uri;
		}
	}
} finally {
	wp_set_current_user( $original_user );
	foreach ( $posts as $post ) {
		wp_delete_post( $post, true );
	}
	if ( is_int( $author ) && $author > 0 ) {
		wp_delete_user( $author );
	}
}
WP_CLI::success( 'Contrôles de sécurité PHP réussis.' );
