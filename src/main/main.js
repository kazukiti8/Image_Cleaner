// Electronのモジュール
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs'); // 設定ファイルの読み書き用

// メインウィンドウと設定ウィンドウをグローバル参照で保持
let mainWindow;
let settingsWindow;

// 設定ファイルのパス (ユーザーデータディレクトリ内)
const settingsFilePath = path.join(app.getPath('userData'), 'app-settings.json');

// --- 設定の読み込み関数 ---
function loadAppSettings() {
    try {
        if (fs.existsSync(settingsFilePath)) {
            const settingsData = fs.readFileSync(settingsFilePath, 'utf-8');
            return JSON.parse(settingsData);
        }
    } catch (error) {
        console.error('Failed to load settings from file:', error);
    }
    return {}; // ファイルが存在しないかエラーの場合は空のオブジェクト
}

// --- 設定の保存関数 ---
function saveAppSettings(settings) {
    try {
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2)); // 整形して保存
        console.log('Settings saved to:', settingsFilePath);
    } catch (error) {
        console.error('Failed to save settings to file:', error);
    }
}


function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'), // メインウィンドウ用のプリロード
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile(path.join(__dirname, '../renderer/html/index.html'));
    // mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    const currentMainWindowPosition = mainWindow ? mainWindow.getPosition() : [0,0];
    const currentMainWindowSize = mainWindow ? mainWindow.getSize() : [800,600];

    settingsWindow = new BrowserWindow({
        width: 620,
        height: 550,
        minWidth: 500,
        minHeight: 400,
        title: '設定',
        parent: mainWindow,
        modal: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preloadSettings.js'), // 設定ダイアログ専用のプリロード
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true
        },
        autoHideMenuBar: true,
        x: currentMainWindowPosition[0] + Math.floor((currentMainWindowSize[0] - 620) / 2),
        y: currentMainWindowPosition[1] + Math.floor((currentMainWindowSize[1] - 550) / 2),
    });

    settingsWindow.loadFile(path.join(__dirname, '../renderer/html/settings.html'));

    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}


app.whenReady().then(() => {
    ipcMain.handle('dialog:openDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        return canceled ? null : filePaths[0];
    });

    // 設定ダイアログを開くIPCリスナー
    ipcMain.on('open-settings-window', () => {
        createSettingsWindow();
    });

    ipcMain.on('close-settings-window', () => {
        if (settingsWindow) {
            settingsWindow.close();
        }
    });

    ipcMain.handle('load-app-settings', () => {
        return loadAppSettings();
    });

    ipcMain.handle('save-app-settings', (event, settings) => {
        saveAppSettings(settings);
        // 必要であればメインウィンドウに設定変更を通知
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('settings-updated', settings);
        }
        return { success: true };
    });

    ipcMain.handle('dialog:openDirectoryForLogs', async () => {
        if (!settingsWindow) return null;
        const { canceled, filePaths } = await dialog.showOpenDialog(settingsWindow, {
            title: 'ログファイルの保存場所を選択',
            properties: ['openDirectory', 'createDirectory']
        });
        return canceled ? null : filePaths[0];
    });


    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
