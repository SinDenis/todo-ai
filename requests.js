// API base URLs
const API_BASE_URL = 'http://localhost:8000/api';
const OPENAI_API_URL = 'https://openai-proxy.tcsbank.ru/public/v1/chat/completions';

// You'll need to replace this with your actual OpenAI API key
const OPENAI_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJPcGVuQUkgcHJveHkgKExEQVApIiwic3ViIjoidXNlciBhdXRoZW50aWNhdGlvbiIsImV4cCI6MTczNzkwOTM5MCwiaWF0IjoxNzM3ODIyOTkwLCJsb2dpbiI6InN2Y19tcy1qYXJ2aXMtb3BlbmFpIiwiZ3JvdXBzIjpbInRicC1vcGVuYWktcHJveHktcHVibGljLWFsbCJdfQ.KHY6EjZBo0ykgJNzBwGVNG47C-lzG3OpnJ7EW4GvgvE';

// Helper function to format date for display
const formatDateForDisplay = (dateString) => {
    return new Date(dateString).toLocaleString();
};

// Helper function to get color from gradient
function getGradientColor(score) {
    // Define gradient colors from red to yellow to green
    const colors = [
        { score: 0.00, color: '#ff1744' }, // Red
        { score: 0.25, color: '#ff6d00' }, // Orange
        { score: 0.50, color: '#ffd600' }, // Yellow
        { score: 0.75, color: '#76ff03' }, // Light green
        { score: 1.00, color: '#00c853' }  // Green
    ];
    
    // Find the two colors to interpolate between
    let color1, color2;
    for (let i = 0; i < colors.length - 1; i++) {
        if (score >= colors[i].score && score <= colors[i + 1].score) {
            color1 = colors[i];
            color2 = colors[i + 1];
            break;
        }
    }
    
    if (!color1 || !color2) {
        return score <= 0 ? colors[0].color : colors[colors.length - 1].color;
    }
    
    // Calculate interpolation factor
    const factor = (score - color1.score) / (color2.score - color1.score);
    
    // Convert hex to RGB and interpolate
    const rgb1 = hexToRgb(color1.color);
    const rgb2 = hexToRgb(color2.color);
    
    const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
    const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
    const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));
    
    return `rgb(${r}, ${g}, ${b})`;
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Function to format similarity score for display
function formatSimilarityScore(score) {
    if (!score) return 'N/A';
    const percentage = (score * 100).toFixed(1);
    const color = getGradientColor(score);
    
    // Add CSS variable for the color to use in todo item styling
    const style = `color: ${color}; --match-color: ${color};`;
    return `<span style="${style}">${percentage}%</span>`;
}

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

// Function to fetch todos by IDs
async function fetchTodosByIds(ids) {
    try {
        const response = await fetch(`${API_BASE_URL}/todos/by-ids`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch todos by IDs:', error);
        return null;
    }
}

// Function to process user input with LLM
async function processUserInput(input, context = null) {
    try {
        let similarTodosContext = "";
        
        // Only make the backend search request if we don't have context
        if (!context) {
            const searchResponse = await fetch(`${API_BASE_URL}/similar-todos?query=${encodeURIComponent(input)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (searchResponse.ok) {
                const similarTodos = await searchResponse.json();
                if (similarTodos.items && similarTodos.items.length > 0) {
                    similarTodosContext = "Similar existing todos:\n" + 
                        similarTodos.items.map(todo => 
                            `- ${todo.name}: ${todo.description}`
                        ).join('\n');
                }
            }
        }

        // First prompt to determine operation
        const operationMessages = [
            {
                role: "system",
                content: `You are a todo list operation classifier. Your job is to determine what operation the user wants to perform.
                Possible operations are:
                - create: When user wants to create one or more new todos
                - delete: When user wants to remove existing todos
                - search: When user wants to find or list existing todos
                - update: When user wants to modify existing todos

                Respond with ONLY ONE of these exact words: "create", "delete", "search", "update"
                `
            }
        ];

        if (context) {
            operationMessages.push({
                role: "system",
                content: "User is currently working with an existing todo, so this is likely an update operation."
            });
        }

        operationMessages.push({
            role: "user",
            content: input
        });

        // Get operation decision
        const operationResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: operationMessages,
                temperature: 0.1,
                max_tokens: 10
            })
        });

        if (!operationResponse.ok) {
            throw new Error(`Operation LLM API error: ${operationResponse.status}`);
        }

        const operationData = await operationResponse.json();
        const operation = operationData.choices[0].message.content.trim().toLowerCase();

        // Second prompt based on operation
        const operationPrompts = {
            create: `You are a todo creation assistant. Create structured todos from user input.
                Rules:
                1. Name must be clear and concise (max 50 chars)
                2. Description must provide detailed context (min 20 chars, max 200 chars)
                3. For deadline:
                   - If user specifies a time frame, use it
                   - If no time specified, default to 1 day
                   - Never leave deadline empty
                   - Convert all time references to number of days (e.g., "next week" = 7)
                4. Maximum 5 tasks per input to prevent overload

                Respond in JSON format:
                {
                    "action": "create",
                    "data": {
                        // For single task:
                        "name": "task name",
                        "description": "task description",
                        "deadline": "days from now"
                        
                        // OR for multiple tasks:
                        "tasks": [
                            {
                                "name": "task 1 name",
                                "description": "task 1 description",
                                "deadline": "days"
                            }
                        ]
                    }
                }`,

            delete: `You are a todo deletion assistant. Extract search terms to identify todos for deletion.
                Rules:
                1. Extract the most specific search terms possible
                2. If an ID is mentioned, use that
                3. Consider task names and key identifiers

                Respond in JSON format:
                {
                    "action": "delete",
                    "data": {
                        "searchTerm": "search term or id"
                    }
                }`,

            search: `You are a todo search assistant. Extract search terms to find relevant todos.
                Rules:
                1. Extract meaningful search terms
                2. Consider task names, descriptions, and dates
                3. If an ID is mentioned, use that

                Respond in JSON format:
                {
                    "action": "search",
                    "data": {
                        "searchTerm": "search term or id"
                    }
                }`,

            update: `You are a todo update assistant. Determine what fields need to be updated.
                Rules:
                1. Only include fields that need to be changed
                2. For deadline changes, convert to number of days from now
                3. Maintain existing values for unchanged fields
                4. Use the todo's ID from context

                Respond in JSON format:
                {
                    "action": "update",
                    "data": {
                        "todoId": "id from context",
                        "updates": {
                            "name": "new name",
                            "description": "new description",
                            "deadline": "new deadline in days"
                        }
                    }
                }`
        };

        const messages = [
            {
                role: "system",
                content: operationPrompts[operation]
            }
        ];

        // Add similar todos context if available and not updating
        if (similarTodosContext && operation !== 'update') {
            messages.push({
                role: "system",
                content: `Consider these existing todos when processing the request:\n${similarTodosContext}`
            });
        }

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
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            console.error('OpenAI API error:', await response.text());
            throw new Error(`LLM API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Unexpected OpenAI response:', data);
            throw new Error('Invalid response from OpenAI');
        }
        
        console.log('OpenAI response:', data);
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('Failed to process input with LLM:', error);
        console.error('Error details:', error.stack);
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
function addMessage(container, content, isUser = false, isHTML = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user' : 'assistant'}`;
    if (isHTML) {
        messageDiv.innerHTML = content;
    } else {
        messageDiv.textContent = content;
    }
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Function to handle todo actions
async function handleTodoAction(action, todoId, container) {
    try {
        switch (action) {
            case 'delete':
                if (await deleteTodo(todoId)) {
                    // Remove the todo item from UI
                    const todoElement = container.querySelector(`[data-todo-id="${todoId}"]`);
                    if (todoElement) {
                        todoElement.remove();
                    }
                }
                break;
            case 'complete':
            case 'uncomplete':
                const response = await fetch(`${API_BASE_URL}/todos/${todoId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ completed: action === 'complete' })
                });
                
                if (response.ok) {
                    // Update the todo item in UI
                    const todoElement = container.querySelector(`[data-todo-id="${todoId}"]`);
                    if (todoElement) {
                        if (action === 'complete') {
                            todoElement.classList.add('completed');
                        } else {
                            todoElement.classList.remove('completed');
                        }
                        
                        const nameElement = todoElement.querySelector('.todo-name');
                        if (nameElement) {
                            nameElement.style.textDecoration = action === 'complete' ? 'line-through' : 'none';
                        }
                        
                        const statusElement = todoElement.querySelector('.todo-status');
                        if (statusElement) {
                            statusElement.textContent = `Status: ${action === 'complete' ? 'Completed' : 'Pending'}`;
                        }
                        
                        const actionsContainer = todoElement.querySelector('.todo-actions');
                        if (actionsContainer) {
                            const newButton = action === 'complete' ?
                                `<button class="uncomplete-action" onclick="handleTodoAction('uncomplete', ${todoId}, this.closest('.${container.classList.contains('chat-todos-list') ? 'chat-todos-list' : 'todos-list'}'))">Uncomplete</button>` :
                                `<button class="complete-action" onclick="handleTodoAction('complete', ${todoId}, this.closest('.${container.classList.contains('chat-todos-list') ? 'chat-todos-list' : 'todos-list'}'))">Complete</button>`;
                            
                            const deleteButton = actionsContainer.querySelector('.delete-action').outerHTML;
                            actionsContainer.innerHTML = deleteButton + newButton;
                        }
                    }
                }
                break;
        }
    } catch (error) {
        console.error(`Failed to ${action} todo ${todoId}:`, error);
    }
}

// Function to render todos in the list
function renderTodosList(todos, container) {
    // Sort todos by similarity score (if present) then by creation date
    const sortedTodos = [...todos].sort((a, b) => {
        if (a.similarity_score !== undefined && b.similarity_score !== undefined) {
            return b.similarity_score - a.similarity_score;
        }
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    container.innerHTML = sortedTodos.map(todo => `
        <div class="todo-item ${todo.completed ? 'completed' : ''} ${todo.similarity_score ? 'with-score' : ''}" 
             data-todo-id="${todo.id}">
            <div class="todo-header">
                <h3 class="todo-name" style="${todo.completed ? 'text-decoration: line-through;' : ''}">${todo.name}</h3>
                <div class="todo-meta">
                    ${todo.similarity_score !== undefined ? 
                        `<span class="similarity-score">Match: ${formatSimilarityScore(todo.similarity_score)}</span>` 
                        : ''}
                    <span class="todo-id">#${todo.id}</span>
                </div>
            </div>
            <p>${todo.description}</p>
            <div class="todo-dates">
                <span>Created: ${formatDateForDisplay(todo.created_at)}</span>
                <span>Deadline: ${formatDateForDisplay(todo.deadline)}</span>
            </div>
            <div class="todo-footer">
                <div class="todo-status">
                    Status: ${todo.completed ? 'Completed' : 'Pending'}
                </div>
                <div class="todo-actions">
                    <button class="delete-action" onclick="handleTodoAction('delete', ${todo.id}, this.closest('.todos-list'))">Delete</button>
                    ${todo.completed ? 
                        `<button class="uncomplete-action" onclick="handleTodoAction('uncomplete', ${todo.id}, this.closest('.todos-list'))">Uncomplete</button>` :
                        `<button class="complete-action" onclick="handleTodoAction('complete', ${todo.id}, this.closest('.todos-list'))">Complete</button>`
                    }
                </div>
            </div>
        </div>
    `).join('');
}

// Function to render todos in chat
function renderTodosInChat(todos, container) {
    const todosHTML = `
        <div class="chat-todos-list">
            <div class="chat-todos-header">Found ${todos.length} relevant todos:</div>
            ${todos.map(todo => `
                <div class="chat-todo-item ${todo.completed ? 'completed' : ''} ${todo.similarity_score ? 'with-score' : ''}"
                     data-todo-id="${todo.id}">
                    <div class="todo-header">
                        <h4 class="todo-name" style="${todo.completed ? 'text-decoration: line-through;' : ''}">${todo.name}</h4>
                        <div class="todo-meta">
                            ${todo.similarity_score !== undefined ? 
                                `<span class="similarity-score">Match: ${formatSimilarityScore(todo.similarity_score)}</span>` 
                                : ''}
                            <span class="todo-id">#${todo.id}</span>
                        </div>
                    </div>
                    <p class="todo-description">${todo.description}</p>
                    <div class="todo-dates">
                        <span>Created: ${formatDateForDisplay(todo.created_at)}</span>
                        <span>Deadline: ${formatDateForDisplay(todo.deadline)}</span>
                    </div>
                    <div class="todo-footer">
                        <div class="todo-status">
                            Status: ${todo.completed ? 'Completed' : 'Pending'}
                        </div>
                        <div class="todo-actions">
                            <button class="delete-action" onclick="handleTodoAction('delete', ${todo.id}, this.closest('.chat-todos-list'))">Delete</button>
                            ${todo.completed ? 
                                `<button class="uncomplete-action" onclick="handleTodoAction('uncomplete', ${todo.id}, this.closest('.chat-todos-list'))">Uncomplete</button>` :
                                `<button class="complete-action" onclick="handleTodoAction('complete', ${todo.id}, this.closest('.chat-todos-list'))">Complete</button>`
                            }
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    addMessage(container, todosHTML, false, true);
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
    
    try {
        // Get similar todos first
        const searchResponse = await fetch(`${API_BASE_URL}/similar-todos?query=${encodeURIComponent(input)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        let similarTodos = [];
        if (searchResponse.ok) {
            const response = await searchResponse.json();
            similarTodos = response.items || [];
        }

        // First prompt to determine operation
        const operationMessages = [
            {
                role: "system",
                content: `You are a todo list operation classifier. Your job is to determine what operation the user wants to perform.
                Possible operations are:
                - create: When user wants to create one or more new todos
                - delete: When user wants to remove existing todos
                - search: When user wants to find or list existing todos
                - update: When user wants to modify existing todos

                Respond with ONLY ONE of these exact words: "create", "delete", "search", "update"
                `
            },
            {
                role: "user",
                content: input
            }
        ];

        const operationResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: operationMessages,
                temperature: 0.1,
                max_tokens: 10
            })
        });

        if (!operationResponse.ok) {
            throw new Error(`Operation LLM API error: ${operationResponse.status}`);
        }

        const operationData = await operationResponse.json();
        const operation = operationData.choices[0].message.content.trim().toLowerCase();

        // For search operation, use LLM to analyze similar todos
        if (operation === 'search' && similarTodos.length > 0) {
            const searchMessages = [
                {
                    role: "system",
                    content: `You are a todo search assistant. Analyze the user's search query and the available todos to find the most relevant matches.
                    Rules:
                    1. Consider semantic similarity, not just exact matches
                    2. Look for matches in task names, descriptions, and deadlines
                    3. Rank results by relevance
                    4. Return a JSON array of todo IDs in order of relevance
                    5. Only include todos that are truly relevant to the query
                    6. Consider dates and time references in the query
                    7. Consider similarity scores in ranking (higher is better)
                    8. Only include todos with similarity score above 0.1 (10%)

                    Available todos with similarity scores:
                    ${JSON.stringify(similarTodos, null, 2)}

                    Respond with a JSON array of todo IDs in order of relevance.
                    Example: [5, 2, 8]
                    `
                },
                {
                    role: "user",
                    content: input
                }
            ];

            const searchResponse = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: searchMessages,
                    temperature: 0.2,
                    max_tokens: 100
                })
            });

            if (!searchResponse.ok) {
                throw new Error(`Search LLM API error: ${searchResponse.status}`);
            }

            const searchData = await searchResponse.json();
            const relevantIds = JSON.parse(searchData.choices[0].message.content);
            
            // Fetch full todo objects with their current state
            const result = await fetchTodosByIds(relevantIds);
            if (result && result.items.length > 0) {
                // Add similarity scores from the similar todos
                const todosWithScores = result.items.map(todo => {
                    const similarTodo = similarTodos.find(st => st.id === todo.id);
                    return {
                        ...todo,
                        similarity_score: similarTodo ? similarTodo.similarity_score : undefined
                    };
                });

                // Render todos in chat
                renderTodosInChat(todosWithScores, ui.messagesContainer);
                
                // Update the todos list with the search results
                renderTodosList(todosWithScores, ui.todosList);
                return;
            } else {
                addMessage(ui.messagesContainer, "No todos found matching your search criteria.");
                return;
            }
        }

        // For other operations, proceed with the existing logic
        const result = await processUserInput(input);
        if (!result) {
            addMessage(ui.messagesContainer, "Sorry, I couldn't process your request.");
            return;
        }

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
    } catch (error) {
        console.error('Error processing input:', error);
        addMessage(ui.messagesContainer, "Sorry, an error occurred while processing your request.");
    } finally {
        // Reset loading state
        ui.input.disabled = false;
        ui.sendButton.disabled = false;
        ui.sendButton.textContent = 'Send';
    }
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
        
        .todo-meta {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .similarity-score {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
            background-color: ${transparentize('var(--match-color)', 0.9)};
            border: 1px solid var(--match-color);
            font-weight: 500;
        }
        
        .todo-item.with-score,
        .chat-todo-item.with-score {
            border-left: 4px solid var(--match-color);
            background-color: ${transparentize('var(--match-color)', 0.95)};
        }
        
        @property --match-color {
            syntax: '<color>';
            initial-value: #e0e0e0;
            inherits: true;
        }
        
        .chat-todos-list {
            width: 100%;
            margin: 10px 0;
        }
        
        .chat-todos-header {
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
        }
        
        .chat-todo-item {
            border: 1px solid #ddd;
            margin: 8px 0;
            padding: 12px;
            border-radius: 4px;
            background-color: #f9f9f9;
            font-size: 0.95em;
        }
        
        .chat-todo-item h4 {
            margin: 0;
            font-size: 1.1em;
            color: #333;
        }
        
        .chat-todo-item .todo-description {
            margin: 8px 0;
            color: #555;
        }
        
        .chat-todo-item .todo-dates {
            font-size: 0.9em;
            color: #666;
            margin: 8px 0;
            display: flex;
            gap: 15px;
        }
        
        .chat-todo-item .todo-status {
            font-size: 0.9em;
            color: #666;
        }
        
        .chat-message.assistant .chat-todo-item.with-score {
            border-left: 4px solid;
            border-left-color: var(--match-color, #e0e0e0);
        }
        
        .chat-message.assistant .chat-todo-item.with-score[style*="--match-color: #4caf50"] {
            background-color: #f1f8e9;
        }
        
        .chat-message.assistant .chat-todo-item.with-score[style*="--match-color: #ff9800"] {
            background-color: #fff3e0;
        }
        
        .chat-message.assistant .chat-todo-item.with-score[style*="--match-color: #f44336"] {
            background-color: #ffebee;
        }
        
        .todo-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #eee;
        }
        
        .todo-actions {
            display: flex;
            gap: 8px;
        }
        
        .todo-actions button {
            padding: 4px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            transition: background-color 0.2s;
        }
        
        .delete-action {
            background-color: #ff5252;
            color: white;
        }
        
        .delete-action:hover {
            background-color: #ff1744;
        }
        
        .complete-action {
            background-color: #4caf50;
            color: white;
        }
        
        .complete-action:hover {
            background-color: #43a047;
        }
        
        .uncomplete-action {
            background-color: #ffc107;
            color: black;
        }
        
        .uncomplete-action:hover {
            background-color: #ffb300;
        }
        
        .todo-item.completed {
            opacity: 0.8;
            background-color: #f5f5f5;
        }
        
        .chat-todo-item .todo-actions button {
            padding: 3px 10px;
            font-size: 0.85em;
        }
    `;
    document.head.appendChild(style);
}

// Helper function to create transparent color
function transparentize(color, opacity) {
    return `color-mix(in srgb, ${color}, transparent ${opacity * 100}%)`;
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