# ファイルスキャンモジュール
import os
import hashlib
import datetime
import imagehash
from ..utils.constants import IMAGE_EXTENSIONS, BLUR_THRESHOLD
from ..utils.image_metadata import get_image_metadata
from ..analysis.blur_detector import calculate_blur_score
from ..analysis.similarity_detector import calculate_ahash, calculate_sha256


class FileScanner:
    def __init__(self):
        self.processed_images_data = []
        self.blurry_images = []
        self.error_files = []

    def scan_folder(self, folder_path, scan_subfolders=True):
        """指定されたフォルダをスキャンし、画像情報を収集する"""
        self._reset_data()
        
        # ファイルウォーカーの設定
        walker = self._get_file_walker(folder_path, scan_subfolders)
        
        # 各ファイルを処理
        for root, _, files in walker:
            for filename in files:
                if self._is_image_file(filename):
                    file_path = os.path.join(root, filename)
                    self._process_image_file(file_path, filename)
            
            if not scan_subfolders:
                break
        
        return {
            "processed_images_data": self.processed_images_data,
            "blurry_images": self.blurry_images,
            "error_files": self.error_files
        }

    def _reset_data(self):
        """データリストを初期化"""
        self.processed_images_data = []
        self.blurry_images = []
        self.error_files = []

    def _get_file_walker(self, folder_path, scan_subfolders):
        """ファイルウォーカーを取得"""
        if scan_subfolders:
            return os.walk(folder_path)
        else:
            try:
                root_items = os.listdir(folder_path)
                files_in_root = [f for f in root_items if os.path.isfile(os.path.join(folder_path, f))]
                dirs_in_root = [d for d in root_items if os.path.isdir(os.path.join(folder_path, d))]
                return [(folder_path, dirs_in_root, files_in_root)]
            except Exception as e:
                self._add_scan_error(folder_path, f"フォルダのスキャンに失敗: {str(e)}")
                return []

    def _is_image_file(self, filename):
        """ファイルが画像ファイルかどうかチェック"""
        return filename.lower().endswith(IMAGE_EXTENSIONS)

    def _process_image_file(self, file_path, filename):
        """画像ファイルを処理"""
        item_id = hashlib.md5(file_path.encode()).hexdigest()[:8]
        
        try:
            # 基本情報の取得
            file_size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
            mod_timestamp = os.path.getmtime(file_path)
            modified_date = datetime.datetime.fromtimestamp(mod_timestamp).strftime('%Y/%m/%d %H:%M:%S')
            
            # メタデータの取得
            resolution, taken_date = get_image_metadata(file_path)
            if taken_date == "N/A":
                taken_date = modified_date
            
            # ブレ検出
            blur_score = calculate_blur_score(file_path)
            if blur_score == -1:
                self._add_processing_error(item_id, filename, file_path, 
                                         "ブレ計算中にエラー発生 (画像読み込み失敗または処理不可)", 
                                         file_size_mb)
                return
            
            # ブレ画像の登録
            if blur_score >= BLUR_THRESHOLD:
                self._add_blurry_image(item_id, filename, file_path, file_size_mb,
                                     modified_date, taken_date, resolution, blur_score)
            
            # 類似度検出用のハッシュ計算
            ahash_str = calculate_ahash(file_path)
            sha256_hex = calculate_sha256(file_path)
            
            if ahash_str and sha256_hex:
                self._add_processed_image(item_id, filename, file_path, file_size_mb,
                                        resolution, ahash_str, sha256_hex, modified_date, taken_date)
            else:
                self._add_hash_error(item_id, filename, file_path, ahash_str, sha256_hex, file_size_mb)
                
        except FileNotFoundError:
            self._add_file_not_found_error(item_id, filename, file_path)
        except Exception as e:
            self._add_general_error(item_id, filename, file_path, str(e))

    def _add_blurry_image(self, item_id, filename, file_path, file_size_mb, 
                         modified_date, taken_date, resolution, blur_score):
        """ブレ画像をリストに追加"""
        self.blurry_images.append({
            "id": f"blur_{item_id}",
            "filename": filename,
            "path": file_path,
            "size": file_size_mb,
            "modifiedDate": modified_date,
            "takenDate": taken_date,
            "resolution": resolution,
            "blurScore": blur_score
        })

    def _add_processed_image(self, item_id, filename, file_path, file_size_mb,
                           resolution, ahash_str, sha256_hex, modified_date, taken_date):
        """処理済み画像データをリストに追加"""
        self.processed_images_data.append({
            "id": item_id,
            "filename": filename,
            "path": file_path,
            "size": file_size_mb,
            "resolution": resolution,
            "ahash": imagehash.hex_to_hash(ahash_str),
            "sha256": sha256_hex,
            "modifiedDate": modified_date,
            "takenDate": taken_date
        })

    def _add_scan_error(self, folder_path, error_message):
        """スキャンエラーを追加"""
        self.error_files.append({
            "id": f"err_scan_root_{len(self.error_files)}",
            "filename": os.path.basename(folder_path),
            "filepath": folder_path,
            "errorMessage": error_message,
            "errorType": "scan_error"
        })

    def _add_processing_error(self, item_id, filename, file_path, error_message, file_size_mb):
        """処理エラーを追加"""
        self.error_files.append({
            "id": f"err_blur_{item_id}",
            "filename": filename,
            "filepath": file_path,
            "errorMessage": error_message,
            "errorType": "processing_error",
            "size": file_size_mb
        })

    def _add_hash_error(self, item_id, filename, file_path, ahash_str, sha256_hex, file_size_mb):
        """ハッシュ計算エラーを追加"""
        if not ahash_str:
            self.error_files.append({
                "id": f"err_ahash_{item_id}",
                "filename": filename,
                "filepath": file_path,
                "errorMessage": "aHashの計算に失敗しました。",
                "errorType": "processing_error",
                "size": file_size_mb
            })
        if not sha256_hex:
            self.error_files.append({
                "id": f"err_sha256_{item_id}",
                "filename": filename,
                "filepath": file_path,
                "errorMessage": "SHA256ハッシュの計算に失敗しました。",
                "errorType": "processing_error",
                "size": file_size_mb
            })

    def _add_file_not_found_error(self, item_id, filename, file_path):
        """ファイル未発見エラーを追加"""
        self.error_files.append({
            "id": f"err_fnf_{item_id}",
            "filename": filename,
            "filepath": file_path,
            "errorMessage": "ファイルが見つかりません (スキャン中に移動または削除された可能性)。",
            "errorType": "file_not_found"
        })

    def _add_general_error(self, item_id, filename, file_path, error_message):
        """一般的なエラーを追加"""
        self.error_files.append({
            "id": f"err_proc_{item_id}",
            "filename": filename,
            "filepath": file_path,
            "errorMessage": f"ファイル処理エラー: {error_message}",
            "errorType": "processing_error"
        })