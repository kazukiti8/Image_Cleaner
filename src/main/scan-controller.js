const { spawn } = require('child_process');
const path = require('path');
const fs_sync = require('fs');
const { app } = require('electron');
const { FILE_PATHS, PYTHON_PATHS } = require('./utils/constants');

class ScanController {
    constructor(settingsManager) {
        this.settingsManager = settingsManager;
        this.logManager = null;
    }

    setLogManager(logManager) {
        this.logManager = logManager;
    }

    async executeScan(folderPath) {
        return new Promise(async (resolve, reject) => {
            const currentSettings = await this.settingsManager.loadSettings();
            const scanSubfoldersArg = currentSettings.scanSubfolders ? 'true' : 'false';
            
            const { pythonExecutable, scriptPath } = this._getPythonPaths();
            
            console.log(`Executing Python: ${pythonExecutable} ${scriptPath} with folder: ${folderPath} and scanSubfolders: ${scanSubfoldersArg}`);
            
            const pyProc = spawn(pythonExecutable, [scriptPath, folderPath, scanSubfoldersArg]);
            let resultData = '';
            let errorData = '';
            
            pyProc.stdout.on('data', (data) => { 
                resultData += data.toString(); 
            });
            
            pyProc.stderr.on('data', (data) => { 
                errorData += data.toString(); 
                console.error(`Python stderr: ${data}`); 
            });
            
            pyProc.on('close', (code) => {
                console.log(`Python script exited with code ${code}`);
                if (code === 0) {
                    try { 
                        resolve(JSON.parse(resultData)); 
                    } catch (e) { 
                        console.error('Failed to parse Python script output:', e);
                        console.error('Raw output from Python:', resultData);
                        reject(new Error('Pythonスクリプトの出力解析に失敗しました。'));
                    }
                } else {
                    reject(new Error(`Pythonスクリプトの実行に失敗しました (終了コード: ${code}): ${errorData}`));
                }
            });
            
            pyProc.on('error', (err) => { 
                console.error('Failed to start Python process:', err);
                reject(new Error(`Pythonプロセスの開始に失敗しました: ${err.message}`));
            });
        });
    }

    async rescanFiles(filePaths) {
        return new Promise(async (resolve, reject) => {
            const currentSettings = await this.settingsManager.loadSettings();
            const { pythonExecutable, scriptPath } = this._getPythonPaths();
            
            console.log(`Rescanning files: ${filePaths.join(', ')}`);
            
            // ファイルパスを一時ファイルに書き込み、Pythonスクリプトに渡す
            const fs = require('fs');
            const tempFilePath = path.join(require('os').tmpdir(), `rescan_${Date.now()}.json`);
            
            try {
                fs.writeFileSync(tempFilePath, JSON.stringify({ filePaths }));
                
                const pyProc = spawn(pythonExecutable, [scriptPath, '--rescan', tempFilePath]);
                let resultData = '';
                let errorData = '';
                
                pyProc.stdout.on('data', (data) => { 
                    resultData += data.toString(); 
                });
                
                pyProc.stderr.on('data', (data) => { 
                    errorData += data.toString(); 
                    console.error(`Python stderr: ${data}`); 
                });
                
                pyProc.on('close', (code) => {
                    // 一時ファイルを削除
                    try {
                        fs.unlinkSync(tempFilePath);
                    } catch (e) {
                        console.warn('Failed to delete temp file:', e);
                    }
                    
                    console.log(`Python rescan script exited with code ${code}`);
                    if (code === 0) {
                        try { 
                            resolve(JSON.parse(resultData)); 
                        } catch (e) { 
                            console.error('Failed to parse Python rescan output:', e);
                            console.error('Raw output from Python:', resultData);
                            reject(new Error('Pythonスクリプトの出力解析に失敗しました。'));
                        }
                    } else {
                        reject(new Error(`再スキャンに失敗しました (終了コード: ${code}): ${errorData}`));
                    }
                });
                
                pyProc.on('error', (err) => { 
                    console.error('Failed to start Python rescan process:', err);
                    reject(new Error(`再スキャンプロセスの開始に失敗しました: ${err.message}`));
                });
            } catch (err) {
                reject(new Error(`一時ファイルの作成に失敗しました: ${err.message}`));
            }
        });
    }

    _getPythonPaths() {
        let pythonExecutable = PYTHON_PATHS.DEFAULT;
        let scriptPath;

        if (app.isPackaged) {
            scriptPath = path.join(process.resourcesPath, 'app.asar.unpacked', FILE_PATHS.PYTHON_SCRIPT);
        } else {
            scriptPath = path.join(app.getAppPath(), FILE_PATHS.PYTHON_SCRIPT);
            const venvPythonPathWin = path.join(app.getAppPath(), PYTHON_PATHS.WIN_VENV);
            const venvPythonPathUnix = path.join(app.getAppPath(), PYTHON_PATHS.UNIX_VENV);
            
            if (process.platform === 'win32' && fs_sync.existsSync(venvPythonPathWin)) {
                pythonExecutable = venvPythonPathWin;
            } else if ((process.platform === 'darwin' || process.platform === 'linux') && fs_sync.existsSync(venvPythonPathUnix)) {
                pythonExecutable = venvPythonPathUnix;
            }
        }

        return { pythonExecutable, scriptPath };
    }
}

module.exports = ScanController;