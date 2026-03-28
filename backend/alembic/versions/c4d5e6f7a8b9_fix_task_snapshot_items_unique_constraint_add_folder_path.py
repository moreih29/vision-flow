"""fix task_snapshot_items unique constraint to include folder_path

Revision ID: c4d5e6f7a8b9
Revises: b8c9d0e1f2a3
Create Date: 2026-03-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 기존 (snapshot_id, image_id) unique constraint 제거
    op.drop_constraint('task_snapshot_items_snapshot_id_image_id_key', 'task_snapshot_items', type_='unique')

    # 새 (snapshot_id, image_id, folder_path) unique constraint 추가
    op.create_unique_constraint(
        'uq_task_snapshot_items_snapshot_image_folder',
        'task_snapshot_items',
        ['snapshot_id', 'image_id', 'folder_path'],
    )


def downgrade() -> None:
    pass
