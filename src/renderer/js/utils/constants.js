// UI関連の定数定義
export const UI_CONSTANTS = {
    TABS: {
        BLURRY: 'blurry',
        SIMILAR: 'similar',
        ERRORS: 'errors'
    },
    // ZOOM 定数オブジェクト全体を削除
    BLUR_THRESHOLD: 50,
    SIMILARITY_THRESHOLD: 50,

    TABLE_EMPTY_MESSAGE: '対象のアイテムは見つかりませんでした。',

    CSS_CLASSES: {
        TAB_ACTIVE: 'tab-active',
        HIDDEN: 'hidden',
        SELECTED_ROW: 'bg-sky-100',
        HOVER_ROW: 'hover:bg-slate-50',
        CURSOR_POINTER: 'cursor-pointer'
    },

    BUTTON_TEXTS: {
        SCAN: {
            DEFAULT: 'スキャン開始',
            SCANNING: 'スキャン中...'
        },
        SELECT: {
            ALL: '全件選択',
            ALL_ERRORS: '全エラー選択',
            DESELECT: '選択解除',
            DESELECT_ERRORS: 'エラー選択解除'
        }
    }
};
