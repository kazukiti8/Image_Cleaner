import { LogUtils } from '../utils/LogUtils.js';
import { UIUtils } from '../utils/UIUtils.js';

/**
 * タブ管理を担当するクラス
 */
export class TabManager {
    constructor(app) {
        this.app = app;
        this.currentTab = 'blur';
        this.tabs = ['blur', 'similar', 'error'];
    }

    /**
     * タブを切り替え
     * @param {string} tabName - タブ名
     */
    switchTab(tabName) {
        // tabNameの妥当性チェック
        if (!tabName || typeof tabName !== 'string') {
            LogUtils.error('Invalid tabName:', tabName);
            return;
        }

        if (!this.tabs.includes(tabName)) {
            LogUtils.error('Unknown tab:', tabName);
            return;
        }

        this.currentTab = tabName;
        // ImageCleanupAppのcurrentTabも更新
        this.app.currentTab = tabName;
        
        this.updateTabUI();
        this.updateTabContent();
        this.clearSelections();
        this.clearPreview();

        LogUtils.log(`Tab switched to: ${tabName}`);
    }

    /**
     * タブUIを更新
     */
    updateTabUI() {
        // タブボタンのアクティブ状態を切り替え
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('tab-active');
        });
        
        const activeButton = document.querySelector(`[data-tab="${this.currentTab}"]`);
        if (activeButton) {
            activeButton.classList.add('tab-active');
        }
    }

    /**
     * タブコンテンツを更新
     */
    updateTabContent() {
        // タブコンテンツの表示/非表示を切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const activeContent = document.getElementById(`content${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }

        // レイアウトの切り替え
        this.app.switchLayout(this.currentTab);

        // 仮想テーブルを初期化
        this.app.initializeVirtualTable(this.currentTab);

        // 現在のタブのデータを仮想テーブルに設定
        this.app.displayResultsForCurrentTab();
    }

    /**
     * 選択状態をクリア
     */
    clearSelections() {
        this.app.selectedFiles.clear();
        this.app.selectedSimilarPairs.clear();
        this.app.selectedIndividualFiles.clear();
        this.app.selectedErrors.clear();
        this.app.updateSelectedCount();
        this.app.updateActionButtons();
    }

    /**
     * プレビューをクリア
     */
    clearPreview() {
        this.app.clearPreviewArea();
    }

    /**
     * 現在のタブ名を取得
     * @returns {string} 現在のタブ名
     */
    getCurrentTab() {
        return this.currentTab;
    }

    /**
     * 現在のタブのデータを取得
     * @returns {Array} 現在のタブのデータ
     */
    getCurrentTabData() {
        switch (this.currentTab) {
            case 'blur':
                return this.app.scanResults.blurImages || [];
            case 'similar':
                return this.app.scanResults.similarImages || [];
            case 'error':
                return this.app.scanResults.errors || [];
            default:
                return [];
        }
    }

    /**
     * タブのカウントを更新
     */
    updateTabCounts() {
        const counts = {
            blur: this.app.scanResults.blurImages?.length || 0,
            similar: this.app.scanResults.similarImages?.length || 0,
            error: this.app.scanResults.errors?.length || 0
        };

        Object.entries(counts).forEach(([tab, count]) => {
            const countElement = document.getElementById(`count${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
            if (countElement) {
                countElement.textContent = count;
            }
        });
    }
} 