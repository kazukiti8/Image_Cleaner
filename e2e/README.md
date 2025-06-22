# E2Eテスト

このディレクトリには、画像整理アプリケーションのE2E（End-to-End）テストが含まれています。

## 概要

E2Eテストは、実際のユーザー操作をシミュレートして、アプリケーション全体の動作を検証します。Playwrightを使用して、ブラウザ環境でのテストを実行します。

## テストファイル

### `app.spec.js`
- アプリケーションの基本機能テスト
- UI操作の検証
- レスポンシブデザインのテスト
- キーボードショートカットのテスト

### `image-analysis.spec.js`
- 画像分析機能のテスト
- スキャン機能の検証
- 結果表示のテスト
- エラーハンドリングのテスト

### `performance.spec.js`
- パフォーマンステスト
- 大量データでの動作確認
- メモリ使用量の監視
- UI応答性のテスト

### `accessibility.spec.js`
- アクセシビリティテスト
- キーボードナビゲーション
- ARIA属性の確認
- スクリーンリーダー対応

## 実行方法

### 全テストの実行
```bash
npm run test:e2e
```

### 特定のテストファイルの実行
```bash
npx playwright test e2e/app.spec.js
npx playwright test e2e/image-analysis.spec.js
npx playwright test e2e/performance.spec.js
npx playwright test e2e/accessibility.spec.js
```

### ヘッドレスモードでの実行
```bash
npx playwright test --headed
```

### 特定のブラウザでの実行
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## テスト用画像ファイル

E2Eテストを実行するには、テスト用の画像ファイルが必要です。

### 必要な画像ファイル

1. **通常の画像ファイル**
   - `test-images/normal1.jpg`
   - `test-images/normal2.jpg`
   - `test-images/normal3.jpg`

2. **ブレ画像ファイル**
   - `test-images/blur1.jpg`
   - `test-images/blur2.jpg`
   - `test-images/blur3.jpg`

3. **類似画像ファイル**
   - `test-images/similar1.jpg`
   - `test-images/similar2.jpg`
   - `test-images/similar3.jpg`

### 画像ファイルの準備方法

1. **手動で画像を用意**
   - 実際の画像ファイルを `test-images/` フォルダに配置
   - ファイル名は上記の命名規則に従う

2. **テスト用画像の生成**
   - 画像編集ソフトでテスト用画像を作成
   - オンラインの画像生成ツールを使用

3. **サンプル画像の使用**
   - 公開されているサンプル画像を使用
   - 著作権に注意して適切な画像を選択

### 画像ファイルの要件

- **形式**: JPG, PNG, GIF, BMP
- **サイズ**: 100KB - 10MB
- **解像度**: 640x480 - 1920x1080
- **数量**: 各カテゴリ3-5枚程度

## テストの注意事項

### 環境依存
- Electronアプリケーションのため、実際のファイルシステム操作が必要
- テスト用の画像ファイルが存在しない場合、一部のテストが失敗する可能性

### パフォーマンス
- 画像分析処理は時間がかかるため、タイムアウト設定を適切に行う
- 大量の画像ファイルでのテストは時間がかかる

### モックとスタブ
- 一部の機能はモックを使用してテスト
- 実際のファイル操作は最小限に抑制

## トラブルシューティング

### テストが失敗する場合

1. **画像ファイルの確認**
   ```bash
   ls test-images/
   ```

2. **Playwrightの再インストール**
   ```bash
   npx playwright install
   ```

3. **ブラウザの更新**
   ```bash
   npx playwright install --with-deps
   ```

4. **テストのデバッグ**
   ```bash
   npx playwright test --debug
   ```

### よくある問題

- **画像ファイルが見つからない**: `test-images/` フォルダに適切な画像ファイルを配置
- **タイムアウトエラー**: 画像分析処理の時間を延長するか、テスト用の軽量な画像を使用
- **メモリ不足**: テスト用の画像サイズを小さくする

## カスタマイズ

### テスト設定の変更

`playwright.config.js` で以下の設定を変更できます：

- タイムアウト時間
- ブラウザ設定
- テスト環境の設定

### 新しいテストの追加

1. 新しいテストファイルを作成
2. テストケースを実装
3. `package.json` のテストスクリプトに追加

## 継続的インテグレーション

### GitHub Actions

```yaml
- name: Run E2E tests
  run: npm run test:e2e
```

### ローカル開発

```bash
# 開発中にテストを実行
npm run test:e2e:watch
```

## レポート

テスト実行後、以下のレポートが生成されます：

- HTMLレポート: `playwright-report/index.html`
- JUnitレポート: `test-results/results.xml`
- スクリーンショット: 失敗したテストの画像

## 参考資料

- [Playwright公式ドキュメント](https://playwright.dev/)
- [E2Eテストのベストプラクティス](https://playwright.dev/docs/best-practices)
- [画像処理テストのガイドライン](https://playwright.dev/docs/test-assertions) 