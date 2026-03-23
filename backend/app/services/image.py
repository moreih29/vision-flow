import bisect
import hashlib
import tempfile
from pathlib import Path

import aiofiles  # type: ignore[import-untyped]
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import case, func, select, update
from sqlalchemy import delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_store import DataStore
from app.models.folder_meta import FolderMeta
from app.models.image import Image
from app.schemas.image import FolderContentsResponse, FolderImageIdsResponse, FolderInfo, ImageResponse
from app.storage.base import StorageBackend

_CHUNK_SIZE = 256 * 1024  # 256 KB


def _normalize_folder_path(path: str) -> str:
    """Normalize folder path: strip leading slash, ensure trailing slash (unless empty)."""
    path = path.lstrip("/")
    if path and not path.endswith("/"):
        path = path + "/"
    # Reject path traversal
    if ".." in path.split("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path must not contain '..' segments",
        )
    return path


def _escape_like(s: str) -> str:
    """Escape SQL LIKE special characters."""
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def _resolve_keys_to_delete(
    db: AsyncSession,
    candidate_keys: list[str],
    target_ids: set[int],
) -> list[str]:
    """GROUP BY 한 번으로 storage_key별 전체/삭제대상 참조 수를 집계해 물리 삭제 대상을 반환.

    total_refs == target_refs 인 키만 반환 (다른 레코드에서 참조 중인 키는 제외).
    """
    if not candidate_keys:
        return []

    rows = await db.execute(
        select(
            Image.storage_key,
            func.count().label("total_refs"),
            func.sum(case((Image.id.in_(target_ids), 1), else_=0)).label("target_refs"),
        )
        .where(Image.storage_key.in_(candidate_keys))
        .group_by(Image.storage_key)
    )
    return [row.storage_key for row in rows if row.total_refs <= row.target_refs]


class ImageService:
    async def check_image_ownership(self, db: AsyncSession, image: Image, user_id: int) -> None:
        """image -> data_store -> project -> owner_id 체인으로 소유권 검증."""
        from app.models.project import Project

        result = await db.execute(
            select(Project)
            .join(DataStore, DataStore.project_id == Project.id)
            .where(DataStore.id == image.data_store_id)
        )
        project = result.scalar_one_or_none()
        if project is None or project.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )

    async def upload_image(
        self,
        db: AsyncSession,
        data_store_id: int,
        user_id: int,
        file: UploadFile,
        storage: StorageBackend,
        folder_path: str = "",
    ) -> Image:
        raw_filename = file.filename or "unknown"
        original_filename = raw_filename.rsplit("/", 1)[-1] if "/" in raw_filename else raw_filename
        ext = Path(original_filename).suffix.lstrip(".")
        mime_type = file.content_type or "application/octet-stream"

        # 청크 단위로 읽어 해시 계산과 임시 파일 저장을 동시에 수행 (메모리 상주 최소화)
        hasher = hashlib.sha256()
        file_size = 0
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = Path(tmp.name)

        try:
            async with aiofiles.open(tmp_path, "wb") as tmp_f:
                while True:
                    chunk = await file.read(_CHUNK_SIZE)
                    if not chunk:
                        break
                    hasher.update(chunk)
                    file_size += len(chunk)
                    await tmp_f.write(chunk)

            file_hash = hasher.hexdigest()
            storage_key = (
                f"{file_hash[:2]}/{file_hash[2:4]}/{file_hash}.{ext}"
                if ext
                else f"{file_hash[:2]}/{file_hash[2:4]}/{file_hash}"
            )

            # dedup: 동일 해시 파일이 없을 때만 저장 (임시 파일을 이동)
            if not await storage.exists(storage_key):
                await storage.save_from_path(storage_key, tmp_path)
            else:
                tmp_path.unlink(missing_ok=True)
        except Exception:
            tmp_path.unlink(missing_ok=True)
            raise

        # Pillow로 이미지 크기 추출 (임시 파일에서 직접 읽어 메모리 복사 제거)
        width: int | None = None
        height: int | None = None
        try:
            from PIL import Image as PILImage

            img = PILImage.open(storage.get_file_path(storage_key))
            width, height = img.size
        except Exception:
            pass

        normalized_folder_path = _normalize_folder_path(folder_path)

        image = Image(
            original_filename=original_filename,
            storage_key=storage_key,
            file_hash=file_hash,
            file_size=file_size,
            width=width,
            height=height,
            mime_type=mime_type,
            folder_path=normalized_folder_path,
            data_store_id=data_store_id,
            uploaded_by=user_id,
        )
        db.add(image)
        await db.commit()
        await db.refresh(image)
        return image

    async def get_images_by_data_store(
        self,
        db: AsyncSession,
        data_store_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Image], int]:
        count_result = await db.execute(select(func.count()).where(Image.data_store_id == data_store_id))
        total = count_result.scalar_one()
        result = await db.execute(
            select(Image)
            .where(Image.data_store_id == data_store_id)
            .order_by(Image.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        images = list(result.scalars().all())
        return images, total

    async def get_image(self, db: AsyncSession, image_id: int) -> Image:
        result = await db.execute(select(Image).where(Image.id == image_id))
        image = result.scalar_one_or_none()
        if image is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found",
            )
        return image

    async def delete_image(
        self,
        db: AsyncSession,
        image_id: int,
        user_id: int,
        storage: StorageBackend,
    ) -> None:
        image = await self.get_image(db, image_id)
        await self.check_image_ownership(db, image, user_id)
        # only delete physical file if no other image records reference same storage_key
        count_result = await db.execute(select(func.count()).where(Image.storage_key == image.storage_key))
        ref_count = count_result.scalar_one()
        await db.delete(image)
        await db.commit()
        if ref_count <= 1:
            await storage.delete(image.storage_key)

    async def get_folder_contents(
        self,
        db: AsyncSession,
        data_store_id: int,
        path: str = "",
        skip: int = 0,
        limit: int = 100,
    ) -> FolderContentsResponse:
        normalized_path = _normalize_folder_path(path)
        prefix_len = len(normalized_path)

        # 1) 이미지가 있는 모든 하위 폴더 경로와 카운트를 한 번에 조회 (GROUP BY)
        counts_result = await db.execute(
            select(Image.folder_path, func.count().label("cnt"))
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
            .group_by(Image.folder_path)
        )
        path_image_counts: dict[str, int] = {row.folder_path: row.cnt for row in counts_result}

        # 2) direct child folders 수집: image 경로 + FolderMeta 경로 모두 포함
        direct_child_folders: set[str] = set()

        for fp in path_image_counts:
            if fp == normalized_path:
                continue
            relative = fp[prefix_len:]
            first_seg = relative.split("/")[0]
            if first_seg:
                direct_child_folders.add(normalized_path + first_seg + "/")

        explicit_result = await db.execute(
            select(FolderMeta.path)
            .where(FolderMeta.data_store_id == data_store_id)
            .where(FolderMeta.path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
            .where(FolderMeta.path != normalized_path)
        )
        for explicit_path in explicit_result.scalars():
            relative = explicit_path[prefix_len:]
            first_seg = relative.split("/")[0]
            if first_seg:
                direct_child_folders.add(normalized_path + first_seg + "/")

        # 3) bisect를 위해 path_image_counts 키를 정렬
        #    prefix 범위 [child_path, child_path + "\xff") 로 O(log N) 슬라이싱
        sorted_count_keys = sorted(path_image_counts)

        # 4) 각 direct child의 image_count, subfolder_count를 O(log N + K) 로 집계
        folders: list[FolderInfo] = []
        for child_path in sorted(direct_child_folders):
            child_prefix_len = len(child_path)

            # image_count: child_path 이하 모든 경로의 카운트 합
            # 상한은 child_path의 마지막 "/" 을 "\xff" 로 교체 — 어떤 폴더명도 이 값을 초과하지 않음
            lo = bisect.bisect_left(sorted_count_keys, child_path)
            hi = bisect.bisect_left(sorted_count_keys, child_path[:-1] + "\xff")
            image_count = sum(path_image_counts[sorted_count_keys[i]] for i in range(lo, hi))

            # subfolder_count: child_path 직하위 폴더 세그먼트만 수집
            sub_children: set[str] = set()
            for i in range(lo, hi):
                fp = sorted_count_keys[i]
                if fp == child_path:
                    continue
                relative = fp[child_prefix_len:]
                first_seg = relative.split("/")[0]
                if first_seg:
                    sub_children.add(first_seg)
            subfolder_count = len(sub_children)

            name = child_path.rstrip("/").split("/")[-1]
            folders.append(
                FolderInfo(
                    path=child_path,
                    name=name,
                    image_count=image_count,
                    subfolder_count=subfolder_count,
                )
            )

        # 5) 현재 경로의 이미지 목록 (exact match)
        total_images = path_image_counts.get(normalized_path, 0)

        images_result = await db.execute(
            select(Image)
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path == normalized_path)
            .order_by(Image.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        images = [ImageResponse.model_validate(img) for img in images_result.scalars().all()]

        return FolderContentsResponse(
            current_path=normalized_path,
            folders=folders,
            images=images,
            total_images=total_images,
        )

    async def delete_folder(
        self,
        db: AsyncSession,
        data_store_id: int,
        folder_path: str,
        user_id: int,
        storage: StorageBackend,
    ) -> int:
        """Delete all images under a folder path (inclusive of subfolders).

        Returns count of deleted images.
        """
        normalized_path = _normalize_folder_path(folder_path)

        # Delete explicit folder metadata
        await db.execute(
            sql_delete(FolderMeta)
            .where(FolderMeta.data_store_id == data_store_id)
            .where(FolderMeta.path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
        )

        # 삭제 대상 이미지의 id와 storage_key만 조회 (ORM 객체 불필요)
        rows_result = await db.execute(
            select(Image.id, Image.storage_key)
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
        )
        rows = rows_result.all()
        if not rows:
            await db.commit()
            return 0

        target_ids = {row.id for row in rows}
        candidate_keys = list({row.storage_key for row in rows})

        # GROUP BY 한 번으로 물리 삭제 대상 결정
        keys_to_delete = await _resolve_keys_to_delete(db, candidate_keys, target_ids)

        # bulk DELETE (ORM 개별 삭제 대신 단일 DELETE 쿼리)
        await db.execute(sql_delete(Image).where(Image.id.in_(target_ids)))
        await db.commit()

        # physically delete files with no remaining references
        for key in keys_to_delete:
            await storage.delete(key)

        return len(target_ids)

    async def update_folder_path(
        self,
        db: AsyncSession,
        data_store_id: int,
        old_path: str,
        new_path: str,
    ) -> int:
        """Rename or move a folder by updating folder_path prefix for all images underneath."""
        normalized_old = _normalize_folder_path(old_path)
        normalized_new = _normalize_folder_path(new_path)

        if normalized_old == normalized_new:
            return 0

        if not normalized_old:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot rename root folder",
            )

        # Prevent moving a folder into itself
        if normalized_new.startswith(normalized_old):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move a folder into itself",
            )

        # Check source exists (images or explicit folder)
        source_img_result = await db.execute(
            select(func.count())
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path.like(f"{_escape_like(normalized_old)}%", escape="\\"))
        )
        source_meta_result = await db.execute(
            select(func.count())
            .where(FolderMeta.data_store_id == data_store_id)
            .where(FolderMeta.path.like(f"{_escape_like(normalized_old)}%", escape="\\"))
        )
        if source_img_result.scalar_one() == 0 and source_meta_result.scalar_one() == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source folder not found",
            )

        # Check target doesn't conflict
        conflict_count_result = await db.execute(
            select(func.count())
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path.like(f"{_escape_like(normalized_new)}%", escape="\\"))
        )
        if conflict_count_result.scalar_one() > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Target folder already exists",
            )

        # Bulk update: replace old prefix with new prefix
        old_prefix_len = len(normalized_old)
        result = await db.execute(
            update(Image)
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path.like(f"{_escape_like(normalized_old)}%", escape="\\"))
            .values(
                folder_path=func.concat(
                    normalized_new,
                    func.substr(Image.folder_path, old_prefix_len + 1),
                )
            )
        )
        # Also update FolderMeta paths
        await db.execute(
            update(FolderMeta)
            .where(FolderMeta.data_store_id == data_store_id)
            .where(FolderMeta.path.like(f"{_escape_like(normalized_old)}%", escape="\\"))
            .values(
                path=func.concat(
                    normalized_new,
                    func.substr(FolderMeta.path, old_prefix_len + 1),
                )
            )
        )
        await db.commit()
        return result.rowcount  # type: ignore[attr-defined, no-any-return]

    async def get_all_folder_paths(
        self,
        db: AsyncSession,
        data_store_id: int,
    ) -> list[str]:
        """Return all unique folder paths in a data store (including intermediate parents)."""
        result = await db.execute(
            select(Image.folder_path)
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path != "")
            .distinct()
        )
        raw_paths: list[str] = list(result.scalars().all())

        # Also include explicit folder paths from FolderMeta
        explicit_result = await db.execute(
            select(FolderMeta.path).where(FolderMeta.data_store_id == data_store_id).where(FolderMeta.path != "")
        )
        raw_paths.extend(explicit_result.scalars().all())

        # Extract all intermediate parent folders
        all_folders: set[str] = set()
        for p in raw_paths:
            parts = p.rstrip("/").split("/")
            for i in range(len(parts)):
                all_folders.add("/".join(parts[: i + 1]) + "/")

        return sorted(all_folders)

    async def create_folder(
        self,
        db: AsyncSession,
        data_store_id: int,
        folder_path: str,
    ) -> str:
        """Create an explicit empty folder. Returns the normalized path."""
        normalized = _normalize_folder_path(folder_path)
        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create root folder",
            )
        existing = await db.execute(
            select(FolderMeta).where(FolderMeta.data_store_id == data_store_id).where(FolderMeta.path == normalized)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Folder already exists",
            )
        meta = FolderMeta(data_store_id=data_store_id, path=normalized)
        db.add(meta)
        await db.commit()
        return normalized

    async def batch_delete_images(
        self,
        db: AsyncSession,
        image_ids: list[int],
        user_id: int,
        storage: StorageBackend,
    ) -> int:
        if not image_ids:
            return 0
        result = await db.execute(select(Image).where(Image.id.in_(image_ids)))
        images = list(result.scalars().all())
        if not images:
            return 0

        # 모든 이미지에 대해 소유권 검증
        for image in images:
            await self.check_image_ownership(db, image, user_id)

        target_ids = {img.id for img in images}
        candidate_keys = list({img.storage_key for img in images})

        # GROUP BY 한 번으로 물리 삭제 대상 결정
        keys_to_delete = await _resolve_keys_to_delete(db, candidate_keys, target_ids)

        # bulk DELETE
        await db.execute(sql_delete(Image).where(Image.id.in_(target_ids)))
        await db.commit()

        for key in keys_to_delete:
            await storage.delete(key)

        return len(images)

    async def batch_move_images(
        self,
        db: AsyncSession,
        image_ids: list[int],
        target_folder: str,
        user_id: int,
    ) -> int:
        if not image_ids:
            return 0

        # 이동할 이미지들의 소유권 검증
        result = await db.execute(select(Image).where(Image.id.in_(image_ids)))
        images = list(result.scalars().all())
        for image in images:
            await self.check_image_ownership(db, image, user_id)

        normalized = _normalize_folder_path(target_folder)
        update_result = await db.execute(update(Image).where(Image.id.in_(image_ids)).values(folder_path=normalized))
        await db.commit()
        return update_result.rowcount  # type: ignore[attr-defined, no-any-return]

    async def batch_delete_folders(
        self,
        db: AsyncSession,
        data_store_id: int,
        folder_paths: list[str],
        user_id: int,
        storage: StorageBackend,
    ) -> int:
        total = 0
        for path in folder_paths:
            count = await self.delete_folder(db, data_store_id, path, user_id, storage)
            total += count
        return total

    async def get_folder_image_ids(
        self,
        db: AsyncSession,
        data_store_id: int,
        path: str = "",
    ) -> FolderImageIdsResponse:
        normalized_path = _normalize_folder_path(path)
        query = select(Image.id).where(Image.data_store_id == data_store_id)
        if normalized_path:
            query = query.where(Image.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
        result = await db.execute(query)
        ids = list(result.scalars().all())
        return FolderImageIdsResponse(image_ids=ids, total=len(ids))

    async def batch_move_folders(
        self,
        db: AsyncSession,
        data_store_id: int,
        folder_paths: list[str],
        target_folder: str,
    ) -> int:
        normalized_target = _normalize_folder_path(target_folder)
        total = 0
        for folder_path in folder_paths:
            normalized_old = _normalize_folder_path(folder_path)
            folder_name = normalized_old.rstrip("/").split("/")[-1]
            normalized_new = normalized_target + folder_name + "/"
            count = await self.update_folder_path(db, data_store_id, normalized_old, normalized_new)
            total += count
        return total


image_service = ImageService()
