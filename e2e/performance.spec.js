const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('パフォーマンステスト', () => {
  test.beforeEach(async ({ page }) => {
    // アプリのメインページに移動（正しいパスを指定）
    const htmlPath = path.join(__dirname, '../src/renderer/html/index.html');
    await page.goto(`file://${htmlPath}`);
    
    // Electron APIをモック
    await page.evaluate(() => {
      window.electronAPI = {
        selectFolder: () => Promise.resolve(['/fake/path']),
        getImages: () => Promise.resolve([]),
        analyzeImages: () => Promise.resolve({ blur: [], similar: [], error: [], log: [] }),
        on: () => {},
        send: () => {}
      };
    });
  });

  test('ページ読み込み時間が1秒未満であること', async ({ page }) => {
    const loadTime = await page.evaluate(() => performance.timing.loadEventEnd - performance.timing.navigationStart);
    expect(loadTime).toBeLessThan(1000);
  });

  test('スキャン実行時のUI応答性が500ms未満であること', async ({ page }) => {
    await page.click('#targetFolder');
    await page.waitForSelector('#targetFolderPathDisplay:has-text("/fake/path")');

    const startTime = await page.evaluate(() => performance.now());
    await page.click('#scanButton');
    await expect(page.locator('#progressMessage')).toBeVisible();
    const endTime = await page.evaluate(() => performance.now());

    expect(endTime - startTime).toBeLessThan(500);
  });

  test('タブ切り替えの応答性', async ({ page }) => {
    const startTime = await page.evaluate(() => performance.now());
    
    // タブ切り替えを実行
    await page.click('[data-tab="blur"]');
    await page.click('[data-tab="similar"]');
    await page.click('[data-tab="error"]');
    
    const switchTime = await page.evaluate(() => performance.now()) - startTime;
    
    // タブ切り替えが500ms以内であることを確認
    expect(switchTime).toBeLessThan(500);
  });

  test('ボタンクリックの応答性', async ({ page }) => {
    const startTime = await page.evaluate(() => performance.now());
    
    // ボタンクリックを実行
    await page.click('#targetFolder');
    await page.click('#scanButton');
    await page.click('#settingsButton');
    
    const clickTime = await page.evaluate(() => performance.now()) - startTime;
    
    // ボタンクリックが300ms以内であることを確認
    expect(clickTime).toBeLessThan(300);
  });

  test('メモリ使用量', async ({ page }) => {
    // ページのメモリ使用量を取得
    const memoryInfo = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    if (memoryInfo) {
      // メモリ使用量が50MB以内であることを確認
      expect(memoryInfo.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('スクロールパフォーマンス', async ({ page }) => {
    // 結果表示エリアでスクロールテスト
    const resultsPane = page.locator('#resultsPane');
    
    const startTime = await page.evaluate(() => performance.now());
    
    // スクロールを実行
    await resultsPane.scrollIntoViewIfNeeded();
    
    const scrollTime = await page.evaluate(() => performance.now()) - startTime;
    
    // スクロールが200ms以内であることを確認
    expect(scrollTime).toBeLessThan(200);
  });

  test('画像プレビューの表示速度', async ({ page }) => {
    const startTime = await page.evaluate(() => performance.now());
    
    // プレビューエリアが表示されるまで待機
    await expect(page.locator('#previewPane')).toBeVisible();
    await expect(page.locator('#previewAreaContainer')).toBeVisible();
    
    const previewTime = await page.evaluate(() => performance.now()) - startTime;
    
    // プレビュー表示が500ms以内であることを確認
    expect(previewTime).toBeLessThan(500);
  });

  test('大量データの処理', async ({ page }) => {
    // 大量のテストデータを生成
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `test-image-${i}.jpg`,
      path: `/test/path/${i}`,
      size: Math.random() * 10
    }));
    
    const startTime = await page.evaluate(() => performance.now());
    
    // データをDOMに挿入
    await page.evaluate((data) => {
      const container = document.getElementById('contentBlur');
      data.forEach(item => {
        const div = document.createElement('div');
        div.textContent = item.name;
        div.className = 'test-item';
        container.appendChild(div);
      });
    }, testData);
    
    const renderTime = await page.evaluate(() => performance.now()) - startTime;
    
    // 大量データのレンダリングが2秒以内であることを確認
    expect(renderTime).toBeLessThan(2000);
  });

  test('ネットワークリクエストの最適化', async ({ page }) => {
    // ネットワークリクエストを監視
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });
    
    // ページを再読み込み
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 不要なリクエストが少ないことを確認
    const imageRequests = requests.filter(r => r.resourceType() === 'image');
    expect(imageRequests.length).toBeLessThan(10);
  });

  test('大量画像でのスキャン性能', async ({ page }) => {
    // テスト用の大量画像フォルダを作成
    const testImageDir = path.join(process.cwd(), 'test-images-large');
    if (!fs.existsSync(testImageDir)) {
      fs.mkdirSync(testImageDir, { recursive: true });
    }

    // モック画像ファイルを大量作成（実際のテストでは既存の画像を使用）
    for (let i = 0; i < 100; i++) {
      const mockImagePath = path.join(testImageDir, `test-image-${i}.jpg`);
      // 実際のテストでは既存の画像ファイルをコピー
    }

    // フォルダ選択をシミュレート
    await page.evaluate((dir) => {
      window.electronAPI = {
        selectFolder: () => Promise.resolve(dir),
        writeToLog: () => Promise.resolve(),
        loadSettings: () => Promise.resolve({}),
        saveSettings: () => Promise.resolve()
      };
    }, testImageDir);

    // スキャン開始時間を記録
    const startTime = Date.now();

    // フォルダ選択ボタンをクリック
    await page.click('#folder-select-btn');
    
    // スキャンボタンをクリック
    await page.click('#scan-btn');
    
    // スキャン完了まで待機
    await page.waitForSelector('#scan-btn:not(:has-text("スキャン中"))', { timeout: 300000 }); // 5分タイムアウト

    // スキャン完了時間を記録
    const endTime = Date.now();
    const scanDuration = endTime - startTime;

    // スキャン時間が5分以内であることを確認
    expect(scanDuration).toBeLessThan(300000); // 5分

    // 結果が表示されることを確認
    await expect(page.locator('#blur-table')).toBeVisible();
  });

  test('メモリ使用量の監視', async ({ page }) => {
    // 初期メモリ使用量を取得
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    // 大量のデータを処理
    await page.evaluate(() => {
      // 大量のデータを生成
      const largeData = [];
      for (let i = 0; i < 10000; i++) {
        largeData.push({
          id: i,
          filename: `test-image-${i}.jpg`,
          size: Math.random() * 1000000,
          score: Math.random() * 100
        });
      }
      
      // グローバル変数に保存
      window.testData = largeData;
    });

    // 処理後のメモリ使用量を取得
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    // メモリ使用量の増加が許容範囲内であることを確認
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB以下
  });

  test('UI応答性のテスト', async ({ page }) => {
    // 大量のデータを表示
    await page.evaluate(() => {
      const largeData = [];
      for (let i = 0; i < 1000; i++) {
        largeData.push({
          id: i,
          filename: `test-image-${i}.jpg`,
          size: Math.random() * 1000000,
          score: Math.random() * 100
        });
      }
      
      // テーブルに大量データを表示
      const table = document.querySelector('#blur-table tbody');
      if (table) {
        largeData.forEach(item => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td><input type="checkbox" data-id="${item.id}"></td>
            <td>${item.filename}</td>
            <td>${item.size}</td>
            <td>${item.score}</td>
          `;
          table.appendChild(row);
        });
      }
    });

    // UI操作の応答性をテスト
    const startTime = Date.now();
    
    // タブ切り替え
    await page.click('#similar-tab');
    await page.click('#blur-tab');
    
    // スクロール
    await page.evaluate(() => {
      const table = document.querySelector('#blur-table');
      if (table) {
        table.scrollTop = table.scrollHeight;
      }
    });
    
    // フィルター操作
    await page.fill('#filter-input', 'test');
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // UI操作の応答時間が1秒以内であることを確認
    expect(responseTime).toBeLessThan(1000);
  });

  test('並び替え性能', async ({ page }) => {
    // 大量データを準備
    await page.evaluate(() => {
      const largeData = [];
      for (let i = 0; i < 5000; i++) {
        largeData.push({
          id: i,
          filename: `test-image-${i}.jpg`,
          size: Math.random() * 1000000,
          score: Math.random() * 100,
          date: new Date(Date.now() - Math.random() * 1000000000).toISOString()
        });
      }
      
      // テーブルにデータを表示
      const table = document.querySelector('#blur-table tbody');
      if (table) {
        largeData.forEach(item => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td><input type="checkbox" data-id="${item.id}"></td>
            <td>${item.filename}</td>
            <td>${item.size}</td>
            <td>${item.date}</td>
            <td>${item.score}</td>
          `;
          table.appendChild(row);
        });
      }
    });

    // 各並び替え操作の時間を測定
    const sortTests = [
      { selector: '[data-sort="filename"]', name: 'ファイル名' },
      { selector: '[data-sort="size"]', name: 'サイズ' },
      { selector: '[data-sort="date"]', name: '日時' },
      { selector: '[data-sort="score"]', name: 'スコア' }
    ];

    for (const sortTest of sortTests) {
      const startTime = Date.now();
      await page.click(sortTest.selector);
      
      // 並び替え完了まで待機
      await page.waitForTimeout(100);
      
      const endTime = Date.now();
      const sortTime = endTime - startTime;

      // 並び替え時間が500ms以内であることを確認
      expect(sortTime).toBeLessThan(500);
    }
  });

  test('フィルター性能', async ({ page }) => {
    // 大量データを準備
    await page.evaluate(() => {
      const largeData = [];
      for (let i = 0; i < 3000; i++) {
        largeData.push({
          id: i,
          filename: `test-image-${i}.jpg`,
          size: Math.random() * 1000000,
          score: Math.random() * 100
        });
      }
      
      // テーブルにデータを表示
      const table = document.querySelector('#blur-table tbody');
      if (table) {
        largeData.forEach(item => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td><input type="checkbox" data-id="${item.id}"></td>
            <td>${item.filename}</td>
            <td>${item.size}</td>
            <td>${item.score}</td>
          `;
          table.appendChild(row);
        });
      }
    });

    // フィルター操作の時間を測定
    const filterTests = [
      { value: 'test', name: '部分一致' },
      { value: 'image-100', name: '特定ファイル' },
      { value: 'jpg', name: '拡張子' },
      { value: '', name: 'クリア' }
    ];

    for (const filterTest of filterTests) {
      const startTime = Date.now();
      await page.fill('#filter-input', filterTest.value);
      
      // フィルター適用まで待機
      await page.waitForTimeout(100);
      
      const endTime = Date.now();
      const filterTime = endTime - startTime;

      // フィルター時間が300ms以内であることを確認
      expect(filterTime).toBeLessThan(300);
    }
  });

  test('エクスポート性能', async ({ page }) => {
    // 大量データを準備
    await page.evaluate(() => {
      const largeData = [];
      for (let i = 0; i < 2000; i++) {
        largeData.push({
          id: i,
          filename: `test-image-${i}.jpg`,
          size: Math.random() * 1000000,
          score: Math.random() * 100,
          date: new Date().toISOString()
        });
      }
      
      // グローバル変数に保存
      window.currentResults = {
        blurImages: largeData,
        similarImages: [],
        errors: []
      };
    });

    // エクスポートボタンをクリック
    await page.click('#export-btn');
    
    // CSV形式を選択
    await page.click('input[name="export-format"][value="csv"]');
    
    // エクスポート開始時間を記録
    const startTime = Date.now();
    
    // エクスポート実行
    await page.click('#export-report');
    
    // エクスポート完了まで待機
    await page.waitForSelector('#export-report-panel', { state: 'hidden' });
    
    const endTime = Date.now();
    const exportTime = endTime - startTime;

    // エクスポート時間が10秒以内であることを確認
    expect(exportTime).toBeLessThan(10000);
  });

  test('長時間動作テスト', async ({ page }) => {
    // 30分間の長時間動作テスト（実際のテストでは短縮）
    const testDuration = 60000; // 1分間
    const startTime = Date.now();
    
    while (Date.now() - startTime < testDuration) {
      // ランダムな操作を実行
      const operations = [
        () => page.click('#blur-tab'),
        () => page.click('#similar-tab'),
        () => page.click('#error-tab'),
        () => page.click('#settings-btn').then(() => page.click('#close-settings')),
        () => page.click('#export-btn').then(() => page.click('#close-export-panel')),
        () => page.click('#log-btn').then(() => page.click('#close-log-viewer'))
      ];
      
      const randomOperation = operations[Math.floor(Math.random() * operations.length)];
      await randomOperation();
      
      // 少し待機
      await page.waitForTimeout(1000);
    }
    
    // アプリが正常に動作し続けていることを確認
    await expect(page.locator('h1')).toContainText('画像整理アシスタント');
  });
}); 