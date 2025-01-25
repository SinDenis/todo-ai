-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE todos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    deadline TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    embedding vector(1536)
);

CREATE INDEX todos_embedding_idx ON todos USING ivfflat (embedding vector_cosine_ops); 