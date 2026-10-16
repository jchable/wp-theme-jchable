<?php
/**
 * Lance Theme Check sur un thème : wp eval-file theme-check.php <slug>
 * Sort en erreur s'il reste des exigences (REQUIRED) non respectées.
 */

$jchable_slug = $args[0] ?? 'jchable';

if ( ! function_exists( 'run_themechecks_against_theme' ) ) {
	$jchable_base = WP_PLUGIN_DIR . '/theme-check/checkbase.php';
	if ( ! file_exists( $jchable_base ) ) {
		WP_CLI::error( 'Plugin Theme Check introuvable.' );
	}
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once $jchable_base;
}

if ( ! function_exists( 'run_themechecks_against_theme' ) ) {
	WP_CLI::error( 'Cette version de Theme Check ne fournit pas run_themechecks_against_theme() : lancer la vérification depuis Apparence › Theme Check.' );
}

$jchable_theme = wp_get_theme( $jchable_slug );
if ( ! $jchable_theme->exists() ) {
	WP_CLI::error( "Thème introuvable : {$jchable_slug}" );
}

run_themechecks_against_theme( $jchable_theme, $jchable_slug );

global $themechecks;
$jchable_required = 0;
foreach ( (array) $themechecks as $jchable_check ) {
	if ( ! method_exists( $jchable_check, 'getError' ) ) {
		continue;
	}
	foreach ( (array) $jchable_check->getError() as $jchable_error ) {
		$jchable_line = trim( wp_strip_all_tags( $jchable_error ) );
		WP_CLI::line( $jchable_line );
		if ( str_starts_with( $jchable_line, 'REQUIRED' ) ) {
			++$jchable_required;
		}
	}
}

if ( $jchable_required > 0 ) {
	WP_CLI::error( "{$jchable_required} exigence(s) non respectée(s)." );
}
WP_CLI::success( 'Theme Check : aucune exigence bloquante.' );
