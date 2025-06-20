const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

// レンダラープロセスで使用可能なAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  // フォルダ選択
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectOutputFolder: (defaultPath) => ipcRenderer.invoke('select-output-folder', defaultPath),
  
  // ファイル操作
  deleteFiles: (filePaths, toRecycleBin) => ipcRenderer.invoke('delete-files', filePaths, toRecycleBin),
  moveFiles: (filePaths, destinationPath) => ipcRenderer.invoke('move-files', filePaths, destinationPath),
  copyFiles: (filePaths, destinationPath) => ipcRenderer.invoke('copy-files', filePaths, destinationPath),
  
  // ファイル保存
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  
  // 画像分析
  scanImages: (folderPath, includeSubfolders) => ipcRenderer.invoke('scan-images', folderPath, includeSubfolders),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  retryScanErrors: (filePaths) => ipcRenderer.invoke('retry-scan-errors', filePaths),
  
  // ファイル監視
  startFileWatching: (folderPath) => ipcRenderer.invoke('start-file-watching', folderPath),
  stopFileWatching: () => ipcRenderer.invoke('stop-file-watching'),
  getWatchedFolders: () => ipcRenderer.invoke('get-watched-folders'),
  
  // 設定
  getSettings: () => ipcRenderer.invoke('get-settings'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // ログ
  logMessage: (level, message) => ipcRenderer.invoke('log-message', level, message),
  writeToLog: (message) => ipcRenderer.invoke('write-to-log', message),
  
  // イベントリスナー
  onScanProgress: (callback) => {
    console.log('onScanProgress called');
    const handler = (event, data) => {
      try {
        console.log('scan-progress event received:', data);
        if (typeof callback === 'function') {
          callback(data);
        } else {
          console.warn('onScanProgress callback is not a function:', typeof callback);
        }
      } catch (error) {
        console.error('スキャン進捗コールバックエラー:', error);
        console.error('エラーの詳細:', {
          message: error.message,
          stack: error.stack,
          callbackType: typeof callback
        });
      }
    };
    ipcRenderer.on('scan-progress', handler);
    return () => ipcRenderer.removeListener('scan-progress', handler);
  },
  onScanComplete: (callback) => {
    console.log('onScanComplete called');
    const handler = (event, data) => {
      try {
        console.log('scan-complete event received:', data);
        if (typeof callback === 'function') {
          callback(data);
        } else {
          console.warn('onScanComplete callback is not a function:', typeof callback);
        }
      } catch (error) {
        console.error('スキャン完了コールバックエラー:', error);
        console.error('エラーの詳細:', {
          message: error.message,
          stack: error.stack,
          callbackType: typeof callback,
          dataType: typeof data,
          dataKeys: data ? Object.keys(data) : 'null'
        });
      }
    };
    ipcRenderer.on('scan-complete', handler);
    return () => ipcRenderer.removeListener('scan-complete', handler);
  },
  onScanError: (callback) => {
    console.log('onScanError called');
    const handler = (event, data) => {
      try {
        console.log('scan-error event received:', data);
        if (typeof callback === 'function') {
          callback(data);
        } else {
          console.warn('onScanError callback is not a function:', typeof callback);
        }
      } catch (error) {
        console.error('スキャンエラーコールバックエラー:', error);
        console.error('エラーの詳細:', {
          message: error.message,
          stack: error.stack,
          callbackType: typeof callback
        });
      }
    };
    ipcRenderer.on('scan-error', handler);
    return () => ipcRenderer.removeListener('scan-error', handler);
  },
  onFileOperationProgress: (callback) => {
    console.log('onFileOperationProgress called');
    const handler = (event, data) => {
      try {
        if (typeof callback === 'function') {
          callback(data);
        } else {
          console.warn('onFileOperationProgress callback is not a function:', typeof callback);
        }
      } catch (error) {
        console.error('ファイル操作進捗コールバックエラー:', error);
        console.error('エラーの詳細:', {
          message: error.message,
          stack: error.stack,
          callbackType: typeof callback
        });
      }
    };
    ipcRenderer.on('file-operation-progress', handler);
    return () => ipcRenderer.removeListener('file-operation-progress', handler);
  },
  onFileOperationComplete: (callback) => {
    console.log('onFileOperationComplete called');
    const handler = (event, data) => {
      try {
        if (typeof callback === 'function') {
          callback(data);
        } else {
          console.warn('onFileOperationComplete callback is not a function:', typeof callback);
        }
      } catch (error) {
        console.error('ファイル操作完了コールバックエラー:', error);
        console.error('エラーの詳細:', {
          message: error.message,
          stack: error.stack,
          callbackType: typeof callback
        });
      }
    };
    ipcRenderer.on('file-operation-complete', handler);
    return () => ipcRenderer.removeListener('file-operation-complete', handler);
  },
  
  // ファイルシステム変更イベント
  onFileSystemChange: (callback) => {
    console.log('onFileSystemChange called');
    const handler = (event, data) => {
      try {
        if (typeof callback === 'function') {
          callback(data);
        } else {
          console.warn('onFileSystemChange callback is not a function:', typeof callback);
        }
      } catch (error) {
        console.error('ファイルシステム変更コールバックエラー:', error);
        console.error('エラーの詳細:', {
          message: error.message,
          stack: error.stack,
          callbackType: typeof callback
        });
      }
    };
    ipcRenderer.on('file-system-change', handler);
    return () => ipcRenderer.removeListener('file-system-change', handler);
  },
  
  // リスナーの削除
  removeAllListeners: (channel) => {
    console.log('removeAllListeners called for channel:', channel);
    ipcRenderer.removeAllListeners(channel);
  }
});

console.log('Preload script loaded successfully');

// セキュリティ警告を無効化（開発時のみ）
if (process.env.NODE_ENV === 'development') {
  console.log('Preload script loaded');
} 