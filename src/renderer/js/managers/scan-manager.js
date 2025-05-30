class ScanManager {
    constructor(uiManager, tableManager, filterManager) {
        this.uiManager = uiManager;
        this.tableManager = tableManager;
        this.filterManager = filterManager;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        const selectTargetFolderBtn = this.uiManager.getElement('selectTargetFolderBtn');
        const selectOutputFolderBtn = this.uiManager.getElement('selectOutputFolderBtn');
        const startScanBtn = this.uiManager.getElement('startScanBtn');
        const settingsBtn = this.uiManager.getElement('settingsBtn');

        selectTargetFolderBtn?.addEventListener('click', () => this._handleSelectTargetFolder());
        selectOutputFolderBtn?.addEventListener('click', () => this._handleSelectOutputFolder());
        startScanBtn?.addEventListener('click', () => this._handleStartScan());
        settingsBtn?.addEventListener('click', () => this._handleOpenSettings());

        // 初期状態でスキャンボタンを無効化
        if (startScanBtn) {
            startScanBtn.disabled = true;
        }
    }

    async _handleSelectTargetFolder() {
        try {
            this.uiManager.updateStatus('対象フォルダを選択中...');
            const folderPath = await window.electronAPI.openDirectoryDialog();
            
            if (folderPath) {
                this.uiManager.setSelectedTargetFolder(folderPath);
                this.uiManager.updateStatus(`対象フォルダ選択: ${folderPath}`);
                this.tableManager.clearAllTables();
            } else {
                this.uiManager.updateStatus('対象フォルダ選択がキャンセルされました。');
                const state = this.uiManager.getState();
                if (!state.selectedTargetFolder) {
                    const startScanBtn = this.uiManager.getElement('startScanBtn');
                    if (startScanBtn) startScanBtn.disabled = true;
                }
            }
        } catch (error) {
            console.error('対象フォルダ選択エラー:', error);
            this.uiManager.updateStatus(`対象フォルダ選択エラー: ${error.message}`, true);
        }
    }

    async _handleSelectOutputFolder() {
        try {
            this.uiManager.updateStatus('移動先フォルダを選択中...');
            const folderPath = await window.electronAPI.openDirectoryDialog();
            
            if (folderPath) {
                this.uiManager.setSelectedOutputFolder(folderPath);
                this.uiManager.updateStatus(`移動先フォルダ選択: ${folderPath}`);
            } else {
                this.uiManager.updateStatus('移動先フォルダ選択がキャンセルされました。');
            }
        } catch (error) {
            console.error('移動先フォルダ選択エラー:', error);
            this.uiManager.updateStatus(`移動先フォルダ選択エラー: ${error.message}`, true);
        }
    }

    async _handleStartScan() {
        const state = this.uiManager.getState();
        
        if (!state.selectedTargetFolder) {
            this.uiManager.updateStatus('スキャンを開始する前に対象フォルダを選択してください。', true);
            return;
        }

        this.tableManager.clearAllTables();
        this.uiManager.updateStatus(`スキャン中: ${state.selectedTargetFolder}`);
        this.uiManager.setScanningState(true);

        try {
            if (window.electronAPI && typeof window.electronAPI.executeScan === 'function') {
                const results = await window.electronAPI.executeScan(state.selectedTargetFolder);
                console.log('Scan results received:', results);
                
                this.tableManager.setOriginalScanResults(results);
                this.filterManager.resetAndApplyFilters();
                this.uiManager.updateStatus('スキャン完了', false);
            } else { 
                throw new Error('executeScan API is not available.');
            }
        } catch (error) {
            console.error('スキャン実行エラー:', error);
            this.uiManager.updateStatus(`スキャンエラー: ${error.message || '不明なエラー'}`, true);
            
            // エラー情報をテーブルに表示
            const errorResults = { 
                blurryImages: [], 
                similarImagePairs: [], 
                errorFiles: [{
                    id: 'scan_err', 
                    filename: 'スキャンエラー', 
                    errorMessage: error.message || 'Pythonスクリプトの実行に失敗しました。', 
                    filepath: state.selectedTargetFolder
                }]
            };
            this.tableManager.setOriginalScanResults(errorResults);
            this.tableManager.populateErrorTable(errorResults.errorFiles);
        } finally {
            this.uiManager.setScanningState(false);
        }
    }

    _handleOpenSettings() {
        console.log('設定ボタンクリック');
        if (window.electronAPI && typeof window.electronAPI.openSettingsWindow === 'function') {
            window.electronAPI.openSettingsWindow();
        } else {
            console.error('electronAPI.openSettingsWindow is not available.');
            this.uiManager.updateStatus('設定画面を開けませんでした。', true);
        }
    }
}

export default ScanManager;