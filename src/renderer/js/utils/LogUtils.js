/**
 * ログ操作に関するユーティリティクラス
 */
export class LogUtils {
    /**
     * 安全なコンソールログ出力
     * @param {...any} args - ログ出力する引数
     */
    static log(...args) {
        try {
            const message = args.join(' ');
            // ファイルログに出力（メインプロセスに委譲）
            if (window.electronAPI && window.electronAPI.writeToLog) {
                window.electronAPI.writeToLog(`LOG: ${message}`);
            }
            // コンソールには最小限の情報のみ出力（無限ループ防止のため一時的に無効化）
            // console.log('App running...');
        } catch (error) {
            // エラーを無視
        }
    }

    /**
     * 安全なコンソールエラー出力
     * @param {...any} args - エラーログ出力する引数
     */
    static error(...args) {
        try {
            const message = args.join(' ');
            // ファイルログに出力（メインプロセスに委譲）
            if (window.electronAPI && window.electronAPI.writeToLog) {
                window.electronAPI.writeToLog(`ERROR: ${message}`);
            }
            // コンソールには最小限の情報のみ出力
            console.log('Error occurred. Check log file.');
        } catch (error) {
            // エラーを無視
        }
    }

    /**
     * 安全なコンソール警告出力
     * @param {...any} args - 警告ログ出力する引数
     */
    static warn(...args) {
        try {
            const message = args.join(' ');
            // ファイルログに出力（メインプロセスに委譲）
            if (window.electronAPI && window.electronAPI.writeToLog) {
                window.electronAPI.writeToLog(`WARN: ${message}`);
            }
            // コンソールには最小限の情報のみ出力
            console.log('Warning occurred. Check log file.');
        } catch (error) {
            // エラーを無視
        }
    }

    /**
     * デバッグ情報を出力（開発時のみ）
     * @param {...any} args - デバッグ情報
     */
    static debug(...args) {
        if (process.env.NODE_ENV === 'development') {
            this.log('[DEBUG]', ...args);
        }
    }

    /**
     * パフォーマンス測定用のログ
     * @param {string} label - 測定ラベル
     * @param {number} startTime - 開始時間
     */
    static performance(label, startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
} 