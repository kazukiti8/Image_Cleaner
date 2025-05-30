class ConfirmationDialog {
    constructor() {
        this._initializeElements();
        this._setupEventListeners();
        this._setupIcons();
    }

    _initializeElements() {
        this.elements = {
            dialogIconContainer: document.getElementById('dialogIconContainer'),
            dialogTitle: document.getElementById('dialogTitle'),
            dialogMessage: document.getElementById('dialogMessage'),
            dialogExtraInfo: document.getElementById('dialogExtraInfo'),
            dialogCancelBtn: document.getElementById('dialogCancelBtn'),
            dialogConfirmBtn: document.getElementById('dialogConfirmBtn'),
            dialogConfirmBtnText: document.getElementById('dialogConfirmBtnText'),
            dialogConfirmIconContainer: document.getElementById('dialogConfirmIconContainer')
        };
    }

    _setupEventListeners() {
        // メインプロセスからダイアログの初期データを受け取る
        window.confirmationDialogAPI?.onDialogData((data) => {
            console.log('Received dialog data:', data);
            this._updateDialogContent(data);
        });

        // キャンセルボタンの処理
        this.elements.dialogCancelBtn.addEventListener('click', () => {
            window.confirmationDialogAPI?.sendDialogResponse({ confirmed: false });
        });

        // 確認ボタンの処理
        this.elements.dialogConfirmBtn.addEventListener('click', () => {
            const actionType = this.elements.dialogConfirmBtn.dataset.actionType;
            window.confirmationDialogAPI?.sendDialogResponse({ 
                confirmed: true, 
                actionType: actionType 
            });
        });

        // ダイアログ初期化完了をメインプロセスに通知
        window.confirmationDialogAPI?.dialogReady();
    }

    _setupIcons() {
        this.icons = {
            info_outline: `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor" class="w-7 h-7"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`,
            warning_amber: `<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="currentColor" class="w-7 h-7"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>`,
            delete_outline: `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor" class="w-4 h-4"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>`,
            delete_forever_outline: `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor" class="w-4 h-4"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.12 10.47L12 12.59l-2.13-2.12-1.41 1.41L10.59 14l-2.12 2.12 1.41 1.41L12 15.41l2.12 2.12 1.41-1.41L13.41 14l2.12-2.12-1.41-1.41zM15.5 4l-1-1h-5l-1 1H5v2h14V4h-3.5l-1-1zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/></svg>`,
            drive_file_move_outline: `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor" class="w-4 h-4"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm0 12H4V6h5.17l2 2H20v10zm-8-4h2V8h-2v2H8v2h4v2zm2 3l4-4-4-4v3H8v2h4v3z"/></svg>`
        };
    }

    _updateDialogContent(data) {
        const { type, itemCount, totalSizeMB, moveToPath } = data;
        const config = this._getDialogConfig(type, itemCount, totalSizeMB, moveToPath);

        this.elements.dialogTitle.textContent = config.title;
        this.elements.dialogMessage.textContent = config.message;
        this.elements.dialogExtraInfo.textContent = config.extraInfo;
        this.elements.dialogConfirmBtnText.textContent = config.confirmText;

        this.elements.dialogConfirmBtn.className = `flex items-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.confirmBtnClasses}`;
        this.elements.dialogIconContainer.className = config.dialogIconContainerClasses;
        this.elements.dialogIconContainer.innerHTML = config.dialogIconSvg;
        this.elements.dialogConfirmIconContainer.innerHTML = config.confirmIconSvg;

        this.elements.dialogConfirmBtn.dataset.actionType = type;
    }

    _getDialogConfig(type, itemCount, totalSizeMB, moveToPath) {
        const configs = {
            trash: {
                title: "画像の削除の確認",
                message: `選択された ${itemCount} 件の画像 (合計 ${totalSizeMB} MB) を\nゴミ箱へ移動します。よろしいですか？`,
                extraInfo: "",
                confirmText: "ゴミ箱へ移動",
                confirmIconSvg: this.icons.delete_outline,
                confirmBtnClasses: "bg-amber-500 hover:bg-amber-600 focus:ring-amber-500",
                dialogIconContainerClasses: "text-amber-500",
                dialogIconSvg: this.icons.info_outline
            },
            delete: {
                title: "画像の完全な削除の確認",
                message: `選択された ${itemCount} 件の画像 (合計 ${totalSizeMB} MB) を\n完全に削除します。\n\nこの操作は元に戻すことができません。\n本当によろしいですか？`,
                extraInfo: "",
                confirmText: "完全に削除",
                confirmIconSvg: this.icons.delete_forever_outline,
                confirmBtnClasses: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
                dialogIconContainerClasses: "text-red-500",
                dialogIconSvg: this.icons.warning_amber
            },
            move: {
                title: "画像の移動の確認",
                message: `選択された ${itemCount} 件の画像 (合計 ${totalSizeMB} MB) を\n以下の場所に移動します。よろしいですか？`,
                extraInfo: `移動先: ${moveToPath || "未指定"}`,
                confirmText: "移動する",
                confirmIconSvg: this.icons.drive_file_move_outline,
                confirmBtnClasses: "bg-sky-500 hover:bg-sky-600 focus:ring-sky-500",
                dialogIconContainerClasses: "text-sky-500",
                dialogIconSvg: this.icons.info_outline
            }
        };

        return configs[type] || configs.trash;
    }
}

// DOM読み込み完了後に初期化
console.log('Confirmation dialog script loaded.');

window.addEventListener('DOMContentLoaded', () => {
    try {
        const confirmationDialog = new ConfirmationDialog();
        console.log('ConfirmationDialog initialized successfully');
        
        // グローバルアクセス用（デバッグ時など）
        window.confirmationDialog = confirmationDialog;
    } catch (error) {
        console.error('Failed to initialize ConfirmationDialog:', error);
    }
});