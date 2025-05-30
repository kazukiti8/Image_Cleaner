const fs_sync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class SettingsManager {
    constructor() {
        this.settingsDirectory = null;
        this.settingsFilePath = null;
        this.defaultLogFilePath = null;
    }

    initialize() {
        this.settingsDirectory = app.getPath('userData');
        this.settingsFilePath = path.join(this.settingsDirectory, 'app-settings.json');
        this.defaultLogFilePath = path.join(app.getPath('logs'), 'app.log');
    }

    getDefaultSettings() {
        const logPath = this.defaultLogFilePath || path.join(app.getPath('userData'), 'logs', 'app.log');
        return {
            scanSubfolders: true,
            deleteOperation: 'recycleBin',
            logLevel: 'normal',
            logFilePath: logPath
        };
    }

    async loadSettings() {
        if (!this.settingsFilePath) {
            console.warn("loadSettings called before settingsFilePath is initialized.");
            return this.getDefaultSettings();
        }
        
        try {
            if (fs_sync.existsSync(this.settingsFilePath)) {
                const settingsData = await fs.readFile(this.settingsFilePath, 'utf-8');
                const loadedSettings = JSON.parse(settingsData);
                return { ...this.getDefaultSettings(), ...loadedSettings };
            } else {
                console.log('Settings file not found, returning default settings.');
                return this.getDefaultSettings();
            }
        } catch (error) {
            console.error('Failed to load settings from file, returning default settings:', error);
            return this.getDefaultSettings();
        }
    }

    async saveSettings(settingsToSave) {
        if (!this.settingsDirectory || !this.settingsFilePath) {
            console.error("saveSettings called before settingsDirectory or settingsFilePath is initialized.");
            return { success: false, error: "Settings path not initialized." };
        }
        
        try {
            if (!fs_sync.existsSync(this.settingsDirectory)) {
                await fs.mkdir(this.settingsDirectory, { recursive: true });
            }
            
            const currentSettings = await this.loadSettings();
            const newSettings = { ...currentSettings, ...settingsToSave };
            await fs.writeFile(this.settingsFilePath, JSON.stringify(newSettings, null, 2));
            
            console.log('Settings saved to:', this.settingsFilePath);
            return { success: true, path: this.settingsFilePath, settings: newSettings };
        } catch (error) {
            console.error('Failed to save settings to file:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SettingsManager;