"""fix task_image unique constraint to include folder_path

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-03-27 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 기존 (task_id, image_id) unique constraint 제거
    op.drop_constraint('task_images_task_id_image_id_key', 'task_images', type_='unique')

    # 새 (task_id, image_id, folder_path) unique constraint 추가
    op.create_unique_constraint(
        'uq_task_images_task_id_image_id_folder_path',
        'task_images',
        ['task_id', 'image_id', 'folder_path'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_task_images_task_id_image_id_folder_path', 'task_images', type_='unique')
    op.create_unique_constraint(
        'task_images_task_id_image_id_key',
        'task_images',
        ['task_id', 'image_id'],
    )
