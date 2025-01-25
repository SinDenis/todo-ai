"""initial

Revision ID: initial
Create Date: 2024-01-25 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = 'initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'todos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('deadline', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed', sa.Boolean(), default=False),
        sa.Column('embedding', Vector(1536)),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('todos_embedding_idx', 'todos', ['embedding'], postgresql_using='ivfflat')

def downgrade():
    op.drop_index('todos_embedding_idx')
    op.drop_table('todos') 