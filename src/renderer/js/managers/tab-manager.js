import { UI_CONSTANTS } from '../utils/constants.js';

class TabManager {
    constructor(uiManager, filterManager, previewManager) {
        this.uiManager = uiManager;
        this.filterManager = filterManager;
        this.previewManager = previewManager;
        this.currentTab = UI_CONSTANTS.TABS.BLURRY;
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        this.uiManager.setState({ currentTab: tabId });
        
        this.uiManager.updateTabButtons(tabId);
        this.uiManager.updateListPanels(tabId);
        this.uiManager.updateFilterPanels(tabId);
        this.uiManager.updateActionButtons(tabId);
        
        this.filterManager.resetAndApplyFilters();
        this.uiManager.updateSelectionInfo(0, 0);
        this.previewManager.displayPreview(null);
        
        console.log(`Switched to ${tabId} tab.`);
    }

    getCurrentTab() {
        return this.currentTab;
    }

    setupTabEventListeners() {
        const tabButtons = this.uiManager.getElement('tabButtons');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.id.replace('tab-', '');
                console.log(`[DEBUG] Tab button clicked: ${button.id}, derived tabId: ${tabId}`);
                this.switchTab(tabId);
            });
        });
    }
}

export default TabManager;