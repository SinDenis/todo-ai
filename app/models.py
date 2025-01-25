from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from pgvector.sqlalchemy import Vector

Base = declarative_base()

class Todo(Base):
    __tablename__ = 'todos'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    deadline = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed = Column(Boolean, default=False)
    embedding = Column(Vector(1536))  # OpenAI embeddings are 1536-dimensional
    
    # Transient field for similarity score
    def __init__(self, *args, similarity_score=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.similarity_score = similarity_score

    def to_dict(self):
        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'deadline': self.deadline.isoformat(),
            'created_at': self.created_at.isoformat(),
            'completed': self.completed
        }
        if hasattr(self, 'similarity_score') and self.similarity_score is not None:
            result['similarity_score'] = float(self.similarity_score)
        return result

    @staticmethod
    def from_dict(data: dict, todo_id: Optional[int] = None):
        return Todo(
            id=todo_id,
            name=data['name'],
            description=data['description'],
            created_at=datetime.now() if todo_id is None else datetime.fromisoformat(data['created_at']),
            deadline=datetime.fromisoformat(data['deadline']),
            completed=data.get('completed', False)
        ) 