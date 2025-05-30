// preloadConfirmationDialog.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('confirmationDialogAPI', {
    // メインプロセスからダイアログの初期データを受け取るためのリスナー登録
    onDialogData: (callback) => ipcRenderer.on('dialog-data', (event, data) => callback(data)),
    // ダイアログの結果をメインプロセスに送信
    sendDialogResponse: (response) => ipcRenderer.send('dialog-response', response),
    // ダイアログの準備ができたことをメインプロセスに通知 (オプション)
    dialogReady: () => ipcRenderer.send('dialog-ready')
});

console.log('Preload script for confirmation dialog loaded.');
