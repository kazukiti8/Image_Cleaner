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
        this.currentResults = null;
        this.originalData = {
            blur: [],
            similar: [],
            error: []
        };
        this.filters = {
            blur: { minScore: 0, maxScore: 100, minSize: 0, maxSize: 100 },
            similar: { similarityMin: 0, similarityMax: 100, type: '', minSize: 0, maxSize: 100 },
            error: { minSize: 0, maxSize: 100 }
        };
        this.settingsManager = null;
        this.init();
    }

    async init() {
        // 設定マネージャーを初期化
        this.settingsManager = new SettingsManager();
        
        this.bindEvents();
        this.updateUI();
    }

    getSettings() {
        return this.settingsManager ? this.settingsManager.getSettings() : null;
    }

    bindEvents() {
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
        
        // スキャン関連のイベントリスナー
        window.electronAPI.onScanProgress((progress) => this.updateScanProgress(progress));
        window.electronAPI.onScanComplete((results) => this.handleScanComplete(results));
        window.electronAPI.onScanError((error) => this.handleScanError(error));
        
        // ファイル操作関連のイベントリスナー
        window.electronAPI.onFileOperationProgress((progress) => this.updateFileOperationProgress(progress));
        window.electronAPI.onFileOperationComplete((result) => this.handleFileOperationComplete(result));
        
        // モーダル関連
        this.initializeModalListeners();
        
        // 倍率調整
        this.initializeZoomControls();
        
        // キーボードショートカット
        this.initializeKeyboardShortcuts();
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
        console.log('結果の詳細構造:');
        console.log('- blurImages:', results.blurImages);
        console.log('- similarImages:', results.similarImages);
        console.log('- errors:', results.errors);
        
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
        
        console.log('保存されたデータ:');
        console.log('- originalData.blur:', this.originalData.blur);
        console.log('- originalData.similar:', this.originalData.similar);
        console.log('- originalData.error:', this.originalData.error);
        
        // 結果を表示
        this.displayBlurResults(this.originalData.blur);
        this.displaySimilarResults(this.originalData.similar);
        this.displayErrorResults(this.originalData.error);
        
        // 成功メッセージを表示
        const totalCount = (results.blurImages?.length || 0) + (results.similarImages?.length || 0) + (results.errors?.length || 0);
        this.showSuccess(`スキャン完了: ブレ ${results.blurImages?.length || 0}件, 類似 ${results.similarImages?.length || 0}件, エラー ${results.errors?.length || 0}件`);
        
        // フィルターカウントを更新
        this.updateFilterCounts();
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
        // タブボタンの状態を更新
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('tab-active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('tab-active');
        
        // タブコンテンツの表示を切り替え
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).style.display = 'block';
        
        this.currentTab = tabName;
        this.updateFilterContent();
        this.updateSelectedCount();
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
    }

    getDisplayPath(path) {
        if (!path) return '';
        const parts = path.split(/[\\/]/);
        if (parts.length <= 2) return path;
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
        // エラーメッセージを表示する実装
    }

    showSuccess(message) {
        console.log(message);
        // 成功メッセージを表示する実装
    }

    // 結果表示メソッド
    displayBlurResults(blurImages) {
        console.log('displayBlurResults呼び出し:', blurImages);
        const container = document.getElementById('contentBlur');
        const countElement = document.getElementById('countBlur');
        
        console.log('container:', container);
        console.log('countElement:', countElement);
        
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
        console.log('displaySimilarResults呼び出し:', similarImages);
        const container = document.getElementById('contentSimilar');
        const countElement = document.getElementById('countSimilar');
        
        console.log('container:', container);
        console.log('countElement:', countElement);
        
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
        console.log('displayErrorResults呼び出し:', errors);
        const container = document.getElementById('contentError');
        const countElement = document.getElementById('countError');
        
        console.log('container:', container);
        console.log('countElement:', countElement);
        
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
            </tr>`;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // イベントリスナーを設定
        this.setupCheckboxListeners(table);
        
        return table;
    }

    createSimilarTable(similarImages) {
        console.log('createSimilarTable呼び出し:', similarImages);
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
                <th class="p-2 text-left">タイプ</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // ボディ
        const tbody = document.createElement('tbody');
        similarImages.forEach((pair, index) => {
            console.log(`類似画像ペア ${index}:`, pair);
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-100 hover:bg-slate-50';
            
            // 新しいデータ構造に対応
            if (!pair.files || pair.files.length < 2) {
                console.warn('無効な類似画像データ:', pair);
                return; // このアイテムをスキップ
            }
            
            const file1 = pair.files[0];
            const file2 = pair.files[1];
            const similarity = pair.similarity || 0;
            const type = pair.type || 'similar';
            
            console.log(`ファイル1:`, file1);
            console.log(`ファイル2:`, file2);
            console.log(`類似度:`, similarity);
            console.log(`タイプ:`, type);
            
            // 最初のファイルをプレビュー用に設定
            row.dataset.filePath = file1.filePath;
            
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
            
            row.innerHTML = `
                <td class="p-2">
                    <input type="checkbox" value="${file1.filePath}" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                </td>
                <td class="p-2 font-medium text-slate-800">${file1.filename}</td>
                <td class="p-2 font-medium text-slate-800">${file2.filename}</td>
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
            </tr>`;
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
            </tr>`;
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

    initializeKeyboardShortcuts() {
        // キーボードショートカットの初期化
    }

    updateFilterContent() {
        // フィルターコンテンツの更新
    }

    updateFilterCounts() {
        // フィルターカウントの更新
    }

    showFilterHelp() {
        // フィルターヘルプの表示
    }

    openSettings() {
        // 設定画面を開く
    }

    moveToTrash() {
        // ゴミ箱に移動
    }

    deletePermanently() {
        // 完全削除
    }

    moveFiles() {
        // ファイル移動
    }

    updateFileOperationProgress(progress) {
        // ファイル操作の進捗更新
    }

    handleFileOperationComplete(result) {
        // ファイル操作完了の処理
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