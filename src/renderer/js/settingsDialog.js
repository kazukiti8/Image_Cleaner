// settingsDialog.js
console.log('Settings dialog script loaded.');

window.addEventListener('DOMContentLoaded', () => {
    const scanSubfoldersCheckbox = document.getElementById('scanSubfolders');
    const deleteToRecycleBinRadio = document.getElementById('deleteToRecycleBin');
    const deletePermanentlyRadio = document.getElementById('deletePermanently');
    const logLevelSelect = document.getElementById('logLevel');
    const logFilePathInput = document.getElementById('logFilePath');
    const changeLogPathButton = document.getElementById('changeLogPathButton');

    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const applySettingsBtn = document.getElementById('applySettingsBtn');
    const okSettingsBtn = document.getElementById('okSettingsBtn');
    // const closeSettingsBtn = document.getElementById('closeSettingsBtn'); // オプションの閉じるボタン

    // --- 設定値の読み込み (プレースホルダー) ---
    async function loadSettings() {
        try {
            // メインプロセスから設定を読み込む (preload.js経由)
            const settings = await window.electronSettingsAPI?.loadSettings();
            if (settings) {
                scanSubfoldersCheckbox.checked = settings.scanSubfolders !== undefined ? settings.scanSubfolders : true;
                if (settings.deleteOperation === 'permanently') {
                    deletePermanentlyRadio.checked = true;
                } else {
                    deleteToRecycleBinRadio.checked = true; // デフォルト
                }
                logLevelSelect.value = settings.logLevel || 'normal';
                logFilePathInput.value = settings.logFilePath || 'デフォルトパス未設定'; // 実際のデフォルトパスはメインプロセスで決定
                console.log('Settings loaded:', settings);
            } else {
                // デフォルト値を設定
                scanSubfoldersCheckbox.checked = true;
                deleteToRecycleBinRadio.checked = true;
                logLevelSelect.value = 'normal';
                logFilePathInput.value = 'デフォルトパスはメインで設定';
                console.log('No saved settings found, using defaults.');
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            // エラー時もデフォルト値を設定
            scanSubfoldersCheckbox.checked = true;
            deleteToRecycleBinRadio.checked = true;
            logLevelSelect.value = 'normal';
            logFilePathInput.value = '設定読み込みエラー';
        }
    }

    // --- 設定値の保存 (プレースホルダー) ---
    async function saveSettings() {
        const settings = {
            scanSubfolders: scanSubfoldersCheckbox.checked,
            deleteOperation: deletePermanentlyRadio.checked ? 'permanently' : 'recycleBin',
            logLevel: logLevelSelect.value,
            logFilePath: logFilePathInput.value // 実際には変更不可にするか、メインで管理
        };
        try {
            // メインプロセスに設定を保存する (preload.js経由)
            await window.electronSettingsAPI?.saveSettings(settings);
            console.log('Settings saved:', settings);
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            // ユーザーにエラー通知 (例: alertの代わりにカスタムUI)
            // alert(`設定の保存に失敗しました: ${error.message}`);
            return false;
        }
    }

    // --- イベントリスナー ---
    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', () => {
            // メインプロセスにウィンドウを閉じるよう通知
            window.electronSettingsAPI?.closeSettingsWindow();
        });
    }

    if (applySettingsBtn) {
        applySettingsBtn.addEventListener('click', async () => {
            console.log('適用ボタンクリック');
            await saveSettings();
            // ここでユーザーに「適用されました」などのフィードバックを表示しても良い
        });
    }

    if (okSettingsBtn) {
        okSettingsBtn.addEventListener('click', async () => {
            console.log('OKボタンクリック');
            const saved = await saveSettings();
            if (saved) {
                window.electronSettingsAPI?.closeSettingsWindow();
            }
        });
    }

    if (changeLogPathButton) {
        changeLogPathButton.addEventListener('click', async () => {
            try {
                const newPath = await window.electronSettingsAPI?.openDirectoryDialogForLogs();
                if (newPath) {
                    logFilePathInput.value = newPath;
                    console.log('Log path changed to:', newPath);
                }
            } catch (error) {
                console.error('Error changing log path:', error);
            }
        });
    }

    // 初期設定読み込み
    loadSettings();
});
