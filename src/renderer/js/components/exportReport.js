// エクスポート・レポートマネージャークラス
class ExportReportManager {
    constructor() {
        this.exportHistory = [];
        this.processingLog = [];
        this.initializeUI();
    }

    // UI初期化
    initializeUI() {
        this.createExportReportPanel();
        this.createReportPreviewDialog();
        this.createProcessingLogViewer();
        this.bindEvents();
    }

    // エクスポート・レポートパネルの作成
    createExportReportPanel() {
        const panel = document.createElement('div');
        panel.id = 'export-report-panel';
        panel.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
        
        panel.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between p-6 border-b">
                    <h2 class="text-xl font-semibold text-gray-800">エクスポート・レポート設定</h2>
                    <button id="close-export-panel" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="p-6 space-y-6">
                    <!-- エクスポート形式選択 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">エクスポート形式</label>
                        <div class="grid grid-cols-3 gap-3">
                            <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <input type="radio" name="export-format" value="csv" checked class="mr-2">
                                <span class="text-sm">CSV</span>
                            </label>
                            <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <input type="radio" name="export-format" value="json" class="mr-2">
                                <span class="text-sm">JSON</span>
                            </label>
                            <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <input type="radio" name="export-format" value="excel" class="mr-2">
                                <span class="text-sm">Excel</span>
                            </label>
                        </div>
                    </div>

                    <!-- エクスポート対象選択 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">エクスポート対象</label>
                        <div class="space-y-2">
                            <label class="flex items-center">
                                <input type="radio" name="export-target" value="current" checked class="mr-2">
                                <span class="text-sm">現在のタブ</span>
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="export-target" value="all" class="mr-2">
                                <span class="text-sm">全タブ</span>
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="export-target" value="selected" class="mr-2">
                                <span class="text-sm">選択アイテムのみ</span>
                            </label>
                        </div>
                    </div>

                    <!-- 含める情報の設定 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">含める情報</label>
                        <div class="space-y-2">
                            <label class="flex items-center">
                                <input type="checkbox" id="include-metadata" checked class="mr-2">
                                <span class="text-sm">メタデータ（ファイル名、サイズ、日時など）</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="include-statistics" checked class="mr-2">
                                <span class="text-sm">統計情報（件数、合計サイズなど）</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" id="include-processing-history" checked class="mr-2">
                                <span class="text-sm">処理履歴</span>
                            </label>
                        </div>
                    </div>

                    <!-- プレビューボタン -->
                    <div class="flex justify-between">
                        <button id="preview-report" class="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                            レポートプレビュー
                        </button>
                        <div class="space-x-3">
                            <button id="cancel-export" class="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                                キャンセル
                            </button>
                            <button id="export-report" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                                エクスポート
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }

    // レポートプレビューダイアログの作成
    createReportPreviewDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'report-preview-dialog';
        dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
        
        dialog.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between p-6 border-b">
                    <h2 class="text-xl font-semibold text-gray-800">レポートプレビュー</h2>
                    <button id="close-preview-dialog" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="p-6">
                    <div id="preview-content" class="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                        <!-- プレビュー内容がここに表示される -->
                    </div>
                    
                    <div class="flex justify-end mt-6 space-x-3">
                        <button id="close-preview" class="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                            閉じる
                        </button>
                        <button id="export-from-preview" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                            エクスポート
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
    }

    // 処理ログビューアの作成
    createProcessingLogViewer() {
        const viewer = document.createElement('div');
        viewer.id = 'processing-log-viewer';
        viewer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
        
        viewer.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between p-6 border-b">
                    <h2 class="text-xl font-semibold text-gray-800">処理ログ</h2>
                    <div class="flex items-center space-x-3">
                        <button id="clear-log" class="px-3 py-1 text-sm font-medium text-red-600 border border-red-600 rounded hover:bg-red-50">
                            クリア
                        </button>
                        <button id="export-log" class="px-3 py-1 text-sm font-medium text-blue-600 border border-blue-600 rounded hover:bg-blue-50">
                            エクスポート
                        </button>
                        <button id="close-log-viewer" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="p-6">
                    <!-- フィルター -->
                    <div class="mb-4 flex items-center space-x-4">
                        <select id="log-level-filter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                            <option value="all">すべてのレベル</option>
                            <option value="info">情報</option>
                            <option value="warning">警告</option>
                            <option value="error">エラー</option>
                        </select>
                        <input type="text" id="log-search" placeholder="ログを検索..." class="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1">
                    </div>
                    
                    <!-- ログ表示エリア -->
                    <div id="log-content" class="bg-gray-50 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
                        <!-- ログ内容がここに表示される -->
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(viewer);
    }

    // イベントバインディング
    bindEvents() {
        // エクスポート・レポートパネル
        document.getElementById('close-export-panel')?.addEventListener('click', () => this.hideExportReportPanel());
        document.getElementById('cancel-export')?.addEventListener('click', () => this.hideExportReportPanel());
        document.getElementById('preview-report')?.addEventListener('click', () => this.previewReport());
        document.getElementById('export-report')?.addEventListener('click', () => this.exportReport());

        // レポートプレビューダイアログ
        document.getElementById('close-preview-dialog')?.addEventListener('click', () => this.hideReportPreview());
        document.getElementById('close-preview')?.addEventListener('click', () => this.hideReportPreview());
        document.getElementById('export-from-preview')?.addEventListener('click', () => this.exportReport());

        // 処理ログビューア
        document.getElementById('close-log-viewer')?.addEventListener('click', () => this.hideProcessingLog());
        document.getElementById('clear-log')?.addEventListener('click', () => this.clearProcessingLog());
        document.getElementById('export-log')?.addEventListener('click', () => this.exportProcessingLog());
        document.getElementById('log-level-filter')?.addEventListener('change', () => this.filterProcessingLog());
        document.getElementById('log-search')?.addEventListener('input', () => this.filterProcessingLog());
    }

    // エクスポート・レポートパネルの表示
    showExportReportPanel() {
        document.getElementById('export-report-panel').classList.remove('hidden');
        this.updateExportSettings();
    }

    // エクスポート・レポートパネルの非表示
    hideExportReportPanel() {
        document.getElementById('export-report-panel').classList.add('hidden');
    }

    // エクスポート設定の更新
    updateExportSettings() {
        const format = document.querySelector('input[name="export-format"]:checked')?.value || 'csv';
        const target = document.querySelector('input[name="export-target"]:checked')?.value || 'current';
        const includeMetadata = document.getElementById('include-metadata')?.checked || false;
        const includeStatistics = document.getElementById('include-statistics')?.checked || false;
        const includeProcessingHistory = document.getElementById('include-processing-history')?.checked || false;

        this.exportSettings = {
            format,
            target,
            includeMetadata,
            includeStatistics,
            includeProcessingHistory
        };
    }

    // レポートプレビュー
    async previewReport() {
        this.updateExportSettings();
        const reportData = await this.generateReportData();
        const previewContent = this.formatReportForPreview(reportData);
        
        document.getElementById('preview-content').innerHTML = previewContent;
        document.getElementById('report-preview-dialog').classList.remove('hidden');
    }

    // レポートプレビューの非表示
    hideReportPreview() {
        document.getElementById('report-preview-dialog').classList.add('hidden');
    }

    // レポートデータの生成
    async generateReportData() {
        const data = {
            timestamp: new Date().toISOString(),
            settings: this.getCurrentExportSettings(),
            metadata: {},
            statistics: {},
            processingHistory: [],
            results: {}
        };

        // メタデータの追加
        if (data.settings.includeMetadata) {
            data.metadata = {
                appVersion: '1.0.0',
                scanDate: new Date().toLocaleString('ja-JP'),
                targetFolder: window.imageCleanupApp?.targetFolder || '未設定',
                outputFolder: window.imageCleanupApp?.outputFolder || '未設定'
            };
        }

        // 統計情報の追加
        if (data.settings.includeStatistics) {
            const currentTab = document.querySelector('.tab-content.active')?.id;
            data.statistics = this.getStatistics(currentTab);
        }

        // 処理履歴の追加
        if (data.settings.includeProcessingHistory) {
            data.processingHistory = this.processingLog;
        }

        // 結果データの追加
        data.results = await this.getResultsData();

        return data;
    }

    // 統計情報の取得
    getStatistics(tabName) {
        const stats = {
            totalFiles: 0,
            blurImages: 0,
            similarImages: 0,
            errors: 0,
            totalSize: 0
        };

        // 現在のタブに応じて統計を取得
        if (tabName === 'blur-tab') {
            const blurTable = document.querySelector('#blur-tab table tbody');
            if (blurTable) {
                stats.blurImages = blurTable.children.length;
                stats.totalFiles = stats.blurImages;
            }
        } else if (tabName === 'similar-tab') {
            const similarTable = document.querySelector('#similar-tab table tbody');
            if (similarTable) {
                stats.similarImages = similarTable.children.length;
                stats.totalFiles = stats.similarImages;
            }
        } else if (tabName === 'error-tab') {
            const errorTable = document.querySelector('#error-tab table tbody');
            if (errorTable) {
                stats.errors = errorTable.children.length;
                stats.totalFiles = stats.errors;
            }
        }

        return stats;
    }

    // 結果データの取得
    async getResultsData() {
        const results = {
            blurImages: [],
            similarImages: [],
            errors: []
        };

        // 現在のタブのデータを取得
        const currentTab = document.querySelector('.tab-content.active')?.id;
        
        if (currentTab === 'blur-tab') {
            results.blurImages = this.getTableData('#blur-tab table tbody');
        } else if (currentTab === 'similar-tab') {
            results.similarImages = this.getTableData('#similar-tab table tbody');
        } else if (currentTab === 'error-tab') {
            results.errors = this.getTableData('#error-tab table tbody');
        }

        return results;
    }

    // テーブルデータの取得
    getTableData(selector) {
        const table = document.querySelector(selector);
        if (!table) return [];

        const rows = Array.from(table.children);
        return rows.map(row => {
            const cells = Array.from(row.children);
            return {
                filename: cells[0]?.textContent || '',
                size: cells[1]?.textContent || '',
                date: cells[2]?.textContent || '',
                score: cells[3]?.textContent || '',
                selected: cells[0]?.querySelector('input[type="checkbox"]')?.checked || false
            };
        });
    }

    // プレビュー用フォーマット
    formatReportForPreview(data) {
        let preview = '<div class="space-y-4">';
        
        // ヘッダー
        preview += '<div class="border-b pb-2">';
        preview += '<h3 class="font-bold text-lg">画像整理レポート</h3>';
        preview += `<p class="text-sm text-gray-600">生成日時: ${new Date(data.timestamp).toLocaleString('ja-JP')}</p>`;
        preview += '</div>';

        // メタデータ
        if (data.metadata && Object.keys(data.metadata).length > 0) {
            preview += '<div class="border-b pb-2">';
            preview += '<h4 class="font-semibold mb-2">メタデータ</h4>';
            for (const [key, value] of Object.entries(data.metadata)) {
                preview += `<p class="text-sm"><span class="font-medium">${key}:</span> ${value}</p>`;
            }
            preview += '</div>';
        }

        // 統計情報
        if (data.statistics && Object.keys(data.statistics).length > 0) {
            preview += '<div class="border-b pb-2">';
            preview += '<h4 class="font-semibold mb-2">統計情報</h4>';
            for (const [key, value] of Object.entries(data.statistics)) {
                preview += `<p class="text-sm"><span class="font-medium">${key}:</span> ${value}</p>`;
            }
            preview += '</div>';
        }

        // 結果データ
        if (data.results) {
            preview += '<div class="border-b pb-2">';
            preview += '<h4 class="font-semibold mb-2">結果データ</h4>';
            
            if (data.results.blurImages && data.results.blurImages.length > 0) {
                preview += `<p class="text-sm font-medium">ブレ画像: ${data.results.blurImages.length}件</p>`;
            }
            if (data.results.similarImages && data.results.similarImages.length > 0) {
                preview += `<p class="text-sm font-medium">類似画像: ${data.results.similarImages.length}件</p>`;
            }
            if (data.results.errors && data.results.errors.length > 0) {
                preview += `<p class="text-sm font-medium">エラー: ${data.results.errors.length}件</p>`;
            }
            preview += '</div>';
        }

        // 処理履歴
        if (data.processingHistory && data.processingHistory.length > 0) {
            preview += '<div>';
            preview += '<h4 class="font-semibold mb-2">処理履歴</h4>';
            data.processingHistory.slice(-10).forEach(log => {
                preview += `<p class="text-sm text-gray-600">${log.timestamp}: ${log.message}</p>`;
            });
            preview += '</div>';
        }

        preview += '</div>';
        return preview;
    }

    // レポートのエクスポート
    async exportReport() {
        try {
            this.updateExportSettings();
            const reportData = await this.generateReportData();
            
            let content = '';
            let filename = `image-cleanup-report-${new Date().toISOString().split('T')[0]}`;
            
            switch (this.getCurrentExportSettings().format) {
                case 'csv':
                    content = this.convertToCSV(reportData);
                    filename += '.csv';
                    break;
                case 'json':
                    content = JSON.stringify(reportData, null, 2);
                    filename += '.json';
                    break;
                case 'excel':
                    content = this.convertToExcel(reportData);
                    filename += '.xlsx';
                    break;
            }

            // ファイル保存ダイアログを表示
            const saved = await window.electronAPI.saveFile({
                content,
                filename,
                filters: [
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'CSV Files', extensions: ['csv'] },
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'Excel Files', extensions: ['xlsx'] }
                ]
            });

            if (saved) {
                this.addProcessingLog('info', `レポートをエクスポートしました: ${filename}`);
                this.exportHistory.push({
                    timestamp: new Date().toISOString(),
                    filename,
                    format: this.getCurrentExportSettings().format,
                    target: this.getCurrentExportSettings().target
                });
                this.hideExportReportPanel();
                this.hideReportPreview();
                this.showNotification('レポートのエクスポートが完了しました', 'success');
            }
        } catch (error) {
            console.error('エクスポートエラー:', error);
            this.addProcessingLog('error', `エクスポートエラー: ${error.message}`);
            this.showNotification('エクスポート中にエラーが発生しました', 'error');
        }
    }

    // CSV形式への変換
    convertToCSV(data) {
        const rows = [];
        
        // ヘッダー
        rows.push(['画像整理レポート']);
        rows.push(['生成日時', new Date(data.timestamp).toLocaleString('ja-JP')]);
        rows.push([]);

        // メタデータ
        if (data.metadata && Object.keys(data.metadata).length > 0) {
            rows.push(['メタデータ']);
            for (const [key, value] of Object.entries(data.metadata)) {
                rows.push([key, value]);
            }
            rows.push([]);
        }

        // 統計情報
        if (data.statistics && Object.keys(data.statistics).length > 0) {
            rows.push(['統計情報']);
            for (const [key, value] of Object.entries(data.statistics)) {
                rows.push([key, value]);
            }
            rows.push([]);
        }

        // 結果データ
        if (data.results) {
            if (data.results.blurImages && data.results.blurImages.length > 0) {
                rows.push(['ブレ画像']);
                rows.push(['ファイル名', 'サイズ', '日時', 'ブレスコア', '選択状態']);
                data.results.blurImages.forEach(item => {
                    rows.push([item.filename, item.size, item.date, item.score, item.selected ? '選択' : '未選択']);
                });
                rows.push([]);
            }

            if (data.results.similarImages && data.results.similarImages.length > 0) {
                rows.push(['類似画像']);
                rows.push(['ファイル名1', 'ファイル名2', '類似度', '選択状態']);
                data.results.similarImages.forEach(item => {
                    rows.push([item.filename, item.size, item.date, item.score, item.selected ? '選択' : '未選択']);
                });
                rows.push([]);
            }

            if (data.results.errors && data.results.errors.length > 0) {
                rows.push(['エラー']);
                rows.push(['ファイル名', 'エラー内容']);
                data.results.errors.forEach(item => {
                    rows.push([item.filename, item.size]);
                });
                rows.push([]);
            }
        }

        return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    // Excel形式への変換（簡易版）
    convertToExcel(data) {
        // 簡易的なExcel形式（実際の実装ではxlsxライブラリを使用）
        return this.convertToCSV(data); // 一時的にCSV形式で返す
    }

    // 処理ログの表示
    showProcessingLog() {
        this.updateProcessingLogDisplay();
        document.getElementById('processing-log-viewer').classList.remove('hidden');
    }

    // 処理ログの非表示
    hideProcessingLog() {
        document.getElementById('processing-log-viewer').classList.add('hidden');
    }

    // 処理ログの追加
    addProcessingLog(level, message) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message
        };
        
        this.processingLog.push(logEntry);
        
        // ログが多すぎる場合は古いものを削除
        if (this.processingLog.length > 1000) {
            this.processingLog = this.processingLog.slice(-500);
        }
        
        // ログビューアが表示されている場合は更新
        if (!document.getElementById('processing-log-viewer').classList.contains('hidden')) {
            this.updateProcessingLogDisplay();
        }
    }

    // 処理ログの表示更新
    updateProcessingLogDisplay() {
        const logContent = document.getElementById('log-content');
        const levelFilter = document.getElementById('log-level-filter')?.value || 'all';
        const searchTerm = document.getElementById('log-search')?.value || '';

        let filteredLogs = this.processingLog;

        // レベルフィルター
        if (levelFilter !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.level === levelFilter);
        }

        // 検索フィルター
        if (searchTerm) {
            filteredLogs = filteredLogs.filter(log => 
                log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.timestamp.includes(searchTerm)
            );
        }

        // 最新のログから表示
        filteredLogs = filteredLogs.slice(-100);

        let logHTML = '';
        filteredLogs.forEach(log => {
            const levelClass = {
                'info': 'text-blue-600',
                'warning': 'text-yellow-600',
                'error': 'text-red-600'
            }[log.level] || 'text-gray-600';

            logHTML += `
                <div class="mb-1">
                    <span class="text-gray-500">${new Date(log.timestamp).toLocaleString('ja-JP')}</span>
                    <span class="mx-2 ${levelClass}">[${log.level.toUpperCase()}]</span>
                    <span>${log.message}</span>
                </div>
            `;
        });

        logContent.innerHTML = logHTML;
        logContent.scrollTop = logContent.scrollHeight;
    }

    // 処理ログのフィルタリング
    filterProcessingLog() {
        this.updateProcessingLogDisplay();
    }

    // 処理ログのクリア
    clearProcessingLog() {
        if (confirm('すべての処理ログを削除しますか？')) {
            this.processingLog = [];
            this.updateProcessingLogDisplay();
            this.showNotification('処理ログをクリアしました', 'info');
        }
    }

    // 処理ログのエクスポート
    async exportProcessingLog() {
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                logs: this.processingLog
            };

            const content = JSON.stringify(logData, null, 2);
            const filename = `processing-log-${new Date().toISOString().split('T')[0]}.json`;

            const saved = await window.electronAPI.saveFile({
                content,
                filename,
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (saved) {
                this.showNotification('処理ログをエクスポートしました', 'success');
            }
        } catch (error) {
            console.error('ログエクスポートエラー:', error);
            this.showNotification('ログエクスポート中にエラーが発生しました', 'error');
        }
    }

    // 通知の表示
    showNotification(message, type = 'info') {
        // 既存の通知システムを使用
        if (window.imageCleanupApp && window.imageCleanupApp.showNotification) {
            window.imageCleanupApp.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    // エクスポート履歴の取得
    getExportHistory() {
        return this.exportHistory;
    }

    // 処理ログの取得
    getProcessingLog() {
        return this.processingLog;
    }

    // 設定値取得用のヘルパー
    getCurrentExportSettings() {
        if (window.settingsManager && window.settingsManager.settings) {
            return {
                format: window.settingsManager.settings.exportFormat,
                target: window.settingsManager.settings.exportTarget,
                includeMetadata: window.settingsManager.settings.includeMetadata,
                includeStatistics: window.settingsManager.settings.includeStatistics,
                includeProcessingHistory: window.settingsManager.settings.includeProcessingHistory
            };
        } else {
            // 万一設定が取得できない場合のデフォルト
            return {
                format: 'csv',
                target: 'current',
                includeMetadata: true,
                includeStatistics: true,
                includeProcessingHistory: true
            };
        }
    }
}

// グローバルにエクスポート
window.ExportReportManager = ExportReportManager; 