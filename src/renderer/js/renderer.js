// 画像整理アプリ レンダラープロセスメインスクリプト

// 文字化け対策
function safeConsoleLog(...args) {
    try {
        const message = args.join(' ');
        // ファイルログに出力（メインプロセスに委譲）
        if (window.electronAPI && window.electronAPI.writeToLog) {
            window.electronAPI.writeToLog(`LOG: ${message}`);
        }
        // コンソールには最小限の情報のみ出力
        console.log('App running...');
    } catch (error) {
        // エラーを無視
    }
}

function safeConsoleError(...args) {
    try {
        const message = args.join(' ');
        // ファイルログに出力（メインプロセスに委譲）
        if (window.electronAPI && window.electronAPI.writeToLog) {
            window.electronAPI.writeToLog(`ERROR: ${message}`);
        }
        // コンソールには最小限の情報のみ出力
        console.log('Error occurred. Check log file.');
    } catch (error) {
        // エラーを無視
    }
}

function safeConsoleWarn(...args) {
    try {
        const message = args.join(' ');
        // ファイルログに出力（メインプロセスに委譲）
        if (window.electronAPI && window.electronAPI.writeToLog) {
            window.electronAPI.writeToLog(`WARN: ${message}`);
        }
        // コンソールには最小限の情報のみ出力
        console.log('Warning occurred. Check log file.');
    } catch (error) {
        // エラーを無視
    }
}

// パス操作のためのユーティリティ関数
function pathBasename(filePath) {
    return filePath.split(/[\\/]/).pop();
}

// バッチ処理マネージャークラス
class BatchProcessor {
    constructor() {
        this.isProcessing = false;
        this.isPaused = false;
        this.currentBatch = [];
        this.processedCount = 0;
        this.totalCount = 0;
        this.successCount = 0;
        this.errorCount = 0;
        this.currentOperation = null;
        this.batchSize = 10; // 一度に処理するファイル数
        this.delayBetweenBatches = 100; // バッチ間の遅延（ms）
        this.progressCallback = null;
        this.completeCallback = null;
        this.errorCallback = null;
        this.operationHistory = [];
    }

    // バッチ処理の開始
    async startBatchOperation(operation, items, options = {}) {
        if (this.isProcessing) {
            throw new Error('既にバッチ処理が実行中です');
        }

        this.isProcessing = true;
        this.isPaused = false;
        this.currentOperation = operation;
        this.currentBatch = [...items];
        this.processedCount = 0;
        this.totalCount = items.length;
        this.successCount = 0;
        this.errorCount = 0;
        this.batchSize = options.batchSize || 10;
        this.delayBetweenBatches = options.delay || 100;

        safeConsoleLog(`Batch processing started: ${operation} - ${this.totalCount} items`);

        try {
            await this.processBatches();
        } catch (error) {
            safeConsoleError('Batch processing error:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        } finally {
            this.isProcessing = false;
            this.isPaused = false;
        }
    }

    // バッチ単位での処理
    async processBatches() {
        while (this.currentBatch.length > 0 && !this.isPaused) {
            const batch = this.currentBatch.splice(0, this.batchSize);
            
            safeConsoleLog(`Processing batch: ${batch.length} items (remaining: ${this.currentBatch.length} items)`);
            
            // バッチ内の各アイテムを処理
            for (const item of batch) {
                if (this.isPaused) break;
                
                try {
                    await this.processItem(item);
                    this.successCount++;
                } catch (error) {
                    safeConsoleError(`Item processing error:`, error);
                    this.errorCount++;
                    this.operationHistory.push({
                        item: item,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
                
                this.processedCount++;
                
                // 進捗コールバック
                if (this.progressCallback) {
                    this.progressCallback({
                        processed: this.processedCount,
                        total: this.totalCount,
                        success: this.successCount,
                        error: this.errorCount,
                        progress: (this.processedCount / this.totalCount) * 100
                    });
                }
            }
            
            // バッチ間の遅延
            if (this.currentBatch.length > 0 && !this.isPaused) {
                await this.delay(this.delayBetweenBatches);
            }
        }
        
        // 処理完了
        if (!this.isPaused) {
            safeConsoleLog(`Batch processing completed: ${this.successCount} successful, ${this.errorCount} errors`);
            if (this.completeCallback) {
                this.completeCallback({
                    total: this.totalCount,
                    success: this.successCount,
                    error: this.errorCount,
                    history: this.operationHistory
                });
            }
        }
    }

    // 個別アイテムの処理
    async processItem(item) {
        switch (this.currentOperation) {
            case 'delete':
                return await this.deleteFile(item);
            case 'move':
                return await this.moveFile(item);
            case 'copy':
                return await this.copyFile(item);
            default:
                throw new Error(`未対応の操作: ${this.currentOperation}`);
        }
    }

    // ファイル削除
    async deleteFile(item) {
        return await window.electronAPI.deleteFile(item.filePath);
    }

    // ファイル移動
    async moveFile(item) {
        const destination = await this.getDestinationPath(item);
        return await window.electronAPI.moveFile(item.filePath, destination);
    }

    // ファイルコピー
    async copyFile(item) {
        const destination = await this.getDestinationPath(item);
        return await window.electronAPI.copyFile(item.filePath, destination);
    }

    // 移動先パスの取得
    async getDestinationPath(item) {
        // 設定から出力フォルダを取得
        const settings = window.imageCleanupApp?.getSettings();
        let outputFolder = '';
        if (settings && settings.defaultOutputFolder) {
            outputFolder = settings.defaultOutputFolder;
        }
        
        if (!outputFolder) {
            throw new Error('移動先フォルダが設定されていません。設定画面で移動先フォルダを設定してください。');
        }
        
        const filename = item.filename || item.filePath.split(/[\\/]/).pop();
        return `${outputFolder}/${filename}`;
    }

    // 処理の一時停止
    pause() {
        this.isPaused = true;
        safeConsoleLog('Batch processing paused');
    }

    // 処理の再開
    resume() {
        if (this.isProcessing && this.isPaused) {
            this.isPaused = false;
            safeConsoleLog('Batch processing resumed');
            this.processBatches();
        }
    }

    // 処理の停止
    stop() {
        this.isProcessing = false;
        this.isPaused = false;
        this.currentBatch = [];
        safeConsoleLog('Batch processing stopped');
    }

    // 遅延関数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 操作履歴の取得
    getOperationHistory() {
        return this.operationHistory;
    }

    // 操作履歴のクリア
    clearOperationHistory() {
        this.operationHistory = [];
    }
}

// メインアプリケーションクラス
class ImageCleanupApp {
    constructor() {
        this.targetFolder = null;
        this.scanInProgress = false;
        this.scanResults = {
            blurImages: [],
            similarImages: [],
            errors: []
        };
        this.currentTab = 'blur';
        this.selectedFiles = new Set();
        this.selectedSimilarPairs = new Set();
        this.selectedErrors = new Set();
        this.batchProcessor = new BatchProcessor();
        
        // エクスポート・レポートマネージャー
        this.exportReportManager = new ExportReportManager();
        
        // イベントリスナーの初期化
        this.initializeEventListeners();
        
        // その他の初期化
        this.initializeFilterEvents();
        this.initializeKeyboardShortcuts();
        this.initializeBatchEventListeners();
        this.initializeAdvancedFiltering();
        this.updateFilterUI();
        this.showGuidanceIfNeeded();
        this.startPerformanceMonitoring();
        this.startMemoryCleanup();
    }

    init() {
        safeConsoleLog('ImageCleanupApp initialization started');
        
        // イベントリスナーの設定
        this.initializeEventListeners();
        
        // フィルター関連のイベントリスナー
        this.initializeFilterEvents();
        
        // キーボードショートカットの初期化
        this.initializeKeyboardShortcuts();
        
        // バッチ処理関連のイベントリスナー
        this.initializeBatchEventListeners();
        
        // 高度なフィルタリング機能の初期化
        this.initializeAdvancedFiltering();
        
        // 初期UIの設定
        this.updateFilterUI();
        
        // ガイダンスの表示
        this.showGuidanceIfNeeded();
        
        // パフォーマンス監視の開始
        this.startPerformanceMonitoring();
        this.startMemoryCleanup();
        
        safeConsoleLog('ImageCleanupApp initialization completed');
    }

    getSettings() {
        return window.settingsManager ? window.settingsManager.getSettings() : null;
    }

    // 基本的なイベントリスナーの初期化
    initializeEventListeners() {
        // フォルダ選択ボタン
        document.getElementById('targetFolder')?.addEventListener('click', () => this.selectTargetFolder());
        
        // スキャンボタン
        document.getElementById('scanButton')?.addEventListener('click', () => this.startScan());
        
        // タブ切り替え
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // 選択操作ボタン
        document.getElementById('selectAllBtn')?.addEventListener('click', () => this.selectAll());
        document.getElementById('deselectAllBtn')?.addEventListener('click', () => this.deselectAll());
        
        // エクスポート・レポート関連のイベントリスナー
        document.getElementById('showExportReport')?.addEventListener('click', () => {
            this.exportReportManager.showExportReportPanel();
        });
        
        document.getElementById('showProcessingLog')?.addEventListener('click', () => {
            this.exportReportManager.showProcessingLog();
        });
        
        // スキャン関連のイベントリスナー
        if (window.electronAPI) {
            // スキャン進捗
            window.electronAPI.onScanProgress((progress) => {
                this.updateScanProgress(progress);
            });
            
            // スキャン完了
            window.electronAPI.onScanComplete((results) => {
                this.handleScanComplete(results);
            });
            
            // スキャンエラー
            window.electronAPI.onScanError((error) => {
                this.handleScanError(error);
            });
        }
    }

    // スキャン関連のメソッド
    async selectTargetFolder() {
        try {
            const folderPath = await window.electronAPI.selectFolder();
            if (folderPath) {
                this.targetFolder = folderPath;
                document.getElementById('targetFolderPathDisplay').textContent = this.getDisplayPath(folderPath);
                document.getElementById('targetFolderPathDisplay').title = folderPath;
                this.updateUI();
            }
        } catch (error) {
            safeConsoleError('Folder selection error:', error);
            this.showError('フォルダの選択に失敗しました');
        }
    }

    async selectOutputFolder() {
        try {
            // 設定からデフォルトの移動先フォルダを取得
            const settings = this.getSettings();
            let outputFolder = '';
            if (settings && settings.defaultOutputFolder) {
                outputFolder = settings.defaultOutputFolder;
            }
            
            // 設定に移動先フォルダが設定されていない場合はダイアログを表示
            if (!outputFolder) {
                const folderPath = await window.electronAPI.selectOutputFolder();
                if (folderPath) {
                    return folderPath;
                }
                return null;
            }
            
            return outputFolder;
        } catch (error) {
            safeConsoleError('Output folder selection error:', error);
            this.showError('移動先フォルダの選択に失敗しました');
            return null;
        }
    }

    async startScan() {
        if (!this.targetFolder) {
            this.showError('対象フォルダを選択してください');
            return;
        }

        if (this.scanInProgress) {
            // スキャンキャンセル
            await this.cancelScan();
            return;
        }

        this.scanInProgress = true;
        this.updateScanButton();
        
        // 進捗メッセージを初期化
        const progressMessage = document.getElementById('progressMessage');
        const progressText = document.getElementById('progressText');
        if (progressMessage && progressText) {
            progressText.textContent = 'スキャンを開始しています...';
            progressMessage.style.display = 'block';
        }
        
        try {
            // スキャン結果をクリア
            this.clearResults();
            
            // スキャン開始
            await window.electronAPI.scanImages(this.targetFolder, true);
            
        } catch (error) {
            safeConsoleError('Scan start error:', error);
            this.showError('スキャンの開始に失敗しました');
            this.scanInProgress = false;
            this.updateScanButton();
            
            // 進捗メッセージを非表示
            if (progressMessage) {
                progressMessage.style.display = 'none';
            }
        }
    }

    async cancelScan() {
        try {
            await window.electronAPI.cancelScan();
            this.scanInProgress = false;
            this.updateScanButton();
            
            // 進捗メッセージを非表示
            const progressMessage = document.getElementById('progressMessage');
            if (progressMessage) {
                progressMessage.style.display = 'none';
            }
            
            safeConsoleLog('Scan cancelled');
        } catch (error) {
            safeConsoleError('Scan cancellation error:', error);
        }
    }

    updateScanProgress(progress) {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            const percentage = progress.percentage || Math.round((progress.current / progress.total) * 100);
            progressText.textContent = `スキャン中... ${progress.current}/${progress.total} (${percentage}%) - ${progress.filename || ''}`;
        }
    }

    handleScanComplete(results) {
        safeConsoleLog('Scan completed - Results received:', {
            blurImages: results.blurImages?.length || 0,
            similarImages: results.similarImages?.length || 0,
            errors: results.errors?.length || 0,
            results: results
        });
        
        this.scanInProgress = false;
        this.updateScanButton();
        
        // 進捗メッセージを非表示
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.style.display = 'none';
        }
        
        // 結果を保存
        this.scanResults = results;
        
        // 結果を表示
        safeConsoleLog('Displaying blur results:', results.blurImages?.length || 0);
        this.displayBlurResults(results.blurImages || []);
        
        safeConsoleLog('Displaying similar results:', results.similarImages?.length || 0);
        this.displaySimilarResults(results.similarImages || []);
        
        safeConsoleLog('Displaying error results:', results.errors?.length || 0);
        this.displayErrorResults(results.errors || []);
        
        this.showSuccess(`スキャン完了: ブレ画像${results.blurImages?.length || 0}件, 類似画像${results.similarImages?.length || 0}件, エラー${results.errors?.length || 0}件`);
    }

    handleScanError(error) {
        safeConsoleError('Scan error:', error);
        
        this.scanInProgress = false;
        this.updateScanButton();
        
        // 進捗メッセージを非表示
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.style.display = 'none';
        }
        
        this.showError('スキャン中にエラーが発生しました');
    }

    switchTab(tabName) {
        // タブボタンの状態を更新
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('tab-active');
        });
        
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('tab-active');
        }
        
        // タブコンテンツの表示を切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const activeContent = document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }
        
        this.currentTab = tabName;
        
        // 選択状態をクリア
        this.selectedFiles.clear();
        this.selectedSimilarPairs.clear();
        this.selectedErrors.clear();
        this.updateSelectedCount();
        this.updateActionButtons();
    }

    updateUI() {
        // フォルダパスの表示を更新
        if (this.targetFolder) {
            document.getElementById('targetFolderPathDisplay').textContent = this.getDisplayPath(this.targetFolder);
            document.getElementById('targetFolderPathDisplay').title = this.targetFolder;
        }
        
        this.updateScanButton();
        this.updateSelectedCount();
        this.updateActionButtons();
    }

    updateScanButton() {
        const scanButton = document.getElementById('scanButton');
        if (scanButton) {
            if (this.scanInProgress) {
                scanButton.textContent = 'スキャン停止';
                scanButton.classList.add('bg-red-500', 'hover:bg-red-600');
                scanButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            } else {
                scanButton.textContent = 'スキャン開始';
                scanButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
                scanButton.classList.remove('bg-red-500', 'hover:bg-red-600');
            }
        }
    }

    updateSelectedCount() {
        let count = 0;
        
        switch (this.currentTab) {
            case 'blur':
                count = this.selectedFiles.size;
                break;
            case 'similar':
                count = this.selectedSimilarPairs.size;
                break;
            case 'error':
                count = this.selectedErrors.size;
                break;
        }
        
        // 選択数を表示
        const countElement = document.getElementById('selectedCount');
        if (countElement) {
            countElement.textContent = count;
        }
    }

    getDisplayPath(path) {
        if (path.length <= 50) {
            return path;
        }
        return '...' + path.substring(path.length - 47);
    }

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleString('ja-JP');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span>${message}</span>
                <button class="ml-2 text-sm" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒後に自動削除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    // 結果表示メソッド
    displayBlurResults(blurImages) {
        safeConsoleLog('displayBlurResults called with:', blurImages.length, 'images');
        
        const container = document.getElementById('contentBlur');
        if (!container) {
            safeConsoleError('contentBlur container not found');
            return;
        }
        
        // タブのカウント表示を更新
        const countElement = document.getElementById('countBlur');
        if (countElement) {
            countElement.textContent = blurImages.length;
        }
        
        if (blurImages.length === 0) {
            safeConsoleLog('No blur images found, showing empty message');
            container.innerHTML = '<div class="text-center text-slate-500 py-8">ブレ画像は見つかりませんでした</div>';
            return;
        }
        
        safeConsoleLog('Creating blur table for', blurImages.length, 'images');
        const table = this.createBlurTable(blurImages);
        container.innerHTML = '';
        container.appendChild(table);
        safeConsoleLog('Blur table created and added to container');
    }

    displaySimilarResults(similarImages) {
        const container = document.getElementById('contentSimilar');
        if (!container) return;
        
        // タブのカウント表示を更新
        const countElement = document.getElementById('countSimilar');
        if (countElement) {
            countElement.textContent = similarImages.length;
        }
        
        if (similarImages.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 py-8">類似画像は見つかりませんでした</div>';
            return;
        }
        
        const table = this.createSimilarTable(similarImages);
        container.innerHTML = '';
        container.appendChild(table);
    }

    displayErrorResults(errors) {
        const container = document.getElementById('contentError');
        if (!container) return;
        
        // タブのカウント表示を更新
        const countElement = document.getElementById('countError');
        if (countElement) {
            countElement.textContent = errors.length;
        }
        
        if (errors.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 py-8">エラーはありません</div>';
            return;
        }
        
        const table = this.createErrorTable(errors);
        container.innerHTML = '';
        container.appendChild(table);
    }

    clearResults() {
        this.scanResults = {
            blurImages: [],
            similarImages: [],
            errors: []
        };
        this.selectedFiles.clear();
        this.selectedSimilarPairs.clear();
        this.selectedErrors.clear();
        
        // 各タブのコンテンツをクリア
        ['Blur', 'Similar', 'Error'].forEach(tab => {
            const container = document.getElementById(`content${tab}`);
            if (container) {
                container.innerHTML = '<div class="text-center text-slate-500 py-8">スキャンを開始してください</div>';
            }
        });
        
        // タブのカウント表示をリセット
        const countElements = ['countBlur', 'countSimilar', 'countError'];
        countElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '0';
            }
        });
        
        this.updateSelectedCount();
        this.updateActionButtons();
    }

    // 基本的なファイル操作メソッド
    moveToTrash() {
        this.performFileOperation('trash');
    }

    deletePermanently() {
        this.performFileOperation('delete');
    }

    moveFiles() {
        this.performFileOperation('move');
    }

    async performFileOperation(operation) {
        let filePaths = [];
        let count = 0;
        
        switch (this.currentTab) {
            case 'blur':
                filePaths = Array.from(this.selectedFiles);
                count = filePaths.length;
                break;
            case 'similar':
                // 類似画像の場合は、選択されたペアの両方のファイルを取得
                filePaths = [];
                this.selectedSimilarPairs.forEach(pairValue => {
                    const [file1, file2] = pairValue.split('|');
                    filePaths.push(file1, file2);
                });
                count = this.selectedSimilarPairs.size;
                break;
            case 'error':
                filePaths = Array.from(this.selectedErrors);
                count = filePaths.length;
                break;
        }
        
        if (count === 0) {
            this.showError('操作するファイルを選択してください');
            return;
        }
        
        // 確認ダイアログを表示
        const confirmed = await this.showOperationConfirmation(operation, count);
        if (!confirmed) return;
        
        // ファイル操作を実行
        await this.executeFileOperation(operation, filePaths);
    }

    async showOperationConfirmation(operation, fileCount) {
        const operationNames = {
            'trash': 'ゴミ箱へ移動',
            'delete': '完全削除',
            'move': '移動'
        };
        
        const message = `${operationNames[operation]}を実行しますか？\n対象: ${fileCount}件`;
        
        return confirm(message);
    }

    async executeFileOperation(operation, filePaths, destinationPath = null) {
        try {
            let result;
            
            switch (operation) {
                case 'trash':
                    result = await window.electronAPI.deleteFiles(filePaths, true);
                    break;
                case 'delete':
                    result = await window.electronAPI.deleteFiles(filePaths, false);
                    break;
                case 'move':
                    if (!destinationPath) {
                        destinationPath = await this.selectMoveDestination();
                        if (!destinationPath) return;
                    }
                    result = await window.electronAPI.moveFiles(filePaths, destinationPath);
                    break;
                default:
                    throw new Error(`未対応の操作: ${operation}`);
            }
            
            if (result.success) {
                this.showSuccess(`${operationNames[operation]}が完了しました`);
                // 成功したファイルをリストから削除
                this.removeTableRows(filePaths);
            } else {
                this.showError(`操作に失敗しました: ${result.error}`);
            }
            
        } catch (error) {
            safeConsoleError('File operation error:', error);
            this.showError(`操作に失敗しました: ${error.message}`);
        }
    }

    async selectMoveDestination() {
        try {
            // 設定から移動先フォルダを取得
            const settings = this.getSettings();
            let outputFolder = '';
            if (settings && settings.defaultOutputFolder) {
                outputFolder = settings.defaultOutputFolder;
            }
            
            // 設定に移動先フォルダが設定されていない場合はダイアログを表示
            if (!outputFolder) {
                const folderPath = await window.electronAPI.selectOutputFolder();
                if (folderPath) {
                    return folderPath;
                }
                return null;
            }
            
            return outputFolder;
        } catch (error) {
            safeConsoleError('Move destination folder selection error:', error);
            this.showError('移動先フォルダの選択に失敗しました');
            return null;
        }
    }

    // その他の必要なメソッド（簡略化）
    initializeFilterEvents() {
        // フィルター関連のイベントリスナー
        safeConsoleLog('Filter events initialized');
    }

    initializeKeyboardShortcuts() {
        // キーボードショートカット
        safeConsoleLog('Keyboard shortcuts initialized');
    }

    initializeBatchEventListeners() {
        // バッチ処理イベントリスナー
        safeConsoleLog('Batch event listeners initialized');
    }

    initializeAdvancedFiltering() {
        // 高度なフィルタリング
        safeConsoleLog('Advanced filtering initialized');
    }

    updateFilterUI() {
        // フィルターUIの更新
        safeConsoleLog('Filter UI updated');
    }

    showGuidanceIfNeeded() {
        // ガイダンスの表示
        safeConsoleLog('Guidance checked');
    }

    startPerformanceMonitoring() {
        // パフォーマンス監視
        safeConsoleLog('Performance monitoring started');
    }

    startMemoryCleanup() {
        // メモリクリーンアップ
        safeConsoleLog('Memory cleanup started');
    }

    // プレビュー表示
    showImagePreview(image) {
        const previewContainer = document.getElementById('previewAreaContainer');
        if (!previewContainer) return;
        previewContainer.innerHTML = '';
        
        // 画像要素
        const img = document.createElement('img');
        img.src = image.filePath;
        img.alt = image.filename;
        img.className = 'max-w-full max-h-[400px] rounded shadow';
        previewContainer.appendChild(img);
        
        // 画像情報
        document.getElementById('infoFileName').textContent = image.filename || '';
        document.getElementById('infoFilePath').textContent = image.filePath || '';
        document.getElementById('infoFilePath').title = image.filePath || '';
        document.getElementById('infoFileSize').textContent = this.formatFileSize(image.size || 0);
        document.getElementById('infoResolution').textContent = image.resolution || '';
        document.getElementById('infoTakenDate').textContent = image.takenDate || '';
        if (typeof image.blurScore !== 'undefined') {
            document.getElementById('infoBlurScoreContainer').style.display = '';
            document.getElementById('infoBlurScore').textContent = image.blurScore;
        } else {
            document.getElementById('infoBlurScoreContainer').style.display = 'none';
        }
    }

    // テーブル作成メソッド（ブレ画像）
    createBlurTable(blurImages) {
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-slate-300';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-100">
                <th class="border border-slate-300 px-4 py-2 text-left">
                    <input type="checkbox" id="selectAllBlur" class="mr-2">
                    ファイル名
                </th>
                <th class="border border-slate-300 px-4 py-2 text-left">サイズ</th>
                <th class="border border-slate-300 px-4 py-2 text-left">更新日時</th>
                <th class="border border-slate-300 px-4 py-2 text-left">スコア</th>
                <th class="border border-slate-300 px-4 py-2 text-left">パス</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        blurImages.forEach((image, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 cursor-pointer';
            row.innerHTML = `
                <td class="border border-slate-300 px-4 py-2">
                    <input type="checkbox" class="file-checkbox mr-2" data-filepath="${image.filePath}">
                    ${image.filename}
                </td>
                <td class="border border-slate-300 px-4 py-2">${this.formatFileSize(image.size)}</td>
                <td class="border border-slate-300 px-4 py-2">${this.formatDate(image.modifiedDate)}</td>
                <td class="border border-slate-300 px-4 py-2">
                    <span class="px-2 py-1 rounded text-sm ${image.blurScore > 80 ? 'bg-red-100 text-red-800' : image.blurScore > 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                        ${image.blurScore}
                    </span>
                </td>
                <td class="border border-slate-300 px-4 py-2 text-sm text-slate-600" title="${image.filePath}">
                    ${this.getDisplayPath(image.filePath)}
                </td>
            `;
            // プレビュー表示イベント
            row.addEventListener('click', (e) => {
                // チェックボックスクリック時は無視
                if (e.target.tagName.toLowerCase() === 'input') return;
                this.showImagePreview(image);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // チェックボックスのイベントリスナーを設定
        this.setupTableCheckboxes(table, 'blur');
        
        return table;
    }

    // 類似画像テーブルにも同様のプレビューイベントを追加
    createSimilarTable(similarImages) {
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-slate-300';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-100">
                <th class="border border-slate-300 px-4 py-2 text-left">
                    <input type="checkbox" id="selectAllSimilar" class="mr-2">
                    類似画像ペア
                </th>
                <th class="border border-slate-300 px-4 py-2 text-left">類似度</th>
                <th class="border border-slate-300 px-4 py-2 text-left">サイズ</th>
                <th class="border border-slate-300 px-4 py-2 text-left">更新日時</th>
                <th class="border border-slate-300 px-4 py-2 text-left">パス</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        similarImages.forEach((group, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 cursor-pointer';
            const file1 = group.files[0];
            const file2 = group.files[1];
            const pairKey = `${file1.filePath}|${file2.filePath}`;
            row.innerHTML = `
                <td class="border border-slate-300 px-4 py-2">
                    <input type="checkbox" class="similar-checkbox mr-2" data-pair="${pairKey}">
                    <div class="text-sm">
                        <div>${file1.filename}</div>
                        <div class="text-slate-500">${file2.filename}</div>
                    </div>
                </td>
                <td class="border border-slate-300 px-4 py-2">
                    <span class="px-2 py-1 rounded text-sm ${group.similarity >= 90 ? 'bg-red-100 text-red-800' : group.similarity >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}">
                        ${group.similarity}%
                    </span>
                </td>
                <td class="border border-slate-300 px-4 py-2 text-sm">
                    <div>${this.formatFileSize(file1.size)}</div>
                    <div class="text-slate-500">${this.formatFileSize(file2.size)}</div>
                </td>
                <td class="border border-slate-300 px-4 py-2 text-sm">
                    <div>${this.formatDate(file1.modifiedDate)}</div>
                    <div class="text-slate-500">${this.formatDate(file2.modifiedDate)}</div>
                </td>
                <td class="border border-slate-300 px-4 py-2 text-sm text-slate-600">
                    <div title="${file1.filePath}">${this.getDisplayPath(file1.filePath)}</div>
                    <div title="${file2.filePath}" class="text-slate-500">${this.getDisplayPath(file2.filePath)}</div>
                </td>
            `;
            // プレビュー表示イベント（ペアの1枚目クリックで1枚目、2枚目クリックで2枚目）
            row.addEventListener('click', (e) => {
                // チェックボックスクリック時は無視
                if (e.target.tagName.toLowerCase() === 'input') return;
                // クリック位置でどちらの画像か判定
                const y = e.offsetY;
                if (y < row.offsetHeight / 2) {
                    this.showImagePreview(file1);
                } else {
                    this.showImagePreview(file2);
                }
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // チェックボックスのイベントリスナーを設定
        this.setupTableCheckboxes(table, 'similar');
        
        return table;
    }

    createErrorTable(errors) {
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-slate-300';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-100">
                <th class="border border-slate-300 px-4 py-2 text-left">
                    <input type="checkbox" id="selectAllError" class="mr-2">
                    ファイル名
                </th>
                <th class="border border-slate-300 px-4 py-2 text-left">エラー詳細</th>
                <th class="border border-slate-300 px-4 py-2 text-left">パス</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        errors.forEach((error, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50';
            row.innerHTML = `
                <td class="border border-slate-300 px-4 py-2">
                    <input type="checkbox" class="error-checkbox mr-2" data-filepath="${error.filePath}">
                    ${error.filename}
                </td>
                <td class="border border-slate-300 px-4 py-2 text-red-600">${error.error}</td>
                <td class="border border-slate-300 px-4 py-2 text-sm text-slate-600" title="${error.filePath}">
                    ${this.getDisplayPath(error.filePath)}
                </td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // チェックボックスのイベントリスナーを設定
        this.setupTableCheckboxes(table, 'error');
        
        return table;
    }

    // テーブルのチェックボックスイベントを設定
    setupTableCheckboxes(table, type) {
        // 全選択チェックボックス
        const selectAllCheckbox = table.querySelector(`#selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`);
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = table.querySelectorAll(`.${type}-checkbox`);
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                    this.handleCheckboxChange(checkbox, type);
                });
            });
        }
        
        // 個別チェックボックス
        const checkboxes = table.querySelectorAll(`.${type}-checkbox`);
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleCheckboxChange(e.target, type);
            });
        });
    }

    // チェックボックスの変更を処理
    handleCheckboxChange(checkbox, type) {
        switch (type) {
            case 'blur':
            case 'error':
                const filePath = checkbox.dataset.filepath;
                if (checkbox.checked) {
                    this.selectedFiles.add(filePath);
                } else {
                    this.selectedFiles.delete(filePath);
                }
                break;
            case 'similar':
                const pairKey = checkbox.dataset.pair;
                if (checkbox.checked) {
                    this.selectedSimilarPairs.add(pairKey);
                } else {
                    this.selectedSimilarPairs.delete(pairKey);
                }
                break;
        }
        
        this.updateSelectedCount();
        this.updateActionButtons();
    }

    // 選択操作メソッド
    selectAll() {
        const checkboxes = document.querySelectorAll(`.${this.currentTab}-checkbox`);
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.handleCheckboxChange(checkbox, this.currentTab);
        });
        
        // 全選択チェックボックスも更新
        const selectAllCheckbox = document.querySelector(`#selectAll${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = true;
        }
    }

    deselectAll() {
        const checkboxes = document.querySelectorAll(`.${this.currentTab}-checkbox`);
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            this.handleCheckboxChange(checkbox, this.currentTab);
        });
        
        // 全選択チェックボックスも更新
        const selectAllCheckbox = document.querySelector(`#selectAll${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
    }

    removeTableRows(filePaths) {
        // 選択されたファイルの行を削除
        filePaths.forEach(filePath => {
            const row = document.querySelector(`[data-filepath="${filePath}"]`)?.closest('tr');
            if (row) {
                row.remove();
            }
        });
        
        // 選択状態をクリア
        this.selectedFiles.clear();
        this.selectedSimilarPairs.clear();
        this.selectedErrors.clear();
        this.updateSelectedCount();
        this.updateActionButtons();
    }

    updateActionButtons() {
        let count = 0;
        
        switch (this.currentTab) {
            case 'blur':
                count = this.selectedFiles.size;
                break;
            case 'similar':
                count = this.selectedSimilarPairs.size;
                break;
            case 'error':
                count = this.selectedErrors.size;
                break;
        }
        
        // アクションボタンの有効/無効を切り替え
        const actionButtons = document.querySelectorAll('#trashBtn, #deleteBtn, #moveBtn');
        actionButtons.forEach(button => {
            if (count > 0) {
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
                button.classList.add('cursor-pointer');
            } else {
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.classList.remove('cursor-pointer');
            }
        });
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    safeConsoleLog('DOM content loaded');
    window.imageCleanupApp = new ImageCleanupApp();
    
    // 設定マネージャーの初期化
    if (window.SettingsManager) {
        window.settingsManager = new window.SettingsManager();
        safeConsoleLog('Settings manager initialized');
    } else {
        safeConsoleError('SettingsManager class not found');
    }
}); 