// リファクタリング後のレンダラープロセスメインファイル
import UIManager from './managers/ui-manager.js';
import TabManager from './managers/tab-manager.js';
import PreviewManager from './managers/preview-manager.js';
import FilterManager from './managers/filter-manager.js';
import TableManager from './managers/table-manager.js';
import SelectionManager from './managers/selection-manager.js';
import ActionHandler from './managers/action-handler.js';
import ScanManager from './managers/scan-manager.js';
import { UI_CONSTANTS } from './utils/constants.js';

class ImageCleanerRenderer {
    constructor() {
        this.managers = {};
        this._initializeManagers();
        this._setupGlobalEventHandlers();
    }

    _initializeManagers() {
        // 基本マネージャーの初期化
        this.managers.ui = new UIManager();
        this.managers.preview = new PreviewManager();

        // テーブルとセレクションマネージャーの初期化（相互依存）
        this.managers.selection = new SelectionManager(this.managers.ui, null); // tableManager は後で設定
        this.managers.table = new TableManager(this.managers.preview, this.managers.selection);
        this.managers.selection.tableManager = this.managers.table; // 循環参照を解決

        // フィルターマネージャーの初期化
        this.managers.filter = new FilterManager(this.managers.table);

        // タブマネージャーの初期化
        this.managers.tab = new TabManager(
            this.managers.ui,
            this.managers.filter,
            this.managers.preview,
            this.managers.selection // SelectionManagerを渡して、タブ切り替え時に選択情報をクリアできるようにする
        );

        // アクションハンドラーの初期化
        // ActionHandler はフッターボタンのイベントリスナーを設定するため、DOM要素が利用可能になった後に初期化することが望ましい。
        // UIManager など、DOM要素にアクセスする他のマネージャーも同様。
        this.managers.action = new ActionHandler(
            this.managers.ui,
            this.managers.selection,
            this.managers.table,
            this.managers.filter
        );

        // スキャンマネージャーの初期化
        this.managers.scan = new ScanManager(
            this.managers.ui,
            this.managers.table,
            this.managers.filter,
            this.managers.selection // SelectionManagerを渡して、スキャン後に選択情報をクリアできるようにする
        );

        // タブマネージャーの現在のタブをテーブルマネージャーに設定
        this.managers.table.setCurrentTab(this.managers.tab.getCurrentTab());
    }

    _setupGlobalEventHandlers() {
        // タブイベントリスナーの設定
        this.managers.tab.setupTabEventListeners();

        // 初期化処理
        // DOMContentLoaded 後に ImageCleanerRenderer インスタンスが作成されるため、
        // この時点では各マネージャーはDOM要素にアクセス可能。
        this.managers.tab.switchTab(UI_CONSTANTS.TABS.BLURRY); // これにより selectionManager.updateSelectionInfo() も呼ばれる
        this.managers.preview.displayPreview(null, null);
    }

    // 公開メソッド（必要に応じて外部からアクセス可能）
    getManager(managerName) {
        return this.managers[managerName];
    }
}

// DOM読み込み完了後に初期化
console.log('Renderer script loaded.');

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    try {
        const app = new ImageCleanerRenderer();
        console.log('ImageCleanerRenderer initialized successfully');

        // グローバルアクセス用（デバッグ時など）
        window.imageCleanerApp = app;
    } catch (error) {
        console.error('Failed to initialize ImageCleanerRenderer:', error);
    }
});
