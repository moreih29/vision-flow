"""add review_status to task_images

Revision ID: e6f7a8b9c0d1
Revises: deaad1ba7e2d
Create Date: 2026-04-07 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'deaad1ba7e2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'task_images',
        sa.Column(
            'review_status',
            sa.String(length=20),
            nullable=False,
            server_default='unreviewed',
        ),
    )


def downgrade() -> None:
    op.drop_column('task_images', 'review_status')
