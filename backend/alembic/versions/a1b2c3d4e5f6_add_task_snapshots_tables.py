"""add task_snapshots and task_snapshot_items tables

Revision ID: a1b2c3d4e5f6
Revises: 3f57854882f4
Create Date: 2026-03-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3f57854882f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'task_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('labeled_image_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('annotation_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('class_schema_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id', 'version'),
    )
    op.create_index(op.f('ix_task_snapshots_id'), 'task_snapshots', ['id'], unique=False)

    op.create_table(
        'task_snapshot_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('snapshot_id', sa.Integer(), nullable=False),
        sa.Column('image_id', sa.Integer(), nullable=False),
        sa.Column('folder_path', sa.String(length=1000), nullable=False, server_default=''),
        sa.Column('annotation_data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['image_id'], ['images.id'], ),
        sa.ForeignKeyConstraint(['snapshot_id'], ['task_snapshots.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('snapshot_id', 'image_id'),
    )
    op.create_index(op.f('ix_task_snapshot_items_id'), 'task_snapshot_items', ['id'], unique=False)
    op.create_index(op.f('ix_task_snapshot_items_snapshot_id'), 'task_snapshot_items', ['snapshot_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_task_snapshot_items_snapshot_id'), table_name='task_snapshot_items')
    op.drop_index(op.f('ix_task_snapshot_items_id'), table_name='task_snapshot_items')
    op.drop_table('task_snapshot_items')
    op.drop_index(op.f('ix_task_snapshots_id'), table_name='task_snapshots')
    op.drop_table('task_snapshots')
