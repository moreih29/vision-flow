from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.snapshot import (
    SnapshotCreate,
    SnapshotDiffResponse,
    SnapshotItemListResponse,
    SnapshotItemResponse,
    SnapshotResponse,
    VersionStatusResponse,
)
from app.services.snapshot import snapshot_service

router = APIRouter(tags=["snapshots"])


@router.get(
    "/tasks/{task_id}/version-status",
    response_model=VersionStatusResponse,
)
async def get_version_status(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VersionStatusResponse:
    """태스크의 현재 버전 상태를 반환합니다. (dirty 여부 및 변경 사항)"""
    from app.services.task import task_service

    await task_service.check_ownership(db, task_id, current_user.id)
    result = await snapshot_service.get_version_status(db, task_id)
    return VersionStatusResponse(**result)


@router.post(
    "/tasks/{task_id}/snapshots",
    response_model=SnapshotResponse,
    status_code=201,
)
async def create_snapshot(
    task_id: int,
    snapshot_in: SnapshotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotResponse:
    """태스크의 현재 상태를 스냅샷으로 저장합니다."""
    snapshot = await snapshot_service.create_snapshot(db, task_id, current_user.id, snapshot_in)
    return SnapshotResponse.model_validate(snapshot)


@router.get(
    "/tasks/{task_id}/snapshots",
    response_model=list[SnapshotResponse],
)
async def list_snapshots(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SnapshotResponse]:
    """태스크의 스냅샷 목록을 최신순으로 조회합니다."""
    from app.services.task import task_service

    await task_service.check_ownership(db, task_id, current_user.id)
    snapshots = await snapshot_service.list_snapshots(db, task_id)
    return [SnapshotResponse.model_validate(s) for s in snapshots]


@router.get(
    "/snapshots/{snapshot_id}",
    response_model=SnapshotResponse,
)
async def get_snapshot(
    snapshot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotResponse:
    """스냅샷 상세를 조회합니다."""
    from app.services.task import task_service

    snapshot = await snapshot_service.get_snapshot(db, snapshot_id)
    await task_service.check_ownership(db, snapshot.task_id, current_user.id)
    return SnapshotResponse.model_validate(snapshot)


@router.get(
    "/snapshots/{snapshot_id}/items",
    response_model=SnapshotItemListResponse,
)
async def list_snapshot_items(
    snapshot_id: int,
    path: str | None = Query(default=None, description="폴더 경로 필터 (정확히 일치)"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotItemListResponse:
    """스냅샷의 이미지+어노테이션 목록을 조회합니다. path로 폴더 필터링이 가능합니다."""
    from app.services.task import task_service

    snapshot = await snapshot_service.get_snapshot(db, snapshot_id)
    await task_service.check_ownership(db, snapshot.task_id, current_user.id)
    items, total = await snapshot_service.get_snapshot_items(db, snapshot_id, path, skip, limit)
    return SnapshotItemListResponse(
        items=[SnapshotItemResponse.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/snapshots/{snapshot_id}/diff/{other_id}",
    response_model=SnapshotDiffResponse,
)
async def diff_snapshots(
    snapshot_id: int,
    other_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotDiffResponse:
    """두 스냅샷을 비교합니다. (추가/삭제된 이미지, 어노테이션 변경, 클래스 호환성)"""
    from app.services.task import task_service

    snapshot_a = await snapshot_service.get_snapshot(db, snapshot_id)
    snapshot_b = await snapshot_service.get_snapshot(db, other_id)
    await task_service.check_ownership(db, snapshot_a.task_id, current_user.id)
    # 두 스냅샷이 같은 task에 속하는지 검증
    if snapshot_a.task_id != snapshot_b.task_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="두 스냅샷이 같은 Task에 속해야 합니다.",
        )
    diff = await snapshot_service.diff_snapshots(db, snapshot_id, other_id)
    return SnapshotDiffResponse(**diff)


@router.post(
    "/snapshots/{snapshot_id}/restore",
    response_model=SnapshotResponse,
)
async def restore_snapshot(
    snapshot_id: int,
    confirm: bool = Body(..., embed=True, description="true여야 복원이 실행됩니다."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotResponse | dict:
    """스냅샷을 현재 태스크 상태로 복원합니다.

    confirm=false이면 영향 범위만 반환합니다 (dry-run).
    confirm=true이면 실제 복원을 실행합니다.
    """
    from app.services.task import task_service

    snapshot = await snapshot_service.get_snapshot(db, snapshot_id)
    await task_service.check_ownership(db, snapshot.task_id, current_user.id)

    if not confirm:
        # dry-run: 영향 범위 반환
        return {
            "dry_run": True,
            "snapshot_id": snapshot_id,
            "version": snapshot.version_string,
            "image_count": snapshot.image_count,
            "annotation_count": snapshot.annotation_count,
            "message": "confirm=true로 재요청하면 복원이 실행됩니다.",
        }

    restored = await snapshot_service.restore_snapshot(db, snapshot_id, current_user.id)
    return SnapshotResponse.model_validate(restored)


@router.delete(
    "/snapshots/{snapshot_id}",
    status_code=204,
)
async def delete_snapshot(
    snapshot_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """스냅샷을 삭제합니다."""
    await snapshot_service.delete_snapshot(db, snapshot_id, current_user.id)


@router.get(
    "/tasks/{task_id}/stash",
    response_model=SnapshotResponse | None,
)
async def get_stash(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotResponse | None:
    """태스크의 stash를 조회합니다. stash가 없으면 null을 반환합니다."""
    from app.services.task import task_service

    await task_service.check_ownership(db, task_id, current_user.id)
    stash = await snapshot_service.get_stash(db, task_id)
    if stash is None:
        return None
    return SnapshotResponse.model_validate(stash)


@router.post(
    "/tasks/{task_id}/stash",
    response_model=SnapshotResponse,
    status_code=201,
)
async def create_stash(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SnapshotResponse:
    """현재 태스크 상태를 stash로 저장합니다. 기존 stash가 있으면 덮어씁니다."""
    stash = await snapshot_service.create_stash(db, task_id, current_user.id)
    return SnapshotResponse.model_validate(stash)


@router.delete(
    "/tasks/{task_id}/stash",
    status_code=204,
)
async def delete_stash(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """태스크의 stash를 삭제합니다."""
    await snapshot_service.delete_stash(db, task_id, current_user.id)
