# 類似度検出モジュール
import hashlib
from PIL import Image
import imagehash
from ..utils.constants import (
    AHASH_SIZE, 
    SIMILARITY_MAX_HAMMING_FOR_SCORE_100, 
    SIMILARITY_MIN_HAMMING_FOR_SCORE_0
)


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


def hamming_distance_to_similarity(distance, hash_len=AHASH_SIZE * AHASH_SIZE):
    """ハミング距離を類似度パーセンテージに変換する"""
    if distance <= SIMILARITY_MAX_HAMMING_FOR_SCORE_100:
        return 100
    if distance >= SIMILARITY_MIN_HAMMING_FOR_SCORE_0:
        return 0
    
    # 線形補間
    # 類似度 = 100 * (1 - (distance - D_100) / (D_0 - D_100))
    similarity = 100 * (1 - (distance - SIMILARITY_MAX_HAMMING_FOR_SCORE_100) / 
                             (SIMILARITY_MIN_HAMMING_FOR_SCORE_0 - SIMILARITY_MAX_HAMMING_FOR_SCORE_100))
    return round(max(0, min(100, similarity)))


def find_similar_pairs(processed_images_data, similarity_threshold=50):
    """画像データから類似ペアを検出する"""
    similar_pairs = []
    
    # SHA256による完全一致検出
    sha256_pairs = _find_sha256_duplicates(processed_images_data)
    similar_pairs.extend(sha256_pairs)
    
    # SHA256でペアにならなかった画像のaHash比較
    remaining_data = _filter_unpaired_images(processed_images_data, sha256_pairs)
    ahash_pairs = _find_ahash_similar_pairs(remaining_data, similarity_threshold)
    similar_pairs.extend(ahash_pairs)
    
    return similar_pairs


def _find_sha256_duplicates(processed_images_data):
    """SHA256ハッシュによる完全一致ペアを検出"""
    sha256_map = {}
    for i, data in enumerate(processed_images_data):
        sha256 = data["sha256"]
        if sha256 in sha256_map:
            sha256_map[sha256].append(i)
        else:
            sha256_map[sha256] = [i]
    
    pairs = []
    paired_indices = set()
    
    for sha_val, indices in sha256_map.items():
        if len(indices) > 1:
            for i in range(len(indices)):
                for j in range(i + 1, len(indices)):
                    idx1, idx2 = indices[i], indices[j]
                    if idx1 not in paired_indices and idx2 not in paired_indices:
                        img1_data = processed_images_data[idx1]
                        img2_data = processed_images_data[idx2]
                        
                        pair = _create_similar_pair(img1_data, img2_data, 100, "sha256")
                        pairs.append(pair)
                        paired_indices.add(idx1)
                        paired_indices.add(idx2)
    
    return pairs


def _find_ahash_similar_pairs(remaining_data, similarity_threshold):
    """aHashによる類似ペア検出"""
    pairs = []
    
    for i in range(len(remaining_data)):
        for j in range(i + 1, len(remaining_data)):
            img1_data = remaining_data[i]
            img2_data = remaining_data[j]

            if img1_data["ahash"] is not None and img2_data["ahash"] is not None:
                try:
                    hamming_dist = img1_data["ahash"] - img2_data["ahash"]
                    similarity_perc = hamming_distance_to_similarity(hamming_dist)

                    if similarity_perc >= similarity_threshold:
                        pair = _create_similar_pair(img1_data, img2_data, similarity_perc, "ahash")
                        pairs.append(pair)
                        
                except Exception:
                    continue  # ハッシュ比較エラー
    
    return pairs


def _filter_unpaired_images(processed_images_data, paired_items):
    """ペアになっていない画像データを抽出"""
    paired_ids = set()
    for pair in paired_items:
        paired_ids.add(pair["id1"])
        paired_ids.add(pair["id2"])
    
    return [data for data in processed_images_data if data["id"] not in paired_ids]


def _create_similar_pair(img1_data, img2_data, similarity, pair_type):
    """類似ペアデータを作成"""
    # 推奨ロジック: 更新日時が新しい方、またはファイルサイズが大きい方を残す
    recommended = "file1" if img1_data["modifiedDate"] >= img2_data["modifiedDate"] else "file2"
    if img1_data["modifiedDate"] == img2_data["modifiedDate"]:
        recommended = "file1" if img1_data["size"] >= img2_data["size"] else "file2"

    return {
        "id": f"sim_{pair_type}_{img1_data['id']}_{img2_data['id']}",
        "id1": img1_data["id"],
        "id2": img2_data["id"],
        "filename1": img1_data["filename"],
        "path1": img1_data["path"],
        "resolution1": img1_data["resolution"],
        "size1": img1_data["size"],
        "filename2": img2_data["filename"],
        "path2": img2_data["path"],
        "resolution2": img2_data["resolution"],
        "size2": img2_data["size"],
        "similarity": similarity,
        "recommended": recommended
    }