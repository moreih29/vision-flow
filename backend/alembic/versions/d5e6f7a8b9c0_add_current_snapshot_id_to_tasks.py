"""add current_snapshot_id to tasks

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-03-27 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. current_snapshot_id 컬럼 추가 (nullable, FK 없이 먼저)
    op.add_column(
        'tasks',
        sa.Column('current_snapshot_id', sa.Integer(), nullable=True),
    )

    # 2. 기존 Task에 최신 스냅샷 ID로 채우기
    op.execute(
        """
        UPDATE tasks SET current_snapshot_id = (
            SELECT id FROM task_snapshots
            WHERE task_snapshots.task_id = tasks.id
              AND task_snapshots.is_stash = false
            ORDER BY major_version DESC, minor_version DESC
            LIMIT 1
        )
        """
    )

    # 3. FK constraint 추가 (use_alter 대응 — 별도 op)
    op.create_foreign_key(
        'fk_tasks_current_snapshot_id',
        'tasks',
        'task_snapshots',
        ['current_snapshot_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    # FK 삭제 → 컬럼 삭제
    op.drop_constraint('fk_tasks_current_snapshot_id', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'current_snapshot_id')
