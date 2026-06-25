<?php if ( ! defined( 'ABSPATH' ) ) { die( 'Direct access forbidden.' ); }
/**
 * SmartRoute converted footer — overrides the parent's footer-builder template part.
 * Brand + footer widget columns (Appearance → Widgets → "Footer") + copyright.
 * Rendered inside the parent's <footer id="colophon">.
 */
?>
<div class="sr-footer-inner">
	<div class="sr-footer-brand"><?php echo esc_html( get_bloginfo( 'name' ) ); ?></div>

	<?php if ( is_active_sidebar( 'sr-footer-widgets' ) ) : ?>
		<div class="sr-footer-widgets"><?php dynamic_sidebar( 'sr-footer-widgets' ); ?></div>
	<?php endif; ?>

	<div class="sr-footer-copy">
		&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php echo esc_html( get_bloginfo( 'name' ) ); ?>. <?php esc_html_e( 'All rights reserved.', 'smartroute-child' ); ?>
	</div>
</div>
