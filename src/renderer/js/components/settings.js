class SettingsManager {
    constructor() {
        this.settings = null;
        this.defaultSettings = {
            includeSubfolders: true,
            deleteOperation: 'recycleBin',
            defaultOutputFolder: '',
            logLevel: 'normal',
            logFilePath: '',
            showFirstTimeGuide: true,
            exportFormat: 'csv',
            exportTarget: 'current',
            includeMetadata: true,
            includeStatistics: true,
            includeProcessingHistory: true,
            fileWatchingEnabled: true,
            cacheEnabled: true,
            cacheValidityHours: 24
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

        // チェックボックスの値を設定
        const includeSubfolders = document.getElementById('includeSubfolders');
        if (includeSubfolders) {
            includeSubfolders.checked = this.settings.includeSubfolders;
        }
        
        // ラジオボタンの値を設定
        const deleteToRecycleBin = document.getElementById('deleteToRecycleBin');
        const deletePermanently = document.getElementById('deletePermanently');
        if (deleteToRecycleBin && deletePermanently) {
            if (this.settings.deleteOperation === 'recycleBin') {
                deleteToRecycleBin.checked = true;
            } else {
                deletePermanently.checked = true;
            }
        }
        
        // 移動先フォルダの値を設定
        const defaultOutputFolder = document.getElementById('defaultOutputFolder');
        if (defaultOutputFolder) {
            defaultOutputFolder.value = this.settings.defaultOutputFolder || '';
        }
        
        // セレクトボックスの値を設定
        const logLevel = document.getElementById('logLevel');
        if (logLevel) {
            logLevel.value = this.settings.logLevel;
        }
        
        // ログファイルパスの値を設定
        const logFilePath = document.getElementById('logFilePath');
        if (logFilePath) {
            logFilePath.value = this.settings.logFilePath;
        }

        // エクスポート・レポート設定の値を設定
        const exportFormat = document.getElementById('exportFormat');
        if (exportFormat) {
            exportFormat.value = this.settings.exportFormat;
        }
        const exportTarget = document.getElementById('exportTarget');
        if (exportTarget) {
            exportTarget.value = this.settings.exportTarget;
        }
        const includeMetadata = document.getElementById('includeMetadata');
        if (includeMetadata) {
            includeMetadata.checked = this.settings.includeMetadata;
        }
        const includeStatistics = document.getElementById('includeStatistics');
        if (includeStatistics) {
            includeStatistics.checked = this.settings.includeStatistics;
        }
        const includeProcessingHistory = document.getElementById('includeProcessingHistory');
        if (includeProcessingHistory) {
            includeProcessingHistory.checked = this.settings.includeProcessingHistory;
        }

        // ファイル監視設定の値を設定
        const fileWatchingEnabled = document.getElementById('fileWatchingEnabled');
        if (fileWatchingEnabled) {
            fileWatchingEnabled.checked = this.settings.fileWatchingEnabled;
        }

        // キャッシュ設定の値を設定
        const cacheEnabled = document.getElementById('cacheEnabled');
        if (cacheEnabled) {
            cacheEnabled.checked = this.settings.cacheEnabled;
        }

        const cacheValidityHours = document.getElementById('cacheValidityHours');
        if (cacheValidityHours) {
            cacheValidityHours.value = this.settings.cacheValidityHours;
        }
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

        // チェックボックスの値変更イベント
        const includeSubfolders = document.getElementById('includeSubfolders');
        if (includeSubfolders) {
            includeSubfolders.addEventListener('change', (e) => {
                this.settings.includeSubfolders = e.target.checked;
            });
        }

        // ラジオボタンの値変更イベント
        const deleteToRecycleBin = document.getElementById('deleteToRecycleBin');
        const deletePermanently = document.getElementById('deletePermanently');
        if (deleteToRecycleBin) {
            deleteToRecycleBin.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.settings.deleteOperation = 'recycleBin';
                }
            });
        }
        if (deletePermanently) {
            deletePermanently.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.settings.deleteOperation = 'permanently';
                }
            });
        }

        // セレクトボックスの値変更イベント
        const logLevel = document.getElementById('logLevel');
        if (logLevel) {
            logLevel.addEventListener('change', (e) => {
                this.settings.logLevel = e.target.value;
            });
        }

        // ログファイルパス変更ボタン
        const changeLogPath = document.getElementById('changeLogPath');
        if (changeLogPath) {
            changeLogPath.addEventListener('click', async () => {
                try {
                    const folderPath = await window.electronAPI.selectFolder();
                    if (folderPath) {
                        this.settings.logFilePath = folderPath;
                        document.getElementById('logFilePath').value = folderPath;
                    }
                } catch (error) {
                    console.error('フォルダ選択に失敗しました:', error);
                }
            });
        }

        // 移動先フォルダ変更ボタン
        const changeOutputFolder = document.getElementById('changeOutputFolder');
        if (changeOutputFolder) {
            changeOutputFolder.addEventListener('click', async () => {
                try {
                    const folderPath = await window.electronAPI.selectFolder();
                    if (folderPath) {
                        this.settings.defaultOutputFolder = folderPath;
                        document.getElementById('defaultOutputFolder').value = folderPath;
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
                    // メインアプリケーションの移動フォルダ表示を更新
                    if (window.imageCleanupApp) {
                        window.imageCleanupApp.updateUI();
                    }
                    this.hideModal();
                }
            });
        }

        // エクスポート・レポート設定イベント
        const exportFormat = document.getElementById('exportFormat');
        if (exportFormat) {
            exportFormat.addEventListener('change', (e) => {
                this.settings.exportFormat = e.target.value;
            });
        }
        const exportTarget = document.getElementById('exportTarget');
        if (exportTarget) {
            exportTarget.addEventListener('change', (e) => {
                this.settings.exportTarget = e.target.value;
            });
        }
        const includeMetadata = document.getElementById('includeMetadata');
        if (includeMetadata) {
            includeMetadata.addEventListener('change', (e) => {
                this.settings.includeMetadata = e.target.checked;
            });
        }
        const includeStatistics = document.getElementById('includeStatistics');
        if (includeStatistics) {
            includeStatistics.addEventListener('change', (e) => {
                this.settings.includeStatistics = e.target.checked;
            });
        }
        const includeProcessingHistory = document.getElementById('includeProcessingHistory');
        if (includeProcessingHistory) {
            includeProcessingHistory.addEventListener('change', (e) => {
                this.settings.includeProcessingHistory = e.target.checked;
            });
        }

        // ファイル監視設定のイベント
        const fileWatchingEnabled = document.getElementById('fileWatchingEnabled');
        if (fileWatchingEnabled) {
            fileWatchingEnabled.addEventListener('change', (e) => {
                this.settings.fileWatchingEnabled = e.target.checked;
                // メインアプリケーションの設定も更新
                if (window.imageCleanupApp) {
                    window.imageCleanupApp.fileWatchingEnabled = e.target.checked;
                }
            });
        }

        // キャッシュ設定のイベント
        const cacheEnabled = document.getElementById('cacheEnabled');
        if (cacheEnabled) {
            cacheEnabled.addEventListener('change', (e) => {
                this.settings.cacheEnabled = e.target.checked;
                // メインアプリケーションの設定も更新
                if (window.imageCleanupApp) {
                    window.imageCleanupApp.cacheEnabled = e.target.checked;
                }
            });
        }

        const cacheValidityHours = document.getElementById('cacheValidityHours');
        if (cacheValidityHours) {
            cacheValidityHours.addEventListener('change', (e) => {
                const hours = parseInt(e.target.value) || 24;
                this.settings.cacheValidityHours = hours;
                // メインアプリケーションの設定も更新
                if (window.imageCleanupApp) {
                    window.imageCleanupApp.cacheValidityHours = hours;
                }
            });
        }

        // 設定値の更新
        this.updateUI();
        
        // ガイダンス再表示ボタン
        document.getElementById('showGuideAgain')?.addEventListener('click', () => {
            this.hideModal();
            // グローバルなガイダンス表示メソッドを呼び出し
            if (window.imageCleanupApp) {
                window.imageCleanupApp.showGuide();
            }
        });
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