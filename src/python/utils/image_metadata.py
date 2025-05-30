# 画像メタデータ処理モジュール
import datetime
from PIL import Image


def get_image_metadata(image_path):
    """画像ファイルのメタデータを取得する"""
    try:
        img = Image.open(image_path)
        width, height = img.size
        resolution = f"{width}x{height}"
        
        taken_date = _extract_taken_date(img)
        
        return resolution, taken_date
    except Exception:
        return "N/A", "N/A"


def _extract_taken_date(img):
    """画像からExif情報を使って撮影日時を取得"""
    try:
        exif_data = img._getexif()
        if not exif_data:
            return "N/A"
            
        # ExifタグIDの定義 (Pillowドキュメントより)
        # 36867: DateTimeOriginal (撮影日時)
        # 306: DateTime (変更日時)
        tag_datetime_original = 0x9003  # 36867
        tag_datetime = 0x0132           # 306

        # DateTimeOriginalを優先的に取得
        if tag_datetime_original in exif_data:
            taken_date_str = exif_data[tag_datetime_original]
            return _parse_exif_datetime(taken_date_str)
        elif tag_datetime in exif_data:
            taken_date_str = exif_data[tag_datetime]
            return _parse_exif_datetime(taken_date_str)
        else:
            return "N/A"
            
    except Exception:
        return "N/A"


def _parse_exif_datetime(date_str):
    """Exifの日付文字列をパースする"""
    try:
        # 日付文字列の形式が複数ある可能性に対応
        parsed_date = datetime.datetime.strptime(date_str, '%Y:%m:%d %H:%M:%S')
        return parsed_date.strftime('%Y/%m/%d %H:%M:%S')
    except ValueError:
        return "N/A"