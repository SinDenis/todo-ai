from apscheduler.schedulers.background import BackgroundScheduler
from langchain_openai import OpenAIEmbeddings
from sqlalchemy import select, update
from datetime import datetime
import os
from .retriever import TodoRetriever

def create_scheduler(app):
    scheduler = BackgroundScheduler()
    
    embeddings = OpenAIEmbeddings(
        openai_api_key=os.getenv('OPENAI_API_KEY'),
        openai_api_base=os.getenv('OPENAI_API_BASE', 'https://openai-proxy.tcsbank.ru/public/v1'),
        model="text-embedding-ada-002"
    )
    
    def vectorize_todos():
        with app.app_context():
            storage = app.config['storage']
            
            # Get todos without embeddings
            with storage.Session() as session:
                query = select(storage.model).where(storage.model.embedding.is_(None))
                todos = session.scalars(query).all()
                
                for todo in todos:
                    # Combine name and description
                    text = f"{todo.name}\n{todo.description}"
                    
                    try:
                        # Generate embedding
                        embedding = embeddings.embed_query(text)
                        
                        # Update todo with embedding
                        stmt = (
                            update(storage.model)
                            .where(storage.model.id == todo.id)
                            .values(embedding=embedding)
                        )
                        session.execute(stmt)
                        
                        print(f"✅ Vectorized todo {todo.id}: {todo.name}")
                    except Exception as e:
                        print(f"❌ Failed to vectorize todo {todo.id}: {str(e)}")
                
                session.commit()
    
    # Add job to run every 5 seconds
    scheduler.add_job(
        vectorize_todos,
        'interval',
        seconds=5,
        next_run_time=datetime.now()  # Run immediately on start
    )
    
    return scheduler 