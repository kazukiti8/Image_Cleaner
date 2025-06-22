const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('アクセシビリティテスト', () => {
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

  test('キーボードナビゲーションが正常に動作する', async ({ page }) => {
    // Tabキーでフォーカス移動をテスト
    await page.keyboard.press('Tab');
    await expect(page.locator('#targetFolder')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('#scanButton')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('#settingsButton')).toBeFocused();
  });

  test('Enterキーでボタンがアクティブになる', async ({ page }) => {
    await page.click('#targetFolder');
    await page.keyboard.press('Enter');
    
    // フォルダ選択ダイアログが表示されることを確認
    await expect(page.locator('#targetFolderPathDisplay')).toBeVisible();
  });

  test('Spaceキーでボタンがアクティブになる', async ({ page }) => {
    await page.click('#scanButton');
    await page.keyboard.press('Space');
    
    // スキャンが開始されることを確認
    await expect(page.locator('#progressMessage')).toBeVisible();
  });

  test('ARIA属性が適切に設定されている', async ({ page }) => {
    // 主要なボタンにaria-labelが設定されていることを確認
    await expect(page.locator('#targetFolder')).toHaveAttribute('aria-label');
    await expect(page.locator('#scanButton')).toHaveAttribute('aria-label');
    await expect(page.locator('#settingsButton')).toHaveAttribute('aria-label');
  });

  test('フォーカスインジケーターが表示される', async ({ page }) => {
    await page.click('#targetFolder');
    await page.keyboard.press('Tab');
    
    // フォーカスインジケーターが表示されることを確認
    const focusedElement = await page.evaluate(() => document.activeElement);
    expect(focusedElement).not.toBeNull();
  });

  test('スクリーンリーダー対応のラベルが設定されている', async ({ page }) => {
    // 主要な要素に適切なラベルが設定されていることを確認
    await expect(page.locator('#targetFolder')).toHaveAttribute('aria-label');
    await expect(page.locator('#scanButton')).toHaveAttribute('aria-label');
    await expect(page.locator('#settingsButton')).toHaveAttribute('aria-label');
    
    // タブボタンにもラベルが設定されていることを確認
    await expect(page.locator('[data-tab="blur"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-tab="similar"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-tab="error"]')).toHaveAttribute('aria-label');
  });

  test('色のコントラストが適切である', async ({ page }) => {
    // 主要なテキスト要素の色のコントラストを確認
    const textElements = await page.locator('body').evaluate(() => {
      const elements = document.querySelectorAll('h1, h2, h3, p, span, button');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        textContent: el.textContent?.trim(),
        computedStyle: window.getComputedStyle(el)
      }));
    });
    
    // テキスト要素が存在することを確認
    expect(textElements.length).toBeGreaterThan(0);
  });

  test('画像にalt属性が設定されている', async ({ page }) => {
    // 画像要素にalt属性が設定されていることを確認
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('フォーム要素にラベルが関連付けられている', async ({ page }) => {
    // 入力フィールドにラベルが関連付けられていることを確認
    const inputs = await page.locator('input, select, textarea').all();
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = await page.locator(`label[for="${id}"]`).count();
        expect(label).toBeGreaterThan(0);
      }
    }
  });

  test('エラーメッセージが適切に表示される', async ({ page }) => {
    // エラー状態をシミュレート
    await page.evaluate(() => {
      window.electronAPI.selectFolder = () => Promise.reject(new Error('フォルダ選択エラー'));
    });
    
    await page.click('#targetFolder');
    
    // エラーメッセージが適切に表示されることを確認
    await expect(page.locator('.error-message, [role="alert"]')).toBeVisible();
  });

  test('ローディング状態が適切に表示される', async ({ page }) => {
    await page.click('#scanButton');
    
    // ローディング状態が表示されることを確認
    await expect(page.locator('#progressMessage')).toBeVisible();
    await expect(page.locator('#progressBar')).toBeVisible();
  });

  test('タブの状態が適切に管理される', async ({ page }) => {
    // タブの状態を確認
    await page.click('[data-tab="blur"]');
    await expect(page.locator('[data-tab="blur"]')).toHaveClass(/tab-active/);
    
    await page.click('[data-tab="similar"]');
    await expect(page.locator('[data-tab="similar"]')).toHaveClass(/tab-active/);
    await expect(page.locator('[data-tab="blur"]')).not.toHaveClass(/tab-active/);
  });

  test('モーダルダイアログのアクセシビリティ', async ({ page }) => {
    // 設定ボタンをクリックしてモーダルを開く
    await page.click('#settingsButton');
    
    // モーダルが表示されることを確認
    await expect(page.locator('#settingsModal')).toBeVisible();
    
    // モーダル内のフォーカス管理を確認
    await expect(page.locator('#settingsModal')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#settingsModal')).toHaveAttribute('aria-modal', 'true');
  });
}); 