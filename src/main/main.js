// Electronのモジュール
const { app, BrowserWindow, ipcMain, dialog, net, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// メインウィンドウと設定ウィンドウをグローバル参照で保持
let mainWindow;
let settingsWindow;

// 設定ファイルのパス関連の変数は app.whenReady() 内で初期化
let settingsDirectory;
let settingsFilePath;
let defaultLogFilePath; // defaultLogFilePathも同様

// デフォルト設定値を取得する関数
// app.getPath() を使用するため、appがreadyになった後に呼び出す必要がある
const getDefaultSettings = () => {
    if (!defaultLogFilePath) { // app.getPath('logs')が使える状態になってから設定
        defaultLogFilePath = path.join(app.getPath('logs'), 'app.log');
    }
    return {
        scanSubfolders: true,
        deleteOperation: 'recycleBin',
        logLevel: 'normal',
        logFilePath: defaultLogFilePath
    };
};

// --- 設定の読み込み関数 ---
function loadAppSettings() {
    if (!settingsFilePath) {
        console.warn("loadAppSettings called before settingsFilePath is initialized.");
        return getDefaultSettings(); // app.getPathが使える状態のデフォルトを返す
    }
    try {
        if (fs.existsSync(settingsFilePath)) {
            const settingsData = fs.readFileSync(settingsFilePath, 'utf-8');
            const loadedSettings = JSON.parse(settingsData);
            return { ...getDefaultSettings(), ...loadedSettings };
        } else {
            console.log('Settings file not found, returning default settings.');
            return getDefaultSettings();
        }
    } catch (error) {
        console.error('Failed to load settings from file, returning default settings:', error);
        return getDefaultSettings();
    }
}

// --- 設定の保存関数 ---
function saveAppSettings(settingsToSave) {
    if (!settingsDirectory || !settingsFilePath) {
        console.error("saveAppSettings called before settingsDirectory or settingsFilePath is initialized.");
        return { success: false, error: "Settings path not initialized." };
    }
    try {
        if (!fs.existsSync(settingsDirectory)) {
            fs.mkdirSync(settingsDirectory, { recursive: true });
        }
        const currentSettings = loadAppSettings();
        const newSettings = { ...currentSettings, ...settingsToSave };
        fs.writeFileSync(settingsFilePath, JSON.stringify(newSettings, null, 2));
        console.log('Settings saved to:', settingsFilePath);
        return { success: true, path: settingsFilePath, settings: newSettings };
    } catch (error) {
        console.error('Failed to save settings to file:', error);
        return { success: false, error: error.message };
    }
}


function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
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
            preload: path.join(__dirname, '../preload/preloadSettings.js'),
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

// appの準備ができてから各種初期化とリスナー登録を行う
app.whenReady().then(() => {
    // app.getPathを使用する変数をここで初期化
    settingsDirectory = app.getPath('userData');
    settingsFilePath = path.join(settingsDirectory, 'app-settings.json');
    defaultLogFilePath = path.join(app.getPath('logs'), 'app.log');

    // カスタムプロトコルの登録
    protocol.handle('app-file', (request) => {
        // 'app-file://' の後の部分を取得 (例: /D:/new/00013.jpg または /path/to/file.jpg)
        const urlPathPart = request.url.slice('app-file://'.length);
        const decodedUrlPath = decodeURI(urlPathPart); // エンコードされた文字をデコード
        console.log(`[DEBUG Main] Protocol 'app-file' received. Decoded URL path part: ${decodedUrlPath}`);

        let systemPath;
        // Windowsの場合で、パスが '/X:/...' の形式になっているか確認
        if (process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(decodedUrlPath)) {
            systemPath = decodedUrlPath.substring(1); // 先頭のスラッシュを除去 -> D:/new/00013.jpg
        } else if (process.platform !== 'win32' && decodedUrlPath.startsWith('/')) {
            systemPath = decodedUrlPath; // POSIXパスはそのまま
        } else {
            console.error(`[DEBUG Main] Invalid path format for app-file: ${decodedUrlPath}`);
            return new Response(null, { status: 400, statusText: 'Invalid path format for app-file protocol.' });
        }
        
        console.log(`[DEBUG Main] System path for fetching: ${systemPath}`);

        // net.fetch は file:/// 形式のURLを期待する
        const fileUrlToFetch = `file:///${systemPath.replace(/\\/g, '/')}`; // Windowsでもスラッシュに統一
        
        console.log(`[DEBUG Main] Attempting to fetch with finalFileUrl: ${fileUrlToFetch}`);
        return net.fetch(fileUrlToFetch)
            .catch(err => {
                console.error(`[DEBUG Main] net.fetch error for ${fileUrlToFetch}:`, err);
                return new Response(null, { status: 404, statusText: `File Not Found or Error Accessing File: ${systemPath}` });
            });
    });

    // --- IPCハンドラ ---
    ipcMain.handle('dialog:openDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        return canceled ? null : filePaths[0];
    });

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
        const result = saveAppSettings(settings);
        if (result.success && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('settings-updated', result.settings);
        }
        return result;
    });

    ipcMain.handle('dialog:openDirectoryForLogs', async () => {
        if (!settingsWindow) return null;
        const { canceled, filePaths } = await dialog.showOpenDialog(settingsWindow, {
            title: 'ログファイルの保存場所を選択',
            properties: ['openDirectory', 'createDirectory']
        });
        return canceled ? null : filePaths[0];
    });

    ipcMain.handle('execute-scan', async (event, folderPath) => {
        return new Promise((resolve, reject) => {
            let pythonExecutable = 'python';
            let scriptPath;
            if (app.isPackaged) {
                scriptPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'python', 'image_scanner.py');
            } else {
                scriptPath = path.join(app.getAppPath(), 'src', 'python', 'image_scanner.py');
                const venvPythonPathWin = path.join(app.getAppPath(), '.venv', 'Scripts', 'python.exe');
                const venvPythonPathMacLinux = path.join(app.getAppPath(), '.venv', 'bin', 'python');
                if (process.platform === 'win32' && fs.existsSync(venvPythonPathWin)) {
                    pythonExecutable = venvPythonPathWin;
                } else if ((process.platform === 'darwin' || process.platform === 'linux') && fs.existsSync(venvPythonPathMacLinux)) {
                    pythonExecutable = venvPythonPathMacLinux;
                }
            }
            
            console.log(`Executing Python: ${pythonExecutable} ${scriptPath} with folder: ${folderPath}`);
            const pyProc = spawn(pythonExecutable, [scriptPath, folderPath]);
            let resultData = '';
            let errorData = '';
            pyProc.stdout.on('data', (data) => { resultData += data.toString(); });
            pyProc.stderr.on('data', (data) => { errorData += data.toString(); console.error(`Python stderr: ${data}`); });
            pyProc.on('close', (code) => {
                console.log(`Python script exited with code ${code}`);
                if (code === 0) {
                    try { resolve(JSON.parse(resultData)); }
                    catch (e) { 
                        console.error('Failed to parse Python script output:', e);
                        console.error('Raw output from Python:', resultData);
                        reject(new Error('Pythonスクリプトの出力解析に失敗しました。'));
                    }
                } else {
                    reject(new Error(`Pythonスクリプトの実行に失敗しました (終了コード: ${code}): ${errorData}`));
                }
            });
            pyProc.on('error', (err) => { 
                console.error('Failed to start Python process:', err);
                reject(new Error(`Pythonプロセスの開始に失敗しました: ${err.message}`));
            });
        });
    });

    ipcMain.handle('convert-file-src', (event, filePath) => {
        console.log(`[DEBUG Main] IPC 'convert-file-src' called with raw filePath: ${filePath}`);
        if (!filePath) {
            console.warn(`[DEBUG Main] convertFileSrc: filePath is null or undefined.`);
            return null;
        }
        // Windowsパスの区切り文字をスラッシュに統一
        let normalizedPath = filePath.replace(/\\/g, '/');
        
        // Windowsのドライブレター付き絶対パスの場合、先頭にスラッシュを追加して "URLパス" らしくする
        // 例: D:/foo/bar -> /D:/foo/bar
        if (process.platform === 'win32' && /^[a-zA-Z]:\//.test(normalizedPath)) {
            normalizedPath = '/' + normalizedPath;
        }
        // POSIXパスで既にスラッシュで始まっている場合はそのまま、そうでなければ追加（相対パス対策だが、基本は絶対パスを期待）
        else if (!normalizedPath.startsWith('/')) {
             normalizedPath = '/' + normalizedPath;
        }

        // URIエンコード（#や?などの特殊文字対策）
        const encodedPath = encodeURI(normalizedPath)
            .replace(/#/g, '%23')
            .replace(/\?/g, '%3F');
        
        const resultUrl = 'app-file://' + encodedPath;
        console.log(`[DEBUG Main] Returning URL for convertFileSrc: ${resultUrl}`);
        return resultUrl;
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
