class SettingsManager {
    constructor() {
        this.initialSettings = {};
        this._initializeElements();
    }

    _initializeElements() {
        this.elements = {
            scanSubfoldersCheckbox: document.getElementById('scanSubfolders'),
            deleteToRecycleBinRadio: document.getElementById('deleteToRecycleBin'),
            deletePermanentlyRadio: document.getElementById('deletePermanently'),
            logLevelSelect: document.getElementById('logLevel'),
            logFilePathInput: document.getElementById('logFilePath'),
            changeLogPathButton: document.getElementById('changeLogPathButton'),
            cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
            applySettingsBtn: document.getElementById('applySettingsBtn'),
            okSettingsBtn: document.getElementById('okSettingsBtn')
        };
    }

    async loadInitialSettings() {
        try {
            console.log('Requesting to load settings...');
            const settings = await window.electronSettingsAPI?.loadSettings();
            
            if (settings) {
                this.applySettingsToUI(settings);
                console.log('Settings loaded and applied to UI:', settings);
            } else {
                console.warn('loadSettings returned undefined or null, applying default UI values.');
                this.applySettingsToUI(this._getDefaultSettings());
            }
        } catch (error) {
            console.error('Failed to load settings via IPC:', error);
            this.applySettingsToUI(this._getDefaultSettings());
        }
    }

    applySettingsToUI(settings) {
        this.initialSettings = { ...settings };

        this.elements.scanSubfoldersCheckbox.checked = 
            settings.scanSubfolders !== undefined ? settings.scanSubfolders : true;

        if (settings.deleteOperation === 'permanently') {
            this.elements.deletePermanentlyRadio.checked = true;
        } else {
            this.elements.deleteToRecycleBinRadio.checked = true;
        }

        this.elements.logLevelSelect.value = settings.logLevel || 'normal';
        this.elements.logFilePathInput.value = settings.logFilePath || 'パスが設定されていません';
    }

    getSettingsFromUI() {
        return {
            scanSubfolders: this.elements.scanSubfoldersCheckbox.checked,
            deleteOperation: this.elements.deletePermanentlyRadio.checked ? 'permanently' : 'recycleBin',
            logLevel: this.elements.logLevelSelect.value,
            logFilePath: this.elements.logFilePathInput.value
        };
    }

    async saveSettings() {
        const currentSettings = this.getSettingsFromUI();
        
        try {
            console.log('Requesting to save settings:', currentSettings);
            const result = await window.electronSettingsAPI?.saveSettings(currentSettings);
            
            if (result && result.success) {
                console.log('Settings saved successfully. New settings:', result.settings);
                this.initialSettings = { ...result.settings };
                return true;
            } else {
                console.error('Failed to save settings via IPC. Result:', result);
                return false;
            }
        } catch (error) {
            console.error('Failed to save settings via IPC:', error);
            return false;
        }
    }

    restoreInitialSettings() {
        this.applySettingsToUI(this.initialSettings);
    }

    async selectLogPath() {
        try {
            console.log('Requesting to open directory dialog for logs...');
            const newPath = await window.electronSettingsAPI?.openDirectoryDialogForLogs();
            
            if (newPath) {
                this.elements.logFilePathInput.value = newPath;
                console.log('Log path selected:', newPath);
            } else {
                console.log('Log path selection cancelled.');
            }
        } catch (error) {
            console.error('Error opening directory dialog for logs:', error);
        }
    }

    _getDefaultSettings() {
        return {
            scanSubfolders: true,
            deleteOperation: 'recycleBin',
            logLevel: 'normal',
            logFilePath: 'デフォルトパス取得エラー'
        };
    }
}

export default SettingsManager;