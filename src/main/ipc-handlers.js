const { ipcMain, dialog, BrowserWindow } = require('electron');

class IPCHandlers {
    constructor(windowManager, settingsManager, scanController, fileOperations, logManager) {
        this.windowManager = windowManager;
        this.settingsManager = settingsManager;
        this.scanController = scanController;
        this.fileOperations = fileOperations;
        this.logManager = logManager;
    }

    setupHandlers() {
        this._setupDialogHandlers();
        this._setupWindowHandlers();
        this._setupSettingsHandlers();
        this._setupScanHandlers();
        this._setupFileOperationHandlers();
        this._setupConfirmationHandlers();
        this._setupLogHandlers();
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

        ipcMain.handle('rescan-files', async (event, filePaths) => {
            return await this.scanController.rescanFiles(filePaths);
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

    _setupLogHandlers() {
        ipcMain.handle('export-error-logs', async (event) => {
            try {
                const errorLogs = await this.logManager.getErrorLogs(30); // 30日分のエラーログ
                
                const mainWindow = this.windowManager.getMainWindow();
                if (!mainWindow) {
                    throw new Error('Main window not found');
                }
                
                const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                    title: 'エラーログをエクスポート',
                    defaultPath: `error-logs-${new Date().toISOString().split('T')[0]}.json`,
                    filters: [
                        { name: 'JSON Files', extensions: ['json'] },
                        { name: 'CSV Files', extensions: ['csv'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                });
                
                if (canceled || !filePath) {
                    return { success: false, message: 'エクスポートがキャンセルされました。' };
                }
                
                const fs = require('fs').promises;
                const path = require('path');
                const ext = path.extname(filePath).toLowerCase();
                
                if (ext === '.csv') {
                    // CSV形式でエクスポート
                    const csvHeader = 'Timestamp,Level,Category,Message,Data\n';
                    const csvRows = errorLogs.map(log => {
                        const data = log.data ? JSON.stringify(log.data).replace(/"/g, '""') : '';
                        return `"${log.timestamp}","${log.level}","${log.category}","${log.message.replace(/"/g, '""')}","${data}"`;
                    }).join('\n');
                    
                    await fs.writeFile(filePath, csvHeader + csvRows, 'utf8');
                } else {
                    // JSON形式でエクスポート
                    await fs.writeFile(filePath, JSON.stringify(errorLogs, null, 2), 'utf8');
                }
                
                await this.logManager.info('LOG_EXPORT', `Error logs exported to: ${filePath}`, {
                    filePath,
                    logCount: errorLogs.length,
                    format: ext
                });
                
                return { 
                    success: true, 
                    message: `エラーログが ${filePath} にエクスポートされました。`,
                    logCount: errorLogs.length 
                };
                
            } catch (error) {
                console.error('Error exporting logs:', error);
                await this.logManager.error('LOG_EXPORT', 'Failed to export error logs', { error: error.message });
                return { 
                    success: false, 
                    message: `エラーログのエクスポートに失敗しました: ${error.message}` 
                };
            }
        });
    }
}

module.exports = IPCHandlers;