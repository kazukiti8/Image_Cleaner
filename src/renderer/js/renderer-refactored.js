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
        this.managers.selection = new SelectionManager(this.managers.ui, null);
        this.managers.table = new TableManager(this.managers.preview, this.managers.selection);
        this.managers.selection.tableManager = this.managers.table;
        
        // フィルターマネージャーの初期化
        this.managers.filter = new FilterManager(this.managers.table);
        
        // タブマネージャーの初期化
        this.managers.tab = new TabManager(
            this.managers.ui, 
            this.managers.filter, 
            this.managers.preview
        );
        
        // アクションハンドラーの初期化
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
            this.managers.filter
        );
        
        // タブマネージャーの現在のタブをテーブルマネージャーに設定
        this.managers.table.setCurrentTab(this.managers.tab.getCurrentTab());
    }

    _setupGlobalEventHandlers() {
        // タブイベントリスナーの設定
        this.managers.tab.setupTabEventListeners();
        
        // 初期化処理
        this.managers.tab.switchTab(UI_CONSTANTS.TABS.BLURRY);
        this.managers.selection.updateSelectionInfo();
        this.managers.preview.updateZoom(UI_CONSTANTS.ZOOM.DEFAULT);
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