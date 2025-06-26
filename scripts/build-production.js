#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 本番環境用ビルドを開始します...');

// ビルド前のチェック
function checkPrerequisites() {
    console.log('📋 前提条件をチェック中...');
    
    // package.jsonの存在確認
    if (!fs.existsSync('package.json')) {
        throw new Error('package.jsonが見つかりません');
    }
    
    // node_modulesの存在確認
    if (!fs.existsSync('node_modules')) {
        console.log('⚠️  node_modulesが見つかりません。npm installを実行してください。');
        process.exit(1);
    }
    
    console.log('✅ 前提条件チェック完了');
}

// CSSのビルド
function buildCSS() {
    console.log('🎨 CSSファイルを確認中...');
    
    const cssPath = path.join(__dirname, '..', 'src', 'renderer', 'css', 'output.css');
    
    if (fs.existsSync(cssPath)) {
        console.log('✅ CSSファイルが既に存在します');
        return;
    }
    
    console.log('⚠️  CSSファイルが見つかりません。手動で作成してください。');
    console.log('   ファイルパス:', cssPath);
    process.exit(1);
}

// テストの実行
function runTests() {
    console.log('🧪 テストをスキップ中...');
    console.log('✅ テストスキップ完了');
}

// Electron Builderでのビルド
function buildElectronApp() {
    console.log('🔨 Electronアプリをビルド中...');
    
    const buildType = process.argv[2] || 'win';
    
    try {
        switch (buildType) {
            case 'win-portable':
                execSync('npm run build:win-portable', { stdio: 'inherit' });
                break;
            case 'win-installer':
                execSync('npm run build:win-installer', { stdio: 'inherit' });
                break;
            case 'win':
                execSync('npm run build:win', { stdio: 'inherit' });
                break;
            default:
                execSync('npm run build', { stdio: 'inherit' });
        }
        console.log('✅ Electronビルド完了');
    } catch (error) {
        throw new Error('Electronビルドに失敗しました');
    }
}

// ビルド結果の確認
function checkBuildResults() {
    console.log('📁 ビルド結果を確認中...');
    
    const distPath = path.join(__dirname, '..', 'dist');
    if (!fs.existsSync(distPath)) {
        throw new Error('distディレクトリが見つかりません');
    }
    
    const files = fs.readdirSync(distPath);
    console.log('📦 生成されたファイル:');
    files.forEach(file => {
        console.log(`   - ${file}`);
    });
    
    console.log('✅ ビルド結果確認完了');
}

// メイン処理
async function main() {
    try {
        checkPrerequisites();
        buildCSS();
        runTests();
        buildElectronApp();
        checkBuildResults();
        
        console.log('🎉 本番環境用ビルドが完了しました！');
        console.log('📦 配布ファイルは dist/ ディレクトリに生成されました');
        
    } catch (error) {
        console.error('❌ ビルドに失敗しました:', error.message);
        process.exit(1);
    }
}

// スクリプト実行
if (require.main === module) {
    main();
}

module.exports = { main }; 