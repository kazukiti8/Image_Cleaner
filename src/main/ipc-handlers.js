const { ipcMain, dialog, BrowserWindow } = require('electron');

class IPCHandlers {
    constructor(windowManager, settingsManager, scanController, fileOperations) {
        this.windowManager = windowManager;
        this.settingsManager = settingsManager;
        this.scanController = scanController;
        this.fileOperations = fileOperations;
    }

    setupHandlers() {
        this._setupDialogHandlers();
        this._setupWindowHandlers();
        this._setupSettingsHandlers();
        this._setupScanHandlers();
        this._setupFileOperationHandlers();
        this._setupConfirmationHandlers();
    }

    _setupDialogHandlers() {
        ipcMain.handle('dialog:openDirectory', async (event) => {
            const parentWindow = BrowserWindow.fromWebContents(event.sender) || this.windowManager.getMainWindow();
            if (!parentWindow) return null;
            
            const { canceled, filePaths } = await dialog.showOpenDialog(parentWindow, {
                properties: ['openDirectory']
            });
            return canceled ? null : filePaths[0];
        });

        ipcMain.handle('dialog:openDirectoryForLogs', async () => {
            const settingsWindow = this.windowManager.getSettingsWindow();
            if (!settingsWindow) return null;
            
            const { canceled, filePaths } = await dialog.showOpenDialog(settingsWindow, {
                title: 'ログファイルの保存場所を選択',
                properties: ['openDirectory', 'createDirectory']
            });
            return canceled ? null : filePaths[0];
        });
    }

    _setupWindowHandlers() {
        ipcMain.on('open-settings-window', () => {
            if (this.windowManager.getMainWindow()) {
                this.windowManager.createSettingsWindow();
            }
        });

        ipcMain.on('close-settings-window', () => {
            this.windowManager.closeSettingsWindow();
        });
    }

    _setupSettingsHandlers() {
        ipcMain.handle('load-app-settings', async () => {
            return await this.settingsManager.loadSettings();
        });

        ipcMain.handle('save-app-settings', async (event, settings) => {
            const result = await this.settingsManager.saveSettings(settings);
            const mainWindow = this.windowManager.getMainWindow();
            
            if (result.success && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('settings-updated', result.settings);
            }
            return result;
        });
    }

    _setupScanHandlers() {
        ipcMain.handle('execute-scan', async (event, folderPath) => {
            return await this.scanController.executeScan(folderPath);
        });
    }

    _setupFileOperationHandlers() {
        const ProtocolHandler = require('./protocol-handler');
        
        ipcMain.handle('convert-file-src', (event, filePath) => {
            return ProtocolHandler.convertFileSrc(filePath);
        });

        ipcMain.handle('perform-file-operation', async (event, { actionType, paths, destination }) => {
            return await this.fileOperations.performOperation(actionType, paths, destination);
        });
    }

    _setupConfirmationHandlers() {
        ipcMain.handle('show-confirmation-dialog', (event, data) => {
            return new Promise((resolve) => {
                const parentWin = BrowserWindow.fromWebContents(event.sender) || this.windowManager.getMainWindow();
                if (!parentWin) {
                    console.error("Parent window for confirmation dialog not found.");
                    resolve({ confirmed: false, error: "Parent window not found." });
                    return;
                }
                
                this.windowManager.createConfirmationDialog(parentWin, data);
                
                const listener = (e, response) => {
                    this.windowManager.closeConfirmationWindow();
                    ipcMain.removeListener('dialog-response', listener);
                    resolve(response);
                };
                ipcMain.once('dialog-response', listener);
            });
        });
    }
}

module.exports = IPCHandlers;