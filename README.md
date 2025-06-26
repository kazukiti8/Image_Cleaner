# イメージクリーンアップアシスタント

PC内の画像ファイルを自動的に分析し、不要な画像（ブレ画像や類似画像）を検出・整理するためのデスクトップアプリケーションです。

## 機能

- **ブレ画像検出**: 手ブレ、ピンボケ、被写体ブレを0-100のスコアで評価
- **類似画像検出**: 完全同一画像と類似画像を検出
- **画像整理**: 検出された画像を削除または移動
- **直感的なUI**: 3ペイン構成の使いやすいインターフェース
- **レスポンシブ対応**: 画面サイズに応じたレイアウト調整

## 対応画像形式

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- TIFF (.tiff, .tif)

## システム要件

- Windows 10 (64bit) 以降
- 推奨環境: Intel Core i5相当、8GB RAM、SATA SSD

## インストール方法

### 方法1: インストーラー版（推奨）

1. [Releases](https://github.com/kazukiti8/Image_Cleaner/releases) ページから最新版のインストーラー（.exe）をダウンロード
2. ダウンロードしたファイルを実行
3. インストールウィザードの指示に従ってインストール
4. デスクトップまたはスタートメニューからアプリを起動

### 方法2: ポータブル版

1. [Releases](https://github.com/kazukiti8/Image_Cleaner/releases) ページからポータブル版（.exe）をダウンロード
2. 任意のフォルダに解凍
3. `Image Cleanup Assistant.exe` を実行

## 開発環境のセットアップ

### 前提条件

- Node.js 16.0.0 以降
- npm または yarn

### 1. リポジトリのクローン

```bash
git clone https://github.com/kazukiti8/Image_Cleaner.git
cd Image_Cleaner
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 開発モードでの起動

```bash
npm run dev
```

### 4. 本番ビルド

```bash
# Windows用ポータブル版
npm run build:win-portable

# Windows用インストーラー版
npm run build:win-installer

# 全プラットフォーム用
npm run build
```

## 使用方法

1. **フォルダ選択**: 「対象フォルダ」ボタンから整理したい画像が保存されているフォルダを選択
2. **スキャン開始**: 「スキャン開始」ボタンを押して画像分析を開始
3. **結果確認**: タブを切り替えてブレ画像、類似画像、エラーを確認
4. **画像整理**: 不要な画像を選択して削除または移動

## キーボードショートカット

- `Ctrl+O`: 対象フォルダ選択
- `Ctrl+Shift+O`: 移動先フォルダ選択
- `F5`: スキャン開始
- `Ctrl+,`: 設定画面

## プロジェクト構造

```
ImageCleanupAssistant/
├── src/
│   ├── main/           # Electronメインプロセス
│   ├── preload/        # プリロードスクリプト
│   ├── renderer/       # UIとレンダラープロセス
│   │   ├── html/       # HTMLファイル
│   │   ├── js/         # JavaScriptファイル
│   │   ├── css/        # スタイルシート
│   │   └── assets/     # 画像・アイコン
│   └── common/         # 共通モジュール
├── docs/               # ドキュメント
├── mockups/            # UIモックアップ
├── build/              # ビルド設定
├── dist/               # ビルド成果物
└── tests/              # テストコード
```

## 開発

### 技術スタック

- **フレームワーク**: Electron
- **UI**: HTML + CSS (Tailwind CSS)
- **フォント**: Inter
- **アイコン**: Google Fonts Icons
- **言語**: JavaScript

### 開発ガイドライン

- UIデザインは `docs/UIデザインガイドライン.txt` に従う
- コードは `docs/アプリケーション詳細設計書.txt` の仕様に従う
- 新機能追加時は要件定義書を確認する

### テスト

```bash
# 単体テスト
npm run test

# E2Eテスト
npm run test:e2e

# 全テスト実行
npm run test:all
```

## 配布

### リリース作成

1. バージョンを更新（package.json）
2. 本番ビルドを実行
3. GitHub Releasesで配布ファイルをアップロード

### 配布ファイル

- `Image Cleanup Assistant-{version}-x64.exe` - Windows用インストーラー
- `Image Cleanup Assistant-{version}-portable.exe` - Windows用ポータブル版

## トラブルシューティング

### よくある問題

1. **アプリが起動しない**
   - Windows Defenderの除外設定を確認
   - 管理者権限で実行を試行

2. **画像分析が遅い**
   - 対象フォルダの画像数を確認
   - 他のアプリケーションを終了してメモリを確保

3. **エラーが発生する**
   - ログファイル（%APPDATA%/Image Cleanup Assistant/app.log）を確認

## ライセンス

MIT License

## 貢献

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## サポート

問題や質問がある場合は、GitHubのIssuesページで報告してください。 