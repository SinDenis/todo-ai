from flask import Blueprint, request, jsonify
from datetime import datetime
from .models import Todo
from .retriever import TodoRetriever
from langchain_openai import OpenAIEmbeddings
from functools import lru_cache
import os

api = Blueprint('api', __name__)

@lru_cache(maxsize=1)
def get_embeddings():
    return OpenAIEmbeddings(
        openai_api_key=os.getenv('OPENAI_API_KEY'),
        openai_api_base=os.getenv('OPENAI_API_BASE', 'https://openai-proxy.tcsbank.ru/public/v1'),
        model="text-embedding-ada-002"
    )

def get_storage():
    from flask import current_app
    return current_app.config['storage']

@api.route('/todos', methods=['POST'])
def create_todo():
    data = request.get_json()
    
    try:
        # Get similar todos as context
        storage = get_storage()
        retriever = TodoRetriever(storage, get_embeddings())
        context = retriever.get_context_for_prompt(data.get('description', ''))
        
        # Add context to description if available
        if context:
            data['description'] = f"{data['description']}\n\nContext from similar todos:\n{context}"
        
        todo = Todo.from_dict(data)
        created_todo = storage.create(todo)
        return jsonify(created_todo.to_dict()), 201
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

@api.route('/todos/<int:todo_id>', methods=['GET'])
def get_todo(todo_id):
    storage = get_storage()
    todo = storage.get(todo_id)
    if todo is None:
        return jsonify({'error': 'Todo not found'}), 404
    return jsonify(todo.to_dict())

@api.route('/todos/<int:todo_id>', methods=['PUT'])
def update_todo(todo_id):
    data = request.get_json()
    
    try:
        storage = get_storage()
        updated_todo = storage.update(todo_id, data)
        if updated_todo is None:
            return jsonify({'error': 'Todo not found'}), 404
        return jsonify(updated_todo.to_dict())
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

@api.route('/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    storage = get_storage()
    if storage.delete(todo_id):
        return '', 204
    return jsonify({'error': 'Todo not found'}), 404

@api.route('/todos', methods=['GET'])
def list_todos():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    search = request.args.get('search')

    storage = get_storage()
    todos, total = storage.list(page, per_page, search)
    
    return jsonify({
        'items': [todo.to_dict() for todo in todos],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    })

@api.route('/similar-todos', methods=['GET'])
def get_similar_todos():
    try:
        query = request.args.get('query', '')
        if not query:
            return jsonify({'items': []}), 200

        storage = get_storage()
        retriever = TodoRetriever(storage, get_embeddings())
        
        # Get limit from query params with default value
        limit = min(int(request.args.get('limit', 3)), 10)
        
        similar_todos = retriever.get_relevant_todos(query, top_k=limit)
        return jsonify({
            'items': [todo.to_dict() for todo in similar_todos]
        })
    except Exception as e:
        print(f"Error in similar-todos endpoint: {str(e)}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@api.route('/todos/by-ids', methods=['POST'])
def get_todos_by_ids():
    """Get todos by list of IDs"""
    try:
        data = request.get_json()
        if not data or 'ids' not in data:
            return jsonify({'error': 'Missing ids in request body'}), 400
            
        todo_ids = data['ids']
        if not isinstance(todo_ids, list) or not all(isinstance(id, int) for id in todo_ids):
            return jsonify({'error': 'Invalid ids format. Expected list of integers'}), 400
            
        storage = get_storage()
        todos = storage.get_by_ids(todo_ids)
        
        return jsonify({
            'items': [todo.to_dict() for todo in todos]
        })
    except Exception as e:
        print(f"Error in todos-by-ids endpoint: {str(e)}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500 