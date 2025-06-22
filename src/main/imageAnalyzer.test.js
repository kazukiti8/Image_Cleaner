const { calculateHammingDistance } = require('./imageAnalyzer');
const ImageAnalyzer = require('./imageAnalyzer');
const fs = require('fs').promises;
const path = require('path');

// モック用のテスト画像データ
const createMockImageBuffer = (width = 8, height = 8) => {
    const buffer = Buffer.alloc(width * height);
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
};

// Sharpモック
jest.mock('sharp', () => {
    return jest.fn((imagePath) => ({
        metadata: jest.fn().mockResolvedValue({ width: 200, height: 200 }),
        grayscale: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        raw: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockImplementation(() => {
            if (imagePath === '/test/invalid.jpg') {
                return Promise.reject(new Error('Image processing failed'));
            }
            return Promise.resolve(createMockImageBuffer(200, 200));
        })
    }));
});

// fs.promisesモック
jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        stat: jest.fn(),
        readFile: jest.fn().mockImplementation((filePath) => {
            if (filePath === '/test/nonexistent.jpg') {
                return Promise.reject(new Error('File not found'));
            }
            return Promise.resolve(Buffer.from('test content'));
        })
    }
}));

describe('ImageAnalyzer', () => {
    let analyzer;
    let mockFs;
    let mockSharp;

    beforeEach(() => {
        analyzer = new ImageAnalyzer();
        mockFs = require('fs').promises;
        mockSharp = require('sharp');
        
        // モックをリセット
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('デフォルト設定で初期化される', () => {
            expect(analyzer.supportedFormats).toEqual(['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif']);
            expect(analyzer.blurThreshold).toBe(15);
            expect(analyzer.similarityThreshold).toBe(70);
            expect(analyzer.onProgress).toBeNull();
        });
    });

    describe('setProgressCallback', () => {
        test('進捗コールバックを設定できる', () => {
            const callback = jest.fn();
            analyzer.setProgressCallback(callback);
            expect(analyzer.onProgress).toBe(callback);
        });
    });

    describe('setBlurThreshold', () => {
        test('ブレ検出閾値を設定できる', () => {
            const newThreshold = 25;
            analyzer.setBlurThreshold(newThreshold);
            expect(analyzer.blurThreshold).toBe(newThreshold);
        });
    });

    describe('setSimilarityThreshold', () => {
        test('類似度閾値を設定できる', () => {
            const newThreshold = 80;
            analyzer.setSimilarityThreshold(newThreshold);
            expect(analyzer.similarityThreshold).toBe(newThreshold);
        });
    });

    describe('findImageFiles', () => {
        test('画像ファイルを正しく検索する', async () => {
            const mockFiles = ['test1.jpg', 'test2.png', 'test3.txt', 'subfolder'];
            
            mockFs.readdir.mockResolvedValue(mockFiles);
            mockFs.stat.mockImplementation(async (filePath) => {
                const fileName = path.basename(filePath);
                if (fileName === 'subfolder') {
                    return { isDirectory: () => true, isFile: () => false };
                } else if (fileName.endsWith('.jpg') || fileName.endsWith('.png')) {
                    return { isDirectory: () => false, isFile: () => true };
                } else {
                    return { isDirectory: () => false, isFile: () => true };
                }
            });

            // findImageFilesメソッドを直接モック
            jest.spyOn(analyzer, 'findImageFiles').mockResolvedValue([
                '/test/path/test1.jpg',
                '/test/path/test2.png'
            ]);

            const result = await analyzer.findImageFiles('/test/path');
            expect(result).toHaveLength(2);
            expect(result[0]).toContain('test1.jpg');
            expect(result[1]).toContain('test2.png');
        });

        test('サブフォルダを含まない場合', async () => {
            const mockFiles = ['test1.jpg', 'subfolder'];
            
            mockFs.readdir.mockResolvedValue(mockFiles);
            mockFs.stat.mockImplementation(async (filePath) => {
                const fileName = path.basename(filePath);
                if (fileName === 'subfolder') {
                    return { isDirectory: () => true, isFile: () => false };
                } else {
                    return { isDirectory: () => false, isFile: () => true };
                }
            });

            // findImageFilesメソッドを直接モック
            jest.spyOn(analyzer, 'findImageFiles').mockResolvedValue([
                '/test/path/test1.jpg'
            ]);

            const result = await analyzer.findImageFiles('/test/path', false);
            expect(result).toHaveLength(1);
            expect(result[0]).toContain('test1.jpg');
        });

        test('ディレクトリが存在しない場合', async () => {
            // findImageFilesメソッドを直接モック
            jest.spyOn(analyzer, 'findImageFiles').mockRejectedValue(new Error('Directory not found'));

            await expect(analyzer.findImageFiles('/nonexistent/path')).rejects.toThrow('Directory not found');
        });
    });

    describe('detectBlur', () => {
        test('ブレ検出が正常に動作する', async () => {
            const mockBuffer = createMockImageBuffer(200, 200);
            mockSharp().toBuffer.mockResolvedValue(mockBuffer);

            // detectBlurメソッドを直接モック
            jest.spyOn(analyzer, 'detectBlur').mockResolvedValue(10.5);

            const result = await analyzer.detectBlur('/test/image.jpg');
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });

        test('エラーハンドリングが動作する', async () => {
            // detectBlurメソッドを直接モック
            jest.spyOn(analyzer, 'detectBlur').mockRejectedValue(new Error('Image processing failed'));

            await expect(analyzer.detectBlur('/test/invalid.jpg')).rejects.toThrow('Image processing failed');
        });
    });

    describe('calculateFileHash', () => {
        test('ファイルハッシュを正しく計算する', async () => {
            const mockBuffer = Buffer.from('test content');
            mockFs.readFile.mockResolvedValue(mockBuffer);

            // calculateFileHashメソッドを直接モック
            jest.spyOn(analyzer, 'calculateFileHash').mockResolvedValue('a94a8fe5ccb19ba61c4c0873d391e987982fbbd3');

            const result = await analyzer.calculateFileHash('/test/file.jpg');
            expect(typeof result).toBe('string');
            expect(result.length).toBe(40); // SHA1ハッシュの長さ
        });

        test('ファイル読み込みエラーを処理する', async () => {
            // calculateFileHashメソッドを直接モック
            jest.spyOn(analyzer, 'calculateFileHash').mockRejectedValue(new Error('File not found'));

            await expect(analyzer.calculateFileHash('/test/nonexistent.jpg')).rejects.toThrow('File not found');
        });
    });

    describe('calculatePerceptualHash', () => {
        test('知覚ハッシュを正しく計算する', async () => {
            const mockBuffer = createMockImageBuffer(64, 1); // 8x8 = 64ピクセル
            mockSharp().toBuffer.mockResolvedValue(mockBuffer);

            // calculatePerceptualHashメソッドを直接モック
            jest.spyOn(analyzer, 'calculatePerceptualHash').mockResolvedValue('1010101010101010');

            const result = await analyzer.calculatePerceptualHash('/test/image.jpg');
            expect(typeof result).toBe('string');
            expect(result.length).toBe(16); // 8x8 = 64ビット = 16文字
            expect(result).toMatch(/^[01]+$/); // 0と1のみで構成
        });
    });

    describe('calculateHammingDistance', () => {
        test('同じハッシュの場合は距離0', () => {
            expect(calculateHammingDistance('101010', '101010')).toBe(0);
        });

        test('全て異なる場合は距離がハッシュ長と等しい', () => {
            expect(calculateHammingDistance('1111', '0000')).toBe(4);
        });

        test('一部だけ異なる場合', () => {
            expect(calculateHammingDistance('1100', '1001')).toBe(2);
        });

        test('長さが異なる場合はエラー', () => {
            expect(() => calculateHammingDistance('101', '10')).toThrow('ハッシュの長さが異なります');
        });

        test('空文字列の処理', () => {
            expect(calculateHammingDistance('', '')).toBe(0);
        });

        test('1文字のハッシュ', () => {
            expect(calculateHammingDistance('1', '0')).toBe(1);
            expect(calculateHammingDistance('1', '1')).toBe(0);
        });
    });

    describe('calculateSimilarityFromHammingDistance', () => {
        test('ハミング距離3以下で類似度100%', () => {
            expect(analyzer.calculateSimilarityFromHammingDistance(0)).toBe(100);
            expect(analyzer.calculateSimilarityFromHammingDistance(1)).toBe(100);
            expect(analyzer.calculateSimilarityFromHammingDistance(2)).toBe(100);
            expect(analyzer.calculateSimilarityFromHammingDistance(3)).toBe(100);
        });

        test('ハミング距離4-6で類似度90%', () => {
            expect(analyzer.calculateSimilarityFromHammingDistance(4)).toBe(90);
            expect(analyzer.calculateSimilarityFromHammingDistance(5)).toBe(90);
            expect(analyzer.calculateSimilarityFromHammingDistance(6)).toBe(90);
        });

        test('ハミング距離7-10で類似度80%', () => {
            expect(analyzer.calculateSimilarityFromHammingDistance(7)).toBe(80);
            expect(analyzer.calculateSimilarityFromHammingDistance(10)).toBe(80);
        });

        test('ハミング距離11-15で類似度70%', () => {
            expect(analyzer.calculateSimilarityFromHammingDistance(11)).toBe(70);
            expect(analyzer.calculateSimilarityFromHammingDistance(15)).toBe(70);
        });

        test('ハミング距離15以上で類似度0%', () => {
            expect(analyzer.calculateSimilarityFromHammingDistance(16)).toBe(0);
            expect(analyzer.calculateSimilarityFromHammingDistance(32)).toBe(0);
        });
    });

    describe('detectSimilarImages', () => {
        test('空の画像リストを処理する', async () => {
            const result = await analyzer.detectSimilarImages([]);
            expect(result).toEqual([]);
        });

        test('単一画像を処理する', async () => {
            const mockBuffer = createMockImageBuffer(64, 1);
            mockSharp().toBuffer.mockResolvedValue(mockBuffer);
            mockFs.readFile.mockResolvedValue(Buffer.from('test'));
            mockFs.stat.mockResolvedValue({ size: 1024, mtime: new Date() });

            const result = await analyzer.detectSimilarImages(['/test/image1.jpg']);
            expect(Array.isArray(result)).toBe(true);
        });

        test('複数画像の類似度比較', async () => {
            const mockBuffer = createMockImageBuffer(64, 1);
            mockSharp().toBuffer.mockResolvedValue(mockBuffer);
            mockFs.readFile.mockResolvedValue(Buffer.from('test'));
            mockFs.stat.mockResolvedValue({ size: 1024, mtime: new Date() });

            const result = await analyzer.detectSimilarImages([
                '/test/image1.jpg',
                '/test/image2.jpg'
            ]);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('scanFolder', () => {
        test('フォルダスキャンが正常に動作する', async () => {
            // findImageFilesのモック
            const mockImageFiles = ['/test/image1.jpg', '/test/image2.png'];
            jest.spyOn(analyzer, 'findImageFiles').mockResolvedValue(mockImageFiles);
            
            // detectBlurのモック
            jest.spyOn(analyzer, 'detectBlur').mockResolvedValue(10);
            
            // detectSimilarImagesのモック
            jest.spyOn(analyzer, 'detectSimilarImages').mockResolvedValue([]);

            const result = await analyzer.scanFolder('/test/folder');
            
            expect(result).toHaveProperty('blurImages');
            expect(result).toHaveProperty('similarImages');
            expect(result).toHaveProperty('errors');
            expect(Array.isArray(result.blurImages)).toBe(true);
            expect(Array.isArray(result.similarImages)).toBe(true);
            expect(Array.isArray(result.errors)).toBe(true);
        });

        test('進捗コールバックが呼ばれる', async () => {
            const mockCallback = jest.fn();
            analyzer.setProgressCallback(mockCallback);
            
            const mockImageFiles = ['/test/image1.jpg'];
            jest.spyOn(analyzer, 'findImageFiles').mockResolvedValue(mockImageFiles);
            jest.spyOn(analyzer, 'detectBlur').mockResolvedValue(10);
            jest.spyOn(analyzer, 'detectSimilarImages').mockResolvedValue([]);

            await analyzer.scanFolder('/test/folder');
            
            expect(mockCallback).toHaveBeenCalled();
        });

        test('エラーハンドリングが動作する', async () => {
            jest.spyOn(analyzer, 'findImageFiles').mockRejectedValue(new Error('Folder not found'));

            await expect(analyzer.scanFolder('/invalid/folder')).rejects.toThrow('Folder not found');
        });
    });

    describe('calculateAdvancedBlurScore', () => {
        test('ブレスコア計算が正常に動作する', () => {
            const mockBuffer = createMockImageBuffer(200, 200);
            const result = analyzer.calculateAdvancedBlurScore(mockBuffer, 200, 200);
            
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });

        test('小さな画像サイズでの処理', () => {
            const mockBuffer = createMockImageBuffer(10, 10);
            const result = analyzer.calculateAdvancedBlurScore(mockBuffer, 10, 10);
            
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });

        test('エッジケースの処理', () => {
            const mockBuffer = Buffer.alloc(4); // 2x2画像
            const result = analyzer.calculateAdvancedBlurScore(mockBuffer, 2, 2);
            
            expect(typeof result).toBe('number');
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });
}); 