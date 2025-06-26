import { LogUtils } from '../utils/LogUtils.js';
import { UIUtils } from '../utils/UIUtils.js';

/**
 * ファイル操作を担当するクラス
 */
export class FileOperationManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * ファイル操作を実行
     * @param {string} operation - 操作タイプ ('delete', 'move', 'copy')
     */
    async performFileOperation(operation) {
        const { filePaths, count } = this.getSelectedFiles();
        
        if (count === 0) {
            UIUtils.showError('操作するファイルを選択してください');
            return;
        }

        // 確認ダイアログを表示
        const confirmed = await this.showOperationConfirmation(operation, count);
        if (!confirmed) return;

        // ファイル操作を実行
        await this.executeFileOperation(operation, filePaths);
    }

    /**
     * 選択されたファイルを取得
     * @returns {Object} ファイルパスとカウント
     */
    getSelectedFiles() {
        let filePaths = [];
        let count = 0;

        switch (this.app.tabManager.getCurrentTab()) {
            case 'blur':
                filePaths = Array.from(this.app.selectedFiles);
                count = filePaths.length;
                break;
            case 'similar':
                // 個別ファイル選択を取得
                const individualFiles = Array.from(this.app.selectedIndividualFiles || new Set());
                
                // ペア全体の選択で追加されるファイルを取得（個別選択と重複しないように）
                const pairFiles = [];
                if (this.app.selectedSimilarPairs && this.app.selectedSimilarPairs.size > 0) {
                    this.app.selectedSimilarPairs.forEach(pairValue => {
                        const [file1, file2] = pairValue.split('|');
                        if (!this.app.selectedIndividualFiles.has(file1)) {
                            pairFiles.push(file1);
                        }
                        if (!this.app.selectedIndividualFiles.has(file2)) {
                            pairFiles.push(file2);
                        }
                    });
                }
                
                // 個別ファイルとペアファイルを結合
                filePaths = [...individualFiles, ...pairFiles];
                count = filePaths.length;
                break;
            case 'error':
                filePaths = Array.from(this.app.selectedErrors);
                count = filePaths.length;
                break;
        }

        return { filePaths, count };
    }

    /**
     * 操作確認ダイアログを表示
     * @param {string} operation - 操作タイプ
     * @param {number} fileCount - ファイル数
     * @returns {Promise<boolean>} 確認結果
     */
    async showOperationConfirmation(operation, fileCount) {
        const operationNames = {
            'delete': '削除',
            'move': '移動',
            'copy': 'コピー'
        };

        const title = `${operationNames[operation]}の確認`;
        const message = `${fileCount}件のファイルを${operationNames[operation]}しますか？`;

        return await UIUtils.showConfirmDialog(title, message);
    }

    /**
     * ファイル操作を実行
     * @param {string} operation - 操作タイプ
     * @param {Array} filePaths - ファイルパスの配列
     * @param {string} destinationPath - 移動先パス（移動・コピー時）
     */
    async executeFileOperation(operation, filePaths, destinationPath = null) {
        try {
            LogUtils.log(`Executing ${operation} operation for ${filePaths.length} files`);

            let result;
            switch (operation) {
                case 'delete':
                    result = await window.electronAPI.deleteFiles(filePaths);
                    break;
                case 'move':
                    if (!destinationPath) {
                        destinationPath = await this.selectMoveDestination();
                        if (!destinationPath) return;
                    }
                    result = await window.electronAPI.moveFiles(filePaths, destinationPath);
                    break;
                case 'copy':
                    if (!destinationPath) {
                        destinationPath = await this.selectCopyDestination();
                        if (!destinationPath) return;
                    }
                    result = await window.electronAPI.copyFiles(filePaths, destinationPath);
                    break;
                default:
                    throw new Error(`未対応の操作: ${operation}`);
            }

            if (result.success) {
                UIUtils.showSuccess(`${filePaths.length}件のファイルの${operation}が完了しました`);
                this.removeFilesFromResults(filePaths);
                this.app.updateTabCounts();
            } else {
                UIUtils.showError(`ファイル${operation}に失敗しました: ${result.error}`);
            }

        } catch (error) {
            LogUtils.error(`File operation error:`, error);
            UIUtils.showError(`ファイル${operation}中にエラーが発生しました: ${error.message}`);
        }
    }

    /**
     * 移動先フォルダを選択
     * @returns {Promise<string|null>} 選択されたフォルダパス
     */
    async selectMoveDestination() {
        try {
            const result = await window.electronAPI.selectFolder();
            if (result.success) {
                return result.folderPath;
            }
            return null;
        } catch (error) {
            LogUtils.error('Move destination selection error:', error);
            return null;
        }
    }

    /**
     * コピー先フォルダを選択
     * @returns {Promise<string|null>} 選択されたフォルダパス
     */
    async selectCopyDestination() {
        try {
            const result = await window.electronAPI.selectFolder();
            if (result.success) {
                return result.folderPath;
            }
            return null;
        } catch (error) {
            LogUtils.error('Copy destination selection error:', error);
            return null;
        }
    }

    /**
     * スキャン結果からファイルを削除
     * @param {Array} filePaths - 削除するファイルパス
     */
    removeFilesFromResults(filePaths) {
        const currentTab = this.app.tabManager.getCurrentTab();

        switch (currentTab) {
            case 'blur':
                this.app.scanResults.blurImages = this.app.scanResults.blurImages.filter(image => 
                    !filePaths.includes(image.filePath)
                );
                break;
            case 'error':
                this.app.scanResults.errors = this.app.scanResults.errors.filter(error => 
                    !filePaths.includes(error.filePath)
                );
                break;
            case 'similar':
                this.app.scanResults.similarImages = this.app.scanResults.similarImages.filter(group => {
                    const file1Path = group.files[0].filePath;
                    const file2Path = group.files[1].filePath;
                    return !filePaths.includes(file1Path) && !filePaths.includes(file2Path);
                });
                break;
        }

        // テーブルを再構築
        this.app.rebuildCurrentTable();
    }
} 