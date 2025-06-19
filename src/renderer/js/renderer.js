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
        this.selectedIndividualFiles = new Set(); // 個別ファイル選択用
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
        
        // ファイル操作ボタン
        document.getElementById('copyBtn')?.addEventListener('click', () => this.copyFiles());
        document.getElementById('deleteBtn')?.addEventListener('click', () => this.deletePermanently());
        document.getElementById('moveBtn')?.addEventListener('click', () => this.moveFiles());
        
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
        let totalSize = 0;
        
        switch (this.currentTab) {
            case 'blur':
                count = this.selectedFiles.size;
                // 選択されたファイルのサイズを計算
                this.scanResults.blurImages.forEach(image => {
                    if (this.selectedFiles.has(image.filePath)) {
                        totalSize += image.size;
                    }
                });
                break;
            case 'similar':
                count = this.selectedSimilarPairs.size + this.selectedIndividualFiles.size;
                // 選択されたペアと個別ファイルのサイズを計算
                this.scanResults.similarImages.forEach(group => {
                    const pairKey = `${group.files[0].filePath}|${group.files[1].filePath}`;
                    if (this.selectedSimilarPairs.has(pairKey)) {
                        totalSize += group.files[0].size + group.files[1].size;
                    } else {
                        // 個別ファイルの選択をチェック
                        if (this.selectedIndividualFiles.has(group.files[0].filePath)) {
                            totalSize += group.files[0].size;
                        }
                        if (this.selectedIndividualFiles.has(group.files[1].filePath)) {
                            totalSize += group.files[1].size;
                        }
                    }
                });
                break;
            case 'error':
                count = this.selectedErrors.size;
                // エラーファイルのサイズは計算しない（エラーのため）
                break;
        }
        
        // 選択数を表示
        const countElement = document.getElementById('selectedCount');
        const sizeElement = document.getElementById('selectedSize');
        if (countElement) {
            countElement.textContent = `${count}件`;
        }
        if (sizeElement) {
            sizeElement.textContent = this.formatFileSize(totalSize);
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
        
        const { filterContainer, table } = this.createSimilarTable(similarImages);
        container.innerHTML = '';
        container.appendChild(filterContainer);
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
        this.selectedIndividualFiles.clear(); // 個別ファイル選択もクリア
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
        // 設定に応じて削除操作を決定
        const settings = this.getSettings();
        if (settings && settings.deleteOperation === 'recycleBin') {
            // 設定でゴミ箱へ移動が選択されている場合
            this.performFileOperation('trash');
        } else {
            // 設定で完全削除が選択されている場合、または設定がない場合
            this.performFileOperation('delete');
        }
    }

    moveFiles() {
        this.performFileOperation('move');
    }

    copyFiles() {
        this.performFileOperation('copy');
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
            'move': '移動',
            'copy': 'コピー'
        };
        
        const message = `${operationNames[operation]}を実行しますか？\n対象: ${fileCount}件`;
        
        return confirm(message);
    }

    async executeFileOperation(operation, filePaths, destinationPath = null) {
        try {
            let result;
            
            // 操作名の定義
            const operationNames = {
                'trash': 'ゴミ箱へ移動',
                'delete': '完全削除',
                'move': '移動',
                'copy': 'コピー'
            };
            
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
                case 'copy':
                    if (!destinationPath) {
                        destinationPath = await this.selectCopyDestination();
                        if (!destinationPath) return;
                    }
                    result = await window.electronAPI.copyFiles(filePaths, destinationPath);
                    break;
                default:
                    throw new Error(`未対応の操作: ${operation}`);
            }
            
            if (result.success) {
                this.showSuccess(`${operationNames[operation]}が完了しました`);
                // 成功したファイルをリストから削除
                safeConsoleLog(`File operation successful. Removing ${filePaths.length} files from table:`, filePaths);
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
            
            // 設定に移動先フォルダが設定されている場合は確認を求める
            if (outputFolder) {
                const useDefault = confirm(`設定で指定された移動先フォルダを使用しますか？\n${outputFolder}\n\n「キャンセル」を選択すると、別のフォルダを選択できます。`);
                if (useDefault) {
                    return outputFolder;
                }
            }
            
            // 設定に移動先フォルダが設定されていない場合、またはユーザーが別のフォルダを選択したい場合
            const folderPath = await window.electronAPI.selectOutputFolder();
            if (folderPath) {
                return folderPath;
            }
            return null;
        } catch (error) {
            safeConsoleError('Move destination folder selection error:', error);
            this.showError('移動先フォルダの選択に失敗しました');
            return null;
        }
    }

    async selectCopyDestination() {
        try {
            // 設定からコピー先フォルダを取得
            const settings = this.getSettings();
            let outputFolder = '';
            if (settings && settings.defaultOutputFolder) {
                outputFolder = settings.defaultOutputFolder;
            }
            
            // 設定にコピー先フォルダが設定されている場合は確認を求める
            if (outputFolder) {
                const useDefault = confirm(`設定で指定されたコピー先フォルダを使用しますか？\n${outputFolder}\n\n「キャンセル」を選択すると、別のフォルダを選択できます。`);
                if (useDefault) {
                    return outputFolder;
                }
            }
            
            // 設定にコピー先フォルダが設定されていない場合、またはユーザーが別のフォルダを選択したい場合
            const folderPath = await window.electronAPI.selectOutputFolder();
            if (folderPath) {
                return folderPath;
            }
            return null;
        } catch (error) {
            safeConsoleError('Copy destination folder selection error:', error);
            this.showError('コピー先フォルダの選択に失敗しました');
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
        img.className = 'max-w-full max-h-[600px] rounded shadow';
        
        // 画像読み込みエラーハンドラー
        img.onerror = () => {
            safeConsoleLog(`Image load error for: ${image.filePath}`);
            previewContainer.innerHTML = `
                <div class="text-center text-red-500 p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 mx-auto mb-2">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <p class="text-sm">ファイルが見つかりません</p>
                    <p class="text-xs text-gray-500 mt-1">${image.filename}</p>
                </div>
            `;
        };
        
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

    // 類似画像ペアプレビュー表示
    showSimilarImagePreview(file1, file2, similarity) {
        const previewContainer = document.getElementById('previewAreaContainer');
        if (!previewContainer) return;
        previewContainer.innerHTML = '';
        
        // 類似度表示
        const similarityDiv = document.createElement('div');
        similarityDiv.className = 'text-center mb-2 p-2 bg-slate-100 rounded';
        similarityDiv.innerHTML = `
            <span class="text-sm font-medium text-slate-700">類似度: </span>
            <span class="px-2 py-1 rounded text-sm font-bold ${similarity >= 90 ? 'bg-red-100 text-red-800' : similarity >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}">
                ${similarity}%
            </span>
        `;
        previewContainer.appendChild(similarityDiv);
        
        // 2つの画像を横に並べて表示
        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'flex space-x-2';
        
        // 画像1
        const img1Container = document.createElement('div');
        img1Container.className = 'flex-1 text-center';
        const img1 = document.createElement('img');
        img1.src = file1.filePath;
        img1.alt = file1.filename;
        img1.className = 'max-w-full max-h-[500px] rounded shadow mx-auto';
        
        // 画像1のエラーハンドラー
        img1.onerror = () => {
            safeConsoleLog(`Image1 load error for: ${file1.filePath}`);
            img1Container.innerHTML = `
                <div class="text-center text-red-500 p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 mx-auto mb-1">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <p class="text-xs">ファイルが見つかりません</p>
                </div>
            `;
        };
        
        img1Container.appendChild(img1);
        
        const label1 = document.createElement('div');
        label1.className = 'text-xs text-slate-600 mt-1 truncate';
        label1.textContent = file1.filename;
        img1Container.appendChild(label1);
        
        // 画像2
        const img2Container = document.createElement('div');
        img2Container.className = 'flex-1 text-center';
        const img2 = document.createElement('img');
        img2.src = file2.filePath;
        img2.alt = file2.filename;
        img2.className = 'max-w-full max-h-[500px] rounded shadow mx-auto';
        
        // 画像2のエラーハンドラー
        img2.onerror = () => {
            safeConsoleLog(`Image2 load error for: ${file2.filePath}`);
            img2Container.innerHTML = `
                <div class="text-center text-red-500 p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 mx-auto mb-1">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <p class="text-xs">ファイルが見つかりません</p>
                </div>
            `;
        };
        
        img2Container.appendChild(img2);
        
        const label2 = document.createElement('div');
        label2.className = 'text-xs text-slate-600 mt-1 truncate';
        label2.textContent = file2.filename;
        img2Container.appendChild(label2);
        
        imagesContainer.appendChild(img1Container);
        imagesContainer.appendChild(img2Container);
        previewContainer.appendChild(imagesContainer);
        
        // 画像情報（1枚目の情報を表示）
        document.getElementById('infoFileName').textContent = `${file1.filename} / ${file2.filename}`;
        document.getElementById('infoFilePath').textContent = file1.filePath;
        document.getElementById('infoFilePath').title = `${file1.filePath}\n${file2.filePath}`;
        document.getElementById('infoFileSize').textContent = `${this.formatFileSize(file1.size)} / ${this.formatFileSize(file2.size)}`;
        document.getElementById('infoResolution').textContent = `${file1.resolution || 'N/A'} / ${file2.resolution || 'N/A'}`;
        document.getElementById('infoTakenDate').textContent = `${file1.takenDate || 'N/A'} / ${file2.takenDate || 'N/A'}`;
        document.getElementById('infoBlurScoreContainer').style.display = 'none';
    }

    // テーブル作成メソッド（ブレ画像）
    createBlurTable(blurImages) {
        // ブレ画像をスコアの降順でソート
        const sortedBlurImages = [...blurImages].sort((a, b) => b.blurScore - a.blurScore);
        
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-slate-300';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-100">
                <th class="border border-slate-300 px-4 py-2 text-left w-1/4">
                    <input type="checkbox" id="selectAllBlur" class="mr-2">
                    ファイル名
                </th>
                <th class="border border-slate-300 px-4 py-2 text-left w-20">サイズ</th>
                <th class="border border-slate-300 px-4 py-2 text-left w-32">更新日時</th>
                <th class="border border-slate-300 px-4 py-2 text-left w-28 whitespace-nowrap">スコア</th>
                <th class="border border-slate-300 px-4 py-2 text-left">パス</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        sortedBlurImages.forEach((image, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 cursor-pointer';
            row.innerHTML = `
                <td class="border border-slate-300 px-4 py-2">
                    <input type="checkbox" class="blur-checkbox mr-2" data-filepath="${image.filePath}">
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
        // 類似画像を類似度の降順でソート
        const sortedSimilarImages = [...similarImages].sort((a, b) => b.similarity - a.similarity);
        
        // 類似度フィルタリング用のUIを追加
        const filterContainer = document.createElement('div');
        filterContainer.className = 'mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200';
        filterContainer.innerHTML = `
            <div class="flex flex-wrap items-center gap-4 text-sm">
                <div class="flex items-center space-x-2">
                    <span class="font-medium text-slate-700">類似度フィルター:</span>
                    <label class="flex items-center space-x-1">
                        <input type="checkbox" id="filter90plus" class="similarity-filter" data-min="90" checked>
                        <span class="px-2 py-1 rounded text-xs bg-red-100 text-red-800">90%以上</span>
                    </label>
                    <label class="flex items-center space-x-1">
                        <input type="checkbox" id="filter80plus" class="similarity-filter" data-min="80" checked>
                        <span class="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">80-89%</span>
                    </label>
                    <label class="flex items-center space-x-1">
                        <input type="checkbox" id="filter70plus" class="similarity-filter" data-min="70" checked>
                        <span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">70-79%</span>
                    </label>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="font-medium text-slate-700">表示:</span>
                    <span id="filteredCount" class="font-semibold text-blue-600">${sortedSimilarImages.length}</span>
                    <span class="text-slate-500">/ ${sortedSimilarImages.length}</span>
                </div>
            </div>
        `;
        
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-slate-300';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-100">
                <th class="border border-slate-300 px-4 py-2 text-left w-8">
                    <input type="checkbox" id="selectAllSimilar" class="mr-2">
                </th>
                <th class="border border-slate-300 px-4 py-2 text-left w-16">類似度</th>
                <th class="border border-slate-300 px-4 py-2 text-left w-32">画像1</th>
                <th class="border border-slate-300 px-4 py-2 text-left w-32">画像2</th>
                <th class="border border-slate-300 px-4 py-2 text-left">詳細情報</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        sortedSimilarImages.forEach((group, index) => {
            const file1 = group.files[0];
            const file2 = group.files[1];
            const pairKey = `${file1.filePath}|${file2.filePath}`;
            
            const row = document.createElement('tr');
            row.className = 'similarity-row hover:bg-slate-50';
            row.dataset.similarity = group.similarity;
            row.dataset.pairKey = pairKey;
            
            // 類似度に基づく行の色分け
            if (group.similarity >= 90) {
                row.classList.add('bg-red-50');
            } else if (group.similarity >= 80) {
                row.classList.add('bg-yellow-50');
            } else {
                row.classList.add('bg-blue-50');
            }
            
            row.innerHTML = `
                <td class="border border-slate-300 px-2 py-2 text-center">
                    <input type="checkbox" class="similar-checkbox" data-pair="${pairKey}">
                </td>
                <td class="border border-slate-300 px-3 py-2 text-center">
                    <span class="px-2 py-1 rounded text-sm font-semibold ${group.similarity >= 90 ? 'bg-red-100 text-red-800' : group.similarity >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}">
                        ${group.similarity}%
                    </span>
                </td>
                <td class="border border-slate-300 px-3 py-2">
                    <div class="flex items-center space-x-2">
                        <div class="w-12 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                            <img src="file://${file1.filePath}" alt="${file1.filename}" 
                                 class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="w-full h-full flex items-center justify-center text-xs text-slate-500" style="display:none;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate" title="${file1.filename}">${file1.filename}</div>
                            <div class="text-xs text-slate-500">${this.formatFileSize(file1.size)}</div>
                            <div class="text-xs text-slate-400">${this.formatDate(file1.modifiedDate)}</div>
                        </div>
                        <input type="checkbox" class="individual-checkbox ml-2" data-filepath="${file1.filePath}" data-pair="${pairKey}">
                    </div>
                </td>
                <td class="border border-slate-300 px-3 py-2">
                    <div class="flex items-center space-x-2">
                        <div class="w-12 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                            <img src="file://${file2.filePath}" alt="${file2.filename}" 
                                 class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="w-full h-full flex items-center justify-center text-xs text-slate-500" style="display:none;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate" title="${file2.filename}">${file2.filename}</div>
                            <div class="text-xs text-slate-500">${this.formatFileSize(file2.size)}</div>
                            <div class="text-xs text-slate-400">${this.formatDate(file2.modifiedDate)}</div>
                        </div>
                        <input type="checkbox" class="individual-checkbox ml-2" data-filepath="${file2.filePath}" data-pair="${pairKey}">
                    </div>
                </td>
                <td class="border border-slate-300 px-3 py-2 text-xs text-slate-600">
                    <div class="space-y-1">
                        <div><span class="font-medium">サイズ差:</span> ${this.getSizeDifference(file1.size, file2.size)}</div>
                        <div><span class="font-medium">パス1:</span> <span class="truncate block" title="${file1.filePath}">${this.getDisplayPath(file1.filePath)}</span></div>
                        <div><span class="font-medium">パス2:</span> <span class="truncate block" title="${file2.filePath}">${this.getDisplayPath(file2.filePath)}</span></div>
                    </div>
                </td>
            `;
            
            // プレビュー表示イベント（画像クリックで両方表示）
            const images = row.querySelectorAll('img');
            images.forEach(img => {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showSimilarImagePreview(file1, file2, group.similarity);
                });
            });
            
            // 行クリックでペア全体を選択
            row.addEventListener('click', (e) => {
                if (e.target.tagName.toLowerCase() === 'input') return;
                const pairCheckbox = row.querySelector('.similar-checkbox');
                pairCheckbox.checked = !pairCheckbox.checked;
                this.handleCheckboxChange(pairCheckbox, 'similar');
            });
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // フィルタリング機能を設定
        this.setupSimilarityFiltering(filterContainer, tbody);
        
        // チェックボックスのイベントリスナーを設定
        this.setupTableCheckboxes(table, 'similar');
        
        // 個別ファイル選択のイベントリスナーを設定
        this.setupIndividualCheckboxes(table);
        
        return { filterContainer, table };
    }

    // 類似度フィルタリング機能
    setupSimilarityFiltering(filterContainer, tbody) {
        const filters = filterContainer.querySelectorAll('.similarity-filter');
        const filteredCountSpan = filterContainer.querySelector('#filteredCount');
        const totalCount = tbody.children.length;
        
        filters.forEach(filter => {
            filter.addEventListener('change', () => {
                const minSimilarity = parseInt(filter.dataset.min);
                const rows = tbody.querySelectorAll('.similarity-row');
                let visibleCount = 0;
                
                rows.forEach(row => {
                    const similarity = parseInt(row.dataset.similarity);
                    const shouldShow = similarity >= minSimilarity;
                    row.style.display = shouldShow ? '' : 'none';
                    if (shouldShow) visibleCount++;
                });
                
                filteredCountSpan.textContent = visibleCount;
            });
        });
    }

    // 個別ファイル選択機能
    setupIndividualCheckboxes(table) {
        const individualCheckboxes = table.querySelectorAll('.individual-checkbox');
        
        individualCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const filePath = checkbox.dataset.filepath;
                const pairKey = checkbox.dataset.pair;
                
                if (checkbox.checked) {
                    this.selectedIndividualFiles.add(filePath);
                } else {
                    this.selectedIndividualFiles.delete(filePath);
                }
                
                // ペア全体の選択状態を更新
                this.updatePairSelectionState(pairKey);
                
                this.updateSelectedCount();
                this.updateActionButtons();
            });
        });
    }

    // ペア全体の選択状態を更新
    updatePairSelectionState(pairKey) {
        const pairCheckbox = document.querySelector(`.similar-checkbox[data-pair="${pairKey}"]`);
        const individualCheckboxes = document.querySelectorAll(`.individual-checkbox[data-pair="${pairKey}"]`);
        
        const checkedCount = Array.from(individualCheckboxes).filter(cb => cb.checked).length;
        
        if (checkedCount === 0) {
            pairCheckbox.checked = false;
            pairCheckbox.indeterminate = false;
        } else if (checkedCount === individualCheckboxes.length) {
            pairCheckbox.checked = true;
            pairCheckbox.indeterminate = false;
        } else {
            pairCheckbox.checked = false;
            pairCheckbox.indeterminate = true;
        }
    }

    // ファイルサイズの差を計算
    getSizeDifference(size1, size2) {
        const diff = Math.abs(size1 - size2);
        const percentage = ((diff / Math.max(size1, size2)) * 100).toFixed(1);
        const diffFormatted = this.formatFileSize(diff);
        
        if (size1 > size2) {
            return `画像1が${diffFormatted}大きい (${percentage}%)`;
        } else if (size2 > size1) {
            return `画像2が${diffFormatted}大きい (${percentage}%)`;
        } else {
            return '同じサイズ';
        }
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
        safeConsoleLog(`Setting up checkboxes for type: ${type}`);
        
        // 全選択チェックボックス
        const selectAllCheckbox = table.querySelector(`#selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`);
        if (selectAllCheckbox) {
            safeConsoleLog(`Found select all checkbox for ${type}`);
            selectAllCheckbox.addEventListener('change', (e) => {
                safeConsoleLog(`Select all checkbox changed: ${e.target.checked}`);
                const checkboxes = table.querySelectorAll(`.${type}-checkbox`);
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                    this.handleCheckboxChange(checkbox, type);
                });
            });
        } else {
            safeConsoleLog(`Select all checkbox not found for ${type}`);
        }
        
        // 個別チェックボックス
        const checkboxes = table.querySelectorAll(`.${type}-checkbox`);
        safeConsoleLog(`Found ${checkboxes.length} individual checkboxes for ${type}`);
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                safeConsoleLog(`Individual checkbox changed: ${e.target.checked}`);
                this.handleCheckboxChange(e.target, type);
            });
        });
    }

    // チェックボックスの変更を処理
    handleCheckboxChange(checkbox, type) {
        safeConsoleLog(`Checkbox change: type=${type}, checked=${checkbox.checked}, filepath=${checkbox.dataset.filepath}`);
        
        switch (type) {
            case 'blur':
                const filePath = checkbox.dataset.filepath;
                if (checkbox.checked) {
                    this.selectedFiles.add(filePath);
                } else {
                    this.selectedFiles.delete(filePath);
                }
                safeConsoleLog(`Blur files selected: ${this.selectedFiles.size}`);
                break;
            case 'error':
                const errorFilePath = checkbox.dataset.filepath;
                if (checkbox.checked) {
                    this.selectedErrors.add(errorFilePath);
                } else {
                    this.selectedErrors.delete(errorFilePath);
                }
                safeConsoleLog(`Error files selected: ${this.selectedErrors.size}`);
                break;
            case 'similar':
                const pairKey = checkbox.dataset.pair;
                if (checkbox.checked) {
                    this.selectedSimilarPairs.add(pairKey);
                } else {
                    this.selectedSimilarPairs.delete(pairKey);
                }
                safeConsoleLog(`Similar pairs selected: ${this.selectedSimilarPairs.size}`);
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
        safeConsoleLog(`Removing ${filePaths.length} rows from table. Current tab: ${this.currentTab}`);
        safeConsoleLog(`File paths to remove:`, filePaths);
        
        // 削除されたファイルをスキャン結果からも削除
        switch (this.currentTab) {
            case 'blur':
                // ブレ画像から削除
                this.scanResults.blurImages = this.scanResults.blurImages.filter(image => 
                    !filePaths.includes(image.filePath)
                );
                safeConsoleLog(`Removed files from blur results. Remaining: ${this.scanResults.blurImages.length}`);
                break;
                
            case 'error':
                // エラーから削除
                this.scanResults.errors = this.scanResults.errors.filter(error => 
                    !filePaths.includes(error.filePath)
                );
                safeConsoleLog(`Removed files from error results. Remaining: ${this.scanResults.errors.length}`);
                break;
                
            case 'similar':
                // 類似画像から削除（ペアの両方のファイルが含まれるペアを削除）
                this.scanResults.similarImages = this.scanResults.similarImages.filter(group => {
                    const file1Path = group.files[0].filePath;
                    const file2Path = group.files[1].filePath;
                    return !filePaths.includes(file1Path) && !filePaths.includes(file2Path);
                });
                safeConsoleLog(`Removed files from similar results. Remaining: ${this.scanResults.similarImages.length}`);
                break;
        }
        
        // 現在のタブのコンテンツエリアを確認
        const currentContent = document.getElementById(`content${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        safeConsoleLog(`Current content element:`, currentContent);
        
        if (currentContent) {
            const tables = currentContent.querySelectorAll('table');
            safeConsoleLog(`Found ${tables.length} tables in current content`);
            tables.forEach((table, index) => {
                const rows = table.querySelectorAll('tr');
                safeConsoleLog(`Table ${index} has ${rows.length} rows`);
            });
        }
        
        // 削除済みの行を追跡するSet
        const removedRows = new Set();
        
        // 現在のタブに応じた処理
        switch (this.currentTab) {
            case 'blur':
            case 'error':
                // ブレ画像とエラータブの場合
                filePaths.forEach(filePath => {
                    safeConsoleLog(`Looking for file: ${filePath}`);
                    
                    // チェックボックスのdata-filepath属性を基準に行を探す
                    const checkboxes = document.querySelectorAll(`[data-filepath="${filePath}"]`);
                    safeConsoleLog(`Found ${checkboxes.length} checkboxes for file: ${filePath}`);
                    
                    checkboxes.forEach((checkbox, index) => {
                        const row = checkbox.closest('tr');
                        safeConsoleLog(`Checkbox ${index} closest tr:`, row);
                        
                        if (row && !removedRows.has(row)) {
                            safeConsoleLog(`Removing row for file: ${filePath}`);
                            row.remove();
                            removedRows.add(row);
                        } else if (removedRows.has(row)) {
                            safeConsoleLog(`Row already removed for file: ${filePath}`);
                        } else {
                            safeConsoleLog(`Row not found for file: ${filePath}`);
                        }
                    });
                });
                break;
                
            case 'similar':
                // 類似画像タブの場合
                safeConsoleLog(`Selected similar pairs:`, Array.from(this.selectedSimilarPairs));
                
                this.selectedSimilarPairs.forEach(pairKey => {
                    safeConsoleLog(`Looking for similar pair: ${pairKey}`);
                    
                    const checkboxes = document.querySelectorAll(`[data-pair="${pairKey}"]`);
                    safeConsoleLog(`Found ${checkboxes.length} checkboxes for pair: ${pairKey}`);
                    
                    checkboxes.forEach((checkbox, index) => {
                        const row = checkbox.closest('tr');
                        safeConsoleLog(`Similar pair checkbox ${index} closest tr:`, row);
                        
                        if (row && !removedRows.has(row)) {
                            safeConsoleLog(`Removing similar pair row: ${pairKey}`);
                            row.remove();
                            removedRows.add(row);
                        } else if (removedRows.has(row)) {
                            safeConsoleLog(`Similar pair row already removed: ${pairKey}`);
                        } else {
                            safeConsoleLog(`Similar pair row not found: ${pairKey}`);
                        }
                    });
                });
                break;
        }
        
        // 選択状態をクリア
        this.selectedFiles.clear();
        this.selectedSimilarPairs.clear();
        this.selectedErrors.clear();
        this.updateSelectedCount();
        this.updateActionButtons();
        
        safeConsoleLog(`Table rows removal completed. Removed ${removedRows.size} rows.`);
        
        // タブのカウント表示を更新
        this.updateTabCounts();
        
        // DOM操作が失敗した場合のフォールバック：テーブル全体を再構築
        if (removedRows.size === 0 && filePaths.length > 0) {
            safeConsoleLog('DOM removal failed, rebuilding table...');
            this.rebuildCurrentTable();
        }
    }
    
    // 現在のタブのテーブルを再構築する関数
    rebuildCurrentTable() {
        safeConsoleLog(`Rebuilding table for tab: ${this.currentTab}`);
        
        switch (this.currentTab) {
            case 'blur':
                this.displayBlurResults(this.scanResults.blurImages);
                break;
            case 'similar':
                this.displaySimilarResults(this.scanResults.similarImages);
                break;
            case 'error':
                this.displayErrorResults(this.scanResults.errors);
                break;
        }
        
        safeConsoleLog('Table rebuild completed');
    }
    
    // タブのカウント表示を更新する関数を追加
    updateTabCounts() {
        const countBlur = document.getElementById('countBlur');
        const countSimilar = document.getElementById('countSimilar');
        const countError = document.getElementById('countError');
        
        if (countBlur) {
            countBlur.textContent = this.scanResults.blurImages.length;
        }
        if (countSimilar) {
            countSimilar.textContent = this.scanResults.similarImages.length;
        }
        if (countError) {
            countError.textContent = this.scanResults.errors.length;
        }
    }

    updateActionButtons() {
        let count = 0;
        
        switch (this.currentTab) {
            case 'blur':
                count = this.selectedFiles.size;
                break;
            case 'similar':
                count = this.selectedSimilarPairs.size + this.selectedIndividualFiles.size;
                break;
            case 'error':
                count = this.selectedErrors.size;
                break;
        }
        
        safeConsoleLog(`updateActionButtons: currentTab=${this.currentTab}, count=${count}`);
        
        // アクションボタンの有効/無効を切り替え
        const actionButtons = document.querySelectorAll('#copyBtn, #deleteBtn, #moveBtn');
        actionButtons.forEach(button => {
            if (count > 0) {
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
                button.classList.add('cursor-pointer');
                safeConsoleLog(`Button ${button.id} enabled`);
            } else {
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.classList.remove('cursor-pointer');
                safeConsoleLog(`Button ${button.id} disabled`);
            }
        });
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    safeConsoleLog('DOM content loaded');
    
    // グローバルエラーハンドラーを追加
    window.addEventListener('error', (event) => {
        // dragEventエラーを無視
        if (event.message && event.message.includes('dragEvent is not defined')) {
            event.preventDefault();
            return false;
        }
        // その他のエラーは通常通り処理
        safeConsoleError('Global error:', event.error);
    });
    
    window.imageCleanupApp = new ImageCleanupApp();
    
    // 設定マネージャーの初期化
    if (window.SettingsManager) {
        window.settingsManager = new window.SettingsManager();
        safeConsoleLog('Settings manager initialized');
    } else {
        safeConsoleError('SettingsManager class not found');
    }
});