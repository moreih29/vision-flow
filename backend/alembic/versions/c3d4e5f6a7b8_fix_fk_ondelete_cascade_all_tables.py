"""fix FK ondelete CASCADE for all child tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-23 02:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # folder_meta.data_store_id
    op.drop_constraint('folder_meta_data_store_id_fkey', 'folder_meta', type_='foreignkey')
    op.create_foreign_key(
        'folder_meta_data_store_id_fkey',
        'folder_meta', 'data_stores',
        ['data_store_id'], ['id'],
        ondelete='CASCADE',
    )

    # images.data_store_id
    op.drop_constraint('images_data_store_id_fkey', 'images', type_='foreignkey')
    op.create_foreign_key(
        'images_data_store_id_fkey',
        'images', 'data_stores',
        ['data_store_id'], ['id'],
        ondelete='CASCADE',
    )

    # data_stores.project_id
    op.drop_constraint('data_stores_project_id_fkey', 'data_stores', type_='foreignkey')
    op.create_foreign_key(
        'data_stores_project_id_fkey',
        'data_stores', 'projects',
        ['project_id'], ['id'],
        ondelete='CASCADE',
    )

    # tasks.project_id
    op.drop_constraint('tasks_project_id_fkey', 'tasks', type_='foreignkey')
    op.create_foreign_key(
        'tasks_project_id_fkey',
        'tasks', 'projects',
        ['project_id'], ['id'],
        ondelete='CASCADE',
    )

    # task_images.task_id
    op.drop_constraint('task_images_task_id_fkey', 'task_images', type_='foreignkey')
    op.create_foreign_key(
        'task_images_task_id_fkey',
        'task_images', 'tasks',
        ['task_id'], ['id'],
        ondelete='CASCADE',
    )

    # label_classes.task_id
    op.drop_constraint('label_classes_task_id_fkey', 'label_classes', type_='foreignkey')
    op.create_foreign_key(
        'label_classes_task_id_fkey',
        'label_classes', 'tasks',
        ['task_id'], ['id'],
        ondelete='CASCADE',
    )

    # annotations.task_image_id
    op.drop_constraint('annotations_task_image_id_fkey', 'annotations', type_='foreignkey')
    op.create_foreign_key(
        'annotations_task_image_id_fkey',
        'annotations', 'task_images',
        ['task_image_id'], ['id'],
        ondelete='CASCADE',
    )

    # task_folder_meta.task_id
    op.drop_constraint('task_folder_meta_task_id_fkey', 'task_folder_meta', type_='foreignkey')
    op.create_foreign_key(
        'task_folder_meta_task_id_fkey',
        'task_folder_meta', 'tasks',
        ['task_id'], ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    # task_folder_meta.task_id
    op.drop_constraint('task_folder_meta_task_id_fkey', 'task_folder_meta', type_='foreignkey')
    op.create_foreign_key(
        'task_folder_meta_task_id_fkey',
        'task_folder_meta', 'tasks',
        ['task_id'], ['id'],
    )

    # annotations.task_image_id
    op.drop_constraint('annotations_task_image_id_fkey', 'annotations', type_='foreignkey')
    op.create_foreign_key(
        'annotations_task_image_id_fkey',
        'annotations', 'task_images',
        ['task_image_id'], ['id'],
    )

    # label_classes.task_id
    op.drop_constraint('label_classes_task_id_fkey', 'label_classes', type_='foreignkey')
    op.create_foreign_key(
        'label_classes_task_id_fkey',
        'label_classes', 'tasks',
        ['task_id'], ['id'],
    )

    # task_images.task_id
    op.drop_constraint('task_images_task_id_fkey', 'task_images', type_='foreignkey')
    op.create_foreign_key(
        'task_images_task_id_fkey',
        'task_images', 'tasks',
        ['task_id'], ['id'],
    )

    # tasks.project_id
    op.drop_constraint('tasks_project_id_fkey', 'tasks', type_='foreignkey')
    op.create_foreign_key(
        'tasks_project_id_fkey',
        'tasks', 'projects',
        ['project_id'], ['id'],
    )

    # data_stores.project_id
    op.drop_constraint('data_stores_project_id_fkey', 'data_stores', type_='foreignkey')
    op.create_foreign_key(
        'data_stores_project_id_fkey',
        'data_stores', 'projects',
        ['project_id'], ['id'],
    )

    # images.data_store_id
    op.drop_constraint('images_data_store_id_fkey', 'images', type_='foreignkey')
    op.create_foreign_key(
        'images_data_store_id_fkey',
        'images', 'data_stores',
        ['data_store_id'], ['id'],
    )

    # folder_meta.data_store_id
    op.drop_constraint('folder_meta_data_store_id_fkey', 'folder_meta', type_='foreignkey')
    op.create_foreign_key(
        'folder_meta_data_store_id_fkey',
        'folder_meta', 'data_stores',
        ['data_store_id'], ['id'],
    )
