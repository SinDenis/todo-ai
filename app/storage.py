from typing import List, Optional, Tuple
from sqlalchemy import create_engine, select, desc, func
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from .models import Base, Todo

class TodoStorage:
    def __init__(self, database_url: str):
        self.engine = create_engine(database_url)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.model = Todo

    def create(self, todo: Todo) -> Todo:
        with self.Session() as session:
            session.add(todo)
            session.commit()
            session.refresh(todo)
            return todo

    def get(self, todo_id: int) -> Optional[Todo]:
        with self.Session() as session:
            return session.get(Todo, todo_id)

    def update(self, todo_id: int, todo_data: dict) -> Optional[Todo]:
        with self.Session() as session:
            todo = session.get(Todo, todo_id)
            if todo:
                for key, value in todo_data.items():
                    setattr(todo, key, value)
                session.commit()
                session.refresh(todo)
            return todo

    def delete(self, todo_id: int) -> bool:
        with self.Session() as session:
            todo = session.get(Todo, todo_id)
            if todo:
                session.delete(todo)
                session.commit()
                return True
            return False

    def list(self, page: int = 1, per_page: int = 10, search: Optional[str] = None) -> Tuple[List[Todo], int]:
        with self.Session() as session:
            query = select(Todo)
            
            if search:
                search = search.lower()
                query = query.where(
                    (Todo.name.ilike(f'%{search}%')) |
                    (Todo.description.ilike(f'%{search}%'))
                )
            
            # Get total count
            total = session.scalar(select(func.count()).select_from(query.subquery()))
            
            # Apply sorting and pagination
            query = query.order_by(desc(Todo.created_at))
            query = query.offset((page - 1) * per_page).limit(per_page)
            
            todos = session.scalars(query).all()
            return todos, total

    def get_by_ids(self, todo_ids: List[int]) -> List[Todo]:
        """Get multiple todos by their IDs, maintaining the order of the input IDs"""
        with self.Session() as session:
            # Get all todos matching the IDs
            todos = session.query(Todo).filter(Todo.id.in_(todo_ids)).all()
            
            # Create a map for quick lookup
            todo_map = {todo.id: todo for todo in todos}
            
            # Return todos in the same order as input IDs
            return [todo_map.get(id) for id in todo_ids if id in todo_map] 