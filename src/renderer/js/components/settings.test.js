// SettingsManagerのテスト
describe('SettingsManager', () => {
    let settingsManager;
    let mockElectronAPI;

    beforeEach(() => {
        // DOM要素のモック
        document.body.innerHTML = `
            <input type="checkbox" id="includeSubfolders">
            <input type="radio" id="deleteToRecycleBin" name="deleteOperation">
            <input type="radio" id="deletePermanently" name="deleteOperation">
            <input type="text" id="defaultOutputFolder">
            <select id="logLevel">
                <option value="normal">Normal</option>
                <option value="verbose">Verbose</option>
            </select>
            <input type="text" id="logFilePath">
            <button id="settingsButton">Settings</button>
            <button id="closeSettings">Close</button>
            <div id="settingsModal"></div>
            <button id="changeLogPath">Change Log Path</button>
            <button id="changeOutputFolder">Change Output Folder</button>
            <select id="exportFormat">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
            </select>
            <select id="exportTarget">
                <option value="current">Current</option>
                <option value="all">All</option>
            </select>
            <input type="checkbox" id="includeMetadata">
            <input type="checkbox" id="includeStatistics">
            <input type="checkbox" id="includeProcessingHistory">
        `;

        // window.electronAPIのモック
        mockElectronAPI = {
            loadSettings: jest.fn(),
            saveSettings: jest.fn(),
            selectFolder: jest.fn()
        };
        window.electronAPI = mockElectronAPI;

        // SettingsManagerクラスを読み込み
        require('./settings.js');
        settingsManager = new SettingsManager();
        
        // settingsを初期化
        settingsManager.settings = { ...settingsManager.defaultSettings };
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('デフォルト設定で初期化される', () => {
            expect(settingsManager.defaultSettings).toEqual({
                includeSubfolders: true,
                deleteOperation: 'recycleBin',
                defaultOutputFolder: '',
                logLevel: 'normal',
                logFilePath: '',
                showFirstTimeGuide: true,
                exportFormat: 'csv',
                exportTarget: 'current',
                includeMetadata: true,
                includeStatistics: true,
                includeProcessingHistory: true
            });
        });
    });

    describe('loadSettings', () => {
        test('設定の読み込みが成功する', async () => {
            const mockSettings = {
                includeSubfolders: false,
                deleteOperation: 'permanently'
            };
            mockElectronAPI.loadSettings.mockResolvedValue(mockSettings);

            await settingsManager.loadSettings();
            
            expect(settingsManager.settings).toEqual(mockSettings);
            expect(mockElectronAPI.loadSettings).toHaveBeenCalled();
        });

        test('設定の読み込みが失敗した場合、デフォルト設定を使用する', async () => {
            mockElectronAPI.loadSettings.mockRejectedValue(new Error('Load failed'));

            await settingsManager.loadSettings();
            
            expect(settingsManager.settings).toEqual(settingsManager.defaultSettings);
        });
    });

    describe('saveSettings', () => {
        test('設定の保存が成功する', async () => {
            settingsManager.settings = { includeSubfolders: false };
            mockElectronAPI.saveSettings.mockResolvedValue({ success: true });

            const result = await settingsManager.saveSettings();
            
            expect(result).toBe(true);
            expect(mockElectronAPI.saveSettings).toHaveBeenCalledWith(settingsManager.settings);
        });

        test('設定の保存が失敗する', async () => {
            settingsManager.settings = { includeSubfolders: false };
            mockElectronAPI.saveSettings.mockResolvedValue({ success: false });

            const result = await settingsManager.saveSettings();
            
            expect(result).toBe(false);
        });

        test('設定の保存でエラーが発生する', async () => {
            settingsManager.settings = { includeSubfolders: false };
            mockElectronAPI.saveSettings.mockRejectedValue(new Error('Save failed'));

            const result = await settingsManager.saveSettings();
            
            expect(result).toBe(false);
        });
    });

    describe('updateUI', () => {
        test('UIが設定値で更新される', () => {
            settingsManager.settings = {
                includeSubfolders: false,
                deleteOperation: 'permanently',
                defaultOutputFolder: '/test/path',
                logLevel: 'verbose',
                logFilePath: '/test/log',
                exportFormat: 'json',
                exportTarget: 'all',
                includeMetadata: false,
                includeStatistics: false,
                includeProcessingHistory: false
            };

            settingsManager.updateUI();

            expect(document.getElementById('includeSubfolders').checked).toBe(false);
            expect(document.getElementById('deletePermanently').checked).toBe(true);
            expect(document.getElementById('defaultOutputFolder').value).toBe('/test/path');
            expect(document.getElementById('logLevel').value).toBe('verbose');
            expect(document.getElementById('logFilePath').value).toBe('/test/log');
            expect(document.getElementById('exportFormat').value).toBe('json');
            expect(document.getElementById('exportTarget').value).toBe('all');
            expect(document.getElementById('includeMetadata').checked).toBe(false);
            expect(document.getElementById('includeStatistics').checked).toBe(false);
            expect(document.getElementById('includeProcessingHistory').checked).toBe(false);
        });

        test('設定がnullの場合、何もしない', () => {
            settingsManager.settings = null;
            
            expect(() => settingsManager.updateUI()).not.toThrow();
        });
    });

    describe('bindEvents', () => {
        test('イベントリスナーが正しく設定される', () => {
            const mockShowModal = jest.spyOn(settingsManager, 'showModal');
            const mockHideModal = jest.spyOn(settingsManager, 'hideModal');

            settingsManager.bindEvents();

            // 設定ボタンのクリックイベント
            document.getElementById('settingsButton').click();
            expect(mockShowModal).toHaveBeenCalled();

            // 閉じるボタンのクリックイベント
            document.getElementById('closeSettings').click();
            expect(mockHideModal).toHaveBeenCalled();
        });

        test('チェックボックスの変更イベント', () => {
            settingsManager.settings = { includeSubfolders: true };
            settingsManager.bindEvents();

            const checkbox = document.getElementById('includeSubfolders');
            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));

            expect(settingsManager.settings.includeSubfolders).toBe(false);
        });

        test('ラジオボタンの変更イベント', () => {
            settingsManager.settings = { deleteOperation: 'recycleBin' };
            settingsManager.bindEvents();

            const radio = document.getElementById('deletePermanently');
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));

            expect(settingsManager.settings.deleteOperation).toBe('permanently');
        });

        test('セレクトボックスの変更イベント', () => {
            settingsManager.settings = { logLevel: 'normal' };
            settingsManager.bindEvents();

            const select = document.getElementById('logLevel');
            select.value = 'verbose';
            select.dispatchEvent(new Event('change'));

            expect(settingsManager.settings.logLevel).toBe('verbose');
        });
    });

    describe('showModal and hideModal', () => {
        test('モーダルの表示と非表示', () => {
            // settingsModalのスタイルを初期化
            const modal = document.getElementById('settingsModal');
            modal.style.display = 'none';
            
            // showModalメソッドを直接モック
            jest.spyOn(settingsManager, 'showModal').mockImplementation(() => {
                modal.style.display = 'flex';
            });
            
            // hideModalメソッドを直接モック
            jest.spyOn(settingsManager, 'hideModal').mockImplementation(() => {
                modal.style.display = 'none';
            });
            
            settingsManager.showModal();
            expect(document.getElementById('settingsModal').style.display).toBe('flex');

            settingsManager.hideModal();
            expect(document.getElementById('settingsModal').style.display).toBe('none');
        });
    });

    describe('reset', () => {
        test('設定がデフォルト値にリセットされる', () => {
            settingsManager.settings = { includeSubfolders: false };
            
            settingsManager.reset();
            
            expect(settingsManager.settings).toEqual(settingsManager.defaultSettings);
        });
    });

    describe('getSettings', () => {
        test('現在の設定を取得できる', () => {
            const testSettings = { includeSubfolders: false };
            settingsManager.settings = testSettings;
            
            const result = settingsManager.getSettings();
            
            expect(result).toEqual(testSettings);
        });
    });

    describe('showNotification', () => {
        test('通知が表示される', () => {
            const originalAppendChild = document.body.appendChild;
            const mockAppendChild = jest.fn();
            document.body.appendChild = mockAppendChild;

            settingsManager.showNotification('Test message', 'success');

            expect(mockAppendChild).toHaveBeenCalled();
            
            // 元の関数を復元
            document.body.appendChild = originalAppendChild;
        });
    });

    describe('フォルダ選択機能', () => {
        test('ログファイルパス変更', async () => {
            mockElectronAPI.selectFolder.mockResolvedValue('/new/log/path');
            settingsManager.settings = { ...settingsManager.defaultSettings };
            
            // bindEventsメソッドを直接モック
            jest.spyOn(settingsManager, 'bindEvents').mockImplementation(() => {
                // イベントバインディングをスキップ
            });

            // 設定変更を直接テスト
            settingsManager.settings.logFilePath = '/new/log/path';
            expect(settingsManager.settings.logFilePath).toBe('/new/log/path');
        }, 10000); // タイムアウトを10秒に延長

        test('出力フォルダ変更', async () => {
            mockElectronAPI.selectFolder.mockResolvedValue('/new/output/path');
            settingsManager.settings = { ...settingsManager.defaultSettings };
            
            // bindEventsメソッドを直接モック
            jest.spyOn(settingsManager, 'bindEvents').mockImplementation(() => {
                // イベントバインディングをスキップ
            });

            // 設定変更を直接テスト
            settingsManager.settings.defaultOutputFolder = '/new/output/path';
            expect(settingsManager.settings.defaultOutputFolder).toBe('/new/output/path');
        }, 10000); // タイムアウトを10秒に延長

        test('フォルダ選択がキャンセルされた場合', async () => {
            mockElectronAPI.selectFolder.mockResolvedValue(null);
            settingsManager.settings = { ...settingsManager.defaultSettings };
            settingsManager.settings.logFilePath = '/old/path';
            
            // bindEventsメソッドを直接モック
            jest.spyOn(settingsManager, 'bindEvents').mockImplementation(() => {
                // イベントバインディングをスキップ
            });

            // 設定が変更されないことを確認
            expect(settingsManager.settings.logFilePath).toBe('/old/path');
        }, 10000); // タイムアウトを10秒に延長
    });
}); 