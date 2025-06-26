/**
 * UI操作に関するユーティリティクラス
 */
export class UIUtils {
    /**
     * 通知を表示
     * @param {string} message - メッセージ
     * @param {string} type - 通知タイプ ('info', 'success', 'error', 'warning')
     * @param {number} duration - 表示時間（ミリ秒、デフォルト: 3000）
     */
    static showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span>${message}</span>
                <button class="ml-2 text-sm" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 指定時間後に自動削除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }

    /**
     * エラー通知を表示
     * @param {string} message - エラーメッセージ
     */
    static showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * 成功通知を表示
     * @param {string} message - 成功メッセージ
     */
    static showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * 警告通知を表示
     * @param {string} message - 警告メッセージ
     */
    static showWarning(message) {
        this.showNotification(message, 'warning');
    }

    /**
     * 確認ダイアログを表示
     * @param {string} title - タイトル
     * @param {string} message - メッセージ
     * @returns {Promise<boolean>} ユーザーの選択結果
     */
    static async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const titleElement = document.getElementById('confirmTitle');
            const messageElement = document.getElementById('confirmMessage');
            const okButton = document.getElementById('confirmOkBtn');
            const cancelButton = document.getElementById('confirmCancelBtn');

            if (!modal || !titleElement || !messageElement || !okButton || !cancelButton) {
                resolve(false);
                return;
            }

            titleElement.textContent = title;
            messageElement.textContent = message;
            modal.classList.remove('hidden');

            const handleOk = () => {
                modal.classList.add('hidden');
                okButton.removeEventListener('click', handleOk);
                cancelButton.removeEventListener('click', handleCancel);
                resolve(true);
            };

            const handleCancel = () => {
                modal.classList.add('hidden');
                okButton.removeEventListener('click', handleOk);
                cancelButton.removeEventListener('click', handleCancel);
                resolve(false);
            };

            okButton.addEventListener('click', handleOk);
            cancelButton.addEventListener('click', handleCancel);
        });
    }

    /**
     * 要素を安全に取得
     * @param {string} selector - セレクタ
     * @returns {Element|null} 要素またはnull
     */
    static safeGetElement(selector) {
        try {
            return document.querySelector(selector);
        } catch (error) {
            console.warn(`Element not found: ${selector}`);
            return null;
        }
    }

    /**
     * 複数の要素を安全に取得
     * @param {string} selector - セレクタ
     * @returns {NodeList|[]} 要素のリスト
     */
    static safeGetElements(selector) {
        try {
            return document.querySelectorAll(selector);
        } catch (error) {
            console.warn(`Elements not found: ${selector}`);
            return [];
        }
    }

    /**
     * 要素の表示/非表示を切り替え
     * @param {string} selector - セレクタ
     * @param {boolean} show - 表示するかどうか
     */
    static toggleElement(selector, show) {
        const element = this.safeGetElement(selector);
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * 要素のクラスを安全に操作
     * @param {string} selector - セレクタ
     * @param {string} className - クラス名
     * @param {boolean} add - 追加するか削除するか
     */
    static toggleClass(selector, className, add) {
        const element = this.safeGetElement(selector);
        if (element) {
            if (add) {
                element.classList.add(className);
            } else {
                element.classList.remove(className);
            }
        }
    }
} 