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
        this.filteredData = {
            blur: [],
            similar: [],
            error: []
        };
        this.currentFilters = {
            blur: { minScore: 0, maxScore: 100 },
            similar: { minScore: 0, maxScore: 100 },
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
        
        this.init();
    }

    async init() {
        // 設定マネージャーを初期化
        this.settingsManager = new SettingsManager();
        
        this.bindEvents();
        this.updateUI();
        
        // 初回起動時ガイダンスの確認
        await this.checkFirstTimeGuide();
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
        // タブボタンの状態を更新
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('tab-active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('tab-active');
        
        // タブコンテンツの表示を切り替え
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).style.display = 'block';
        
        this.currentTab = tabName;
        this.updateFilterContent();
        this.updateSelectedCount();
        
        // アクションボタンの表示切り替え
        const normalActions = document.getElementById('normalActions');
        const errorActions = document.getElementById('errorActions');
        if (tabName === 'error') {
            if (normalActions) normalActions.style.display = 'none';
            if (errorActions) errorActions.style.display = '';
        } else {
            if (normalActions) normalActions.style.display = '';
            if (errorActions) errorActions.style.display = 'none';
        }
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
            
            // 行クリック時のプレビュー表示（チェックボックス以外をクリックした場合）
            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    // 最初のファイルをプレビュー表示
                    this.showImagePreview(file1);
                }
            });
            
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

    initializeKeyboardShortcuts() {
        // キーボードショートカットの初期化
        document.addEventListener('keydown', (e) => {
            // Ctrl+F: フィルター適用
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.applyFilter();
            }
            
            // Ctrl+R: フィルターリセット
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.resetFilter();
            }
            
            // Ctrl+Shift+F: フィルターパネルにフォーカス
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                const filterInput = document.getElementById('blurMinScore');
                if (filterInput) {
                    filterInput.focus();
                }
            }
            
            // ESC: 選択解除
            if (e.key === 'Escape') {
                this.deselectAll();
            }
            
            // Ctrl+A: 全選択
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.selectAll();
            }
        });
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
        if (similarMinScore && similarMaxScore) {
            similarMinScore.value = this.currentFilters.similar.minScore;
            similarMaxScore.value = this.currentFilters.similar.maxScore;
        }
        
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
        console.log('フィルターをリセットします');
        
        // フィルター値をデフォルトにリセット
        this.currentFilters = {
            blur: { minScore: 0, maxScore: 100 },
            similar: { minScore: 0, maxScore: 100 },
            error: { 
                fileNotFound: true, 
                permissionDenied: true, 
                corrupted: true, 
                unsupported: true 
            }
        };
        
        // UIを更新
        this.updateFilterUI();
        
        // フィルタリングを実行
        this.performFiltering();
        
        // 結果を表示
        this.displayFilteredResults();
        
        this.showSuccess('フィルターをリセットしました');
    }

    updateCurrentFilters() {
        // ブレ画像フィルター
        const blurMinScore = document.getElementById('blurMinScore');
        const blurMaxScore = document.getElementById('blurMaxScore');
        if (blurMinScore && blurMaxScore) {
            this.currentFilters.blur.minScore = parseInt(blurMinScore.value) || 0;
            this.currentFilters.blur.maxScore = parseInt(blurMaxScore.value) || 100;
        }
        
        // 類似画像フィルター
        const similarMinScore = document.getElementById('similarMinScore');
        const similarMaxScore = document.getElementById('similarMaxScore');
        if (similarMinScore && similarMaxScore) {
            this.currentFilters.similar.minScore = parseInt(similarMinScore.value) || 0;
            this.currentFilters.similar.maxScore = parseInt(similarMaxScore.value) || 100;
        }
        
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
        // ブレ画像のフィルタリング
        this.filteredData.blur = this.originalData.blur.filter(item => {
            const score = parseFloat(item.blurScore) || 0;
            return score >= this.currentFilters.blur.minScore && 
                   score <= this.currentFilters.blur.maxScore;
        });
        
        // 類似画像のフィルタリング
        this.filteredData.similar = this.originalData.similar.filter(item => {
            const score = parseFloat(item.similarityScore) || 0;
            return score >= this.currentFilters.similar.minScore && 
                   score <= this.currentFilters.similar.maxScore;
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
        
        console.log('フィルタリング結果:', {
            blur: this.filteredData.blur.length,
            similar: this.filteredData.similar.length,
            error: this.filteredData.error.length
        });
    }

    displayFilteredResults() {
        // 現在のタブに応じてフィルタリング結果を表示
        switch (this.currentTab) {
            case 'blur':
                this.displayBlurResults(this.filteredData.blur);
                break;
            case 'similar':
                this.displaySimilarResults(this.filteredData.similar);
                break;
            case 'error':
                this.displayErrorResults(this.filteredData.error);
                break;
        }
        
        // カウントを更新
        this.updateFilterCounts();
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
        document.getElementById('applyFilter').addEventListener('click', () => this.applyFilter());
        document.getElementById('resetFilter').addEventListener('click', () => this.resetFilter());
        
        // フィルター入力フィールドのEnterキーイベント
        const filterInputs = [
            'blurMinScore', 'blurMaxScore',
            'similarMinScore', 'similarMaxScore'
        ];
        
        filterInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.applyFilter();
                    }
                });
            }
        });
        
        // エラーフィルターのチェックボックス
        const errorCheckboxes = [
            'errorFileNotFound', 'errorPermissionDenied', 
            'errorCorrupted', 'errorUnsupported'
        ];
        
        errorCheckboxes.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.updateErrorFilter());
            }
        });
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