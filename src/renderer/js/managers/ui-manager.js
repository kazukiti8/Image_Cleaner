import { UI_CONSTANTS } from '../utils/constants.js';

class UIManager {
    constructor() {
        this.elements = {};
        this.state = {
            selectedTargetFolder: null,
            selectedOutputFolder: null,
            currentTab: UI_CONSTANTS.TABS.BLURRY
        };
        this._initializeElements();
    }

    _initializeElements() {
        // ヘッダー要素
        this.elements.targetFolderPath = document.getElementById('targetFolderPath');
        this.elements.outputFolderPath = document.getElementById('outputFolderPath');
        this.elements.statusMessage = document.getElementById('status-message');
        
        // ボタン要素
        this.elements.selectTargetFolderBtn = document.getElementById('selectTargetFolderBtn');
        this.elements.selectOutputFolderBtn = document.getElementById('selectOutputFolderBtn');
        this.elements.startScanBtn = document.getElementById('startScanBtn');
        this.elements.settingsBtn = document.getElementById('settingsBtn');
        
        // タブ関連
        this.elements.tabButtons = document.querySelectorAll('.tab-button');
        this.elements.listPanels = document.querySelectorAll('.list-panel');
        this.elements.filterPanels = document.querySelectorAll('.filter-panel-content');
        
        // アクションボタン
        this.elements.blurryActionButtons = document.getElementById('action-buttons-blurry-similar');
        this.elements.errorsActionButtons = document.getElementById('action-buttons-errors');
        this.elements.exportErrorLogBtn = document.getElementById('exportErrorLogBtn');
        
        // 選択関連
        this.elements.selectAllBtn = document.getElementById('selectAllBtn');
        this.elements.deselectAllBtn = document.getElementById('deselectAllBtn');
        this.elements.selectedItemsCount = document.getElementById('selected-items-count');
        this.elements.selectedItemsSize = document.getElementById('selected-items-size');
        
        // フッターボタン
        this.elements.btnTrash = document.getElementById('btn-trash');
        this.elements.btnDeletePermanently = document.getElementById('btn-delete-permanently');
        this.elements.btnMove = document.getElementById('btn-move');
        this.elements.btnIgnoreError = document.getElementById('btn-ignore-error');
        this.elements.btnRetryScanError = document.getElementById('btn-retry-scan-error');
    }

    updateStatus(message, isError = false) {
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.classList.toggle('text-red-400', isError);
        this.elements.statusMessage.classList.toggle('text-white', !isError);
    }

    setSelectedTargetFolder(folderPath) {
        this.state.selectedTargetFolder = folderPath;
        this.elements.targetFolderPath.textContent = folderPath;
        this.elements.targetFolderPath.title = folderPath;
        this.elements.startScanBtn.disabled = false;
    }

    setSelectedOutputFolder(folderPath) {
        this.state.selectedOutputFolder = folderPath;
        this.elements.outputFolderPath.textContent = folderPath;
        this.elements.outputFolderPath.title = folderPath;
    }

    setScanningState(isScanning) {
        this.elements.startScanBtn.disabled = isScanning;
        this.elements.startScanBtn.textContent = isScanning ? 
            UI_CONSTANTS.BUTTON_TEXTS.SCAN.SCANNING : 
            UI_CONSTANTS.BUTTON_TEXTS.SCAN.DEFAULT;
    }

    updateSelectionInfo(count, sizeMB) {
        this.elements.selectedItemsCount.textContent = `${count}件`;
        this.elements.selectedItemsSize.textContent = `${sizeMB.toFixed(1)} MB`;
        
        const hasSelection = count > 0;
        const isMoveActionPossible = hasSelection && this.state.selectedOutputFolder !== null;

        if (this.state.currentTab === UI_CONSTANTS.TABS.ERRORS) {
            this.elements.btnIgnoreError.disabled = !hasSelection;
            this.elements.btnRetryScanError.disabled = !hasSelection;
        } else {
            this.elements.btnTrash.disabled = !hasSelection;
            this.elements.btnDeletePermanently.disabled = !hasSelection;
            this.elements.btnMove.disabled = !isMoveActionPossible;
        }
    }

    updateTabButtons(tabId) {
        this.elements.tabButtons.forEach(button => {
            button.classList.toggle(UI_CONSTANTS.CSS_CLASSES.TAB_ACTIVE, button.id === `tab-${tabId}`);
        });
    }

    updateListPanels(tabId) {
        this.elements.listPanels.forEach(panel => {
            panel.classList.toggle(UI_CONSTANTS.CSS_CLASSES.HIDDEN, panel.id !== `list-area-${tabId}`);
        });
    }

    updateFilterPanels(tabId) {
        this.elements.filterPanels.forEach(panel => {
            panel.classList.toggle(UI_CONSTANTS.CSS_CLASSES.HIDDEN, panel.id !== `filter-${tabId}-container`);
        });
    }

    updateActionButtons(tabId) {
        if (tabId === UI_CONSTANTS.TABS.ERRORS) {
            this.elements.blurryActionButtons.classList.add(UI_CONSTANTS.CSS_CLASSES.HIDDEN);
            this.elements.errorsActionButtons.classList.remove(UI_CONSTANTS.CSS_CLASSES.HIDDEN);
            this.elements.exportErrorLogBtn.classList.remove(UI_CONSTANTS.CSS_CLASSES.HIDDEN);
            this.elements.selectAllBtn.textContent = UI_CONSTANTS.BUTTON_TEXTS.SELECT.ALL_ERRORS;
            this.elements.deselectAllBtn.textContent = UI_CONSTANTS.BUTTON_TEXTS.SELECT.DESELECT_ERRORS;
        } else {
            this.elements.blurryActionButtons.classList.remove(UI_CONSTANTS.CSS_CLASSES.HIDDEN);
            this.elements.errorsActionButtons.classList.add(UI_CONSTANTS.CSS_CLASSES.HIDDEN);
            this.elements.exportErrorLogBtn.classList.add(UI_CONSTANTS.CSS_CLASSES.HIDDEN);
            this.elements.selectAllBtn.textContent = UI_CONSTANTS.BUTTON_TEXTS.SELECT.ALL;
            this.elements.deselectAllBtn.textContent = UI_CONSTANTS.BUTTON_TEXTS.SELECT.DESELECT;
        }
    }

    clearAllCounts() {
        document.getElementById('count-blurry').textContent = 0;
        document.getElementById('count-similar').textContent = 0;
        document.getElementById('count-errors').textContent = 0;
    }

    getState() {
        return { ...this.state };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
    }

    getElement(elementName) {
        return this.elements[elementName];
    }
}

export default UIManager;