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

    let initialSettings = {}; // 読み込み時の設定を保持

    // --- 設定値のUIへの適用 ---
    function applySettingsToUI(settings) {
        initialSettings = { ...settings }; // 読み込んだ設定を保持

        scanSubfoldersCheckbox.checked = settings.scanSubfolders !== undefined ? settings.scanSubfolders : true;

        if (settings.deleteOperation === 'permanently') {
            deletePermanentlyRadio.checked = true;
        } else {
            deleteToRecycleBinRadio.checked = true; // デフォルト or recycleBin
        }
        logLevelSelect.value = settings.logLevel || 'normal';
        logFilePathInput.value = settings.logFilePath || 'パスが設定されていません'; // 実際のデフォルトパスはメインプロセスで決定される
    }

    // --- 設定値の読み込み ---
    async function loadInitialSettings() {
        try {
            console.log('Requesting to load settings...');
            const settings = await window.electronSettingsAPI?.loadSettings();
            if (settings) {
                applySettingsToUI(settings);
                console.log('Settings loaded and applied to UI:', settings);
            } else {
                // API呼び出しは成功したが、設定データが空だった場合 (通常はデフォルトが返る)
                console.warn('loadSettings returned undefined or null, applying default UI values.');
                applySettingsToUI({ // UIのフォールバック
                    scanSubfolders: true,
                    deleteOperation: 'recycleBin',
                    logLevel: 'normal',
                    logFilePath: 'デフォルトパス取得エラー'
                });
            }
        } catch (error) {
            console.error('Failed to load settings via IPC:', error);
            // エラー時もUIのフォールバック値を設定
            applySettingsToUI({
                scanSubfolders: true,
                deleteOperation: 'recycleBin',
                logLevel: 'normal',
                logFilePath: '設定読み込みエラー'
            });
        }
    }

    // --- UIから設定値を取得 ---
    function getSettingsFromUI() {
        return {
            scanSubfolders: scanSubfoldersCheckbox.checked,
            deleteOperation: deletePermanentlyRadio.checked ? 'permanently' : 'recycleBin',
            logLevel: logLevelSelect.value,
            logFilePath: logFilePathInput.value
        };
    }

    // --- 設定値の保存 ---
    async function handleSaveSettings() {
        const currentSettings = getSettingsFromUI();
        try {
            console.log('Requesting to save settings:', currentSettings);
            const result = await window.electronSettingsAPI?.saveSettings(currentSettings);
            if (result && result.success) {
                console.log('Settings saved successfully. New settings:', result.settings);
                initialSettings = { ...result.settings }; // 保存後の設定を初期値として更新
                // TODO: ユーザーに「保存されました」などのフィードバックを表示
                // 例: showToast("設定が保存されました。");
                return true;
            } else {
                console.error('Failed to save settings via IPC. Result:', result);
                // TODO: ユーザーにエラー通知
                // 例: showModalError(`設定の保存に失敗しました: ${result?.error || '不明なエラー'}`);
                return false;
            }
        } catch (error) {
            console.error('Failed to save settings via IPC:', error);
            // TODO: ユーザーにエラー通知
            // 例: showModalError(`設定の保存中にエラーが発生しました: ${error.message}`);
            return false;
        }
    }

    // --- イベントリスナー ---
    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', () => {
            // 変更を破棄して閉じる (読み込み時の設定に戻す)
            applySettingsToUI(initialSettings);
            window.electronSettingsAPI?.closeSettingsWindow();
        });
    }

    if (applySettingsBtn) {
        applySettingsBtn.addEventListener('click', async () => {
            console.log('適用ボタンクリック');
            await handleSaveSettings();
        });
    }

    if (okSettingsBtn) {
        okSettingsBtn.addEventListener('click', async () => {
            console.log('OKボタンクリック');
            const saved = await handleSaveSettings();
            if (saved) {
                window.electronSettingsAPI?.closeSettingsWindow();
            }
        });
    }

    if (changeLogPathButton) {
        changeLogPathButton.addEventListener('click', async () => {
            try {
                console.log('Requesting to open directory dialog for logs...');
                const newPath = await window.electronSettingsAPI?.openDirectoryDialogForLogs();
                if (newPath) {
                    logFilePathInput.value = newPath;
                    console.log('Log path selected:', newPath);
                } else {
                    console.log('Log path selection cancelled.');
                }
            } catch (error) {
                console.error('Error opening directory dialog for logs:', error);
            }
        });
    }

    // 初期設定読み込み
    loadInitialSettings();
});
