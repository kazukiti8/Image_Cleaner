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
- Node.js 16.0.0 以降
- 推奨環境: Intel Core i5相当、8GB RAM、SATA SSD

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発モードでの起動

```bash
npm run dev
```

### 3. 本番ビルド

```bash
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
├── build/              # ビルド成果物
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

## ライセンス

ISC License

## 貢献

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## サポート

問題や質問がある場合は、GitHubのIssuesページで報告してください。 