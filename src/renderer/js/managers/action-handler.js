import { UI_CONSTANTS } from '../utils/constants.js';

class ActionHandler {
    constructor(uiManager, selectionManager, tableManager, filterManager) {
        this.uiManager = uiManager;
        this.selectionManager = selectionManager;
        this.tableManager = tableManager;
        this.filterManager = filterManager;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // ファイル操作ボタン
        const btnTrash = this.uiManager.getElement('btnTrash');
        const btnDeletePermanently = this.uiManager.getElement('btnDeletePermanently');
        const btnMove = this.uiManager.getElement('btnMove');
        const btnIgnoreError = this.uiManager.getElement('btnIgnoreError');
        const btnRetryScanError = this.uiManager.getElement('btnRetryScanError');

        btnTrash?.addEventListener('click', () => this.handleAction('trash'));
        btnDeletePermanently?.addEventListener('click', () => this.handleAction('delete'));
        btnMove?.addEventListener('click', () => this.handleAction('move'));
        btnIgnoreError?.addEventListener('click', () => this._handleIgnoreError());
        btnRetryScanError?.addEventListener('click', () => this._handleRetryScanError());
    }

    async handleAction(actionType) {
        console.log(`[DEBUG] handleAction called for type: ${actionType}`);
        
        const filePaths = this.selectionManager.getSelectedFilePaths();
        const selectedCount = filePaths.length;
        
        console.log(`[DEBUG] Selected file paths for action:`, filePaths);

        if (selectedCount === 0) {
            this.uiManager.updateStatus("操作対象のアイテムが選択されていません。", true);
            console.log('[DEBUG] No items selected for action.');
            return;
        }

        const totalSizeMB = this._calculateTotalSize();
        const dialogData = this._createDialogData(actionType, selectedCount, totalSizeMB);

        if (actionType === 'move') {
            const state = this.uiManager.getState();
            if (!state.selectedOutputFolder) {
                this.uiManager.updateStatus("移動先のフォルダが選択されていません。", true);
                console.log('[DEBUG] Move action, but no output folder selected.');
                return;
            }
            dialogData.moveToPath = state.selectedOutputFolder;
        }

        try {
            await this._executeActionWithConfirmation(actionType, dialogData, filePaths);
        } catch (error) {
            console.error('[DEBUG] handleAction error:', error);
            this.uiManager.updateStatus(`操作中にエラーが発生しました: ${error.message}`, true);
        }
    }

    async _executeActionWithConfirmation(actionType, dialogData, filePaths) {
        if (!window.electronAPI?.showConfirmationDialog) {
            console.error('[DEBUG] showConfirmationDialog API is not available.');
            this.uiManager.updateStatus('確認ダイアログを開けませんでした。', true);
            return;
        }

        console.log(`[DEBUG] Showing confirmation dialog for action: ${actionType}`, dialogData);
        const response = await window.electronAPI.showConfirmationDialog(dialogData);
        console.log('[DEBUG] Dialog response:', response);

        if (response && response.confirmed) {
            await this._performFileOperation(response.actionType, filePaths);
        } else {
            this.uiManager.updateStatus(`${actionType} 操作はキャンセルされました。`);
        }
    }

    async _performFileOperation(actionType, filePaths) {
        this.uiManager.updateStatus(`${actionType} 操作を実行中...`);
        console.log(`[DEBUG] User confirmed action: ${actionType}. Paths:`, filePaths);
        
        const state = this.uiManager.getState();
        const operationResult = await window.electronAPI.performFileOperation({
            actionType: actionType,
            paths: filePaths,
            destination: actionType === 'move' ? state.selectedOutputFolder : undefined
        });
        
        console.log('[DEBUG] File operation result from main process:', operationResult);
        this._handleOperationResult(operationResult, actionType);
    }

    _handleOperationResult(operationResult, actionType) {
        if (operationResult.successCount > 0) {
            this.uiManager.updateStatus(`${operationResult.successCount}件のファイルを${actionType}しました。`);
            this.tableManager.refreshAfterFileOperation(operationResult.successPaths);
            this.filterManager.applyFilters();
            this.selectionManager.updateSelectionInfo();
        }
        
        if (operationResult.errors.length > 0) {
            const firstError = operationResult.errors[0];
            let errorMsg = `${operationResult.errors.length}件のエラー: ${firstError.path ? firstError.path.split('/').pop() : 'N/A'} - ${firstError.reason}`;
            if (operationResult.successCount > 0) {
                errorMsg = `${operationResult.successCount}件成功、` + errorMsg;
            }
            this.uiManager.updateStatus(errorMsg, true);
            console.error('[DEBUG] File operation errors:', operationResult.errors);
        }
        
        if (operationResult.successCount === 0 && operationResult.errors.length === 0) {
            this.uiManager.updateStatus('操作対象のファイルがありませんでした（既に処理済みなど）。');
        }
    }

    _calculateTotalSize() {
        let totalSizeMB = 0;
        const activeTbody = document.querySelector('.list-panel:not(.hidden) tbody');
        const currentTab = this.tableManager.getCurrentTab();
        
        if (activeTbody) {
            if (currentTab === UI_CONSTANTS.TABS.BLURRY || currentTab === UI_CONSTANTS.TABS.ERRORS) {
                const checkedCheckboxes = activeTbody.querySelectorAll('input[type="checkbox"].item-checkbox:checked');
                checkedCheckboxes.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.dataset.sizeMb) totalSizeMB += parseFloat(row.dataset.sizeMb);
                });
            } else if (currentTab === UI_CONSTANTS.TABS.SIMILAR) {
                const file1Checked = activeTbody.querySelectorAll('input[type="checkbox"].file1-checkbox:checked');
                const file2Checked = activeTbody.querySelectorAll('input[type="checkbox"].file2-checkbox:checked');
                file1Checked.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.dataset.size1Mb) totalSizeMB += parseFloat(row.dataset.size1Mb);
                });
                file2Checked.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.dataset.size2Mb) totalSizeMB += parseFloat(row.dataset.size2Mb);
                });
            }
        }
        
        console.log(`[DEBUG] Calculated totalSizeMB: ${totalSizeMB}`);
        return totalSizeMB;
    }

    _createDialogData(actionType, itemCount, totalSizeMB) {
        return {
            type: actionType,
            itemCount: itemCount,
            totalSizeMB: totalSizeMB.toFixed(1)
        };
    }

    _handleIgnoreError() {
        const selectedPaths = this.selectionManager.getSelectedFilePaths();
        if (selectedPaths.length === 0) {
            this.uiManager.updateStatus("操作対象のアイテムが選択されていません。", true);
            return;
        }
        console.log(`${selectedPaths.length}件のエラーを無視します (実際の処理は未実装)`);
        this.uiManager.updateStatus(`${selectedPaths.length}件のエラーを無視しました。`);
    }

    _handleRetryScanError() {
        const selectedPaths = this.selectionManager.getSelectedFilePaths();
        if (selectedPaths.length === 0) {
            this.uiManager.updateStatus("操作対象のアイテムが選択されていません。", true);
            return;
        }
        console.log(`${selectedPaths.length}件のエラーを再スキャン試行します (実際の処理は未実装)`);
        this.uiManager.updateStatus(`${selectedPaths.length}件のエラーの再スキャンを試行します。`);
    }
}

export default ActionHandler;