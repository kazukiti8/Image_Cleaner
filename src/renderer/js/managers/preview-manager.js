import { UI_CONSTANTS } from '../utils/constants.js'; // clamp は不要になったので削除
// import { clamp } from '../utils/helpers.js'; // clamp は不要になったので削除

class PreviewManager {
    constructor() {
        this._initializeElements();
        // ズーム関連の初期化を削除
        // this._setupZoomControls();
        // this.currentZoom = UI_CONSTANTS.ZOOM.DEFAULT; // ZOOM定数がないため削除
    }

    _initializeElements() {
        this.elements = {
            previewImage1: document.getElementById('previewImage1'),
            previewImage2: document.getElementById('previewImage2'),
            previewPlaceholderText: document.getElementById('preview-placeholder-text'),

            // 情報表示
            infoFilename: document.getElementById('info-filename'),
            infoFilepath: document.getElementById('info-filepath'),
            infoResolution: document.getElementById('info-resolution'),
            infoFilesize: document.getElementById('info-filesize'),
            infoDatetime: document.getElementById('info-datetime'),
            infoBlurScoreContainer: document.getElementById('info-blur-score-container'),
            infoBlurScore: document.getElementById('info-blur-score'),
            infoSimilarityContainer: document.getElementById('info-similarity-container'),
            infoSimilarity: document.getElementById('info-similarity'),

            // ズームコントロール関連の要素取得を削除
            // zoomSlider: document.getElementById('zoomSlider'),
            // zoomInput: document.getElementById('zoomInput'),
            // zoomValueDisplay: document.getElementById('zoomValue'),
            // zoomInBtn: document.getElementById('zoomInBtn'),
            // zoomOutBtn: document.getElementById('zoomOutBtn'),
            // resetZoomBtn: document.getElementById('resetZoomBtn')
        };
    }

    // _setupZoomControls メソッド全体を削除

    // updateZoom メソッド全体を削除

    // _applyZoomToImages メソッド全体を削除

    // _resetImageTransforms メソッド全体を削除

    async displayPreview(item, type) {
        this._hideAllPreviews();
        this._resetImages();
        // this.updateZoom(UI_CONSTANTS.ZOOM.DEFAULT); // ZOOM定数がないため削除

        if (!item) {
            this._showPlaceholder('画像を選択するとここにプレビューが表示されます');
            this._clearInfo();
            return;
        }

        try {
            switch (type) {
                case 'blurry':
                    await this._displayBlurryPreview(item);
                    break;
                case 'similar':
                    await this._displaySimilarPreview(item);
                    break;
                case 'error':
                    this._displayErrorPreview(item);
                    break;
            }
        } catch (error) {
            console.error('Error in displayPreview:', error);
            this._showPlaceholder('プレビュー表示エラー');
        }
    }

    async _displayBlurryPreview(item) {
        this.elements.previewPlaceholderText.classList.add('hidden');

        try {
            const imageSrc = await window.electronAPI.convertFileSrc(item.path);
            if (imageSrc) {
                this.elements.previewImage1.src = imageSrc;
                this.elements.previewImage1.classList.remove('hidden');
            } else {
                this._showPlaceholder('プレビューを読み込めません');
                return;
            }
        } catch (e) {
            this._showPlaceholder('プレビュー読み込みエラー');
            console.error(`Error loading preview for ${item.path}:`, e);
            return;
        }

        this._updateBlurryInfo(item);
    }

    async _displaySimilarPreview(item) {
        this.elements.previewPlaceholderText.classList.add('hidden');

        try {
            const [imageSrc1, imageSrc2] = await Promise.all([
                window.electronAPI.convertFileSrc(item.path1),
                window.electronAPI.convertFileSrc(item.path2)
            ]);

            if (imageSrc1) {
                this.elements.previewImage1.src = imageSrc1;
                this.elements.previewImage1.classList.remove('hidden');
            }
            if (imageSrc2) {
                this.elements.previewImage2.src = imageSrc2;
                this.elements.previewImage2.classList.remove('hidden');
            }

            if (this.elements.previewImage1.classList.contains('hidden') &&
                this.elements.previewImage2.classList.contains('hidden')) {
                this._showPlaceholder('プレビューを読み込めません');
                return;
            }
        } catch (e) {
            this._showPlaceholder('プレビュー読み込みエラー');
            console.error('Error loading similar previews:', e);
            return;
        }

        this._updateSimilarInfo(item);
    }

    _displayErrorPreview(item) {
        this._showPlaceholder(`エラー: ${item.errorMessage}`);
        this._updateErrorInfo(item);
    }

    _hideAllPreviews() {
        this.elements.previewImage1.classList.add('hidden');
        this.elements.previewImage2.classList.add('hidden');
        this.elements.previewPlaceholderText.classList.remove('hidden');
        this.elements.infoBlurScoreContainer.classList.add('hidden');
        this.elements.infoSimilarityContainer.classList.add('hidden');
    }

    _resetImages() {
        this.elements.previewImage1.src = '';
        this.elements.previewImage2.src = '';
        // 画像のtransformスタイル操作を削除
        // this.elements.previewImage1.style.transform = 'scale(1)';
        // this.elements.previewImage2.style.transform = 'scale(1)';
    }

    _showPlaceholder(text) {
        this.elements.previewPlaceholderText.textContent = text;
        this.elements.previewPlaceholderText.classList.remove('hidden');
    }

    _clearInfo() {
        this.elements.infoFilename.textContent = '-';
        this.elements.infoFilepath.textContent = '-';
        this.elements.infoResolution.textContent = '-';
        this.elements.infoFilesize.textContent = '-';
        this.elements.infoDatetime.textContent = '-';
    }

    _updateBlurryInfo(item) {
        this.elements.infoFilename.textContent = item.filename;
        this.elements.infoFilepath.textContent = item.path;
        this.elements.infoFilepath.title = item.path;
        this.elements.infoResolution.textContent = item.resolution;
        this.elements.infoFilesize.textContent = `${item.size} MB`;
        this.elements.infoDatetime.textContent = item.takenDate;
        this.elements.infoBlurScore.textContent = item.blurScore;
        this.elements.infoBlurScoreContainer.classList.remove('hidden');
    }

    _updateSimilarInfo(item) {
        this.elements.infoFilename.textContent = `${item.filename1} vs ${item.filename2}`;
        this.elements.infoFilepath.textContent = `(左) ${item.path1} (右) ${item.path2}`;
        this.elements.infoResolution.textContent = `(左) ${item.resolution1} (右) ${item.resolution2}`;
        this.elements.infoSimilarity.textContent = `${item.similarity}%`;
        this.elements.infoSimilarityContainer.classList.remove('hidden');
        this.elements.infoFilesize.textContent = `(左) ${item.size1 || '-'}MB (右) ${item.size2 || '-'}MB`;
        this.elements.infoDatetime.textContent = '-';
    }

    _updateErrorInfo(item) {
        this.elements.infoFilename.textContent = item.filename;
        this.elements.infoFilepath.textContent = item.filepath;
        this.elements.infoFilepath.title = item.filepath;
        this.elements.infoResolution.textContent = '-';
        this.elements.infoFilesize.textContent = item.size ? `${item.size} MB` : '-';
        this.elements.infoDatetime.textContent = '-';
    }
}

export default PreviewManager;
