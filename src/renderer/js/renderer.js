// 画像整理アプリ レンダラープロセスメインスクリプト

// パス操作のためのユーティリティ関数
function pathBasename(filePath) {
    return filePath.split(/[\\/]/).pop();
}

// エクスポート・レポートマネージャークラス
class ExportReportManager {
    constructor() {
        this.exportHistory = [];
        this.processingLog = [];
        this.exportSettings = {
            format: 'csv',
            includeMetadata: true,
            includeStatistics: true,
            includeProcessingHistory: true
        };
    }

    // エクスポート・レポートパネルの表示
    showExportReportPanel() {
        console.log('エクスポート・レポートパネルを表示');
        // 実装は後で追加
    }

    // 処理ログの表示
    showProcessingLog() {
        console.log('処理ログを表示');
        // 実装は後で追加
    }
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

        console.log(`バッチ処理開始: ${operation} - ${this.totalCount}件`);

        try {
            await this.processBatches();
        } catch (error) {
            console.error('バッチ処理エラー:', error);
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
            
            console.log(`バッチ処理中: ${batch.length}件 (残り: ${this.currentBatch.length}件)`);
            
            // バッチ内の各アイテムを処理
            for (const item of batch) {
                if (this.isPaused) break;
                
                try {
                    await this.processItem(item);
                    this.successCount++;
                } catch (error) {
                    console.error(`アイテム処理エラー:`, error);
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
            console.log(`バッチ処理完了: 成功${this.successCount}件, エラー${this.errorCount}件`);
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
        const outputFolder = await window.electronAPI.getOutputFolder();
        if (!outputFolder) {
            throw new Error('出力フォルダが設定されていません');
        }
        
        const filename = item.filename || item.filePath.split(/[\\/]/).pop();
        return `${outputFolder}/${filename}`;
    }

    // 処理の一時停止
    pause() {
        this.isPaused = true;
        console.log('バッチ処理を一時停止しました');
    }

    // 処理の再開
    resume() {
        if (this.isProcessing && this.isPaused) {
            this.isPaused = false;
            console.log('バッチ処理を再開しました');
            this.processBatches();
        }
    }

    // 処理の停止
    stop() {
        this.isProcessing = false;
        this.isPaused = false;
        this.currentBatch = [];
        console.log('バッチ処理を停止しました');
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
        this.outputFolder = null;
        this.scanInProgress = false;
        this.scanResults = {
            blurImages: [],
            similarImages: [],
            errors: []
        };
        this.selectedFiles = new Set();
        this.selectedSimilarPairs = new Set();
        this.selectedErrors = new Set();
        this.currentTab = 'blur';
        this.filterSettings = {
            blurMinScore: 0,
            blurMaxScore: 100,
            similarMinScore: 0,
            similarMaxScore: 100,
            showOnlySelected: false
        };
        this.batchProcessor = new BatchProcessor();
        
        // エクスポート・レポートマネージャー
        this.exportReportManager = new ExportReportManager();
        
        this.init();
    }

    init() {
        console.log('ImageCleanupApp初期化開始');
        
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
        
        console.log('ImageCleanupApp初期化完了');
    }

    getSettings() {
        return window.settingsManager ? window.settingsManager.getSettings() : null;
    }

    // 基本的なイベントリスナーの初期化
    initializeEventListeners() {
        // フォルダ選択ボタン
        document.getElementById('targetFolder')?.addEventListener('click', () => this.selectTargetFolder());
        document.getElementById('outputFolder')?.addEventListener('click', () => this.selectOutputFolder());
        
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
        document.getElementById('trashBtn')?.addEventListener('click', () => {
            console.log('ゴミ箱ボタンがクリックされました');
            this.moveToTrash();
        });
        document.getElementById('deleteBtn')?.addEventListener('click', () => {
            console.log('削除ボタンがクリックされました');
            this.deletePermanently();
        });
        document.getElementById('moveBtn')?.addEventListener('click', () => {
            console.log('移動ボタンがクリックされました');
            this.moveFiles();
        });
        
        // エクスポート・レポート関連のイベントリスナー
        document.getElementById('showExportReport')?.addEventListener('click', () => {
            this.exportReportManager.showExportReportPanel();
        });
        
        document.getElementById('showProcessingLog')?.addEventListener('click', () => {
            this.exportReportManager.showProcessingLog();
        });
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
            console.error('フォルダ選択エラー:', error);
            this.showError('フォルダの選択に失敗しました');
        }
    }

    async selectOutputFolder() {
        try {
            const folderPath = await window.electronAPI.selectOutputFolder();
            if (folderPath) {
                this.outputFolder = folderPath;
                document.getElementById('outputFolderPathDisplay').textContent = this.getDisplayPath(folderPath);
                document.getElementById('outputFolderPathDisplay').title = this.outputFolder;
                this.updateUI();
            }
        } catch (error) {
            console.error('移動先フォルダ選択エラー:', error);
            this.showError('移動先フォルダの選択に失敗しました');
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
            console.error('スキャン開始エラー:', error);
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
            
            console.log('スキャンをキャンセルしました');
        } catch (error) {
            console.error('スキャンキャンセルエラー:', error);
        }
    }

    updateScanProgress(progress) {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = `スキャン中... ${progress.current}/${progress.total} (${Math.round(progress.progress)}%)`;
        }
    }

    handleScanComplete(results) {
        console.log('スキャン完了:', results);
        
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
        this.displayBlurResults(results.blurImages || []);
        this.displaySimilarResults(results.similarImages || []);
        this.displayErrorResults(results.errors || []);
        
        this.showSuccess(`スキャン完了: ブレ画像${results.blurImages?.length || 0}件, 類似画像${results.similarImages?.length || 0}件, エラー${results.errors?.length || 0}件`);
    }

    handleScanError(error) {
        console.error('スキャンエラー:', error);
        
        this.scanInProgress = false;
        this.updateScanButton();
        
        // 進捗メッセージを非表示
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.style.display = 'none';
        }
        
        this.showError(`スキャンエラー: ${error.message}`);
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
        
        if (this.outputFolder) {
            document.getElementById('outputFolderPathDisplay').textContent = this.getDisplayPath(this.outputFolder);
            document.getElementById('outputFolderPathDisplay').title = this.outputFolder;
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
        const container = document.getElementById('contentBlur');
        if (!container) return;
        
        if (blurImages.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 py-8">ブレ画像は見つかりませんでした</div>';
            return;
        }
        
        const table = this.createBlurTable(blurImages);
        container.innerHTML = '';
        container.appendChild(table);
    }

    displaySimilarResults(similarImages) {
        const container = document.getElementById('contentSimilar');
        if (!container) return;
        
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
            console.error('ファイル操作エラー:', error);
            this.showError(`操作に失敗しました: ${error.message}`);
        }
    }

    async selectMoveDestination() {
        try {
            const folderPath = await window.electronAPI.selectOutputFolder();
            return folderPath;
        } catch (error) {
            console.error('移動先フォルダ選択エラー:', error);
            this.showError('移動先フォルダの選択に失敗しました');
            return null;
        }
    }

    // その他の必要なメソッド（簡略化）
    initializeFilterEvents() {
        // フィルター関連のイベントリスナー
        console.log('フィルターイベントを初期化');
    }

    initializeKeyboardShortcuts() {
        // キーボードショートカット
        console.log('キーボードショートカットを初期化');
    }

    initializeBatchEventListeners() {
        // バッチ処理イベントリスナー
        console.log('バッチ処理イベントを初期化');
    }

    initializeAdvancedFiltering() {
        // 高度なフィルタリング
        console.log('高度なフィルタリングを初期化');
    }

    updateFilterUI() {
        // フィルターUIの更新
        console.log('フィルターUIを更新');
    }

    showGuidanceIfNeeded() {
        // ガイダンスの表示
        console.log('ガイダンスを確認');
    }

    startPerformanceMonitoring() {
        // パフォーマンス監視
        console.log('パフォーマンス監視を開始');
    }

    startMemoryCleanup() {
        // メモリクリーンアップ
        console.log('メモリクリーンアップを開始');
    }

    // テーブル作成メソッド（簡略化）
    createBlurTable(blurImages) {
        const table = document.createElement('table');
        table.className = 'w-full';
        table.innerHTML = '<tr><th>ファイル名</th><th>ブレスコア</th><th>操作</th></tr>';
        return table;
    }

    createSimilarTable(similarImages) {
        const table = document.createElement('table');
        table.className = 'w-full';
        table.innerHTML = '<tr><th>類似画像ペア</th><th>類似度</th><th>操作</th></tr>';
        return table;
    }

    createErrorTable(errors) {
        const table = document.createElement('table');
        table.className = 'w-full';
        table.innerHTML = '<tr><th>エラー</th><th>詳細</th><th>操作</th></tr>';
        return table;
    }

    // 選択操作メソッド
    selectAll() {
        console.log('全選択');
    }

    deselectAll() {
        console.log('選択解除');
    }

    removeTableRows(filePaths) {
        console.log('テーブル行を削除');
    }

    updateActionButtons() {
        console.log('アクションボタンを更新');
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM読み込み完了');
    window.imageCleanupApp = new ImageCleanupApp();
}); 