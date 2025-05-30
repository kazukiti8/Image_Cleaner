import { UI_CONSTANTS } from '../utils/constants.js';
import { escapeHtml } from '../utils/helpers.js';

class TableManager {
    constructor(previewManager, selectionManager) {
        this.previewManager = previewManager;
        this.selectionManager = selectionManager;
        this.originalScanResults = { 
            blurryImages: [],
            similarImagePairs: [],
            errorFiles: []
        };
        this.currentTab = UI_CONSTANTS.TABS.BLURRY;
        this._initializeElements();
    }

    _initializeElements() {
        this.elements = {
            blurryTbody: document.getElementById('blurry-images-tbody'),
            similarTbody: document.getElementById('similar-images-tbody'),
            errorTbody: document.getElementById('error-files-tbody')
        };
    }

    setCurrentTab(tabId) {
        this.currentTab = tabId;
    }

    getCurrentTab() {
        return this.currentTab;
    }

    getOriginalScanResults() {
        return this.originalScanResults;
    }

    setOriginalScanResults(results) {
        this.originalScanResults = results || { 
            blurryImages: [],
            similarImagePairs: [],
            errorFiles: []
        };
    }

    clearAllTables() {
        this.elements.blurryTbody.innerHTML = '';
        this.elements.similarTbody.innerHTML = '';
        this.elements.errorTbody.innerHTML = '';
        this._updateCounts(0, 0, 0);
        this.originalScanResults = { blurryImages: [], similarImagePairs: [], errorFiles: [] };
    }

    populateBlurryTable(images) {
        this._populateTable(this.elements.blurryTbody, images, 'blurry', (item) => this._createBlurryRow(item));
        this._updateCount('count-blurry', images.length);
    }

    populateSimilarTable(imagePairs) {
        this._populateTable(this.elements.similarTbody, imagePairs, 'similar', (item) => this._createSimilarRow(item));
        this._updateCount('count-similar', imagePairs.length);
    }

    populateErrorTable(errors) {
        this._populateTable(this.elements.errorTbody, errors, 'error', (item) => this._createErrorRow(item));
        this._updateCount('count-errors', errors.length);
    }

    _populateTable(tbody, items, itemType, createRowFn) {
        tbody.innerHTML = '';
        
        if (!items || items.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 10;
            cell.textContent = UI_CONSTANTS.TABLE_EMPTY_MESSAGE;
            cell.className = 'text-center text-slate-500 py-8';
            return;
        }

        items.forEach(item => {
            const row = createRowFn(item);
            this._setupRowEventListeners(row, item, itemType);
            tbody.appendChild(row);
        });
    }

    _setupRowEventListeners(row, item, itemType) {
        row.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const tbody = row.closest('tbody');
                tbody.querySelectorAll('tr.bg-sky-100').forEach(r => 
                    r.classList.remove('bg-sky-100'));
                row.classList.add('bg-sky-100');
                this.previewManager.displayPreview(item, itemType);
            }
        });

        row.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => this.selectionManager.updateSelectionInfo());
        });
    }

    _createBlurryRow(item) {
        const row = document.createElement('tr');
        row.className = `${UI_CONSTANTS.CSS_CLASSES.HOVER_ROW} ${UI_CONSTANTS.CSS_CLASSES.CURSOR_POINTER}`;
        row.dataset.id = item.id;
        row.dataset.sizeMb = item.size;
        
        const blurScoreColor = item.blurScore > 90 ? 'text-red-600' : 
                             item.blurScore > 70 ? 'text-orange-500' : 'text-yellow-500';
        
        row.innerHTML = `
            <td class="px-3 py-2">
                <input type="checkbox" data-id="${escapeHtml(item.id)}" 
                       class="item-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4">
            </td>
            <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(item.filename)}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.size} MB</td>
            <td class="px-3 py-2 whitespace-nowrap hidden md:table-cell">${escapeHtml(item.modifiedDate)}</td>
            <td class="px-3 py-2 whitespace-nowrap hidden lg:table-cell">${escapeHtml(item.takenDate)}</td>
            <td class="px-3 py-2 whitespace-nowrap hidden lg:table-cell">${escapeHtml(item.resolution)}</td>
            <td class="px-3 py-2 whitespace-nowrap font-medium ${blurScoreColor}">${item.blurScore}</td>
        `;
        
        return row;
    }

    _createSimilarRow(pair) {
        const row = document.createElement('tr');
        row.className = `${UI_CONSTANTS.CSS_CLASSES.HOVER_ROW} ${UI_CONSTANTS.CSS_CLASSES.CURSOR_POINTER} ${
            pair.recommended ? 'bg-yellow-50 hover:bg-yellow-100' : ''
        }`;
        row.dataset.pairId = pair.id;
        row.dataset.size1Mb = pair.size1;
        row.dataset.size2Mb = pair.size2;
        
        const recommendedIcon1 = pair.recommended === 'file1' ? 
            '<span title="アプリによる推奨" class="text-amber-500 mr-1">★</span>' : '';
        const recommendedIcon2 = pair.recommended === 'file2' ? 
            '<span title="アプリによる推奨" class="text-amber-500 mr-1">★</span>' : '';
        const file1Checked = pair.recommended === 'file2' ? 'checked' : '';
        const file2Checked = pair.recommended === 'file1' || !pair.recommended ? 'checked' : '';

        const similarityColor = pair.similarity > 95 ? 'text-green-700' : 
                               pair.similarity > 85 ? 'text-green-600' : 'text-green-500';

        row.innerHTML = `
            <td class="px-3 py-2">
                <input type="checkbox" data-pair-id="${escapeHtml(pair.id)}" 
                       class="pair-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4">
            </td>
            <td class="px-3 py-2">
                <input type="checkbox" data-file-id="${escapeHtml(pair.id)}-f1" 
                       class="file1-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4" ${file1Checked}>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">${recommendedIcon1}${escapeHtml(pair.filename1)}</td>
            <td class="px-3 py-2 whitespace-nowrap hidden md:table-cell">${escapeHtml(pair.resolution1)}</td>
            <td class="px-3 py-2">
                <input type="checkbox" data-file-id="${escapeHtml(pair.id)}-f2" 
                       class="file2-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4" ${file2Checked}>
            </td>
            <td class="px-3 py-2 whitespace-nowrap">${recommendedIcon2}${escapeHtml(pair.filename2)}</td>
            <td class="px-3 py-2 whitespace-nowrap hidden md:table-cell">${escapeHtml(pair.resolution2)}</td>
            <td class="px-3 py-2 whitespace-nowrap font-medium ${similarityColor}">${pair.similarity}%</td>
        `;
        
        return row;
    }

    _createErrorRow(error) {
        const row = document.createElement('tr');
        row.className = `${UI_CONSTANTS.CSS_CLASSES.HOVER_ROW} ${UI_CONSTANTS.CSS_CLASSES.CURSOR_POINTER}`;
        row.dataset.id = error.id;
        row.dataset.sizeMb = error.size || 0;
        
        const errorColor = error.errorType === 'corrupted' || error.errorType === 'access_denied' ? 
                          'text-red-600' : 'text-orange-600';
        
        row.innerHTML = `
            <td class="px-3 py-2">
                <input type="checkbox" data-id="${escapeHtml(error.id)}" 
                       class="item-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4">
            </td>
            <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(error.filename)}</td>
            <td class="px-3 py-2 whitespace-nowrap ${errorColor}">${escapeHtml(error.errorMessage)}</td>
            <td class="px-3 py-2 whitespace-nowrap text-slate-500 truncate max-w-xs" 
                title="${escapeHtml(error.filepath)}">${escapeHtml(error.filepath)}</td>
        `;
        
        return row;
    }

    _updateCount(countElementId, count) {
        const element = document.getElementById(countElementId);
        if (element) {
            element.textContent = count;
        }
    }

    _updateCounts(blurryCount, similarCount, errorCount) {
        this._updateCount('count-blurry', blurryCount);
        this._updateCount('count-similar', similarCount);
        this._updateCount('count-errors', errorCount);
    }

    refreshAfterFileOperation(successPaths) {
        console.log('[DEBUG] refreshAfterFileOperation called with successPaths:', successPaths);
        
        if (!successPaths || successPaths.length === 0) return;

        if (this.originalScanResults.blurryImages) {
            this.originalScanResults.blurryImages = this.originalScanResults.blurryImages.filter(
                item => !successPaths.includes(item.path)
            );
        }
        
        if (this.originalScanResults.similarImagePairs) {
            this.originalScanResults.similarImagePairs = this.originalScanResults.similarImagePairs.filter(
                pair => !successPaths.includes(pair.path1) && !successPaths.includes(pair.path2)
            );
        }
        
        if (this.originalScanResults.errorFiles) {
            this.originalScanResults.errorFiles = this.originalScanResults.errorFiles.filter(
                item => !successPaths.includes(item.filepath)
            );
        }

        console.log('[DEBUG] originalScanResults after filtering successPaths:', this.originalScanResults);
    }
}

export default TableManager;