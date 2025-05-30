// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // フォルダ選択ダイアログを開く
    openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),

    // 設定ウィンドウを開く
    openSettingsWindow: () => ipcRenderer.send('open-settings-window'),

    // Pythonによるスキャン実行を要求
    executeScan: (folderPath) => ipcRenderer.invoke('execute-scan', folderPath),
    
    // 特定ファイルの再スキャンを要求
    rescanFiles: (filePaths) => ipcRenderer.invoke('rescan-files', filePaths),
    
    // ファイルパスを安全な画像ソースに変換するよう要求
    convertFileSrc: (filePath) => ipcRenderer.invoke('convert-file-src', filePath),

    // 確認ダイアログを開き、結果をPromiseで受け取る
    showConfirmationDialog: (data) => ipcRenderer.invoke('show-confirmation-dialog', data),

    // ★★★ 新しいAPI: ファイル操作の実行を要求 ★★★
    performFileOperation: (operationDetails) => ipcRenderer.invoke('perform-file-operation', operationDetails),

    // エラーログのエクスポートを要求
    exportErrorLogs: () => ipcRenderer.invoke('export-error-logs')
});

console.log('Preload script for main window loaded.');
