from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_storage
from app.models.user import User
from app.schemas.image import (
    BatchDeleteRequest,
    BatchFolderDeleteRequest,
    BatchFolderMoveRequest,
    BatchMoveRequest,
    FolderContentsResponse,
    FolderCreateRequest,
    FolderUpdateRequest,
    ImageListResponse,
    ImageResponse,
)
from app.services.data_store import data_store_service
from app.services.image import image_service
from app.storage.base import StorageBackend

router = APIRouter(tags=["images"])


@router.post(
    "/data-stores/{data_store_id}/images",
    response_model=list[ImageResponse],
    status_code=201,
)
async def upload_images(
    data_store_id: int,
    files: list[UploadFile] = File(...),
    folder_paths: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageBackend = Depends(get_storage),
) -> list[ImageResponse]:
    """Upload one or more images to a data store."""
    ALLOWED_EXTS = {
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif", ".svg"
    }
    # verify data store exists
    await data_store_service.get_data_store(db, data_store_id)
    parsed_paths = folder_paths.split(",") if folder_paths else []
    results = []
    for i, file in enumerate(files):
        # Skip non-image files
        filename = file.filename or ""
        ext = filename[filename.rfind(".") :].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTS:
            continue
        fp = parsed_paths[i] if i < len(parsed_paths) else ""
        image = await image_service.upload_image(
            db, data_store_id, current_user.id, file, storage, folder_path=fp
        )
        results.append(ImageResponse.model_validate(image))
    return results


@router.get(
    "/data-stores/{data_store_id}/folders", response_model=FolderContentsResponse
)
async def get_folder_contents(
    data_store_id: int,
    path: str = Query(default=""),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FolderContentsResponse:
    """List folders and images at a given folder path within a data store."""
    await data_store_service.get_data_store(db, data_store_id)
    return await image_service.get_folder_contents(
        db, data_store_id, path, skip, limit
    )


@router.get(
    "/data-stores/{data_store_id}/images", response_model=ImageListResponse
)
async def list_images(
    data_store_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImageListResponse:
    """List images in a data store with pagination."""
    images, total = await image_service.get_images_by_data_store(
        db, data_store_id, skip, limit
    )
    return ImageListResponse(
        images=[ImageResponse.model_validate(img) for img in images],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/images/{image_id}", response_model=ImageResponse)
async def get_image(
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImageResponse:
    """Get image metadata by ID."""
    image = await image_service.get_image(db, image_id)
    return ImageResponse.model_validate(image)


@router.get("/images/{image_id}/file")
async def get_image_file(
    image_id: int,
    token: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
) -> Response:
    """Download an image file. Supports token via query param for img src tags."""
    from app.services.auth import auth_service

    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token_data = auth_service.decode_token(token)
    user = await auth_service.get_user_by_email(db, token_data.email)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Not authenticated")

    image = await image_service.get_image(db, image_id)
    file_path = storage._key_to_path(image.storage_key)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    return FileResponse(path=str(file_path), media_type=image.mime_type)


@router.patch("/data-stores/{data_store_id}/folders", status_code=200)
async def update_folder(
    data_store_id: int,
    body: FolderUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Rename or move a folder (updates folder_path prefix for all images)."""
    await data_store_service.get_data_store(db, data_store_id)
    count = await image_service.update_folder_path(
        db, data_store_id, body.old_path, body.new_path
    )
    return {"updated_count": count}


@router.post("/data-stores/{data_store_id}/folders", status_code=201)
async def create_folder(
    data_store_id: int,
    body: FolderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create an empty folder."""
    await data_store_service.get_data_store(db, data_store_id)
    path = await image_service.create_folder(db, data_store_id, body.path)
    return {"path": path}


@router.get(
    "/data-stores/{data_store_id}/folders/tree", response_model=list[str]
)
async def get_all_folders(
    data_store_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Return all unique folder paths in a data store."""
    await data_store_service.get_data_store(db, data_store_id)
    return await image_service.get_all_folder_paths(db, data_store_id)


@router.delete("/data-stores/{data_store_id}/folders", status_code=200)
async def delete_folder(
    data_store_id: int,
    path: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageBackend = Depends(get_storage),
) -> dict:
    """Delete all images in a folder and its subfolders."""
    await data_store_service.get_data_store(db, data_store_id)
    count = await image_service.delete_folder(
        db, data_store_id, path, current_user.id, storage
    )
    return {"deleted_count": count}


@router.delete("/images/{image_id}", status_code=204)
async def delete_image(
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageBackend = Depends(get_storage),
) -> None:
    """Delete an image."""
    await image_service.delete_image(db, image_id, current_user.id, storage)


@router.post("/images/batch-delete", status_code=200)
async def batch_delete_images(
    body: BatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageBackend = Depends(get_storage),
) -> dict:
    """Delete multiple images by IDs."""
    count = await image_service.batch_delete_images(db, body.image_ids, storage)
    return {"deleted_count": count}


@router.patch("/images/batch-move", status_code=200)
async def batch_move_images(
    body: BatchMoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Move multiple images to a target folder."""
    count = await image_service.batch_move_images(
        db, body.image_ids, body.target_folder
    )
    return {"updated_count": count}


@router.post(
    "/data-stores/{data_store_id}/folders/batch-delete", status_code=200
)
async def batch_delete_folders(
    data_store_id: int,
    body: BatchFolderDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageBackend = Depends(get_storage),
) -> dict:
    """Delete multiple folders and their contents."""
    await data_store_service.get_data_store(db, data_store_id)
    count = await image_service.batch_delete_folders(
        db, data_store_id, body.paths, current_user.id, storage
    )
    return {"deleted_count": count}


@router.patch(
    "/data-stores/{data_store_id}/folders/batch-move", status_code=200
)
async def batch_move_folders(
    data_store_id: int,
    body: BatchFolderMoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Move multiple folders to a target folder."""
    await data_store_service.get_data_store(db, data_store_id)
    count = await image_service.batch_move_folders(
        db, data_store_id, body.paths, body.target_folder
    )
    return {"updated_count": count}
