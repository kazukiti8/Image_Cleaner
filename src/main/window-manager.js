const { BrowserWindow } = require('electron');
const path = require('path');
const { WINDOW_SIZES, FILE_PATHS } = require('./utils/constants');

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.settingsWindow = null;
        this.confirmationWindow = null;
    }

    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            ...WINDOW_SIZES.MAIN,
            webPreferences: {
                preload: path.join(__dirname, FILE_PATHS.PRELOAD.MAIN),
                contextIsolation: true,
                nodeIntegration: false,
            }
        });
        
        this.mainWindow.loadFile(path.join(__dirname, FILE_PATHS.RENDERER.MAIN));
        this.mainWindow.on('closed', () => { this.mainWindow = null; });
        
        return this.mainWindow;
    }

    createSettingsWindow() {
        if (this.settingsWindow) {
            this.settingsWindow.focus();
            return this.settingsWindow;
        }

        const parentPos = this.mainWindow ? this.mainWindow.getPosition() : [0, 0];
        const parentSize = this.mainWindow ? this.mainWindow.getSize() : [800, 600];

        this.settingsWindow = new BrowserWindow({
            ...WINDOW_SIZES.SETTINGS,
            title: '設定',
            parent: this.mainWindow,
            modal: true,
            show: false,
            frame: false,
            transparent: true,
            resizable: false,
            maximizable: false,
            minimizable: false,
            webPreferences: {
                preload: path.join(__dirname, FILE_PATHS.PRELOAD.SETTINGS),
                contextIsolation: true,
                nodeIntegration: false,
                devTools: true
            },
            autoHideMenuBar: true,
            x: parentPos[0] + Math.floor((parentSize[0] - WINDOW_SIZES.SETTINGS.width) / 2),
            y: parentPos[1] + Math.floor((parentSize[1] - WINDOW_SIZES.SETTINGS.height) / 2),
        });

        this.settingsWindow.loadFile(path.join(__dirname, FILE_PATHS.RENDERER.SETTINGS));
        this.settingsWindow.once('ready-to-show', () => {
            this.settingsWindow.show();
        });
        this.settingsWindow.on('closed', () => {
            this.settingsWindow = null;
        });

        return this.settingsWindow;
    }

    createConfirmationDialog(parentWindow, dialogData) {
        if (this.confirmationWindow) {
            this.confirmationWindow.focus();
            return this.confirmationWindow;
        }

        const parentPos = parentWindow.getPosition();
        const parentSize = parentWindow.getSize();

        this.confirmationWindow = new BrowserWindow({
            ...WINDOW_SIZES.CONFIRMATION,
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
                preload: path.join(__dirname, FILE_PATHS.PRELOAD.CONFIRMATION),
                contextIsolation: true,
                nodeIntegration: false,
                devTools: true
            },
            autoHideMenuBar: true,
            x: parentPos[0] + Math.floor((parentSize[0] - WINDOW_SIZES.CONFIRMATION.width) / 2),
            y: parentPos[1] + Math.floor((parentSize[1] - WINDOW_SIZES.CONFIRMATION.height) / 2),
        });

        this.confirmationWindow.loadFile(path.join(__dirname, FILE_PATHS.RENDERER.CONFIRMATION));

        this.confirmationWindow.once('ready-to-show', () => {
            this.confirmationWindow.show();
            this.confirmationWindow.webContents.send('dialog-data', dialogData);
        });

        this.confirmationWindow.on('closed', () => {
            this.confirmationWindow = null;
        });

        return this.confirmationWindow;
    }

    closeSettingsWindow() {
        if (this.settingsWindow) {
            this.settingsWindow.close();
        }
    }

    closeConfirmationWindow() {
        if (this.confirmationWindow) {
            this.confirmationWindow.close();
        }
    }

    getMainWindow() {
        return this.mainWindow;
    }

    getSettingsWindow() {
        return this.settingsWindow;
    }

    getConfirmationWindow() {
        return this.confirmationWindow;
    }
}

module.exports = WindowManager;