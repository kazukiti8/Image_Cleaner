// preloadSettings.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronSettingsAPI', {
    closeSettingsWindow: () => ipcRenderer.send('close-settings-window'),
    saveSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-app-settings'),
    openDirectoryDialogForLogs: () => ipcRenderer.invoke('dialog:openDirectoryForLogs') // ログ用フォルダ選択
});

console.log('Preload script for settings dialog loaded.');
