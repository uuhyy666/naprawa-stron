<?php
/**
 * Plugin Name:  Chatbot FAQ AI — widget 24/7
 * Description:  Widget czatu FAQ osadzany na froncie jedną linijką, z ekranem ustawień w kokpicie WP,
 *               własnym CPT na bazę wiedzy, blokiem Gutenberga i REST-owym logiem pytań bez odpowiedzi.
 * Version:      1.0.0
 * Requires PHP: 7.4
 * Author:       bartekdev_pl
 * License:      GPL-2.0-or-later
 * Text Domain:  chatbot-faq
 *
 * Próbka kodu pod zlecenie Useme 144108 (DPPG) — autorski motyw/wtyczka od zera,
 * bez buildera: hooki, CPT, ACF-friendly meta, blok Gutenberga, REST API, enqueue z wersjonowaniem.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CBFAQ_VERSION', '1.0.0' );
define( 'CBFAQ_FILE', __FILE__ );

/* -------------------------------------------------------------------------
 *  1. Baza wiedzy jako custom post type (współpracuje z ACF / ACF PRO)
 * ---------------------------------------------------------------------- */

add_action(
	'init',
	function () {
		register_post_type(
			'cbfaq_entry',
			array(
				'labels'       => array(
					'name'          => __( 'Baza wiedzy bota', 'chatbot-faq' ),
					'singular_name' => __( 'Wpis FAQ', 'chatbot-faq' ),
					'add_new_item'  => __( 'Dodaj pytanie', 'chatbot-faq' ),
				),
				'public'       => false,
				'show_ui'      => true,
				'show_in_rest' => true,
				'menu_icon'    => 'dashicons-format-chat',
				'supports'     => array( 'title', 'editor', 'custom-fields', 'page-attributes' ),
			)
		);

		register_post_meta(
			'cbfaq_entry',
			'cbfaq_keywords',
			array(
				'type'              => 'string',
				'single'            => true,
				'show_in_rest'      => true,
				'sanitize_callback' => 'sanitize_text_field',
				'auth_callback'     => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);
	}
);

/* -------------------------------------------------------------------------
 *  2. Ustawienia w kokpicie (Ustawienia → Chatbot FAQ)
 * ---------------------------------------------------------------------- */

add_action(
	'admin_menu',
	function () {
		add_options_page(
			__( 'Chatbot FAQ', 'chatbot-faq' ),
			__( 'Chatbot FAQ', 'chatbot-faq' ),
			'manage_options',
			'cbfaq',
			'cbfaq_render_settings_page'
		);
	}
);

add_action(
	'admin_init',
	function () {
		register_setting(
			'cbfaq',
			'cbfaq_options',
			array(
				'type'              => 'array',
				'sanitize_callback' => 'cbfaq_sanitize_options',
				'default'           => cbfaq_default_options(),
			)
		);

		add_settings_section( 'cbfaq_main', __( 'Wygląd i teksty', 'chatbot-faq' ), '__return_false', 'cbfaq' );

		$fields = array(
			'greeting' => __( 'Powitanie', 'chatbot-faq' ),
			'fallback' => __( 'Odpowiedź, gdy bot nie wie', 'chatbot-faq' ),
			'accent'   => __( 'Kolor akcentu (hex)', 'chatbot-faq' ),
		);

		foreach ( $fields as $key => $label ) {
			add_settings_field(
				'cbfaq_' . $key,
				$label,
				function () use ( $key ) {
					$o = cbfaq_options();
					printf(
						'<input type="text" class="regular-text" name="cbfaq_options[%1$s]" value="%2$s" />',
						esc_attr( $key ),
						esc_attr( $o[ $key ] )
					);
				},
				'cbfaq',
				'cbfaq_main'
			);
		}
	}
);

function cbfaq_default_options() {
	return array(
		'greeting' => 'Cześć! Zapytaj o godziny otwarcia, ceny albo dostawę.',
		'fallback' => 'Nie mam tej informacji — zostaw kontakt, odezwiemy się.',
		'accent'   => '#2563eb',
	);
}

function cbfaq_options() {
	return wp_parse_args( (array) get_option( 'cbfaq_options', array() ), cbfaq_default_options() );
}

function cbfaq_sanitize_options( $input ) {
	$out             = cbfaq_default_options();
	$out['greeting'] = isset( $input['greeting'] ) ? sanitize_text_field( $input['greeting'] ) : $out['greeting'];
	$out['fallback'] = isset( $input['fallback'] ) ? sanitize_text_field( $input['fallback'] ) : $out['fallback'];
	$accent          = isset( $input['accent'] ) ? sanitize_hex_color( $input['accent'] ) : '';
	$out['accent']   = $accent ? $accent : $out['accent'];

	return $out;
}

function cbfaq_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	echo '<div class="wrap"><h1>' . esc_html__( 'Chatbot FAQ', 'chatbot-faq' ) . '</h1>';
	echo '<p>' . esc_html__( 'Bazę pytań prowadzisz w menu „Baza wiedzy bota”. Log pytań bez odpowiedzi: Narzędzia → Chatbot FAQ.', 'chatbot-faq' ) . '</p>';
	echo '<form action="options.php" method="post">';
	settings_fields( 'cbfaq' );
	do_settings_sections( 'cbfaq' );
	submit_button();
	echo '</form></div>';
}

/* -------------------------------------------------------------------------
 *  3. Front: enqueue z wersjonowaniem + baza wiedzy podana inline
 * ---------------------------------------------------------------------- */

add_action(
	'wp_enqueue_scripts',
	function () {
		if ( is_admin() ) {
			return;
		}

		wp_enqueue_script(
			'cbfaq',
			plugins_url( 'assets/chatbot.js', CBFAQ_FILE ),
			array(),
			CBFAQ_VERSION,
			true
		);

		wp_localize_script(
			'cbfaq',
			'CBFAQ',
			array(
				'options' => cbfaq_options(),
				'entries' => cbfaq_entries(),
				'rest'    => esc_url_raw( rest_url( 'cbfaq/v1/miss' ) ),
				'nonce'   => wp_create_nonce( 'wp_rest' ),
			)
		);
	}
);

/**
 * Baza wiedzy z CPT, cache'owana w transiencie i czyszczona przy zapisie wpisu.
 */
function cbfaq_entries() {
	$cached = get_transient( 'cbfaq_entries' );
	if ( false !== $cached ) {
		return $cached;
	}

	$posts   = get_posts(
		array(
			'post_type'      => 'cbfaq_entry',
			'posts_per_page' => 200,
			'orderby'        => 'menu_order',
			'order'          => 'ASC',
		)
	);
	$entries = array();

	foreach ( $posts as $post ) {
		$entries[] = array(
			'q' => $post->post_title,
			'a' => wp_strip_all_tags( $post->post_content ),
			'k' => array_filter( array_map( 'trim', explode( ',', (string) get_post_meta( $post->ID, 'cbfaq_keywords', true ) ) ) ),
		);
	}

	set_transient( 'cbfaq_entries', $entries, HOUR_IN_SECONDS );

	return $entries;
}

add_action(
	'save_post_cbfaq_entry',
	function () {
		delete_transient( 'cbfaq_entries' );
	}
);

/* -------------------------------------------------------------------------
 *  4. REST: log pytań, na które bot nie znalazł odpowiedzi
 * ---------------------------------------------------------------------- */

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'cbfaq/v1',
			'/miss',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'args'                => array(
					'question' => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
				'callback'            => function ( WP_REST_Request $req ) {
					$log   = (array) get_option( 'cbfaq_misses', array() );
					$log[] = array(
						'q'  => $req->get_param( 'question' ),
						'ts' => current_time( 'mysql' ),
					);
					update_option( 'cbfaq_misses', array_slice( $log, -500 ), false );

					return rest_ensure_response( array( 'ok' => true ) );
				},
			)
		);
	}
);

/* -------------------------------------------------------------------------
 *  5. Blok Gutenberga + shortcode — bot osadzony w treści strony
 * ---------------------------------------------------------------------- */

add_action(
	'init',
	function () {
		register_block_type(
			'cbfaq/inline',
			array(
				'api_version'     => 2,
				'title'           => __( 'Chatbot FAQ (inline)', 'chatbot-faq' ),
				'category'        => 'widgets',
				'render_callback' => 'cbfaq_render_inline',
			)
		);

		add_shortcode( 'chatbot_faq', 'cbfaq_render_inline' );
	}
);

function cbfaq_render_inline() {
	return '<div class="cbfaq-inline" data-cbfaq-inline="1"></div>';
}
