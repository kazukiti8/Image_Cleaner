# 画像処理関連の定数定義

# ブレ検出の正規化パラメータ (要件定義書より)
# 低い分散値ほどブレが大きい => スコアは高く
BLUR_MAX_VARIANCE_FOR_SCORE_100 = 180  # これ以下の分散値はスコア100 (ブレ大)
BLUR_MIN_VARIANCE_FOR_SCORE_0 = 3000   # これ以上の分散値はスコア0 (鮮明)

# 類似度検出の正規化パラメータ (要件定義書より)
# ハミング距離が小さいほど類似度が高い
SIMILARITY_MAX_HAMMING_FOR_SCORE_100 = 3   # これ以下のハミング距離は類似度100%
SIMILARITY_MIN_HAMMING_FOR_SCORE_0 = 15    # これ以上のハミング距離は類似度0%
AHASH_SIZE = 8  # ahashのハッシュサイズ

# サポートする画像拡張子
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp')

# スコア閾値
BLUR_THRESHOLD = 50  # この値以上をブレ画像候補とする
SIMILARITY_THRESHOLD = 50  # この値以上を類似画像候補とする