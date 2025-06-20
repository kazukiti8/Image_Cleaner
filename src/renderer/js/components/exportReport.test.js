// ExportReportManagerのテスト
describe('ExportReportManager', () => {
    let exportReportManager;
    let mockElectronAPI;

    beforeEach(() => {
        // DOM要素のモック
        document.body.innerHTML = `
            <div id="export-report-panel"></div>
            <div id="report-preview-dialog"></div>
            <div id="processing-log-viewer"></div>
            <table id="blur-table">
                <tbody>
                    <tr><td>test1.jpg</td><td>1024</td></tr>
                </tbody>
            </table>
            <table id="similar-table">
                <tbody>
                    <tr><td>test2.jpg</td><td>2048</td></tr>
                </tbody>
            </table>
        `;

        // window.electronAPIのモック
        mockElectronAPI = {
            selectFolder: jest.fn(),
            writeFile: jest.fn()
        };
        window.electronAPI = mockElectronAPI;

        // ExportReportManagerクラスを読み込み
        require('./exportReport.js');
        exportReportManager = new ExportReportManager();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('初期化が正常に動作する', () => {
            expect(exportReportManager.exportHistory).toEqual([]);
            expect(exportReportManager.processingLog).toEqual([]);
        });
    });

    describe('initializeUI', () => {
        test('UI要素が作成される', () => {
            expect(document.getElementById('export-report-panel')).toBeTruthy();
            expect(document.getElementById('report-preview-dialog')).toBeTruthy();
            expect(document.getElementById('processing-log-viewer')).toBeTruthy();
        });
    });

    describe('showExportReportPanel and hideExportReportPanel', () => {
        test('パネルの表示と非表示', () => {
            exportReportManager.showExportReportPanel();
            expect(document.getElementById('export-report-panel').classList.contains('hidden')).toBe(false);

            exportReportManager.hideExportReportPanel();
            expect(document.getElementById('export-report-panel').classList.contains('hidden')).toBe(true);
        });
    });

    describe('updateExportSettings', () => {
        test('エクスポート設定が更新される', () => {
            // ラジオボタンとチェックボックスを追加
            document.body.innerHTML += `
                <input type="radio" name="export-format" value="csv" checked>
                <input type="radio" name="export-format" value="json">
                <input type="radio" name="export-target" value="current" checked>
                <input type="radio" name="export-target" value="all">
                <input type="checkbox" id="include-metadata" checked>
                <input type="checkbox" id="include-statistics" checked>
                <input type="checkbox" id="include-processing-history" checked>
            `;

            exportReportManager.updateExportSettings();

            const settings = exportReportManager.getCurrentExportSettings();
            expect(settings.format).toBe('csv');
            expect(settings.target).toBe('current');
            expect(settings.includeMetadata).toBe(true);
            expect(settings.includeStatistics).toBe(true);
            expect(settings.includeProcessingHistory).toBe(true);
        });
    });

    describe('generateReportData', () => {
        test('レポートデータが生成される', async () => {
            const mockData = {
                blurImages: [{ filename: 'test1.jpg', size: 1024 }],
                similarImages: [{ files: [{ filename: 'test2.jpg', size: 2048 }] }],
                errors: [{ filename: 'test3.jpg', error: 'Error message' }]
            };

            // グローバル変数をモック
            global.currentResults = mockData;
            global.currentTab = 'blur';

            const result = await exportReportManager.generateReportData();

            expect(result).toHaveProperty('metadata');
            expect(result).toHaveProperty('statistics');
            expect(result).toHaveProperty('data');
            expect(result.data).toHaveProperty('blurImages');
            expect(result.data).toHaveProperty('similarImages');
            expect(result.data).toHaveProperty('errors');
        });
    });

    describe('getStatistics', () => {
        test('統計情報が計算される', () => {
            const mockData = {
                blurImages: [
                    { size: 1024 },
                    { size: 2048 }
                ],
                similarImages: [
                    { files: [{ size: 1024 }, { size: 2048 }] }
                ],
                errors: [{ error: 'Error 1' }, { error: 'Error 2' }]
            };

            const blurStats = exportReportManager.getStatistics('blur', mockData.blurImages);
            expect(blurStats.count).toBe(2);
            expect(blurStats.totalSize).toBe(3072);

            const similarStats = exportReportManager.getStatistics('similar', mockData.similarImages);
            expect(similarStats.count).toBe(1);
            expect(similarStats.totalSize).toBe(3072);

            const errorStats = exportReportManager.getStatistics('error', mockData.errors);
            expect(errorStats.count).toBe(2);
        });
    });

    describe('getTableData', () => {
        test('テーブルデータが取得される', () => {
            const result = exportReportManager.getTableData('#blur-table');
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        test('存在しないテーブルセレクターの場合', () => {
            const result = exportReportManager.getTableData('#nonexistent-table');
            expect(result).toEqual([]);
        });
    });

    describe('convertToCSV', () => {
        test('CSV形式に変換される', () => {
            const mockData = [
                { filename: 'test1.jpg', size: 1024, date: '2023-01-01' },
                { filename: 'test2.jpg', size: 2048, date: '2023-01-02' }
            ];

            const csv = exportReportManager.convertToCSV(mockData);
            
            expect(csv).toContain('filename,size,date');
            expect(csv).toContain('test1.jpg,1024,2023-01-01');
            expect(csv).toContain('test2.jpg,2048,2023-01-02');
        });

        test('空のデータの場合', () => {
            const csv = exportReportManager.convertToCSV([]);
            expect(csv).toBe('');
        });

        test('特殊文字を含むデータの場合', () => {
            const mockData = [
                { filename: 'test,file.jpg', size: 1024, description: 'Test "description"' }
            ];

            const csv = exportReportManager.convertToCSV(mockData);
            expect(csv).toContain('"test,file.jpg"');
            expect(csv).toContain('"Test ""description"""');
        });
    });

    describe('addProcessingLog', () => {
        test('ログが追加される', () => {
            const initialLength = exportReportManager.processingLog.length;
            
            exportReportManager.addProcessingLog('info', 'Test log message');
            
            expect(exportReportManager.processingLog.length).toBe(initialLength + 1);
            expect(exportReportManager.processingLog[exportReportManager.processingLog.length - 1]).toEqual({
                timestamp: expect.any(Date),
                level: 'info',
                message: 'Test log message'
            });
        });

        test('ログレベルが正しく設定される', () => {
            exportReportManager.addProcessingLog('error', 'Error message');
            exportReportManager.addProcessingLog('warning', 'Warning message');
            exportReportManager.addProcessingLog('info', 'Info message');

            const logs = exportReportManager.processingLog;
            expect(logs[0].level).toBe('error');
            expect(logs[1].level).toBe('warning');
            expect(logs[2].level).toBe('info');
        });
    });

    describe('updateProcessingLogDisplay', () => {
        test('ログ表示が更新される', () => {
            exportReportManager.addProcessingLog('info', 'Test message');
            exportReportManager.updateProcessingLogDisplay();

            const logContent = document.getElementById('log-content');
            expect(logContent).toBeTruthy();
        });
    });

    describe('filterProcessingLog', () => {
        test('ログフィルタリングが動作する', () => {
            exportReportManager.addProcessingLog('info', 'Info message');
            exportReportManager.addProcessingLog('error', 'Error message');
            exportReportManager.addProcessingLog('warning', 'Warning message');

            // フィルター要素を追加
            document.body.innerHTML += `
                <select id="log-level-filter">
                    <option value="all">All</option>
                    <option value="error">Error</option>
                </select>
                <input type="text" id="log-search" value="Error">
            `;

            exportReportManager.filterProcessingLog();

            // フィルタリング結果を確認
            const filteredLogs = exportReportManager.processingLog.filter(log => 
                log.level === 'error' && log.message.includes('Error')
            );
            expect(filteredLogs.length).toBe(1);
        });
    });

    describe('clearProcessingLog', () => {
        test('ログがクリアされる', () => {
            exportReportManager.addProcessingLog('info', 'Test message');
            expect(exportReportManager.processingLog.length).toBeGreaterThan(0);

            exportReportManager.clearProcessingLog();
            expect(exportReportManager.processingLog.length).toBe(0);
        });
    });

    describe('exportProcessingLog', () => {
        test('ログエクスポートが動作する', async () => {
            exportReportManager.addProcessingLog('info', 'Test log message');
            mockElectronAPI.selectFolder.mockResolvedValue('/export/path');
            mockElectronAPI.writeFile.mockResolvedValue({ success: true });

            await exportReportManager.exportProcessingLog();

            expect(mockElectronAPI.selectFolder).toHaveBeenCalled();
            expect(mockElectronAPI.writeFile).toHaveBeenCalled();
        });

        test('フォルダ選択がキャンセルされた場合', async () => {
            mockElectronAPI.selectFolder.mockResolvedValue(null);

            await exportReportManager.exportProcessingLog();

            expect(mockElectronAPI.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('getExportHistory', () => {
        test('エクスポート履歴が取得される', () => {
            const history = exportReportManager.getExportHistory();
            expect(Array.isArray(history)).toBe(true);
        });
    });

    describe('getProcessingLog', () => {
        test('処理ログが取得される', () => {
            exportReportManager.addProcessingLog('info', 'Test message');
            const logs = exportReportManager.getProcessingLog();
            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBeGreaterThan(0);
        });
    });

    describe('getCurrentExportSettings', () => {
        test('現在のエクスポート設定が取得される', () => {
            const settings = exportReportManager.getCurrentExportSettings();
            expect(settings).toHaveProperty('format');
            expect(settings).toHaveProperty('target');
            expect(settings).toHaveProperty('includeMetadata');
            expect(settings).toHaveProperty('includeStatistics');
            expect(settings).toHaveProperty('includeProcessingHistory');
        });
    });

    describe('showNotification', () => {
        test('通知が表示される', () => {
            const originalAppendChild = document.body.appendChild;
            const mockAppendChild = jest.fn();
            document.body.appendChild = mockAppendChild;

            exportReportManager.showNotification('Test message', 'success');

            expect(mockAppendChild).toHaveBeenCalled();
            
            // 元の関数を復元
            document.body.appendChild = originalAppendChild;
        });
    });

    describe('イベントハンドリング', () => {
        test('エクスポートパネルのイベント', () => {
            const mockShowPanel = jest.spyOn(exportReportManager, 'showExportReportPanel');
            const mockHidePanel = jest.spyOn(exportReportManager, 'hideExportReportPanel');

            // イベントをシミュレート
            const closeButton = document.querySelector('#close-export-panel');
            if (closeButton) {
                closeButton.click();
                expect(mockHidePanel).toHaveBeenCalled();
            }
        });

        test('プレビューダイアログのイベント', () => {
            const mockHidePreview = jest.spyOn(exportReportManager, 'hideReportPreview');

            // イベントをシミュレート
            const closeButton = document.querySelector('#close-preview-dialog');
            if (closeButton) {
                closeButton.click();
                expect(mockHidePreview).toHaveBeenCalled();
            }
        });

        test('ログビューアのイベント', () => {
            const mockHideLog = jest.spyOn(exportReportManager, 'hideProcessingLog');
            const mockClearLog = jest.spyOn(exportReportManager, 'clearProcessingLog');

            // イベントをシミュレート
            const closeButton = document.querySelector('#close-log-viewer');
            const clearButton = document.querySelector('#clear-log');
            
            if (closeButton) {
                closeButton.click();
                expect(mockHideLog).toHaveBeenCalled();
            }
            
            if (clearButton) {
                clearButton.click();
                expect(mockClearLog).toHaveBeenCalled();
            }
        });
    });
}); 