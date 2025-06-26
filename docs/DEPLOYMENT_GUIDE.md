# デプロイメントガイド

このガイドでは、Image Cleanup Assistantを本番環境にデプロイする手順を説明します。

## 📋 前提条件

- Node.js 16.0.0 以降
- npm または yarn
- Git
- Windows 10 (64bit) 以降（ビルド環境）

## 🚀 本番ビルド手順

### 1. リポジトリの準備

```bash
# リポジトリをクローン
git clone https://github.com/kazukiti8/Image_Cleaner.git
cd Image_Cleaner

# 最新の変更を取得
git pull origin main
```

### 2. 依存関係のインストール

```bash
# 依存関係をインストール
npm install

# Electron Builderの依存関係をインストール
npm run postinstall
```

### 3. テストの実行

```bash
# 全テストを実行
npm run test:all
```

### 4. 本番ビルド

#### 方法1: 自動ビルドスクリプト（推奨）

```bash
# Windows用ポータブル版
npm run build:prod:win-portable

# Windows用インストーラー版
npm run build:prod:win-installer

# 全Windows版
npm run build:prod:win
```

#### 方法2: 手動ビルド

```bash
# CSSをビルド
npm run build:css:prod

# Windows用ポータブル版
npm run build:win-portable

# Windows用インストーラー版
npm run build:win-installer
```

### 5. ビルド結果の確認

```bash
# distディレクトリの内容を確認
ls dist/
```

生成されるファイル：
- `Image Cleanup Assistant-{version}-x64.exe` - インストーラー版
- `Image Cleanup Assistant-{version}-portable.exe` - ポータブル版

## 📦 GitHub Releasesでの配布

### 1. タグの作成

```bash
# バージョンを更新（package.json）
# 例: "version": "1.0.1"

# タグを作成
git add .
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

### 2. GitHub Releasesの作成

1. GitHubのリポジトリページにアクセス
2. "Releases" をクリック
3. "Create a new release" をクリック
4. タグを選択（例: v1.0.1）
5. タイトルを入力（例: "Image Cleanup Assistant v1.0.1"）
6. リリースノートを入力（`docs/RELEASE_TEMPLATE.md`を参考）
7. ビルドしたファイルをアップロード
8. "Publish release" をクリック

## 🔧 ビルド設定のカスタマイズ

### package.jsonの設定

```json
{
  "build": {
    "appId": "com.imagecleanup.assistant",
    "productName": "Image Cleanup Assistant",
    "directories": {
      "output": "dist"
    },
    "files": [
      "src/**/*",
      "package.json",
      "node_modules/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "portable",
          "arch": ["x64"]
        },
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    }
  }
}
```

### アイコンの設定

1. `src/renderer/assets/icons/app-icon.ico` を配置
2. 複数サイズ（16x16, 32x32, 48x48, 256x256）を含める

## 🧪 ビルド前のチェックリスト

- [ ] すべてのテストが通る
- [ ] 開発モードでアプリが正常に動作する
- [ ] アイコンファイルが存在する
- [ ] バージョン番号が正しく設定されている
- [ ] リリースノートが準備されている

## 🚨 トラブルシューティング

### よくある問題

1. **ビルドが失敗する**
   - Node.jsのバージョンを確認
   - `npm install` を再実行
   - ディスク容量を確認

2. **アイコンが表示されない**
   - .icoファイルの形式を確認
   - 複数サイズが含まれているか確認

3. **ファイルサイズが大きい**
   - 不要なファイルが含まれていないか確認
   - 圧縮設定を確認

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. ログファイル（`%APPDATA%/Image Cleanup Assistant/app.log`）
2. GitHub Issues
3. 開発チームへの連絡

---

**最終更新**: 2024年12月 