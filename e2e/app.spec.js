const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('アプリケーション基本機能 E2Eテスト', () => {
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
        send: () => {},
        showConfirmDialog: () => Promise.resolve({ response: 0 }),
        showErrorDialog: () => Promise.resolve(),
        openFile: () => Promise.resolve()
      };
    });
  });

  test('アプリケーションが正常に起動する', async ({ page }) => {
    // ページタイトルを確認
    await expect(page).toHaveTitle(/Image Cleaner/);
    
    // 主要なUI要素が表示されることを確認
    await expect(page.locator('#targetFolder')).toBeVisible();
    await expect(page.locator('#scanButton')).toBeVisible();
    await expect(page.locator('#settingsButton')).toBeVisible();
  });

  test('フォルダ選択機能が動作する', async ({ page }) => {
    await page.click('#targetFolder');
    
    // フォルダ選択後にパスが表示されることを確認
    await expect(page.locator('#targetFolderPathDisplay')).toBeVisible();
    await expect(page.locator('#targetFolderPathDisplay')).toContainText('/fake/path');
  });

  test('スキャンボタンが正常に動作する', async ({ page }) => {
    await page.click('#targetFolder');
    await page.click('#scanButton');
    
    // スキャンが開始されることを確認
    await expect(page.locator('#progressMessage')).toBeVisible();
    await expect(page.locator('#progressBar')).toBeVisible();
  });

  test('設定ボタンが正常に動作する', async ({ page }) => {
    await page.click('#settingsButton');
    
    // 設定モーダルが表示されることを確認
    await expect(page.locator('#settingsModal')).toBeVisible();
  });

  test('タブ切り替えが正常に動作する', async ({ page }) => {
    // ブレ画像タブ
    await page.click('[data-tab="blur"]');
    await expect(page.locator('[data-tab="blur"]')).toHaveClass(/tab-active/);
    await expect(page.locator('#contentBlur')).toBeVisible();
    
    // 類似画像タブ
    await page.click('[data-tab="similar"]');
    await expect(page.locator('[data-tab="similar"]')).toHaveClass(/tab-active/);
    await expect(page.locator('#contentSimilar')).toBeVisible();
    await expect(page.locator('#similarTablePane')).toBeVisible();
    
    // エラータブ
    await page.click('[data-tab="error"]');
    await expect(page.locator('[data-tab="error"]')).toHaveClass(/tab-active/);
    await expect(page.locator('#contentError')).toBeVisible();
  });

  test('プレビューエリアが表示される', async ({ page }) => {
    // プレビューエリアが存在することを確認
    await expect(page.locator('#previewPane')).toBeVisible();
    await expect(page.locator('#previewAreaContainer')).toBeVisible();
    await expect(page.locator('#imageInfoArea')).toBeVisible();
  });

  test('フッターエリアが表示される', async ({ page }) => {
    // フッターエリアが存在することを確認
    await expect(page.locator('#selectedCount')).toBeVisible();
    await expect(page.locator('#selectedSize')).toBeVisible();
    await expect(page.locator('#copyBtn')).toBeVisible();
    await expect(page.locator('#deleteBtn')).toBeVisible();
    await expect(page.locator('#moveBtn')).toBeVisible();
  });

  test('アクションボタンが初期状態で無効化されている', async ({ page }) => {
    // 初期状態ではアクションボタンが無効化されていることを確認
    await expect(page.locator('#copyBtn')).toBeDisabled();
    await expect(page.locator('#deleteBtn')).toBeDisabled();
    await expect(page.locator('#moveBtn')).toBeDisabled();
  });

  test('カウント表示が正常に動作する', async ({ page }) => {
    // 初期状態のカウントを確認
    await expect(page.locator('#countBlur')).toContainText('0');
    await expect(page.locator('#countSimilar')).toContainText('0');
    await expect(page.locator('#countError')).toContainText('0');
  });

  test('高度なフィルタリングパネルが表示される', async ({ page }) => {
    // 高度なフィルタリングパネルを表示
    await page.evaluate(() => {
      document.getElementById('advancedFilterPanel').classList.remove('hidden');
    });
    
    // フィルタリングパネルが表示されることを確認
    await expect(page.locator('#advancedFilterPanel')).toBeVisible();
    await expect(page.locator('#dateFrom')).toBeVisible();
    await expect(page.locator('#dateTo')).toBeVisible();
    await expect(page.locator('#filenamePattern')).toBeVisible();
    await expect(page.locator('#sizeFrom')).toBeVisible();
    await expect(page.locator('#sizeTo')).toBeVisible();
  });

  test('レスポンシブデザインが動作する', async ({ page }) => {
    // モバイルサイズに変更
    await page.setViewportSize({ width: 375, height: 667 });
    
    // レスポンシブ対応の要素が表示されることを確認
    await expect(page.locator('.footer-actions-responsive')).toBeVisible();
    
    // デスクトップサイズに戻す
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('キーボードナビゲーションが動作する', async ({ page }) => {
    // Tabキーでフォーカス移動
    await page.keyboard.press('Tab');
    await expect(page.locator('#targetFolder')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('#scanButton')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('#settingsButton')).toBeFocused();
  });

  test('エラーハンドリングが正常に動作する', async ({ page }) => {
    // エラー状態をシミュレート
    await page.evaluate(() => {
      window.electronAPI.selectFolder = () => Promise.reject(new Error('フォルダ選択エラー'));
    });
    
    await page.click('#targetFolder');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('.error-message, [role="alert"]')).toBeVisible();
  });

  test('ローディング状態が正常に表示される', async ({ page }) => {
    await page.click('#targetFolder');
    await page.click('#scanButton');
    
    // ローディング状態が表示されることを確認
    await expect(page.locator('#progressMessage')).toBeVisible();
    await expect(page.locator('#progressBar')).toBeVisible();
  });
}); 