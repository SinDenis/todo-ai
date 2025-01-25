from langchain_openai import OpenAIEmbeddings
from typing import List, Optional, Dict
import numpy as np
from sqlalchemy import select, func, text
from .models import Todo
from functools import lru_cache
import time

def vector_to_float8(vector: List[float]) -> str:
    """Convert vector to PostgreSQL float8[] format"""
    return f"[{','.join(str(x) for x in vector)}]"

class TodoRetriever:
    def __init__(self, storage, embeddings: OpenAIEmbeddings):
        self.storage = storage
        self.embeddings = embeddings
        self.context_todos: Optional[List[Todo]] = None
        self.similarity_threshold = 0.1  # Add similarity threshold
        
    def set_context(self, todos: List[Todo]):
        """Set the context todos for local search"""
        self.context_todos = todos
        
    def clear_context(self):
        """Clear the context todos"""
        self.context_todos = None
        
    @lru_cache(maxsize=100)
    def _get_embedding(self, text: str) -> List[float]:
        """Cache embeddings to avoid regenerating them"""
        start_time = time.time()
        result = self.embeddings.embed_query(text)
        print(f"Embedding generation took: {time.time() - start_time:.2f} seconds", flush=True)
        return result
    
    def _search_in_context(self, query: str, top_k: int = 10) -> List[Todo]:  # Increase default top_k
        """Search for similar todos in the provided context"""
        if not self.context_todos:
            return []
            
        print("\n=== Searching in provided context ===", flush=True)
        start_time = time.time()
        
        # Get query embedding
        query_embedding = self._get_embedding(query)
        
        # Get embeddings for context todos
        todo_embeddings = []
        for todo in self.context_todos:
            if todo.description:
                emb = self._get_embedding(todo.description)
                todo_embeddings.append((todo, emb))
        
        # Calculate similarities
        similarities = []
        for todo, emb in todo_embeddings:
            similarity = float(np.dot(query_embedding, emb))
            if similarity >= self.similarity_threshold:  # Only include todos above threshold
                todo.similarity_score = similarity
                similarities.append((todo, similarity))
        
        # Sort by similarity and get top_k
        similarities.sort(key=lambda x: x[1], reverse=True)
        results = [todo for todo, _ in similarities[:top_k]]
        
        print(f"Context search took: {time.time() - start_time:.2f} seconds", flush=True)
        print(f"Found {len(results)} similar todos in context", flush=True)
        return results
        
    def get_relevant_todos(self, query: str, top_k: int = 10) -> List[Todo]:  # Increase default top_k
        """
        Retrieve most relevant todos using vector similarity search
        First tries to search in context if available, falls back to database search
        """
        try:
            print(f"\n=== Starting similarity search for query: '{query}' ===", flush=True)
            print(f"Requested top_k: {top_k}", flush=True)
            
            # If we have context, search there first
            if self.context_todos is not None:
                return self._search_in_context(query, top_k)
            
            # Otherwise, search in database
            start_total = time.time()
            print("\n1. Generating embedding...", flush=True)
            query_embedding = self._get_embedding(query)
            print(f"Embedding vector size: {len(query_embedding)}", flush=True)
            
            with self.storage.Session() as session:
                print("\n2. Executing SQL query...", flush=True)
                sql = text("""
                    WITH similarity_scores AS (
                        SELECT id, name, description, deadline, created_at, completed,
                               1 - (embedding <=> :query_vector) as similarity_score
                        FROM todos
                        WHERE embedding IS NOT NULL
                    )
                    SELECT *
                    FROM similarity_scores
                    WHERE similarity_score >= :threshold
                    ORDER BY similarity_score DESC
                    LIMIT :limit;
                """)
                
                start_query = time.time()
                results = session.execute(
                    sql,
                    {
                        "query_vector": vector_to_float8(query_embedding),
                        "threshold": self.similarity_threshold,
                        "limit": top_k
                    }
                ).all()
                query_time = time.time() - start_query
                print(f"SQL query took: {query_time:.2f} seconds", flush=True)
                
                print("\n3. Processing results...", flush=True)
                start_processing = time.time()
                todos = [Todo(
                    id=row.id,
                    name=row.name,
                    description=row.description,
                    deadline=row.deadline,
                    created_at=row.created_at,
                    completed=row.completed,
                    similarity_score=row.similarity_score
                ) for row in results]
                
                processing_time = time.time() - start_processing
                print(f"Processing results took: {processing_time:.2f} seconds", flush=True)
                
                total_time = time.time() - start_total
                print(f"\n=== Completed database search ===", flush=True)
                print(f"Found {len(todos)} similar todos", flush=True)
                print(f"Total time breakdown:", flush=True)
                print(f"- Embedding generation: {time.time() - start_total - query_time - processing_time:.2f}s", flush=True)
                print(f"- SQL query: {query_time:.2f}s", flush=True)
                print(f"- Results processing: {processing_time:.2f}s", flush=True)
                print(f"- Total time: {total_time:.2f}s", flush=True)
                print("=" * 50 + "\n", flush=True)
                return todos
                
        except Exception as e:
            print(f"Error in get_relevant_todos: {str(e)}", flush=True)
            return []

    def get_context_for_prompt(self, query: str) -> str:
        """
        Get relevant todos and format them as context for the prompt
        """
        try:
            relevant_todos = self.get_relevant_todos(query)
            
            if not relevant_todos:
                return ""
            
            # Set found todos as context for future searches
            self.set_context(relevant_todos)
                
            return "Context from similar existing todos:\n" + "\n".join(
                f"- {todo.name}: {todo.description}"
                for todo in relevant_todos
            )
        except Exception as e:
            print(f"Error in get_context_for_prompt: {str(e)}", flush=True)
            return "" 