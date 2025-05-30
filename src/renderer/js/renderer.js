// レンダラープロセスのメインスクリプト
console.log('Renderer script loaded.');

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    // --- グローバル要素 ---
    const targetFolderPathSpan = document.getElementById('targetFolderPath');
    const outputFolderPathSpan = document.getElementById('outputFolderPath');
    const statusMessageSpan = document.getElementById('status-message');

    // --- ヘッダーボタン ---
    const selectTargetFolderBtn = document.getElementById('selectTargetFolderBtn');
    const selectOutputFolderBtn = document.getElementById('selectOutputFolderBtn');
    const startScanBtn = document.getElementById('startScanBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    // --- タブ関連 ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const listPanels = document.querySelectorAll('.list-panel');
    const filterPanels = document.querySelectorAll('.filter-panel-content');
    const blurryActionButtons = document.getElementById('action-buttons-blurry-similar');
    const errorsActionButtons = document.getElementById('action-buttons-errors');
    const exportErrorLogBtn = document.getElementById('exportErrorLogBtn');


    // --- プレビュー関連 ---
    const previewImage1 = document.getElementById('previewImage1');
    const previewImage2 = document.getElementById('previewImage2');
    const previewPlaceholderText = document.getElementById('preview-placeholder-text');
    const infoFilename = document.getElementById('info-filename');
    const infoFilepath = document.getElementById('info-filepath');
    const infoResolution = document.getElementById('info-resolution');
    const infoFilesize = document.getElementById('info-filesize');
    const infoDatetime = document.getElementById('info-datetime');
    const infoBlurScoreContainer = document.getElementById('info-blur-score-container');
    const infoBlurScore = document.getElementById('info-blur-score');
    const infoSimilarityContainer = document.getElementById('info-similarity-container');
    const infoSimilarity = document.getElementById('info-similarity');

    // ズームコントロール
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomInput = document.getElementById('zoomInput');
    const zoomValueDisplay = document.getElementById('zoomValue');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetZoomBtn = document.getElementById('resetZoomBtn');


    // --- 右ペイン ---
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    // ブレ画像フィルター
    const blurScoreMinInput = document.getElementById('blurScoreMin');
    const blurScoreMaxInput = document.getElementById('blurScoreMax');
    const blurScoreSlider = document.getElementById('blurScoreSlider'); // HTMLには単一スライダーしかないため、min/maxとは直接連動しない
    const applyFilterBlurryBtn = document.getElementById('applyFilterBlurryBtn');
    const resetFilterBlurryBtn = document.getElementById('resetFilterBlurryBtn');
    // 類似画像フィルター
    const similarityMinInput = document.getElementById('similarityMin');
    const similarityMaxInput = document.getElementById('similarityMax');
    const similaritySlider = document.getElementById('similaritySlider'); // 同上
    const applyFilterSimilarBtn = document.getElementById('applyFilterSimilarBtn');
    const resetFilterSimilarBtn = document.getElementById('resetFilterSimilarBtn');
    // エラーフィルター
    const errorTypeFilterSelect = document.getElementById('errorTypeFilter');
    const applyFilterErrorsBtn = document.getElementById('applyFilterErrorsBtn');
    const resetFilterErrorsBtn = document.getElementById('resetFilterErrorsBtn');


    // --- フッターアクションボタン ---
    const selectedItemsCountSpan = document.getElementById('selected-items-count');
    const selectedItemsSizeSpan = document.getElementById('selected-items-size');
    const btnTrash = document.getElementById('btn-trash');
    const btnDeletePermanently = document.getElementById('btn-delete-permanently');
    const btnMove = document.getElementById('btn-move');
    const btnIgnoreError = document.getElementById('btn-ignore-error');
    const btnRetryScanError = document.getElementById('btn-retry-scan-error');

    // --- テーブルボディ ---
    const blurryTbody = document.getElementById('blurry-images-tbody');
    const similarTbody = document.getElementById('similar-images-tbody');
    const errorTbody = document.getElementById('error-files-tbody');

    // --- 初期状態 ---
    let currentTab = 'blurry';
    let selectedTargetFolder = null;
    let selectedOutputFolder = null;
    let originalScanResults = { // 元のスキャン結果を保持
        blurryImages: [],
        similarImagePairs: [],
        errorFiles: []
    };
    // filteredScanResults は applyFilters 関数内で都度生成・更新するので、ここでは不要

    // --- 関数 ---
    function updateStatus(message, isError = false) {
        statusMessageSpan.textContent = message;
        statusMessageSpan.classList.toggle('text-red-400', isError);
        statusMessageSpan.classList.toggle('text-white', !isError);
    }

    function switchTab(tabId) {
        currentTab = tabId;
        tabButtons.forEach(button => {
            button.classList.toggle('tab-active', button.id === `tab-${tabId}`);
        });
        listPanels.forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `list-area-${tabId}`);
        });
        filterPanels.forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `filter-${tabId}-container`);
        });

        if (tabId === 'errors') {
            blurryActionButtons.classList.add('hidden');
            errorsActionButtons.classList.remove('hidden');
            exportErrorLogBtn.classList.remove('hidden');
            selectAllBtn.textContent = "全エラー選択";
            deselectAllBtn.textContent = "エラー選択解除";
        } else {
            blurryActionButtons.classList.remove('hidden');
            errorsActionButtons.classList.add('hidden');
            exportErrorLogBtn.classList.add('hidden');
            selectAllBtn.textContent = "全件選択";
            deselectAllBtn.textContent = "選択解除";
        }
        resetAndApplyFilters(); // タブ切り替え時にフィルターをリセットして全件表示
        updateSelectionInfo();
        displayPreview(null);
        console.log(`Switched to ${tabId} tab.`);
    }
    
    function clearAllTablesAndResults() {
        blurryTbody.innerHTML = '';
        similarTbody.innerHTML = '';
        errorTbody.innerHTML = '';
        document.getElementById('count-blurry').textContent = 0;
        document.getElementById('count-similar').textContent = 0;
        document.getElementById('count-errors').textContent = 0;
        originalScanResults = { blurryImages: [], similarImagePairs: [], errorFiles: [] };
        // filteredScanResults は applyFilters で再生成されるのでここでは不要
        displayPreview(null);
        updateSelectionInfo();
    }

    function updateSelectionInfo() {
        let count = 0;
        let size = 0;
        const activeTbody = document.querySelector(`.list-panel:not(.hidden) tbody`);
        if (activeTbody) {
            if (currentTab === 'blurry' || currentTab === 'errors') {
                const checkedCheckboxes = activeTbody.querySelectorAll('input[type="checkbox"].item-checkbox:checked');
                count = checkedCheckboxes.length;
                checkedCheckboxes.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.dataset.sizeMb) {
                        size += parseFloat(row.dataset.sizeMb);
                    }
                });
            } else if (currentTab === 'similar') {
                let fileCountInPairs = 0;
                let pairCheckboxes = activeTbody.querySelectorAll('input[type="checkbox"].pair-checkbox:checked');
                
                pairCheckboxes.forEach(pairCheckbox => {
                    const row = pairCheckbox.closest('tr');
                    if (row) {
                        const file1Cb = row.querySelector('.file1-checkbox');
                        const file2Cb = row.querySelector('.file2-checkbox');
                        if (file1Cb && file1Cb.checked) {
                            fileCountInPairs++;
                            if(row.dataset.size1Mb) size += parseFloat(row.dataset.size1Mb);
                        }
                        if (file2Cb && file2Cb.checked) {
                            fileCountInPairs++;
                            if(row.dataset.size2Mb) size += parseFloat(row.dataset.size2Mb);
                        }
                    }
                });
                count = fileCountInPairs;
            }
        }

        selectedItemsCountSpan.textContent = `${count}件`;
        selectedItemsSizeSpan.textContent = `${size.toFixed(1)} MB`;
        const hasSelection = count > 0;
        const isMoveActionPossible = hasSelection && selectedOutputFolder !== null;

        if (currentTab === 'errors') {
            btnIgnoreError.disabled = !hasSelection;
            btnRetryScanError.disabled = !hasSelection;
        } else {
            btnTrash.disabled = !hasSelection;
            btnDeletePermanently.disabled = !hasSelection;
            btnMove.disabled = !isMoveActionPossible;
        }
    }

    function updateZoom(value, fromSlider = false, fromInput = false) {
        const val = Math.max(parseInt(zoomSlider.min, 10), Math.min(parseInt(zoomSlider.max, 10), parseInt(value, 10)));
        if (!fromSlider) zoomSlider.value = val;
        if (!fromInput) zoomInput.value = val;
        zoomValueDisplay.textContent = val;
        const scale = val / 100;
        if (previewImage1.src && previewImage1.src.startsWith('app-file://')) {
            previewImage1.style.transform = `scale(${scale})`;
        }
        if (previewImage2.src && previewImage2.src.startsWith('app-file://')) {
            previewImage2.style.transform = `scale(${scale})`;
        }
    }

    async function displayPreview(item, type) {
        previewImage1.classList.add('hidden');
        previewImage2.classList.add('hidden');
        previewPlaceholderText.classList.remove('hidden');
        infoBlurScoreContainer.classList.add('hidden');
        infoSimilarityContainer.classList.add('hidden');
        previewImage1.src = '';
        previewImage2.src = '';
        previewImage1.style.transform = 'scale(1)';
        previewImage2.style.transform = 'scale(1)';
        updateZoom(100);

        if (!item) {
            previewPlaceholderText.textContent = '画像を選択するとここにプレビューが表示されます';
            infoFilename.textContent = '-';
            infoFilepath.textContent = '-';
            infoResolution.textContent = '-';
            infoFilesize.textContent = '-';
            infoDatetime.textContent = '-';
            return;
        }

        if (type === 'blurry') {
            previewPlaceholderText.classList.add('hidden');
            try {
                const imageSrc = await window.electronAPI.convertFileSrc(item.path);
                if (imageSrc) {
                    previewImage1.src = imageSrc;
                    previewImage1.classList.remove('hidden');
                } else {
                    previewPlaceholderText.textContent = 'プレビューを読み込めません';
                    previewPlaceholderText.classList.remove('hidden');
                }
            } catch (e) {
                previewPlaceholderText.textContent = 'プレビュー読み込みエラー';
                previewPlaceholderText.classList.remove('hidden');
                console.error(`Error loading preview for ${item.path}:`, e);
            }
            infoFilename.textContent = item.filename;
            infoFilepath.textContent = item.path;
            infoFilepath.title = item.path;
            infoResolution.textContent = item.resolution;
            infoFilesize.textContent = `${item.size} MB`;
            infoDatetime.textContent = item.takenDate;
            infoBlurScore.textContent = item.blurScore;
            infoBlurScoreContainer.classList.remove('hidden');
        } else if (type === 'similar') {
            previewPlaceholderText.classList.add('hidden');
            try {
                const [imageSrc1, imageSrc2] = await Promise.all([
                    window.electronAPI.convertFileSrc(item.path1),
                    window.electronAPI.convertFileSrc(item.path2)
                ]);
                if (imageSrc1) {
                    previewImage1.src = imageSrc1;
                    previewImage1.classList.remove('hidden');
                }
                if (imageSrc2) {
                    previewImage2.src = imageSrc2;
                    previewImage2.classList.remove('hidden');
                }
                if (previewImage1.classList.contains('hidden') && previewImage2.classList.contains('hidden')) {
                    previewPlaceholderText.textContent = 'プレビューを読み込めません';
                    previewPlaceholderText.classList.remove('hidden');
                }
            } catch (e) {
                 previewPlaceholderText.textContent = 'プレビュー読み込みエラー';
                 previewPlaceholderText.classList.remove('hidden');
                 console.error(`Error loading similar previews:`, e);
            }
            infoFilename.textContent = `${item.filename1} vs ${item.filename2}`;
            infoFilepath.textContent = `(左) ${item.path1} (右) ${item.path2}`;
            infoResolution.textContent = `(左) ${item.resolution1} (右) ${item.resolution2}`;
            infoSimilarity.textContent = `${item.similarity}%`;
            infoSimilarityContainer.classList.remove('hidden');
            infoFilesize.textContent = `(左) ${item.size1 || '-'}MB (右) ${item.size2 || '-'}MB`;
            infoDatetime.textContent = '-';
        } else if (type === 'error') {
            previewPlaceholderText.textContent = `エラー: ${item.errorMessage}`;
            infoFilename.textContent = item.filename;
            infoFilepath.textContent = item.filepath;
            infoFilepath.title = item.filepath;
            infoResolution.textContent = '-';
            infoFilesize.textContent = item.size ? `${item.size} MB` : '-';
            infoDatetime.textContent = '-';
        }
    }
    
    // --- イベントリスナー ---
    if (selectTargetFolderBtn) {
        selectTargetFolderBtn.addEventListener('click', async () => {
            try {
                updateStatus('対象フォルダを選択中...');
                const folderPath = await window.electronAPI.openDirectoryDialog();
                if (folderPath) {
                    selectedTargetFolder = folderPath;
                    targetFolderPathSpan.textContent = folderPath;
                    targetFolderPathSpan.title = folderPath;
                    updateStatus(`対象フォルダ選択: ${folderPath}`);
                    startScanBtn.disabled = false;
                    clearAllTablesAndResults();
                } else {
                    updateStatus('対象フォルダ選択がキャンセルされました。');
                    if (!selectedTargetFolder) {
                        startScanBtn.disabled = true;
                    }
                }
            } catch (error) {
                console.error('対象フォルダ選択エラー:', error);
                updateStatus(`対象フォルダ選択エラー: ${error.message}`, true);
            }
        });
    }

    if (selectOutputFolderBtn) {
        selectOutputFolderBtn.addEventListener('click', async () => {
            try {
                updateStatus('移動先フォルダを選択中...');
                const folderPath = await window.electronAPI.openDirectoryDialog();
                if (folderPath) {
                    selectedOutputFolder = folderPath;
                    outputFolderPathSpan.textContent = folderPath;
                    outputFolderPathSpan.title = folderPath;
                    updateStatus(`移動先フォルダ選択: ${folderPath}`);
                } else {
                    updateStatus('移動先フォルダ選択がキャンセルされました。');
                }
                updateSelectionInfo();
            } catch (error) {
                console.error('移動先フォルダ選択エラー:', error);
                updateStatus(`移動先フォルダ選択エラー: ${error.message}`, true);
            }
        });
    }

    if (startScanBtn) {
        startScanBtn.addEventListener('click', async () => {
            if (!selectedTargetFolder) {
                updateStatus('スキャンを開始する前に対象フォルダを選択してください。', true);
                return;
            }
            clearAllTablesAndResults();
            updateStatus(`スキャン中: ${selectedTargetFolder}`);
            startScanBtn.disabled = true;
            startScanBtn.textContent = 'スキャン中...';

            try {
                if (window.electronAPI && typeof window.electronAPI.executeScan === 'function') {
                    const results = await window.electronAPI.executeScan(selectedTargetFolder);
                    console.log('Scan results received:', results);
                    originalScanResults = results || { blurryImages: [], similarImagePairs: [], errorFiles: [] };
                    resetAndApplyFilters(); // スキャン後、フィルターをリセットして全件表示
                    updateStatus('スキャン完了', false);
                } else { 
                    throw new Error('executeScan API is not available.');
                }
            } catch (error) {
                console.error('スキャン実行エラー:', error);
                updateStatus(`スキャンエラー: ${error.message || '不明なエラー'}`, true);
                originalScanResults = { blurryImages: [], similarImagePairs: [], errorFiles: [] };
                populateErrorTable([{id: 'scan_err', filename: 'スキャンエラー', errorMessage: error.message || 'Pythonスクリプトの実行に失敗しました。', filepath: selectedTargetFolder}]);
            } finally {
                startScanBtn.disabled = false;
                startScanBtn.textContent = 'スキャン開始';
            }
        });
        startScanBtn.disabled = true;
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            console.log('設定ボタンクリック');
            if (window.electronAPI && typeof window.electronAPI.openSettingsWindow === 'function') {
                window.electronAPI.openSettingsWindow();
            } else {
                console.error('electronAPI.openSettingsWindow is not available.');
                updateStatus('設定画面を開けませんでした。', true);
            }
        });
    }
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.id.replace('tab-', '');
            switchTab(tabId);
        });
    });
    
    // (ズームコントロールのイベントリスナーは変更なし)
    zoomSlider.addEventListener('input', (e) => updateZoom(e.target.value, true, false));
    zoomInput.addEventListener('change', (e) => updateZoom(e.target.value, false, true));
    zoomInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') updateZoom(e.target.value, false, true); });
    zoomInBtn.addEventListener('click', () => updateZoom(parseInt(zoomInput.value, 10) + 10));
    zoomOutBtn.addEventListener('click', () => updateZoom(parseInt(zoomInput.value, 10) - 10));
    resetZoomBtn.addEventListener('click', () => {
        updateZoom(100);
        if (previewImage1.src && previewImage1.src.startsWith('app-file://')) previewImage1.style.transform = 'scale(1)';
        if (previewImage2.src && previewImage2.src.startsWith('app-file://')) previewImage2.style.transform = 'scale(1)';
    });


    // --- フィルター関連の関数とイベントリスナー ---
    function getBlurryFilterValues() {
        const min = parseInt(blurScoreMinInput.value, 10);
        const max = parseInt(blurScoreMaxInput.value, 10);
        return { 
            minScore: isNaN(min) || min < 0 ? 0 : min > 100 ? 100 : min, 
            maxScore: isNaN(max) || max < 0 ? 0 : max > 100 ? 100 : max 
        };
    }

    function getSimilarFilterValues() {
        const min = parseInt(similarityMinInput.value, 10);
        const max = parseInt(similarityMaxInput.value, 10);
        return { 
            minSimilarity: isNaN(min) || min < 0 ? 0 : min > 100 ? 100 : min, 
            maxSimilarity: isNaN(max) || max < 0 ? 0 : max > 100 ? 100 : max
        };
    }

    function getErrorFilterValues() {
        return { errorType: errorTypeFilterSelect.value };
    }

    function applyFilters() {
        console.log(`Applying filters for tab: ${currentTab}`);
        if (!originalScanResults) {
            console.warn("originalScanResults is not available for filtering.");
            return;
        }

        let filteredItems = [];

        if (currentTab === 'blurry') {
            const { minScore, maxScore } = getBlurryFilterValues();
            filteredItems = (originalScanResults.blurryImages || []).filter(img => 
                img.blurScore >= minScore && img.blurScore <= maxScore
            );
            populateBlurryTable(filteredItems);
        } else if (currentTab === 'similar') {
            const { minSimilarity, maxSimilarity } = getSimilarFilterValues();
            filteredItems = (originalScanResults.similarImagePairs || []).filter(pair =>
                pair.similarity >= minSimilarity && pair.similarity <= maxSimilarity
            );
            populateSimilarTable(filteredItems);
        } else if (currentTab === 'errors') {
            const { errorType } = getErrorFilterValues();
            if (errorType) {
                filteredItems = (originalScanResults.errorFiles || []).filter(err =>
                    err.errorType === errorType
                );
            } else {
                filteredItems = [...(originalScanResults.errorFiles || [])];
            }
            populateErrorTable(filteredItems);
        }
        updateSelectionInfo();
        displayPreview(null); // フィルター適用後はプレビューをリセット
    }

    function resetAndApplyFilters() {
        // UIの値をデフォルトに戻す
        if (blurScoreMinInput) blurScoreMinInput.value = 0;
        if (blurScoreMaxInput) blurScoreMaxInput.value = 100;
        if (blurScoreSlider) blurScoreSlider.value = 0; // 単一スライダーの例 (最小値に合わせるなど)
        
        if (similarityMinInput) similarityMinInput.value = 0;
        if (similarityMaxInput) similarityMaxInput.value = 100;
        if (similaritySlider) similaritySlider.value = 0; // 単一スライダーの例

        if (errorTypeFilterSelect) errorTypeFilterSelect.value = "";

        // フィルターを適用して全件表示に戻す
        applyFilters();
    }

    if(applyFilterBlurryBtn) applyFilterBlurryBtn.addEventListener('click', applyFilters);
    if(applyFilterSimilarBtn) applyFilterSimilarBtn.addEventListener('click', applyFilters);
    if(applyFilterErrorsBtn) applyFilterErrorsBtn.addEventListener('click', applyFilters);

    if(resetFilterBlurryBtn) resetFilterBlurryBtn.addEventListener('click', resetAndApplyFilters);
    if(resetFilterSimilarBtn) resetFilterSimilarBtn.addEventListener('click', resetAndApplyFilters);
    if(resetFilterErrorsBtn) resetFilterErrorsBtn.addEventListener('click', resetAndApplyFilters);
    
    // スライダーと数値入力の同期 (基本的な単方向同期の例)
    // ブレ画像スコア
    if(blurScoreMinInput && blurScoreSlider) { // 単一スライダーを最小値と同期
        blurScoreMinInput.addEventListener('input', () => {
            let minVal = parseInt(blurScoreMinInput.value, 10);
            let maxVal = parseInt(blurScoreMaxInput.value, 10);
            if (isNaN(minVal)) minVal = 0;
            if (isNaN(maxVal)) maxVal = 100;
            if (minVal > maxVal) blurScoreMaxInput.value = minVal; // 最小値が最大値を超えないように
            if (minVal < 0) blurScoreMinInput.value = 0;
            if (minVal > 100) blurScoreMinInput.value = 100;
            // blurScoreSlider.value = blurScoreMinInput.value; // 単一スライダーの場合
        });
        // blurScoreSlider.addEventListener('input', () => { // 単一スライダーの場合
        //     blurScoreMinInput.value = blurScoreSlider.value;
        // });
    }
    if(blurScoreMaxInput) {
         blurScoreMaxInput.addEventListener('input', () => {
            let minVal = parseInt(blurScoreMinInput.value, 10);
            let maxVal = parseInt(blurScoreMaxInput.value, 10);
            if (isNaN(minVal)) minVal = 0;
            if (isNaN(maxVal)) maxVal = 100;
            if (maxVal < minVal) blurScoreMinInput.value = maxVal; // 最大値が最小値を下回らないように
            if (maxVal < 0) blurScoreMaxInput.value = 0;
            if (maxVal > 100) blurScoreMaxInput.value = 100;
         });
    }

    // 類似度
    if(similarityMinInput && similaritySlider) {
        similarityMinInput.addEventListener('input', () => {
            let minVal = parseInt(similarityMinInput.value, 10);
            let maxVal = parseInt(similarityMaxInput.value, 10);
            if (isNaN(minVal)) minVal = 0;
            if (isNaN(maxVal)) maxVal = 100;
            if (minVal > maxVal) similarityMaxInput.value = minVal;
            if (minVal < 0) similarityMinInput.value = 0;
            if (minVal > 100) similarityMinInput.value = 100;
            // similaritySlider.value = similarityMinInput.value;
        });
        // similaritySlider.addEventListener('input', () => {
        //     similarityMinInput.value = similaritySlider.value;
        // });
    }
     if(similarityMaxInput) {
         similarityMaxInput.addEventListener('input', () => {
            let minVal = parseInt(similarityMinInput.value, 10);
            let maxVal = parseInt(similarityMaxInput.value, 10);
            if (isNaN(minVal)) minVal = 0;
            if (isNaN(maxVal)) maxVal = 100;
            if (maxVal < minVal) similarityMinInput.value = maxVal;
            if (maxVal < 0) similarityMaxInput.value = 0;
            if (maxVal > 100) similarityMaxInput.value = 100;
         });
    }


    // --- テーブル描画関数 ---
    function populateTable(tbody, items, itemType, createRowFn) {
        tbody.innerHTML = '';
        if (!items || items.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 10;
            cell.textContent = '対象のアイテムは見つかりませんでした。';
            cell.className = 'text-center text-slate-500 py-8';
            return;
        }

        items.forEach(item => {
            const row = createRowFn(item);
            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    tbody.querySelectorAll('tr.bg-sky-100').forEach(r => r.classList.remove('bg-sky-100'));
                    row.classList.add('bg-sky-100');
                    displayPreview(item, itemType);
                }
            });
            row.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', updateSelectionInfo);
            });
            tbody.appendChild(row);
        });
        updateSelectionInfo();
    }
    
    function createBlurryRow(item) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50 cursor-pointer';
        row.dataset.id = item.id;
        row.dataset.sizeMb = item.size;
        row.innerHTML = `
            <td class="px-3 py-2"><input type="checkbox" data-id="${item.id}" class="item-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4"></td>
            <td class="px-3 py-2 whitespace-nowrap">${item.filename}</td>
            <td class="px-3 py-2 whitespace-nowrap">${item.size} MB</td>
            <td class="px-3 py-2 whitespace-nowrap hidden md:table-cell">${item.modifiedDate}</td>
            <td class="px-3 py-2 whitespace-nowrap hidden lg:table-cell">${item.takenDate}</td>
            <td class="px-3 py-2 whitespace-nowrap hidden lg:table-cell">${item.resolution}</td>
            <td class="px-3 py-2 whitespace-nowrap font-medium ${item.blurScore > 90 ? 'text-red-600' : item.blurScore > 70 ? 'text-orange-500' : 'text-yellow-500'}">${item.blurScore}</td>
        `;
        return row;
    }
    
    function createSimilarRow(pair) {
        const row = document.createElement('tr');
        row.className = `hover:bg-slate-50 cursor-pointer ${pair.recommended ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`;
        row.dataset.pairId = pair.id;
        row.dataset.size1Mb = pair.size1;
        row.dataset.size2Mb = pair.size2;
        const recommendedIcon1 = pair.recommended === 'file1' ? '<span title="アプリによる推奨" class="text-amber-500 mr-1">★</span>' : '';
        const recommendedIcon2 = pair.recommended === 'file2' ? '<span title="アプリによる推奨" class="text-amber-500 mr-1">★</span>' : '';
        const file1Checked = pair.recommended === 'file2' ? 'checked' : '';
        const file2Checked = pair.recommended === 'file1' || !pair.recommended ? 'checked' : '';

        row.innerHTML = `
            <td class="px-3 py-2"><input type="checkbox" data-pair-id="${pair.id}" class="pair-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4"></td>
            <td class="px-3 py-2"><input type="checkbox" data-file-id="${pair.id}-f1" class="file1-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4" ${file1Checked}></td>
            <td class="px-3 py-2 whitespace-nowrap">${recommendedIcon1}${pair.filename1}</td>
            <td class="px-3 py-2 whitespace-nowrap hidden md:table-cell">${pair.resolution1}</td>
            <td class="px-3 py-2"><input type="checkbox" data-file-id="${pair.id}-f2" class="file2-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4" ${file2Checked}></td>
            <td class="px-3 py-2 whitespace-nowrap">${recommendedIcon2}${pair.filename2}</td>
            <td class="px-3 py-2 whitespace-nowrap hidden md:table-cell">${pair.resolution2}</td>
            <td class="px-3 py-2 whitespace-nowrap font-medium ${pair.similarity > 95 ? 'text-green-700' : pair.similarity > 85 ? 'text-green-600' : 'text-green-500'}">${pair.similarity}%</td>
        `;
        return row;
    }

    function createErrorRow(error) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50 cursor-pointer';
        row.dataset.id = error.id;
        row.dataset.sizeMb = error.size || 0;
        const errorColor = error.errorType === 'corrupted' || error.errorType === 'access_denied' ? 'text-red-600' : 'text-orange-600';
        row.innerHTML = `
            <td class="px-3 py-2"><input type="checkbox" data-id="${error.id}" class="item-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4"></td>
            <td class="px-3 py-2 whitespace-nowrap">${error.filename}</td>
            <td class="px-3 py-2 whitespace-nowrap ${errorColor}">${error.errorMessage}</td>
            <td class="px-3 py-2 whitespace-nowrap text-slate-500 truncate max-w-xs" title="${error.filepath}">${error.filepath}</td>
        `;
        return row;
    }
    
    function populateBlurryTable(images) {
        populateTable(blurryTbody, images, 'blurry', createBlurryRow);
        document.getElementById('count-blurry').textContent = images.length;
    }
    function populateSimilarTable(imagePairs) {
        populateTable(similarTbody, imagePairs, 'similar', createSimilarRow);
        document.getElementById('count-similar').textContent = imagePairs.length;
    }
    function populateErrorTable(errors) {
        populateTable(errorTbody, errors, 'error', createErrorRow);
        document.getElementById('count-errors').textContent = errors.length;
    }

    // --- 初期化処理 ---
    switchTab('blurry');
    updateSelectionInfo();
    updateZoom(100);
    displayPreview(null, null);
});
