<?php
/**
 * Plugin Name: VALORANT エージェント当てゲーム
 * Plugin URI:  https://github.com/sakurai92/valo-agent-game
 * Description: Valorantエージェントをタップで消去しながら絞り込むゲームボード。[valo_agent_game] ショートコードで任意のページに設置できます。
 * Version:     1.0.0
 * Author:      sakurai92
 * License:     MIT
 * Text Domain: valo-agent-game
 */

defined( 'ABSPATH' ) || exit;

final class Valo_Agent_Game {

    private static ?self $instance = null;

    public static function get_instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_shortcode( 'valo_agent_game', [ $this, 'render_shortcode' ] );
    }

    /**
     * ショートコード [valo_agent_game] の出力
     * 使い方: 任意のページ・投稿の本文に [valo_agent_game] と入力するだけ。
     */
    public function render_shortcode( array $atts ): string {

        // アセットをエンキュー（ショートコードが使われたページのみ読み込む）
        wp_enqueue_style(
            'valo-agent-game',
            plugin_dir_url( __FILE__ ) . 'assets/style.css',
            [],
            '1.0.0'
        );

        // Google Fonts (Noto Sans JP)
        wp_enqueue_style(
            'valo-agent-game-fonts',
            'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap',
            [],
            null
        );

        wp_enqueue_script(
            'valo-agent-game',
            plugin_dir_url( __FILE__ ) . 'assets/app.js',
            [],
            '1.0.0',
            true   // フッターに出力（DOM構築後に実行するため）
        );

        ob_start();
        ?>
        <div id="valo-game-app" class="valo-game-app">

            <header class="vgame-header">
                <div class="vgame-header-left">
                    <p class="vgame-title">
                        <span class="vgame-title-valo">VALORANT</span>
                        <span class="vgame-title-sub">エージェント当てゲーム</span>
                    </p>
                </div>
                <div class="vgame-header-right">
                    <div id="counter" class="vgame-counter">
                        残り <span id="count-num">--</span> / <span id="count-total">--</span>
                    </div>
                    <button id="reset-btn" class="vgame-btn-reset">リセット</button>
                </div>
            </header>

            <nav class="vgame-role-filter" id="role-filter">
                <button class="vgame-filter-btn active" data-role="all">すべて</button>
                <button class="vgame-filter-btn" data-role="Duelist">⚔️ デュエリスト</button>
                <button class="vgame-filter-btn" data-role="Controller">🌫️ コントローラー</button>
                <button class="vgame-filter-btn" data-role="Sentinel">🛡️ センチネル</button>
                <button class="vgame-filter-btn" data-role="Initiator">🔍 イニシエーター</button>
            </nav>

            <main id="grid" class="vgame-agent-grid">
                <div class="vgame-loading">
                    <div class="vgame-spinner"></div>
                    <p>エージェントデータを読み込み中…</p>
                </div>
            </main>

        </div>
        <?php
        return ob_get_clean();
    }
}

Valo_Agent_Game::get_instance();
