<?php if ( ! defined( 'ABSPATH' ) ) { die( 'Direct access forbidden.' ); }
/**
 * SmartRoute converted header — overrides the parent's header-builder template part.
 * Layout: logo (left) | primary menu (center) | CTA button (right).
 * Keeps #masthead so the carried CSS / sticky behaviour still apply.
 */
?>
<header id="masthead" class="site-header sr-header" role="banner">
	<div class="sr-header-inner">
		<div class="sr-logo">
			<?php if ( function_exists( 'has_custom_logo' ) && has_custom_logo() ) : ?>
				<?php the_custom_logo(); ?>
			<?php else : ?>
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="sr-logo-text"><?php echo esc_html( get_bloginfo( 'name' ) ); ?></a>
			<?php endif; ?>
		</div>
		<nav class="primary-menu" aria-label="<?php esc_attr_e( 'Primary', 'smartroute-child' ); ?>">
			<?php
			wp_nav_menu( array(
				'theme_location' => 'primary',
				'container'      => false,
				'menu_class'     => 'sr-menu',
				'depth'          => 2,
				'fallback_cb'    => false,
			) );
			?>
		</nav>
		<div class="sr-header-cta">
			<a class="sr-header-btn" href="<?php echo esc_url( home_url( '/#get-started' ) ); ?>"><?php esc_html_e( 'Get started', 'smartroute-child' ); ?></a>
		</div>
	</div>
</header>
