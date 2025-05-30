const { shell } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class FileOperations {
    constructor() {
        this.logManager = null;
    }

    setLogManager(logManager) {
        this.logManager = logManager;
    }
    async performOperation(actionType, paths, destination = null) {
        if (!paths || paths.length === 0) {
            return { successCount: 0, errors: [{ path: 'N/A', reason: '対象ファイルがありません。' }] };
        }

        // 操作開始をログに記録
        if (this.logManager) {
            await this.logManager.info('FILE_OPERATION', `Starting ${actionType} operation on ${paths.length} files`, {
                actionType,
                pathCount: paths.length,
                destination
            });
        }

        let operationPromise;

        switch (actionType) {
            case 'trash':
                operationPromise = this._trashFiles(paths);
                break;
            case 'delete':
                operationPromise = this._deleteFiles(paths);
                break;
            case 'move':
                if (!destination) {
                    const error = { successCount: 0, errors: [{ path: 'N/A', reason: '移動先フォルダが指定されていません。' }] };
                    if (this.logManager) {
                        await this.logManager.error('FILE_OPERATION', 'Move operation failed: no destination specified');
                    }
                    return error;
                }
                operationPromise = this._moveFiles(paths, destination);
                break;
            default:
                const error = { successCount: 0, errors: [{ path: 'N/A', reason: `未定義の操作です: ${actionType}` }] };
                if (this.logManager) {
                    await this.logManager.error('FILE_OPERATION', `Unknown operation type: ${actionType}`);
                }
                return error;
        }

        const results = await operationPromise;
        const processedResults = this._processResults(results, paths);
        
        // 操作結果をログに記録
        if (this.logManager) {
            await this.logManager.info('FILE_OPERATION', `Completed ${actionType} operation`, {
                actionType,
                successCount: processedResults.successCount,
                errorCount: processedResults.errors.length,
                errors: processedResults.errors
            });
        }
        
        return processedResults;
    }

    async _trashFiles(paths) {
        return Promise.allSettled(
            paths.map(async (p) => {
                try {
                    await shell.trashItem(p);
                    return p;
                } catch (err) {
                    console.error(`Error trashing item ${p}:`, err);
                    throw err;
                }
            })
        );
    }

    async _deleteFiles(paths) {
        return Promise.allSettled(
            paths.map(p => fs.unlink(p).then(() => p))
        );
    }

    async _moveFiles(paths, destination) {
        await fs.mkdir(destination, { recursive: true });
        
        return Promise.allSettled(
            paths.map(async (p) => {
                const newPath = path.join(destination, path.basename(p));
                try {
                    if (await fs.stat(newPath).then(() => true).catch(() => false)) {
                        throw new Error(`移動先に同名のファイルが存在します: ${path.basename(p)}`);
                    }
                    await fs.rename(p, newPath);
                    return p;
                } catch (err) {
                    console.error(`Error moving item ${p} to ${newPath}:`, err);
                    throw err;
                }
            })
        );
    }

    _processResults(results, originalPaths) {
        const successFiles = [];
        const errorFiles = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successFiles.push(result.value);
            } else {
                errorFiles.push({
                    path: originalPaths[index],
                    reason: result.reason.message || '不明なエラー'
                });
            }
        });

        console.log(`Operation completed. Success: ${successFiles.length}, Failed: ${errorFiles.length}`);
        return { 
            successCount: successFiles.length, 
            errors: errorFiles, 
            successPaths: successFiles 
        };
    }
}

module.exports = FileOperations;