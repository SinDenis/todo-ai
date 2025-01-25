"""add vector index

Revision ID: add_vector_index
Create Date: 2024-03-19 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Create an index for vector operations
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS todos_embedding_idx 
        ON todos 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
        """
    )

def downgrade():
    op.execute("DROP INDEX IF EXISTS todos_embedding_idx;") 