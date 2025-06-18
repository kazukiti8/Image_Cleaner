// 画像整理アプリ レンダラープロセスメインスクリプト

// パス操作のためのユーティリティ関数
function pathBasename(filePath) {
    return filePath.split(/[\\/]/).pop();
}

class ImageCleanupApp {
    constructor() {
        this.currentTab = 'blur';
        this.selectedItems = new Set();
        this.scanInProgress = false;
        this.targetFolder = null;
        this.outputFolder = null;
        this.confirmResolve = null;
        
        // フィルター設定
        this.filters = {
            blur: {
                scoreMin: 0,
                scoreMax: 100,
                sizeMin: 0,
                sizeMax: Infinity,
                dateFrom: null,
                dateTo: null
            },
            similar: {
                similarityMin: 0,
                similarityMax: 100,
                sizeMin: 0,
                sizeMax: Infinity,
                dateFrom: null,
                dateTo: null
            },
            error: {
                errorType: '',
                sizeMin: 0,
                sizeMax: Infinity,
                dateFrom: null,
                dateTo: null
            }
        };
        
        // 元のデータ（フィルタリング前）
        this.originalData = {
            blur: [],
            similar: [],
            error: []
        };
        
        // 保存されたフィルター設定を読み込み
        this.loadFilterSettings();
        
        this.initializeEventListeners();
        this.initializeScanEventListeners();
        this.updateUI();
    }

    loadFilterSettings() {
        try {
            const savedFilters = localStorage.getItem('imageCleaner_filters');
            if (savedFilters) {
                const parsed = JSON.parse(savedFilters);
                // 各タブのフィルター設定を復元
                Object.keys(parsed).forEach(tabName => {
                    if (this.filters[tabName]) {
                        this.filters[tabName] = { ...this.filters[tabName], ...parsed[tabName] };
                    }
                });
            }
        } catch (error) {
            console.warn('フィルター設定の読み込みに失敗しました:', error);
        }
    }

    saveFilterSettings() {
        try {
            localStorage.setItem('imageCleaner_filters', JSON.stringify(this.filters));
        } catch (error) {
            console.warn('フィルター設定の保存に失敗しました:', error);
        }
    }

    initializeEventListeners() {
        // フォルダ選択ボタン
        document.getElementById('targetFolder').addEventListener('click', () => this.selectTargetFolder());
        document.getElementById('outputFolder').addEventListener('click', () => this.selectOutputFolder());
        
        // スキャンボタン
        document.getElementById('scanButton').addEventListener('click', () => this.startScan());
        
        // 設定ボタン
        document.getElementById('settingsButton').addEventListener('click', () => this.openSettings());
        
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
        document.getElementById('trashBtn').addEventListener('click', () => this.moveToTrash());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deletePermanently());
        document.getElementById('moveBtn').addEventListener('click', () => this.moveFiles());
        
        // モーダル関連
        this.initializeModalListeners();
        
        // 倍率調整
        this.initializeZoomControls();
        
        // キーボードショートカット
        this.initializeKeyboardShortcuts();
    }

    initializeScanEventListeners() {
        console.log('スキャンイベントリスナーを初期化中...');
        
        // イベントリスナーを設定（重複を防ぐため一度削除してから設定）
        try {
            window.electronAPI.removeAllListeners('scan-progress');
            window.electronAPI.removeAllListeners('scan-complete');
            window.electronAPI.removeAllListeners('scan-error');
            window.electronAPI.removeAllListeners('file-operation-progress');
            window.electronAPI.removeAllListeners('file-operation-complete');
        } catch (error) {
            console.warn('イベントリスナー削除エラー:', error);
        }
        
        // スキャン進捗
        try {
            const progressHandler = (progress) => {
                console.log('スキャン進捗イベント受信:', progress);
                this.updateScanProgress(progress);
            };
            window.electronAPI.onScanProgress(progressHandler);
            console.log('スキャン進捗イベントリスナー設定完了');
        } catch (error) {
            console.error('スキャン進捗イベントリスナー設定エラー:', error);
        }
        
        // スキャン完了
        try {
            const completeHandler = (results) => {
                try {
                    console.log('スキャン完了イベント受信:', results);
                    console.log('結果の型:', typeof results);
                    console.log('結果のキー:', results ? Object.keys(results) : 'null');
                    this.handleScanComplete(results);
                } catch (error) {
                    console.error('スキャン完了ハンドラー内でエラー:', error);
                    console.error('エラーの詳細:', {
                        message: error.message,
                        stack: error.stack,
                        resultsType: typeof results,
                        resultsKeys: results ? Object.keys(results) : 'null'
                    });
                }
            };
            window.electronAPI.onScanComplete(completeHandler);
            console.log('スキャン完了イベントリスナー設定完了');
        } catch (error) {
            console.error('スキャン完了イベントリスナー設定エラー:', error);
            console.error('エラーの詳細:', {
                message: error.message,
                stack: error.stack
            });
        }
        
        // スキャンエラー
        try {
            const errorHandler = (error) => {
                console.log('スキャンエラーイベント受信:', error);
                this.handleScanError(error);
            };
            window.electronAPI.onScanError(errorHandler);
            console.log('スキャンエラーイベントリスナー設定完了');
        } catch (error) {
            console.error('スキャンエラーイベントリスナー設定エラー:', error);
        }
        
        // ファイル操作の進捗
        try {
            const fileProgressHandler = (progress) => {
                this.updateFileOperationProgress(progress);
            };
            window.electronAPI.onFileOperationProgress(fileProgressHandler);
            console.log('ファイル操作進捗イベントリスナー設定完了');
        } catch (error) {
            console.error('ファイル操作進捗イベントリスナー設定エラー:', error);
        }
        
        // ファイル操作の完了
        try {
            const fileCompleteHandler = (result) => {
                this.handleFileOperationComplete(result);
            };
            window.electronAPI.onFileOperationComplete(fileCompleteHandler);
            console.log('ファイル操作完了イベントリスナー設定完了');
        } catch (error) {
            console.error('ファイル操作完了イベントリスナー設定エラー:', error);
        }
        
        console.log('すべてのスキャンイベントリスナー初期化完了');
    }

    initializeModalListeners() {
        const modal = document.getElementById('confirmModal');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const okBtn = document.getElementById('confirmOkBtn');
        
        // モーダル外クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeConfirmModal();
            }
        });
        
        // キャンセルボタン
        cancelBtn.addEventListener('click', () => this.closeConfirmModal());
        
        // OKボタン
        okBtn.addEventListener('click', () => this.confirmAction());
        
        // ESCキーで閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.closeConfirmModal();
            }
        });
    }

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
                document.getElementById('outputFolderPathDisplay').title = folderPath;
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

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // タブボタンの状態を更新
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('tab-active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('tab-active');
        
        // タブコンテンツを切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).style.display = 'block';
        
        // フィルターを更新
        this.updateFilterContent();
    }

    selectAll() {
        // 現在のタブの全アイテムを選択
        const currentContent = document.getElementById(`content${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        const checkboxes = currentContent.querySelectorAll('input[type="checkbox"]');
        const headerCheckbox = currentContent.querySelector('thead input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.selectedItems.add(checkbox.value);
        });
        
        if (headerCheckbox) {
            headerCheckbox.checked = true;
            headerCheckbox.indeterminate = false;
        }
        
        this.updateSelectionUI();
    }

    deselectAll() {
        // 全選択を解除
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const headerCheckboxes = document.querySelectorAll('thead input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        headerCheckboxes.forEach(headerCheckbox => {
            headerCheckbox.checked = false;
            headerCheckbox.indeterminate = false;
        });
        
        this.selectedItems.clear();
        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const count = this.selectedItems.size;
        const size = this.calculateSelectedSize();
        
        document.getElementById('selectedCount').textContent = `${count}件`;
        document.getElementById('selectedSize').textContent = `${size.toFixed(1)} MB`;
        
        // アクションボタンの有効/無効を切り替え
        const hasSelection = count > 0;
        const hasOutputFolder = this.outputFolder !== null;
        
        document.getElementById('trashBtn').disabled = !hasSelection;
        document.getElementById('deleteBtn').disabled = !hasSelection;
        document.getElementById('moveBtn').disabled = !hasSelection || !hasOutputFolder;
    }

    calculateSelectedSize() {
        // 選択されたアイテムの合計サイズを計算
        let totalSize = 0;
        this.selectedItems.forEach(itemId => {
            // 実際の実装では、アイテムのサイズ情報を取得
            totalSize += 0; // 仮の実装
        });
        return totalSize;
    }

    updateScanButton() {
        const button = document.getElementById('scanButton');
        if (this.scanInProgress) {
            button.textContent = 'スキャン中...';
            button.disabled = true;
            button.classList.add('opacity-50');
        } else {
            button.textContent = 'スキャン開始';
            button.disabled = false;
            button.classList.remove('opacity-50');
        }
    }

    updateScanProgress(progress) {
        // スキャン進捗を更新
        console.log('スキャン進捗:', progress);
        
        const button = document.getElementById('scanButton');
        const progressMessage = document.getElementById('progressMessage');
        const progressText = document.getElementById('progressText');
        
        if (progress) {
            button.textContent = `スキャン中... ${progress.percentage}%`;
            
            // 進捗メッセージを表示
            if (progressMessage && progressText) {
                progressText.textContent = `分析中: ${progress.filename} (${progress.current}/${progress.total})`;
                progressMessage.style.display = 'block';
            }
        }
    }

    handleScanComplete(results) {
        try {
            this.scanInProgress = false;
            this.updateScanButton();
            
            // デバッグ: スキャン結果の構造をログ出力
            console.log('スキャン完了 - 結果データ:', results);
            console.log('ブレ画像数:', results.blurImages?.length || 0);
            console.log('類似画像数:', results.similarImages?.length || 0);
            console.log('エラー数:', results.errors?.length || 0);
            
            if (results.blurImages && results.blurImages.length > 0) {
                console.log('ブレ画像サンプル:', results.blurImages[0]);
            }
            if (results.similarImages && results.similarImages.length > 0) {
                console.log('類似画像サンプル:', results.similarImages[0]);
            }
            if (results.errors && results.errors.length > 0) {
                console.log('エラーサンプル:', results.errors[0]);
            }
            
            // 進捗メッセージを非表示
            const progressMessage = document.getElementById('progressMessage');
            if (progressMessage) {
                progressMessage.style.display = 'none';
            }
            
            // 元のデータを保存
            this.originalData.blur = results.blurImages || [];
            this.originalData.similar = results.similarImages || [];
            this.originalData.error = results.errors || [];
            
            // 結果を表示
            this.displayResults(results);
            
            // フィルターカウントを更新
            this.updateFilterCounts();
            
            this.showSuccess(`スキャン完了: ブレ画像 ${results.blurImages?.length || 0}件, 類似画像 ${results.similarImages?.length || 0}件, エラー ${results.errors?.length || 0}件`);
        } catch (error) {
            console.error('handleScanComplete内でエラー:', error);
            console.error('エラーの詳細:', {
                message: error.message,
                stack: error.stack,
                resultsType: typeof results,
                resultsKeys: results ? Object.keys(results) : 'null'
            });
            
            // エラーが発生してもスキャン状態をリセット
            this.scanInProgress = false;
            this.updateScanButton();
            
            // 進捗メッセージを非表示
            const progressMessage = document.getElementById('progressMessage');
            if (progressMessage) {
                progressMessage.style.display = 'none';
            }
            
            this.showError('スキャン結果の処理中にエラーが発生しました');
        }
    }

    handleScanError(error) {
        this.scanInProgress = false;
        this.updateScanButton();
        
        // 進捗メッセージを非表示
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.style.display = 'none';
        }
        
        this.showError(`スキャンエラー: ${error.message}`);
        console.error('スキャンエラー:', error);
    }

    displayResults(results) {
        console.log('displayResults 呼び出し:', results);
        
        // 結果を各タブに表示
        if (results.blurImages) {
            console.log('ブレ画像を表示:', results.blurImages.length, '件');
            this.displayBlurResults(results.blurImages);
        } else {
            console.log('ブレ画像データなし');
        }
        
        if (results.similarImages) {
            console.log('類似画像を表示:', results.similarImages.length, '件');
            this.displaySimilarResults(results.similarImages);
        } else {
            console.log('類似画像データなし');
        }
        
        if (results.errors) {
            console.log('エラーを表示:', results.errors.length, '件');
            this.displayErrorResults(results.errors);
        } else {
            console.log('エラーデータなし');
        }
    }

    displayBlurResults(blurImages) {
        console.log('displayBlurResults 呼び出し:', blurImages);
        
        const container = document.getElementById('contentBlur');
        const count = document.getElementById('countBlur');
        
        console.log('コンテナ要素:', container);
        console.log('カウント要素:', count);
        
        count.textContent = blurImages.length;
        
        if (blurImages.length === 0) {
            console.log('ブレ画像なし - メッセージを表示');
            container.innerHTML = '<div class="text-center text-slate-500 py-8">ブレ画像は見つかりませんでした</div>';
            return;
        }
        
        // テーブルを作成
        console.log('ブレ画像テーブルを作成中...');
        const table = this.createBlurTable(blurImages);
        console.log('作成されたテーブル:', table);
        
        container.innerHTML = '';
        container.appendChild(table);
        console.log('テーブルをコンテナに追加完了');
    }

    displaySimilarResults(similarImages) {
        const container = document.getElementById('contentSimilar');
        const count = document.getElementById('countSimilar');
        
        count.textContent = similarImages.length;
        
        if (similarImages.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 py-8">類似画像は見つかりませんでした</div>';
            return;
        }
        
        // テーブルを作成
        const table = this.createSimilarTable(similarImages);
        container.innerHTML = '';
        container.appendChild(table);
    }

    displayErrorResults(errors) {
        const container = document.getElementById('contentError');
        const count = document.getElementById('countError');
        
        count.textContent = errors.length;
        
        if (errors.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-500 py-8">エラーはありません</div>';
            return;
        }
        
        // テーブルを作成
        const table = this.createErrorTable(errors);
        container.innerHTML = '';
        container.appendChild(table);
    }

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
            row.className = 'border-b border-slate-100 hover:bg-slate-50';
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
                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                </th>
                <th class="p-2 text-left">ファイル1</th>
                <th class="p-2 text-left">ファイル2</th>
                <th class="p-2 text-left">類似度</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // ボディ
        const tbody = document.createElement('tbody');
        similarImages.forEach(pair => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-100 hover:bg-slate-50';
            row.dataset.filePath = pair.filePath1 || pair.file1; // 最初のファイルをプレビュー用に設定
            
            row.innerHTML = `
                <td class="p-2">
                    <input type="checkbox" value="${pair.filePath1 || pair.file1}" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                </td>
                <td class="p-2 font-medium text-slate-800">${pair.filename1 || pair.file1}</td>
                <td class="p-2 font-medium text-slate-800">${pair.filename2 || pair.file2}</td>
                <td class="p-2">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${pair.similarity > 90 ? 'bg-red-100 text-red-800' : pair.similarity > 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'}">
                        ${pair.similarity}%
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // イベントリスナーを設定
        this.setupCheckboxListeners(table);
        
        return table;
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
            row.className = 'border-b border-slate-100 hover:bg-slate-50';
            row.dataset.filePath = error.filePath;
            
            row.innerHTML = `
                <td class="p-2">
                    <input type="checkbox" value="${error.filePath}" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                </td>
                <td class="p-2 font-medium text-slate-800">${error.filename}</td>
                <td class="p-2 text-red-600">${error.error}</td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // イベントリスナーを設定
        this.setupCheckboxListeners(table);
        
        return table;
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

    updateFilterContent() {
        const filterContent = document.getElementById('filterContent');
        
        switch (this.currentTab) {
            case 'blur':
                filterContent.innerHTML = `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">ブレスコア範囲:</label>
                            <div class="flex items-center space-x-2">
                                <input type="number" id="blurScoreMin" step="1" min="0" max="100" value="${this.filters.blur.scoreMin}" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <span class="text-xs text-slate-500">-</span>
                                <input type="number" id="blurScoreMax" step="1" min="0" max="100" value="${this.filters.blur.scoreMax}" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">ファイルサイズ (MB):</label>
                            <div class="flex items-center space-x-2">
                                <input type="number" id="blurSizeMin" step="0.1" min="0" value="${this.filters.blur.sizeMin}" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <span class="text-xs text-slate-500">-</span>
                                <input type="number" id="blurSizeMax" step="0.1" min="0" value="${this.filters.blur.sizeMax === Infinity ? '' : this.filters.blur.sizeMax}" placeholder="∞" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">日付範囲:</label>
                            <div class="space-y-1">
                                <input type="date" id="blurDateFrom" value="${this.filters.blur.dateFrom || ''}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <input type="date" id="blurDateTo" value="${this.filters.blur.dateTo || ''}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button id="applyBlurFilter" class="flex-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm transition-colors">適用</button>
                            <button id="resetBlurFilter" class="flex-1 px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md shadow-sm transition-colors">リセット</button>
                        </div>
                        <div class="text-xs text-slate-500 text-center">
                            表示: <span id="blurFilterCount">0</span> / <span id="blurTotalCount">0</span> 件
                        </div>
                    </div>
                `;
                this.setupFilterEventListeners('blur');
                break;
            case 'similar':
                filterContent.innerHTML = `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">類似度範囲 (%):</label>
                            <div class="flex items-center space-x-2">
                                <input type="number" id="similarityMin" step="1" min="0" max="100" value="${this.filters.similar.similarityMin}" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <span class="text-xs text-slate-500">-</span>
                                <input type="number" id="similarityMax" step="1" min="0" max="100" value="${this.filters.similar.similarityMax}" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">ファイルサイズ (MB):</label>
                            <div class="flex items-center space-x-2">
                                <input type="number" id="similarSizeMin" step="0.1" min="0" value="${this.filters.similar.sizeMin}" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <span class="text-xs text-slate-500">-</span>
                                <input type="number" id="similarSizeMax" step="0.1" min="0" value="${this.filters.similar.sizeMax === Infinity ? '' : this.filters.similar.sizeMax}" placeholder="∞" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">日付範囲:</label>
                            <div class="space-y-1">
                                <input type="date" id="similarDateFrom" value="${this.filters.similar.dateFrom || ''}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <input type="date" id="similarDateTo" value="${this.filters.similar.dateTo || ''}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button id="applySimilarFilter" class="flex-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm transition-colors">適用</button>
                            <button id="resetSimilarFilter" class="flex-1 px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md shadow-sm transition-colors">リセット</button>
                        </div>
                        <div class="text-xs text-slate-500 text-center">
                            表示: <span id="similarFilterCount">0</span> / <span id="similarTotalCount">0</span> 件
                        </div>
                    </div>
                `;
                this.setupFilterEventListeners('similar');
                break;
            case 'error':
                filterContent.innerHTML = `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">エラーの種類:</label>
                            <select id="errorType" class="w-full px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <option value="">すべて</option>
                                <option value="access" ${this.filters.error.errorType === 'access' ? 'selected' : ''}>アクセス不可</option>
                                <option value="corrupt" ${this.filters.error.errorType === 'corrupt' ? 'selected' : ''}>ファイル破損</option>
                                <option value="format" ${this.filters.error.errorType === 'format' ? 'selected' : ''}>未対応形式</option>
                                <option value="permission" ${this.filters.error.errorType === 'permission' ? 'selected' : ''}>権限エラー</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">ファイルサイズ (MB):</label>
                            <div class="flex items-center space-x-2">
                                <input type="number" id="errorSizeMin" step="0.1" min="0" value="${this.filters.error.sizeMin}" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <span class="text-xs text-slate-500">-</span>
                                <input type="number" id="errorSizeMax" step="0.1" min="0" value="${this.filters.error.sizeMax === Infinity ? '' : this.filters.error.sizeMax}" placeholder="∞" class="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-600 mb-1">日付範囲:</label>
                            <div class="space-y-1">
                                <input type="date" id="errorDateFrom" value="${this.filters.error.dateFrom || ''}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <input type="date" id="errorDateTo" value="${this.filters.error.dateTo || ''}" class="w-full px-2 py-1 text-xs border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button id="applyErrorFilter" class="flex-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm transition-colors">適用</button>
                            <button id="resetErrorFilter" class="flex-1 px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md shadow-sm transition-colors">リセット</button>
                        </div>
                        <div class="text-xs text-slate-500 text-center">
                            表示: <span id="errorFilterCount">0</span> / <span id="errorTotalCount">0</span> 件
                        </div>
                    </div>
                `;
                this.setupFilterEventListeners('error');
                break;
        }
        
        this.updateFilterCounts();
    }

    initializeZoomControls() {
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomInput = document.getElementById('zoomInput');
        const zoomValueDisplay = document.getElementById('zoomValueDisplay');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');

        const updateZoom = (value) => {
            zoomSlider.value = value;
            zoomInput.value = value;
            zoomValueDisplay.textContent = value;
        };

        zoomSlider.addEventListener('input', (e) => updateZoom(e.target.value));
        zoomInput.addEventListener('input', (e) => updateZoom(e.target.value));
        zoomInBtn.addEventListener('click', () => {
            const current = parseInt(zoomSlider.value);
            if (current < 150) updateZoom(current + 10);
        });
        zoomOutBtn.addEventListener('click', () => {
            const current = parseInt(zoomSlider.value);
            if (current > 1) updateZoom(current - 10);
        });
        resetZoomBtn.addEventListener('click', () => updateZoom(100));
    }

    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+O: 対象フォルダ選択
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                this.selectTargetFolder();
            }
            
            // Ctrl+Shift+O: 移動先フォルダ選択
            if (e.ctrlKey && e.shiftKey && e.key === 'O') {
                e.preventDefault();
                this.selectOutputFolder();
            }
            
            // F5: スキャン開始
            if (e.key === 'F5') {
                e.preventDefault();
                this.startScan();
            }
            
            // Ctrl+,: 設定画面
            if (e.ctrlKey && e.key === ',') {
                e.preventDefault();
                this.openSettings();
            }
            
            // Ctrl+F: フィルター適用
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.applyFilter(this.currentTab);
            }
            
            // Ctrl+R: フィルターリセット
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.resetFilter(this.currentTab);
            }
            
            // Ctrl+Shift+F: フィルターパネルにフォーカス
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                this.focusFilterPanel();
            }
        });
    }

    focusFilterPanel() {
        // 現在のタブに応じてフィルターパネルの最初の入力フィールドにフォーカス
        const inputSelectors = this.getInputSelectors(this.currentTab);
        if (inputSelectors.length > 0) {
            const firstInput = document.querySelector(inputSelectors[0]);
            if (firstInput) {
                firstInput.focus();
                firstInput.select();
            }
        }
    }

    updateUI() {
        // スキャンボタンの有効/無効
        const scanButton = document.getElementById('scanButton');
        scanButton.disabled = !this.targetFolder || this.scanInProgress;
        
        // 移動ボタンの有効/無効
        const moveBtn = document.getElementById('moveBtn');
        moveBtn.disabled = this.selectedItems.size === 0 || !this.outputFolder;
    }

    openSettings() {
        // 設定画面を開く（実装予定）
        console.log('設定画面を開く');
    }

    async moveToTrash() {
        if (this.selectedItems.size === 0) return;
        
        const confirmed = await this.showConfirmation(
            '画像の削除の確認',
            `選択された ${this.selectedItems.size} 件の画像をゴミ箱へ移動します。よろしいですか？`
        );
        
        if (confirmed) {
            try {
                const result = await window.electronAPI.deleteFiles(Array.from(this.selectedItems), true);
                
                if (result.success) {
                    this.showSuccess(`画像をゴミ箱へ移動しました (${result.successCount}件)`);
                    this.selectedItems.clear();
                    this.updateSelectionUI();
                    // 結果を再読み込み
                    this.refreshResults();
                } else {
                    const errorMessage = result.errorCount > 0 
                        ? `${result.successCount}件成功、${result.errorCount}件失敗`
                        : result.error || '操作に失敗しました';
                    this.showError(errorMessage);
                }
            } catch (error) {
                console.error('ゴミ箱への移動エラー:', error);
                this.showError('ゴミ箱への移動に失敗しました');
            }
        }
    }

    async deletePermanently() {
        if (this.selectedItems.size === 0) return;
        
        const confirmed = await this.showConfirmation(
            '画像の完全な削除の確認',
            `選択された ${this.selectedItems.size} 件の画像を完全に削除します。\n\nこの操作は元に戻すことができません。\n本当によろしいですか？`
        );
        
        if (confirmed) {
            try {
                const result = await window.electronAPI.deleteFiles(Array.from(this.selectedItems), false);
                
                if (result.success) {
                    this.showSuccess(`画像を完全に削除しました (${result.successCount}件)`);
                    this.selectedItems.clear();
                    this.updateSelectionUI();
                    // 結果を再読み込み
                    this.refreshResults();
                } else {
                    const errorMessage = result.errorCount > 0 
                        ? `${result.successCount}件成功、${result.errorCount}件失敗`
                        : result.error || '操作に失敗しました';
                    this.showError(errorMessage);
                }
            } catch (error) {
                console.error('削除エラー:', error);
                this.showError('削除に失敗しました');
            }
        }
    }

    async moveFiles() {
        if (this.selectedItems.size === 0 || !this.outputFolder) return;
        
        const confirmed = await this.showConfirmation(
            '画像の移動の確認',
            `選択された ${this.selectedItems.size} 件の画像を移動します。よろしいですか？`
        );
        
        if (confirmed) {
            try {
                const result = await window.electronAPI.moveFiles(Array.from(this.selectedItems), this.outputFolder);
                
                if (result.success) {
                    this.showSuccess(`画像を移動しました (${result.successCount}件)`);
                    this.selectedItems.clear();
                    this.updateSelectionUI();
                    // 結果を再読み込み
                    this.refreshResults();
                } else {
                    const errorMessage = result.errorCount > 0 
                        ? `${result.successCount}件成功、${result.errorCount}件失敗`
                        : result.error || '操作に失敗しました';
                    this.showError(errorMessage);
                }
            } catch (error) {
                console.error('移動エラー:', error);
                this.showError('移動に失敗しました');
            }
        }
    }

    // 結果を再読み込み
    async refreshResults() {
        if (this.targetFolder) {
            try {
                await window.electronAPI.scanImages(this.targetFolder, true);
            } catch (error) {
                console.error('結果の再読み込みエラー:', error);
            }
        }
    }

    // ユーティリティ関数
    getDisplayPath(path) {
        if (path.length > 50) {
            return path.substring(0, 20) + '...' + path.substring(path.length - 20);
        }
        return path;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('ja-JP');
    }

    showError(message) {
        // エラーメッセージを表示
        console.error(message);
        
        // トースト通知を作成
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
        toast.innerHTML = `
            <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 mr-2">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // アニメーション
        setTimeout(() => toast.classList.remove('translate-x-full'), 100);
        
        // 自動削除
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 5000);
    }

    showSuccess(message) {
        // 成功メッセージを表示
        console.log(message);
        
        // トースト通知を作成
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
        toast.innerHTML = `
            <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 mr-2">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // アニメーション
        setTimeout(() => toast.classList.remove('translate-x-full'), 100);
        
        // 自動削除
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    async showConfirmation(title, message) {
        return new Promise((resolve) => {
            this.confirmResolve = resolve;
            
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;
            document.getElementById('confirmModal').classList.remove('hidden');
        });
    }

    closeConfirmModal() {
        const modal = document.getElementById('confirmModal');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        
        modal.classList.add('hidden');
        cancelBtn.style.display = 'block'; // キャンセルボタンを再表示
        
        if (this.confirmResolve) {
            this.confirmResolve(false);
            this.confirmResolve = null;
        }
    }

    confirmAction() {
        const modal = document.getElementById('confirmModal');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        
        modal.classList.add('hidden');
        cancelBtn.style.display = 'block'; // キャンセルボタンを再表示
        
        if (this.confirmResolve) {
            this.confirmResolve(true);
            this.confirmResolve = null;
        }
    }

    setupCheckboxListeners(table) {
        // チェックボックスのイベントリスナーを設定
        const checkboxes = table.querySelectorAll('input[type="checkbox"]');
        const headerCheckbox = table.querySelector('thead input[type="checkbox"]');
        const bodyCheckboxes = table.querySelectorAll('tbody input[type="checkbox"]');
        
        // 個別チェックボックスのイベントリスナー
        bodyCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const value = checkbox.value;
                if (checkbox.checked) {
                    this.selectedItems.add(value);
                } else {
                    this.selectedItems.delete(value);
                }
                this.updateSelectionUI();
                this.updateHeaderCheckbox(table);
            });
        });
        
        // ヘッダーチェックボックスのイベントリスナー
        if (headerCheckbox) {
            headerCheckbox.addEventListener('change', () => {
                const isChecked = headerCheckbox.checked;
                bodyCheckboxes.forEach(checkbox => {
                    checkbox.checked = isChecked;
                    const value = checkbox.value;
                    if (isChecked) {
                        this.selectedItems.add(value);
                    } else {
                        this.selectedItems.delete(value);
                    }
                });
                this.updateSelectionUI();
            });
        }
        
        // テーブル行のクリックイベント（プレビュー表示）
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.addEventListener('click', (e) => {
                // チェックボックスをクリックした場合はプレビューを表示しない
                if (e.target.type === 'checkbox') return;
                const filePath = row.dataset.filePath;
                if (filePath) {
                    this.showImagePreview(filePath, row.dataset);
                }
            });
            // 行にホバー効果を追加
            row.style.cursor = 'pointer';
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = '#f8fafc';
            });
            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = '';
            });
        });
    }

    // 画像プレビュー表示
    showImagePreview(filePath, metadata = {}) {
        const previewArea = document.getElementById('previewAreaContainer');
        const imageInfoArea = document.getElementById('imageInfoArea');
        
        // プレビューエリアの内容をクリア
        previewArea.innerHTML = '';
        
        // 画像要素を作成
        const img = document.createElement('img');
        img.src = `file://${filePath}`;
        img.alt = 'プレビュー画像';
        img.className = 'max-w-full max-h-full object-contain';
        img.style.maxHeight = '300px';
        
        // 画像情報を更新
        const infoFileName = document.getElementById('infoFileName');
        const infoFilePath = document.getElementById('infoFilePath');
        const infoResolution = document.getElementById('infoResolution');
        const infoFileSize = document.getElementById('infoFileSize');
        const infoTakenDate = document.getElementById('infoTakenDate');
        const infoBlurScore = document.getElementById('infoBlurScore');
        const infoBlurScoreContainer = document.getElementById('infoBlurScoreContainer');
        
        img.onload = () => {
            // プレビューエリアに画像を追加
            previewArea.appendChild(img);
            
            // 画像情報を更新
            infoFileName.textContent = pathBasename(filePath);
            infoFilePath.textContent = filePath;
            infoFilePath.title = filePath;
            infoResolution.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
            infoFileSize.textContent = metadata.size ? this.formatFileSize(metadata.size) : '不明';
            infoTakenDate.textContent = metadata.modifiedDate ? this.formatDate(metadata.modifiedDate) : '不明';
            
            // ブレスコアが存在する場合のみ表示
            if (metadata.blurScore !== undefined) {
                infoBlurScore.textContent = metadata.blurScore;
                infoBlurScoreContainer.style.display = 'block';
                
                // スコアに応じて色を変更
                if (metadata.blurScore > 80) {
                    infoBlurScore.className = 'font-bold text-red-600';
                } else if (metadata.blurScore > 60) {
                    infoBlurScore.className = 'font-bold text-yellow-600';
                } else {
                    infoBlurScore.className = 'font-bold text-orange-600';
                }
            } else {
                infoBlurScoreContainer.style.display = 'none';
            }
        };
        
        img.onerror = () => {
            // 画像読み込みエラー時の表示
            previewArea.innerHTML = `
                <div class="text-center text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-16 h-16 mx-auto mb-2">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    <p>画像の読み込みに失敗しました</p>
                </div>
            `;
            
            // 情報をクリア
            infoFileName.textContent = '';
            infoFilePath.textContent = '';
            infoFilePath.title = '';
            infoResolution.textContent = '';
            infoFileSize.textContent = '';
            infoTakenDate.textContent = '';
            infoBlurScoreContainer.style.display = 'none';
        };
    }

    updateHeaderCheckbox(table) {
        const headerCheckbox = table.querySelector('thead input[type="checkbox"]');
        const bodyCheckboxes = table.querySelectorAll('tbody input[type="checkbox"]');
        const checkedCount = table.querySelectorAll('tbody input[type="checkbox"]:checked').length;
        
        if (headerCheckbox) {
            if (checkedCount === 0) {
                headerCheckbox.checked = false;
                headerCheckbox.indeterminate = false;
            } else if (checkedCount === bodyCheckboxes.length) {
                headerCheckbox.checked = true;
                headerCheckbox.indeterminate = false;
            } else {
                headerCheckbox.checked = false;
                headerCheckbox.indeterminate = true;
            }
        }
    }

    updateFileOperationProgress(progress) {
        // ファイル操作の進捗を表示
        console.log('ファイル操作進捗:', progress);
        
        const progressMessage = document.getElementById('fileOperationProgressMessage');
        const progressText = document.getElementById('fileOperationProgressText');
        
        if (progress) {
            let operationText = '';
            switch (progress.operation) {
                case 'trash':
                    operationText = 'ゴミ箱へ移動中';
                    break;
                case 'delete':
                    operationText = '削除中';
                    break;
                case 'move':
                    operationText = '移動中';
                    break;
                default:
                    operationText = 'ファイル操作中';
            }
            
            progressText.textContent = `${operationText}: ${progress.filename} (${progress.current}/${progress.total})`;
            progressMessage.style.display = 'block';
        }
    }

    handleFileOperationComplete(result) {
        // ファイル操作の完了を処理
        console.log('ファイル操作完了:', result);
        
        // 進捗表示を非表示
        document.getElementById('fileOperationProgressMessage').style.display = 'none';
        
        if (result.success) {
            this.showSuccess(`ファイル操作が完了しました (${result.successCount}件)`);
        } else {
            let message = '';
            if (result.partialSuccessCount > 0) {
                // 部分的な成功がある場合
                message = `${result.successCount}件成功、${result.partialSuccessCount}件部分成功`;
                if (result.errorCount > 0) {
                    message += `、${result.errorCount}件失敗`;
                }
                this.showWarning(message);
            } else {
                // 完全な失敗の場合
                const errorMessage = result.errorCount > 0 
                    ? `${result.successCount}件成功、${result.errorCount}件失敗`
                    : result.error || '操作に失敗しました';
                this.showError(errorMessage);
            }
        }
    }

    // 警告メッセージを表示
    showWarning(message) {
        console.warn(message);
        
        // 警告トースト通知を作成
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
        toast.innerHTML = `
            <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 mr-2">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // アニメーション
        setTimeout(() => toast.classList.remove('translate-x-full'), 100);
        
        // 自動削除
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 6000);
    }

    setupFilterEventListeners(tabName) {
        // フィルター適用ボタンのイベントリスナーを設定
        const applyFilterBtn = document.getElementById(`apply${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Filter`);
        applyFilterBtn.addEventListener('click', () => this.applyFilter(tabName));
        
        // フィルターリセットボタンのイベントリスナーを設定
        const resetFilterBtn = document.getElementById(`reset${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Filter`);
        resetFilterBtn.addEventListener('click', () => this.resetFilter(tabName));
        
        // リアルタイムフィルタリングの設定
        this.setupRealTimeFiltering(tabName);
    }

    setupRealTimeFiltering(tabName) {
        // 入力フィールドにリアルタイムフィルタリングを設定
        const inputSelectors = this.getInputSelectors(tabName);
        
        inputSelectors.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                // 入力イベントでリアルタイムフィルタリング
                element.addEventListener('input', () => {
                    this.debounce(() => this.applyFilter(tabName), 300);
                });
                
                // Enterキーでフィルター適用
                element.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.applyFilter(tabName);
                    }
                });
            }
        });
    }

    getInputSelectors(tabName) {
        switch (tabName) {
            case 'blur':
                return ['#blurScoreMin', '#blurScoreMax', '#blurSizeMin', '#blurSizeMax', '#blurDateFrom', '#blurDateTo'];
            case 'similar':
                return ['#similarityMin', '#similarityMax', '#similarSizeMin', '#similarSizeMax', '#similarDateFrom', '#similarDateTo'];
            case 'error':
                return ['#errorType', '#errorSizeMin', '#errorSizeMax', '#errorDateFrom', '#errorDateTo'];
            default:
                return [];
        }
    }

    debounce(func, wait) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(func, wait);
    }

    applyFilter(tabName) {
        // フィルター値を取得
        this.updateFilterValues(tabName);
        
        // フィルタリングを実行
        const filteredData = this.filterData(tabName);
        
        // 結果を再表示
        this.displayFilteredResults(tabName, filteredData);
        
        // カウントを更新
        this.updateFilterCounts();
        
        // フィルター設定を保存
        this.saveFilterSettings();
        
        this.showSuccess(`${tabName === 'blur' ? 'ブレ画像' : tabName === 'similar' ? '類似画像' : 'エラー'}のフィルターを適用しました`);
    }

    resetFilter(tabName) {
        // フィルターをリセット
        this.resetFilterValues(tabName);
        
        // 元のデータを表示
        this.displayFilteredResults(tabName, this.originalData[tabName]);
        
        // カウントを更新
        this.updateFilterCounts();
        
        // フィルター設定を保存
        this.saveFilterSettings();
        
        this.showSuccess(`${tabName === 'blur' ? 'ブレ画像' : tabName === 'similar' ? '類似画像' : 'エラー'}のフィルターをリセットしました`);
    }

    updateFilterValues(tabName) {
        const filter = this.filters[tabName];
        
        switch (tabName) {
            case 'blur':
                filter.scoreMin = parseFloat(document.getElementById('blurScoreMin').value) || 0;
                filter.scoreMax = parseFloat(document.getElementById('blurScoreMax').value) || 100;
                filter.sizeMin = parseFloat(document.getElementById('blurSizeMin').value) || 0;
                filter.sizeMax = document.getElementById('blurSizeMax').value === '' ? Infinity : parseFloat(document.getElementById('blurSizeMax').value);
                filter.dateFrom = document.getElementById('blurDateFrom').value || null;
                filter.dateTo = document.getElementById('blurDateTo').value || null;
                break;
            case 'similar':
                filter.similarityMin = parseFloat(document.getElementById('similarityMin').value) || 0;
                filter.similarityMax = parseFloat(document.getElementById('similarityMax').value) || 100;
                filter.sizeMin = parseFloat(document.getElementById('similarSizeMin').value) || 0;
                filter.sizeMax = document.getElementById('similarSizeMax').value === '' ? Infinity : parseFloat(document.getElementById('similarSizeMax').value);
                filter.dateFrom = document.getElementById('similarDateFrom').value || null;
                filter.dateTo = document.getElementById('similarDateTo').value || null;
                break;
            case 'error':
                filter.errorType = document.getElementById('errorType').value;
                filter.sizeMin = parseFloat(document.getElementById('errorSizeMin').value) || 0;
                filter.sizeMax = document.getElementById('errorSizeMax').value === '' ? Infinity : parseFloat(document.getElementById('errorSizeMax').value);
                filter.dateFrom = document.getElementById('errorDateFrom').value || null;
                filter.dateTo = document.getElementById('errorDateTo').value || null;
                break;
        }
    }

    resetFilterValues(tabName) {
        const filter = this.filters[tabName];
        
        switch (tabName) {
            case 'blur':
                filter.scoreMin = 0;
                filter.scoreMax = 100;
                filter.sizeMin = 0;
                filter.sizeMax = Infinity;
                filter.dateFrom = null;
                filter.dateTo = null;
                break;
            case 'similar':
                filter.similarityMin = 0;
                filter.similarityMax = 100;
                filter.sizeMin = 0;
                filter.sizeMax = Infinity;
                filter.dateFrom = null;
                filter.dateTo = null;
                break;
            case 'error':
                filter.errorType = '';
                filter.sizeMin = 0;
                filter.sizeMax = Infinity;
                filter.dateFrom = null;
                filter.dateTo = null;
                break;
        }
        
        // UIも更新
        this.updateFilterContent();
    }

    filterData(tabName) {
        const originalData = this.originalData[tabName];
        const filter = this.filters[tabName];
        
        return originalData.filter(item => {
            // ブレ画像のフィルタリング
            if (tabName === 'blur') {
                const score = parseFloat(item.blurScore) || 0;
                const size = (item.size || 0) / (1024 * 1024); // MBに変換
                const date = item.modifiedDate ? new Date(item.modifiedDate) : null;
                
                if (score < filter.scoreMin || score > filter.scoreMax) return false;
                if (size < filter.sizeMin || (filter.sizeMax !== Infinity && size > filter.sizeMax)) return false;
                if (filter.dateFrom && date && date < new Date(filter.dateFrom)) return false;
                if (filter.dateTo && date && date > new Date(filter.dateTo)) return false;
            }
            
            // 類似画像のフィルタリング
            else if (tabName === 'similar') {
                const similarity = parseFloat(item.similarity) || 0;
                const size1 = (item.size1 || 0) / (1024 * 1024);
                const size2 = (item.size2 || 0) / (1024 * 1024);
                const date1 = item.modifiedDate1 ? new Date(item.modifiedDate1) : null;
                const date2 = item.modifiedDate2 ? new Date(item.modifiedDate2) : null;
                
                if (similarity < filter.similarityMin || similarity > filter.similarityMax) return false;
                if ((size1 < filter.sizeMin || (filter.sizeMax !== Infinity && size1 > filter.sizeMax)) &&
                    (size2 < filter.sizeMin || (filter.sizeMax !== Infinity && size2 > filter.sizeMax))) return false;
                if (filter.dateFrom && date1 && date1 < new Date(filter.dateFrom) && date2 && date2 < new Date(filter.dateFrom)) return false;
                if (filter.dateTo && date1 && date1 > new Date(filter.dateTo) && date2 && date2 > new Date(filter.dateTo)) return false;
            }
            
            // エラーのフィルタリング
            else if (tabName === 'error') {
                const size = (item.size || 0) / (1024 * 1024);
                const date = item.modifiedDate ? new Date(item.modifiedDate) : null;
                
                if (filter.errorType && !item.error.toLowerCase().includes(filter.errorType.toLowerCase())) return false;
                if (size < filter.sizeMin || (filter.sizeMax !== Infinity && size > filter.sizeMax)) return false;
                if (filter.dateFrom && date && date < new Date(filter.dateFrom)) return false;
                if (filter.dateTo && date && date > new Date(filter.dateTo)) return false;
            }
            
            return true;
        });
    }

    displayFilteredResults(tabName, filteredData) {
        switch (tabName) {
            case 'blur':
                this.displayBlurResults(filteredData);
                break;
            case 'similar':
                this.displaySimilarResults(filteredData);
                break;
            case 'error':
                this.displayErrorResults(filteredData);
                break;
        }
    }

    updateFilterCounts() {
        // 各タブのフィルター適用後の件数を更新
        const blurFilterCount = document.getElementById('blurFilterCount');
        const blurTotalCount = document.getElementById('blurTotalCount');
        const similarFilterCount = document.getElementById('similarFilterCount');
        const similarTotalCount = document.getElementById('similarTotalCount');
        const errorFilterCount = document.getElementById('errorFilterCount');
        const errorTotalCount = document.getElementById('errorTotalCount');
        
        if (blurFilterCount && blurTotalCount) {
            const currentBlurData = this.filterData('blur');
            blurFilterCount.textContent = currentBlurData.length;
            blurTotalCount.textContent = this.originalData.blur.length;
        }
        
        if (similarFilterCount && similarTotalCount) {
            const currentSimilarData = this.filterData('similar');
            similarFilterCount.textContent = currentSimilarData.length;
            similarTotalCount.textContent = this.originalData.similar.length;
        }
        
        if (errorFilterCount && errorTotalCount) {
            const currentErrorData = this.filterData('error');
            errorFilterCount.textContent = currentErrorData.length;
            errorTotalCount.textContent = this.originalData.error.length;
        }
    }

    showFilterHelp() {
        const helpMessage = `
フィルター機能の使い方:

【ブレ画像フィルター】
• ブレスコア範囲: ブレの度合いを0-100で指定
• ファイルサイズ: MB単位でファイルサイズを絞り込み
• 日付範囲: ファイルの更新日で絞り込み

【類似画像フィルター】
• 類似度範囲: 類似度を0-100%で指定
• ファイルサイズ: MB単位でファイルサイズを絞り込み
• 日付範囲: ファイルの更新日で絞り込み

【エラーフィルター】
• エラーの種類: 特定のエラー種類で絞り込み
• ファイルサイズ: MB単位でファイルサイズを絞り込み
• 日付範囲: ファイルの更新日で絞り込み

【便利な機能】
• リアルタイムフィルタリング: 入力中に自動でフィルター適用
• 設定の保存: フィルター設定は自動で保存されます
• キーボードショートカット: Ctrl+F(適用), Ctrl+R(リセット)
        `;
        
        this.showInfo('フィルター機能のヘルプ', helpMessage);
    }

    showInfo(title, message) {
        // 情報ダイアログを表示
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const okBtn = document.getElementById('confirmOkBtn');
        
        titleEl.textContent = title;
        messageEl.innerHTML = message.replace(/\n/g, '<br>');
        cancelBtn.style.display = 'none';
        okBtn.textContent = 'OK';
        
        modal.classList.remove('hidden');
        
        return new Promise((resolve) => {
            this.confirmResolve = resolve;
        });
    }
}

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
    
    console.log('アプリケーション初期化完了');
});

// グローバル関数（デバッグ用）
window.debugApp = () => {
    console.log('アプリケーション状態:', window.app);
    console.log('electronAPI:', window.electronAPI);
}; 