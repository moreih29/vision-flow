"""add 3level version stash hashes

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-23 05:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # minor_version → data_version 리네임
    op.execute("ALTER TABLE task_snapshots RENAME COLUMN minor_version TO data_version")

    # label_version 컬럼 추가 (NOT NULL, default 0)
    op.add_column('task_snapshots', sa.Column('label_version', sa.Integer(), nullable=False, server_default='0'))

    # is_stash 컬럼 추가 (NOT NULL, default False)
    op.add_column('task_snapshots', sa.Column('is_stash', sa.Boolean(), nullable=False, server_default='false'))

    # image_set_hash 컬럼 추가 (nullable)
    op.add_column('task_snapshots', sa.Column('image_set_hash', sa.String(64), nullable=True))

    # annotation_hash 컬럼 추가 (nullable)
    op.add_column('task_snapshots', sa.Column('annotation_hash', sa.String(64), nullable=True))

    # 기존 unique constraint 삭제
    op.drop_constraint(
        'task_snapshots_task_id_major_version_minor_version_key',
        'task_snapshots',
        type_='unique',
    )

    # partial unique index 생성 (is_stash = false인 경우만)
    op.create_index(
        'ix_task_snapshots_version_unique',
        'task_snapshots',
        ['task_id', 'major_version', 'data_version', 'label_version'],
        unique=True,
        postgresql_where=sa.text('is_stash = false'),
    )


def downgrade() -> None:
    # partial unique index 삭제
    op.drop_index('ix_task_snapshots_version_unique', table_name='task_snapshots')

    # 기존 unique constraint 복원
    op.create_unique_constraint(
        'task_snapshots_task_id_major_version_minor_version_key',
        'task_snapshots',
        ['task_id', 'major_version', 'data_version', 'label_version'],
    )

    # 추가 컬럼 제거
    op.drop_column('task_snapshots', 'annotation_hash')
    op.drop_column('task_snapshots', 'image_set_hash')
    op.drop_column('task_snapshots', 'is_stash')
    op.drop_column('task_snapshots', 'label_version')

    # data_version → minor_version 리네임
    op.execute("ALTER TABLE task_snapshots RENAME COLUMN data_version TO minor_version")
