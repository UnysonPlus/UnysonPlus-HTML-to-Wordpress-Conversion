<?php
/**
 * SmartRoute (Child) — functions.
 *
 * Enqueues the source webfonts + the child stylesheet (after the parent + Unyson
 * shortcode CSS so the chrome wins the cascade) and registers a footer widget area.
 * The header/footer markup itself lives in the overridden template-parts.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Webfonts + child stylesheet (loaded late so it wins the cascade). */
function smartroute_child_assets() {
	wp_enqueue_style(
		'smartroute-fonts',
		'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Manrope:wght@400;500;600;700;800&family=Noto+Serif:wght@400;600;700&display=swap',
		array(),
		null
	);
	wp_enqueue_style(
		'smartroute-child',
		get_stylesheet_uri(),
		array(),
		wp_get_theme()->get( 'Version' )
	);
}
add_action( 'wp_enqueue_scripts', 'smartroute_child_assets', 20 );

/** Footer widget area (the footer template part renders it when populated). */
function smartroute_child_widgets() {
	register_sidebar( array(
		'name'          => __( 'Footer', 'smartroute-child' ),
		'id'            => 'sr-footer-widgets',
		'description'   => __( 'Footer columns shown in the converted footer.', 'smartroute-child' ),
		'before_widget' => '<div class="sr-widget %2$s">',
		'after_widget'  => '</div>',
		'before_title'  => '<h4>',
		'after_title'   => '</h4>',
	) );
}
add_action( 'widgets_init', 'smartroute_child_widgets' );

/**
 * Drop a "Get started" item from the PRIMARY nav — it's rendered as the header CTA
 * button, so showing it in the menu too would duplicate it. (The generator makes
 * the CTA label configurable; here it's pinned to the SmartRoute source.)
 */
function smartroute_child_dedupe_cta( $items, $args ) {
	if ( isset( $args->theme_location ) && 'primary' === $args->theme_location ) {
		$items = array_filter( $items, function ( $item ) {
			return 0 !== strcasecmp( trim( wp_strip_all_tags( $item->title ) ), 'Get started' );
		} );
	}
	return $items;
}
add_filter( 'wp_nav_menu_objects', 'smartroute_child_dedupe_cta', 10, 2 );
