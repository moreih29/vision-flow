import hashlib
import io
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder_meta import FolderMeta
from app.models.image import Image
from app.schemas.image import FolderContentsResponse, FolderInfo, ImageResponse
from app.storage.base import StorageBackend


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


class ImageService:
    async def upload_image(
        self,
        db: AsyncSession,
        data_store_id: int,
        user_id: int,
        file: UploadFile,
        storage: StorageBackend,
        folder_path: str = "",
    ) -> Image:
        data = await file.read()
        file_hash = hashlib.sha256(data).hexdigest()
        original_filename = file.filename or "unknown"
        ext = Path(original_filename).suffix.lstrip(".")
        storage_key = (
            f"{file_hash[:2]}/{file_hash[2:4]}/{file_hash}.{ext}"
            if ext
            else f"{file_hash[:2]}/{file_hash[2:4]}/{file_hash}"
        )
        mime_type = file.content_type or "application/octet-stream"
        file_size = len(data)

        # dedup: only save physical file if not already stored
        if not await storage.exists(storage_key):
            await storage.save(storage_key, data)

        # extract image dimensions using Pillow if possible
        width: int | None = None
        height: int | None = None
        try:
            from PIL import Image as PILImage

            img = PILImage.open(io.BytesIO(data))
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
        result = await db.execute(select(Image).where(Image.data_store_id == data_store_id).offset(skip).limit(limit))
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
        if image.uploaded_by != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        # only delete physical file if no other image records reference same storage_key
        count_result = await db.execute(select(func.count()).where(Image.storage_key == image.storage_key))
        ref_count = count_result.scalar_one()
        await db.delete(image)
        await db.commit()
        if ref_count <= 1:
            await storage.delete(image.storage_key)

    async def get_image_file(
        self,
        db: AsyncSession,
        image_id: int,
        storage: StorageBackend,
    ) -> tuple[bytes, str]:
        image = await self.get_image(db, image_id)
        data = await storage.load(image.storage_key)
        return data, image.mime_type

    async def get_folder_contents(
        self,
        db: AsyncSession,
        data_store_id: int,
        path: str = "",
        skip: int = 0,
        limit: int = 100,
    ) -> FolderContentsResponse:
        normalized_path = _normalize_folder_path(path)

        # get all distinct folder_paths under the given prefix
        folder_paths_result = await db.execute(
            select(Image.folder_path)
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
            .distinct()
        )
        all_folder_paths: list[str] = list(folder_paths_result.scalars().all())

        # find direct child folders only
        direct_child_folders: set[str] = set()
        for fp in all_folder_paths:
            if fp == normalized_path:
                continue
            # strip the current path prefix and find the next segment
            relative = fp[len(normalized_path) :]
            parts = relative.split("/")
            if parts[0]:
                child_path = normalized_path + parts[0] + "/"
                direct_child_folders.add(child_path)

        # Also include explicit folders from FolderMeta
        explicit_result = await db.execute(
            select(FolderMeta.path)
            .where(FolderMeta.data_store_id == data_store_id)
            .where(FolderMeta.path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
            .where(FolderMeta.path != normalized_path)
        )
        for explicit_path in explicit_result.scalars():
            relative = explicit_path[len(normalized_path) :]
            parts = relative.split("/")
            if parts[0]:
                child_path = normalized_path + parts[0] + "/"
                direct_child_folders.add(child_path)

        # batch fetch image counts per folder_path in a single query
        counts_result = await db.execute(
            select(Image.folder_path, func.count().label("cnt"))
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
            .group_by(Image.folder_path)
        )
        path_image_counts: dict[str, int] = {row.folder_path: row.cnt for row in counts_result}

        # build FolderInfo for each direct child using only in-memory data
        folders: list[FolderInfo] = []
        for folder_path in sorted(direct_child_folders):
            # image_count: sum counts for all folder_paths that fall under this child folder
            image_count = sum(cnt for fp, cnt in path_image_counts.items() if fp.startswith(folder_path))

            # subfolder_count: count direct children of this folder
            sub_children: set[str] = set()
            for fp in all_folder_paths:
                if fp == folder_path or not fp.startswith(folder_path):
                    continue
                relative = fp[len(folder_path) :]
                parts = relative.split("/")
                if parts[0]:
                    sub_children.add(parts[0])
            subfolder_count = len(sub_children)

            # folder name is the last non-empty segment
            name = folder_path.rstrip("/").split("/")[-1]
            folders.append(
                FolderInfo(
                    path=folder_path,
                    name=name,
                    image_count=image_count,
                    subfolder_count=subfolder_count,
                )
            )

        # images directly in the current path (exact folder_path match)
        total_images_result = await db.execute(
            select(func.count()).where(Image.data_store_id == data_store_id).where(Image.folder_path == normalized_path)
        )
        total_images = total_images_result.scalar_one()

        images_result = await db.execute(
            select(Image)
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path == normalized_path)
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

        # fetch all images under this folder path (inclusive of subfolders)
        result = await db.execute(
            select(Image)
            .where(Image.data_store_id == data_store_id)
            .where(Image.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
        )
        images = list(result.scalars().all())
        if not images:
            await db.commit()
            return 0

        # collect unique storage_keys from images to be deleted
        target_ids = {img.id for img in images}
        storage_keys = list({img.storage_key for img in images})

        # for each storage_key, count total references across the entire data store
        # a key can be physically deleted only if all references are within the deletion set
        keys_to_delete: list[str] = []
        for key in storage_keys:
            count_result = await db.execute(select(func.count()).where(Image.storage_key == key))
            total_refs = count_result.scalar_one()

            target_refs_result = await db.execute(
                select(func.count()).where(Image.storage_key == key).where(Image.id.in_(target_ids))
            )
            target_refs = target_refs_result.scalar_one()

            if total_refs <= target_refs:
                keys_to_delete.append(key)

        # bulk delete DB records
        for img in images:
            await db.delete(img)
        await db.commit()

        # physically delete files with no remaining references
        for key in keys_to_delete:
            await storage.delete(key)

        return len(images)

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
        storage: StorageBackend,
    ) -> int:
        if not image_ids:
            return 0
        result = await db.execute(select(Image).where(Image.id.in_(image_ids)))
        images = list(result.scalars().all())
        if not images:
            return 0

        target_ids = {img.id for img in images}
        storage_keys = list({img.storage_key for img in images})
        keys_to_delete: list[str] = []

        for key in storage_keys:
            count_result = await db.execute(select(func.count()).where(Image.storage_key == key))
            total_refs = count_result.scalar_one()
            target_refs_result = await db.execute(
                select(func.count()).where(Image.storage_key == key).where(Image.id.in_(target_ids))
            )
            target_refs = target_refs_result.scalar_one()
            if total_refs <= target_refs:
                keys_to_delete.append(key)

        for img in images:
            await db.delete(img)
        await db.commit()

        for key in keys_to_delete:
            await storage.delete(key)

        return len(images)

    async def batch_move_images(
        self,
        db: AsyncSession,
        image_ids: list[int],
        target_folder: str,
    ) -> int:
        if not image_ids:
            return 0
        normalized = _normalize_folder_path(target_folder)
        result = await db.execute(update(Image).where(Image.id.in_(image_ids)).values(folder_path=normalized))
        await db.commit()
        return result.rowcount  # type: ignore[attr-defined, no-any-return]

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
