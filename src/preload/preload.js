// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // フォルダ選択ダイアログを開く
    openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),

    // 設定ウィンドウを開くようメインプロセスに通知する
    openSettingsWindow: () => ipcRenderer.send('open-settings-window'),

    // (以下、他のAPIも必要に応じて追加)
    // Pythonスクリプト実行をリクエストする関数 (例)
    // executePython: (scriptName, args) => ipcRenderer.invoke('execute-python-script', scriptName, args),
});

console.log('Preload script for main window loaded.');
