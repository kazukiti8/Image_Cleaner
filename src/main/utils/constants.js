// 定数定義
module.exports = {
    WINDOW_SIZES: {
        MAIN: {
            width: 1000,
            height: 750,
            minWidth: 800,
            minHeight: 600
        },
        SETTINGS: {
            width: 620,
            height: 550,
            minWidth: 500,
            minHeight: 400
        },
        CONFIRMATION: {
            width: 500,
            height: 280,
            minWidth: 450,
            minHeight: 220
        }
    },
    
    FILE_PATHS: {
        SETTINGS: 'app-settings.json',
        PRELOAD: {
            MAIN: '../preload/preload.js',
            SETTINGS: '../preload/preloadSettings.js',
            CONFIRMATION: '../preload/preloadConfirmationDialog.js'
        },
        RENDERER: {
            MAIN: '../renderer/html/index.html',
            SETTINGS: '../renderer/html/settings.html',
            CONFIRMATION: '../renderer/html/confirmationDialog.html'
        },
        PYTHON_SCRIPT: 'src/python/image_scanner.py'
    },
    
    PYTHON_PATHS: {
        WIN_VENV: '.venv/Scripts/python.exe',
        UNIX_VENV: '.venv/bin/python',
        DEFAULT: 'python'
    }
};