// 画像整理アプリ レンダラープロセスメインスクリプト

import { FileUtils } from './utils/FileUtils.js';
import { UIUtils } from './utils/UIUtils.js';
import { LogUtils } from './utils/LogUtils.js';
import { TabManager } from './components/TabManager.js';
import { FileOperationManager } from './components/FileOperationManager.js';

// 文字化け対策
function safeConsoleLog(...args) {
    try {
        const message = args.join(' ');
        // ファイルログに出力（メインプロセスに委譲）
        if (window.electronAPI && window.electronAPI.writeToLog) {
            window.electronAPI.writeToLog(`LOG: ${message}`);
        }
        // コンソールにデバッグ情報を出力
        console.log(...args);
    } catch (error) {
        // エラーを無視
    }
}

function safeConsoleError(...args) {
    try {
        const message = args.join(' ');
        // ファイルログに出力（メインプロセスに委譲）
        if (window.electronAPI && window.electronAPI.writeToLog) {
            window.electronAPI.writeToLog(`ERROR: ${message}`);
        }
        // コンソールには最小限の情報のみ出力
        console.log('Error occurred. Check log file.');
    } catch (error) {
        // エラーを無視
    }
}

function safeConsoleWarn(...args) {
    try {
        const message = args.join(' ');
        // ファイルログに出力（メインプロセスに委譲）
        if (window.electronAPI && window.electronAPI.writeToLog) {
            window.electronAPI.writeToLog(`WARN: ${message}`);
        }
        // コンソールには最小限の情報のみ出力
        console.log('Warning occurred. Check log file.');
    } catch (error) {
        // エラーを無視
    }
}

// パス操作のためのユーティリティ関数（後方互換性のため残す）
function pathBasename(filePath) {
    return FileUtils.getBasename(filePath);
}

// 仮想スクロールテーブルクラス
class VirtualTable {
    constructor(container, options = {}) {
        this.container = container;
        this.rowHeight = options.rowHeight || 60;
        this.visibleRows = options.visibleRows || 15;
        this.bufferRows = options.bufferRows || 5;
        this.data = [];
        this.currentScrollTop = 0;
        this.isInitialized = false;
        
        // チェックボックスの状態を保持するためのマップ
        this.checkboxStates = new Map();
        
        this.init();
    }
    
    init() {
        // コンテナのスタイルを設定
        this.container.style.position = 'relative';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        
        // 仮想スクロール用の要素を作成
        this.createVirtualElements();
        
        // スクロールイベントリスナーを設定
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        
        this.isInitialized = true;
    }
    
    createVirtualElements() {
        // 全体の高さを保持する要素
        this.spacer = document.createElement('div');
        this.spacer.style.position = 'absolute';
        this.spacer.style.top = '0';
        this.spacer.style.left = '0';
        this.spacer.style.right = '0';
        this.spacer.style.pointerEvents = 'none';
        this.container.appendChild(this.spacer);
        
        // ヘッダーを作成
        this.createHeader();
        
        // コンテナ自体にスクロールを設定
        this.container.style.overflow = 'auto';
        this.container.style.flex = '1';
        
        // 実際に表示される行を格納する要素
        this.content = document.createElement('div');
        this.content.style.position = 'absolute';
        this.content.style.top = '0';
        this.content.style.left = '0';
        this.content.style.right = '0';
        this.container.appendChild(this.content);
        
        // スクロールイベントリスナーをコンテナに設定
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        
        // ヘッダーの高さを取得してコンテンツの位置を調整
        this.headerHeight = this.header.offsetHeight;
        this.content.style.top = `${this.headerHeight}px`;
    }
    
    createHeader() {
        this.header = document.createElement('div');
        this.header.className = 'bg-slate-100 border-b border-slate-300 px-4 py-2 font-medium text-sm flex items-center';
        this.header.innerHTML = `
            <div class="flex-1 px-3">画像1</div>
            <div class="flex-1 px-3">画像2</div>
            <div class="w-20 px-2 text-center">類似度</div>
        `;
        
        this.container.appendChild(this.header);
    }
    
    setData(data) {
        this.data = data;
        // 新しいデータが設定された時にチェックボックスの状態をクリア
        this.clearCheckboxStates();
        this.sortData();
        this.updateSpacerHeight();
        this.render();
    }
    
    sortData() {
        // サブクラスでオーバーライドされる
        // デフォルトではソートしない
    }
    
    updateSpacerHeight() {
        const totalHeight = this.data.length * this.rowHeight;
        this.spacer.style.height = `${totalHeight}px`;
    }
    
    handleScroll() {
        if (!this.isInitialized) return;
        
        this.currentScrollTop = this.container.scrollTop;
        this.render();
    }
    
    render() {
        if (!this.isInitialized) return;
        
        safeConsoleLog('VirtualTable render called, data length:', this.data.length);
        
        if (this.data.length === 0) {
            // データが0件の場合は空のメッセージを表示
            this.content.innerHTML = '<div class="text-center text-slate-500 py-8">データがありません</div>';
            safeConsoleLog('Rendered empty message');
            return;
        }
        
        const startIndex = Math.floor(this.currentScrollTop / this.rowHeight);
        const endIndex = Math.min(
            startIndex + this.visibleRows + this.bufferRows * 2,
            this.data.length
        );
        
        // 表示範囲のデータを取得
        const visibleData = this.data.slice(startIndex, endIndex);
        
        safeConsoleLog('Rendering visible data:', visibleData.length, 'items from', startIndex, 'to', endIndex);
        
        // オフセットを計算（ヘッダーの高さを考慮）
        const offsetY = startIndex * this.rowHeight;
        
        // コンテンツの位置と高さを更新
        this.content.style.transform = `translateY(${offsetY}px)`;
        this.content.style.height = `${visibleData.length * this.rowHeight}px`;
        
        // 行をレンダリング
        this.renderRows(visibleData, startIndex);
    }
    
    renderRows(visibleData, startIndex) {
        // 既存の行をクリア
        this.content.innerHTML = '';
        
        safeConsoleLog('Rendering rows for visible data:', visibleData.length, 'items');
        
        // 新しい行を作成
        visibleData.forEach((item, index) => {
            try {
                const row = this.createRow(item, startIndex + index);
                this.content.appendChild(row);
            } catch (error) {
                safeConsoleError('Error creating row:', error, 'Item:', item, 'Index:', startIndex + index);
                const errorRow = document.createElement('div');
                errorRow.className = 'flex items-center border-b border-red-200 bg-red-50';
                errorRow.style.height = `${this.rowHeight}px`;
                errorRow.innerHTML = `
                    <div class="flex-1 px-4 py-2 text-red-600 text-sm">
                        <div class="font-medium">Error creating row ${startIndex + index}</div>
                        <div class="text-xs">${error.message}</div>
                    </div>
                `;
                this.content.appendChild(errorRow);
            }
        });
        
        safeConsoleLog('Finished rendering rows');
    }
    
    createRow(item, index) {
        // サブクラスでオーバーライドされる
        const row = document.createElement('div');
        row.style.height = `${this.rowHeight}px`;
        row.style.borderBottom = '1px solid #e2e8f0';
        row.textContent = `Row ${index}: ${JSON.stringify(item)}`;
        return row;
    }
    
    // チェックボックスの状態を保存
    saveCheckboxState(identifier, checked) {
        this.checkboxStates.set(identifier, checked);
    }
    
    // チェックボックスの状態を取得
    getCheckboxState(identifier) {
        return this.checkboxStates.get(identifier) || false;
    }
    
    // チェックボックスの状態をクリア
    clearCheckboxStates() {
        this.checkboxStates.clear();
    }
    
    scrollToIndex(index) {
        if (index >= 0 && index < this.data.length) {
            const scrollTop = index * this.rowHeight;
            this.container.scrollTop = scrollTop;
        }
    }
    
    destroy() {
        if (this.container) {
            this.container.removeEventListener('scroll', this.handleScroll.bind(this));
        }
        this.isInitialized = false;
    }
}

// ブレ画像用仮想テーブル
class BlurVirtualTable extends VirtualTable {
    constructor(container, app) {
        super(container, { rowHeight: 60, visibleRows: 20 });
        this.app = app;
    }
    
    sortData() {
        // ブレスコアの降順でソート
        this.data.sort((a, b) => b.blurScore - a.blurScore);
    }
    
    createHeader() {
        this.header = document.createElement('div');
        this.header.className = 'bg-slate-100 border-b border-slate-300 px-4 py-2 font-medium text-sm flex items-center';
        this.header.innerHTML = `
            <div class="flex-1 px-3">画像1</div>
            <div class="flex-1 px-3">画像2</div>
            <div class="w-20 px-2 text-center">類似度</div>
        `;
        
        this.container.appendChild(this.header);
    }
    
    createRow(image, index) {
        const row = document.createElement('div');
        row.className = 'flex items-center hover:bg-slate-50 cursor-pointer border-b border-slate-200';
        row.style.height = `${this.rowHeight}px`;
        row.dataset.index = index;
        row.dataset.filepath = image.filePath;
        
        row.innerHTML = `
            <div class="flex-1 flex items-center px-4 py-2">
                <input type="checkbox" class="blur-checkbox mr-3" data-filepath="${image.filePath}">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">${image.filename}</div>
                    <div class="text-xs text-slate-500">${this.app.getDisplayPath(image.filePath)}</div>
                </div>
            </div>
            <div class="w-20 px-2 py-2 text-sm text-slate-600">${this.app.formatFileSize(image.size)}</div>
            <div class="w-32 px-2 py-2 text-sm text-slate-600">${this.app.formatDate(image.modifiedDate)}</div>
            <div class="w-28 px-2 py-2">
                <span class="px-2 py-1 rounded text-sm ${image.blurScore > 80 ? 'bg-red-100 text-red-800' : image.blurScore > 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                    ${image.blurScore}
                </span>
            </div>
        `;
        
        // チェックボックスの状態を復元
        const checkbox = row.querySelector('.blur-checkbox');
        const savedState = this.getCheckboxState(image.filePath);
        checkbox.checked = savedState;
        
        // イベントリスナーを設定
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            // チェックボックスの状態を保存
            this.saveCheckboxState(image.filePath, e.target.checked);
            this.app.handleCheckboxChange(checkbox, 'blur');
        });
        
        row.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'input') return;
            this.app.showImagePreview(image);
        });
        
        return row;
    }
}

// 類似画像用仮想テーブル
class SimilarVirtualTable extends VirtualTable {
    constructor(container, app) {
        super(container, { rowHeight: 80, visibleRows: 15 });
        this.app = app;
    }
    
    sortData() {
        // 類似度の降順でソート
        this.data.sort((a, b) => b.similarity - a.similarity);
    }
    
    createHeader() {
        this.header = document.createElement('div');
        this.header.className = 'bg-slate-100 border-b border-slate-300 px-4 py-2 font-medium text-sm flex items-center';
        this.header.innerHTML = `
            <div class="flex-1 px-3">画像1</div>
            <div class="flex-1 px-3">画像2</div>
            <div class="w-20 px-2 text-center">類似度</div>
        `;
        
        this.container.appendChild(this.header);
    }
    
    createRow(group, index) {
        try {
            safeConsoleLog('Creating row for group:', group);
            
            // データ構造の検証
            if (!group.files || !Array.isArray(group.files) || group.files.length < 2) {
                safeConsoleError('Invalid group structure:', group);
                return this.createErrorRow(`Invalid data structure: ${JSON.stringify(group)}`, index);
            }
            
            const file1 = group.files[0];
            const file2 = group.files[1];
            
            if (!file1 || !file2) {
                safeConsoleError('Missing file data:', { file1, file2 });
                return this.createErrorRow('Missing file data', index);
            }
            
            const pairKey = `${file1.filePath}|${file2.filePath}`;
            
            const row = document.createElement('div');
            row.className = 'flex items-center hover:bg-slate-50 cursor-pointer border-b border-slate-200';
            row.style.height = `${this.rowHeight}px`;
            row.dataset.index = index;
            row.dataset.pairKey = pairKey;
            row.dataset.similarity = group.similarity;
            
            // 類似度に基づく背景色
            if (group.similarity >= 90) {
                row.classList.add('bg-red-50');
            } else if (group.similarity >= 80) {
                row.classList.add('bg-yellow-50');
            } else {
                row.classList.add('bg-blue-50');
            }
            
            row.innerHTML = `
                <div class="flex-1 px-3 py-2">
                    <div class="flex items-center space-x-2">
                        <input type="checkbox" class="individual-checkbox" data-filepath="${file1.filePath}" data-pair="${pairKey}">
                        <div class="w-12 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                            <img src="file://${file1.filePath}" alt="${file1.filename}" 
                                 class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="w-full h-full flex items-center justify-center text-xs text-slate-500" style="display:none;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate" title="${file1.filename}">${file1.filename}</div>
                            <div class="text-xs text-slate-500">${this.app.formatFileSize(file1.size)}</div>
                        </div>
                    </div>
                </div>
                <div class="flex-1 px-3 py-2">
                    <div class="flex items-center space-x-2">
                        <input type="checkbox" class="individual-checkbox" data-filepath="${file2.filePath}" data-pair="${pairKey}">
                        <div class="w-12 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                            <img src="file://${file2.filePath}" alt="${file2.filename}" 
                                 class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="w-full h-full flex items-center justify-center text-xs text-slate-500" style="display:none;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate" title="${file2.filename}">${file2.filename}</div>
                            <div class="text-xs text-slate-500">${this.app.formatFileSize(file2.size)}</div>
                        </div>
                    </div>
                </div>
                <div class="w-20 px-2 py-2 text-center">
                    <span class="px-2 py-1 rounded text-sm font-semibold ${group.similarity >= 90 ? 'bg-red-100 text-red-800' : group.similarity >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}">
                        ${group.similarity}%
                    </span>
                </div>
            `;
            
            // イベントリスナーを設定
            this.setupRowEventListeners(row, file1, file2, group.similarity, pairKey);
            
            return row;
        } catch (error) {
            safeConsoleError('Error creating similar row:', error, 'Group:', group);
            return this.createErrorRow(`Error: ${error.message}`, index);
        }
    }
    
    createErrorRow(message, index) {
        const row = document.createElement('div');
        row.className = 'flex items-center border-b border-red-200 bg-red-50';
        row.style.height = `${this.rowHeight}px`;
        row.innerHTML = `
            <div class="flex-1 px-4 py-2 text-red-600 text-sm">
                <div class="font-medium">Error at index ${index}</div>
                <div class="text-xs">${message}</div>
            </div>
        `;
        return row;
    }
    
    setupRowEventListeners(row, file1, file2, similarity, pairKey) {
        // 個別チェックボックスイベント
        const individualCheckboxes = row.querySelectorAll('.individual-checkbox');
        individualCheckboxes.forEach(checkbox => {
            // 個別チェックボックスの状態を復元
            const filePath = checkbox.dataset.filepath;
            const savedIndividualState = this.getCheckboxState(`individual_${filePath}`);
            checkbox.checked = savedIndividualState;
            
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                
                safeConsoleLog('Individual checkbox changed:', filePath, 'checked:', e.target.checked);
                
                if (checkbox.checked) {
                    this.app.selectedIndividualFiles.add(filePath);
                    safeConsoleLog('Added to selectedIndividualFiles:', filePath);
                } else {
                    this.app.selectedIndividualFiles.delete(filePath);
                    safeConsoleLog('Removed from selectedIndividualFiles:', filePath);
                }
                
                safeConsoleLog('selectedIndividualFiles size:', this.app.selectedIndividualFiles.size);
                
                // 個別チェックボックスの状態を保存
                this.saveCheckboxState(`individual_${filePath}`, e.target.checked);
                
                this.app.updatePairSelectionState(pairKey);
                this.app.updateSelectedCount();
                this.app.updateActionButtons();
                
                safeConsoleLog('updateActionButtons called after individual checkbox change');
            });
        });
        
        // 画像クリックイベント
        const images = row.querySelectorAll('img');
        images.forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.showSimilarImagePreview(file1, file2, similarity);
            });
        });
        
        // 行クリックイベント
        row.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'input') return;
            
            // プレビュー表示のみ（チェックボックスは自動選択しない）
            this.app.showSimilarImagePreview(file1, file2, similarity);
        });
    }
}

// エラー用仮想テーブル
class ErrorVirtualTable extends VirtualTable {
    constructor(container, app) {
        super(container, { rowHeight: 50, visibleRows: 25 });
        this.app = app;
    }
    
    createHeader() {
        this.header = document.createElement('div');
        this.header.className = 'bg-slate-100 border-b border-slate-300 px-4 py-2 font-medium text-sm flex items-center';
        this.header.innerHTML = `
            <div class="flex-1 flex items-center">
                <input type="checkbox" id="selectAllError" class="mr-3">
                <span>ファイル名</span>
            </div>
            <div class="flex-1 px-4">エラー詳細</div>
        `;
        
        // 全選択チェックボックスのイベントリスナー
        const selectAllCheckbox = this.header.querySelector('#selectAllError');
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = this.content.querySelectorAll('.error-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                // チェックボックスの状態を保存
                this.saveCheckboxState(checkbox.dataset.filepath, e.target.checked);
                this.app.handleCheckboxChange(checkbox, 'error');
            });
        });
        
        this.container.appendChild(this.header);
    }
    
    createRow(error, index) {
        const row = document.createElement('div');
        row.className = 'flex items-center hover:bg-slate-50 border-b border-slate-200';
        row.style.height = `${this.rowHeight}px`;
        row.dataset.index = index;
        row.dataset.filepath = error.filePath;
        
        row.innerHTML = `
            <div class="flex-1 flex items-center px-4 py-2">
                <input type="checkbox" class="error-checkbox mr-3" data-filepath="${error.filePath}">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">${error.filename}</div>
                    <div class="text-xs text-slate-500">${this.app.getDisplayPath(error.filePath)}</div>
                </div>
            </div>
            <div class="flex-1 px-4 py-2 text-red-600 text-sm">${error.error}</div>
        `;
        
        // チェックボックスの状態を復元
        const checkbox = row.querySelector('.error-checkbox');
        const savedState = this.getCheckboxState(error.filePath);
        checkbox.checked = savedState;
        
        // イベントリスナーを設定
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            // チェックボックスの状態を保存
            this.saveCheckboxState(error.filePath, e.target.checked);
            this.app.handleCheckboxChange(checkbox, 'error');
        });
        
        return row;
    }
}

// バッチ処理マネージャークラス
class BatchProcessor {
    constructor() {
        this.isProcessing = false;
        this.isPaused = false;
        this.currentBatch = [];
        this.processedCount = 0;
        this.totalCount = 0;
        this.successCount = 0;
        this.errorCount = 0;
        this.currentOperation = null;
        this.batchSize = 10; // 一度に処理するファイル数
        this.delayBetweenBatches = 100; // バッチ間の遅延（ms）
        this.progressCallback = null;
        this.completeCallback = null;
        this.errorCallback = null;
        this.operationHistory = [];
    }

    // バッチ処理の開始
    async startBatchOperation(operation, items, options = {}) {
        if (this.isProcessing) {
            throw new Error('既にバッチ処理が実行中です');
        }

        this.isProcessing = true;
        this.isPaused = false;
        this.currentOperation = operation;
        this.currentBatch = [...items];
        this.processedCount = 0;
        this.totalCount = items.length;
        this.successCount = 0;
        this.errorCount = 0;
        this.batchSize = options.batchSize || 10;
        this.delayBetweenBatches = options.delay || 100;

        safeConsoleLog(`Batch processing started: ${operation} - ${this.totalCount} items`);

        try {
            await this.processBatches();
        } catch (error) {
            safeConsoleError('Batch processing error:', error);
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        } finally {
            this.isProcessing = false;
            this.isPaused = false;
        }
    }

    // バッチ単位での処理
    async processBatches() {
        while (this.currentBatch.length > 0 && !this.isPaused) {
            const batch = this.currentBatch.splice(0, this.batchSize);
            
            safeConsoleLog(`Processing batch: ${batch.length} items (remaining: ${this.currentBatch.length} items)`);
            
            // バッチ内の各アイテムを処理
            for (const item of batch) {
                if (this.isPaused) break;
                
                try {
                    await this.processItem(item);
                    this.successCount++;
                } catch (error) {
                    safeConsoleError(`Item processing error:`, error);
                    this.errorCount++;
                    this.operationHistory.push({
                        item: item,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
                
                this.processedCount++;
                
                // 進捗コールバック
                if (this.progressCallback) {
                    this.progressCallback({
                        processed: this.processedCount,
                        total: this.totalCount,
                        success: this.successCount,
                        error: this.errorCount,
                        progress: (this.processedCount / this.totalCount) * 100
                    });
                }
            }
            
            // バッチ間の遅延
            if (this.currentBatch.length > 0 && !this.isPaused) {
                await this.delay(this.delayBetweenBatches);
            }
        }
        
        // 処理完了
        if (!this.isPaused) {
            safeConsoleLog(`Batch processing completed: ${this.successCount} successful, ${this.errorCount} errors`);
            if (this.completeCallback) {
                this.completeCallback({
                    total: this.totalCount,
                    success: this.successCount,
                    error: this.errorCount,
                    history: this.operationHistory
                });
            }
        }
    }

    // 個別アイテムの処理
    async processItem(item) {
        switch (this.currentOperation) {
            case 'delete':
                return await this.deleteFile(item);
            case 'move':
                return await this.moveFile(item);
            case 'copy':
                return await this.copyFile(item);
            default:
                throw new Error(`未対応の操作: ${this.currentOperation}`);
        }
    }

    // ファイル削除
    async deleteFile(item) {
        return await window.electronAPI.deleteFile(item.filePath);
    }

    // ファイル移動
    async moveFile(item) {
        const destination = await this.getDestinationPath(item);
        return await window.electronAPI.moveFile(item.filePath, destination);
    }

    // ファイルコピー
    async copyFile(item) {
        const destination = await this.getDestinationPath(item);
        return await window.electronAPI.copyFile(item.filePath, destination);
    }

    // 移動先パスの取得
    async getDestinationPath(item) {
        // 設定から出力フォルダを取得
        const settings = window.imageCleanupApp && window.imageCleanupApp.getSettings ? window.imageCleanupApp.getSettings() : null;
        let outputFolder = '';
        if (settings && settings.defaultOutputFolder) {
            outputFolder = settings.defaultOutputFolder;
        }
        
        if (!outputFolder) {
            throw new Error('移動先フォルダが設定されていません。設定画面で移動先フォルダを設定してください。');
        }
        
        const filename = item.filename || item.filePath.split(/[\\/]/).pop();
        return `${outputFolder}/${filename}`;
    }

    // 処理の一時停止
    pause() {
        this.isPaused = true;
        safeConsoleLog('Batch processing paused');
    }

    // 処理の再開
    resume() {
        if (this.isProcessing && this.isPaused) {
            this.isPaused = false;
            safeConsoleLog('Batch processing resumed');
            this.processBatches();
        }
    }

    // 処理の停止
    stop() {
        this.isProcessing = false;
        this.isPaused = false;
        this.currentBatch = [];
        safeConsoleLog('Batch processing stopped');
    }

    // 遅延関数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 操作履歴の取得
    getOperationHistory() {
        return this.operationHistory;
    }

    // 操作履歴のクリア
    clearOperationHistory() {
        this.operationHistory = [];
    }
}

// メインアプリケーションクラス
class ImageCleanupApp {
    constructor() {
        // 基本設定
        this.targetFolder = null;
        this.outputFolder = null;
        this.scanInProgress = false;
        this.currentTab = 'blur';
        
        // スキャン結果
        this.scanResults = {
            blurImages: [],
            similarImages: [],
            errors: []
        };
        
        // 選択状態管理
        this.selectedFiles = new Set();
        this.selectedSimilarPairs = new Set();
        this.selectedIndividualFiles = new Set(); // 個別ファイル選択用
        this.selectedErrors = new Set();
        
        // バッチ処理
        this.batchProcessor = new BatchProcessor();
        
        // 仮想テーブルのインスタンス
        this.virtualTables = {
            blur: null,
            similar: null,
            error: null
        };
        
        // プレビュー状態管理
        this.currentPreviewIndex = -1; // 現在プレビュー中の画像のインデックス
        this.currentPreviewData = []; // 現在のタブの画像データ
        this.previewMode = 'single'; // 'single' または 'similar'
        
        // マネージャークラスの初期化
        this.tabManager = new TabManager(this);
        this.fileOperationManager = new FileOperationManager(this);
        
        // イベントリスナーの初期化
        this.initializeEventListeners();
        
        // その他の初期化
        this.initializeFilterEvents();
        this.initializeKeyboardShortcuts();
        this.initializeBatchEventListeners();
        this.initializeAdvancedFiltering();
        
        // 設定の読み込み
        this.getSettings();
        
        // ガイダンスの表示
        this.showGuidanceIfNeeded();
        
        // パフォーマンス監視の開始
        this.startPerformanceMonitoring();
        
        // メモリクリーンアップの開始
        this.startMemoryCleanup();
        
        LogUtils.log('ImageCleanupApp initialized');
    }

    init() {
        safeConsoleLog('ImageCleanupApp initialization started');
        
        // 初期レイアウトの設定（デフォルトはブレタブ）
        this.switchLayout('blur');
        
        safeConsoleLog('ImageCleanupApp initialization completed');
    }

    // 仮想テーブルの初期化
    initializeVirtualTable(tabName) {
        safeConsoleLog('initializeVirtualTable called for tab:', tabName);
        
        const container = document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        if (!container) {
            safeConsoleError(`Container not found for tab: ${tabName}`);
            return;
        }
        
        safeConsoleLog('Container found:', container);
        
        // 既存の仮想テーブルを破棄
        if (this.virtualTables[tabName]) {
            safeConsoleLog('Destroying existing virtual table for tab:', tabName);
            this.virtualTables[tabName].destroy();
        }
        
        // コンテナの既存コンテンツをクリア
        container.innerHTML = '';
        
        // 新しい仮想テーブルを作成
        switch (tabName) {
            case 'blur':
                this.virtualTables[tabName] = new BlurVirtualTable(container, this);
                break;
            case 'similar':
                this.virtualTables[tabName] = new SimilarVirtualTable(container, this);
                break;
            case 'error':
                this.virtualTables[tabName] = new ErrorVirtualTable(container, this);
                break;
        }
        
        safeConsoleLog(`Virtual table initialized for tab: ${tabName}`, this.virtualTables[tabName]);
    }

    // 仮想テーブルにデータを設定
    setVirtualTableData(tabName, data) {
        safeConsoleLog('setVirtualTableData called:', tabName, 'data length:', data.length);
        safeConsoleLog('virtualTables:', this.virtualTables);
        
        if (this.virtualTables[tabName]) {
            safeConsoleLog('Setting data for virtual table:', tabName);
            this.virtualTables[tabName].setData(data);
            safeConsoleLog(`Data set for virtual table ${tabName}: ${data.length} items`);
        } else {
            safeConsoleError('Virtual table not found for tab:', tabName);
        }
    }

    // 仮想テーブルの全選択機能
    selectAllVirtualTable(tabName) {
        if (this.virtualTables[tabName]) {
            if (tabName === 'similar') {
                // 類似画像タブでは個別チェックボックスのみを対象
                const checkboxes = this.virtualTables[tabName].content.querySelectorAll('.individual-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                    const filePath = checkbox.dataset.filepath;
                    this.virtualTables[tabName].saveCheckboxState(`individual_${filePath}`, true);
                    this.selectedIndividualFiles.add(filePath);
                });
                this.updateSelectedCount();
                this.updateActionButtons();
            } else {
                // 他のタブでは従来通り
                const checkboxes = this.virtualTables[tabName].content.querySelectorAll(`.${tabName}-checkbox`);
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                    this.virtualTables[tabName].saveCheckboxState(checkbox.dataset.filepath, true);
                    this.handleCheckboxChange(checkbox, tabName);
                });
            }
        }
    }

    // 仮想テーブルの全選択解除機能
    deselectAllVirtualTable(tabName) {
        if (this.virtualTables[tabName]) {
            if (tabName === 'similar') {
                // 類似画像タブでは個別チェックボックスのみを対象
                const checkboxes = this.virtualTables[tabName].content.querySelectorAll('.individual-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                    const filePath = checkbox.dataset.filepath;
                    this.virtualTables[tabName].saveCheckboxState(`individual_${filePath}`, false);
                    this.selectedIndividualFiles.delete(filePath);
                });
                this.updateSelectedCount();
                this.updateActionButtons();
            } else {
                // 他のタブでは従来通り
                const checkboxes = this.virtualTables[tabName].content.querySelectorAll(`.${tabName}-checkbox`);
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                    this.virtualTables[tabName].saveCheckboxState(checkbox.dataset.filepath, false);
                    this.handleCheckboxChange(checkbox, tabName);
                });
            }
        }
    }

    getSettings() {
        return window.settingsManager ? window.settingsManager.getSettings() : null;
    }

    // 基本的なイベントリスナーの初期化
    initializeEventListeners() {
        // フォルダ選択ボタン
        const targetFolderBtn = document.getElementById('targetFolder');
        if (targetFolderBtn) {
            targetFolderBtn.addEventListener('click', () => this.selectTargetFolder());
        }
        
        // スキャンボタン
        const scanButton = document.getElementById('scanButton');
        if (scanButton) {
            scanButton.addEventListener('click', () => this.startScan());
        }
        
        // タブ切り替え
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                safeConsoleLog('Tab button clicked:', e.target);
                
                // クリックされた要素またはその親要素からtabNameを取得
                let target = e.target;
                let tabName = null;
                
                // クリックされた要素またはその親要素からdata-tab属性を探す
                while (target && target !== document.body) {
                    if (target.dataset && target.dataset.tab) {
                        tabName = target.dataset.tab;
                        break;
                    }
                    target = target.parentElement;
                }
                
                safeConsoleLog('Found tabName:', tabName);
                
                if (tabName) {
                    safeConsoleLog('Calling switchTab with:', tabName);
                    this.switchTab(tabName);
                } else {
                    safeConsoleError('Tab name not found in clicked element');
                }
            });
        });
        
        // 選択操作ボタン
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAll());
        }
        const deselectAllBtn = document.getElementById('deselectAllBtn');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => this.deselectAll());
        }
        
        // ファイル操作ボタン
        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyFiles());
        }
        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deletePermanently());
        }
        const moveBtn = document.getElementById('moveBtn');
        if (moveBtn) {
            moveBtn.addEventListener('click', () => this.moveFiles());
        }
        
        // スキャン関連のイベントリスナー
        if (window.electronAPI) {
            // スキャン進捗
            window.electronAPI.onScanProgress((progress) => {
                this.updateScanProgress(progress);
            });
            
            // スキャン完了
            window.electronAPI.onScanComplete((results) => {
                this.handleScanComplete(results);
            });
            
            // スキャンエラー
            window.electronAPI.onScanError((error) => {
                this.handleScanError(error);
            });
        }
    }

    // スキャン関連のメソッド
    async selectTargetFolder() {
        try {
            const folderPath = await window.electronAPI.selectFolder();
            if (folderPath) {
                this.targetFolder = folderPath;
                
                // フォルダパスを表示
                const folderPathElement = document.getElementById('folderPath');
                if (folderPathElement) {
                    folderPathElement.textContent = this.getDisplayPath(folderPath);
                }
                
                safeConsoleLog('対象フォルダが選択されました:', folderPath);
            }
        } catch (error) {
            safeConsoleError('フォルダ選択エラー:', error);
            this.showError('フォルダの選択に失敗しました');
        }
    }

    async selectOutputFolder() {
        try {
            // 設定からデフォルトの移動先フォルダを取得
            const settings = this.getSettings();
            let outputFolder = '';
            if (settings && settings.defaultOutputFolder) {
                outputFolder = settings.defaultOutputFolder;
            }
            
            // 設定に移動先フォルダが設定されていない場合はダイアログを表示
            if (!outputFolder) {
                const folderPath = await window.electronAPI.selectOutputFolder();
                if (folderPath) {
                    return folderPath;
                }
                return null;
            }
            
            return outputFolder;
        } catch (error) {
            safeConsoleError('Output folder selection error:', error);
            this.showError('移動先フォルダの選択に失敗しました');
            return null;
        }
    }

    async startScan() {
        if (!this.targetFolder) {
            this.showError('対象フォルダを選択してください');
            return;
        }

        if (this.scanInProgress) {
            // スキャンキャンセル
            await this.cancelScan();
            return;
        }

        this.scanInProgress = true;
        this.updateScanButton();
        
        // 進捗メッセージを初期化
        const progressMessage = document.getElementById('progressMessage');
        const progressText = document.getElementById('progressText');
        if (progressMessage && progressText) {
            progressText.textContent = 'スキャンを開始しています...';
            progressMessage.style.display = 'block';
        }
        
        try {
            // スキャン結果をクリア
            this.clearResults();
            
            // スキャン開始
            await window.electronAPI.scanImages(this.targetFolder, true);
            
        } catch (error) {
            safeConsoleError('Scan start error:', error);
            this.showError('スキャンの開始に失敗しました');
            this.scanInProgress = false;
            this.updateScanButton();
            
            // 進捗メッセージを非表示
            if (progressMessage) {
                progressMessage.style.display = 'none';
            }
        }
    }

    async cancelScan() {
        try {
            await window.electronAPI.cancelScan();
            this.scanInProgress = false;
            this.updateScanButton();
            
            // 進捗メッセージを非表示
            const progressMessage = document.getElementById('progressMessage');
            if (progressMessage) {
                progressMessage.style.display = 'none';
            }
            
            safeConsoleLog('Scan cancelled');
        } catch (error) {
            safeConsoleError('Scan cancellation error:', error);
        }
    }

    updateScanProgress(progress) {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            const percentage = progress.percentage || Math.round((progress.current / progress.total) * 100);
            progressText.textContent = `スキャン中... ${progress.current}/${progress.total} (${percentage}%) - ${progress.filename || ''}`;
        }
    }

    handleScanComplete(results) {
        safeConsoleLog('Scan completed - Results received:', {
            blurImages: results.blurImages?.length || 0,
            similarImages: results.similarImages?.length || 0,
            errors: results.errors?.length || 0,
            results: results
        });
        
        this.scanInProgress = false;
        this.updateScanButton();
        
        // 進捗メッセージを非表示
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.style.display = 'none';
        }
        
        // スキャン結果を保存
        this.scanResults = {
            blurImages: results.blurImages || [],
            similarImages: results.similarImages || [],
            errors: results.errors || []
        };
        
        // 結果の件数をログ出力
        safeConsoleLog('Scan results received:', {
            blurImages: results.blurImages ? results.blurImages.length : 0,
            similarImages: results.similarImages ? results.similarImages.length : 0,
            errors: results.errors ? results.errors.length : 0
        });
        
        // 現在のタブに応じて結果を表示
        this.displayResultsForCurrentTab();
        
        // 成功メッセージを表示
        const blurCount = results.blurImages ? results.blurImages.length : 0;
        const similarCount = results.similarImages ? results.similarImages.length : 0;
        const errorCount = results.errors ? results.errors.length : 0;
        this.showSuccess(`スキャン完了: ブレ画像${blurCount}件, 類似画像${similarCount}件, エラー${errorCount}件`);
    }
    
    // 現在のタブに応じて結果を表示するメソッド
    displayResultsForCurrentTab() {
        safeConsoleLog('displayResultsForCurrentTab called, currentTab:', this.currentTab);
        safeConsoleLog('scanResults:', this.scanResults);
        
        switch (this.currentTab) {
            case 'blur':
                safeConsoleLog('Displaying blur results for current tab:', this.scanResults.blurImages.length);
                this.displayBlurResults(this.scanResults.blurImages);
                break;
            case 'similar':
                safeConsoleLog('Displaying similar results for current tab:', this.scanResults.similarImages.length);
                this.displaySimilarResults(this.scanResults.similarImages);
                break;
            case 'error':
                safeConsoleLog('Displaying error results for current tab:', this.scanResults.errors.length);
                this.displayErrorResults(this.scanResults.errors);
                break;
        }
    }

    handleScanError(error) {
        safeConsoleError('Scan error:', error);
        
        this.scanInProgress = false;
        this.updateScanButton();
        
        // 進捗メッセージを非表示
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.style.display = 'none';
        }
        
        this.showError('スキャン中にエラーが発生しました');
    }

    switchTab(tabName) {
        this.tabManager.switchTab(tabName);
    }

    // レイアウト切り替え機能
    switchLayout(tabName) {
        const previewPane = document.getElementById('previewPane');
        const resultsPane = document.getElementById('resultsPane');
        
        safeConsoleLog(`Switching layout for tab: ${tabName}`);
        
        // すべてのタブで同じ2ペインレイアウトを使用
        if (previewPane) {
            previewPane.style.display = 'flex';
            safeConsoleLog('Showed preview pane');
        }
        if (resultsPane) {
            resultsPane.style.display = 'flex';
            safeConsoleLog('Showed results pane');
        }
        
        safeConsoleLog('Layout switch completed');
    }

    // プレビューエリアをクリア
    clearPreviewArea() {
        // プレビュー選択状態をクリア
        this.clearPreviewSelection();
        
        // 通常のプレビューエリアをクリア
        const previewContainer = document.getElementById('previewAreaContainer');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 mx-auto mb-2">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    <p>画像を選択して<br>プレビューを表示</p>
                </div>
            `;
        }
        
        // 情報表示エリアをクリア
        this.clearImageInfoAreas();
    }

    // 画像情報表示エリアをクリア
    clearImageInfoAreas() {
        // 通常の情報エリア
        const infoAreas = [
            'infoFileName', 'infoFilePath', 'infoResolution', 
            'infoFileSize', 'infoTakenDate', 'infoBlurScore'
        ];
        infoAreas.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '';
        });
    }

    updateUI() {
        // フォルダパスを表示
        if (this.targetFolder) {
            const folderPathElement = document.getElementById('targetFolderPathDisplay');
            if (folderPathElement) {
                folderPathElement.textContent = FileUtils.getDisplayPath(this.targetFolder);
                folderPathElement.title = this.targetFolder;
            }
        }
        
        this.updateScanButton();
        this.updateSelectedCount();
        this.updateActionButtons();
    }

    updateScanButton() {
        const scanButton = document.getElementById('scanButton');
        if (scanButton) {
            if (this.scanInProgress) {
                scanButton.textContent = 'スキャン停止';
                scanButton.classList.add('bg-red-500', 'hover:bg-red-600');
                scanButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            } else {
                scanButton.textContent = 'スキャン開始';
                scanButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
                scanButton.classList.remove('bg-red-500', 'hover:bg-red-600');
            }
        }
    }

    updateSelectedCount() {
        let count = 0;
        let totalSize = 0;
        
        switch (this.currentTab) {
            case 'blur':
                count = this.selectedFiles.size;
                // 選択されたファイルのサイズを計算
                this.scanResults.blurImages.forEach(image => {
                    if (this.selectedFiles.has(image.filePath)) {
                        totalSize += image.size;
                    }
                });
                break;
            case 'similar':
                count = this.selectedSimilarPairs.size + this.selectedIndividualFiles.size;
                // 選択されたペアと個別ファイルのサイズを計算
                this.scanResults.similarImages.forEach(group => {
                    const pairKey = `${group.files[0].filePath}|${group.files[1].filePath}`;
                    if (this.selectedSimilarPairs.has(pairKey)) {
                        totalSize += group.files[0].size + group.files[1].size;
                    } else {
                        // 個別ファイルの選択をチェック
                        if (this.selectedIndividualFiles.has(group.files[0].filePath)) {
                            totalSize += group.files[0].size;
                        }
                        if (this.selectedIndividualFiles.has(group.files[1].filePath)) {
                            totalSize += group.files[1].size;
                        }
                    }
                });
                break;
            case 'error':
                count = this.selectedErrors.size;
                // エラーファイルのサイズは計算しない（エラーのため）
                break;
        }
        
        // 選択数を表示
        const countElement = document.getElementById('selectedCount');
        const sizeElement = document.getElementById('selectedSize');
        if (countElement) {
            countElement.textContent = `${count}件`;
        }
        if (sizeElement) {
            sizeElement.textContent = this.formatFileSize(totalSize);
        }
    }

    getDisplayPath(path) {
        if (path.length <= 50) {
            return path;
        }
        return '...' + path.substring(path.length - 47);
    }

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleString('ja-JP');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span>${message}</span>
                <button class="ml-2 text-sm" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒後に自動削除
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    // 結果表示メソッド
    displayBlurResults(blurImages) {
        safeConsoleLog('displayBlurResults called with:', blurImages.length, 'images');
        
        // タブのカウント表示を更新
        const countElement = document.getElementById('countBlur');
        if (countElement) {
            countElement.textContent = blurImages.length;
        }
        
        // 仮想テーブルにデータを設定（0件の場合も含む）
        this.setVirtualTableData('blur', blurImages);
        safeConsoleLog('Blur data set to virtual table:', blurImages.length, 'items');
    }

    displaySimilarResults(similarImages) {
        safeConsoleLog('displaySimilarResults called with:', similarImages.length, 'similar images');
        safeConsoleLog('Current tab:', this.currentTab);
        
        // データ構造のデバッグ
        if (similarImages.length > 0) {
            safeConsoleLog('Sample similar image data:', similarImages[0]);
        }
        
        // タブのカウント表示を更新
        const countElement = document.getElementById('countSimilar');
        if (countElement) {
            countElement.textContent = similarImages.length;
            safeConsoleLog('Updated similar count:', similarImages.length);
        }
        
        // 仮想テーブルにデータを設定（0件の場合も含む）
        this.setVirtualTableData('similar', similarImages);
        safeConsoleLog('Similar data set to virtual table:', similarImages.length, 'items');
    }

    displayErrorResults(errors) {
        // タブのカウント表示を更新
        const countElement = document.getElementById('countError');
        if (countElement) {
            countElement.textContent = errors.length;
        }
        
        // 仮想テーブルにデータを設定（0件の場合も含む）
        this.setVirtualTableData('error', errors);
        safeConsoleLog('Error data set to virtual table:', errors.length, 'items');
    }

    clearResults() {
        this.scanResults = {
            blurImages: [],
            similarImages: [],
            errors: []
        };
        this.selectedFiles.clear();
        this.selectedSimilarPairs.clear();
        this.selectedIndividualFiles.clear(); // 個別ファイル選択もクリア
        this.selectedErrors.clear();
        
        // 各タブのコンテンツをクリア
        ['Blur', 'Similar', 'Error'].forEach(tab => {
            const container = document.getElementById(`content${tab}`);
            if (container) {
                container.innerHTML = '<div class="text-center text-slate-500 py-8">スキャンを開始してください</div>';
            }
        });
        
        // タブのカウント表示をリセット
        const countElements = ['countBlur', 'countSimilar', 'countError'];
        countElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '0';
            }
        });
        
        this.updateSelectedCount();
        this.updateActionButtons();
    }

    // 基本的なファイル操作メソッド
    moveToTrash() {
        this.fileOperationManager.performFileOperation('delete');
    }

    deletePermanently() {
        this.fileOperationManager.performFileOperation('delete');
    }

    moveFiles() {
        this.fileOperationManager.performFileOperation('move');
    }

    copyFiles() {
        this.fileOperationManager.performFileOperation('copy');
    }

    async performFileOperation(operation) {
        let filePaths = [];
        let count = 0;
        
        switch (this.currentTab) {
            case 'blur':
                filePaths = Array.from(this.selectedFiles);
                count = filePaths.length;
                break;
            case 'similar':
                // 類似画像の場合は、選択されたペアの両方のファイルを取得
                filePaths = [];
                this.selectedSimilarPairs.forEach(pairValue => {
                    const [file1, file2] = pairValue.split('|');
                    filePaths.push(file1, file2);
                });
                count = this.selectedSimilarPairs.size;
                break;
            case 'error':
                filePaths = Array.from(this.selectedErrors);
                count = filePaths.length;
                break;
        }
        
        if (count === 0) {
            this.showError('操作するファイルを選択してください');
            return;
        }
        
        // 確認ダイアログを表示
        const confirmed = await this.showOperationConfirmation(operation, count);
        if (!confirmed) return;
        
        // ファイル操作を実行
        await this.executeFileOperation(operation, filePaths);
    }

    async showOperationConfirmation(operation, fileCount) {
        const operationNames = {
            'trash': 'ゴミ箱へ移動',
            'delete': '完全削除',
            'move': '移動',
            'copy': 'コピー'
        };
        
        const message = `${operationNames[operation]}を実行しますか？\n対象: ${fileCount}件`;
        
        return confirm(message);
    }

    async executeFileOperation(operation, filePaths, destinationPath = null) {
        try {
            let result;
            
            // 操作名の定義
            const operationNames = {
                'trash': 'ゴミ箱へ移動',
                'delete': '完全削除',
                'move': '移動',
                'copy': 'コピー'
            };
            
            switch (operation) {
                case 'trash':
                    result = await window.electronAPI.deleteFiles(filePaths, true);
                    break;
                case 'delete':
                    result = await window.electronAPI.deleteFiles(filePaths, false);
                    break;
                case 'move':
                    if (!destinationPath) {
                        destinationPath = await this.selectMoveDestination();
                        if (!destinationPath) return;
                    }
                    result = await window.electronAPI.moveFiles(filePaths, destinationPath);
                    break;
                case 'copy':
                    if (!destinationPath) {
                        destinationPath = await this.selectCopyDestination();
                        if (!destinationPath) return;
                    }
                    result = await window.electronAPI.copyFiles(filePaths, destinationPath);
                    break;
                default:
                    throw new Error(`未対応の操作: ${operation}`);
            }
            
            if (result.success) {
                this.showSuccess(`${operationNames[operation]}が完了しました`);
                // 成功したファイルをリストから削除
                safeConsoleLog(`File operation successful. Removing ${filePaths.length} files from table:`, filePaths);
                this.removeTableRows(filePaths);
            } else {
                this.showError(`操作に失敗しました: ${result.error}`);
            }
            
        } catch (error) {
            safeConsoleError('File operation error:', error);
            this.showError(`操作に失敗しました: ${error.message}`);
        }
    }

    async selectMoveDestination() {
        try {
            // 設定から移動先フォルダを取得
            const settings = this.getSettings();
            let outputFolder = '';
            if (settings && settings.defaultOutputFolder) {
                outputFolder = settings.defaultOutputFolder;
            }
            
            // 設定に移動先フォルダが設定されている場合は確認を求める
            if (outputFolder) {
                const useDefault = confirm(`設定で指定された移動先フォルダを使用しますか？\n${outputFolder}\n\n「キャンセル」を選択すると、別のフォルダを選択できます。`);
                if (useDefault) {
                    return outputFolder;
                }
            }
            
            // 設定に移動先フォルダが設定されていない場合、またはユーザーが別のフォルダを選択したい場合
            const folderPath = await window.electronAPI.selectOutputFolder();
            if (folderPath) {
                return folderPath;
            }
            return null;
        } catch (error) {
            safeConsoleError('Move destination folder selection error:', error);
            this.showError('移動先フォルダの選択に失敗しました');
            return null;
        }
    }

    async selectCopyDestination() {
        try {
            // 設定からコピー先フォルダを取得
            const settings = this.getSettings();
            let outputFolder = '';
            if (settings && settings.defaultOutputFolder) {
                outputFolder = settings.defaultOutputFolder;
            }
            
            // 設定にコピー先フォルダが設定されている場合は確認を求める
            if (outputFolder) {
                const useDefault = confirm(`設定で指定されたコピー先フォルダを使用しますか？\n${outputFolder}\n\n「キャンセル」を選択すると、別のフォルダを選択できます。`);
                if (useDefault) {
                    return outputFolder;
                }
            }
            
            // 設定にコピー先フォルダが設定されていない場合、またはユーザーが別のフォルダを選択したい場合
            const folderPath = await window.electronAPI.selectOutputFolder();
            if (folderPath) {
                return folderPath;
            }
            return null;
        } catch (error) {
            safeConsoleError('Copy destination folder selection error:', error);
            this.showError('コピー先フォルダの選択に失敗しました');
            return null;
        }
    }

    // その他の必要なメソッド（簡略化）
    initializeFilterEvents() {
        // フィルター関連のイベントリスナー
        safeConsoleLog('Filter events initialized');
    }

    initializeKeyboardShortcuts() {
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            // プレビュー中でない場合は何もしない
            if (this.currentPreviewIndex === -1) return;
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigatePreview('up');
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigatePreview('down');
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigatePreview('left');
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigatePreview('right');
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.clearPreviewSelection();
                    break;
            }
        });
        
        safeConsoleLog('Keyboard shortcuts initialized');
    }

    initializeBatchEventListeners() {
        // バッチ処理イベントリスナー
        safeConsoleLog('Batch event listeners initialized');
    }

    initializeAdvancedFiltering() {
        // 高度なフィルタリング
        safeConsoleLog('Advanced filtering initialized');
    }

    updateFilterUI() {
        // フィルターUIの更新
        safeConsoleLog('Filter UI updated');
    }

    showGuidanceIfNeeded() {
        // ガイダンスの表示
        safeConsoleLog('Guidance checked');
    }

    startPerformanceMonitoring() {
        // パフォーマンス監視
        safeConsoleLog('Performance monitoring started');
    }

    startMemoryCleanup() {
        // メモリクリーンアップ
        safeConsoleLog('Memory cleanup started');
    }

    // プレビュー表示
    showImagePreview(image) {
        // プレビュー状態を設定
        this.previewMode = 'single';
        this.currentPreviewData = this.getCurrentTabData();
        this.currentPreviewIndex = this.findImageIndex(image);
        
        // プレビュー選択状態を更新
        this.updatePreviewSelection();
        
        const previewContainer = document.getElementById('previewAreaContainer');
        if (!previewContainer) return;
        previewContainer.innerHTML = '';
        
        // 画像要素
        const img = document.createElement('img');
        img.src = image.filePath;
        img.alt = image.filename;
        img.className = 'max-w-full max-h-[600px] rounded shadow';
        
        // 画像読み込みエラーハンドラー
        img.onerror = () => {
            safeConsoleLog(`Image load error for: ${image.filePath}`);
            previewContainer.innerHTML = `
                <div class="text-center text-red-500 p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 mx-auto mb-2">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <p class="text-sm">ファイルが見つかりません</p>
                    <p class="text-xs text-gray-500 mt-1">${image.filename}</p>
                </div>
            `;
        };
        
        previewContainer.appendChild(img);
        
        // 画像情報
        document.getElementById('infoFileName').textContent = image.filename || '';
        document.getElementById('infoFilePath').textContent = image.filePath || '';
        document.getElementById('infoFilePath').title = image.filePath || '';
        document.getElementById('infoFileSize').textContent = this.formatFileSize(image.size || 0);
        document.getElementById('infoResolution').textContent = image.resolution || '';
        document.getElementById('infoTakenDate').textContent = image.takenDate || '';
        if (typeof image.blurScore !== 'undefined') {
            document.getElementById('infoBlurScoreContainer').style.display = '';
            document.getElementById('infoBlurScore').textContent = image.blurScore;
        } else {
            document.getElementById('infoBlurScoreContainer').style.display = 'none';
        }
    }

    // 類似画像ペアプレビュー表示
    showSimilarImagePreview(file1, file2, similarity) {
        // プレビュー状態を設定
        this.previewMode = 'similar';
        this.currentPreviewData = this.getCurrentTabData();
        this.currentPreviewIndex = this.findSimilarPairIndex(file1, file2);
        
        // プレビュー選択状態を更新
        this.updatePreviewSelection();
        
        const previewContainer = document.getElementById('previewAreaContainer');
        if (!previewContainer) return;
        previewContainer.innerHTML = '';
        
        // 2つの画像を横に並べて表示
        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'flex space-x-2';
        
        // 画像1
        const img1Container = document.createElement('div');
        img1Container.className = 'flex-1 text-center';
        const img1 = document.createElement('img');
        img1.src = file1.filePath;
        img1.alt = file1.filename;
        img1.className = 'max-w-full max-h-[500px] rounded shadow mx-auto';
        
        // 画像1のエラーハンドラー
        img1.onerror = () => {
            safeConsoleLog(`Image1 load error for: ${file1.filePath}`);
            img1Container.innerHTML = `
                <div class="text-center text-red-500 p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 mx-auto mb-1">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <p class="text-xs">ファイルが見つかりません</p>
                </div>
            `;
        };
        
        img1Container.appendChild(img1);
        
        const label1 = document.createElement('div');
        label1.className = 'text-xs text-slate-600 mt-1 truncate';
        label1.textContent = file1.filename;
        img1Container.appendChild(label1);
        
        // 画像2
        const img2Container = document.createElement('div');
        img2Container.className = 'flex-1 text-center';
        const img2 = document.createElement('img');
        img2.src = file2.filePath;
        img2.alt = file2.filename;
        img2.className = 'max-w-full max-h-[500px] rounded shadow mx-auto';
        
        // 画像2のエラーハンドラー
        img2.onerror = () => {
            safeConsoleLog(`Image2 load error for: ${file2.filePath}`);
            img2Container.innerHTML = `
                <div class="text-center text-red-500 p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 mx-auto mb-1">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <p class="text-xs">ファイルが見つかりません</p>
                </div>
            `;
        };
        
        img2Container.appendChild(img2);
        
        const label2 = document.createElement('div');
        label2.className = 'text-xs text-slate-600 mt-1 truncate';
        label2.textContent = file2.filename;
        img2Container.appendChild(label2);
        
        imagesContainer.appendChild(img1Container);
        imagesContainer.appendChild(img2Container);
        previewContainer.appendChild(imagesContainer);
        
        // 画像情報（1枚目の情報を表示）
        document.getElementById('infoFileName').textContent = `${file1.filename} / ${file2.filename}`;
        document.getElementById('infoFilePath').textContent = file1.filePath;
        document.getElementById('infoFilePath').title = `${file1.filePath}\n${file2.filePath}`;
        document.getElementById('infoFileSize').textContent = `${this.formatFileSize(file1.size)} / ${this.formatFileSize(file2.size)}`;
        document.getElementById('infoResolution').textContent = `${file1.resolution || 'N/A'} / ${file2.resolution || 'N/A'}`;
        document.getElementById('infoTakenDate').textContent = `${file1.takenDate || 'N/A'} / ${file2.takenDate || 'N/A'}`;
        document.getElementById('infoBlurScoreContainer').style.display = 'none';
    }

    // テーブル作成メソッド（ブレ画像）
    createBlurTable(blurImages) {
        // ブレ画像をスコアの降順でソート
        const sortedBlurImages = [...blurImages].sort((a, b) => b.blurScore - a.blurScore);
        
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-slate-300';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-100">
                <th class="border border-slate-300 px-4 py-2 text-left w-1/4">
                    <input type="checkbox" id="selectAllBlur" class="mr-2">
                    ファイル名
                </th>
                <th class="border border-slate-300 px-4 py-2 text-left w-20">サイズ</th>
                <th class="border border-slate-300 px-4 py-2 text-left w-32">更新日時</th>
                <th class="border border-slate-300 px-4 py-2 text-left w-28 whitespace-nowrap">スコア</th>
                <th class="border border-slate-300 px-4 py-2 text-left">パス</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        sortedBlurImages.forEach((image, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 cursor-pointer';
            row.innerHTML = `
                <td class="border border-slate-300 px-4 py-2">
                    <input type="checkbox" class="blur-checkbox mr-2" data-filepath="${image.filePath}">
                    ${image.filename}
                </td>
                <td class="border border-slate-300 px-4 py-2">${this.formatFileSize(image.size)}</td>
                <td class="border border-slate-300 px-4 py-2">${this.formatDate(image.modifiedDate)}</td>
                <td class="border border-slate-300 px-4 py-2">
                    <span class="px-2 py-1 rounded text-sm ${image.blurScore > 80 ? 'bg-red-100 text-red-800' : image.blurScore > 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                        ${image.blurScore}
                    </span>
                </td>
                <td class="border border-slate-300 px-4 py-2 text-sm text-slate-600" title="${image.filePath}">
                    ${this.getDisplayPath(image.filePath)}
                </td>
            `;
            // プレビュー表示イベント
            row.addEventListener('click', (e) => {
                // チェックボックスクリック時は無視
                if (e.target.tagName.toLowerCase() === 'input') return;
                this.showImagePreview(image);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // チェックボックスのイベントリスナーを設定
        this.setupTableCheckboxes(table, 'blur');
        
        return table;
    }

    // 類似画像テーブルにも同様のプレビューイベントを追加
    createSimilarTable(similarImages) {
        // 類似画像を類似度の降順でソート
        const sortedSimilarImages = [...similarImages].sort((a, b) => b.similarity - a.similarity);
        
        // 類似度フィルタリング用のUIを追加
        const filterContainer = document.createElement('div');
        filterContainer.className = 'mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200';
        filterContainer.innerHTML = `
            <div class="flex flex-wrap items-center gap-4 text-sm">
                <div class="flex items-center space-x-2">
                    <span class="font-medium text-slate-700">類似度フィルター:</span>
                    <label class="flex items-center space-x-1">
                        <input type="checkbox" id="filter90plus" class="similarity-filter" data-min="90" checked>
                        <span class="px-2 py-1 rounded text-xs bg-red-100 text-red-800">90%以上</span>
                    </label>
                    <label class="flex items-center space-x-1">
                        <input type="checkbox" id="filter80plus" class="similarity-filter" data-min="80" checked>
                        <span class="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">80-89%</span>
                    </label>
                    <label class="flex items-center space-x-1">
                        <input type="checkbox" id="filter70plus" class="similarity-filter" data-min="70" checked>
                        <span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">70-79%</span>
                    </label>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="font-medium text-slate-700">表示:</span>
                    <span id="filteredCount" class="font-semibold text-blue-600">${sortedSimilarImages.length}</span>
                    <span class="text-slate-500">/ ${sortedSimilarImages.length}</span>
                </div>
            </div>
        `;
        
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-slate-300';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-100">
                <th class="border border-slate-300 px-4 py-2 text-left w-8">
                    <input type="checkbox" id="selectAllSimilar" class="mr-2">
                </th>
                <th class="border border-slate-300 px-4 py-2 text-left w-16">類似度</th>
                <th class="border border-slate-300 px-4 py-2 text-left w-32">画像1</th>
                <th class="border border-slate-300 px-4 py-2 text-left w-32">画像2</th>
                <th class="border border-slate-300 px-4 py-2 text-left">詳細情報</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        sortedSimilarImages.forEach((group, index) => {
            const file1 = group.files[0];
            const file2 = group.files[1];
            const pairKey = `${file1.filePath}|${file2.filePath}`;
            
            const row = document.createElement('tr');
            row.className = 'similarity-row hover:bg-slate-50';
            row.dataset.similarity = group.similarity;
            row.dataset.pairKey = pairKey;
            
            // 類似度に基づく行の色分け
            if (group.similarity >= 90) {
                row.classList.add('bg-red-50');
            } else if (group.similarity >= 80) {
                row.classList.add('bg-yellow-50');
            } else {
                row.classList.add('bg-blue-50');
            }
            
            row.innerHTML = `
                <td class="border border-slate-300 px-2 py-2 text-center">
                    <input type="checkbox" class="similar-checkbox" data-pair="${pairKey}">
                </td>
                <td class="border border-slate-300 px-3 py-2 text-center">
                    <span class="px-2 py-1 rounded text-sm font-semibold ${group.similarity >= 90 ? 'bg-red-100 text-red-800' : group.similarity >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}">
                        ${group.similarity}%
                    </span>
                </td>
                <td class="border border-slate-300 px-3 py-2">
                    <div class="flex items-center space-x-2">
                        <div class="w-12 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                            <img src="file://${file1.filePath}" alt="${file1.filename}" 
                                 class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="w-full h-full flex items-center justify-center text-xs text-slate-500" style="display:none;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate" title="${file1.filename}">${file1.filename}</div>
                            <div class="text-xs text-slate-500">${this.formatFileSize(file1.size)}</div>
                            <div class="text-xs text-slate-400">${this.formatDate(file1.modifiedDate)}</div>
                        </div>
                        <input type="checkbox" class="individual-checkbox ml-2" data-filepath="${file1.filePath}" data-pair="${pairKey}">
                    </div>
                </td>
                <td class="border border-slate-300 px-3 py-2">
                    <div class="flex items-center space-x-2">
                        <div class="w-12 h-12 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                            <img src="file://${file2.filePath}" alt="${file2.filename}" 
                                 class="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="w-full h-full flex items-center justify-center text-xs text-slate-500" style="display:none;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate" title="${file2.filename}">${file2.filename}</div>
                            <div class="text-xs text-slate-500">${this.formatFileSize(file2.size)}</div>
                            <div class="text-xs text-slate-400">${this.formatDate(file2.modifiedDate)}</div>
                        </div>
                        <input type="checkbox" class="individual-checkbox ml-2" data-filepath="${file2.filePath}" data-pair="${pairKey}">
                    </div>
                </td>
                <td class="border border-slate-300 px-3 py-2 text-xs text-slate-600">
                    <div class="space-y-1">
                        <div><span class="font-medium">サイズ差:</span> ${this.getSizeDifference(file1.size, file2.size)}</div>
                        <div><span class="font-medium">パス1:</span> <span class="truncate block" title="${file1.filePath}">${this.getDisplayPath(file1.filePath)}</span></div>
                        <div><span class="font-medium">パス2:</span> <span class="truncate block" title="${file2.filePath}">${this.getDisplayPath(file2.filePath)}</span></div>
                    </div>
                </td>
            `;
            
            // プレビュー表示イベント（画像クリックで両方表示）
            const images = row.querySelectorAll('img');
            images.forEach(img => {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showSimilarImagePreview(file1, file2, group.similarity);
                });
            });
            
            // 行クリックでペア全体を選択し、プレビューを表示
            row.addEventListener('click', (e) => {
                if (e.target.tagName.toLowerCase() === 'input') return;
                
                // ペア全体を選択
                const pairCheckbox = row.querySelector('.similar-checkbox');
                pairCheckbox.checked = !pairCheckbox.checked;
                this.handleCheckboxChange(pairCheckbox, 'similar');
                
                // 通常のプレビュー表示
                this.showSimilarImagePreview(file1, file2, group.similarity);
            });
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // フィルタリング機能を設定
        this.setupSimilarityFiltering(filterContainer, tbody);
        
        // チェックボックスのイベントリスナーを設定
        this.setupTableCheckboxes(table, 'similar');
        
        // 個別ファイル選択のイベントリスナーを設定
        this.setupIndividualCheckboxes(table);
        
        return { filterContainer, table };
    }

    // 類似度フィルタリング機能
    setupSimilarityFiltering(filterContainer, tbody) {
        const filters = filterContainer.querySelectorAll('.similarity-filter');
        const filteredCountSpan = filterContainer.querySelector('#filteredCount');
        const totalCount = tbody.children.length;
        
        filters.forEach(filter => {
            filter.addEventListener('change', () => {
                const minSimilarity = parseInt(filter.dataset.min);
                const rows = tbody.querySelectorAll('.similarity-row');
                let visibleCount = 0;
                
                rows.forEach(row => {
                    const similarity = parseInt(row.dataset.similarity);
                    const shouldShow = similarity >= minSimilarity;
                    row.style.display = shouldShow ? '' : 'none';
                    if (shouldShow) visibleCount++;
                });
                
                filteredCountSpan.textContent = visibleCount;
            });
        });
    }

    // 個別ファイル選択機能
    setupIndividualCheckboxes(table) {
        const individualCheckboxes = table.querySelectorAll('.individual-checkbox');
        
        individualCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const filePath = checkbox.dataset.filepath;
                const pairKey = checkbox.dataset.pair;
                
                if (checkbox.checked) {
                    this.selectedIndividualFiles.add(filePath);
                } else {
                    this.selectedIndividualFiles.delete(filePath);
                }
                
                // ペア全体の選択状態を更新
                this.updatePairSelectionState(pairKey);
                
                this.updateSelectedCount();
                this.updateActionButtons();
            });
        });
    }

    // ペア全体の選択状態を更新
    updatePairSelectionState(pairKey) {
        const pairCheckbox = document.querySelector(`.similar-checkbox[data-pair="${pairKey}"]`);
        const individualCheckboxes = document.querySelectorAll(`.individual-checkbox[data-pair="${pairKey}"]`);
        
        // pairCheckboxがnullの場合は処理をスキップ
        if (!pairCheckbox) {
            safeConsoleLog('Pair checkbox not found for pairKey:', pairKey);
            return;
        }
        
        const checkedCount = Array.from(individualCheckboxes).filter(cb => cb.checked).length;
        
        if (checkedCount === 0) {
            pairCheckbox.checked = false;
            pairCheckbox.indeterminate = false;
        } else if (checkedCount === individualCheckboxes.length) {
            pairCheckbox.checked = true;
            pairCheckbox.indeterminate = false;
        } else {
            pairCheckbox.checked = false;
            pairCheckbox.indeterminate = true;
        }
    }

    // ファイルサイズの差を計算
    getSizeDifference(size1, size2) {
        const diff = Math.abs(size1 - size2);
        const percentage = ((diff / Math.max(size1, size2)) * 100).toFixed(1);
        const diffFormatted = this.formatFileSize(diff);
        
        if (size1 > size2) {
            return `画像1が${diffFormatted}大きい (${percentage}%)`;
        } else if (size2 > size1) {
            return `画像2が${diffFormatted}大きい (${percentage}%)`;
        } else {
            return '同じサイズ';
        }
    }

    createErrorTable(errors) {
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-slate-300';
        
        // テーブルヘッダー
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-slate-100">
                <th class="border border-slate-300 px-4 py-2 text-left">
                    <input type="checkbox" id="selectAllError" class="mr-2">
                    ファイル名
                </th>
                <th class="border border-slate-300 px-4 py-2 text-left">エラー詳細</th>
                <th class="border border-slate-300 px-4 py-2 text-left">パス</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // テーブルボディ
        const tbody = document.createElement('tbody');
        errors.forEach((error, index) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50';
            row.innerHTML = `
                <td class="border border-slate-300 px-4 py-2">
                    <input type="checkbox" class="error-checkbox mr-2" data-filepath="${error.filePath}">
                    ${error.filename}
                </td>
                <td class="border border-slate-300 px-4 py-2 text-red-600">${error.error}</td>
                <td class="border border-slate-300 px-4 py-2 text-sm text-slate-600" title="${error.filePath}">
                    ${this.getDisplayPath(error.filePath)}
                </td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // チェックボックスのイベントリスナーを設定
        this.setupTableCheckboxes(table, 'error');
        
        return table;
    }

    // テーブルのチェックボックスイベントを設定
    setupTableCheckboxes(table, type) {
        safeConsoleLog(`Setting up checkboxes for type: ${type}`);
        
        // 全選択チェックボックス
        const selectAllCheckbox = table.querySelector(`#selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`);
        if (selectAllCheckbox) {
            safeConsoleLog(`Found select all checkbox for ${type}`);
            selectAllCheckbox.addEventListener('change', (e) => {
                safeConsoleLog(`Select all checkbox changed: ${e.target.checked}`);
                const checkboxes = table.querySelectorAll(`.${type}-checkbox`);
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                    this.handleCheckboxChange(checkbox, type);
                });
            });
        } else {
            safeConsoleLog(`Select all checkbox not found for ${type}`);
        }
        
        // 個別チェックボックス
        const checkboxes = table.querySelectorAll(`.${type}-checkbox`);
        safeConsoleLog(`Found ${checkboxes.length} individual checkboxes for ${type}`);
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                safeConsoleLog(`Individual checkbox changed: ${e.target.checked}`);
                this.handleCheckboxChange(e.target, type);
            });
        });
    }

    // チェックボックスの変更を処理
    handleCheckboxChange(checkbox, type) {
        safeConsoleLog(`Checkbox change: type=${type}, checked=${checkbox.checked}, filepath=${checkbox.dataset.filepath}`);
        
        switch (type) {
            case 'blur':
                const filePath = checkbox.dataset.filepath;
                if (checkbox.checked) {
                    this.selectedFiles.add(filePath);
                } else {
                    this.selectedFiles.delete(filePath);
                }
                safeConsoleLog(`Blur files selected: ${this.selectedFiles.size}`);
                break;
            case 'error':
                const errorFilePath = checkbox.dataset.filepath;
                if (checkbox.checked) {
                    this.selectedErrors.add(errorFilePath);
                } else {
                    this.selectedErrors.delete(errorFilePath);
                }
                safeConsoleLog(`Error files selected: ${this.selectedErrors.size}`);
                break;
            case 'similar':
                const pairKey = checkbox.dataset.pair;
                if (checkbox.checked) {
                    this.selectedSimilarPairs.add(pairKey);
                } else {
                    this.selectedSimilarPairs.delete(pairKey);
                }
                safeConsoleLog(`Similar pairs selected: ${this.selectedSimilarPairs.size}`);
                break;
        }
        
        this.updateSelectedCount();
        this.updateActionButtons();
    }

    // 選択操作メソッド
    selectAll() {
        // 仮想テーブルの全選択機能を使用
        this.selectAllVirtualTable(this.currentTab);
        
        // 全選択チェックボックスも更新
        const selectAllCheckbox = document.querySelector(`#selectAll${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = true;
        }
    }

    deselectAll() {
        // 仮想テーブルの全選択解除機能を使用
        this.deselectAllVirtualTable(this.currentTab);
        
        // 全選択チェックボックスも更新
        const selectAllCheckbox = document.querySelector(`#selectAll${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
    }

    removeTableRows(filePaths) {
        safeConsoleLog(`Removing ${filePaths.length} rows from table. Current tab: ${this.currentTab}`);
        safeConsoleLog(`File paths to remove:`, filePaths);
        
        // 削除されたファイルをスキャン結果からも削除
        switch (this.currentTab) {
            case 'blur':
                // ブレ画像から削除
                this.scanResults.blurImages = this.scanResults.blurImages.filter(image => 
                    !filePaths.includes(image.filePath)
                );
                safeConsoleLog(`Removed files from blur results. Remaining: ${this.scanResults.blurImages.length}`);
                break;
                
            case 'error':
                // エラーから削除
                this.scanResults.errors = this.scanResults.errors.filter(error => 
                    !filePaths.includes(error.filePath)
                );
                safeConsoleLog(`Removed files from error results. Remaining: ${this.scanResults.errors.length}`);
                break;
                
            case 'similar':
                // 類似画像から削除（ペアの両方のファイルが含まれるペアを削除）
                this.scanResults.similarImages = this.scanResults.similarImages.filter(group => {
                    const file1Path = group.files[0].filePath;
                    const file2Path = group.files[1].filePath;
                    return !filePaths.includes(file1Path) && !filePaths.includes(file2Path);
                });
                safeConsoleLog(`Removed files from similar results. Remaining: ${this.scanResults.similarImages.length}`);
                break;
        }
        
        // 現在のタブのコンテンツエリアを確認
        const currentContent = document.getElementById(`content${this.currentTab.charAt(0).toUpperCase() + this.currentTab.slice(1)}`);
        safeConsoleLog(`Current content element:`, currentContent);
        
        if (currentContent) {
            const tables = currentContent.querySelectorAll('table');
            safeConsoleLog(`Found ${tables.length} tables in current content`);
            tables.forEach((table, index) => {
                const rows = table.querySelectorAll('tr');
                safeConsoleLog(`Table ${index} has ${rows.length} rows`);
            });
        }
        
        // 削除済みの行を追跡するSet
        const removedRows = new Set();
        
        // 現在のタブに応じた処理
        switch (this.currentTab) {
            case 'blur':
            case 'error':
                // ブレ画像とエラータブの場合
                filePaths.forEach(filePath => {
                    safeConsoleLog(`Looking for file: ${filePath}`);
                    
                    // チェックボックスのdata-filepath属性を基準に行を探す
                    const checkboxes = document.querySelectorAll(`[data-filepath="${filePath}"]`);
                    safeConsoleLog(`Found ${checkboxes.length} checkboxes for file: ${filePath}`);
                    
                    checkboxes.forEach((checkbox, index) => {
                        const row = checkbox.closest('tr');
                        safeConsoleLog(`Checkbox ${index} closest tr:`, row);
                        
                        if (row && !removedRows.has(row)) {
                            safeConsoleLog(`Removing row for file: ${filePath}`);
                            row.remove();
                            removedRows.add(row);
                        } else if (removedRows.has(row)) {
                            safeConsoleLog(`Row already removed for file: ${filePath}`);
                        } else {
                            safeConsoleLog(`Row not found for file: ${filePath}`);
                        }
                    });
                });
                break;
                
            case 'similar':
                // 類似画像タブの場合
                safeConsoleLog(`Selected similar pairs:`, Array.from(this.selectedSimilarPairs));
                
                this.selectedSimilarPairs.forEach(pairKey => {
                    safeConsoleLog(`Looking for similar pair: ${pairKey}`);
                    
                    const checkboxes = document.querySelectorAll(`[data-pair="${pairKey}"]`);
                    safeConsoleLog(`Found ${checkboxes.length} checkboxes for pair: ${pairKey}`);
                    
                    checkboxes.forEach((checkbox, index) => {
                        const row = checkbox.closest('tr');
                        safeConsoleLog(`Similar pair checkbox ${index} closest tr:`, row);
                        
                        if (row && !removedRows.has(row)) {
                            safeConsoleLog(`Removing similar pair row: ${pairKey}`);
                            row.remove();
                            removedRows.add(row);
                        } else if (removedRows.has(row)) {
                            safeConsoleLog(`Similar pair row already removed: ${pairKey}`);
                        } else {
                            safeConsoleLog(`Similar pair row not found: ${pairKey}`);
                        }
                    });
                });
                break;
        }
        
        // 選択状態をクリア
        this.selectedFiles.clear();
        this.selectedSimilarPairs.clear();
        this.selectedErrors.clear();
        this.updateSelectedCount();
        this.updateActionButtons();
        
        safeConsoleLog(`Table rows removal completed. Removed ${removedRows.size} rows.`);
        
        // タブのカウント表示を更新
        this.updateTabCounts();
        
        // DOM操作が失敗した場合のフォールバック：テーブル全体を再構築
        if (removedRows.size === 0 && filePaths.length > 0) {
            safeConsoleLog('DOM removal failed, rebuilding table...');
            this.rebuildCurrentTable();
        }
    }
    
    // 現在のタブのテーブルを再構築する関数
    rebuildCurrentTable() {
        safeConsoleLog(`Rebuilding table for tab: ${this.currentTab}`);
        
        switch (this.currentTab) {
            case 'blur':
                this.displayBlurResults(this.scanResults.blurImages);
                break;
            case 'similar':
                this.displaySimilarResults(this.scanResults.similarImages);
                break;
            case 'error':
                this.displayErrorResults(this.scanResults.errors);
                break;
        }
        
        safeConsoleLog('Table rebuild completed');
    }
    
    // タブのカウント表示を更新する関数を追加
    updateTabCounts() {
        const countBlur = document.getElementById('countBlur');
        const countSimilar = document.getElementById('countSimilar');
        const countError = document.getElementById('countError');
        
        if (countBlur) {
            countBlur.textContent = this.scanResults.blurImages.length;
        }
        if (countSimilar) {
            countSimilar.textContent = this.scanResults.similarImages.length;
        }
        if (countError) {
            countError.textContent = this.scanResults.errors.length;
        }
    }

    updateActionButtons() {
        let count = 0;
        
        switch (this.currentTab) {
            case 'blur':
                count = this.selectedFiles.size;
                break;
            case 'similar':
                count = this.selectedSimilarPairs.size + this.selectedIndividualFiles.size;
                break;
            case 'error':
                count = this.selectedErrors.size;
                break;
        }
        
        safeConsoleLog(`updateActionButtons: currentTab=${this.currentTab}, count=${count}`);
        
        // アクションボタンの有効/無効を切り替え
        const actionButtons = document.querySelectorAll('#copyBtn, #deleteBtn, #moveBtn');
        actionButtons.forEach(button => {
            if (count > 0) {
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
                button.classList.add('cursor-pointer');
                safeConsoleLog(`Button ${button.id} enabled`);
            } else {
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
                button.classList.remove('cursor-pointer');
                safeConsoleLog(`Button ${button.id} disabled`);
            }
        });
    }

    // 3ペインレイアウトで類似画像を表示
    showSimilarImagesIn3PaneLayout(file1, file2, similarity) {
        // 画像1を左ペインに表示
        this.showImageInPane(file1, 'similarImage1');
        
        // 画像2を中央ペインに表示
        this.showImageInPane(file2, 'similarImage2');
        
        // 類似度情報を表示
        this.showSimilarityInfo(similarity);
    }

    // 指定されたペインに画像を表示
    showImageInPane(image, panePrefix) {
        const container = document.getElementById(`${panePrefix}Container`);
        const fileNameElement = document.getElementById(`${panePrefix}FileName`);
        const filePathElement = document.getElementById(`${panePrefix}FilePath`);
        const resolutionElement = document.getElementById(`${panePrefix}Resolution`);
        const fileSizeElement = document.getElementById(`${panePrefix}FileSize`);
        const modifiedDateElement = document.getElementById(`${panePrefix}ModifiedDate`);
        
        if (!container) return;
        
        // 画像を表示
        container.innerHTML = `
            <img src="file://${image.filePath}" 
                 alt="${image.filename}" 
                 class="w-full h-full object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="w-full h-full flex items-center justify-center text-slate-500" style="display:none;">
                <div class="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 mx-auto mb-2">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    <p class="text-sm">画像の読み込みに<br>失敗しました</p>
                </div>
            </div>
        `;
        
        // 情報を表示
        if (fileNameElement) fileNameElement.textContent = image.filename;
        if (filePathElement) {
            filePathElement.textContent = this.getDisplayPath(image.filePath);
            filePathElement.title = image.filePath;
        }
        if (resolutionElement) resolutionElement.textContent = image.resolution || '不明';
        if (fileSizeElement) fileSizeElement.textContent = this.formatFileSize(image.size);
        if (modifiedDateElement) modifiedDateElement.textContent = this.formatDate(image.modifiedDate);
    }

    // 類似度情報を表示
    showSimilarityInfo(similarity) {
        // 類似度をヘッダーに表示（オプション）
        const similarityHeader = document.createElement('div');
        similarityHeader.className = 'text-center text-sm font-medium text-slate-700 mb-2';
        similarityHeader.innerHTML = `
            類似度: <span class="px-2 py-1 rounded text-xs font-semibold ${
                similarity >= 90 ? 'bg-red-100 text-red-800' : 
                similarity >= 80 ? 'bg-yellow-100 text-yellow-800' : 
                'bg-blue-100 text-blue-800'
            }">${similarity}%</span>
        `;
        
        // 既存の類似度ヘッダーがあれば更新、なければ追加
        const existingHeader = document.querySelector('.similarity-header');
        if (existingHeader) {
            existingHeader.replaceWith(similarityHeader);
        } else {
            similarityHeader.classList.add('similarity-header');
            // 適切な位置に挿入（例：テーブルペインのヘッダー）
            const tablePane = document.getElementById('similarTablePane');
            if (tablePane) {
                const header = tablePane.querySelector('.flex.border-b');
                if (header) {
                    header.appendChild(similarityHeader);
                }
            }
        }
    }

    // ファイル監視機能の初期化
    initializeFileWatching() {
        if (!window.electronAPI || !window.electronAPI.onFileSystemChange) {
            safeConsoleWarn('ファイル監視APIが利用できません');
            return;
        }

        // ファイルシステム変更イベントのリスナーを設定
        this.fileSystemChangeUnsubscribe = window.electronAPI.onFileSystemChange((data) => {
            this.handleFileSystemChange(data);
        });

        safeConsoleLog('ファイル監視機能が初期化されました');
    }

    // ファイルシステム変更の処理
    handleFileSystemChange(data) {
        if (!this.fileWatchingEnabled) {
            return;
        }

        safeConsoleLog('ファイルシステム変更を検知:', data);

        // デバウンス処理
        if (this.fileChangeDebounceTimer) {
            clearTimeout(this.fileChangeDebounceTimer);
        }

        this.fileChangeDebounceTimer = setTimeout(() => {
            this.processFileSystemChange(data);
        }, this.fileChangeDebounceDelay);
    }

    // ファイルシステム変更の処理（デバウンス後）
    processFileSystemChange(data) {
        const { type, filePath } = data;
        
        // ターゲットフォルダ内のファイル変更のみ処理
        if (this.targetFolder && filePath.startsWith(this.targetFolder)) {
            safeConsoleLog(`ターゲットフォルダ内のファイル変更を検知: ${type} - ${filePath}`);

            // ユーザーに通知
            this.showFileChangeNotification(type, filePath);

            // 必要に応じて自動再スキャンを提案
            this.suggestRescan(type);
        }
    }

    // ファイル変更通知の表示
    showFileChangeNotification(type, filePath) {
        const fileName = pathBasename(filePath);
        let message = '';

        switch (type) {
            case 'added':
                message = `新しい画像ファイルが追加されました: ${fileName}`;
                break;
            case 'changed':
                message = `画像ファイルが変更されました: ${fileName}`;
                break;
            case 'deleted':
                message = `画像ファイルが削除されました: ${fileName}`;
                break;
            default:
                message = `ファイルが変更されました: ${fileName}`;
        }

        this.showNotification(message, 'info');
    }

    // 再スキャンの提案
    suggestRescan(type) {
        // 削除の場合は即座に再スキャンを提案
        if (type === 'deleted') {
            this.showNotification('ファイルが削除されました。再スキャンを実行することをお勧めします。', 'warning');
        }
        // 追加・変更の場合は少し待ってから提案
        else {
            setTimeout(() => {
                this.showNotification('ファイルが変更されました。最新の状態を確認するために再スキャンを実行することをお勧めします。', 'info');
            }, 5000); // 5秒後に提案
        }
    }

    // ファイル監視の開始
    async startFileWatching(folderPath) {
        if (!this.fileWatchingEnabled || !folderPath) {
            return;
        }

        try {
            const result = await window.electronAPI.startFileWatching(folderPath);
            if (result.success) {
                this.fileWatchingActive = true;
                safeConsoleLog('ファイル監視を開始しました:', folderPath);
                this.showSuccess('ファイル監視を開始しました');
            } else {
                safeConsoleError('ファイル監視の開始に失敗しました:', result.error);
                this.showError('ファイル監視の開始に失敗しました');
            }
        } catch (error) {
            safeConsoleError('ファイル監視開始エラー:', error);
            this.showError('ファイル監視の開始に失敗しました');
        }
    }

    // ファイル監視の停止
    async stopFileWatching() {
        try {
            const result = await window.electronAPI.stopFileWatching();
            if (result.success) {
                this.fileWatchingActive = false;
                safeConsoleLog('ファイル監視を停止しました');
                this.showSuccess('ファイル監視を停止しました');
            } else {
                safeConsoleError('ファイル監視の停止に失敗しました:', result.error);
                this.showError('ファイル監視の停止に失敗しました');
            }
        } catch (error) {
            safeConsoleError('ファイル監視停止エラー:', error);
            this.showError('ファイル監視の停止に失敗しました');
        }
    }

    // ファイル監視の有効/無効を切り替え
    toggleFileWatching() {
        this.fileWatchingEnabled = !this.fileWatchingEnabled;
        
        if (this.fileWatchingEnabled) {
            this.showSuccess('ファイル監視を有効にしました');
            if (this.targetFolder) {
                this.startFileWatching(this.targetFolder);
            }
        } else {
            this.showSuccess('ファイル監視を無効にしました');
            this.stopFileWatching();
        }
        
        return this.fileWatchingEnabled;
    }

    // ファイル監視状態の取得
    getFileWatchingStatus() {
        return {
            enabled: this.fileWatchingEnabled,
            active: this.fileWatchingActive,
            targetFolder: this.targetFolder
        };
    }

    // アプリケーション終了時のクリーンアップ
    cleanup() {
        safeConsoleLog('アプリケーションのクリーンアップが完了しました');
    }

    // プレビューナビゲーション機能
    navigatePreview(direction) {
        if (this.currentPreviewIndex === -1 || this.currentPreviewData.length === 0) return;
        
        let newIndex = this.currentPreviewIndex;
        
        switch (direction) {
            case 'up':
            case 'left':
                newIndex = Math.max(0, this.currentPreviewIndex - 1);
                break;
            case 'down':
            case 'right':
                newIndex = Math.min(this.currentPreviewData.length - 1, this.currentPreviewIndex + 1);
                break;
        }
        
        if (newIndex !== this.currentPreviewIndex) {
            this.currentPreviewIndex = newIndex;
            this.updatePreviewSelection();
            
            // 新しい画像をプレビュー
            const item = this.currentPreviewData[newIndex];
            if (this.previewMode === 'single') {
                this.showImagePreview(item);
            } else if (this.previewMode === 'similar') {
                this.showSimilarImagePreview(item.files[0], item.files[1], item.similarity);
            }
            
            // 仮想テーブルで該当の行をスクロールして表示
            this.scrollToPreviewItem(newIndex);
        }
    }
    
    // プレビュー選択をクリア
    clearPreviewSelection() {
        this.currentPreviewIndex = -1;
        this.currentPreviewData = [];
        this.previewMode = 'single';
        // this.clearPreviewArea(); ← 削除
        // 仮想テーブルの選択状態をクリア
        if (this.virtualTables[this.currentTab]) {
            const rows = this.virtualTables[this.currentTab].content.querySelectorAll('[data-index]');
            rows.forEach(row => {
                row.classList.remove('preview-selected');
            });
        }
    }
    
    // プレビュー選択状態を更新
    updatePreviewSelection() {
        if (this.currentPreviewIndex === -1) return;
        
        // 仮想テーブルの選択状態を更新
        if (this.virtualTables[this.currentTab]) {
            const rows = this.virtualTables[this.currentTab].content.querySelectorAll('[data-index]');
            rows.forEach((row, index) => {
                if (index === this.currentPreviewIndex) {
                    row.classList.add('preview-selected');
                } else {
                    row.classList.remove('preview-selected');
                }
            });
        }
    }
    
    // プレビューアイテムまでスクロール
    scrollToPreviewItem(index) {
        if (this.virtualTables[this.currentTab]) {
            this.virtualTables[this.currentTab].scrollToIndex(index);
        }
    }

    // 現在のタブのデータを取得
    getCurrentTabData() {
        switch (this.currentTab) {
            case 'blur':
                return this.scanResults.blurImages || [];
            case 'similar':
                return this.scanResults.similarImages || [];
            case 'error':
                return this.scanResults.errors || [];
            default:
                return [];
        }
    }
    
    // 画像のインデックスを検索
    findImageIndex(image) {
        const data = this.getCurrentTabData();
        return data.findIndex(item => {
            if (this.currentTab === 'blur' || this.currentTab === 'error') {
                return item.filePath === image.filePath;
            } else if (this.currentTab === 'similar') {
                return (item.files[0].filePath === image.filePath || item.files[1].filePath === image.filePath);
            }
            return false;
        });
    }
    
    // 類似画像ペアのインデックスを検索
    findSimilarPairIndex(file1, file2) {
        if (this.currentTab !== 'similar') return -1;
        
        const data = this.getCurrentTabData();
        return data.findIndex(item => {
            return (item.files[0].filePath === file1.filePath && item.files[1].filePath === file2.filePath) ||
                   (item.files[0].filePath === file2.filePath && item.files[1].filePath === file1.filePath);
        });
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    safeConsoleLog('DOM content loaded');
    
    // グローバルエラーハンドラーを追加
    window.addEventListener('error', (event) => {
        // dragEventエラーを無視
        if (event.message && event.message.includes('dragEvent is not defined')) {
            event.preventDefault();
            return false;
        }
        // その他のエラーは通常通り処理
        safeConsoleError('Global error:', event.error);
    });
    
    window.imageCleanupApp = new ImageCleanupApp();
    
    // 設定マネージャーの初期化
    if (window.SettingsManager) {
        window.settingsManager = new window.SettingsManager();
        safeConsoleLog('Settings manager initialized');
    } else {
        safeConsoleError('SettingsManager class not found');
    }
    
    // ページアンロード時のクリーンアップ
    window.addEventListener('beforeunload', () => {
        if (window.imageCleanupApp) {
            window.imageCleanupApp.cleanup();
        }
    });
});