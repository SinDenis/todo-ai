from flask import Blueprint, request, jsonify
from datetime import datetime
from .models import Todo

api = Blueprint('api', __name__)

def get_storage():
    from flask import current_app
    return current_app.config['storage']

@api.route('/todos', methods=['POST'])
def create_todo():
    data = request.get_json()
    
    try:
        todo = Todo.from_dict(data)
        storage = get_storage()
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