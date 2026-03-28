"""refactor version 3part to 2part

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-27 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. minor_version 컬럼 추가 (nullable 허용)
    op.add_column('task_snapshots', sa.Column('minor_version', sa.Integer(), nullable=True))

    # 2. 기존 데이터 변환
    #    - is_stash=true인 행은 minor_version=0 고정
    op.execute("""
        UPDATE task_snapshots
        SET minor_version = 0
        WHERE is_stash = true
    """)

    #    - is_stash=false인 행: task별 major_version 그룹 내에서
    #      created_at 순서로 0, 1, 2... 순차 부여
    op.execute("""
        UPDATE task_snapshots AS ts
        SET minor_version = sub.rn
        FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY task_id, major_version
                    ORDER BY created_at
                ) - 1 AS rn
            FROM task_snapshots
            WHERE is_stash = false
        ) AS sub
        WHERE ts.id = sub.id
    """)

    # 3. minor_version을 NOT NULL로 변경
    op.alter_column('task_snapshots', 'minor_version', nullable=False)

    # 4. 기존 partial unique index 삭제 (task_id, major_version, data_version, label_version)
    op.drop_index('ix_task_snapshots_version_unique', table_name='task_snapshots')

    # 5. 새 partial unique index 생성: (task_id, major_version, minor_version) WHERE is_stash = false
    op.create_index(
        'ix_task_snapshots_version_unique',
        'task_snapshots',
        ['task_id', 'major_version', 'minor_version'],
        unique=True,
        postgresql_where=sa.text('is_stash = false'),
    )

    # 6. data_version, label_version 컬럼 삭제
    op.drop_column('task_snapshots', 'data_version')
    op.drop_column('task_snapshots', 'label_version')


def downgrade() -> None:
    # 정보 손실로 복원 불가
    pass
