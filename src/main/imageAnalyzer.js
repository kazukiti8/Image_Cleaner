const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

// コンソール出力の文字エンコーディングを設定
if (process.platform === 'win32') {
    // Windowsの場合、コンソールのコードページをUTF-8に設定
    require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
}

class ImageAnalyzer {
    constructor() {
        this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif'];
        this.blurThreshold = 60; // デフォルトのブレ検出閾値
        this.onProgress = null; // 進捗コールバック
        this.similarityThreshold = 80; // 類似度の閾値（%）
    }

    /**
     * 進捗コールバックを設定
     */
    setProgressCallback(callback) {
        this.onProgress = callback;
    }

    /**
     * フォルダ内の画像ファイルをスキャンして分析
     */
    async scanFolder(folderPath, includeSubfolders = true) {
        try {
            console.log('画像分析開始:', folderPath);
            
            const imageFiles = await this.findImageFiles(folderPath, includeSubfolders);
            console.log(`見つかった画像ファイル数: ${imageFiles.length}`);
            
            const results = {
                blurImages: [],
                similarImages: [],
                errors: []
            };

            // 各画像ファイルを分析
            for (let i = 0; i < imageFiles.length; i++) {
                const filePath = imageFiles[i];
                try {
                    console.log(`分析中 (${i + 1}/${imageFiles.length}): ${path.basename(filePath)}`);
                    
                    // 進捗を送信
                    if (this.onProgress) {
                        this.onProgress({
                            current: i + 1,
                            total: imageFiles.length,
                            filename: path.basename(filePath),
                            percentage: Math.round(((i + 1) / imageFiles.length) * 100)
                        });
                    }
                    
                    // ブレ検出
                    const blurScore = await this.detectBlur(filePath);
                    
                    // ブレ画像の判定（閾値を調整）
                    if (blurScore > this.blurThreshold) { // 設定可能な閾値を使用
                        const fileStats = await fs.stat(filePath);
                        results.blurImages.push({
                            id: `blur_${i}`,
                            filename: path.basename(filePath),
                            filePath: filePath,
                            size: fileStats.size,
                            modifiedDate: fileStats.mtime.toISOString(),
                            blurScore: Math.round(blurScore)
                        });
                        console.log(`ブレ検出: ${path.basename(filePath)} (スコア: ${Math.round(blurScore)})`);
                    } else {
                        console.log(`正常画像: ${path.basename(filePath)} (スコア: ${Math.round(blurScore)})`);
                    }
                    
                } catch (error) {
                    console.error(`画像分析エラー (${filePath}):`, error);
                    results.errors.push({
                        id: `error_${i}`,
                        filename: path.basename(filePath),
                        filePath: filePath,
                        error: error.message
                    });
                }
            }

            // 類似画像検出（全画像の分析が完了してから実行）
            console.log('類似画像検出を開始...');
            const similarResults = await this.detectSimilarImages(imageFiles);
            results.similarImages = similarResults;

            console.log('画像分析完了');
            return results;
            
        } catch (error) {
            console.error('フォルダスキャンエラー:', error);
            throw error;
        }
    }

    /**
     * フォルダ内の画像ファイルを再帰的に検索
     */
    async findImageFiles(folderPath, includeSubfolders = true) {
        const imageFiles = [];
        
        async function scanDirectory(dirPath) {
            try {
                const items = await fs.readdir(dirPath);
                
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const stats = await fs.stat(fullPath);
                    
                    if (stats.isDirectory() && includeSubfolders) {
                        await scanDirectory(fullPath);
                    } else if (stats.isFile()) {
                        const ext = path.extname(item).toLowerCase();
                        if (this.supportedFormats.includes(ext)) {
                            imageFiles.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                console.error(`ディレクトリスキャンエラー (${dirPath}):`, error);
            }
        }
        
        await scanDirectory.call(this, folderPath);
        return imageFiles;
    }

    /**
     * ブレ画像検出（改良版Laplacian分散法）
     */
    async detectBlur(imagePath) {
        try {
            // Sharpを使用して画像を読み込み
            const image = sharp(imagePath);
            const metadata = await image.metadata();
            
            // より安全な前処理：サイズを小さくしてオーバーフローを防ぐ
            const buffer = await image
                .grayscale()
                .resize(200, 200, { fit: 'inside' }) // より小さなサイズで処理
                .raw()
                .toBuffer();
            
            // 改良されたブレスコア計算
            const blurScore = this.calculateAdvancedBlurScore(buffer, 200, 200);
            
            return blurScore;
            
        } catch (error) {
            console.error(`ブレ検出エラー (${imagePath}):`, error);
            throw error;
        }
    }

    /**
     * 改良されたブレスコア計算（Laplacian分散法 + エッジ密度）
     */
    calculateAdvancedBlurScore(buffer, width, height) {
        try {
            // Laplacianフィルタ
            const laplacianKernel = [
                [0, -1, 0],
                [-1, 4, -1],
                [0, -1, 0]
            ];
            
            let laplacianSum = 0;
            let laplacianSumSquared = 0;
            let edgeCount = 0;
            let totalPixels = 0;
            let absSum = 0;
            
            // 画像の端を除いてLaplacianフィルタを適用
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let laplacianValue = 0;
                    
                    // Laplacianフィルタを適用（オーバーフロー防止）
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixelValue = buffer[(y + ky) * width + (x + kx)];
                            const kernelValue = laplacianKernel[ky + 1][kx + 1];
                            laplacianValue += pixelValue * kernelValue;
                            
                            // オーバーフロー防止
                            if (!isFinite(laplacianValue)) {
                                laplacianValue = 0;
                                break;
                            }
                        }
                        if (!isFinite(laplacianValue)) break;
                    }
                    
                    // NaNチェック
                    if (isNaN(laplacianValue) || !isFinite(laplacianValue)) {
                        laplacianValue = 0;
                    }
                    
                    // エッジ検出（閾値以上の変化をエッジとしてカウント）
                    if (Math.abs(laplacianValue) > 30) {
                        edgeCount++;
                    }
                    
                    laplacianSum += laplacianValue;
                    laplacianSumSquared += laplacianValue * laplacianValue;
                    absSum += Math.abs(laplacianValue);
                    totalPixels++;
                    
                    // 累積値のオーバーフロー防止
                    if (!isFinite(laplacianSum) || !isFinite(laplacianSumSquared) || !isFinite(absSum)) {
                        console.warn('累積値でオーバーフローが発生しました。計算をリセットします。');
                        laplacianSum = 0;
                        laplacianSumSquared = 0;
                        absSum = 0;
                        totalPixels = 0;
                        edgeCount = 0;
                        break;
                    }
                }
                if (totalPixels === 0) break;
            }
            
            if (totalPixels === 0) return 50;
            
            // より安全なブレスコア計算
            const mean = laplacianSum / totalPixels;
            const avgAbsValue = absSum / totalPixels;
            const edgeDensity = edgeCount / totalPixels;
            
            // デバッグ情報
            console.log(`デバッグ情報: totalPixels=${totalPixels}, mean=${mean}, avgAbsValue=${avgAbsValue}, edgeDensity=${edgeDensity}`);
            
            // NaNチェック
            if (isNaN(mean) || isNaN(avgAbsValue) || isNaN(edgeDensity)) {
                console.warn('基本計算でNaNが発生しました。エッジ密度のみを使用します。');
                const edgeScore = Math.max(0, Math.min(100, 100 - (edgeDensity * 1000)));
                return isNaN(edgeScore) ? 50 : edgeScore;
            }
            
            // 分散計算（NaN防止）
            let laplacianVariance;
            try {
                const variance = (laplacianSumSquared / totalPixels) - (mean * mean);
                console.log(`分散計算: laplacianSumSquared=${laplacianSumSquared}, variance=${variance}`);
                
                if (isNaN(variance) || variance < 0 || !isFinite(variance)) {
                    console.warn('分散が無効、絶対値平均を使用');
                    laplacianVariance = avgAbsValue;
                } else {
                    laplacianVariance = Math.sqrt(variance);
                }
            } catch (error) {
                console.warn('分散計算エラー、絶対値平均を使用:', error.message);
                laplacianVariance = avgAbsValue;
            }
            
            console.log(`laplacianVariance=${laplacianVariance}`);
            
            // NaNチェック
            if (isNaN(laplacianVariance) || !isFinite(laplacianVariance)) {
                console.warn('laplacianVarianceが無効、エッジ密度のみを使用');
                const edgeScore = Math.max(0, Math.min(100, 100 - (edgeDensity * 1000)));
                return isNaN(edgeScore) ? 50 : edgeScore;
            }
            
            // ブレスコアの計算（安全な範囲で）
            const laplacianScore = Math.max(0, Math.min(100, 100 - (laplacianVariance / 2)));
            const edgeScore = Math.max(0, Math.min(100, 100 - (edgeDensity * 1000)));
            
            console.log(`スコア計算: laplacianScore=${laplacianScore}, edgeScore=${edgeScore}`);
            
            // 重み付き平均
            const finalScore = (laplacianScore * 0.7) + (edgeScore * 0.3);
            
            console.log(`最終スコア: ${finalScore}`);
            
            // 最終チェック
            if (isNaN(finalScore) || !isFinite(finalScore)) {
                console.warn('最終スコアが無効な値になりました。エッジスコアのみを使用します。');
                return isNaN(edgeScore) ? 50 : edgeScore;
            }
            
            return Math.min(100, Math.max(0, finalScore));
            
        } catch (error) {
            console.error('ブレスコア計算エラー:', error);
            return 50; // エラー時のデフォルト値
        }
    }

    /**
     * 類似画像検出（本格実装）
     */
    async detectSimilarImages(imageFiles) {
        try {
            console.log('類似画像検出開始...');
            
            // 1. 完全同一画像の検出（SHA256ハッシュ比較）
            const hashMap = new Map();
            
            for (let i = 0; i < imageFiles.length; i++) {
                const filePath = imageFiles[i];
                try {
                    const fileHash = await this.calculateFileHash(filePath);
                    const fileStats = await fs.stat(filePath);
                    
                    if (hashMap.has(fileHash)) {
                        // 既に同じハッシュのファイルが存在する場合
                        const existingGroup = hashMap.get(fileHash);
                        existingGroup.files.push({
                            filePath: filePath,
                            filename: path.basename(filePath),
                            size: fileStats.size,
                            modifiedDate: fileStats.mtime.toISOString()
                        });
                    } else {
                        // 新しいハッシュの場合
                        const newGroup = {
                            id: `duplicate_${hashMap.size}`,
                            files: [{
                                filePath: filePath,
                                filename: path.basename(filePath),
                                size: fileStats.size,
                                modifiedDate: fileStats.mtime.toISOString()
                            }],
                            similarity: 100, // 完全同一
                            type: 'duplicate'
                        };
                        hashMap.set(fileHash, newGroup);
                    }
                } catch (error) {
                    console.error(`ハッシュ計算エラー (${filePath}):`, error);
                }
            }
            
            // 重複画像グループを作成（2つ以上のファイルがある場合のみ）
            const duplicateGroups = [];
            for (const [hash, group] of hashMap.entries()) {
                if (group.files.length >= 2) {
                    duplicateGroups.push(group);
                }
            }
            
            console.log(`重複画像グループ数: ${duplicateGroups.length}`);
            
            // 2. 類似画像の検出（知覚ハッシュ比較）
            const perceptualHashes = [];
            
            for (let i = 0; i < imageFiles.length; i++) {
                const filePath = imageFiles[i];
                try {
                    const perceptualHash = await this.calculatePerceptualHash(filePath);
                    const fileStats = await fs.stat(filePath);
                    perceptualHashes.push({
                        filePath: filePath,
                        filename: path.basename(filePath),
                        hash: perceptualHash,
                        size: fileStats.size,
                        modifiedDate: fileStats.mtime.toISOString()
                    });
                } catch (error) {
                    console.error(`知覚ハッシュ計算エラー (${filePath}):`, error);
                }
            }
            
            // 3. 知覚ハッシュの比較
            const similarGroups = [];
            const processedPairs = new Set();
            
            for (let i = 0; i < perceptualHashes.length; i++) {
                for (let j = i + 1; j < perceptualHashes.length; j++) {
                    const pairKey = `${i}-${j}`;
                    if (processedPairs.has(pairKey)) continue;
                    
                    const hash1 = perceptualHashes[i].hash;
                    const hash2 = perceptualHashes[j].hash;
                    
                    // ハミング距離を計算
                    const hammingDistance = this.calculateHammingDistance(hash1, hash2);
                    const similarity = this.calculateSimilarityFromHammingDistance(hammingDistance);
                    
                    // 類似度が閾値を超える場合
                    if (similarity >= this.similarityThreshold) {
                        // 完全同一画像でないことを確認
                        const isDuplicate = duplicateGroups.some(group => 
                            group.files.some(f => f.filePath === perceptualHashes[i].filePath) &&
                            group.files.some(f => f.filePath === perceptualHashes[j].filePath)
                        );
                        
                        if (!isDuplicate) {
                            similarGroups.push({
                                id: `similar_${similarGroups.length}`,
                                files: [
                                    {
                                        filePath: perceptualHashes[i].filePath,
                                        filename: perceptualHashes[i].filename,
                                        size: perceptualHashes[i].size,
                                        modifiedDate: perceptualHashes[i].modifiedDate
                                    },
                                    {
                                        filePath: perceptualHashes[j].filePath,
                                        filename: perceptualHashes[j].filename,
                                        size: perceptualHashes[j].size,
                                        modifiedDate: perceptualHashes[j].modifiedDate
                                    }
                                ],
                                similarity: similarity,
                                type: 'similar'
                            });
                        }
                        
                        processedPairs.add(pairKey);
                    }
                }
            }
            
            // 4. 結果を統合（重複画像 + 類似画像）
            const allResults = [...duplicateGroups, ...similarGroups];
            
            console.log(`類似画像検出完了: 重複画像 ${duplicateGroups.length}件, 類似画像 ${similarGroups.length}件`);
            
            return allResults;
            
        } catch (error) {
            console.error('類似画像検出エラー:', error);
            return [];
        }
    }

    /**
     * ファイルのSHA256ハッシュを計算
     */
    async calculateFileHash(filePath) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            return crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (error) {
            console.error(`ファイルハッシュ計算エラー (${filePath}):`, error);
            throw error;
        }
    }

    /**
     * 知覚ハッシュ（Average Hash）を計算
     */
    async calculatePerceptualHash(imagePath) {
        try {
            // 画像を8x8のグレースケールにリサイズ
            const buffer = await sharp(imagePath)
                .grayscale()
                .resize(8, 8, { fit: 'fill' })
                .raw()
                .toBuffer();
            
            // 平均値を計算
            let sum = 0;
            for (let i = 0; i < buffer.length; i++) {
                sum += buffer[i];
            }
            const average = sum / buffer.length;
            
            // ハッシュ値を生成（平均値より大きいピクセルは1、小さいピクセルは0）
            let hash = '';
            for (let i = 0; i < buffer.length; i++) {
                hash += buffer[i] > average ? '1' : '0';
            }
            
            return hash;
        } catch (error) {
            console.error(`知覚ハッシュ計算エラー (${imagePath}):`, error);
            throw error;
        }
    }

    /**
     * ハミング距離を計算
     */
    calculateHammingDistance(hash1, hash2) {
        if (hash1.length !== hash2.length) {
            throw new Error('ハッシュの長さが異なります');
        }
        
        let distance = 0;
        for (let i = 0; i < hash1.length; i++) {
            if (hash1[i] !== hash2[i]) {
                distance++;
            }
        }
        
        return distance;
    }

    /**
     * ハミング距離から類似度を計算
     */
    calculateSimilarityFromHammingDistance(hammingDistance) {
        // 64ビットハッシュの場合、最大ハミング距離は64
        // ハミング距離3以下で類似度100%、ハミング距離6で約50%、ハミング距離15以上で類似度0%
        if (hammingDistance <= 3) {
            return 100;
        } else if (hammingDistance >= 15) {
            return 0;
        } else {
            // 線形補間で類似度を計算
            const similarity = Math.max(0, 100 - ((hammingDistance - 3) * 100 / 12));
            return Math.round(similarity);
        }
    }

    /**
     * 類似度閾値を設定
     */
    setSimilarityThreshold(threshold) {
        this.similarityThreshold = threshold;
        console.log(`類似度閾値を ${threshold}% に設定しました`);
    }

    /**
     * ブレ検出閾値を設定
     */
    setBlurThreshold(threshold) {
        this.blurThreshold = threshold;
        console.log(`ブレ検出閾値を ${threshold} に設定しました`);
    }
}

module.exports = ImageAnalyzer; 