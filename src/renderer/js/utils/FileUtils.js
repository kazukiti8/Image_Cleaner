/**
 * ファイル操作に関するユーティリティクラス
 */
export class FileUtils {
    /**
     * ファイルサイズを人間が読みやすい形式にフォーマット
     * @param {number} bytes - バイト数
     * @returns {string} フォーマットされたサイズ文字列
     */
    static formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * ファイルパスを表示用に短縮
     * @param {string} path - ファイルパス
     * @param {number} maxLength - 最大長（デフォルト: 50）
     * @returns {string} 短縮されたパス
     */
    static getDisplayPath(path, maxLength = 50) {
        if (path.length <= maxLength) {
            return path;
        }
        return '...' + path.substring(path.length - (maxLength - 3));
    }

    /**
     * ファイルパスからファイル名を抽出
     * @param {string} filePath - ファイルパス
     * @returns {string} ファイル名
     */
    static getBasename(filePath) {
        return filePath.split(/[\\/]/).pop();
    }

    /**
     * 日付文字列をローカライズされた形式にフォーマット
     * @param {string} dateString - ISO形式の日付文字列
     * @returns {string} フォーマットされた日付文字列
     */
    static formatDate(dateString) {
        return new Date(dateString).toLocaleString('ja-JP');
    }

    /**
     * ファイルサイズの差を計算して表示用文字列を生成
     * @param {number} size1 - サイズ1
     * @param {number} size2 - サイズ2
     * @returns {string} サイズ差の説明文字列
     */
    static getSizeDifference(size1, size2) {
        const diff = Math.abs(size1 - size2);
        const percentage = ((diff / Math.max(size1, size2)) * 100).toFixed(1);
        const diffFormatted = this.formatFileSize(diff);
        
        if (size1 > size2) {
            return `画像1が${diffFormatted}大きい (${percentage}%)`;
        } else if (size2 > size1) {
            return `画像2が${diffFormatted}大きい (${percentage}%)`;
        } else {
            return '同じサイズ';
        }
    }
} 