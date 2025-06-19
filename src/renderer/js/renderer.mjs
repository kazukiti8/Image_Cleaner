// 画像整理アプリ レンダラープロセスメインスクリプト

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

class ImageCleanupApp {
    constructor() {
        this.currentTab = 'blur';
        this.selectedItems = new Set();
        this.scanInProgress = false;
        this.targetFolder = null;
        this.outputFolder = null;
        this.confirmResolve = null;
        this.currentResults = null;
        this.originalData = {
            blur: [],
            similar: [],
            error: []
        };
        this.filteredData = {
            blur: [],
            similar: [],
            error: []
        };
        this.currentFilters = {
            blur: { minScore: 0, maxScore: 100 },
            similar: { 
                minScore: 0, 
                maxScore: 100, 
                typeSimilar: true, 
                typeDuplicate: true, 
                recommendFile1: true, 
                recommendFile2: true, 
                recommendBoth: true, 
                minSize: 0, 
                maxSize: 1000 
            },
            error: { 
                fileNotFound: true, 
                permissionDenied: true, 
                corrupted: true, 
                unsupported: true 
            }
        };
        this.filters = {
            blur: { minScore: 0, maxScore: 100, minSize: 0, maxSize: 100 },
            similar: { similarityMin: 0, similarityMax: 100, type: '', minSize: 0, maxSize: 100 },
            error: { minSize: 0, maxSize: 100 }
        };
        this.settingsManager = null;
        
        // プレビュー機能用のプロパティ
        this.currentPreviewImage = null;
        this.zoomLevel = 100;
        this.previewImageElement = null;
        
        // ガイダンス機能用のプロパティ
        this.currentGuideStep = 1;
        this.totalGuideSteps = 4;
        this.guideShown = false;
        
        // 仮想スクロール用のプロパティ
        this.virtualScroll = {
            itemHeight: 60, // 1行の高さ（px）
            visibleItems: 20, // 一度に表示するアイテム数
            startIndex: 0,
            endIndex: 0,
            scrollTop: 0,
            containerHeight: 0,
            totalHeight: 0
        };
        
        // パフォーマンス最適化用のプロパティ
        this.performanceCache = {
            recommendations: new Map(), // 推奨判定のキャッシュ
            filteredResults: new Map(), // フィルタリング結果のキャッシュ
            lastFilterHash: '', // 最後のフィルター設定のハッシュ
            debounceTimer: null // デバウンス用タイマー
        };
        
        // 高度なフィルタリング用のプロパティ
        this.advancedFilters = {
            dateRange: { from: null, to: null },
            filenamePattern: { pattern: '', useRegex: false },
            sizeRange: { from: null, to: null },
            resolutionRange: { min: null, max: null },
            customCondition: '',
            sortBy: 'name',
            sortOrder: 'asc'
        };
        
        // バッチ処理マネージャー
        this.batchProcessor = new BatchProcessor();
        this.batchProcessor.progressCallback = (progress) => this.updateBatchProgress(progress);
        this.batchProcessor.completeCallback = (result) => this.onBatchComplete(result);
        this.batchProcessor.errorCallback = (error) => this.onBatchError(error);
        
        this.init();
    }

    init() {
        console.log('ImageCleanupApp初期化開始');
        
        // 設定マネージャーの初期化
        this.settingsManager = new SettingsManager();
        
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
        return this.settingsManager ? this.settingsManager.getSettings() : null;
    }

    initializeEventListeners() {
        // フォルダ選択ボタン
        document.getElementById('targetFolder').addEventListener('click', () => this.selectTargetFolder());
        document.getElementById('outputFolder').addEventListener('click', () => this.selectOutputFolder());
        
        // スキャンボタン
        document.getElementById('scanButton').addEventListener('click', () => this.startScan());
        
        // 設定ボタン（SettingsManagerで管理）
        // document.getElementById('settingsButton').addEventListener('click', () => this.openSettings());
        
        // フィルターヘルプボタン
        document.getElementById('filterHelp').addEventListener('click', () => this.showFilterHelp());
        
        // タブ切り替え
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // 選択操作ボタン
        document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAll());
        document.getElementById('deselectAllBtn').addEventListener('click', () => this.deselectAll());
        
        // ファイル操作ボタン
        document.getElementById('trashBtn').addEventListener('click', () => {
            console.log('ゴミ箱ボタンがクリックされました');
            this.moveToTrash();
        });
        document.getElementById('deleteBtn').addEventListener('click', () => {
            console.log('削除ボタンがクリックされました');
            this.deletePermanently();
        });
        document.getElementById('moveBtn').addEventListener('click', () => {
            console.log('移動ボタンがクリックされました');
            this.moveFiles();
        });
        
        // スキャン関連のイベントリスナー
        window.electronAPI.onScanProgress((progress) => this.updateScanProgress(progress));
        window.electronAPI.onScanComplete((results) => this.handleScanComplete(results));
        window.electronAPI.onScanError((error) => this.handleScanError(error));
        
        // ファイル操作関連のイベントリスナー
        window.electronAPI.onFileOperationProgress((progress) => this.updateFileOperationProgress(progress));
        window.electronAPI.onFileOperationComplete((result) => {
            console.log('ファイル操作完了イベントを受信:', result);
            this.handleFileOperationComplete(result, result.operation);
        });
        
        // モーダル関連
        this.initializeModalListeners();
        
        // 倍率調整
        this.initializeZoomControls();
        
        // キーボードショートカット
        this.initializeKeyboardShortcuts();
        
        // プレビュー機能の初期化
        this.initializePreviewFeatures();
        
        // フィルター関連のイベントリスナー
        this.initializeFilterEvents();
        
        // ガイダンス関連のイベントリスナー
        this.initializeGuideEvents();

        // エラータブ用アクションボタン
        document.getElementById('ignoreErrorBtn')?.addEventListener('click', () => this.ignoreSelectedErrors());
        document.getElementById('retryErrorBtn')?.addEventListener('click', () => this.retrySelectedErrors());
        document.getElementById('exportErrorLogBtn')?.addEventListener('click', () => this.exportErrorLog());
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
        } catch (error) {
            console.error('スキャンキャンセルエラー:', error);
        }
    }

    updateScanProgress(progress) {
        const button = document.getElementById('scanButton');
        const progressText = document.getElementById('progressText');
        
        if (button) {
            button.textContent = `スキャン中... ${progress.percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `分析中: ${progress.filename} (${progress.current}/${progress.total})`;
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
        this.originalData.blur = results.blurImages || [];
        this.originalData.similar = results.similarImages || [];
        this.originalData.error = results.errors || [];
        
        // フィルタリングを実行
        this.performFiltering();
        
        // フィルタリング結果を表示
        this.displayFilteredResults();
        
        // 成功メッセージを表示
        const totalCount = (results.blurImages?.length || 0) + (results.similarImages?.length || 0) + (results.errors?.length || 0);
        this.showSuccess(`スキャン完了: ブレ ${results.blurImages?.length || 0}件, 類似 ${results.similarImages?.length || 0}件, エラー ${results.errors?.length || 0}件`);
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

    // 基本的なメソッド
    switchTab(tabName) {
        console.log('タブ切り替え:', tabName);
        
        // 現在のタブを更新
        this.currentTab = tabName;
        
        // タブボタンの状態を更新
        document.querySelectorAll('.tab-button').forEach(button => {
            if (button.dataset.tab === tabName) {
                button.classList.add('tab-active');
            } else {
                button.classList.remove('tab-active');
            }
        });
        
        // タブコンテンツの表示/非表示を切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const targetContent = document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        if (targetContent) {
            targetContent.style.display = 'block';
        }
        
        // フィルターコンテンツの表示/非表示を切り替え
        this.updateFilterContent();
        
        // アクションボタンの表示/非表示を切り替え
        this.updateActionButtons();
        
        // 選択状態をクリア
        this.selectedItems.clear();
        this.updateSelectedCount();
        
        // プレビューエリアをリセット
        this.resetPreviewArea();
        
        // 倍率調整UIの表示/非表示を切り替え
        const zoomControls = document.getElementById('zoomControls');
        if (zoomControls) {
            if (tabName === 'similar') {
                zoomControls.style.display = 'none';
            } else {
                zoomControls.style.display = 'block';
            }
        }
        
        // フィルタリング結果を表示
        this.displayFilteredResults();
        
        console.log('タブ切り替え完了:', tabName);
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
    }

    updateScanButton() {
        const button = document.getElementById('scanButton');
        if (this.scanInProgress) {
            button.textContent = 'スキャン停止';
            button.className = 'px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm transition-colors';
        } else {
            button.textContent = 'スキャン開始';
            button.className = 'px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm transition-colors';
        }
    }

    updateSelectedCount() {
        const count = this.selectedItems.size;
        const size = Array.from(this.selectedItems).reduce((total, filePath) => {
            const currentContent = document.getElementById(`content${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
            const row = currentContent.querySelector(`[data-file-path="${filePath}"]`);
            return total + (row ? parseFloat(row.dataset.size || 0) : 0);
        }, 0) / (1024 * 1024); // MBに変換
        
        document.getElementById('selectedCount').textContent = `${count}件`;
        document.getElementById('selectedSize').textContent = `${size.toFixed(1)} MB`;
        
        // ファイル操作ボタンの有効/無効を切り替え
        const hasSelection = count > 0;
        this.setOperationButtonsEnabled(hasSelection);
    }

    getDisplayPath(path) {
        if (!path) return '';
        const parts = path.split(/[\\/]/);
        if (parts.length <= 2) return path;
        
        // プラットフォームに応じたパスセパレータを使用
        const pathSeparator = navigator.platform.includes('Win') ? '\\' : '/';
        return `...${pathSeparator}${parts.slice(-2).join(pathSeparator)}`;
    }

    // ユーティリティ関数
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP');
    }

    showError(message) {
        console.error(message);
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        console.log(message);
        this.showNotification(message, 'success');
    }

    // 通知メッセージの表示
    showNotification(message, type = 'info') {
        // 既存の通知を削除
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 通知要素を作成
        const notification = document.createElement('div');
        notification.className = `notification fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-md transform transition-all duration-300 translate-x-full`;
        
        // タイプに応じたスタイルを設定
        let bgColor = 'bg-blue-500';
        let textColor = 'text-white';
        let icon = 'ℹ️';
        
        switch (type) {
            case 'error':
                bgColor = 'bg-red-500';
                icon = '❌';
                break;
            case 'success':
                bgColor = 'bg-green-500';
                icon = '✅';
                break;
            case 'warning':
                bgColor = 'bg-yellow-500';
                icon = '⚠️';
                break;
        }
        
        notification.className += ` ${bgColor} ${textColor}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">${icon}</span>
                <span class="flex-1">${message}</span>
                <button class="ml-2 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // 通知を表示
        document.body.appendChild(notification);
        
        // アニメーション
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // 自動で非表示（5秒後）
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('translate-x-full');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // 結果表示メソッド
    displayBlurResults(blurImages) {
        const container = document.getElementById('contentBlur');
        const countElement = document.getElementById('countBlur');
        
        countElement.textContent = blurImages.length;
        
        if (blurImages.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 py-8">ブレ画像が見つかりませんでした</div>';
            return;
        }
        
        const table = this.createBlurTable(blurImages);
        container.innerHTML = '';
        container.appendChild(table);
    }

    displaySimilarResults(similarImages) {
        const container = document.getElementById('contentSimilar');
        const countElement = document.getElementById('countSimilar');
        
        countElement.textContent = similarImages.length;
        
        if (similarImages.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 py-8">類似画像が見つかりませんでした</div>';
            return;
        }
        
        const table = this.createSimilarTable(similarImages);
        container.innerHTML = '';
        container.appendChild(table);
    }

    displayErrorResults(errors) {
        const container = document.getElementById('contentError');
        const countElement = document.getElementById('countError');
        
        countElement.textContent = errors.length;
        
        if (errors.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 py-8">エラーはありませんでした</div>';
            return;
        }
        
        const table = this.createErrorTable(errors);
        container.innerHTML = '';
        container.appendChild(table);
    }

    clearResults() {
        // 結果をクリア
        document.getElementById('countBlur').textContent = '0';
        document.getElementById('countSimilar').textContent = '0';
        document.getElementById('countError').textContent = '0';
        
        document.getElementById('contentBlur').innerHTML = '<div class="text-center text-slate-500 py-8">スキャンを開始してください</div>';
        document.getElementById('contentSimilar').innerHTML = '<div class="text-center text-slate-500 py-8">スキャンを開始してください</div>';
        document.getElementById('contentError').innerHTML = '<div class="text-center text-slate-500 py-8">スキャンを開始してください</div>';
        
        // 進捗メッセージを非表示
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.style.display = 'none';
        }
    }

    // テーブル作成メソッド
    createBlurTable(blurImages) {
        const table = document.createElement('table');
        table.className = 'w-full text-sm border-collapse';
        
        // ヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-50 border-b border-slate-200">
                <th class="p-2 text-left">
                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                </th>
                <th class="p-2 text-left">ファイル名</th>
                <th class="p-2 text-left">サイズ</th>
                <th class="p-2 text-left">日時</th>
                <th class="p-2 text-left">ブレスコア</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // ボディ
        const tbody = document.createElement('tbody');
        blurImages.forEach(image => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-100 hover:bg-slate-50 cursor-pointer';
            row.dataset.filePath = image.filePath;
            row.dataset.size = image.size;
            row.dataset.modifiedDate = image.modifiedDate;
            row.dataset.blurScore = image.blurScore;
            
            row.innerHTML = `
                <td class="p-2">
                    <input type="checkbox" value="${image.filePath}" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                </td>
                <td class="p-2 font-medium text-slate-800">${image.filename}</td>
                <td class="p-2 text-slate-600">${this.formatFileSize(image.size)}</td>
                <td class="p-2 text-slate-600">${this.formatDate(image.modifiedDate)}</td>
                <td class="p-2">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${image.blurScore > 80 ? 'bg-red-100 text-red-800' : image.blurScore > 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'}">
                        ${image.blurScore}
                    </span>
                </td>
            </tr>`;
            
            // 行クリック時のプレビュー表示（チェックボックス以外をクリックした場合）
            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    this.showImagePreview(image);
                }
            });
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // イベントリスナーを設定
        this.setupCheckboxListeners(table);
        
        return table;
    }

    createSimilarTable(similarImages) {
        const table = document.createElement('table');
        table.className = 'w-full text-sm border-collapse';
        
        // ヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-50 border-b border-slate-200">
                <th class="p-2 text-left">
                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500" title="全ペア選択">
                </th>
                <th class="p-2 text-left">
                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500" title="全ファイル1選択">
                </th>
                <th class="p-2 text-left">ファイル1</th>
                <th class="p-2 text-left hidden md:table-cell">サイズ1</th>
                <th class="p-2 text-left hidden lg:table-cell">解像度1</th>
                <th class="p-2 text-left">
                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500" title="全ファイル2選択">
                </th>
                <th class="p-2 text-left">ファイル2</th>
                <th class="p-2 text-left hidden md:table-cell">サイズ2</th>
                <th class="p-2 text-left hidden lg:table-cell">解像度2</th>
                <th class="p-2 text-left">類似度</th>
                <th class="p-2 text-left">タイプ</th>
                <th class="p-2 text-left">推奨</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // ボディ
        const tbody = document.createElement('tbody');
        similarImages.forEach((pair, index) => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-100 hover:bg-slate-50 cursor-pointer';
            
            // 新しいデータ構造に対応
            if (!pair.files || pair.files.length < 2) {
                return; // このアイテムをスキップ
            }
            
            const file1 = pair.files[0];
            const file2 = pair.files[1];
            const similarity = pair.similarity || 0;
            const type = pair.type || 'similar';
            
            // 推奨判定（ファイルサイズ、解像度などを考慮）
            const recommendation = this.getSimilarImageRecommendation(file1, file2);
            
            // タイプに応じた表示色を決定
            let typeColor = 'bg-blue-100 text-blue-800';
            let typeText = '類似';
            if (type === 'duplicate') {
                typeColor = 'bg-red-100 text-red-800';
                typeText = '重複';
            }
            
            // 類似度に応じた表示色を決定
            let similarityColor = 'bg-orange-100 text-orange-800';
            if (similarity >= 95) {
                similarityColor = 'bg-red-100 text-red-800';
            } else if (similarity >= 85) {
                similarityColor = 'bg-yellow-100 text-yellow-800';
            }
            
            // 推奨に応じた表示色を決定
            let recommendationColor = 'bg-green-100 text-green-800';
            let recommendationText = 'ファイル1';
            if (recommendation === 'file2') {
                recommendationColor = 'bg-purple-100 text-purple-800';
                recommendationText = 'ファイル2';
            } else if (recommendation === 'both') {
                recommendationColor = 'bg-gray-100 text-gray-800';
                recommendationText = '両方';
            }
            
            row.innerHTML = `
                <td class="p-2">
                    <input type="checkbox" value="pair_${index}" class="pair-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-pair-index="${index}">
                </td>
                <td class="p-2">
                    <input type="checkbox" value="${file1.filePath}" class="file1-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-pair-index="${index}">
                </td>
                <td class="p-2 font-medium text-slate-800">${file1.filename}</td>
                <td class="p-2 text-slate-600 hidden md:table-cell">${this.formatFileSize(file1.size)}</td>
                <td class="p-2 text-slate-600 hidden lg:table-cell">${file1.resolution || 'N/A'}</td>
                <td class="p-2">
                    <input type="checkbox" value="${file2.filePath}" class="file2-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-pair-index="${index}">
                </td>
                <td class="p-2 font-medium text-slate-800">${file2.filename}</td>
                <td class="p-2 text-slate-600 hidden md:table-cell">${this.formatFileSize(file2.size)}</td>
                <td class="p-2 text-slate-600 hidden lg:table-cell">${file2.resolution || 'N/A'}</td>
                <td class="p-2">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${similarityColor}">
                        ${similarity}%
                    </span>
                </td>
                <td class="p-2">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${typeColor}">
                        ${typeText}
                    </span>
                </td>
                <td class="p-2">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${recommendationColor}" title="推奨: ${recommendationText}">
                        ${recommendationText}
                    </span>
                </td>
            </tr>`;
            
            // 行クリック時のプレビュー表示（チェックボックス以外をクリックした場合）
            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    this.showSimilarImagePreview(pair);
                }
            });
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // イベントリスナーを設定
        this.setupSimilarCheckboxListeners(table);
        
        return table;
    }

    // 類似画像の推奨判定
    getSimilarImageRecommendation(file1, file2) {
        // ファイルサイズを比較
        const size1 = file1.size || 0;
        const size2 = file2.size || 0;
        
        // 解像度を比較（幅x高さの形式を想定）
        const resolution1 = this.parseResolution(file1.resolution);
        const resolution2 = this.parseResolution(file2.resolution);
        
        let score1 = 0;
        let score2 = 0;
        
        // ファイルサイズのスコア（大きい方が良い）
        if (size1 > size2) score1 += 2;
        else if (size2 > size1) score2 += 2;
        
        // 解像度のスコア（高い方が良い）
        if (resolution1 && resolution2) {
            const pixels1 = resolution1.width * resolution1.height;
            const pixels2 = resolution2.width * resolution2.height;
            if (pixels1 > pixels2) score1 += 3;
            else if (pixels2 > pixels1) score2 += 3;
        }
        
        // ファイル名のスコア（より詳細な名前の方が良い）
        const name1 = file1.filename.toLowerCase();
        const name2 = file2.filename.toLowerCase();
        if (name1.includes('copy') || name1.includes('duplicate')) score1 -= 1;
        if (name2.includes('copy') || name2.includes('duplicate')) score2 -= 1;
        
        // 結果を返す
        if (score1 > score2) return 'file1';
        else if (score2 > score1) return 'file2';
        else return 'both'; // 同点の場合は両方
    }

    // 解像度文字列をパース
    parseResolution(resolutionStr) {
        if (!resolutionStr) return null;
        const match = resolutionStr.match(/(\d+)x(\d+)/);
        if (match) {
            return {
                width: parseInt(match[1]),
                height: parseInt(match[2])
            };
        }
        return null;
    }

    // 類似画像用のチェックボックスリスナー
    setupSimilarCheckboxListeners(table) {
        // ヘッダーのチェックボックス
        const headerCheckboxes = table.querySelectorAll('thead input[type="checkbox"]');
        const pairCheckboxes = table.querySelectorAll('tbody .pair-checkbox');
        const file1Checkboxes = table.querySelectorAll('tbody .file1-checkbox');
        const file2Checkboxes = table.querySelectorAll('tbody .file2-checkbox');
        
        // 全ペア選択
        headerCheckboxes[0].addEventListener('change', (e) => {
            pairCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                this.updateSimilarSelection(checkbox.value, e.target.checked);
            });
        });
        
        // 全ファイル1選択
        headerCheckboxes[1].addEventListener('change', (e) => {
            file1Checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                this.updateSelection(checkbox.value, e.target.checked);
            });
        });
        
        // 全ファイル2選択
        headerCheckboxes[2].addEventListener('change', (e) => {
            file2Checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                this.updateSelection(checkbox.value, e.target.checked);
            });
        });
        
        // ペア選択チェックボックス
        pairCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const pairIndex = e.target.dataset.pairIndex;
                const file1Checkbox = table.querySelector(`.file1-checkbox[data-pair-index="${pairIndex}"]`);
                const file2Checkbox = table.querySelector(`.file2-checkbox[data-pair-index="${pairIndex}"]`);
                
                if (e.target.checked) {
                    file1Checkbox.checked = true;
                    file2Checkbox.checked = true;
                    this.updateSelection(file1Checkbox.value, true);
                    this.updateSelection(file2Checkbox.value, true);
                } else {
                    file1Checkbox.checked = false;
                    file2Checkbox.checked = false;
                    this.updateSelection(file1Checkbox.value, false);
                    this.updateSelection(file2Checkbox.value, false);
                }
            });
        });
        
        // 個別ファイル選択チェックボックス
        [...file1Checkboxes, ...file2Checkboxes].forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateSelection(e.target.value, e.target.checked);
            });
            
            // チェックボックスのクリックイベントが行クリックイベントに伝播しないようにする
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    // 類似画像選択の更新
    updateSimilarSelection(pairValue, selected) {
        // ペア選択の場合は個別ファイルの選択状態も更新
        if (selected) {
            this.selectedItems.add(pairValue);
        } else {
            this.selectedItems.delete(pairValue);
        }
        this.updateSelectedCount();
    }

    createErrorTable(errors) {
        const table = document.createElement('table');
        table.className = 'w-full text-sm border-collapse';
        
        // ヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-50 border-b border-slate-200">
                <th class="p-2 text-left">
                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                </th>
                <th class="p-2 text-left">ファイル名</th>
                <th class="p-2 text-left">エラー</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // ボディ
        const tbody = document.createElement('tbody');
        errors.forEach(error => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-100 hover:bg-slate-50 cursor-pointer';
            row.dataset.filePath = error.filePath;
            
            row.innerHTML = `
                <td class="p-2">
                    <input type="checkbox" value="${error.filePath}" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                </td>
                <td class="p-2 font-medium text-slate-800">${error.filename}</td>
                <td class="p-2 text-red-600">${error.error}</td>
            </tr>`;
            
            // 行クリック時のプレビュー表示（チェックボックス以外をクリックした場合）
            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    this.showImagePreview(error);
                }
            });
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // イベントリスナーを設定
        this.setupCheckboxListeners(table);
        
        return table;
    }

    setupCheckboxListeners(table) {
        // ヘッダーのチェックボックス
        const headerCheckbox = table.querySelector('thead input[type="checkbox"]');
        const rowCheckboxes = table.querySelectorAll('tbody input[type="checkbox"]');
        
        headerCheckbox.addEventListener('change', (e) => {
            rowCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                this.updateSelection(checkbox.value, e.target.checked);
            });
        });
        
        // 各行のチェックボックス
        rowCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateSelection(e.target.value, e.target.checked);
            });
            
            // チェックボックスのクリックイベントが行クリックイベントに伝播しないようにする
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    updateSelection(filePath, selected) {
        if (selected) {
            this.selectedItems.add(filePath);
        } else {
            this.selectedItems.delete(filePath);
        }
        this.updateSelectedCount();
    }

    selectAll() {
        const currentContent = document.getElementById(`content${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        const checkboxes = currentContent.querySelectorAll('input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.updateSelection(checkbox.value, true);
        });
    }

    deselectAll() {
        const currentContent = document.getElementById(`content${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        const checkboxes = currentContent.querySelectorAll('input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            this.updateSelection(checkbox.value, false);
        });
    }

    // その他の必要なメソッド
    initializeModalListeners() {
        // モーダル関連の初期化
    }

    initializeZoomControls() {
        // 倍率調整の初期化
    }

    // キーボードショートカットの最適化
    initializeKeyboardShortcuts() {
        // デバウンス処理付きのキーボードイベント
        let lastKeyTime = 0;
        const keyDebounceTime = 100; // 100ms
        
        document.addEventListener('keydown', (e) => {
            const currentTime = Date.now();
            if (currentTime - lastKeyTime < keyDebounceTime) {
                return; // デバウンス
            }
            lastKeyTime = currentTime;
            
            // Ctrl/Cmd + キーの組み合わせ
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'a':
                        e.preventDefault();
                        this.selectAllItems();
                        break;
                    case 'd':
                        e.preventDefault();
                        this.deselectAllItems();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.focusFilterInput();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.resetFilters();
                        break;
                    case '1':
                    case '2':
                    case '3':
                        e.preventDefault();
                        const tabIndex = parseInt(e.key) - 1;
                        this.switchToTab(['blur', 'similar', 'error'][tabIndex]);
                        break;
                }
            }
            
            // 単独キー
            switch (e.key) {
                case 'Escape':
                    this.clearSelection();
                    break;
                case 'Delete':
                    if (this.selectedItems.size > 0) {
                        e.preventDefault();
                        this.deleteSelectedItems();
                    }
                    break;
                case 'Enter':
                    if (this.selectedItems.size === 1) {
                        e.preventDefault();
                        this.showPreviewForSelected();
                    }
                    break;
            }
        });
    }

    // 全選択（最適化版）
    selectAllItems() {
        const currentData = this.filteredData[this.currentTab];
        if (!currentData || currentData.length === 0) return;
        
        // バッチ処理で選択状態を更新
        const batchSize = 100;
        for (let i = 0; i < currentData.length; i += batchSize) {
            const batch = currentData.slice(i, i + batchSize);
            batch.forEach(item => {
                if (this.currentTab === 'similar' && item.files) {
                    // 類似画像の場合は両方のファイルを選択
                    item.files.forEach(file => {
                        this.selectedItems.add(file.filePath);
                    });
                } else {
                    this.selectedItems.add(item.filePath);
                }
            });
            
            // UI更新をバッチごとに実行
            if (i % (batchSize * 5) === 0) {
                this.updateSelectedCount();
            }
        }
        
        this.updateSelectedCount();
        this.updateCheckboxes();
    }

    // 全選択解除（最適化版）
    deselectAllItems() {
        this.selectedItems.clear();
        this.updateSelectedCount();
        this.updateCheckboxes();
    }

    // 選択解除
    clearSelection() {
        this.deselectAllItems();
        this.hidePreview();
    }

    // フィルター入力にフォーカス
    focusFilterInput() {
        const filterInput = document.querySelector('.filter-input');
        if (filterInput) {
            filterInput.focus();
        }
    }

    // 選択されたアイテムのプレビュー表示
    showPreviewForSelected() {
        const selectedArray = Array.from(this.selectedItems);
        if (selectedArray.length === 1) {
            const filePath = selectedArray[0];
            const currentData = this.filteredData[this.currentTab];
            const item = currentData.find(item => 
                item.filePath === filePath || 
                (item.files && item.files.some(f => f.filePath === filePath))
            );
            
            if (item) {
                if (this.currentTab === 'similar' && item.files) {
                    this.showSimilarImagePreview(item);
                } else {
                    this.showImagePreview(item);
                }
            }
        }
    }

    updateFilterContent() {
        // すべてのフィルターセクションを非表示
        document.querySelectorAll('.filter-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // 現在のタブに応じたフィルターセクションを表示
        switch (this.currentTab) {
            case 'blur':
                document.getElementById('blurFilter').classList.remove('hidden');
                break;
            case 'similar':
                document.getElementById('similarFilter').classList.remove('hidden');
                break;
            case 'error':
                document.getElementById('errorFilter').classList.remove('hidden');
                break;
        }
        
        // フィルター値をUIに反映
        this.updateFilterUI();
    }

    updateFilterUI() {
        // ブレ画像フィルター
        const blurMinScore = document.getElementById('blurMinScore');
        const blurMaxScore = document.getElementById('blurMaxScore');
        if (blurMinScore && blurMaxScore) {
            blurMinScore.value = this.currentFilters.blur.minScore;
            blurMaxScore.value = this.currentFilters.blur.maxScore;
        }
        
        // 類似画像フィルター
        const similarMinScore = document.getElementById('similarMinScore');
        const similarMaxScore = document.getElementById('similarMaxScore');
        const similarTypeSimilar = document.getElementById('similarTypeSimilar');
        const similarTypeDuplicate = document.getElementById('similarTypeDuplicate');
        const similarRecommendFile1 = document.getElementById('similarRecommendFile1');
        const similarRecommendFile2 = document.getElementById('similarRecommendFile2');
        const similarRecommendBoth = document.getElementById('similarRecommendBoth');
        const similarMinSize = document.getElementById('similarMinSize');
        const similarMaxSize = document.getElementById('similarMaxSize');
        
        if (similarMinScore && similarMaxScore) {
            similarMinScore.value = this.currentFilters.similar.minScore;
            similarMaxScore.value = this.currentFilters.similar.maxScore;
        }
        if (similarTypeSimilar) similarTypeSimilar.checked = this.currentFilters.similar.typeSimilar;
        if (similarTypeDuplicate) similarTypeDuplicate.checked = this.currentFilters.similar.typeDuplicate;
        if (similarRecommendFile1) similarRecommendFile1.checked = this.currentFilters.similar.recommendFile1;
        if (similarRecommendFile2) similarRecommendFile2.checked = this.currentFilters.similar.recommendFile2;
        if (similarRecommendBoth) similarRecommendBoth.checked = this.currentFilters.similar.recommendBoth;
        if (similarMinSize) similarMinSize.value = this.currentFilters.similar.minSize;
        if (similarMaxSize) similarMaxSize.value = this.currentFilters.similar.maxSize;
        
        // エラーフィルター
        const errorFileNotFound = document.getElementById('errorFileNotFound');
        const errorPermissionDenied = document.getElementById('errorPermissionDenied');
        const errorCorrupted = document.getElementById('errorCorrupted');
        const errorUnsupported = document.getElementById('errorUnsupported');
        
        if (errorFileNotFound) errorFileNotFound.checked = this.currentFilters.error.fileNotFound;
        if (errorPermissionDenied) errorPermissionDenied.checked = this.currentFilters.error.permissionDenied;
        if (errorCorrupted) errorCorrupted.checked = this.currentFilters.error.corrupted;
        if (errorUnsupported) errorUnsupported.checked = this.currentFilters.error.unsupported;
    }

    applyFilter() {
        console.log('フィルターを適用します');
        
        // 現在のフィルター値を取得
        this.updateCurrentFilters();
        
        // フィルタリングを実行
        this.performFiltering();
        
        // 結果を表示
        this.displayFilteredResults();
        
        this.showSuccess('フィルターを適用しました');
    }

    resetFilter() {
        // ブレ画像フィルターをリセット
        const blurMinScore = document.getElementById('blurMinScore');
        const blurMaxScore = document.getElementById('blurMaxScore');
        if (blurMinScore) blurMinScore.value = '0';
        if (blurMaxScore) blurMaxScore.value = '100';
        
        // 類似画像フィルターをリセット
        const similarMinScore = document.getElementById('similarMinScore');
        const similarMaxScore = document.getElementById('similarMaxScore');
        const similarTypeSimilar = document.getElementById('similarTypeSimilar');
        const similarTypeDuplicate = document.getElementById('similarTypeDuplicate');
        const similarRecommendFile1 = document.getElementById('similarRecommendFile1');
        const similarRecommendFile2 = document.getElementById('similarRecommendFile2');
        const similarRecommendBoth = document.getElementById('similarRecommendBoth');
        const similarMinSize = document.getElementById('similarMinSize');
        const similarMaxSize = document.getElementById('similarMaxSize');
        
        if (similarMinScore) similarMinScore.value = '0';
        if (similarMaxScore) similarMaxScore.value = '100';
        if (similarTypeSimilar) similarTypeSimilar.checked = true;
        if (similarTypeDuplicate) similarTypeDuplicate.checked = true;
        if (similarRecommendFile1) similarRecommendFile1.checked = true;
        if (similarRecommendFile2) similarRecommendFile2.checked = true;
        if (similarRecommendBoth) similarRecommendBoth.checked = true;
        if (similarMinSize) similarMinSize.value = '0';
        if (similarMaxSize) similarMaxSize.value = '1000';
        
        // エラーフィルターをリセット
        const errorFileNotFound = document.getElementById('errorFileNotFound');
        const errorPermissionDenied = document.getElementById('errorPermissionDenied');
        const errorCorrupted = document.getElementById('errorCorrupted');
        const errorUnsupported = document.getElementById('errorUnsupported');
        
        if (errorFileNotFound) errorFileNotFound.checked = true;
        if (errorPermissionDenied) errorPermissionDenied.checked = true;
        if (errorCorrupted) errorCorrupted.checked = true;
        if (errorUnsupported) errorUnsupported.checked = true;
        
        // フィルターを適用
        this.updateCurrentFilters();
        this.performFiltering();
        this.displayFilteredResults();
    }

    updateCurrentFilters() {
        // ブレ画像フィルター
        const blurMinScore = document.getElementById('blurMinScore');
        const blurMaxScore = document.getElementById('blurMaxScore');
        
        if (blurMinScore) this.currentFilters.blur.minScore = parseFloat(blurMinScore.value) || 0;
        if (blurMaxScore) this.currentFilters.blur.maxScore = parseFloat(blurMaxScore.value) || 100;
        
        // 類似画像フィルター
        const similarMinScore = document.getElementById('similarMinScore');
        const similarMaxScore = document.getElementById('similarMaxScore');
        const similarTypeSimilar = document.getElementById('similarTypeSimilar');
        const similarTypeDuplicate = document.getElementById('similarTypeDuplicate');
        const similarRecommendFile1 = document.getElementById('similarRecommendFile1');
        const similarRecommendFile2 = document.getElementById('similarRecommendFile2');
        const similarRecommendBoth = document.getElementById('similarRecommendBoth');
        const similarMinSize = document.getElementById('similarMinSize');
        const similarMaxSize = document.getElementById('similarMaxSize');
        
        if (similarMinScore) this.currentFilters.similar.minScore = parseFloat(similarMinScore.value) || 0;
        if (similarMaxScore) this.currentFilters.similar.maxScore = parseFloat(similarMaxScore.value) || 100;
        if (similarTypeSimilar) this.currentFilters.similar.typeSimilar = similarTypeSimilar.checked;
        if (similarTypeDuplicate) this.currentFilters.similar.typeDuplicate = similarTypeDuplicate.checked;
        if (similarRecommendFile1) this.currentFilters.similar.recommendFile1 = similarRecommendFile1.checked;
        if (similarRecommendFile2) this.currentFilters.similar.recommendFile2 = similarRecommendFile2.checked;
        if (similarRecommendBoth) this.currentFilters.similar.recommendBoth = similarRecommendBoth.checked;
        if (similarMinSize) this.currentFilters.similar.minSize = parseFloat(similarMinSize.value) || 0;
        if (similarMaxSize) this.currentFilters.similar.maxSize = parseFloat(similarMaxSize.value) || 1000;
        
        // エラーフィルター
        const errorFileNotFound = document.getElementById('errorFileNotFound');
        const errorPermissionDenied = document.getElementById('errorPermissionDenied');
        const errorCorrupted = document.getElementById('errorCorrupted');
        const errorUnsupported = document.getElementById('errorUnsupported');
        
        if (errorFileNotFound) this.currentFilters.error.fileNotFound = errorFileNotFound.checked;
        if (errorPermissionDenied) this.currentFilters.error.permissionDenied = errorPermissionDenied.checked;
        if (errorCorrupted) this.currentFilters.error.corrupted = errorCorrupted.checked;
        if (errorUnsupported) this.currentFilters.error.unsupported = errorUnsupported.checked;
    }

    updateErrorFilter() {
        // エラーフィルターのチェックボックスが変更された時の処理
        this.updateCurrentFilters();
        this.performFiltering();
        this.displayFilteredResults();
    }

    performFiltering() {
        // フィルター設定のハッシュを計算
        const filterHash = this.calculateFilterHash();
        
        // キャッシュされた結果があるかチェック
        if (this.performanceCache.filteredResults.has(filterHash)) {
            console.log('フィルタリング結果をキャッシュから取得');
            this.filteredData = this.performanceCache.filteredResults.get(filterHash);
            return;
        }
        
        console.log('フィルタリング処理を実行中...');
        const startTime = performance.now();
        
        // ブレ画像のフィルタリング
        this.filteredData.blur = this.originalData.blur.filter(item => {
            const score = parseFloat(item.blurScore) || 0;
            return score >= this.currentFilters.blur.minScore && 
                   score <= this.currentFilters.blur.maxScore;
        });
        
        // 類似画像のフィルタリング
        this.filteredData.similar = this.originalData.similar.filter(item => {
            const similarity = parseFloat(item.similarity) || 0;
            const type = item.type || 'similar';
            
            // 類似度フィルター
            if (similarity < this.currentFilters.similar.minScore || 
                similarity > this.currentFilters.similar.maxScore) {
                return false;
            }
            
            // タイプフィルター
            if (type === 'similar' && !this.currentFilters.similar.typeSimilar) {
                return false;
            }
            if (type === 'duplicate' && !this.currentFilters.similar.typeDuplicate) {
                return false;
            }
            
            // 推奨フィルター
            if (item.files && item.files.length >= 2) {
                const recommendation = this.getSimilarImageRecommendation(item.files[0], item.files[1]);
                if (recommendation === 'file1' && !this.currentFilters.similar.recommendFile1) {
                    return false;
                }
                if (recommendation === 'file2' && !this.currentFilters.similar.recommendFile2) {
                    return false;
                }
                if (recommendation === 'both' && !this.currentFilters.similar.recommendBoth) {
                    return false;
                }
                
                // ファイルサイズフィルター（両方のファイルのサイズをチェック）
                const file1SizeMB = (item.files[0].size || 0) / (1024 * 1024);
                const file2SizeMB = (item.files[1].size || 0) / (1024 * 1024);
                const maxSizeMB = Math.max(file1SizeMB, file2SizeMB);
                const minSizeMB = Math.min(file1SizeMB, file2SizeMB);
                
                if (maxSizeMB < this.currentFilters.similar.minSize || 
                    minSizeMB > this.currentFilters.similar.maxSize) {
                    return false;
                }
            }
            
            return true;
        });
        
        // エラーのフィルタリング
        this.filteredData.error = this.originalData.error.filter(item => {
            const errorType = item.errorType || 'unknown';
            switch (errorType) {
                case 'fileNotFound':
                    return this.currentFilters.error.fileNotFound;
                case 'permissionDenied':
                    return this.currentFilters.error.permissionDenied;
                case 'corrupted':
                    return this.currentFilters.error.corrupted;
                case 'unsupported':
                    return this.currentFilters.error.unsupported;
                default:
                    return true;
            }
        });
        
        // 結果をキャッシュに保存
        this.performanceCache.filteredResults.set(filterHash, {
            blur: [...this.filteredData.blur],
            similar: [...this.filteredData.similar],
            error: [...this.filteredData.error]
        });
        
        // キャッシュサイズを制限（最大100件）
        if (this.performanceCache.filteredResults.size > 100) {
            const firstKey = this.performanceCache.filteredResults.keys().next().value;
            this.performanceCache.filteredResults.delete(firstKey);
        }
        
        const endTime = performance.now();
        console.log(`フィルタリング完了: ${(endTime - startTime).toFixed(2)}ms`, {
            blur: this.filteredData.blur.length,
            similar: this.filteredData.similar.length,
            error: this.filteredData.error.length
        });
    }

    calculateFilterHash() {
        // フィルター設定を文字列化してハッシュを生成
        const filterString = JSON.stringify(this.currentFilters);
        let hash = 0;
        for (let i = 0; i < filterString.length; i++) {
            const char = filterString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit整数に変換
        }
        return hash.toString();
    }

    displayFilteredResults() {
        console.log('フィルタリング結果を表示中...');
        const startTime = performance.now();
        
        // 現在のタブのコンテナを取得
        const container = document.getElementById(`content${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        if (!container) {
            console.error('コンテナが見つかりません');
            return;
        }
        
        // コンテナをクリア
        container.innerHTML = '';
        
        // データ量に応じて仮想スクロールを使用するか決定
        const data = this.filteredData[this.currentTab];
        const useVirtualScroll = data.length > 100; // 100件以上で仮想スクロールを使用
        
        let table;
        if (useVirtualScroll) {
            console.log(`仮想スクロールを使用: ${data.length}件のデータ`);
            table = this.createVirtualScrollTable(data, this.currentTab);
        } else {
            console.log(`通常のテーブルを使用: ${data.length}件のデータ`);
            switch (this.currentTab) {
                case 'blur':
                    table = this.createBlurTable(data);
                    break;
                case 'similar':
                    table = this.createSimilarTable(data);
                    break;
                case 'error':
                    table = this.createErrorTable(data);
                    break;
            }
        }
        
        // テーブルをコンテナに追加
        if (table) {
            container.appendChild(table);
        }
        
        // カウントを更新
        this.updateFilterCounts();
        
        const endTime = performance.now();
        console.log(`表示完了: ${(endTime - startTime).toFixed(2)}ms`);
    }

    updateFilterCounts() {
        // 各タブのカウントを更新
        document.getElementById('countBlur').textContent = this.filteredData.blur.length;
        document.getElementById('countSimilar').textContent = this.filteredData.similar.length;
        document.getElementById('countError').textContent = this.filteredData.error.length;
    }

    showFilterHelp() {
        // フィルターヘルプの表示
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between p-6 border-b border-slate-200">
                    <h2 class="text-xl font-semibold text-slate-800">フィルターの使い方</h2>
                    <button class="text-slate-400 hover:text-slate-600" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="p-6 space-y-6">
                    <div>
                        <h3 class="text-lg font-medium text-slate-800 mb-3">ブレ画像フィルター</h3>
                        <div class="text-sm text-slate-600 space-y-2">
                            <p>• <strong>ブレスコア範囲</strong>: 0-100の範囲でブレの程度を指定</p>
                            <p>• 数値が高いほどブレが強い画像</p>
                            <p>• 例: 50-100で設定すると、中程度以上のブレ画像のみ表示</p>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-medium text-slate-800 mb-3">類似画像フィルター</h3>
                        <div class="text-sm text-slate-600 space-y-2">
                            <p>• <strong>類似度範囲</strong>: 0-100の範囲で類似度を指定</p>
                            <p>• 数値が高いほど類似度が高い</p>
                            <p>• 例: 80-100で設定すると、非常に類似度の高い画像のみ表示</p>
                            <p>• <strong>タイプ</strong>: 類似画像と重複画像を個別にフィルタリング</p>
                            <p>• <strong>推奨</strong>: 自動判定された推奨ファイル別にフィルタリング</p>
                            <p>• <strong>ファイルサイズ範囲</strong>: MB単位でファイルサイズを指定</p>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-medium text-slate-800 mb-3">エラーフィルター</h3>
                        <div class="text-sm text-slate-600 space-y-2">
                            <p>• <strong>エラーの種類</strong>: 表示したいエラーの種類をチェック</p>
                            <p>• ファイルが見つからない: 削除されたファイル</p>
                            <p>• アクセス権限エラー: 読み取り権限がないファイル</p>
                            <p>• 破損ファイル: 画像ファイルが破損している</p>
                            <p>• 未対応形式: サポートされていない画像形式</p>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-medium text-slate-800 mb-3">キーボードショートカット</h3>
                        <div class="text-sm text-slate-600 space-y-1">
                            <p>• <strong>Ctrl+F</strong>: フィルター適用</p>
                            <p>• <strong>Ctrl+R</strong>: フィルターリセット</p>
                            <p>• <strong>Ctrl+Shift+F</strong>: フィルターパネルにフォーカス</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // モーダル外クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // ESCキーで閉じる
        const closeModal = () => modal.remove();
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        }, { once: true });
    }

    openSettings() {
        // 設定画面を開く
        if (this.settingsManager) {
            this.settingsManager.showModal();
        } else {
            console.error('SettingsManagerが初期化されていません');
        }
    }

    moveToTrash() {
        console.log('moveToTrashメソッドが呼び出されました');
        this.performFileOperation('trash');
    }

    deletePermanently() {
        console.log('deletePermanentlyメソッドが呼び出されました');
        this.performFileOperation('delete');
    }

    moveFiles() {
        console.log('moveFilesメソッドが呼び出されました');
        this.performFileOperation('move');
    }

    // ファイル操作の共通処理
    async performFileOperation(operation) {
        console.log('performFileOperationが呼び出されました:', operation);
        const selectedFiles = Array.from(this.selectedItems);
        
        console.log('選択されたファイル数:', selectedFiles.length);
        console.log('選択されたファイル:', selectedFiles);
        
        if (selectedFiles.length === 0) {
            this.showError('操作するファイルが選択されていません');
            return;
        }

        // 操作確認
        const confirmed = await this.showOperationConfirmation(operation, selectedFiles.length);
        if (!confirmed) return;

        // 移動操作の場合は移動先フォルダを選択
        let destinationPath = null;
        if (operation === 'move') {
            destinationPath = await this.selectMoveDestination();
            if (!destinationPath) return;
        }

        // ファイル操作を実行
        await this.executeFileOperation(operation, selectedFiles, destinationPath);
    }

    // 操作確認ダイアログの表示
    async showOperationConfirmation(operation, fileCount) {
        const modal = document.getElementById('confirmModal');
        const title = document.getElementById('confirmTitle');
        const message = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        if (!modal || !title || !message || !okBtn || !cancelBtn) {
            return confirm(`${operation === 'trash' ? 'ゴミ箱へ移動' : operation === 'delete' ? '完全削除' : '移動'}しますか？`);
        }

        // 操作に応じたメッセージを設定
        let operationText = '';
        let buttonText = '';
        let buttonClass = '';

        switch (operation) {
            case 'trash':
                operationText = 'ゴミ箱へ移動';
                buttonText = '移動';
                buttonClass = 'bg-amber-600 hover:bg-amber-700';
                break;
            case 'delete':
                operationText = '完全に削除';
                buttonText = '削除';
                buttonClass = 'bg-red-600 hover:bg-red-700';
                break;
            case 'move':
                operationText = '移動';
                buttonText = '移動';
                buttonClass = 'bg-sky-600 hover:bg-sky-700';
                break;
        }

        title.textContent = `${operationText}の確認`;
        message.textContent = `選択された ${fileCount}件 のファイルを${operationText}します。この操作は取り消せません。`;
        
        okBtn.textContent = buttonText;
        okBtn.className = `px-4 py-2 text-sm ${buttonClass} text-white rounded-md transition-colors`;

        // モーダルを表示
        modal.classList.remove('hidden');

        // Promiseで結果を待つ
        return new Promise((resolve) => {
            const handleConfirm = () => {
                modal.classList.add('hidden');
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                modal.classList.add('hidden');
                cleanup();
                resolve(false);
            };

            const cleanup = () => {
                okBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
            };

            okBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
        });
    }

    // 移動先フォルダの選択
    async selectMoveDestination() {
        try {
            const destinationPath = await window.electronAPI.selectOutputFolder();
            if (!destinationPath) {
                this.showError('移動先フォルダが選択されませんでした');
                return null;
            }
            return destinationPath;
        } catch (error) {
            console.error('移動先フォルダ選択エラー:', error);
            this.showError('移動先フォルダの選択に失敗しました');
            return null;
        }
    }

    // ファイル操作の実行
    async executeFileOperation(operation, filePaths, destinationPath = null) {
        try {
            // 操作ボタンを無効化
            this.setOperationButtonsEnabled(false);
            
            // 進捗メッセージを表示
            this.showFileOperationProgress(operation, filePaths.length);

            let result;
            switch (operation) {
                case 'trash':
                case 'delete':
                    result = await window.electronAPI.deleteFiles(filePaths, operation === 'trash');
                    break;
                case 'move':
                    result = await window.electronAPI.moveFiles(filePaths, destinationPath);
                    break;
                default:
                    throw new Error(`不明な操作: ${operation}`);
            }

            // 操作完了の処理
            this.handleFileOperationComplete(result, operation);

        } catch (error) {
            console.error('ファイル操作エラー:', error);
            this.showError(`ファイル操作に失敗しました: ${error.message}`);
            this.hideFileOperationProgress();
            this.setOperationButtonsEnabled(true);
        }
    }

    // 操作ボタンの有効/無効切り替え
    setOperationButtonsEnabled(enabled) {
        const buttons = ['trashBtn', 'deleteBtn', 'moveBtn'];
        buttons.forEach(btnId => {
            const button = document.getElementById(btnId);
            if (button) {
                button.disabled = !enabled;
                button.style.opacity = enabled ? '1' : '0.5';
            }
        });
    }

    // ファイル操作進捗の表示
    showFileOperationProgress(operation, totalFiles) {
        const progressMessage = document.getElementById('fileOperationProgressMessage');
        const progressText = document.getElementById('fileOperationProgressText');
        
        if (progressMessage && progressText) {
            let operationText = '';
            switch (operation) {
                case 'trash': operationText = 'ゴミ箱へ移動中'; break;
                case 'delete': operationText = '削除中'; break;
                case 'move': operationText = '移動中'; break;
            }
            
            progressText.textContent = `${operationText} (0/${totalFiles})`;
            progressMessage.style.display = 'block';
        }
    }

    // ファイル操作進捗の更新
    updateFileOperationProgress(progress) {
        const progressText = document.getElementById('fileOperationProgressText');
        
        if (progressText) {
            let operationText = '';
            switch (progress.operation) {
                case 'trash': operationText = 'ゴミ箱へ移動中'; break;
                case 'delete': operationText = '削除中'; break;
                case 'move': operationText = '移動中'; break;
            }
            
            progressText.textContent = `${operationText} (${progress.current}/${progress.total}): ${progress.filename}`;
        }
    }

    // ファイル操作進捗の非表示
    hideFileOperationProgress() {
        const progressMessage = document.getElementById('fileOperationProgressMessage');
        if (progressMessage) {
            progressMessage.style.display = 'none';
        }
    }

    // ファイル操作完了の処理
    handleFileOperationComplete(result, operation) {
        console.log('ファイル操作完了:', result);
        console.log('操作タイプ:', operation);
        
        // 進捗メッセージを非表示
        this.hideFileOperationProgress();
        
        // 操作ボタンを有効化
        this.setOperationButtonsEnabled(true);
        
        // 結果に応じたメッセージを表示
        if (result.success || result.successCount > 0) {
            let operationText = '';
            switch (operation) {
                case 'trash': operationText = 'ゴミ箱へ移動'; break;
                case 'delete': operationText = '削除'; break;
                case 'move': operationText = '移動'; break;
            }
            
            this.showSuccess(`${operationText}が完了しました (${result.successCount}件)`);
            
            // 選択をクリア
            this.selectedItems.clear();
            this.updateSelectedCount();
            
            // 成功したファイルのパスを取得
            if (result.results && Array.isArray(result.results)) {
                const processedPaths = result.results
                    .filter(r => r.success)
                    .map(r => r.path);
                
                console.log('処理されたファイルパス:', processedPaths);
                
                if (processedPaths.length > 0) {
                    // originalDataから該当ファイルを削除
                    this.removeFromOriginalData(processedPaths);
                    
                    // テーブルから該当行を削除（バックアップ処理）
                    this.removeTableRows(processedPaths);
                }
            }
            
        } else {
            // エラーがある場合
            const errorCount = result.errorCount || 0;
            const partialSuccessCount = result.partialSuccessCount || 0;
            
            if (errorCount > 0) {
                this.showError(`${errorCount}件のファイルでエラーが発生しました`);
            }
            
            if (partialSuccessCount > 0) {
                this.showSuccess(`${partialSuccessCount}件のファイルは部分的な成功でした`);
            }
        }
    }

    // テーブルから行を削除
    removeTableRows(filePaths) {
        console.log('removeTableRowsが呼び出されました:', filePaths);
        
        const currentTab = this.currentTab;
        const container = document.getElementById(`content${currentTab.charAt(0).toUpperCase() + currentTab.slice(1)}`);
        
        console.log('現在のタブ:', currentTab);
        console.log('コンテナ要素:', container);
        
        if (!container) {
            console.log('コンテナが見つかりません');
            return;
        }
        
        let removedCount = 0;
        filePaths.forEach(filePath => {
            console.log('ファイルパスを検索中:', filePath);
            
            // 複数の方法で行を検索
            let row = container.querySelector(`[data-file-path="${filePath}"]`);
            
            // 見つからない場合は、ファイル名でも検索
            if (!row) {
                const fileName = filePath.split(/[\\/]/).pop();
                const rows = container.querySelectorAll('tbody tr');
                for (const r of rows) {
                    const rowFileName = r.querySelector('td:nth-child(2)')?.textContent?.trim();
                    if (rowFileName === fileName) {
                        row = r;
                        break;
                    }
                }
            }
            
            console.log('見つかった行:', row);
            
            if (row) {
                console.log('行を削除します:', filePath);
                row.remove();
                removedCount++;
            } else {
                console.log('行が見つかりませんでした:', filePath);
            }
        });
        
        console.log(`削除された行数: ${removedCount}`);
        
        // カウントを更新
        const countElement = document.getElementById(`count${currentTab.charAt(0).toUpperCase() + currentTab.slice(1)}`);
        if (countElement) {
            const remainingRows = container.querySelectorAll('tbody tr').length;
            console.log('残りの行数:', remainingRows);
            countElement.textContent = remainingRows;
        }
    }

    // プレビュー機能の初期化
    initializePreviewFeatures() {
        // プレビューエリアの初期化
        this.initializePreviewArea();
        
        // 倍率調整コントロールの初期化
        this.initializeZoomControls();
        
        // プレビューエリアの初期表示
        this.showPreviewPlaceholder();
    }

    // プレビューエリアの初期化
    initializePreviewArea() {
        const container = document.getElementById('previewAreaContainer');
        if (!container) return;
        
        // プレビューエリアをクリア
        container.innerHTML = '';
        
        // プレビュー用の画像要素を作成
        this.previewImageElement = document.createElement('img');
        this.previewImageElement.className = 'max-w-full max-h-full object-contain';
        this.previewImageElement.style.display = 'none';
        
        // プレビューエリアに画像要素を追加
        container.appendChild(this.previewImageElement);
        
        // プレビューエリアのクリックイベント（画像の拡大表示）
        container.addEventListener('click', () => {
            if (this.currentPreviewImage && this.previewImageElement.style.display !== 'none') {
                this.showFullScreenPreview();
            }
        });
    }

    // 倍率調整コントロールの初期化
    initializeZoomControls() {
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomInput = document.getElementById('zoomInput');
        const zoomValueDisplay = document.getElementById('zoomValueDisplay');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        
        if (!zoomSlider || !zoomInput || !zoomValueDisplay) return;
        
        // スライダーの変更イベント
        zoomSlider.addEventListener('input', (e) => {
            this.setZoomLevel(parseInt(e.target.value));
        });
        
        // 数値入力の変更イベント
        zoomInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value >= 1 && value <= 150) {
                this.setZoomLevel(value);
            }
        });
        
        // Enterキーでの確定
        zoomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= 150) {
                    this.setZoomLevel(value);
                }
            }
        });
        
        // 拡大ボタン
        zoomInBtn.addEventListener('click', () => {
            this.setZoomLevel(Math.min(this.zoomLevel + 10, 150));
        });
        
        // 縮小ボタン
        zoomOutBtn.addEventListener('click', () => {
            this.setZoomLevel(Math.max(this.zoomLevel - 10, 1));
        });
        
        // リセットボタン
        resetZoomBtn.addEventListener('click', () => {
            this.setZoomLevel(100);
        });
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.setZoomLevel(Math.min(this.zoomLevel + 10, 150));
                } else if (e.key === '-') {
                    e.preventDefault();
                    this.setZoomLevel(Math.max(this.zoomLevel - 10, 1));
                } else if (e.key === '0') {
                    e.preventDefault();
                    this.setZoomLevel(100);
                }
            }
        });
    }

    // 倍率の設定
    setZoomLevel(level) {
        this.zoomLevel = Math.max(1, Math.min(150, level));
        
        // UI要素を更新
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomInput = document.getElementById('zoomInput');
        const zoomValueDisplay = document.getElementById('zoomValueDisplay');
        
        if (zoomSlider) zoomSlider.value = this.zoomLevel;
        if (zoomInput) zoomInput.value = this.zoomLevel;
        if (zoomValueDisplay) zoomValueDisplay.textContent = this.zoomLevel;
        
        // プレビュー画像の倍率を更新
        if (this.previewImageElement && this.previewImageElement.style.display !== 'none') {
            this.previewImageElement.style.transform = `scale(${this.zoomLevel / 100})`;
            this.previewImageElement.style.transformOrigin = 'center center';
        }
    }

    // プレビュープレースホルダーの表示
    showPreviewPlaceholder() {
        const container = document.getElementById('previewAreaContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 mx-auto mb-2">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                <p>画像を選択して<br>プレビューを表示</p>
            </div>
        `;
        
        // プレビュー用の画像要素を再作成
        this.previewImageElement = document.createElement('img');
        this.previewImageElement.className = 'max-w-full max-h-full object-contain';
        this.previewImageElement.style.display = 'none';
        container.appendChild(this.previewImageElement);
    }

    // 画像のプレビュー表示
    async showImagePreview(imageData) {
        console.log('画像プレビュー表示:', imageData);
        
        if (!imageData || !imageData.filePath) {
            this.showPreviewPlaceholder();
            return;
        }
        
        this.currentPreviewImage = imageData;
        
        try {
            // プレビューエリアを取得
            const container = document.getElementById('previewAreaContainer');
            if (!container) return;
            
            // プレビュー用の画像要素を取得または作成
            if (!this.previewImageElement) {
                this.previewImageElement = document.createElement('img');
                this.previewImageElement.className = 'max-w-full max-h-full object-contain';
                container.appendChild(this.previewImageElement);
            }
            
            // 画像を読み込み
            this.previewImageElement.src = `file://${imageData.filePath}`;
            this.previewImageElement.style.display = 'block';
            
            // プレビューエリアのプレースホルダーを非表示
            const placeholder = container.querySelector('div');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            // 画像の読み込み完了時の処理
            this.previewImageElement.onload = () => {
                // 倍率を適用
                this.setZoomLevel(this.zoomLevel);
                
                // 画像情報を表示
                this.updateImageInfo(imageData);
            };
            
            // 画像の読み込みエラー時の処理
            this.previewImageElement.onerror = () => {
                console.error('画像の読み込みに失敗:', imageData.filePath);
                this.showPreviewError('画像の読み込みに失敗しました');
            };
            
        } catch (error) {
            console.error('プレビュー表示エラー:', error);
            this.showPreviewError('プレビューの表示に失敗しました');
        }
    }

    // プレビューエラーの表示
    showPreviewError(message) {
        const container = document.getElementById('previewAreaContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="text-center text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 mx-auto mb-2">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <p>${message}</p>
            </div>
        `;
    }

    // 画像情報の更新
    updateImageInfo(imageData) {
        // ファイル名
        const infoFileName = document.getElementById('infoFileName');
        if (infoFileName) {
            infoFileName.textContent = imageData.filename || '';
        }
        
        // ファイルパス
        const infoFilePath = document.getElementById('infoFilePath');
        if (infoFilePath) {
            infoFilePath.textContent = imageData.filePath || '';
            infoFilePath.title = imageData.filePath || '';
        }
        
        // ファイルサイズ
        const infoFileSize = document.getElementById('infoFileSize');
        if (infoFileSize) {
            infoFileSize.textContent = imageData.size ? this.formatFileSize(imageData.size) : '';
        }
        
        // 撮影日時
        const infoTakenDate = document.getElementById('infoTakenDate');
        if (infoTakenDate) {
            infoTakenDate.textContent = imageData.modifiedDate ? this.formatDate(imageData.modifiedDate) : '';
        }
        
        // 解像度（画像から取得）
        const infoResolution = document.getElementById('infoResolution');
        if (infoResolution && this.previewImageElement) {
            infoResolution.textContent = `${this.previewImageElement.naturalWidth} × ${this.previewImageElement.naturalHeight}`;
        }
        
        // ブレスコア（ブレ画像の場合）
        const infoBlurScoreContainer = document.getElementById('infoBlurScoreContainer');
        const infoBlurScore = document.getElementById('infoBlurScore');
        if (infoBlurScoreContainer && infoBlurScore) {
            if (imageData.blurScore !== undefined) {
                infoBlurScore.textContent = imageData.blurScore;
                infoBlurScoreContainer.style.display = 'block';
            } else {
                infoBlurScoreContainer.style.display = 'none';
            }
        }
    }

    // フルスクリーンプレビューの表示
    showFullScreenPreview() {
        if (!this.currentPreviewImage || !this.previewImageElement) return;
        
        // フルスクリーンモーダルを作成
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="relative max-w-full max-h-full p-4">
                <button class="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl font-bold z-10" onclick="this.parentElement.parentElement.remove()">×</button>
                <img src="${this.previewImageElement.src}" class="max-w-full max-h-full object-contain" style="transform: scale(${this.zoomLevel / 100}); transform-origin: center center;">
            </div>
        `;
        
        // モーダルを表示
        document.body.appendChild(modal);
        
        // ESCキーで閉じる
        const closeModal = () => modal.remove();
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        }, { once: true });
    }

    // 代替措置: 現在のタブを強制再描画
    refreshCurrentTab() {
        console.log('代替措置: 現在のタブを強制再描画します');
        const currentTab = this.currentTab;
        
        // originalDataから現在のタブのデータを再取得
        if (this.originalData && this.originalData[currentTab]) {
            console.log('originalDataから再描画:', this.originalData[currentTab].length, '件');
            
            // 現在のタブのコンテナを取得
            const container = document.getElementById(`content${currentTab.charAt(0).toUpperCase() + currentTab.slice(1)}`);
            if (!container) {
                console.log('コンテナが見つかりません');
                return;
            }
            
            // コンテナをクリア
            container.innerHTML = '';
            
            // 現在のタブのテーブルを再描画
            let table;
            switch (currentTab) {
                case 'blur':
                    table = this.createBlurTable(this.originalData.blur);
                    break;
                case 'similar':
                    table = this.createSimilarTable(this.originalData.similar);
                    break;
                case 'error':
                    table = this.createErrorTable(this.originalData.error);
                    break;
            }
            
            // テーブルをコンテナに追加
            if (table) {
                container.appendChild(table);
            }
            
            // カウントを更新
            this.updateFilterCounts();
            
            console.log('テーブル再描画完了');
        } else {
            console.log('originalDataが見つかりません');
        }
    }

    // originalDataから該当ファイルを削除
    removeFromOriginalData(paths) {
        console.log('originalDataから削除するファイル:', paths);
        
        if (!paths || !Array.isArray(paths)) {
            console.log('削除するファイルが無効です:', paths);
            return;
        }
        
        const currentTab = this.currentTab;
        if (this.originalData && this.originalData[currentTab]) {
            console.log('originalDataから削除前:', this.originalData[currentTab].length, '件');
            
            // 削除するファイルをoriginalDataから削除
            this.originalData[currentTab] = this.originalData[currentTab].filter(item => !paths.includes(item.filePath));
            
            console.log('originalDataから削除後:', this.originalData[currentTab].length, '件');
            
            // テーブルを再描画
            this.refreshCurrentTab();
        } else {
            console.log('originalDataが見つかりません');
        }
    }

    // フィルター関連のイベントリスナー
    initializeFilterEvents() {
        // フィルターボタン
        document.getElementById('applyFilter')?.addEventListener('click', () => {
            this.updateCurrentFilters();
            this.performFiltering();
            this.displayFilteredResults();
        });
        
        document.getElementById('resetFilter')?.addEventListener('click', () => {
            this.resetFilters();
        });
        
        // デバウンス処理付きのフィルター適用関数
        const debouncedFilter = this.debounce(() => {
            this.updateCurrentFilters();
            this.performFiltering();
            this.displayFilteredResults();
        }, 300);
        
        // ブレ画像フィルターの数値入力
        document.getElementById('blurMinScore')?.addEventListener('input', debouncedFilter);
        document.getElementById('blurMaxScore')?.addEventListener('input', debouncedFilter);
        
        // 類似画像フィルターの数値入力
        document.getElementById('similarMinScore')?.addEventListener('input', debouncedFilter);
        document.getElementById('similarMaxScore')?.addEventListener('input', debouncedFilter);
        document.getElementById('similarMinSize')?.addEventListener('input', debouncedFilter);
        document.getElementById('similarMaxSize')?.addEventListener('input', debouncedFilter);
        
        // 類似画像フィルターのチェックボックス
        document.getElementById('similarTypeSimilar')?.addEventListener('change', debouncedFilter);
        document.getElementById('similarTypeDuplicate')?.addEventListener('change', debouncedFilter);
        document.getElementById('similarRecommendFile1')?.addEventListener('change', debouncedFilter);
        document.getElementById('similarRecommendFile2')?.addEventListener('change', debouncedFilter);
        document.getElementById('similarRecommendBoth')?.addEventListener('change', debouncedFilter);
        
        // エラーフィルターのチェックボックス
        document.getElementById('errorFileNotFound')?.addEventListener('change', debouncedFilter);
        document.getElementById('errorPermissionDenied')?.addEventListener('change', debouncedFilter);
        document.getElementById('errorCorrupted')?.addEventListener('change', debouncedFilter);
        document.getElementById('errorUnsupported')?.addEventListener('change', debouncedFilter);
    }

    // デバウンス関数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 初回起動時ガイダンス関連のメソッド
    async checkFirstTimeGuide() {
        try {
            // 設定からガイダンス表示フラグを取得
            const settings = this.getSettings();
            if (settings && settings.showFirstTimeGuide === false) {
                console.log('ガイダンスは既に表示済みです');
                return;
            }
            
            // 初回起動時はガイダンスを表示
            setTimeout(() => {
                this.showGuide();
            }, 1000); // 1秒後に表示
            
        } catch (error) {
            console.error('ガイダンス確認エラー:', error);
        }
    }

    showGuide() {
        console.log('ガイダンスを表示します');
        this.guideShown = true;
        this.currentGuideStep = 1;
        
        const modal = document.getElementById('firstTimeGuideModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateGuideStep();
        }
    }

    hideGuide() {
        console.log('ガイダンスを非表示にします');
        this.guideShown = false;
        
        const modal = document.getElementById('firstTimeGuideModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        // 「次回から表示しない」の設定を保存
        this.saveGuideSettings();
    }

    updateGuideStep() {
        // すべてのステップを非表示
        for (let i = 1; i <= this.totalGuideSteps; i++) {
            const step = document.getElementById(`guideStep${i}`);
            if (step) {
                step.classList.add('hidden');
            }
        }
        
        // 完了メッセージも非表示
        const complete = document.getElementById('guideComplete');
        if (complete) {
            complete.classList.add('hidden');
        }
        
        // 現在のステップを表示
        if (this.currentGuideStep <= this.totalGuideSteps) {
            const currentStep = document.getElementById(`guideStep${this.currentGuideStep}`);
            if (currentStep) {
                currentStep.classList.remove('hidden');
            }
        } else {
            // 完了メッセージを表示
            if (complete) {
                complete.classList.remove('hidden');
            }
        }
        
        // ボタンの状態を更新
        this.updateGuideButtons();
    }

    updateGuideButtons() {
        const prevBtn = document.getElementById('prevGuideStep');
        const nextBtn = document.getElementById('nextGuideStep');
        const startBtn = document.getElementById('startGuide');
        
        if (prevBtn) {
            prevBtn.classList.toggle('hidden', this.currentGuideStep === 1);
        }
        
        if (nextBtn && startBtn) {
            if (this.currentGuideStep <= this.totalGuideSteps) {
                nextBtn.classList.remove('hidden');
                startBtn.classList.add('hidden');
            } else {
                nextBtn.classList.add('hidden');
                startBtn.classList.remove('hidden');
            }
        }
    }

    nextGuideStep() {
        if (this.currentGuideStep < this.totalGuideSteps + 1) {
            this.currentGuideStep++;
            this.updateGuideStep();
        }
    }

    prevGuideStep() {
        if (this.currentGuideStep > 1) {
            this.currentGuideStep--;
            this.updateGuideStep();
        }
    }

    skipGuide() {
        console.log('ガイダンスをスキップします');
        this.hideGuide();
    }

    completeGuide() {
        console.log('ガイダンスを完了します');
        this.hideGuide();
    }

    async saveGuideSettings() {
        try {
            const dontShowAgain = document.getElementById('dontShowGuideAgain');
            if (dontShowAgain && dontShowAgain.checked) {
                // 設定を更新
                const settings = this.getSettings();
                if (settings) {
                    settings.showFirstTimeGuide = false;
                    await this.settingsManager.saveSettings();
                    console.log('ガイダンス設定を保存しました');
                }
            }
        } catch (error) {
            console.error('ガイダンス設定の保存に失敗しました:', error);
        }
    }

    // ガイダンス関連のイベントリスナー
    initializeGuideEvents() {
        // ガイダンスボタン
        document.getElementById('nextGuideStep')?.addEventListener('click', () => this.nextGuideStep());
        document.getElementById('prevGuideStep')?.addEventListener('click', () => this.prevGuideStep());
        document.getElementById('skipGuide')?.addEventListener('click', () => this.skipGuide());
        document.getElementById('startGuide')?.addEventListener('click', () => this.completeGuide());
        document.getElementById('closeGuide')?.addEventListener('click', () => this.hideGuide());
        
        // モーダル外クリックで閉じる
        const modal = document.getElementById('firstTimeGuideModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideGuide();
                }
            });
        }
        
        // ESCキーで閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.guideShown) {
                this.hideGuide();
            }
        });
    }

    ignoreSelectedErrors() {
        console.log('選択されたエラーを無視します');
        if (this.currentTab !== 'error') return;
        const selected = Array.from(this.selectedItems);
        if (selected.length === 0) {
            this.showError('無視するエラーを選択してください');
            return;
        }
        // originalDataとfilteredDataから除外
        this.originalData.error = this.originalData.error.filter(item => !selected.includes(item.filePath));
        this.filteredData.error = this.filteredData.error.filter(item => !selected.includes(item.filePath));
        // 選択状態もクリア
        selected.forEach(fp => this.selectedItems.delete(fp));
        this.displayFilteredResults();
        this.showSuccess('選択したエラーをリストから非表示にしました');
    }

    async retrySelectedErrors() {
        console.log('選択されたエラーを再試行します');
        if (this.currentTab !== 'error') return;
        const selected = Array.from(this.selectedItems);
        if (selected.length === 0) {
            this.showError('再スキャンするエラーを選択してください');
            return;
        }
        try {
            this.showSuccess('再スキャンを開始します...');
            const result = await window.electronAPI.retryScanErrors(selected);
            if (result && result.success) {
                this.showSuccess('再スキャンが完了しました');
                // スキャン完了後のデータ更新はonScanCompleteで自動反映
            } else {
                this.showError('再スキャンに失敗しました');
            }
        } catch (error) {
            this.showError('再スキャン中にエラーが発生しました: ' + error.message);
        }
    }

    exportErrorLog() {
        console.log('エラーログをエクスポートします');
        const errors = this.filteredData.error;
        if (!errors || errors.length === 0) {
            this.showError('エクスポートするエラーがありません');
            return;
        }
        // CSV生成
        const header = 'ファイル名,パス,エラー内容\n';
        const rows = errors.map(e => `"${e.filename}","${e.filePath}","${e.error || ''}"`).join('\n');
        const csv = header + rows;
        // ダウンロードリンク生成
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'error_log.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        this.showSuccess('エラーログをエクスポートしました');
    }

    // 類似画像の比較プレビュー表示
    showSimilarImagePreview(pair) {
        if (!pair.files || pair.files.length < 2) {
            console.error('類似画像ペアのデータが不正です:', pair);
            return;
        }

        const file1 = pair.files[0];
        const file2 = pair.files[1];
        const similarity = pair.similarity || 0;
        const type = pair.type || 'similar';
        const recommendation = this.getSimilarImageRecommendation(file1, file2);

        // プレビューエリアをクリア
        const previewArea = document.getElementById('previewAreaContainer');
        if (!previewArea) return;

        // 類似画像用のレイアウトに変更
        previewArea.className = 'flex-grow bg-slate-100 rounded text-slate-500 text-sm min-h-[200px] sm:min-h-[300px] flex space-x-2 p-2';
        previewArea.innerHTML = '';

        // 左側の画像（ファイル1）
        const leftPane = document.createElement('div');
        leftPane.className = 'flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col';
        
        const leftImageContainer = document.createElement('div');
        leftImageContainer.className = 'flex-1 flex items-center justify-center p-2 bg-slate-50';
        
        const leftImage = document.createElement('img');
        leftImage.className = 'max-w-full max-h-full object-contain rounded';
        leftImage.alt = file1.filename;
        leftImage.onerror = () => {
            leftImageContainer.innerHTML = `
                <div class="text-center text-slate-400">
                    <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    <p class="text-xs">画像を読み込めません</p>
                </div>
            `;
        };
        
        // ファイルパスから画像を読み込み
        window.electronAPI.loadImage(file1.filePath).then(imageData => {
            leftImage.src = imageData;
        }).catch(error => {
            console.error('画像読み込みエラー:', error);
            leftImage.onerror();
        });
        
        leftImageContainer.appendChild(leftImage);
        leftPane.appendChild(leftImageContainer);

        // ファイル1の情報
        const leftInfo = document.createElement('div');
        leftInfo.className = 'p-2 border-t border-slate-200 bg-white';
        leftInfo.innerHTML = `
            <div class="text-xs space-y-1">
                <div class="font-medium text-slate-800">${file1.filename}</div>
                <div class="text-slate-600">サイズ: ${this.formatFileSize(file1.size)}</div>
                <div class="text-slate-600">解像度: ${file1.resolution || 'N/A'}</div>
                <div class="text-slate-600">更新日: ${this.formatDate(file1.modifiedDate)}</div>
            </div>
        `;
        leftPane.appendChild(leftInfo);

        // 右側の画像（ファイル2）
        const rightPane = document.createElement('div');
        rightPane.className = 'flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col';
        
        const rightImageContainer = document.createElement('div');
        rightImageContainer.className = 'flex-1 flex items-center justify-center p-2 bg-slate-50';
        
        const rightImage = document.createElement('img');
        rightImage.className = 'max-w-full max-h-full object-contain rounded';
        rightImage.alt = file2.filename;
        rightImage.onerror = () => {
            rightImageContainer.innerHTML = `
                <div class="text-center text-slate-400">
                    <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    <p class="text-xs">画像を読み込めません</p>
                </div>
            `;
        };
        
        // ファイルパスから画像を読み込み
        window.electronAPI.loadImage(file2.filePath).then(imageData => {
            rightImage.src = imageData;
        }).catch(error => {
            console.error('画像読み込みエラー:', error);
            rightImage.onerror();
        });
        
        rightImageContainer.appendChild(rightImage);
        rightPane.appendChild(rightImageContainer);

        // ファイル2の情報
        const rightInfo = document.createElement('div');
        rightInfo.className = 'p-2 border-t border-slate-200 bg-white';
        rightInfo.innerHTML = `
            <div class="text-xs space-y-1">
                <div class="font-medium text-slate-800">${file2.filename}</div>
                <div class="text-slate-600">サイズ: ${this.formatFileSize(file2.size)}</div>
                <div class="text-slate-600">解像度: ${file2.resolution || 'N/A'}</div>
                <div class="text-slate-600">更新日: ${this.formatDate(file2.modifiedDate)}</div>
            </div>
        `;
        rightPane.appendChild(rightInfo);

        // 中央の比較情報
        const centerPane = document.createElement('div');
        centerPane.className = 'w-16 flex flex-col items-center justify-center space-y-2';
        
        // 類似度表示
        const similarityBadge = document.createElement('div');
        similarityBadge.className = 'px-3 py-2 bg-blue-100 text-blue-800 rounded-lg text-center';
        similarityBadge.innerHTML = `
            <div class="text-lg font-bold">${similarity}%</div>
            <div class="text-xs">類似度</div>
        `;
        
        // タイプ表示
        const typeBadge = document.createElement('div');
        const typeColor = type === 'duplicate' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
        const typeText = type === 'duplicate' ? '重複' : '類似';
        typeBadge.className = `px-3 py-2 ${typeColor} rounded-lg text-center`;
        typeBadge.innerHTML = `
            <div class="text-sm font-bold">${typeText}</div>
        `;
        
        // 推奨表示
        const recommendationBadge = document.createElement('div');
        let recommendationColor = 'bg-green-100 text-green-800';
        let recommendationText = '推奨: ファイル1';
        if (recommendation === 'file2') {
            recommendationColor = 'bg-purple-100 text-purple-800';
            recommendationText = '推奨: ファイル2';
        } else if (recommendation === 'both') {
            recommendationColor = 'bg-gray-100 text-gray-800';
            recommendationText = '推奨: 両方';
        }
        recommendationBadge.className = `px-3 py-2 ${recommendationColor} rounded-lg text-center`;
        recommendationBadge.innerHTML = `
            <div class="text-xs font-bold">${recommendationText}</div>
        `;
        
        centerPane.appendChild(similarityBadge);
        centerPane.appendChild(typeBadge);
        centerPane.appendChild(recommendationBadge);

        // プレビューエリアに追加
        previewArea.appendChild(leftPane);
        previewArea.appendChild(centerPane);
        previewArea.appendChild(rightPane);

        // 画像情報エリアを更新
        this.updateImageInfoForSimilar(pair);
        
        // 倍率調整UIを非表示（類似画像比較時は不要）
        const zoomControls = document.getElementById('zoomControls');
        if (zoomControls) {
            zoomControls.style.display = 'none';
        }
    }

    // 類似画像用の画像情報更新
    updateImageInfoForSimilar(pair) {
        if (!pair.files || pair.files.length < 2) return;

        const file1 = pair.files[0];
        const file2 = pair.files[1];
        const similarity = pair.similarity || 0;
        const type = pair.type || 'similar';
        const recommendation = this.getSimilarImageRecommendation(file1, file2);

        // 画像情報エリアを更新
        const fileNameEl = document.getElementById('infoFileName');
        const filePathEl = document.getElementById('infoFilePath');
        const resolutionEl = document.getElementById('infoResolution');
        const fileSizeEl = document.getElementById('infoFileSize');
        const takenDateEl = document.getElementById('infoTakenDate');
        const blurScoreContainer = document.getElementById('infoBlurScoreContainer');

        if (fileNameEl) fileNameEl.textContent = `${file1.filename} / ${file2.filename}`;
        if (filePathEl) {
            filePathEl.textContent = `${this.getDisplayPath(file1.filePath)} / ${this.getDisplayPath(file2.filePath)}`;
            filePathEl.title = `${file1.filePath}\n${file2.filePath}`;
        }
        if (resolutionEl) resolutionEl.textContent = `${file1.resolution || 'N/A'} / ${file2.resolution || 'N/A'}`;
        if (fileSizeEl) fileSizeEl.textContent = `${this.formatFileSize(file1.size)} / ${this.formatFileSize(file2.size)}`;
        if (takenDateEl) takenDateEl.textContent = `${this.formatDate(file1.modifiedDate)} / ${this.formatDate(file2.modifiedDate)}`;
        
        // ブレスコア表示を非表示
        if (blurScoreContainer) blurScoreContainer.style.display = 'none';
    }

    // プレビューエリアをリセット
    resetPreviewArea() {
        const previewArea = document.getElementById('previewAreaContainer');
        if (!previewArea) return;

        // デフォルトのプレビューエリアに戻す
        previewArea.className = 'flex-grow bg-slate-100 rounded text-slate-500 text-sm min-h-[200px] sm:min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-300';
        previewArea.innerHTML = `
            <div class="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 mx-auto mb-2">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                <p>画像を選択して<br>プレビューを表示</p>
            </div>
        `;

        // 画像情報エリアをクリア
        const fileNameEl = document.getElementById('infoFileName');
        const filePathEl = document.getElementById('infoFilePath');
        const resolutionEl = document.getElementById('infoResolution');
        const fileSizeEl = document.getElementById('infoFileSize');
        const takenDateEl = document.getElementById('infoTakenDate');
        const blurScoreContainer = document.getElementById('infoBlurScoreContainer');

        if (fileNameEl) fileNameEl.textContent = '';
        if (filePathEl) {
            filePathEl.textContent = '';
            filePathEl.title = '';
        }
        if (resolutionEl) resolutionEl.textContent = '';
        if (fileSizeEl) fileSizeEl.textContent = '';
        if (takenDateEl) takenDateEl.textContent = '';
        if (blurScoreContainer) blurScoreContainer.style.display = 'none';
    }

    // アクションボタンの表示/非表示を切り替え
    updateActionButtons() {
        const normalActions = document.getElementById('normalActions');
        const errorActions = document.getElementById('errorActions');
        
        if (this.currentTab === 'error') {
            if (normalActions) normalActions.style.display = 'none';
            if (errorActions) errorActions.style.display = 'flex';
        } else {
            if (normalActions) normalActions.style.display = 'flex';
            if (errorActions) errorActions.style.display = 'none';
        }
    }

    createVirtualScrollTable(data, tableType) {
        const container = document.createElement('div');
        container.className = 'virtual-scroll-container';
        container.style.position = 'relative';
        container.style.height = '100%';
        container.style.overflow = 'auto';
        
        // スクロール可能なコンテンツエリア
        const scrollContent = document.createElement('div');
        scrollContent.className = 'virtual-scroll-content';
        scrollContent.style.position = 'relative';
        
        // 実際のコンテンツを表示するエリア
        const visibleContent = document.createElement('div');
        visibleContent.className = 'virtual-scroll-visible';
        visibleContent.style.position = 'absolute';
        visibleContent.style.top = '0';
        visibleContent.style.left = '0';
        visibleContent.style.right = '0';
        
        // ヘッダー
        const header = this.createTableHeader(tableType);
        header.style.position = 'sticky';
        header.style.top = '0';
        header.style.zIndex = '10';
        header.style.backgroundColor = 'white';
        
        container.appendChild(header);
        container.appendChild(scrollContent);
        scrollContent.appendChild(visibleContent);
        
        // 仮想スクロールの初期化
        this.initializeVirtualScroll(container, scrollContent, visibleContent, data, tableType);
        
        return container;
    }

    createTableHeader(tableType) {
        const thead = document.createElement('thead');
        thead.className = 'bg-slate-50 border-b border-slate-200';
        
        switch (tableType) {
            case 'blur':
                thead.innerHTML = `
                    <tr>
                        <th class="p-2 text-left">
                            <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                        </th>
                        <th class="p-2 text-left">ファイル名</th>
                        <th class="p-2 text-left">サイズ</th>
                        <th class="p-2 text-left">日時</th>
                        <th class="p-2 text-left">ブレスコア</th>
                    </tr>
                `;
                break;
            case 'similar':
                thead.innerHTML = `
                    <tr>
                        <th class="p-2 text-left">
                            <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500" title="全ペア選択">
                        </th>
                        <th class="p-2 text-left">
                            <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500" title="全ファイル1選択">
                        </th>
                        <th class="p-2 text-left">ファイル1</th>
                        <th class="p-2 text-left hidden md:table-cell">サイズ1</th>
                        <th class="p-2 text-left hidden lg:table-cell">解像度1</th>
                        <th class="p-2 text-left">
                            <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500" title="全ファイル2選択">
                        </th>
                        <th class="p-2 text-left">ファイル2</th>
                        <th class="p-2 text-left hidden md:table-cell">サイズ2</th>
                        <th class="p-2 text-left hidden lg:table-cell">解像度2</th>
                        <th class="p-2 text-left">類似度</th>
                        <th class="p-2 text-left">タイプ</th>
                        <th class="p-2 text-left">推奨</th>
                    </tr>
                `;
                break;
            case 'error':
                thead.innerHTML = `
                    <tr>
                        <th class="p-2 text-left">
                            <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                        </th>
                        <th class="p-2 text-left">ファイル名</th>
                        <th class="p-2 text-left">エラー</th>
                    </tr>
                `;
                break;
        }
        
        return thead;
    }

    initializeVirtualScroll(container, scrollContent, visibleContent, data, tableType) {
        const itemHeight = this.virtualScroll.itemHeight;
        const visibleItems = this.virtualScroll.visibleItems;
        const totalItems = data.length;
        
        // スクロールコンテンツの高さを設定
        scrollContent.style.height = `${totalItems * itemHeight}px`;
        
        // 初期表示
        this.updateVisibleItems(container, scrollContent, visibleContent, data, tableType, 0, Math.min(visibleItems, totalItems));
        
        // スクロールイベントリスナー
        container.addEventListener('scroll', (e) => {
            // デバウンス処理
            if (this.performanceCache.debounceTimer) {
                clearTimeout(this.performanceCache.debounceTimer);
            }
            
            this.performanceCache.debounceTimer = setTimeout(() => {
                const scrollTop = e.target.scrollTop;
                const startIndex = Math.floor(scrollTop / itemHeight);
                const endIndex = Math.min(startIndex + visibleItems + 5, totalItems); // バッファを追加
                
                this.updateVisibleItems(container, scrollContent, visibleContent, data, tableType, startIndex, endIndex);
            }, 16); // 約60fps
        });
    }

    updateVisibleItems(container, scrollContent, visibleContent, data, tableType, startIndex, endIndex) {
        const itemHeight = this.virtualScroll.itemHeight;
        
        // 表示位置を調整
        visibleContent.style.transform = `translateY(${startIndex * itemHeight}px)`;
        
        // 表示するアイテムのみを生成
        const visibleData = data.slice(startIndex, endIndex);
        const tbody = document.createElement('tbody');
        
        visibleData.forEach((item, index) => {
            const actualIndex = startIndex + index;
            const row = this.createTableRow(item, actualIndex, tableType);
            tbody.appendChild(row);
        });
        
        // 既存のコンテンツを置き換え
        visibleContent.innerHTML = '';
        visibleContent.appendChild(tbody);
    }

    createTableRow(item, index, tableType) {
        const row = document.createElement('tr');
        row.className = 'border-b border-slate-100 hover:bg-slate-50 cursor-pointer';
        row.style.height = `${this.virtualScroll.itemHeight}px`;
        
        switch (tableType) {
            case 'blur':
                return this.createBlurRow(item, index, row);
            case 'similar':
                return this.createSimilarRow(item, index, row);
            case 'error':
                return this.createErrorRow(item, index, row);
            default:
                return row;
        }
    }

    createBlurRow(image, index, row) {
        row.dataset.filePath = image.filePath;
        row.dataset.size = image.size;
        row.dataset.modifiedDate = image.modifiedDate;
        row.dataset.blurScore = image.blurScore;
        
        row.innerHTML = `
            <td class="p-2">
                <input type="checkbox" value="${image.filePath}" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
            </td>
            <td class="p-2 font-medium text-slate-800">${image.filename}</td>
            <td class="p-2 text-slate-600">${this.formatFileSize(image.size)}</td>
            <td class="p-2 text-slate-600">${this.formatDate(image.modifiedDate)}</td>
            <td class="p-2">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${image.blurScore > 80 ? 'bg-red-100 text-red-800' : image.blurScore > 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'}">
                    ${image.blurScore}
                </span>
            </td>
        `;
        
        // 行クリック時のプレビュー表示（チェックボックス以外をクリックした場合）
        row.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                this.showImagePreview(image);
            }
        });
        
        return row;
    }

    createSimilarRow(pair, index, row) {
        // 新しいデータ構造に対応
        if (!pair.files || pair.files.length < 2) {
            return row; // このアイテムをスキップ
        }
        
        const file1 = pair.files[0];
        const file2 = pair.files[1];
        const similarity = pair.similarity || 0;
        const type = pair.type || 'similar';
        
        // 推奨判定（キャッシュを使用）
        const cacheKey = `${file1.filePath}_${file2.filePath}`;
        let recommendation = this.performanceCache.recommendations.get(cacheKey);
        if (!recommendation) {
            recommendation = this.getSimilarImageRecommendation(file1, file2);
            this.performanceCache.recommendations.set(cacheKey, recommendation);
        }
        
        // タイプに応じた表示色を決定
        let typeColor = 'bg-blue-100 text-blue-800';
        let typeText = '類似';
        if (type === 'duplicate') {
            typeColor = 'bg-red-100 text-red-800';
            typeText = '重複';
        }
        
        // 類似度に応じた表示色を決定
        let similarityColor = 'bg-orange-100 text-orange-800';
        if (similarity >= 95) {
            similarityColor = 'bg-red-100 text-red-800';
        } else if (similarity >= 85) {
            similarityColor = 'bg-yellow-100 text-yellow-800';
        }
        
        // 推奨に応じた表示色を決定
        let recommendationColor = 'bg-green-100 text-green-800';
        let recommendationText = 'ファイル1';
        if (recommendation === 'file2') {
            recommendationColor = 'bg-purple-100 text-purple-800';
            recommendationText = 'ファイル2';
        } else if (recommendation === 'both') {
            recommendationColor = 'bg-gray-100 text-gray-800';
            recommendationText = '両方';
        }
        
        row.innerHTML = `
            <td class="p-2">
                <input type="checkbox" value="pair_${index}" class="pair-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-pair-index="${index}">
            </td>
            <td class="p-2">
                <input type="checkbox" value="${file1.filePath}" class="file1-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-pair-index="${index}">
            </td>
            <td class="p-2 font-medium text-slate-800">${file1.filename}</td>
            <td class="p-2 text-slate-600 hidden md:table-cell">${this.formatFileSize(file1.size)}</td>
            <td class="p-2 text-slate-600 hidden lg:table-cell">${file1.resolution || 'N/A'}</td>
            <td class="p-2">
                <input type="checkbox" value="${file2.filePath}" class="file2-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-pair-index="${index}">
            </td>
            <td class="p-2 font-medium text-slate-800">${file2.filename}</td>
            <td class="p-2 text-slate-600 hidden md:table-cell">${this.formatFileSize(file2.size)}</td>
            <td class="p-2 text-slate-600 hidden lg:table-cell">${file2.resolution || 'N/A'}</td>
            <td class="p-2">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${similarityColor}">
                    ${similarity}%
                </span>
            </td>
            <td class="p-2">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${typeColor}">
                    ${typeText}
                </span>
            </td>
            <td class="p-2">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${recommendationColor}" title="推奨: ${recommendationText}">
                    ${recommendationText}
                </span>
            </td>
        `;
        
        // 行クリック時のプレビュー表示（チェックボックス以外をクリックした場合）
        row.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                this.showSimilarImagePreview(pair);
            }
        });
        
        return row;
    }

    createErrorRow(error, index, row) {
        row.dataset.filePath = error.filePath;
        row.dataset.errorType = error.errorType;
        
        const errorTypeText = this.getErrorTypeText(error.errorType);
        const errorColor = this.getErrorTypeColor(error.errorType);
        
        row.innerHTML = `
            <td class="p-2">
                <input type="checkbox" value="${error.filePath}" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
            </td>
            <td class="p-2 font-medium text-slate-800">${error.filename}</td>
            <td class="p-2">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${errorColor}">
                    ${errorTypeText}
                </span>
            </td>
        `;
        
        return row;
    }

    // メモリ管理とクリーンアップ
    cleanupMemory() {
        console.log('メモリクリーンアップを実行中...');
        
        // 推奨判定キャッシュのクリーンアップ
        if (this.performanceCache.recommendations.size > 1000) {
            console.log('推奨判定キャッシュをクリーンアップ');
            this.performanceCache.recommendations.clear();
        }
        
        // フィルタリング結果キャッシュのクリーンアップ
        if (this.performanceCache.filteredResults.size > 50) {
            console.log('フィルタリング結果キャッシュをクリーンアップ');
            this.performanceCache.filteredResults.clear();
        }
        
        // プレビュー画像のクリーンアップ
        if (this.previewImageElement) {
            this.previewImageElement.src = '';
            this.previewImageElement = null;
        }
        
        // ガベージコレクションを促す
        if (window.gc) {
            window.gc();
        }
        
        console.log('メモリクリーンアップ完了');
    }

    // 定期的なメモリクリーンアップ
    startMemoryCleanup() {
        // 5分ごとにメモリクリーンアップを実行
        setInterval(() => {
            this.cleanupMemory();
        }, 5 * 60 * 1000);
    }

    // パフォーマンス監視
    startPerformanceMonitoring() {
        // メモリ使用量の監視
        if (performance.memory) {
            setInterval(() => {
                const memoryInfo = performance.memory;
                const usedMB = Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
                const totalMB = Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024);
                const limitMB = Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024);
                
                console.log(`メモリ使用量: ${usedMB}MB / ${totalMB}MB (上限: ${limitMB}MB)`);
                
                // メモリ使用量が80%を超えた場合、クリーンアップを実行
                if (usedMB / limitMB > 0.8) {
                    console.warn('メモリ使用量が高いため、クリーンアップを実行します');
                    this.cleanupMemory();
                }
            }, 30 * 1000); // 30秒ごと
        }
    }

    // パフォーマンス監視UIの制御
    initializePerformanceUI() {
        // メモリクリーンアップボタン
        document.getElementById('cleanupMemory')?.addEventListener('click', () => {
            this.cleanupMemory();
            this.updateMemoryUsageDisplay();
        });
        
        // FPS監視
        this.startFPSMonitoring();
        
        // メモリ使用量表示の更新
        this.updateMemoryUsageDisplay();
    }

    // FPS監視
    startFPSMonitoring() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const updateFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                document.getElementById('fpsCounter').textContent = fps;
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
    }

    // メモリ使用量表示の更新
    updateMemoryUsageDisplay() {
        if (performance.memory) {
            const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            const totalMB = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
            const limitMB = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
            
            document.getElementById('memoryUsage').textContent = usedMB;
            document.getElementById('memoryUsageText').textContent = `${usedMB} / ${totalMB} (上限: ${limitMB})`;
            
            // メモリ使用量に応じて表示を変更
            const memoryDisplay = document.getElementById('memoryUsageDisplay');
            const usageRatio = usedMB / limitMB;
            
            memoryDisplay.className = 'memory-usage';
            if (usageRatio > 0.8) {
                memoryDisplay.classList.add('danger');
            } else if (usageRatio > 0.6) {
                memoryDisplay.classList.add('warning');
            }
            
            memoryDisplay.style.display = 'block';
        }
    }

    // パフォーマンス監視の開始（更新版）
    startPerformanceMonitoring() {
        // メモリ使用量の監視
        if (performance.memory) {
            setInterval(() => {
                this.updateMemoryUsageDisplay();
                
                const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                const limitMB = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
                
                // メモリ使用量が80%を超えた場合、クリーンアップを実行
                if (usedMB / limitMB > 0.8) {
                    console.warn('メモリ使用量が高いため、クリーンアップを実行します');
                    this.cleanupMemory();
                }
            }, 30 * 1000); // 30秒ごと
        }
        
        // パフォーマンス監視UIの初期化
        this.initializePerformanceUI();
    }

    // バッチ処理の制御機能
    async startBatchDelete() {
        const selectedItems = Array.from(this.selectedItems);
        if (selectedItems.length === 0) {
            this.showNotification('エラー', '削除するファイルが選択されていません', 'error');
            return;
        }

        // 確認ダイアログの表示
        const confirmed = await this.showBatchConfirmDialog('削除', selectedItems.length);
        if (!confirmed) return;

        // バッチ処理の開始
        const items = this.getSelectedItemsData();
        await this.batchProcessor.startBatchOperation('delete', items, {
            batchSize: parseInt(document.getElementById('batchSize')?.value || '10'),
            delay: parseInt(document.getElementById('batchDelay')?.value || '100')
        });
    }

    async startBatchMove() {
        const selectedItems = Array.from(this.selectedItems);
        if (selectedItems.length === 0) {
            this.showNotification('エラー', '移動するファイルが選択されていません', 'error');
            return;
        }

        // 出力フォルダの確認
        if (!this.outputFolder) {
            this.showNotification('エラー', '出力フォルダが設定されていません', 'error');
            return;
        }

        // 確認ダイアログの表示
        const confirmed = await this.showBatchConfirmDialog('移動', selectedItems.length);
        if (!confirmed) return;

        // バッチ処理の開始
        const items = this.getSelectedItemsData();
        await this.batchProcessor.startBatchOperation('move', items, {
            batchSize: parseInt(document.getElementById('batchSize')?.value || '10'),
            delay: parseInt(document.getElementById('batchDelay')?.value || '100')
        });
    }

    async startBatchCopy() {
        const selectedItems = Array.from(this.selectedItems);
        if (selectedItems.length === 0) {
            this.showNotification('エラー', 'コピーするファイルが選択されていません', 'error');
            return;
        }

        // 出力フォルダの確認
        if (!this.outputFolder) {
            this.showNotification('エラー', '出力フォルダが設定されていません', 'error');
            return;
        }

        // 確認ダイアログの表示
        const confirmed = await this.showBatchConfirmDialog('コピー', selectedItems.length);
        if (!confirmed) return;

        // バッチ処理の開始
        const items = this.getSelectedItemsData();
        await this.batchProcessor.startBatchOperation('copy', items, {
            batchSize: parseInt(document.getElementById('batchSize')?.value || '10'),
            delay: parseInt(document.getElementById('batchDelay')?.value || '100')
        });
    }

    // バッチ処理確認ダイアログ
    async showBatchConfirmDialog(operation, count) {
        const confirmDialog = document.getElementById('batchConfirmDialog');
        const confirmText = document.getElementById('batchConfirmText');
        const confirmCount = document.getElementById('batchConfirmCount');
        
        confirmText.textContent = `${operation}操作`;
        confirmCount.textContent = `${count}件のファイル`;
        
        confirmDialog.classList.remove('hidden');
        
        return new Promise((resolve) => {
            document.getElementById('batchConfirmYes').onclick = () => {
                confirmDialog.classList.add('hidden');
                resolve(true);
            };
            
            document.getElementById('batchConfirmNo').onclick = () => {
                confirmDialog.classList.add('hidden');
                resolve(false);
            };
        });
    }

    // 選択されたアイテムのデータを取得
    getSelectedItemsData() {
        const items = [];
        const currentData = this.filteredData[this.currentTab];
        
        for (const filePath of this.selectedItems) {
            const item = currentData.find(item => 
                item.filePath === filePath || 
                (item.files && item.files.some(f => f.filePath === filePath))
            );
            
            if (item) {
                if (this.currentTab === 'similar' && item.files) {
                    // 類似画像の場合は両方のファイルを追加
                    items.push(...item.files);
                } else {
                    items.push(item);
                }
            }
        }
        
        return items;
    }

    // バッチ処理進捗の更新
    updateBatchProgress(progress) {
        const progressBar = document.getElementById('batchProgressBar');
        const progressText = document.getElementById('batchProgressText');
        const successCount = document.getElementById('batchSuccessCount');
        const errorCount = document.getElementById('batchErrorCount');
        const operationText = document.getElementById('batchOperationText');
        
        if (progressBar) progressBar.style.width = `${progress.progress}%`;
        if (progressText) progressText.textContent = `${progress.processed} / ${progress.total}`;
        if (successCount) successCount.textContent = `${progress.success}件`;
        if (errorCount) errorCount.textContent = `${progress.error}件`;
        
        const operationMap = {
            'delete': '削除中',
            'move': '移動中',
            'copy': 'コピー中'
        };
        if (operationText) operationText.textContent = operationMap[this.batchProcessor.currentOperation] || '処理中';
        
        // 進捗ダイアログを表示
        document.getElementById('batchProgressDialog').classList.remove('hidden');
    }

    // バッチ処理完了時の処理
    onBatchComplete(result) {
        console.log('バッチ処理完了:', result);
        
        // 進捗ダイアログを非表示
        document.getElementById('batchProgressDialog').classList.add('hidden');
        
        // 成功通知
        this.showNotification(
            'バッチ処理完了',
            `成功: ${result.success}件, エラー: ${result.error}件`,
            result.error > 0 ? 'warning' : 'success'
        );
        
        // 選択をクリア
        this.selectedItems.clear();
        this.updateSelectedCount();
        this.updateCheckboxes();
        
        // 結果を再読み込み
        this.refreshCurrentTab();
        
        // 履歴を更新
        this.updateBatchHistory();
    }

    // バッチ処理エラー時の処理
    onBatchError(error) {
        console.error('バッチ処理エラー:', error);
        
        // 進捗ダイアログを非表示
        document.getElementById('batchProgressDialog').classList.add('hidden');
        
        // エラー通知
        this.showNotification('バッチ処理エラー', error.message, 'error');
    }

    // バッチ処理履歴の更新
    updateBatchHistory() {
        const history = this.batchProcessor.getOperationHistory();
        const historyContent = document.getElementById('batchHistoryContent');
        
        if (!historyContent) return;
        
        historyContent.innerHTML = '';
        
        if (history.length === 0) {
            historyContent.innerHTML = '<p class="text-gray-500 text-center py-8">履歴がありません</p>';
            return;
        }
        
        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'batch-history-item error';
            historyItem.innerHTML = `
                <div class="batch-history-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                <div class="batch-history-operation">${item.item.filename}</div>
                <div class="batch-history-error">${item.error}</div>
            `;
            historyContent.appendChild(historyItem);
        });
    }

    // 通知表示
    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `batch-notification ${type}`;
        notification.innerHTML = `
            <div class="batch-notification-title">${title}</div>
            <div class="batch-notification-message">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // 表示アニメーション
        setTimeout(() => notification.classList.add('show'), 100);
        
        // 自動非表示
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // バッチ処理関連のイベントリスナー
    initializeBatchEventListeners() {
        // バッチ処理進捗ダイアログの制御
        document.getElementById('closeBatchProgress')?.addEventListener('click', () => {
            document.getElementById('batchProgressDialog').classList.add('hidden');
        });

        // バッチ処理の一時停止/再開/停止
        document.getElementById('pauseBatch')?.addEventListener('click', () => {
            this.batchProcessor.pause();
            document.getElementById('pauseBatch').classList.add('hidden');
            document.getElementById('resumeBatch').classList.remove('hidden');
        });

        document.getElementById('resumeBatch')?.addEventListener('click', () => {
            this.batchProcessor.resume();
            document.getElementById('resumeBatch').classList.add('hidden');
            document.getElementById('pauseBatch').classList.remove('hidden');
        });

        document.getElementById('stopBatch')?.addEventListener('click', () => {
            this.batchProcessor.stop();
            document.getElementById('batchProgressDialog').classList.add('hidden');
        });

        // バッチ処理設定ダイアログの制御
        document.getElementById('closeBatchSettings')?.addEventListener('click', () => {
            document.getElementById('batchSettingsDialog').classList.add('hidden');
        });

        document.getElementById('saveBatchSettings')?.addEventListener('click', () => {
            this.saveBatchSettings();
            document.getElementById('batchSettingsDialog').classList.add('hidden');
        });

        document.getElementById('cancelBatchSettings')?.addEventListener('click', () => {
            document.getElementById('batchSettingsDialog').classList.add('hidden');
        });

        // バッチ処理履歴ダイアログの制御
        document.getElementById('closeBatchHistory')?.addEventListener('click', () => {
            document.getElementById('batchHistoryDialog').classList.add('hidden');
        });

        document.getElementById('exportBatchHistory')?.addEventListener('click', () => {
            this.exportBatchHistory();
        });

        document.getElementById('clearBatchHistory')?.addEventListener('click', () => {
            this.clearBatchHistory();
        });

        // バッチ処理設定の表示
        document.getElementById('showBatchSettings')?.addEventListener('click', () => {
            this.showBatchSettings();
        });

        // バッチ処理履歴の表示
        document.getElementById('showBatchHistory')?.addEventListener('click', () => {
            this.showBatchHistory();
        });
    }

    // バッチ処理設定の保存
    saveBatchSettings() {
        const batchSize = document.getElementById('batchSize').value;
        const batchDelay = document.getElementById('batchDelay').value;
        const confirmDialog = document.querySelector('input[name="confirmDialog"]:checked').value;

        // 設定を保存
        this.settingsManager.setSetting('batchSize', parseInt(batchSize));
        this.settingsManager.setSetting('batchDelay', parseInt(batchDelay));
        this.settingsManager.setSetting('confirmDialog', confirmDialog);

        this.showNotification('設定保存', 'バッチ処理設定を保存しました', 'success');
    }

    // バッチ処理設定の表示
    showBatchSettings() {
        // 現在の設定を読み込み
        const batchSize = this.settingsManager.getSetting('batchSize', 10);
        const batchDelay = this.settingsManager.getSetting('batchDelay', 100);
        const confirmDialog = this.settingsManager.getSetting('confirmDialog', 'always');

        document.getElementById('batchSize').value = batchSize;
        document.getElementById('batchDelay').value = batchDelay;
        document.querySelector(`input[name="confirmDialog"][value="${confirmDialog}"]`).checked = true;

        document.getElementById('batchSettingsDialog').classList.remove('hidden');
    }

    // バッチ処理履歴の表示
    showBatchHistory() {
        this.updateBatchHistory();
        document.getElementById('batchHistoryDialog').classList.remove('hidden');
    }

    // バッチ処理履歴のエクスポート
    exportBatchHistory() {
        const history = this.batchProcessor.getOperationHistory();
        if (history.length === 0) {
            this.showNotification('エラー', 'エクスポートする履歴がありません', 'error');
            return;
        }

        const csvContent = this.convertHistoryToCSV(history);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `batch_history_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        this.showNotification('エクスポート完了', 'バッチ処理履歴をエクスポートしました', 'success');
    }

    // バッチ処理履歴のクリア
    clearBatchHistory() {
        this.batchProcessor.clearOperationHistory();
        this.updateBatchHistory();
        this.showNotification('履歴クリア', 'バッチ処理履歴をクリアしました', 'success');
    }

    // 履歴をCSVに変換
    convertHistoryToCSV(history) {
        const headers = ['タイムスタンプ', 'ファイル名', 'エラー内容'];
        const rows = history.map(item => [
            new Date(item.timestamp).toLocaleString(),
            item.item.filename,
            item.error
        ]);

        return [headers, ...rows].map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
    }

    // ファイル操作メソッド（バッチ処理対応）
    async deleteSelectedFiles() {
        if (this.selectedItems.size === 0) {
            this.showNotification('エラー', '削除するファイルが選択されていません', 'error');
            return;
        }

        // 単一ファイルの場合は従来の確認ダイアログ
        if (this.selectedItems.size === 1) {
            await this.deleteSingleFile();
            return;
        }

        // 複数ファイルの場合はバッチ処理
        await this.startBatchDelete();
    }

    async moveSelectedFiles() {
        if (this.selectedItems.size === 0) {
            this.showNotification('エラー', '移動するファイルが選択されていません', 'error');
            return;
        }

        if (!this.outputFolder) {
            this.showNotification('エラー', '出力フォルダが設定されていません', 'error');
            return;
        }

        // 単一ファイルの場合は従来の確認ダイアログ
        if (this.selectedItems.size === 1) {
            await this.moveSingleFile();
            return;
        }

        // 複数ファイルの場合はバッチ処理
        await this.startBatchMove();
    }

    async copySelectedFiles() {
        if (this.selectedItems.size === 0) {
            this.showNotification('エラー', 'コピーするファイルが選択されていません', 'error');
            return;
        }

        if (!this.outputFolder) {
            this.showNotification('エラー', '出力フォルダが設定されていません', 'error');
            return;
        }

        // 単一ファイルの場合は従来の確認ダイアログ
        if (this.selectedItems.size === 1) {
            await this.copySingleFile();
            return;
        }

        // 複数ファイルの場合はバッチ処理
        await this.startBatchCopy();
    }

    // 単一ファイル操作（従来の実装）
    async deleteSingleFile() {
        const filePath = Array.from(this.selectedItems)[0];
        const confirmed = await this.showConfirmDialog('削除', filePath);
        if (!confirmed) return;

        try {
            await window.electronAPI.deleteFile(filePath);
            this.showNotification('削除完了', 'ファイルを削除しました', 'success');
            this.selectedItems.clear();
            this.updateSelectedCount();
            this.refreshCurrentTab();
        } catch (error) {
            console.error('削除エラー:', error);
            this.showNotification('削除エラー', error.message, 'error');
        }
    }

    async moveSingleFile() {
        const filePath = Array.from(this.selectedItems)[0];
        const confirmed = await this.showConfirmDialog('移動', filePath);
        if (!confirmed) return;

        try {
            const filename = this.getFilenameFromPath(filePath);
            const destination = `${this.outputFolder}/${filename}`;
            await window.electronAPI.moveFile(filePath, destination);
            this.showNotification('移動完了', 'ファイルを移動しました', 'success');
            this.selectedItems.clear();
            this.updateSelectedCount();
            this.refreshCurrentTab();
        } catch (error) {
            console.error('移動エラー:', error);
            this.showNotification('移動エラー', error.message, 'error');
        }
    }

    async copySingleFile() {
        const filePath = Array.from(this.selectedItems)[0];
        const confirmed = await this.showConfirmDialog('コピー', filePath);
        if (!confirmed) return;

        try {
            const filename = this.getFilenameFromPath(filePath);
            const destination = `${this.outputFolder}/${filename}`;
            await window.electronAPI.copyFile(filePath, destination);
            this.showNotification('コピー完了', 'ファイルをコピーしました', 'success');
            this.selectedItems.clear();
            this.updateSelectedCount();
        } catch (error) {
            console.error('コピーエラー:', error);
            this.showNotification('コピーエラー', error.message, 'error');
        }
    }

    // 高度なフィルタリング機能
    initializeAdvancedFiltering() {
        // 高度なフィルタリングパネルの表示/非表示
        document.getElementById('showAdvancedFilter')?.addEventListener('click', () => {
            this.toggleAdvancedFilterPanel();
        });

        document.getElementById('closeAdvancedFilter')?.addEventListener('click', () => {
            this.hideAdvancedFilterPanel();
        });

        // フィルター適用ボタン
        document.getElementById('applyAdvancedFilter')?.addEventListener('click', () => {
            this.applyAdvancedFilter();
        });

        // フィルターリセットボタン
        document.getElementById('resetAdvancedFilter')?.addEventListener('click', () => {
            this.resetAdvancedFilter();
        });

        // プリセット関連のイベント
        document.getElementById('saveFilterPreset')?.addEventListener('click', () => {
            this.showPresetDialog('save');
        });

        document.getElementById('loadFilterPreset')?.addEventListener('click', () => {
            this.showPresetDialog('load');
        });

        // プリセットダイアログの制御
        this.initializePresetDialogEvents();

        // 高度なフィルター条件の変更監視
        this.initializeAdvancedFilterEvents();
    }

    // 高度なフィルタリングパネルの表示/非表示
    toggleAdvancedFilterPanel() {
        const panel = document.getElementById('advancedFilterPanel');
        if (panel.classList.contains('hidden')) {
            this.showAdvancedFilterPanel();
        } else {
            this.hideAdvancedFilterPanel();
        }
    }

    showAdvancedFilterPanel() {
        const panel = document.getElementById('advancedFilterPanel');
        panel.classList.remove('hidden');
        this.updateAdvancedFilterCount();
    }

    hideAdvancedFilterPanel() {
        const panel = document.getElementById('advancedFilterPanel');
        panel.classList.add('hidden');
    }

    // 高度なフィルター条件の変更監視
    initializeAdvancedFilterEvents() {
        const filterInputs = [
            'dateFrom', 'dateTo', 'filenamePattern', 'sizeFrom', 'sizeTo',
            'resolutionMin', 'resolutionMax', 'customCondition', 'sortBy'
        ];

        filterInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.updateAdvancedFilterCount();
                });
                element.addEventListener('input', () => {
                    this.updateAdvancedFilterCount();
                });
            }
        });

        // ラジオボタンとチェックボックス
        document.querySelectorAll('input[name="sortOrder"], #useRegex').forEach(element => {
            element.addEventListener('change', () => {
                this.updateAdvancedFilterCount();
            });
        });
    }

    // 高度なフィルター条件数の更新
    updateAdvancedFilterCount() {
        const conditions = this.getActiveAdvancedFilterConditions();
        const countElement = document.getElementById('advancedFilterCount');
        if (countElement) {
            countElement.textContent = conditions.length;
        }
    }

    // アクティブな高度なフィルター条件を取得
    getActiveAdvancedFilterConditions() {
        const conditions = [];

        // 日時範囲
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;
        if (dateFrom || dateTo) {
            conditions.push('日時範囲');
        }

        // ファイル名パターン
        const filenamePattern = document.getElementById('filenamePattern')?.value;
        if (filenamePattern) {
            conditions.push('ファイル名パターン');
        }

        // ファイルサイズ範囲
        const sizeFrom = document.getElementById('sizeFrom')?.value;
        const sizeTo = document.getElementById('sizeTo')?.value;
        if (sizeFrom || sizeTo) {
            conditions.push('ファイルサイズ範囲');
        }

        // 解像度範囲
        const resolutionMin = document.getElementById('resolutionMin')?.value;
        const resolutionMax = document.getElementById('resolutionMax')?.value;
        if (resolutionMin || resolutionMax) {
            conditions.push('解像度範囲');
        }

        // カスタム条件
        const customCondition = document.getElementById('customCondition')?.value;
        if (customCondition) {
            conditions.push('カスタム条件');
        }

        // ソート設定
        const sortBy = document.getElementById('sortBy')?.value;
        if (sortBy && sortBy !== 'name') {
            conditions.push('ソート設定');
        }

        return conditions;
    }

    // 高度なフィルターの適用
    applyAdvancedFilter() {
        console.log('高度なフィルターを適用中...');
        const startTime = performance.now();

        // 現在のフィルター設定を更新
        this.updateAdvancedFilterSettings();

        // フィルタリングを実行
        this.performAdvancedFiltering();

        // 結果を表示
        this.displayFilteredResults();

        const endTime = performance.now();
        console.log(`高度なフィルター適用完了: ${(endTime - startTime).toFixed(2)}ms`);
    }

    // 高度なフィルター設定の更新
    updateAdvancedFilterSettings() {
        this.advancedFilters = {
            dateRange: {
                from: document.getElementById('dateFrom')?.value || null,
                to: document.getElementById('dateTo')?.value || null
            },
            filenamePattern: {
                pattern: document.getElementById('filenamePattern')?.value || '',
                useRegex: document.getElementById('useRegex')?.checked || false
            },
            sizeRange: {
                from: parseFloat(document.getElementById('sizeFrom')?.value) || null,
                to: parseFloat(document.getElementById('sizeTo')?.value) || null
            },
            resolutionRange: {
                min: this.parseResolution(document.getElementById('resolutionMin')?.value),
                max: this.parseResolution(document.getElementById('resolutionMax')?.value)
            },
            customCondition: document.getElementById('customCondition')?.value || '',
            sortBy: document.getElementById('sortBy')?.value || 'name',
            sortOrder: document.querySelector('input[name="sortOrder"]:checked')?.value || 'asc'
        };
    }

    // 高度なフィルタリングの実行
    performAdvancedFiltering() {
        const data = this.originalData[this.currentTab];
        let filteredData = [...data];

        // 日時範囲フィルター
        if (this.advancedFilters.dateRange.from || this.advancedFilters.dateRange.to) {
            filteredData = filteredData.filter(item => {
                const itemDate = new Date(item.modifiedDate || item.files?.[0]?.modifiedDate);
                const fromDate = this.advancedFilters.dateRange.from ? new Date(this.advancedFilters.dateRange.from) : null;
                const toDate = this.advancedFilters.dateRange.to ? new Date(this.advancedFilters.dateRange.to) : null;

                if (fromDate && itemDate < fromDate) return false;
                if (toDate && itemDate > toDate) return false;
                return true;
            });
        }

        // ファイル名パターンフィルター
        if (this.advancedFilters.filenamePattern.pattern) {
            filteredData = filteredData.filter(item => {
                const filename = item.filename || item.files?.[0]?.filename;
                if (!filename) return false;

                if (this.advancedFilters.filenamePattern.useRegex) {
                    try {
                        const regex = new RegExp(this.advancedFilters.filenamePattern.pattern);
                        return regex.test(filename);
                    } catch (error) {
                        console.warn('正規表現エラー:', error);
                        return false;
                    }
                } else {
                    // ワイルドカードパターンの処理
                    const pattern = this.advancedFilters.filenamePattern.pattern.toLowerCase();
                    const name = filename.toLowerCase();
                    
                    if (pattern.includes('*')) {
                        const regexPattern = pattern.replace(/\*/g, '.*');
                        try {
                            const regex = new RegExp(regexPattern);
                            return regex.test(name);
                        } catch (error) {
                            return name.includes(pattern.replace(/\*/g, ''));
                        }
                    } else {
                        return name.includes(pattern);
                    }
                }
            });
        }

        // ファイルサイズ範囲フィルター
        if (this.advancedFilters.sizeRange.from || this.advancedFilters.sizeRange.to) {
            filteredData = filteredData.filter(item => {
                const sizeMB = (item.size || item.files?.[0]?.size || 0) / (1024 * 1024);
                const fromSize = this.advancedFilters.sizeRange.from;
                const toSize = this.advancedFilters.sizeRange.to;

                if (fromSize && sizeMB < fromSize) return false;
                if (toSize && sizeMB > toSize) return false;
                return true;
            });
        }

        // 解像度範囲フィルター
        if (this.advancedFilters.resolutionRange.min || this.advancedFilters.resolutionRange.max) {
            filteredData = filteredData.filter(item => {
                const resolution = this.parseResolution(item.resolution || item.files?.[0]?.resolution);
                if (!resolution) return false;

                const pixels = resolution.width * resolution.height;
                const minPixels = this.advancedFilters.resolutionRange.min ? 
                    this.advancedFilters.resolutionRange.min.width * this.advancedFilters.resolutionRange.min.height : 0;
                const maxPixels = this.advancedFilters.resolutionRange.max ? 
                    this.advancedFilters.resolutionRange.max.width * this.advancedFilters.resolutionRange.max.height : Infinity;

                if (minPixels && pixels < minPixels) return false;
                if (maxPixels !== Infinity && pixels > maxPixels) return false;
                return true;
            });
        }

        // カスタム条件フィルター
        if (this.advancedFilters.customCondition) {
            filteredData = filteredData.filter(item => {
                return this.applyCustomCondition(item, this.advancedFilters.customCondition);
            });
        }

        // ソート
        filteredData = this.sortData(filteredData, this.advancedFilters.sortBy, this.advancedFilters.sortOrder);

        // 結果を保存
        this.filteredData[this.currentTab] = filteredData;
    }

    // カスタム条件の適用
    applyCustomCondition(item, condition) {
        const now = new Date();
        const itemDate = new Date(item.modifiedDate || item.files?.[0]?.modifiedDate);
        const sizeMB = (item.size || item.files?.[0]?.size || 0) / (1024 * 1024);
        const resolution = this.parseResolution(item.resolution || item.files?.[0]?.resolution);
        const pixels = resolution ? resolution.width * resolution.height : 0;

        switch (condition) {
            case 'recent':
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return itemDate >= sevenDaysAgo;
            case 'old':
                const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                return itemDate <= oneYearAgo;
            case 'large':
                return sizeMB >= 10;
            case 'small':
                return sizeMB <= 1;
            case 'highRes':
                return pixels >= 3840 * 2160; // 4K
            case 'lowRes':
                return pixels <= 1920 * 1080; // HD
            default:
                return true;
        }
    }

    // データのソート
    sortData(data, sortBy, sortOrder) {
        return data.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'name':
                    aValue = a.filename || a.files?.[0]?.filename || '';
                    bValue = b.filename || b.files?.[0]?.filename || '';
                    break;
                case 'size':
                    aValue = a.size || a.files?.[0]?.size || 0;
                    bValue = b.size || b.files?.[0]?.size || 0;
                    break;
                case 'date':
                    aValue = new Date(a.modifiedDate || a.files?.[0]?.modifiedDate);
                    bValue = new Date(b.modifiedDate || b.files?.[0]?.modifiedDate);
                    break;
                case 'blurScore':
                    aValue = parseFloat(a.blurScore) || 0;
                    bValue = parseFloat(b.blurScore) || 0;
                    break;
                case 'similarity':
                    aValue = parseFloat(a.similarity) || 0;
                    bValue = parseFloat(b.similarity) || 0;
                    break;
                default:
                    return 0;
            }

            if (sortOrder === 'desc') {
                return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
            } else {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            }
        });
    }

    // 高度なフィルターのリセット
    resetAdvancedFilter() {
        const inputs = [
            'dateFrom', 'dateTo', 'filenamePattern', 'sizeFrom', 'sizeTo',
            'resolutionMin', 'resolutionMax', 'customCondition'
        ];

        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });

        // チェックボックスとラジオボタンのリセット
        document.getElementById('useRegex').checked = false;
        document.querySelector('input[name="sortOrder"][value="asc"]').checked = true;
        document.getElementById('sortBy').value = 'name';

        this.updateAdvancedFilterCount();
        this.applyAdvancedFilter();
    }

    // フィルタープリセット機能
    initializePresetDialogEvents() {
        // プリセットダイアログの制御
        document.getElementById('closeFilterPreset')?.addEventListener('click', () => {
            document.getElementById('filterPresetDialog').classList.add('hidden');
        });

        // プリセット保存
        document.getElementById('savePreset')?.addEventListener('click', () => {
            this.saveFilterPreset();
        });

        // プリセット読み込み/保存の切り替え
        document.getElementById('switchToLoad')?.addEventListener('click', () => {
            this.switchPresetDialog('load');
        });

        document.getElementById('switchToSave')?.addEventListener('click', () => {
            this.switchPresetDialog('save');
        });
    }

    // プリセットダイアログの表示
    showPresetDialog(mode) {
        this.switchPresetDialog(mode);
        document.getElementById('filterPresetDialog').classList.remove('hidden');
    }

    // プリセットダイアログのモード切り替え
    switchPresetDialog(mode) {
        const saveForm = document.getElementById('savePresetForm');
        const loadForm = document.getElementById('loadPresetForm');

        if (mode === 'save') {
            saveForm.classList.remove('hidden');
            loadForm.classList.add('hidden');
            this.clearPresetForm();
        } else {
            saveForm.classList.add('hidden');
            loadForm.classList.remove('hidden');
            this.loadPresetList();
        }
    }

    // プリセットフォームのクリア
    clearPresetForm() {
        document.getElementById('presetName').value = '';
        document.getElementById('presetDescription').value = '';
    }

    // フィルタープリセットの保存
    saveFilterPreset() {
        const name = document.getElementById('presetName').value.trim();
        const description = document.getElementById('presetDescription').value.trim();

        if (!name) {
            this.showNotification('エラー', 'プリセット名を入力してください', 'error');
            return;
        }

        // 現在のフィルター設定を取得
        const currentSettings = this.getCurrentFilterSettings();

        // プリセットを保存
        const presets = this.settingsManager.getSetting('filterPresets', []);
        const newPreset = {
            id: Date.now().toString(),
            name: name,
            description: description,
            settings: currentSettings,
            createdAt: new Date().toISOString(),
            tab: this.currentTab
        };

        presets.push(newPreset);
        this.settingsManager.setSetting('filterPresets', presets);

        this.showNotification('保存完了', 'フィルタープリセットを保存しました', 'success');
        document.getElementById('filterPresetDialog').classList.add('hidden');
    }

    // 現在のフィルター設定を取得
    getCurrentFilterSettings() {
        return {
            // 基本フィルター
            basic: { ...this.currentFilters },
            // 高度なフィルター
            advanced: {
                dateRange: {
                    from: document.getElementById('dateFrom')?.value || null,
                    to: document.getElementById('dateTo')?.value || null
                },
                filenamePattern: {
                    pattern: document.getElementById('filenamePattern')?.value || '',
                    useRegex: document.getElementById('useRegex')?.checked || false
                },
                sizeRange: {
                    from: parseFloat(document.getElementById('sizeFrom')?.value) || null,
                    to: parseFloat(document.getElementById('sizeTo')?.value) || null
                },
                resolutionRange: {
                    min: document.getElementById('resolutionMin')?.value || null,
                    max: document.getElementById('resolutionMax')?.value || null
                },
                customCondition: document.getElementById('customCondition')?.value || '',
                sortBy: document.getElementById('sortBy')?.value || 'name',
                sortOrder: document.querySelector('input[name="sortOrder"]:checked')?.value || 'asc'
            }
        };
    }

    // プリセット一覧の読み込み
    loadPresetList() {
        const presets = this.settingsManager.getSetting('filterPresets', []);
        const presetList = document.getElementById('presetList');

        if (presets.length === 0) {
            presetList.innerHTML = '<p class="text-gray-500 text-center py-8">保存されたプリセットがありません</p>';
            return;
        }

        presetList.innerHTML = '';
        presets.forEach(preset => {
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            presetItem.innerHTML = `
                <div class="preset-name">${preset.name}</div>
                <div class="preset-description">${preset.description || '説明なし'}</div>
                <div class="preset-meta">
                    <span>${new Date(preset.createdAt).toLocaleDateString()}</span>
                    <span>${preset.tab || '全タブ'}</span>
                </div>
                <div class="preset-actions">
                    <button class="preset-action-btn load" data-preset-id="${preset.id}">読み込み</button>
                    <button class="preset-action-btn delete" data-preset-id="${preset.id}">削除</button>
                </div>
            `;

            // イベントリスナーを追加
            presetItem.querySelector('.load').addEventListener('click', () => {
                this.loadFilterPreset(preset.id);
            });

            presetItem.querySelector('.delete').addEventListener('click', () => {
                this.deleteFilterPreset(preset.id);
            });

            presetList.appendChild(presetItem);
        });
    }

    // フィルタープリセットの読み込み
    loadFilterPreset(presetId) {
        const presets = this.settingsManager.getSetting('filterPresets', []);
        const preset = presets.find(p => p.id === presetId);

        if (!preset) {
            this.showNotification('エラー', 'プリセットが見つかりません', 'error');
            return;
        }

        // 基本フィルターの適用
        if (preset.settings.basic) {
            this.currentFilters = { ...preset.settings.basic };
            this.updateFilterUI();
        }

        // 高度なフィルターの適用
        if (preset.settings.advanced) {
            const advanced = preset.settings.advanced;
            
            // 日時範囲
            if (advanced.dateRange) {
                document.getElementById('dateFrom').value = advanced.dateRange.from || '';
                document.getElementById('dateTo').value = advanced.dateRange.to || '';
            }

            // ファイル名パターン
            if (advanced.filenamePattern) {
                document.getElementById('filenamePattern').value = advanced.filenamePattern.pattern || '';
                document.getElementById('useRegex').checked = advanced.filenamePattern.useRegex || false;
            }

            // ファイルサイズ範囲
            if (advanced.sizeRange) {
                document.getElementById('sizeFrom').value = advanced.sizeRange.from || '';
                document.getElementById('sizeTo').value = advanced.sizeRange.to || '';
            }

            // 解像度範囲
            if (advanced.resolutionRange) {
                document.getElementById('resolutionMin').value = advanced.resolutionRange.min || '';
                document.getElementById('resolutionMax').value = advanced.resolutionRange.max || '';
            }

            // カスタム条件
            if (advanced.customCondition) {
                document.getElementById('customCondition').value = advanced.customCondition;
            }

            // ソート設定
            if (advanced.sortBy) {
                document.getElementById('sortBy').value = advanced.sortBy;
            }
            if (advanced.sortOrder) {
                document.querySelector(`input[name="sortOrder"][value="${advanced.sortOrder}"]`).checked = true;
            }
        }

        // フィルターを適用
        this.updateAdvancedFilterCount();
        this.applyAdvancedFilter();

        this.showNotification('読み込み完了', `プリセット「${preset.name}」を読み込みました`, 'success');
        document.getElementById('filterPresetDialog').classList.add('hidden');
    }

    // フィルタープリセットの削除
    deleteFilterPreset(presetId) {
        const presets = this.settingsManager.getSetting('filterPresets', []);
        const preset = presets.find(p => p.id === presetId);

        if (!preset) {
            this.showNotification('エラー', 'プリセットが見つかりません', 'error');
            return;
        }

        if (confirm(`プリセット「${preset.name}」を削除しますか？`)) {
            const updatedPresets = presets.filter(p => p.id !== presetId);
            this.settingsManager.setSetting('filterPresets', updatedPresets);
            
            this.showNotification('削除完了', 'プリセットを削除しました', 'success');
            this.loadPresetList();
        }
    }
}

// アプリケーションの初期化
const app = new ImageCleanupApp();

// グローバル変数として設定（設定画面からガイダンスを呼び出すため）
window.imageCleanupApp = app;

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - アプリケーションを初期化中...');
    
    // window.electronAPIが利用可能かチェック
    if (typeof window.electronAPI === 'undefined') {
        console.error('window.electronAPIが利用できません');
        return;
    }
    
    console.log('window.electronAPI利用可能:', Object.keys(window.electronAPI));
    
    // アプリケーションインスタンスを作成
    window.app = new ImageCleanupApp();
    window.imageCleanupApp = window.app;
    
    console.log('アプリケーション初期化完了');
});

// グローバル関数（デバッグ用）
window.debugApp = () => {
    console.log('アプリケーション状態:', window.app);
    console.log('electronAPI:', window.electronAPI);
}; 