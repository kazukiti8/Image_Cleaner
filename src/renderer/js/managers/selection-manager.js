import { UI_CONSTANTS } from '../utils/constants.js';

class SelectionManager {
    constructor(uiManager, tableManager) {
        this.uiManager = uiManager;
        this.tableManager = tableManager;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        const selectAllBtn = this.uiManager.getElement('selectAllBtn');
        const deselectAllBtn = this.uiManager.getElement('deselectAllBtn');

        selectAllBtn?.addEventListener('click', () => this.selectAll());
        deselectAllBtn?.addEventListener('click', () => this.deselectAll());
    }

    selectAll() {
        const activeTbody = document.querySelector('.list-panel:not(.hidden) tbody');
        if (!activeTbody) return;

        const checkboxes = activeTbody.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { cb.checked = true; });
        this.updateSelectionInfo();
    }

    deselectAll() {
        const activeTbody = document.querySelector('.list-panel:not(.hidden) tbody');
        if (!activeTbody) return;

        const checkboxes = activeTbody.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.updateSelectionInfo();
    }

    getSelectedFilePaths() {
        console.log('[DEBUG] getSelectedFilePaths called for tab:', this.tableManager.getCurrentTab());
        
        const activeTbody = document.querySelector('.list-panel:not(.hidden) tbody');
        if (!activeTbody) {
            console.log('[DEBUG] getSelectedFilePaths: No active tbody found.');
            return [];
        }
        
        const paths = new Set();
        const currentTab = this.tableManager.getCurrentTab();
        const originalScanResults = this.tableManager.getOriginalScanResults();

        if (currentTab === UI_CONSTANTS.TABS.BLURRY || currentTab === UI_CONSTANTS.TABS.ERRORS) {
            this._getSelectedPathsFromSimpleTable(activeTbody, paths, originalScanResults, currentTab);
        } else if (currentTab === UI_CONSTANTS.TABS.SIMILAR) {
            this._getSelectedPathsFromSimilarTable(activeTbody, paths, originalScanResults);
        }

        const finalPaths = Array.from(paths);
        console.log('[DEBUG] getSelectedFilePaths returning:', finalPaths);
        return finalPaths;
    }

    _getSelectedPathsFromSimpleTable(activeTbody, paths, originalScanResults, currentTab) {
        const checkedCheckboxes = activeTbody.querySelectorAll('input[type="checkbox"].item-checkbox:checked');
        console.log(`[DEBUG] getSelectedFilePaths (${currentTab}): Found ${checkedCheckboxes.length} checked items.`);
        
        checkedCheckboxes.forEach(cb => {
            const row = cb.closest('tr');
            const itemId = row.dataset.id;
            
            let item = null;
            if (currentTab === UI_CONSTANTS.TABS.BLURRY) {
                item = originalScanResults.blurryImages.find(i => i.id === itemId);
                if (item && item.path) {
                    paths.add(item.path);
                    console.log(`[DEBUG] Added path: ${item.path}`);
                }
            } else if (currentTab === UI_CONSTANTS.TABS.ERRORS) {
                item = originalScanResults.errorFiles.find(i => i.id === itemId);
                if (item && item.filepath) {
                    paths.add(item.filepath);
                    console.log(`[DEBUG] Added filepath: ${item.filepath}`);
                }
            }
            
            if (!item) {
                console.warn(`[DEBUG] Could not find item for ID: ${itemId} in tab: ${currentTab}`);
            }
        });
    }

    _getSelectedPathsFromSimilarTable(activeTbody, paths, originalScanResults) {
        const file1Checkboxes = activeTbody.querySelectorAll('input[type="checkbox"].file1-checkbox:checked');
        const file2Checkboxes = activeTbody.querySelectorAll('input[type="checkbox"].file2-checkbox:checked');
        console.log(`[DEBUG] getSelectedFilePaths (similar): Found ${file1Checkboxes.length} file1 checked, ${file2Checkboxes.length} file2 checked.`);

        file1Checkboxes.forEach(cb => {
            const row = cb.closest('tr');
            const pairId = row.dataset.pairId;
            const pair = originalScanResults.similarImagePairs.find(p => p.id === pairId);
            if (pair && pair.path1) {
                paths.add(pair.path1);
                console.log(`[DEBUG] Added path1: ${pair.path1}`);
            } else {
                console.warn(`[DEBUG] Could not find pair or path1 for ID: ${pairId}`);
            }
        });
        
        file2Checkboxes.forEach(cb => {
            const row = cb.closest('tr');
            const pairId = row.dataset.pairId;
            const pair = originalScanResults.similarImagePairs.find(p => p.id === pairId);
            if (pair && pair.path2) {
                paths.add(pair.path2);
                console.log(`[DEBUG] Added path2: ${pair.path2}`);
            } else {
                console.warn(`[DEBUG] Could not find pair or path2 for ID: ${pairId}`);
            }
        });
    }

    updateSelectionInfo() {
        let count = 0;
        let size = 0;
        const activeTbody = document.querySelector('.list-panel:not(.hidden) tbody');
        const currentTab = this.tableManager.getCurrentTab();
        
        if (activeTbody) {
            if (currentTab === UI_CONSTANTS.TABS.BLURRY || currentTab === UI_CONSTANTS.TABS.ERRORS) {
                const checkedCheckboxes = activeTbody.querySelectorAll('input[type="checkbox"].item-checkbox:checked');
                count = checkedCheckboxes.length;
                checkedCheckboxes.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.dataset.sizeMb) {
                        size += parseFloat(row.dataset.sizeMb);
                    }
                });
            } else if (currentTab === UI_CONSTANTS.TABS.SIMILAR) {
                const file1Checked = activeTbody.querySelectorAll('input[type="checkbox"].file1-checkbox:checked');
                const file2Checked = activeTbody.querySelectorAll('input[type="checkbox"].file2-checkbox:checked');
                count = file1Checked.length + file2Checked.length;

                file1Checked.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.dataset.size1Mb) size += parseFloat(row.dataset.size1Mb);
                });
                file2Checked.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.dataset.size2Mb) size += parseFloat(row.dataset.size2Mb);
                });
            }
        }

        this.uiManager.updateSelectionInfo(count, size);
    }
}

export default SelectionManager;