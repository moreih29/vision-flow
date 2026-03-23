"""fix FK ondelete for task_snapshot_items and task_images

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-23 01:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # task_snapshot_items.image_id: drop FK → nullable → new FK (SET NULL)
    op.drop_constraint(
        'task_snapshot_items_image_id_fkey',
        'task_snapshot_items',
        type_='foreignkey',
    )
    op.alter_column(
        'task_snapshot_items',
        'image_id',
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_foreign_key(
        'task_snapshot_items_image_id_fkey',
        'task_snapshot_items',
        'images',
        ['image_id'],
        ['id'],
        ondelete='SET NULL',
    )

    # task_images.image_id: drop FK → new FK (CASCADE)
    op.drop_constraint(
        'task_images_image_id_fkey',
        'task_images',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'task_images_image_id_fkey',
        'task_images',
        'images',
        ['image_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    # task_images.image_id: revert to no ondelete
    op.drop_constraint(
        'task_images_image_id_fkey',
        'task_images',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'task_images_image_id_fkey',
        'task_images',
        'images',
        ['image_id'],
        ['id'],
    )

    # task_snapshot_items.image_id: revert to NOT NULL, no ondelete
    op.drop_constraint(
        'task_snapshot_items_image_id_fkey',
        'task_snapshot_items',
        type_='foreignkey',
    )
    op.alter_column(
        'task_snapshot_items',
        'image_id',
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        'task_snapshot_items_image_id_fkey',
        'task_snapshot_items',
        'images',
        ['image_id'],
        ['id'],
    )
