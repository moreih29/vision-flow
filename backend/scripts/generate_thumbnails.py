"""기존 이미지 썸네일 일괄 생성 스크립트.

사용법:
    cd backend
    python scripts/generate_thumbnails.py
"""
import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import select

from app.database import async_session
from app.dependencies import get_storage
from app.models.image import Image
from app.services.image import image_service


async def main() -> None:
    storage = get_storage()

    async with async_session() as db:
        result = await db.execute(
            select(Image).distinct(Image.storage_key).order_by(Image.storage_key, Image.id)
        )
        images = list(result.scalars().all())

    total = len(images)
    created = 0
    skipped = 0
    failed = 0

    print(f"총 {total}개 이미지 처리 시작")

    for i, image in enumerate(images, start=1):
        pct = int(i / total * 100) if total > 0 else 100
        print(f"\r[{i}/{total}] 생성 중... ({pct}%)", end="", flush=True)

        try:
            from pathlib import Path
            from app.config import settings

            key_parts = image.storage_key.split("/")
            hash_with_ext = key_parts[2] if len(key_parts) >= 3 else image.storage_key
            file_hash = hash_with_ext[: hash_with_ext.rfind(".")] if "." in hash_with_ext else hash_with_ext
            thumb_path = (
                Path(settings.storage_base_path)
                / ".thumbnails"
                / file_hash[:2]
                / file_hash[2:4]
                / f"{file_hash}_thumb.webp"
            )

            already_exists = thumb_path.exists() or image.mime_type == "image/svg+xml"

            await image_service.get_or_create_thumbnail(image, storage)

            if already_exists:
                skipped += 1
            else:
                created += 1
        except Exception as e:
            failed += 1
            print(f"\n  [실패] id={image.id} key={image.storage_key}: {e}")

    print(f"\n완료 — 생성 {created}개, 스킵 {skipped}개, 실패 {failed}개")


if __name__ == "__main__":
    asyncio.run(main())
