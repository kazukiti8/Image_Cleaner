const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const ImageAnalyzer = require('./imageAnalyzer');

// 文字エンコーディング設定
process.env.LANG = 'ja_JP.UTF-8';
process.env.LC_ALL = 'ja_JP.UTF-8';

// コンソール出力の文字エンコーディングを設定
if (process.platform === 'win32') {
    // Windowsの場合、コンソールのコードページをUTF-8に設定
    require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
}

// メインウィンドウの参照を保持
let mainWindow;
let imageAnalyzer;

// 設定ファイルのパス
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// デフォルト設定
const defaultSettings = {
    similarityThreshold: 80,
    blurThreshold: 60,
    includeSubfolders: true,
    deleteConfirmation: 'always',
    moveDestination: '',
    enableDebugLog: false,
    saveLogFile: false
};

// 設定を読み込み
async function loadSettings() {
    try {
        const data = await fs.readFile(settingsPath, 'utf8');
        return { ...defaultSettings, ...JSON.parse(data) };
    } catch (error) {
        console.log('設定ファイルが見つからないため、デフォルト設定を使用します');
        return defaultSettings;
    }
}

// 設定を保存
async function saveSettings(settings) {
    try {
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        console.log('設定を保存しました');
    } catch (error) {
        console.error('設定の保存に失敗しました:', error);
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
      allowRunningInsecureContent: false
    },
    icon: path.join(__dirname, '../renderer/assets/icons/app-icon.png'), // アイコンファイルが存在する場合
    title: 'イメージクリーンアップアシスタント',
    show: false, // 準備が整ってから表示
    autoHideMenuBar: true // メニューバーを自動非表示
  });

  // メインウィンドウのHTMLファイルを読み込み
  mainWindow.loadFile(path.join(__dirname, '../renderer/html/index.html'));

  // 開発モードの場合はDevToolsを開く
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // ウィンドウが準備できたときに表示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ウィンドウが閉じられたときの処理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '移動先フォルダを選択'
  });
  
  if (!result.canceled) {
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
            console.log('ゴミ箱へ移動成功:', filePath);
            results.push({ path: filePath, success: true });
          } else {
            console.warn('ゴミ箱への移動に失敗、ファイルは残ります:', filePath);
            results.push({ 
              path: filePath, 
              success: false, 
              error: 'ファイルが使用中のため削除できませんでした',
              partialSuccess: true,
              message: 'ファイルは残りますが、操作は完了しました'
            });
          }
        } else {
          // 完全削除
          const success = await safeDeleteFile(filePath);
          if (success) {
            console.log('完全削除成功:', filePath);
            results.push({ path: filePath, success: true });
          } else {
            console.warn('完全削除に失敗、ファイルは残ります:', filePath);
            results.push({ 
              path: filePath, 
              success: false, 
              error: 'ファイルが使用中のため削除できませんでした',
              partialSuccess: true,
              message: 'ファイルは残りますが、操作は完了しました'
            });
          }
        }
      } catch (error) {
        console.error(`ファイル操作エラー (${filePath}):`, error);
        results.push({ path: filePath, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success && !r.partialSuccess).length;
    const partialSuccessCount = results.filter(r => r.partialSuccess).length;
    
    console.log(`ファイル操作完了: 成功 ${successCount}件, 部分成功 ${partialSuccessCount}件, 失敗 ${errorCount}件`);
    
    // 操作完了を通知
    if (mainWindow) {
      mainWindow.webContents.send('file-operation-complete', {
        operation: toRecycleBin ? 'trash' : 'delete',
        successCount: successCount,
        errorCount: errorCount,
        partialSuccessCount: partialSuccessCount
      });
    }
    
    return { 
      success: errorCount === 0, 
      results: results,
      successCount: successCount,
      errorCount: errorCount,
      partialSuccessCount: partialSuccessCount
    };
  } catch (error) {
    console.error('ファイル削除エラー:', error);
    return { success: false, error: error.message };
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
        console.log('移動:', filePath, '→', finalPath);
        results.push({ path: filePath, newPath: finalPath, success: true });
      } catch (error) {
        console.error(`ファイル移動エラー (${filePath}):`, error);
        
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
    
    console.log(`ファイル移動完了: 成功 ${successCount}件, 部分成功 ${totalPartialSuccess}件, 失敗 ${errorCount}件`);
    
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
    console.error('ファイル移動エラー:', error);
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
      console.log('異なるドライブ間の移動を検出、コピー&削除方式を使用');
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
      console.log(`ファイル削除成功 (試行${attempt}回目):`, filePath);
      return true;
    } catch (error) {
      if (error.code === 'EPERM' && attempt < maxRetries) {
        console.log(`ファイルが使用中です。${retryDelay/1000}秒待機してから再試行します (${attempt}/${maxRetries}):`, filePath);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else if (error.code === 'EPERM' && attempt === maxRetries) {
        console.warn(`最大試行回数に達しました。ファイルは残ります:`, filePath);
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
      // 方法1: PowerShell + Microsoft.VisualBasic
      const command1 = `powershell -command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${filePath.replace(/\\/g, '\\\\')}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`;
      await execAsync(command1);
      console.log('PowerShellでのゴミ箱移動成功:', filePath);
      return true;
    } catch (error) {
      console.warn('PowerShellでのゴミ箱移動に失敗、代替方法を試行:', error.message);
      
      try {
        // 方法2: より安全なPowerShellコマンド
        const command2 = `powershell -command "Remove-Item '${filePath.replace(/\\/g, '\\\\')}' -Force -Recurse -ErrorAction SilentlyContinue"`;
        await execAsync(command2);
        console.log('代替PowerShellでの削除成功:', filePath);
        return true;
      } catch (error2) {
        console.warn('代替PowerShellも失敗、通常削除を試行:', error2.message);
        
        try {
          // 方法3: 通常削除（リトライ機能付き）
          return await safeDeleteFile(filePath);
        } catch (error3) {
          console.error('すべての削除方法が失敗:', error3.message);
          throw error3;
        }
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
    console.log('スキャン開始:', folderPath);
    
    // 実際の画像分析を実行
    const results = await imageAnalyzer.scanFolder(folderPath, includeSubfolders);
    
    console.log('スキャン完了 - 結果:', {
      blurImages: results.blurImages?.length || 0,
      similarImages: results.similarImages?.length || 0,
      errors: results.errors?.length || 0
    });
    
    // 結果を送信（mainWindowの存在チェック付き）
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('scan-complete', results);
        console.log('スキャン完了イベントを送信しました');
      } catch (sendError) {
        console.error('スキャン完了イベント送信エラー:', sendError);
      }
    } else {
      console.warn('mainWindowが利用できないため、スキャン完了イベントを送信できません');
    }
    
    return { success: true };
  } catch (error) {
    console.error('スキャンエラー:', error);
    
    // エラーも送信（mainWindowの存在チェック付き）
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('scan-error', { message: error.message });
      } catch (sendError) {
        console.error('スキャンエラーイベント送信エラー:', sendError);
      }
    }
    
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-scan', async () => {
  console.log('スキャンキャンセル');
  return { success: true };
});

// 設定
ipcMain.handle('get-settings', async () => {
  // デフォルト設定を返す
  return {
    scanSubfolders: true,
    deleteOperation: 'recycleBin',
    logLevel: 'normal',
    logFilePath: path.join(app.getPath('userData'), 'logs')
  };
});

// 設定関連のIPC通信
ipcMain.handle('load-settings', async () => {
    try {
        const settings = await loadSettings();
        return settings;
    } catch (error) {
        console.error('設定の読み込みに失敗しました:', error);
        return defaultSettings;
    }
});

ipcMain.handle('save-settings', async (event, settings) => {
    try {
        await saveSettings(settings);
        
        // ImageAnalyzerの設定を更新
        if (imageAnalyzer) {
            imageAnalyzer.setSimilarityThreshold(settings.similarityThreshold);
            imageAnalyzer.setBlurThreshold(settings.blurThreshold);
        }
        
        return { success: true };
    } catch (error) {
        console.error('設定の保存に失敗しました:', error);
        return { success: false, error: error.message };
    }
});

// ログ
ipcMain.handle('log-message', async (event, level, message) => {
  console.log(`[${level.toUpperCase()}] ${message}`);
  return { success: true };
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function initializeApp() {
    try {
        // 設定を読み込み
        const settings = await loadSettings();
        
        // ImageAnalyzerを初期化
        imageAnalyzer = new ImageAnalyzer();
        
        // 設定をImageAnalyzerに適用
        imageAnalyzer.setSimilarityThreshold(settings.similarityThreshold);
        imageAnalyzer.setBlurThreshold(settings.blurThreshold);
        
        // 進捗コールバックを設定
        imageAnalyzer.setProgressCallback((progress) => {
            if (mainWindow) {
                mainWindow.webContents.send('scan-progress', progress);
            }
        });
        
        console.log('アプリケーションを初期化しました');
    } catch (error) {
        console.error('アプリケーションの初期化に失敗しました:', error);
    }
} 