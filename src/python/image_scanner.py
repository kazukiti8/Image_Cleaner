# src/python/image_scanner.py
import sys
import json
import os
import time
import datetime
import hashlib
from PIL import Image, ExifTags
import imagehash # type: ignore
import cv2 # type: ignore
import numpy as np # type: ignore

# --- 定数 ---
# ブレ検出の正規化パラメータ (要件定義書より)
# 低い分散値ほどブレが大きい => スコアは高く
BLUR_MAX_VARIANCE_FOR_SCORE_100 = 180  # これ以下の分散値はスコア100 (ブレ大)
BLUR_MIN_VARIANCE_FOR_SCORE_0 = 3000 # これ以上の分散値はスコア0 (鮮明)

# 類似度検出の正規化パラメータ (要件定義書より)
# ハミング距離が小さいほど類似度が高い
SIMILARITY_MAX_HAMMING_FOR_SCORE_100 = 3  # これ以下のハミング距離は類似度100%
SIMILARITY_MIN_HAMMING_FOR_SCORE_0 = 15   # これ以上のハミング距離は類似度0%
AHASH_SIZE = 8 # ahashのハッシュサイズ

# --- ヘルパー関数 ---
def get_image_metadata(image_path):
    """画像ファイルのメタデータを取得する"""
    try:
        img = Image.open(image_path)
        width, height = img.size
        resolution = f"{width}x{height}"
        
        taken_date = None
        try:
            exif_data = img._getexif()
            if exif_data:
                # ExifタグIDの定義 (Pillowドキュメントより)
                # 36867: DateTimeOriginal (撮影日時)
                # 306: DateTime (変更日時)
                tag_datetime_original = 0x9003 # 36867
                tag_datetime = 0x0132 # 306

                if tag_datetime_original in exif_data:
                    taken_date_str = exif_data[tag_datetime_original]
                    # 日付文字列の形式が複数ある可能性に対応
                    try:
                        taken_date = datetime.datetime.strptime(taken_date_str, '%Y:%m:%d %H:%M:%S').strftime('%Y/%m/%d %H:%M:%S')
                    except ValueError:
                        taken_date = "N/A" # パース失敗
                elif tag_datetime in exif_data: # DateTimeOriginalがない場合、DateTimeを使用
                    taken_date_str = exif_data[tag_datetime]
                    try:
                        taken_date = datetime.datetime.strptime(taken_date_str, '%Y:%m:%d %H:%M:%S').strftime('%Y/%m/%d %H:%M:%S')
                    except ValueError:
                        taken_date = "N/A"
                else:
                    taken_date = "N/A"
        except Exception:
            taken_date = "N/A" # Exif読み取りエラー
            
        return resolution, taken_date
    except Exception:
        return "N/A", "N/A"

def calculate_blur_score(image_path, laplacian_ksize=3):
    """
    画像のブレスコアを計算する。
    スコアが高いほどブレが大きい (0-100)。
    """
    try:
        image = cv2.imread(image_path)
        if image is None:
            return -1 # 画像読み込み失敗

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        variance_of_laplacian = cv2.Laplacian(gray, cv2.CV_64F, ksize=laplacian_ksize).var()

        # 正規化
        if variance_of_laplacian <= BLUR_MAX_VARIANCE_FOR_SCORE_100:
            score = 100
        elif variance_of_laplacian >= BLUR_MIN_VARIANCE_FOR_SCORE_0:
            score = 0
        else:
            # 線形補間: (V - V_sharp) / (V_blur - V_sharp) * 100, ただし逆転させる
            score = 100 - (
                (variance_of_laplacian - BLUR_MAX_VARIANCE_FOR_SCORE_100) /
                (BLUR_MIN_VARIANCE_FOR_SCORE_0 - BLUR_MAX_VARIANCE_FOR_SCORE_100) * 100
            )
        return round(max(0, min(100, score))) # 0-100の範囲に収める
    except Exception:
        return -1 # 計算エラー

def calculate_ahash(image_path, hash_size=AHASH_SIZE):
    """画像のaHashを計算する"""
    try:
        img = Image.open(image_path)
        ahash = imagehash.average_hash(img, hash_size=hash_size)
        return str(ahash)
    except Exception:
        return None

def calculate_sha256(image_path):
    """ファイルのSHA256ハッシュを計算する"""
    sha256_hash = hashlib.sha256()
    try:
        with open(image_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception:
        return None

def hamming_distance_to_similarity(distance, hash_len=AHASH_SIZE*AHASH_SIZE):
    """ハミング距離を類似度パーセンテージに変換する (要件定義書ベース)"""
    if distance <= SIMILARITY_MAX_HAMMING_FOR_SCORE_100:
        return 100
    if distance >= SIMILARITY_MIN_HAMMING_FOR_SCORE_0:
        return 0
    
    # 線形補間
    # 類似度 = 100 * (1 - (distance - D_100) / (D_0 - D_100))
    similarity = 100 * (1 - (distance - SIMILARITY_MAX_HAMMING_FOR_SCORE_100) / 
                             (SIMILARITY_MIN_HAMMING_FOR_SCORE_0 - SIMILARITY_MAX_HAMMING_FOR_SCORE_100))
    return round(max(0, min(100, similarity)))


def scan_folder(folder_path, scan_subfolders=True):
    """
    指定されたフォルダをスキャンし、画像情報を収集する。
    """
    blurry_images = []
    similar_image_pairs = []
    error_files = []
    
    processed_images_data = [] # ahashとsha256を含む画像データのリスト
    
    image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp') # webpも追加

    # 1. 全画像ファイルの情報を収集
    # scan_subfolders の設定を考慮
    if scan_subfolders:
        walker = os.walk(folder_path)
    else:
        # ルートフォルダのみを対象とする os.walk の使い方
        # (root, dirs, files) のタプルを一度だけ生成するリストでラップ
        try:
            # os.listdir を使ってサブフォルダを除外する方が確実
            root_items = os.listdir(folder_path)
            files_in_root = [f for f in root_items if os.path.isfile(os.path.join(folder_path, f))]
            dirs_in_root = [d for d in root_items if os.path.isdir(os.path.join(folder_path, d))]
            walker = [(folder_path, dirs_in_root, files_in_root)]
        except Exception as e:
            error_files.append({
                "id": f"err_scan_root_{len(error_files)}",
                "filename": os.path.basename(folder_path),
                "filepath": folder_path,
                "errorMessage": f"フォルダのスキャンに失敗: {str(e)}",
                "errorType": "scan_error"
            })
            walker = [] # 空のウォーカーで以降の処理をスキップ


    for root, _, files in walker:
        for filename in files:
            if not filename.lower().endswith(image_extensions):
                continue

            file_path = os.path.join(root, filename)
            item_id = hashlib.md5(file_path.encode()).hexdigest()[:8] # ファイルパスから簡易ID生成

            try:
                file_size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
                mod_timestamp = os.path.getmtime(file_path)
                modified_date = datetime.datetime.fromtimestamp(mod_timestamp).strftime('%Y/%m/%d %H:%M:%S')
                
                resolution, taken_date = get_image_metadata(file_path)
                if taken_date == "N/A": # Exifから取得できなかった場合、更新日時を代用
                    taken_date = modified_date 

                # ブレ検出
                blur_score = calculate_blur_score(file_path)
                if blur_score == -1: # 画像読み込み/処理エラー
                    error_files.append({
                        "id": f"err_blur_{item_id}", "filename": filename, "filepath": file_path,
                        "errorMessage": "ブレ計算中にエラー発生 (画像読み込み失敗または処理不可)", "errorType": "processing_error", "size": file_size_mb
                    })
                    continue # このファイルは以降の処理をスキップ
                
                if blur_score >= 50: # 例: スコア50以上をブレ画像候補とする (閾値は調整可能)
                    blurry_images.append({
                        "id": f"blur_{item_id}", "filename": filename, "path": file_path, "size": file_size_mb,
                        "modifiedDate": modified_date, "takenDate": taken_date, "resolution": resolution,
                        "blurScore": blur_score
                    })

                # 類似度検出のためのハッシュ計算
                ahash_str = calculate_ahash(file_path)
                sha256_hex = calculate_sha256(file_path)

                if ahash_str and sha256_hex:
                    processed_images_data.append({
                        "id": item_id, "filename": filename, "path": file_path, "size": file_size_mb,
                        "resolution": resolution, "ahash": imagehash.hex_to_hash(ahash_str), "sha256": sha256_hex,
                        "modifiedDate": modified_date, "takenDate": taken_date
                    })
                elif not ahash_str:
                     error_files.append({
                        "id": f"err_ahash_{item_id}", "filename": filename, "filepath": file_path,
                        "errorMessage": "aHashの計算に失敗しました。", "errorType": "processing_error", "size": file_size_mb
                    })
                elif not sha256_hex:
                     error_files.append({
                        "id": f"err_sha256_{item_id}", "filename": filename, "filepath": file_path,
                        "errorMessage": "SHA256ハッシュの計算に失敗しました。", "errorType": "processing_error", "size": file_size_mb
                    })

            except FileNotFoundError:
                error_files.append({
                    "id": f"err_fnf_{item_id}", "filename": filename, "filepath": file_path,
                    "errorMessage": "ファイルが見つかりません (スキャン中に移動または削除された可能性)。", "errorType": "file_not_found"
                })
            except Exception as e:
                error_files.append({
                    "id": f"err_proc_{item_id}", "filename": filename, "filepath": file_path,
                    "errorMessage": f"ファイル処理エラー: {str(e)}", "errorType": "processing_error"
                })
        if not scan_subfolders: # サブフォルダをスキャンしない場合は一度でループを抜ける
            break


    # 2. 類似画像のペアを検出
    # まずSHA256で完全一致をチェック
    sha256_map = {}
    for i, data1 in enumerate(processed_images_data):
        if data1["sha256"] in sha256_map:
            sha256_map[data1["sha256"]].append(i)
        else:
            sha256_map[data1["sha256"]] = [i]

    # SHA256が一致したものをペアリング (類似度100%)
    # 既にペアリングされた画像のインデックスを管理
    paired_indices_sha = set() 
    for sha_val, indices in sha256_map.items():
        if len(indices) > 1:
            for i in range(len(indices)):
                for j in range(i + 1, len(indices)):
                    idx1, idx2 = indices[i], indices[j]
                    # 両方のインデックスがまだペアリングされていなければ処理
                    if idx1 not in paired_indices_sha and idx2 not in paired_indices_sha:
                        img1_data = processed_images_data[idx1]
                        img2_data = processed_images_data[idx2]
                        # 推奨ロジックの例: 更新日時が新しい方、またはファイルサイズが大きい方を残す
                        recommended = "file1" if img1_data["modifiedDate"] >= img2_data["modifiedDate"] else "file2"
                        if img1_data["modifiedDate"] == img2_data["modifiedDate"]:
                             recommended = "file1" if img1_data["size"] >= img2_data["size"] else "file2"

                        similar_image_pairs.append({
                            "id": f"sim_sha_{img1_data['id']}_{img2_data['id']}",
                            "filename1": img1_data["filename"], "path1": img1_data["path"], "resolution1": img1_data["resolution"], "size1": img1_data["size"],
                            "filename2": img2_data["filename"], "path2": img2_data["path"], "resolution2": img2_data["resolution"], "size2": img2_data["size"],
                            "similarity": 100, # 完全一致
                            "recommended": recommended
                        })
                        paired_indices_sha.add(idx1)
                        paired_indices_sha.add(idx2)


    # 次にaHashで類似画像をチェック (SHA256でペアにならなかったもののみ対象)
    # paired_indices_sha に含まれないインデックスのリストを作成
    remaining_indices = [i for i, data in enumerate(processed_images_data) if i not in paired_indices_sha]
    
    for i in range(len(remaining_indices)):
        for j in range(i + 1, len(remaining_indices)):
            idx1 = remaining_indices[i]
            idx2 = remaining_indices[j]
            
            img1_data = processed_images_data[idx1]
            img2_data = processed_images_data[idx2]

            if img1_data["ahash"] is not None and img2_data["ahash"] is not None:
                try:
                    hamming_dist = img1_data["ahash"] - img2_data["ahash"] # imagehashオブジェクト同士の差分
                    similarity_perc = hamming_distance_to_similarity(hamming_dist)

                    if similarity_perc > 50: # 例: 類似度50%以上を候補とする (閾値は調整可能)
                        recommended = "file1" if img1_data["modifiedDate"] >= img2_data["modifiedDate"] else "file2"
                        if img1_data["modifiedDate"] == img2_data["modifiedDate"]:
                             recommended = "file1" if img1_data["size"] >= img2_data["size"] else "file2"
                        
                        similar_image_pairs.append({
                            "id": f"sim_ahash_{img1_data['id']}_{img2_data['id']}",
                            "filename1": img1_data["filename"], "path1": img1_data["path"], "resolution1": img1_data["resolution"], "size1": img1_data["size"],
                            "filename2": img2_data["filename"], "path2": img2_data["path"], "resolution2": img2_data["resolution"], "size2": img2_data["size"],
                            "similarity": similarity_perc,
                            "recommended": recommended
                        })
                except Exception: # ハッシュ比較エラーなど
                    pass # エラーとして記録済みか、ここで追加で記録

    return {
        "blurryImages": blurry_images,
        "similarImagePairs": similar_image_pairs,
        "errorFiles": error_files
    }

if __name__ == "__main__":
    if len(sys.argv) > 2:
        target_folder = sys.argv[1]
        # Electron側から 'true'/'false' の文字列で渡される想定
        scan_subfolders_str = sys.argv[2].lower()
        scan_subfolders_flag = scan_subfolders_str == 'true'

        if os.path.isdir(target_folder):
            results = scan_folder(target_folder, scan_subfolders_flag)
            print(json.dumps(results))
        else:
            error_result = {
                "blurryImages": [], "similarImagePairs": [],
                "errorFiles": [{"id": "err_path", "filename": os.path.basename(target_folder), "errorMessage": "指定されたパスはフォルダではありません。", "filepath": target_folder}]
            }
            print(json.dumps(error_result))
    elif len(sys.argv) > 1: # サブフォルダスキャンフラグがない場合 (後方互換性のため、デフォルトTrueで動作)
        target_folder = sys.argv[1]
        if os.path.isdir(target_folder):
            results = scan_folder(target_folder, True) # デフォルトTrue
            print(json.dumps(results))
        else:
            error_result = {
                "blurryImages": [], "similarImagePairs": [],
                "errorFiles": [{"id": "err_path", "filename": os.path.basename(target_folder), "errorMessage": "指定されたパスはフォルダではありません。", "filepath": target_folder}]
            }
            print(json.dumps(error_result))
    else:
        error_result = {
            "blurryImages": [], "similarImagePairs": [],
            "errorFiles": [{"id": "err_arg", "filename": "N/A", "errorMessage": "スキャン対象のフォルダパスが指定されていません。", "filepath": "N/A"}]
        }
        print(json.dumps(error_result))
