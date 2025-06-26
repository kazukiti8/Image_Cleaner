const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const ImageAnalyzer = require('./imageAnalyzer');

// 環境設定
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const isProduction = !isDev;

// 文字エンコーディング設定
process.env.LANG = 'en_US.UTF-8';
process.env.LC_ALL = 'en_US.UTF-8';

// Windowsでの文字化け対策
if (process.platform === 'win32') {
    // コンソールのコードページをUTF-8に設定
    try {
        require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
    } catch (error) {
        // エラーを無視
    }
    
    // コンソール出力の文字エンコーディングを強制的にUTF-8に設定
    if (process.stdout && process.stdout.setEncoding) {
        process.stdout.setEncoding('utf8');
    }
    if (process.stderr && process.stderr.setEncoding) {
        process.stderr.setEncoding('utf8');
    }
    
    // 環境変数を追加設定
    process.env.PYTHONIOENCODING = 'utf-8';
    process.env.NODE_OPTIONS = '--max-old-space-size=4096';
}

// ログファイルパス
const logFilePath = path.join(app.getPath('userData'), 'app.log');

// ファイルログ関数
async function writeToLog(message) {
    try {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        await fs.appendFile(logFilePath, logMessage, 'utf8');
    } catch (error) {
        // ログ書き込みエラーは無視
    }
}

// コンソール出力のラッパー関数
function safeConsoleLog(...args) {
    try {
        const message = args.join(' ');
        writeToLog(`LOG: ${message}`);
        // 本番環境では最小限の情報のみ出力
        if (isDev) {
            console.log(...args);
        } else {
            console.log('App running...');
        }
    } catch (error) {
        // エラーを無視
    }
}

function safeConsoleError(...args) {
    try {
        const message = args.join(' ');
        writeToLog(`ERROR: ${message}`);
        // 本番環境では最小限の情報のみ出力
        if (isDev) {
            console.error(...args);
        } else {
            console.log('Error occurred. Check log file.');
        }
    } catch (error) {
        // エラーを無視
    }
}

function safeConsoleWarn(...args) {
    try {
        const message = args.join(' ');
        writeToLog(`WARN: ${message}`);
        // 本番環境では最小限の情報のみ出力
        if (isDev) {
            console.warn(...args);
        } else {
            console.log('Warning occurred. Check log file.');
        }
    } catch (error) {
        // エラーを無視
    }
}

// メインウィンドウの参照を保持
let mainWindow;
let imageAnalyzer;
let supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif']; // 監視対象の画像拡張子

// 設定ファイルのパス
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// デフォルト設定
const defaultSettings = {
    includeSubfolders: true,
    deleteOperation: 'recycleBin',
    defaultOutputFolder: '',
    logLevel: 'normal',
    logFilePath: path.join(app.getPath('userData'), 'logs'),
    showFirstTimeGuide: true,
    blurThreshold: 15, // ブレ検出閾値
    similarityThreshold: 70 // 類似度閾値
};

// 設定を読み込み
async function loadSettings() {
    try {
        const data = await fs.readFile(settingsPath, 'utf8');
        return { ...defaultSettings, ...JSON.parse(data) };
    } catch (error) {
        safeConsoleLog('Settings file not found, using default settings');
        return defaultSettings;
    }
}

// 設定を保存
async function saveSettings(settings) {
    try {
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        safeConsoleLog('Settings saved successfully');
    } catch (error) {
        safeConsoleError('Failed to save settings:', error);
        throw error;
    }
}

function createWindow() {
  // メインウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      // 本番環境でのセキュリティ強化
      ...(isProduction && {
        devTools: false,
        webSecurity: true,
        allowRunningInsecureContent: false
      })
    },
    icon: path.join(__dirname, '../renderer/assets/icons/app-icon.png'), // アイコンファイルが存在する場合
    title: 'イメージクリーンアップアシスタント',
    show: false, // 準備が整ってから表示
    autoHideMenuBar: isProduction, // 本番環境ではメニューバーを自動非表示
    // 本番環境での追加設定
    ...(isProduction && {
      resizable: true,
      maximizable: true,
      minimizable: true,
      fullscreenable: true,
      skipTaskbar: false,
      alwaysOnTop: false
    })
  });

  // メインウィンドウのHTMLファイルを読み込み
  mainWindow.loadFile(path.join(__dirname, '../renderer/html/index.html'));

  // 開発モードの場合はDevToolsを開く
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // ウィンドウが準備できたときに表示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    safeConsoleLog('Main window created and shown');
  });

  // ウィンドウが閉じられたときの処理
  mainWindow.on('closed', () => {
    mainWindow = null;
    safeConsoleLog('Main window closed');
  });

  // 本番環境でのセキュリティ強化
  if (isProduction) {
    // 新規ウィンドウ作成を防ぐ
    mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  }
}

// アプリが準備できたときにウィンドウを作成
app.whenReady().then(() => {
  initializeApp();
  createWindow();
});

// すべてのウィンドウが閉じられたときにアプリを終了
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC通信の設定
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '移動先フォルダを選択'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-output-folder', async (event, defaultPath = '') => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '移動先フォルダを選択',
    defaultPath: defaultPath || undefined
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// ファイル操作
ipcMain.handle('delete-files', async (event, filePaths, toRecycleBin) => {
  try {
    const results = [];
    
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      try {
        // 進捗を送信
        if (mainWindow) {
          mainWindow.webContents.send('file-operation-progress', {
            current: i + 1,
            total: filePaths.length,
            filename: path.basename(filePath),
            operation: toRecycleBin ? 'trash' : 'delete'
          });
        }
        
        if (toRecycleBin) {
          // ゴミ箱へ移動
          const success = await moveToRecycleBin(filePath);
          if (success) {
            safeConsoleLog('Moved to recycle bin successfully:', filePath);
            results.push({ path: filePath, success: true });
          } else {
            safeConsoleLog('Failed to move to recycle bin, file remains:', filePath);
            results.push({ 
              path: filePath, 
              success: false, 
              error: 'Failed to move to recycle bin',
              partialSuccess: true,
              message: 'File remains but operation completed'
            });
          }
        } else {
          // 完全削除
          const success = await safeDeleteFile(filePath);
          if (success) {
            safeConsoleLog('Permanently deleted successfully:', filePath);
            results.push({ path: filePath, success: true });
          } else {
            safeConsoleLog('Failed to delete permanently:', filePath);
            results.push({ 
              path: filePath, 
              success: false, 
              error: 'Failed to delete permanently'
            });
          }
        }
      } catch (error) {
        safeConsoleError(`ファイル操作エラー (${filePath}):`, error);
        results.push({ path: filePath, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success && !r.partialSuccess).length;
    const partialSuccessCount = results.filter(r => r.partialSuccess).length;
    
    safeConsoleLog(`ファイル操作完了: 成功 ${successCount}件, 部分成功 ${partialSuccessCount}件, 失敗 ${errorCount}件`);
    
    return {
      success: true,
      results: results,
      summary: {
        total: filePaths.length,
        success: successCount,
        error: errorCount,
        partialSuccess: partialSuccessCount
      }
    };
  } catch (error) {
    safeConsoleError('ファイル操作エラー:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// ファイル保存機能
ipcMain.handle('save-file', async (event, options) => {
  try {
    const { content, filename, filters } = options;
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'ファイルを保存',
      defaultPath: filename,
      filters: filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    const filePath = result.filePath;
    
    // ファイルを保存
    await fs.writeFile(filePath, content, 'utf8');
    
    safeConsoleLog('ファイル保存成功:', filePath);
    
    return {
      success: true,
      filePath: filePath
    };
  } catch (error) {
    safeConsoleError('ファイル保存エラー:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('move-files', async (event, filePaths, destinationPath) => {
  try {
    const results = [];
    let partialSuccessCount = 0;
    
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      try {
        // 進捗を送信
        if (mainWindow) {
          mainWindow.webContents.send('file-operation-progress', {
            current: i + 1,
            total: filePaths.length,
            filename: path.basename(filePath),
            operation: 'move'
          });
        }
        
        const fileName = path.basename(filePath);
        const newPath = path.join(destinationPath, fileName);
        
        // 同名ファイルが存在する場合の処理
        let finalPath = newPath;
        let counter = 1;
        while (await fileExists(finalPath)) {
          const nameWithoutExt = path.parse(fileName).name;
          const ext = path.parse(fileName).ext;
          finalPath = path.join(destinationPath, `${nameWithoutExt}_${counter}${ext}`);
          counter++;
        }
        
        // 安全なファイル移動（異なるドライブ間でも動作）
        await safeMoveFile(filePath, finalPath);
        safeConsoleLog('移動:', filePath, '→', finalPath);
        results.push({ path: filePath, newPath: finalPath, success: true });
      } catch (error) {
        safeConsoleError(`ファイル移動エラー (${filePath}):`, error);
        
        // EPERMエラーの場合は部分的な成功として扱う
        if (error.code === 'EPERM') {
          partialSuccessCount++;
          results.push({ 
            path: filePath, 
            success: false, 
            error: error.message,
            partialSuccess: true,
            message: 'ファイルはコピーされましたが、元ファイルの削除に失敗しました'
          });
        } else {
          results.push({ path: filePath, success: false, error: error.message });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success && !r.partialSuccess).length;
    const totalPartialSuccess = results.filter(r => r.partialSuccess).length;
    
    safeConsoleLog(`ファイル移動完了: 成功 ${successCount}件, 部分成功 ${totalPartialSuccess}件, 失敗 ${errorCount}件`);
    
    // 操作完了を通知
    if (mainWindow) {
      mainWindow.webContents.send('file-operation-complete', {
        operation: 'move',
        successCount: successCount,
        errorCount: errorCount,
        partialSuccessCount: totalPartialSuccess
      });
    }
    
    return { 
      success: errorCount === 0, 
      results: results,
      successCount: successCount,
      errorCount: errorCount,
      partialSuccessCount: totalPartialSuccess
    };
  } catch (error) {
    safeConsoleError('ファイル移動エラー:', error);
    return { success: false, error: error.message };
  }
});

// 安全なファイル移動（異なるドライブ間でも動作）
async function safeMoveFile(sourcePath, destinationPath) {
  try {
    // まずrenameを試行（同じドライブ内の場合）
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    if (error.code === 'EXDEV') {
      // 異なるドライブ間の場合は、コピーしてから削除
      safeConsoleLog('異なるドライブ間の移動を検出、コピー&削除方式を使用');
      await fs.copyFile(sourcePath, destinationPath);
      await safeDeleteFile(sourcePath);
    } else {
      // その他のエラーは再スロー
      throw error;
    }
  }
}

// 安全なファイル削除（EPERMエラー対策）
async function safeDeleteFile(filePath) {
  const maxRetries = 3;
  const retryDelay = 2000; // 2秒
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.unlink(filePath);
      safeConsoleLog(`ファイル削除成功 (試行${attempt}回目):`, filePath);
      return true;
    } catch (error) {
      if (error.code === 'EPERM' && attempt < maxRetries) {
        safeConsoleLog(`ファイルが使用中です。${retryDelay/1000}秒待機してから再試行します (${attempt}/${maxRetries}):`, filePath);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else if (error.code === 'EPERM' && attempt === maxRetries) {
        safeConsoleWarn(`最大試行回数に達しました。ファイルは残ります:`, filePath);
        return false;
      } else {
        throw error;
      }
    }
  }
}

// ゴミ箱への移動（Windows）- 改良版
async function moveToRecycleBin(filePath) {
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      // 方法1: PowerShell + Microsoft.VisualBasic（推奨）
      const command1 = `powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${filePath.replace(/\\/g, '\\\\')}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`;
      await execAsync(command1);
      safeConsoleLog('PowerShellでのゴミ箱移動成功:', filePath);
      return true;
    } catch (error) {
      safeConsoleWarn('PowerShellでのゴミ箱移動に失敗、代替方法を試行:', error.message);
      
      try {
        // 方法2: より安全なPowerShellコマンド（RecycleBinオプション付き）
        const command2 = `powershell -command "$shell = New-Object -ComObject Shell.Application; $shell.NameSpace(0x0a).MoveHere('${filePath.replace(/\\/g, '\\\\')}')"`;
        await execAsync(command2);
        safeConsoleLog('代替PowerShellでのゴミ箱移動成功:', filePath);
        return true;
      } catch (error2) {
        safeConsoleWarn('代替PowerShellも失敗、ファイルは残します:', error2.message);
        
        // 方法3: ファイルを残して部分的な成功として扱う
        safeConsoleLog('ゴミ箱への移動に失敗したため、ファイルは残します:', filePath);
        return false;
      }
    }
  } else {
    // 他のOSでは通常の削除
    return await safeDeleteFile(filePath);
  }
}

// ファイル存在チェック
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 画像分析（実際の実装）
ipcMain.handle('scan-images', async (event, folderPath, includeSubfolders) => {
  try {
    safeConsoleLog('スキャン開始:', folderPath);
    
    // 実際の画像分析を実行
    const results = await imageAnalyzer.scanFolder(folderPath, includeSubfolders);
    
    safeConsoleLog('スキャン完了 - 結果:', {
      blurImages: results.blurImages?.length || 0,
      similarImages: results.similarImages?.length || 0,
      errors: results.errors?.length || 0
    });
    
    // 結果を送信（mainWindowの存在チェック付き）
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('scan-complete', results);
        safeConsoleLog('スキャン完了イベントを送信しました');
      } catch (sendError) {
        safeConsoleError('スキャン完了イベント送信エラー:', sendError);
      }
    } else {
      safeConsoleWarn('mainWindowが利用できないため、スキャン完了イベントを送信できません');
    }
    
    return { success: true };
  } catch (error) {
    safeConsoleError('スキャンエラー:', error);
    
    // エラーも送信（mainWindowの存在チェック付き）
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('scan-error', { message: error.message });
      } catch (sendError) {
        safeConsoleError('スキャンエラーイベント送信エラー:', sendError);
      }
    }
    
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-scan', async () => {
  safeConsoleLog('スキャンキャンセル');
  return { success: true };
});

// 画像分析（選択エラーのみ再スキャン）
ipcMain.handle('retry-scan-errors', async (event, filePaths) => {
  try {
    safeConsoleLog('選択エラーのみ再スキャン:', filePaths);
    // imageAnalyzerに個別ファイルの再分析メソッドがあれば利用、なければscanFolderの一部ロジックを流用
    const results = {
      blurImages: [],
      similarImages: [],
      errors: []
    };
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      try {
        // ブレ検出
        const blurScore = await imageAnalyzer.detectBlur(filePath);
        if (blurScore > imageAnalyzer.blurThreshold) {
          const fileStats = await fs.stat(filePath);
          results.blurImages.push({
            id: `blur_retry_${i}`,
            filename: path.basename(filePath),
            filePath: filePath,
            size: fileStats.size,
            modifiedDate: fileStats.mtime.toISOString(),
            blurScore: Math.round(blurScore)
          });
        }
      } catch (error) {
        results.errors.push({
          id: `error_retry_${i}`,
          filename: path.basename(filePath),
          filePath: filePath,
          error: error.message
        });
      }
    }
    // 類似画像検出は省略（必要なら追加）
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-complete', results);
    }
    return { success: true };
  } catch (error) {
    safeConsoleError('選択エラー再スキャンエラー:', error);
    return { success: false, error: error.message };
  }
});

// 設定関連のIPC通信
ipcMain.handle('load-settings', async () => {
    try {
        const settings = await loadSettings();
        return settings;
    } catch (error) {
        safeConsoleError('設定の読み込みに失敗しました:', error);
        return defaultSettings;
    }
});

ipcMain.handle('save-settings', async (event, settings) => {
    try {
        await saveSettings(settings);
        return { success: true };
    } catch (error) {
        safeConsoleError('設定の保存に失敗しました:', error);
        return { success: false, error: error.message };
    }
});

// ログ関連のIPC通信
ipcMain.handle('write-to-log', async (event, message) => {
    try {
        await writeToLog(message);
        return { success: true };
    } catch (error) {
        safeConsoleError('ログ書き込みに失敗しました:', error);
        return { success: false, error: error.message };
    }
});

// ログ
ipcMain.handle('log-message', async (event, level, message) => {
  safeConsoleLog(`[${level.toUpperCase()}] ${message}`);
  return { success: true };
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  safeConsoleError('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  safeConsoleError('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function initializeApp() {
    try {
        // 設定を読み込み
        const settings = await loadSettings();
        
        // ImageAnalyzerを初期化
        imageAnalyzer = new ImageAnalyzer();
        
        // 設定をImageAnalyzerに適用（デフォルト値を設定）
        const similarityThreshold = settings.similarityThreshold || 70;
        const blurThreshold = settings.blurThreshold || 15;
        
        imageAnalyzer.setSimilarityThreshold(similarityThreshold);
        imageAnalyzer.setBlurThreshold(blurThreshold);
        
        // デバッグ情報を出力
        safeConsoleLog(`ImageAnalyzer初期化 - 類似度閾値: ${similarityThreshold}, ブレ閾値: ${blurThreshold}`);
        
        // 進捗コールバックを設定
        imageAnalyzer.setProgressCallback((progress) => {
            if (mainWindow) {
                mainWindow.webContents.send('scan-progress', progress);
            }
        });
        
        safeConsoleLog('アプリケーションを初期化しました');
    } catch (error) {
        safeConsoleError('アプリケーションの初期化に失敗しました:', error);
    }
}

ipcMain.handle('copy-files', async (event, filePaths, destinationPath) => {
  try {
    const results = [];
    
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      try {
        // 進捗を送信
        if (mainWindow) {
          mainWindow.webContents.send('file-operation-progress', {
            current: i + 1,
            total: filePaths.length,
            filename: path.basename(filePath),
            operation: 'copy'
          });
        }
        
        const fileName = path.basename(filePath);
        const newPath = path.join(destinationPath, fileName);
        
        // 同名ファイルが存在する場合の処理
        let finalPath = newPath;
        let counter = 1;
        while (await fileExists(finalPath)) {
          const nameWithoutExt = path.parse(fileName).name;
          const ext = path.parse(fileName).ext;
          finalPath = path.join(destinationPath, `${nameWithoutExt}_${counter}${ext}`);
          counter++;
        }
        
        // ファイルコピー
        await fs.copyFile(filePath, finalPath);
        safeConsoleLog('コピー:', filePath, '→', finalPath);
        results.push({ path: filePath, newPath: finalPath, success: true });
      } catch (error) {
        safeConsoleError(`ファイルコピーエラー (${filePath}):`, error);
        results.push({ path: filePath, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    safeConsoleLog(`ファイルコピー完了: 成功 ${successCount}件, 失敗 ${errorCount}件`);
    
    // 操作完了を通知
    if (mainWindow) {
      mainWindow.webContents.send('file-operation-complete', {
        operation: 'copy',
        successCount: successCount,
        errorCount: errorCount,
        partialSuccessCount: 0
      });
    }
    
    return { 
      success: errorCount === 0, 
      results: results,
      successCount: successCount,
      errorCount: errorCount,
      partialSuccessCount: 0
    };
  } catch (error) {
    safeConsoleError('ファイルコピーエラー:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}); 