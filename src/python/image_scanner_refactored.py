# リファクタリング後のメインスキャナー
import sys
import json
import os
from scanner.file_scanner import FileScanner
from analysis.similarity_detector import find_similar_pairs
from utils.constants import SIMILARITY_THRESHOLD


class ImageScanner:
    def __init__(self):
        self.file_scanner = FileScanner()

    def scan_folder(self, folder_path, scan_subfolders=True):
        """
        指定されたフォルダをスキャンし、画像情報を収集する。
        """
        # ファイルスキャンの実行
        scan_results = self.file_scanner.scan_folder(folder_path, scan_subfolders)
        
        # 類似画像ペアの検出
        similar_image_pairs = find_similar_pairs(
            scan_results["processed_images_data"], 
            SIMILARITY_THRESHOLD
        )
        
        return {
            "blurryImages": scan_results["blurry_images"],
            "similarImagePairs": similar_image_pairs,
            "errorFiles": scan_results["error_files"]
        }


def main():
    """メイン実行関数"""
    if len(sys.argv) > 2:
        target_folder = sys.argv[1]
        scan_subfolders_str = sys.argv[2].lower()
        scan_subfolders_flag = scan_subfolders_str == 'true'
        
        if os.path.isdir(target_folder):
            scanner = ImageScanner()
            results = scanner.scan_folder(target_folder, scan_subfolders_flag)
            print(json.dumps(results))
        else:
            print(json.dumps(_create_path_error_result(target_folder)))
            
    elif len(sys.argv) > 1:
        # 後方互換性のため、デフォルトTrueで動作
        target_folder = sys.argv[1]
        if os.path.isdir(target_folder):
            scanner = ImageScanner()
            results = scanner.scan_folder(target_folder, True)
            print(json.dumps(results))
        else:
            print(json.dumps(_create_path_error_result(target_folder)))
    else:
        print(json.dumps(_create_argument_error_result()))


def _create_path_error_result(target_folder):
    """パスエラー用の結果を作成"""
    return {
        "blurryImages": [],
        "similarImagePairs": [],
        "errorFiles": [{
            "id": "err_path",
            "filename": os.path.basename(target_folder),
            "errorMessage": "指定されたパスはフォルダではありません。",
            "filepath": target_folder
        }]
    }


def _create_argument_error_result():
    """引数エラー用の結果を作成"""
    return {
        "blurryImages": [],
        "similarImagePairs": [],
        "errorFiles": [{
            "id": "err_arg",
            "filename": "N/A",
            "errorMessage": "スキャン対象のフォルダパスが指定されていません。",
            "filepath": "N/A"
        }]
    }


if __name__ == "__main__":
    main()