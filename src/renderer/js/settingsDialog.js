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
                showToast("設定が保存されました。", "success");
                return true;
            } else {
                console.error('Failed to save settings via IPC. Result:', result);
                showToast(`設定の保存に失敗しました: ${result?.error || '不明なエラー'}`, "error");
                return false;
            }
        } catch (error) {
            console.error('Failed to save settings via IPC:', error);
            showToast(`設定の保存中にエラーが発生しました: ${error.message}`, "error");
            return false;
        }
    }

    // --- トースト通知機能 ---
    function showToast(message, type = "success") {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `
            transform transition-all duration-300 ease-in-out
            max-w-xs w-full p-4 rounded-lg shadow-lg
            ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
            translate-x-full opacity-0
        `;
        
        toast.innerHTML = `
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    ${type === 'success' ? 
                        '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' :
                        '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>'
                    }
                </div>
                <div class="ml-3 flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <div class="ml-4 flex-shrink-0">
                    <button class="inline-flex text-white hover:text-gray-200 focus:outline-none" onclick="this.closest('.transform').remove()">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(toast);

        // アニメーション開始
        setTimeout(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        }, 100);

        // 自動削除
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
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
