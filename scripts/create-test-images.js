const fs = require('fs');
const path = require('path');

// テスト用画像ディレクトリの作成
const testImageDir = path.join(process.cwd(), 'test-images');

if (!fs.existsSync(testImageDir)) {
  fs.mkdirSync(testImageDir, { recursive: true });
  console.log('test-images ディレクトリを作成しました');
}

// テスト用のダミー画像ファイルを作成
const createDummyImage = (filename, size = 1024) => {
  const filePath = path.join(testImageDir, filename);
  
  // 簡単なJPEGヘッダー（実際の画像ではないが、ファイルとして認識される）
  const jpegHeader = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00
  ]);
  
  // ダミーデータを追加
  const dummyData = Buffer.alloc(size - jpegHeader.length, 0x00);
  const imageData = Buffer.concat([jpegHeader, dummyData]);
  
  fs.writeFileSync(filePath, imageData);
  console.log(`作成: ${filename}`);
};

// テスト用画像ファイルのリスト
const testImages = [
  // 通常の画像
  'normal1.jpg',
  'normal2.jpg', 
  'normal3.jpg',
  'normal4.png',
  'normal5.gif',
  
  // ブレ画像
  'blur1.jpg',
  'blur2.jpg',
  'blur3.jpg',
  
  // 類似画像
  'similar1.jpg',
  'similar2.jpg',
  'similar3.jpg',
  
  // エラー画像（破損ファイル）
  'error1.jpg',
  'error2.jpg',
  
  // 大きな画像
  'large1.jpg',
  'large2.jpg',
  
  // 小さな画像
  'small1.jpg',
  'small2.jpg'
];

console.log('テスト用画像ファイルを作成中...');

// 各画像ファイルを作成
testImages.forEach((filename, index) => {
  // ファイルサイズをランダムに設定（1KB - 100KB）
  const size = Math.floor(Math.random() * 99 * 1024) + 1024;
  createDummyImage(filename, size);
});

console.log(`\n${testImages.length}個のテスト用画像ファイルを作成しました`);
console.log(`場所: ${testImageDir}`);

// サブディレクトリも作成
const subDirs = ['subfolder1', 'subfolder2', 'nested/deep/folder'];

subDirs.forEach(dir => {
  const fullPath = path.join(testImageDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`ディレクトリ作成: ${dir}`);
    
    // サブディレクトリにも画像ファイルを作成
    for (let i = 1; i <= 3; i++) {
      const filename = `sub_${dir.replace(/\//g, '_')}_${i}.jpg`;
      const filePath = path.join(fullPath, filename);
      const size = Math.floor(Math.random() * 50 * 1024) + 1024;
      
      const jpegHeader = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00
      ]);
      const dummyData = Buffer.alloc(size - jpegHeader.length, 0x00);
      const imageData = Buffer.concat([jpegHeader, dummyData]);
      
      fs.writeFileSync(filePath, imageData);
      console.log(`作成: ${dir}/${filename}`);
    }
  }
});

console.log('\nテスト用画像ファイルの作成が完了しました！');
console.log('注意: これらのファイルは実際の画像ではありません。');
console.log('実際のテストでは、本物の画像ファイルを使用することをお勧めします。'); 