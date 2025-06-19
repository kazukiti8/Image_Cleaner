// エクスポート・レポート機能
export class ExportReportManager {
    constructor() {
        this.exportData = [];
        this.processingLog = [];
        this.exportHistory = [];
        this.currentReport = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // エクスポート・レポートパネルの表示/非表示
        document.getElementById('showExportReport')?.addEventListener('click', () => {
            this.showExportReportPanel();
        });

        document.getElementById('closeExportReport')?.addEventListener('click', () => {
            this.hideExportReportPanel();
        });

        // エクスポート設定の変更
        document.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateExportPreview();
            });
        });

        document.querySelectorAll('#exportCurrentTab, #exportAllTabs, #exportSelected').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateExportItemCount();
            });
        });

        // エクスポート・レポートボタン
        document.getElementById('exportData')?.addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('previewReport')?.addEventListener('click', () => {
            this.previewReport();
        });

        document.getElementById('generateReport')?.addEventListener('click', () => {
            this.generateReport();
        });

        // レポートプレビューダイアログ
        document.getElementById('closeReportPreview')?.addEventListener('click', () => {
            this.hideReportPreview();
        });

        document.getElementById('exportFromPreview')?.addEventListener('click', () => {
            this.exportFromPreview();
        });

        // 処理ログビューア
        document.getElementById('showProcessingLog')?.addEventListener('click', () => {
            this.showProcessingLog();
        });

        document.getElementById('closeProcessingLog')?.addEventListener('click', () => {
            this.hideProcessingLog();
        });

        document.getElementById('exportLog')?.addEventListener('click', () => {
            this.exportProcessingLog();
        });

        document.getElementById('clearLog')?.addEventListener('click', () => {
            this.clearProcessingLog();
        });

        document.getElementById('applyLogFilter')?.addEventListener('click', () => {
            this.applyLogFilter();
        });

        // 初期化
        this.updateExportItemCount();
    }

    showExportReportPanel() {
        document.getElementById('exportReportPanel').classList.remove('hidden');
        this.updateExportItemCount();
        this.updateExportPreview();
    }

    hideExportReportPanel() {
        document.getElementById('exportReportPanel').classList.add('hidden');
    }

    updateExportItemCount() {
        const currentTab = document.getElementById('exportCurrentTab').checked;
        const allTabs = document.getElementById('exportAllTabs').checked;
        const selectedOnly = document.getElementById('exportSelected').checked;

        let count = 0;

        if (selectedOnly) {
            // 選択されたアイテムのみ
            const selectedItems = document.querySelectorAll('.file-item.selected, .duplicate-item.selected, .error-item.selected');
            count = selectedItems.length;
        } else if (allTabs) {
            // 全タブ
            const allItems = document.querySelectorAll('.file-item, .duplicate-item, .error-item');
            count = allItems.length;
        } else if (currentTab) {
            // 現在のタブ
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const items = activeTab.querySelectorAll('.file-item, .duplicate-item, .error-item');
                count = items.length;
            }
        }

        document.getElementById('exportItemCount').textContent = count;
    }

    updateExportPreview() {
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        const includeStats = document.getElementById('includeStats').checked;
        const includeMetadata = document.getElementById('includeMetadata').checked;
        const includeProcessingHistory = document.getElementById('includeProcessingHistory').checked;

        // プレビュー用のデータを準備
        this.prepareExportData();
    }

    prepareExportData() {
        const currentTab = document.getElementById('exportCurrentTab').checked;
        const allTabs = document.getElementById('exportAllTabs').checked;
        const selectedOnly = document.getElementById('exportSelected').checked;

        this.exportData = [];

        if (selectedOnly) {
            // 選択されたアイテムのみ
            const selectedItems = document.querySelectorAll('.file-item.selected, .duplicate-item.selected, .error-item.selected');
            selectedItems.forEach(item => {
                this.exportData.push(this.extractItemData(item));
            });
        } else if (allTabs) {
            // 全タブ
            const allItems = document.querySelectorAll('.file-item, .duplicate-item, .error-item');
            allItems.forEach(item => {
                this.exportData.push(this.extractItemData(item));
            });
        } else if (currentTab) {
            // 現在のタブ
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const items = activeTab.querySelectorAll('.file-item, .duplicate-item, .error-item');
                items.forEach(item => {
                    this.exportData.push(this.extractItemData(item));
                });
            }
        }
    }

    extractItemData(item) {
        const data = {
            type: this.getItemType(item),
            path: item.dataset.path || '',
            filename: item.dataset.filename || '',
            size: item.dataset.size || '',
            resolution: item.dataset.resolution || '',
            status: item.dataset.status || '',
            timestamp: new Date().toISOString()
        };

        // メタデータを含める場合
        if (document.getElementById('includeMetadata').checked) {
            data.metadata = {
                created: item.dataset.created || '',
                modified: item.dataset.modified || '',
                fileType: item.dataset.fileType || '',
                dimensions: item.dataset.dimensions || '',
                fileSize: item.dataset.fileSize || ''
            };
        }

        return data;
    }

    getItemType(item) {
        if (item.classList.contains('file-item')) return 'file';
        if (item.classList.contains('duplicate-item')) return 'duplicate';
        if (item.classList.contains('error-item')) return 'error';
        return 'unknown';
    }

    async exportData() {
        try {
            this.prepareExportData();
            const format = document.querySelector('input[name="exportFormat"]:checked').value;
            const includeStats = document.getElementById('includeStats').checked;
            const includeMetadata = document.getElementById('includeMetadata').checked;
            const includeProcessingHistory = document.getElementById('includeProcessingHistory').checked;

            const exportData = {
                items: this.exportData,
                exportInfo: {
                    timestamp: new Date().toISOString(),
                    format: format,
                    totalItems: this.exportData.length
                }
            };

            if (includeStats) {
                exportData.statistics = this.generateStatistics();
            }

            if (includeProcessingHistory) {
                exportData.processingHistory = this.processingLog;
            }

            let content = '';
            let filename = `image_cleaner_export_${new Date().toISOString().split('T')[0]}`;

            switch (format) {
                case 'csv':
                    content = this.convertToCSV(exportData);
                    filename += '.csv';
                    break;
                case 'json':
                    content = JSON.stringify(exportData, null, 2);
                    filename += '.json';
                    break;
                case 'excel':
                    content = this.convertToExcel(exportData);
                    filename += '.xlsx';
                    break;
            }

            // ElectronのIPCを使用してファイル保存ダイアログを表示
            const result = await window.electronAPI.saveFile({
                content: content,
                filename: filename,
                filters: this.getFileFilters(format)
            });

            if (result.success) {
                this.addLogEntry('success', `エクスポートが完了しました: ${result.filePath}`);
                this.addToExportHistory({
                    timestamp: new Date().toISOString(),
                    format: format,
                    itemCount: this.exportData.length,
                    filePath: result.filePath
                });
            } else {
                this.addLogEntry('error', 'エクスポートに失敗しました');
            }

        } catch (error) {
            console.error('Export error:', error);
            this.addLogEntry('error', `エクスポートエラー: ${error.message}`);
        }
    }

    convertToCSV(data) {
        const headers = ['Type', 'Filename', 'Path', 'Size', 'Resolution', 'Status', 'Timestamp'];
        const rows = [headers.join(',')];

        data.items.forEach(item => {
            const row = [
                item.type,
                `"${item.filename}"`,
                `"${item.path}"`,
                item.size,
                item.resolution,
                item.status,
                item.timestamp
            ];
            rows.push(row.join(','));
        });

        return rows.join('\n');
    }

    convertToExcel(data) {
        // Excel形式の変換（簡易版）
        // 実際の実装ではxlsxライブラリを使用
        return this.convertToCSV(data);
    }

    getFileFilters(format) {
        switch (format) {
            case 'csv':
                return [{ name: 'CSV Files', extensions: ['csv'] }];
            case 'json':
                return [{ name: 'JSON Files', extensions: ['json'] }];
            case 'excel':
                return [{ name: 'Excel Files', extensions: ['xlsx'] }];
            default:
                return [{ name: 'All Files', extensions: ['*'] }];
        }
    }

    generateStatistics() {
        const stats = {
            totalFiles: this.exportData.length,
            byType: {},
            byStatus: {},
            totalSize: 0,
            averageSize: 0
        };

        this.exportData.forEach(item => {
            // タイプ別統計
            stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

            // ステータス別統計
            stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;

            // サイズ統計
            const size = parseInt(item.size) || 0;
            stats.totalSize += size;
        });

        stats.averageSize = stats.totalFiles > 0 ? stats.totalSize / stats.totalFiles : 0;

        return stats;
    }

    async generateReport() {
        try {
            this.prepareExportData();
            const includeStats = document.getElementById('includeStats').checked;
            const includeMetadata = document.getElementById('includeMetadata').checked;
            const includeProcessingHistory = document.getElementById('includeProcessingHistory').checked;

            this.currentReport = {
                timestamp: new Date().toISOString(),
                items: this.exportData,
                statistics: includeStats ? this.generateStatistics() : null,
                processingHistory: includeProcessingHistory ? this.processingLog : null
            };

            this.addLogEntry('success', 'レポートが生成されました');
            this.updateExportItemCount();

        } catch (error) {
            console.error('Report generation error:', error);
            this.addLogEntry('error', `レポート生成エラー: ${error.message}`);
        }
    }

    previewReport() {
        if (!this.currentReport) {
            this.generateReport();
        }

        this.showReportPreview();
    }

    showReportPreview() {
        const dialog = document.getElementById('reportPreviewDialog');
        const navigation = document.getElementById('reportNavigation');
        const content = document.getElementById('reportContent');

        // ナビゲーションを生成
        navigation.innerHTML = this.generateReportNavigation();

        // コンテンツを生成
        content.innerHTML = this.generateReportContent();

        dialog.classList.remove('hidden');

        // ナビゲーションイベントを設定
        this.setupReportNavigation();
    }

    hideReportPreview() {
        document.getElementById('reportPreviewDialog').classList.add('hidden');
    }

    generateReportNavigation() {
        const sections = [
            { id: 'summary', title: 'サマリー' },
            { id: 'items', title: 'アイテム一覧' },
            { id: 'statistics', title: '統計情報' },
            { id: 'processing', title: '処理履歴' }
        ];

        return sections.map(section => `
            <a href="#${section.id}" class="report-navigation-item" data-section="${section.id}">
                ${section.title}
            </a>
        `).join('');
    }

    generateReportContent() {
        if (!this.currentReport) return '<p>レポートが生成されていません</p>';

        return `
            <div id="summary" class="report-section">
                <h4>サマリー</h4>
                <div class="report-summary">
                    <div class="stats-card">
                        <h5>総アイテム数</h5>
                        <div class="stats-value">${this.currentReport.items.length}</div>
                    </div>
                    <div class="stats-card">
                        <h5>処理日時</h5>
                        <div class="stats-value">${new Date(this.currentReport.timestamp).toLocaleString()}</div>
                    </div>
                    ${this.currentReport.statistics ? `
                        <div class="stats-card">
                            <h5>総サイズ</h5>
                            <div class="stats-value">${this.formatFileSize(this.currentReport.statistics.totalSize)}</div>
                        </div>
                        <div class="stats-card">
                            <h5>平均サイズ</h5>
                            <div class="stats-value">${this.formatFileSize(this.currentReport.statistics.averageSize)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div id="items" class="report-section">
                <h4>アイテム一覧</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>タイプ</th>
                            <th>ファイル名</th>
                            <th>サイズ</th>
                            <th>解像度</th>
                            <th>ステータス</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.currentReport.items.map(item => `
                            <tr>
                                <td>${item.type}</td>
                                <td>${item.filename}</td>
                                <td>${item.size}</td>
                                <td>${item.resolution}</td>
                                <td>${item.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${this.currentReport.statistics ? `
                <div id="statistics" class="report-section">
                    <h4>統計情報</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="chart-container">
                            <h5>タイプ別分布</h5>
                            <div class="space-y-2">
                                ${Object.entries(this.currentReport.statistics.byType).map(([type, count]) => `
                                    <div class="flex justify-between">
                                        <span>${type}</span>
                                        <span class="font-medium">${count}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="chart-container">
                            <h5>ステータス別分布</h5>
                            <div class="space-y-2">
                                ${Object.entries(this.currentReport.statistics.byStatus).map(([status, count]) => `
                                    <div class="flex justify-between">
                                        <span>${status}</span>
                                        <span class="font-medium">${count}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}

            ${this.currentReport.processingHistory ? `
                <div id="processing" class="report-section">
                    <h4>処理履歴</h4>
                    <div class="processing-timeline">
                        ${this.currentReport.processingHistory.map(log => `
                            <div class="timeline-item">
                                <div class="timeline-icon ${log.level}">${log.level.charAt(0).toUpperCase()}</div>
                                <div class="timeline-content">
                                    <div class="timeline-title">${log.message}</div>
                                    <div class="timeline-time">${new Date(log.timestamp).toLocaleString()}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    setupReportNavigation() {
        const navItems = document.querySelectorAll('.report-navigation-item');
        const sections = document.querySelectorAll('.report-section');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.dataset.section;

                // アクティブクラスを更新
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // セクションを表示
                sections.forEach(section => {
                    if (section.id === targetId) {
                        section.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });
        });

        // 最初のアイテムをアクティブにする
        if (navItems.length > 0) {
            navItems[0].classList.add('active');
        }
    }

    exportFromPreview() {
        this.exportData();
        this.hideReportPreview();
    }

    showProcessingLog() {
        const dialog = document.getElementById('processingLogDialog');
        const logContent = document.getElementById('logContent');

        logContent.innerHTML = this.generateLogContent();
        dialog.classList.remove('hidden');
    }

    hideProcessingLog() {
        document.getElementById('processingLogDialog').classList.add('hidden');
    }

    generateLogContent() {
        return this.processingLog.map(log => `
            <div class="log-entry ${log.level}">
                <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
                <span class="log-level">[${log.level.toUpperCase()}]</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
    }

    async exportProcessingLog() {
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                logs: this.processingLog
            };

            const content = JSON.stringify(logData, null, 2);
            const filename = `processing_log_${new Date().toISOString().split('T')[0]}.json`;

            const result = await window.electronAPI.saveFile({
                content: content,
                filename: filename,
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });

            if (result.success) {
                this.addLogEntry('success', `ログエクスポートが完了しました: ${result.filePath}`);
            } else {
                this.addLogEntry('error', 'ログエクスポートに失敗しました');
            }

        } catch (error) {
            console.error('Log export error:', error);
            this.addLogEntry('error', `ログエクスポートエラー: ${error.message}`);
        }
    }

    clearProcessingLog() {
        this.processingLog = [];
        this.addLogEntry('info', '処理ログがクリアされました');
        this.hideProcessingLog();
    }

    applyLogFilter() {
        const info = document.getElementById('logInfo').checked;
        const warning = document.getElementById('logWarning').checked;
        const error = document.getElementById('logError').checked;
        const success = document.getElementById('logSuccess').checked;
        const dateFrom = document.getElementById('logDateFrom').value;
        const dateTo = document.getElementById('logDateTo').value;

        const filteredLogs = this.processingLog.filter(log => {
            // レベルフィルター
            const levelMatch = (info && log.level === 'info') ||
                             (warning && log.level === 'warning') ||
                             (error && log.level === 'error') ||
                             (success && log.level === 'success');

            // 日付フィルター
            let dateMatch = true;
            if (dateFrom || dateTo) {
                const logDate = new Date(log.timestamp);
                if (dateFrom && logDate < new Date(dateFrom)) dateMatch = false;
                if (dateTo && logDate > new Date(dateTo + 'T23:59:59')) dateMatch = false;
            }

            return levelMatch && dateMatch;
        });

        const logContent = document.getElementById('logContent');
        logContent.innerHTML = filteredLogs.map(log => `
            <div class="log-entry ${log.level}">
                <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
                <span class="log-level">[${log.level.toUpperCase()}]</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
    }

    addLogEntry(level, message) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message
        };

        this.processingLog.push(logEntry);

        // ログが表示されている場合は更新
        const logContent = document.getElementById('logContent');
        if (logContent && !logContent.parentElement.classList.contains('hidden')) {
            logContent.innerHTML = this.generateLogContent();
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    addToExportHistory(exportInfo) {
        this.exportHistory.push(exportInfo);
        
        // 履歴を最大100件に制限
        if (this.exportHistory.length > 100) {
            this.exportHistory = this.exportHistory.slice(-100);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 外部から呼び出し可能なメソッド
    logInfo(message) {
        this.addLogEntry('info', message);
    }

    logWarning(message) {
        this.addLogEntry('warning', message);
    }

    logError(message) {
        this.addLogEntry('error', message);
    }

    logSuccess(message) {
        this.addLogEntry('success', message);
    }
} 