# ブレ検出モジュール
import cv2
from ..utils.constants import BLUR_MAX_VARIANCE_FOR_SCORE_100, BLUR_MIN_VARIANCE_FOR_SCORE_0


def calculate_blur_score(image_path, laplacian_ksize=3):
    """
    画像のブレスコアを計算する。
    スコアが高いほどブレが大きい (0-100)。
    """
    try:
        image = cv2.imread(image_path)
        if image is None:
            return -1  # 画像読み込み失敗

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        variance_of_laplacian = cv2.Laplacian(gray, cv2.CV_64F, ksize=laplacian_ksize).var()

        # 正規化
        score = _normalize_blur_variance(variance_of_laplacian)
        return round(max(0, min(100, score)))  # 0-100の範囲に収める
        
    except Exception:
        return -1  # 計算エラー


def _normalize_blur_variance(variance):
    """分散値をブレスコア(0-100)に正規化"""
    if variance <= BLUR_MAX_VARIANCE_FOR_SCORE_100:
        return 100
    elif variance >= BLUR_MIN_VARIANCE_FOR_SCORE_0:
        return 0
    else:
        # 線形補間: (V - V_sharp) / (V_blur - V_sharp) * 100, ただし逆転させる
        score = 100 - (
            (variance - BLUR_MAX_VARIANCE_FOR_SCORE_100) /
            (BLUR_MIN_VARIANCE_FOR_SCORE_0 - BLUR_MAX_VARIANCE_FOR_SCORE_100) * 100
        )
        return score