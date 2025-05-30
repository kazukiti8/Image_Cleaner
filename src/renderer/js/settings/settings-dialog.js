import SettingsManager from './settings-manager.js';

class SettingsDialog {
    constructor() {
        this.settingsManager = new SettingsManager();
        this._setupEventListeners();
        this._initialize();
    }

    _setupEventListeners() {
        const elements = this.settingsManager.elements;

        if (elements.cancelSettingsBtn) {
            elements.cancelSettingsBtn.addEventListener('click', () => {
                this.settingsManager.restoreInitialSettings();
                this._closeWindow();
            });
        }

        if (elements.applySettingsBtn) {
            elements.applySettingsBtn.addEventListener('click', async () => {
                console.log('適用ボタンクリック');
                await this.settingsManager.saveSettings();
            });
        }

        if (elements.okSettingsBtn) {
            elements.okSettingsBtn.addEventListener('click', async () => {
                console.log('OKボタンクリック');
                const saved = await this.settingsManager.saveSettings();
                if (saved) {
                    this._closeWindow();
                }
            });
        }

        if (elements.changeLogPathButton) {
            elements.changeLogPathButton.addEventListener('click', async () => {
                await this.settingsManager.selectLogPath();
            });
        }
    }

    async _initialize() {
        await this.settingsManager.loadInitialSettings();
    }

    _closeWindow() {
        window.electronSettingsAPI?.closeSettingsWindow();
    }
}

// DOM読み込み完了後に初期化
console.log('Settings dialog script loaded.');

window.addEventListener('DOMContentLoaded', () => {
    try {
        const settingsDialog = new SettingsDialog();
        console.log('SettingsDialog initialized successfully');
        
        // グローバルアクセス用（デバッグ時など）
        window.settingsDialog = settingsDialog;
    } catch (error) {
        console.error('Failed to initialize SettingsDialog:', error);
    }
});