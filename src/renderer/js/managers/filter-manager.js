import { UI_CONSTANTS } from '../utils/constants.js';

class FilterManager {
    constructor(tableManager) {
        this.tableManager = tableManager;
        this._initializeElements();
        this._setupEventListeners();
    }

    _initializeElements() {
        this.elements = {
            // ブレ画像フィルター
            blurScoreMinInput: document.getElementById('blurScoreMin'),
            blurScoreMaxInput: document.getElementById('blurScoreMax'),
            blurScoreSlider: document.getElementById('blurScoreSlider'),
            applyFilterBlurryBtn: document.getElementById('applyFilterBlurryBtn'),
            resetFilterBlurryBtn: document.getElementById('resetFilterBlurryBtn'),
            
            // 類似画像フィルター
            similarityMinInput: document.getElementById('similarityMin'),
            similarityMaxInput: document.getElementById('similarityMax'),
            similaritySlider: document.getElementById('similaritySlider'),
            applyFilterSimilarBtn: document.getElementById('applyFilterSimilarBtn'),
            resetFilterSimilarBtn: document.getElementById('resetFilterSimilarBtn'),
            
            // エラーフィルター
            errorTypeFilterSelect: document.getElementById('errorTypeFilter'),
            applyFilterErrorsBtn: document.getElementById('applyFilterErrorsBtn'),
            resetFilterErrorsBtn: document.getElementById('resetFilterErrorsBtn')
        };
    }

    _setupEventListeners() {
        // フィルター適用ボタン
        this.elements.applyFilterBlurryBtn?.addEventListener('click', () => this.applyFilters());
        this.elements.applyFilterSimilarBtn?.addEventListener('click', () => this.applyFilters());
        this.elements.applyFilterErrorsBtn?.addEventListener('click', () => this.applyFilters());

        // フィルターリセットボタン
        this.elements.resetFilterBlurryBtn?.addEventListener('click', () => this.resetAndApplyFilters());
        this.elements.resetFilterSimilarBtn?.addEventListener('click', () => this.resetAndApplyFilters());
        this.elements.resetFilterErrorsBtn?.addEventListener('click', () => this.resetAndApplyFilters());

        // ブレスコア入力値の検証
        this._setupBlurScoreValidation();
        this._setupSimilarityValidation();
    }

    _setupBlurScoreValidation() {
        if (this.elements.blurScoreMinInput) {
            this.elements.blurScoreMinInput.addEventListener('input', () => {
                this._validateMinMaxInputs(
                    this.elements.blurScoreMinInput,
                    this.elements.blurScoreMaxInput
                );
            });
        }

        if (this.elements.blurScoreMaxInput) {
            this.elements.blurScoreMaxInput.addEventListener('input', () => {
                this._validateMinMaxInputs(
                    this.elements.blurScoreMinInput,
                    this.elements.blurScoreMaxInput
                );
            });
        }
    }

    _setupSimilarityValidation() {
        if (this.elements.similarityMinInput) {
            this.elements.similarityMinInput.addEventListener('input', () => {
                this._validateMinMaxInputs(
                    this.elements.similarityMinInput,
                    this.elements.similarityMaxInput
                );
            });
        }

        if (this.elements.similarityMaxInput) {
            this.elements.similarityMaxInput.addEventListener('input', () => {
                this._validateMinMaxInputs(
                    this.elements.similarityMinInput,
                    this.elements.similarityMaxInput
                );
            });
        }
    }

    _validateMinMaxInputs(minInput, maxInput) {
        let minVal = parseInt(minInput.value, 10);
        let maxVal = parseInt(maxInput.value, 10);
        
        if (isNaN(minVal)) minVal = 0;
        if (isNaN(maxVal)) maxVal = 100;
        
        if (minVal > maxVal) {
            if (minInput === document.activeElement) {
                maxInput.value = minVal;
            } else {
                minInput.value = maxVal;
            }
        }
        
        if (minVal < 0) minInput.value = 0;
        if (minVal > 100) minInput.value = 100;
        if (maxVal < 0) maxInput.value = 0;
        if (maxVal > 100) maxInput.value = 100;
    }

    getBlurryFilterValues() {
        const min = parseInt(this.elements.blurScoreMinInput?.value || '0', 10);
        const max = parseInt(this.elements.blurScoreMaxInput?.value || '100', 10);
        
        return { 
            minScore: isNaN(min) || min < 0 ? 0 : min > 100 ? 100 : min, 
            maxScore: isNaN(max) || max < 0 ? 0 : max > 100 ? 100 : max 
        };
    }

    getSimilarFilterValues() {
        const min = parseInt(this.elements.similarityMinInput?.value || '0', 10);
        const max = parseInt(this.elements.similarityMaxInput?.value || '100', 10);
        
        return { 
            minSimilarity: isNaN(min) || min < 0 ? 0 : min > 100 ? 100 : min, 
            maxSimilarity: isNaN(max) || max < 0 ? 0 : max > 100 ? 100 : max
        };
    }

    getErrorFilterValues() {
        return { 
            errorType: this.elements.errorTypeFilterSelect?.value || ''
        };
    }

    applyFilters() {
        const originalScanResults = this.tableManager.getOriginalScanResults();
        const currentTab = this.tableManager.getCurrentTab();
        
        console.log(`Applying filters for tab: ${currentTab}`);
        
        if (!originalScanResults) {
            console.warn("originalScanResults is not available for filtering.");
            return;
        }

        let filteredItems = [];

        switch (currentTab) {
            case UI_CONSTANTS.TABS.BLURRY:
                filteredItems = this._filterBlurryImages(originalScanResults.blurryImages || []);
                this.tableManager.populateBlurryTable(filteredItems);
                break;
                
            case UI_CONSTANTS.TABS.SIMILAR:
                filteredItems = this._filterSimilarImages(originalScanResults.similarImagePairs || []);
                this.tableManager.populateSimilarTable(filteredItems);
                break;
                
            case UI_CONSTANTS.TABS.ERRORS:
                filteredItems = this._filterErrorFiles(originalScanResults.errorFiles || []);
                this.tableManager.populateErrorTable(filteredItems);
                break;
        }
    }

    _filterBlurryImages(images) {
        const { minScore, maxScore } = this.getBlurryFilterValues();
        return images.filter(img => 
            img.blurScore >= minScore && img.blurScore <= maxScore
        );
    }

    _filterSimilarImages(pairs) {
        const { minSimilarity, maxSimilarity } = this.getSimilarFilterValues();
        return pairs.filter(pair =>
            pair.similarity >= minSimilarity && pair.similarity <= maxSimilarity
        );
    }

    _filterErrorFiles(errors) {
        const { errorType } = this.getErrorFilterValues();
        if (errorType) {
            return errors.filter(err => err.errorType === errorType);
        }
        return [...errors];
    }

    resetAndApplyFilters() {
        if (this.elements.blurScoreMinInput) this.elements.blurScoreMinInput.value = 0;
        if (this.elements.blurScoreMaxInput) this.elements.blurScoreMaxInput.value = 100;
        if (this.elements.blurScoreSlider) this.elements.blurScoreSlider.value = 0;
        
        if (this.elements.similarityMinInput) this.elements.similarityMinInput.value = 0;
        if (this.elements.similarityMaxInput) this.elements.similarityMaxInput.value = 100;
        if (this.elements.similaritySlider) this.elements.similaritySlider.value = 0;

        if (this.elements.errorTypeFilterSelect) this.elements.errorTypeFilterSelect.value = "";
        
        this.applyFilters();
    }
}

export default FilterManager;