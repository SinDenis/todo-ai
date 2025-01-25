// API base URLs
const API_BASE_URL = 'http://localhost:8000/api';
const OPENAI_API_URL = 'https://openai-proxy.tcsbank.ru/public/v1/chat/completions';

// You'll need to replace this with your actual OpenAI API key
const OPENAI_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJPcGVuQUkgcHJveHkgKExEQVApIiwic3ViIjoidXNlciBhdXRoZW50aWNhdGlvbiIsImV4cCI6MTczNzkwOTM5MCwiaWF0IjoxNzM3ODIyOTkwLCJsb2dpbiI6InN2Y19tcy1qYXJ2aXMtb3BlbmFpIiwiZ3JvdXBzIjpbInRicC1vcGVuYWktcHJveHktcHVibGljLWFsbCJdfQ.KHY6EjZBo0ykgJNzBwGVNG47C-lzG3OpnJ7EW4GvgvE';

// Helper function to format date for display
const formatDateForDisplay = (dateString) => {
    return new Date(dateString).toLocaleString();
};

// Function to create a todo
async function createTodo(todo) {
    try {
        const response = await fetch(`${API_BASE_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(todo)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Created todo: ${todo.name}`);
        return data;
    } catch (error) {
        console.error(`❌ Failed to create todo: ${todo.name}`);
        console.error(error.message);
    }
}

// Function to fetch todos
async function fetchTodos(page = 1, perPage = 5, search = null) {
    try {
        let url = `${API_BASE_URL}/todos?page=${page}&per_page=${perPage}`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }
        
        const response = await fetch(
            url
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch todos:', error);
        return null;
    }
}

// Function to delete a todo
async function deleteTodo(todoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/todos/${todoId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error(`Failed to delete todo ${todoId}:`, error);
        return false;
    }
}

// Function to get a specific todo
async function getTodo(todoId) {
    try {
        const response = await fetch(`${API_BASE_URL}/todos/${todoId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Failed to get todo ${todoId}:`, error);
        return null;
    }
}

// Function to process user input with LLM
async function processUserInput(input, context = null) {
    try {
        const messages = [
            {
                role: "system",
                content: `You are a todo list assistant. Your job is to create structured todos from user input. Always ensure all required fields are filled with meaningful content.

                Rules:
                1. Name must be clear and concise (max 50 chars)
                2. Description must provide detailed context (min 20 chars, max 200 chars)
                3. For deadline:
                   - If user specifies a time frame, use it
                   - If no time specified, default to 1 day
                   - Never leave deadline empty
                   - Convert all time references to number of days (e.g., "next week" = 7)
                4. For search/delete, extract meaningful search terms
                5. For updates, ensure all fields are properly filled
                6. When user provides multiple tasks, create separate entries for each task
                7. Maximum 5 tasks per input to prevent overload
                8. For updates:
                   - Use the provided todo context to understand what's being updated
                   - Only include fields that need to be changed
                   - Maintain existing values for unchanged fields
                   - Use the todo's ID from the context

                Respond in JSON format with the following structure:
                {
                    "action": "create" | "delete" | "search" | "update",
                    "data": {
                        // For single task create:
                        "name": "task name",
                        "description": "task description",
                        "deadline": "suggested deadline in days from now"
                        
                        // For multiple tasks create:
                        "tasks": [
                            {
                                "name": "task 1 name",
                                "description": "task 1 description",
                                "deadline": "deadline in days"
                            },
                            {
                                "name": "task 2 name",
                                "description": "task 2 description",
                                "deadline": "deadline in days"
                            }
                        ]
                        
                        // For delete/search:
                        "searchTerm": "search term or id"
                        
                        // For update:
                        "todoId": "id of todo to update",
                        "updates": {
                            "name": "new name",
                            "description": "new description",
                            "deadline": "new deadline in days"
                        }
                    }
                }
                
                Example responses:
                1. Input: "I need to: 1. buy groceries tomorrow, 2. call dentist next week, 3. fix the car by friday"
                  Output: {
                      "action": "create",
                      "data": {
                          "tasks": [
                              {
                                  "name": "Buy Groceries",
                                  "description": "Purchase necessary groceries and household items for daily needs",
                                  "deadline": 1
                              },
                              {
                                  "name": "Call Dentist",
                                  "description": "Schedule dental appointment and discuss treatment plan",
                                  "deadline": 7
                              },
                              {
                                  "name": "Fix Car",
                                  "description": "Take car to mechanic for repairs and maintenance",
                                  "deadline": 3
                              }
                          ]
                      }
                  }

                2. Input: "need to prepare presentation for next week"
                   Output: {
                       "action": "create",
                       "data": {
                           "name": "Prepare Presentation",
                           "description": "Create and finalize presentation materials, including slides, notes, and supporting documents",
                           "deadline": 7
                       }
                   }

                3. Input: "remove the grocery task"
                   Output: {
                       "action": "delete",
                       "data": {
                           "searchTerm": "grocery"
                       }
                   }
                
                4. Input: "change the deadline to next friday" (with todo context)
                   Output: {
                       "action": "update",
                       "data": {
                           "todoId": 123,
                           "updates": {
                               "deadline": 5
                           }
                       }
                   }

                Only respond with valid JSON, no additional text.`
            }
        ];

        // If there's context, add it before the user input
        if (context) {
            messages.push({
                role: "system",
                content: `Current todo context:\n${JSON.stringify(context, null, 2)}`
            });
        }

        messages.push({
            role: "user",
            content: input
        });

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: messages
            })
        });

        if (!response.ok) {
            throw new Error(`LLM API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(data);
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('Failed to process input with LLM:', error);
        return null;
    }
}

// Function to create the chat UI
function createChatUI(container) {
    const uiContainer = document.createElement('div');
    uiContainer.innerHTML = `
        <div class="app-container">
            <div class="chat-container">
                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-input-container">
                    <input type="text" id="chatInput" placeholder="Type your request (e.g., 'Create a todo for buying groceries tomorrow')">
                    <button id="sendButton">Send</button>
                </div>
            </div>
            <div class="todos-container">
                <h2>All Todos</h2>
                <div class="todos-list" id="todosList"></div>
                <div class="pagination">
                    <button id="prevPage">Previous</button>
                    <span id="pageInfo"></span>
                    <button id="nextPage">Next</button>
                </div>
            </div>
            <div id="editForm" class="edit-form" style="display: none;">
                <h3>Edit Todo</h3>
                <input type="text" id="editName" placeholder="Name">
                <textarea id="editDescription" placeholder="Description"></textarea>
                <input type="datetime-local" id="editDeadline">
                <div class="edit-actions">
                    <button id="saveEdit">Save</button>
                    <button id="cancelEdit" class="secondary">Cancel</button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(uiContainer);

    return {
        messagesContainer: uiContainer.querySelector('#chatMessages'),
        input: uiContainer.querySelector('#chatInput'),
        sendButton: uiContainer.querySelector('#sendButton'),
        editForm: uiContainer.querySelector('#editForm'),
        editName: uiContainer.querySelector('#editName'),
        editDescription: uiContainer.querySelector('#editDescription'),
        editDeadline: uiContainer.querySelector('#editDeadline'),
        saveEditButton: uiContainer.querySelector('#saveEdit'),
        cancelEditButton: uiContainer.querySelector('#cancelEdit'),
        todosList: uiContainer.querySelector('#todosList'),
        prevButton: uiContainer.querySelector('#prevPage'),
        nextButton: uiContainer.querySelector('#nextPage'),
        pageInfo: uiContainer.querySelector('#pageInfo')
    };
}

// Function to add a message to the chat
function addMessage(container, text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user' : 'assistant'}`;
    messageDiv.textContent = text;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Function to render todos in the list
function renderTodosList(todos, container) {
    // Sort todos by creation date, newest first
    const sortedTodos = [...todos].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
    
    container.innerHTML = sortedTodos.map(todo => `
        <div class="todo-item ${todo.completed ? 'completed' : ''}">
            <div class="todo-header">
                <h3>${todo.name}</h3>
                <span class="todo-id">#${todo.id}</span>
            </div>
            <p>${todo.description}</p>
            <div class="todo-dates">
                <span>Created: ${formatDateForDisplay(todo.created_at)}</span>
                <span>Deadline: ${formatDateForDisplay(todo.deadline)}</span>
            </div>
            <div class="todo-status">
                Status: ${todo.completed ? 'Completed' : 'Pending'}
            </div>
        </div>
    `).join('');
}

// Function to update the todos list
async function updateTodosList(ui, page = 1) {
    const result = await fetchTodos(page);
    if (result) {
        renderTodosList(result.items, ui.todosList);
        ui.prevButton.disabled = page <= 1;
        ui.nextButton.disabled = page >= result.pages;
        ui.pageInfo.textContent = `Page ${page} of ${result.pages}`;
        return result.pages;
    }
    return 0;
}

// Function to handle user input
async function handleUserInput(input, ui) {
    // Show loading state
    ui.input.disabled = true;
    ui.sendButton.disabled = true;
    ui.sendButton.textContent = 'Processing...';
    
    addMessage(ui.messagesContainer, input, true);
    
    const result = await processUserInput(input);
    if (!result) {
        addMessage(ui.messagesContainer, "Sorry, I couldn't process your request.");
        // Reset loading state
        ui.input.disabled = false;
        ui.sendButton.disabled = false;
        ui.sendButton.textContent = 'Send';
        return;
    }

    try {
        switch (result.action) {
            case 'create':
                // Check if it's a single task or multiple tasks
                if (result.data.tasks) {
                    // Handle multiple tasks
                    const createdTasks = [];
                    for (const taskData of result.data.tasks) {
                        const todo = {
                            name: taskData.name,
                            description: taskData.description,
                            deadline: new Date(Date.now() + taskData.deadline * 24 * 60 * 60 * 1000).toISOString()
                        };
                        const createdTodo = await createTodo(todo);
                        if (createdTodo) {
                            createdTasks.push(createdTodo.name);
                        }
                    }
                    if (createdTasks.length > 0) {
                        addMessage(ui.messagesContainer, `Created ${createdTasks.length} todos:\n${createdTasks.map(name => `- ${name}`).join('\n')}`);
                    }
                } else {
                    // Handle single task
                    const todo = {
                        name: result.data.name,
                        description: result.data.description,
                        deadline: new Date(Date.now() + result.data.deadline * 24 * 60 * 60 * 1000).toISOString()
                    };
                    await createTodo(todo);
                    addMessage(ui.messagesContainer, `Created todo: ${todo.name}`);
                }
                break;

            case 'delete':
                const searchResult = await fetchTodos(1, 100, result.data.searchTerm);
                if (searchResult && searchResult.items.length > 0) {
                    const todoToDelete = searchResult.items[0];
                    await deleteTodo(todoToDelete.id);
                    addMessage(ui.messagesContainer, `Deleted todo: ${todoToDelete.name}`);
                } else {
                    addMessage(ui.messagesContainer, "Couldn't find a todo matching your description.");
                }
                break;

            case 'search':
                const foundTodos = await fetchTodos(1, 5, result.data.searchTerm);
                if (foundTodos && foundTodos.items.length > 0) {
                    const resultsList = foundTodos.items
                        .map(todo => `- ${todo.name} (Due: ${formatDateForDisplay(todo.deadline)})`)
                        .join('\n');
                    addMessage(ui.messagesContainer, `Found todos:\n${resultsList}`);
                } else {
                    addMessage(ui.messagesContainer, "No todos found matching your search.");
                }
                break;

            case 'update':
                // First, search for the todo using the search term
                const searchResults = await fetchTodos(1, 5, result.data.searchTerm);
                
                if (!searchResults || searchResults.items.length === 0) {
                    addMessage(ui.messagesContainer, "Couldn't find the todo you want to update.");
                    return;
                }
                
                // Use the first matching todo as context
                const todoToUpdate = searchResults.items[0];
                
                // Process the update request again with the todo context
                const updateResult = await processUserInput(input, todoToUpdate);
                
                if (todoToUpdate) {
                    if (updateResult && updateResult.action === 'update') {
                        // Create updated todo object
                        const updatedTodo = {
                            ...todoToUpdate,
                            name: updateResult.data.updates.name || todoToUpdate.name,
                            description: updateResult.data.updates.description || todoToUpdate.description,
                            deadline: updateResult.data.updates.deadline ? 
                                new Date(Date.now() + updateResult.data.updates.deadline * 24 * 60 * 60 * 1000).toISOString() :
                                todoToUpdate.deadline
                        };
                        
                        // Update the todo
                        const response = await fetch(`${API_BASE_URL}/todos/${todoToUpdate.id}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(updatedTodo)
                        });
                        
                        if (response.ok) {
                            addMessage(ui.messagesContainer, `Updated todo: ${updatedTodo.name}`);
                            updateTodosList(ui, currentPage);
                        } else {
                            addMessage(ui.messagesContainer, "Failed to update the todo.");
                        }
                    }
                } else {
                    addMessage(ui.messagesContainer, "Couldn't find the todo you want to update.");
                }
                break;
        }
    } finally {
        // Reset loading state
        ui.input.disabled = false;
        ui.sendButton.disabled = false;
        ui.sendButton.textContent = 'Send';
    }

    updateTodosList(ui);
}

// Add styles
function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .app-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            max-width: 800px;
            margin: 20px auto;
        }

        .chat-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            height: 40vh;
        }

        .todos-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 20px;
        }

        .todos-container h2 {
            margin: 0 0 20px 0;
            color: #333;
        }

        .todo-item {
            border: 1px solid #ddd;
            margin: 10px 0;
            padding: 15px;
            border-radius: 4px;
            background-color: #f9f9f9;
        }

        .todo-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .todo-id {
            color: #666;
            font-size: 0.9em;
        }

        .chat-messages {
            flex-grow: 1;
            overflow-y: auto;
            padding: 20px;
        }

        .chat-message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 8px;
            max-width: 80%;
        }

        .chat-message.user {
            background: #e3f2fd;
            margin-left: auto;
        }

        .chat-message.assistant {
            background: #f5f5f5;
            margin-right: auto;
        }

        .chat-input-container {
            display: flex;
            padding: 20px;
            border-top: 1px solid #eee;
        }

        .chat-input-container input {
            flex-grow: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 10px;
        }

        .edit-form {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            width: 300px;
        }

        .edit-form input,
        .edit-form textarea {
            width: 100%;
            margin-bottom: 10px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        .edit-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-top: 20px;
        }

        .pagination button {
            padding: 5px 10px;
            border: none;
            background: #4CAF50;
            color: white;
            border-radius: 4px;
            cursor: pointer;
        }

        .pagination button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }

        .chat-input-container input:disabled,
        .chat-input-container button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        
        .chat-input-container button:disabled {
            background-color: #cccccc;
        }
    `;
    document.head.appendChild(style);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    addStyles();
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    const ui = createChatUI(container);
    
    // Initialize chat message
    addMessage(ui.messagesContainer, "Hello! I can help you manage your todos. Just tell me what you want to do.");
    
    // Initialize todos list
    let currentPage = 1;
    updateTodosList(ui, currentPage);
    
    // Add event listeners for chat input
    ui.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && ui.input.value.trim()) {
            handleUserInput(ui.input.value.trim(), ui);
            ui.input.value = '';
        }
    });
    
    ui.sendButton.addEventListener('click', () => {
        if (ui.input.value.trim()) {
            handleUserInput(ui.input.value.trim(), ui);
            ui.input.value = '';
        }
    });
    
    // Add pagination event listeners
    ui.prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateTodosList(ui, currentPage);
        }
    });
    
    ui.nextButton.addEventListener('click', () => {
        currentPage++;
        updateTodosList(ui, currentPage);
    });
    
    // Update todos list after each action
    const originalHandleUserInput = handleUserInput;
    handleUserInput = async (input, ui) => {
        await originalHandleUserInput(input, ui);
        updateTodosList(ui, currentPage);
    };
}); 