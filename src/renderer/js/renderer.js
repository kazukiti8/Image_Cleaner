// レンダラープロセスのメインスクリプト
console.log('Renderer script loaded.');

// DOMContentLoaded イベントを待ってからDOM操作を行う
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
    const settingsBtn = document.getElementById('settingsBtn'); // 設定ボタンの参照

    // --- タブ関連 ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const listPanels = document.querySelectorAll('.list-panel');
    const filterPanels = document.querySelectorAll('.filter-panel-content');
    const blurryActionButtons = document.getElementById('action-buttons-blurry-similar');
    const errorsActionButtons = document.getElementById('action-buttons-errors');
    const exportErrorLogBtn = document.getElementById('exportErrorLogBtn');


    // --- プレビュー関連 ---
    const previewImageContainer = document.getElementById('preview-image-container');
    const previewImage1 = document.getElementById('previewImage1');
    const previewImage2 = document.getElementById('previewImage2');
    const previewPlaceholderText = document.getElementById('preview-placeholder-text');
    // 画像情報表示用span
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
    // フィルターボタン (ブレ画像)
    const blurScoreMinInput = document.getElementById('blurScoreMin');
    const blurScoreMaxInput = document.getElementById('blurScoreMax');
    const blurScoreSlider = document.getElementById('blurScoreSlider');
    const applyFilterBlurryBtn = document.getElementById('applyFilterBlurryBtn');
    const resetFilterBlurryBtn = document.getElementById('resetFilterBlurryBtn');
    // フィルターボタン (類似画像)
    const similarityMinInput = document.getElementById('similarityMin');
    const similarityMaxInput = document.getElementById('similarityMax');
    const similaritySlider = document.getElementById('similaritySlider');
    const applyFilterSimilarBtn = document.getElementById('applyFilterSimilarBtn');
    const resetFilterSimilarBtn = document.getElementById('resetFilterSimilarBtn');
    // フィルターボタン (エラー)
    const errorTypeFilterSelect = document.getElementById('errorTypeFilter');
    const applyFilterErrorsBtn = document.getElementById('applyFilterErrorsBtn');
    const resetFilterErrorsBtn = document.getElementById('resetFilterErrorsBtn');


    // --- フッターアクションボタン ---
    const selectionInfoSpan = document.getElementById('selection-info');
    const selectedItemsCountSpan = document.getElementById('selected-items-count');
    const selectedItemsSizeSpan = document.getElementById('selected-items-size');
    // ブレ・類似画像用
    const btnTrash = document.getElementById('btn-trash');
    const btnDeletePermanently = document.getElementById('btn-delete-permanently');
    const btnMove = document.getElementById('btn-move');
    // エラー用
    const btnIgnoreError = document.getElementById('btn-ignore-error');
    const btnRetryScanError = document.getElementById('btn-retry-scan-error');

    // --- テーブルボディ ---
    const blurryTbody = document.getElementById('blurry-images-tbody');
    const similarTbody = document.getElementById('similar-images-tbody');
    const errorTbody = document.getElementById('error-files-tbody');

    // --- 初期状態 ---
    let currentTab = 'blurry'; // 'blurry', 'similar', 'errors'
    let selectedTargetFolder = null;
    let selectedOutputFolder = null;

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
        updateSelectionInfo();
        console.log(`Switched to ${tabId} tab.`);
    }

    function updateSelectionInfo() {
        let count = 0;
        let size = 0; // MB
        const activeTbody = document.querySelector(`.list-panel:not(.hidden) tbody`);
        if (activeTbody) {
            const checkedCheckboxes = activeTbody.querySelectorAll('input[type="checkbox"].item-checkbox:checked, input[type="checkbox"].pair-checkbox:checked');

            if (currentTab === 'blurry' || currentTab === 'errors') {
                count = checkedCheckboxes.length;
                checkedCheckboxes.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.dataset.sizeMb) {
                        size += parseFloat(row.dataset.sizeMb);
                    }
                });
            } else if (currentTab === 'similar') {
                let fileCountInPairs = 0;
                 checkedCheckboxes.forEach(pairCheckbox => {
                    const row = pairCheckbox.closest('tr');
                    if (row && pairCheckbox.checked) {
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
        if (previewImage1.src && !previewImage1.classList.contains('hidden') && previewImage1.src !== 'https://placehold.co/1x1/transparent/transparent') {
            previewImage1.style.transform = `scale(${scale})`;
        }
        if (previewImage2.src && !previewImage2.classList.contains('hidden') && previewImage2.src !== 'https://placehold.co/1x1/transparent/transparent') {
            previewImage2.style.transform = `scale(${scale})`;
        }
        console.log(`Zoom set to: ${val}%`);
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
        startScanBtn.addEventListener('click', () => {
            if (!selectedTargetFolder) {
                updateStatus('スキャンを開始する前に対象フォルダを選択してください。', true);
                return;
            }
            updateStatus(`スキャン開始: ${selectedTargetFolder}`);
            startScanBtn.disabled = true;
            startScanBtn.textContent = 'スキャン中...';

            console.warn("開発用: ダミーデータを2秒後に表示します。実際のPython連携に置き換えてください。");
            setTimeout(() => {
                if (currentTab === 'blurry') populateBlurryTable(dummyBlurryImages);
                else if (currentTab === 'similar') populateSimilarTable(dummySimilarImages);
                else if (currentTab === 'errors') populateErrorTable(dummyErrorFiles);
                updateStatus('スキャン完了 (ダミー)', false);
                startScanBtn.disabled = false;
                startScanBtn.textContent = 'スキャン開始';
            }, 2000);
        });
        startScanBtn.disabled = true;
    }

    // 設定ボタンのイベントリスナー
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            console.log('設定ボタンがクリックされました。メインプロセスに通知します。');
            if (window.electronAPI && typeof window.electronAPI.openSettingsWindow === 'function') {
                window.electronAPI.openSettingsWindow();
            } else {
                console.error('electronAPI.openSettingsWindow is not available. Check preload script.');
                updateStatus('設定画面を開けませんでした。preload.jsを確認してください。', true);
            }
        });
    }


    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.id.replace('tab-', '');
            switchTab(tabId);
        });
    });

    zoomSlider.addEventListener('input', (e) => updateZoom(e.target.value, true, false));
    zoomInput.addEventListener('change', (e) => updateZoom(e.target.value, false, true));
    zoomInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') updateZoom(e.target.value, false, true);
    });
    zoomInBtn.addEventListener('click', () => updateZoom(parseInt(zoomInput.value, 10) + 10));
    zoomOutBtn.addEventListener('click', () => updateZoom(parseInt(zoomInput.value, 10) - 10));
    resetZoomBtn.addEventListener('click', () => {
        updateZoom(100);
        if (previewImage1.src && !previewImage1.classList.contains('hidden') && previewImage1.src !== 'https://placehold.co/1x1/transparent/transparent') {
             previewImage1.style.transform = 'scale(1)';
        }
        if (previewImage2.src && !previewImage2.classList.contains('hidden') && previewImage2.src !== 'https://placehold.co/1x1/transparent/transparent') {
            previewImage2.style.transform = 'scale(1)';
        }
    });


    selectAllBtn.addEventListener('click', () => {
        const activeTbody = document.querySelector(`.list-panel:not(.hidden) tbody`);
        const headerCheckboxId = `selectAll${currentTab === 'similar' ? 'Pairs-similar' : ('-' + currentTab)}`;
        const headerCheckbox = document.getElementById(headerCheckboxId);


        if (activeTbody) {
            const checkboxesToSelect = currentTab === 'similar' ?
                activeTbody.querySelectorAll('input[type="checkbox"].pair-checkbox') :
                activeTbody.querySelectorAll('input[type="checkbox"].item-checkbox');

            checkboxesToSelect.forEach(cb => cb.checked = true);
            if (headerCheckbox) headerCheckbox.checked = true;

            if(currentTab === 'similar'){
                 activeTbody.querySelectorAll('input[type="checkbox"].file1-checkbox, input[type="checkbox"].file2-checkbox').forEach(cb => cb.checked = true);
                 const headerFile1Cb = document.getElementById('selectAllFile1-similar');
                 const headerFile2Cb = document.getElementById('selectAllFile2-similar');
                 if(headerFile1Cb) headerFile1Cb.checked = true;
                 if(headerFile2Cb) headerFile2Cb.checked = true;
            }
        }
        updateSelectionInfo();
    });

    deselectAllBtn.addEventListener('click', () => {
        const activeTbody = document.querySelector(`.list-panel:not(.hidden) tbody`);
        const headerCheckboxId = `selectAll${currentTab === 'similar' ? 'Pairs-similar' : ('-' + currentTab)}`;
        const headerCheckbox = document.getElementById(headerCheckboxId);

        if (activeTbody) {
             const checkboxesToDeselect = currentTab === 'similar' ?
                activeTbody.querySelectorAll('input[type="checkbox"].pair-checkbox') :
                activeTbody.querySelectorAll('input[type="checkbox"].item-checkbox');

            checkboxesToDeselect.forEach(cb => cb.checked = false);
            if (headerCheckbox) headerCheckbox.checked = false;

            if(currentTab === 'similar'){
                 activeTbody.querySelectorAll('input[type="checkbox"].file1-checkbox, input[type="checkbox"].file2-checkbox').forEach(cb => cb.checked = false);
                 const headerFile1Cb = document.getElementById('selectAllFile1-similar');
                 const headerFile2Cb = document.getElementById('selectAllFile2-similar');
                 if(headerFile1Cb) headerFile1Cb.checked = false;
                 if(headerFile2Cb) headerFile2Cb.checked = false;
            }
        }
        updateSelectionInfo();
    });

    function setupSelectAllHeaderCheckbox(tbodyId, headerCheckboxId, itemCheckboxClass) {
        const headerCheckbox = document.getElementById(headerCheckboxId);
        const tbody = document.getElementById(tbodyId);
        if (headerCheckbox && tbody) {
            headerCheckbox.addEventListener('change', (e) => {
                tbody.querySelectorAll(`input[type="checkbox"].${itemCheckboxClass}`).forEach(cb => {
                    cb.checked = e.target.checked;
                });
                if (headerCheckboxId === 'selectAllPairs-similar' && itemCheckboxClass === 'pair-checkbox') {
                    const file1HeaderCb = document.getElementById('selectAllFile1-similar');
                    const file2HeaderCb = document.getElementById('selectAllFile2-similar');
                    if (file1HeaderCb) file1HeaderCb.checked = e.target.checked;
                    if (file2HeaderCb) file2HeaderCb.checked = e.target.checked;
                    tbody.querySelectorAll('input[type="checkbox"].file1-checkbox, input[type="checkbox"].file2-checkbox').forEach(cb => {
                        cb.checked = e.target.checked;
                    });
                }
                updateSelectionInfo();
            });
        }
    }
    setupSelectAllHeaderCheckbox('blurry-images-tbody', 'selectAll-blurry', 'item-checkbox');
    setupSelectAllHeaderCheckbox('similar-images-tbody', 'selectAllPairs-similar', 'pair-checkbox');
    setupSelectAllHeaderCheckbox('similar-images-tbody', 'selectAllFile1-similar', 'file1-checkbox');
    setupSelectAllHeaderCheckbox('similar-images-tbody', 'selectAllFile2-similar', 'file2-checkbox');
    setupSelectAllHeaderCheckbox('error-files-tbody', 'selectAll-errors', 'item-checkbox');


    btnTrash.addEventListener('click', () => {
        console.log('ゴミ箱へボタンクリック');
    });
    btnDeletePermanently.addEventListener('click', () => {
        console.log('完全に削除ボタンクリック');
    });
    btnMove.addEventListener('click', () => {
        console.log('移動...ボタンクリック');
    });
    btnIgnoreError.addEventListener('click', () => console.log('選択を無視'));
    btnRetryScanError.addEventListener('click', () => console.log('再スキャン試行'));


    const dummyBlurryImages = [
        { id: 'b1', filename: 'IMG_001.jpg', size: 2.5, modifiedDate: '2024/05/01', takenDate: '2024/04/30', resolution: '1920x1080', blurScore: 95, path: '/path/to/IMG_001.jpg' },
        { id: 'b2', filename: 'photo_002_blurry.png', size: 1.8, modifiedDate: '2024/05/02', takenDate: '2024/05/01', resolution: '1024x768', blurScore: 78, path: '/path/to/photo_002_blurry.png' },
        { id: 'b3', filename: 'capture_003.jpeg', size: 3.1, modifiedDate: '2024/05/03', takenDate: '2024/05/02', resolution: '2048x1536', blurScore: 98, path: '/path/to/capture_003.jpeg' },
    ];

    const dummySimilarImages = [
        { id: 's1', filename1: 'GroupA_img1.jpg', resolution1: '1920x1080', path1: '/path/to/GroupA_img1.jpg', size1: 2.1, filename2: 'GroupA_img2.jpg', resolution2: '1920x1080', path2: '/path/to/GroupA_img2.jpg', size2: 2.2, similarity: 98, recommended: 'file1' },
        { id: 's2', filename1: 'IMG_005_original.png', resolution1: '2048x1536', path1: '/path/to/IMG_005_original.png', size1: 3.5, filename2: 'IMG_005_resized.png', resolution2: '1024x768', path2: '/path/to/IMG_005_resized.png', size2: 0.8, similarity: 92, recommended: 'file1' },
        { id: 's3', filename1: 'Photo_A.jpeg', resolution1: '3000x2000', path1: '/path/to/Photo_A.jpeg', size1: 4.0, filename2: 'Photo_A_copy.jpeg', resolution2: '3000x2000', path2: '/path/to/Photo_A_copy.jpeg', size2: 4.0, similarity: 100, recommended: 'file2' },
    ];

    const dummyErrorFiles = [
        { id: 'e1', filename: 'corrupted_image.jpg', errorMessage: 'ファイルが破損しています', filepath: 'C:\\...\\corrupted_image.jpg', errorType: 'corrupted', size: 0.5 },
        { id: 'e2', filename: 'unsupported_format.webp', errorMessage: '非対応のファイル形式です', filepath: 'C:\\...\\unsupported_format.webp', errorType: 'unsupported', size: 1.2 },
        { id: 'e3', filename: 'access_denied.png', errorMessage: 'アクセス権がありません', filepath: 'C:\\...\\access_denied.png', errorType: 'access_denied', size: 0.1 },
    ];

    function displayPreview(item, type) {
        previewImage1.classList.add('hidden');
        previewImage2.classList.add('hidden');
        previewPlaceholderText.classList.add('hidden');
        infoBlurScoreContainer.classList.add('hidden');
        infoSimilarityContainer.classList.add('hidden');
        previewImage1.src = 'https://placehold.co/1x1/transparent/transparent';
        previewImage2.src = 'https://placehold.co/1x1/transparent/transparent';
        previewImage1.style.transform = 'scale(1)';
        previewImage2.style.transform = 'scale(1)';
        updateZoom(100);


        if (!item) {
            previewPlaceholderText.textContent = '画像を選択するとここにプレビューが表示されます';
            previewPlaceholderText.classList.remove('hidden');
            infoFilename.textContent = '-';
            infoFilepath.textContent = '-';
            infoResolution.textContent = '-';
            infoFilesize.textContent = '-';
            infoDatetime.textContent = '-';
            return;
        }

        if (type === 'blurry') {
            previewImage1.src = `https://placehold.co/400x300/e2e8f0/94a3b8?text=${item.filename.substring(0,20)}`;
            previewImage1.classList.remove('hidden');
            previewPlaceholderText.classList.add('hidden');

            infoFilename.textContent = item.filename;
            infoFilepath.textContent = item.path;
            infoFilepath.title = item.path;
            infoResolution.textContent = item.resolution;
            infoFilesize.textContent = `${item.size} MB`;
            infoDatetime.textContent = item.takenDate;
            infoBlurScore.textContent = item.blurScore;
            infoBlurScoreContainer.classList.remove('hidden');
        } else if (type === 'similar') {
            previewImage1.src = `https://placehold.co/300x200/e2e8f0/94a3b8?text=${item.filename1.substring(0,15)}`;
            previewImage2.src = `https://placehold.co/300x200/e2e8f0/94a3b8?text=${item.filename2.substring(0,15)}`;
            previewImage1.classList.remove('hidden');
            previewImage2.classList.remove('hidden');
            previewPlaceholderText.classList.add('hidden');

            infoFilename.textContent = `${item.filename1} vs ${item.filename2}`;
            infoFilepath.textContent = `(左) ${item.path1} (右) ${item.path2}`;
            infoResolution.textContent = `(左) ${item.resolution1} (右) ${item.resolution2}`;
            infoSimilarity.textContent = `${item.similarity}%`;
            infoSimilarityContainer.classList.remove('hidden');
            infoFilesize.textContent = `(左) ${item.size1 || '-'}MB (右) ${item.size2 || '-'}MB`;
            infoDatetime.textContent = '-';
        } else if (type === 'error') {
            previewPlaceholderText.textContent = `エラー: ${item.errorMessage}`;
            previewPlaceholderText.classList.remove('hidden');
            infoFilename.textContent = item.filename;
            infoFilepath.textContent = item.filepath;
            infoFilepath.title = item.filepath;
            infoResolution.textContent = '-';
            infoFilesize.textContent = item.size ? `${item.size} MB` : '-';
            infoDatetime.textContent = '-';
        }
    }


    function populateBlurryTable(images) {
        blurryTbody.innerHTML = '';
        images.forEach(item => {
            const row = blurryTbody.insertRow();
            row.className = 'hover:bg-slate-50 cursor-pointer';
            row.dataset.id = item.id;
            row.dataset.sizeMb = item.size;

            row.insertCell().innerHTML = `<input type="checkbox" data-id="${item.id}" class="item-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4 ml-3">`;
            row.insertCell().textContent = item.filename;
            row.insertCell().textContent = `${item.size} MB`;
            const modDateCell = row.insertCell();
            modDateCell.textContent = item.modifiedDate;
            modDateCell.className = 'hidden md:table-cell';
            const takenDateCell = row.insertCell();
            takenDateCell.textContent = item.takenDate;
            takenDateCell.className = 'hidden lg:table-cell';
            const resCell = row.insertCell();
            resCell.textContent = item.resolution;
            resCell.className = 'hidden lg:table-cell';
            const scoreCell = row.insertCell();
            scoreCell.textContent = item.blurScore;
            scoreCell.className = `font-medium ${item.blurScore > 90 ? 'text-red-600' : item.blurScore > 70 ? 'text-orange-500' : 'text-yellow-500'}`;

            row.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    blurryTbody.querySelectorAll('tr.bg-sky-100').forEach(r => r.classList.remove('bg-sky-100'));
                    row.classList.add('bg-sky-100');
                    displayPreview(item, 'blurry');
                }
            });
            row.querySelector('.item-checkbox').addEventListener('change', updateSelectionInfo);
        });
        document.getElementById('count-blurry').textContent = images.length;
        updateSelectionInfo();
    }

    function populateSimilarTable(imagePairs) {
        similarTbody.innerHTML = '';
        imagePairs.forEach(pair => {
            const row = similarTbody.insertRow();
            row.className = `hover:bg-slate-50 cursor-pointer ${pair.recommended ? 'bg-yellow-50 hover:bg-yellow-100' : ''}`;
            row.dataset.pairId = pair.id;
            row.dataset.size1Mb = pair.size1;
            row.dataset.size2Mb = pair.size2;


            row.insertCell().innerHTML = `<input type="checkbox" data-pair-id="${pair.id}" class="pair-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4 ml-3">`;
            row.insertCell().innerHTML = `<input type="checkbox" data-file-id="${pair.id}-f1" class="file1-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4 ml-3" ${pair.recommended === 'file2' ? 'checked' : ''}>`;
            const fn1Cell = row.insertCell();
            fn1Cell.innerHTML = `${pair.recommended === 'file1' ? '<span title="アプリによる推奨" class="text-amber-500 mr-1">★</span>' : ''}${pair.filename1}`;
            const res1Cell = row.insertCell();
            res1Cell.textContent = pair.resolution1;
            res1Cell.className = 'hidden md:table-cell';
            row.insertCell().innerHTML = `<input type="checkbox" data-file-id="${pair.id}-f2" class="file2-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4 ml-3" ${pair.recommended === 'file1' || !pair.recommended ? 'checked' : ''}>`;
            const fn2Cell = row.insertCell();
            fn2Cell.innerHTML = `${pair.recommended === 'file2' ? '<span title="アプリによる推奨" class="text-amber-500 mr-1">★</span>' : ''}${pair.filename2}`;
            const res2Cell = row.insertCell();
            res2Cell.textContent = pair.resolution2;
            res2Cell.className = 'hidden md:table-cell';
            const simCell = row.insertCell();
            simCell.textContent = `${pair.similarity}%`;
            simCell.className = `font-medium ${pair.similarity > 95 ? 'text-green-700' : pair.similarity > 85 ? 'text-green-600' : 'text-green-500'}`;

            row.addEventListener('click', (e) => {
                 if (e.target.type !== 'checkbox') {
                    similarTbody.querySelectorAll('tr.bg-sky-100').forEach(r => r.classList.remove('bg-sky-100'));
                    row.classList.add('bg-sky-100');
                    displayPreview(pair, 'similar');
                }
            });
            row.querySelectorAll('.pair-checkbox, .file1-checkbox, .file2-checkbox').forEach(cb => {
                cb.addEventListener('change', updateSelectionInfo);
            });
        });
        document.getElementById('count-similar').textContent = imagePairs.length;
        updateSelectionInfo();
    }

    function populateErrorTable(errors) {
        errorTbody.innerHTML = '';
        errors.forEach(error => {
            const row = errorTbody.insertRow();
            row.className = 'hover:bg-slate-50 cursor-pointer';
            row.dataset.id = error.id;
            row.dataset.sizeMb = error.size || 0;


            row.insertCell().innerHTML = `<input type="checkbox" data-id="${error.id}" class="item-checkbox rounded border-slate-300 text-blue-600 shadow-sm h-4 w-4 ml-3">`;
            row.insertCell().textContent = error.filename;
            const errorMsgCell = row.insertCell();
            errorMsgCell.textContent = error.errorMessage;
            errorMsgCell.className = error.errorType === 'corrupted' || error.errorType === 'access_denied' ? 'text-red-600' : 'text-orange-600';
            const pathCell = row.insertCell();
            pathCell.textContent = error.filepath;
            pathCell.className = 'truncate max-w-xs';
            pathCell.title = error.filepath;

            row.addEventListener('click', (e) => {
                 if (e.target.type !== 'checkbox') {
                    errorTbody.querySelectorAll('tr.bg-sky-100').forEach(r => r.classList.remove('bg-sky-100'));
                    row.classList.add('bg-sky-100');
                    displayPreview(error, 'error');
                }
            });
            row.querySelector('.item-checkbox').addEventListener('change', updateSelectionInfo);
        });
        document.getElementById('count-errors').textContent = errors.length;
        updateSelectionInfo();
    }

    switchTab('blurry');

    document.querySelectorAll('#center-pane thead th[data-sort-key]').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sortKey;
            const currentSortDir = th.dataset.sortDir || 'none';
            let nextSortDir;

            document.querySelectorAll('#center-pane thead th[data-sort-key]').forEach(otherTh => {
                if (otherTh !== th) {
                    otherTh.dataset.sortDir = 'none';
                    otherTh.querySelector('.sort-indicator').textContent = '';
                }
            });

            if (currentSortDir === 'asc') {
                nextSortDir = 'desc';
                th.querySelector('.sort-indicator').textContent = '▼';
            } else {
                nextSortDir = 'asc';
                th.querySelector('.sort-indicator').textContent = '▲';
            }
            th.dataset.sortDir = nextSortDir;

            console.log(`Sorting by ${sortKey} in ${nextSortDir} order for tab ${currentTab}`);
        });
    });

    updateSelectionInfo();
    updateZoom(100);
    displayPreview(null, null);
});
