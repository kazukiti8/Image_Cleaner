// Electronのモジュール
const { app, BrowserWindow, ipcMain, dialog, net, protocol, shell } = require('electron');
const path = require('path');
const fs_sync = require('fs'); // 同期的なファイル操作用 (existsSyncなど)
const fs = require('fs').promises; // Promiseベースの非同期ファイル操作用
const { spawn } = require('child_process');

let mainWindow;
let settingsWindow;
let confirmationWindow;

let settingsDirectory;
let settingsFilePath;
let defaultLogFilePath;

const getDefaultSettings = () => {
    const logPath = defaultLogFilePath || path.join(app.getPath('userData'), 'logs', 'app.log');
    return {
        scanSubfolders: true,
        deleteOperation: 'recycleBin',
        logLevel: 'normal',
        logFilePath: logPath
    };
};

async function loadAppSettings() {
    if (!settingsFilePath) {
        console.warn("loadAppSettings called before settingsFilePath is initialized.");
        return getDefaultSettings();
    }
    try {
        if (fs_sync.existsSync(settingsFilePath)) { // 同期版を使用
            const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
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

async function saveAppSettings(settingsToSave) {
    if (!settingsDirectory || !settingsFilePath) {
        console.error("saveAppSettings called before settingsDirectory or settingsFilePath is initialized.");
        return { success: false, error: "Settings path not initialized." };
    }
    try {
        // fs.mkdir は fs.promises.mkdir を使うので await を使用
        if (!fs_sync.existsSync(settingsDirectory)) { // ディレクトリ存在確認は同期で良い場合もある
            await fs.mkdir(settingsDirectory, { recursive: true });
        }
        const currentSettings = await loadAppSettings();
        const newSettings = { ...currentSettings, ...settingsToSave };
        await fs.writeFile(settingsFilePath, JSON.stringify(newSettings, null, 2));
        console.log('Settings saved to:', settingsFilePath);
        return { success: true, path: settingsFilePath, settings: newSettings };
    } catch (error) {
        console.error('Failed to save settings to file:', error);
        return { success: false, error: error.message };
    }
}


function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1000, height: 750, minWidth: 800, minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true, nodeIntegration: false,
        }
    });
    mainWindow.loadFile(path.join(__dirname, '../renderer/html/index.html'));
    mainWindow.on('closed', () => { mainWindow = null; });
}

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }
    const parentPos = mainWindow ? mainWindow.getPosition() : [0, 0];
    const parentSize = mainWindow ? mainWindow.getSize() : [800, 600];

    settingsWindow = new BrowserWindow({
        width: 620,
        height: 550,
        minWidth: 500,
        minHeight: 400,
        title: '設定',
        parent: mainWindow,
        modal: true,
        show: false,
        frame: false, 
        transparent: true, 
        resizable: false,
        maximizable: false,
        minimizable: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preloadSettings.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true
        },
        autoHideMenuBar: true,
        x: parentPos[0] + Math.floor((parentSize[0] - 620) / 2),
        y: parentPos[1] + Math.floor((parentSize[1] - 550) / 2),
    });

    settingsWindow.loadFile(path.join(__dirname, '../renderer/html/settings.html'));
    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
    });
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function createConfirmationDialog(parentWindow, dialogData) {
    if (confirmationWindow) {
        confirmationWindow.focus();
        return;
    }
    const parentPos = parentWindow.getPosition();
    const parentSize = parentWindow.getSize();

    confirmationWindow = new BrowserWindow({
        width: 500,
        height: 280,
        minWidth: 450,
        minHeight: 220,
        title: dialogData.title || '確認',
        parent: parentWindow,
        modal: true,
        show: false,
        frame: false, 
        transparent: true, 
        resizable: false,
        maximizable: false,
        minimizable: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preloadConfirmationDialog.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true
        },
        autoHideMenuBar: true,
        x: parentPos[0] + Math.floor((parentSize[0] - 500) / 2),
        y: parentPos[1] + Math.floor((parentSize[1] - 280) / 2),
    });

    confirmationWindow.loadFile(path.join(__dirname, '../renderer/html/confirmationDialog.html'));

    confirmationWindow.once('ready-to-show', () => {
        confirmationWindow.show();
        confirmationWindow.webContents.send('dialog-data', dialogData);
    });

    confirmationWindow.on('closed', () => {
        confirmationWindow = null;
    });
}


app.whenReady().then(async () => {
    settingsDirectory = app.getPath('userData');
    settingsFilePath = path.join(settingsDirectory, 'app-settings.json');
    defaultLogFilePath = path.join(app.getPath('logs'), 'app.log');

    protocol.handle('app-file', (request) => {
        const urlPathPart = request.url.slice('app-file://'.length);
        const decodedUrlPath = decodeURI(urlPathPart);
        let systemPath;
        if (process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(decodedUrlPath)) {
            systemPath = decodedUrlPath.substring(1); 
        } else if (process.platform !== 'win32' && decodedUrlPath.startsWith('/')) {
            systemPath = decodedUrlPath;
        } else {
            console.error(`[DEBUG Main] Invalid path format for app-file: ${decodedUrlPath}`);
            return new Response(null, { status: 400, statusText: 'Invalid path format for app-file protocol.' });
        }
        const fileUrlToFetch = `file:///${systemPath.replace(/\\/g, '/')}`; 
        return net.fetch(fileUrlToFetch)
            .catch(err => {
                console.error(`[DEBUG Main] net.fetch error for ${fileUrlToFetch}:`, err);
                return new Response(null, { status: 404, statusText: `File Not Found or Error Accessing File: ${systemPath}` });
            });
    });

    // --- IPCハンドラ ---
    ipcMain.handle('dialog:openDirectory', async (event) => {
        const parentWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
        if (!parentWindow) return null;
        const { canceled, filePaths } = await dialog.showOpenDialog(parentWindow, {
            properties: ['openDirectory']
        });
        return canceled ? null : filePaths[0];
    });

    ipcMain.on('open-settings-window', () => {
        if (mainWindow) {
            createSettingsWindow();
        }
    });

    ipcMain.on('close-settings-window', () => { 
        if (settingsWindow) settingsWindow.close(); 
    });

    ipcMain.handle('load-app-settings', async () => await loadAppSettings());

    ipcMain.handle('save-app-settings', async (event, settings) => {
        const result = await saveAppSettings(settings);
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

    ipcMain.handle('execute-scan', async (event, folderPath) => { // この行がエラーの出ていた112行目付近に相当
        return new Promise(async (resolve, reject) => {
            const currentSettings = await loadAppSettings();
            const scanSubfoldersArg = currentSettings.scanSubfolders ? 'true' : 'false';
            let pythonExecutable = 'python';
            let scriptPath;

            if (app.isPackaged) {
                scriptPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'python', 'image_scanner.py');
            } else {
                scriptPath = path.join(app.getAppPath(), 'src', 'python', 'image_scanner.py');
                const venvPythonPathWin = path.join(app.getAppPath(), '.venv', 'Scripts', 'python.exe');
                const venvPythonPathMacLinux = path.join(app.getAppPath(), '.venv', 'bin', 'python');
                // ここで fs_sync.existsSync を使用
                if (process.platform === 'win32' && fs_sync.existsSync(venvPythonPathWin)) {
                    pythonExecutable = venvPythonPathWin;
                } else if ((process.platform === 'darwin' || process.platform === 'linux') && fs_sync.existsSync(venvPythonPathMacLinux)) {
                    pythonExecutable = venvPythonPathMacLinux;
                }
            }
            
            console.log(`Executing Python: ${pythonExecutable} ${scriptPath} with folder: ${folderPath} and scanSubfolders: ${scanSubfoldersArg}`);
            const pyProc = spawn(pythonExecutable, [scriptPath, folderPath, scanSubfoldersArg]);
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
        if (!filePath) { // fs_sync.existsSync は filePath が null や undefined の場合にエラーになるため、先にチェック
            console.warn(`[DEBUG Main] convertFileSrc: filePath is null or undefined.`);
            return null;
        }
        // ここで fs_sync.existsSync を使用
        if (!fs_sync.existsSync(filePath)) {
            console.warn(`[DEBUG Main] convertFileSrc: File does not exist at path: ${filePath}`);
            return null;
        }
        let normalizedPath = filePath.replace(/\\/g, '/');
        if (process.platform === 'win32' && /^[a-zA-Z]:\//.test(normalizedPath)) {
            normalizedPath = '/' + normalizedPath;
        } else if (!normalizedPath.startsWith('/')) {
             normalizedPath = '/' + normalizedPath;
        }
        const encodedPath = encodeURI(normalizedPath)
            .replace(/#/g, '%23')
            .replace(/\?/g, '%3F');
        const resultUrl = 'app-file://' + encodedPath;
        console.log(`[DEBUG Main] Returning URL for convertFileSrc: ${resultUrl}`);
        return resultUrl;
    });

    ipcMain.handle('show-confirmation-dialog', (event, data) => {
        return new Promise((resolve) => {
            const parentWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
            if (!parentWin) {
                console.error("Parent window for confirmation dialog not found.");
                resolve({ confirmed: false, error: "Parent window not found." });
                return;
            }
            createConfirmationDialog(parentWin, data);
            
            const listener = (e, response) => {
                if (confirmationWindow && !confirmationWindow.isDestroyed()) {
                    confirmationWindow.close();
                }
                ipcMain.removeListener('dialog-response', listener);
                resolve(response);
            };
            ipcMain.once('dialog-response', listener);
        });
    });

    ipcMain.handle('perform-file-operation', async (event, { actionType, paths, destination }) => {
        if (!paths || paths.length === 0) {
            return { successCount: 0, errors: [{ path: 'N/A', reason: '対象ファイルがありません。' }] };
        }

        let operationPromise;
        switch (actionType) {
            case 'trash':
                operationPromise = Promise.allSettled(
                    paths.map(async (p) => {
                        try {
                            await shell.trashItem(p);
                            return p;
                        } catch (err) {
                            console.error(`Error trashing item ${p}:`, err);
                            throw err;
                        }
                    })
                );
                break;
            case 'delete':
                operationPromise = Promise.allSettled(
                    paths.map(p => fs.unlink(p).then(() => p)) // fs は fs.promises を指す
                );
                break;
            case 'move':
                if (!destination) {
                    return { successCount: 0, errors: [{ path: 'N/A', reason: '移動先フォルダが指定されていません。' }] };
                }
                await fs.mkdir(destination, { recursive: true });
                operationPromise = Promise.allSettled(
                    paths.map(async (p) => {
                        const newPath = path.join(destination, path.basename(p));
                        try {
                            // fs.stat は fs.promises.stat を指す
                            if (await fs.stat(newPath).then(() => true).catch(() => false)) {
                                throw new Error(`移動先に同名のファイルが存在します: ${path.basename(p)}`);
                            }
                            await fs.rename(p, newPath); // fs.rename は fs.promises.rename を指す
                            return p;
                        } catch (err) {
                            console.error(`Error moving item ${p} to ${newPath}:`, err);
                            throw err;
                        }
                    })
                );
                break;
            default:
                return { successCount: 0, errors: [{ path: 'N/A', reason: `未定義の操作です: ${actionType}` }] };
        }

        const results = await operationPromise;
        
        const successFiles = [];
        const errorFiles = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successFiles.push(result.value);
            } else {
                errorFiles.push({
                    path: paths[index],
                    reason: result.reason.message || '不明なエラー'
                });
            }
        });
        
        console.log(`Operation: ${actionType}, Success: ${successFiles.length}, Failed: ${errorFiles.length}`);
        return { successCount: successFiles.length, errors: errorFiles, successPaths: successFiles };
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
