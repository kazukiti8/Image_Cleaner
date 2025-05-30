const { app, BrowserWindow } = require('electron');

const WindowManager = require('./window-manager');
const SettingsManager = require('./settings-manager');
const ScanController = require('./scan-controller');
const FileOperations = require('./file-operations');
const IPCHandlers = require('./ipc-handlers');
const ProtocolHandler = require('./protocol-handler');
const LogManager = require('./log-manager');

class ImageCleanerApp {
    constructor() {
        this.windowManager = new WindowManager();
        this.settingsManager = new SettingsManager();
        this.logManager = null;
        this.scanController = null;
        this.fileOperations = new FileOperations();
        this.ipcHandlers = null;
    }

    async initialize() {
        await this._setupApp();
        this._initializeManagers();
        this._setupEventHandlers();
    }

    async _setupApp() {
        this.settingsManager.initialize();
        this.logManager = new LogManager(this.settingsManager);
        ProtocolHandler.initialize();
        
        this.scanController = new ScanController(this.settingsManager);
        this.scanController.setLogManager(this.logManager);
        this.fileOperations.setLogManager(this.logManager);
        this.ipcHandlers = new IPCHandlers(
            this.windowManager,
            this.settingsManager,
            this.scanController,
            this.fileOperations,
            this.logManager
        );
        
        this.ipcHandlers.setupHandlers();
        
        // アプリケーション開始をログに記録
        await this.logManager.info('APPLICATION', 'Image Cleaner application started');
    }

    _initializeManagers() {
        this.windowManager.createMainWindow();
    }

    _setupEventHandlers() {
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.windowManager.createMainWindow();
            }
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    }
}

app.whenReady().then(async () => {
    const imageCleanerApp = new ImageCleanerApp();
    await imageCleanerApp.initialize();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});