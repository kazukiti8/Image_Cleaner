class SettingsManager {
    constructor() {
        this.settings = null;
        this.defaultSettings = {
            similarityThreshold: 80,
            blurThreshold: 60,
            includeSubfolders: true,
            deleteConfirmation: 'always',
            moveDestination: '',
            enableDebugLog: false,
            saveLogFile: false
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.bindEvents();
        this.updateUI();
    }

    async loadSettings() {
        try {
            this.settings = await window.electronAPI.loadSettings();
            console.log('設定を読み込みました:', this.settings);
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    async saveSettings() {
        try {
            const result = await window.electronAPI.saveSettings(this.settings);
            if (result.success) {
                this.showNotification('設定を保存しました', 'success');
                return true;
            } else {
                this.showNotification('設定の保存に失敗しました', 'error');
                return false;
            }
        } catch (error) {
            console.error('設定の保存に失敗しました:', error);
            this.showNotification('設定の保存に失敗しました', 'error');
            return false;
        }
    }

    updateUI() {
        if (!this.settings) return;

        // スライダーの値を設定
        const similaritySlider = document.getElementById('similarityThreshold');
        const blurSlider = document.getElementById('blurThreshold');
        
        if (similaritySlider) {
            similaritySlider.value = this.settings.similarityThreshold;
            document.getElementById('similarityThresholdValue').textContent = `${this.settings.similarityThreshold}%`;
        }
        
        if (blurSlider) {
            blurSlider.value = this.settings.blurThreshold;
            document.getElementById('blurThresholdValue').textContent = this.settings.blurThreshold;
        }
        
        // チェックボックスの値を設定
        const includeSubfolders = document.getElementById('includeSubfolders');
        const enableDebugLog = document.getElementById('enableDebugLog');
        const saveLogFile = document.getElementById('saveLogFile');
        
        if (includeSubfolders) includeSubfolders.checked = this.settings.includeSubfolders;
        if (enableDebugLog) enableDebugLog.checked = this.settings.enableDebugLog;
        if (saveLogFile) saveLogFile.checked = this.settings.saveLogFile;
        
        // セレクトボックスの値を設定
        const deleteConfirmation = document.getElementById('deleteConfirmation');
        if (deleteConfirmation) deleteConfirmation.value = this.settings.deleteConfirmation;
        
        // 移動先フォルダの値を設定
        const moveDestination = document.getElementById('moveDestination');
        if (moveDestination) moveDestination.value = this.settings.moveDestination;
    }

    bindEvents() {
        // 設定ボタンのクリックイベント
        const settingsButton = document.getElementById('settingsButton');
        if (settingsButton) {
            settingsButton.addEventListener('click', () => {
                this.showModal();
            });
        }

        // 設定モーダルの閉じるボタン
        const closeSettings = document.getElementById('closeSettings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                this.hideModal();
            });
        }

        // 設定モーダルの背景クリック
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settingsModal') {
                    this.hideModal();
                }
            });
        }

        // スライダーの値変更イベント
        const similaritySlider = document.getElementById('similarityThreshold');
        if (similaritySlider) {
            similaritySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('similarityThresholdValue').textContent = `${value}%`;
                this.settings.similarityThreshold = parseInt(value);
            });
        }

        const blurSlider = document.getElementById('blurThreshold');
        if (blurSlider) {
            blurSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('blurThresholdValue').textContent = value;
                this.settings.blurThreshold = parseInt(value);
            });
        }

        // チェックボックスの値変更イベント
        const includeSubfolders = document.getElementById('includeSubfolders');
        if (includeSubfolders) {
            includeSubfolders.addEventListener('change', (e) => {
                this.settings.includeSubfolders = e.target.checked;
            });
        }

        const enableDebugLog = document.getElementById('enableDebugLog');
        if (enableDebugLog) {
            enableDebugLog.addEventListener('change', (e) => {
                this.settings.enableDebugLog = e.target.checked;
            });
        }

        const saveLogFile = document.getElementById('saveLogFile');
        if (saveLogFile) {
            saveLogFile.addEventListener('change', (e) => {
                this.settings.saveLogFile = e.target.checked;
            });
        }

        // セレクトボックスの値変更イベント
        const deleteConfirmation = document.getElementById('deleteConfirmation');
        if (deleteConfirmation) {
            deleteConfirmation.addEventListener('change', (e) => {
                this.settings.deleteConfirmation = e.target.value;
            });
        }

        // 移動先フォルダ選択ボタン
        const selectMoveFolder = document.getElementById('selectMoveFolder');
        if (selectMoveFolder) {
            selectMoveFolder.addEventListener('click', async () => {
                try {
                    const folderPath = await window.electronAPI.selectFolder();
                    if (folderPath) {
                        this.settings.moveDestination = folderPath;
                        document.getElementById('moveDestination').value = folderPath;
                    }
                } catch (error) {
                    console.error('フォルダ選択に失敗しました:', error);
                }
            });
        }

        // リセットボタン
        const resetSettings = document.getElementById('resetSettings');
        if (resetSettings) {
            resetSettings.addEventListener('click', () => {
                this.reset();
            });
        }

        // 保存ボタン
        const saveSettings = document.getElementById('saveSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', async () => {
                const success = await this.saveSettings();
                if (success) {
                    this.hideModal();
                }
            });
        }
    }

    showModal() {
        this.updateUI();
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    reset() {
        this.settings = { ...this.defaultSettings };
        this.updateUI();
    }

    getSettings() {
        return this.settings;
    }

    showNotification(message, type = 'info') {
        // 簡単な通知表示（後で改善可能）
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // より良い通知システムを実装する場合はここに追加
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// グローバルに公開
window.SettingsManager = SettingsManager; 