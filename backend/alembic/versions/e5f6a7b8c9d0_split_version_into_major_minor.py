"""split version into major_version and minor_version

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-23 04:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 새 컬럼 추가 (nullable로 먼저)
    op.add_column('task_snapshots', sa.Column('major_version', sa.Integer(), nullable=True))
    op.add_column('task_snapshots', sa.Column('minor_version', sa.Integer(), nullable=True))

    # 기존 데이터 변환
    op.execute('UPDATE task_snapshots SET major_version = 1, minor_version = version - 1')

    # NOT NULL 적용
    op.alter_column('task_snapshots', 'major_version', nullable=False)
    op.alter_column('task_snapshots', 'minor_version', nullable=False)

    # 기존 unique constraint 제거
    op.drop_constraint('task_snapshots_task_id_version_key', 'task_snapshots', type_='unique')

    # 기존 version 컬럼 제거
    op.drop_column('task_snapshots', 'version')

    # 새 unique constraint 생성
    op.create_unique_constraint(
        'task_snapshots_task_id_major_version_minor_version_key',
        'task_snapshots',
        ['task_id', 'major_version', 'minor_version'],
    )


def downgrade() -> None:
    # 새 unique constraint 제거
    op.drop_constraint(
        'task_snapshots_task_id_major_version_minor_version_key',
        'task_snapshots',
        type_='unique',
    )

    # version 컬럼 복원 (nullable로 먼저)
    op.add_column('task_snapshots', sa.Column('version', sa.Integer(), nullable=True))

    # 데이터 복원: minor_version + 1 → version
    op.execute('UPDATE task_snapshots SET version = minor_version + 1')

    # NOT NULL 적용
    op.alter_column('task_snapshots', 'version', nullable=False)

    # 새 컬럼 제거
    op.drop_column('task_snapshots', 'major_version')
    op.drop_column('task_snapshots', 'minor_version')

    # 기존 unique constraint 복원
    op.create_unique_constraint(
        'task_snapshots_task_id_version_key',
        'task_snapshots',
        ['task_id', 'version'],
    )
